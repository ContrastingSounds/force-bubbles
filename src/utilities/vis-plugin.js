const pluginDefaults = {
  dimensionLabels: true,
  dimensionHide: false,
  measureLabels: true,
  measureStyles: [],
  colorBy: false,
  groupBy: false,
  sizeBy: false,
}

const newArray = function(length, value) {
  var arr = []
  for (var l = 0; l < length; l++) {
    arr.push(value)
  }
  return arr
}

/**
 * Represents a row in the dataset that populates the table.
 * @class
 */
class Row {
  constructor() {
    this.id = ''
    this.data = {}
  }
}

/**
 * Represents a column in the dataset that populates the table.
 * Ensures all key vis properties (e.g. 'label') are consistent across different field types
 * 
 * @class
 */
class Column {
  constructor(id) {
    this.id = id
    this.label = '' // queryResponse.fields.measures[n].label_short
    this.view = '' // queryResponse.fields.measures[n].view_label
    this.levels = []
    this.field = {} // Looker field definition
    this.field_name = ''
    this.type = '' // dimension | measure
    this.pivoted = false
    this.super = false
    this.pivot_key = '' // queryResponse.pivots[n].key // single string that concats all pivot values
  }
}

/**
 * Represents an "enriched data object" with additional methods and properties for data vis
 * Takes the data, config and queryResponse objects as inputs to the constructor
 */
class VisPluginModel {
  /**
   * Build the sourceData object
   * @constructor
   * 
   * 1. Check for pivots and supermeasures
   * 2. Add dimensions, list of ids, list of full objects
   * 3. Add measures, list of ids, list of full objects
   * 4. Build rows
   * 
   * @param {*} sourceData 
   * @param {*} config 
   * @param {*} queryResponse 
   */
  constructor(sourceData, config, queryResponse) {
    this.config = config
    this.columns = []
    this.dimensions = []
    this.measures = []
    this.ranges = {}
    this.data = []
    this.pivot_fields = []
    this.pivot_values = []
    this.has_pivots = typeof queryResponse.pivots === 'undefined' ? false : true
    this.has_supers = typeof queryResponse.fields.supermeasure_like === 'undefined' ? false : true
    
    if (this.has_pivots) {
      this.addPivots(queryResponse)
    }
    this.addDimensions(config, queryResponse)
    this.addMeasures(config, queryResponse)
    this.buildRows(sourceData)
  }

  addPivots(queryResponse) {
    queryResponse.fields.pivots.forEach(pivot => {
      this.pivot_fields.push({
        name: pivot.name,
        label: pivot.label_short || pivot.label,
        view: pivot.view_label || '',
      }) 
      this.ranges[pivot.name] = {set : []}
    })
    
    this.ranges['lookerPivotKey'] = {set: []}
    this.pivot_values = queryResponse.pivots
    this.pivot_values.forEach(pivot_value => {
      this.ranges['lookerPivotKey'].set.push(pivot_value.key)

      for (var key in pivot_value.data) {
        var current_set = this.ranges[key].set
        var row_value = pivot_value.data[key]
        if (current_set.indexOf(row_value) === -1) {
          current_set.push(row_value)
        }
      } 
    })
  }

  addDimensions(config, queryResponse) {
    queryResponse.fields.dimension_like.forEach(dimension => {
      this.dimensions.push({
        name: dimension.name,
        label: dimension.label_short || dimension.label,
        view: dimension.view_label || '',
      })
      this.ranges[dimension.name] = {
        set: [],
      }

      var column = new Column(dimension.name)
      column.levels = newArray(queryResponse.fields.pivots.length, '') // populate empty levels when pivoted
      column.field = dimension
      column.field_name = dimension.name
      column.label = column.field.label_short || column.field.label
      column.view = column.field.view_label
      column.type = 'dimension'
      column.pivoted = false
      column.super = false

      if (typeof config['hide|' + column.id] !== 'undefined') {
        if (config['hide|' + column.id]) {
          column.hide = true
        }
      }

      this.columns.push(column)
    })
  }

  addMeasures(config, queryResponse) {
    // add measures, list of ids
    for (var m = 0; m < queryResponse.fields.measure_like.length; m++) {
      this.measures.push({
        name: queryResponse.fields.measure_like[m].name,
        label: queryResponse.fields.measure_like[m].label_short || queryResponse.fields.measure_like[m].label,
        view: queryResponse.fields.measure_like[m].view_label || '',
        is_table_calculation: typeof queryResponse.fields.measure_like[m].is_table_calculation !== 'undefined',
      }) 
      this.ranges[queryResponse.fields.measure_like[m].name] = {
        min: 100000000,
        max: 0,
      }
    }
    
    // add measures, list of full objects
    if (this.has_pivots) {
      for (var p = 0; p < this.pivot_values.length; p++) {
        for (var m = 0; m < this.measures.length; m++) {
          var include_measure = (                                     // for pivoted measures, skip table calcs for row totals
            this.pivot_values[p]['key'] != '$$$_row_total_$$$'        // if user wants a row total for table calc, must define separately
          ) || (
            this.pivot_values[p]['key'] == '$$$_row_total_$$$' 
            && this.measures[m].is_table_calculation == false
          )

          if (include_measure) {
            var pivotKey = this.pivot_values[p]['key']
            var measureName = this.measures[m].name
            var columnId = pivotKey + '.' + measureName

            var levels = [] // will contain a list of all the pivot values for this column
            var level_sort_values = []
            for (var pf = 0; pf < queryResponse.fields.pivots.length; pf++) { 
              var pf_name = queryResponse.fields.pivots[pf].name
              levels.push(this.pivot_values[p]['data'][pf_name])
              level_sort_values.push(this.pivot_values[p]['sort_values'][pf_name]) 
            }

            var column = new Column(columnId)
            column.levels = levels
            column.field = queryResponse.fields.measure_like[m]
            column.field_name = queryResponse.fields.measure_like[m].name
            column.label = column.field.label_short || column.field.label
            column.view = column.field.view_label
            column.type = 'measure'
            column.pivoted = true
            column.super = false
            column.pivot_key = pivotKey

            // TODO: Hide function

            this.columns.push(column)
          }
        }
      }
    } else {
      // noticeably simpler for flat tables!
      for (var m = 0; m < this.measures.length; m++) {
        var column = new Column(this.measures[m].name)
        console.log('addMeasures() col.id', column.id)

        column.field = queryResponse.fields.measure_like[m]
        column.field_name = queryResponse.fields.measure_like[m].name
        column.label = column.field.label_short || column.field.label
        column.view = column.field.view_label
        column.type = 'measure'
        column.pivoted = false
        column.super = false
        this.columns.push(column)

      }
    }
    
    // add supermeasures, if present
    if (typeof queryResponse.fields.supermeasure_like !== 'undefined') {
      for (var s = 0; s < queryResponse.fields.supermeasure_like.length; s++) {
        var column_name = queryResponse.fields.supermeasure_like[s].name
        this.measures.push({
          name: queryResponse.fields.supermeasure_like[s].name,
          label: queryResponse.fields.supermeasure_like[s].label,
          view: '',
        }) 

        var column = new Column(column_name)
        column.levels = newArray(queryResponse.fields.pivots.length, '')
        column.field = queryResponse.fields.supermeasure_like[s]
        column.field_name = queryResponse.fields.supermeasure_like[s].name
        column.label = column.field.label_short || column.field.label
        column.view = column.field.view_label
        column.type = 'measure'
        column.pivoted = false
        column.super = true

        this.columns.push(column)
      }
    }
  }

  buildRows(sourceData) {
    sourceData.forEach(sourceRow => {
      var row = new Row()
      
      
      for (var c = 0; c < this.columns.length; c++) {
        // flatten data, if pivoted. Looker's data structure is nested for pivots (to a single level, no matter how many pivots)
        var column = this.columns[c]
        if (column.pivoted) {
          row.data[column.id] = sourceRow[column.field_name][column.pivot_key]
        } else {
          row.data[column.id] = sourceRow[column.id]
        }

        // build ranges object (mix/max for measures, unique values for dimensions)
        if (typeof row.data[column.id] !== 'undefined') {
          if (column.type === 'measure') {
            var current_min = this.ranges[column.field_name].min
            var current_max = this.ranges[column.field_name].max
            var row_value = row.data[column.id].value

            this.ranges[column.field_name].min = Math.min(current_min, row_value)
            this.ranges[column.field_name].max = Math.max(current_max, row_value)
          } else if (column.type === 'dimension') {
            var current_set = this.ranges[column.field_name].set
            var row_value = row.data[column.id].value

            if (current_set.indexOf(row_value) === -1) {
              current_set.push(row_value)
            }
          }
        }
      }

      row.id = this.dimensions.map(dim => sourceRow[dim.name].value).join('|')

      this.data.push(row)
    })
  }

  
  /**
   * Returns dataset as a simple json object
   * Includes line_items only (e.g. no row subtotals)
   * 
   * @param {boolean} includeRowId - adds a unique lookerId value to each row
   * @param {boolean} melt - if dataset is pivoted, will 'melt' back to flat data
   */
  getJson(includeRowId=true, melt=false) {
    var jsonData = []
    if (!this.has_pivots || !melt) {
      this.data.forEach(r => {
        var row = {}
        this.columns.forEach(c => {
            row[c.id] = r.data[c.id].value
          })
        if (includeRowId) {
          row['lookerId'] = r.id
        }
        jsonData.push(row)
      })
    } else {
      this.pivot_values.forEach(p => {
        this.data.forEach(r => {
          var row = {}
          for (var pivot_value in p.data) {
            row[pivot_value] = p.data[pivot_value]
          }
          this.columns // 'flat fields' i.e. dimensions and supermeasures
            .filter(c => c.type === 'dimension' || c.super)
            .forEach(c => {
              row[c.id] = r.data[c.id].value
            })
          this.columns // 'pivoted fields' i.e. measures
            .filter(c => c.pivoted)
            .forEach(c => {
              var valueRef = p.key + '.' + c.field_name
              row[c.field_name] = r.data[valueRef].value
            })
          if (includeRowId) {
            row['lookerId'] = p.key + '|' + r.id
          }
          row['lookerPivotKey'] = p.key
          jsonData.push(row)
        })
      })
    }
    return jsonData
  }
}

const getConfigOptions = function(visModel, optionChoices=pluginDefaults, baseOptions={}) {
  var optionChoices = {...pluginDefaults, ...optionChoices} 
  var newOptions = baseOptions

  if (optionChoices.sizeBy) {
    var sizeByOptions = [];
    for (var i = 0; i < visModel.measures.length; i++) {
        var option = {};
        option[visModel.measures[i].label] = visModel.measures[i].name;
        sizeByOptions.push(option);
    }
  
    newOptions["sizeBy"] = {
        section: " Visualization",
        type: "string",
        label: "Size By",
        display: "select",
        values: sizeByOptions,
        default: "0",
        order: 300,
    }
  }

  // colorByOptions include:
  // - by dimension
  // - by pivot key (which are also dimensions)
  // - by pivot series (one color per column)
  var colorByOptions = [];
  for (var i = 0; i < visModel.dimensions.length; i++) {
      var option = {};
      option[visModel.dimensions[i].label] = visModel.dimensions[i].name;
      colorByOptions.push(option)
  }

  for (var i = 0; i < visModel.pivot_fields.length; i++) {
    var option = {};
    option[visModel.pivot_fields[i].label] = visModel.pivot_fields[i].name;
    colorByOptions.push(option)
  }

  if (visModel.pivot_fields.length > 1 ) {
    colorByOptions.push({'Pivot Series': 'lookerPivotKey'})
  }
  
  if (optionChoices.colorBy) {
    newOptions["colorBy"] = {
      section: " Visualization",
      type: "string",
      label: "Color By",
      display: "select",
      values: colorByOptions,
      default: "0",
      order: 100,
    } 
  }

  if (optionChoices.groupBy) {
    newOptions["groupBy"] = {
      section: " Visualization",
      type: "string",
      label: "Group By",
      display: "select",
      values: colorByOptions,
      default: "0",
      order: 200,
    } 
  }

  return newOptions
}

export { VisPluginModel, getConfigOptions };

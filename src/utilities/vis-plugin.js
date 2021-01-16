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
    this.label = ''
    this.view = ''
    this.field_name = ''
    this.type = '' // dimension | measure
    this.pivoted = false
    this.super = false
    this.pivot_key = ''
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
    this.columns = []
    this.dimensions = []
    this.measures = []
    this.ranges = {}
    this.data = []
    this.pivot_fields = []
    this.pivot_values = []
    this.has_pivots = typeof queryResponse.pivots !== 'undefined'
    this.has_supers = typeof queryResponse.fields.supermeasure_like !== 'undefined'
    
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
      column.field_name = dimension.name
      column.label = dimension.label_short || dimension.label
      column.view = dimension.view_label
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
    queryResponse.fields.measure_like.forEach(measure => {
      this.measures.push({
        name: measure.name,
        label: measure.label_short || measure.label,
        view: measure.view_label || '',
        is_table_calculation: typeof measure.is_table_calculation !== 'undefined',
      }) 

      this.ranges[measure.name] = {
        min: 100000000,
        max: 0,
      }
    })
    
    // add measures, list of full objects
    if (this.has_pivots) {
      this.pivot_values.forEach(pivot_value => {
        this.measures.forEach(measure => {
          var include_measure = (                          // for pivoted measures, skip table calcs for row totals
            pivot_value['key'] !== '$$$_row_total_$$$'     // if user wants a row total for table calc, must define separately
          ) || (
            pivot_value['key'] === '$$$_row_total_$$$' 
            && !measure.is_table_calculation
          )

          if (include_measure) {
            var column = new Column(pivot_value['key'] + '.' + measure.name)
            column.field_name = measure.name
            column.label = measure.label_short || measure.label
            column.view = measure.view_label
            column.type = 'measure'
            column.pivoted = true
            column.super = false
            column.pivot_key = pivot_value['key']

            this.columns.push(column)
          }
        })
      })
    } else {
      // noticeably simpler for flat tables!
      this.measures.length.forEach(measure => {
        var column = new Column(measure.name)
        column.field_name = measure.name
        column.label = measure.label_short || measure.label
        column.view = measure.view_label
        column.type = 'measure'
        column.pivoted = false
        column.super = false
        this.columns.push(column)
      })
    }
    
    // add supermeasures, if present
    if (this.has_supers) {
      queryResponse.fields.supermeasure_like.forEach(supermeasure => {
        var column_name = supermeasure.name
        this.measures.push({
          name: supermeasure.name,
          label: supermeasure.label,
          view: '',
        })

        this.ranges[supermeasure.name] = {
          min: 100000000,
          max: 0,
        }

        var column = new Column(column_name)
        column.field_name = supermeasure.name
        column.label = supermeasure.label_short || supermeasure.label
        column.view = supermeasure.view_label
        column.type = 'measure'
        column.pivoted = false
        column.super = true

        this.columns.push(column)
      })
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

/**
 * Sets values of visModel.pivot_fields array
 * Gets the range of each pivot field (i.e. the set of unique dimension values)
 * @param {*} queryResponse 
 * @param {*} altVisModel 
 */
const getPivots = (queryResponse, altVisModel) => {
  queryResponse.fields.pivots.forEach(pivot => {
    altVisModel.pivot_fields.push({
      name: pivot.name,
      label: pivot.label_short || pivot.label,
      view: pivot.view_label || '',
    }) 

    altVisModel.ranges[pivot.name] = {set : []}
  })
  
  altVisModel.ranges['lookerPivotKey'] = {set: []}
  queryResponse.pivots.forEach(pivot_value => {
    altVisModel.ranges['lookerPivotKey'].set.push(pivot_value.key)

    for (var key in pivot_value.data) {
      var current_set = altVisModel.ranges[key].set
      var row_value = pivot_value.data[key]
      if (current_set.indexOf(row_value) === -1) {
        current_set.push(row_value)
      }
    } 
  })
}

const getDimensions = (queryResponse, altVisModel) => {
  queryResponse.fields.dimension_like.forEach(dimension => {
    altVisModel.dimensions.push({
      name: dimension.name,
      label: dimension.label_short || dimension.label,
      view: dimension.view_label || '',
    })
    
    altVisModel.ranges[dimension.name] = { set: [] }

    altVisModel.columns.push({
      id: dimension.name,
      field: dimension.name,
      type: 'dimension',
    })
  })
}

const getMeasures = (queryResponse, altVisModel) => {
  queryResponse.fields.measure_like.forEach(measure => {
    console.log('raw measure', measure)
    altVisModel.measures.push({
      name: measure.name,
      label: measure.label_short || measure.label,
      view: measure.view_label || '',
      is_table_calculation: typeof measure.is_table_calculation !== 'undefined',
      is_row_total: false,
      is_pivoted: queryResponse.pivots.length > 0,
      is_super: false
    }) 

    altVisModel.ranges[measure.name] = {
      min: 100000000,
      max: 0,
    }

    if (queryResponse.has_row_totals) {
      altVisModel.measures.push({
        name: '$$$_row_total_$$$.' + measure.name,
        label: (measure.label_short || measure.label) + ' (Row Total)', 
        view: measure.view_label || '',
        is_table_calculation: false, // table calcs aren't included in row totals
        is_row_total: true,
        is_pivoted: false,
        is_super: false
      }) 
  
      altVisModel.ranges['$$$_row_total_$$$.' + measure.name] = {
        min: 100000000,
        max: 0,
      }     
    }
  })
  
  // add to columns
  if (typeof queryResponse.pivots !== 'undefined') {
    altVisModel.pivot_values.forEach(pivot_value => {
      altVisModel.measures.filter(m => !m.is_row_total).forEach(measure => {
        var shouldAddColumn = (                          // for pivoted measures, skip table calcs for row totals
          pivot_value['key'] !== '$$$_row_total_$$$'     // if user wants a row total for table calc, must define separately
        ) || (
          pivot_value['key'] === '$$$_row_total_$$$' 
          && !measure.is_table_calculation
        )

        if (shouldAddColumn) {
          altVisModel.columns.push({
            id: pivot_value['key'] + '.' + measure.name,
            field: measure.name,
            type: 'measure',
            is_pivoted: true,
            pivot_key: pivot_value['key'],
            is_super: false,
          })
        }
      })
    })
  } else {
    // noticeably simpler for flat tables!
    altVisModel.measures.length.forEach(measure => {      
      columns.push({
        id: measure.name,
        field: measure.name,
        type: 'measure',
        is_pivoted: false,
        is_row_total: false,
        is_super: false,
      })
    })
  }
  
  // add supermeasures, if present
  if (queryResponse.fields.supermeasure_like.length > 0) {
    queryResponse.fields.supermeasure_like.forEach(supermeasure => {
      altVisModel.measures.push({
        name: supermeasure.name,
        label: supermeasure.label,
        view: '',
        is_pivoted: false,
        is_row_total: false,
        is_super: true
      }) 

      altVisModel.columns.push({
        id: supermeasure.name,
        field: supermeasure.name,
        type: 'measure',
        is_pivoted: false,
        is_super: true
      })
    })
  }
}

const getConfigOptions = function(model) {
  const { pivot_fields, dimensions, measures } = model

  var pluginSettings = {
    colorBy: true,
    groupBy: true,
    sizeBy: true,
  }

  var visOptions = {
    scale: {
      section: ' Visualization',
      type: 'number',
      display: 'range',
      label: 'Scale Size By',
      default: 1.0,
      min: 0.2,
      max: 2.0,
      step: 0.2,
      order: 100000,
    }
  }

  if (pluginSettings.sizeBy) {
    var sizeByOptions = [];
    measures.forEach(measure => {
        var option = {};
        option[measure.label] = measure.name;
        sizeByOptions.push(option);
    })
  
    visOptions["sizeBy"] = {
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
  if (pluginSettings.colorBy) {
    var colorByOptions = [];

    dimensions.forEach(dimension => {
        var option = {};
        option[dimension.label] = dimension.name;
        colorByOptions.push(option)
    })
  
    pivot_fields.forEach(pivot_field => {
      var option = {};
      option[pivot_field.label] = pivot_field.name;
      colorByOptions.push(option)
    })
  
    if (pivot_fields.length > 1 ) {
      colorByOptions.push({'Pivot Series': 'lookerPivotKey'})
    }

    visOptions["colorBy"] = {
      section: " Visualization",
      type: "string",
      label: "Color By",
      display: "select",
      values: colorByOptions,
      default: "0",
      order: 100,
    } 
  }

  if (pluginSettings.groupBy) {
    visOptions["groupBy"] = {
      section: " Visualization",
      type: "string",
      label: "Group By",
      display: "select",
      values: colorByOptions,
      default: "0",
      order: 200,
    } 
  }

  console.log('getConfigOptions() returns:', visOptions)
  return visOptions
}

/**
 * 
 * @param {*} data 
 * @param {*} config 
 * @param {*} measures 
 * 
 * The vis requires an object per circle (in data terms, one observation per data point)
 * - For a FLAT table (no pivots), or PIVOTED table charting a ROW TOTAL or SUPERMEASURE, that's one object per row
 *    - In future, tooltips might make use of pivoted values for a richer popover)
 * - For pivoted measures, the data needs to be converted to a TIDY data set
 *    - Each pivot value can be treated as additional dimension(s)
 *    - The raw data structure therefore contains one cell per row per pivot value
 * 
 * Flat, pivoted or tidy
 * - is it pivoted
 * - is a supermeasure selected for sizeBy
 * 
 * - in future, colorBy could also be a color option. If so, color & size will both need to be sync on measure vs supermeasure
 * 
 * ID
 * - if flat or pivoted, concat dimensions
 * - if tidy, concat dimensions + pivot_key
 * 
 * Value
 */
const getData = (data, config, altVisModel) => {
  var tableType
  console.log('config.sizeBy', config.sizeBy)
  const sizeByField = altVisModel.measures.find(measure => measure.name === config.sizeBy)
  console.log('sizeByField', sizeByField)

  if (altVisModel.pivot_fields.length === 0) {
    tableType = 'flat'
  } else if (sizeByField.is_super) {
    tableType = 'pivoted'
  } else if (sizeByField.is_pivoted) {
    tableType = 'tidy'
  } else {
    tableType = 'unknown'
  }

  console.log('table type', tableType)

  var visPayload = {
    altData: 'TBD',
    altRanges: 'TBD'
  }

  if (tableType !== 'tidy') {
    data.forEach(row => {
      row.observationId = altVisModel.dimensions.map(dimension => row[dimension.name].value).join('|')

      altVisModel.dimensions.forEach(dimension => {
        var current_set = altVisModel.ranges[dimension.name].set
        var row_value = row[dimension.name].value

        if (current_set.indexOf(row_value) === -1) {
          current_set.push(row_value)
        }
      })

      altVisModel.measures.forEach(measure => {
        var current_min = altVisModel.ranges[measure.name].min
        var current_max = altVisModel.ranges[measure.name].max
        var row_value = row.data[measure.name].value

        altVisModel.ranges[measure.name].min = Math.min(current_min, row_value)
        altVisModel.ranges[measure.name].max = Math.max(current_max, row_value)
      })
    })
    visPayload.altData = data
  } else {
    var tidyData = []
    data.forEach(row => {
      console.log('row', row)

      altVisModel.dimensions.forEach(dimension => {
        var current_set = altVisModel.ranges[dimension.name].set
        var row_value = row[dimension.name].value

        if (current_set.indexOf(row_value) === -1) {
          current_set.push(row_value)
        }
      })

      altVisModel.measures.filter(m => m.is_row_total || m.is_super).forEach(measure => {
        var current_min = altVisModel.ranges[measure.name].min
        var current_max = altVisModel.ranges[measure.name].max
        var row_value = row.data[measure.name].value

        altVisModel.ranges[measure.name].min = Math.min(current_min, row_value)
        altVisModel.ranges[measure.name].max = Math.max(current_max, row_value)
      })

      altVisModel.measures.filter(m => !m.is_row_total && !m.is_super).forEach(measure => {
        console.log('measure', measure)
        altVisModel.pivot_values.filter(p => !p.is_total).forEach(pivot => {
          console.log('pivot', pivot)

          console.log('measure.name', measure.name)
          console.log('dimensions', ...altVisModel.dimensions.map(dimension => row[dimension.name].value))
          console.log('pivot.key', pivot.key)
          var key = [
            measure.name,
            ...altVisModel.dimensions.map(dimension => row[dimension.name].value),
            pivot.key
          ].join('|')
          console.log('key', key)

          var observation = {
            observationId: key
          }
          observation[measure.name] = row[measure.name][pivot.key]

          var current_min = altVisModel.ranges[measure.name].min
          var current_max = altVisModel.ranges[measure.name].max
          var row_value = row.data[measure.name][pivot.key].value
  
          altVisModel.ranges[measure.name].min = Math.min(current_min, row_value)
          altVisModel.ranges[measure.name].max = Math.max(current_max, row_value)

          tidyData.push(observation)
        })
      })
    })
    visPayload.altData = tidyData
  }

  return visPayload
}

export { VisPluginModel, getPivots, getDimensions, getMeasures, getConfigOptions, getData };

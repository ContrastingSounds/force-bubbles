/**
 * Sets values of visModel.pivot_fields array
 * Gets the range of each pivot field (i.e. the set of unique dimension values)
 * @param {*} queryResponse 
 * @param {*} visModel 
 */
const getPivots = (queryResponse, visModel) => {
  queryResponse.fields.pivots.filter(p => p.key !== '$$$_row_total_$$$').forEach(pivot => {
    visModel.pivot_fields.push({
      name: pivot.name,
      label: pivot.label_short || pivot.label,
      view: pivot.view_label || '',
    }) 

    visModel.ranges[pivot.name] = {set : []}
  })
  
  visModel.ranges['lookerPivotKey'] = {set: []}
  queryResponse.pivots.filter(p => p.key !== '$$$_row_total_$$$').forEach(pivot_value => {
    visModel.ranges['lookerPivotKey'].set.push(pivot_value.key)

    for (var key in pivot_value.data) {
      var current_set = visModel.ranges[key].set
      var row_value = pivot_value.data[key]
      if (current_set.indexOf(row_value) === -1) {
        current_set.push(row_value)
      }
    } 
  })
}

const getDimensions = (queryResponse, visModel) => {
  queryResponse.fields.dimension_like.forEach(dimension => {
    visModel.dimensions.push({
      name: dimension.name,
      label: dimension.label_short || dimension.label,
      view: dimension.view_label || '',
    })
    
    visModel.ranges[dimension.name] = { set: [] }
  })
}

const getMeasures = (queryResponse, visModel) => {
  queryResponse.fields.measure_like.forEach(measure => {
    visModel.measures.push({
      name: measure.name,
      label: measure.label_short || measure.label,
      view: measure.view_label || '',
      is_table_calculation: typeof measure.is_table_calculation !== 'undefined',
      is_row_total: false,
      is_pivoted: queryResponse.pivots.length > 0,
      is_super: false
    }) 

    visModel.ranges[measure.name] = {
      min: 100000000,
      max: 0,
    }

    if (queryResponse.has_row_totals) {
      visModel.measures.push({
        name: '$$$_row_total_$$$.' + measure.name,
        field_name: measure.name,
        label: (measure.label_short || measure.label) + ' (Row Total)', 
        view: measure.view_label || '',
        is_table_calculation: false, // table calcs aren't included in row totals
        is_row_total: true,
        is_pivoted: false,
        is_super: false
      }) 
  
      visModel.ranges['$$$_row_total_$$$.' + measure.name] = {
        min: 100000000,
        max: 0,
      }     
    }
  })
    
  // add supermeasures, if present
  if (queryResponse.fields.supermeasure_like.length > 0) {
    queryResponse.fields.supermeasure_like.forEach(supermeasure => {
      visModel.measures.push({
        name: supermeasure.name,
        label: supermeasure.label,
        view: '',
        is_pivoted: false,
        is_row_total: false,
        is_super: true
      }) 

      visModel.ranges[supermeasure.name] = {
        min: 100000000,
        max: 0,
      }
    })
  }
}

const getConfigOptions = function(model) {
  const { pivot_fields, dimensions, measures } = model

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

  // sizeBy
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

  // colorByOptions include:
  // - by dimension
  // - by pivot key (which are also dimensions)
  // - by pivot series (one color per column)
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

  /// groupBy
  visOptions["groupBy"] = {
    section: " Visualization",
    type: "string",
    label: "Group By",
    display: "select",
    values: colorByOptions,
    default: "0",
    order: 200,
  } 

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
const getData = (data, config, visModel) => {
  var tableType
  const sizeByField = visModel.measures.find(measure => measure.name === config.sizeBy)

  if (visModel.pivot_fields.length === 0) {
    tableType = 'flat'
  } else if (sizeByField.is_row_total || sizeByField.is_super ) {
    tableType = 'pivoted'
  } else if (sizeByField.is_pivoted) {
    tableType = 'tidy'
  } else {
    tableType = 'unknown'
  }

  var visPayload = {
    visData: 'TBD',
    visRanges: 'TBD'
  }

  if (tableType !== 'tidy') {
    data.forEach(row => {
      row.observationId = visModel.dimensions.map(dimension => row[dimension.name].value).join('|')

      visModel.dimensions.forEach(dimension => {
        var current_set = visModel.ranges[dimension.name].set
        var row_value = row[dimension.name].value

        if (current_set.indexOf(row_value) === -1) {
          current_set.push(row_value)
        }
      })

      visModel.measures.forEach(measure => {
        if (measure.is_row_total) {
          row[measure.name] = row[measure.field_name]['$$$_row_total_$$$']
        }

        var current_min = visModel.ranges[measure.name].min
        var current_max = visModel.ranges[measure.name].max

        var row_value = measure.is_row_total 
          ? row[measure.field_name]['$$$_row_total_$$$'].value 
          : row[measure.name].value

        visModel.ranges[measure.name].min = Math.min(current_min, row_value)
        visModel.ranges[measure.name].max = Math.max(current_max, row_value)
      })
    })
    visPayload.visData = data
  } else {
    var tidyData = []
    data.forEach(row => {
      visModel.dimensions.forEach(dimension => {
        var current_set = visModel.ranges[dimension.name].set
        var row_value = row[dimension.name].value

        if (current_set.indexOf(row_value) === -1) {
          current_set.push(row_value)
        }
      })

      visModel.measures.filter(m => m.is_row_total || m.is_super).forEach(measure => {
        var current_min = visModel.ranges[measure.name].min
        var current_max = visModel.ranges[measure.name].max
        var row_value = measure.is_row_total 
          ? row[measure.field_name]['$$$_row_total_$$$'].value 
          : row[measure.name].value

        visModel.ranges[measure.name].min = Math.min(current_min, row_value)
        visModel.ranges[measure.name].max = Math.max(current_max, row_value)
      })

      visModel.pivot_values.filter(p => !p.is_total).forEach(pivot_value => {
        var key = [
          ...visModel.dimensions.map(dimension => row[dimension.name].value),
          pivot_value.key
        ].join('|')

        var observation = {
          observationId: key
        }
        
        visModel.pivot_fields.forEach(pivot_field => {
          observation[pivot_field.name] = {value: pivot_value.data[pivot_field.name]}
        })

        visModel.dimensions.forEach(dimension => {
          observation[dimension.name] = row[dimension.name]
        })

        visModel.measures.filter(m => !m.is_row_total && !m.is_super).forEach(measure => {
          observation[measure.name] = row[measure.name][pivot_value.key]

          var current_min = visModel.ranges[measure.name].min
          var current_max = visModel.ranges[measure.name].max
          var row_value = row[measure.name][pivot_value.key].value

          visModel.ranges[measure.name].min = Math.min(current_min, row_value)
          visModel.ranges[measure.name].max = Math.max(current_max, row_value)
        })

        tidyData.push(observation)
      })
    })
    visPayload.visData = tidyData
  }

  visPayload.visRanges = visModel.ranges
  return visPayload
}

export { getPivots, getDimensions, getMeasures, getConfigOptions, getData };

import React from "react";
import ReactDOM from "react-dom";

import ForceBubbles from "./force-bubbles";
import { 
  getPivots,
  getDimensions,
  getMeasures,
  getConfigOptions,
  getData,
} from "./utilities/vis-plugin.js";


looker.plugins.visualizations.add({
  options: {},

  create: function(element, config) {
    this.chart = ReactDOM.render(<div />, element);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    console.log('data', data)
    console.log('config', config)
    console.log('queryResponse', queryResponse)

    // ERROR HANDLING
    this.clearErrors();

    // INITIALISE THE VIS

    // BUILD THE VIS
    // 1. Create model object
    // 2. Register options
    // 3. Render vis
    
    var visModel = {
      pivot_fields: [],
      pivot_values: [],
      dimensions: [],
      measures: [],
      ranges: {}
    }

    visModel.pivot_values = queryResponse.pivots.filter(p => p.key !== '$$$_row_total_$$$')
    getPivots(queryResponse, visModel)
    getDimensions(queryResponse, visModel)
    getMeasures(queryResponse, visModel)
    console.log('visModel', visModel)
    
    this.trigger('registerOptions', getConfigOptions(visModel))

    const {visData, visRanges} = getData(data, config, visModel)
    console.log('visData', visData)
    console.log('visRanges', visRanges)

    var colorBy = config.colorBy
    var groupBy = config.groupBy

    var sizeMeasure = visModel.measures.find(m => m.name === config.sizeBy)
    if (sizeMeasure.is_row_total || sizeMeasure.is_super) {
      var sizeBy = sizeMeasure.is_super ? config.sizeBy : config.sizeBy.slice(18)
      var list_of_pivot_fields = visModel.pivot_fields.map(p => p.name)
      console.log('list of pivots', list_of_pivot_fields)
      if (list_of_pivot_fields.includes(config.colorBy)) {
        var colorBy = visModel.dimensions[0].name
      }
      if (list_of_pivot_fields.includes(config.groupBy)) {
        var groupBy = visModel.dimensions[0].name
      }
    } else {
      var sizeBy = config.sizeBy
    }

    console.log('colorBy', colorBy)
    console.log('groupBy', groupBy)
    console.log('sizeBy', sizeBy)

    this.chart = ReactDOM.render(
      <ForceBubbles
        colorBy={colorBy}
        groupBy={groupBy}
        sizeBy={sizeBy}
        scale={config.scale}
        data={visData}
        ranges={visRanges}
        width={element.clientWidth}
        height={element.clientHeight}
      />,
      element
    );

    // DEBUG OUTPUT AND DONE
    // console.log('element', element)
    done();
  }
})
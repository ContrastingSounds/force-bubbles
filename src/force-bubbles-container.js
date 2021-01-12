import React from "react";
import ReactDOM from "react-dom";

import ForceBubbles from "./force-bubbles";
import { 
  VisPluginModel, 
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
    // 3. Build vis

    var visModel = new VisPluginModel(data, config, queryResponse)
    // console.log('visModel', visModel)
    
    var altVisModel = {
      pivot_fields: [],
      pivot_values: [],
      dimensions: [],
      measures: [],
      columns: [],
      ranges: {}
    }

    altVisModel.pivot_values = queryResponse.pivots
    getPivots(queryResponse, altVisModel)
    getDimensions(queryResponse, altVisModel)
    getMeasures(queryResponse, altVisModel)
    console.log('altVisModel', altVisModel)
    
    this.trigger('registerOptions', getConfigOptions(altVisModel))

    const visData = visModel.getJson(true, visModel.has_pivots)
    const visModelRanges = visModel.ranges
    console.log('visData', visData)
    console.log('visModelRanges', visModelRanges)

    const {altData, altRanges} = getData(data, config, altVisModel)
    console.log('altData', altData)
    console.log('altRanges', altRanges)

    this.chart = ReactDOM.render(
      <ForceBubbles
        colorBy={config.colorBy}
        groupBy={config.groupBy}
        sizeBy={config.sizeBy}
        scale={config.scale}
        data={visData}
        ranges={visModelRanges}
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
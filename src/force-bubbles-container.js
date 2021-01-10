import React from "react";
import ReactDOM from "react-dom";

import ForceBubbles from "./force-bubbles";
import { 
  VisPluginModel, 
  getConfigOptions 
} from "./utilities/vis-plugin.js";

const visOptions = {
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

looker.plugins.visualizations.add({
  options: visOptions,

  create: function(element, config) {
    console.log('create() config', config)
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
    // 1. Create object
    // 2. Register options
    // 3. Build vis

    var visModel = new VisPluginModel(data, config, queryResponse)
    console.log('visModel', visModel)
    
    var pluginSettings = {
      dimensionLabels: true,
      dimensionHide: false,
      measureLabels: true,
      measureStyles: [],
      colorBy: true,
      groupBy: true,
      sizeBy: true,
      states: {},
    }
    this.trigger('registerOptions', getConfigOptions(visModel, pluginSettings, visOptions))

    // TODO: what props are necessary for ForceBubbles?
       // var visData = visModel.getJson(true, visModel.has_pivots)
       // visModel.config (groupBy, sizeBy, colorBy)
       // .html(visModel.getTooltipFromD3(d))
       // visModel.ranges
    // TODO: Split out vis between D3 bit and e.g. legend (legend def. best done in React!)
    //            vis in D3 or React depending on best practice

    // Flow
    // data, config, queryResponse
    // convert data into simple json array for vis
    // calculate ranges
    // 

    const visData = visModel.getJson(true, visModel.has_pivots)
    const ranges = visModel.ranges

    console.log('config', config)
    console.log('data', visData)
    console.log('ranges', ranges)
    console.log('width', element.clientWidth)
    console.log('height', element.clientHeight)

    this.chart = ReactDOM.render(
      <ForceBubbles
        config={config}
        data={visData}
        ranges={ranges}
        width={element.clientWidth}
        height={element.clientHeight}
      />,
      element
    );

    // DEBUG OUTPUT AND DONE
    console.log('container', this.container)
    done();
  }
})
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
    this.chart = ReactDOM.render(<div />, element);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    // console.log('data', data)
    // console.log('config', config)
    // console.log('queryResponse', queryResponse)

    // ERROR HANDLING
    this.clearErrors();

    // INITIALISE THE VIS

    // BUILD THE VIS
    // 1. Create model object
    // 2. Register options
    // 3. Build vis

    var visModel = new VisPluginModel(data, config, queryResponse)
    // console.log('visModel', visModel)
    
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

    const visData = visModel.getJson(true, visModel.has_pivots)
    const ranges = visModel.ranges

    this.chart = ReactDOM.render(
      <ForceBubbles
        colorBy={config.colorBy}
        groupBy={config.groupBy}
        sizeBy={config.sizeBy}
        scale={config.scale}
        data={visData}
        ranges={ranges}
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
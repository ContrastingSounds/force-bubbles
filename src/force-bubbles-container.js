import React from "react";
import ReactDOM from "react-dom";

import ForceBubbles from "./force-bubbles";
import { 
  VisPluginModel, 
  getConfigOptions 
} from "./utilities/vis-plugin.js";


looker.plugins.visualizations.add({
  options: {},

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
    
    // TODO: streamline options registration (e.g. no need for defaults)

    this.trigger('registerOptions', getConfigOptions(visModel))

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
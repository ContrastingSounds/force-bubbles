import React from "react";
import ReactDOM from "react-dom";

import ForceBubbles from "./force-bubbles";
import { 
  getPivots,
  getDimensions,
  getMeasures,
  getConfigOptions,
  getDataAndRanges,
} from "./force-bubbles-model.js";


looker.plugins.visualizations.add({
  options: {},

  create: function(element, config) {
    this.chart = ReactDOM.render(<div />, element);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    // ERROR HANDLING
    this.clearErrors();

    // TRANSLATE LOOKER OBJECTS INTO STRUCTURE FOR THE VIS

    // 1. Define the structure
    var visModel = {
      pivot_fields: [],
      pivot_values: [],
      dimensions: [],
      measures: [],
      data: [],
      ranges: {}
    }

    // 2. Get the metadata (pivots, dimensions, measures)
    visModel.pivot_values = queryResponse.pivots.filter(p => p.key !== '$$$_row_total_$$$')
    getPivots(queryResponse, visModel)
    getDimensions(queryResponse, visModel)
    getMeasures(queryResponse, visModel)
    
    // 3. Register config options based on the metadata
    this.trigger('registerOptions', getConfigOptions(visModel))

    // 4. Transform raw data to structure suitable for vis
    getDataAndRanges(data, config, visModel)

    
    // VALIDATE CONFIG SETTINGS AGAINST DATA
    // e.g. it is not possible to group by pivot value when sizing by a row total
    var visConfig = {
      colorBy: config.colorBy,
      groupBy: config.groupBy,
      sizeBy: config.sizeBy,
      scale: config.scale
    }

    // If the sizeBy measure is a row total or a supermeasure,
    // the colorBy and groupBy fields MUST be dimensions.
    // If the config isn't a dimension, will default to first dimension.
    var sizeMeasure = visModel.measures.find(m => m.name === config.sizeBy)
    if (sizeMeasure.is_row_total || sizeMeasure.is_super) {
      var list_of_pivot_fields = visModel.pivot_fields.map(p => p.name)
      if (list_of_pivot_fields.includes(config.colorBy)) {
        visConfig.colorBy = visModel.dimensions[0].name
      }
      if (list_of_pivot_fields.includes(config.groupBy)) {
        visConfig.groupBy = visModel.dimensions[0].name
      }
    }

    this.chart = ReactDOM.render(
      <ForceBubbles
        colorBy={visConfig.colorBy}
        groupBy={visConfig.groupBy}
        sizeBy={visConfig.sizeBy}
        scale={visConfig.scale}

        data={visModel.data}
        ranges={visModel.ranges}
        
        width={element.clientWidth}
        height={element.clientHeight}
      />,
      element
    );

    // LET LOOKER KNOW VIS IS COMPLETE
    done();
  }
})
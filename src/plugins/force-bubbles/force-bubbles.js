import { select } from 'd3-selection';
import { transition } from 'd3-transition';
import { scaleOrdinal } from 'd3-scale';
import { schemeAccent } from 'd3-scale-chromatic';
import { forceSimulation, forceManyBody, forceX, forceY, forceCollide } from 'd3-force';

import { VisPluginModel, getConfigOptions } from "../../utilities/vis-plugin.js";

import './force-bubbles.css';

const options = {}

const buildVis = function(config, visModel, width, height) {
  var visData = visModel.getJson(true, visModel.has_pivots)
  console.log('buildVis() visData', visData)

  const colorScale = scaleOrdinal().range(schemeAccent)
  const calcSize = (value) => Math.floor(5 + (value / visModel.ranges[config.sizeBy].max * 45))  
  const calcX = (value) => {
    if (typeof config.groupBy !== 'undefined') {
      var catWidth = visModel.ranges[config.groupBy].set.length + 1
      var catIndex = visModel.ranges[config.groupBy].set.indexOf(value) + 1
      return width / catWidth * catIndex
    } else {
      return width / 2
    }
  }

  const tick = function() {
    var u = select('svg')
      .selectAll('circle')
      .data(visData, d => d.lookerId)
  
    u.enter()
        .append('circle')
        .attr('r', d => calcSize(d[config.sizeBy]))
        .attr('cx', d => Math.random() * width)
        .attr('cy', d => Math.random() * height)
        .style('fill', d => colorScale(d[config.colorBy]))
      .merge(u)
        .transition()
        .duration(100)
        .attr('r', d => calcSize(d[config.sizeBy]))
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .style('fill', d => colorScale(d[config.colorBy]))
  
    u.exit().remove()
  }
  
  forceSimulation(visData)
    .force('charge', forceManyBody().strength(5))
    // .force('center', forceCenter(width / 2, height / 2))
    .force('forceX', forceX(d => calcX(d[config.groupBy])))
    .force('forceY', forceY(height / 2))
    .force('collision', forceCollide().radius(d => calcSize(d[config.sizeBy])))
    .on('tick', tick);
}

looker.plugins.visualizations.add({
  options: options,

  create: function(element, config) {
    this.container = select(element)
        .append("svg")
        .attr("id", "visSvg")
        .attr("width", element.clientWidth)
        .attr("height", element.clientHeight);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    console.log('sourceData:', data);
    console.log('config:', config);
    console.log('queryResponse:', queryResponse);

    document.getElementById('visSvg').setAttribute("width", element.clientWidth);
    document.getElementById('visSvg').setAttribute("height", element.clientHeight);

    var visModel = new VisPluginModel(data, config, queryResponse)
    var configOptions = {
      dimensionLabels: true,
      dimensionHide: false,
      measureLabels: true,
      measureStyles: [],
      colorBy: true,
      groupBy: true,
      sizeBy: true,
    }
    this.trigger('registerOptions', getConfigOptions(visModel, configOptions))

    buildVis(config, visModel, element.clientWidth, element.clientHeight - 16);
    done();
  }
})
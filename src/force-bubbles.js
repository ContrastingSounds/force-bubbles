import { select, event } from 'd3-selection';
import { transition } from 'd3-transition';
import { scaleOrdinal } from 'd3-scale';
import { schemeAccent } from 'd3-scale-chromatic';
import { forceSimulation, forceManyBody, forceX, forceY, forceCollide } from 'd3-force';

import { VisPluginModel, getConfigOptions } from "../../vis-tools/vis_plugin.js";

import './force-bubbles.css';

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

const buildVis = function(visModel, width, height) {
  var visData = visModel.getJson(true, visModel.has_pivots)
  const colorScale = scaleOrdinal().range(schemeAccent)

  const calcSize = (value) => {
    if (typeof visModel.config.sizeBy !== 'undefined') {
      var max = visModel.ranges[visModel.config.sizeBy].max
      var scale = visModel.config.scale
      return Math.floor(5 + (value / max * 45 * scale))
    } else {
      return 20
    }
  }
  
  const calcX = (value) => {
    if (typeof visModel.config.groupBy !== 'undefined') {
      var range = visModel.ranges[visModel.config.groupBy]
      var catWidth = range.set.length + 1
      var catIndex = range.set.indexOf(value) + 1
      return width / catWidth * catIndex
    } else {
      return width / 2
    }
  }

  const simulation = forceSimulation(visData)
    .force('charge', forceManyBody().strength(5))
    .force('forceX', forceX(d => calcX(d[visModel.config.groupBy])))
    .force('forceY', forceY(height / 2))
    .force('collision', forceCollide().radius(d => calcSize(d[visModel.config.sizeBy])))
    .stop()

  if (typeof visModel.config.sizeBy !== 'undefined' && typeof visModel.config.groupBy !== 'undefined') {
    for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
      simulation.tick();
    }

    var svg = select('#visSvg')
      .attr("width", width)
      .attr("height", height)
      .selectAll('circle')
        .data(visData, d => d.lookerId) 

    svg.enter()
      .append('circle')
        .attr('r', d => calcSize(d[visModel.config.sizeBy]))
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .style('fill', d => colorScale(d[visModel.config.colorBy]))
        .on("mouseover", d => {
          console.log('mouseover', event)
          
          var xPosition = event.pageX;
          var yPosition = event.pageY;

          select("#tooltip")
            .style("left", xPosition + "px")
            .style("top", yPosition + "px")                   
            .html(visModel.getTooltipFromD3(d))
            .classed("hidden", false);
        })
        .on("mousemove", () => {
          var xPosition = event.pageX
          var yPosition = event.pageY

          select('#tooltip')
            .style('left', xPosition + 'px')
            .style('top', yPosition + 'px')
        })
        .on("mouseout", () => {
          select("#tooltip").classed("hidden", true);
        })

    svg.transition()
      .duration(250)
        .attr('r', d => calcSize(d[visModel.config.sizeBy]))
        .attr('cx', d =>  d.x)
        .attr('cy', d => d.y)
        .style('fill', d => colorScale(d[visModel.config.colorBy]))
  
    svg.exit().remove()

  }
}

looker.plugins.visualizations.add({
  options: visOptions,

  create: function(element, config) {
    this.container = select(element)
        .append("svg")
        .attr("id", "visSvg")
        .attr("width", element.clientWidth)
        .attr("height", element.clientHeight);

    this.tooltip = select(element)
        .append("div")
        .attr("class", "hidden")
        .attr("id", "tooltip")
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    console.log('updateAsync() called...')
    // ERROR HANDLING

    this.clearErrors();


    // INITIALISE THE VIS


    // BUILD THE VIS
    // 1. Create object
    // 2. Register options
    // 3. Build vis

    var visModel = new VisPluginModel(data, config, queryResponse)
    
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

    buildVis(visModel, element.clientWidth, element.clientHeight - 16)

    // DEBUG OUTPUT AND DONE
    console.log('visModel', visModel)
    // console.log('container', this.container)
    done();
  }
})
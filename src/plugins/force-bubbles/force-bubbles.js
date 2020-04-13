/* Dependency: https://cdnjs.cloudflare.com/ajax/libs/d3/5.15.0/d3.min.js,https://jwtest.ngrok.io/src/utilities/vis-plugin-model.js */

const addCSS = link => {
  const linkElement = document.createElement('link');

  linkElement.setAttribute('rel', 'stylesheet');
  linkElement.setAttribute('href', link);

  document.getElementsByTagName('head')[0].appendChild(linkElement);
};

const loadStylesheets = () => {
  addCSS('https://jwtest.ngrok.io/src/utilities/vis-plugin.css');
};

const options = {}

const getNewConfigOptions = function(visModel) {
  newOptions = options;

  for (var i = 0; i < visModel.dimensions.length; i++) {
    newOptions['label|' + visModel.dimensions[i].name] = {
      section: 'Dimensions',
      type: 'string',
      label: visModel.dimensions[i].label,
      default: visModel.dimensions[i].label,
      order: i * 10 + 1,
    }

    newOptions['hide|' + visModel.dimensions[i].name] = {
      section: 'Dimensions',
      type: 'boolean',
      label: 'Hide',
      display_size: 'third',
      order: i * 10 + 2,
    }
  }

  for (var i = 0; i < visModel.measures.length; i++) {
    newOptions['label|' + visModel.measures[i].name] = {
      section: 'Measures',
      type: 'string',
      label: visModel.measures[i].label_short || visModel.measures[i].label,
      default: visModel.measures[i].label_short || visModel.measures[i].label,
      order: 100 + i * 10 + 1,
    }

    newOptions['style|' + visModel.measures[i].name] = {
      section: 'Measures',
      type: 'string',
      label: 'Style',
      display: 'select',
      values: [
        {'Normal': 'normal'},
        {'Hide': 'hide'}
      ],
      order: 100 + i * 10 + 2
    }
  }

  sizeByOptions = [];
  for (var i = 0; i < visModel.measures.length; i++) {
      option = {};
      option[visModel.measures[i].label] = visModel.measures[i].name;
      sizeByOptions.push(option);
  }

  newOptions["sizeBy"] = {
      section: "Data",
      type: "string",
      label: "Size By",
      display: "select",
      values: sizeByOptions,
      default: "0",
  }

  // colorByOptions include:
  // - by dimension
  // - by pivot key (which are also dimensions)
  // - by pivot series (one color per column)
  colorByOptions = [];
  for (var i = 0; i < visModel.dimensions.length; i++) {
      option = {};
      option[visModel.dimensions[i].label] = visModel.dimensions[i].name;
      colorByOptions.push(option)
  }

  for (var i = 0; i < visModel.pivot_fields.length; i++) {
    option = {};
    option[visModel.pivot_fields[i].label] = visModel.pivot_fields[i].name;
    colorByOptions.push(option)
  }

  if (visModel.pivot_fields.length > 1 ) {
    colorByOptions.push({'Pivot Series': 'lookerPivotKey'})
  }
  
  newOptions["colorBy"] = {
      section: "Data",
      type: "string",
      label: "Color By",
      display: "select",
      values: colorByOptions,
      default: "0",
  } 

  newOptions["groupBy"] = {
    section: "Data",
    type: "string",
    label: "Group By",
    display: "select",
    values: colorByOptions,
    default: "0",
} 
  
  return newOptions
}

const buildVis = function(config, visModel, width, height) {
  visData = visModel.getJson(includeRowId=true, melt=visModel.has_pivots)
  console.log('buildVis() visData', visData)

  const colorScale = d3.scaleOrdinal().range(d3.schemeAccent)
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
    var u = d3.select('svg')
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
  
  d3.forceSimulation(visData)
    .force('charge', d3.forceManyBody().strength(5))
    // .force('center', d3.forceCenter(width / 2, height / 2))
    .force('forceX', d3.forceX(d => calcX(d[config.groupBy])))
    .force('forceY', d3.forceY(height / 2))
    .force('collision', d3.forceCollide().radius(d => calcSize(d[config.sizeBy])))
    .on('tick', tick);
}


looker.plugins.visualizations.add({
  options: options,

  create: function(element, config) {
    loadStylesheets();

    this.container = d3.select(element)
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

    visModel = new VisPluginModel(data, config, queryResponse)
    console.log('visModel', visModel)

    newOptions = getNewConfigOptions(visModel)
    this.trigger('registerOptions', newOptions)

    buildVis(config, visModel, element.clientWidth, element.clientHeight - 16);
    done();
  }
})
const titles = {
  "death": "Daily deaths",
  "death_cum": "Cumulative total deaths",
  "death_gf": "Growth factor of new deaths",
  "case": "Daily cases",
  "case_cum": "Cumulative total cases",
  "case_gf": "Growth factor of new cases"
}

let bubbleMetric = "case"; // or deaths_cum
let growthMetric = "case_gf"; // or
let peakMetric = "case_cum"; // or deaths_cum

var chartSelectorParent = document.getElementById("chartTypeSelector")
function addMetricInput(metric) {
  const input = document.createElement('input');
  input.type = "radio"
  input.name = "chartType"
  input.value = metric
  input.onchange = function () {
    window.onGraphChange(this.value)
  }
  input.checked = metric === bubbleMetric
  chartSelectorParent.appendChild(input);
  const label = document.createTextNode(titles[metric]);
  chartSelectorParent.appendChild(label);
  chartSelectorParent.appendChild(document.createElement('br'));
}

Array.from([bubbleMetric, growthMetric]).forEach(addMetricInput);
chartSelectorParent.appendChild(document.createElement('hr'));
Array.from(["death", "death_gf"]).forEach(addMetricInput);

const speed = 500;
const transitionDuration = 100;
// const reverse = true;

var mapColor = "#cecece";
var backgroundColor = "#ffffff";
var lollipopLineColor = '#000000';
var textColor = '#000000';

const projection = d3.geoAlbersUsa();
const path = d3.geoPath().projection(projection);
let usTopoJSON;

const bubbleScale = d3.scaleSqrt();
const peakColorScale = d3.scaleSqrt();
const bubbleColorScale = d3.scaleSqrt();
const peakScale = d3.scaleLinear();
const timeScale = d3.scaleTime();

const bubbleRadius = d => bubbleScale(d[bubbleMetric]);
const bubbleColor = d => d3.interpolateBuPu(bubbleColorScale(d[bubbleMetric]));
const peakColor = d => d3.interpolateOrRd(peakColorScale(d[peakMetric]));

const lollipopScale = d3.scalePow().exponent(0.5);
// const dotColor = d3.scaleLinear();
const dotColor = d3.scaleDiverging([0, 1, 4], t => d3.interpolateSpectral(1 - t))

const projectY = d => {
  const projected = projection(lookupMap.get(+d.UID));
  if (projected) {
    return projected[1];
  }
}
const projectX = d => {
  const projected = projection(lookupMap.get(+d.UID));
  if (projected) {
    return projected[0]
  }
}

let lookupMap;
let fips_to_uid;
const makeLookupMap = lookupCSV => {
  lookupMap = new Map();
  fips_to_uid = {};
  lookupCSV.map(d => {
    lookupMap.set(+d.UID, [d.lon, d.lat]);
    if (d.FIPS) {
      fips_to_uid[+d.FIPS] = +d.UID;
    }
  });
}

const peakGenerator = {
  draw: function (context, size) {
    const x1 = 0, y1 = 0, x2 = Math.sqrt(size), y2 = 0, cpx1 = (x1 + x2) / 2, cpy1 = size
    context.moveTo(x1, y1);
    context.quadraticCurveTo(cpx1, -cpy1, x2, y2);
  }
};
const peak = d3.symbol().type(peakGenerator);

function parseData(d) {
  return {
    ...d,
    case: +d.case,
    case_cum: +d.case_cum,
    case_gf: +d.case_gf,
    death: +d.death,
    death_cum: +d.death_cum,
    death_gf: +d.death_gf,
  }
}

function baseMap(svg) {
  if (!svg || !usTopoJSON) throw "No svg or map json given";
  const counties = topojson.feature(usTopoJSON, "counties");
  
  // Create the map
  svg.selectAll("path")
    .data(counties.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr('fill', "none")
    .attr('stroke', mapColor)
    .attr('stroke-width', 0.3)
    .attr("background", backgroundColor)
  
  svg.append("path")
    .datum(topojson.mesh(usTopoJSON, usTopoJSON.objects.counties, function (a, b) {
      return a.id / 1000 ^ b.id / 1000;
    }))
    .attr("class", "state-borders")
    .attr("d", path);
}

function key(d) {
  return d ? d.UID : this.id
}

function showDate(svg, date) {
  // const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  svg.selectAll(".date").data([date])
    .join("text")
    .attr("class", "date")
    // .text(d => d)
    .text(d => {
      return `${months[d.getMonth()]}, ${d.getDate()}`
    })
    .attr("x", function () {
      return (this.parentNode.clientWidth - 40)
    })
    .attr("y", function () {
      return (this.parentNode.clientHeight - 20)
    })
    .attr("text-anchor", "end")
}

function showChloro(svg, data) {
  const counties = topojson.feature(usTopoJSON, "counties");
  return svg.selectAll(".counties").data(counties.features)
    .join("path")
    .attr("class", "counties")
    .attr("d", path)
    .attr("fill", d => {
      const FIPS = Number(d.id);
      const UID = Number(fips_to_uid[FIPS]);
      const item = data.get(UID);
      if (!UID || !item) return 'grey';
      return dotColor(item[growthMetric]);
    });
}

function showBubbles(svg, data) {
  const non_zero = Array.from(data.values()).filter(d => bubbleRadius(d));
  svg.selectAll(".bubble").data(non_zero, key)
    .join("circle")
    .attr("class", "bubble")
    .attr("r", bubbleRadius)
    .attr("cx", projectX)
    .attr("cy", projectY)
    .style("fill-opacity", 0.3)
    .style("fill", bubbleColor)
    .style("fill", "red")
  // .transition()
  // .duration(transitionDuration)
  // .attr("r", bubbleRadius)
}

function showPeaks(svg, data) {
  if (!svg || !data) throw "svg and data must be given"
  const non_zero = Array.from(data.values()).filter(d => +d[peakMetric] > 0);
  svg.selectAll(".peaks")
    .data(non_zero, key)
    .join(
      enter => enter.append("path")
        .attr('opacity', 0.7)
        .attr('stroke-width', 0.5)
        .attr("class", "peaks"),
      update => update,
      exit => exit.remove()
    )
    .attr("transform", d => {
      return "translate(" + projectX(d) + "," + projectY(d) + ")"
    })
    .transition()
    .duration(transitionDuration)
    .attr("d", peak)
    .style("stroke", 'red')
    .style("fill", 'red')
    .style("opacity", 0.6)
}

function showLollipop(svg, data) {
  const bar = svg.selectAll(".growth").data(data, key);
  const dot = svg.selectAll(".dot").data(data, key);
  const metric = peakMetric;
  
  bar.join("rect")
    .attr("class", "growth")
    .attr("width", 0.5)
    .attr("fill", lollipopLineColor)
    .attr("height", d => lollipopScale(d[metric]))
    .attr("transform", (d, i) => {
      return "translate(" + projectX(d) + "," + Number(projectY(d) - lollipopScale(d[metric])) + ")";
    });
  
  dot.join("circle")
    .attr("class", "dot")
    .attr("r", 2)
    // .attr("fill", d => dotColor(d[metric]))
    .attr("fill", "red")
    .attr("opacity", 0.6)
    .attr("transform", (d, i) => {
      return "translate(" + projectX(d) + "," + Number(projectY(d) - lollipopScale(d[metric])) + ")"
    });
}

function createTimer(funcs, svg, dates) {
  // create base map first
  baseMap(svg);
  // start animation
  let i = 0;
  var timer = d3.interval(function update(elapsed) {
    if (i > 2) return timer.stop;
    if (!dates[i]) return timer.stop();
    const date = dates[i]
    if (!date) return t.stop(); // exit condition
    i++;
    const data = grouped[date];
    funcs.map(() => func(svg, data));
    showDate(svg, date);
  }, speed);
  
  return timer;
}

function chartSelector() {
  var chartTypeElement = document.querySelector('input[name="chartType"]:checked');
  var chartType = chartTypeElement && chartTypeElement.value || 'bubble';
  return [chartType, chartTypeElement];
}

d3.csv('./geo_cleaned.csv', parseData).then(dataset => {
  return d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
    .then(function (us) {
      usTopoJSON = us;
      return dataset;
    }).catch(err => {
      if (err) throw err
    });
}).then(dataset => {
  return d3.csv('./lookup.csv')
    .then(lookup => {
      makeLookupMap(lookup);
      const UIDS = Array.from(lookupMap.keys());
      dataset = dataset.filter(d => UIDS.indexOf(+d.UID) > -1)
      return dataset
    });
}).then(dataset => {
  // dataset = dataset.slice(res.length * 0.6) // subset for testing
  if (typeof reverse !== 'undefined' && reverse) {
    dataset = dataset.reverse();
  }
  if (!dataset) throw "No dataset given";
  
  
  grouped = dataset.reduce((next, curr) => {
    if (next[curr.date]) {
      next[curr.date].set(+curr.UID, curr);
    } else {
      next[curr.date] = new Map().set(+curr.UID, curr)
    }
    return next
  }, {});
  
  
  const dates = Object.keys(grouped);
  
  d3.select('body').style('background', backgroundColor);
  
  function addTitle(container, val) {
    container.append("div").lower()
      .html(`<h5>${titles[val]}</h5>`)
      .attr("class", "text-center")
      .style("color", textColor);
  }
  
  const dateRange = document.getElementById("date");
  var [chartType, chartTypeElement] = chartSelector();
  
  let chartContainer = d3.select("#chart");
  let svg = chartContainer.append("svg");
  svg.attr("width", function () {
    return this.parentNode.clientWidth
  }).attr("height", 400).style("background", backgroundColor);
  
  var width = svg.node().clientWidth;
  var height = svg.node().clientHeight;
  projection.scale(width).translate([width / 2, height / 2]);
  
  // start animation
  function updateMeta() {
    // svg.selectAll("*").remove();
    svg.remove();
    
    chartContainer = d3.select("#chart");
    svg = chartContainer.append("svg");
    svg.attr("width", function () {
      return this.parentNode.clientWidth
    }).attr("height", 400).style("background", backgroundColor);
    
    bubbleScale.domain(d3.extent(dataset.map(d => d[bubbleMetric]))).range([0, 100]);
    peakColorScale.domain(d3.extent(dataset.map(d => d[peakMetric]))).range([0, 1]);
    peakScale.domain(d3.extent(dataset.map(d => d[peakMetric]))).range([0, 100]);
    peak.size(d => peakScale(d[peakMetric]));
    
    const gfExtent = d3.extent(dataset.map(d => d[growthMetric]));
    lollipopScale.domain(d3.extent(dataset.map(d => d[peakMetric]))).range([0, 100]);
    // dotColor.domain([0, 1, gfExtent[1]]).range(["blue", "red", "yellow"]).interpolate(d3.interpolateCubehelix)
  
    baseMap(svg);
    
    
    var [chartType] = chartSelector();
    if (chartType === growthMetric) {
      svg.append("g")
        .attr("transform", function () {
          return "translate(" + (this.parentNode.clientWidth - 200) + "," + (this.parentNode.clientHeight - 130) + ")"
        })
        // .attr("transform", "translate(100, 800)")
        .attr("class", "legend")
        .append(() => legend({
          color: dotColor,
          title: "Growth Factor",
          width: 150,
          ticks: 2,
          tickFormat: "",
          tickValues: [0, 1, 4],
        }));
    } else if (chartType === bubbleMetric) {
      svg.append("g")
        .attr("transform", function () {
          return "translate(" + (this.parentNode.clientWidth - 130) + "," + (this.parentNode.clientHeight - 60) + ")"
        })
        .attr("class", "legend")
        .append(() => legend({
          radius: bubbleScale,
          radiusStroke: 'red',
          title: titles[bubbleMetric],
          tickFormat: ",d",
          tickValues: bubbleMetric === 'case' ? [100, 5000, 10000] : [10, 100, 1000] // death
        }));
    } else {
      svg.select('.legend').remove();
    }
  }
  
  function updateMap(date) {
    if (!date) return;
    const data = grouped[date];
    showDate(svg, new Date(date));
    
    var [chartType] = chartSelector();
    if (chartType === bubbleMetric) {
      showBubbles(svg, data);
    } else if (chartType === growthMetric) {
      showChloro(svg, data);
    } else if (chartType === peakMetric) {
      // showPeaks(svg, data);
      showLollipop(svg, Array.from(data.values()).filter(d => d[peakMetric] > 0));
    }
  }
  
  let i = 0;
  
  function timerCallback(elapsed) {
    // if (i > 5) timer.stop();
    if (!dates[i]) return timer.stop();
    const date = dates[i];
    dateRange.value = timeScale(new Date(date));
    console.log('timer iteratoin for date', date);
    updateMap(date);
    i++;
  }
  
  updateMeta();
  var timer = d3.interval(timerCallback, speed);
  
  const date_min = new Date(dates[0])
  const date_max = new Date(dates[dates.length - 1])
  
  timeScale.domain([date_min, date_max]);
  timeScale.range([0, 100]);
  dateRange.min = timeScale(date_min);
  dateRange.max = timeScale(date_max);
  dateRange.value = timeScale(date_min);
  
  const debounced = debounce(updateMap, 500);
  dateRange.addEventListener("input", function (event) {
    timer.stop();
    const date = timeScale.invert(event.target.value);
    const dateKey = date.toISOString().split("T")[0];
    debounced(dateKey);
  });
  
  window.onGraphChange = function (val) {
    timer.stop();
    i = 0;
    dateRange.value = 0;
    
    switch (val) {
      case "case":
      case "death":
        bubbleMetric = val;
        break;
      case "case_gf":
      case "death_gf":
        growthMetric = val;
        break;
    }
    
    updateMeta();
    updateMap(dates[0]);
  }
  
  window.onStartClick = function () {
    if (timer) timer.stop();
    timer = d3.interval(timerCallback, speed);
  }
  
  window.onRestartClick = function () {
    i = 0;
    dateRange.value = 0;
    return onStartClick();
  }
  
  window.onStopClick = function () {
    if (timer) timer.stop();
  }
  
  
  return timer;
  
}).catch(err => {
  if (err) throw err;
});

function debounce(func, wait) {
  var timeout;
  return function () {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(func.apply(null, arguments), wait);
  }
}
const titles = {
    "death": "Daily Deaths",
    "death_cum": "Cumulative deaths",
    "death_gf": "Growth factor of new deaths",
    "case": "Daily new cases",
    "case_cum": "Cumulative positive cases",
    "case_gf": "Growth factor of new cases"
}

const bubbleMetric = "death_cum"; // or deaths_cum
const peakMetric = "case_cum"; // or deaths_cum
const growthMetric = "case_gf"; // or

const speed = 500;
const transitionDuration = 0;
const reverse = true;

var mapColor = "#cecece";
var backgroundColor = "#ffffff";
var lollipopLineColor = '#000000';
var textColor = '#000000';

const projection = d3.geoAlbersUsa();
const path = d3.geoPath().projection(projection);
let timer;
let usTopoJSON;

const bubbleScale = d3.scaleSqrt();
const peakColorScale = d3.scaleSqrt();
const bubbleColorScale = d3.scaleSqrt();
const peakScale = d3.scalePow().exponent(0.7);

const bubbleRadius = d => bubbleScale(d[bubbleMetric]);
const bubbleColor = d => d3.interpolateBuPu(bubbleColorScale(d[bubbleMetric]));
const peakColor = d => d3.interpolateOrRd(peakColorScale(d[peakMetric]));

const growthBarScale = d3.scaleLinear(1);
const dotColor = d3.scaleLinear();

const peakGenerator = {
    draw: function (context, size) {
        const x1 = 0, y1 = 0, x2 = Math.sqrt(size), y2 = 0, cpx1 = (x1 + x2) / 2, cpy1 = size
        context.moveTo(x1, y1);
        context.quadraticCurveTo(cpx1, -cpy1, x2, y2);
    }
};
const peak = d3.symbol().type(peakGenerator);

const projectX = d => projection([d.lon, d.lat])[0]
const projectY = d => projection([d.lon, d.lat])[1]

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
}

function key(d) {
    return d ? d.UID : this.id
}

function showDate(svg, date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    svg.selectAll(".date").data([date])
        .join("text")
        .attr("class", "date")
        .text(d => d)
        // .text(d => {
        //     const date = new Date(d);
        //     return `${months[date.getMonth()]}, ${date.getDay()}`
        // })
        .attr("x", function () {
            return this.parentNode.clientWidth / 2
        })
        .attr("text-anchor", "middle")
        .attr("y", 20)
        .attr("fill", textColor)
}

function showBubbles(svg, data) {
    svg.selectAll(".bubble").data(data, key)
        .join("circle")
        .attr("class", "bubble")
        .attr("cx", projectX)
        .attr("cy", projectY)
        .attr("r", bubbleRadius)
        .style("fill-opacity", 0.3)
        // .style("fill", bubbleColor)
        .style("fill", "red")
        .transition()
        .duration(transitionDuration)
        .attr("r", bubbleRadius)
}

function showPeaks(svg, data) {
    if (!svg || !data) throw "svg and data must be given"
    svg.selectAll(".peaks")
        .data(data, key)
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
        .style("stroke", peakColor)
        .style("fill", peakColor)
        .style("opacity", 0.8)
}

function showGrowthFactor(svg, data) {
    const bar = svg.selectAll(".growth").data(data, key);
    const dot = svg.selectAll(".dot").data(data, key);

    bar
        .join(
            enter => enter.append("rect")
                .attr("class", "growth")
                .attr("width", 0.5)
                .attr("fill", lollipopLineColor)
                .attr("height", d => growthBarScale(d[growthMetric])), // start from 0
            update => update,
            exit => exit.remove()
        )
        .transition()
        .duration(transitionDuration)
        .attr("transform", (d, i) => {
            return "translate(" + projectX(d) + "," + Number(projectY(d) - growthBarScale(d[growthMetric])) + ")";
        })
        .attr("height", d => growthBarScale(d[growthMetric])),

        dot.join(
            enter => enter.append("circle")
                .attr("class", "dot")
                .attr("r", 2)
                .attr("opacity", 0.5)
                .attr("fill", d => dotColor(d[growthMetric]))
                .attr("transform", (d, i) => {
                    return "translate(" + projectX(d) + "," + Number(projectY(d) - growthBarScale(d[growthMetric])) + ")"
                }),
        update => update
            .transition()
            .duration(transitionDuration)
            .attr("fill", d => dotColor(d[growthMetric]))
            // .attr("opacity", d => d[growthMetric > 1 ? 1 : 0.5)
            .attr("opacity", 1)
            .attr("transform", (d, i) => {
                return "translate(" + projectX(d) + "," + Number(projectY(d) - growthBarScale(d[growthMetric])) + ")"
            }),
        exit => exit
    )
}

function createTimer(func, svg, dates) {
    // create base map first
    baseMap(svg);
    // start animation
    let i = 0;
    var timer = d3.interval(function update(elapsed) {
        // if (i > 4) return timer.stop;
        if (!dates[i]) return timer.stop();
        const date = dates[i]
        if (!date) return t.stop(); // exit condition
        i++;
        const data = grouped[date];
        func(svg, data);
        showDate(svg, date);
    }, speed);

    return timer;
}

function createSvg(container) {
    return container.select('svg').attr("width", function () {
        return this.parentNode.clientWidth
    }).attr("height", 400).style("background", backgroundColor);
}

d3.csv('./geo_cleaned.csv', parseData).then(dataset => {
    return d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
        .then(function (us) {
            usTopoJSON = us;
            return (dataset);
        }).catch(err => {
            if (err) throw err
        });
}).then(dataset => {
    // dataset = dataset.slice(res.length * 0.6) // subset for testing
    if (typeof reverse !== 'undefined' && reverse) {
        dataset = dataset.reverse();
    }
    if (!dataset) throw "No dataset given";


    bubbleScale.domain(d3.extent(dataset.map(d => d[bubbleMetric]))).range([0, 100]);
    peakColorScale.domain(d3.extent(dataset.map(d => d[peakMetric]))).range([0, 1]);
    peakScale.domain(d3.extent(dataset.map(d => d[peakMetric]))).range([0, 100]);
    peak.size(d => peakScale(d[peakMetric]));

    const gfExtent = d3.extent(dataset.map(d => d[growthMetric]));
    growthBarScale.domain(gfExtent).range([0, 400])
    dotColor.domain([0, 1, gfExtent[1]]).range(["blue", "red", "yellow"]).interpolate(d3.interpolateCubehelix)


    grouped = dataset.reduce((next, curr) => {
        if (next[curr.date]) {
            next[curr.date].push(curr);
        } else {
            next[curr.date] = [curr]
        }
        return next
    }, {});


    const dates = Object.keys(grouped);
    let i = 0;

    d3.select('body').style('background', backgroundColor);

    function addTitle(container, val) {
        container.append("div").lower()
            .html(`<h5>${titles[val]}</h5>`)
            .attr("class", "text-center")
            .style("color", textColor);
    }

    var bubbleContainer = d3.select('#bubble');
    addTitle(bubbleContainer, bubbleMetric);
    var bubbleSvg = createSvg(bubbleContainer);

    var growthFactorContainer = d3.select('#growth-factor');
    addTitle(growthFactorContainer, growthMetric);
    var growthFactorSvg = createSvg(growthFactorContainer);

    var peakContainer = d3.select('#peak');
    addTitle(peakContainer, peakMetric);
    var peakSvg = createSvg(peakContainer);

    var width = bubbleSvg.node().clientWidth;
    var height = bubbleSvg.node().clientHeight;
    projection.scale(width).translate([width / 2, height / 2])


    var bubbleTimer = createTimer(showBubbles, bubbleSvg, dates);
    var growthFactorTimer = createTimer(showGrowthFactor, growthFactorSvg, dates);
    var peakTimer = createTimer(showPeaks, peakSvg, dates);

}).catch(err => {
    if (err) throw err;
});
//
// d3.csv('./totals.csv', function (d) {
//     return {
//         ...d,
//         // death: +d.death,
//         // case: +d.case,
//         // case_cum: +d.case_cum,
//         // death_cum: +d.death_cum,
//         date: new Date(d.date)
//     }
// }).then(function (dataset){
//
//     const margin = {
//         t: 10,
//         l: 10,
//         b: 10,
//         r: 10
//     };
//     const Y_AXIS = 'case_cum';
//     const height = 400;
//
//     var chartContainer = d3.select("#total");
//     var svg = chartContainer.select('svg');
//
//     svg.attr("height", height)
//         .attr("width", function () {
//             return this.parentNode.clientWidth;
//         })
//         .attr("transform","translate("+margin.l+","+margin.t+")")
//         .style("background", backgroundColor)
//
//     var width = svg.node().clientWidth;
//     // var height = svg.node().clientHeight;
//
//     const xScale = d3.scaleTime().domain(d3.extent(dataset.map(d => d.date))).range([0, width-margin.l-margin.r-100]) // width of the svg
//     const yScale = d3.scaleLinear().domain(d3.extent(dataset.map(d => d[Y_AXIS]))).range([height-margin.t-margin.b, 0]);
//
//     const line = d3.line()
//         .x(d => xScale(d.date))
//         // .curve(d3.curveMonotoneX)
//
//     const caseLine = line.x(d => xScale(d.date)).y(d => yScale(d[Y_AXIS]))
//     const deathLine = line.x(d => xScale(d.date)).y(d => yScale(d['case_cum']))
//
//
//     svg.append("g")
//         .attr("transform", "translate(0," + Number(height-margin.t-margin.b) + ")")
//         .call(d3.axisBottom(xScale))
//
//     svg.append("g")
//         .attr("transform", "translate(60,0)")
//         .call(d3.axisLeft(yScale))
//
//     svg.selectAll('.case').data([dataset])
//         .enter()
//         .append("path")
//         .attr("class","case")
//         .attr("d", caseLine)
//         .attr("fill", "none")
//         .attr("stroke", "blue")
//
//     svg.selectAll('.death').data([dataset])
//         .enter()
//         .append("path")
//         .attr("class","death")
//         .attr("d", deathLine)
//         .attr("fill", "none")
//         .attr("stroke", "red")
//
//
//     console.log(d3.extent(dataset.map(d => d[Y_AXIS])));
// }).catch(function (err) {
//     if (err) throw err;
// });

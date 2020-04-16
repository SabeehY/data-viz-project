const margin = {
    left: 20,
    right: 20,
    top: 20,
    bottom: 20
}
const width = window.innerWidth;
const height = window.innerHeight;
const yVal = "cumsum";
const speed = 500;
const transitionDuration = 0;

var mapColor = "#b3b3b3";
var backgroundColor = "#fff";
var lollipopLineColor = '#383838';
var textColor = '#000';

const projection = d3.geoAlbersUsa();
const path = d3.geoPath().projection(projection);
let timer;
let usTopoJSON;

const scaleCircle = d3.scaleSqrt();
const color = d3.scaleSqrt();
const peakScale = d3.scaleLinear();

const bubbleRadius = d => scaleCircle(d[yVal]);
const bubbleColor = d => d3.interpolateBuPu(color(d[yVal]));
const peakColor = d => d3.interpolateOrRd(color(d[yVal]));

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
const growthBar = d3.line();

const projectX = d => projection([d.lon, d.lat])[0]
const projectY = d => projection([d.lon, d.lat])[1]

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
    svg.selectAll(".date").data([date])
        .join("text")
        .attr("class", "date")
        .text(d => d)
        .attr("x", function () {
            return this.parentNode.clientWidth / 2
        })
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
        .style("fill", bubbleColor)
        .transition()
        .duration(transitionDuration)
        .attr("r", bubbleRadius)
}

function showPeaks(svg, data) {
    svg.selectAll(".peaks")
        .data(data, key)
        .join(
            enter => enter.append("path")
                .attr('opacity', 0.7)
                .attr('stroke-width', 0.5)
                .attr("class", "peaks"),
            update => update,
            exit => {
                exit.remove()
            }
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
            enter => enter.append("path")
                .attr("class", "growth")
                .attr("d", d => growthBar([{gf: 0}], {gf: 0})), // start from 0
            update => update,
            exit => exit.remove()
        )
        .attr("stroke", lollipopLineColor)
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.8)
        .attr("transform", (d, i) => {
            return "translate(" + projectX(d) + "," + projectY(d) + ")"
        })
        .transition()
        .duration(transitionDuration)
        .attr("d", d => growthBar([{gf: 0}, d]))

    dot.join(
        enter => enter.append("circle")
            .attr("class", "dot")
            .attr("r", 2)
            .attr("opacity", 0.5)
            .attr("fill", d => dotColor(d.gf))
            .attr("transform", (d, i) => {
                return "translate(" + projectX(d) + "," + Number(projectY(d) - growthBarScale(d.gf)) + ")"
            }),
        update => update
            .transition()
            .duration(transitionDuration)
            .attr("fill", d => dotColor(d.gf))
            // .attr("opacity", d => d.gf > 1 ? 1 : 0.5)
            .attr("opacity", 1)
            .attr("transform", (d, i) => {
                return "translate(" + projectX(d) + "," + Number(projectY(d) - growthBarScale(d.gf)) + ")"
            }),
        exit => exit
    )
}

function createTimer(func, svg, dates) {
    // create base map first
    baseMap(svg);
    // start animation
    let i = 0;
    return d3.interval(function update(elapsed) {
        // if (i > 4) return timer.stop;
        if (!dates[i]) return timer.stop();
        const date = dates[i]
        if (!date) return t.stop(); // exit condition
        i++;
        const data = grouped[date];
        func(svg, data);
        showDate(svg, date);
    }, speed);
}

d3.csv('./geo_cleaned.csv', d => {
    return {
        ...d,
        gf: +d.gf,
        count: parseInt(d.count),
        cumsum: parseInt(d.cumsum)
    }
}).then(dataset => {
    return d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
        .then(function (us) {
            usTopoJSON = us;
            return (dataset);
        }).catch(err => {
            if (err) throw err
        });
}).then(dataset => {
    // dataset = dataset.slice(res.length * 0.6) // subset for testing
    dataset = dataset.reverse();
    if (!dataset) throw "No dataset given";

    const extent = d3.extent(dataset.map(d => d[yVal]));
    const gfExtent = d3.extent(dataset.map(d => d.gf))

    color.domain(extent).range([0, 1]);
    scaleCircle.domain(extent).range([0, 100]);
    peakScale.domain(extent).range([0, 100]);
    peak.size(d => peakScale(d[yVal]))
    growthBarScale.domain(gfExtent).range([0, 400])
    growthBar.x(d => 0).y(d => -growthBarScale(d.gf))
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

    var bubbleSvg = d3.select('#bubble').select('svg').attr("width", function () {
        return this.parentNode.clientWidth
    }).attr("height", 400);
    var growthFactorSvg = d3.select('#growth-factor').select('svg').attr("width", function () {
        return this.parentNode.clientWidth
    }).attr("height", 400);

    var width = bubbleSvg.node().clientWidth;
    var height = bubbleSvg.node().clientHeight;
    projection.scale(width).translate([width / 2, height / 2])


    var bubbleTimer = createTimer(showBubbles, bubbleSvg, dates);
    var growthFactorTimer = createTimer(showGrowthFactor, growthFactorSvg, dates);

}).catch(err => {
    if (err) throw err;
});


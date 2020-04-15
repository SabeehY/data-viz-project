const margin = {
    left: 20,
    right: 20,
    top: 20,
    bottom: 20
}
const width = window.innerWidth;
const height = window.innerHeight;
const yVal = "cumsum";
const speed = 1000;
const transitionDuration = 100;

var mapColor = "#b3b3b3";
var backgroundColor = "#fff";
var lollipopLineColor = '#383838';
var textColor = '#000';

const projection = d3.geoAlbersUsa().scale(width - margin.left - margin.top).translate([width / 2, height / 2])
const path = d3.geoPath().projection(projection);
let dataset;
let timer;

const svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
// .style("background", backgroundColor);

d3.csv('./geo_cleaned.csv', d => {
    return {
        ...d,
        gf: +d.gf,
        count: parseInt(d.count),
        cumsum: parseInt(d.cumsum)
    }
}).then(res => {
    // res = res.slice(res.length * 0.6) // subset for testing
    res = res.reverse();
    dataset = res;
}).catch(err => {
    if (err) throw err;
});

function visualize() {
    if (!dataset) return;

    const extent = d3.extent(dataset.map(d => d[yVal]));

    const scaleCircle = d3.scaleSqrt().domain(extent).range([0, 100])
    const color = d3.scaleSqrt().domain(extent).range([0, 1])
    const peakScale = d3.scaleLinear().domain(extent).range([0, 100])

    const bubbleRadius = d => scaleCircle(d[yVal])
    const bubbleColor = d => d3.interpolateBuPu(color(d[yVal]))
    const peakColor = d => d3.interpolateOrRd(color(d[yVal]))

    const gfExtent = d3.extent(dataset.map(d => d.gf))

    const lollipopBarScale = d3.scaleLinear(1).domain(gfExtent).range([0, 400])
    const dotColor = d3.scaleLinear()
        .domain([0, 1, gfExtent[1]])
        .range(["blue", "red", "yellow"])
        .interpolate(d3.interpolateCubehelix)


    const sqrt3 = Math.sqrt(3);
    const peakGenerator = {
        draw: function (context, size) {
            const x1 = 0, y1 = 0, x2 = Math.sqrt(size), y2 = 0, cpx1 = (x1 + x2) / 2, cpy1 = size
            context.moveTo(x1, y1);
            context.quadraticCurveTo(cpx1, -cpy1, x2, y2);
        }
    };
    const peak = d3.symbol().type(peakGenerator).size(d => peakScale(d[yVal]))

    const growthLine = d3.line()
        .x(d => 0)
        .y(d => -lollipopBarScale(d.gf))
    // .curve(d3.curveLinear)

    const projectX = d => projection([d.lon, d.lat])[0]
    const projectY = d => projection([d.lon, d.lat])[1]

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

    timer = d3.interval(function update(elapsed) {
        // if (i > 4) return timer.stop;
        if (!dates[i]) return timer.stop();
        const date = dates[i]

        if (!date) return t.stop(); // exit condition
        i++;

        // console.log('calling iteration for date:', i,  date);

        const data = grouped[date];

        function key(d) {
            return d ? d.UID : this.id
        }

        function showDate() {
            svg.selectAll(".date").data([date])
                .join("text")
                .attr("class", "date")
                .text(d => d)
                .attr("x", width / 2)
                .attr("y", 20)
                .attr("fill", textColor)
        }

        function showBubbles() {
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

        function showPeaks() {
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

        function showLollipop() {
            const bar = svg.selectAll(".growth").data(data, key);
            const dot = svg.selectAll(".dot").data(data, key);
            console.log('data', data);
            bar
                .join(
                    enter => enter.append("path")
                        .attr("class", "growth")
                        .attr("d", d => growthLine([{gf: 0}], {gf: 0})), // start from 0
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
                .attr("d", d => growthLine([{gf: 0}, d]))

            dot.join(
                enter => enter.append("circle")
                    .attr("class", "dot")
                    .attr("r", 2)
                    .attr("opacity", 0.5)
                    .attr("fill", d => dotColor(d.gf))
                    .attr("transform", (d, i) => {
                        return "translate(" + projectX(d) + "," + Number(projectY(d) - lollipopBarScale(d.gf)) + ")"
                    }),
                update => update
                    .transition()
                    .duration(transitionDuration)
                    .attr("fill", d => dotColor(d.gf))
                    // .attr("opacity", d => d.gf > 1 ? 1 : 0.5)
                    .attr("opacity", 1)
                    .attr("transform", (d, i) => {
                        return "translate(" + projectX(d) + "," + Number(projectY(d) - lollipopBarScale(d.gf)) + ")"
                    }),
                exit => exit
            )
        }

        showDate();
        // showLollipop();
        showBubbles();
        // showPeaks();

    }, speed);
}

function showMap() {
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
        .then(function (us) {
            // console.log(topojson.feature(us, "counties"));

            const counties = topojson.feature(us, "counties")
            // svg.append("path")
            //     .datum(counties)
            //     .attr("d", path)
            //     .attr("stroke", "black")

            // Create the map
            svg.selectAll("path")
                .data(counties.features)
                .enter()
                .append("path")
                .attr("d", path)
                .attr('fill', "none")
                .attr('stroke', mapColor)
                .attr('stroke-width', 0.3)
        }).catch(err => {
        if (err) throw err
    });

}

showMap();
visualize();

document.querySelector('#replay').addEventListener('click', function () {
    if (timer && timer.stop) timer.stop()
    visualize();
})

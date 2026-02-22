// script.js

const margin = { top: 50, right: 120, bottom: 20, left: 80 }; // right margin bigger for legend
const matrixWidth = 900;    // width of the matrix
const matrixHeight = 500;   // height of the matrix

const width = matrixWidth - margin.left - margin.right;
const height = matrixHeight - margin.top - margin.bottom;

let mode = "max"; // toggles between max and min

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", matrixWidth)
    .attr("height", matrixHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

function loadData() {
    d3.csv("temperature_daily.csv").then(data => {

        // Parse and format data
        data.forEach(d => {
            d.date = new Date(d.date);
            d.year = d.date.getFullYear();
            d.month = d.date.getMonth() + 1;
            d.max_temperature = +d.max_temperature;
            d.min_temperature = +d.min_temperature;
        });

        // Filter last 10 years
        const maxYear = d3.max(data, d => d.year);
        const filtered = data.filter(d => d.year >= maxYear - 9);

        // Group by year + month
        const monthlyData = d3.groups(filtered, d => d.year, d => d.month)
            .flatMap(([year, months]) =>
                months.map(([month, values]) => ({
                    year,
                    month,
                    max: d3.max(values, d => d.max_temperature),
                    min: d3.min(values, d => d.min_temperature),
                    daily: values.map(d => d.max_temperature) // mini chart
                }))
            );

        drawMatrix(monthlyData);
    });
}

function drawMatrix(data) {

    const years = [...new Set(data.map(d => d.year))].sort();
    const months = d3.range(1, 13);

    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(months)
        .range([0, height])
        .padding(0.05);

    let colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([d3.min(data, d => d[mode]), d3.max(data, d => d[mode])]);

    // Axes
    svg.append("g")
        .call(d3.axisTop(xScale));

    svg.append("g")
        .call(d3.axisLeft(yScale)
            .tickFormat(m => d3.timeFormat("%b")(new Date(2020, m - 1, 1))));

    // Create cells
    const cells = svg.selectAll(".cell")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${xScale(d.year)},${yScale(d.month)})`);

    cells.append("rect")
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => colorScale(d[mode]))
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1)
                .html(`<strong>${d.year} - ${monthName(d.month)}</strong><br>
                       ${mode.toUpperCase()}: ${d[mode].toFixed(2)}°C`);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Mini line charts
    cells.each(function(d) {
        const miniX = d3.scaleLinear()
            .domain([0, d.daily.length - 1])
            .range([0, xScale.bandwidth()]);

        const miniY = d3.scaleLinear()
            .domain([d3.min(d.daily), d3.max(d.daily)])
            .range([yScale.bandwidth(), 0]);

        const line = d3.line()
            .x((val, i) => miniX(i))
            .y(val => miniY(val));

        d3.select(this)
            .append("path")
            .datum(d.daily)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", 1);
    });

    drawLegend(colorScale);

    // Toggle mode on click
    d3.select("body").on("click", () => {
        mode = mode === "max" ? "min" : "max";

        colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
            .domain([d3.min(data, d => d[mode]), d3.max(data, d => d[mode])]);

        svg.selectAll(".cell rect")
            .transition()
            .duration(500)
            .attr("fill", d => colorScale(d[mode]));

        svg.selectAll(".legend").remove();
        svg.selectAll("defs").remove();
        drawLegend(colorScale);
    });
}

function drawLegend(colorScale) {

    const legendWidth = 20;
    const legendHeight = 150;   // smaller than full matrix
    const legendX = width + 30; // inside right margin
    const legendY = 50;         // some space from top

    // remove old legend and defs
    svg.selectAll(".legend").remove();
    svg.selectAll("defs").remove();

    const defs = svg.append("defs");

    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    gradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .enter()
        .append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d =>
            colorScale(colorScale.domain()[0] + d * (colorScale.domain()[1] - colorScale.domain()[0]))
        );

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX},${legendY})`);

    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([legendHeight, 0]);

    legend.append("g")
        .attr("transform", `translate(${legendWidth},0)`)
        .call(d3.axisRight(legendScale).ticks(5));

    // optional label
    legend.append("text")
        .attr("x", -10)
        .attr("y", -10)
        .text(mode === "max" ? "Max Temp (°C)" : "Min Temp (°C)")
        .style("font-size", "12px");
}

function monthName(monthNumber) {
    return d3.timeFormat("%b")(new Date(2020, monthNumber - 1, 1));
}

loadData();
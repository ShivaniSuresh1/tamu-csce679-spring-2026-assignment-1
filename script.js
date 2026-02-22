// Configuration & Constants
const CONFIG = {
    svgWidth: 1000,
    svgHeight: 700,
    margins: { top: 60, right: 120, bottom: 40, left: 100 },
    cellPadding: 0.15,
    temperatureDomain: [0, 40], 
    legend: {
        width: 20,
        height: 200,
        offsetX: 40,
        offsetY: 50
    }
};

const AXIS_OFFSET = 20;          
let currentTemperatureMode = "max"; // toggle between "max" and "min"

// SVG & Tooltip Setup
const innerWidth = CONFIG.svgWidth - CONFIG.margins.left - CONFIG.margins.right;
const innerHeight = CONFIG.svgHeight - CONFIG.margins.top - CONFIG.margins.bottom;

const svgContainer = d3.select("#chart")
    .append("svg")
    .attr("width", CONFIG.svgWidth)
    .attr("height", CONFIG.svgHeight)
    .append("g")
    .attr("transform", `translate(${CONFIG.margins.left},${CONFIG.margins.top})`);

const tooltip = d3.select("#tooltip");

// Display current temperature mode
const modeLabel = svgContainer.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -CONFIG.margins.top / 2)  
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .text(`Mode: ${currentTemperatureMode.toUpperCase()}`);

// Data Loading & Preprocessing
function loadTemperatureData() {
    d3.csv("temperature_daily.csv").then(rawData => {

        rawData.forEach(row => {
            row.date = new Date(row.date);
            row.year = row.date.getFullYear();
            row.month = row.date.getMonth() + 1;
            row.day = row.date.getDate();
            row.max_temperature = +row.max_temperature;
            row.min_temperature = +row.min_temperature;
        });

        const latestYear = d3.max(rawData, d => d.year);
        const last10YearsData = rawData.filter(d => d.year >= latestYear - 9);

        const monthlyAggregatedData = aggregateMonthlyData(last10YearsData);

        initializeVisualization(monthlyAggregatedData);
    });
}

// Aggregate Data by Year & Month
function aggregateMonthlyData(data) {
    return d3.groups(data, d => d.year, d => d.month)
        .flatMap(([year, months]) =>
            months.map(([month, dailyRecords]) => ({
                year: year,
                month: month,
                max: d3.max(dailyRecords, r => r.max_temperature),
                min: d3.min(dailyRecords, r => r.min_temperature),
                dailyMax: dailyRecords.map(r => r.max_temperature),
                dailyMin: dailyRecords.map(r => r.min_temperature)
            }))
        );
}

// Visualization Initialization
function initializeVisualization(monthlyData) {

    const scales = createScales(monthlyData);

    renderAxes(scales);
    renderGridLines(scales);
    renderHeatmapCells(monthlyData, scales);
    renderTemperatureLegend(scales.colorScale);

    attachTemperatureToggle(monthlyData, scales);
}

// Create D3 Scales
function createScales(monthlyData) {

    const uniqueYears = [...new Set(monthlyData.map(d => d.year))].sort();
    const months = d3.range(1, 13);

    const xScale = d3.scaleBand()
        .domain(uniqueYears)
        .range([AXIS_OFFSET + 5, innerWidth])
        .padding(CONFIG.cellPadding);

    const yScale = d3.scaleBand()
        .domain(months)
        .range([AXIS_OFFSET + 5, innerHeight])
        .padding(CONFIG.cellPadding);

    const colorScale = d3.scaleSequential()
        .domain([CONFIG.temperatureDomain[1], CONFIG.temperatureDomain[0]])
        .interpolator(d3.interpolateRdYlBu);

    const miniLineYScale = d3.scaleLinear()
        .domain(CONFIG.temperatureDomain)
        .range([yScale.bandwidth() - 2, 2]);

    return { xScale, yScale, colorScale, miniLineYScale };
}

// Axes Rendering
function renderAxes(scales) {

    const axisExtension = 10;

    // Top (Year) Axis
    const topAxis = d3.axisTop(scales.xScale).tickSize(6);
    const topAxisGroup = svgContainer.append("g")
        .attr("transform", `translate(0, ${AXIS_OFFSET})`)
        .call(topAxis);

    // Left (Month) Axis
    const leftAxis = d3.axisLeft(scales.yScale)
        .tickFormat(m => d3.timeFormat("%B")(new Date(2020, m - 1, 1)))
        .tickSize(6);
    const leftAxisGroup = svgContainer.append("g")
        .attr("transform", `translate(${AXIS_OFFSET}, 0)`)
        .call(leftAxis);

    // Remove default axis lines
    topAxisGroup.select(".domain").remove();
    leftAxisGroup.select(".domain").remove();

    // Draw corner extension lines
    svgContainer.append("line")
        .attr("x1", AXIS_OFFSET - axisExtension)
        .attr("x2", innerWidth)
        .attr("y1", AXIS_OFFSET)
        .attr("y2", AXIS_OFFSET)
        .attr("stroke", "black");

    svgContainer.append("line")
        .attr("x1", AXIS_OFFSET)
        .attr("x2", AXIS_OFFSET)
        .attr("y1", AXIS_OFFSET - axisExtension)
        .attr("y2", innerHeight)
        .attr("stroke", "black");
}

// Grid Lines Rendering
function renderGridLines(scales) {

    // Vertical grid lines (Years)
    svgContainer.append("g")
        .attr("class", "grid-lines-x")
        .selectAll("line")
        .data(scales.xScale.domain())
        .enter()
        .append("line")
        .attr("x1", d => scales.xScale(d))
        .attr("x2", d => scales.xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke-width", 0.5);

    // Horizontal grid lines (Months)
    svgContainer.append("g")
        .attr("class", "grid-lines-y")
        .selectAll("line")
        .data(scales.yScale.domain())
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => scales.yScale(d))
        .attr("y2", d => scales.yScale(d))
        .attr("stroke-width", 0.5);
}

// Heatmap Cells Rendering
function renderHeatmapCells(monthlyData, scales) {

    const cellGroups = svgContainer.selectAll(".cell")
        .data(monthlyData)
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${scales.xScale(d.year)},${scales.yScale(d.month)})`);

    // Background Rectangles
    cellGroups.append("rect")
        .attr("width", scales.xScale.bandwidth())
        .attr("height", scales.yScale.bandwidth())
        .attr("fill", d => scales.colorScale(d[currentTemperatureMode]))
        .attr("stroke", "#ffffff")
        .on("mouseover", (event, d) => showTooltip(event, d))
        .on("mousemove", event => moveTooltip(event))
        .on("mouseout", hideTooltip);

    // Mini Line Charts
    cellGroups.each(function(d) {
        renderMiniTemperatureChart(d3.select(this), d, scales);
    });
}

// Mini Line Chart within Each Cell
function renderMiniTemperatureChart(cellGroup, monthData, scales) {

    cellGroup.selectAll("path").remove();  

    const miniXScale = d3.scaleLinear()
        .domain([0, monthData.dailyMax.length - 1])
        .range([2, scales.xScale.bandwidth() - 2]);

    const dailyValues = currentTemperatureMode === "max" ? monthData.dailyMax : monthData.dailyMin;
    const lineColor = currentTemperatureMode === "max" ? "#006400" : "#000000";

    const lineGenerator = d3.line()
        .x((value, index) => miniXScale(index))
        .y(value => scales.miniLineYScale(value));

    cellGroup.append("path")
        .datum(dailyValues)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 1.2);
}

// Temperature Legend
const COLOR_STEPS = 11;
const legendColorScale = d3.scaleQuantize()
    .domain(CONFIG.temperatureDomain)
    .range(d3.schemeRdYlBu[COLOR_STEPS].reverse());

function renderTemperatureLegend(colorScale) {

    svgContainer.selectAll(".legend").remove();

    const legendGroup = svgContainer.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${innerWidth + CONFIG.legend.offsetX}, ${CONFIG.legend.offsetY})`);

    const boxHeight = CONFIG.legend.height / COLOR_STEPS;
    const legendValues = d3.range(COLOR_STEPS).map(i => {
        const stepSize = (CONFIG.temperatureDomain[1] - CONFIG.temperatureDomain[0]) / COLOR_STEPS;
        return CONFIG.temperatureDomain[0] + i * stepSize;
    });

    // Color boxes
    legendGroup.selectAll("rect")
        .data(legendValues)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * boxHeight)
        .attr("width", CONFIG.legend.width)
        .attr("height", boxHeight)
        .attr("fill", d => colorScale(d));

    // Legend axis
    const legendScale = d3.scaleLinear()
        .domain(CONFIG.temperatureDomain)
        .range([0, CONFIG.legend.height]);

    const legendAxis = legendGroup.append("g")
        .attr("transform", `translate(${CONFIG.legend.width},0)`)
        .call(
            d3.axisRight(legendScale)
                .tickValues([CONFIG.temperatureDomain[0], CONFIG.temperatureDomain[1]])
                .tickSize(0)
                .tickPadding(6)
                .tickFormat(d => d + " Celsius")
        );

    legendAxis.select(".domain").remove();
}

// Toggle Max/Min Temperatures
function attachTemperatureToggle(monthlyData, scales) {

    d3.select("#chart svg").on("click", (event) => {

        event.stopPropagation();  // avoid tooltip interference

        currentTemperatureMode = currentTemperatureMode === "max" ? "min" : "max";

        // Update mode label
        modeLabel.text(`Mode: ${currentTemperatureMode.toUpperCase()}`);

        // Update heatmap colors
        svgContainer.selectAll(".cell rect")
            .transition()
            .duration(300)
            .attr("fill", d => scales.colorScale(d[currentTemperatureMode]));

        // Update mini line charts
        svgContainer.selectAll(".cell")
            .each(function(d) {
                renderMiniTemperatureChart(d3.select(this), d, scales);
            });
    });
}

// Tooltip functions
function showTooltip(event, data) {
    tooltip.style("opacity", 1)
        .html(`
            <strong>${data.year} - ${monthName(data.month)}</strong><br>
            ${currentTemperatureMode.toUpperCase()} Temperature: ${data[currentTemperatureMode]} °C
        `);

    moveTooltip(event);
}

function moveTooltip(event) {
    tooltip.style("left", (event.pageX + 10) + "px")
           .style("top", (event.pageY + 10) + "px");
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

// Utility Functions
function monthName(monthNumber) {
    return d3.timeFormat("%B")(new Date(2020, monthNumber - 1, 1));
}

// Launch
loadTemperatureData();
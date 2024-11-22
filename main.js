import * as d3 from 'd3';
import * as d3Sankey from "d3-sankey";

const width = 928;
const height = 600;
const format = d3.format(",.0f");
const linkColor = "source-target"; // source, target, source-target, or a color string.

// Create a SVG container.
const svg = d3.create("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [0, 0, width, height])
  .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

// Constructs and configures a Sankey generator.
const sankey = d3Sankey.sankey()
  .nodeId(d => d.name)
  .nodeAlign(d3Sankey.sankeyJustify) // d3.sankeyLeft, etc.
  .nodeWidth(15)
  .nodePadding(10)
  .extent([[1, 5], [width - 1, height - 5]]);

function jmuPositiveItems(item) {
  return {
    name: item["name"],
    value: item["2023"],
    title: item["name"],
    category: item["type"]
  };
}

function jmuRevenueCatagories(item, data) {
  let total = 0;
  for (let dat of data) {
    if (dat["type"] == item["type"]) {
      total += dat["2023"];
    }
  }
  return {
    name: item["type"],
    value: total,
    title: item["type"],
    category: item["type"]
  }
}

function jmuNegativeItems(item) {
  return {
    name: item["name"],
    value: item["2023"],
    title: item["name"],
    category: item["type"]
  }
}

function jmuFinanceNodes(data) {
  const dataArray = []
  let totalRev = 0;
  let totalLoss = 0;
  //1. leftmost nodes: JMU (positive) Revenue items
  for (let item of data) {
    if (item["2023"] > 0 && item["type"] != "Operating Expense") {
      dataArray.push(jmuPositiveItems(item))
      totalRev += item["2023"];
    }
  }
  //2. second-to-leftmost nodes: JMU Revenue Categories (e.g. operating revenues, non-operating revenues, etc.)
  const typeMap = new Map();
  for (let item of data) {
    if (item["2023"] > 0 && item["type"] != "Operating Expense") {
      if (!typeMap.has(item["type"])) {
        dataArray.push(jmuRevenueCatagories(item, data));
        typeMap.set(item["type"], 1)
      }
    }
  }
  //3. center node: JMU 
  dataArray.push({
    name : "JMU",
    value: totalRev,
    title: "JMU"
  })
  //4. second-to-rightmost nodes: JMU Expense (negative revenue) Categories (e.g. operating expenses)
  for (let item of data) {
    if (item["2023"] < 0 || item["type"] == "Operating Expense") {
      if (item["2023"] < 0) {
        totalLoss -= item["2023"];
      } else {
        totalLoss += item["2023"];
      }
    }
  }
  dataArray.push({
    name: "Operating Expense",
    value: totalLoss,
    title: "Operating Expense"
  })
  //5. rightmost nodes: JMU Expense items (e.g. Instruction, Research, etc.)
  for (let item of data) {
    if(item["2023"] < 0 || item["type"] == "Operating Expense") {
      dataArray.push(jmuNegativeItems(item));
    }
  }
  //return an array of objects with unique names and a display title
  return dataArray;
}

function jmuPosLink(item) {
  //item to catagories
  return {
    source: item["name"],
    target: item["type"],
    value: item["2023"]
  }
}

function jmuposCat(item) {
  //catagories to JMU
  return {
    source: item[0],
    target: "JMU",
    value: item[1]
  }
}

function jmuNegLink(item) {
  return {
    source: item["type"],
    target: item["name"],
    value: item["2023"]
  }
}

function jmuFinanceLinks(data) {
  //returns array of links between catagories
  //array of objects w/ source, target, value
  const linkArray = []
    //revenue positive items to catagories
    for (let item of data) {
      if (item["2023"] > 0 && item["type"] != "Operating Expense") {
        linkArray.push(jmuPosLink(item))
      }
    }
    console.log(linkArray)
    //catagories to JMU
    const typeMap = new Map();
    //collect totals of catagories
    for (let item of data) {
      if (item["2023"] > 0 && item["type"] != "Operating Expense") {
        if (!typeMap.has(item["type"])) {
          typeMap.set(item["type"], item["2023"])
        } else {
          typeMap.set(item["type"], typeMap.get(item["type"]) + item["2023"]);
        }
      }
    }
    for (let item of typeMap) {
      linkArray.push(jmuposCat(item));
    }
    let totalLoss = 0;
    for (let item of data) {
      if (item["type"] == "Operating Expense") {
        totalLoss += item["2023"];
      }
    }
    //JMU to expenses catagories
      linkArray.push({
        source: "JMU",
        value: totalLoss,
        target: "Operating Expense"
      })
    //expenses to items
    for (let item of data) {
      if (item["type"] == "Operating Expense") {
        linkArray.push(jmuNegLink(item));
      }
    }
  return linkArray
}

function jmuFinanceMap(jmuData) {
  //should return object w/ keys Nodes and Links
  //keys should pair with arrays of objects
  const newdata = jmuData["jmu-revenues"];
  const results = {
    nodes: jmuFinanceNodes(newdata),
    links: jmuFinanceLinks(newdata)
  };
  console.log(results)
  return results
}

async function init() {
  //const data = await d3.json("data/data_sankey.json");
  const jmuData = await d3.json("data/jmu.json");
  const financedata = jmuFinanceMap(jmuData);
  // Applies it to the data. We make a copy of the nodes and links objects
  // so as to avoid mutating the original.
  const { nodes, links } = sankey({
  // const tmp = sankey({
    nodes: financedata.nodes.map(d => Object.assign({}, d)),
    links: financedata.links.map(d => Object.assign({}, d))
  });

  // console.log('tmp', tmp);
  //console.log('nodes', nodes);
  //console.log('links', links);

  // Defines a color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Creates the rects that represent the nodes.
  const rect = svg.append("g")
    .attr("stroke", "#000")
    .selectAll()
    .data(nodes)
    .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.category));

  // Adds a title on the nodes.
  rect.append("title")
    .text(d => {
      //console.log('d', d);
      return `${d.name}\n${format(d.value)}`});

  // Creates the paths that represent the links.
  const link = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll()
    .data(links)
    .join("g")
    .style("mix-blend-mode", "multiply");

  // Creates a gradient, if necessary, for the source-target color option.
  if (linkColor === "source-target") {
    const gradient = link.append("linearGradient")
      .attr("id", d => (d.uid = `link-${d.index}`))
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d => d.source.x1)
      .attr("x2", d => d.target.x0);
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d => color(d.source.category));
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d => color(d.target.category));
  }

  link.append("path")
    .attr("d", d3Sankey.sankeyLinkHorizontal())
    .attr("stroke", linkColor === "source-target" ? (d) => `url(#${d.uid})`
      : linkColor === "source" ? (d) => color(d.source.category)
        : linkColor === "target" ? (d) => color(d.target.category)
          : linkColor)
    .attr("stroke-width", d => Math.max(1, d.width));

  link.append("title")
    .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)}`);

  // Adds labels on the nodes.
  svg.append("g")
    .selectAll()
    .data(nodes)
    .join("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => d.title);

    // Adds labels on the links.
  svg.append("g")
    .selectAll()
    .data(links)
    .join("text")
    .attr("x", d => {
      //console.log('linkd', d)
      const midX = (d.source.x1 + d.target.x0) / 2;
      return midX < width / 2 ? midX + 6 : midX - 6
    })
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => {
      //console.log('linkd', d);
      return `${d.source.title} → ${d.value} → ${d.target.title}`
    });

  const svgNode = svg.node();
    document.body.appendChild(svgNode);
  return svgNode;
}

init();
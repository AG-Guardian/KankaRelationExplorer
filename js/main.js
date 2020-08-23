const CAMPAIGN_ID = '15519'
const REQUEST_PATH = 'https://kanka.io/api/1.0/campaigns/' + CAMPAIGN_ID
const REDIRECT_PATH = 'https://kanka.io/en-US/campaign/' + CAMPAIGN_ID
const TOKEN = 'token'

// init the graph and set default style
var cy = cytoscape({
  container: document.getElementById('cy'), // container to render in
  style: cytoscape.stylesheet()
    .selector('node')
    .css({
      'label': 'data(name)',
      'background-image': 'data(image)',
      'height': 80,
      'width': 80,
      'background-fit': 'cover',
      'border-color': '#777',
      'border-width': 3,
      'text-margin-y': '-8px',
      'text-background-opacity': 1,
      'text-background-color': '#fff',
      'text-border-color': '#fff',
      'text-border-width': 3,
      'text-border-opacity': 1
    })
    .selector('edge')
    .css({
      'line-color': 'data(color)',
      'curve-style': 'bezier',
      'control-point-step-size': 40,
      'target-arrow-shape': 'triangle-backcurve',
      'target-arrow-color': 'data(color)',
      'width': 'data(attitude)',
      'text-background-opacity': 1,
      'text-background-color': '#fff',
      'text-border-color': '#fff',
      'text-border-width': 3,
      'text-border-opacity': 1
    })
});

// on load, make an ajax request for campaign characters
$(document).ready(function() {
  $.ajax({
    url: REQUEST_PATH + '/characters?related=1',
    type: 'GET',
    dataType: 'json',
    success: buildGraph,
    beforeSend: setHeader
  });
});

function setHeader(xhr) {
  xhr.setRequestHeader('authorization', 'Bearer ' + TOKEN)
  xhr.setRequestHeader('accept', 'application/json')
}

function buildGraph(json) {
  let elementList = []

  // for each entity from the ajax call, create a node
  for (entity in json.data) {
    let element = {
      group: 'nodes',
      data: {
        id: json.data[entity].entity_id,
        name: json.data[entity].name,
        image: json.data[entity].image_full,
        char_id: json.data[entity].id
      }
    }
    elementList.push(element)

    // for each relation an entity has, create an edge
    for (relation in json.data[entity].relations) {
      let element = {
        group: 'edges',
        data: {
          source: json.data[entity].relations[relation].owner_id,
          target: json.data[entity].relations[relation].target_id,
          name: json.data[entity].relations[relation].relation,
          color: json.data[entity].relations[relation].colour,
          attitude: json.data[entity].relations[relation].attitude,
        }
      }
      // if the relation does not have a color, use the default
      if (!element.data.color) {
        element.data.color = '#777'
      }
      if (!element.data.attitude) {
        element.data.attitude = 0
      }
      element.data.attitude = (((element.data.attitude + 100) / 100) * 2) + 2
      elementList.push(element)
    }
  }

  // Strip out non-character relations. Temporary workaround to keep the code simple.
  // If I was using all entity types this block would be unnecessary
  let characters = []
  for (entity in json.data) {
    characters.push(json.data[entity].entity_id)
  }
  for (var i = 0; i < elementList.length; i++) {
    if (elementList[i].group == 'edges' && !characters.includes(elementList[i].data.target)) {
      elementList.splice(i, 1);
      i--;
    }
  }

  // add all of the elements (nodes and edges) to the graph. Remove orphans to keep the graph clean.
  cy.add(elementList)
  cy.nodes().forEach(function(node){
    if (node.connectedEdges().length == 0) {
      cy.remove(node)
    }
  })

  // use an automatic layout. fcose is decently fast and looks nice
  var layout = cy.elements().layout({
    name: 'fcose',
    idealEdgeLength: 130,
    nodeDimensionsIncludeLabels: true,
  })
  layout.run()

  // Node (character) events
  cy.nodes().on('click', function(e){
    entity = cy.getElementById(e.target.id())
    window.location.href = REDIRECT_PATH + '/characters/' + entity._private.data.char_id
  })

  cy.nodes().on('mouseover', function(e){
    entity = cy.getElementById(e.target.id())
    entity.style('overlay-opacity', 0.1)
  })

  cy.nodes().on('mouseout', function(e){
    entity.style('overlay-opacity', 0)
  })

  // Edge (relation) events
  cy.edges().on('click', function(e){
    relation = cy.getElementById(e.target.id())
    window.location.href = REDIRECT_PATH + '/entities/' + relation._private.data.source + '/relations'
  })

  cy.edges().on('mouseover', function(e){
    relation = cy.getElementById(e.target.id());
    relation.style('label', relation._private.data.name);
    relation.style('overlay-opacity', 0.1)
  })

  cy.edges().on('mouseout', function(e){
    relation.style('label', '')
    relation.style('overlay-opacity', 0)
  })

  // wait until images load to display graph
  displayOnLoad()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function displayOnLoad() {
  let loading = true
  while (loading) {
    if (cy.elements('node:backgrounding').length == 0) {
      loading = false
    } else {
      await sleep(300)
    }
  }
  document.getElementById("spinner").style.display = 'none'
  document.getElementById("cy").style.display = 'block'
}

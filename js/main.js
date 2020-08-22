const CAMPAIGN_ID = '15519'
const REQUEST_PATH = 'https://kanka.io/api/1.0/campaigns/' + CAMPAIGN_ID
const REDIRECT_PATH = 'https://kanka.io/en-US/campaign/' + CAMPAIGN_ID + '/characters/'
const TOKEN = 'token'
var cy = cytoscape({
  container: document.getElementById('cy'), // container to render in

  elements: [],

  style: cytoscape.stylesheet()
    .selector('node')
    .css({
      'label': 'data(name)',
      'background-image': 'data(image)',
      'height': 80,
      'width': 80,
      'background-fit': 'cover',
      'border-color': '#000',
      'border-width': 3,
      'border-opacity': 0.5,
      'text-margin-y': '-8px',
      'text-outline-color': '#ffffff',
      'text-outline-width': '8px',
    })
    .selector('edge')
    .css({
      'label': 'data(name)',
      'source-endpoint': 'outside-to-node-or-label',
      'target-endpoint': 'outside-to-node-or-label',
      'text-outline-color': '#ffffff',
      'text-outline-width': '8px',
    }),

  layout: {
    name: 'grid',
    rows: 1
  }
});

$(document).ready(function() {
  $.ajax({
    url: REQUEST_PATH + '/characters?related=1',
    type: 'GET',
    dataType: 'json',
    success: buildElements,
    beforeSend: setHeader
  });
});

function setHeader(xhr) {
  xhr.setRequestHeader('authorization', 'Bearer ' + TOKEN);
  xhr.setRequestHeader('accept', 'application/json');
}

function buildElements(json) {
  let elementList = [];

  for (entity in json.data) {
    if (json.data[entity].relations.length > 0) {
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

      for (relation in json.data[entity].relations) {
        let element = {
          group: 'edges',
          data: {
            id: json.data[entity].relations[relation].owner_id + json.data[entity].relations[relation].target_id,
            source: json.data[entity].relations[relation].owner_id,
            target: json.data[entity].relations[relation].target_id,
            name: json.data[entity].relations[relation].relation,
          }
        }
        elementList.push(element)
      }
    }
  }

  cy.add(elementList)

  var layout = cy.elements().layout({
    name: 'cose-bilkent',
    padding: 80,
    idealEdgeLength: 130,
  });

  layout.run();

  cy.nodes().on('click', function(e){
    entity = cy.getElementById(e.target.id());
    window.location.href = REDIRECT_PATH + entity._private.data.char_id;
  });
}

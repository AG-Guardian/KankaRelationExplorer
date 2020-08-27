const entityTypes = ['characters', 'locations', 'families', 'organisations', 'items', 'notes', 'events', 'calendars', 'races', 'quests', 'journals', 'abilities', 'tags'];
const elementList = [];
const DEFAULT_COLOR = '#777777';

let CAMPAIGN_ID;
let TOKEN;
let REQUEST_PATH;
let REDIRECT_PATH;
let currentType;
let hasNextPage;
let removed;
let sourceId;
let tempId;
let addingRelation;

/**
 * On page load, create login modal to get campaign ID and API token from user input.
 */
document.addEventListener('DOMContentLoaded', function() {
  // prompt for campaign and api key
  $( function() {
    let dialog, form,
      campaign = $("#campaign"),
      token = $("#token"),
      allFields = $([]).add(campaign).add(token),
      tips = $("#login-tips");

    dialog = $("#login-form").dialog({
      dialogClass: "no-close",
      autoOpen: true,
      height: 400,
      width: 350,
      modal: true,
      buttons: {
        "Get Started": login,
      }
    });

    form = dialog.find( "form" ).on("submit", function(event) {
      event.preventDefault();
      login();
    });

    // update the validation text at the top of the modal
    function updateTips(t) {
      tips
        .text(t)
        .addClass( "ui-state-highlight" );
      setTimeout(function() {
        tips.removeClass("ui-state-highlight", 1500);
      }, 500);
    }

    // check the user input for basic validation, and then proceed by calling init()
    function login() {
      let valid = true;
      allFields.removeClass("ui-state-error");

      valid = valid && Number.isInteger(parseInt(campaign.val()));
      if (!valid) {
        campaign.addClass("ui-state-error");
        updateTips("Please enter a valid campaign ID. You can find your campaign ID in the URL of your campaign, after \"campaign/\".");
      } else {
        valid = valid && token.val() != '' && token.val() != undefined;
        if (!valid) {
          token.addClass("ui-state-error");
          updateTips("Please enter a valid API token. You create an API token under Profile > API.");
        } else {
          CAMPAIGN_ID = $("#campaign").val();
          TOKEN = $("#token").val();
          REQUEST_PATH = 'https://kanka.io/api/1.0/campaigns/' + CAMPAIGN_ID;
          REDIRECT_PATH = 'https://kanka.io/en-US/campaign/' + CAMPAIGN_ID;

          // close the menu
          updateTips("");
          dialog.dialog("close");

          // begin loading the graph
          init();
        }
      }
    }
  });
});

/**
 * Initialize the graph and context menus, then begin to import Entities
 */
function init() {
  // display loading spinner
  document.getElementById("spinner").style.display = 'block';

  // init the graph and set default styles
  let cy = window.cy = cytoscape({
    container: document.getElementById('cy'), // container to render in
    style: cytoscape.stylesheet()
    .selector('node')
    .css({
      'label': 'data(name)',
      'background-image': 'data(image)',
      'height': 80,
      'width': 80,
      'background-fit': 'cover',
      'border-color': DEFAULT_COLOR,
      'border-width': 3,
      'text-margin-y': '-8px',
      'text-background-opacity': 1,
      'text-background-color': '#ffffff',
      'text-border-color': '#ffffff',
      'text-border-width': 3,
      'text-border-opacity': 1
    })
    .selector('edge')
    .css({
      'line-color': 'data(color)',
      'curve-style': 'bezier',
      'control-point-step-size': 40,
      'target-arrow-shape': 'triangle',
      'target-arrow-color': 'data(color)',
      'width': 'data(attitude)',
      'text-background-opacity': 1,
      'text-background-color': '#ffffff',
      'text-border-color': '#ffffff',
      'text-border-width': 3,
      'text-border-opacity': 1
    }),
  });

  // init the context menus and set up their functions
  let menu = cy.contextMenus({
    menuItems: [
      {
        id: 'remove',
        content: ' remove',
        tooltipText: 'remove',
        image: {src : "resources/minus.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'edge',
        onClickFunction: function (event) {
          let target = event.target || event.cyTarget;
          removed = target.remove();
          menu.showMenuItem('undo-last-remove');
        },
        hasTrailingDivider: true
      },
      {
        id: 'undo-last-remove',
        content: ' undo last remove',
        image: {src : "resources/back.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'edge',
        show: false,
        coreAsWell: true,
        onClickFunction: function (event) {
          if (removed) {
            removed.restore();
          }
          menu.hideMenuItem('undo-last-remove');
        },
        hasTrailingDivider: true
      },
      {
        id: 'add-edge',
        content: ' add relation',
        tooltipText: 'add relation',
        image: {src : "resources/plus.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'node',
        onClickFunction: function (event) {
          sourceId = event.target.id();
          handleAddRelation();
        },
        hasTrailingDivider: true
      },
      {
        id: 'set-color',
        content: ' set color',
        tooltipText: 'set color',
        image: {src : "resources/edit.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'edge',
        onClickFunction: function (event) {
          dialog = $("#color-form").dialog({
            autoOpen: true,
            height: 275,
            width: 525,
            modal: true,
            buttons: {
              "Apply": setColor,
            }
          });

          function hexFromRGB(r, g, b) {
            let hex = [
              r.toString(16),
              g.toString(16),
              b.toString(16)
            ];

            $.each(hex, function(nr, val) {
              if (val.length === 1) {
                hex[nr] = "0" + val;
              }
            });

            return hex.join( "" ).toUpperCase();
          }

          function hexToRGB(hex) {
            let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16)
            } : null;
          }

          function refreshSwatch() {
            let red = $("#red").slider("value"),
                green = $("#green").slider("value"),
                blue = $("#blue").slider("value"),
                hex = hexFromRGB(red, green, blue);
            $("#swatch").css("background-color", "#" + hex);
          }

          let redHandle = $("#red-handle");
          let greenHandle = $("#green-handle");
          let blueHandle = $("#blue-handle");

          $("#red").slider({
            orientation: "horizontal",
            range: "min",
            max: 255,
            value: 127,
            create: function() {
              redHandle.text($(this).slider("value"));
            },
            slide: function(event, ui) {
              refreshSwatch();
              redHandle.text(ui.value);
            },
            change: refreshSwatch
          });

          $("#green").slider({
            orientation: "horizontal",
            range: "min",
            max: 255,
            value: 127,
            create: function() {
              greenHandle.text($(this).slider("value"));
            },
            slide: function(event, ui) {
              refreshSwatch();
              greenHandle.text(ui.value);
            },
            change: refreshSwatch
          });

          $("#blue").slider({
            orientation: "horizontal",
            range: "min",
            max: 255,
            value: 127,
            create: function() {
              blueHandle.text($(this).slider("value"));
            },
            slide: function(event, ui) {
              refreshSwatch();
              blueHandle.text(ui.value);
            },
            change: refreshSwatch
          });

          let color = hexToRGB(event.target._private.data.color);
          $("#red").slider("value", color.r);
          $("#green").slider("value", color.g);
          $("#blue").slider("value", color.b);
          refreshSwatch();

          function setColor() {
            let red = $("#red").slider("value"),
                green = $("#green").slider("value"),
                blue = $("#blue").slider("value"),
                hex = "#" + hexFromRGB(red, green, blue);

            relation = cy.getElementById(event.target.id());
            relation._private.data.color = hex;
            relation.style('line-color', hex);
            relation.style('target-arrow-color', hex);
            dialog.dialog("close");
          }
        },
        hasTrailingDivider: true
      },
      {
        id: 'set-attitude',
        content: ' set attitude',
        tooltipText: 'set attitude',
        image: {src : "resources/edit.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'edge',
        onClickFunction: function (event) {
          dialog = $("#attitude-form").dialog({
            autoOpen: true,
            height: 185,
            width: 400,
            modal: true,
            buttons: {
              "Apply": setAttitude,
            }
          });

          let attitudeHandle = $("#attitude-handle");

          $("#attitude").slider({
            orientation: "horizontal",
            range: "min",
            max: 100,
            min: -100,
            value: getAttitudeFromWidth(event.target._private.data.attitude),
            create: function() {
              attitudeHandle.text($(this).slider("value"));
            },
            slide: function(event, ui) {
              attitudeHandle.text(ui.value);
            }
          });

          function setAttitude() {
            let val = getWidthFromAttitude($("#attitude").slider("value"));
            let relation = cy.getElementById(event.target.id());
            relation._private.data.attitude = val;
            relation.style('width', val);
            dialog.dialog("close");
          }
        },
        hasTrailingDivider: true
      },
      {
        id: 'view-entity',
        content: ' view',
        tooltipText: 'view',
        image: {src : "resources/eye.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'node',
        onClickFunction: function (event) {
          entity = cy.getElementById(event.target.id());
          window.open(REDIRECT_PATH + '/' + entity._private.data.type + '/' + entity._private.data.typeId, '_blank');
        },
        hasTrailingDivider: true
      },
      {
        id: 'view-relation',
        content: ' view',
        tooltipText: 'view',
        image: {src : "resources/eye.svg", width : 12, height : 12, x : 6, y : 4},
        selector: 'edge',
        onClickFunction: function (event) {
          entity = cy.getElementById(event.target.id());
          window.open(REDIRECT_PATH + '/entities/' + relation._private.data.source + '/relations', '_blank');
        },
        hasTrailingDivider: true
      },
      {
        id: 'hide',
        content: ' hide',
        tooltipText: 'hide',
        image: {src : "resources/eye-slash.svg", width : 12, height : 12, x : 6, y : 4},
        selector: '*',
        onClickFunction: function (event) {
          let target = event.target || event.cyTarget;
          if (target.isEdge()) {
            target.hide();
          } else {
            addEntityToOrphans(target);
          }
        },
        disabled: false,
        hasTrailingDivider: true
      },
      {
        id: 'show-hidden',
        content: ' show hidden',
        tooltipText: 'show hidden',
        image: {src : "resources/eye.svg", width : 12, height : 12, x : 6, y : 4},
        coreAsWell: true,
        onClickFunction: function (event) {
          cy.elements().forEach(function(element) {
            if (element.isEdge() || element.connectedEdges().length > 0);
            element.show();
          });
        },
        disabled: false,
        hasTrailingDivider: true
      },
      {
        id: 'add-entity',
        content: ' add entity',
        tooltipText: 'add entity',
        image: {src : "resources/plus.svg", width : 12, height : 12, x : 6, y : 4},
        coreAsWell: true,
        onClickFunction: function (event) {
          dialog = $("#orphan-form").dialog({
            autoOpen: true,
            height: 200,
            width: 350,
            modal: true
          });

          let opened = false;

          $("#orphans").selectmenu({
            open: function () {
              opened = true;
            },
            select: function(event, data) {
              if (opened) {
                // show the selected entity
                cy.getElementById(data.item.value).show();

                let dropdown = document.getElementById("orphans");
                dropdown.remove(data.item.index);

                // close the menu
                dialog.dialog("close");
              }
            }
          }).selectmenu("menuWidget").addClass("overflow");

          $("#orphans").selectmenu("refresh");
        },
        disabled: false,
        hasTrailingDivider: true
      },
      {
        id: 'hide-orphans',
        content: ' hide all orphans',
        tooltipText: 'hide all orphans',
        image: {src : "resources/eye-slash.svg", width : 12, height : 12, x : 6, y : 4},
        coreAsWell: true,
        onClickFunction: function (event) {
          cy.elements().forEach(function(element) {
            if (element.isNode() && element.connectedEdges().length == 0 && !element.hidden()) {
              addEntityToOrphans(element);
            }
          });
        },
        disabled: false,
        hasTrailingDivider: true
      },
    ]
  });

  // enable double-click event
  cy.dblclick();

  // on load, make an ajax requests for campaign entities
  getEntities();
}

async function getEntities() {
  for (i in entityTypes) {
    currentType = entityTypes[i];
    hasNextPage = true;
    let page = 1;

    while(hasNextPage) {
      try {
        await getEntityByType(entityTypes[i], page);
        page++;
      } catch(e) {
        alert("Failed to get entities. Please check your inputs and try again.");
        location.reload();
      }
    }
  }
  $("#loading-text").html("");
  buildGraph(elementList);
}

function getEntityByType(entityType, page) {
  $("#loading-text").html("Loading " + entityType + "...");
  return $.ajax({
    url: REQUEST_PATH + '/' + entityType + '?page=' + page + '&related=1',
    type: 'GET',
    dataType: 'json',
    success: getElements,
    beforeSend: setHeader
  });
}

function setHeader(xhr) {
  xhr.setRequestHeader('authorization', 'Bearer ' + TOKEN);
  xhr.setRequestHeader('accept', 'application/json');
}

function getElements(json) {
  // for each entity from the ajax call, create a node
  for (entity in json.data) {
    let element = {
      group: 'nodes',
      data: {
        id: json.data[entity].entity_id,
        name: json.data[entity].name,
        image: json.data[entity].image_full,
        type: currentType,
        typeId: json.data[entity].id,
      }
    };
    elementList.push(element);

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
      };
      // if the relation does not have a color, use the default
      if (!element.data.color) {
        element.data.color = DEFAULT_COLOR;
      }
      if (!element.data.attitude) {
        element.data.attitude = 0;
      }
      element.data.attitude = getWidthFromAttitude(element.data.attitude);
      elementList.push(element);
    }
  }

  // deal with pagination
  if (!json.links.next) {
    hasNextPage = false;
  }
}

function buildGraph(elementList) {
  // add all of the elements (nodes and edges) to the graph. Remove orphans to keep the graph clean.
  cy.add(elementList);
  cy.nodes().forEach(function(node) {
    if (node.connectedEdges().length == 0) {
      addEntityToOrphans(node);
    }
  });

  // organize and display the elements
  runLayout();

  // add user input events to the elements
  addListeners();

  // wait until images load to display graph
  displayOnLoad();
}

function addEntityToOrphans(node) {
  // hide the node, we dont want to show orphans unless asked
  node.hide();

  // add the node to the dropdown
  let dropdown = document.getElementById("orphans");
  let option = document.createElement("option");
  option.text = node._private.data.name;
  option.value = node.id();
  dropdown.add(option);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function displayOnLoad() {
  let loading = true;
  while (loading) {
    if (cy.nodes(':backgrounding').length == 0) {
      loading = false;
    } else {
      await sleep(300);
    }
  }
  document.getElementById("spinner").style.display = 'none';
  document.getElementById("cy").style.display = 'block';
}

function runLayout() {
  // use an automatic layout. fcose is decently fast and looks nice
  let layout = cy.elements().layout({
    name: 'cose-bilkent',
    idealEdgeLength: 130,
    nodeDimensionsIncludeLabels: true,
  });
  layout.run();
}

function addListeners() {
  // NODES / ENTITIES

  // open on double click
  cy.nodes().on('dblclick', function(e) {
    entity = cy.getElementById(e.target.id());
    window.open(REDIRECT_PATH + '/' + entity._private.data.type + '/' + entity._private.data.typeId, '_blank');
  });

  // highlight on hover
  cy.nodes().on('mouseover', function(e) {
    entity = cy.getElementById(e.target.id());
    entity.style('overlay-opacity', 0.1);
  });

  // stop highlight on hover
  cy.nodes().on('mouseout', function(e) {
    entity.style('overlay-opacity', 0);
  });

  // show temp relation on hover when adding
  cy.nodes().on('mouseover', function(e) {
    if (addingRelation) {
      removeTempRelation();
      tempId =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      let target = e.target;
      let source = cy.getElementById(sourceId);
      let tempRelation = {
        group: 'edges',
        data: {
          id: tempId,
          source: source._private.data.id,
          target: target._private.data.id,
          name: '',
          color: '#dddddd',
          attitude: 4,
        }
      };
      cy.add(tempRelation);
    }
  });

  // remove temp relation on hover
  cy.nodes().on('mouseout', function(e) {
    removeTempRelation();
  });

  // EDGES / RELATIONS

  // open on double click
  cy.edges().on('dblclick', function(e) {
    relation = cy.getElementById(e.target.id());
    window.open(REDIRECT_PATH + '/entities/' + relation._private.data.source + '/relations', '_blank');
  });

  // highlight on hover
  cy.edges().on('mouseover', function(e) {
    relation = cy.getElementById(e.target.id());
    relation.style('label', relation._private.data.name);
    relation.style('overlay-opacity', 0.1);
  });

  // stop highlight on hover
  cy.edges().on('mouseout', function(e) {
    relation.style('label', '');
    relation.style('overlay-opacity', 0);
  });
}

function handleAddRelation() {
  addingRelation = true
  cy.nodes().once('click', function(e) {
    removeTempRelation();
    addingRelation = false;

    // prompt for user input
    $( function() {
      let dialog, form,
        relationName = $("#relation"),
        tips = $("#relation-tips");
  
      dialog = $("#relation-form").dialog({
        autoOpen: true,
        height: 250,
        width: 350,
        modal: true,
        buttons: {
          "Submit": applyName,
        }
      });
  
      form = dialog.find( "form" ).on("submit", function(event) {
        event.preventDefault();
        applyName();
      });
  
      // check the user input for basic validation, and then proceed by calling init()
      function applyName() {
        let valid = true;
        relationName.removeClass("ui-state-error");

        valid = valid && relationName.val() != '' && relationName.val() != undefined;
        if (!valid) {
          relationName.addClass("ui-state-error");
        }
  
        if (valid) {
          let relationName = $("#relation").val();
          let target = e.target;
          let source = cy.getElementById(sourceId);
          let relation = {
            group: 'edges',
            data: {
              source: source._private.data.id,
              target: target._private.data.id,
              name: relationName,
              color: DEFAULT_COLOR,
              attitude: getWidthFromAttitude(0),
            }
          };
          cy.add(relation);
          addListeners();
  
          // close the menu
          dialog.dialog("close");
        }
      }
    });
  });
}

function removeTempRelation() {
  if (tempId) {
      cy.remove(cy.getElementById(tempId));
      tempId = undefined;
    }
}

function getAttitudeFromWidth(width) {
  return (((width - 2) / 2) * 100) - 100;
}

function getWidthFromAttitude(attitude) {
  return (((attitude + 100) / 100) * 2) + 2;
}




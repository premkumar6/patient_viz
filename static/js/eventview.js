// // Represents a view component that displays and manages a list of events in a sidebar
function EventView(sel) {
  var that = this;
  var totalHeight = Number.NaN;
  var totalWidth = 265;
  var singleSlot = false;
  var singleType = false;
  var events = []; // Array to hold the events currently displayed in the EventView
  
  // Apply initial styles to the root element
  sel.style({
    "display": "inline-block",
    "padding": 0,
    "width": totalWidth + "px"
  });
  // Create the main container for the EventView
  var full = sel.append("div");
  // Create and style the header, which displays the title "Selection"
  var header = full.append("span").text("Selection").classed("hidden", true).style({
    "font-weight": 500
  });
  // Create a container for the list of events.
  var list = full.append("div").style({
    "overflow": "auto",
  });
   // Create a dropdown menu in the header for selecting different sorting and grouping options
  var sortAndGroup = null;
  var dropdown = header.append("select").classed("dropdown", true).on("change", function() {
    var dd = dropdown.node();
    var sag = d3.select(dd.options[dd.selectedIndex]).datum();
    that.selectSortAndGroup(sag);  // Change the sorting and grouping strategy based on the selected option
  }).style({
    "position": "absolute",
    "right": "14px"
  });
   // Method to resize the EventView based on available height and padding
  this.resize = function(allowedHeight, bodyPadding) {
    sel.style({
      "position": "absolute",
      "top": bodyPadding + "px",
      "right": 10 + "px",
      "width": totalWidth + "px",
      "height": allowedHeight + "px"
    });
    full.style({
      "width": totalWidth + "px",
      "height": allowedHeight + "px"
    });
    var head = header.node().offsetHeight;
    list.style({
      "max-height": (allowedHeight - head - 10) + "px" // Adjust the max height of the event list to fit within the available space
    });
  };

  // Method to connect the EventView to an event pool
  this.connectPool = function(pool) {
     // Add a listener to the pool to update the EventView when events are selected
    pool.addSelectionListener(function(es, types, singleSlot, singleType) {
      if(es.length && singleSlot) {
        var tmp = [];
        pool.traverseEventsForEventTime(es[0], function(e) {
          tmp.push(e);
        });
        that.setEvents(tmp, singleSlot, singleType);
      } else {
        that.setEvents(es, singleSlot, singleType);
      }
    });
    // Add a listener to the pool to update the EventView when events are highlighted
    pool.addHighlightListener(function() {
      that.updateEntries();
    });
  };
  // Method to set the events to be displayed in the EventView
  this.setEvents = function(es, ss, st) {
    events = es;
    singleSlot = ss;
    singleType = st;
    that.updateList();
  };
  // Method to update the list of events displayed in the EventView
  this.updateList = function() {
    var groups;
    // Group events if a grouping function is defined
    if(sortAndGroup && sortAndGroup.group) {
      var set = {};
      events.forEach(function(e) {
        var g = sortAndGroup.group(e);  // Determine the group for each event
        if(!(g.id in set)) {
          set[g.id] = {
            id: g.id,
            desc: g.desc,
            events: []
          };
        }
        set[g.id].events.push(e); // Add the event to its corresponding group
      });
      groups = [];
      Object.keys(set).sort().forEach(function(id) {
        groups.push(set[id]);
      });
    } else {
      // If no grouping is applied, place all events in a single group
      groups = [{
        id: "events",
        desc: "Events",
        events: events
      }];
    }
     // Bind the groups to the DOM elements and order them
    var gs = list.selectAll("p.eP").data(groups, function(g) {
      return g.id;
    }).order();
    gs.exit().remove();  // Remove any old group elements
    // Append new group elements for entering groups
    var gsE = gs.enter().append("p").classed("eP", true);
    gsE.append("h5").classed("eHead", true);
    gsE.append("ul").classed({
      "list-unstyled": true,
      "eUl": true
    }).style({
      "font-size": "10px",
      "font-family": "monospace",
      "white-space": "nowrap"
    });

    // Function to propagate group properties to new elements
    function propagateGroup(g) {
      groups.forEach(function(ref) {
        if(ref.id !== g.id) return;
        g.events = ref.events;
        g.desc = ref.desc;
      });
    };
    // Update group headers with the correct description
    var groupHeaders = gs.selectAll("h5.eHead");
    groupHeaders.each(propagateGroup);
    groupHeaders.text(function(g) {
      return g.desc;
    });

     // Bind events to the corresponding group list elements
    var eu = gs.selectAll("ul.eUl").each(propagateGroup);
    var es = eu.selectAll("li.pElem").data(function(g) {
      return g.events;
    }, function(e) {
      return e.getId();
    });
    es.exit().remove();
    es.enter().append("li").classed("pElem", true).each(function(e) {
      var li = d3.select(this);
      e.createListEntry(li);
    });
    if(sortAndGroup && sortAndGroup.sort) {
      es.sort(sortAndGroup.sort);
    }
    that.updateEntries();
  };
  this.updateEntries = function() {
    list.selectAll("li.pElem").each(function(e) {
      var li = d3.select(this);
      e.updateListEntry(li, singleSlot, singleType);
    });
  };
  // Method to add a sorting and grouping strategy to the dropdown menu
  this.addSortAndGroup = function(desc, sort, group) {
    // TODO
    var g = {
      desc: desc,
      sort: sort,
      group: group
    };
    dropdown.append("option").datum(g).text(g.desc);
    return g;
  };
  // Method to select and apply a sorting and grouping strategy
  this.selectSortAndGroup = function(sg) {
    sortAndGroup = sg;
    // TODO
    that.updateList();
  };
} // EventView


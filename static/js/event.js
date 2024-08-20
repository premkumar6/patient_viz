// Event class constructor function
function Event(e, pool, dictionary) {
  var that = this;
  // Generate a unique ID for each event using a static method.
  var id = Event.nextId();
  // Parse the event time as an integer from the input data.
  var time = parseInt(e["time"]);
  // e["weight"] = Math.max(Math.floor(Math.random() * 100 - 40) / 10 - 0.5, 0);
  // weights assigned to events
  var specialInfo = !e["weight"] ? null : {
    weight: Math.abs(e["weight"]), // the absolute value of the weight
    radius: 4 + 160 * Math.abs(e["weight"]), // The radius size for the event based on its weight.
    isneg: e["weight"] > 0 // Indicates if the weight is positive.
  };
  // If the event has weight
  if(e["weight"]) {
    TypePool.hasWeightedEvent = true;
  }
  // Cost associated with the event, defaulting to 0 if not provided.
  var cost = e["cost"] || 0;
  if(cost) {
    cost = +cost;
    if(Number.isNaN(cost)) {
      cost = 0; // Ensure cost is a valid number.
    }
  }
  // Method to get the cost of the event.
  this.cost = function() {
    return cost;
  };

  var resultFlag = (e["flag"] || "").trim();
  // Indicates whether the event is selected.
  var selected = false;

  var topoX = -1;
  this.topoX = function(_) {
    if(!arguments.length) return topoX;
    topoX = _;
  };
   // Index of the event within its type.
  var ixInType = -1;
  this.ixInType = function(_) {
    if(!arguments.length) return ixInType;
    ixInType = _;
  };

  // Last known X-coordinate, useful for tracking movement
  var lastX = Number.NaN;
  this.lastX = function(_) {
    if(!arguments.length) return lastX;
    lastX = _;
  };
   // Width of the event representation
  var width = Number.NaN;
  this.width = function(_) {
    if(!arguments.length) return width;
    width = _;
  };

  // Visibility status of the event
  var shown = true;
  this.shown = function(_) {
    if(!arguments.length) return shown;
    shown = _;
    if(!shown) {
      that.deleteEvent();
      destroyed = false;
    }
  };
   // Checks if the current event is equivalent to another event based on time, weight, and description
  this.eq = function(otherEvent) {
    if(that === otherEvent) return true;
    if(that.getTime() !== otherEvent.getTime()) return false;
    if(that.getWeight() !== otherEvent.getWeight()) return false;
    if(that.getDesc() !== otherEvent.getDesc()) return false;
    return true;
  };
  // Determine the type of the event by adding it to the event pool and referencing the dictionary.
  var type = pool.addEventToType(that, e, dictionary);
  // Generate a description for the event.
  var desc = Event.eventDesc(e, type);

   // Register the event by its ID if present in the data.
  if("event_id" in e) {
    pool.registerNamedEvent(e["event_id"], that);
  }
  var connections = e["connections"] || [];

  var eg_id = "";
  if("row_id" in e) {
    eg_id = e["row_id"];
    if(eg_id.length) {
      pool.registerEventGroup(eg_id, that);
    }
  }
   // Method to get the event group ID
  this.getEventGroupId = function() {
    return eg_id;
  };
  // Cached value to determine the first event of the group
  var fog = null
  this.firstOfGroup = function(_) {
    if(!arguments.length) {
      if(!fog) {
        fog = getFirstOfGroup();
      }
      return fog;
    }
    fog = _;
  };

   // Method to determine the first event of the group based on time.
  function getFirstOfGroup() {
    if(!eg_id.length) return that;
    var typeId = that.getType().getTypeId();
    var time = that.getTime();
    var eve = that;
    var eves = pool.getEventGroup(eg_id).filter(function(e) {
      return typeId === e.getType().getTypeId();
    });
    eves.forEach(function(e) {
      var t = e.getTime();
      if(t < time) {
        time = t;
        eve = e;
      }
    });
    eves.forEach(function(e) {
      e.firstOfGroup(eve);
    });
    return eve;
  }
  // Determines if this is the first event of its type
  this.isFirstOfType = function() {
    return type.getCount() && type.getEventByIndex(0) === that;
  };
  // Checks if the event is weighted
  this.isWeighted = function() {
    return !!specialInfo;
  };
   // Method to get the weight of the event
  this.getWeight = function() {
    return specialInfo ? specialInfo.weight : 0;
  };
  // Show only the events that are weighted
  this.showOnlyWeighted = function() {
    that.shown(!!specialInfo);
  };
  // Method to handle click selection of the event
  this.clickSelected = function() {
    var pool = that.getType().getPool();
    pool.highlightMode(TypePool.HIGHLIGHT_BOTH);
    pool.highlightEvent(that);
  };
  // Set the selected state of the event
  this.setSelected = function(isSelected) {
    var old = selected;
    selected = !!isSelected;
    if(old != selected) {
      that.getType().getPool().updateSelection();
    }
  };
  this.isSelected = function() {
    return selected;
  };
  this.getTime = function() {
    return time;
  };
  this.getType = function() {
    return type;
  };
  // Method to get the color of the event
  this.getColor = function() {
    var pool = type.getPool();
    if(pool.greyOutRest() && pool.hasSelection() && pool.fixSelection() && !that.isSelected()) {
      return d3.rgb("darkgray");
    }
    return that.getBaseColor();
  };
  this.getBaseColor = function() {
    return that.getType().getColor(resultFlag);
  };
  this.getDesc = function() {
    return desc + " (" + that.getType().getCount() + ")";
  };
  this.getId = function() {
    return id;
  };

  var sel = null;
  var additional = null;
  var connectionsPath = null;
  // Indicates if the event has been destroyed
  var destroyed = false;
  // Method to select the event, which creates an SVG rectangle representing the event
  this.select = function() {
    if(destroyed) {
      console.warn("event already destroyed");
      return null;
    }
    if(!sel) {
      var pSel = that.getType().select();
      sel = pSel.append("rect").datum(that);
    }
    return sel;
  };
   // Method to update the visual appearance of the event
  this.updateLook = function() {
    if(destroyed) {
      console.warn("event already destroyed");
      return false;
    }
    that.select().attr({
      "fill": that.getColor(),
      "stroke": that.isSelected() ? "gray" : "gray",
      "stroke-width": 0.1
    });
    // Handle connections to other events
    if(connections.length && !connectionsPath) {
      connectionsPath = pool.select().append("g").datum(that);
    }
    if(connectionsPath) {
      var boxSize = pool.boxSize();
      var colW = boxSize[0];
      var rowH = boxSize[1];
      var ownX = pool.getXByEventTime(that) + colW * 0.5;
      var ownY = that.getType().getY() + rowH * 0.5;
      connectionsPath.selectAll("line").remove();
      if(that.shown()) {
        connections.forEach(function(con) {
          var cid = con["event_id"];
          var other = pool.getNamedEvent(cid);
          if(!other || !other.shown()) return;
          var x = pool.getXByEventTime(other) + colW * 0.5;
          var y = other.getType().getY() + rowH * 0.5;
          connectionsPath.append("line").attr({
            "stroke-width": "stroke_width" in con ? con["stroke_width"] : 4,
            "stroke": "color" in con ? con["color"] : "black",
            "stroke-linecap": "round",
            "x1": ownX,
            "y1": ownY,
            "x2": x,
            "y2": y
          });
        });
      }
    }
    return true;
  };
  // Method to update additional visual elements for weighted events
  this.updateAdditional = function(x, y) {
    if(!specialInfo) {
      if(additional) {
        additional.remove();
        additional = null;
      }
      return;
    }
    if(!additional) {
      var pSel = that.getType().select();
      additional = pSel.append("circle").datum(that);
      jkjs.util.toFront(additional, false);
    }
    additional.attr({
      "cx": x,
      "cy": y,
      "r": specialInfo.radius,
      "stroke-width": 1,
      "stroke": specialInfo.isneg ? "red" : "black",
      "fill": "none",
      // "opacity": 0.5
    });
  };
  // Method to delete the event from the visualization
  this.deleteEvent = function() {
    if(sel) {
      sel.remove();
      sel = null;
    }
    if(additional) {
      additional.remove();
      additional = null;
    }
    if(connectionsPath) {
      connectionsPath.remove();
      connectionsPath = null;
    }
    destroyed = true;
  };
  // Method to create a list entry for the event in the sidebar or other UI component
  this.createListEntry = function(sel) {
    sel.on("click", function(e) {
      if(d3.event.button != 0) return;
      e.clickSelected();
    });
    sel.append("div").classed("pBox", true).style({
      "background-color": function(e) {
        return e.getBaseColor();
      }
    });
    sel.append("span");
  };
  // Method to update the list entry when the event is modified
  this.updateListEntry = function(sel, singleSlot, singleType) {
    var color = that.getBaseColor();
    var showSelection = pool.highlightEvent() === that && (pool.highlightMode() === TypePool.HIGHLIGHT_BOTH);
    // removes all children of sel
    sel.selectAll("span").text(that.getDesc()).style({
      "background-color": showSelection ? color : null,
      "color": showSelection ? jkjs.util.getFontColor(color) : null
    });
    // TODO scroll only when necessary
    // if(singleSlot && singleType && showSelection) {
    //   sel.node().scrollIntoView(true);
    // }
  };
} // Event
// Static method to generate the next unique ID for an event
Event.currentId = 0;
Event.nextId = function() {
  var id = "e" + Event.currentId;
  Event.currentId += 1;
  return id;
};

// Static method to generate the description of an event based on its type
Event.eventDesc = function(e, type) {
  var add;
  if("flag" in e) {
    add = e["flag_value"] + (e["flag"] ? " ["+e["flag"]+"]" : "") + ": ";
  } else {
    add = "";
  }
  return add + type.getDesc();
};

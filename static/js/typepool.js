function TypePool(busy, overview, setBox, onVC, cw, rh) {
  var that = this;
  var startTime = Number.NaN;  // Start time for the event pool
  var endTime = Number.NaN;    // End time for the event pool
  var colW = cw;               // Column width for event visualization
  var rowH = rh;               // Row height for event visualization
  var width = Number.NaN;      // Overall width of the event pool
  var groups = {};             // Stores event types grouped by their group ID
  var sel = null;              // Selection for primary event handling
  var sec = null;              // Secondary selection for additional event handling
  var helpH = null;            // Helper for horizontal highlighting
  var helpV = null;            // Helper for vertical highlighting
  var hBars = [];              // Array for storing horizontal bars in the visualization
  var vBars = [];              // Array for storing vertical bars in the visualization
  var vSpan = [];              // Array for storing vertical spans in the visualization

  /**
   * Returns the 'busy' status of the TypePool.
   */
  this.getBusy = function() {
    return busy;
  };

  /**
   * Gets the current mouse position relative to the selected element.
   */
  this.getMousePos = function() {
    return d3.mouse(sel.node());
  };

  var eventMap = {};  // Map of registered named events
  
  /**
   * Registers an event with a unique ID. Logs a warning if the ID is already in use.
   */
  this.registerNamedEvent = function(id, eve) {
    if(id in eventMap) {
      console.warn("duplicate event id: " + id);
    }
    eventMap[id] = eve;
  };

  /**
   * Retrieves a registered event by its ID. Logs a warning if the ID is unknown.
   */
  this.getNamedEvent = function(id) {
    if(!(id in eventMap)) {
      console.warn("unknown event id: " + id);
    }
    return eventMap[id] || null;
  };

  var eventGroups = {};  // Map of registered event groups
  var egSel = null;      // Selection for event group visualization

  /**
   * Registers an event into a group by its group ID.
   */
  this.registerEventGroup = function(eg_id, eve) {
    if(!(eg_id in eventGroups)) {
      eventGroups[eg_id] = [];
    }
    eventGroups[eg_id].push(eve);
  };

  /**
   * Retrieves all events belonging to a specific event group.
   */
  this.getEventGroup = function(eg_id) {
    return eg_id in eventGroups ? eventGroups[eg_id] : [];
  };

  /**
   * Updates the visualization lines connecting events within the same group.
   */
  this.updateEventGroupLines = function(eve) {
    overview.clearShadow();

    function update() {
      if(!egSel) {
        egSel = that.select().append("g");
      }
      egSel.selectAll("line").remove();
      if(!eve) return;
      var eg_id = eve.getEventGroupId();
      var eg = that.getEventGroup(eg_id);
      if(!eg.length && eve.shown()) return;
      var boxSize = that.boxSize();
      var colW = boxSize[0];
      var rowH = boxSize[1];
      var ownX = that.getXByEventTime(eve) + colW * 0.5;
      var ownY = eve.getType().getY() + rowH * 0.5;
      eg.forEach(function(other) {
        if(!other || !other.shown() || other === eve) return;
        var x = that.getXByEventTime(other) + colW * 0.5;
        var y = other.getType().getY() + rowH * 0.5;
        egSel.append("line").attr({
          "stroke-width": 4,
          "stroke": "black",
          "stroke-linecap": "round",
          "x1": ownX,
          "y1": ownY,
          "x2": x,
          "y2": y
        });
      });
    }

    update();
    overview.onBoxUpdate();
  };

  /**
   * Adds an event to a specific type within a group, creating the type if it doesn't exist.
   */
  this.addEventToType = function(eve, e, dictionary) {
    var g = e["group"];
    console.log("Adding event to type:", g);
    if(!(g in groups)) {
      groups[g] = {};
    }
    var grp = groups[g];
    var id = e["id"];
    var res;
    if(!(id in grp)) {

      /**
       * Recursive function to get an alias type for an event.
       */
      function getAliasType(id) {
        if(!(id in dictionary[g])) {
          return null;
        }
        var t = null;
        if("alias" in dictionary[g][id]) {
          var alias = dictionary[g][id]["alias"];
          if(!(alias in grp)) {
            t = getAliasType(alias);
            if(t) {
              grp[alias] = t;
            }
          } else {
            t = grp[alias];
          }
        }
        if(!t && id in dictionary[g]) {
          t = new Type(that, g, id, dictionary);
        }
        return t;
      }

      res = getAliasType(id);
      if(!res) {
        console.warn("unknown type: " + g + " " + id);
        res = new Type(that, g, id, dictionary);
      }

      grp[id] = res;
      
      // Create all subtypes as well
      var t = res;
      while(t.getParentString() && !that.hasTypeFor(g, t.getParentString())) {
        var p = t.getParentString();
        t = new Type(that, g, p, dictionary);
        grp[p] = t;
      }
      if(!("" in grp)) {
        grp[""] = new Type(that, g, "", dictionary);
      }
    } else {
      res = grp[id];
    }
    res.addEvent(eve, e);
    return res;
  };

  /**
   * Checks if a specific type exists within a group.
   */
  this.hasTypeFor = function(group, id) {
    return group in groups && id in groups[group];
  };

  /**
   * Retrieves a specific type within a group by its ID.
   */
  this.getTypeFor = function(group, id) {
    if(!(group in groups)) {
      console.warn("unknown group", group);
      return null;
    }
    var g = groups[group];
    if(!(id in g)) {
      console.warn("unknown id in group " + group, "'" + id + "'");
      return null;
    }
    return g[id];
  };

  /**
   * Traverses all groups and applies a callback function to each.
   */
  this.traverseGroups = function(cb) {
    Object.keys(groups).forEach(function(gid) {
      cb(gid, groups[gid]);
    });
  };

  /**
   * Traverses a specific group and applies a callback function to each type within the group.
   */
  this.traverseGroup = function(gid, cb) {
    var group = groups[gid];
    Object.keys(group).forEach(function(tid) {
      cb(group[tid]);
    });
  };

  /**
   * Traverses all types and applies a callback function to each, with optional sorting.
   */
  this.traverseTypes = function(cb, sorting) {
    var types = [];
    this.traverseGroups(function(_, group) {
      Object.keys(group).forEach(function(tid) {
        var type = group[tid];
        if(type.hasEvents()) {
          types.push(type);
        }
      });
    });
    if(sorting) {
      types.sort(sorting);
    }
    types.forEach(function(type) {
      cb(type.getGroupId(), type.getTypeId(), type);
    });
  };

  /**
   * Traverses all days and applies a callback function to each day's events.
   */
  this.traverseDays = function(cb) {
    var types = [];
    that.traverseTypes(function(_, _, type) {
      types.push({
        type: type,
        index: 0,
        event: type.getEventByIndex(0),
        length: type.getCount()
      });
    });
    var finished = false;
    var curTime = Number.NEGATIVE_INFINITY;
    while(!finished) {
      var eventsToday = [];
      var nextTime = Number.POSITIVE_INFINITY;
      finished = true;
      types.forEach(function(obj) {
        var e = obj.event;
        if(!e) {
          return;
        }
        var time = e.getTime();
        if(time < nextTime && time > curTime) {
          nextTime = time;
        }
        if(time == curTime) {
          eventsToday.push(e);
          obj.index += 1;
          if(obj.index < obj.length) {
            obj.event = obj.type.getEventByIndex(obj.index);
          } else {
            obj.event = null;
          }
        }
        finished = false;
      });
      if(eventsToday.length) {
        cb(curTime, eventsToday);
      }
      if(Number.isFinite(nextTime)) {
        curTime = nextTime;
      } else {
        finished = true;
      }
    }
  };

  /**
   * Traverses

 all events and applies a callback function to each.
   */
  this.traverseEvents = function(cb) {
    this.traverseTypes(function(gid, tid, type) {
      type.traverseEvents(function(e) {
        cb(gid, tid, e);
      });
    });
  };

  /**
   * Traverses all events, including invisible ones, and applies a callback function to each.
   */
  this.traverseAllEvents = function(cb) {
    this.traverseTypes(function(gid, tid, type) {
      type.traverseAllEvents(function(e) {
        cb(gid, tid, e);
      });
    });
  };

  /**
   * Traverses events within a specific range of X-coordinates (pixels) and applies a callback to each.
   */
  this.traverseEventsForX = function(x, cb) {
    var toX = x;
    var fromX = toX - colW;
    this.traverseTypes(function(gid, tid, type) {
      if(!type.isValid()) return;
      type.traverseEventRange(fromX, toX, function(e) {
        return that.getXByEventTime(e);
      }, function(e) {
        cb(e);
      });
    });
  };

  /**
   * Traverses events within a specific range of time and applies a callback to each.
   */
  this.traverseEventsForTime = function(time, cb) {
    var toTime = time;
    var fromTime = toTime - minTimeDiff;
    this.traverseEventsForTimespan(fromTime, toTime, cb);
  };

  /**
   * Traverses events within a specific timespan and applies a callback to each.
   */
  this.traverseEventsForTimespan = function(fromTime, toTime, cb) {
    this.traverseTypes(function(gid, tid, type) {
      if(!type.isValid()) return;
      type.traverseEventRange(fromTime, toTime, function(e) {
        return e.getTime();
      }, function(e) {
        cb(e);
      });
    });
  };

  /**
   * Converts event data to a bit vector representation.
   */
  this.toBitVector = function(type) {
    var len = Math.ceil((endTime - startTime) / minTimeDiff);
    var vec = new Uint8Array(len);
    type.traverseEvents(function(e) {
      vec[Math.floor((e.getTime() - startTime) / minTimeDiff)] = 1;
    });
    return vec;
  };

  var topTenWeights = [];       // Top ten event weights
  var distinctTypes = 0;        // Number of distinct event types
  var minTimeDiff = Number.POSITIVE_INFINITY;  // Minimum time difference between events

  /**
   * Clears all events and resets the state.
   */
  this.clearEvents = function() {
    topTenWeights = [];
    startTime = 0;
    endTime = 1;
    minTimeDiff = 1;
    distinctTypes = 0;
    that.traverseTypes(function(gid, tid, t) {
      t.deleteType();
    });
    groups = {};
    eventMap = {};
    hBars.forEach(function(b) {
      b.sel && b.sel.remove();
    });
    vBars.forEach(function(b) {
      b.sel && b.sel.remove();
    });
    vSpan.forEach(function(b) {
      b.sel && b.sel.remove();
    });
    hBars = [];
    vBars = [];
    vSpan = [];
    width = colW;
    that.updateLook();
  };

  /**
   * Reads events from a person object and updates the visualization.
   */
  this.readEvents = function(person, dictionary) {
    if(!("start" in person) || !("end" in person)) {
      console.warn("missing time bounds 'start' or 'end'", person["start"], person["end"]);
      return;
    }
    TypePool.hasWeightedEvent = false;
    var timeSpan = [parseInt(person["start"]), parseInt(person["end"])];
    startTime = timeSpan[0];
    endTime = timeSpan[1];
    var allTimes = [];
    person["events"].forEach(function(e) {
      var eve = new Event(e, that, dictionary);
      var time = eve.getTime();
      allTimes = jkjs.util.join(allTimes, [time]);
      if(time < startTime || time > endTime) {
        console.warn("time is out of bounds: " + startTime + " < " + time + " < " + endTime);
        console.log(eve);
      }
      if(eve.isWeighted()) {
        topTenWeights.push(eve.getWeight());
        topTenWeights.sort(d3.ascending);
        var tmp = jkjs.util.unique(topTenWeights);
        if(tmp.length > 10) {
          tmp = tmp.slice(-10);
        }
        topTenWeights = tmp;
      }
    });
    var topoTimes = {};
    allTimes.forEach(function(time, ix) {
      topoTimes[time] = ix;
    });
    allTimes = [];
    distinctTypes = 0;
    minTimeDiff = Number.POSITIVE_INFINITY
    that.traverseTypes(function(gid, tid, type) {
      var mTimeDiff = type.sortEvents();
      if(mTimeDiff < minTimeDiff) {
        minTimeDiff = mTimeDiff;
      }
      distinctTypes += 1;
    });
    if(!Number.isFinite(minTimeDiff)) {
      // Slow way of getting minTimeDiff -- collecting all times
      var allEventTimes = [];
      that.traverseAllEvents(function(_, _, e) {
        allEventTimes.push(e.getTime());
      });
      allEventTimes.sort(d3.ascending);
      var lastTime = Number.NEGATIVE_INFINITY;
      allEventTimes.forEach(function(t) {
        if(t === lastTime) return;
        var diff = t - lastTime;
        if(diff < minTimeDiff) {
          minTimeDiff = diff;
        }
        lastTime = t;
      });
    }
    that.traverseEvents(function(gid, tid, e) {
      e.topoX(topoTimes[e.getTime()]);
    });
    (!Number.isFinite(minTimeDiff) || minTimeDiff <= 0) && console.warn("minTimeDiff incorrect", minTimeDiff, that);
    width = (endTime - startTime) / minTimeDiff * colW;
    d3.select("#pShowLabel").style({
      "display": TypePool.hasWeightedEvent ? null : "none"
    });
  };

  /**
   * Checks if an event's weight is within the top ten weights.
   */
  this.isInTopTenWeight = function(weight) {
    if(!topTenWeights.length) return true;
    return weight >= topTenWeights[0];
  };

  /**
   * Returns the total number of distinct event types.
   */
  this.getTotalDistinctTypeCount = function() {
    return distinctTypes;
  };

  /**
   * Placeholder function for unimplemented features.
   */
  function noImpl() {
    console.warn("no implementation possible");
    console.trace();
  }

  /**
   * Returns the width of the TypePool.
   */
  function getWidth() {
    return width;
  }

  var allW = width;  // Overall width including any padding or margins

  /**
   * Returns the full width of the visualization.
   */
  function getAllWidth() {
    return allW;
  }

  // Define different modes for assigning Y-coordinates to events
  function yByEvent(name, time, sort) {
    return {
      "assignY": function(displayTypes, setY) {
        displayTypes.sort(function(ta, tb) {
          return sort(time(ta), time(tb));
        });
        var y = 0;
        displayTypes.forEach(function(type) {
          setY(type, y);
          y += rowH;
        });
        return y;
      },
      "name": name
    };
  }

  // Define different modes for grouping events by category or time
  function yByGroup(name, time, join, init, sort) {
    return {
      "assignY": function(displayTypes, setY) {
        var groups = {};
        var roots = {};

        // Helper function to get or create a node for event hierarchy
        function getNode(type) {
          var group = type.getGroup();
          var id = type.getTypeId();
          if(!(group in groups)) {
            groups[group] = {};
          }
          if(!(id in groups[group])) {
            groups[group][id] = new Node(id, type);
          }
          return groups[group][id];
        }

        // Create node and manage event hierarchy for the group
        function createNode(type) {
          var group = type.getGroup();
          var node = getNode(type);
          node.time(time(type));
          var t = type.getParent();
          while(t) {
            var p = getNode(t);
            p.putChild(node);
            if(p.getId() == "") {
              if(!(group in roots)) {
                roots[group] = p;
              }
            }
            node = p;
            t = t.getParent();
          }
          if(!(group in roots)) {
            console.warn("no real root found");
            roots[group] = getNode({
              "getGroup": function() {
                return group;
              },
              "getTypeId": function() {
                return "";
              },
              "isValid": function() {
                return true;
              }
            });
            roots[group].putChild(node);
          }
        }

        // Define a Node structure to represent event hierarchy
        function Node(id, type) {
          var that = this;
          var children = {};
          var time = init

;

          this.putChild = function(node) {
            var id = node.getId();
            if(id === that.getId()) {
              console.warn("tried to add itself as child", "'" + id + "'");
              return;
            }
            children[id] = node;
            that.time(node.time());
          };
          this.getId = function() {
            return id;
          };
          this.getType = function() {
            return type;
          };
          this.time = function(_) {
            if(!arguments.length) return time;
            time = join(time, _);
          };
          this.traverseChildren = function(cb) {
            var cids = Object.keys(children).map(function(c) {
              return children[c];
            });
            cids.sort(function(ca, cb) {
              return sort(ca.time(), cb.time());
            });
            cids.forEach(cb);
          };
          this.hasChildren = function() {
            return Object.keys(children).length > 0;
          };
        } // Node

        displayTypes.forEach(function(type) {
          createNode(type);
        });
        var rootList = Object.keys(roots).map(function(k) {
          return roots[k];
        });
        rootList.sort(function(ra, rb) {
          return sort(ra.time(), rb.time());
        });

        var y = 0;
        function assign(n) {
          var t = n.getType();
          if(!t.isValid()) {
            return;
          }
          setY(t, y);
          if(n.hasChildren()) {
            n.traverseChildren(function(c) {
              assign(c);
            });
          } else {
            y += rowH;
          }
        }

        rootList.forEach(function(n) {
          assign(n);
        });
        return y;
      },
      "name": name
    };
  }

  var yModes = [
    yByEvent("First Event", function(t) {
      return t.proxedMinTime();
    }, d3.descending),
    yByEvent("Last Event", function(t) {
      return t.proxedMaxTime();
    }, d3.ascending),
    yByGroup("Groups (First)", function(t) {
      return t.proxedMinTime();
    }, function(a, b) {
      return Math.min(a, b);
    }, Number.POSITIVE_INFINITY, d3.descending),
    yByGroup("Groups (Last)", function(t) {
      return t.proxedMaxTime();
    }, function(a, b) {
      return Math.max(a, b);
    }, Number.NEGATIVE_INFINITY, d3.ascending)
  ];

  var yModeIx = 0;
  var yMode = yModes[0];

  /**
   * Sets or gets the Y-axis mode for the visualization.
   */
  this.yMode = function(_) {
    if(!arguments.length) return yModeIx;
    yModeIx = _;
    yMode = yModes[yModeIx];
    that.onValidityChange();
  };

  /**
   * Returns a list of available Y-axis modes by name.
   */
  this.getYModes = function() {
    return yModes.map(function(ym) {
      return ym["name"];
    });
  };

  /**
   * Assigns Y-coordinates to types based on the selected Y-mode.
   */
  function assignY(displayTypes) {
    var yMap = {};

    function setY(type, y) {
      var group = type.getGroup();
      if(!(group in yMap)) {
        yMap[group] = {};
      }
      yMap[group][type.getTypeId()] = y;
      if(type.proxyType() !== type) {
        setY(type.proxyType(), y);
      }
    }

    var h = yMode["assignY"](displayTypes, setY);
    that.traverseTypes(function(gid, tid, type) {
      if(!type.isValid()) {
        type.setY(-rowH);
        return;
      }
      var pt = type;
      for(;;) {
        var pid = pt.getTypeId();
        var grp = pt.getGroup();
        if(pid in yMap[grp]) {
          type.setY(yMap[grp][pid]);
          break;
        }
        if(pt === pt.proxyType()) {
          console.warn("no mapping for " + pid, pid, grp, type.getTypeId(), type.getGroup(), yMap);
          type.setY(-rowH);
          break;
        }
        pt = pt.proxyType();
      }
    });
    return h;
  }

  var xModes = [
    {
      "byTime": function(time) {
        // var compressionFactor = 0.5; // Adjust this factor to control compression
        return (time - startTime) / (endTime - startTime) * (getWidth() - colW);
        // var compressionFactor = 0.7; 
    
        // // Calculate density factor based on event density (e.g., events per year)
        // var densityFactor = (time - startTime) / (endTime - startTime);
        
        // // Scale the density factor linearly (instead of logarithmically)
        // return densityFactor * (getWidth() - colW) * compressionFactor;
      },
      "byEvent": function(e) {
        return that.getXByTime(e.getTime());
      },
      "time": function(x) {
        return x / (getWidth() - colW) * (endTime - startTime) + startTime;
      },
      "date": function(x) {
        return new Date(that.getTimeByX(x) * 1000);
      },
      "name": "Time",
      "ticks": true,
      "linear": true,
      "vconst": true
    },
    {
      "byTime": function(time) {
        noImpl();
      },
      "byEvent": function(e) {
        return e.topoX() * colW;
      },
      "time": function(x) {
        noImpl();
      },
      "date": function(x) {
        noImpl();
      },
      "name": "Sequence",
      "ticks": true,
      "linear": false,
      "vconst": true
    },
    {
      "byTime": function(time) {
        noImpl();
      },
      "byEvent": function(e) {
        return e.ixInType() * colW;
      },
      "time": function(x) {
        noImpl();
      },
      "date": function(x) {
        noImpl();
      },
      "name": "Stacked",
      "ticks": true,
      "linear": false,
      "vconst": false
    },
  ];

  var xModeIx = 0;
  var xMode = xModes[0];

  /**
   * Sets or gets the X-axis mode for the visualization.
   */
  this.xMode = function(_) {
    if(!arguments.length) return xModeIx;
    xModeIx = _;
    xMode = xModes[xModeIx];
    that.onValidityChange();
  };

  /**
   * Returns a list of available X-axis modes by name.
   */
  this.getXModes = function() {
    return xModes.map(function(xm) {
      return xm["name"];
    });
  };

  /**
   * Gets the X-coordinate by a specific time value.
   */
  this.getXByTime = function(time) {
    return xMode["byTime"](time);
  };

  /**
   * Gets the X-coordinate by an event's time value.
   */
  this.getXByEventTime = function(e) {
    return xMode["byEvent"](e);
  };

  /**
   * Gets the time value from a specific X-coordinate.
   */
  this.getTimeByX = function(x) {
    return xMode["time"](x);
  };

  /**
   * Gets the date object from a specific X-coordinate.
   */
  this.getDateByX = function(x) {
    return xMode["date"](x);
  };

  /**
   * Returns whether the ticks should be displayed on the X-axis.
   */
  this.showTicks = function() {
    return xMode["ticks"];
  };

  /**
   * Returns whether the X-axis is linear in time.
   */
  this.linearTime = function() {
    return xMode["linear"];
  };

  /**
   * Returns whether the vertical spacing is constant.
   */
  this.vConst = function() {
    return xMode["vconst"];
  };

  /**
   * Gets the Y-range for a specific type.
   */
  this.getRangeY = function(type) {
    var y = type.getY();
    return [ y, y + rowH ];
  };

  /**
   * Gets the X-range for the entire event pool.
   */
  this.getRangeX = function() {
    return [ that.getXByTime(startTime), that.getXByTime(endTime) ];
  };

  /**
   * Gets the time range for the entire event pool.
   */
  this.getRangeTime = function() {
    return [ startTime, endTime ];
  };

  /**
   * Gets the date range for the entire event pool.
   */
  this.getRangeDate = function() {
    return [ new Date(startTime * 1000), new Date(endTime * 1000) ];
  };

  var hasLinechart = false;

  /**
   * Sets or gets whether a line chart is present in the visualization.
   */
  this.hasLinechart = function(_) {
    if(!arguments.length) return hasLinechart;
    hasLinechart = _;
  };

  var selListeners = [];  // Listeners for selection changes

  /**
   * Adds a listener for selection changes.
   */
  this.addSelectionsListener = function(listener) {
    selListeners.push(listener);
   

 listener(sel, sec);
  };

  /**
   * Sets the primary and secondary selections for events.
   */
  this.setSelections = function(inner, secondary) {
    sel = inner;
    sel.datum(that);
    sec = secondary;
    helpH = sel.append("rect").attr({
      "height": rowH,
      "x": 0
    }).style({
      "fill": "darkgray"
    });
    helpV = sel.append("rect").attr({
      "width": colW,
      "y": 0
    }).style({
      "fill": "darkgray"
    });
    jkjs.util.toFront(helpH, false);
    jkjs.util.toFront(helpV, false);
    selListeners.forEach(function(l) {
      l(sel, sec);
    });
  };

  /**
   * Returns the primary selection object.
   */
  this.select = function() {
    sel || console.warn("no selection defined", sel, that);
    return sel;
  };

  /**
   * Returns the secondary selection object.
   */
  this.selectSec = function() {
    sec || console.warn("no secondary selection defined", sec, that);
    return sec;
  };

  /**
   * Adds a horizontal bar to the visualization based on the group and type IDs.
   */
  this.addHBar = function(groupId, typeId, noUpdate) {
    that.traverseTypes(function(gid, tid, type) {
      if(gid != groupId) return;
      if(type.getId() != typeId) return; // TODO maybe startsWith later
      hBars.push(type);
    });
    if(!noUpdate) {
      that.updateLook();
    }
  };

  /**
   * Adds a vertical span to the visualization based on the start and end times.
   */
  this.addVSpan = function(from, to, styleClass, noUpdate) {
    var start = from;
    var end = Number.isNaN(to) ? from + minTimeDiff : to;
    var newBar = sel.append("rect").attr({
      "y": -jkjs.util.BIG_NUMBER * 0.5,
      "height": jkjs.util.BIG_NUMBER
    });
    vSpan.push({
      sel: newBar,
      start: start,
      end: end,
      styleClass: styleClass
    });
    if(!noUpdate) {
      that.updateLook();
    }
  };

  /**
   * Adds a vertical bar to the visualization at a specific time.
   */
  this.addVBar = function(time, noUpdate) {
    var newBar = sel.append("rect").attr({
      "width": colW,
      "y": -jkjs.util.BIG_NUMBER * 0.5,
      "height": jkjs.util.BIG_NUMBER
    }).style({
      "fill": "#7e7e7e"
    });
    jkjs.util.toFront(newBar, false);
    vBars.push({
      sel: newBar,
      time: time,
      labels: []
    });
    if(!noUpdate) {
      that.updateLook();
    }
  };

  /**
   * Traverses vertical bars and applies a callback function to each.
   */
  this.traverseVBars = function(cb) {
    var from = startTime;
    var prevObj = null;
    vBars.forEach(function(obj) {
      cb(from, obj.time, prevObj);
      prevObj = obj;
      from = obj.time;
    });
    if(prevObj) {
      cb(from, endTime, prevObj);
    }
  };

  var inTransition = false;

  /**
   * Sets or gets the 'in transition' status of the visualization.
   */
  this.inTransition = function(_) {
    if(!arguments.length) return inTransition;
    inTransition = _;
  };

  var vGrids = [];    // Current vertical grid lines
  var newVGrids = []; // New vertical grid lines to be added

  /**
   * Sets new vertical grid lines to be displayed.
   */
  this.setVGrids = function(vg) {
    newVGrids = vg;
  };

  var hGrids = [];    // Current horizontal grid lines
  var newHGrids = []; // New horizontal grid lines to be added
  var gridSize = 100; // Grid size for visualization

  /**
   * Updates the grid lines in the visualization.
   */
  function updateGrid(_ /*svgport*/, viewport, scale, smooth) {
    var vrect = {
      x: 0,
      y: 0,
      width: viewport.width * scale,
      height: viewport.height * scale
    };
    if(smooth || inTransition) {
      vGrids.forEach(function(s) {
        s.remove();
      });
      vGrids = [];
      hGrids.forEach(function(s) {
        s.remove();
      });
      hGrids = [];
      return;
    }

    /**
     * Adjusts the grid lines based on the current viewport and scale.
     */
    function adjust(arr, arrAfter, create, style) {
      if(arrAfter.length < arr.length) {
        for(var ix = arrAfter.length;ix < arr.length;ix += 1) {
          arr[ix].remove();
        }
        arr.length = arrAfter.length;
      } else {
        for(var ix = arr.length;ix < arrAfter.length;ix += 1) {
          arr.push(sec.append(create).style(style));
        }
      }
    }

    var debug = false;
    var dashes = debug ? gridSize / 2 / 3 : gridSize / 2 / 30;
    adjust(vGrids, newVGrids, "line", {
      "opacity": debug ? 1 : 0.4,
      "stroke": "black",
      "stroke-width": 0.5,
      "stroke-dasharray": dashes + ", " + dashes
    });
    vGrids.forEach(function(s, ix) {
      var x = newVGrids[ix];
      s.attr({
        "x1": x,
        "x2": x,
        "y1": vrect.y - gridSize - (viewport.y * scale - gridSize) % gridSize,
        "y2": vrect.y + vrect.height + gridSize
      });
    });
    newVGrids = [];

    newHGrids = [];
    var dist = gridSize * scale;
    while(dist < gridSize * 0.5) {
      dist *= 2;
    }
    while(dist > gridSize * 1.5) {
      dist /= 2;
    }
    var yStart = vrect.y - dist - (viewport.y * scale - dist) % dist;
    for(var yPos = yStart;yPos <= vrect.y + vrect.height;yPos += dist) {
      newHGrids.push(yPos);
    }
    adjust(hGrids, newHGrids, "line", {
      "opacity": debug ? 1 : 0.4,
      "stroke": "black",
      "stroke-width": 0.5,
      "stroke-dasharray": dashes + ", " + dashes
    });
    hGrids.forEach(function(s, ix) {
      var y = newHGrids[ix];
      s.attr({
        "x1": vrect.x - gridSize - (viewport.x * scale - gridSize) % gridSize,
        "x2": vrect.width + gridSize,
        "y1": y,
        "y2": y
      });
    });
  }

  var maxConnectSlot = 0;

  /**
   * Sets or gets the maximum connection slot for events.
   */
  this.maxConnectSlot = function(_) {
    if(!arguments.length) return maxConnectSlot;
    if(maxConnectSlot === _) return;
    overview.clearShadow();
    maxConnectSlot = _;
    that.updateLook();
  };

  var showSpans = true;

  /**
   * Sets or gets whether spans should be shown in the visualization.
   */
  this.showSpans = function(_) {
    if(!arguments.length) return showSpans;
    showSpans = _;
  };

  /**
   * Updates the look of the entire visualization, adjusting all event elements and grid lines.
   */
  this.updateLook = function() {
    var displayTypes = {};
    that.traverseTypes(function(gid, tid, type) {
      var pt = type;
      while(pt !== pt.proxyType()) {
        pt = pt.proxyType();
      }
      displayTypes[pt.getGroupId() + '__' + pt.getTypeId()] = pt;
    });
    displayTypes = Object.keys(displayTypes).map(function(id) {
      var type = displayTypes[id];
      type.traverseProxedEvents(function(e, ix) {
        e.ixInType(ix);
      });
      return type;
    });
    var add = 100;
    var maxY = assignY(displayTypes);
    var maxX = 0;
    
    // Traverse through each event and update the appearance
    that.traverseEvents(function(gid, tid, e) {
      if(e.shown()) {
        e.updateLook();
      } else {
        e.select().style("display", "none");
      }
      var eSel = e.select();
      var oldX = e.lastX();
      var newX = that.getXByEventTime(e);
      if(newX > maxX) {
        maxX = newX;
      }
      if(oldX != newX) { // only update if necessary -- very expensive!!!
        eSel.attr({
          "x": newX - add,
          "y": -add,
          "width": colW

 + 2 * add,  // Adjust the width scaling here
          "height": rowH + 2 * add  // Adjust the height scaling here
        });
        e.lastX(newX);
      }
      e.updateAdditional(newX + colW * 0.5, rowH * 0.5);
    });

    // Adjust the appearance of event connections and bars
    displayTypes.forEach(function(type) {
      var prev = null;
      var prevT = Number.NaN;
      var prevX = Number.NaN;
      type.traverseProxedEvents(function(eve) {
        var t = eve.getTime();
        var x = that.getXByEventTime(eve);
        if(prev) {
          var dt = (t - prevT) / minTimeDiff;
          if(dt > maxConnectSlot) {
            dt = 1;
          }
          var dx = dt > 1 ? (x - prevX) / colW : 1;
          if(prev.width() !== dx) {
            prev.select().attr({
              "width": colW * dx + 2 * add,
              "height": rowH + 2 * add
            });
            prev.width(dx);
          }
        }
        prev = eve;
        prevT = t;
        prevX = x;
      });
      if(prev && prev.width() !== 1) {
        prev.select().attr({
          "width": colW + 2 * add,
          "height": rowH + 2 * add
        });
        prev.width(1);
      }
    });
    
    var w = Math.max(maxX, colW) + 2 * add;
    var h = Math.max(maxY, rowH + 2 * add);

    allW = w;
    setBox(w, h);
    helpH && helpH.attr({
      "x": -jkjs.util.BIG_NUMBER * 0.5,
      "width": jkjs.util.BIG_NUMBER
    });
    helpV && helpV.attr({
      "y": that.vConst() ? -jkjs.util.BIG_NUMBER * 0.5 : 0,
      "height": that.vConst() ? jkjs.util.BIG_NUMBER : 0
    });
    hBars.forEach(function(bar) {
      if(!bar.hBar()) {
        var newBar = sel.append("rect").attr({
          "height": rowH,
          "width": jkjs.util.BIG_NUMBER,
          "x": -jkjs.util.BIG_NUMBER * 0.5
        }).style({
          "fill": "#7e7e7e",
          "opacity": 0.5
        });
        jkjs.util.toFront(newBar, false);
        bar.hBar(newBar);
      }
      var y = bar.getProxed()[0].getY();
      bar.hBar().attr({
        "y": y
      });
    });
    var vis = that.linearTime();
    vBars.forEach(function(bar) {
      bar.sel.style({
        "opacity": vis ? 0.5 : 0
      });
      if(!vis) return;
      var x = that.getXByTime(bar.time);
      bar.sel.attr({
        "x": x
      });
    });
    vSpan.forEach(function(span) {
      span.sel.style(that.getStyleClass(span.styleClass, {
        "opacity": vis ? 0.2 : 0,
        "color": "gray"
      }));
      if(!vis || !showSpans) {
        span.sel.style({
          "opacity": 0
        });
      };
      if(!vis || !showSpans) return;
      var x1 = that.getXByTime(span.start);
      var x2 = that.getXByTime(span.end);
      span.sel.attr({
        "x": x1,
        "width": (x2 - x1)
      });
    });
  };

  /**
   * Returns the current box size for the visualization.
   */
  this.boxSize = function() {
    return [ colW, rowH ];
  };

  var styleClasses = {};  // Map of style classes for events

  /**
   * Adds a new style class or updates an existing one.
   */
  this.addStyleClass = function(names, styles) {
    names.split(" ").forEach(function(name) {
      var n = name.trim();
      if(!n.length) return;
      var obj = n in styleClasses ? styleClasses[n] : {};
      Object.keys(styles).forEach(function(k) {
        obj[k] = styles[k];
      });
      styleClasses[n] = obj;
    });
  };

  /**
   * Retrieves the style properties for a given class, applying defaults where necessary.
   */
  this.getStyleClass = function(names, defaults) {
    var res = {};
    Object.keys(defaults).forEach(function(k) {
      res[k] = defaults[k];
    });
    names.split(" ").forEach(function(name) {
      var n = name.trim();
      if(!n.length) return;
      if(n in styleClasses) {
        Object.keys(styleClasses[n]).forEach(function(k) {
          res[k] = styleClasses[n][k];
        });
      }
    });
    return res;
  };

  var szListeners = [];  // List of listeners for size updates

  /**
   * Calls all registered size update listeners with the current width and height.
   */
  this.onSizeUpdate = function(w, h) {
    szListeners.forEach(function(l) {
      l(w, h);
    });
  };

  /**
   * Adds a new listener for size updates.
   */
  this.addSizeListener = function(listen) {
    szListeners.push(listen);
  };

  var vpListeners = [];  // List of listeners for viewport changes

  /**
   * Calls all registered viewport change listeners with the current viewport and scale.
   */
  this.onViewportChange = function(svgport, viewport, scale, smooth) {
    vpListeners.forEach(function(l) {
      l(svgport, viewport, scale, smooth);
    });
  };

  /**
   * Adds a new listener for viewport changes.
   */
  this.addViewportChangeListener = function(listen) {
    vpListeners.unshift(listen); // Earlier added listeners are always called last!
  };

  /**
   * Adds a default listener for viewport changes to update the grid.
   */
  this.addViewportChangeListener(function(svgport, viewport, scale, smooth) {
    updateGrid(svgport, viewport, scale, smooth);
  });

  /**
   * Returns the color associated with a specific group ID.
   */
  this.getGroupColor = function(gid) {
    const typeGroup = that.getTypeFor(gid, "");
    
    // Check if typeGroup is null or undefined
    if (!typeGroup) {
      console.warn(`Group not found for gid: ${gid}`);
      return '#ccc'; // Return a default color or handle gracefully
    }
    return that.getTypeFor(gid, "").getColor();
  };

  var inBulkSelection = 0;

  /**
   * Handles bulk selection of events within a rectangular area.
   */
  TypePool.prototype.selectInRect = function(sRect, done) {
    if (!done) return; // Don't update if selection isn't finalized yet

    // Hide the vertical helper line
    if (this.helpV) {
      this.helpV.style("opacity", 0);
    }

    this.startBulkSelection(); // Begin a series of selection changes

    if (!this.joinSelections()) {
        // If not joining with existing selections, clear all previous selections
        this.traverseEvents(function(gid, tid, e) {
            e.setSelected(false);
        });
    }

    // Iterate over all types
    this.traverseTypes(function(gid, tid, type) {
        if (!type.isValid()) return; // Skip invalid types

        // Get vertical range of this type
        var rangeY = this.getRangeY(type);

        // Check if the selection rectangle overlaps with the type's vertical range
        if (sRect.y + sRect.height >= rangeY[0] && sRect.y <= rangeY[1]) {
            type.traverseEventRange(
                sRect.x - colW,
                sRect.x + sRect.width,
                function(e) { // Function to get the x-coordinate (in pixels) of an event
                    return this.getXByEventTime(e);
                }.bind(this),  // Bind to ensure correct 'this' context
                function(e) {  // Callback for events within the box
                    e.setSelected(true);
                }
            );
        }
    }.bind(this));  // Bind to ensure correct 'this' context
    
    // updateSelectedTimeRangeDisplay(startTime, endTime);

    this.highlightMode(TypePool.HIGHLIGHT_NONE); // Clear any previous highlights
    this.highlightEvent(null);  // Clear any previous highlights
    this.fixSelection(true);    // Fix the current selection
    this.greyOutRest(true);     // Grey out events not in the selection
    this.endBulkSelection();   // End the bulk selection process, triggering updates
  };

  /**
   * Begins a bulk selection process, allowing multiple selections to be handled together.
   */
  this.startBulkSelection = function() {
    inBulkSelection += 1;
  };

  /**
   * Ends the bulk selection process, triggering updates if necessary.
   */
  this.endBulkSelection = function() {
    inBulkSelection -= 1;
    if(inBulkSelection <= 0) {
      that.updateSelection();
    }
  };

  var greyOutRest = false;

  /**
   * Sets or gets the 'grey out rest' status, which affects the visibility of non-selected events.
   */
 

 this.greyOutRest = function(_) {
    if(!arguments.length) return greyOutRest;
    greyOutRest = _;
  };

  var fixSelection = false;

  /**
   * Sets or gets the 'fix selection' status, which prevents selection changes once fixed.
   */
  this.fixSelection = function(_) {
    if(!arguments.length) return fixSelection;
    fixSelection = _;
  };

  var highlightEvent = null;
  var highlightListeners = [];  // List of listeners for highlight changes
  var highlightMode = TypePool.HIGHLIGHT_HOR;  // Current highlight mode
  var hm = highlightMode;

  /**
   * Sets or gets the highlight mode for events (horizontal, vertical, or both).
   */
  this.highlightMode = function(_) {
    if(!arguments.length) return highlightMode;
    highlightMode = _;
  };

  /**
   * Sets or gets the currently highlighted event.
   */
  this.highlightEvent = function(_) {
    if(!arguments.length) return highlightEvent;
    if(highlightEvent === _ && highlightMode === hm) return;
    highlightEvent = _;
    hm = highlightMode;
    if(helpV) {
      overview.clearShadow();
      var hv = highlightEvent && (highlightMode & TypePool.HIGHLIGHT_VER);
      helpV.attr({
        "x": hv ? that.getXByEventTime(highlightEvent) : 0
      }).style({
        "opacity": hv ? 1 : 0
      });
      overview.onBoxUpdate();
    }
    if(helpH) {
      var type = highlightEvent ? highlightEvent.getType() : null;
      if(type && type.getProxed().length) {
        type = type.getProxed()[0];
      }
      var hh = type && (highlightMode & TypePool.HIGHLIGHT_HOR);
      helpH.attr({
        "y": hh ? type.getY() : 0
      }).style({
        "opacity": hh ? 1 : 0
      });
    }
    if(inBulkSelection > 0) return;
    highlightListeners.forEach(function(cb) {
      cb();
    });
  };

  /**
   * Adds a new listener for highlight changes.
   */
  this.addHighlightListener = function(cb) {
    highlightListeners.push(cb);
  };

  var hasSelection = false;

  /**
   * Returns whether there is a current selection.
   */
  this.hasSelection = function() {
    return hasSelection;
  };

  /**
   * Updates the current selection, notifying listeners as necessary.
   */
  this.updateSelection = function() {
    if(inBulkSelection > 0) return;
    overview.clearShadow();
    var onlyTime = Number.NaN;
    var repr = null;
    var types = {};
    var eventMap = {};
    that.traverseEvents(function(gid, tid, e) {
      e.updateLook();
      var type = e.getType();
      if(e.isSelected() && type.isValid()) {
        var time = e.getTime();
        if(isNaN(onlyTime)) {
          onlyTime = time;
          repr = e;
        } else if(onlyTime != time) {
          onlyTime = Number.POSITIVE_INFINITY;
          repr = null;
        }

        function addType(type) {
          var at = type.proxyType();
          var atid = at.getId();
          if(!(atid in types)) {
            types[atid] = at;
          }
        }

        addType(type);
        var fog = e.firstOfGroup();
        eventMap[fog.getId()] = fog;
      }
    });
    var events = Object.keys(eventMap).map(function(k) {
      return eventMap[k];
    });
    var singleSlot = false;
    var singleType = false;
    var onlyType = null;
    if(!isNaN(onlyTime) && Number.isFinite(onlyTime)) {
      singleSlot = true;
    }
    if(Object.keys(types).length == 1) {
      onlyType = types[Object.keys(types)[0]];
      singleType = true;
    }
    hasSelection = !!events.length;

    // Notify listeners of the new selection
    seListeners.forEach(function(l) {
      l(events, types, singleSlot, singleType);
    });
    overview.onBoxUpdate();
  };

  var joinSelections = false;

  /**
   * Sets or gets the 'join selections' status, which controls whether new selections are added to the current selection.
   */
  this.joinSelections = function(js) {
    if(!arguments.length) return joinSelections;
    joinSelections = !!js;
  };

  var verticalSelection = false;

  /**
   * Sets or gets the 'vertical selection' status, which controls whether selection is restricted vertically.
   */
  this.verticalSelection = function(_) {
    if(!arguments.length) return verticalSelection;
    verticalSelection = !!_;
  };

  var seListeners = [];  // List of listeners for selection events

  /**
   * Adds a new listener for selection events.
   */
  this.addSelectionListener = function(listen) {
    seListeners.push(listen);
  };

  var inValidityChange = false;
  var inBulkValidity = 0;

  /**
   * Begins a bulk validity change, allowing multiple validity updates to be processed together.
   */
  this.startBulkValidity = function() {
    inBulkValidity += 1;
  };

  /**
   * Ends the bulk validity change process, triggering updates if necessary.
   */
  this.endBulkValidity = function() {
    inBulkValidity -= 1;
    if(inBulkValidity <= 0) {
      that.onValidityChange();
    }
  };

  /**
   * Updates the validity of all elements in the TypePool, refreshing the display as necessary.
   */
  TypePool.prototype.onValidityChange = function() {
    if(this.inValidityChange) return;
    this.inValidityChange = true;
    var that = this;
    setTimeout(function() {
      that.updateLook();
      that.updateSelection();
      that.inValidityChange = false;
    }, 0);
  };

  /**
   * Toggles the display of only weighted events in the visualization.
   */
  this.showOnlyWeightedEvents = function(s) {
    overview.clearShadow();
    that.traverseAllEvents(function(_, _, e) {
      if(s) {
        e.showOnlyWeighted();
      } else {
        e.shown(true);
      }
    });
    that.updateLook();
    that.updateSelection();
  };
} // TypePool

// Static properties for TypePool
TypePool.hasWeightedEvent = false;
TypePool.HIGHLIGHT_NONE = 0;
TypePool.HIGHLIGHT_HOR = 1;
TypePool.HIGHLIGHT_VER = 2;
TypePool.HIGHLIGHT_BOTH = TypePool.HIGHLIGHT_HOR | TypePool.HIGHLIGHT_VER;

/**
 * Sets the time range for the TypePool, updating the visualization accordingly.
 */
TypePool.prototype.setTimeRange = function(start, end) {
  this.startTime = start;
  this.endTime = end;
  console.log("Time range set to:", this.startTime, this.endTime);
  this.updateLook();  // Trigger an update to the visualization
};
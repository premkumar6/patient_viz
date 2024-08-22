function Type(p, g, typeId, dictionary) {
  var that = this;
  var pool = p;  // Reference to the parent TypePool
  var group = g;  // Group ID for the type
  var gid = g.trim().replace(/[.#*]/gi, "_");  // Sanitized group ID
  var id = typeId;  // Type ID for this Type instance
  var desc = Type.typeDesc(g, typeId, false, dictionary, true);  // Full description of the type
  var type = typeId;  // Alias for typeId
  var name = Type.typeDesc(g, typeId, false, dictionary, false);  // Name of the type
  var events = [];  // Array to store events associated with this type
  var typeSpec = g in dictionary && typeId in dictionary[g] ? dictionary[group][id] : null;  // Type specification from the dictionary
  var color = (typeSpec && typeSpec["color"]) || null;  // Color for the type, if specified
  var flags = (typeSpec && typeSpec["flags"]) || null;  // Flags for the type, if specified
  var allFlags = null;  // Cached flags including those inherited from parent types
  var parent = (typeSpec && typeSpec["parent"]) || "";  // Parent type ID, if specified

  // If the parent ID is the same as the current type ID, reset it to an empty string
  if(parent == id && id !== "") {
    console.warn("parent to self", parent, id);
    parent = "";
  }

  var proxy = that;  // Reference to the proxy type (initially itself)
  var proxed = {};  // Object to store proxied types
  proxed[id] = that;
  var proxedEvents = null;  // Cached array of proxied events
  var proxedMinTime = Number.NaN;  // Cached minimum time of proxied events
  var proxedMaxTime = Number.NaN;  // Cached maximum time of proxied events

  /**
   * Updates the proxied types list by adding or removing a type.
   */
  this.changeProxed = function(type, add) {
    var id = type.getTypeId();
    if(add) {
      proxed[id] = type;
    } else {
      proxed[id] = null;
      delete proxed[id];
    }
    proxedEvents = null;  // Invalidate cached proxied events
  };

  /**
   * Returns an array of proxied types.
   */
  this.getProxed = function() {
    return Object.keys(proxed).map(function(id) {
      return proxed[id];
    });
  };

  /**
   * Ensures the proxied events are calculated and sorted by time.
   */
  function ensureProxedEvents() {
    if(proxedEvents) return;
    var events = [];
    that.getProxed().forEach(function(type) {
      type.traverseEvents(function(e) {
        events.push(e);
      });
    });
    events.sort(function(a, b) {
      return d3.ascending(a.getTime(), b.getTime());
    });
    if(events.length) {
      proxedMinTime = events[0].getTime();
      proxedMaxTime = events[events.length - 1].getTime();
    } else {
      proxedMinTime = Number.NaN;
      proxedMaxTime = Number.NaN;
    }
    proxedEvents = events;
  }

  /**
   * Returns the first event from the proxied events list.
   */
  this.getFirstProxedEvent = function() {
    ensureProxedEvents();
    return proxedEvents.length ? proxedEvents[0] : null;
  };

  /**
   * Traverses all proxied events and applies a callback function to each.
   */
  this.traverseProxedEvents = function(cb) {
    ensureProxedEvents();
    proxedEvents.forEach(cb);
  };

  /**
   * Traverses proxied events within a specific range of X-coordinates and applies a callback to each.
   */
  this.traverseProxedEventRange = function(fromX, toX, getX, cb) {
    // Events are sorted by time -> x position
    ensureProxedEvents();
    proxedEvents.every(function(e) {
      var x = getX(e);
      if(x < fromX) return true;
      if(x >= toX) return false;
      e.shown() && cb(e, x);
      return true;
    });
  };

  /**
   * Returns the minimum time of the proxied events.
   */
  this.proxedMinTime = function() {
    ensureProxedEvents();
    if (isNaN(proxedMinTime)) {
      console.warn("NaN proxedMinTime", that);
      return Number.MAX_SAFE_INTEGER; // Return a safe default
    }
    return proxedMinTime;
  };

  /**
   * Returns the maximum time of the proxied events.
   */
  this.proxedMaxTime = function() {
    ensureProxedEvents();
    if (isNaN(proxedMaxTime)) {
      console.warn("NaN proxedMaxTime", that);
      return Number.MIN_SAFE_INTEGER; // Return a safe default
    }
    return proxedMaxTime;
  };

  /**
   * Sets or gets the proxy type for this type.
   */
  this.proxyType = function(_) {
    if(!arguments.length) return proxy;
    // Temporarily lifted group ban
    // if(_.getGroup() !== that.getGroup()) {
    //   console.warn("proxy must have same group", _.getGroup(), that.getGroup());
    //   return;
    // }
    proxy.changeProxed(that, false);
    proxy = _;
    proxy.changeProxed(that, true);
    pool.onValidityChange();  // Notify the pool of validity changes
  };

  /**
   * Returns whether this type has a real proxy type.
   */
  this.hasRealProxy = function() {
    return that.proxyType() !== that;
  };

  var fingerprint = null;  // Cached fingerprint for the type
  var fingerprintTypes = {};  // Types included in the fingerprint

  /**
   * Sets the types that contribute to the fingerprint and returns whether it changed.
   */
  this.setFingerprintTypes = function(types) {
    var oldT = Object.keys(fingerprintTypes);
    fingerprintTypes = types;
    var newT = Object.keys(fingerprintTypes);
    var chg = true;
    if(oldT.length === newT.length) {
      chg = false;
      oldT.sort();
      newT.sort();
      for(var ix = 0;ix < oldT.length;ix += 1) {
        if(oldT[ix] !== newT[ix]) {
          chg = true;
          break;
        }
      }
    }
    if(chg) {
      fingerprint = null;
    }
    return chg;
  };

  /**
   * Fills the fingerprint canvas with lines representing the events' times.
   */
  this.fillFingerprint = function(ctx, w, h) {
    if(!fingerprint) {
      fingerprint = {};
      Object.keys(fingerprintTypes).forEach(function(tid) {
        fingerprintTypes[tid].traverseProxedEvents(function(e) {
          fingerprint[e.getTime()] = 1;
        });
      });
    }
    var timeRange = pool.getRangeTime();
    var min = timeRange[0];
    var max = timeRange[1];
    var baseAlpha = 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = that.getColor();
    Object.keys(fingerprint).forEach(function(t) {
      var x = (t - min) / (max - min) * w;
      if(Number.isNaN(x)) return;
      ctx.globalAlpha = Math.min(1, baseAlpha * fingerprint[t]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
    ctx.restore();
  };

  /**
   * Returns the parent type's ID as a string.
   */
  this.getParentString = function() {
    return parent;
  };

  /**
   * Returns the parent type object, or null if there is no parent.
   */
  this.getParent = function() {
    if(id == "") return null;
    return pool.getTypeFor(g, parent);
  };

  /**
   * Returns the root type in the hierarchy.
   */
  this.getRoot = function() {
    if(!that.getParent()) return that;
    return that.getParent().getRoot();
  };

  /**
   * Returns the flags for this type, including inherited ones.
   */
  this.getFlags = function() {
    if(allFlags) return allFlags;
    allFlags = flags || {};
    var p = this.getParent();
    if(p) {
      var f = p.getFlags();
      Object.keys(f).forEach(function(k) {
        if(!(k in allFlags)) {
          allFlags[k] = f[k];
        }
      });
    }
    return allFlags;
  };

  /**
   * Returns the color associated with a specific flag or the type's color.
   */
  this.getColor = function(flag) {
    if(arguments.length) {
      var fs = that.getFlags();
      var f = flag.trim();
      if(f in fs) {
        return fs[f]["color"];
      }
    }
    if(color) return color;
    var p = this.getParent();
    if(p) {
      return p

.getColor(); // All flags already checked
    }
    return "black"; // Last resort
  };

  /**
   * Validates that the event's type and group match this type's ID and group.
   */
  function validate(e) {
    if((type !== e["id"]) || (group !== e["group"])) {
      console.warn("mismatching type: " + id, group, type, e);
    }
  }

  /**
   * Returns the pool this type belongs to.
   */
  this.getPool = function() {
    return pool;
  };

  /**
   * Adds an event to this type's event list.
   */
  this.addEvent = function(eve, e) {
    validate(e);
    events.push(eve);
  };

  var minTime = Number.NaN;  // Cached minimum event time
  var maxTime = Number.NaN;  // Cached maximum event time

  /**
   * Sorts the events by time and removes duplicates.
   * Returns the minimum time difference between consecutive events.
   */
  this.sortEvents = function() {
    events.sort(function(a, b) {
      return d3.ascending(a.getTime(), b.getTime());
    });
    var newEvents = [];
    var prevE = null;
    events.forEach(function(e) {
      if(prevE && prevE.getTime() === e.getTime()) {
        if(!prevE.eq(e)) {
          console.warn("removed non-equal duplicate: ", e.getDesc(), prevE.getDesc());
        }
        return;
      }
      newEvents.push(e);
      prevE = e;
    });
    events = newEvents;
    if(events.length) {
      minTime = events[0].getTime();
      maxTime = events[events.length - 1].getTime();
    } else {
      minTime = Number.NaN;
      maxTime = Number.NaN;
    }
    var minTimeDiff = Number.POSITIVE_INFINITY;
    var prevTime = minTime;
    events.forEach(function(e) {
      var time = e.getTime();
      var diff = time - prevTime;
      prevTime = time;
      if(!isNaN(diff) && diff > 0 && diff < minTimeDiff) {
        minTimeDiff = diff;
      }
    });
    return minTimeDiff;
  };

  /**
   * Returns whether this type has any events.
   */
  this.hasEvents = function() {
    return events.length > 0;
  };

  /**
   * Returns the minimum time of events for this type.
   */
  this.getMinTime = function() {
    isNaN(minTime) && console.warn("NaN minTime", that);
    return minTime;
  };

  /**
   * Returns the maximum time of events for this type.
   */
  this.getMaxTime = function() {
    isNaN(maxTime) && console.warn("NaN maxTime", that);
    return maxTime;
  };

  /**
   * Returns the sanitized group ID for this type.
   */
  this.getGroupId = function() {
    return gid;
  };

  /**
   * Returns the group ID for this type.
   */
  this.getGroup = function() {
    return group;
  };

  /**
   * Returns the type ID for this type.
   */
  this.getTypeId = function() {
    return id;
  };

  /**
   * Returns the internal ID for this type.
   */
  this.getId = function() {
    return type;
  };

  /**
   * Returns the number of visible events for this type.
   */
  this.getCount = function() {
    return events.filter(function(e) {
      return e.shown();
    }).length;
  };

  /**
   * Returns the event at a specific index, or logs a warning if out of bounds.
   */
  this.getEventByIndex = function(ix) {
    var rix = 0;
    var elem = null;
    events.every(function(e) {
      if(rix > ix) return false;
      if(e.shown()) {
        if(rix == ix) {
          elem = e;
          return false;
        }
        rix += 1;
      }
      return true;
    });
    if(!elem) {
      console.warn("index out of bounds", ix);
    }
    return elem;
  };

  /**
   * Returns the first visible event after a specified time.
   */
  this.getFirstEventAfter = function(time) {
    var elem = null;
    events.every(function(e) {
      if(elem) return false;
      if(e.shown()) {
        if(e.getTime() >= time) {
          elem = e;
          return false;
        }
      }
      return true;
    });
    return elem;
  };

  /**
   * Returns the full description of this type.
   */
  this.getDesc = function() {
    return desc;
  };

  /**
   * Returns the name of this type.
   */
  this.getName = function() {
    return name;
  };

  /**
   * Traverses all visible events for this type and applies a callback function to each.
   */
  this.traverseEvents = function(cb) {
    events.forEach(function(e) {
      e.shown() && cb(e);
    });
  };

  /**
   * Traverses all events for this type, including invisible ones, and applies a callback function to each.
   */
  this.traverseAllEvents = function(cb) {
    events.forEach(function(e) {
      cb(e);
    });
  };

  /**
   * Traverses events within a specific range of X-coordinates and applies a callback to each.
   */
  this.traverseEventRange = function(fromX, toX, getX, cb) {
    // Events are sorted by time -> x position
    events.every(function(e) {
      var x = getX(e);
      if(x < fromX) return true;
      if(x >= toX) return false;
      e.shown() && cb(e, x);
      return true;
    });
  };

  var showLabels = true;  // Flag indicating whether to show labels

  /**
   * Sets or gets the 'show labels' flag.
   */
  this.showLabels = function(_) {
    if(!arguments.length) return showLabels;
    showLabels = _;
    if(destroyed) return;
    if(!showLabels) {
      that.clearText();
      that.selectConnect().style({
        "opacity": 0
      });
    }
  };

  var y = 0;  // Y-coordinate for this type

  /**
   * Sets the Y-coordinate for this type and updates its position if changed.
   */
  this.setY = function(yPos) {
    var oldY = y;
    y = yPos;
    if(oldY !== y && events.length > 0) {
      that.select().attr({
        "transform": "translate(0 "+y+")",
        "opacity": y < 0 ? 0 : null
      });
    }
  };

  /**
   * Returns the current Y-coordinate for this type.
   */
  this.getY = function() {
    return y;
  };

  var hBar = null;  // Horizontal bar element for this type

  /**
   * Sets or gets the horizontal bar element for this type.
   */
  this.hBar = function(_) {
    if(!arguments.length) return hBar;
    hBar = _;
  };

  var sel = null;  // Main selection element for this type
  var destroyed = false;  // Flag indicating whether this type has been destroyed

  /**
   * Returns the main selection element for this type, creating it if necessary.
   */
  this.select = function() {
    if(destroyed) {
      console.warn("type already destroyed");
      return null;
    }
    if(!sel) {
      var pSel = that.getPool().select();
      sel = pSel.append("g").datum(that);
    }
    return sel;
  };

  var selConnect = null;  // Connection line element for this type

  /**
   * Returns the connection line element for this type, creating it if necessary.
   */
  this.selectConnect = function() {
    if(destroyed) {
      console.warn("type already destroyed");
      return null;
    }
    if(!selConnect) {
      var sSel = that.getPool().selectSec();
      selConnect = sSel.append("line").datum(that).style({
        "stroke": "black",
        "stroke-width": 1
      });
    }
    return selConnect;
  };

  var selText = null;  // Text element for this type

  /**
   * Returns the text element for this type, creating it if necessary.
   */
  this.selectText = function() {
    if(destroyed) {
      // console.warn("type already destroyed"); // TODO bug!!! #21
      return null;
    }
    if(!selText) {
      var sSel = that.getPool().selectSec();
      selText = sSel.append("text").datum(that).style({
        "fill": "black"
      });
      textWidthCache = Number.NaN;
    }
    return selText;
  };

  /**
   * Removes the text element for this type.
   */
  this.clearText = function() {
    if(!selText) return;
    selText.remove();
    selText = null;
    textWidthCache = Number.NaN;
  };

  var textWidthCache = Number.NaN;  // Cached width of the text element

  /**
   * Sets or gets the cached width of the text element.
   */
  this.textWidthCache = function(_) {
    if(!arguments.length) return textWidthCache;
    textWidthCache

 = _;
  };

  var textOrientCache = false;  // Cached orientation of the text element

  /**
   * Sets or gets the cached orientation of the text element.
   */
  this.textOrientCache = function(_) {
    if(!arguments.length) return textOrientCache;
    textOrientCache = _;
  };

  /**
   * Destroys the type by removing all associated elements and clearing the events list.
   */
  this.deleteType = function() {
    if(sel) {
      sel.remove();
      sel = null;
    }
    if(selText) {
      selText.remove();
      selText = null;
    }
    if(selConnect) {
      selConnect.remove();
      selConnect = null;
    }
    that.traverseEvents(function(e) {
      e.deleteEvent();
    });
    events = [];
    destroyed = true;
  };

  var valid = true;  // Flag indicating whether the type is valid

  /**
   * Sets or gets the 'valid' status of the type, triggering updates if changed.
   */
  this.setValid = function(v) {
    var oldValid = valid;
    valid = !!v;
    if(valid != oldValid) {
      that.getPool().onValidityChange();
      if(!valid) {
        that.clearText();
        that.selectConnect().style({
          "opacity": 0
        });
      }
    }
  };

  /**
   * Returns whether the type is valid.
   */
  this.isValid = function() {
    return valid;
  };

  var entryW = Number.NaN;  // Width of the list entry
  var entryH = Number.NaN;  // Height of the list entry
  var check = null;  // Checkbox element for the list entry
  var span = null;  // Span element for the list entry
  var space = null;  // Space element for the list entry

  /**
   * Creates a list entry for this type and returns the elements.
   */
  this.createListEntry = function(sel, level, isInner, isExpanded) {
    check = sel.append("input").attr({
      "type": "checkbox"
    }).style({
      "display": "none"
    }).on("change", function() {
      that.setValid(check.node().checked);
    });
    space = sel.append("span").style({
      "font-family": "monospace"
    }).text(" " + Array(level).join("|") + (!isInner ? "" : isExpanded ? "-" : "+"));
    span = sel.append("span").style({
      "margin-left": 4 + "px"
    }).text(that.getName()).on("click", function() {
      pool.startBulkSelection();
      if(!pool.joinSelections()) {
        pool.traverseEvents(function(gid, tid, e) {
          e.setSelected(false);
        });
      }
      var none = true;
      var first = null;
      that.traverseProxedEvents(function(e) {
        if(!first) first = e;
        e.setSelected(true);
        none = false;
      });
      if(none) {
        first = null;
        // We clicked on an inner node
        // We can determine selection through parenthood
        pool.traverseEvents(function(gid, tid, e) {
          var type = e.getType().proxyType();
          while(type) {
            if(type === that) {
              e.setSelected(true);
              break;
            }
            type = type.getParent();
          }
        });
      }
      pool.highlightMode(TypePool.HIGHLIGHT_HOR);
      pool.highlightEvent(first);
      pool.fixSelection(true);
      pool.greyOutRest(false);
      pool.endBulkSelection();
    });
    return {
      "check": check,
      "span": span,
      "space": space
    };
  };

  /**
   * Updates the list entry for this type based on selection status.
   */
  this.updateListEntry = function(sel, hasSelected, onlyOneTypeSelected) {
    var color = that.getColor();
    span.style({
      "background-color": hasSelected ? color : null,
      "color": hasSelected ? jkjs.util.getFontColor(color) : null
    });
    var tmp = check.on("change"); // Disable notification when updating
    check.on("change", null);
    check.node().checked = that.isValid();
    check.on("change", tmp);
  };
} // Type

/**
 * Generates a description for a type based on its group and ID.
 */
Type.typeDesc = function(group, id, asId, dictionary, full) {
  if(asId) {
    return (group+"__"+id).replace(/[.#*]/gi, "_");
  } else if(group in dictionary && id in dictionary[group]) {
    var desc = dictionary[group][id][full ? "desc" : "name"];
    if(group != "diagnosis" && group != "procedure") return desc;
    var rid = id.indexOf("__") >= 0 ? id.split("__", 2)[1] : id;
    if(rid.startsWith("HIERARCHY") || rid == '') return desc;
    if(desc == rid) {
      desc = "";
    }
    if(rid.indexOf('.') >= 0) return rid + (desc != "" ? ": " + desc : "");
    var letterstart = Number.isNaN(+rid.substring(0, 1));
    var pre = rid.substring(0, letterstart ? 4 : 3);
    var post = rid.substring(letterstart ? 4 : 3);
    return pre + "." + post + (desc != "" ? ": " + desc : "");
  } else {
    return (full ? group + " " : "") + rid;
  }
}; // Type
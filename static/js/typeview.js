function TypeView(pool, sel, sortDropdownSel) {
  var that = this;
  var totalHeight = Number.NaN;
  var totalWidth = 265; // Set the total width of the type view

  var typeSort = null;
  // Create a dropdown for sorting options and handle change events
  var dropdown = sortDropdownSel.append("select").classed("dropdown hidden", true).on("change", function () {
    var dd = dropdown.node();
    var s = d3.select(dd.options[dd.selectedIndex]).datum();
    that.selectSort(s);
  });
   // Function to add a new sorting option to the dropdown
  this.addSort = function (desc, sort) {
    var g = {
      desc: desc,
      sort: sort
    };
    dropdown.append("option").datum(g).text(g.desc);
    return g;
  };
  // Function to select and apply a sorting method
  this.selectSort = function (s) {
    typeSort = s.sort;
    dropdown.selectAll("option").each(function (g, i) {
      if (g !== s) return;
      var tmpChg = dropdown.on("change");
      dropdown.on("change", null);
      dropdown.node().selectedIndex = i;
      dropdown.on("change", tmpChg);
    });
    that.updateLists();
  };

  // Selected types object, updated when selection changes in the pool
  var selectedTypes = {};
  pool.addSelectionListener(function (es, types, singleSlot, singleType) {
    selectedTypes = types; // Update selected types based on the selection event
    that.updateLists(); // Update the lists to reflect the new selection
  });
  // Set initial styles for the selection container
  sel.style({
    "display": "inline-block",
    "padding": 0,
    "width": totalWidth + "px"
  });

   // Function to resize the view based on allowed height and body padding
  this.resize = function (allowedHeight, bodyPadding) {
    totalHeight = allowedHeight;
    sel.style({
      "position": "absolute",
      "top": bodyPadding + "px",
      "left": 10 + "px",
      "width": totalWidth + "px",
      "height": totalHeight + "px"
    });
    this.updateLists(); // Update the lists after resizing
    fingerQueue += 2; // Increase the fingerprint queue to ensure reprocessing
    fingerprints();
  };

  // Function to manage and display fingerprints (small graphical representations of types)
  var fingerQueue = 0;
  function fingerprints() {
    if (fingerQueue > 1) {
      fingerQueue -= 1;
      sel.selectAll("canvas.fingerprint").style({
        "display": "none"
      });
      setTimeout(fingerprints, 0);
      return;
    }
    if (fingerQueue <= 0) {
      return;
    }
    fingerQueue = 0;
    sel.selectAll("canvas.fingerprint").style({
      "display": null
    }).each(function (d) {
      var fpSel = d3.select(this);
      var pSel = d3.select(fpSel.node().parentNode);
      var types = d.types;
      var h = 14;
      var w = totalWidth - 44;
      var tw = w;
      var th = h * types.length;
      fpSel.attr({
        "width": tw,
        "height": th
      }).style({
        "position": "absolute",
        "top": 0,
        "left": 22 + "px",
        "width": tw + "px",
        "height": th + "px",
        "z-index": -1000
      });
      jkjs.util.toFront(fpSel, true);
      var ctx = fpSel.node().getContext("2d");
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, totalWidth, totalHeight);
      ctx.save();
      types.forEach(function (type) {
        //ctx.fillStyle = "black";
        //ctx.fillText(type.getDesc(), 0, h);
        type.fillFingerprint(ctx, w, h);
        ctx.translate(0, h);
      });
      ctx.restore();
    });
  }

  // Function to clear all type lists
  this.clearLists = function () {
    sel.selectAll("div.pType").remove(); // Remove all type divs
  };

  var oldTypes = [];
  var nodeRoots = [];
  var groups = {};
  var allGroups = {};
  var groupIx = 0;
  // Function to update the type lists
  this.updateLists = function () {
    // Reset the groups and populate them using pool.traverseTypes
    var newGroups = {}; // reset the groups
    pool.traverseTypes(function (gid, tid, t) {
        if (!(gid in newGroups)) {
            newGroups[gid] = {
                desc: t.getRoot().getDesc(),
                types: []
            };
        }
        newGroups[gid].types.push(t);
    });
    // Merge the new groups into the existing groups
    Object.keys(newGroups).forEach(function (gid) {
      if (!(gid in groups)) {
          groups[gid] = newGroups[gid];
      } else {
          groups[gid].types = groups[gid].types.concat(newGroups[gid].types);
      }
     });

    console.log("Groups:", groups);

    // Get the keys of the groups and handle empty or invalid states
    var groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      console.warn("No groups available");
      sel.selectAll("div.pType").remove();  // Clear the sidebar if no groups
      return;
    }

    // Ensure correct group index handling
    if (groupIx >= groupKeys.length) {
      groupIx = 0;
    }

    var currentGroup = groupKeys[groupIx]; // Get the current group
    var gKeys = [groupKeys[groupIx]]; // Use only the current group key

    console.log("Current Group Index:", groupIx);
    console.log("Current Group:", currentGroup);
    console.log("gKeys:", gKeys);

    var gCount = Object.keys(groups).length;

    // Function to change the current group index and emit a type change event
    function chgGroupIx(inc) {
      var groupKeys = Object.keys(groups);
      if (groupKeys.length === 0) return;  // Do nothing if no groups

      groupIx += inc ? 1 : -1;
      if (groupIx < 0) {
        groupIx = groupKeys.length - 1;
      }
      if (groupIx >= groupKeys.length) {
        groupIx = 0;
      }
      // that.updateLists();
      console.log("Changing to group index:", groupIx);
      console.log("New group:", groupKeys[groupIx]);

      emitTypeChangeEvent(); // Emit the type change event
    }
    // Function to emit a custom type change event
    function emitTypeChangeEvent() {
      var groupKeys = Object.keys(groups);
      if (groupKeys.length === 0) return;  // Do nothing if no groups

      var currentGroup = groupKeys[groupIx];
      var event = new CustomEvent('typeChange', { detail: { group: currentGroup } });
      window.dispatchEvent(event); // Dispatch the event to notify listeners of the change
    }

    // Bind the data to the type elements in the selection container
    var pType = sel.selectAll("div.pType").data(gKeys, function (key) {
      return key;
    });

    pType.exit().remove(); // Remove old elements that are no longer needed
    var pe = pType.enter().append("div").classed("pType", true); // Create new type elements
    var head = pe.append("div").classed("pTypeHead", true)  // Create the header for each type;
    head.append("span").classed("pTypeLeft", true); // Create the left arrow for changing groups
    head.append("span").classed("pTypeSpan", true).style({
      "position": "relative"
    }); // Create the span for displaying the type name
    head.append("span").classed("pTypeRight", true); // Create the right arrow for changing groups
    pe.append("div").classed("pTypeDiv", true); // Create the right arrow for changing groups

    // Set up the click listeners for the left and right arrows
    pType.selectAll("span.pTypeLeft").text("<").on("click", function () {
      chgGroupIx(false);
      emitTypeChangeEvent();
    }).style({
      "left": "10px",
      "position": "absolute",
      "cursor": "pointer",
      "text-align": "center"
    });
    pType.selectAll("span.pTypeRight").text(">").on("click", function () {
      chgGroupIx(true);
      emitTypeChangeEvent();
    }).style({
      "right": "10px",
      "position": "absolute",
      "cursor": "pointer",
      "text-align": "center"
    });

    // Style the type headers
    pType.selectAll("div.pTypeHead").style({
      "border-radius": 4 + "px",
      "text-align": "center",
      "margin": "0 0 4px 0",
      "padding": "5px 0",
      "background-color": function (gid) {
        return pool.getGroupColor(gid);
      },
      "color": function (gid) {
        return jkjs.util.getFontColor(pool.getGroupColor(gid));
      }
    });
    // Set the text of the type span to the group's description
    pType.selectAll("span.pTypeSpan").text(function (gid) {
      return groups[gid].desc;
    }).on("click", function (gid) {
      if (d3.event.button != 0) return;
      pool.startBulkValidity();
      var state = Number.NaN;
      pool.traverseGroup(gid, function (t) {
        if (state == 0) {
          return;
        }
        var v = t.isValid();
        if (isNaN(state)) {
          state = v ? 1 : -1;
        } else if ((state > 0 && !v) || (state < 0 && v)) {
          state = 0;
        }
      });
      var setV = state <= 0;
      pool.traverseGroup(gid, function (t) {
        t.setValid(setV);
      });
      pool.endBulkValidity();
    });
    var h = totalHeight / gKeys.length - 46; // 24: padding + margin + border; 22: buffer
    var divs = pType.selectAll("div.pTypeDiv").style({
      "font-size": "10px",
      "font-family": "monospace",
      // "white-space": "nowrap",
      // "max-height": h + "px",
      "max-width": totalWidth + "px",
      "margin": "0 0 12px 0",
      "position": "absolute",
      "display": "block",
      "max-height": totalHeight / gKeys.length - 46 + "px",
      "overflow": "auto", // Ensure content does not overflow
      "white-space": "nowrap", // Prevent text from wrapping
      "text-overflow": "ellipsis"
    });

    // Node class to represent each type in the hierarchy
    function Node(id, type) {
      var that = this;
      var children = {};
      var childs = null; // Stores child nodes
      var descendants = null;
      var count = Number.NaN;
      var y = Number.NaN;
      var isRoot = false;
      this.isRoot = function (_) {
        if (!arguments.length) return isRoot;
        isRoot = !!_;
      };
      this.putChild = function (node) {
        var id = node.getId();
        if (that.getId() == id) {
          console.warn("tried to add itself as child", "'" + id + "'");
          return;
        }
        children[id] = node;
        childs = null;
        count = Number.NaN;
        y = Number.NaN;
      };
      this.getId = function () {
        return id; // Get the ID of the node
      };
      this.getType = function () {
        return type; // Get the type of the node
      };
      this.getDesc = function () {
        return type.getDesc(); // Get the description of the type
      };
      this.getName = function () {
        return type.getName(); // Get the description of the type
      };
      this.getCount = function () {
        if (Number.isNaN(count)) {
          if (that.hasChildren()) {
            count = 0;
            that.getChildren().forEach(function (c) {
              count += c.getCount();
            });
          } else {
            count = type.getCount(); // Get the count of descendants
          }
        }
        return count;
      };
      this.getY = function () {
        if (Number.isNaN(y)) {
          y = Number.POSITIVE_INFINITY;
          that.getChildren().forEach(function (c) {
            y = Math.min(y, c.getY());
          });
        }
        return y;
      };
      this.getChildren = function () {
        if (!childs) {
          childs = Object.keys(children).map(function (c) {
            return children[c];
          });
        }
        return childs;
      };
      this.getDescendantTypes = function () {
        if (!descendants) {
          descendants = {};
          descendants[that.getId()] = that.getType();
          that.getChildren().forEach(function (c) {
            var cdt = c.getDescendantTypes();
            Object.keys(cdt).forEach(function (d) {
              descendants[d] = cdt[d];
            });
          });
        }
        return descendants; // Get all descendant types
      };
      this.hasChildren = function () {
        return that.getChildren().length > 0;
      };
      this.isExpanded = function () {
        return that.isRoot() || !that.getChildren().some(function (c) {
          return c.getType().hasRealProxy();
        });
      };
      this.preorder = function (cb, level, onlyVisible) {
        cb(level, that, that.hasChildren(), that.isExpanded());
        if (that.hasChildren() && (!onlyVisible || that.isExpanded())) {
          var cs = that.getChildren();
          typeSort && cs.sort(function (a, b) {
            return typeSort(a, b);
          });
          cs.forEach(function (n) {
            n.preorder(cb, level + 1, onlyVisible);
          });
        }
      };
      this.setExpanded = function (expand) {
        toggle(this, !expand);
      }
    } // Node

    var roots = {}; // Object to hold root nodes
    var nodeMap = {}; // Map of nodes by group
    function buildHierarchy(type) {
      var g = type.getGroup();
      if (!(g in nodeMap)) {
        nodeMap[g] = {};
      }
      var nm = nodeMap[g];
      var t = type;
      var node = null;
      while (t) {
        var id = t.getTypeId();
        var p = id in nm ? nm[id] : new Node(id, t);
        if (node) {
          p.putChild(node); // Attach the current node to its parent
        }
        if (id == "" && !(g in roots)) {
          p.isRoot(true); // Mark the node as a root if it has an empty ID
          roots[g] = p;
        }
        if (!(id in nm)) {
          nm[id] = p;
        } else {
          break;
        }
        node = p;
        t = t.getParent(); // Move up the hierarchy
      }
      if (!(g in roots)) {
        console.warn("no real root found!"); // Handle cases where no root is found
        roots[g] = new Node("", {
          "getGroup": function () {
            return g;
          },
          "getTypeId": function () {
            return "";
          }
        });
        roots[g].isRoot(true);
        node && roots[g].putChild(node);
      }
    }

    Object.keys(groups).forEach(function (gid) {
      groups[gid].types.forEach(function (type) {
        buildHierarchy(type);
      });

    });
    // Function to toggle node expansion or collapse
    function toggle(node, collapse) {
      var type = node.getType();
      pool.startBulkValidity();
      node.preorder(function (level, n) {
        if (!level) return;
        var t = n.getType();
        if (collapse) {
          t.proxyType(type);  // Collapse the node
        } else {
          t.proxyType(t);  // Expand the node
        }
      }, 0, false);
      pool.endBulkValidity(); // End the bulk validity operation
    }

    var fingerprintTypes = [];
    var updateFingerprints = false;
    // Remove old type elements and create new ones
    divs.selectAll("div.pT").remove();
    divs.each(function (gid) {
      var pT = d3.select(this);
      var types = [];
      roots[gid].preorder(function (level, node, isInner, isExpanded) {
        var type = node.getType();
        if (type.getTypeId() == "") {
          return;
        }
        updateFingerprints = type.setFingerprintTypes(node.getDescendantTypes()) || updateFingerprints;
        fingerprintTypes.push(type.getTypeId());
        var div = pT.append("div").classed("pT", true).datum(type);
        if ("createListEntry" in type) {
          types.push(type);
          var objs = type.createListEntry(div, level, isInner, isExpanded);
          objs["space"].on("click", function () {
            toggle(node, isExpanded);
            that.updateLists();
          });
        }
      }, 0, true);
      var fpSel = pT.selectAll("canvas.fingerprint").data([{
        id: gid,
        types: types
      }], function (d) {
        return d.id;
      });
      fpSel.exit().remove();
      fpSel.enter().append("canvas").classed("fingerprint", true);
    });

    divs.selectAll("div.pT").style({
      "min-width": totalWidth + "px"
    }).each(function (t) {
      var div = d3.select(this);
      var pt = t.proxyType();
      var hasSelected = pt.getId() in selectedTypes;
      while (pt.getParent() && !hasSelected) {
        pt = pt.getParent();
        hasSelected = pt.getId() in selectedTypes;
      }
      var onlyOneTypeSelected = Object.keys(selectedTypes).length == 1;
      if ("updateListEntry" in t) {
        t.updateListEntry(div, hasSelected, onlyOneTypeSelected);
      }
      // TODO detect when it's not a manual selection and then scroll
      //if(hasSelected && onlyOneTypeSelected) {
      //  div.node().scrollIntoView(true);
      //}
    });

    nodeRoots = Object.keys(roots).map(function (r) {
      return roots[r];
    });

    fingerprintTypes.sort();
    if (!updateFingerprints) {
      if (fingerprintTypes.length === oldTypes.length) {
        for (var ix = 0; ix < oldTypes.length; ix += 1) {
          if (oldTypes[ix] !== fingerprintTypes[ix]) {
            updateFingerprints = true;
            break;
          }
        }
      } else {
        updateFingerprints = true;
      }
    }
    oldTypes = fingerprintTypes;

    if (updateFingerprints) {
      fingerQueue += 2;
      fingerprints();
    }
  };
  this.getNodeRoots = function () {
    return nodeRoots;
  };
} // Typeview.js
// main.js - dynamic patient id creation

var SLOW_MODE = false;
var DEBUG_V_SEGMENTS = false;
var SHOW_EVENT_GROUPS = false;
var busy = null;

function start() {
  jkjs.busy.imgBusy = "static/lib/jk-js/jkjs/img/busy.gif";
  jkjs.busy.imgWarn = "static/lib/jk-js/jkjs/img/warning.png";
  jkjs.text.exact(!SLOW_MODE);

  // function setPidSel(ps) {
  //   var curId;
  //   if (ps) {
  //     ps.on("change", function() {
  //       var pn = ps.node();
  //       var op = d3.select(pn.options[pn.selectedIndex]).datum();
  //       loadFile(op, lastDictionaryFile, true);
  //     });
  //     var dd = ps.node();
  //     curId = d3.select(dd.options[dd.selectedIndex]).text();
  //   } else {
  //     curId = 0;
  //   }
  //   d3.text("patients.txt", "text/plain", function(error, data) {
  //     if (error) {
  //       console.error("Error loading patients.txt:", error);
  //       busy.setState(jkjs.busy.state.warn, "Error loading file list. Error: " + error.statusText);
  //       return;
  //     }

  //     var pids = data.split("\n").map(function(pid) {
  //       return ("" + pid).trim();
  //     }).filter(function(pid) {
  //       return pid != "";
  //     });
  //     if (ps) {
  //       var pidOpts = ps.selectAll("option").data(pids);
  //       pidOpts.exit().remove();
  //       pidOpts.enter().append("option");
  //       pidOpts.text(function(pid) {
  //         return pid;
  //       });
  //       pidOpts.sort();

  //       ps.selectAll("option").each(function(p, i) {
  //         if (p !== curId) {
  //           return;
  //         }
  //         var tmpChg = ps.on("change");
  //         ps.on("change", null);
  //         ps.node().selectedIndex = i;
  //         ps.on("change", tmpChg);
  //       });
  //     } else {
  //       if (pids.length > 2 && pids[2] === "json/998093F33FE2D940.json") {
  //         curId = 2;
  //       }
  //       if (curId < pids.length) {
  //         loadFile(pids[curId], lastDictionaryFile || dictionaryDefault, true);
  //       } else {
  //         console.warn("no patients found!");
  //         busy.setState(jkjs.busy.state.warn, "No file list found.");
  //       }
  //     }
  //   });
  // }

  var showLabelsOnDrag = !SLOW_MODE;
  var topPad = 71; // bootstraps navbar
  var divContent = d3.select("#pContent").style({
    "display": "inline-block",
    "margin": "0 5px",
    "padding": 0,
    "box-sizing": "border-box",
    "font-size": "10px",
    "font-family": "monospace"
  });
  var divSVG = d3.select("#pSVG");
  var width = 800;
  var height = 600;
  var ovWidth = 256;
  var ovHeight = Math.floor(256 / width * height);
  var handler = {
    getSize: function() {
      return {
        width: ovWidth,
        height: ovHeight
      };
    },
    getBox: function() {
      return box;
    },
    getZUI: function() {
      return zui;
    }
  };
  var inTransition = 0;
  var zui = jkjs.zui.create(divSVG, {
    width: width + "px",
    height: height + "px"
  }, {
    width: width,
    height: height
  }, function() {
    return box;
  }, function(target, translate, scale, w, h, canvasRect, isSmooth) {
    if (isSmooth) {
      labels && labels.setShowLabels(false);
      pool.inTransition(true);
      inTransition += 1;
      setTimeout(function() {
        inTransition -= 1;
        if (inTransition == 0) {
          labels && labels.setShowLabels(true);
          pool.inTransition(false);
          updateViewport();
        }
      }, jkjs.zui.animationDuration);
    }
    jkjs.zui.applyCanvasZoom(target, translate, scale, w, h, canvasRect, isSmooth);
    var visRect = jkjs.zui.computeVisibleRect(translate, scale, w, h);
    overview.updateCameraRect(canvasRect, visRect, isSmooth);
    pool.onViewportChange(box, visRect, scale, isSmooth);
  }, [1e-6, 12]); // be generous with zooming! FIXME: adapt zoom extent depending on minTimeDiff #34

  function updateViewport() {
    zui.move(0, 0, false);
  }

  zui.svg.style({
    "cursor": "crosshair"
  });
  if (!showLabelsOnDrag) {
    zui.svg.on("mousedown.labels", function() {
      labels && labels.setShowLabels(false);
    }).on("mouseup.labels", function() {
      labels && labels.setShowLabels(true);
      updateViewport();
    }).on("mousewheel.labels", function() {
      labels && labels.setShowLabels(true);
      updateViewport();
    });
  }
  var suppl = divSVG.append("svg");
  var overview = new Overview(d3.select("#pTypesRight"), handler);
  overview.getSVG().on("mousedown.labels", function() {
    labels && labels.setShowLabels(false);
  }).on("mouseup.labels", function() {
    labels && labels.setShowLabels(true);
    updateViewport();
  });
  var pool = null;
  var eventList = null;
  var typeList = null;
  var linechart = null;
  var histogram = null;
  var box = null;
  var labels = null;

  function setBox(w, h) {
    box = {
      x: 0,
      y: 0,
      width: w,
      height: h
    };
    overview.onBoxUpdate();
  };

  var mainG = zui.inner.append("g").attr({
    "id": "mainG"
  });
  var secG = zui.svg.append("g");
  var busy = new jkjs.busy.layer(zui.svg, {
    x: 0,
    y: 0,
    width: width,
    height: height
  });
  var fullRect = zui.svg.append("rect").attr({
    "x": 0,
    "y": 0,
    "width": width,
    "height": height,
    "stroke": "black",
    "stroke-width": 1,
    "fill": "none"
  });
  var blank = zui.svg.append("rect").attr({
    "x": 0,
    "y": 0,
    "width": width,
    "height": height,
    "fill": "white",
    "opacity": 0
  });

  function setSize(w, h) {
    width = w;
    height = h;
    if (box) {
      setBox(box.width, box.height);
    }
    overview.onSizeUpdate();
    fullRect.attr({
      "width": width,
      "height": height
    });
    blank.attr({
      "width": width,
      "height": height
    });
    busy.setRect({
      x: 0,
      y: 0,
      width: width,
      height: height
    });
    zui.setSize({
      width: width + "px",
      height: height + "px"
    }, {
      width: width,
      height: height
    });
    if (pool) {
      pool.onSizeUpdate(width, height);
    }
  }

  var views = initViews(mainG, secG, suppl, blank, d3.select("#pTypesRight"), d3.select("#pTypesLeft"), overview, setBox, onVC, busy, updateViewport);
  pool = views[0];
  eventList = views[1];
  typeList = views[2];
  linechart = views[3];
  histogram = views[4];
  labels = views[5];
  d3.select("#pVSel").on("change", function() {
    pool.verticalSelection(d3.select("#pVSel").node().checked);
  });
  d3.select("#pShow").on("change", function() {
    pool.showOnlyWeightedEvents(!d3.select("#pShow").node().checked);
  });
  d3.select("#pShowSpans").on("change", function() {
    pool.showSpans(d3.select("#pShowSpans").node().checked);
    overview.clearShadow();
    pool.updateLook();
  });

  function updateRange() {
    var value = d3.select("#pConnectRange").node().value;
    d3.select("#pConnectRangeDisplay").text(value);
    pool.maxConnectSlot(value);
  }

  d3.select("#pConnectRange").style({
    "width": "50px",
    "display": "inline-block"
  }).on("change", updateRange);
  if (!SLOW_MODE) {
    d3.select("#pConnectRange").on("input", updateRange);
  }

  var args = jkjs.util.getQueryStrings();

  var dictionaryDefault = 'json/dictionary.json';
  var dictionary = null;
  var lastDictionaryFile = null;

  // function loadFile(pid, dictionaryFile, createState) {
  //   if (createState) {
  //     var url = jkjs.util.getOwnURL() + "?p=" + encodeURIComponent(pid) + "&d=" + encodeURIComponent(dictionaryFile);
  //     window.history.pushState({
  //       pid: pid,
  //       dictionary: dictionaryFile
  //     }, "", url);
  //   }
  //   var inputFile = pid;
  //   console.log("Loading patient file from:", inputFile);
  //   busy.setState(jkjs.busy.state.busy);
  //   overview.clearShadow();
  //   typeList.clearLists();
  //   eventList.setEvents([], false, false);
  //   d3.json(inputFile, function(err, json_patient) {
  //     if (err) {
  //       console.error("Failed loading patient:", inputFile, err);
  //       busy.setState(jkjs.busy.state.warn, "Failed loading file: '" + inputFile + "'. Error: " + err.statusText);
  //       return;
  //     }
  //     d3.json(dictionaryFile, function(err_dict, json_dictionary) {
  //       if (err_dict) {
  //         console.error("Failed loading dictionary:", dictionaryFile, err_dict);
  //         busy.setState(jkjs.busy.state.warn, "Invalid dictionary file. Error: " + err_dict.statusText);
  //         return;
  //       }
  //       dictionary = json_dictionary;
  //       lastDictionaryFile = dictionaryFile;
  //       var error = true;
  //       try {
  //         setPidSel(loadPerson(pid, json_patient, pool, eventList, typeList, linechart, histogram, dictionary, suppl));
  //         busy.setState(jkjs.busy.state.norm);
  //         relayout();
  //         zui.showAll(false);
  //         error = false;
  //       } finally {
  //         if (error) {
  //           busy.setState(jkjs.busy.state.warn, "Error while loading file.");
  //         }
  //       }
  //     });
  //   });
  // }

  // dynamic patient id creation
  function loadFile(pid, dictionaryFile, createState) {
    if (createState) {
        var url = jkjs.util.getOwnURL() + "?p=" + encodeURIComponent(pid) + "&d=" + encodeURIComponent(dictionaryFile);
        window.history.pushState({
            pid: pid,
            dictionary: dictionaryFile
        }, "", url);
    }
    console.log("Loading patient file from:", pid);
    busy.setState(jkjs.busy.state.busy);
    overview.clearShadow();
    typeList.clearLists();
    eventList.setEvents([], false, false);

    // Extract person_id if it's a filename
    var personId = pid;
    if (pid.startsWith('json/') && pid.endsWith('.json')) {
        personId = pid.substring(5, pid.length - 5);
    }

    // Use the new endpoint to get patient data
    d3.json("/get_patient_data?id=" + encodeURIComponent(personId), function(err, json_patient) {
        if (err) {
            console.error("Failed loading patient:", pid, err);
            busy.setState(jkjs.busy.state.warn, "Failed loading file: '" + pid + "'. Error: " + err.statusText);
            return;
        }
        d3.json(dictionaryFile, function(err_dict, json_dictionary) {
            if (err_dict) {
                console.error("Failed loading dictionary:", dictionaryFile, err_dict);
                busy.setState(jkjs.busy.state.warn, "Invalid dictionary file. Error: " + err_dict.statusText);
                return;
            }
            dictionary = json_dictionary;
            lastDictionaryFile = dictionaryFile;
            var error = true;
            try {
                // setPidSel(loadPerson(personId, json_patient, pool, eventList, typeList, linechart, histogram, dictionary, suppl));
                loadPerson(pid, json_patient, pool, eventList, typeList, linechart, histogram, dictionary, suppl);
                busy.setState(jkjs.busy.state.norm);
                relayout();
                zui.showAll(false);
                error = false;
            } finally {
                if (error) {
                    busy.setState(jkjs.busy.state.warn, "Error while loading file.");
                }
            }
        });
    });
}

  window.onpopstate = function(e) {
    if (e.state) {
      loadFile(e.state.pid, e.state.dictionary, false);
    }
  };

  function onVC() {
    relayout();
    zui.showAll(false);
  }

  function relayout() {
    topPad = d3.select("#pHead").node().offsetHeight + 10; // comfort space
    var bodyHeight = window.innerHeight;
    var body = d3.select("body").style({
      "width": "100%",
      "height": bodyHeight + "px"
    });
    var bodyPadding = topPad;
    var bodyWidth = body.node().offsetWidth;
    var listWidthLeft = d3.select("#pTypesLeft").node().offsetWidth;
    var listWidthRight = d3.select("#pTypesRight").node().offsetWidth;
    var correctWidth = bodyWidth - listWidthLeft - listWidthRight - 36; // 2 * 5px margin on both sides + 16px buffer
    var allowedHeight = bodyHeight - bodyPadding - 16; // 10px bottom margin + 6px buffer
    var bodyHPad = 18;
    divContent.style({
      "left": (listWidthLeft + bodyHPad) + "px",
      "height": allowedHeight + "px",
      "width": correctWidth + "px"
    });
    divSVG.style({
      "left": (listWidthLeft + bodyHPad) + "px",
      "height": allowedHeight + "px",
      "width": correctWidth + "px",
      "position": "absolute",
      "top": bodyPadding + "px"
    });
    if (ovWidth !== listWidthRight) {
      var ovw = listWidthRight;
      ovHeight = overview.getHeightForWidth(ovw);
      ovWidth = ovw;
      overview.onSizeUpdate();
    }
    var shadowHeight = overview.getHeightForWidth(listWidthRight);
    var listHeightLeft = allowedHeight;
    var listHeightRight = allowedHeight - shadowHeight;
    eventList && eventList.resize(listHeightRight, bodyPadding);
    typeList && typeList.resize(listHeightLeft, bodyPadding);
    if (box) {
      var supplHeight = suppl.node().offsetHeight;
      if (!supplHeight) {
        supplHeight = 108;
      }
      setSize(correctWidth, allowedHeight - supplHeight);
    }
    labels && labels.isInit(false);
  }

  window.onresize = function() {
    relayout();
  };

  // Add event listener to the select file button
  document.getElementById("selectFileBtn").addEventListener("click", function() {
    var patientId = document.getElementById("patientIdInput").value.trim();
    if (patientId) {
      var filePath = "json/" + patientId + ".json";
      loadFile(filePath, lastDictionaryFile || dictionaryDefault, true);
    } else {
      alert("Please enter a valid Patient ID.");
    }
  });

  // document.getElementById("selectFileBtn").addEventListener("click", function() {
  //   var patientId = document.getElementById("patientIdInput").value.trim();
  //   if (patientId) {
  //       selectFileByPatientId(patientId);
  //   } else {
  //       alert("Please enter a valid Patient ID.");
  //   }
  // });
}






  






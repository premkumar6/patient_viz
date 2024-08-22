// Filtering data based on event-types and encrypted the data

let isLoading = false;
var SLOW_MODE = false; // Flag to control slow mode behavior
var DEBUG_V_SEGMENTS = false; // Flag to control debug view segments
var SHOW_EVENT_GROUPS = false; // Flag to show event groups
var busy = null;  // Variable to manage busy state
let dictionary = {}; 
var checkboxStates = {};

// Encryption settings: Key and IV used for decrypting data
const ENCRYPTION_KEY = CryptoJS.enc.Utf8.parse('ThisIsA16ByteKey');
const IV = CryptoJS.enc.Utf8.parse('ThisIsA16ByteIV!');

// Function to decrypt data using AES encryption
function decryptData(encryptedData) {
  const ciphertext = CryptoJS.enc.Base64.parse(encryptedData);
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertext },
    ENCRYPTION_KEY,
    { iv: IV, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
}

// Main function to start application
async function start() {
  // Configure busy images
  jkjs.busy.imgBusy = "static/lib/jk-js/jkjs/img/busy.gif";
  jkjs.busy.imgWarn = "static/lib/jk-js/jkjs/img/warning.png";
  jkjs.text.exact(!SLOW_MODE);

  var showLabelsOnDrag = !SLOW_MODE; // Control label visibility on drag based on slow mode
  var topPad = 71; // bootstraps navbar
  // Configure the main content div
  var divContent = d3.select("#pContent").style({
    "display": "inline-block",
    "margin": "0 5px",
    "padding": 0,
    "box-sizing": "border-box",
    "font-size": "10px",
    "font-family": "monospace"
  });
  // Configure the main SVG element
  var divSVG = d3.select("#pSVG");
  var width = 800;
  var height = 600;
  var ovWidth = 256; // overview width
  var ovHeight = Math.floor(256 / width * height); // Overview height proportional to the width
  // Handler functions for managing size and zoom
  var handler = {
    getSize: function () {
      return {
        width: ovWidth,
        height: ovHeight
      };
    },
    getBox: function () {
      return box;
    },
    getZUI: function () {
      return zui;
    }
  };
  var inTransition = 0;
   // Initialize the zoom and pan interface
  var zui = jkjs.zui.create(divSVG, {
    width: width + "px",
    height: height + "px"
  }, {
    width: width,
    height: height
  }, function () {
    return box;
  }, function (target, translate, scale, w, h, canvasRect, isSmooth) {
    // Manage transition effects when zooming/panning
    if (isSmooth) {
      labels && labels.setShowLabels(false); // Hide labels during smooth transitions
      pool.inTransition(true);
      inTransition += 1;
      setTimeout(function () {
        inTransition -= 1;
        if (inTransition == 0) {
          labels && labels.setShowLabels(true);  // Show labels after transition
          pool.inTransition(false);
          updateViewport();
        }
      }, jkjs.zui.animationDuration);
    }
    jkjs.zui.applyCanvasZoom(target, translate, scale, w, h, canvasRect, isSmooth);
    var visRect = jkjs.zui.computeVisibleRect(translate, scale, w, h);
    overview.updateCameraRect(canvasRect, visRect, isSmooth);
    pool.onViewportChange(box, visRect, scale, isSmooth);
  }, [1e-6, 12]); // Zoom extent settings

    // Function to reset the viewport position
    function updateViewport() {
      zui.move(0, 0, false);
    }
  // Configure the SVG style and event listeners for labels during dragging/zooming
  zui.svg.style({
    "cursor": "crosshair"
  });
  if (!showLabelsOnDrag) {
    zui.svg.on("mousedown.labels", function () {
      labels && labels.setShowLabels(false);
    }).on("mouseup.labels", function () {
      labels && labels.setShowLabels(true);
      updateViewport();
    }).on("mousewheel.labels", function () {
      labels && labels.setShowLabels(true);
      updateViewport();
    });
  }
  // Additional SVG elements for the visualization
  var suppl = divSVG.append("svg");
  var overview = new Overview(d3.select("#pTypesRight"), handler);
  overview.getSVG().on("mousedown.labels", function () {
    labels && labels.setShowLabels(false);
  }).on("mouseup.labels", function () {
    labels && labels.setShowLabels(true);
    updateViewport();
  });
  // Initialize various visual elements
  var pool = null;
  var eventList = null;
  var typeList = null;
  var linechart = null;
  var histogram = null;
  var box = null;
  var labels = null;

  // Function to set the bounding box for the visualization
  function setBox(w, h) {
    box = {
      x: 0,
      y: 0,
      width: w,
      height: h
    };
    overview.onBoxUpdate(); // Update the overview when the box changes
  };

   // Main SVG group for the visualization
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
  // Rectangle to outline the full SVG area
  var fullRect = zui.svg.append("rect").attr({
    "x": 0,
    "y": 0,
    "width": width,
    "height": height,
    "stroke": "black",
    "stroke-width": 1,
    "fill": "none"
  });
  // Rectangle for a blank background, initially invisible
  var blank = zui.svg.append("rect").attr({
    "x": 0,
    "y": 0,
    "width": width,
    "height": height,
    "fill": "white",
    "opacity": 0
  });

  // Function to resize the visualization
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

  // Initialize the main views and their components
  var views = initViews(mainG, secG, suppl, blank, d3.select("#pTypesRight"), d3.select("#pTypesLeft"), overview, setBox, onVC, busy, updateViewport);
  pool = views[0];
  eventList = views[1];
  typeList = views[2];
  linechart = views[3];
  histogram = views[4];
  labels = views[5];

  // Load the initial dictionary data
  await fetchDictionary();

  // Set event listeners for various controls
  d3.select("#pVSel").on("change", function () {
    pool.verticalSelection(d3.select("#pVSel").node().checked);
  });
  d3.select("#pShow").on("change", function () {
    pool.showOnlyWeightedEvents(!d3.select("#pShow").node().checked);
  });
  d3.select("#pShowSpans").on("change", function () {
    pool.showSpans(d3.select("#pShowSpans").node().checked);
    overview.clearShadow();
    pool.updateLook();
  });

  // Function to update the range for connected slots
  function updateRange() {
    var value = d3.select("#pConnectRange").node().value;
    d3.select("#pConnectRangeDisplay").text(value);
    pool.maxConnectSlot(value);
  }

  // Configure the range input for connecting slots
  d3.select("#pConnectRange").style({
    "width": "50px",
    "display": "inline-block"
  }).on("change", updateRange);
  if (!SLOW_MODE) {
    d3.select("#pConnectRange").on("input", updateRange);
  }

  // Parse query strings from the URL to get initial parameters
  var args = jkjs.util.getQueryStrings();

  // Default dictionary file and related variables
  var dictionaryDefault = 'json/dictionary.json';
  var dictionary = null;
  var lastDictionaryFile = null;

  // Function to load patient data dynamically based on ID and group
  async function loadFile(pid, dictionaryFile, createState, group = null) {
    document.getElementById('timelineContainer').style.display = 'none';
    if (createState) {
       // Update the browser history with the new patient ID and dictionary file
      var url = jkjs.util.getOwnURL() + "?p=" + encodeURIComponent(pid) + "&d=" + encodeURIComponent(dictionaryFile);
      window.history.pushState({
        pid: pid,
        dictionary: dictionaryFile
      }, "", url);
    }
    console.log("Loading patient file from:", pid);
    busy.setState(jkjs.busy.state.busy); // Set the busy state to show loading

    overview.clearShadow(); // Clear previous visualization shadows
    typeList.clearLists();// Clear the type list
    eventList.setEvents([], false, false); // Clear the event list
    pool.clearEvents();  // Clear the pool of events
    currentPatientId = pid; // Store the current patient ID

    var personId = pid;
    if (pid.startsWith('json/') && pid.endsWith('.json')) {
      personId = pid.substring(5, pid.length - 5);
    }

    try {
      // Fetch the patient data from the server
      const response = await fetch(`/get_patient_data?id=${encodeURIComponent(personId)}${group ? '&group=' + encodeURIComponent(group) : ''}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const json_patient = decryptData(data.encrypted_data); // Decrypt the patient data

      console.log("Received patient data for group:", group, json_patient);
      console.log("Number of events:", json_patient.events.length);
      console.log("First event:", json_patient.events[0]);
      console.log("Last event:", json_patient.events[json_patient.events.length - 1]);

      if (json_patient.start === undefined || json_patient.end === undefined) {
        console.error("Missing start or end time in patient data");
        busy.setState(jkjs.busy.state.warn, "Missing start or end time in patient data");
        return;
      }

      // Update the dictionary with the new data
      if (json_patient.dictionary) {
        updateDictionary(json_patient.dictionary);
      } else {
        // If no dictionary in json_patient, fetch it separately
        await fetchDictionary(group);
      }
      // Load the patient data into the visualization
      
      console.log("Patient data loaded, creating checkboxes");
      loadPerson(pid, json_patient, pool, eventList, typeList, linechart, histogram, dictionary, suppl);
      createEventTypeCheckboxes(pool);
      // checkboxStates = {}; 

      // Show the timeline container
      document.getElementById('timelineContainer').style.display = 'block';
      // Show hidden elements after data is loaded
      d3.select("#timeRangeDisplay").classed("hidden", false);

      // Targeting the 'Selection' span within the parent div
      d3.select("#pTypesRight  span").classed("hidden", false);
      
      d3.select("#pTypesRight select.dropdown").classed("hidden", false);



      typeList.updateLists();  // Update the type lists

      busy.setState(jkjs.busy.state.norm);
      relayout();
      pool.updateLook();
      zui.showAll(false);

      // Hide the loading indicator if present
      var loadingIndicator = document.getElementById('loadingIndicator');
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
      console.error("Error loading patient data:", error);
      busy.setState(jkjs.busy.state.warn, "Error while loading file: " + error.message);
      // Hide the timeline container in case of an error
      document.getElementById('timelineContainer').style.display = 'none';
    }
  }
   // Function to fetch the dictionary data, filtered by group
  async function fetchDictionary(group = null) {
    try {
      const url = group
        ? `/get_dictionary_by_type?type=${encodeURIComponent(group)}`
        : '/patient-viz/dictionary.json';
      const response = await fetch(url);
      const data = await response.json();
      updateDictionary(data); // Update the local dictionary with the fetched data
    } catch (error) {
      console.error('Error loading dictionary data:', error);
    }
  }

  // Function to update the local dictionary with new data
  function updateDictionary(newDictionaryData) {
    if (!dictionary) {
      dictionary = {};
    }
    // Merge the new dictionary data with the existing dictionary
    Object.keys(newDictionaryData).forEach(key => {
      if (!dictionary[key]) {
        dictionary[key] = {};
      }
      Object.assign(dictionary[key], newDictionaryData[key]);
    });
    console.log("Updated dictionary:", dictionary); // Debugging
  }
  function createEventTypeCheckboxes(pool) {
    console.log("Creating event type checkboxes");
    var checkboxContainer = d3.select("#eventTypeCheckboxes");
    checkboxContainer.selectAll("*").remove(); // Clear existing checkboxes
  
    // Create "All" checkbox
    var allLabel = checkboxContainer.append("label").classed("checkbox-label", true);
    allLabel.append("input")
      .attr("type", "checkbox")
      .property("checked", true)
      .attr("id", "allEventTypes")
      .on("change", function() {
        var checked = d3.select(this).property("checked");
        checkboxContainer.selectAll("input[type='checkbox']")
          .filter(function() { return this.id !== "allEventTypes"; })
          .property("checked", checked);
        filterEventsByType(pool);
      });
    allLabel.append("span").text("All");
  
    // Get all event types from the dictionary
    var dictionaryEventTypes = Object.keys(dictionary);

    // Get event types actually present in the patient data
    var patientEventTypes = [];
    pool.traverseGroups(function(gid, group) {
      if (!patientEventTypes.includes(gid)) {
        patientEventTypes.push(gid);
      }
    });
  
    // Intersect dictionary event types with patient event types
    var eventTypes = dictionaryEventTypes.filter(type => patientEventTypes.includes(type));
  
    console.log("Event types in patient data:", eventTypes);
  
    // Create checkboxes for each event type
    eventTypes.forEach(function(eventType) {
      var label = checkboxContainer.append("label").classed("checkbox-label", true);
      label.append("input")
        .attr("type", "checkbox")
        .property("checked", true)
        .attr("data-event-type", eventType)
        .on("change", function() {
          if (!this.checked) {
            d3.select("#allEventTypes").property("checked", false);
          }
          filterEventsByType(pool);
        });
      label.append("span").text(eventType);
    });
  
    filterEventsByType(pool); // Initial filtering
  }
  function filterEventsByType(pool) {
    console.log("Filtering events by type");
    var checkboxContainer = d3.select("#eventTypeCheckboxes");
    var allChecked = d3.select("#allEventTypes").property("checked");
    
    var checkedTypes = [];
    checkboxContainer.selectAll("input[type='checkbox']")
      .filter(function() { return this.id !== "allEventTypes" && this.checked; })
      .each(function() {
        checkedTypes.push(this.getAttribute("data-event-type"));
      });
  
    console.log("Checked types:", checkedTypes);
  
    pool.traverseAllEvents(function(gid, tid, e) {
      var isVisible = allChecked || checkedTypes.includes(e.getType().getGroup());
      e.shown(isVisible);
    });
  
    pool.updateLook();
    pool.updateSelection();
    zui.showAll(false);
  }
  // Update the event listener to use the modified loadFile function
  window.addEventListener('typeChange', async function (e) {
    currentGroup = e.detail.group;

    try {
      await fetchDictionary(currentGroup);
      await loadFile(currentPatientId, lastDictionaryFile || dictionaryDefault, false, currentGroup);

      // Force a complete update of the TypeView
      typeList.updateLists();
    } catch (error) {
      console.error("Error during type change:", error);
    }
  });
  // Handle browser back/forward navigation
  window.onpopstate = function (e) {
    if (e.state) {
      loadFile(e.state.pid, e.state.dictionary, false);
    }
  };
   // Function to update the visualization layout
  function onVC() {
    relayout();
    zui.showAll(false);
  }
  // Function to adjust the layout when the window is resized or other changes occur
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
    var headerHeight = d3.select("#pHead").node().offsetHeight;
    var checkboxContainerHeight = d3.select("#eventTypeCheckboxes").node().offsetHeight;
    
    // Adjust the top padding to account for the checkbox container
    bodyPadding = headerHeight + checkboxContainerHeight + 10; // 10px extra padding

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

  window.onresize = function () {
    relayout();
  };

  // Add event listener to the select file button for dynamic patient ID creation
  document.getElementById("selectFileBtn").addEventListener("click", function () {
    var patientId = document.getElementById("patientIdInput").value.trim();
    if (patientId) {
      var filePath = "json/" + patientId + ".json";
      loadFile(filePath, lastDictionaryFile || dictionaryDefault, true);
    } else {
      alert("Please enter a valid Patient ID.");
    }
  });
}
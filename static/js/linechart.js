function Linechart(svg) {
  var that = this;
  var values = [];
  var min = 0;
  var max = 1;

  // Create SVG groups for left and right Y-axis labels
  var yLabelsLeft = svg.append("g").classed("yAxisClass", true);
  var yLabelsRight = svg.append("g").classed("yAxisClass", true);
  // Create a group element to hold the line path
  var g = svg.append("g").attr({
    "transform": "scale(1 1) translate(0 0)" // Initial transform attributes
  });

  // Create a path element within the group to draw the line
  var path = g.append("path").attr({
    "fill": "transparent",
    "stroke": "black",
    "stroke-width": "2px"
  });
  var timeMap = function(t) {
    return 0;
  };
  var yMap = function(v) {
    return 0;
  };

  // Function to set or get the mapping functions for the x and y axes
  this.mapping = function(m) {
    if(!arguments.length) return [ timeMap, yMap ]; // If no arguments, return current mappings
    timeMap = m[0];  // Set the time mapping function
    yMap = m[1]; // Set the y-axis mapping function
    that.updatePath(); // Update the path after setting the mappings
  };
  this.hasContent = function() {
    return !!values.length;
  };
  // Function to set or get the values to be plotted
  this.values = function(v) {
    if(!arguments.length) return values;
    // Reset min and max values to find the true min and max of the new data
    min = Number.POSITIVE_INFINITY;
    max = Number.NEGATIVE_INFINITY;
    v.forEach(function(a) {
      var y = a[1];
      if(y < min) min = y;
      if(y > max) max = y;
    });
    if(!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    // Normalize the y-values between 0 and 1 based on the min and max
    values = v.map(function(a) {
      return [ a[0], (a[1] - min) / (max - min) ];
    });
    // Sort the values by the x-axis (time) values
    values.sort(function(a, b) {
      return d3.ascending(a[0], b[0]);
    });
    that.updatePath();
  };
    // Function to update the line path based on the current values and mapping functions
  this.updatePath = function() {
    var p = new jkjs.Path();
     // Iterate over the values to create the path
    values.forEach(function(v) {
      var x = timeMap(v[0]);
      var y = yMap(v[1]);
      if(p.isEmpty()) {
        p.move(x, y);
      } else {
        p.line(x, y);
      }
    });
    // Update the 'd' attribute of the path element with the constructed path
    path.attr({
      "d": p
    });
    var yAxisLeft = d3.svg.axis();
    var yAxisRight = d3.svg.axis();
    yAxisLeft.orient("right");
    yAxisRight.orient("left");
    var yc = d3.scale.linear();
    yc.domain([ min, max ]);
    yc.range([ yMap(0), yMap(1) ]);
    yAxisLeft.scale(yc);
    yAxisRight.scale(yc);
    yLabelsLeft.call(yAxisLeft);
    yLabelsRight.call(yAxisRight);
    if(!values.length) {
      yLabelsLeft.style({
        "opacity": 0
      });
      yLabelsRight.style({
        "opacity": 0
      });
    } else {
      yLabelsLeft.style({
        "opacity": null
      });
      yLabelsRight.style({
        "opacity": null
      });
    }
  };
  // Function to update the position of the right y-axis labels when the width changes
  this.updateWidth = function(newWidth) {
    yLabelsRight.attr({
      "transform": "translate(" + newWidth + " 0)"
    });
  };
  this.getG = function() {
    return g;
  };
};

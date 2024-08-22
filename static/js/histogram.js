function Histogram(svg) {
  var that = this;
  var values = [];  // Array to store the histogram values
  var max = 1;  // Maximum value in the histogram (for scaling)
  var colors = ["#eee", "#bbb", "#777", "#444", "#000"];  // Color scale for the histogram bars based on value
  var yLabelsLeft = svg.append("g").classed("yAxisClass", true);  // Group for left y-axis labels
  var yLabelsRight = svg.append("g").classed("yAxisClass", true);  // Group for right y-axis labels
  var g = svg.append("g").attr({
    "transform": "scale(1 1) translate(0 0)"
  });  // Main group for the histogram
  var lineSel = g.append("g");  // Group for horizontal lines in the histogram
  var timeMap = function(t) {
    return 0;
  };  // Function to map time to x-coordinate (initially identity function)
  var yMap = function(v) {
    return 0;
  };  // Function to map value to y-coordinate (initially identity function)

  /**
   * Sets or gets the mapping functions for time (x-axis) and value (y-axis).
   */
  this.mapping = function(m) {
    if(!arguments.length) return [ timeMap, yMap ];
    timeMap = m[0];
    yMap = m[1];
    that.update();  // Update the histogram whenever the mapping changes
  };

  /**
   * Returns whether the histogram has any values.
   */
  this.hasContent = function() {
    return !!values.length;
  };

  /**
   * Sets or gets the values for the histogram.
   * The values are sorted by time, and the maximum value is calculated.
   */
  this.values = function(v) {
    if(!arguments.length) return values;
    max = Number.NEGATIVE_INFINITY;
    v.forEach(function(a) {
      var y = a[1];
      if(y > max) max = y;
    });
    if(!Number.isFinite(max) || !max) {
      max = 1;
    }
    values = v.map(function(a) {
      return [ a[0], a[1] ];
    });
    values.sort(function(a, b) {
      return d3.ascending(a[0], b[0]);
    });
    that.update();  // Update the histogram whenever values change
  };

  var useLog = true;  // Flag to determine if logarithmic scale should be used
  var yc = useLog ? d3.scale.log() : d3.scale.linear();  // y-axis scale (logarithmic or linear)

  /**
   * Updates the histogram by recalculating scales, redrawing bars, and updating axes.
   */
  this.update = function() {
    yc.domain([ useLog ? 1 : 0, max ]);  // Set the domain of the y-axis
    yc.range([ yMap(0), yMap(1) ]);  // Set the range of the y-axis based on the current mapping
    var valueMap = {};
    var times = values.map(function(v) {
      valueMap[v[0]] = v[1];
      return v[0];
    });
    times.sort(d3.ascending);  // Sort times in ascending order
    var rects = g.selectAll("rect.hist").data(times, function(t) {
      return t;
    });
    rects.exit().remove();  // Remove old rectangles
    rects.enter().append("rect").classed("hist", true).attr({
      "stroke": "black",
      "stroke-width": 0.2
    }).append("title");  // Add new rectangles with a black stroke and a title element
    var smallestWidth = Number.POSITIVE_INFINITY;  // Track the smallest width for bars

    // Calculate the smallest width for the bars
    rects.each(function(t, ix) {
      if(ix + 1 < times.length) {
        var w = timeMap(times[ix + 1]) - timeMap(t);
        smallestWidth = Math.min(smallestWidth, w);
      }
    });

    // Set the attributes for the rectangles (bars)
    rects.attr({
      "x": function(t) {
        return timeMap(t);  // Set the x position based on the time mapping
      },
      "width": smallestWidth,  // Set the width based on the smallest calculated width
      "y": function(t) {
        if(useLog && valueMap[t] < 1) return yMap(0);  // Handle log scale for values < 1
        return yc(valueMap[t]);  // Set the y position based on the y-axis scale
      },
      "height": function(t) {
        if(useLog && valueMap[t] < 1) return 0;  // Handle log scale for values < 1
        return yMap(0) - yc(valueMap[t]);  // Set the height based on the y-axis scale
      },
      "fill": function(t) {
        var bucket = Math.max(Math.min(Math.floor(Math.log10(valueMap[t])), colors.length), 0);  // Determine the color bucket based on log scale
        return colors[bucket];  // Set the fill color based on the bucket
      }
    });

    // Set the title for each bar (tooltip)
    rects.selectAll("title").text(function(t) {
      return "$" + valueMap[t];
    });

    // Warn if the smallest width is zero
    smallestWidth > 0 || console.warn("smallest width is zero");

    // Update the left y-axis
    var yAxisLeft = d3.svg.axis();
    yAxisLeft.orient("right");
    yAxisLeft.scale(yc);
    useLog && yAxisLeft.ticks(1, 10);  // Set ticks for log scale
    yLabelsLeft.call(yAxisLeft);
    jkjs.util.toFront(yLabelsLeft, true);  // Bring the y-axis to the front

    // Update the right y-axis
    var yAxisRight = d3.svg.axis();
    yAxisRight.orient("left");
    yAxisRight.scale(yc);
    useLog && yAxisRight.ticks(1, 10);  // Set ticks for log scale
    yLabelsRight.call(yAxisRight);
    jkjs.util.toFront(yLabelsRight, true);  // Bring the y-axis to the front

    // Draw horizontal grid lines
    var horLines = [];
    if(useLog) {
      var l = 10;
      while(l < max) {
        horLines.push(l);
        l *= 10;
      }
    } else {
      yLabelsLeft.selectAll("g.tick").each(function(l) {
        horLines.push(l);
      });
    }
    var horSel = lineSel.selectAll("line.hor_line").data(horLines, function(l) { return l; });
    horSel.exit().remove();  // Remove old lines
    horSel.enter().append("line").classed("hor_line", true);  // Add new lines
    horSel.attr({
      "stroke": "lightgray",
      "x1": -0.25 * jkjs.util.BIG_NUMBER,
      "x2": 0.5 * jkjs.util.BIG_NUMBER,
      "y1": function(l) {
        return yc(l);  // Set the y position based on the y-axis scale
      },
      "y2": function(l) {
        return yc(l);  // Set the y position based on the y-axis scale
      }
    });

    // Set the opacity of the y-labels based on whether there are values to display
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

  /**
   * Updates the width of the right y-axis labels based on the new width of the SVG.
   */
  this.updateWidth = function(newWidth) {
    yLabelsRight.attr({
      "transform": "translate(" + newWidth + " 0)"
    });
  };

  /**
   * Returns the main group element for the histogram.
   */
  this.getG = function() {
    return g;
  };
}; // Histogram
/**
 * This package extends the zoomable user interface (ZUI) of D3.js with additional functionality.
 */
jkjs = window.jkjs || {}; // Initialize the namespace if it doesn't exist

// Main jkjs.zui function that acts as a constructor for the zoom interface
jkjs.zui = function() {
  var that = this;

  /**
   * Applies zoom and pan transformations to the target element for canvas-based zoom.
   * @param {Object} target - The D3 selection to apply the transformation to.
   * @param {Array} translate - The translation vector [x, y].
   * @param {Number} scale - The scaling factor.
   * @param {Number} w - The width of the view.
   * @param {Number} h - The height of the view.
   * @param {Object} canvasRect - The rectangle representing the canvas.
   * @param {Boolean} isSmooth - Flag to indicate if the transformation should be smooth.
   */
  this.applyCanvasZoom = function(target, translate, scale, w, h, canvasRect, isSmooth) {
    target.attr('transform', 'translate(' + translate + ') scale(' + scale + ')');
  };

  /**
   * Applies zoom and pan transformations to the target element, with a fixed vertical scale.
   * @param {Object} target - The D3 selection to apply the transformation to.
   * @param {Array} translate - The translation vector [x, y].
   * @param {Number} scaleH - The horizontal scaling factor.
   * @param {Number} w - The width of the view.
   * @param {Number} h - The height of the view.
   * @param {Object} canvasRect - The rectangle representing the canvas.
   * @param {Boolean} isSmooth - Flag to indicate if the transformation should be smooth.
   */
  this.applyFixedHeightZoom = function(target, translate, scaleH, w, h, canvasRect, isSmooth) {
    var scaleV = canvasRect.height > 0 ? h / canvasRect.height : 1;  // Compute vertical scale
    if(isNaN(scaleH)) {
      scaleH = 1;  // Default to no horizontal scaling if NaN
    }
    if(isNaN(scaleV)) {
      scaleV = 1;  // Default to no vertical scaling if NaN
    }
    if(isNaN(translate[0])) {
      translate[0] = 0;  // Default to no horizontal translation if NaN
    }
    target.attr('transform', 'translate(' + translate[0] + ' 0) scale(' + scaleH + ' ' + scaleV + ')');
  };

  /**
   * Computes the visible rectangle of the view based on the current translation and scale.
   * @param {Array} translate - The translation vector [x, y].
   * @param {Number} scale - The scaling factor.
   * @param {Number} w - The width of the view.
   * @param {Number} h - The height of the view.
   * @returns {Object} The visible rectangle {x, y, width, height}.
   */
  this.computeVisibleRect = function(translate, scale, w, h) {
    return {
      x: -translate[0] / scale,
      y: -translate[1] / scale,
      width: w / scale,
      height: h / scale
    };
  };

  // Default easing function for animations
  this.animationEase = "easeInOutCubic";

  // Default duration for animations in milliseconds
  this.animationDuration = 750;

  /**
   * Applies a smooth transition to a D3 selection if the 'smooth' flag is true.
   * @param {Object} sel - The D3 selection.
   * @param {Boolean} smooth - Flag to indicate if the transition should be smooth.
   * @returns {Object} The D3 selection, possibly with a transition applied.
   */
  this.asTransition = function(sel, smooth) {
    if(!smooth) return sel;
    return sel.transition().duration(that.animationDuration).ease(that.animationEase);
  };

  /**
   * Executes a callback function after the current transition is complete.
   * @param {Function} cb - The callback function to execute.
   * @param {Boolean} smooth - Flag to indicate if the transition should be smooth.
   */
  this.afterTransition = function(cb, smooth) {
    if(!smooth) {
      cb();
      return;
    }
    setTimeout(function() {
      cb();
    }, that.animationDuration); // Execute after the animation duration
  };

  // Default margin used in zoom calculations
  this.margin = 10;

  /**
   * Computes the scaling factor needed to fit or fill a given area.
   * @param {Number} pixWidth - The pixel width of the view.
   * @param {Number} pixHeight - The pixel height of the view.
   * @param {Number} w - The actual width of the content.
   * @param {Number} h - The actual height of the content.
   * @param {Boolean} fit - Flag to determine whether to fit (true) or fill (false) the area.
   * @returns {Number} The scaling factor.
   */
  function fitInto(pixWidth, pixHeight, w, h, fit) {
    var rw = pixWidth / w;
    var rh = pixHeight / h;
    return fit ? Math.min(rw, rh) : Math.max(rw, rh);
  }

  /**
   * Sets the offset vector for translation.
   * @param {Number} x - The x-offset.
   * @param {Number} y - The y-offset.
   * @param {Array} off - The offset vector to update.
   */
  function setOffset(x, y, off) {
    off[0] = x;
    off[1] = y;
  }

  /**
   * Computes the new zoom level and translation offset based on zooming to a point.
   * @param {Number} x - The x-coordinate to zoom to.
   * @param {Number} y - The y-coordinate to zoom to.
   * @param {Number} factor - The zoom factor.
   * @param {Number} zoom - The current zoom level.
   * @param {Array} off - The current offset vector [x, y].
   * @returns {Number} The new zoom level.
   */
  function zoomTo(x, y, factor, zoom, off) {
    var f = factor;
    var newZoom = zoom * factor;  // Calculate new zoom level
    newZoom <= 0 && console.warn("factor: " + factor + " zoom: " + newZoom);  // Warn if zoom level is non-positive
    setOffset((off[0] - x) * f + x, (off[1] - y) * f + y, off);  // Update the offset based on the zoom factor
    return newZoom;
  }

  /**
   * Creates a zoomable SVG element with the specified real and view sizes.
   * @param {Object} sel - The D3 selection to append the SVG to.
   * @param {Object} realSize - The real size of the content {width, height}.
   * @param {Object} viewSize - The size of the view {width, height}.
   * @param {Function} getCanvasRect - Function to get the canvas rectangle.
   * @param {Function} applyZoom - Function to apply zoom transformations.
   * @param {Array} extent - Optional array specifying the zoom extent [min, max].
   * @returns {Object} An object with methods to manipulate the zoom interface.
   */
  this.create = function(sel, realSize, viewSize, getCanvasRect, applyZoom, extent) {
    var canvasMargin = that.margin;  // Margin around the canvas
    var w, h, rw, rh;  // Dimensions for the view and real content
    var svg = sel.append("svg");  // Create the SVG element
    var zoom = null;  // D3 zoom behavior

    /**
     * Sets the size of the real content and view.
     * @param {Object} realSize - The real size of the content {width, height}.
     * @param {Object} viewSize - The size of the view {width, height}.
     */
    function setSize(realSize, viewSize) {
      w = viewSize.width;
      h = viewSize.height;
      rw = realSize.width;
      rh = realSize.height;
      svg.attr({
        "viewBox": "0 0 " + w + " " + h
      }).style({
        "width": rw,
        "height": rh,
        "padding": 0
      });
      // Propagate changes to the zoom behavior if already initialized
      if(zoom) {
        svg.on("mousemove.zoom")();
        setZoom(zoom.translate(), zoom.scale(), false);
      }
    }

    setSize(realSize, viewSize);  // Initialize the sizes
    zoom = d3.behavior.zoom();  // Enable zoom behavior
    var inner = svg.append("g");  // Create a group element for inner content

    /**
     * Adjusts the view to display a specific rectangle with optional fitting and smoothing.
     * @param {Object} rect - The rectangle to display {x, y, width, height}.
     * @param {Number} margin - The margin around the rectangle.
     * @param {Boolean} fit - Flag to indicate if the rectangle should be fit into the view.
     * @param {Boolean} smooth - Flag to indicate if the transition should be smooth.
     */
    function showRectangle(rect, margin, fit, smooth) {
      var screenW = w - 2 * margin;
      var screenH = h - 2 * margin;
      var factor = fitInto(screenW, screenH, rect.width, rect.height, fit);  // Compute scaling factor
      var zoom = 1;
      var off = [ margin + (screenW - rect.width) * 0.5 - rect.x, margin + (screenH - rect.height) * 0.5 - rect.y ];  // Compute offset
      zoom = zoomTo(screenW * 0.5 + margin, screenH * 0.5 + margin, factor, zoom, off);  // Update zoom level
      setZoom(off, zoom, smooth);  // Apply zoom
    }

    var prevTranslate = null;  // Store previous translation vector
    var prevScale = 0;  // Store previous scale factor

    /**
     * Applies the specified zoom and translation to the view.
     * @param {Array} translation - The translation vector [x, y].
     * @param {Number} scale - The scale factor.
     * @param {Boolean} smooth - Flag to indicate if the transition should be smooth.
     */
    function setZoom(translation, scale, smooth) {
      zoom.translate(translation);
      zoom.scale(scale);
      var target = that.asTransition(inner, smooth);  // Apply transition if smooth
      applyZoom(target, translation, scale, w, h, getCanvasRect(), smooth);  // Apply zoom
      prevTranslate = translation;  // Store current translation
      prevScale = scale;  // Store current scale
    }

    // Set zoom extent if provided
    var ext = extent || [ 1 / 6, 12 ];
    if(ext.length) {
      zoom.scaleExtent(ext);
    }

    var sidewaysScroll = false;  // Flag for sideways scrolling
    var onSidewayScroll = false;  // Flag to indicate if currently sideways scrolling
    var onNormalZoom = false;  // Flag to indicate if currently normal zooming

    // Event listener for zooming
    zoom.on("zoom", function() {
      var t = d3.event.translate;  // Get current translation
      var s = d3.event.scale;  // Get current scale
      var eve = d3.event.sourceEvent;  // Get the source event
      var initSidewayScroll = sidewaysScroll && prevTranslate && eve instanceof WheelEvent && eve.wheelDeltaX;  // Determine if sideways scroll
      if(onSidewayScroll || (!onNormalZoom && initSidewayScroll)) {
        t[0] = prevTranslate[0] + eve.wheelDeltaX;  // Adjust horizontal translation
        t[1] = prevTranslate[1];  // Keep vertical translation unchanged
        s = prevScale !== 0 ? prevScale : s;  // Keep scale unchanged if already set
        onSidewayScroll = true;
        setZoom(t, s, false);  // Apply zoom with updated translation
        return;
      }
      setZoom(t, s, false);  // Apply normal zoom
      onNormalZoom = true;
    });

    // Event listener for the end of a zoom gesture
    zoom.on("zoomend", function() {
      onSidewayScroll = false;
      onNormalZoom = false;
      // Simulate an empty mouse move to reset the internal state of the "zoom" event
      svg.on("mousemove.zoom")();
    });

    svg.call(zoom);  // Attach zoom behavior to the SVG element

    /**
     * Adjusts the view to display the entire canvas.
     * @param {Boolean} smooth - Flag to indicate if the transition should be smooth.
     */
    function showAll(smooth) {
      if (!getCanvasRect)
        return;
      var rect = getCanvasRect();
      var margin = canvasMargin * 4; // Increased margin for better visibility
      showRectangle({
        x: rect.x - margin,
        y: rect.y - margin,
        width: rect.width + 2 * margin,
        height: rect.height + 2 * margin
      }, canvasMargin, true, smooth);
    }

    // Double-click to show the entire canvas
    svg.on("dblclick.zoom", function() {
      showAll(true);
    });

    // Return an object with methods to manipulate the zoom interface
    return {
      sidewaysScroll: function(set) {
        if(!arguments.length) return sidewaysScroll;
        sidewaysScroll = !!set;  // Toggle sideways scrolling
      },
      move: function(dx, dy, smooth) {
        var t = zoom.translate();
        t[0] += dx;  // Move horizontally
        t[1] += dy;  // Move vertically
        setZoom(t, zoom.scale(), smooth);  // Apply updated zoom
      },
      getScale: function() {
        return zoom.scale();  // Get the current scale factor
      },
      zoomTo: function(x, y, factor, smooth) {
        var off = zoom.translate();
        var s = zoom.scale();
        s = zoomTo(x, y, factor, s, off);  // Calculate new zoom level
        setZoom(off, s, smooth);  // Apply zoom
      },
      showRectangle: showRectangle,
      setZoom: setZoom,
      showAll: showAll,
      inner: inner,
      svg: svg,
      setSize: setSize,
      getVisibleRect: function() {
        return that.computeVisibleRect(zoom.translate(), zoom.scale(), w, h);  // Compute the visible rectangle
      }
    };
  }
}; // jkjs.zui

// Create a singleton instance of jkjs.zui
jkjs.zui = new jkjs.zui();
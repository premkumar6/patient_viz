function Overview(sel, handler) {
  var that = this;
  // Set a maximum height for the overview element
  var maxHeight = 100;
  // Get the initial width from the handler's size
  var initW = handler.getSize().width;
  var svg = sel.append("svg").style({
    "width": initW + "px"
  });
  // Set up a double-click event on the SVG to show the full view
  svg.on("dblclick", function() {
    var zui = handler.getZUI();
    zui.showAll(true); // Get the ZUI for interaction
  });
   // Create a drag behavior for the SVG 
  var drag = d3.behavior.drag().on("drag", function() {
    var box = handler.getBox();
    if(!box) return;
    var size = handler.getSize();
    var zui = handler.getZUI();
    // Calculate the scale based on the current zoom level and the box size
    var scale = zui.getScale() / that.getScaleFor(size.width, box);
    // Calculate the translation values based on drag events
    var dx = -d3.event.dx * scale;
    var dy = -d3.event.dy * scale;

    // Move the view by the calculated translation values without smoothing
    zui.move(dx, dy, false);
  });
  svg.call(drag);
  this.getSVG = function() {
    return svg;
  };
   // Append a rectangle to the SVG to represent the shadow of the main view
  var shadowRect = svg.append("rect").attr({
    "x": 0,
    "y": 0,
    "width": initW,
    "stroke": "black",
    "stroke-width": 1,
    "fill": "none"
  });
  var camRect = null;
  var shadow = null;

  this.clearShadow = function() {
    if(shadow) {
      shadow.remove();
      shadow = null;
    }
  };
  // Method to update the shadow and camera rectangle based on the box update
  this.onBoxUpdate = function() {
    var box = handler.getBox();
    if(!box) return;
    if(!shadow) {
      shadow = svg.append("use").attr({
        "xlink:href": "#mainG"
      });
    } // If the camera rectangle doesn't exist, create it
    if(!camRect) {
      camRect = svg.append("rect").attr({
        "stroke": "black",
        "stroke-width": 2,
        "fill": "none"
      });
    }
    var size = handler.getSize();
    var ss = that.getScaleFor(size.width, box);
    var sh = box.height * ss;
    shadow.attr({
      "transform": "scale(" + ss + ")"
    });
    svg.style({
      "height": sh + "px"
    });
    shadowRect.attr({
      "height": sh
    });
  };
  // Method to update the SVG and shadow rectangle when the container size changes
  this.onSizeUpdate = function() {
    var size = handler.getSize();
    svg.style({
      "width": size.width + "px"
    });
    shadowRect.attr({
      "width": size.width
    });
  };
  // Method to calculate the scale factor based on the container width and bounding box
  this.getScaleFor = function(width, box) {
    var ss = width / box.width;
    var sh = Math.min(box.height * ss, maxHeight);
    return sh / Math.max(box.height, 1);
  };
  // Method to calculate the scale factor based on the container width and bounding box
  this.getHeightForWidth = function(width) {
    var box = handler.getBox();
    if(!box) return width;
    return Math.ceil(box.height * that.getScaleFor(width, box));
  };

  // Method to update the camera rectangle based on the visible portion of the view
  this.updateCameraRect = function(canvasRect, visRect, smooth) {
    if(!camRect) return;
    var size = handler.getSize();
    var ss = that.getScaleFor(size.width, canvasRect);
    var tgt = jkjs.zui.asTransition(camRect, smooth);
    tgt.attr({
      "x": visRect.x * ss,
      "y": visRect.y * ss,
      "width": visRect.width * ss,
      "height": visRect.height * ss
    });
  }

} 

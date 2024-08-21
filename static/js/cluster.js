// This class is used to cluster types of events based on a distance metric

function EventClusterer() {
  var that = this;
  // Default distance (hamming) function to measure similarity between two vectors 
  var distance = function(vecA, vecB) {
    return jkjs.stat.edit_distances.hamming(vecA, vecB);
  };
  
  // Threshold for determining whether two types are similar enough to be clustered together
  var threshold = 5;

  // Minimum number of neighbors (types) required to form a cluster
  var minCluster = 3;

  // Array to store the types of clusters computed
  var clusterTypes = [];

  // Getter and setter for the distance function
  // If no argument is passed, it returns the current distance function
  // If an argument is passed, it sets a new distance function and clears existing clusters
  this.distance = function(_) {
    if(!arguments.length) return distance;
    distance = _;
    clusterTypes = [];
    return that;
  };
  // Getter and setter for the threshold value
  this.threshold = function(_) {
    if(!arguments.length) return threshold;
    threshold = _;
    clusterTypes = [];
    return that;
  };
  // Getter and setter for the minimum cluster size
  this.minCluster = function(_) {
    if(!arguments.length) return minCluster;
    minCluster = _;
    clusterTypes = [];
    return that;
  };
  // Function to compute clusters of types (rows) based on the distance function, threshold, and minCluster
  function computeRowClusters(pool, distance, threshold, minCluster) {
    // init types
    console.log("init");
    var types = [];
    pool.traverseTypes(function(gid, tid, type) {
      if(type.hasEvents()) {
        types.push({
          type: type,
          vec: pool.toBitVector(type),  // Convert type to a bit vector representation
          neighbors: [], // Neighbors will hold types that are close in distance
          cluster: type,  // Initially, each type is its own cluster
          visited: false // Visited flag for DBSCAN algorithm
        });
      }
    });
    // Compute distances between all pairs of types and identify neighbors based on the threshold
    console.log("distances");
    var total = (types.length * types.length - types.length) * 0.5;
    var count = 0;
    var lastTime = new Date().getTime();
    for(var ix = 0;ix < types.length;ix += 1) {
      var objA = types[ix];
      var vecA = objA.vec;
      var curTime = new Date().getTime();
      if(curTime - lastTime > 1000) {
        console.log((count / total) * 100 + "%");
        lastTime = curTime;
      }
      for(var k = ix + 1;k < types.length;k += 1) {
        var objB = types[k];
        var vecB = objB.vec;
        var dist = distance(vecA, vecB); // Calculate distance between vecA and vecB
        if(dist < threshold) { // If distance is below threshold, they are neighbors
          objA.neighbors.push(objB);
          objB.neighbors.push(objA);
        }
        count += 1;
      }
    }
    // dbscan
    // Function to expand a cluster by visiting all its neighboring types.
    console.log("dbscan");
    function expandCluster(obj, cluster) {
      obj.cluster = cluster; // Assign the cluster to the current type
      var list = [ obj.neighbors ]; // Start with the current type's neighbors
      while(list.length) {
        list.shift().forEach(function(p) {
          if(!p.visited) {
            p.visited = true;
            if(p.neighbors.length >= minCluster) { // If enough neighbors, continue expanding
              list.push(p.neighbors);
            }
          }
          if(p.cluster === p.type) {  // If the type is not yet part of any other cluster
            p.cluster = cluster;
          }
        });
      }
    }
    // Main scanning function to start clustering.
    function scan() {
      types.forEach(function(obj) {
        if(obj.visited) { // Skip already visited types.
          return;
        }
        obj.visited = true;
        if(obj.neighbors.length >= minCluster) {  // If the type has enough neighbors, expand the cluster.
          expandCluster(obj, obj.cluster);
        }
      });
    }

    scan();
    return types;
  }

  // Method to compute clusters based on the current settings
  this.compute = function(pool) {
    clusterTypes = computeRowClusters(pool, distance, threshold, minCluster);
    return that;
  };

   // Method to assign proxy types after clusters have been computed.
  function assignProxies(clusterTypes) {
    // assign proxies
    console.log("assign proxies");
    pool.startBulkValidity();
    clusterTypes.forEach(function(obj) {
      obj.type.proxyType(obj.cluster);
    });
    pool.endBulkValidity();
  }

  this.assignProxies = function() {
    assignProxies(clusterTypes);
    return that;
  };
  // Method to return the types and their assigned clusters
  this.clusterTypes = function() {
    return clusterTypes.map(function(type) {
      return {
        type: type["type"],
        cluster: type["cluster"]
      };
    });
  };
} // EventClusterer

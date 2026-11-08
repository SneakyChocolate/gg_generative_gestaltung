let myModel;
let originalVertices = [];
let version = 0; // Track geometry updates for the GPU cache

async function setup() {
  createCanvas(600, 600, WEBGL);
  
  // Load the model
  myModel = await loadModel('assets/scene.obj', true);
  
  // Save a copy of every original vertex position
  for (let i = 0; i < myModel.vertices.length; i++) {
    originalVertices.push(myModel.vertices[i].copy());
  }
}

function draw() {
  background(30);
  orbitControl(); // Rotate and zoom with the mouse
  
  lights();
  noStroke();
  fill(100, 180, 255);

  // Animate the vertices every frame
  if (myModel && originalVertices.length > 0) {
    for (let i = 0; i < myModel.vertices.length; i++) {
      let v = myModel.vertices[i];
      let orig = originalVertices[i];
      
      // Create a wave effect using sine and vertex position
      let wave = sin(frameCount * 0.05 + orig.x * 0.05);
      v.y = orig.y + wave * 15; 
    }
    
    // Recalculate lighting normals for the deformed shape
    myModel.computeNormals();
    
    // CRITICAL: Invalidate the cache so p5.js re-renders the new vertex positions
    myModel.gid = `scene-version-${version++}`;
  }

  scale(2); // Scale up if the model looks small
  model(myModel);
}

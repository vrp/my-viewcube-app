import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.dynamicDampingFactor = 0.3;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let model;
let lastHoveredFaceIndex = null;

// Camera animation state
let isAnimating = false;
let animationStart = 0;
const animationDuration = 600; // milliseconds
let startPosition = new THREE.Vector3();
let startQuaternion = new THREE.Quaternion();
let targetPosition = new THREE.Vector3();
let targetQuaternion = new THREE.Quaternion();

// Event tracking state
let lastZoomDistance = null;
let zoomStartDistance = null;
let zoomTimeout = null;

let lastPanTarget = null;
let panStart = null;
let panTimeout = null;

let orientationStart = null;
let orientationActive = false;
let orientationCause = null;

// LOG function - define early so it's available everywhere
function logEvent(message) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  console.log(`[${hh}:${mm}:${ss}:${ms}] ${message}`);
}

function quaternionToString(q) {
  return `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)})`;
}

// Map mesh names to material indices for the beveled cube GLB model
function getMaterialIndexFromMesh(meshName) {
  // Main faces: Cube001 = 0, Cube001_1 = 1, ..., Cube001_5 = 5
  if (meshName === 'Cube001') return 0;
  if (meshName.startsWith('Cube001_')) {
    const suffix = parseInt(meshName.replace('Cube001_', ''));
    if (suffix >= 1 && suffix <= 5) return suffix; // Main faces 1-5
    if (suffix >= 6 && suffix <= 17) return suffix; // Edge chamfers 6-17
    if (suffix >= 18 && suffix <= 25) return suffix; // Corner chamfers 18-25
  }
  return -1; // Unknown mesh
}

// Get material index from intersection (handles both old and new model structures)
function getMaterialIndexFromIntersection(intersect) {
  // Use mesh name mapping for both models since the new model still has separate meshes
  return getMaterialIndexFromMesh(intersect.object.name);
}

// Get material name and color info from material index
function getMaterialInfo(materialIndex) {
  const materialMapping = {
    0: { name: 'Red', color: 'MainFace_0' },
    1: { name: 'Green', color: 'MainFace_1' },
    2: { name: 'Blue', color: 'MainFace_2' },
    3: { name: 'Yellow', color: 'MainFace_3' },
    4: { name: 'Magenta', color: 'MainFace_4' },
    5: { name: 'Cyan', color: 'MainFace_5' },
    6: { name: 'EdgeChamfer_0', color: 'Orange' },
    7: { name: 'EdgeChamfer_1', color: 'Orange' },
    8: { name: 'EdgeChamfer_2', color: 'Orange' },
    9: { name: 'EdgeChamfer_3', color: 'Orange' },
    10: { name: 'EdgeChamfer_4', color: 'Orange' },
    11: { name: 'EdgeChamfer_5', color: 'Orange' },
    12: { name: 'EdgeChamfer_6', color: 'Orange' },
    13: { name: 'EdgeChamfer_7', color: 'Orange' },
    14: { name: 'EdgeChamfer_8', color: 'Orange' },
    15: { name: 'EdgeChamfer_9', color: 'Orange' },
    16: { name: 'EdgeChamfer_10', color: 'Orange' },
    17: { name: 'EdgeChamfer_11', color: 'Orange' },
    18: { name: 'CornerChamfer_0', color: 'Purple' },
    19: { name: 'CornerChamfer_1', color: 'Purple' },
    20: { name: 'CornerChamfer_2', color: 'Purple' },
    21: { name: 'CornerChamfer_3', color: 'Purple' },
    22: { name: 'CornerChamfer_4', color: 'Purple' },
    23: { name: 'CornerChamfer_5', color: 'Purple' },
    24: { name: 'CornerChamfer_6', color: 'Purple' },
    25: { name: 'CornerChamfer_7', color: 'Purple' }
  };
  return materialMapping[materialIndex] || { name: 'Unknown', color: 'Unknown' };
}


const loader = new GLTFLoader();
loader.load('./chamfered_cube.glb', function (gltf) {
  model = gltf.scene;
  scene.add(model);
  logEvent(`GLB model loaded with ${gltf.scene.children.length} meshes`);
}, undefined, function (error) {
  logEvent(`Error loading GLB: ${error}`);
});

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
light.position.set(0, 20, 0);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff);
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

// TIMER
const timerDiv = document.createElement('div');
timerDiv.style.position = 'absolute';
timerDiv.style.top = '10px';
timerDiv.style.left = '10px';
timerDiv.style.color = '#000';
timerDiv.style.fontFamily = 'monospace';
timerDiv.style.fontSize = '16px';
document.body.appendChild(timerDiv);

// FACE INFO DISPLAY
const faceInfoDiv = document.createElement('div');
faceInfoDiv.style.position = 'absolute';
faceInfoDiv.style.top = '40px';
faceInfoDiv.style.left = '10px';
faceInfoDiv.style.color = '#000';
faceInfoDiv.style.fontFamily = 'monospace';
faceInfoDiv.style.fontSize = '16px';
faceInfoDiv.style.fontWeight = 'bold';
document.body.appendChild(faceInfoDiv);

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  timerDiv.textContent = `${hh}:${mm}:${ss}:${ms}`;
  requestAnimationFrame(updateClock);
}
updateClock();

function updateFaceInfo() {
  if (!model) return;
  
  // Get camera's up direction in world space
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  
  // Define face normals for the 6 main faces (using corrected material indices)
  const faces = [
    { index: 0, normal: new THREE.Vector3(1, 0, 0), name: 'Red' },
    { index: 1, normal: new THREE.Vector3(-1, 0, 0), name: 'Green' },
    { index: 2, normal: new THREE.Vector3(0, 0, 1), name: 'Blue' },
    { index: 3, normal: new THREE.Vector3(0, 0, -1), name: 'Yellow' },
    { index: 4, normal: new THREE.Vector3(0, 1, 0), name: 'Magenta' },
    { index: 5, normal: new THREE.Vector3(0, -1, 0), name: 'Cyan' }
  ];
  
  // Find which face normal is most aligned with camera up
  let bestFace = null;
  let bestDot = -1;
  
  for (const face of faces) {
    const dot = cameraUp.dot(face.normal);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }
  
  if (bestFace) {
    faceInfoDiv.textContent = `Up Face: ${bestFace.index} - ${bestFace.name}`;
  }
}

// Initialize tracking variables
lastZoomDistance = camera.position.distanceTo(controls.target);
lastPanTarget = controls.target.clone();

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('click', onMouseClick, false);

// Zoom tracking
renderer.domElement.addEventListener('wheel', () => {
  if (!zoomTimeout) zoomStartDistance = lastZoomDistance;
  clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(() => {
    const newZoom = camera.position.distanceTo(controls.target);
    if (Math.abs(newZoom - zoomStartDistance) > 0.001) {
      logEvent(`Zoom changed | From: ${zoomStartDistance.toFixed(2)} | To: ${newZoom.toFixed(2)}`);
    }
    lastZoomDistance = newZoom;
    zoomTimeout = null;
  }, 200);
});

// Pan and zoom tracking on controls change
controls.addEventListener('change', () => {
  // ZOOM (touch pinch or programmatic)
  const newZoom = camera.position.distanceTo(controls.target);
  if (Math.abs(newZoom - lastZoomDistance) > 0.001) {
    if (!zoomTimeout) zoomStartDistance = lastZoomDistance;
    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
      const finalZoom = camera.position.distanceTo(controls.target);
      if (Math.abs(finalZoom - zoomStartDistance) > 0.001) {
        logEvent(`Zoom changed | From: ${zoomStartDistance.toFixed(2)} | To: ${finalZoom.toFixed(2)}`);
      }
      lastZoomDistance = finalZoom;
      zoomTimeout = null;
    }, 200);
  }
  
  // PAN
  if (!controls.target.equals(lastPanTarget)) {
    if (!panTimeout) panStart = lastPanTarget.clone();
    clearTimeout(panTimeout);
    panTimeout = setTimeout(() => {
      logEvent(`Pan changed | From: (${panStart.x.toFixed(2)}, ${panStart.y.toFixed(2)}, ${panStart.z.toFixed(2)}) | To: (${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)})`);
      lastPanTarget.copy(controls.target);
      panTimeout = null;
    }, 200);
  }
});

// Orientation tracking
renderer.domElement.addEventListener('pointerdown', (event) => {
  // Skip if clicking on ViewCube area  
  const size = 100;
  const margin = 10;
  const inCube = event.clientX > window.innerWidth - size - margin && event.clientY < size + margin;
  
  if (!inCube && !orientationActive) {
    orientationStart = camera.quaternion.clone();
    orientationActive = true;
    orientationCause = 'mouse drag';
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  if (orientationActive) {
    const orientationEnd = camera.quaternion.clone();
    if (!orientationStart.equals(orientationEnd)) {
      logEvent(`Orientation changed | From: ${quaternionToString(orientationStart)} | To: ${quaternionToString(orientationEnd)} | Source: ${orientationCause || 'unknown'}`);
    }
    orientationActive = false;
    orientationCause = null;
  }
});

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseClick() {
  if (!model) return;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(model, true);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const faceIndex = intersect.faceIndex;
    const meshName = intersect.object.name;
    const materialIndex = getMaterialIndexFromIntersection(intersect);
    const materialInfo = getMaterialInfo(materialIndex);
    
    logEvent(`Clicked face index: ${faceIndex}, Material index: ${materialIndex} (${materialInfo.name}), Mesh: ${meshName}`);

    const oldQuat = camera.quaternion.clone();
    
    // Get proper camera position and orientation based on material index
    const distance = 5;
    let targetPosition = new THREE.Vector3();
    let targetUp = new THREE.Vector3(0, 1, 0);
    
    // Check if this is a main face (0-5), edge chamfer (6-17), or corner chamfer (18-25)
    const isMainFace = materialIndex >= 0 && materialIndex <= 5;
    
    if (isMainFace) {
      // For main faces, define target positions and check if already oriented correctly
      let shouldReorient = false;
      
      switch (materialIndex) {
        case 0: // Red - Right face (+X)
          targetPosition.set(distance, 0, 0);
          targetUp.set(0, 1, 0);
          // Check if camera is already positioned correctly for this face
          shouldReorient = Math.abs(camera.position.x - distance) > 0.1 || 
                          Math.abs(camera.position.y) > 0.1 || 
                          Math.abs(camera.position.z) > 0.1;
          break;
        case 1: // Green - Left face (-X)
          targetPosition.set(-distance, 0, 0);
          targetUp.set(0, 1, 0);
          shouldReorient = Math.abs(camera.position.x + distance) > 0.1 || 
                          Math.abs(camera.position.y) > 0.1 || 
                          Math.abs(camera.position.z) > 0.1;
          break;
        case 2: // Blue - Back face (-Z)
          targetPosition.set(0, 0, -distance);
          targetUp.set(0, 1, 0);
          shouldReorient = Math.abs(camera.position.x) > 0.1 || 
                          Math.abs(camera.position.y) > 0.1 || 
                          Math.abs(camera.position.z + distance) > 0.1;
          break;
        case 3: // Yellow - Front face (+Z)
          targetPosition.set(0, 0, distance);
          targetUp.set(0, 1, 0);
          shouldReorient = Math.abs(camera.position.x) > 0.1 || 
                          Math.abs(camera.position.y) > 0.1 || 
                          Math.abs(camera.position.z - distance) > 0.1;
          break;
        case 4: // Magenta - Top face (+Y)
          targetPosition.set(0, distance, 0);
          targetUp.set(0, 0, -1);
          shouldReorient = Math.abs(camera.position.x) > 0.1 || 
                          Math.abs(camera.position.y - distance) > 0.1 || 
                          Math.abs(camera.position.z) > 0.1;
          break;
        case 5: // Cyan - Bottom face (-Y)
          targetPosition.set(0, -distance, 0);
          targetUp.set(0, 0, 1);
          shouldReorient = Math.abs(camera.position.x) > 0.1 || 
                          Math.abs(camera.position.y + distance) > 0.1 || 
                          Math.abs(camera.position.z) > 0.1;
          break;
      }
      
      // Only apply changes if camera needs to be reoriented
      if (!shouldReorient) {
        logEvent(`Face ${materialIndex} (${materialInfo.name}) already correctly oriented - no change needed`);
        return; // Skip camera changes
      }
    } else {
      // For edges and corners, use the face normal from the intersected geometry
      const clickedNormal = intersect.face.normal.clone().transformDirection(intersect.object.matrixWorld);
      targetPosition.copy(clickedNormal.multiplyScalar(distance));
      
      // For non-main faces, use smart up vector calculation
      const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const projectedUp = currentUp.clone();
      projectedUp.sub(clickedNormal.clone().multiplyScalar(currentUp.dot(clickedNormal)));
      
      if (projectedUp.length() > 0.1) {
        targetUp.copy(projectedUp.normalize());
      } else {
        targetUp.set(0, 1, 0);
      }
    }
    
    // Apply the calculated position and orientation
    camera.position.copy(targetPosition);
    camera.up.copy(targetUp);
    
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.updateMatrixWorld();
    controls.update();
    updateFaceInfo();
    
    const newQuat = camera.quaternion.clone();
    logEvent(`Orientation changed | From: ${quaternionToString(oldQuat)} | To: ${quaternionToString(newQuat)} | Source: view cube`);
  }
}

function animate() {
  requestAnimationFrame(animate);

  raycaster.setFromCamera(mouse, camera);
  if (model) {
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const meshName = intersect.object.name;
      const materialIndex = getMaterialIndexFromIntersection(intersect);
      const materialInfo = getMaterialInfo(materialIndex);
      
      // Use material index for hover detection instead of face index
      if (materialIndex !== lastHoveredFaceIndex) {
        logEvent(`Hovered material index: ${materialIndex} (${materialInfo.name}), Mesh: ${meshName}`);
        lastHoveredFaceIndex = materialIndex;
      }
    } else {
      lastHoveredFaceIndex = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// Initial face info update
setTimeout(() => updateFaceInfo(), 100);

animate();

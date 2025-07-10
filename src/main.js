import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';

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
let clickInProgress = false;
let clickCameraSnapshot = null; // Camera state when click started

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

// Click debugging state
let clickStartTime = null;
let clickStartEvent = null;
let clickSequenceId = 0;

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
    0: { name: 'Red (Right Face)', color: 'MainFace_0' },
    1: { name: 'Green (Left Face)', color: 'MainFace_1' },
    2: { name: 'Blue (Back Face)', color: 'MainFace_2' },
    3: { name: 'Yellow (Front Face)', color: 'MainFace_3' },
    4: { name: 'Magenta (Top Face)', color: 'MainFace_4' },
    5: { name: 'Cyan (Bottom Face)', color: 'MainFace_5' },
    6: { name: 'Edge 0', color: 'Orange' },
    7: { name: 'Edge 1', color: 'Orange' },
    8: { name: 'Edge 2', color: 'Orange' },
    9: { name: 'Edge 3', color: 'Orange' },
    10: { name: 'Edge 4', color: 'Orange' },
    11: { name: 'Edge 5', color: 'Orange' },
    12: { name: 'Edge 6', color: 'Orange' },
    13: { name: 'Edge 7', color: 'Orange' },
    14: { name: 'Edge 8', color: 'Orange' },
    15: { name: 'Edge 9', color: 'Orange' },
    16: { name: 'Edge 10', color: 'Orange' },
    17: { name: 'Edge 11', color: 'Orange' },
    18: { name: 'Corner 0', color: 'Purple' },
    19: { name: 'Corner 1', color: 'Purple' },
    20: { name: 'Corner 2', color: 'Purple' },
    21: { name: 'Corner 3', color: 'Purple' },
    22: { name: 'Corner 4', color: 'Purple' },
    23: { name: 'Corner 5', color: 'Purple' },
    24: { name: 'Corner 6', color: 'Purple' },
    25: { name: 'Corner 7', color: 'Purple' }
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

// Create debug panel
function createDebugPanel() {
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.position = 'fixed';
  panel.style.left = '10px';
  panel.style.top = '50px'; // Moved down to clear timer
  panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  panel.style.borderRadius = '8px';
  panel.style.color = 'white';
  panel.style.fontSize = '14px';
  panel.style.maxHeight = 'calc(90vh - 50px)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.zIndex = '1000';
  
  // Create sticky header with Go button
  const header = document.createElement('div');
  header.style.padding = '15px';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
  header.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  header.style.borderRadius = '8px 8px 0 0';
  
  const goButton = document.createElement('button');
  goButton.textContent = 'Go';
  goButton.style.width = '100%';
  goButton.style.padding = '8px 16px';
  goButton.style.fontSize = '16px';
  goButton.style.fontWeight = 'bold';
  
  header.appendChild(goButton);
  
  // Create scrollable options container
  const scrollContainer = document.createElement('div');
  scrollContainer.style.overflowY = 'auto';
  scrollContainer.style.padding = '15px';
  scrollContainer.style.flex = '1';
  
  const optionsContainer = document.createElement('div');
  optionsContainer.style.display = 'flex';
  optionsContainer.style.flexDirection = 'column';
  optionsContainer.style.gap = '5px';
  
  // Create radio options for all 26 materials
  for (let i = 0; i < 26; i++) {
    const option = document.createElement('label');
    option.style.display = 'flex';
    option.style.alignItems = 'center';
    option.style.cursor = 'pointer';
    option.style.padding = '4px';
    option.style.borderRadius = '4px';
    option.style.transition = 'background-color 0.2s';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'debug-material';
    radio.value = i;
    radio.style.marginRight = '8px';
    
    // Select first option by default
    if (i === 0) radio.checked = true;
    
    const materialInfo = getMaterialInfo(i);
    const textContainer = document.createElement('div');
    textContainer.style.flex = '1';
    
    const mainText = document.createElement('div');
    mainText.textContent = `${i} - ${materialInfo.name}`;
    
    const subText = document.createElement('div');
    subText.style.fontSize = '11px';
    subText.style.color = 'rgba(255, 255, 255, 0.5)';
    subText.style.marginTop = '2px';
    
    // Get mesh name for this material index
    let meshName = '';
    if (i === 0) meshName = 'Cube001';
    else if (i >= 1 && i <= 25) meshName = `Cube001_${i}`;
    
    subText.textContent = `Material: ${i}, Mesh: ${meshName}`;
    
    textContainer.appendChild(mainText);
    textContainer.appendChild(subText);
    
    option.appendChild(radio);
    option.appendChild(textContainer);
    
    // Hover effect
    option.addEventListener('mouseenter', () => {
      option.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    option.addEventListener('mouseleave', () => {
      option.style.backgroundColor = 'transparent';
    });
    
    optionsContainer.appendChild(option);
  }
  
  scrollContainer.appendChild(optionsContainer);
  panel.appendChild(header);
  panel.appendChild(scrollContainer);
  document.body.appendChild(panel);
  
  // Add Go button click handler
  goButton.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="debug-material"]:checked');
    if (selectedRadio) {
      const materialIndex = parseInt(selectedRadio.value);
      logEvent(`Debug panel: Triggering camera position for material ${materialIndex} (${getMaterialInfo(materialIndex).name})`);
      setCameraForMaterial(materialIndex, 'debug panel');
    }
  });
}

// Create the debug panel
createDebugPanel();

// Camera position lookup table for all 26 features
const CAMERA_POSITIONS = {
  // Main faces (0-5) - Orthographic views
  0: { position: [5, 0, 0], up: [0, 1, 0], description: 'Red (Right Face)' },
  1: { position: [-5, 0, 0], up: [0, 1, 0], description: 'Green (Left Face)' },
  2: { position: [0, 0, -5], up: [0, 1, 0], description: 'Blue (Back Face)' },
  3: { position: [0, 0, 5], up: [0, 1, 0], description: 'Yellow (Front Face)' },
  4: { position: [0, 5, 0], up: [0, 0, -1], description: 'Magenta (Top Face)' },
  5: { position: [0, -5, 0], up: [0, 0, 1], description: 'Cyan (Bottom Face)' },
  
  // Edges (6-17) - Isometric views showing 2 adjacent faces
  6: { position: [3.5, 3.5, 0], up: [0, 0, -1], description: 'Edge 0 (Right-Top)' },
  7: { position: [-3.5, 3.5, 0], up: [0, 0, -1], description: 'Edge 1 (Left-Top)' },
  8: { position: [-3.5, -3.5, 0], up: [0, 0, 1], description: 'Edge 2 (Left-Bottom)' },
  9: { position: [3.5, -3.5, 0], up: [0, 0, 1], description: 'Edge 3 (Right-Bottom)' },
  10: { position: [0, 3.5, -3.5], up: [0, 0, -1], description: 'Edge 4 (Back-Top)' },
  11: { position: [0, -3.5, -3.5], up: [0, 0, 1], description: 'Edge 5 (Back-Bottom)' },
  12: { position: [3.5, 0, -3.5], up: [0, 1, 0], description: 'Edge 6 (Right-Back)' },
  13: { position: [-3.5, 0, -3.5], up: [0, 1, 0], description: 'Edge 7 (Left-Back)' },
  14: { position: [3.5, 0, 3.5], up: [0, 1, 0], description: 'Edge 8 (Right-Front)' },
  15: { position: [-3.5, 0, 3.5], up: [0, 1, 0], description: 'Edge 9 (Left-Front)' },
  16: { position: [0, 3.5, 3.5], up: [0, 0, -1], description: 'Edge 10 (Front-Top)' },
  17: { position: [0, -3.5, 3.5], up: [0, 0, 1], description: 'Edge 11 (Front-Bottom)' },
  
  // Corners (18-25) - Isometric views showing 3 adjacent faces
  18: { position: [2.9, 2.9, -2.9], up: [0, 0, -1], description: 'Corner 0 (Right-Top-Back)' },
  19: { position: [-2.9, 2.9, -2.9], up: [0, 0, -1], description: 'Corner 1 (Left-Top-Back)' },
  20: { position: [-2.9, -2.9, -2.9], up: [0, 0, 1], description: 'Corner 2 (Left-Bottom-Back)' },
  21: { position: [2.9, -2.9, -2.9], up: [0, 0, 1], description: 'Corner 3 (Right-Bottom-Back)' },
  22: { position: [2.9, 2.9, 2.9], up: [0, 0, -1], description: 'Corner 4 (Right-Top-Front)' },
  23: { position: [-2.9, 2.9, 2.9], up: [0, 0, -1], description: 'Corner 5 (Left-Top-Front)' },
  24: { position: [-2.9, -2.9, 2.9], up: [0, 0, 1], description: 'Corner 6 (Left-Bottom-Front)' },
  25: { position: [2.9, -2.9, 2.9], up: [0, 0, 1], description: 'Corner 7 (Right-Bottom-Front)' }
};

// Function to check if camera is already correctly positioned for a feature
function isCameraCorrectlyOriented(materialIndex, tolerance = 0.1) {
  const config = CAMERA_POSITIONS[materialIndex];
  if (!config) return false;
  
  const [x, y, z] = config.position;
  return Math.abs(camera.position.x - x) <= tolerance &&
         Math.abs(camera.position.y - y) <= tolerance &&
         Math.abs(camera.position.z - z) <= tolerance;
}

// Function to set camera position for a given material index
function setCameraForMaterial(materialIndex, source = 'direct') {
  const materialInfo = getMaterialInfo(materialIndex);
  const config = CAMERA_POSITIONS[materialIndex];
  
  if (!config) {
    logEvent(`No camera position defined for material index ${materialIndex}`);
    return;
  }
  
  // Check if camera is already correctly oriented
  if (isCameraCorrectlyOriented(materialIndex)) {
    logEvent(`Feature ${materialIndex} (${materialInfo.name}) already correctly oriented - no change needed`);
    return;
  }
  
  const oldQuat = camera.quaternion.clone();
  
  // Apply the predefined position and orientation
  const [x, y, z] = config.position;
  const [ux, uy, uz] = config.up;
  
  camera.position.set(x, y, z);
  camera.up.set(ux, uy, uz);
  
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  camera.updateMatrixWorld();
  controls.update();
  // updateFaceInfo() - removed
  
  const newQuat = camera.quaternion.clone();
  logEvent(`Orientation changed | From: ${quaternionToString(oldQuat)} | To: ${quaternionToString(newQuat)} | Source: ${source}`);
}

const directionalLight = new THREE.DirectionalLight(0xffffff);
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

// TIMER
const timerDiv = document.createElement('div');
timerDiv.style.position = 'absolute';
timerDiv.style.top = '10px';
timerDiv.style.right = '10px';
timerDiv.style.color = '#000';
timerDiv.style.fontFamily = 'monospace';
timerDiv.style.fontSize = '16px';
document.body.appendChild(timerDiv);

// FACE INFO DISPLAY - removed

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

// updateFaceInfo function removed

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

// Enhanced click debugging functions
function get3DIntersectionInfo(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const tempRaycaster = new THREE.Raycaster();
  tempRaycaster.setFromCamera({ x, y }, camera);
  
  const info = {
    screenCoords: { x: event.clientX, y: event.clientY },
    normalizedCoords: { x: x.toFixed(3), y: y.toFixed(3) },
    intersection: null,
    materialIndex: null,
    meshName: null,
    worldPosition: null,
    faceNormal: null,
    distanceFromCamera: null
  };
  
  if (model) {
    const intersects = tempRaycaster.intersectObject(model, true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      info.intersection = true;
      info.materialIndex = getMaterialIndexFromIntersection(intersect);
      info.meshName = intersect.object.name;
      info.worldPosition = `(${intersect.point.x.toFixed(2)}, ${intersect.point.y.toFixed(2)}, ${intersect.point.z.toFixed(2)})`;
      info.faceNormal = `(${intersect.face.normal.x.toFixed(2)}, ${intersect.face.normal.y.toFixed(2)}, ${intersect.face.normal.z.toFixed(2)})`;
      info.distanceFromCamera = intersect.distance.toFixed(2);
    } else {
      info.intersection = false;
    }
  } else {
    info.intersection = 'no_model';
  }
  
  return info;
}

function logClickEvent(eventType, event, info) {
  const materialInfo = info.materialIndex !== null ? getMaterialInfo(info.materialIndex) : { name: 'None' };
  
  logEvent(`${eventType} | Seq: ${clickSequenceId} | Screen: (${info.screenCoords.x}, ${info.screenCoords.y}) | NDC: (${info.normalizedCoords.x}, ${info.normalizedCoords.y}) | 3D: ${info.worldPosition || 'None'} | Material: ${info.materialIndex} (${materialInfo.name}) | Mesh: ${info.meshName || 'None'} | Distance: ${info.distanceFromCamera || 'N/A'}`);
}

// Enhanced orientation and click tracking
renderer.domElement.addEventListener('pointerdown', (event) => {
  clickSequenceId++;
  clickStartTime = performance.now();
  clickStartEvent = event;
  clickInProgress = true;
  
  // Snapshot camera state for consistent raycasting
  clickCameraSnapshot = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    matrix: camera.matrix.clone(),
    matrixWorld: camera.matrixWorld.clone(),
    projectionMatrix: camera.projectionMatrix.clone()
  };
  
  // Get 3D intersection info for debugging
  const info = get3DIntersectionInfo(event);
  logClickEvent('POINTER_DOWN', event, info);
  
  // Skip if clicking on debug panel area  
  const debugPanelBounds = document.getElementById('debug-panel')?.getBoundingClientRect();
  const inDebugPanel = debugPanelBounds && 
    event.clientX >= debugPanelBounds.left && 
    event.clientX <= debugPanelBounds.right &&
    event.clientY >= debugPanelBounds.top && 
    event.clientY <= debugPanelBounds.bottom;
  
  if (!inDebugPanel && !orientationActive) {
    orientationStart = camera.quaternion.clone();
    orientationActive = true;
    orientationCause = 'mouse drag';
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (clickStartTime !== null) {
    const clickDuration = (performance.now() - clickStartTime).toFixed(1);
    const info = get3DIntersectionInfo(event);
    
    logEvent(`POINTER_UP | Seq: ${clickSequenceId} | Duration: ${clickDuration}ms | Screen: (${info.screenCoords.x}, ${info.screenCoords.y}) | NDC: (${info.normalizedCoords.x}, ${info.normalizedCoords.y}) | 3D: ${info.worldPosition || 'None'} | Material: ${info.materialIndex} (${info.materialIndex !== null ? getMaterialInfo(info.materialIndex).name : 'None'}) | Mesh: ${info.meshName || 'None'}`);
    
    clickStartTime = null;
    clickStartEvent = null;
  }
  
  // Short delay to ensure click event processes with stable camera state
  setTimeout(() => {
    clickInProgress = false;
    clickCameraSnapshot = null; // Clear snapshot
  }, 50);
  
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
  // Use same coordinate calculation as click events for consistency
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onMouseClick(event) {
  if (!model) {
    logEvent(`CLICK | No model loaded - click ignored`);
    return;
  }

  // Calculate mouse coordinates directly from the click event to avoid timing issues
  const rect = renderer.domElement.getBoundingClientRect();
  const clickMouse = new THREE.Vector2();
  clickMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  clickMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Use camera snapshot from pointerdown for consistent raycasting
  const cameraToUse = clickCameraSnapshot ? createTempCamera(clickCameraSnapshot) : camera;
  const cameraSource = clickCameraSnapshot ? 'snapshot' : 'current';
  
  raycaster.setFromCamera(clickMouse, cameraToUse);
  const intersects = raycaster.intersectObject(model, true);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const faceIndex = intersect.faceIndex;
    const meshName = intersect.object.name;
    const materialIndex = getMaterialIndexFromIntersection(intersect);
    const materialInfo = getMaterialInfo(materialIndex);
    
    logEvent(`CLICK | Seq: ${clickSequenceId} | Face: ${faceIndex} | Material: ${materialIndex} (${materialInfo.name}) | Mesh: ${meshName} | 3D: (${intersect.point.x.toFixed(2)}, ${intersect.point.y.toFixed(2)}, ${intersect.point.z.toFixed(2)}) | Normal: (${intersect.face.normal.x.toFixed(2)}, ${intersect.face.normal.y.toFixed(2)}, ${intersect.face.normal.z.toFixed(2)}) | Distance: ${intersect.distance.toFixed(2)} | Camera: ${cameraSource}`);
    
    setCameraForMaterial(materialIndex, 'view cube');
  } else {
    logEvent(`CLICK | Seq: ${clickSequenceId} | No intersection detected | Click coords: (${clickMouse.x.toFixed(3)}, ${clickMouse.y.toFixed(3)}) vs Global: (${mouse.x.toFixed(3)}, ${mouse.y.toFixed(3)}) | Ray origin: (${cameraToUse.position.x.toFixed(2)}, ${cameraToUse.position.y.toFixed(2)}, ${cameraToUse.position.z.toFixed(2)}) | Camera: ${cameraSource}`);
  }
}

// Helper function to create temporary camera from snapshot
function createTempCamera(snapshot) {
  const tempCamera = new THREE.PerspectiveCamera(
    camera.fov,
    camera.aspect,
    camera.near,
    camera.far
  );
  tempCamera.position.copy(snapshot.position);
  tempCamera.quaternion.copy(snapshot.quaternion);
  tempCamera.matrix.copy(snapshot.matrix);
  tempCamera.matrixWorld.copy(snapshot.matrixWorld);
  tempCamera.projectionMatrix.copy(snapshot.projectionMatrix);
  return tempCamera;
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

  // Prevent camera updates during click processing to avoid raycasting inconsistencies
  if (!clickInProgress) {
    controls.update();
  }
  renderer.render(scene, camera);
}

// Initial face info update and orientation logging
setTimeout(() => {
  // updateFaceInfo() - removed
  logEvent(`Initial orientation: ${quaternionToString(camera.quaternion)} | Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
}, 100);

animate();

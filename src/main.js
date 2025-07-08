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

const loader = new GLTFLoader();
loader.load('./beveled_cube_chamfered.glb', function (gltf) {
  model = gltf.scene;
  scene.add(model);
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
  
  // Define face normals for the 6 main faces (based on GLB inspection)
  const faces = [
    { index: 0, normal: new THREE.Vector3(1, 0, 0), name: 'Red' },
    { index: 1, normal: new THREE.Vector3(-1, 0, 0), name: 'Green' },
    { index: 2, normal: new THREE.Vector3(0, 0, 1), name: 'Blue' },
    { index: 3, normal: new THREE.Vector3(0, -1, 0), name: 'Yellow' },
    { index: 4, normal: new THREE.Vector3(0, 1, 0), name: 'Magenta' },
    { index: 5, normal: new THREE.Vector3(0, 0, -1), name: 'Cyan' }
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
    const materialIndex = intersect.face.materialIndex;
    logEvent(`Clicked face index: ${faceIndex}, Material index: ${materialIndex}`);

    const oldQuat = camera.quaternion.clone();
    
    const clickedNormal = intersect.face.normal.clone().transformDirection(intersect.object.matrixWorld);
    const distance = 5;
    
    // Check if this is a main face (0-5), edge chamfer (6-17), or corner chamfer (18-25)
    const isMainFace = materialIndex >= 0 && materialIndex <= 5;

    // Calculate target position
    camera.position.copy(clickedNormal.multiplyScalar(distance));
    
    // Calculate smart up vector based on current orientation
    const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const absNormal = new THREE.Vector3(
      Math.abs(clickedNormal.x),
      Math.abs(clickedNormal.y),
      Math.abs(clickedNormal.z)
    );
    
    // Only apply special cardinal logic for main faces
    if (isMainFace && absNormal.y > 0.9) {
      // For top/bottom faces, find the best up vector
      const candidates = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
      ];
      
      // Choose the candidate that's closest to current up
      let bestUp = candidates[0];
      let bestDot = currentUp.dot(candidates[0]);
      
      for (const candidate of candidates) {
        const dot = currentUp.dot(candidate);
        if (dot > bestDot) {
          bestDot = dot;
          bestUp = candidate;
        }
      }
      
      camera.up.copy(bestUp);
    } else {
      // For side faces, try to keep current up if possible
      const projectedUp = currentUp.clone();
      projectedUp.sub(clickedNormal.clone().multiplyScalar(currentUp.dot(clickedNormal)));
      
      if (projectedUp.length() > 0.1) {
        camera.up.copy(projectedUp.normalize());
      } else {
        camera.up.set(0, 1, 0);
      }
    }
    
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
      const faceIndex = intersects[0].faceIndex;
      if (faceIndex !== lastHoveredFaceIndex) {
        logEvent(`Hovered face index: ${faceIndex}`);
        lastHoveredFaceIndex = faceIndex;
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

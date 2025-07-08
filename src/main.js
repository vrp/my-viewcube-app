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

// LOG function - define early so it's available everywhere
function logEvent(message) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  console.log(`[${hh}:${mm}:${ss}:${ms}] ${message}`);
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

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('click', onMouseClick, false);

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

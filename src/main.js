import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// === SCENE ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === CONTROLS ===
const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.dynamicDampingFactor = 0.3;

// === LIGHT ===
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// === LOAD CHAMFERED VIEW CUBE ===
const cubeScene = new THREE.Scene();
const cubeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
cubeCamera.position.z = 5;

let viewCube = null;

const loader = new GLTFLoader();
loader.load('/beveled_cube_chamfered.glb', (gltf) => {
  // ✅ Corner cube
  viewCube = gltf.scene.clone();
  viewCube.scale.set(0.5, 0.5, 0.5);

  viewCube.traverse((child) => {
    if (child.isMesh) {
      // ✅ DEBUG: check the draw call groups
      console.log('Groups:', child.geometry.groups);

      // ✅ fallback: add material if missing
      if (!child.material) {
        child.material = new THREE.MeshNormalMaterial();
      }
    }
  });

  cubeScene.add(viewCube);

  // Main model
  const mainModel = gltf.scene.clone();
  mainModel.scale.set(1, 1, 1);
  mainModel.traverse((child) => {
    if (child.isMesh && !child.material) {
      child.material = new THREE.MeshNormalMaterial();
    }
  });
  scene.add(mainModel);

  const cubeLight = new THREE.AmbientLight(0xffffff, 1);
  cubeScene.add(cubeLight);
});

// === RAYCAST ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredFaceIndex = null;

// === ORIENTATION TRACKING ===
let orientationStart = null;
let orientationEnd = null;
let orientationCause = null;
let orientationActive = false;

// === TIMER ===
const timerDiv = document.createElement('div');
timerDiv.style.position = 'absolute';
timerDiv.style.top = '10px';
timerDiv.style.left = '10px';
timerDiv.style.color = '#000';
timerDiv.style.fontFamily = 'monospace';
timerDiv.style.fontSize = '16px';
document.body.appendChild(timerDiv);

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

// === RESIZE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === HOVER ===
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!viewCube) return;

  const size = 100;
  const margin = 10;

  const inCube =
    event.clientX > window.innerWidth - size - margin &&
    event.clientY < size + margin;

  if (inCube) {
    mouse.x =
      ((event.clientX - (window.innerWidth - size - margin)) / size) * 2 - 1;
    mouse.y = -((event.clientY - margin) / size) * 2 + 1;

    raycaster.setFromCamera(mouse, cubeCamera);
    const intersects = raycaster.intersectObject(viewCube, true);
    if (intersects.length > 0) {
      const matIndex = intersects[0].face.materialIndex;
      if (matIndex !== hoveredFaceIndex) {
        hoveredFaceIndex = matIndex;
        logEvent(`Hovered material index: ${matIndex}`);
      }
    } else {
      hoveredFaceIndex = null;
    }
  }
});

// === CLICK ===
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!viewCube) return;

  const size = 100;
  const margin = 10;

  const inCube =
    event.clientX > window.innerWidth - size - margin &&
    event.clientY < size + margin;

  if (inCube) {
    mouse.x =
      ((event.clientX - (window.innerWidth - size - margin)) / size) * 2 - 1;
    mouse.y = -((event.clientY - margin) / size) * 2 + 1;

    raycaster.setFromCamera(mouse, cubeCamera);
    const intersects = raycaster.intersectObject(viewCube, true);
    if (intersects.length > 0) {
      const matIndex = intersects[0].face.materialIndex;
      logEvent(`Clicked material index: ${matIndex}`);

      const oldQuat = camera.quaternion.clone();

      // === MAP MATERIAL INDEX TO ORIENTATION ===
      if (matIndex >= 0 && matIndex <= 5) {
        // Main face
        switch (matIndex) {
          case 0: camera.position.set(3, 0, 0); camera.up.set(0, 1, 0); break;
          case 1: camera.position.set(-3, 0, 0); camera.up.set(0, 1, 0); break;
          case 2: camera.position.set(0, 3, 0); camera.up.set(0, 0, -1); break;
          case 3: camera.position.set(0, -3, 0); camera.up.set(0, 0, 1); break;
          case 4: camera.position.set(0, 0, 3); camera.up.set(0, 1, 0); break;
          case 5: camera.position.set(0, 0, -3); camera.up.set(0, 1, 0); break;
        }
      } else if (matIndex >= 6 && matIndex <= 17) {
        logEvent(`Edge chamfer clicked — add orientation if needed.`);
      } else if (matIndex >= 18 && matIndex <= 25) {
        logEvent(`Corner chamfer clicked — add orientation if needed.`);
      }

      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controls.update();

      const newQuat = camera.quaternion.clone();
      logEvent(
        `Orientation changed | From: ${quatString(oldQuat)} | To: ${quatString(newQuat)} | Source: view cube`
      );
    }
  } else {
    orientationStart = camera.quaternion.clone();
    orientationActive = true;
    orientationCause = 'mouse drag';
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  if (orientationActive) {
    orientationEnd = camera.quaternion.clone();
    logEvent(
      `Orientation changed | From: ${quatString(orientationStart)} | To: ${quatString(orientationEnd)} | Source: ${orientationCause}`
    );
    orientationActive = false;
    orientationCause = null;
  }
});

// === LOG ===
function logEvent(message) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  console.log(`[${hh}:${mm}:${ss}:${ms}] ${message}`);
}

function quatString(q) {
  return `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)})`;
}

// === ANIMATE ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (viewCube) {
    viewCube.quaternion.copy(camera.quaternion).invert();
  }

  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.render(scene, camera);

  const size = 100;
  const margin = 10;
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(
    window.innerWidth - size - margin,
    window.innerHeight - size - margin,
    size,
    size
  );
  renderer.setViewport(
    window.innerWidth - size - margin,
    window.innerHeight - size - margin,
    size,
    size
  );
  renderer.render(cubeScene, cubeCamera);
  renderer.setScissorTest(false);
}

animate();

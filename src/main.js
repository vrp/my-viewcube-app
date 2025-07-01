import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // limits look up and look down rotate envelope to 180 degrees
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'; // enables full free rotation without limits

// SCENE
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

// un-comment the following section if using OrbitControls (and not TrackballControls)
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true; // set this to false if you don't want "inertia" effect when rotating and panning a model
// controls.dampingFactor = 0.25; // Default is 0.05 (works when enableDamping is true)

// un-comment the following section if using TrackballControls
const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.dynamicDampingFactor = 0.3;

// Following section only applies for OrbitControls
// controls.minPolarAngle = 0;          // allow looking straight up
// controls.maxPolarAngle = Math.PI;    // allow looking straight down
// controls.minAzimuthAngle = -Infinity; // no horizontal limit
// controls.maxAzimuthAngle = Infinity;  // no horizontal limit

let lastZoomDistance = camera.position.distanceTo(controls.target);
let zoomStartDistance = lastZoomDistance;
let zoomTimeout;

let lastPanTarget = controls.target.clone();
let panStart = lastPanTarget.clone();
let panTimeout;

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

// Touch pinch triggers 'change', so handle there
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
    if (!panTimeout) panStart.copy(lastPanTarget);
    clearTimeout(panTimeout);
    panTimeout = setTimeout(() => {
      logEvent(`Pan changed | From: (${panStart.x.toFixed(2)}, ${panStart.y.toFixed(2)}, ${panStart.z.toFixed(2)}) | To: (${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)})`);
      lastPanTarget.copy(controls.target);
      panTimeout = null;
    }, 200);
  }
});

const boxGeometry = new THREE.BoxGeometry();
const boxMaterials = [
  new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
  new THREE.MeshBasicMaterial({ color: 0x0000ff }),
  new THREE.MeshBasicMaterial({ color: 0xffff00 }),
  new THREE.MeshBasicMaterial({ color: 0x00ffff }),
  new THREE.MeshBasicMaterial({ color: 0xff00ff }),
];
const box = new THREE.Mesh(boxGeometry, boxMaterials);
scene.add(box);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// VIEW CUBE
const cubeScene = new THREE.Scene();
const cubeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
cubeCamera.position.z = 5;

const viewCube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  [
    new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
    new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    new THREE.MeshBasicMaterial({ color: 0x00ffff }),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  ]
);
cubeScene.add(viewCube);

// TIMER
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

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// RAYCAST
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredFaceIndex = null;

// ORIENTATION TRACKING
let orientationStart = null;
let orientationEnd = null;
let orientationCause = null;
let orientationActive = false;

// HOVER
renderer.domElement.addEventListener('pointermove', (event) => {
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
      const faceIndex = intersects[0].face.materialIndex;
      if (faceIndex !== hoveredFaceIndex) {
        hoveredFaceIndex = faceIndex;
        logEvent(`Hovered face: ${faceIndex}`);
      }
    } else {
      hoveredFaceIndex = null;
    }
  }
});

// CLICK
renderer.domElement.addEventListener('pointerdown', (event) => {
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
      const faceIndex = intersects[0].face.materialIndex;
      logEvent(`Clicked face: ${faceIndex}`);

      const oldQuat = camera.quaternion.clone();

      switch (faceIndex) {
        case 0: camera.position.set(3, 0, 0); break;
        case 1: camera.position.set(-3, 0, 0); break;
        case 2: camera.position.set(0, 3, 0); break;
        case 3: camera.position.set(0, -3, 0); break;
        case 4: camera.position.set(0, 0, 3); break;
        case 5: camera.position.set(0, 0, -3); break;
      }
      controls.update();

      const newQuat = camera.quaternion.clone();
      logEvent(
        `Orientation changed | From: ${quaternionToString(
          oldQuat
        )} | To: ${quaternionToString(newQuat)} | Source: view cube`
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
      `Orientation changed | From: ${quaternionToString(
        orientationStart
      )} | To: ${quaternionToString(orientationEnd)} | Source: ${
        orientationCause || 'unknown'
      }`
    );
    orientationActive = false;
    orientationCause = null;
  }
});

// LOG
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

// ANIMATE
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  viewCube.quaternion.copy(camera.quaternion).invert();

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

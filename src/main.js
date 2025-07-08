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

const loader = new GLTFLoader();
loader.load('./beveled_cube_chamfered.glb', function (gltf) {
  model = gltf.scene;
  scene.add(model);
}, undefined, function (error) {
  console.error(error);
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
    console.log('Clicked face index:', faceIndex);

    const clickedNormal = intersect.face.normal.clone().transformDirection(intersect.object.matrixWorld);
    const distance = 5;

    camera.position.copy(clickedNormal.multiplyScalar(distance));
    
    // Set appropriate up vector based on the clicked face normal
    const absNormal = new THREE.Vector3(
      Math.abs(clickedNormal.x),
      Math.abs(clickedNormal.y),
      Math.abs(clickedNormal.z)
    );
    
    // Check if we're looking straight up or down
    if (absNormal.y > 0.9) {
      // Top or bottom face - use special up vector
      camera.up.set(0, 0, clickedNormal.y > 0 ? -1 : 1);
    } else {
      // Side faces - use standard up vector
      camera.up.set(0, 1, 0);
    }
    
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.updateMatrixWorld();
    controls.update();
  }
}

function animate() {
  requestAnimationFrame(animate);

  raycaster.setFromCamera(mouse, camera);
  if (model) {
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
      const faceIndex = intersects[0].faceIndex;
      console.log('Hovered face index:', faceIndex);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

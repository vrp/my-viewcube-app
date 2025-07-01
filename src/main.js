import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

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
    camera.lookAt(new THREE.Vector3(0, 0, 0));
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

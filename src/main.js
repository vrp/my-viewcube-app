import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const box = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshNormalMaterial()
);
scene.add(box);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// View cube scene
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
      switch (faceIndex) {
        case 0:
          camera.position.set(3, 0, 0);
          break;
        case 1:
          camera.position.set(-3, 0, 0);
          break;
        case 2:
          camera.position.set(0, 3, 0);
          break;
        case 3:
          camera.position.set(0, -3, 0);
          break;
        case 4:
          camera.position.set(0, 0, 3);
          break;
        case 5:
          camera.position.set(0, 0, -3);
          break;
      }
      controls.update();
    }
  }
});

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

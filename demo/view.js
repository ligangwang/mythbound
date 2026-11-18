// Shows a GLB from four sides: view.html?m=hound-trellis.glb
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const W = 1280, H = 720;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#8a8f9c");
scene.add(new THREE.HemisphereLight("#ffffff", "#666677", 2.2));
const sun = new THREE.DirectionalLight("#ffffff", 2.5); sun.position.set(3, 5, 4); scene.add(sun);
const camera = new THREE.PerspectiveCamera(30, (W / 2) / (H / 2), 0.01, 100);
new GLTFLoader().load("./" + new URLSearchParams(location.search).get("m"), (g) => {
  scene.add(g.scene);
  const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  let tris = 0; g.scene.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  window.info = { min: box.min.toArray(), max: box.max.toArray(), tris, anims: g.animations.length };
  const r = Math.max(s.x, s.y, s.z) * 2.3;
  [[1, 0.25, 0], [0, 0.25, 1], [-1, 0.25, 0], [0.7, 0.5, -0.7]].forEach((d, i) => {
    const x = (i % 2) * W / 2, y = (i < 2 ? 1 : 0) * H / 2;
    renderer.setViewport(x, y, W / 2, H / 2); renderer.setScissor(x, y, W / 2, H / 2);
    camera.position.copy(c).add(new THREE.Vector3(...d).normalize().multiplyScalar(r)); camera.lookAt(c);
    renderer.render(scene, camera);
  });
  window.done = true;
});

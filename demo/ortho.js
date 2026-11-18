// Orthographic side / front / top views of a GLB with a 0.1 grid, in Blender axes (front is -Y, up is Z).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const W = 1280, H = 720, q = new URLSearchParams(location.search), view = q.get("v") || "side";
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#9a9fac");
scene.add(new THREE.AmbientLight("#ffffff", 3));
const half = 1.15, cam = new THREE.OrthographicCamera(-half * W / H, half * W / H, half, -half, -10, 10);
// blender (x,y,z) -> three (x,z,-y)
const centre = view === "top" ? [0, 0, 0] : [0, 1.0, 0];
const dir = { side: [1, 0, 0], front: [0, 0, 1], top: [0, 1, 0], other: [-1, 0, 0] }[view];
cam.position.set(centre[0] + dir[0], centre[1] + dir[1], centre[2] + dir[2]);
if (view === "top") cam.up.set(0, 0, 1);
cam.lookAt(...centre);
const lines = (step, color, depth) => {
  const pts = [];
  for (let k = -2; k <= 2.001; k += step) {
    const a = view === "side" ? [[0, -2, k], [0, 3, k], [0, k + 1, -2], [0, k + 1, 2]] : view === "other" ? [[0, -2, k], [0, 3, k], [0, k + 1, -2], [0, k + 1, 2]] : view === "front" ? [[k, -2, 0], [k, 3, 0], [-2, k + 1, 0], [2, k + 1, 0]] : [[k, 0, -2], [k, 0, 2], [-2, 0, k], [2, 0, k]];
    a.forEach((p) => pts.push(new THREE.Vector3(...p).addScaledVector(new THREE.Vector3(...dir), depth)));
  }
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.6 }));
  l.renderOrder = 5; scene.add(l);
};
lines(0.1, "#ffffff", 0); lines(0.5, "#ff2020", 0);
new GLTFLoader().load("./" + q.get("m"), (g) => { scene.add(g.scene); renderer.render(scene, cam); window.done = true; });

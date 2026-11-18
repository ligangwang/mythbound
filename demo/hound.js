// Plays the Blender-built Stormhound (demo/stormhound.glb) on the Cloudpeak Shores painting.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import shores from "../src/art/shores.webp";

const W = 1280, H = 720;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
let loaded = 0;
const bg = new THREE.TextureLoader().load(shores, () => loaded++);
bg.colorSpace = THREE.SRGBColorSpace;
scene.background = bg;
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
const real = new URLSearchParams(location.search).has("real");
const glb = real ? "./hound-rigged.glb" : "./stormhound.glb";
scene.add(new THREE.HemisphereLight(real ? "#ffffff" : "#d6c4f0", real ? "#8a7f98" : "#5a4660", real ? 2.6 : 1.6));
const sun = new THREE.DirectionalLight(real ? "#ffe2c8" : "#ffc79c", real ? 1.8 : 3.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -3, near: 0.5, far: 30 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight("#8fa8ff", real ? 0.7 : 1.2);
fill.position.set(-4, 4, 6);
scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const root = new THREE.Group(); scene.add(root);
// A soft blob shadow: cheap, and it works on every phone.
const sc = document.createElement("canvas"); sc.width = sc.height = 128;
const sg = sc.getContext("2d"), grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
grad.addColorStop(0, "rgba(20,10,30,0.75)"); grad.addColorStop(0.6, "rgba(20,10,30,0.35)"); grad.addColorStop(1, "rgba(20,10,30,0)");
sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; scene.add(blob);
let mixer, acts = {}, glowMat;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(glb, (g) => {
  g.scene.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material.name === "glow") glowMat = o.material; if (real) { o.material.roughness = 0.85; o.material.metalness = 0; } }
  });
  root.add(g.scene);
  mixer = new THREE.AnimationMixer(g.scene);
  for (const c of g.animations) { acts[c.name] = mixer.clipAction(c); acts[c.name].play(); acts[c.name].setEffectiveWeight(0); }
  acts.attack.setLoop(THREE.LoopOnce); acts.attack.clampWhenFinished = true;
  loaded++; window.clips = g.animations.map((c) => c.name + ":" + c.duration.toFixed(2));
});
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.6, 1.0));
composer.addPass(new OutputPass());

const ease = (k) => k * k * (3 - 2 * k);
const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const WALK = real ? 0.26 / 0.64 : 0.5 / (0.64 * 32 / 24), RUN = real ? 0.4 / (0.45 * 0.5) : 0.62 / (0.45 * 14 / 24);
const state = { t: 0, x: real ? 2.3 : 3.4 };
window.ready = () => loaded === 2;
window.step = (dt, draw = true) => {
  const t = (state.t += dt);
  // Walk on, stand, leap and howl, run off.
  const wWalk = 1 - ease(span(t, 4.6, 5.2));
  const wAtk = ease(span(t, 6.3, 6.5)) * (1 - ease(span(t, 9.3, 9.7)));
  const wRun = ease(span(t, 10.2, 10.6));
  const wIdle = Math.max(0, 1 - wWalk - wAtk - wRun);
  acts.walk.setEffectiveWeight(wWalk); acts.idle.setEffectiveWeight(wIdle); acts.attack.setEffectiveWeight(wAtk); acts.run.setEffectiveWeight(wRun);
  if (t >= 6.4 && t - dt < 6.4) { acts.attack.reset(); acts.attack.play(); }
  const ta = (t - 6.4) * 24;
  const lunge = (k) => (real ? 0.9 : 1.5) * ease(span(k, 11, 25));
  state.x -= (wWalk * WALK + wRun * RUN) * dt + (lunge(ta) - lunge(ta - dt * 24));
  root.position.x = state.x; root.rotation.y = -Math.PI / 2;
  mixer.update(dt);
  const flare = 1 + 3 * span(ta, 12, 20) * (1 - span(ta, 24, 32)) + 2.5 * span(ta, 40, 46) * (1 - span(ta, 60, 70)) * (0.7 + 0.3 * Math.sin(t * 40));
  if (glowMat) glowMat.emissiveIntensity = 3 * flare;
  const air = span(ta, 12, 18) * (1 - span(ta, 24, 29));
  blob.position.x = state.x - 0.1; blob.scale.set(2.6 - air * 0.6, 1.3 - air * 0.3, 1); blob.material.opacity = 0.9 - air * 0.45;
  const cx = THREE.MathUtils.lerp(1.2, state.x, 0.6);
  const dist = (real ? 7.4 : 8.2) - ease(span(t, 4, 6.2)) * 2.2 + ease(span(t, 10, 11.5)) * 2;
  camera.position.set(cx + 0.6 + Math.sin(t * 0.25) * 0.4, 1.35, dist);
  camera.lookAt(cx - 0.2, 0.95, 0);
  sun.position.set(state.x + 3, 6, 2.5); sun.target.position.set(state.x, 0, 0);
  if (draw) { const t0 = performance.now(); composer.render(); window.ms = performance.now() - t0; }
};

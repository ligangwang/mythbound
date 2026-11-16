/**
 * The three.js world: an ink-wash stage for each realm (layered mountains
 * fading into mist, painted on the fly), the binder, the spirits and their
 * animations, the rune burst of a binding, and the codex portraits.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Element } from "./engine/elements";
import { hash, rng } from "./engine/random";
import { spirit, type RealmId } from "./engine/spirits";
import { DARK, INK, buildBinder, buildSpirit, lit, setGlow, type Model } from "./spirit-models";

export type Place = RealmId | "home";
export type Action = "appear" | "attack" | "hurt" | "bound" | "flee" | "evolve" | "cast";

type Theme = {
  paper: string;
  ink: string;
  far: string;
  sun: string | null;
  ground: string;
  kind: "peaks" | "city" | "trees";
  /** The colour of the main light and of the light from behind. */
  key: string;
  rim: string;
  /** The colour of the mist, where it isn't the paper's. */
  mist?: string;
};
/** The darker look being tried out: an ink painting of the night. */
const NIGHT: Theme = { paper: "#27303b", ink: "#0b0e13", far: "#55687a", sun: "#dfe9f2", ground: "#3b4652", kind: "peaks", key: "#c9d8ee", rim: "#6fc4ff", mist: "#7d93a6" };
const themeOf = (place: Place): Theme => (DARK ? { ...NIGHT, kind: THEMES[place].kind } : THEMES[place]);
const THEMES: Record<Place, Theme> = {
  home: { paper: "#efe6d2", ink: "#2c2a28", far: "#7d8790", sun: "#c8442f", ground: "#cfc3a8", kind: "peaks", key: "#fff4e0", rim: "#ffd9c2" },
  shores: { paper: "#e9e6da", ink: "#27353f", far: "#6f8794", sun: "#c8442f", ground: "#b9c4c4", kind: "peaks", key: "#f2f8ff", rim: "#9fd0ee" },
  city: { paper: "#f1e2c8", ink: "#3a2a24", far: "#9a7a66", sun: "#e0a23c", ground: "#d2bd9a", kind: "city", key: "#ffe9c4", rim: "#ff9a4a" },
  wood: { paper: "#dfe3d0", ink: "#1f2c24", far: "#62786a", sun: null, ground: "#aebca0", kind: "trees", key: "#f0ffe2", rim: "#a8f08a" },
};

/** Paints one misty layer of the backdrop. */
function paintLayer(theme: Theme, layer: number, seed: number) {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const random = rng(seed);
  const color = layer === 0 ? theme.ink : theme.far;
  const base = h * (0.34 + layer * 0.07);
  // Sharp peaks from folded waves, with smaller ones riding on them.
  const ridge = (x: number) => {
    const t = x / w;
    let y = 0;
    for (let o = 0; o < 5; o++) {
      const f = (1.7 + layer * 0.6) * Math.pow(1.9, o);
      const fold = 1 - Math.abs(Math.sin(t * Math.PI * f + seed * (o + 1) * 0.37));
      y += (fold * fold) / Math.pow(1.7, o);
    }
    return base + 40 - y * (theme.kind === "peaks" ? 78 : 34);
  };
  // The ridge, dark at its edge and thinning to mist below.
  const fade = ctx.createLinearGradient(0, base - 170, 0, h);
  fade.addColorStop(0, color);
  fade.addColorStop(0.75, color + "00");
  ctx.fillStyle = fade;
  ctx.globalAlpha = layer === 0 ? 0.85 : 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, ridge(x));
  ctx.lineTo(w, h);
  ctx.fill();
  if (theme.kind === "city" && layer === 0) {
    // Roofs with upturned eaves and a pagoda or two.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 112 + random() * 40;
      const tiers = 1 + Math.floor(random() * 3.4);
      const bw = 50 + random() * 46;
      let y = base + 40;
      for (let tier = 0; tier < tiers; tier++) {
        const tw = bw * (1 - tier * 0.2);
        const th = 30 - tier * 3;
        ctx.fillRect(x - tw * 0.4, y - th, tw * 0.8, th);
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.75, y - th + 3);
        ctx.quadraticCurveTo(x - tw * 0.4, y - th - 4, x, y - th - 20);
        ctx.quadraticCurveTo(x + tw * 0.4, y - th - 4, x + tw * 0.75, y - th + 3);
        ctx.quadraticCurveTo(x, y - th - 6, x - tw * 0.75, y - th + 3);
        ctx.fill();
        y -= th + 12;
      }
      ctx.fillRect(x - 1.5, y - 14, 3, 20);
    }
  }
  if (theme.kind === "trees") {
    // Tall trunks under blotted canopies.
    for (let i = 0; i < 9 - layer * 3; i++) {
      const x = random() * w;
      const lean = (random() - 0.5) * 60;
      const tw = 10 + random() * 16 - layer * 4;
      ctx.globalAlpha = layer === 0 ? 0.85 : 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = tw;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.95);
      ctx.quadraticCurveTo(x + lean, h * 0.5, x + lean * 0.6, 30);
      ctx.stroke();
      ctx.fillStyle = color;
      for (let b = 0; b < 14; b++) {
        ctx.globalAlpha = (layer === 0 ? 0.22 : 0.12) * (0.5 + random());
        ctx.beginPath();
        ctx.arc(x + lean * 0.6 + (random() - 0.5) * 190, 20 + random() * 120, 30 + random() * 50, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // A few dry brush strokes under the ridge.
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    const x = random() * w;
    const y = ridge(x) + 8 + random() * 50;
    ctx.globalAlpha = 0.12 + random() * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + random() * 50, y + 14 + random() * 26);
    ctx.stroke();
  }
  return canvas;
}

function paintGround(theme: Theme) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const wash = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  wash.addColorStop(0, theme.ground);
  wash.addColorStop(0.55, theme.ground + "cc");
  wash.addColorStop(1, theme.ground + "00");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 512, 512);
  const random = rng(hash(theme.ground));
  ctx.strokeStyle = theme.ink;
  for (let i = 0; i < 60; i++) {
    const a = random() * Math.PI * 2;
    const r = 30 + random() * 190;
    ctx.globalAlpha = 0.05 + random() * 0.1;
    ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath();
    ctx.arc(256, 256, r, a, a + 0.2 + random() * 0.5);
    ctx.stroke();
  }
  return canvas;
}

function glyphTexture(char: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 70px "Ma Shan Zheng", "Kaiti SC", "STKaiti", "KaiTi", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, 64, 70);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The colour each element strikes with. */
const ELEMENT_COLOR: Record<Element, string> = {
  wood: "#5fbf5a",
  fire: "#ff6a2a",
  earth: "#d9a441",
  metal: "#dfe6f0",
  water: "#3fa9f5",
};

/** A colour brighter than white can show, which the bloom turns into glow. */
const bright = (color: string, by: number) => lit(color, by * 0.75);

const shared = new Map<string, THREE.Texture>();
/** A texture painted once and used by many effects (never disposed). */
function sharedTexture(key: string, size: [number, number], paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  let texture = shared.get(key);
  if (!texture) {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = size;
    const ctx = canvas.getContext("2d");
    if (ctx) paint(ctx, size[0], size[1]);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    shared.set(key, texture);
  }
  return texture;
}
/** A soft round blot: mist, glows, fireflies and the shadows under feet. */
const softDot = () =>
  sharedTexture("dot", [128, 128], (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
/** One sweep of a loaded brush, thick in the middle and dry at its ends. */
const brushStroke = () =>
  sharedTexture("stroke", [256, 256], (ctx) => {
    const random = rng(41);
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    for (let i = 0; i < 46; i++) {
      const r = 78 + (i / 46) * 34;
      const from = -2.5 + random() * 0.5;
      const to = -0.55 - random() * 0.5;
      ctx.globalAlpha = 0.25 + random() * 0.6;
      ctx.lineWidth = 1 + random() * 3.5;
      ctx.beginPath();
      ctx.arc(128, 150, r, from, to);
      ctx.stroke();
    }
  });
/** Light that fades along its length: sunbeams and the pillar of a binding. */
const fadeUp = () =>
  sharedTexture("fade", [8, 128], (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

/** Frees everything under a node except the shared textures. */
function discard(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of list as (THREE.Material & { map?: THREE.Texture | null })[]) {
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  });
}

/** The last pass: darker paper toward the edges, its grain, and the flash of a hit. */
const PaperShader = {
  uniforms: { tDiffuse: { value: null }, flash: { value: 0 }, edge: { value: 0.5 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float flash; uniform float edge; varying vec2 vUv;
    float grain(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(0.42, 1.0, length(vUv - 0.5) * 1.3);
      c.rgb = mix(c.rgb, c.rgb * vec3(0.5, 0.45, 0.4), v * edge);
      // Anything brighter than the screen can show keeps its hue instead of bleaching.
      float most = max(c.r, max(c.g, c.b));
      if (most > 1.0) c.rgb /= most;
      c.rgb += (grain(floor(vUv * vec2(1400.0, 900.0))) - 0.5) * 0.03 * (0.25 + 0.75 * dot(c.rgb, vec3(0.33)));
      c.rgb = mix(c.rgb, vec3(1.0, 0.97, 0.9), flash);
      gl_FragColor = c;
    }`,
};

type Weather = (t: number, dt: number) => void;

/**
 * Frees a model's geometries (an outline shares its mesh's, so each is freed
 * once). Materials are shared by every model and stay.
 */
function release(root: THREE.Object3D) {
  const seen = new Set<THREE.BufferGeometry>();
  root.traverse((child) => {
    const geometry = (child as THREE.Mesh).geometry;
    if (geometry && !seen.has(geometry)) {
      seen.add(geometry);
      geometry.dispose();
    }
  });
}

type Actor = {
  model: Model;
  home: THREE.Vector3;
  /** The way it faces at rest. */
  turn: number;
  phase: number;
  action: Action | null;
  started: number;
  scale: number;
  /** How hard the blow it is taking lands. */
  power: number;
  element?: Element;
  shadow: THREE.Mesh;
};

const MAIN = new THREE.Vector3(0.9, 0, 0);
const ALLY = new THREE.Vector3(-0.75, 0, 1.2);
const BINDER = new THREE.Vector3(-1.75, 0, 0.9);

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  private backdrop = new THREE.Group();
  private actors = new THREE.Group();
  private effects = new THREE.Group();
  private main: Actor | null = null;
  private ally: Actor | null = null;
  private lineup: Actor[] = [];
  private binder: Actor | null = null;
  private motes: THREE.Points;
  private bursts: { group: THREE.Group; started: number }[] = [];
  private place: Place | null = null;
  private clock = new THREE.Clock();
  private frame = 0;
  private shake = 0;
  private inkColor = "#b8322a";
  private portraits = new Map<string, string>();
  private disposed = false;
  private distance = 7.8;
  private composer: EffectComposer | null = null;
  private paper: ShaderPass | null = null;
  private key = new THREE.DirectionalLight("#ffffff", 1.6);
  private rim = new THREE.DirectionalLight("#ffffff", 0.45);
  private weather: Weather[] = [];
  /** The stage's own time, which a hard hit holds still for a moment. */
  private time = 0;
  private real = 0;
  private freeze = 0;
  private punch = 0;
  private flash = 0;
  /** Someone who asked their device for less motion gets a steadier camera. */
  private calm =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.add(this.backdrop, this.actors, this.effects);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b9ae98", 1.5));
    this.key.position.set(3, 6, 5);
    this.rim.position.set(-4, 3, -6);
    this.scene.add(this.key, this.rim);
    try {
      // The glow is drawn into half-float targets. A device that can't render
      // to them fails silently while drawing, so it is asked first.
      const ext = this.renderer.extensions;
      if (!ext.has("EXT_color_buffer_float") && !ext.has("EXT_color_buffer_half_float"))
        throw new Error("no float targets");
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(this.renderer, target);
      composer.addPass(new RenderPass(this.scene, this.camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.75, 1.05));
      this.paper = new ShaderPass(PaperShader);
      composer.addPass(this.paper);
      composer.addPass(new OutputPass());
      this.composer = composer;
    } catch {
      // No float targets on this device: the stage is drawn plainly.
      this.composer = null;
    }

    const positions = new Float32Array(120 * 3);
    const random = rng(7);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (random() - 0.5) * 16;
      positions[i + 1] = random() * 6;
      positions[i + 2] = (random() - 0.5) * 10 - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: INK, size: 0.05, transparent: true, opacity: 0.35 }),
    );
    this.scene.add(this.motes);

    this.setPlace("home");
    this.setBinder("");
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // The sheet covers the right of a wide screen and the bottom of any
    // other, so the stage is slid into the part that is left.
    const wide = w >= 900 && h >= 560;
    const tall = aspect < 0.9;
    const distance = tall ? Math.min(19, 6.7 / aspect) : 7.8;
    this.camera.position.set(0, 1.7, distance);
    this.camera.lookAt(-0.3, 0.95, 0);
    if (this.paper) this.paper.uniforms.edge.value = tall ? 0.35 : 0.5;
    if (wide) this.camera.setViewOffset(w, h, w * 0.2, -h * 0.02, w, h);
    else this.camera.setViewOffset(w, h, 0, h * (tall ? 0.2 : 0.22), w, h);
    this.distance = distance;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance + 3;
      this.scene.fog.far = distance + 26;
    }
    this.camera.updateProjectionMatrix();
  }

  /** The colour of the binder's ink: runes, bursts and strokes. */
  setInk(color: string) {
    this.inkColor = color;
  }

  setPlace(place: Place) {
    if (place === this.place) return;
    this.place = place;
    const theme = themeOf(place);
    this.rim.intensity = DARK ? 1.3 : 0.45;
    for (const child of [...this.backdrop.children]) {
      this.backdrop.remove(child);
      discard(child);
    }
    this.weather = [];
    this.key.color.set(theme.key);
    this.rim.color.set(theme.rim);
    this.scene.background = new THREE.Color(theme.paper);
    this.scene.fog = new THREE.Fog(theme.paper, this.distance + 3, this.distance + 26);
    (this.motes.material as THREE.PointsMaterial).color.set(
      place === "wood" ? "#b8f08a" : place === "city" ? "#e0a23c" : theme.ink,
    );
    const seed = hash(place);
    for (let layer = 2; layer >= 0; layer--) {
      const texture = new THREE.CanvasTexture(paintLayer(theme, layer, seed + layer * 13));
      texture.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(30 + layer * 12, 10 + layer * 2),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }),
      );
      plane.position.set(layer * 2 - 2, [1.0, 2.7, 4.7][layer], -9 - layer * 7);
      plane.renderOrder = -10 + -layer;
      this.backdrop.add(plane);
    }
    if (theme.sun) {
      const sun = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 40),
        new THREE.MeshBasicMaterial({ color: bright(theme.sun, 1.3), fog: false, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      sun.position.set(-4.5, 6.6, -24.5);
      sun.renderOrder = -20;
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: softDot(), color: theme.sun, transparent: true, opacity: 0.3, depthWrite: false, fog: false }),
      );
      halo.position.copy(sun.position);
      halo.position.z -= 0.2;
      halo.scale.setScalar(9);
      halo.renderOrder = -21;
      this.backdrop.add(halo, sun);
      this.weather.push((t) => halo.scale.setScalar(9 + Math.sin(t * 0.5) * 0.6));
    }
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(11, 48),
      new THREE.MeshBasicMaterial({
        map: (() => {
          const t = new THREE.CanvasTexture(paintGround(theme));
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        })(),
        transparent: true,
        depthWrite: false,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.renderOrder = -5;
    this.backdrop.add(ground);
    // A few ink props near the stage.
    const random = rng(seed);
    const ink = new THREE.MeshBasicMaterial({ color: theme.ink });
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (4.2 + random() * 3.5);
      const z = -3 - random() * 4;
      let prop: THREE.Mesh;
      if (theme.kind === "trees")
        prop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 9, 7), ink);
      else if (theme.kind === "city") {
        prop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), new THREE.MeshBasicMaterial({ color: "#a3241c" }));
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: bright("#e0502f", 1.9) }));
        lamp.position.y = 1.9;
        lamp.scale.y = 0.85;
        prop.add(lamp);
      } else {
        prop = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + random() * 0.5, 0), ink);
        prop.scale.y = 0.6 + random() * 1.4;
        prop.rotation.set(random(), random() * 3, random());
      }
      prop.position.set(x, theme.kind === "peaks" ? 0.2 : theme.kind === "trees" ? 4.4 : 1.7, z);
      this.backdrop.add(prop);
    }
    this.addWeather(place, theme, rng(seed + 99));
  }

  /** What moves in the air of a place: mist everywhere, and each realm's own. */
  private addWeather(place: Place, theme: Theme, random: () => number) {
    const add = <T extends THREE.Object3D>(object: T) => {
      this.backdrop.add(object);
      return object;
    };
    // Bands of mist drifting between the stage and the mountains.
    const mist = Array.from({ length: 7 }, () => {
      const sprite = add(
        new THREE.Sprite(
          new THREE.SpriteMaterial({ map: softDot(), color: theme.mist ?? theme.paper, transparent: true, opacity: theme.mist ? 0.22 : 0.55, depthWrite: false, fog: false }),
        ),
      );
      sprite.scale.set(10 + random() * 8, 1.6 + random() * 1.6, 1);
      sprite.position.set((random() - 0.5) * 30, 0.3 + random() * 2.4, -3.5 - random() * 12);
      sprite.userData.drift = 0.12 + random() * 0.3;
      return sprite;
    });
    this.weather.push((_, dt) => {
      for (const m of mist) {
        m.position.x += m.userData.drift * dt;
        if (m.position.x > 18) m.position.x = -18;
      }
    });

    /** Small things that fall and tumble: petals and leaves. */
    const falling = (count: number, colors: string[], speed: number) => {
      const geo = new THREE.PlaneGeometry(0.13, 0.08);
      const mats = colors.map((color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      const bits = Array.from({ length: count }, (_, i) => {
        const bit = add(new THREE.Mesh(geo, mats[i % mats.length]));
        bit.position.set((random() - 0.5) * 16, random() * 7, -5 + random() * 8);
        bit.userData = { fall: speed * (0.6 + random() * 0.8), sway: random() * 6, spin: 1 + random() * 3 };
        return bit;
      });
      this.weather.push((t, dt) => {
        for (const b of bits) {
          const u = b.userData;
          b.position.y -= u.fall * dt;
          b.position.x += Math.sin(t * 0.9 + u.sway) * 0.35 * dt + 0.12 * dt;
          b.rotation.x += u.spin * dt;
          b.rotation.z += u.spin * 0.6 * dt;
          if (b.position.y < -0.2) {
            b.position.y = 7;
            b.position.x = (Math.random() - 0.5) * 16;
          }
        }
      });
    };

    if (place === "home") falling(38, ["#eaa0ae", "#f3c3cb", "#ffffff"], 0.5);
    if (place === "shores") {
      // A light rain off the sea, slanting with the wind.
      const count = 150;
      const at = new Float32Array(count * 6);
      const heads = Array.from({ length: count }, () => [(random() - 0.5) * 22, random() * 9, -8 + random() * 11, 5 + random() * 3]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(at, 3));
      add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: theme.ink, transparent: true, opacity: 0.22 })));
      this.weather.push((_, dt) => {
        heads.forEach((h, i) => {
          h[1] -= h[3] * dt;
          h[0] -= h[3] * 0.22 * dt;
          if (h[1] < 0) {
            h[1] = 9;
            h[0] = (Math.random() - 0.5) * 22;
          }
          at.set([h[0], h[1], h[2], h[0] + 0.07, h[1] + 0.32, h[2]], i * 6);
        });
        geo.attributes.position.needsUpdate = true;
      });
    }
    if (place === "city") {
      // Sky lanterns rising over the roofs.
      const geo = new THREE.SphereGeometry(0.2, 10, 8);
      const paperMat = new THREE.MeshBasicMaterial({ color: bright("#ff7a2a", 2.6), fog: false });
      const lanterns = Array.from({ length: 16 }, () => {
        const lantern = add(new THREE.Mesh(geo, paperMat));
        lantern.scale.set(1, 1.25, 1).multiplyScalar(0.5 + random() * 0.6);
        lantern.position.set((random() - 0.5) * 30, random() * 9, -8 - random() * 11);
        lantern.userData = { rise: 0.18 + random() * 0.22, sway: random() * 6 };
        return lantern;
      });
      this.weather.push((t, dt) => {
        for (const l of lanterns) {
          l.position.y += l.userData.rise * dt;
          l.position.x += Math.sin(t * 0.5 + l.userData.sway) * 0.15 * dt;
          if (l.position.y > 10) l.position.y = -0.5;
        }
      });
    }
    if (place === "wood") {
      // Shafts of light through the canopy.
      const rays = Array.from({ length: 5 }, (_, i) => {
        const ray = add(
          new THREE.Mesh(
            new THREE.PlaneGeometry(1.2 + random() * 1.6, 13),
            new THREE.MeshBasicMaterial({ map: fadeUp(), color: "#fff7cf", transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
          ),
        );
        ray.position.set(-7 + i * 3.4 + random() * 1.5, 5.2, -4 - random() * 5);
        ray.rotation.z = -0.38;
        ray.userData.beat = random() * 6;
        return ray;
      });
      this.weather.push((t) => {
        for (const r of rays) (r.material as THREE.MeshBasicMaterial).opacity = 0.11 + Math.sin(t * 0.4 + r.userData.beat) * 0.06;
      });
      // Fireflies.
      const count = 46;
      const at = new Float32Array(count * 3);
      const homes = Array.from({ length: count }, () => [(random() - 0.5) * 15, 0.4 + random() * 3.6, -6 + random() * 8, random() * 20]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(at, 3));
      add(
        new THREE.Points(
          geo,
          new THREE.PointsMaterial({ map: softDot(), color: bright("#c8ff7a", 2.4), size: 0.2, transparent: true, depthWrite: false, fog: false }),
        ),
      );
      this.weather.push((t) => {
        homes.forEach((h, i) => {
          at[i * 3] = h[0] + Math.sin(t * 0.5 + h[3]) * 0.7;
          at[i * 3 + 1] = h[1] + Math.sin(t * 0.8 + h[3] * 1.7) * 0.4;
          at[i * 3 + 2] = h[2] + Math.cos(t * 0.4 + h[3]) * 0.7;
        });
        geo.attributes.position.needsUpdate = true;
      });
      falling(22, ["#7fae5c", "#c9b24a"], 0.45);
    }
  }

  setBinder(robe: string) {
    this.drop(this.binder);
    this.binder = this.actor(buildBinder(robe), BINDER, 0.75);
  }

  private actor(model: Model, at: THREE.Vector3, turn: number, scale = 1, element?: Element): Actor {
    model.root.position.copy(at);
    model.root.rotation.y = turn;
    model.root.scale.multiplyScalar(scale);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ map: softDot(), color: INK, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = -4;
    this.actors.add(model.root, shadow);
    return {
      power: 1,
      element,
      shadow,
      model,
      home: at.clone(),
      turn,
      phase: Math.random() * 10,
      action: null,
      started: 0,
      scale: model.root.scale.x,
    };
  }
  private drop(actor: Actor | null) {
    if (!actor) return;
    this.actors.remove(actor.model.root, actor.shadow);
    release(actor.model.root);
    discard(actor.shadow);
  }

  /** The wild spirit or guardian on the stage. */
  showSpirit(id: string | null, stage = 0, big = false) {
    this.drop(this.main);
    // A phone's stage is narrow, so a guardian stays its own size there.
    const tall = this.camera.aspect < 0.9;
    this.main = id
      ? this.actor(
          buildSpirit(spirit(id), stage),
          tall ? new THREE.Vector3(0.7, 0, 0) : MAIN,
          -0.45,
          big ? (tall ? 0.9 : 1.15) : 1,
          spirit(id).element,
        )
      : null;
    if (this.main) this.act("appear");
  }
  /** The team spirit standing with the binder. */
  showAlly(id: string | null, stage = 0) {
    this.drop(this.ally);
    this.ally = id ? this.actor(buildSpirit(spirit(id), stage), ALLY, 0.7, 0.75, spirit(id).element) : null;
  }
  /** Spirits gathered around the binder on the home screen. */
  showLineup(list: { id: string; stage: number }[]) {
    for (const a of this.lineup) this.drop(a);
    // A phone has room for the team; a wide screen for six.
    const spots =
      this.camera.aspect < 0.9
        ? [[0.35, 0.8], [1.45, -0.5], [-0.6, -1.7]]
        : [[0.25, 0.9], [1.75, 0.5], [-0.8, -1.3], [1.0, -2.3], [2.7, -1.5], [-2.3, -2.6]];
    this.lineup = list.slice(0, spots.length).map(({ id, stage }, i) =>
      this.actor(
        buildSpirit(spirit(id), stage),
        new THREE.Vector3(spots[i][0], 0, spots[i][1]),
        -0.35 + (i % 3) * 0.3,
        // The one at the back stands tall behind the front row.
        i < 2 ? 0.95 : i === 3 ? 1.15 : 0.8,
      ),
    );
  }

  /**
   * Plays an action on the stage spirit (or the ally, for its attack).
   * `power` is how hard a blow lands: above 1 for a strong match or a heavy one.
   */
  act(action: Action, who: "main" | "ally" = "main", power = 1) {
    const actor = who === "ally" ? this.ally : this.main;
    if (!actor) return;
    actor.action = action;
    actor.started = this.time;
    actor.power = power;
    if (action === "bound" || action === "evolve") {
      this.runeBurst(actor.home);
      this.pillar(actor.home);
      this.flash = this.calm ? 0.15 : 0.45;
      this.punch = 0.6;
      if (this.binder) {
        this.binder.action = "cast";
        this.binder.started = this.time;
      }
    }
    if (action === "hurt") this.impact(actor, (who === "ally" ? this.main : this.ally)?.element, power);
    if (action === "appear" || action === "flee") this.inkPuff(actor.home);
    if (action === "appear") this.floorRing(actor.home, INK, 2.6, 0.7);
  }

  private burst(group: THREE.Group, life: number) {
    group.userData.life = life;
    this.effects.add(group);
    this.bursts.push({ group, started: this.time });
  }

  /** A blow landing: a brush slash, sparks in the attacker's element, a ring on the ground. */
  private impact(actor: Actor, element: Element | undefined, power: number) {
    const strong = power > 1;
    const color = element ? ELEMENT_COLOR[element] : this.inkColor;
    const quiet = this.calm ? 0.3 : 1;
    this.shake = (strong ? 0.5 : 0.3) * quiet;
    this.punch = strong ? 1 : 0.55;
    this.flash = (strong ? 0.3 : 0.14) * quiet;
    this.freeze = strong ? 0.11 : 0.06;
    const group = new THREE.Group();
    const middle = actor.model.height * actor.scale * 0.5 + actor.model.rig.hover;
    group.position.set(actor.home.x, middle, actor.home.z + 0.3);
    const tilt = Math.random() * Math.PI * 2;
    // The ink of the stroke, then its colour laid over, bright enough to glow.
    for (const [tint, size, turn] of [
      [new THREE.Color(INK), 2.5, 0],
      [bright(color, 1.55), 2.2, 0.06],
    ] as const) {
      const slash = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: brushStroke(), color: tint, transparent: true, depthTest: false, rotation: tilt + turn }),
      );
      slash.userData.slash = size * (strong ? 1.3 : 1);
      group.add(slash);
    }
    this.addSplash(group, strong ? 30 : 16, bright(color, 2.2), strong ? 4.4 : 3.2);
    this.burst(group, 0.55);
    this.floorRing(actor.home, color, strong ? 4.2 : 3, 0.5);
  }
  /** A ring of ink spreading on the ground. */
  private floorRing(at: THREE.Vector3, color: string, reach: number, life: number) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.02, at.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = -3;
    ring.userData.floor = reach;
    group.add(ring);
    this.burst(group, life);
  }
  /** The column of light a binding or an awakening stands in. */
  private pillar(at: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.set(at.x, 0, at.z);
    for (let i = 0; i < 2; i++) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5 + i * 0.4, 0.5 + i * 0.4, 9, 28, 1, true),
        new THREE.MeshBasicMaterial({
          map: fadeUp(),
          color: bright(i ? this.inkColor : "#ffe9b0", i ? 1.4 : 2.2),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      beam.position.y = 4.5;
      beam.userData.pillar = i ? 0.22 : 0.5;
      group.add(beam);
    }
    this.burst(group, 1.5);
  }

  /** A ring of seal characters and a splash of ink. */
  private runeBurst(at: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.9, at.z);
    const chars = ["灵", "契", "藏", "鉴", "封", "缚", "灵", "契"];
    chars.forEach((char, i) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glyphTexture(char, this.inkColor), color: bright("#ffffff", 1.5), transparent: true, depthTest: false }),
      );
      sprite.userData.angle = (i / chars.length) * Math.PI * 2;
      sprite.scale.setScalar(0.5);
      group.add(sprite);
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.025 + i * 0.012, 6, 60),
        new THREE.MeshBasicMaterial({ color: i === 1 ? new THREE.Color(INK) : bright(this.inkColor, 1.8), transparent: true, depthTest: false }),
      );
      ring.userData.ring = i + 1;
      group.add(ring);
    }
    this.addSplash(group, 46, bright(this.inkColor, 1.6), 3.2);
    this.burst(group, 1.6);
  }
  private inkPuff(at: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.6, at.z);
    this.addSplash(group, 22, new THREE.Color(INK), 1.6);
    this.burst(group, 0.7);
  }
  private addSplash(group: THREE.Group, count: number, color: THREE.Color, speed: number) {
    const geo = new THREE.SphereGeometry(0.07, 6, 5);
    for (let i = 0; i < count; i++) {
      const drop = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 ? color : INK, transparent: true }));
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      drop.userData.velocity = new THREE.Vector3(Math.cos(a) * speed, up * speed, Math.sin(a) * speed).multiplyScalar(0.5 + Math.random() * 0.6);
      drop.scale.setScalar(0.5 + Math.random() * 1.4);
      group.add(drop);
    }
  }

  private animate(actor: Actor, t: number, dt: number) {
    const { model, home } = actor;
    const { rig, root } = model;
    const p = t * 2 + actor.phase;
    let y = rig.hover ? rig.hover + Math.sin(p * 0.8) * 0.08 : Math.abs(Math.sin(p * 0.9)) * 0.03;
    let x = home.x;
    let z = home.z;
    let scale = actor.scale;
    let turn = actor.turn;
    // Breathing; a windup squashes it and a lunge stretches it.
    let stretch = 1 + Math.sin(p * 0.9) * 0.018;
    let lean = 0;
    let reach = 0;
    const flap = rig.hover ? 0.5 : 0.12;
    for (const wing of rig.wings)
      wing.rotation.z = (Math.sin(p * (rig.hover ? 3.2 : 1.1)) * flap + reach) * (wing.userData.side ?? 1);
    rig.tails.forEach((tail, i) => (tail.rotation.y = Math.sin(p * 1.3 + i * 0.7) * 0.22));
    if (rig.head) {
      rig.head.rotation.z = Math.sin(p * 0.6) * 0.06;
      rig.head.rotation.x = Math.sin(p * 0.45) * 0.05;
    }
    for (const o of rig.orbit) o.rotation.y += dt * 1.2;

    if (actor.action) {
      const a = t - actor.started;
      const toward = actor === this.ally ? 1 : -1;
      switch (actor.action) {
        case "appear": {
          const k = Math.min(1, a / 0.5);
          scale *= 1 + Math.sin(k * Math.PI) * 0.15 - (1 - k) * 0.9;
          if (k >= 1) actor.action = null;
          break;
        }
        case "attack": {
          // Draws back, darts in to land at about a quarter of a second, and returns.
          const away = actor === this.ally ? -1 : 1;
          let go: number;
          if (a < 0.14) {
            go = -0.28 * Math.sin((a / 0.14) * Math.PI * 0.5);
            stretch *= 1 - 0.14 * (a / 0.14);
          } else if (a < 0.27) {
            const k = (a - 0.14) / 0.13;
            go = -0.28 + 1.6 * k * k;
            stretch *= 0.86 + 0.3 * k;
          } else {
            const k = Math.min(1, (a - 0.27) / 0.4);
            go = 1.32 * (1 - k) * (1 - k);
            stretch *= 1 + 0.16 * (1 - k);
          }
          x += toward * go;
          z += away * go * 0.45;
          y += Math.max(0, go) * 0.28;
          lean = -toward * go * 0.16;
          if (a >= 0.67) actor.action = null;
          break;
        }
        case "hurt": {
          // Knocked back and rocking, harder for a harder blow.
          const k = Math.min(1, a / 0.5);
          const force = Math.min(1.6, actor.power);
          const back = Math.exp(-a * 7) * 0.3 * force;
          x -= toward * back;
          x += Math.sin(a * 60) * 0.05 * (1 - k);
          lean = toward * back * 0.5;
          stretch *= 1 - back * 0.35;
          turn += Math.sin(a * 40) * 0.15 * (1 - k);
          if (k >= 1) actor.action = null;
          break;
        }
        case "cast": {
          // The binder throws an arm up with the seal.
          const k = Math.min(1, a / 0.9);
          const up = Math.sin(k * Math.PI);
          y += up * 0.16;
          reach = up * 1.1;
          lean = -up * 0.12;
          if (k >= 1) actor.action = null;
          break;
        }
        case "bound": {
          // Spins and shrinks into the codex.
          const k = Math.min(1, a / 1.1);
          turn += k * k * 14;
          scale *= Math.max(0.001, 1 - k * k);
          y += k * 1.2;
          if (k >= 1) {
            root.visible = false;
            actor.action = null;
          }
          break;
        }
        case "flee": {
          const k = Math.min(1, a / 0.8);
          x += k * k * 7;
          y += Math.sin(k * Math.PI) * 0.8;
          if (k >= 1) {
            root.visible = false;
            actor.action = null;
          }
          break;
        }
        case "evolve": {
          const k = Math.min(1, a / 1);
          turn += k * Math.PI * 4;
          scale *= 1 + Math.sin(k * Math.PI) * 0.3;
          y += Math.sin(k * Math.PI) * 0.5;
          if (k >= 1) actor.action = null;
          break;
        }
      }
    }
    root.position.set(x, y, z);
    root.rotation.y = turn;
    root.rotation.z = lean;
    const wide = Math.max(0.001, scale / Math.sqrt(stretch));
    root.scale.set(wide, Math.max(0.001, scale * stretch), wide);
    // The shadow stays on the ground, smaller and fainter under a leap.
    const lift = Math.max(0, y - rig.hover * 0.5);
    actor.shadow.visible = root.visible;
    actor.shadow.position.set(x, 0.012, z);
    actor.shadow.scale.setScalar(Math.max(0.001, scale * (0.34 + model.height * 0.2) * (1 - Math.min(0.5, lift * 0.3))));
    (actor.shadow.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - Math.min(0.6, lift * 0.45));
  }

  private tick() {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.real += dt;
    // A hit holds the stage still for an instant, which is what gives it weight.
    const step = this.freeze > 0 ? dt * 0.04 : dt;
    this.freeze = Math.max(0, this.freeze - dt);
    this.time += step;
    const t = this.time;
    for (const actor of [this.main, this.ally, this.binder, ...this.lineup])
      if (actor) this.animate(actor, t, step);
    this.motes.rotation.y = t * 0.02;
    this.motes.position.y = Math.sin(t * 0.3) * 0.2;
    for (const blow of this.weather) blow(t, step);

    this.bursts = this.bursts.filter(({ group, started }) => {
      const k = (t - started) / group.userData.life;
      if (k >= 1) {
        this.effects.remove(group);
        discard(group);
        return false;
      }
      for (const child of group.children) {
        const material = (child as THREE.Mesh).material as THREE.Material & { opacity: number };
        const u = child.userData;
        if (u.velocity) {
          const v = u.velocity as THREE.Vector3;
          v.y -= step * 4;
          child.position.addScaledVector(v, step);
          material.opacity = 1 - k;
        } else if (u.ring) {
          const s = 0.2 + k * 1.7 * (0.6 + u.ring * 0.25);
          child.scale.setScalar(s);
          child.lookAt(this.camera.position);
          material.opacity = 1 - k;
        } else if (u.floor) {
          child.scale.setScalar(0.25 + (1 - (1 - k) * (1 - k)) * u.floor);
          material.opacity = (1 - k) * 0.7;
        } else if (u.slash) {
          child.scale.setScalar(u.slash * (0.55 + (1 - (1 - k) * (1 - k)) * 0.6));
          material.opacity = k < 0.25 ? 1 : (1 - k) / 0.75;
        } else if (u.pillar) {
          const rise = Math.min(1, k * 5);
          child.scale.set(1 - k * 0.5, rise, 1 - k * 0.5);
          child.position.y = 4.5 * rise;
          child.rotation.y = t * 1.5;
          material.opacity = u.pillar * Math.sin(Math.min(1, k * 1.15) * Math.PI);
        } else {
          const angle = u.angle + k * 2.4;
          const r = 0.3 + Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 1.35;
          child.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.2);
          child.scale.setScalar(0.35 + k * 0.4);
          material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        }
      }
      return true;
    });

    // The camera breathes, jolts with a hit and leans in on it.
    this.shake *= Math.exp(-dt * 9);
    this.punch *= Math.exp(-dt * 6);
    this.flash *= Math.exp(-dt * 11);
    const drift = this.calm ? 0 : 1;
    const r = this.real;
    this.camera.position.set(
      Math.sin(r * 0.13) * 0.24 * drift + (Math.sin(r * 83) + Math.sin(r * 47)) * this.shake * 0.11,
      1.7 + Math.sin(r * 0.17) * 0.06 * drift + Math.sin(r * 61) * this.shake * 0.1,
      this.distance * (1 - this.punch * 0.05),
    );
    this.camera.lookAt(-0.3, 0.95, 0);
    if (this.composer && this.paper) {
      this.paper.uniforms.flash.value = this.flash;
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
    this.frame++;
  }

  /** A picture of a spirit for its codex page, as a data URL. */
  portrait(id: string, stage = 0, silhouette = false): string {
    const key = `${id}:${stage}:${silhouette}`;
    const cached = this.portraits.get(key);
    if (cached) return cached;
    const size = 256;
    const model = buildSpirit(spirit(id), stage, silhouette);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#b9ae98", 1.5));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(3, 6, 5);
    scene.add(sun, model.root);
    model.root.rotation.y = -0.5;
    const box = new THREE.Box3().setFromObject(model.root);
    const centre = box.getCenter(new THREE.Vector3());
    const reach = box.getSize(new THREE.Vector3()).length() * 0.5;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(centre.x, centre.y + reach * 0.25, centre.z + reach / Math.tan((15 * Math.PI) / 180) * 0.92);
    camera.lookAt(centre);
    const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    const pixels = new Uint8Array(size * size * 4);
    const clear = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(target);
    this.renderer.setClearAlpha(0);
    this.renderer.clear();
    setGlow(false);
    this.renderer.render(scene, camera);
    setGlow();
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearAlpha(clear);
    target.dispose();
    release(model.root);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const image = ctx.createImageData(size, size);
    // Flip the rows and take the linear colours to sRGB.
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const from = ((size - 1 - row) * size + col) * 4;
        const to = (row * size + col) * 4;
        for (let c = 0; c < 3; c++)
          image.data[to + c] = Math.round(Math.pow(pixels[from + c] / 255, 1 / 2.2) * 255);
        image.data[to + 3] = pixels[from + 3];
      }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL("image/png");
    this.portraits.set(key, url);
    return url;
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.composer?.dispose();
    this.renderer.dispose();
  }
}

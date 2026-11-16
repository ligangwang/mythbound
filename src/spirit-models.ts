/**
 * Every spirit and the binder, built in code from three.js shapes: toon
 * shading in a few flat tones with an ink outline, so they sit in the
 * ink-wash world. No model files. Each spirit faces +Z and stands on y = 0.
 */
import * as THREE from "three";
import type { Form, SpiritDef } from "./engine/spirits";

export const INK = "#1d1b19";
type V3 = [number, number, number];
type Opt = {
  p?: V3;
  s?: V3 | number;
  r?: V3;
  /** Outline thickness, or false for none. */
  o?: number | false;
  /** Unlit and bright, for runes, flames and eyes' highlights. */
  glow?: boolean;
  parent?: THREE.Object3D;
};

/** What the scene animates on a model. */
export type Rig = {
  wings: THREE.Object3D[];
  tails: THREE.Object3D[];
  head?: THREE.Object3D;
  /** Things that circle the spirit, such as a pearl. */
  orbit: THREE.Object3D[];
  /** How high it floats above the ground (0 for walkers). */
  hover: number;
};
export type Model = { root: THREE.Group; rig: Rig; height: number };

/** The darker look being tried out: open the game with ?dark in its address. */
export const DARK = typeof location !== "undefined" && new URLSearchParams(location.search).has("dark");

let gradient: THREE.DataTexture | null = null;
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(
      new Uint8Array(
        DARK
          ? [46, 46, 46, 255, 128, 128, 128, 255, 255, 255, 255, 255]
          : [110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255],
      ),
      3,
      1,
      THREE.RGBAFormat,
    );
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const materials = new Map<string, THREE.Material>();
const glows: [THREE.MeshBasicMaterial, THREE.Color][] = [];
let glowing = true;
/**
 * A colour made as bright as `light` (1 is white), keeping its hue. Above 1 it
 * is brighter than the screen can show, which the stage's bloom turns to glow.
 * A dark red needs far more of a push than a white does to shine the same.
 */
export function lit(color: THREE.ColorRepresentation, light: number) {
  const c = new THREE.Color(color);
  const now = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c.multiplyScalar(Math.min(4.5, Math.max(1, light / Math.max(0.05, now))));
}
/** Glowing parts shine on the stage; a codex portrait wants their true colour. */
export function setGlow(on = true) {
  glowing = on;
  for (const [m, base] of glows) m.color.copy(on ? lit(base, 1.45) : base);
}
function material(color: string, kind: "toon" | "glow" | "flat") {
  const key = `${kind}:${color}`;
  let m = materials.get(key);
  if (!m) {
    m =
      kind === "toon"
        ? new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() })
        : new THREE.MeshBasicMaterial({ color });
    if (kind === "toon" && DARK) {
      // Moonlight catching the edges that turn away from the eye.
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float edge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
           outgoingLight += vec3(0.32, 0.62, 0.95) * smoothstep(0.35, 0.8, edge) * 0.7;
           #include <opaque_fragment>`,
        );
      };
      m.customProgramCacheKey = () => "toon-rim";
    }
    if (kind === "glow") {
      const glow = m as THREE.MeshBasicMaterial;
      glows.push([glow, glow.color.clone()]);
      if (glowing) glow.color.copy(lit(glow.color, 1.45));
    }
    m.side = THREE.DoubleSide;
    materials.set(key, m);
  }
  return m;
}
function outlineMaterial(thickness: number) {
  const key = `outline:${thickness.toFixed(3)}`;
  let m = materials.get(key);
  if (!m) {
    const basic = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    basic.onBeforeCompile = (shader) => {
      shader.uniforms.thickness = { value: thickness };
      shader.vertexShader =
        "uniform float thickness;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed += normalize(normal) * thickness;",
        );
    };
    basic.customProgramCacheKey = () => key;
    m = basic;
    materials.set(key, m);
  }
  return m;
}

class Kit {
  root = new THREE.Group();
  rig: Rig = { wings: [], tails: [], orbit: [], hover: 0 };
  constructor(private silhouette: boolean) {}

  private place(obj: THREE.Object3D, opt: Opt) {
    if (opt.p) obj.position.set(...opt.p);
    if (opt.r) obj.rotation.set(...opt.r);
    if (opt.s != null)
      typeof opt.s === "number" ? obj.scale.setScalar(opt.s) : obj.scale.set(...opt.s);
    (opt.parent ?? this.root).add(obj);
  }
  /** An empty pivot, for parts that move together. */
  pivot(opt: Opt = {}) {
    const g = new THREE.Group();
    this.place(g, opt);
    return g;
  }
  add(geo: THREE.BufferGeometry, color: string, opt: Opt = {}) {
    const mesh = new THREE.Mesh(
      geo,
      this.silhouette
        ? material(INK, "flat")
        : material(color, opt.glow ? "glow" : "toon"),
    );
    this.place(mesh, opt);
    if (!this.silhouette && opt.o !== false && !opt.glow) {
      const s = mesh.scale;
      const mean = (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3 || 1;
      mesh.add(new THREE.Mesh(geo, outlineMaterial((opt.o ?? 0.028) / mean)));
    }
    return mesh;
  }
  /** Two dark eyes with a highlight, at ±x. */
  eyes(parent: THREE.Object3D, y: number, z: number, spread: number, size = 0.07) {
    for (const side of [-1, 1]) {
      this.add(sphere(size), INK, { p: [side * spread, y, z], o: false, parent });
      this.add(sphere(size * 0.35), "#ffffff", {
        p: [side * spread + size * 0.3, y + size * 0.35, z + size * 0.75],
        glow: true,
        parent,
      });
    }
  }
}

// Shapes

const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, length: number) => new THREE.CapsuleGeometry(r, length, 6, 14);
const cone = (r: number, h: number, sides = 14) => new THREE.ConeGeometry(r, h, sides);
const cylinder = (top: number, bottom: number, h: number, sides = 16) =>
  new THREE.CylinderGeometry(top, bottom, h, sides);
const torus = (r: number, tube: number, arc = Math.PI * 2) =>
  new THREE.TorusGeometry(r, tube, 8, 28, arc);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

/** A tube along a smooth curve through `points`, tapering from r0 to r1. */
function tube(
  points: V3[],
  r0: number,
  r1: number,
  profile: (t: number) => number = (t) => t,
) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segments = Math.max(12, points.length * 8);
  const radial = 10;
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position;
  const centre = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const r = r0 + (r1 - r0) * profile(t);
    for (let j = 0; j <= radial; j++) {
      const n = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, n).sub(centre).multiplyScalar(r).add(centre);
      pos.setXYZ(n, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
/** A thin flat piece cut from an outline in the XY plane, for wings and fins. */
function flat(points: [number, number][], depth = 0.05) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
/** A smooth leaf or feather outline from the origin to (length, 0). */
function leaf(length: number, width: number, n = 10): [number, number][] {
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(Math.PI * Math.pow(t, 0.7)) * width;
    top.push([t * length, w]);
    bottom.unshift([t * length, -w]);
  }
  return [...top, ...bottom.slice(1, -1)];
}

type Build = (k: Kit, c: [string, string, string], stage: number) => void;


/**
 * A spike of fur or a blade of mane: a leaf standing in the plane that runs
 * front to back, rising from `p` and swept back by `sweep` (0 is straight up).
 */
function blade(k: Kit, color: string, p: V3, length: number, width: number, sweep: number, opt: Opt = {}) {
  return k.add(flat(leaf(length, width), 0.03), color, { p, r: [Math.PI / 2 - sweep, Math.PI / 2, 0], o: false, ...opt });
}

/** The storm wolf: lean, long-legged and maned, with a storm caught in its coat. */
const stormwolf: Build = (k, _colors, stage) => {
  const coat = "#46597a";
  const dark = "#1b2434";
  const pale = "#b4cce2";
  const glow = "#7fd0ff";
  const size = stage ? 1.4 : 1.1;
  const body = k.pivot({ s: size });
  const on = (opt: Opt = {}): Opt => ({ parent: body, ...opt });
  // A deep chest that tucks up to a narrow waist.
  const chest = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.5)), 0.8);
  k.add(tube([[0, 0.94, -0.6], [0, 0.93, -0.2], [0, 0.98, 0.22], [0, 1.1, 0.52]], 0.17, 0.38, chest), coat, on({ s: [0.82, 1, 1] }));
  k.add(tube([[0, 0.8, 0.3], [0, 0.74, 0.0], [0, 0.82, -0.3]], 0.1, 0.2, (t) => Math.sin(Math.PI * t)), pale, on({ s: [0.6, 1, 1], o: false }));
  // Legs with their joints: shoulder, elbow, wrist; hip, knee, hock.
  for (const side of [-1, 1]) {
    const x = side * 0.19;
    const thin = (t: number) => Math.pow(t, 0.55);
    k.add(tube([[x, 1.02, 0.4], [x * 1.1, 0.66, 0.3], [x * 1.1, 0.34, 0.4], [x * 1.1, 0.07, 0.42]], 0.15, 0.05, thin), coat, on());
    k.add(tube([[x, 1.0, -0.5], [x * 1.15, 0.62, -0.34], [x * 1.15, 0.36, -0.64], [x * 1.15, 0.07, -0.54]], 0.2, 0.05, thin), coat, on());
    // Shoulder and haunch.
    k.add(sphere(0.19), coat, on({ p: [x * 1.05, 1.0, 0.4], s: [0.6, 1.25, 0.95], o: false }));
    k.add(sphere(0.23), coat, on({ p: [x * 1.05, 0.95, -0.46], s: [0.6, 1.2, 1.1], o: false }));
    for (const z of [0.46, -0.5]) {
      k.add(sphere(0.085), dark, on({ p: [x * 1.12, 0.06, z], s: [1, 0.6, 1.5] }));
      for (let c = -1; c <= 1; c++)
        k.add(cone(0.017, 0.07, 5), "#e8f4ff", on({ p: [x * 1.12 + c * 0.045, 0.035, z + 0.13], r: [Math.PI / 2 + 0.3, 0, 0], o: false }));
    }
    // Lightning running down the flank.
    k.add(tube([[side * 0.25, 1.05, 0.25], [side * 0.27, 0.92, 0.1], [side * 0.245, 0.99, -0.05], [side * 0.23, 0.9, -0.28]], 0.016, 0.004), glow, on({ glow: true }));
    if (stage)
      k.add(tube([[side * 0.2, 0.75, 0.33], [side * 0.225, 0.55, 0.3], [side * 0.215, 0.45, 0.35]], 0.012, 0.003), glow, on({ glow: true }));
  }
  // Neck and a head carried low and forward.
  k.add(tube([[0, 1.06, 0.42], [0, 1.24, 0.66], [0, 1.36, 0.84]], 0.22, 0.13), coat, on({ s: [0.85, 1, 1] }));
  const head = k.pivot(on({ p: [0, 1.4, 0.9], r: [0.18, 0, 0] }));
  k.rig.head = head;
  const at = (opt: Opt = {}): Opt => ({ parent: head, ...opt });
  k.add(sphere(0.19), coat, at({ s: [0.9, 0.82, 1.1] }));
  k.add(cylinder(0.045, 0.13, 0.4, 12), coat, at({ p: [0, -0.03, 0.3], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.8] }));
  k.add(cylinder(0.04, 0.085, 0.32, 10), dark, at({ p: [0, -0.125, 0.25], r: [Math.PI / 2 + 0.16, 0, 0], s: [1, 1, 0.55] }));
  k.add(sphere(0.028), "#07090d", at({ p: [0, 0.0, 0.5], s: [1.2, 0.8, 1], o: false }));
  for (const side of [-1, 1]) {
    // Fangs, a heavy brow and a narrow burning eye.
    k.add(cone(0.012, 0.06, 5), "#f4f8ff", at({ p: [side * 0.04, -0.105, 0.43], r: [Math.PI, 0, 0], o: false }));
    k.add(sphere(0.02), glow, at({ p: [side * 0.105, 0.035, 0.15], s: [1.6, 0.4, 0.8], r: [0, side * 0.5, side * -0.45], glow: true }));
    // Ears laid back, and fur swept off the cheeks.
    k.add(flat(leaf(0.3, 0.08), 0.03), dark, at({ p: [side * 0.11, 0.1, -0.04], r: [Math.PI / 2 - 0.75, Math.PI / 2 - side * 0.35, 0] }));
    for (let i = 0; i < 3; i++)
      k.add(flat(leaf(0.22 + i * 0.05, 0.045), 0.02), coat, at({ p: [side * 0.15, -0.06 + i * 0.045, 0.0], r: [0.25 * i - 0.2, side > 0 ? 1.15 : Math.PI - 1.15, 0], o: false }));
    if (stage) {
      // Horns swept back over the skull, their tips alight.
      const horn: V3[] = [[side * 0.07, 0.12, 0.0], [side * 0.13, 0.3, -0.1], [side * 0.17, 0.4, -0.32], [side * 0.14, 0.42, -0.55]];
      k.add(tube(horn, 0.04, 0.006), "#cfdbe8", at());
      k.add(tube([horn[2], [side * 0.155, 0.415, -0.44], horn[3]], 0.02, 0.005), glow, at({ glow: true }));
    }
  }
  // A mane of fur that stands off the neck, and a ridge of it down the spine.
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 11; i++) {
      const a = ((i + (row % 2) * 0.5) / 10.5 - 0.5) * 4.6;
      const out = k.pivot(on({ p: [0, 1.2 - row * 0.03, 0.62 - row * 0.15], r: [-0.95 - row * 0.12, 0, a] }));
      k.add(cone(0.085, 0.42 + ((i * 7 + row * 3) % 5) * 0.05, 5), (i + row) % 3 ? coat : dark, { p: [0, 0.3 - row * 0.02, 0], s: [1, 1, 0.55], o: false, parent: out });
    }
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    k.add(cone(0.06, 0.3 - t * 0.12, 4), i % 2 ? dark : coat, on({ p: [0, 1.3 - t * 0.2, 0.2 - t * 0.78], r: [-1.0 - t * 0.2, 0, 0], s: [0.6, 1, 1], o: false }));
  }
  // Fur on the chest.
  for (let i = 0; i < 5; i++)
    k.add(cone(0.07, 0.3, 4), i % 2 ? pale : coat, on({ p: [(i - 2) * 0.07, 0.86 - Math.abs(i - 2) * 0.03, 0.56], r: [Math.PI - 0.5, 0, (i - 2) * 0.12], s: [1, 1, 0.5], o: false }));
  // The tail: brush strokes streaming behind, with storm light among them.
  const tail = k.pivot(on({ p: [0, 0.98, -0.6] }));
  k.rig.tails.push(tail);
  const strands = stage ? 7 : 4;
  for (let i = 0; i < strands; i++) {
    const f = i / (strands - 1) - 0.5;
    const lit = stage && i % 3 === 1;
    k.add(
      tube([[0, 0, 0], [f * 0.25, 0.22 + Math.abs(f) * 0.1, -0.3], [f * 0.55, 0.42 - Math.abs(f) * 0.25, -0.62], [f * 0.75, 0.3 - Math.abs(f) * 0.3, -0.95 - (i % 2) * 0.12]], lit ? 0.03 : 0.11, 0.004, (t) => Math.pow(t, 0.7)),
      lit ? glow : i % 2 ? coat : dark,
      { parent: tail, glow: !!lit, o: false },
    );
  }
  if (stage) {
    // Sparks that circle it.
    const ring = k.pivot(on({ p: [0, 0.95, 0] }));
    k.rig.orbit.push(ring);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.add(sphere(0.014), glow, { p: [Math.cos(a) * 0.62, Math.sin(a * 2) * 0.22, Math.sin(a) * 0.9], glow: true, parent: ring });
    }
  }
};

// The twelve forms

const hound: Build = (k, [body, accent, glow], stage) => {
  k.add(capsule(0.3, 0.45), body, { p: [0, 0.52, 0], r: [Math.PI / 2, 0, 0] });
  for (const [x, z] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.26], [0.18, -0.26]])
    k.add(capsule(0.09, 0.2), body, { p: [x, 0.19, z] });
  for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.24], [0.18, -0.24]])
    k.add(sphere(0.1), accent, { p: [x, 0.07, z + 0.03], s: [1, 0.6, 1.2] });
  const head = k.pivot({ p: [0, 0.92, 0.42] });
  k.rig.head = head;
  k.add(sphere(0.3), body, { parent: head });
  k.add(sphere(0.15), "#ffffff", { p: [0, -0.08, 0.22], s: [1.1, 0.8, 1], parent: head });
  k.add(sphere(0.05), INK, { p: [0, -0.03, 0.37], o: false, parent: head });
  k.eyes(head, 0.06, 0.25, 0.13);
  for (const side of [-1, 1])
    k.add(flat(leaf(0.3, 0.1), 0.06), accent, {
      p: [side * 0.2, 0.2, -0.02],
      r: [0, side > 0 ? 0 : Math.PI, side * -0.9],
      parent: head,
    });
  // A wave-curl ruff around the neck.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.add(torus(0.09, 0.035, Math.PI * 1.4), stage ? "#8d98a8" : accent, {
      p: [Math.cos(a) * 0.24, 0.72 + Math.sin(a) * 0.2, 0.26],
      r: [0, 0, a],
    });
  }
  const tails = stage ? [-0.35, 0.35] : [0];
  for (const lean of tails) {
    const tail = k.pivot({ p: [0, 0.6, -0.5], r: [0, 0, lean] });
    k.rig.tails.push(tail);
    k.add(tube([[0, 0, 0], [0, 0.25, -0.2], [0, 0.55, -0.12], [0, 0.6, 0.12], [0, 0.42, 0.14]], 0.09, 0.04), accent, { parent: tail });
    k.add(sphere(0.08), "#ffffff", { p: [0, 0.42, 0.14], parent: tail });
  }
  if (stage) {
    // A storm collar and lightning horns.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.add(sphere(0.13), "#aab4c4", { p: [Math.cos(a) * 0.3, 0.62 + Math.sin(a) * 0.1, 0.05 + Math.sin(a) * 0.25] });
    }
    for (const side of [-1, 1])
      k.add(flat([[0, 0], [0.1, 0.16], [0.03, 0.16], [0.14, 0.38], [-0.02, 0.2], [0.05, 0.2]], 0.05), glow, {
        p: [side * 0.14, 0.24, 0.02],
        r: [0, 0, side * -0.25],
        glow: true,
        parent: head,
      });
  }
};

const crane: Build = (k, [body, accent, glow], stage) => {
  for (const side of [-1, 1]) {
    k.add(cylinder(0.022, 0.022, 0.62, 6), INK, { p: [side * 0.09, 0.32, 0], o: false });
    k.add(cone(0.07, 0.04, 3), accent, { p: [side * 0.09, 0.02, 0.04], o: false });
  }
  k.add(sphere(0.3), body, { p: [0, 0.8, 0], s: [0.85, 0.8, 1.25] });
  k.add(tube([[0, 0.9, 0.28], [0, 1.2, 0.42], [0, 1.45, 0.3], [0, 1.62, 0.38]], 0.09, 0.055), body);
  const head = k.pivot({ p: [0, 1.66, 0.4] });
  k.rig.head = head;
  k.add(sphere(0.12), body, { parent: head });
  k.add(cone(0.045, 0.3, 8), INK, { p: [0, -0.02, 0.22], r: [Math.PI / 2, 0, 0], o: false, parent: head });
  k.add(sphere(0.07), accent, { p: [0, 0.09, 0], s: [1, 0.6, 1.2], o: false, parent: head });
  k.eyes(head, 0.02, 0.085, 0.085, 0.03);
  for (const side of [-1, 1]) {
    const wing = k.pivot({ p: [side * 0.2, 0.92, -0.02] });
    wing.userData.side = side;
    k.rig.wings.push(wing);
    const span = stage ? 1.05 : 0.8;
    for (let i = 0; i < 4; i++)
      k.add(flat(leaf(span * (1 - i * 0.14), 0.13), 0.04), i > 1 ? accent : body, {
        p: [0, -i * 0.04, -i * 0.1],
        r: [0, side > 0 ? 0 : Math.PI, side * (0.25 - i * 0.2)],
        parent: wing,
      });
  }
  const tail = k.pivot({ p: [0, 0.8, -0.34] });
  k.rig.tails.push(tail);
  const feathers = stage ? 5 : 3;
  for (let i = 0; i < feathers; i++) {
    const a = (i - (feathers - 1) / 2) * 0.32;
    const len = stage ? 1.1 : 0.5;
    k.add(tube([[0, 0, 0], [Math.sin(a) * len * 0.5, 0.1, -len * 0.5], [Math.sin(a) * len, -0.2 * stage, -len]], 0.05, 0.015), i % 2 ? glow : accent, { parent: tail, glow: i % 2 === 1 });
  }
  if (stage)
    k.add(torus(0.3, 0.03), glow, { p: [0, 1.7, 0.2], glow: true });
};

const turtle: Build = (k, [body, accent, glow], stage) => {
  k.add(sphere(0.55), body, { p: [0, 0.3, 0], s: [1, 0.35, 1.15] });
  k.add(new THREE.SphereGeometry(0.56, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, { p: [0, 0.3, 0], s: [1, 0.85, 1.12] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(sphere(0.14), glow, { p: [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.34], s: [1, 0.3, 1], o: false });
  }
  k.add(sphere(0.17), glow, { p: [0, 0.76, 0], s: [1, 0.3, 1], o: false });
  for (const [x, z] of [[-0.42, 0.38], [0.42, 0.38], [-0.42, -0.36], [0.42, -0.36]])
    k.add(sphere(0.15), body, { p: [x, 0.13, z], s: [1, 0.8, 1.2] });
  k.add(cone(0.07, 0.25, 8), body, { p: [0, 0.25, -0.68], r: [-Math.PI / 2, 0, 0] });
  const head = k.pivot({ p: [0, 0.48, 0.72] });
  k.rig.head = head;
  k.add(capsule(0.12, 0.2), body, { p: [0, -0.1, -0.14], r: [1.1, 0, 0], parent: head });
  k.add(sphere(0.2), body, { parent: head });
  k.eyes(head, 0.04, 0.16, 0.1, 0.035);
  // An old sage's brows and beard.
  for (const side of [-1, 1])
    k.add(capsule(0.025, 0.12), "#ffffff", { p: [side * 0.12, 0.12, 0.15], r: [0, 0, side * 1.1], parent: head });
  k.add(cone(0.07, 0.3, 8), "#ffffff", { p: [0, -0.24, 0.12], r: [Math.PI, 0, 0], parent: head });
  if (stage) {
    // A small mountain grows on its back.
    for (const [x, z, h, r] of [[0, 0, 0.8, 0.3], [-0.24, 0.12, 0.5, 0.22], [0.22, -0.1, 0.58, 0.24]]) {
      k.add(cone(r, h, 7), "#6f7f78", { p: [x, 0.74 + h / 2, z] });
      k.add(cone(r * 0.42, h * 0.4, 7), "#ffffff", { p: [x, 0.74 + h * 0.81, z], o: false });
    }
    k.add(cylinder(0.02, 0.02, 0.14, 5), "#5a4326", { p: [0.3, 0.86, 0.24], o: false });
    k.add(cone(0.1, 0.24, 6), "#4f8a5b", { p: [0.3, 1.02, 0.24] });
  }
};

const whale: Build = (k, [body, accent, glow]) => {
  k.rig.hover = 0.45;
  k.add(sphere(0.6), accent, { p: [0, 0.7, 0], s: [0.9, 0.78, 1.35] });
  k.add(sphere(0.56), body, { p: [0, 0.6, 0.06], s: [0.86, 0.7, 1.3], o: false });
  const head = k.pivot({ p: [0, 0.72, 0.5] });
  k.rig.head = head;
  k.eyes(head, 0, 0.14, 0.44, 0.05);
  for (const side of [-1, 1]) {
    // Long whiskers that drift like a dragon's.
    k.add(tube([[side * 0.3, 0.55, 0.62], [side * 0.6, 0.5, 0.75], [side * 0.8, 0.75, 0.55], [side * 0.95, 0.6, 0.3]], 0.03, 0.008), glow, { glow: true });
    const fin = k.pivot({ p: [side * 0.5, 0.5, 0.1] });
    fin.userData.side = side;
    k.rig.wings.push(fin);
    k.add(flat(leaf(0.55, 0.14), 0.06), accent, { r: [0.4, side > 0 ? 0 : Math.PI, side * -0.5], parent: fin });
  }
  const tail = k.pivot({ p: [0, 0.75, -0.7] });
  k.rig.tails.push(tail);
  k.add(tube([[0, 0, 0.1], [0, 0.12, -0.3], [0, 0.4, -0.55]], 0.3, 0.07), accent, { parent: tail });
  for (const side of [-1, 1])
    k.add(flat(leaf(0.5, 0.15), 0.05), accent, { p: [0, 0.4, -0.55], r: [0.9, side > 0 ? 0 : Math.PI, side * 0.35], parent: tail });
  // Glowing tide runes along its back, and a spout.
  for (let i = 0; i < 4; i++)
    k.add(torus(0.08 - i * 0.008, 0.016), glow, { p: [0, 1.17 - i * 0.03 - (i > 1 ? 0.06 : 0), 0.3 - i * 0.26], r: [Math.PI / 2 - 0.2 + i * 0.16, 0, 0], glow: true });
  for (let i = 0; i < 5; i++)
    k.add(sphere(0.05 - i * 0.006), glow, { p: [Math.sin(i * 2.1) * 0.08 * i, 1.32 + i * 0.12, 0.3 + Math.cos(i * 1.7) * 0.05 * i], glow: true });
  for (const [x, z, r] of [[-0.5, 0.3, 0.2], [0.45, -0.3, 0.24], [0.1, 0.6, 0.16], [-0.3, -0.5, 0.2]])
    k.add(sphere(r), "#ffffff", { p: [x, 0.1, z], s: [1.4, 0.6, 1] });
};

const lantern: Build = (k, [body, accent, glow], stage) => {
  k.rig.hover = 0.35;
  const head = k.pivot({ p: [0, 0.75, 0] });
  k.rig.head = head;
  if (stage) {
    k.add(cylinder(0.34, 0.3, 0.6, 6), body, { parent: head });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      k.add(cylinder(0.025, 0.025, 0.62, 5), accent, { p: [Math.cos(a) * 0.33, 0, Math.sin(a) * 0.33], o: false, parent: head });
      k.add(sphere(0.05), glow, { p: [Math.cos(a) * 0.5, 0.36, Math.sin(a) * 0.5], glow: true, parent: head });
    }
    k.add(cone(0.52, 0.3, 6), accent, { p: [0, 0.45, 0], parent: head });
    k.add(sphere(0.07), "#e7c47a", { p: [0, 0.64, 0], parent: head });
  } else {
    k.add(sphere(0.36), body, { s: [1, 0.9, 1], parent: head });
    for (let i = 0; i < 6; i++)
      k.add(torus(0.365, 0.014), accent, { r: [0, (i / 6) * Math.PI, 0], s: [1, 0.9, 1], o: false, parent: head });
    k.add(torus(0.1, 0.02), INK, { p: [0, 0.46, 0], o: false, parent: head });
  }
  k.add(cylinder(0.17, 0.2, 0.08), INK, { p: [0, 0.34, 0], o: false, parent: head });
  k.add(cylinder(0.2, 0.15, 0.08), INK, { p: [0, -0.34, 0], o: false, parent: head });
  k.eyes(head, 0.02, stage ? 0.31 : 0.33, 0.11, 0.05);
  k.add(torus(0.05, 0.014, Math.PI), INK, { p: [0, -0.08, stage ? 0.31 : 0.345], r: [0, 0, Math.PI], o: false, parent: head });
  for (const x of stage ? [-0.12, 0.12] : [0]) {
    const tassel = k.pivot({ p: [x, 0.38, 0] });
    k.rig.tails.push(tassel);
    k.add(cylinder(0.012, 0.012, 0.2, 5), accent, { p: [0, -0.08, 0], o: false, parent: tassel });
    k.add(sphere(0.045), "#e7c47a", { p: [0, -0.18, 0], parent: tassel });
    k.add(cone(0.06, 0.24, 8), accent, { p: [0, -0.32, 0], parent: tassel });
  }
  // Little flame hands.
  for (const side of [-1, 1]) {
    const hand = k.pivot({ p: [side * 0.48, 0.72, 0.1] });
    hand.userData.side = side;
    k.rig.wings.push(hand);
    k.add(cone(0.07, 0.2, 8), glow, { glow: true, parent: hand });
    k.add(sphere(0.07), glow, { p: [0, -0.1, 0], glow: true, parent: hand });
  }
  if (stage) k.add(cone(0.08, 0.26, 8), glow, { p: [0, 1.56, 0], glow: true });
};

const monkey: Build = (k, [body, accent, glow], stage) => {
  k.add(capsule(0.2, 0.22), accent, { p: [0, 0.48, 0] });
  k.add(sphere(0.15), body, { p: [0, 0.46, 0.1], s: [1, 1.2, 0.7], o: false });
  for (const side of [-1, 1]) {
    k.add(capsule(0.06, 0.2), accent, { p: [side * 0.12, 0.16, 0.05], r: [0, 0, side * 0.2] });
    k.add(sphere(0.08), body, { p: [side * 0.15, 0.05, 0.1], s: [1, 0.6, 1.4] });
  }
  k.add(capsule(0.05, 0.3), accent, { p: [-0.28, 0.5, 0.05], r: [0, 0, -0.5] });
  const arm = k.pivot({ p: [0.2, 0.62, 0.05] });
  arm.userData.side = 1;
  k.rig.wings.push(arm);
  k.add(capsule(0.05, 0.3), accent, { p: [0.14, 0.12, 0], r: [0, 0, -0.9], parent: arm });
  // The brush it stole.
  const len = stage ? 0.9 : 0.6;
  k.add(cylinder(0.022, 0.022, len, 6), "#a77b3f", { p: [0.3, 0.3, 0.02], parent: arm });
  k.add(cone(0.06, 0.2, 8), INK, { p: [0.3, 0.3 + len / 2 + 0.1, 0.02], o: false, parent: arm });
  const head = k.pivot({ p: [0, 0.98, 0.02] });
  k.rig.head = head;
  k.add(sphere(0.3), accent, { parent: head });
  k.add(sphere(0.23), body, { p: [0, -0.03, 0.14], s: [1.05, 0.95, 0.7], o: false, parent: head });
  for (const side of [-1, 1]) {
    k.add(sphere(0.11), accent, { p: [side * 0.3, 0.05, 0], s: [0.6, 1, 1], parent: head });
    k.add(sphere(0.06), body, { p: [side * 0.33, 0.05, 0.03], o: false, parent: head });
  }
  k.eyes(head, 0, 0.29, 0.1, 0.05);
  k.add(sphere(0.03), INK, { p: [0, -0.09, 0.31], o: false, parent: head });
  const tail = k.pivot({ p: [0, 0.4, -0.18] });
  k.rig.tails.push(tail);
  k.add(tube([[0, 0, 0], [0, 0.1, -0.3], [0.05, 0.5, -0.42], [0.1, 0.78, -0.22], [0.05, 0.66, -0.05], [0, 0.56, -0.16]], 0.05, 0.025), accent, { parent: tail });
  k.add(sphere(0.05), glow, { p: [0, 0.56, -0.16], glow: true, parent: tail });
  if (stage) {
    k.add(box(0.36, 0.1, 0.3), INK, { p: [0, 0.3, 0], o: false, parent: head });
    k.add(box(0.6, 0.03, 0.22), INK, { p: [0, 0.36, -0.02], o: false, parent: head });
    for (const side of [-1, 1])
      k.add(capsule(0.025, 0.14), "#ffffff", { p: [side * 0.12, 0.12, 0.27], r: [0, 0, side * 1.2], parent: head });
    k.add(cylinder(0.08, 0.08, 0.6, 10), "#f2ead8", { p: [0, 0.62, -0.26], r: [0, 0, 1.2] });
    for (const side of [-1, 1])
      k.add(cylinder(0.09, 0.09, 0.05, 10), "#b8322a", { p: [side * 0.29, 0.62 + side * 0.112, -0.26], r: [0, 0, 1.2] });
  }
};

const moth: Build = (k, [body, accent, glow], stage) => {
  k.rig.hover = 0.5;
  k.add(capsule(0.14, 0.34), body, { p: [0, 0.62, 0], r: [0.25, 0, 0] });
  for (let i = 0; i < 3; i++)
    k.add(torus(0.145, 0.02), accent, { p: [0, 0.48 + i * 0.12, -0.04 + i * 0.03], r: [Math.PI / 2 + 0.25, 0, 0], o: false });
  const head = k.pivot({ p: [0, 1.0, 0.08] });
  k.rig.head = head;
  k.add(sphere(0.19), body, { parent: head });
  k.add(sphere(0.2), "#ffffff", { p: [0, -0.1, -0.02], s: [1.25, 0.6, 1.1], parent: head });
  k.eyes(head, 0.02, 0.15, 0.1, 0.06);
  for (const side of [-1, 1]) {
    k.add(tube([[side * 0.06, 0.14, 0.05], [side * 0.2, 0.4, 0.1], [side * 0.36, 0.44, 0.16]], 0.022, 0.012), accent, { parent: head });
    for (let i = 0; i < 4; i++)
      k.add(sphere(0.035 - i * 0.004), glow, { p: [side * (0.16 + i * 0.06), 0.33 + i * 0.035, 0.09 + i * 0.02], glow: true, parent: head });
    const wing = k.pivot({ p: [side * 0.1, 0.72, -0.05] });
    wing.userData.side = side;
    k.rig.wings.push(wing);
    const big = stage ? 1.25 : 1;
    const flip = side > 0 ? 0 : Math.PI;
    k.add(flat(leaf(0.8 * big, 0.34 * big), 0.04), body, { r: [0, flip, side * 0.5], parent: wing });
    k.add(flat(leaf(0.55 * big, 0.26 * big), 0.04), accent, { p: [0, -0.05, -0.03], r: [0, flip, side * -0.45], parent: wing });
    // Eye-spots, and a bell that rings as it flies.
    k.add(cylinder(0.11 * big, 0.11 * big, 0.06, 16), glow, { p: [side * 0.42 * big, 0.24 * big, 0], r: [Math.PI / 2, 0, 0], glow: true, parent: wing });
    k.add(cylinder(0.05 * big, 0.05 * big, 0.07, 12), INK, { p: [side * 0.42 * big, 0.24 * big, 0], r: [Math.PI / 2, 0, 0], o: false, parent: wing });
    bell(k, wing, [side * 0.36 * big, -0.36 * big, 0], 0.07);
  }
  if (stage) {
    bell(k, k.root, [0, 0.24, 0.05], 0.16);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.add(cone(0.035, 0.12, 5), "#e7c47a", { p: [Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1], parent: head });
    }
  }
};
function bell(k: Kit, parent: THREE.Object3D, p: V3, r: number) {
  k.add(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#c9a04a", { p, s: [1, 1.3, 1], parent });
  k.add(torus(r, r * 0.16), "#c9a04a", { p, r: [Math.PI / 2, 0, 0], parent });
  k.add(sphere(r * 0.3), INK, { p: [p[0], p[1] - r * 0.25, p[2]], o: false, parent });
}

const lion: Build = (k, [body, accent, glow]) => {
  k.add(capsule(0.4, 0.4), body, { p: [0, 0.62, -0.05], r: [Math.PI / 2 - 0.35, 0, 0] });
  for (const [x, z, h] of [[-0.3, 0.32, 0.36], [0.3, 0.32, 0.36], [-0.32, -0.36, 0.2], [0.32, -0.36, 0.2]]) {
    k.add(capsule(0.13, h), body, { p: [x, 0.16 + h / 2, z] });
    k.add(sphere(0.16), body, { p: [x, 0.09, z + 0.05], s: [1, 0.6, 1.25] });
  }
  // A golden ball under one paw.
  k.add(sphere(0.17), "#e7c47a", { p: [0.36, 0.17, 0.56] });
  k.add(torus(0.17, 0.015), accent, { p: [0.36, 0.17, 0.56], o: false });
  const head = k.pivot({ p: [0, 1.1, 0.3] });
  k.rig.head = head;
  // A mane of flame curls.
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + ring * 0.35;
      const r = 0.42 - ring * 0.02;
      k.add(sphere(0.17 - ring * 0.02), ring ? "#d9772b" : accent, {
        p: [Math.cos(a) * r, Math.sin(a) * r, -0.12 - ring * 0.2],
        parent: head,
      });
    }
  k.add(sphere(0.4), body, { s: [1, 0.92, 0.95], parent: head });
  k.add(sphere(0.2), body, { p: [0, -0.14, 0.3], s: [1.3, 0.8, 1], parent: head });
  k.add(sphere(0.07), INK, { p: [0, -0.05, 0.47], s: [1.3, 0.8, 1], o: false, parent: head });
  k.add(box(0.26, 0.04, 0.04), INK, { p: [0, -0.24, 0.43], o: false, parent: head });
  for (const side of [-1, 1]) {
    k.add(cone(0.035, 0.1, 6), "#ffffff", { p: [side * 0.1, -0.29, 0.42], r: [Math.PI, 0, 0], o: false, parent: head });
    k.add(sphere(0.11), body, { p: [side * 0.3, 0.3, 0], parent: head });
    k.add(flat(leaf(0.26, 0.06), 0.05), glow, { p: [side * 0.07, 0.17, 0.36], r: [0, side > 0 ? 0 : Math.PI, side * 0.5], glow: true, parent: head });
  }
  k.eyes(head, 0.06, 0.35, 0.16, 0.06);
  k.add(torus(0.36, 0.035), "#e7c47a", { p: [0, 0.84, 0.2], r: [Math.PI / 2 - 0.4, 0, 0] });
  bell(k, k.root, [0, 0.72, 0.52], 0.09);
  const tail = k.pivot({ p: [0, 0.5, -0.5] });
  k.rig.tails.push(tail);
  k.add(tube([[0, 0, 0], [0, 0.3, -0.3], [0, 0.72, -0.25], [0, 0.85, 0]], 0.07, 0.05), body, { parent: tail });
  for (let i = 0; i < 4; i++)
    k.add(cone(0.1 - i * 0.015, 0.28, 8), i % 2 ? glow : accent, { p: [(i - 1.5) * 0.06, 0.95 + (i % 2) * 0.06, 0.02], r: [0, 0, (i - 1.5) * -0.3], glow: i % 2 === 1, parent: tail });
};

const deer: Build = (k, [body, accent, glow], stage) => {
  k.add(capsule(0.24, 0.42), body, { p: [0, 0.7, 0], r: [Math.PI / 2, 0, 0] });
  for (const [x, z] of [[-0.14, 0.26], [0.14, 0.26], [-0.14, -0.26], [0.14, -0.26]]) {
    k.add(cylinder(0.045, 0.035, 0.5, 8), body, { p: [x, 0.3, z] });
    k.add(cylinder(0.045, 0.05, 0.08, 8), "#5a4326", { p: [x, 0.04, z], o: false });
  }
  // Moss and flowers on its back.
  for (const [x, z, r] of [[0, 0.1, 0.17], [-0.1, -0.12, 0.13], [0.11, -0.2, 0.12]])
    k.add(sphere(r), accent, { p: [x, 0.92, z], s: [1.2, 0.45, 1.2] });
  for (const [x, z] of [[0.05, 0.14], [-0.12, -0.14], [0.14, -0.22]])
    k.add(sphere(0.045), "#f6b8c6", { p: [x, 1.0, z], glow: true });
  k.add(tube([[0, 0.8, 0.26], [0, 1.05, 0.4], [0, 1.25, 0.42]], 0.13, 0.1), body);
  const head = k.pivot({ p: [0, 1.32, 0.46] });
  k.rig.head = head;
  k.add(sphere(0.2), body, { s: [1, 0.95, 1.1], parent: head });
  k.add(sphere(0.11), "#ffffff", { p: [0, -0.07, 0.17], s: [1, 0.8, 1.1], parent: head });
  k.add(sphere(0.035), INK, { p: [0, -0.04, 0.28], o: false, parent: head });
  k.eyes(head, 0.04, 0.15, 0.11, 0.055);
  for (const side of [-1, 1]) {
    k.add(flat(leaf(0.26, 0.08), 0.05), body, { p: [side * 0.15, 0.08, -0.04], r: [0, side > 0 ? 0 : Math.PI, side * -0.4], parent: head });
    // Antlers that branch as it grows, budding leaves and blossoms.
    const reach = stage ? 1 : 0.45;
    const base: V3 = [side * 0.08, 0.16, -0.02];
    const tip: V3 = [side * (0.12 + 0.3 * reach), 0.2 + 0.6 * reach, -0.08];
    k.add(tube([base, [side * (0.1 + 0.26 * reach), 0.2 + 0.3 * reach, -0.04], tip], 0.035, 0.018), "#6b4f2c", { parent: head });
    const twigs = stage ? 3 : 1;
    for (let i = 0; i < twigs; i++) {
      const t = (i + 1) / (twigs + 1);
      const from: V3 = [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, -0.04];
      const to: V3 = [from[0] + side * 0.2 * (i % 2 ? -0.6 : 1), from[1] + 0.2, 0.02];
      k.add(tube([from, to], 0.022, 0.012), "#6b4f2c", { parent: head });
      k.add(sphere(0.05), i % 2 ? "#f6b8c6" : glow, { p: to, glow: true, parent: head });
    }
    k.add(sphere(0.05), glow, { p: tip, glow: true, parent: head });
  }
  if (stage) k.add(cone(0.07, 0.24, 8), accent, { p: [0, -0.26, 0.1], r: [Math.PI, 0, 0], parent: head });
  const tail = k.pivot({ p: [0, 0.82, -0.44] });
  k.rig.tails.push(tail);
  k.add(sphere(0.09), "#ffffff", { p: [0, 0.03, -0.04], parent: tail });
};

const fox: Build = (k, [body, accent, glow], stage) => {
  k.add(capsule(0.22, 0.4), body, { p: [0, 0.48, 0], r: [Math.PI / 2 - 0.25, 0, 0] });
  for (const [x, z, h] of [[-0.13, 0.26, 0.3], [0.13, 0.26, 0.3], [-0.15, -0.2, 0.16], [0.15, -0.2, 0.16]]) {
    k.add(capsule(0.06, h), body, { p: [x, 0.1 + h / 2, z] });
    k.add(sphere(0.07), accent, { p: [x, 0.05, z + 0.03], s: [1, 0.6, 1.3] });
  }
  k.add(sphere(0.18), "#ffffff", { p: [0, 0.56, 0.24], s: [1, 1.1, 0.8] });
  const head = k.pivot({ p: [0, 0.98, 0.32] });
  k.rig.head = head;
  k.add(sphere(0.26), body, { s: [1.1, 0.9, 1], parent: head });
  k.add(cone(0.13, 0.3, 10), body, { p: [0, -0.07, 0.3], r: [Math.PI / 2, 0, 0], parent: head });
  k.add(sphere(0.04), INK, { p: [0, -0.06, 0.45], o: false, parent: head });
  for (const side of [-1, 1]) {
    k.add(cone(0.11, 0.32, 4), body, { p: [side * 0.17, 0.3, -0.02], r: [0, 0.6, side * -0.25], parent: head });
    k.add(cone(0.06, 0.2, 4), accent, { p: [side * 0.17, 0.29, 0.02], r: [0, 0.6, side * -0.25], o: false, parent: head });
    k.add(sphere(0.1), "#ffffff", { p: [side * 0.2, -0.1, 0.1], s: [1.2, 0.7, 0.9], parent: head });
  }
  k.eyes(head, 0.02, 0.21, 0.12, 0.05);
  k.add(torus(0.07, 0.02, Math.PI), glow, { p: [0, 0.16, 0.2], r: [-0.3, 0, Math.PI / 2 + 0.4], glow: true, parent: head });
  const count = stage ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const a = (i - (count - 1) / 2) * (stage ? 0.42 : 0.5);
    const tail = k.pivot({ p: [0, 0.42, -0.36], r: [0, 0, -a] });
    k.rig.tails.push(tail);
    k.add(tube([[0, 0, 0], [0, 0.3, -0.34], [0, 0.72, -0.4], [0, 1.02, -0.2]], 0.07, 0.03, (t) => (t < 0.6 ? -t * 1.3 : (t - 0.6) * 4.4 - 0.78)), body, { parent: tail });
    k.add(sphere(0.07), glow, { p: [0, 1.04, -0.19], glow: true, parent: tail });
  }
  if (stage) k.add(torus(0.62, 0.035, Math.PI * 1.25), glow, { p: [0, 1.0, -0.5], r: [0, 0, Math.PI * 0.9], glow: true });
};

const serpent: Build = (k, [body, accent, glow], stage) => {
  const coil: V3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = t * Math.PI * 4.2;
    const r = 0.5 - t * 0.3;
    coil.push([Math.cos(a) * r, 0.12 + t * 0.95, Math.sin(a) * r]);
  }
  coil.push([0.02, 1.2, 0.28], [0, 1.28, 0.42]);
  k.add(tube(coil, 0.05, 0.16, (t) => Math.min(1, t * 2.4)), accent);
  for (let i = 2; i < coil.length - 2; i += 2)
    k.add(sphere(0.05), glow, { p: [coil[i][0] * 1.22, coil[i][1], coil[i][2] * 1.22], glow: true });
  const head = k.pivot({ p: [0, 1.32, 0.5] });
  k.rig.head = head;
  k.add(sphere(0.2), accent, { s: [1, 0.85, 1.25], parent: head });
  k.add(sphere(0.16), body, { p: [0, -0.07, 0.04], s: [1, 0.6, 1.3], o: false, parent: head });
  k.eyes(head, 0.05, 0.16, 0.12, 0.05);
  for (const side of [-1, 1]) {
    const frill = k.pivot({ p: [side * 0.15, 0.02, -0.08], parent: head });
    frill.userData.side = side;
    k.rig.wings.push(frill);
    k.add(flat(leaf(0.3, 0.12), 0.04), glow, { r: [0, side > 0 ? 0 : Math.PI, side * 0.3], glow: true, parent: frill });
    if (stage) {
      k.add(cone(0.04, 0.26, 6), "#e7c47a", { p: [side * 0.09, 0.22, -0.06], r: [-0.5, 0, side * -0.3], parent: head });
      k.add(tube([[side * 0.1, -0.04, 0.22], [side * 0.3, 0.02, 0.4], [side * 0.42, -0.14, 0.34]], 0.02, 0.006), glow, { glow: true, parent: head });
    }
  }
  if (stage)
    for (let i = 3; i < coil.length - 3; i++)
      k.add(cone(0.05, 0.16, 5), glow, { p: [coil[i][0] * 1.05, coil[i][1] + 0.16, coil[i][2] * 1.05], glow: true });
};

const dragon: Build = (k, [body, accent, glow]) => {
  k.rig.hover = 0.3;
  const spine: V3[] = [
    [-0.75, 0.35, -0.75], [-0.2, 0.2, -0.85], [0.5, 0.4, -0.6], [0.7, 0.8, -0.1],
    [0.2, 1.05, 0.15], [-0.4, 1.0, 0.2], [-0.55, 1.35, 0.35], [-0.15, 1.6, 0.45], [0.1, 1.62, 0.6],
  ];
  k.add(tube(spine, 0.05, 0.2, (t) => Math.min(1, t * 2.2)), accent);
  const curve = new THREE.CatmullRomCurve3(spine.map((p) => new THREE.Vector3(...p)));
  // A mane of leaves down its back, and bark-pale belly scales.
  for (let i = 1; i < 16; i++) {
    const p = curve.getPointAt(i / 17);
    k.add(cone(0.06, 0.2, 5), i % 3 ? "#4f8a5b" : glow, { p: [p.x, p.y + 0.14 + Math.min(1, (i / 17) * 2.2) * 0.1, p.z], glow: i % 3 === 0 });
  }
  for (const t of [0.35, 0.62]) {
    const p = curve.getPointAt(t);
    for (const side of [-1, 1]) {
      k.add(capsule(0.05, 0.16), accent, { p: [p.x + side * 0.16, p.y - 0.2, p.z + 0.05], r: [0, 0, side * 0.5] });
      k.add(sphere(0.07), body, { p: [p.x + side * 0.22, p.y - 0.32, p.z + 0.08] });
    }
  }
  const tail = k.pivot({ p: spine[0] });
  k.rig.tails.push(tail);
  for (let i = 0; i < 5; i++)
    k.add(flat(leaf(0.34, 0.09), 0.04), i % 2 ? glow : "#4f8a5b", { r: [0, 2.4, (i - 2) * 0.45], glow: i % 2 === 1, parent: tail });
  const head = k.pivot({ p: [0.14, 1.66, 0.72] });
  k.rig.head = head;
  k.add(sphere(0.26), accent, { s: [1, 0.85, 1.2], parent: head });
  k.add(sphere(0.17), body, { p: [0, -0.08, 0.26], s: [1.1, 0.75, 1.2], parent: head });
  for (const side of [-1, 1]) {
    k.add(sphere(0.03), INK, { p: [side * 0.07, -0.04, 0.45], o: false, parent: head });
    k.add(tube([[side * 0.14, -0.08, 0.36], [side * 0.42, 0.05, 0.56], [side * 0.6, -0.2, 0.5], [side * 0.7, -0.05, 0.3]], 0.025, 0.006), glow, { glow: true, parent: head });
    // Antlers like old branches, in leaf and blossom.
    const tip: V3 = [side * 0.42, 0.62, -0.2];
    k.add(tube([[side * 0.1, 0.16, -0.05], [side * 0.3, 0.36, -0.12], tip], 0.045, 0.02), "#6b4f2c", { parent: head });
    for (const [t, dx] of [[0.45, 0.24], [0.75, -0.16]]) {
      const from: V3 = [side * (0.1 + 0.32 * t), 0.16 + 0.46 * t, -0.1];
      const to: V3 = [from[0] + side * dx, from[1] + 0.18, -0.04];
      k.add(tube([from, to], 0.025, 0.012), "#6b4f2c", { parent: head });
      k.add(sphere(0.055), dx > 0 ? glow : "#f6b8c6", { p: to, glow: true, parent: head });
    }
    k.add(sphere(0.055), glow, { p: tip, glow: true, parent: head });
    k.add(flat(leaf(0.3, 0.08), 0.04), "#4f8a5b", { p: [side * 0.2, 0.02, -0.1], r: [0, side > 0 ? 0.5 : Math.PI - 0.5, side * 0.2], parent: head });
  }
  k.eyes(head, 0.06, 0.2, 0.14, 0.055);
  k.add(cone(0.06, 0.26, 6), "#ffffff", { p: [0, -0.26, 0.26], r: [Math.PI, 0, 0], parent: head });
  // The pearl it guards.
  const pearl = k.pivot({ p: [0, 1.0, 0] });
  k.rig.orbit.push(pearl);
  k.add(sphere(0.11), glow, { p: [0.95, 0.2, 0], glow: true, parent: pearl });
  k.add(torus(0.16, 0.012), glow, { p: [0.95, 0.2, 0], glow: true, parent: pearl });
};

const FORMS: Record<Form, { build: Build; height: number; scale: [number, number] }> = {
  hound: { build: hound, height: 1.3, scale: [1, 1.25] },
  crane: { build: crane, height: 1.85, scale: [0.85, 1.05] },
  turtle: { build: turtle, height: 1.0, scale: [1.05, 1.25] },
  whale: { build: whale, height: 1.7, scale: [1.3, 1.3] },
  lantern: { build: lantern, height: 1.3, scale: [1.05, 1.2] },
  monkey: { build: monkey, height: 1.35, scale: [1.05, 1.25] },
  moth: { build: moth, height: 1.5, scale: [0.95, 1.1] },
  lion: { build: lion, height: 1.6, scale: [1.2, 1.2] },
  deer: { build: deer, height: 1.7, scale: [0.9, 1.05] },
  fox: { build: fox, height: 1.5, scale: [1, 1.15] },
  serpent: { build: serpent, height: 1.6, scale: [0.95, 1.1] },
  dragon: { build: dragon, height: 2.3, scale: [0.85, 0.85] },
};

/** Builds a spirit. `stage` 1 is its evolved form; `silhouette` paints it all ink. */
export function buildSpirit(def: SpiritDef, stage = 0, silhouette = false): Model {
  const form = FORMS[def.form];
  const kit = new Kit(silhouette);
  if (DARK && def.form === "hound") {
    stormwolf(kit, def.colors, stage);
    return { root: kit.root, rig: kit.rig, height: stage ? 2.3 : 1.8 };
  }
  form.build(kit, def.colors, stage);
  const scale = form.scale[stage] ?? form.scale[0];
  kit.root.scale.setScalar(scale);
  return { root: kit.root, rig: kit.rig, height: form.height * scale };
}

/** The clock the painted figures sway to; the stage keeps it running. */
export const cardTime = { value: 0 };
const cardTextures = new Map<string, THREE.Texture>();
/**
 * A figure from a painting, cut out and stood on the stage facing the eye.
 * Its hair and cloth drift a little, more the further they are from its core.
 */
export function buildCard(url: string, aspect: number, height: number, flip = false): Model {
  let map = cardTextures.get(url);
  if (!map) {
    map = new THREE.TextureLoader().load(url);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    cardTextures.set(url, map);
  }
  const geo = new THREE.PlaneGeometry(height * aspect, height, 14, 20);
  geo.translate(0, height / 2, 0);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.cardTime = cardTime;
    shader.vertexShader =
      "uniform float cardTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float away = smoothstep(0.12, 0.5, abs(uv.x - 0.5));
         float sway = sin(cardTime * 1.3 + uv.y * 5.0 + uv.x * 3.0) + 0.5 * sin(cardTime * 2.1 + uv.y * 9.0);
         transformed.x += sway * away * 0.022 * smoothstep(0.0, 0.25, uv.y);
         transformed.y += sin(cardTime * 1.1) * 0.006 * uv.y;`,
      );
  };
  material.customProgramCacheKey = () => "card";
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geo, material);
  if (flip) mesh.scale.x = -1;
  root.add(mesh);
  return { root, rig: { wings: [], tails: [], orbit: [], hover: 0 }, height };
}

export const ROBES: Record<string, [string, string]> = {
  "": ["#f2ead8", "#3a3a3a"],
  "robe-crimson": ["#b8322a", "#e7c47a"],
  "robe-azure": ["#4f86b0", "#f2ead8"],
  "robe-jade": ["#4f8a5b", "#e7c47a"],
};

/** The binder: a young talisman-writer with a giant brush and the codex. */
export function buildBinder(robe = ""): Model {
  const [cloth, trim] = ROBES[robe] ?? ROBES[""];
  const k = new Kit(false);
  k.add(cone(0.34, 0.8, 16), cloth, { p: [0, 0.42, 0] });
  k.add(cylinder(0.36, 0.36, 0.05, 16), trim, { p: [0, 0.05, 0], o: false });
  k.add(torus(0.2, 0.035), trim, { p: [0, 0.52, 0], r: [Math.PI / 2, 0, 0] });
  k.add(sphere(0.06), "#c8442f", { p: [0.12, 0.5, 0.17] });
  k.add(cone(0.03, 0.2, 6), "#c8442f", { p: [0.12, 0.38, 0.17], r: [Math.PI, 0, 0], o: false });
  // The codex at the hip.
  k.add(box(0.2, 0.26, 0.07), "#3a5a78", { p: [-0.26, 0.46, 0.12], r: [0, 0.5, 0.15] });
  k.add(box(0.1, 0.14, 0.075), "#f2ead8", { p: [-0.265, 0.47, 0.125], r: [0, 0.5, 0.15], o: false });
  for (const side of [-1, 1]) {
    const arm = k.pivot({ p: [side * 0.2, 0.74, 0] });
    arm.userData.side = side;
    k.rig.wings.push(arm);
    k.add(cone(0.13, 0.42, 10), cloth, { p: [side * 0.12, -0.14, 0.04], r: [0, 0, side * 0.6], parent: arm });
    k.add(sphere(0.06), "#f1cfae", { p: [side * 0.24, -0.3, 0.06], parent: arm });
    if (side > 0) {
      // A brush as tall as its owner.
      k.add(cylinder(0.028, 0.028, 1.25, 8), "#8a5a2b", { p: [0.26, 0.06, 0.1], parent: arm });
      k.add(cylinder(0.05, 0.04, 0.08, 8), trim, { p: [0.26, 0.7, 0.1], parent: arm });
      k.add(cone(0.075, 0.3, 10), INK, { p: [0.26, 0.88, 0.1], o: false, parent: arm });
    }
  }
  const head = k.pivot({ p: [0, 1.05, 0] });
  k.rig.head = head;
  k.add(sphere(0.25), "#f1cfae", { parent: head });
  k.add(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), INK, { p: [0, 0.02, -0.03], r: [-0.35, 0, 0], o: false, parent: head });
  k.add(sphere(0.11), INK, { p: [0, 0.3, -0.06], parent: head });
  k.add(cylinder(0.012, 0.012, 0.36, 5), "#c8442f", { p: [0, 0.3, -0.06], r: [0, 0, Math.PI / 2 - 0.2], o: false, parent: head });
  k.eyes(head, -0.02, 0.22, 0.09, 0.04);
  for (const side of [-1, 1])
    k.add(sphere(0.04), "#f2a59a", { p: [side * 0.15, -0.08, 0.19], s: [1, 0.6, 0.4], o: false, parent: head });
  return { root: k.root, rig: k.rig, height: 1.4 };
}

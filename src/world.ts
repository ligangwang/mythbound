/**
 * The three.js world: an ink-wash stage for each realm (layered mountains
 * fading into mist, painted on the fly), the binder, the spirits and their
 * animations, the rune burst of a binding, and the codex portraits.
 */
import * as THREE from "three";
import { hash, rng } from "./engine/random";
import { spirit, type RealmId } from "./engine/spirits";
import { INK, buildBinder, buildSpirit, type Model } from "./spirit-models";

export type Place = RealmId | "home";
export type Action = "appear" | "attack" | "hurt" | "bound" | "flee" | "evolve";

type Theme = {
  paper: string;
  ink: string;
  far: string;
  sun: string | null;
  ground: string;
  kind: "peaks" | "city" | "trees";
};
const THEMES: Record<Place, Theme> = {
  home: { paper: "#efe6d2", ink: "#2c2a28", far: "#7d8790", sun: "#c8442f", ground: "#cfc3a8", kind: "peaks" },
  shores: { paper: "#e9e6da", ink: "#27353f", far: "#6f8794", sun: "#c8442f", ground: "#b9c4c4", kind: "peaks" },
  city: { paper: "#f1e2c8", ink: "#3a2a24", far: "#9a7a66", sun: "#e0a23c", ground: "#d2bd9a", kind: "city" },
  wood: { paper: "#dfe3d0", ink: "#1f2c24", far: "#62786a", sun: null, ground: "#aebca0", kind: "trees" },
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

type Actor = {
  model: Model;
  home: THREE.Vector3;
  /** The way it faces at rest. */
  turn: number;
  phase: number;
  action: Action | null;
  started: number;
  scale: number;
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

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.add(this.backdrop, this.actors, this.effects);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b9ae98", 1.5));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(3, 6, 5);
    this.scene.add(sun);

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
    const aspect = w / h;
    this.camera.aspect = aspect;
    // The sheet covers the right of a wide screen and the bottom of any
    // other, so the stage is slid into the part that is left.
    const wide = w >= 900 && h >= 560;
    const tall = aspect < 0.9;
    const distance = tall ? Math.min(19, 6.7 / aspect) : 7.8;
    this.camera.position.set(0, 1.7, distance);
    this.camera.lookAt(-0.3, 0.95, 0);
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
    const theme = THEMES[place];
    for (const child of [...this.backdrop.children]) {
      this.backdrop.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const m = mesh.material as THREE.MeshBasicMaterial | undefined;
      m?.map?.dispose();
      m?.dispose();
    }
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
        new THREE.MeshBasicMaterial({ color: theme.sun, fog: false, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      sun.position.set(-4.5, 6.6, -24.5);
      sun.renderOrder = -20;
      this.backdrop.add(sun);
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
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: "#e0502f" }));
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
  }

  setBinder(robe: string) {
    if (this.binder) this.actors.remove(this.binder.model.root);
    this.binder = this.actor(buildBinder(robe), BINDER, 0.75);
  }

  private actor(model: Model, at: THREE.Vector3, turn: number, scale = 1): Actor {
    model.root.position.copy(at);
    model.root.rotation.y = turn;
    model.root.scale.multiplyScalar(scale);
    this.actors.add(model.root);
    return {
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
    if (actor) this.actors.remove(actor.model.root);
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
        )
      : null;
    if (this.main) this.act("appear");
  }
  /** The team spirit standing with the binder. */
  showAlly(id: string | null, stage = 0) {
    this.drop(this.ally);
    this.ally = id ? this.actor(buildSpirit(spirit(id), stage), ALLY, 0.7, 0.75) : null;
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

  /** Plays an action on the stage spirit (or the ally, for its attack). */
  act(action: Action, who: "main" | "ally" = "main") {
    const actor = who === "ally" ? this.ally : this.main;
    if (!actor) return;
    actor.action = action;
    actor.started = this.clock.getElapsedTime();
    if (action === "bound" || action === "evolve") this.runeBurst(actor.home);
    if (action === "hurt") this.shake = 0.25;
    if (action === "appear" || action === "flee") this.inkPuff(actor.home);
  }

  /** A ring of seal characters and a splash of ink. */
  private runeBurst(at: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.9, at.z);
    const chars = ["灵", "契", "藏", "鉴", "封", "缚", "灵", "契"];
    chars.forEach((char, i) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glyphTexture(char, this.inkColor), transparent: true, depthTest: false }),
      );
      sprite.userData.angle = (i / chars.length) * Math.PI * 2;
      sprite.scale.setScalar(0.5);
      group.add(sprite);
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.025 + i * 0.012, 6, 60),
        new THREE.MeshBasicMaterial({ color: i === 1 ? INK : this.inkColor, transparent: true, depthTest: false }),
      );
      ring.userData.ring = i + 1;
      group.add(ring);
    }
    this.addSplash(group, 46, this.inkColor, 3.2);
    this.effects.add(group);
    this.bursts.push({ group, started: this.clock.getElapsedTime() });
  }
  private inkPuff(at: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.6, at.z);
    this.addSplash(group, 22, INK, 1.6);
    group.userData.short = true;
    this.effects.add(group);
    this.bursts.push({ group, started: this.clock.getElapsedTime() });
  }
  private addSplash(group: THREE.Group, count: number, color: string, speed: number) {
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
    const flap = rig.hover ? 0.5 : 0.12;
    for (const wing of rig.wings)
      wing.rotation.z = Math.sin(p * (rig.hover ? 3.2 : 1.1)) * flap * (wing.userData.side ?? 1);
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
          const k = Math.min(1, a / 0.55);
          const lunge = Math.sin(k * Math.PI);
          x += toward * lunge * 1.1;
          z += (actor === this.ally ? -1 : 1) * lunge * 0.5;
          y += lunge * 0.35;
          if (k >= 1) actor.action = null;
          break;
        }
        case "hurt": {
          const k = Math.min(1, a / 0.45);
          x += Math.sin(a * 60) * 0.08 * (1 - k);
          turn += Math.sin(a * 40) * 0.2 * (1 - k);
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
          if (k >= 1) actor.action = null;
          break;
        }
      }
    }
    root.position.set(x, y, z);
    root.rotation.y = turn;
    root.scale.setScalar(Math.max(0.001, scale));
  }

  private tick() {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.getElapsedTime();
    for (const actor of [this.main, this.ally, this.binder, ...this.lineup])
      if (actor) this.animate(actor, t, dt);
    this.motes.rotation.y = t * 0.02;
    this.motes.position.y = Math.sin(t * 0.3) * 0.2;

    this.bursts = this.bursts.filter(({ group, started }) => {
      const life = group.userData.short ? 0.7 : 1.6;
      const k = (t - started) / life;
      if (k >= 1) {
        this.effects.remove(group);
        return false;
      }
      for (const child of group.children) {
        const material = (child as THREE.Mesh).material as THREE.Material & { opacity: number };
        if (child.userData.velocity) {
          const v = child.userData.velocity as THREE.Vector3;
          v.y -= dt * 4;
          child.position.addScaledVector(v, dt);
          material.opacity = 1 - k;
        } else if (child.userData.ring) {
          const s = 0.2 + k * 1.7 * (0.6 + child.userData.ring * 0.25);
          child.scale.setScalar(s);
          child.lookAt(this.camera.position);
          material.opacity = 1 - k;
        } else {
          const angle = child.userData.angle + k * 2.4;
          const r = 0.3 + Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 1.35;
          child.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.2);
          child.scale.setScalar(0.35 + k * 0.4);
          material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        }
      }
      return true;
    });

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x = Math.sin(t * 70) * this.shake * 0.25;
    } else this.camera.position.x = 0;
    this.renderer.render(this.scene, this.camera);
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
    this.renderer.render(scene, camera);
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearAlpha(clear);
    target.dispose();
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
    this.renderer.dispose();
  }
}

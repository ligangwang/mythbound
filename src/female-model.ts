import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Model } from "./spirit-models";

export const gaitSpeed = { Walk: 1.65, Jog: 2.4, Run: 3.2, "Fast Run": 4.3 } as const;
export type BinderAction = keyof typeof gaitSpeed | "Stand" | "Sit" | "Stand up" | "Lie down" |
  "Ground lie down" | "Get up from ground" | "Jump" | "Fight - evade and recover";

export function isGait(name: BinderAction | null): name is keyof typeof gaitSpeed {
  return name !== null && name in gaitSpeed;
}

const robeColors: Record<string, string> = {
  "robe-crimson": "#b96a77", "robe-azure": "#82aadd", "robe-jade": "#82b89a",
};

// The dress and skin share a texture atlas. Tint the skirt below the hands,
// fading back to the original fabric at the waist.
function tintSkirt(mesh: THREE.Mesh, tint: THREE.Color) {
  const positions = mesh.geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const weight = 1 - THREE.MathUtils.smoothstep(positions.getY(i), -0.22, -0.07);
    color.setRGB(1, 1, 1).lerp(tint, weight).toArray(colors, i * 3);
  }
  mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export async function loadFemaleBinder(robe: string): Promise<Model> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/female-binder.glb`);
  const root = new THREE.Group();
  root.name = "female-binder-blender";
  const height = 2.8;
  // Blender's mesh is centered at the hips, with the sole at -0.952.
  const scale = height / 1.9;
  gltf.scene.scale.setScalar(scale);
  gltf.scene.position.y = 0.952 * scale;
  root.add(gltf.scene);
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    object.castShadow = object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.userData.modelOwned = true;
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.map) textures.add(material.map);
      if (robeColors[robe] && material.name === "Material_0") {
        tintSkirt(object, new THREE.Color(robeColors[robe]));
        material.vertexColors = true;
      }
    }
  });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  let current: THREE.AnimationAction;
  let preview: BinderAction | null = null;
  let finished = false;
  function play(name: BinderAction, restart = false) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw new Error(`Female Binder is missing animation: ${name}`);
    const next = mixer.clipAction(clip);
    if (current === next && !restart) return;
    const loop = name === "Stand" || name in gaitSpeed;
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.setEffectiveWeight(1).play();
    if (current && current !== next) current.crossFadeTo(next, 0.15, false);
    current = next;
    finished = false;
  }
  mixer.addEventListener("finished", event => {
    if (event.action === current) finished = true;
  });
  play("Stand");
  mixer.update(0);
  return {
    root, height,
    rig: { wings: [], tails: [], orbit: [], hover: 0 },
    previewAction(name) {
      preview = name;
      if (name) play(name, true);
    },
    update(dt, moving, running) {
      if (finished && preview !== "Sit" && preview !== "Lie down" && preview !== "Ground lie down")
        preview = null;
      if (!preview) play(moving ? (running ? "Run" : "Walk") : "Stand");
      mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
      skeletons.forEach(skeleton => skeleton.dispose());
      textures.forEach(texture => {
        texture.dispose();
        if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
      });
    },
  };
}

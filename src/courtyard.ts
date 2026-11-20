import * as THREE from "three";

/** The opening courtyard: real geometry, with a clear walking area in front. */
export function buildCourtyard() {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#3e515b", roughness: 0.64 });
  const edge = new THREE.MeshStandardMaterial({ color: "#202d39", roughness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ color: "#302b2d", roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: "#d7b978", metalness: 0.45, roughness: 0.4 });
  const leaves = new THREE.MeshStandardMaterial({ color: "#737f7c", roughness: 1 });
  const glow = new THREE.MeshStandardMaterial({ color: "#c9a879", emissive: "#e9a967", emissiveIntensity: .65 });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  }
  mesh(new THREE.CylinderGeometry(4.7, 4.9, 0.28, 48), edge, 0, -0.18, -0.7);
  mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.08, 48), stone, 0, -0.04, -0.7);
  // Insets in the paving give the feet a visible sense of scale and travel.
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 2; z++) {
    if (x * x + (z + 0.7) ** 2 > 17) continue;
    const tile = mesh(new THREE.BoxGeometry(0.965, 0.025, 0.965), stone, x, 0.006, z);
    tile.rotation.y = Math.sin(x * 12 + z * 7) * .004;
  }
  const ring = mesh(new THREE.TorusGeometry(1.35, 0.009, 6, 96), gold, 0, 0.03, 0);
  ring.rotation.x = -Math.PI / 2;
  // A small gate frames the start of the journey beyond the courtyard.
  for (const x of [-2.2, 2.2]) {
    mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), edge, x, 0.12, -3);
    mesh(new THREE.CylinderGeometry(0.13, 0.19, 2.6, 12), wood, x, 1.5, -3);
    mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), gold, x, 2.6, -3);
  }
  mesh(new THREE.BoxGeometry(5.1, 0.22, 0.38), wood, 0, 2.8, -3);
  // Curved tile courses and upturned eaves replace the pyramidal toy roof.
  for (let i = 0; i < 32; i++) {
    const x = -2.75 + i * 5.5 / 31;
    const rise = Math.pow(Math.abs(x) / 2.75, 5) * .25;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x,2.96+rise,-2.35), new THREE.Vector3(x,3.1+rise,-2.65),
      new THREE.Vector3(x,3.42+rise,-3), new THREE.Vector3(x,3.1+rise,-3.35), new THREE.Vector3(x,2.96+rise,-3.65),
    ]);
    mesh(new THREE.TubeGeometry(path,16,.1,8,false),edge,0,0,0);
  }
  mesh(new THREE.CylinderGeometry(.07,.07,5.6,12),gold,0,3.43,-3).rotation.z=Math.PI/2;
  const lanterns: THREE.Mesh[] = [];
  for (const x of [-1.7, 1.7]) {
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), gold, x, 2.5, -3);
    lanterns.push(mesh(new THREE.CylinderGeometry(.12,.12,.3,8), glow, x, 2.16, -3));
    for(const y of [1.99,2.33]) mesh(new THREE.CylinderGeometry(.15,.15,.04,8),gold,x,y,-3);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+Math.PI/4;
      mesh(new THREE.CylinderGeometry(.008,.008,.32,5),wood,x+Math.cos(a)*.125,2.16,-3+Math.sin(a)*.125);
    }
    const light = new THREE.PointLight("#edb47b", 3, 5, 2);
    light.position.set(x,2.13,-2.8); root.add(light);
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.DodecahedronGeometry(0.65, 0), edge, side * 3.5, 0.3, -1.9);
    const trunk = mesh(new THREE.CylinderGeometry(0.09, 0.22, 2.7, 7), wood, side * 3.6, 1.3, -2.2);
    trunk.rotation.z = side * -0.16;
    for (let i = 0; i < 9; i++) {
      const x=side*3.7+Math.sin(i*2.4)*.8, y=2.3+Math.cos(i*1.5)*.55, z=-2.2+Math.cos(i*2.4)*.6;
      const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(side*3.6,1.5,-2.2),new THREE.Vector3((side*3.6+x)/2,y-.1,z),new THREE.Vector3(x,y,z)]);
      mesh(new THREE.TubeGeometry(branch,10,.035,6,false),wood,0,0,0);
      const crown = mesh(new THREE.IcosahedronGeometry(0.48, 1), leaves,x,y,z);
      crown.scale.set(1,.18,.7);
    }
  }
  return { root, animate: (t: number) => lanterns.forEach((l, i) => {
    l.rotation.z = Math.sin(t * 1.4 + i) * 0.08;
    l.scale.y = 1.1 + Math.sin(t * 1.8 + i) * 0.025;
  }) };
}

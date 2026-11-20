import * as THREE from "three";
import type { Model, Rig } from "./spirit-models";

type V3 = [number, number, number];
type Ring = [y: number, width: number, depth: number];

/** Authored, adult-proportioned real-time binder. All geometry is original.
 * Materials belong to this model (unlike the shared classic toon materials).
 */
export function buildAdultBinder(robe = "", look: "f" | "m" = "f"): Model {
  const root = new THREE.Group();
  root.name = "adult-binder";
  const rig: Rig = { wings: [], tails: [], orbit: [], legs: [], hover: 0 };
  const male = look === "m";
  const palette: Record<string, string> = {
    "": "#243c47", "robe-crimson": "#642f39", "robe-azure": "#304c70", "robe-jade": "#315248",
  };
  function material(color: string, roughness: number, metalness = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
    m.userData.modelOwned = true;
    return m;
  }
  const silk = material(palette[robe] ?? palette[""], 0.62);
  const lining = material("#bbc3bb", 0.88);
  const dark = material("#111d27", 0.76);
  const leather = material("#242329", 0.68);
  const gold = material("#b49b6a", 0.32, 0.72);
  const skin = material("#d4a891", 0.8);
  const hair = material("#151b23", 0.43);
  const lips = material("#97655f", 0.72);
  const white = material("#c2beb0", 0.5);
  const jade = material("#4a9991", 0.24, 0.25);
  // Small-scale weave catches light without requiring an external texture.
  const weave = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    const v = 125 + ((x + y) % 2 ? 32 : -25);
    weave.set([v, v, v, 255], i);
  }
  const bump = new THREE.DataTexture(weave, 32, 32);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(16, 16);
  bump.needsUpdate = true;
  silk.bumpMap = bump;
  silk.bumpScale = 0.009;

  function group(name: string, p: V3, parent: THREE.Object3D = root) {
    const g = new THREE.Group(); g.name = name; g.position.set(...p); parent.add(g); return g;
  }
  function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, p: V3, parent: THREE.Object3D = root) {
    const m = new THREE.Mesh(geo, mat); m.position.set(...p);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function oval(mat: THREE.Material, p: V3, scale: V3, parent: THREE.Object3D = root) {
    const m = mesh(new THREE.SphereGeometry(1, 28, 20), mat, p, parent); m.scale.set(...scale); return m;
  }
  function curve(points: V3[], radius: number, mat: THREE.Material, parent: THREE.Object3D = root) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, radius, 6, false), mat, [0, 0, 0], parent);
  }
  /** Elliptical tailored surfaces, including open split robe panels. */
  function garment(rings: Ring[], mat: THREE.Material, parent: THREE.Object3D = root, from = 0, arc = Math.PI * 2, folds = 0.006) {
    const verts: number[] = [], uv: number[] = [], indices: number[] = [];
    const segments = 48;
    rings.forEach(([y, width, depth], row) => {
      for (let j = 0; j <= segments; j++) {
        const a = from + j / segments * arc;
        const fold = Math.cos(a * 14) * folds * (1 - row / rings.length);
        verts.push(Math.sin(a) * (width + fold), y, Math.cos(a) * (depth + fold));
        uv.push(j / segments, row / (rings.length - 1));
        if (row && j) {
          const i = row * (segments + 1) + j;
          indices.push(i, i - 1, i - segments - 2, i, i - segments - 2, i - segments - 1);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo, mat, [0, 0, 0], parent);
  }
  const shoulder = male ? 0.31 : 0.27;
  garment([[1.25, .23, .15], [1.45, .19, .125], [1.65, .19, .13], [1.9, shoulder, .16], [2.08, shoulder, .13], [2.15, .13, .095]], silk);
  mesh(new THREE.CylinderGeometry(.073, .09, .2, 24), skin, [0, 2.19, 0]);
  // Crossed ivory lapels, bordered with narrow antique-gold piping.
  for (const side of [-1, 1]) {
    const lapel = [[side * .09, 2.18, .105], [side * .16, 2.07, .145], [side * .09, 1.88, .175], [-side * .08, 1.65, .145]] as V3[];
    curve(lapel, .032, lining);
    curve(lapel.map(([x,y,z]) => [x + side * .027,y,z + .01] as V3), .006, gold);
  }
  garment([[1.43, .205, .145], [1.54, .204, .146]], leather);
  oval(gold, [0, 1.49, .15], [.065, .042, .015]);
  oval(jade, [0, 1.49, .168], [.035, .027, .009]);
  // Legs have separate knees so a step flexes rather than swinging rigid rods.
  for (const side of [-1, 1]) {
    const leg = group(`leg-${side}`, [side * .12, 1.26, 0]);
    rig.legs!.push(leg);
    garment([[-.6,.09,.09], [-.32,.105,.105], [0,.115,.12]], dark, leg);
    const knee = group("knee", [0, -.59, 0], leg);
    leg.userData.knee = knee;
    garment([[-.48,.065,.07], [-.28,.075,.085], [0,.085,.09]], dark, knee);
    oval(leather, [0,-.57,.045], [.083,.1,.17], knee);
    garment([[-.53,.085,.1], [-.22,.077,.087]], leather, knee);
    curve([[side*.067,-.22,.052],[side*.073,-.4,.065],[side*.077,-.52,.075]], .005, gold, knee);
  }
  // Split silk coat: the centre stays open to reveal the stepping legs.
  for (const side of [-1, 1]) {
    const panel = group(`robe-panel-${side}`, [0,1.43,0]);
    panel.userData.side = side;
    rig.tails.push(panel);
    const from = side > 0 ? .35 : Math.PI;
    garment([[-1.15,.38,.25],[-.9,.33,.22],[-.55,.28,.19],[-.22,.24,.16],[0,.213,.15]], silk, panel, from, Math.PI-.35, .012);
    const a = side > 0 ? .35 : Math.PI * 2 - .35;
    curve([[Math.sin(a)*.38,-1.15,Math.cos(a)*.25],[Math.sin(a)*.33,-.9,Math.cos(a)*.22],[Math.sin(a)*.28,-.55,Math.cos(a)*.19],[Math.sin(a)*.213,0,Math.cos(a)*.15]], .008, gold, panel);
    // Fine embroidered arcs down the lower coat.
    for (let i=0;i<4;i++) curve([[side*.24,-.75-i*.07,.15],[side*.29,-.8-i*.07,.13],[side*.32,-.75-i*.07,.1]], .003, gold, panel);
  }
  const sash = group("sash", [-.13,1.44,.17]);
  garment([[-.82,.055,.012],[-.4,.045,.014],[0,.04,.012]], lining, sash, 0, Math.PI*2, .002);
  rig.tails.push(sash);
  curve([[.15,1.44,.14],[.25,1.25,.16],[.21,1.15,.19]], .008, gold);
  oval(jade, [.21,1.12,.19], [.045,.065,.014]);
  // Codex case rests at the hip; no oversized toy weapon.
  const book = mesh(new THREE.BoxGeometry(.17,.25,.07), leather, [-.25,1.3,.02]);
  book.rotation.z = -.12;
  mesh(new THREE.BoxGeometry(.13,.21,.012), gold, [-.25,1.3,.062]);
  mesh(new THREE.BoxGeometry(.11,.19,.013), dark, [-.25,1.3,.07]);
  for (const side of [-1,1]) {
    const arm = group(`arm-${side}`, [side*shoulder,2.04,0]);
    arm.userData.side = side; rig.wings.push(arm);
    garment([[-.4,.11,.115],[-.18,.12,.12],[0,.12,.12]], silk, arm);
    const elbow = group("elbow", [0,-.38,.015], arm);
    elbow.rotation.x = -.12;
    garment([[-.38,.075,.08],[-.31,.085,.09],[-.05,.1,.11],[0,.105,.11]], silk, elbow);
    garment([[-.39,.078,.082],[-.34,.082,.086]], gold, elbow);
    oval(skin, [0,-.46,.01], [.045,.082,.027], elbow);
    for (let finger=0;finger<4;finger++) oval(skin, [(-1.5+finger)*.018,-.52,.013], [.009,.041,.012], elbow);
    oval(skin,[side*-.041,-.46,.024],[.013,.04,.018],elbow).rotation.z=side*-.35;
    // Subtle shoulder plates, following the shoulder rather than floating.
    oval(gold,[side*.015,-.015,0],[.126,.045,.128],arm);
    oval(silk,[side*.015,.003,.008],[.117,.037,.115],arm);
  }
  const head = group("head", [0,2.45,0]); rig.head = head;
  // Oval face with a tapered jaw and chin, about one seventh of total height.
  const face = new THREE.SphereGeometry(1,40,32);
  const pos = face.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const y=pos.getY(i), x=pos.getX(i), z=pos.getZ(i);
    const jaw = y < -.2 ? 1 + (y+.2)*.3 : 1;
    pos.setXYZ(i,x*(male?.142:.133)*jaw,y*.187,z*.127);
  }
  face.computeVertexNormals(); mesh(face,skin,[0,0,0],head);
  for(const side of [-1,1]) {
    oval(skin,[side*.132,-.005,-.005],[.026,.047,.021],head);
    oval(white,[side*.052,.017,.116],[.039,.009,.009],head);
    oval(hair,[side*.052,.017,.124],[.012,.009,.005],head);
    curve([[side*.018,.021,.12],[side*.052,.03,.126],[side*.087,.021,.108]],.0035,hair,head);
    curve([[side*.023,.054,.12],[side*.054,.06,.119],[side*.088,.049,.1]],.005,hair,head);
    if(!male) { curve([[side*.142,-.032,0],[side*.149,-.07,0],[side*.149,-.1,0]],.003,gold,head); oval(jade,[side*.149,-.11,0],[.009,.019,.009],head); }
  }
  oval(skin,[0,-.009,.127],[.017,.042,.024],head);
  oval(skin,[0,-.037,.142],[.022,.015,.015],head);
  curve([[-.033,-.076,.11],[0,-.071,.125],[.033,-.076,.11]],.004,lips,head);
  curve([[-.025,-.079,.112],[0,-.083,.123],[.025,-.079,.112]],.003,lips,head);
  // Swept crown, individual flowing locks, and a bound fall of long hair.
  const cap = mesh(new THREE.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI*.53),hair,[0,.025,-.018],head);
  cap.scale.set(.145,.19,.137); cap.rotation.x=-.22;
  for(const side of [-1,1]) for(let i=0;i<4;i++) {
    curve([[side*.015,.18,-.01],[side*(.08+i*.012),.11,.09-i*.012],[side*(.12+i*.004),-.05,.03-i*.012],[side*(.105+i*.005),-.19,-.04]], .012, hair,head);
  }
  oval(hair,[0,.195,-.07],[.075,.078,.065],head);
  curve([[-.085,.2,-.055],[0,.22,-.045],[.105,.225,-.06]],.008,gold,head);
  const fall = group("hair-fall",[0,.08,-.12],head); rig.tails.push(fall);
  for(let i=0;i<7;i++) curve([[(i-3)*.023,0,0],[(i-3)*.027,-.22,-.025],[(i-3)*.026,-(male?.45:.65),-.04],[(i-3)*.02,-(male?.54:.8),-.01]],.022,hair,fall);
  return {root,rig,height:2.75};
}

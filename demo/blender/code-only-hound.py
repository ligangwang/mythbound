# Builds a Stormhound in Blender from code: skin-modifier body, armature, automatic weights,
# walk / idle / attack actions, exported as GLB.
import bpy, bmesh, math, sys
from mathutils import Vector, Quaternion, Matrix
OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

def mat(name, color, rough=0.8, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = 4
    return m
def srgb(h): 
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
COAT = mat("coat", srgb("#3a4a70"), 0.75)
DARK = mat("dark", srgb("#151b2c"), 0.6)
BONE = mat("horn", srgb("#e0d8c4"), 0.4)
GLOW = mat("glow", srgb("#7fe6ff"), 0.4, srgb("#7fe6ff"))
MANE = mat("mane", srgb("#aebde6"), 0.7)

def skin_obj(name, verts, edges, radii, material, group=None, subdiv=2):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, edges, []); me.update()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    sk = ob.modifiers.new("skin", "SKIN"); sk.use_smooth_shade = True
    for i, r in enumerate(radii):
        v = me.skin_vertices[0].data[i]; v.radius = r if isinstance(r, tuple) else (r, r); v.use_root = i == 0
    ss = ob.modifiers.new("sub", "SUBSURF"); ss.levels = subdiv
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear(); ob.data = new
    for p in new.polygons: p.use_smooth = True
    new.materials.append(material)
    if group:
        g = ob.vertex_groups.new(name=group); g.add(range(len(new.vertices)), 1.0, "REPLACE")
    return ob

# --- body skeleton (front is -Y, up is +Z) ---
P = {}
def pt(n, x, y, z): P[n] = Vector((x, y, z)); return P[n]
pt("hips", 0, .55, 1.0); pt("mid", 0, .05, .98); pt("chest", 0, -.45, 1.03); pt("neckb", 0, -.68, 1.2)
pt("head", 0, -.93, 1.52); pt("muzzle", 0, -1.2, 1.46); pt("nose", 0, -1.42, 1.42)
pt("t1", 0, .82, 1.06); pt("t2", 0, 1.1, 1.0); pt("t3", 0, 1.38, .88); pt("t4", 0, 1.68, .84)
for s, n in ((1, "L"), (-1, "R")):
    pt("sh" + n, s * .2, -.5, .95); pt("el" + n, s * .2, -.38, .55); pt("wr" + n, s * .2, -.5, .14); pt("pw" + n, s * .2, -.66, .045)
    pt("hp" + n, s * .2, .55, .95); pt("kn" + n, s * .2, .4, .6); pt("hk" + n, s * .2, .68, .33); pt("an" + n, s * .2, .62, .07); pt("to" + n, s * .2, .47, .045)
order = list(P)
E = [("hips", "mid"), ("mid", "chest"), ("chest", "neckb"), ("neckb", "head"), ("head", "muzzle"), ("muzzle", "nose"),
     ("hips", "t1"), ("t1", "t2"), ("t2", "t3"), ("t3", "t4")]
for n in "LR":
    E += [("chest", "sh" + n), ("sh" + n, "el" + n), ("el" + n, "wr" + n), ("wr" + n, "pw" + n),
          ("hips", "hp" + n), ("hp" + n, "kn" + n), ("kn" + n, "hk" + n), ("hk" + n, "an" + n), ("an" + n, "to" + n)]
R = dict(hips=(.27, .3), mid=(.25, .27), chest=(.31, .38), neckb=(.21, .25), head=(.19, .19), muzzle=(.1, .1), nose=(.06, .055),
         t1=.1, t2=.1, t3=.08, t4=.03)
for n in "LR":
    R.update({"sh" + n: (.13, .17), "el" + n: .085, "wr" + n: .06, "pw" + n: (.075, .045),
              "hp" + n: (.15, .21), "kn" + n: .11, "hk" + n: .065, "an" + n: .055, "to" + n: (.07, .045)})
body = skin_obj("Stormhound", [P[n] for n in order], [(order.index(a), order.index(b)) for a, b in E], [R[n] for n in order], COAT)

# --- armature ---
arm_data = bpy.data.armatures.new("Rig"); arm = bpy.data.objects.new("Rig", arm_data); scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="EDIT")
BONES = [("body", "hips", "mid", None), ("chest", "mid", "chest", "body"), ("neck", "neckb", "head", "chest"), ("head", "head", "nose", "neck"),
         ("tail1", "t1", "t2", "body"), ("tail2", "t2", "t3", "tail1"), ("tail3", "t3", "t4", "tail2")]
for n in "LR":
    BONES += [("f_up" + n, "sh" + n, "el" + n, "chest"), ("f_lo" + n, "el" + n, "wr" + n, "f_up" + n), ("f_paw" + n, "wr" + n, "pw" + n, "f_lo" + n),
              ("h_up" + n, "hp" + n, "kn" + n, "body"), ("h_lo" + n, "kn" + n, "hk" + n, "h_up" + n), ("h_ft" + n, "hk" + n, "an" + n, "h_lo" + n), ("h_toe" + n, "an" + n, "to" + n, "h_ft" + n)]
for name, a, b, par in BONES:
    eb = arm_data.edit_bones.new(name); eb.head = P[a]; eb.tail = P[b]
    if par: eb.parent = arm_data.edit_bones[par]
bpy.ops.object.mode_set(mode="OBJECT")
PARENT = {b[0]: b[3] for b in BONES}
bpy.ops.object.select_all(action="DESELECT"); body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
print("groups:", len(body.vertex_groups), "verts:", len(body.data.vertices))

# --- extras, each bound to one bone ---
extras = []
for s in (1, -1):
    extras.append(skin_obj("ear", [(s * .1, -.9, 1.66), (s * .16, -.84, 1.9)], [(0, 1)], [(.07, .03), (.012, .008)], COAT, "head", 1))
    extras.append(skin_obj("horn", [(s * .08, -.98, 1.68), (s * .13, -.82, 1.82), (s * .15, -.62, 1.84), (s * .13, -.46, 1.98)], [(0, 1), (1, 2), (2, 3)], [.04, .034, .024, .006], BONE, "head", 2))
    eye = bpy.data.meshes.new("eye"); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=.034)
    bmesh.ops.scale(bm, vec=(.5, 1.3, .75), verts=bm.verts); bmesh.ops.translate(bm, vec=(s * .158, -1.02, 1.56), verts=bm.verts); bm.to_mesh(eye); bm.free()
    eo = bpy.data.objects.new("eye", eye); scene.collection.objects.link(eo); eye.materials.append(GLOW)
    eo.vertex_groups.new(name="head").add(range(len(eye.vertices)), 1, "REPLACE"); extras.append(eo)
nose = skin_obj("nosetip", [(0, -1.45, 1.44), (0, -1.5, 1.43)], [(0, 1)], [.05, .035], DARK, "head", 1); extras.append(nose)
# Mane: swept spikes along the neck and shoulders, a crest down the spine, a tail plume.
import random; random.seed(3)
def spike(base, direction, length, r, group, material):
    b = Vector(base); d = Vector(direction).normalized()
    m = b + d * length * .5 + Vector((0, 0, -.03 * length)); t = b + d * length + Vector((0, 0, -.1 * length))
    extras.append(skin_obj("spike", [b, m, t], [(0, 1), (1, 2)], [(r, r * .6), (r * .7, r * .4), (r * .12, r * .1)], material, group, 1))
for i in range(9):
    k = i / 8; c = P["head"].lerp(P["chest"], k) + Vector((0, .1, .16 - .05 * k))
    for s in (-1, 0, 1):
        if s == 0 or i % 2 == 0:
            spike(c + Vector((s * (.13 + .08 * k), 0, -abs(s) * .08)), (s * .35, 1, .55 - k * .4), .34 + .12 * random.random(), .075, "neck" if k < .6 else "chest", MANE if s == 0 else COAT)
for i in range(5):
    k = i / 4; c = P["chest"].lerp(P["hips"], .25 + k * .75) + Vector((0, 0, .25))
    spike(c, (0, 1, .45), .2 + .06 * random.random(), .05, "body" if k > .4 else "chest", MANE)
for i, (n, g) in enumerate((("t2", "tail1"), ("t3", "tail2"), ("t4", "tail3"), ("t4", "tail3"))):
    for s in (-1, 1):
        spike(P[n] + Vector((s * .04, -.05, .03)), (s * .5, 1, .25 if i < 3 else -.2), .32, .06, g, MANE if i % 2 else COAT)
# Chest ruff.
for s in (-1, 1):
    for i in range(3):
        spike(P["neckb"] + Vector((s * .14, -.05 + i * .06, -.12 - i * .05)), (s * .5, .5, -1), .26, .07, "chest", COAT)
bpy.ops.object.select_all(action="DESELECT")
for e in extras: e.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active = body; bpy.ops.object.join()

# --- animation ---
bpy.context.view_layer.objects.active = arm
REST = {pb.name: pb.bone.matrix_local.to_3x3() for pb in arm.pose.bones}
X = Vector((1, 0, 0)); Z = Vector((0, 0, 1))
def qx(a): return Quaternion(X, -a)          # sagittal angle: positive swings "down" toward the front
def absang(a, b):                              # angle of a segment from straight down, toward the front
    d = P[b] - P[a]; return math.atan2(-d.y, -d.z)
RA = {b[0]: absang(b[1], b[2]) for b in BONES}
def seglen(n): 
    b = next(x for x in BONES if x[0] == n); return math.hypot(P[b[2]].y - P[b[1]].y, P[b[2]].z - P[b[1]].z)
def ik(dx, dy, a, b, bend):
    d = min(a + b - .002, max(abs(a - b) + .002, math.hypot(dx, dy)))
    base = math.atan2(dx, -dy)
    al = math.acos((a * a + d * d - b * b) / (2 * a * d)); be = math.acos((a * a + b * b - d * d) / (2 * a * b))
    up = base + bend * al; return up, up - bend * (math.pi - be)
def fz(n): return (-P[n].y, P[n].z)           # (forward, up)
PIV = fz("hips")
def pose(frame, off=(0, 0), pitch=0.0, feet=None, extra=None):
    """off: body shift (forward, up); pitch: nose-up; feet: {leg: (forward, up)} shift of each foot from rest."""
    Q = {"body": qx(pitch)}
    def carried(n):                            # where a body-attached point sits after shift and pitch
        f, z = fz(n); f -= PIV[0]; z -= PIV[1]
        return (PIV[0] + f * math.cos(pitch) - z * math.sin(pitch) + off[0], PIV[1] + f * math.sin(pitch) + z * math.cos(pitch) + off[1])
    Q["chest"] = Q["body"]
    for n in "LR":
        dfx, dfy = (feet or {}).get("f" + n, (0, 0)); hx, hy = carried("sh" + n); tx, ty = fz("wr" + n)
        u, l = ik(tx + dfx - hx, ty + dfy - hy, seglen("f_up" + n), seglen("f_lo" + n), -1)
        Q["f_up" + n] = qx(u - RA["f_up" + n]); Q["f_lo" + n] = qx(l - RA["f_lo" + n]); Q["f_paw" + n] = qx(min(0.9, dfy * 3.0))
        dfx, dfy = (feet or {}).get("h" + n, (0, 0)); hx, hy = carried("hp" + n); tx, ty = fz("an" + n)
        th = RA["h_up" + n] + pitch * .5 + dfx * .5 + (PIV[1] - carried("hp" + n)[1] + 0) * 0 + max(0, -off[1]) * 1.2
        L0 = seglen("h_up" + n); kx = hx + math.sin(th) * L0; ky = hy - math.cos(th) * L0
        u, l = ik(tx + dfx - kx, ty + dfy - ky, seglen("h_lo" + n), seglen("h_ft" + n), -1)
        Q["h_up" + n] = qx(th - RA["h_up" + n]); Q["h_lo" + n] = qx(u - RA["h_lo" + n]); Q["h_ft" + n] = qx(l - RA["h_ft" + n]); Q["h_toe" + n] = qx(-min(0.9, dfy * 3.0))
    for k, q in (extra or {}).items():
        par = PARENT[k]; base = Q.get(par, Quaternion()) if par else Quaternion()
        Q[k] = base @ q
    for pb in arm.pose.bones:
        n = pb.name; par = PARENT[n]
        q = Q.get(n); 
        if q is None: q = Q[n] = Q.get(par, Quaternion()) if par else Quaternion()
        qp = Q.get(par, Quaternion()) if par else Quaternion()
        Rm = REST[n].to_quaternion()
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Rm.inverted() @ (qp.inverted() @ q) @ Rm
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if n == "body":
            pb.location = REST[n].inverted() @ Vector((0, -off[0], off[1])); pb.keyframe_insert("location", frame=frame)
def yaw(a): return Quaternion(Z, a)
def new_action(name):
    arm.animation_data_create(); act = bpy.data.actions.new(name); arm.animation_data.action = act; return act
def stash(act):
    tr = arm.animation_data.nla_tracks.new(); tr.name = act.name
    tr.strips.new(act.name, int(act.frame_range[0]), act); arm.animation_data.action = None
ease = lambda k: k * k * (3 - 2 * k)
def gait(N, S, D, lift, offs, drop, bobA, run=False):
    for f in range(N + 1):
        p = f / N; feet = {}
        for leg, o in offs.items():
            c = (p + o) % 1
            if c < D: fx, fy = S / 2 - c / D * S, 0
            else:
                k = (c - D) / (1 - D); fx, fy = -S / 2 + ease(k) * S, math.sin(k * math.pi) * lift
            feet[leg] = (fx, fy)
        w = p * math.tau
        bob = bobA * math.sin(w * 2 + .6)
        ex = {"neck": qx(-.12 + .05 * math.sin(w * 2 + 1.2)) @ yaw(.05 * math.sin(w)), "head": qx(-.1 - .04 * math.sin(w * 2 + 1.6)),
              "tail1": qx(.15 if run else -.1) @ yaw(.18 * math.sin(w)), "tail2": yaw(.2 * math.sin(w - .7)), "tail3": yaw(.22 * math.sin(w - 1.4)),
              "chest": yaw(.04 * math.sin(w))}
        pose(f, off=(0, -drop + bob), pitch=(.05 * math.sin(w) if run else .012 * math.sin(w * 2)), feet=feet, extra=ex)
a = new_action("walk"); gait(32, .5, .64, .13, {"fL": .25, "fR": .75, "hL": 0, "hR": .5}, .07, .015); stash(a)
a = new_action("run"); gait(14, .62, .45, .22, {"fL": 0, "fR": .12, "hL": .5, "hR": .62}, .1, .05, True); stash(a)
a = new_action("idle")
for f in range(0, 73, 6):
    w = f / 72 * math.tau
    pose(f, off=(0, -.03 + .012 * math.sin(w)), extra={"neck": qx(.04 * math.sin(w + .5)), "head": qx(.03 * math.sin(w + 1)) @ yaw(.12 * math.sin(w)),
         "tail1": qx(-.15) @ yaw(.25 * math.sin(w * 2)), "tail2": yaw(.25 * math.sin(w * 2 - .8)), "tail3": yaw(.25 * math.sin(w * 2 - 1.6))})
stash(a)
a = new_action("attack")   # crouch, leap, land, howl
keys = [(0, 0, -.03, 0, 0, 0), (8, -.08, -.24, -.12, 0, 0), (12, .1, -.05, .22, .3, 0), (18, .1, .5, .25, 1, 0), (24, .1, .45, -.2, 1, 0),
        (29, .05, -.18, -.1, 0, 0), (36, 0, -.05, .05, 0, .3), (46, -.05, -.02, .16, 0, 1), (60, -.05, -.02, .16, 0, 1), (72, 0, -.03, 0, 0, 0)]
for f, ox, oz, pitch, air, howl in keys:
    feet = {}
    if air:
        feet = {"fL": (.4 * air, oz + .1), "fR": (.3 * air, oz + .05), "hL": (-.4 * air, oz + .05), "hR": (-.3 * air, oz)}
        if f == 24: feet = {"fL": (.35, .2), "fR": (.3, .15), "hL": (.1, .4), "hR": (.15, .38)}
    pose(f, off=(ox, oz), pitch=pitch, feet=feet, extra={"neck": qx(-.3 + .25 * air + .75 * howl), "head": qx(-.1 - .2 * howl - .1 * air),
         "tail1": qx(-.2 + .5 * air - .3 * howl), "tail2": qx(.1 * air), "tail3": qx(.1 * air)})
stash(a)
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animation_mode="NLA_TRACKS", export_yup=True, export_apply=False)
print("exported", OUT)

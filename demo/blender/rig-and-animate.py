# Rigs the TRELLIS Stormhound: armature placed on the model, distance-based skin weights, then the shared animations.
import bpy, math, sys, numpy as np
from mathutils import Vector, Quaternion, Matrix
SRC, OUT = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene; scene.render.fps = 24
body = [o for o in scene.objects if o.type == "MESH"][0]
P = {}
def pt(n, x, y, z): P[n] = Vector((x, y, z))
pt("hips", .06, .26, .92); pt("mid", 0, -.13, .98); pt("chest", -.05, -.45, .9); pt("neckb", -.06, -.5, 1.1); pt("head", -.09, -.68, 1.48); pt("nose", -.1, -.93, 1.42)
pt("t1", .1, .38, .95); pt("t2", .2, .6, 1.05); pt("t3", .25, .8, .95); pt("t4", .25, .88, .65); pt("t5", .2, .82, .4); pt("t6", .12, .7, .15)
pt("m0", -.06, -.4, 1.35); pt("m1", 0, -.1, 1.45); pt("m2", .05, .25, 1.4)
pt("shL", .14, -.48, .85); pt("elL", .16, -.45, .55); pt("wrL", .18, -.53, .2); pt("pwL", .21, -.6, .05)
pt("shR", -.22, -.48, .85); pt("elR", -.25, -.45, .55); pt("wrR", -.28, -.53, .2); pt("pwR", -.3, -.6, .05)
pt("hpL", .14, .2, .82); pt("knL", .13, .12, .57); pt("hkL", .13, .30, .36); pt("anL", .17, .27, .1); pt("toL", .18, .2, .03)
pt("hpR", -.14, .2, .82); pt("knR", -.18, .04, .57); pt("hkR", -.21, .12, .32); pt("anR", -.22, -.02, .1); pt("toR", -.22, -.1, .03)
BONES = [("body", "hips", "mid", None), ("chest", "mid", "chest", "body"), ("neck", "neckb", "head", "chest"), ("head", "head", "nose", "neck"),
         ("tail1", "t1", "t2", "body"), ("tail2", "t2", "t3", "tail1"), ("tail3", "t3", "t4", "tail2"), ("tail4", "t4", "t5", "tail3"), ("tail5", "t5", "t6", "tail4"),
         ("mane1", "m0", "m1", "neck"), ("mane2", "m1", "m2", "mane1")]
for n in "LR":
    BONES += [("f_up" + n, "sh" + n, "el" + n, "chest"), ("f_lo" + n, "el" + n, "wr" + n, "f_up" + n), ("f_paw" + n, "wr" + n, "pw" + n, "f_lo" + n),
              ("h_up" + n, "hp" + n, "kn" + n, "body"), ("h_lo" + n, "kn" + n, "hk" + n, "h_up" + n), ("h_ft" + n, "hk" + n, "an" + n, "h_lo" + n), ("h_toe" + n, "an" + n, "to" + n, "h_ft" + n)]
RAD = dict(body=.28, chest=.3, neck=.26, head=.24, tail1=.2, tail2=.22, tail3=.22, tail4=.22, tail5=.2, mane1=.2, mane2=.22, f_up=.12, f_lo=.08, f_paw=.07, h_up=.13, h_lo=.08, h_ft=.07, h_toe=.06)
arm_data = bpy.data.armatures.new("Rig"); arm = bpy.data.objects.new("Rig", arm_data); scene.collection.objects.link(arm)
bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="EDIT")
for name, a, b, par in BONES:
    eb = arm_data.edit_bones.new(name); eb.head = P[a]; eb.tail = P[b]
    if par: eb.parent = arm_data.edit_bones[par]
bpy.ops.object.mode_set(mode="OBJECT")
PARENT = {b[0]: b[3] for b in BONES}
# Skin weights: each vertex follows the bones it is closest to, measured against each bone's reach.
v = np.array([p.co[:] for p in body.data.vertices])
W = np.zeros((len(v), len(BONES)))
for i, (name, a, b, _) in enumerate(BONES):
    A, B = np.array(P[a]), np.array(P[b]); ab = B - A
    t = np.clip(((v - A) @ ab) / (ab @ ab), 0, 1); d = np.linalg.norm(v - (A + t[:, None] * ab), axis=1)
    W[:, i] = 1 / np.maximum(d / RAD[name.rstrip("LR") if name[-1] in "LR" else name], 1e-3) ** 5
names = [b[0] for b in BONES]
for i, n in enumerate(names):
    if n.startswith("h_"): W[v[:, 1] > .42, i] = 0          # the tail plume never follows a hind leg
    if n.startswith("tail"): W[(v[:, 1] < .22), i] = 0       # and the body never follows the tail
    if n.startswith("f_"): W[v[:, 2] > 1.0, i] = 0
    if n.startswith("mane"): W[(v[:, 2] < 1.15) | (v[:, 1] < -.42), i] = 0           # the mane never follows a fore leg
top = np.argsort(-W, axis=1)[:, :4]
for i, (name, *_ ) in enumerate(BONES): body.vertex_groups.new(name=name)
rows = np.arange(len(v))[:, None]; w4 = W[rows, top]; w4 /= w4.sum(1, keepdims=True)
for k in range(4):
    for bi in range(len(BONES)):
        sel = np.where((top[:, k] == bi) & (w4[:, k] > .02))[0]
        ws = w4[sel, k]
        g = body.vertex_groups[bi]
        for q in np.unique(np.round(ws, 2)):
            g.add([int(x) for x in sel[np.round(ws, 2) == q]], float(q), "REPLACE")
body.parent = arm; body.modifiers.new("arm", "ARMATURE").object = arm
NEUTRAL_AN = .2; TH0 = .3; K = .6
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
        dfx, dfy = (feet or {}).get("h" + n, (0, 0)); hx, hy = carried("hp" + n); tx, ty = NEUTRAL_AN, P["an" + n].z
        th = TH0 + pitch * .5 + dfx * .5 + (PIV[1] - carried("hp" + n)[1] + 0) * 0 + max(0, -off[1]) * 1.2
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
              "tail1": qx(.15 if run else -.1) @ yaw(.18 * math.sin(w)), "tail2": yaw(.2 * math.sin(w - .7)), "tail3": yaw(.22 * math.sin(w - 1.4)), "tail4": yaw(.24 * math.sin(w - 2.1)) @ qx(.08 * math.sin(w * 2 - 1)), "tail5": yaw(.26 * math.sin(w - 2.8)),
              "mane1": qx((-.12 if run else 0) + .07 * math.sin(w * 2 + 2.2)) @ yaw(.08 * math.sin(w + .8)), "mane2": qx(.09 * math.sin(w * 2 + 1.2)) @ yaw(.1 * math.sin(w)),
              "chest": yaw(.04 * math.sin(w))}
        pose(f, off=(0, -drop + bob), pitch=(.05 * math.sin(w) if run else .012 * math.sin(w * 2)), feet=feet, extra=ex)
a = new_action("walk"); gait(24, .26, .64, .08, {"fL": .25, "fR": .75, "hL": 0, "hR": .5}, .05, .01); stash(a)
a = new_action("run"); gait(12, .4, .45, .16, {"fL": 0, "fR": .12, "hL": .5, "hR": .62}, .08, .03, True); stash(a)
a = new_action("idle")
for f in range(0, 73, 6):
    w = f / 72 * math.tau
    pose(f, off=(0, -.02 + .008 * math.sin(w)), extra={"neck": qx(.04 * math.sin(w + .5)), "head": qx(.03 * math.sin(w + 1)) @ yaw(.12 * math.sin(w)),
         "tail1": yaw(.2 * math.sin(w * 2)), "tail2": yaw(.2 * math.sin(w * 2 - .8)), "tail3": yaw(.2 * math.sin(w * 2 - 1.6)), "tail4": yaw(.2 * math.sin(w * 2 - 2.4)), "tail5": yaw(.2 * math.sin(w * 2 - 3.2)),
         "mane1": qx(.05 * math.sin(w * 2 + 1)) @ yaw(.06 * math.sin(w * 2)), "mane2": qx(.07 * math.sin(w * 2)) @ yaw(.08 * math.sin(w * 2 - 1))})
stash(a)
a = new_action("attack")   # crouch, leap, land, howl
keys = [(0, 0, -.03, 0, 0, 0), (8, -.08, -.24, -.12, 0, 0), (12, .1, -.05, .22, .3, 0), (18, .1, .5, .25, 1, 0), (24, .1, .45, -.2, 1, 0),
        (29, .05, -.18, -.1, 0, 0), (36, 0, -.05, .05, 0, .3), (46, -.05, -.02, .16, 0, 1), (60, -.05, -.02, .16, 0, 1), (72, 0, -.03, 0, 0, 0)]
for f, ox, oz, pitch, air, howl in keys:
    ox *= K; oz *= K
    feet = {}
    if air:
        feet = {"fL": (.25 * air, oz + .06), "fR": (.18 * air, oz + .03), "hL": (-.25 * air, oz + .03), "hR": (-.18 * air, oz)}
        if f == 24: feet = {"fL": (.2, .12), "fR": (.18, .09), "hL": (.06, .24), "hR": (.09, .22)}
    pose(f, off=(ox, oz), pitch=pitch, feet=feet, extra={"neck": qx(-.3 + .25 * air + .75 * howl), "head": qx(-.1 - .2 * howl - .1 * air),
         "tail1": qx(-.2 + .5 * air - .3 * howl), "tail2": qx(.1 * air), "tail3": qx(.12 * air), "tail4": qx(.15 * air - .1 * howl), "tail5": qx(.15 * air),
         "mane1": qx(-.25 * air + .15 * howl + (.2 if f == 29 else 0)), "mane2": qx(-.2 * air + .15 * howl + (.2 if f == 29 else 0))})
stash(a)
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animation_mode="NLA_TRACKS", export_yup=True, export_apply=False, export_image_format="WEBP", export_image_quality=82)
print("exported", OUT)

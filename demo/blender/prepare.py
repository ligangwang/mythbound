import bpy, sys, math, numpy as np
from mathutils import Matrix
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]; print([ (o.name, len(o.data.vertices)) for o in obs])
ob = obs[0]; bpy.context.view_layer.objects.active = ob; ob.select_set(True)
ob.parent = None
ob.matrix_world = Matrix.Rotation(-math.pi / 2, 4, "Z") @ Matrix.Scale(2.0, 4) @ ob.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.shade_smooth()
v = np.array([p.co[:] for p in ob.data.vertices]); zmin = v[:, 2].min()
ob.location.z = -zmin; bpy.ops.object.transform_apply(location=True)
v[:, 2] -= zmin; print("verts", len(v), "tris", len(ob.data.polygons), v.min(0), v.max(0))
np.save(out + ".npy", v); bpy.ops.wm.save_as_mainfile(filepath=out)

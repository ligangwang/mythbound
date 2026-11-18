# 3D movement tests

Experiments, not part of the game build. Run `npx vite` and open:

- `demo/hound.html` — a Stormhound built only from code in Blender (`blender/code-only-hound.py`).
- `demo/hound.html?real` — the Stormhound painting turned into a 3D model by TRELLIS.2
  (`blender/picture-to-model.py`, needs `HF_TOKEN`), then rigged and animated in Blender
  (`blender/prepare.py`, `blender/rig-and-animate.py`) and compressed with `gltf-transform meshopt`.
- `demo/view.html?m=<file.glb>` and `demo/ortho.html?m=<file.glb>&v=side|front|top` — viewers used to place the skeleton.

The Blender scripts run headless with the `bpy` Python package.

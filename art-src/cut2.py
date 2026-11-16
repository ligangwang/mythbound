# The model's cut-out, plus anything it missed that clearly isn't the flat grey ground
# (thin things like a brush staff), except near the floor where the cast shadow is.
import sys, numpy as np
from PIL import Image, ImageFilter
src, cut, dst = sys.argv[1:4]
rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
out = Image.open(cut).convert("RGBA")
a = np.asarray(out).astype(np.float32)
h, w, _ = rgb.shape
# The ground colour, row by row, from the picture's left and right edges.
# Measured against each edge on its own, so a tail that touches one edge doesn't colour the row.
dist = np.minimum(*[np.abs(rgb - side.mean(axis=1)[:, None, :]).max(axis=2) for side in (rgb[:, :12], rgb[:, -12:])])
key = np.clip((dist - 14) / 22, 0, 1) * 255
key[int(h * 0.9):] = 0
key = np.asarray(Image.fromarray(key.astype(np.uint8)).filter(ImageFilter.MedianFilter(3))).astype(np.float32)
# A seam where floor meets wall keys as a long thin horizontal line: drop anything under 9px tall.
from scipy.ndimage import grey_opening
key = grey_opening(key, size=(9, 1))
alpha = np.maximum(a[..., 3], key)
# Away from the body, anything the model kept that is the ground's own colour (a floor seam,
# the rim of a shadow) goes.
from scipy.ndimage import binary_opening, binary_dilation
body = binary_dilation(binary_opening(a[..., 3] > 128, iterations=26), iterations=30)
alpha = np.where(body, alpha, alpha * np.clip((dist - 8) / 14, 0, 1))
# A long, thin, level stroke outside the body is a floor seam, not a hair.
level = grey_opening(alpha, size=(1, 90))
seam = (level > 20) & (grey_opening(alpha, size=(11, 1)) < 20) & ~body
seam = binary_dilation(seam, iterations=2) & ~body
alpha = np.where(seam, 0, alpha)
# HOLES=1: also open large patches of bare ground enclosed by the figure (inside a halo, between tails).
import os
if os.environ.get("HOLES"):
    from scipy.ndimage import label, gaussian_filter
    bare = binary_opening(dist < 7, iterations=3)
    marks, n = label(bare)
    sizes = np.bincount(marks.ravel())
    big = np.isin(marks, [i for i in range(1, n + 1) if sizes[i] > 500])
    big = binary_dilation(big, iterations=3) & (dist < 14)
    alpha = alpha * (1 - gaussian_filter(big.astype(np.float32), 1.2))
res = np.dstack([rgb, alpha]).astype(np.uint8)
im = Image.fromarray(res, "RGBA"); im.save(dst)
prev = Image.new("RGB", (w * 2, h), (30, 38, 50)); prev.paste(Image.new("RGB", (w, h), (235, 225, 205)), (w, 0))
prev.paste(im, (0, 0), im); prev.paste(im, (w, 0), im); prev.save(dst.replace(".png", "-preview.jpg"), quality=85)

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
edge = np.concatenate([rgb[:, :12], rgb[:, -12:]], axis=1).mean(axis=1)[:, None, :]
dist = np.abs(rgb - edge).max(axis=2)
key = np.clip((dist - 14) / 22, 0, 1) * 255
key[int(h * 0.9):] = 0
key = np.asarray(Image.fromarray(key.astype(np.uint8)).filter(ImageFilter.MedianFilter(3))).astype(np.float32)
alpha = np.maximum(a[..., 3], key)
res = np.dstack([rgb, alpha]).astype(np.uint8)
im = Image.fromarray(res, "RGBA"); im.save(dst)
prev = Image.new("RGB", (w * 2, h), (30, 38, 50)); prev.paste(Image.new("RGB", (w, h), (235, 225, 205)), (w, 0))
prev.paste(im, (0, 0), im); prev.paste(im, (w, 0), im); prev.save(dst.replace(".png", "-preview.jpg"), quality=85)

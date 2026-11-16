import sys
from rembg import remove, new_session
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "isnet-general-use"
im = Image.open(src).convert("RGB")
out = remove(im, session=new_session(model), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=15, alpha_matting_erode_size=6)
out.save(dst)
# preview over a dark and a light ground
w, h = out.size
prev = Image.new("RGB", (w * 2, h), (30, 38, 50))
prev.paste(Image.new("RGB", (w, h), (235, 225, 205)), (w, 0))
prev.paste(out, (0, 0), out); prev.paste(out, (w, 0), out)
prev.save(dst.replace(".png", "-preview.jpg"), quality=85)

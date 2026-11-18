import sys, shutil, time
from gradio_client import Client, handle_file
src, out = sys.argv[1], sys.argv[2]
import os; c = Client("microsoft/TRELLIS.2", token=os.environ["HF_TOKEN"])
t = time.time()
c.predict(api_name="/start_session")
img = c.predict(handle_file(src), api_name="/preprocess_image"); print("pre", img, flush=True)
p = img["path"] if isinstance(img, dict) else img
c.predict(handle_file(p), 42, "1024", api_name="/image_to_3d"); print("3d done", time.time() - t, flush=True)
r = c.predict(int(sys.argv[3]), int(sys.argv[4]), api_name="/extract_glb"); print(r, time.time() - t, flush=True)
shutil.copy(r[1] or r[0], out)

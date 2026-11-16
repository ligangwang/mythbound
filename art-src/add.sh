#!/bin/sh
# add.sh <upload.png> <name>: cut a figure out of its grey ground and write src/art/<name>.webp
set -e
cd "$(dirname "$0")"
cp "$1" "$2.png"
python3 cut.py "$2.png" "$2-rembg.png" >/dev/null 2>&1
python3 cut2.py "$2.png" "$2-rembg.png" "$2-cut.png"
python3 - "$2" <<'P'
import sys
from PIL import Image
n=sys.argv[1]
im=Image.open(n+'-cut.png')
b=im.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
c=im.crop(b); c=c.resize((round(c.width*1100/c.height),1100),Image.LANCZOS); c.save('../src/art/'+n+'.webp',quality=86); print(n,c.size)
p=Image.open(n+'-cut-preview.jpg'); p.thumbnail((1400,1000)); p.save(n+'-cut-preview.jpg')
P
rm -f "$2-rembg.png" "$2-rembg-preview.jpg"

#!/bin/sh
# backdrop.sh <upload.png> <name>: keep the original and write src/art/<name>.webp
set -e
cd "$(dirname "$0")"
cp "$1" "$2.png"
python3 -c "
import sys
from PIL import Image
im=Image.open(sys.argv[1]+'.png').convert('RGB'); im.save('../src/art/'+sys.argv[1]+'.webp',quality=84); print(sys.argv[1], im.size)" "$2"

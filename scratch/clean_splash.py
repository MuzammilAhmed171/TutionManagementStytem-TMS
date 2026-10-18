import os
from PIL import Image

res_dir = os.path.abspath('android/app/src/main/res')
white_pixel = Image.new('RGBA', (1, 1), (255, 255, 255, 255))

for root, dirs, files in os.walk(res_dir):
    for f in files:
        if f == 'splash.png':
            full_path = os.path.join(root, f)
            white_pixel.save(full_path, 'PNG')
            print(f"Replaced {full_path} with blank white drawable")

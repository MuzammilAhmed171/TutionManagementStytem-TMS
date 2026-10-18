import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_tuition_icon(size=1024, shape='squircle', transparent_bg=False):
    # Create image with supersampling (2x) for razor sharp anti-aliasing
    canvas_size = size * 2
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = canvas_size / 2
    radius = canvas_size * 0.46

    if not transparent_bg:
        if shape == 'round':
            # Circle
            bbox = [center - radius, center - radius, center + radius, center + radius]
            # Navy gradient simulation
            draw.ellipse(bbox, fill=(14, 24, 48, 255))
            # Subtle gold inner ring
            ring_bbox = [center - radius + 8, center - radius + 8, center + radius - 8, center + radius - 8]
            draw.ellipse(ring_bbox, outline=(232, 160, 32, 60), width=int(8 * 2))
        else:
            # Squircle / Rounded Rect
            r = int(canvas_size * 0.22)
            margin = int(canvas_size * 0.04)
            bbox = [margin, margin, canvas_size - margin, canvas_size - margin]
            draw.rounded_rectangle(bbox, radius=r, fill=(14, 24, 48, 255))
            # Subtle gold border
            draw.rounded_rectangle(bbox, radius=r, outline=(232, 160, 32, 100), width=int(6 * 2))

    # Scale factor for drawing the emblem
    # If transparent_bg (adaptive icon foreground), the safe area is center 66%
    emblem_scale = 0.58 if transparent_bg else 0.62
    s = canvas_size * emblem_scale / 100.0

    # Center offset
    cx = center
    cy = center + (canvas_size * 0.02 if not transparent_bg else 0)

    # 1. Graduation Cap Top Diamond (Mortarboard)
    # Coordinates relative to center
    cap_top = (cx, cy - 28 * s)
    cap_right = (cx + 42 * s, cy - 10 * s)
    cap_bottom = (cx, cy + 8 * s)
    cap_left = (cx - 42 * s, cy - 10 * s)

    # Shadow under cap
    shadow_offset = 6 * s
    draw.polygon([
        (cap_left[0], cap_left[1] + shadow_offset),
        (cap_bottom[0], cap_bottom[1] + shadow_offset),
        (cap_right[0], cap_right[1] + shadow_offset),
        (cap_top[0], cap_top[1] + shadow_offset),
    ], fill=(5, 10, 22, 120))

    # Cap Main Gold Fill
    draw.polygon([cap_top, cap_right, cap_bottom, cap_left], fill=(232, 160, 32, 255)) # #E8A020

    # Cap Highlight / bevel (top half brighter)
    draw.polygon([cap_top, cap_right, (cx, cy - 10 * s), cap_left], fill=(245, 180, 55, 255))

    # Cap Outline
    draw.polygon([cap_top, cap_right, cap_bottom, cap_left], outline=(255, 215, 110, 255), width=int(2.5 * s))

    # Center Button on Cap
    btn_r = 4.5 * s
    draw.ellipse([cx - btn_r, cy - 10 * s - btn_r, cx + btn_r, cy - 10 * s + btn_r], fill=(255, 230, 150, 255), outline=(200, 130, 20, 255), width=int(1.5 * s))

    # Tassel hanging to the right
    tassel_pts = [
        (cx + 2 * s, cy - 10 * s),
        (cx + 24 * s, cy - 4 * s),
        (cx + 44 * s, cy + 8 * s),
        (cx + 44 * s, cy + 24 * s)
    ]
    draw.line(tassel_pts, fill=(245, 180, 55, 255), width=int(3.5 * s), joint='round')
    # Tassel bob
    draw.ellipse([cx + 41 * s, cy + 22 * s, cx + 47 * s, cy + 29 * s], fill=(255, 210, 90, 255))

    # 2. Skullcap / Headband underneath
    skull_pts = [
        (cx - 22 * s, cy - 2 * s),
        (cx - 22 * s, cy + 18 * s),
        (cx, cy + 28 * s),
        (cx + 22 * s, cy + 18 * s),
        (cx + 22 * s, cy - 2 * s)
    ]
    draw.line(skull_pts, fill=(210, 140, 20, 255), width=int(5 * s), joint='round')
    # Inner gold arch
    inner_arch = [
        (cx - 16 * s, cy + 5 * s),
        (cx - 16 * s, cy + 16 * s),
        (cx, cy + 24 * s),
        (cx + 16 * s, cy + 16 * s),
        (cx + 16 * s, cy + 5 * s)
    ]
    draw.line(inner_arch, fill=(255, 210, 90, 255), width=int(3.5 * s), joint='round')

    # 3. Open Book / Tuition Foundation at base
    book_y = cy + 34 * s
    # Left page
    draw.polygon([
        (cx - 2 * s, book_y),
        (cx - 32 * s, book_y - 6 * s),
        (cx - 32 * s, book_y + 12 * s),
        (cx - 2 * s, book_y + 16 * s)
    ], fill=(240, 245, 255, 245), outline=(200, 140, 20, 255), width=int(2 * s))

    # Right page
    draw.polygon([
        (cx + 2 * s, book_y),
        (cx + 32 * s, book_y - 6 * s),
        (cx + 32 * s, book_y + 12 * s),
        (cx + 2 * s, book_y + 16 * s)
    ], fill=(240, 245, 255, 245), outline=(200, 140, 20, 255), width=int(2 * s))

    # Spine marker
    draw.rectangle([cx - 2 * s, book_y, cx + 2 * s, book_y + 17 * s], fill=(232, 160, 32, 255))

    # Lines on pages to simulate tuition notes
    draw.line([(cx - 26 * s, book_y - 1 * s), (cx - 8 * s, book_y + 3 * s)], fill=(14, 24, 48, 160), width=int(1.8 * s))
    draw.line([(cx - 26 * s, book_y + 5 * s), (cx - 8 * s, book_y + 9 * s)], fill=(14, 24, 48, 160), width=int(1.8 * s))
    draw.line([(cx + 8 * s, book_y + 3 * s), (cx + 26 * s, book_y - 1 * s)], fill=(14, 24, 48, 160), width=int(1.8 * s))
    draw.line([(cx + 8 * s, book_y + 9 * s), (cx + 26 * s, book_y + 5 * s)], fill=(14, 24, 48, 160), width=int(1.8 * s))

    # Downsample with Lanczos for anti-aliasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def generate_all_icons(res_dir):
    # Standard launcher sizes
    launcher_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    # Adaptive foreground sizes (108dp base)
    foreground_sizes = {
        'mipmap-mdpi': 108,
        'mipmap-hdpi': 162,
        'mipmap-xhdpi': 216,
        'mipmap-xxhdpi': 324,
        'mipmap-xxxhdpi': 432,
    }

    for folder, size in launcher_sizes.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Square/Squircle launcher
        sq_img = create_tuition_icon(size=size, shape='squircle', transparent_bg=False)
        sq_img.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
        
        # Round launcher
        rd_img = create_tuition_icon(size=size, shape='round', transparent_bg=False)
        rd_img.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
        print(f"Generated {folder}/ic_launcher.png ({size}x{size}) and ic_launcher_round.png")

    for folder, size in foreground_sizes.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Foreground for adaptive icon
        fg_img = create_tuition_icon(size=size, shape='squircle', transparent_bg=True)
        fg_img.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), 'PNG')
        print(f"Generated {folder}/ic_launcher_foreground.png ({size}x{size})")

if __name__ == '__main__':
    res_path = os.path.abspath('android/app/src/main/res')
    generate_all_icons(res_path)
    # Also save a 512x512 high-res icon in public / src / android
    hi_res = create_tuition_icon(size=512, shape='squircle', transparent_bg=False)
    hi_res.save('android/app/src/main/ic_launcher-playstore.png', 'PNG')
    print("All icons generated successfully!")

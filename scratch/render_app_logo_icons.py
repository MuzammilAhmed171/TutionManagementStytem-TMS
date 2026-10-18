import os
import math
from PIL import Image, ImageDraw

def bezier_point(p0, p1, p2, p3, t):
    x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
    y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
    return (x, y)

def generate_exact_app_logo(size=1024, shape='squircle', transparent_bg=False):
    # Supersampling 2x (2048x2048) for ultra-smooth anti-aliasing
    canv = size * 2
    img = Image.new('RGBA', (canv, canv), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale from 32x32 SVG coordinate space to canvas
    # In 32x32 viewBox:
    # rect: x=2.5, y=2.5, width=27, height=27, rx=8
    # stroke: 1.8px -> stroke-gold-500/80
    # fill: ink-950 (#080E1E or #0A1124)
    
    scale = canv / 32.0
    
    GOLD_BORDER = (232, 160, 32, 230)    # #E8A020
    GOLD_FILL = (251, 191, 36, 255)       # #FBBF24 / gold-400
    GOLD_STROKE = (232, 160, 32, 255)     # #E8A020 / gold-500
    NAVY_BG = (10, 17, 36, 255)           # #0A1124 / ink-950
    
    # 1. Background
    if not transparent_bg:
        if shape == 'round':
            # Circle
            margin = 1.0 * scale
            draw.ellipse([margin, margin, canv - margin, canv - margin], fill=NAVY_BG, outline=GOLD_BORDER, width=int(1.8 * scale))
        else:
            # Squircle
            margin = 1.8 * scale
            r = int(7.8 * scale)
            draw.rounded_rectangle([margin, margin, canv - margin, canv - margin], radius=r, fill=NAVY_BG, outline=GOLD_BORDER, width=int(1.8 * scale))
    
    # 2. Mortarboard Cap Diamond: d="M16 7L6 11.8L16 16.6L26 11.8L16 7Z"
    cap_poly = [
        (16 * scale, 7 * scale),
        (6 * scale, 11.8 * scale),
        (16 * scale, 16.6 * scale),
        (26 * scale, 11.8 * scale)
    ]
    draw.polygon(cap_poly, fill=GOLD_FILL, outline=GOLD_STROKE)
    draw.line(cap_poly + [cap_poly[0]], fill=GOLD_STROKE, width=int(1.2 * scale), joint='round')
    
    # 3. Chin / Neck Arc:
    # d="M21.5 14.5V19.2C21.5 19.2 19.2 22 16 22C12.8 22 10.5 19.2 10.5 19.2V14.5"
    arc_points = [(21.5 * scale, 14.5 * scale), (21.5 * scale, 19.2 * scale)]
    # First cubic bezier from (21.5, 19.2) to (16, 22) with control points (21.5, 19.2) and (19.2, 22)
    p0 = (21.5 * scale, 19.2 * scale)
    p1 = (21.5 * scale, 20.6 * scale)
    p2 = (19.2 * scale, 22 * scale)
    p3 = (16.0 * scale, 22 * scale)
    for i in range(1, 21):
        t = i / 20.0
        arc_points.append(bezier_point(p0, p1, p2, p3, t))
        
    # Second cubic bezier from (16, 22) to (10.5, 19.2) with control points (12.8, 22) and (10.5, 19.2)
    q0 = (16.0 * scale, 22 * scale)
    q1 = (12.8 * scale, 22 * scale)
    q2 = (10.5 * scale, 20.6 * scale)
    q3 = (10.5 * scale, 19.2 * scale)
    for i in range(1, 21):
        t = i / 20.0
        arc_points.append(bezier_point(q0, q1, q2, q3, t))
        
    arc_points.append((10.5 * scale, 14.5 * scale))
    draw.line(arc_points, fill=GOLD_FILL, width=int(1.7 * scale), joint='round')
    
    # 4. Tassel Line: d="M26 12.2V17"
    draw.line([(26 * scale, 12.2 * scale), (26 * scale, 17 * scale)], fill=GOLD_FILL, width=int(1.4 * scale), joint='round')
    
    # 5. Tassel Circle: cx="26" cy="18" r="1"
    cr = 1.0 * scale
    draw.ellipse([(26 * scale - cr, 18 * scale - cr), (26 * scale + cr, 18 * scale + cr)], fill=GOLD_FILL)
    
    # 6. Base Line: d="M12 24.8H20"
    draw.line([(12 * scale, 24.8 * scale), (20 * scale, 24.8 * scale)], fill=GOLD_FILL, width=int(1.6 * scale), joint='round')
    
    # Lanczos downsampling to target size for crystal sharp anti-aliasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def generate_all_android_icons(res_dir):
    launcher_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    # For adaptive foreground: center the squircle/symbol within the 108dp canvas (66% safe zone)
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
        
        # Squircle icon
        sq = generate_exact_app_logo(size=size, shape='squircle', transparent_bg=False)
        sq.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
        
        # Round icon
        rd = generate_exact_app_logo(size=size, shape='round', transparent_bg=False)
        rd.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
        print(f"Generated {folder}/ic_launcher.png ({size}x{size}) & ic_launcher_round.png")

    for folder, size in foreground_sizes.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Adaptive foreground (108dp canvas)
        fg_canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        # Inner emblem is 72dp inside 108dp
        inner_size = int(size * 0.72)
        inner_img = generate_exact_app_logo(size=inner_size, shape='squircle', transparent_bg=False)
        offset = (size - inner_size) // 2
        fg_canvas.paste(inner_img, (offset, offset), inner_img)
        fg_canvas.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), 'PNG')
        print(f"Generated {folder}/ic_launcher_foreground.png ({size}x{size})")

    # High res store icon (512x512)
    hi_res = generate_exact_app_logo(size=512, shape='squircle', transparent_bg=False)
    hi_res.save('android/app/src/main/ic_launcher-playstore.png', 'PNG')
    print("All exact AppLogo icons generated successfully!")

if __name__ == '__main__':
    res_path = os.path.abspath('android/app/src/main/res')
    generate_all_android_icons(res_path)

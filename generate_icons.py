import struct
import zlib
import math

def create_png(width, height, draw_func):
    """Generate a raw RGBA PNG with python standard library."""
    pixels = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            idx = (y * width + x) * 4
            pixels[idx] = r
            pixels[idx+1] = g
            pixels[idx+2] = b
            pixels[idx+3] = a

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        start = y * width * 4
        raw_data.extend(pixels[start:start + width * 4])

    compressed = zlib.compress(raw_data, 9)

    def chunk(tag, data):
        length = struct.pack('!I', len(data))
        crc = struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff)
        return length + tag + data + crc

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    ihdr_data = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr_data))
    # IDAT
    png.extend(chunk(b'IDAT', compressed))
    # IEND
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

def draw_icon(x, y, W, H):
    # Normalized coordinates 0.0 -> 1.0
    nx = x / W
    ny = y / H
    
    # Rounded corner mask (Squircle radius 22%)
    r_corner = 0.22
    # Distance to corner centers
    dx = max(0.0, abs(nx - 0.5) - (0.5 - r_corner))
    dy = max(0.0, abs(ny - 0.5) - (0.5 - r_corner))
    dist_corner = math.sqrt(dx*dx + dy*dy)
    if dist_corner > r_corner:
        return (0, 0, 0, 0) # Transparent outside squircle
    
    # Background gradient: Deep Indigo to Navy
    t_diag = (nx + ny) / 2.0
    bg_r = int(24 + (10 - 24) * t_diag)
    bg_g = int(58 + (18 - 58) * t_diag)
    bg_b = int(140 + (35 - 140) * t_diag)

    # Subtle inner border ring
    if dist_corner > r_corner - 0.015 or nx < 0.02 or nx > 0.98 or ny < 0.02 or ny > 0.98:
        bg_r = min(255, bg_r + 40)
        bg_g = min(255, bg_g + 45)
        bg_b = min(255, bg_b + 55)

    # French Top Ribbon (Tricolore)
    if 0.09 <= ny <= 0.14:
        if 0.38 <= nx < 0.46: # Blue
            return (37, 99, 235, 255)
        elif 0.46 <= nx < 0.54: # White
            return (255, 255, 255, 255)
        elif 0.54 <= nx <= 0.62: # Red
            return (225, 29, 72, 255)

    # Central Glow around Eiffel tower
    cx, cy = 0.5, 0.52
    d_center = math.sqrt((nx - cx)**2 + (ny - cy)**2)
    if d_center < 0.35:
        glow = math.exp(-d_center * 5.0) * 0.35
        bg_r = int(bg_r * (1 - glow) + 37 * glow)
        bg_g = int(bg_g * (1 - glow) + 99 * glow)
        bg_b = int(bg_b * (1 - glow) + 235 * glow)

    # Eiffel Tower Geometry
    # Spire
    if 0.16 <= ny <= 0.30 and abs(nx - 0.5) < 0.008:
        return (248, 250, 252, 255)
    # Spire Tip Star / Light
    if math.sqrt((nx - 0.5)**2 + (ny - 0.16)**2) < 0.016:
        return (251, 191, 36, 255)
    
    # Upper Section
    if 0.30 <= ny <= 0.40:
        w_top = 0.015 + (ny - 0.30) * 0.12
        if abs(nx - 0.5) < w_top:
            if abs(nx - 0.5) < w_top - 0.008 and ny < 0.39:
                return (24, 58, 140, 255) # hollow inside
            return (255, 255, 255, 255)

    # Middle Platform (Gold)
    if 0.40 <= ny <= 0.42 and abs(nx - 0.5) < 0.06:
        return (245, 158, 11, 255)

    # Middle Section
    if 0.42 <= ny <= 0.58:
        w_mid = 0.04 + (ny - 0.42) * 0.25
        if abs(nx - 0.5) < w_mid:
            # outer pillars
            if abs(nx - 0.5) > w_mid - 0.015:
                return (255, 255, 255, 255)
            # horizontal beams
            if abs(ny - 0.47) < 0.006 or abs(ny - 0.53) < 0.006:
                return (148, 163, 184, 255)
            # cross beams
            diag1 = abs((nx - 0.5) - (ny - 0.50) * 0.8)
            diag2 = abs((nx - 0.5) + (ny - 0.50) * 0.8)
            if diag1 < 0.006 or diag2 < 0.006:
                return (148, 163, 184, 255)

    # Main Platform (Gold)
    if 0.58 <= ny <= 0.61 and abs(nx - 0.5) < 0.14:
        return (245, 158, 11, 255)

    # Lower Section / Legs & Arch
    if 0.61 <= ny <= 0.82:
        w_bot = 0.12 + (ny - 0.61) * 0.45
        arch_h = 0.82 - (abs(nx - 0.5) / 0.18)**2 * 0.14
        if abs(nx - 0.5) < w_bot:
            # Under arch cutout
            if ny > arch_h and abs(nx - 0.5) < 0.14:
                # Arch gold outline
                if abs(ny - arch_h) < 0.014:
                    return (251, 191, 36, 255)
            else:
                # Legs solid white with inner cutout
                if abs(nx - 0.5) > w_bot - 0.04 or ny < 0.65:
                    return (255, 255, 255, 255)

    # Open Book of Learning at Bottom
    if 0.77 <= ny <= 0.89:
        bx = (nx - 0.5) / 0.22 # -1.0 to 1.0
        if abs(bx) <= 1.0:
            curve_y = 0.80 + 0.04 * (1.0 - bx*bx)
            if curve_y - 0.04 <= ny <= curve_y + 0.02:
                if abs(bx) < 0.03:
                    return (255, 255, 255, 255) # Book Spine
                elif bx < 0:
                    return (37, 99, 235, 255) # French Blue page
                else:
                    return (225, 29, 72, 255) # French Red page

    # Decorative Learning Sparkles (Left & Right)
    def is_star(px, py, star_cx, star_cy, size):
        s_dx = abs(px - star_cx)
        s_dy = abs(py - star_cy)
        if s_dx + s_dy < size:
            return True
        return False

    if is_star(nx, ny, 0.28, 0.36, 0.035) or is_star(nx, ny, 0.72, 0.32, 0.025):
        return (251, 191, 36, 255)

    return (bg_r, bg_g, bg_b, 255)

def main():
    sizes = [
        ('icon-512.png', 512, 512),
        ('icon-192.png', 192, 192),
        ('apple-touch-icon.png', 180, 180),
        ('favicon-32x32.png', 32, 32),
        ('favicon-16x16.png', 16, 16)
    ]
    for filename, w, h in sizes:
        print(f"Generating {filename} ({w}x{h})...")
        data = create_png(w, h, draw_icon)
        with open(filename, 'wb') as f:
            f.write(data)
    print("All icons successfully generated!")

if __name__ == '__main__':
    main()

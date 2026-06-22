"""
Generate the Sakthi app launcher icons from the brand logo.

Produces a square monogram: purple->magenta diagonal gradient background,
a white "S" in Inter-Bold, crowned by the orange flame-spark from the logo.

Outputs full-bleed PNGs for every Android density (ic_launcher + ic_launcher_round)
and a 512x512 store-listing icon. Run from the SakthiMobile/ directory:

    python tools/make_icon.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
RES = os.path.join(PROJ, "android", "app", "src", "main", "res")
FONT_PATH = os.path.join(PROJ, "android", "app", "src", "main", "assets", "fonts", "Inter-Bold.ttf")
STORE_OUT = os.path.join(HERE, "sakthi_store_icon_512.png")

# Brand colors sampled from the logo
PURPLE = (58, 16, 120)      # deep indigo (left of wordmark)
MAGENTA = (190, 38, 142)    # magenta (right of wordmark)
ORANGE = (255, 96, 30)      # flame core
ORANGE_HI = (255, 168, 70)  # flame highlight

MASTER = 1024

# Android density buckets -> launcher icon pixel size
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(size):
    """Diagonal purple -> magenta gradient, full bleed."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(PURPLE, MAGENTA, t)
    return img


def draw_flame(draw, cx, base_y, scale):
    """Crown of three tapered rays fanning up-and-out, echoing the logo's 'I' flame."""
    # (angle from vertical in deg, length, base width)
    rays = [
        (0, 250 * scale, 46 * scale),
        (-30, 180 * scale, 32 * scale),
        (30, 180 * scale, 32 * scale),
    ]
    for ang_deg, length, bw in rays:
        ang = math.radians(ang_deg)
        # ray points upward/outward from the shared base point
        tipx = cx + math.sin(ang) * length
        tipy = base_y - math.cos(ang) * length
        # base edge is perpendicular to the ray direction
        px = math.cos(ang) * bw / 2
        py = math.sin(ang) * bw / 2
        draw.polygon(
            [(tipx, tipy), (cx + px, base_y + py), (cx - px, base_y - py)],
            fill=ORANGE,
        )


def build_master():
    img = gradient_bg(MASTER).convert("RGBA")

    # --- flame on its own layer so we can add a glow ---
    flame = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    fd = ImageDraw.Draw(flame)
    draw_flame(fd, cx=MASTER * 0.5, base_y=MASTER * 0.42, scale=1.0)
    glow = flame.filter(ImageFilter.GaussianBlur(26))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, flame)

    # --- the "S" monogram ---
    txt = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    font = ImageFont.truetype(FONT_PATH, int(MASTER * 0.56))
    bbox = td.textbbox((0, 0), "S", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (MASTER - tw) / 2 - bbox[0]
    ty = (MASTER - th) / 2 - bbox[1] + MASTER * 0.14
    td.text((tx, ty), "S", font=font, fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img, txt)

    return img


def round_mask(size):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    return m


def save_density(master, name, size, rounded):
    icon = master.resize((size, size), Image.LANCZOS)
    if rounded:
        icon.putalpha(round_mask(size))
    out_dir = os.path.join(RES, f"mipmap-{name}")
    os.makedirs(out_dir, exist_ok=True)
    fname = "ic_launcher_round.png" if rounded else "ic_launcher.png"
    icon.convert("RGBA").save(os.path.join(out_dir, fname))


def main():
    master = build_master()
    for name, size in DENSITIES.items():
        save_density(master, name, size, rounded=False)
        save_density(master, name, size, rounded=True)
    master.resize((512, 512), Image.LANCZOS).convert("RGB").save(STORE_OUT)
    print("Done. Store icon ->", STORE_OUT)


if __name__ == "__main__":
    main()

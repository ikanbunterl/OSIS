#!/usr/bin/env python3
"""
Generate ikon PWA (192/512/maskable + favicon) dari desain logo OSIS TD2.
Jalankan:  python3 scripts/gen-icons.py
Butuh:     Pillow  (pip install pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
SS = 4  # supersampling biar halus

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def font(size):
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def gradien(w, h, atas=(30, 43, 130), bawah=(11, 18, 32)):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(atas[0] + (bawah[0] - atas[0]) * t)
        g = int(atas[1] + (bawah[1] - atas[1]) * t)
        b = int(atas[2] + (bawah[2] - atas[2]) * t)
        for x in range(w):
            # sedikit variasi diagonal
            tt = (x / max(1, w - 1)) * 0.25
            px[x, y] = (
                max(0, min(255, int(r * (1 - tt) + 29 * tt))),
                max(0, min(255, int(g * (1 - tt) + 49 * tt))),
                max(0, min(255, int(b * (1 - tt) + 204 * tt * 0.35))),
            )
    return img


def perisai(draw, cx, cy, w, h, fill, outline, width):
    """Perisai sederhana: atas persegi membulat, bawah meruncing."""
    pts = [
        (cx - w / 2, cy - h / 2),
        (cx + w / 2, cy - h / 2),
        (cx + w / 2, cy + h * 0.12),
        (cx + w * 0.30, cy + h * 0.40),
        (cx, cy + h / 2),
        (cx - w * 0.30, cy + h * 0.40),
        (cx - w / 2, cy + h * 0.12),
    ]
    draw.polygon(pts, fill=fill, outline=outline)
    for i in range(1, width):
        shifted = [(x + (i - width / 2) * 0.0, y) for x, y in pts]
        draw.line(shifted + [shifted[0]], fill=outline, width=i)


def buat(ukuran, maskable=False):
    S = ukuran * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # latar
    bg = gradien(S, S).convert("RGBA")
    radius = int(S * (0.5 if maskable else 0.203))
    if maskable:
        img.paste(bg, (0, 0))
    else:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=radius, fill=255)
        img.paste(bg, (0, 0), mask)

    # area aman maskable = 80% tengah
    scale = 0.80 if maskable else 1.0
    cx, cy = S / 2, S / 2

    # perisai
    sw, sh = S * 0.52 * scale, S * 0.60 * scale
    perisai(
        draw,
        cx,
        cy - S * 0.01,
        sw,
        sh,
        fill=(15, 23, 42, 160),
        outline=(245, 158, 11, 255),
        width=max(2, int(S * 0.014)),
    )

    # teks TD2
    f = font(int(S * 0.20 * scale))
    draw.text((cx, cy + S * 0.02), "TD2", font=f, fill=(253, 230, 138, 255), anchor="mm")

    # tiga garis
    bar_w = S * 0.19 * scale
    for i, alpha in enumerate((235, 175, 120)):
        y = cy + S * (0.115 + i * 0.038)
        w = bar_w - i * S * 0.026 * scale
        draw.rounded_rectangle(
            [cx - w / 2, y, cx + w / 2, y + S * 0.016],
            radius=S * 0.008,
            fill=(226, 232, 240, alpha),
        )

    # bintang
    import math
    r1, r2 = S * 0.045 * scale, S * 0.019 * scale
    by = cy - S * 0.20
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        r = r1 if k % 2 == 0 else r2
        pts.append((cx + r * math.cos(ang), by + r * math.sin(ang)))
    draw.polygon(pts, fill=(253, 230, 138, 250))

    return img.resize((ukuran, ukuran), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)

    buat(192).save(OUT / "icons" / "192.png")
    buat(512).save(OUT / "icons" / "512.png")
    buat(512, maskable=True).save(OUT / "icons" / "maskable.png")
    buat(180).save(OUT / "icons" / "apple-touch-icon.png")

    # favicon .ico multi-ukuran
    ikon = buat(64)
    ikon.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    buat(32).save(OUT / "icons" / "32.png")

    print("Ikon dibuat di:", OUT)
    for f in sorted((OUT / "icons").glob("*.png")):
        print(" -", f.relative_to(ROOT), f.stat().st_size, "bytes")
    print(" -", "favicon.ico", (OUT / "favicon.ico").stat().st_size, "bytes")


if __name__ == "__main__":
    main()

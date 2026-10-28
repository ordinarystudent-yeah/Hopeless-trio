"""별빛스프 #9 16쪽: 고른 맛에 맞춘 임시 아트워크 (크레용·파스텔 질감). 가로 A4 한 쪽 297:210."""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1414, 1000
OUT = sys.argv[1]

def grad(top, bottom, mid=None):
    t = np.linspace(0, 1, H)[:, None]
    top, bottom = np.array(top, float), np.array(bottom, float)
    if mid is not None:
        mid = np.array(mid, float)
        a = np.where(t < .5, top + (mid - top) * (t / .5), mid + (bottom - mid) * ((t - .5) / .5))
    else:
        a = top + (bottom - top) * t
    a = np.repeat(a[:, None, :], W, axis=1)
    return Image.fromarray(a.astype('uint8'), 'RGB').convert('RGBA')

def grain(img, amt=26, seed=1):
    rng = np.random.default_rng(seed)
    a = np.asarray(img.convert('RGB')).astype(float)
    n = rng.normal(0, amt, (H, W, 1))
    # 종이 결: 가로 방향으로 살짝 늘린 노이즈
    n2 = np.asarray(Image.fromarray(((rng.random((H // 3, W // 9)) * 255).astype('uint8'))).resize((W, H))).astype(float)[:, :, None]
    a = a + n * 0.5 + (n2 - 128) * 0.12
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8'), 'RGB')

def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

def crayon_line(d, pts, color, width, alpha=170, jitter=None, rng=random):
    """크레용 선: 경로를 따라 작은 점을 흩뿌려 거친 질감"""
    jitter = jitter or width * 0.45
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        steps = max(1, int(math.hypot(x2 - x1, y2 - y1) / 2))
        for i in range(steps):
            t = i / steps
            x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            for _ in range(3):
                r = rng.uniform(width * 0.15, width * 0.42)
                ox, oy = rng.gauss(0, jitter), rng.gauss(0, jitter)
                a = int(alpha * rng.uniform(0.35, 1))
                d.ellipse((x + ox - r, y + oy - r, x + ox + r, y + oy + r), fill=color + (a,))

def wave(x0, y0, x1, y1, amp, freq, n=80, phase=0):
    pts = []
    for i in range(n + 1):
        t = i / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        dx, dy = y1 - y0, -(x1 - x0)
        L = math.hypot(dx, dy) or 1
        s = math.sin(t * math.pi * 2 * freq + phase) * amp
        pts.append((x + dx / L * s, y + dy / L * s))
    return pts

def star_shape(cx, cy, r, points=5, inner=0.45, rot=-90):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 180 / points)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

def paint_star(img, cx, cy, r, color, rng, glow=True):
    if glow:
        g = layer(); gd = ImageDraw.Draw(g)
        gd.ellipse((cx - r * 1.8, cy - r * 1.8, cx + r * 1.8, cy + r * 1.8), fill=color + (90,))
        img.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * 0.9)))
    s = layer(); sd = ImageDraw.Draw(s)
    pts = star_shape(cx, cy, r, rot=rng.uniform(-110, -70))
    sd.polygon(pts, fill=color + (235,))
    crayon_line(sd, pts + [pts[0]], tuple(min(255, c + 40) for c in color), max(4, r * 0.12), 200, rng=rng)
    img.alpha_composite(s)

def dots(img, n, color_choices, rmin, rmax, rng, area=None, alpha=(120, 255)):
    d = ImageDraw.Draw(img)
    for _ in range(n):
        if area:
            x, y = area(rng)
        else:
            x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.uniform(rmin, rmax)
        c = rng.choice(color_choices)
        d.ellipse((x - r, y - r, x + r, y + r), fill=c + (int(rng.uniform(*alpha)),))

def galaxy():
    rng = random.Random(7)
    img = grad((22, 26, 86), (120, 60, 160), (52, 40, 130))
    # 은하수 띠: 대각선으로 부드러운 색 덩어리
    band = layer(); bd = ImageDraw.Draw(band)
    for i in range(260):
        t = rng.random()
        x = -80 + t * (W + 160); y = H * 0.85 - t * H * 0.7 + math.sin(t * 9) * 60
        r = rng.uniform(40, 120)
        c = rng.choice([(255, 140, 200), (190, 150, 255), (130, 210, 255), (255, 210, 150), (255, 255, 255)])
        bd.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=c + (rng.randint(18, 45),))
    img.alpha_composite(band.filter(ImageFilter.GaussianBlur(28)))
    # 사탕 같은 소용돌이 크레용 선
    sw = layer(); sd = ImageDraw.Draw(sw)
    for k, c in enumerate([(255, 150, 210), (170, 200, 255), (255, 230, 160)]):
        pts = wave(-40, H * (0.9 - k * 0.08), W + 40, H * (0.15 - k * 0.08), 40 + k * 14, 2.2, phase=k)
        crayon_line(sd, pts, c, 26, 150, rng=rng)
    img.alpha_composite(sw.filter(ImageFilter.GaussianBlur(1.2)))
    # 반짝이 가루
    def along(r):
        t = r.random(); return (-40 + t * (W + 80) + r.gauss(0, 30), H * 0.85 - t * H * 0.7 + r.gauss(0, 110))
    dots(img, 900, [(255, 255, 255), (255, 240, 190), (255, 200, 230)], 1.2, 3.6, rng, along)
    dots(img, 160, [(255, 255, 255)], 1, 2.4, rng)
    for (x, y, r, c) in [(260, 220, 46, (255, 214, 102)), (1120, 330, 36, (255, 170, 210)), (760, 640, 30, (180, 220, 255)), (420, 760, 24, (255, 236, 150)), (1180, 820, 40, (255, 214, 102))]:
        paint_star(img, x, y, r, c, rng)
    return img

def spark():
    rng = random.Random(11)
    img = grad((14, 18, 60), (60, 30, 90), (30, 24, 80))
    def burst(cx, cy, R, cols, n):
        lay = layer(); d = ImageDraw.Draw(lay)
        g = layer(); gd = ImageDraw.Draw(g)
        gd.ellipse((cx - R * 0.6, cy - R * 0.6, cx + R * 0.6, cy + R * 0.6), fill=cols[0] + (120,))
        img.alpha_composite(g.filter(ImageFilter.GaussianBlur(R * 0.35)))
        for i in range(n):
            a = i / n * math.tau + rng.uniform(-0.08, 0.08)
            r0, r1 = R * rng.uniform(0.12, 0.25), R * rng.uniform(0.75, 1.1)
            pts = [(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)]
            crayon_line(d, pts, rng.choice(cols), R * 0.06, 200, rng=rng)
            ex, ey = pts[1]
            rr = R * 0.035
            d.ellipse((ex - rr, ey - rr, ex + rr, ey + rr), fill=(255, 255, 230, 230))
        img.alpha_composite(lay)
    burst(700, 470, 330, [(255, 220, 90), (255, 160, 60), (255, 255, 230)], 34)
    burst(270, 250, 170, [(120, 230, 255), (255, 255, 255), (170, 160, 255)], 22)
    burst(1170, 260, 190, [(255, 120, 170), (255, 210, 120), (255, 255, 255)], 24)
    burst(1150, 800, 150, [(160, 255, 170), (255, 255, 200)], 18)
    burst(260, 820, 130, [(255, 200, 90), (255, 140, 120)], 16)
    dots(img, 500, [(255, 255, 255), (255, 230, 150), (255, 180, 210), (170, 230, 255)], 1.5, 5, rng)
    for (x, y, r, c) in [(700, 470, 60, (255, 240, 170)), (520, 140, 26, (255, 214, 102)), (930, 880, 28, (255, 170, 210)), (90, 520, 22, (180, 220, 255))]:
        paint_star(img, x, y, r, c, rng)
    return img

def cloud():
    rng = random.Random(5)
    img = grad((255, 214, 196), (196, 186, 240), (250, 196, 214))
    def puff(cx, cy, w, h, base, shade):
        lay = layer(); d = ImageDraw.Draw(lay)
        circles = []
        for i in range(9):
            t = i / 8
            x = cx - w / 2 + t * w
            r = h * (0.38 + 0.32 * math.sin(t * math.pi)) * rng.uniform(0.85, 1.1)
            circles.append((x, cy - r * 0.35, r))
        d.rounded_rectangle((cx - w / 2, cy - h * 0.15, cx + w / 2, cy + h * 0.3), radius=h * 0.25, fill=base + (255,))
        for x, y, r in circles:
            d.ellipse((x - r, y - r, x + r, y + r), fill=base + (255,))
        soft = lay.filter(ImageFilter.GaussianBlur(6))
        # 아래쪽 그림자
        sh = layer(); sd = ImageDraw.Draw(sh)
        sd.ellipse((cx - w * 0.45, cy, cx + w * 0.45, cy + h * 0.38), fill=shade + (110,))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        img.alpha_composite(soft)
        # 위쪽에 부드러운 하이라이트 (크레용 질감)
        hl = layer(); hd = ImageDraw.Draw(hl)
        for x, y, r in circles[2:7]:
            hd.ellipse((x - r * 0.55, y - r * 0.75, x + r * 0.35, y - r * 0.1), fill=(255, 255, 255, 120))
        img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(14)))

    # 해 대신 부드러운 빛
    g = layer(); gd = ImageDraw.Draw(g)
    gd.ellipse((900, 60, 1300, 460), fill=(255, 246, 210, 170))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(70)))
    puff(420, 330, 560, 230, (255, 250, 244), (230, 170, 190))
    puff(1050, 560, 640, 260, (255, 244, 236), (200, 170, 220))
    puff(330, 790, 520, 210, (255, 236, 240), (225, 160, 185))
    puff(1180, 180, 300, 120, (255, 252, 246), (225, 190, 200))
    # 부드러운 바람결 선
    wl = layer(); wd = ImageDraw.Draw(wl)
    for k, c in enumerate([(255, 255, 255), (255, 210, 225)]):
        crayon_line(wd, wave(80, 560 + k * 40, 700, 520 + k * 40, 18, 1.6, phase=k), c, 12, 130, rng=rng)
    img.alpha_composite(wl)
    dots(img, 140, [(255, 255, 255), (255, 236, 170)], 2, 5, rng, alpha=(140, 230))
    for (x, y, r, c) in [(720, 150, 26, (255, 214, 102)), (150, 140, 20, (255, 236, 150)), (760, 880, 22, (255, 200, 220))]:
        paint_star(img, x, y, r, c, rng)
    return img

for name, fn in [('galaxy', galaxy), ('spark', spark), ('cloud', cloud)]:
    im = grain(fn(), seed=hash(name) % 1000)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    p = f'{OUT}/09-taste-{name}.jpg'
    im.save(p, 'JPEG', quality=84, optimize=True, progressive=True)
    print(p)

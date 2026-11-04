"""별빛스프 #9 16쪽: 고른 맛 그림 — 지금 삽화들처럼 흰 종이 위 파스텔 크레용 질감.
가로 A4 한 쪽 297:210. (쪽 왼쪽 1/3은 투명하게 처리되어 15쪽 삽화와 이어진다)
사용: python3 taste_art.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1414, 1000
OUT = sys.argv[1].rstrip('/')

def layer(): return Image.new('RGBA', (W, H), (255, 255, 255, 0))   # 흰색 투명: 흐림 처리할 때 회색 테두리가 생기지 않게

def blur(L, r):
    """알파를 고려해 흐리게 (색이 투명한 바탕과 섞여 탁해지지 않게)"""
    a = np.asarray(L).astype(float); al = a[..., 3:4] / 255
    pm = Image.fromarray(np.clip(np.concatenate([a[..., :3] * al, a[..., 3:4]], -1), 0, 255).astype('uint8'), 'RGBA').filter(ImageFilter.GaussianBlur(r))
    b = np.asarray(pm).astype(float); al2 = np.maximum(b[..., 3:4] / 255, 1e-3)
    return Image.fromarray(np.clip(np.concatenate([b[..., :3] / al2, b[..., 3:4]], -1), 0, 255).astype('uint8'), 'RGBA')

def paper():
    a = np.full((H, W, 3), (253, 250, 244), float)
    a += np.random.default_rng(1).normal(0, 4, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8')).convert('RGBA')

def crayon_blob(img, rng, cx, cy, rx, ry, cols, n=2600, ang=-0.6, soft=1.2, alpha=(90, 190), lw=(3, 6)):
    """타원 안을 비스듬한 크레용 결로 칠한다 (가장자리는 성기게)."""
    L = layer(); d = ImageDraw.Draw(L)
    for i in range(n):
        t = rng.uniform(0, math.tau); rr = math.sqrt(rng.random())
        x, y = cx + math.cos(t) * rx * rr, cy + math.sin(t) * ry * rr
        if rr > 0.85 and rng.random() < 0.5: continue
        l = rng.uniform(14, 40); a = ang + rng.gauss(0, 0.15)
        c = cols[i % len(cols)]
        d.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=c + (rng.randint(*alpha),), width=rng.randint(*lw))
    img.alpha_composite(blur(L, soft))

def star_pts(cx, cy, r, inner=0.48, rot=-90):
    return [(cx + (r if k % 2 == 0 else r * inner) * math.cos(math.radians(rot + k * 36)),
             cy + (r if k % 2 == 0 else r * inner) * math.sin(math.radians(rot + k * 36))) for k in range(10)]

def crayon_star(img, rng, cx, cy, r, fill, edge, rot=-90):
    L = layer(); d = ImageDraw.Draw(L)
    d.polygon(star_pts(cx, cy, r * 1.12, rot=rot), fill=edge + (230,))
    d.polygon(star_pts(cx, cy, r, rot=rot), fill=fill + (255,))
    for k in range(int(r * 2)):
        t = rng.uniform(0, math.tau); rr = rng.uniform(0, r * 0.55)
        x, y = cx + math.cos(t) * rr, cy + math.sin(t) * rr
        d.line((x, y, x + 12, y - 8), fill=(255, 255, 255, rng.randint(60, 140)), width=3)
    img.alpha_composite(blur(L, 1.8))

def dots(img, rng, n, cols, rmin=3, rmax=9):
    L = layer(); d = ImageDraw.Draw(L)
    for i in range(n):
        x, y = rng.uniform(0, W), rng.uniform(0, H); s = rng.uniform(rmin, rmax)
        d.ellipse((x - s, y - s, x + s, y + s), fill=cols[i % len(cols)] + (rng.randint(140, 230),))
    img.alpha_composite(blur(L, 1))

def galaxy():
    """은하수가 퍼지는 듯한 달콤한 맛: 라일락·하늘빛 크레용 은하수 띠 + 노란 별"""
    rng = random.Random(3); img = paper()
    for k in range(3):   # 굽이치는 은하수 띠 (삽화의 물결처럼)
        L = layer(); d = ImageDraw.Draw(L)
        cols = [(196, 178, 246), (170, 200, 250), (236, 196, 240), (200, 236, 246)]
        for i in range(5200):
            u = rng.random(); x = W * (0.15 + 0.9 * u)
            y = H * (0.5 + 0.22 * math.sin(u * 5.2 + k * 0.9) + (k - 1) * 0.12) + rng.gauss(0, 46)
            l = rng.uniform(16, 42); a = math.atan(0.22 * 5.2 * math.cos(u * 5.2 + k * 0.9) * H / W / 0.9) + rng.gauss(0, 0.15)
            d.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=cols[i % 4] + (rng.randint(70, 170),), width=rng.randint(3, 6))
        img.alpha_composite(blur(L, 1.3))
    for (u, v, r) in [(0.55, 0.3, 70), (0.82, 0.55, 90), (0.66, 0.78, 54), (0.92, 0.2, 46), (0.42, 0.62, 40)]:
        crayon_star(img, rng, u * W, v * H, r, (255, 230, 120), (250, 190, 90), rot=rng.uniform(-110, -70))
    dots(img, rng, 120, [(255, 255, 255), (255, 236, 160), (210, 196, 250)], 2, 6)
    return img

def spark():
    """별빛이 입 안에서 터지는 듯한 짜릿한 맛: 15쪽처럼 노랑·하늘빛 크레용 별 폭발"""
    rng = random.Random(5); img = paper()
    crayon_blob(img, rng, W * 0.68, H * 0.5, W * 0.4, H * 0.48, [(206, 236, 250), (240, 214, 246), (226, 244, 236)], n=3600, alpha=(50, 120))
    def burst(cx, cy, R, n=8):
        L = layer(); d = ImageDraw.Draw(L)
        pts = []
        for k in range(n * 2):
            a = k * math.pi / n + rng.uniform(-0.08, 0.08); rr = R if k % 2 == 0 else R * rng.uniform(0.38, 0.5)
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        d.polygon(pts, fill=(96, 206, 230, 255))
        inner = [(cx + (x - cx) * 0.8, cy + (y - cy) * 0.8) for x, y in pts]
        d.polygon(inner, fill=(255, 232, 120, 255))
        for k in range(int(R * 3)):
            t = rng.uniform(0, math.tau); rr = rng.uniform(0, R * 0.4)
            x, y = cx + math.cos(t) * rr, cy + math.sin(t) * rr
            d.line((x, y, x + 14, y - 9), fill=(255, 250, 220, rng.randint(70, 150)), width=3)
        img.alpha_composite(blur(L, 2.2))
    burst(W * 0.66, H * 0.48, 300, 9)
    burst(W * 0.9, H * 0.18, 130, 7)
    burst(W * 0.46, H * 0.82, 120, 7)
    for (u, v, r, f, e) in [(0.4, 0.25, 48, (255, 186, 226), (170, 236, 200)), (0.88, 0.78, 56, (200, 250, 240), (250, 170, 120)),
                            (0.56, 0.12, 34, (255, 186, 226), (170, 236, 200))]:
        crayon_star(img, rng, u * W, v * H, r, f, e, rot=rng.uniform(-110, -70))
    # 톡톡 튀는 방울
    L = layer(); d = ImageDraw.Draw(L)
    for i in range(46):
        a = rng.uniform(0, math.tau); rr = rng.uniform(320, 560)
        x, y = W * 0.66 + math.cos(a) * rr, H * 0.48 + math.sin(a) * rr * 0.7; s = rng.uniform(8, 18)
        c = rng.choice([(96, 206, 230), (255, 214, 110), (250, 170, 210)])
        if rng.random() < 0.5: d.ellipse((x - s, y - s, x + s, y + s), outline=c + (220,), width=5)
        else: d.line((x, y, x + math.cos(a) * s * 2, y + math.sin(a) * s * 2), fill=c + (220,), width=8)
    img.alpha_composite(blur(L, 1.2))
    return img

def cloud():
    """구름을 입에 머금은 듯한 포근한 맛: 몽글몽글한 파스텔 구름 + 작은 별"""
    rng = random.Random(9); img = paper()
    crayon_blob(img, rng, W * 0.7, H * 0.4, W * 0.4, H * 0.4, [(214, 236, 248), (246, 226, 240), (252, 240, 214)], n=3000, alpha=(50, 110))
    for (u, v, s) in [(0.66, 0.55, 1.0), (0.9, 0.3, 0.6), (0.48, 0.3, 0.5), (0.86, 0.82, 0.55)]:
        cx, cy, R = u * W, v * H, 210 * s
        for (ox, oy, rr) in [(-0.9, 0.15, 0.6), (-0.35, -0.25, 0.78), (0.3, -0.35, 0.86), (0.9, 0.05, 0.62), (0, 0.25, 0.8)]:
            crayon_blob(img, rng, cx + ox * R, cy + oy * R, rr * R, rr * R * 0.82,
                        [(206, 222, 252), (226, 212, 250), (246, 222, 244), (196, 230, 246)], n=int(1500 * s * rr + 300), ang=-0.4, alpha=(130, 230), soft=1.4)
        # 아래쪽 하늘빛 그늘
        crayon_blob(img, rng, cx, cy + R * 0.42, R * 1.2, R * 0.22, [(160, 180, 236), (184, 166, 232)], n=int(700 * s), ang=0, alpha=(80, 160))
    for (u, v, r) in [(0.5, 0.12, 30), (0.98, 0.58, 26), (0.58, 0.88, 34), (0.78, 0.1, 22)]:
        crayon_star(img, rng, u * W, v * H, r, (255, 236, 150), (250, 200, 120))
    dots(img, rng, 60, [(255, 255, 255), (246, 226, 250)], 3, 8)
    return img

for name, fn in (('galaxy', galaxy), ('spark', spark), ('cloud', cloud)):
    im = fn().convert('RGB')
    p = OUT + '/09-taste-' + name + '.jpg'
    im.save(p, 'JPEG', quality=84, optimize=True, progressive=True)
    print(p)

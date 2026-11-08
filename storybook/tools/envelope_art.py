"""#10 18쪽: 황금빛 편지봉투 (크레용 그림체).
  envelope-closed.png : 닫힌 봉투(덮개 쪽). 떨어질 때와 창틀에 놓였을 때 (원근은 CSS로 눕힌다)
  envelope-open.png   : 덮개가 위로 열린 봉투. 펼쳤을 때 그 위로 편지지(글)가 비스듬히 나온다
사용: python3 envelope_art.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

rng = random.Random(21)
GOLD = (246, 196, 92)
GOLD_D = (222, 160, 58)      # 덮개·접힌 면 (조금 진하게)
GOLD_L = (255, 222, 140)     # 안쪽·밝은 면
INK = (176, 112, 36)         # 크레용 테두리
SEAL = (240, 110, 110)       # 별 봉인


def crayon_fill(img, poly, base, rng, strokes=2600, light=(255, 246, 214), dark=None, angle=(-38, -28)):
    """다각형 안을 바탕색 + 비스듬한 크레용 결로 칠한다 (9쪽 말풍선처럼)"""
    W, H = img.size
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    lay = Image.new('RGBA', (W, H), base + (255,))
    strokes_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))   # 결은 따로 그려 바탕 위에 겹친다 (바로 그리면 그 자리가 반투명해진다)
    d = ImageDraw.Draw(strokes_l)
    dark = dark or tuple(max(0, c - 34) for c in base)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    for _ in range(strokes):
        x, y = rng.uniform(min(xs) - 40, max(xs) + 40), rng.uniform(min(ys) - 40, max(ys) + 40)
        a = math.radians(rng.uniform(*angle)); l = rng.uniform(16, 60)
        c = rng.choice([light, light, dark, (255, 236, 190), (255, 214, 150), (250, 196, 176)])
        d.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=c + (rng.randint(14, 48),), width=rng.randint(2, 4))
    lay.alpha_composite(strokes_l.filter(ImageFilter.GaussianBlur(1.1)))
    img.paste(lay, (0, 0), mask)


def crayon_line(img, pts, color, width=5, passes=3, closed=False, rng=rng):
    """손으로 그은 크레용 선 (살짝 떨리며 여러 번 겹쳐 긋는다)"""
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    seq = list(pts) + ([pts[0]] if closed else [])
    for k in range(passes):
        prev = None
        for i in range(len(seq) - 1):
            (x0, y0), (x1, y1) = seq[i], seq[i + 1]
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 14))
            for j in range(n + 1):
                t = j / n
                p = (x0 + (x1 - x0) * t + rng.uniform(-1.6, 1.6), y0 + (y1 - y0) * t + rng.uniform(-1.6, 1.6))
                if prev: d.line((prev, p), fill=color + (rng.randint(110, 200),), width=width + rng.randint(-1, 1))
                prev = p
        prev = None
    img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(0.7)))


def grain(img, amt=6):
    a = np.asarray(img).astype(float)
    a[..., :3] += np.random.default_rng(4).normal(0, amt, a[..., :3].shape)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def star(cx, cy, r):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


def closed(path):
    W, H = 900, 440
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    m = 14
    body = [(m, m), (W - m, m), (W - m, H - m), (m, H - m)]
    crayon_fill(img, body, GOLD, rng)
    # 아래·양옆에서 가운데로 모이는 접힌 면 (살짝 진하게)
    cx, cy = W / 2, H * 0.6
    crayon_fill(img, [(m, H - m), (cx, H * 0.52), (W - m, H - m)], tuple(c - 10 for c in GOLD), rng, strokes=900)
    # 덮개: 위 양 모서리에서 가운데 아래로 내려오는 V
    tip = (cx, H * 0.66)
    crayon_fill(img, [(m, m), (W - m, m), tip], GOLD_D, rng, strokes=1400)
    # 덮개 그림자
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(m + 10, m + 10), (W - m - 10, m + 10), (tip[0], tip[1] + 12)], fill=(120, 70, 10, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    under = Image.new('RGBA', (W, H), (0, 0, 0, 0)); under.alpha_composite(sh)
    under.alpha_composite(img); img = under
    crayon_fill(img, [(m, m), (W - m, m), tip], GOLD_D, rng, strokes=1400)
    # 크레용 선
    crayon_line(img, body, INK, closed=True)
    crayon_line(img, [(m, m), tip, (W - m, m)], INK)
    crayon_line(img, [(m + 6, H - m - 6), (cx - 60, H * 0.58)], INK, width=3, passes=2)
    crayon_line(img, [(W - m - 6, H - m - 6), (cx + 60, H * 0.58)], INK, width=3, passes=2)
    # 별 봉인
    crayon_fill(img, star(tip[0], tip[1] - 8, 46), SEAL, rng, strokes=500, light=(255, 200, 200))
    crayon_line(img, star(tip[0], tip[1] - 8, 46), (190, 70, 70), width=4, closed=True)
    save(grain(img), path)


def opened(path):
    W, H = 900, 720
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    m = 14
    top = 300                    # 봉투 몸통 위쪽 (그 위로 덮개가 열려 있다)
    cx = W / 2
    # 열린 덮개 (뒤로 젖혀져 위로)
    flap = [(m, top), (W - m, top), (cx, m + 10)]
    crayon_fill(img, flap, GOLD_D, rng, strokes=1500)
    # 봉투 안쪽 (어둡게)
    inner = [(m + 8, top), (W - m - 8, top), (W - m - 8, H - m - 60), (m + 8, H - m - 60)]
    crayon_fill(img, inner, (196, 132, 46), rng, strokes=900, light=(230, 170, 80))
    # 앞판: 양옆 접힌 면 + 아래 접힌 면 (편지지는 CSS로 이 사이에 끼운다)
    crayon_fill(img, [(m, top), (cx - 40, H * 0.72), (m, H - m)], GOLD, rng, strokes=900)
    crayon_fill(img, [(W - m, top), (cx + 40, H * 0.72), (W - m, H - m)], GOLD, rng, strokes=900)
    crayon_fill(img, [(m, H - m), (cx, H * 0.58), (W - m, H - m)], GOLD_L, rng, strokes=1200)
    crayon_line(img, [(m, top), (cx, m + 10), (W - m, top)], INK)
    crayon_line(img, [(m, top), (W - m, top), (W - m, H - m), (m, H - m)], INK, closed=True)
    crayon_line(img, [(m + 4, top + 4), (cx - 40, H * 0.72)], INK, width=3, passes=2)
    crayon_line(img, [(W - m - 4, top + 4), (cx + 40, H * 0.72)], INK, width=3, passes=2)
    crayon_line(img, [(m + 6, H - m - 6), (cx, H * 0.58), (W - m - 6, H - m - 6)], INK, width=4)
    save(grain(img), path)


def save(img, path):
    img = img.resize((img.width * 2 // 3, img.height * 2 // 3), Image.LANCZOS)
    img.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(path, optimize=True)


out = sys.argv[1] if len(sys.argv) > 1 else '.'
closed(out + '/envelope-closed.png')
opened(out + '/envelope-open.png')
print('ok')

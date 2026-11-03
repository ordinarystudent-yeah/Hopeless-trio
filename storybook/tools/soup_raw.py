"""별빛스프 젓기 전 모습: #7 삽화처럼 파스텔 크레용 결의 푸른 스프 위에 별 모양 건더기가 동동.
위에서 본 그릇 안쪽 원(지름 660)만 그린 투명 PNG. 저을수록 옅어져 아래의 금빛 스프가 드러난다.
사용: python3 soup_raw.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 660
rng = random.Random(11)
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

def layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))

# 바탕: 파스텔 페리윙클 블루, 가운데가 조금 밝게
yy, xx = np.mgrid[0:S, 0:S]
d = np.hypot(xx - S * 0.46, yy - S * 0.42) / (S * 0.6)
col = np.stack([196 - 30 * d, 206 - 26 * d, 248 - 14 * d], -1).clip(0, 255)
base = Image.fromarray(col.astype('uint8'), 'RGB').convert('RGBA')
img.alpha_composite(base)

# 크레용 결: 밝은 하늘색·라일락·민트 짧은 선을 비스듬히 잔뜩
cr = layer(); cd = ImageDraw.Draw(cr)
palette = [(232, 240, 255), (210, 196, 246), (196, 236, 230), (176, 190, 240), (248, 226, 246)]
for i in range(5200):
    x, y = rng.uniform(0, S), rng.uniform(0, S)
    l = rng.uniform(8, 26); a = -0.75 + rng.gauss(0, 0.18)
    c = palette[i % len(palette)]
    cd.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=c + (rng.randint(60, 150),), width=2)
img.alpha_composite(cr.filter(ImageFilter.GaussianBlur(0.7)))

# 별 모양 건더기 (#7의 노랑·분홍 파스텔 별): 크레용으로 칠한 듯 가장자리가 부드럽게
def star(cx, cy, r, inner, rot):
    return [(cx + (r if k % 2 == 0 else r * inner) * math.cos(math.radians(rot + k * 36)),
             cy + (r if k % 2 == 0 else r * inner) * math.sin(math.radians(rot + k * 36))) for k in range(10)]
stars = layer(); sd = ImageDraw.Draw(stars)
spots = [(0.30, 0.30), (0.64, 0.27), (0.74, 0.58), (0.44, 0.60), (0.22, 0.60), (0.54, 0.84), (0.30, 0.82)]
for i, (u, v) in enumerate(spots):
    cx, cy, r = u * S, v * S, rng.uniform(60, 86)
    rot = rng.uniform(-110, -70)
    sd.polygon(star(cx + 6, cy + 8, r, 0.5, rot), fill=(150, 150, 210, 90))                    # 그림자
    sd.polygon(star(cx, cy, r, 0.5, rot), fill=(255, 234, 150, 255))
    sd.polygon(star(cx - r * 0.12, cy - r * 0.12, r * 0.55, 0.5, rot), fill=(255, 246, 196, 230))  # 밝은 가운데
    for k in range(70):                                                                       # 분홍 크레용 결
        a = rng.uniform(0, math.tau); rr = rng.uniform(0, r * 0.5)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        sd.line((x, y, x + 9, y - 6), fill=(250, 186, 206, rng.randint(40, 120)), width=2)
img.alpha_composite(stars.filter(ImageFilter.GaussianBlur(3)))

# 반짝이 점
sp = layer(); spd = ImageDraw.Draw(sp)
for i in range(50):
    x, y = rng.uniform(0, S), rng.uniform(0, S); s2 = rng.uniform(1.5, 3.5)
    spd.ellipse((x - s2, y - s2, x + s2, y + s2), fill=(255, 255, 255, rng.randint(150, 230)))
img.alpha_composite(sp)

# 원으로 오려 내기 (가장자리는 살짝 어둡게, 부드럽게)
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse((2, 2, S - 3, S - 3), fill=255)
edge = layer(); ImageDraw.Draw(edge).ellipse((0, 0, S - 1, S - 1), outline=(120, 120, 190, 120), width=14)
img.alpha_composite(edge.filter(ImageFilter.GaussianBlur(8)))
img.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
p = sys.argv[1].rstrip('/') + '/08-soup-raw.png'
img.resize((480, 480), Image.LANCZOS).save(p, optimize=True)
print(p)

"""별빛스프 #8: 위에서 내려다본(버즈아이뷰) 별빛스프 그릇 — 크레용·파스텔 질감 임시 아트워크.
가로 A4 한 쪽(297:210). 그릇은 쪽 가운데, 재료 스티커가 그 위에 놓인다.
사용: python3 soup_top.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1414, 1000
CX, CY = W // 2, H // 2 + 10
rng = random.Random(3)

def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

def crayon_ring(d, cx, cy, r, color, width, alpha=170, n=900):
    for i in range(n):
        a = i / n * math.tau
        rr = r + rng.gauss(0, width * 0.25)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        s = rng.uniform(width * 0.2, width * 0.5)
        d.ellipse((x - s, y - s, x + s, y + s), fill=color + (int(alpha * rng.uniform(0.4, 1)),))

def star(cx, cy, r, inner=0.45, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 36)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

# 식탁보: 남보라 천에 체크 무늬
t = np.linspace(0, 1, H)[:, None]
base = np.array([34, 36, 92]) * (1 - t) + np.array([58, 44, 112]) * t
img = Image.fromarray(np.repeat(base[:, None, :], W, axis=1).astype('uint8'), 'RGB').convert('RGBA')
chk = layer(); cd = ImageDraw.Draw(chk)
for x in range(-40, W + 40, 120):
    cd.rectangle((x, 0, x + 44, H), fill=(255, 255, 255, 14))
for y in range(-40, H + 40, 120):
    cd.rectangle((0, y, W, y + 44), fill=(255, 255, 255, 14))
img.alpha_composite(chk)

# 그릇 그림자
sh = layer(); sd = ImageDraw.Draw(sh)
sd.ellipse((CX - 420, CY - 380, CX + 440, CY + 420), fill=(8, 10, 30, 150))
img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(40)))

R_OUT, R_IN = 400, 330
bowl = layer(); bd = ImageDraw.Draw(bowl)
bd.ellipse((CX - R_OUT, CY - R_OUT, CX + R_OUT, CY + R_OUT), fill=(246, 236, 214, 255))
# 그릇 테 안쪽 그늘
bd.ellipse((CX - R_IN - 18, CY - R_IN - 18, CX + R_IN + 18, CY + R_IN + 18), fill=(222, 206, 178, 255))
img.alpha_composite(bowl)
rim = layer(); rd = ImageDraw.Draw(rim)
crayon_ring(rd, CX, CY, R_OUT - 6, (200, 160, 120), 10, 150, 1400)
crayon_ring(rd, CX, CY, R_IN + 30, (255, 198, 90), 7, 170, 1200)   # 테에 금빛 줄
img.alpha_composite(rim)

# 스프: 금빛 원 + 소용돌이
soup = layer(); so = ImageDraw.Draw(soup)
so.ellipse((CX - R_IN, CY - R_IN, CX + R_IN, CY + R_IN), fill=(255, 190, 80, 255))
img.alpha_composite(soup)
glow = layer(); gd = ImageDraw.Draw(glow)
gd.ellipse((CX - R_IN * 0.7, CY - R_IN * 0.7, CX + R_IN * 0.5, CY + R_IN * 0.5), fill=(255, 236, 170, 200))
img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))
sw = layer(); swd = ImageDraw.Draw(sw)
for k in range(3):
    for i in range(500):
        a = i / 500 * math.tau * 1.6 + k * 2.1
        rr = 40 + i / 500 * (R_IN - 70)
        x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
        s = rng.uniform(3, 7)
        swd.ellipse((x - s, y - s, x + s, y + s), fill=(255, 246, 210, rng.randint(40, 110)))
img.alpha_composite(sw.filter(ImageFilter.GaussianBlur(1.5)))
# 동동 떠다니는 별빛
st = layer(); std = ImageDraw.Draw(st)
for i in range(16):
    a = rng.uniform(0, math.tau); rr = rng.uniform(30, R_IN - 40)
    x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
    r = rng.uniform(9, 22)
    std.polygon(star(x, y, r, rot=rng.uniform(-110, -70)), fill=(255, 252, 228, 230))
for i in range(160):
    a = rng.uniform(0, math.tau); rr = rng.uniform(0, R_IN - 20)
    x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
    s = rng.uniform(1.5, 3.5)
    std.ellipse((x - s, y - s, x + s, y + s), fill=(255, 255, 255, rng.randint(120, 230)))
img.alpha_composite(st)

# 숟가락 (오른쪽 아래)
sp = layer(); spd = ImageDraw.Draw(sp)
spd.line((CX + 380, CY + 300, CX + 560, CY + 430), fill=(220, 214, 230, 255), width=26)
spd.ellipse((CX + 330, CY + 250, CX + 420, CY + 330), fill=(232, 228, 240, 255))
img.alpha_composite(sp)

# 종이 결
a = np.asarray(img.convert('RGB')).astype(float)
a += np.random.default_rng(5).normal(0, 9, (H, W, 1))
out = Image.fromarray(np.clip(a, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.5))
p = sys.argv[1].rstrip('/') + '/08-soup-top.jpg'
out.save(p, 'JPEG', quality=86, optimize=True, progressive=True)
print(p)

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

# 식탁보: #4 삽화처럼 파스텔 민트 천 (크레용 결이 살짝 보이게)
t = np.linspace(0, 1, H)[:, None]
base = np.array([186, 228, 218]) * (1 - t) + np.array([166, 216, 206]) * t
img = Image.fromarray(np.repeat(base[:, None, :], W, axis=1).astype('uint8'), 'RGB').convert('RGBA')
grain = layer(); gd0 = ImageDraw.Draw(grain)
for i in range(2600):
    x, y = rng.uniform(0, W), rng.uniform(0, H); l = rng.uniform(10, 34); a0 = rng.uniform(-0.5, 0.5) - 0.6
    col = (255, 255, 255, rng.randint(18, 46)) if i % 2 else (110, 170, 165, rng.randint(14, 34))
    gd0.line((x, y, x + math.cos(a0) * l, y + math.sin(a0) * l), fill=col, width=2)
img.alpha_composite(grain.filter(ImageFilter.GaussianBlur(0.6)))

# 그릇 아래 냅킨: 연두색 체크 천을 살짝 비스듬히 (#4의 연두 체크 냅킨처럼)
nap = Image.new('RGBA', (860, 860), (0, 0, 0, 0)); nd = ImageDraw.Draw(nap)
nd.rounded_rectangle((40, 40, 820, 820), radius=40, fill=(222, 244, 168, 255))
for k in range(70, 820, 96):
    nd.rectangle((k, 40, k + 22, 820), fill=(176, 214, 112, 150))
    nd.rectangle((40, k, 820, k + 22), fill=(176, 214, 112, 150))
nap = nap.rotate(14, resample=Image.BICUBIC, expand=True)
ng = layer(); ng.paste(nap, (CX - nap.width // 2, CY - nap.height // 2), nap)
img.alpha_composite(ng.filter(ImageFilter.GaussianBlur(0.8)))

# 그릇 그림자
sh = layer(); sd = ImageDraw.Draw(sh)
sd.ellipse((CX - 420, CY - 380, CX + 440, CY + 420), fill=(60, 100, 70, 90))
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
for i in range(5):     # 별은 몇 개만 (너무 많으면 어지러움)
    a = rng.uniform(0, math.tau); rr = rng.uniform(30, R_IN - 40)
    x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
    r = rng.uniform(9, 22)
    std.polygon(star(x, y, r, rot=rng.uniform(-110, -70)), fill=(255, 252, 228, 230))
for i in range(45):
    a = rng.uniform(0, math.tau); rr = rng.uniform(0, R_IN - 20)
    x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr
    s = rng.uniform(1.5, 3.5)
    std.ellipse((x - s, y - s, x + s, y + s), fill=(255, 255, 255, rng.randint(120, 230)))
img.alpha_composite(st)

# 숟가락: 그릇 지름(800)만큼 긴 숟가락을 그릇 오른쪽에 세로로 살짝 비스듬히
SL = 800
spl = Image.new('RGBA', (220, SL + 40), (0, 0, 0, 0)); spd = ImageDraw.Draw(spl)
spd.rounded_rectangle((94, 150, 126, SL + 20), radius=16, fill=(150, 160, 170, 255))      # 자루
spd.ellipse((30, 10, 190, 220), fill=(172, 182, 192, 255))                                 # 머리
spd.ellipse((52, 34, 168, 196), fill=(188, 198, 208, 255))                                 # 오목한 안쪽
spd.ellipse((70, 50, 104, 110), fill=(236, 242, 246, 200))                                 # 반짝
spd.line((104, 230, 104, SL - 20), fill=(214, 222, 228, 170), width=6)                     # 자루 빛
spl = spl.rotate(-7, resample=Image.BICUBIC, expand=True)
shadow = Image.new('RGBA', spl.size, (40, 80, 60, 0)); shadow.putalpha(spl.getchannel('A').point(lambda v: v * 0.35))
sp = layer()
px, py = CX + R_OUT + 140 - spl.width // 2, CY - spl.height // 2
sp.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)), (px + 14, py + 18))
sp.alpha_composite(spl, (px, py))
img.alpha_composite(sp)

# 종이 결
a = np.asarray(img.convert('RGB')).astype(float)
a += np.random.default_rng(5).normal(0, 9, (H, W, 1))
out = Image.fromarray(np.clip(a, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.5))
p = sys.argv[1].rstrip('/') + '/08-soup-top.jpg'
out.save(p, 'JPEG', quality=86, optimize=True, progressive=True)
print(p)

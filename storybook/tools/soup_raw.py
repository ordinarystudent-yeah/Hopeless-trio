"""별빛스프 젓기 전 모습: 은하수처럼 소용돌이치는 푸른 스프 (파스텔 페리윙클·라일락·민트) + 한가운데 별 하나.
위에서 본 그릇 안쪽 원만 그린 투명 PNG. 저을수록 옅어져 아래의 금빛 스프가 드러난다.
사용: python3 soup_raw.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 660
rng = random.Random(11)
yy, xx = np.mgrid[0:S, 0:S].astype(float)
cx = cy = S / 2
dx, dy = xx - cx, yy - cy
r = np.hypot(dx, dy) / (S / 2)
th = np.arctan2(dy, dx)

# 바탕: 가운데 밝은 페리윙클 → 가장자리 짙은 블루 바이올렛 (예전 은하빛 그러데이션, 색만 파스텔로)
c0, c1, c2 = np.array([206, 214, 252]), np.array([150, 160, 232]), np.array([112, 112, 200])
t1 = np.clip(r / 0.5, 0, 1)[..., None]; t2 = np.clip((r - 0.5) / 0.5, 0, 1)[..., None]
col = np.where(r[..., None] < 0.5, c0 * (1 - t1) + c1 * t1, c1 * (1 - t2) + c2 * t2)
# 은하 소용돌이 띠: 라일락·민트·하늘빛이 각도를 따라 번갈아 (나선으로 감김)
spiral = th + r * 4.2
w1 = (np.sin(spiral * 2) * 0.5 + 0.5) ** 2
w2 = (np.sin(spiral * 2 + 2.1) * 0.5 + 0.5) ** 2
w3 = (np.sin(spiral * 2 + 4.2) * 0.5 + 0.5) ** 2
fade = np.clip(1 - r, 0, 1)[..., None] * 0.5 + 0.3
lilac, mint, sky = np.array([216, 190, 250]), np.array([190, 240, 228]), np.array([226, 236, 255])
col = col * (1 - fade * 0.95) + fade * 0.95 * (lilac * w1[..., None] + mint * w2[..., None] + sky * w3[..., None]) / np.maximum((w1 + w2 + w3)[..., None], 1e-3)
img = Image.fromarray(np.clip(col, 0, 255).astype('uint8'), 'RGB').convert("RGBA").filter(ImageFilter.GaussianBlur(3))

# 작은 별빛 점들 (예전처럼 하얀 점)
dots = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dd = ImageDraw.Draw(dots)
for i in range(70):
    a = rng.uniform(0, math.tau); rr = rng.uniform(0.08, 0.95) * S / 2
    x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr; s2 = rng.uniform(1.4, 3.4)
    dd.ellipse((x - s2, y - s2, x + s2, y + s2), fill=(255, 255, 255, rng.randint(150, 240)))
img.alpha_composite(dots.filter(ImageFilter.GaussianBlur(0.4)))

# 한가운데 별 하나 (지난번 별과 같은 크기·모양)
def star(cx, cy, r, inner, rot):
    return [(cx + (r if k % 2 == 0 else r * inner) * math.cos(math.radians(rot + k * 36)),
             cy + (r if k % 2 == 0 else r * inner) * math.sin(math.radians(rot + k * 36))) for k in range(10)]
st = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
R0, rot = 72, -90
sd.polygon(star(cx + 6, cy + 8, R0, 0.5, rot), fill=(150, 150, 210, 90))
sd.polygon(star(cx, cy, R0, 0.5, rot), fill=(255, 234, 150, 255))
sd.polygon(star(cx - R0 * 0.12, cy - R0 * 0.12, R0 * 0.55, 0.5, rot), fill=(255, 246, 196, 230))
for k in range(70):
    a = rng.uniform(0, math.tau); rr = rng.uniform(0, R0 * 0.5)
    x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
    sd.line((x, y, x + 9, y - 6), fill=(250, 186, 206, rng.randint(40, 120)), width=2)
img.alpha_composite(st.filter(ImageFilter.GaussianBlur(3)))

# 원으로 오려 내기 + 가장자리 안쪽 그늘
edge = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(edge).ellipse((0, 0, S - 1, S - 1), outline=(90, 90, 170, 130), width=16)
img.alpha_composite(edge.filter(ImageFilter.GaussianBlur(9)))
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse((2, 2, S - 3, S - 3), fill=255)
img.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
p = sys.argv[1].rstrip('/') + '/08-soup-raw.png'
img.resize((480, 480), Image.LANCZOS).save(p, optimize=True)
print(p)

"""#6 두 번째 쪽(10쪽): 나에 대해 적는 파스텔 코르크 보드 — 크레용 질감 임시 아트워크.
가로 A4 한 쪽(297:210). 메모지 스티커(착한 일·좋아하는 음식)가 위에 붙고, 그 위에 그림을 그린다.
사용: python3 board_art.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1000, 707
rng = random.Random(7)
def layer(): return Image.new('RGBA', (W, H), (0, 0, 0, 0))

# 벽: 삽화의 흰 종이처럼 밝은 크림
img = Image.new('RGBA', (W, H), (252, 249, 242, 255))

# 보드 틀(연한 나무색) + 안쪽 판(파스텔 민트)
F = 40
TOP = 168   # 보드 위쪽 (그 위 빈 종이에 나레이션)
frame = layer(); fd = ImageDraw.Draw(frame)
fd.rounded_rectangle((60, TOP, W - 60, H - 54), radius=30, fill=(232, 204, 164, 255))
fd.rounded_rectangle((60 + F, TOP + F, W - 60 - F, H - 54 - F), radius=16, fill=(196, 234, 222, 255))
img.alpha_composite(frame)
# 판 그림자(위쪽 안쪽)
sh = layer(); ImageDraw.Draw(sh).rounded_rectangle((60 + F, TOP + F, W - 60 - F, TOP + F + 26), radius=12, fill=(90, 150, 130, 70))
img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))

# 코르크 결: 작은 점과 짧은 크레용 선
cork = layer(); cd = ImageDraw.Draw(cork)
x0, y0, x1, y1 = 60 + F, TOP + F, W - 60 - F, H - 54 - F
for i in range(4200):
    x, y = rng.uniform(x0, x1), rng.uniform(y0, y1); s = rng.uniform(1, 3.2)
    c = rng.choice([(160, 210, 196), (210, 242, 232), (240, 252, 248), (176, 222, 208)])
    cd.ellipse((x - s, y - s, x + s, y + s), fill=c + (rng.randint(70, 160),))
for i in range(900):
    x, y = rng.uniform(x0, x1), rng.uniform(y0, y1); l = rng.uniform(8, 22); a = rng.uniform(0, math.pi)
    cd.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=(236, 252, 246, rng.randint(50, 110)), width=2)
img.alpha_composite(cork.filter(ImageFilter.GaussianBlur(0.5)))

# 틀 크레용 결
fr = layer(); frd = ImageDraw.Draw(fr)
for i in range(2400):
    side = rng.random()
    if side < 0.5:
        x = rng.uniform(64, W - 64); y = rng.choice([rng.uniform(TOP + 4, TOP + F), rng.uniform(H - 54 - F, H - 58)])
    else:
        y = rng.uniform(TOP + 4, H - 58); x = rng.choice([rng.uniform(64, 60 + F), rng.uniform(W - 60 - F, W - 64)])
    l = rng.uniform(10, 26); a = rng.uniform(-0.3, 0.3) + (0 if side < 0.5 else math.pi / 2)
    frd.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=rng.choice([(214, 180, 134), (246, 222, 186)]) + (rng.randint(60, 140),), width=3)
img.alpha_composite(fr.filter(ImageFilter.GaussianBlur(0.6)))

# 구석의 작은 장식: 색 압정 몇 개와 별 스티커
dec = layer(); dd = ImageDraw.Draw(dec)
for (u, v, c) in [(0.17, 0.34, (255, 160, 170)), (0.83, 0.34, (150, 200, 255)), (0.17, 0.84, (170, 225, 170)), (0.83, 0.84, (255, 214, 120))]:
    x, y = u * W, v * H
    dd.ellipse((x - 13 + 3, y - 13 + 5, x + 13 + 3, y + 13 + 5), fill=(120, 80, 50, 70))
    dd.ellipse((x - 13, y - 13, x + 13, y + 13), fill=c + (255,))
    dd.ellipse((x - 6, y - 8, x + 1, y - 2), fill=(255, 255, 255, 190))
img.alpha_composite(dec.filter(ImageFilter.GaussianBlur(0.6)))

a = np.asarray(img.convert('RGB')).astype(float)
a += np.random.default_rng(3).normal(0, 5, (H, W, 1))
out = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
p = sys.argv[1].rstrip('/') + '/06-board.jpg'
out.save(p, 'JPEG', quality=88, optimize=True, progressive=True)
print(p)

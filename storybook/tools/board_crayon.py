"""#6 10쪽 보드 안쪽 판의 크레용 질감 (9쪽 말풍선처럼 비스듬한 크레용 결).
색은 따로 깔고(CSS의 .board-tint 배경색) 이 투명 PNG를 그 위에 얹는다 → 어떤 바탕색이어도 같은 질감.
보드 그림(06-board.jpg) 안쪽 판 자리(1000×707 기준 x 100~900, y 208~613)에 맞춘 800×405의 1.5배 크기.
압정 네 개도 함께 그린다 (색을 칠하면 원래 그림의 압정이 덮이므로).
사용: python3 board_crayon.py 저장할_폴더"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

K = 1.5
W, H = int(800 * K), int(405 * K)
rng = random.Random(11)
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))

def strokes(n, colors, alpha, width, length, blur):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y = rng.uniform(-60, W + 60), rng.uniform(-60, H + 60)
        a = math.radians(rng.uniform(-42, -30))           # 말풍선처럼 오른쪽 위로 비스듬히
        l = rng.uniform(*length) * K
        c = rng.choice(colors)
        d.line((x, y, x + math.cos(a) * l, y + math.sin(a) * l), fill=c + (rng.randint(*alpha),), width=int(rng.uniform(*width) * K))
    return lay.filter(ImageFilter.GaussianBlur(blur * K))

# 1) 밝은 크레용 결 (흰빛)
img.alpha_composite(strokes(2600, [(255, 255, 255), (255, 252, 240)], (40, 95), (2, 5), (20, 70), 0.6))
# 2) 여러 빛깔의 가는 크레용 (말풍선의 분홍·하늘·민트·레몬·살구)
img.alpha_composite(strokes(1700, [(255, 170, 190), (150, 205, 255), (150, 230, 190), (255, 230, 120), (255, 196, 150), (205, 180, 255)], (28, 60), (1.5, 3.5), (14, 50), 0.5))
# 3) 살짝 어두운 결 (깊이)
img.alpha_composite(strokes(900, [(90, 80, 70)], (10, 22), (1.5, 3), (12, 40), 0.6))

# 종이 결 (작은 흰 점)
a = np.array(img).astype(float)
grain = np.random.default_rng(5).random((H, W))
spots = grain > 0.985
a[spots, :3] = a[spots, :3] * 0.4 + 255 * 0.6
a[spots, 3] = np.maximum(a[spots, 3], 70)
img = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

# 압정 (원래 보드 그림과 같은 자리·색)
pin = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(pin)
for (px, py, c) in [(70, 32, (255, 160, 170)), (730, 32, (150, 200, 255)), (70, 386, (170, 225, 170)), (730, 386, (255, 214, 120))]:
    x, y, r = px * K, py * K, 13 * K
    pd.ellipse((x - r + 3 * K, y - r + 5 * K, x + r + 3 * K, y + r + 5 * K), fill=(120, 80, 50, 70))
    pd.ellipse((x - r, y - r, x + r, y + r), fill=c + (255,))
    pd.ellipse((x - 6 * K, y - 8 * K, x + 1 * K, y - 2 * K), fill=(255, 255, 255, 190))
img.alpha_composite(pin.filter(ImageFilter.GaussianBlur(0.6 * K)))

out = (sys.argv[1] if len(sys.argv) > 1 else '.') + '/06-board-crayon.png'
img.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(out, optimize=True)
print(out)

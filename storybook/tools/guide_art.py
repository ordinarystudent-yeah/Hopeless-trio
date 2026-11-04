"""그림판 '따라 그리기' 가이드: 음식 그림(assets/foods/*.png)의 윤곽을 점선으로 딴 투명 PNG.
그림판에서는 30% 투명도로 아래에 깔린다(내보내는 그림에는 들어가지 않음).
사용: python3 tools/guide_art.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter

S = 800
for p in sorted(glob.glob('assets/foods/*.png')):
    im = Image.open(p).convert('RGBA')
    im.thumbnail((int(S * 0.78), int(S * 0.78)))
    a = np.asarray(im.getchannel('A')) > 40
    m = Image.fromarray((a * 255).astype('uint8'))
    # 바깥 윤곽: 조금 부풀린 것 - 원래 것 (두께 약 6px)
    big = np.asarray(m.filter(ImageFilter.MaxFilter(9))) > 0
    small = np.asarray(m.filter(ImageFilter.MaxFilter(3))) > 0
    edge = big & ~small
    # 안쪽 선(굵은 무늬 경계)도 조금: 밝기 차이가 큰 곳
    lum = np.asarray(im.convert('L')).astype(float)
    gy, gx = np.gradient(lum)
    inner = (np.hypot(gx, gy) > 38) & a & ~small
    inner = np.asarray(Image.fromarray((inner * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    # 점선: 대각선 줄무늬로 끊는다
    h, w = edge.shape
    yy, xx = np.mgrid[0:h, 0:w]
    dash = ((xx + yy) // 9) % 2 == 0
    dash2 = ((xx - yy) // 7) % 3 == 0
    line = (edge & dash) | (inner & dash2)
    out = np.zeros((h, w, 4), 'uint8')
    out[line] = (70, 52, 40, 255)
    g = Image.fromarray(out, 'RGBA')
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(g, ((S - w) // 2, (S - h) // 2))
    name = os.path.splitext(os.path.basename(p))[0]
    canvas.quantize(colors=4, method=Image.FASTOCTREE).save('assets/guides/%s.png' % name, optimize=True)
    print(name, os.path.getsize('assets/guides/%s.png' % name))

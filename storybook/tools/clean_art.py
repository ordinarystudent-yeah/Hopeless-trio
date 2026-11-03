"""사용자가 준 펼침면 삽화에서 인쇄 템플릿 표시(재단선·뒷면/앞면/책등 글자·사양 글자·로고)를 지운다."""
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
which = sys.argv[3] if len(sys.argv) > 3 else ''
labels = bool(which)
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(float)
H, W = a.shape[:2]
lum = a @ [0.299, 0.587, 0.114]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mask = np.zeros((H, W), bool)
sat = a.max(2) - a.min(2)
if labels:
    # 가운데 책등 재단선: 양옆(6px 떨어진 곳)과 색이 확 다른 가는 세로줄만
    side = (a[:, 704:705] + a[:, 723:724]) / 2
    diff = np.abs(a[:, 708:719] - side).sum(2)
    mask[:, 708:719] |= diff > 45
    ALL = {'back': (325, 236, 405, 284), 'spine': (692, 224, 733, 304), 'front': (1022, 236, 1104, 284),   # 뒷면 / 책등 / 앞면
           'spec': (728, 408, 910, 490), 'copy': (385, 448, 705, 490)}                                     # 사양 글자 / 로고·저작권
    bgl = np.asarray(Image.fromarray(lum.astype('uint8')).filter(ImageFilter.GaussianBlur(9))).astype(float)
    for k in which.split(','):
        x0, y0, x1, y1 = ALL[k]
        # 글자는 둘레보다 확 어둡다 (흰 종이 위든 그림 위든)
        m = (lum[y0:y1, x0:x1] < bgl[y0:y1, x0:x1] - 14) | (lum[y0:y1, x0:x1] < 110)
        mask[y0:y1, x0:x1] |= m
# 조금 넓혀서 글자 가장자리까지
mk = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))
mask = np.asarray(mk) > 0
# 주변 색으로 채우기 (확산)
out = a.copy()
out[mask] = np.nan
for it in range(400):
    nanm = np.isnan(out[..., 0])
    if not nanm.any(): break
    acc = np.zeros_like(out); cnt = np.zeros((H, W, 1))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(out, dy, 0), dx, 1)
        ok = ~np.isnan(sh[..., :1])
        acc += np.where(ok, sh, 0); cnt += ok
    fillv = acc / np.maximum(cnt, 1)
    can = nanm & (cnt[..., 0] > 0)
    out[can] = fillv[can]
# 사양 글자 자리는 빈 종이라서, 색이 없는 점은 모두 종이색으로
if labels and 'spec' in which.split(','):
    x0, y0, x1, y1 = 722, 404, 916, 494
    reg = out[y0:y1, x0:x1]
    paper = np.median(out[30:90, 1180:1380].reshape(-1, 3), axis=0)   # 오른쪽 위 빈 종이
    flat = ((reg.max(2) - reg.min(2)) < 40) & ((reg @ [0.299, 0.587, 0.114]) > 150)
    reg[flat] = paper
if labels and 'copy' in which.split(','):
    x0, y0, x1, y1 = 380, 444, 712, 494
    reg = out[y0:y1, x0:x1]
    paper = np.median(out[30:90, 1180:1380].reshape(-1, 3), axis=0)
    flat = ((reg.max(2) - reg.min(2)) < 22) & ((reg @ [0.299, 0.587, 0.114]) > 200)
    reg[flat] = paper
res = Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
# 가장자리 재단선 바깥(12px)을 잘라 책 비율에 맞춘다
res = res.crop((12, 12, W - 12, H - 14))
res.save(dst, 'JPEG', quality=90, optimize=True, progressive=True)
print(dst, res.size, int(mask.sum()), 'px filled')

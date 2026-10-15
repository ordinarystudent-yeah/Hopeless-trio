/* 별빛스프 — 그림 편집기
   StarSoupEditor.open({ title, image, askName, name }) → Promise<{ image, name } | null>
   - image: 이어서 그릴 기존 그림 (data URL)
   - 그림을 지우는 방법은 '전체 지우기' 하나뿐이며(실행 취소로 되돌릴 수 있음) 항상 확인창을 거친다
   - 결과 image는 그림이 있는 부분만 잘라낸 투명 배경 PNG (스티커로 사용)
   Pointer Events로 마우스·손가락·펜을 함께 처리한다. */
(function () {
  'use strict';

  var SIZE = 800;          // 캔버스 내부 해상도 (정사각형)
  var MAX_UNDO = 15;       // 실행 취소 단계 (한 단계당 약 2.5MB)
  var EXPORT_MAX = 640;    // 스티커로 내보낼 때 최대 변 길이
  var FILL_TOLERANCE = 72; // 페인트 통 색 허용 오차 (0~1020)
  var DEFAULTS = { tool: 'pen', size: 14, color: '#2b2118' };
  var PALETTE = ['#2b2118', '#ffffff', '#ff5a5f', '#ff9f43', '#ffd23f', '#7bd389', '#2bb3a3', '#3fa7d6', '#5b6ee1', '#b07be0', '#ff8fc7', '#8b5a3c'];
  var TOOL_SCALE = { pen: 1, pencil: 0.45, brush: 1.8, eraser: 1.5 };

  var $ = function (id) { return document.getElementById(id); };
  var ui = function () { return window.StarSoupUI; };

  var root, canvas, g, wrap, sizeInput, sizeOut, sizeDot, colorInput, nameInput, undoBtn;
  var photoLayer, photoImg, photoBar, photoScale;
  var tool = DEFAULTS.tool, size = DEFAULTS.size, color = DEFAULTS.color;
  var pf = 1;          // 필압 배율 (펜슬일 때만 바뀜)
  var penSeen = false; // 펜슬을 한 번이라도 쓰면 손바닥(터치)은 그리기에서 무시
  var undo = [], dirty = false, stroke = null, photo = null, stamp = null, resolver = null, ready = false;

  /* ---------- 준비 ---------- */
  function init() {
    if (ready) return;
    ready = true;
    root = $('editor');
    canvas = $('ed-canvas');
    canvas.width = canvas.height = SIZE;
    g = canvas.getContext('2d', { willReadFrequently: true });
    wrap = $('ed-canvas-wrap');
    sizeInput = $('ed-size');
    sizeOut = $('ed-size-out');
    sizeDot = $('ed-size-dot');
    colorInput = $('ed-color');
    nameInput = $('ed-name');
    undoBtn = $('ed-undo');
    photoLayer = $('ed-photo');
    photoImg = $('ed-photo-img');
    photoBar = $('ed-photo-bar');
    photoScale = $('ed-photo-scale');

    // 색 팔레트
    var swatches = $('ed-swatches');
    PALETTE.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--c', c);
      b.setAttribute('data-color', c);
      b.setAttribute('aria-label', '색 ' + c);
      b.addEventListener('click', function () { setColor(c); });
      swatches.append(b);
    });
    colorInput.addEventListener('input', function () { setColor(colorInput.value); });

    root.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
    });
    sizeInput.addEventListener('input', function () { size = Number(sizeInput.value); paintSize(); stamp = null; });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', onUp);

    undoBtn.addEventListener('click', undoOnce);
    $('ed-back').addEventListener('click', back);
    $('ed-done').addEventListener('click', finish);
    $('ed-clear').addEventListener('click', clearAll);

    // 사진: 카메라로 찍기 / 앨범에서 고르기 (둘 다 사용자가 직접 고르는 파일 선택 방식)
    $('ed-camera').addEventListener('click', function () { $('ed-file-camera').click(); });
    $('ed-album').addEventListener('click', function () { $('ed-file-album').click(); });
    ['ed-file-camera', 'ed-file-album'].forEach(function (id) {
      $(id).addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) loadPhoto(file);
      });
    });
    // 사진을 그림판에 끌어다 놓거나 붙여넣어도 들어간다
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    wrap.addEventListener('drop', function (e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadPhoto(file);
    });
    document.addEventListener('paste', function (e) {
      if (root.hidden || !e.clipboardData) return;
      var item = Array.prototype.find.call(e.clipboardData.items || [], function (it) { return it.kind === 'file' && /^image\//.test(it.type); });
      if (item) { e.preventDefault(); loadPhoto(item.getAsFile()); }
    });
    photoScale.addEventListener('input', function () { if (photo) { photo.s = photo.fit * Number(photoScale.value) / 100; placePhoto(); } });
    $('ed-photo-ok').addEventListener('click', commitPhoto);
    $('ed-photo-cancel').addEventListener('click', cancelPhoto);
    photoImg.addEventListener('pointerdown', onPhotoDown);
    photoImg.addEventListener('pointermove', onPhotoMove);
    photoImg.addEventListener('pointerup', onPhotoUp);
    photoImg.addEventListener('pointercancel', onPhotoUp);

    document.addEventListener('keydown', function (e) {
      if (root.hidden || !$('modal').hidden) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoOnce(); }
      else if (e.key === 'Escape') { e.preventDefault(); back(); }
    });
  }

  /* ---------- 열기·닫기 ---------- */
  function open(opts) {
    init();
    opts = opts || {};
    $('editor-title').textContent = opts.title || '그림 그리기';
    $('ed-name-field').hidden = !opts.askName;
    nameInput.value = opts.name || '';
    g.clearRect(0, 0, SIZE, SIZE);
    undo = [];
    dirty = false;
    cancelPhoto();
    setTool(tool);
    setColor(color);
    sizeInput.value = size;
    paintSize();
    paintUndo();
    root.hidden = false;
    document.documentElement.classList.add('is-editing');
    $('ed-back').focus({ preventScroll: true });

    if (opts.image) {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(SIZE * 0.86 / im.width, SIZE * 0.86 / im.height, 1.6);
        g.drawImage(im, (SIZE - im.width * s) / 2, (SIZE - im.height * s) / 2, im.width * s, im.height * s);
      };
      im.onerror = function () { ui().toast('지난번 그림을 불러오지 못했어요. 새로 그려 주세요.'); };
      im.src = opts.image;
    }
    return new Promise(function (resolve) { resolver = resolve; });
  }

  function close(result) {
    cancelPhoto();
    root.hidden = true;
    document.documentElement.classList.remove('is-editing');
    undo = [];
    var r = resolver;
    resolver = null;
    if (r) r(result);
  }

  function back() {
    if (!dirty) { close(null); return; }
    ui().ask({
      title: '그리던 그림을 두고 나갈까요?',
      message: '지금 나가면 이번에 그린 내용은 동화에 붙지 않아요.',
      ok: '나가기', cancel: '계속 그리기', danger: true
    }).then(function (yes) { if (yes) close(null); });
  }

  function finish() {
    if (photo) commitPhoto();
    var image = exportTrimmed();
    if (!image) { ui().toast('아직 그린 그림이 없어요. 그림을 그리거나 사진을 넣어 주세요.'); return; }
    close({ image: image, name: nameInput.value.trim() });
  }

  /* ---------- 도구 ---------- */
  function setTool(t) {
    tool = t;
    root.querySelectorAll('[data-tool]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-tool') === t ? 'true' : 'false');
    });
    $('ed-size-row').classList.toggle('is-off', t === 'bucket');
    canvas.setAttribute('data-tool', t);
    paintSize();
  }

  function setColor(c) {
    color = c;
    stamp = null;
    root.querySelectorAll('.swatch').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-color') === c ? 'true' : 'false');
    });
    if (/^#[0-9a-f]{6}$/i.test(c)) colorInput.value = c;
    $('ed-wheel').classList.toggle('is-on', PALETTE.indexOf(c) < 0);
    $('ed-wheel').style.setProperty('--c', c);
    paintSize();
  }

  function paintSize() {
    sizeOut.textContent = size;
    // 실제 화면에서 보이는 굵기로 미리보기
    var shown = Math.max(3, size * (TOOL_SCALE[tool] || 1) * (canvas.getBoundingClientRect().width || SIZE) / SIZE);
    sizeDot.style.width = sizeDot.style.height = Math.min(44, shown) + 'px';
    sizeDot.style.background = tool === 'eraser' ? 'transparent' : color;
    sizeDot.classList.toggle('is-eraser', tool === 'eraser');
    sizeDot.classList.toggle('is-soft', tool === 'brush');
  }

  /* ---------- 실행 취소 ---------- */
  function pushUndo() {
    undo.push(g.getImageData(0, 0, SIZE, SIZE));
    if (undo.length > MAX_UNDO) undo.shift();
    paintUndo();
  }
  function undoOnce() {
    if (!undo.length) { ui().toast('더 이상 되돌릴 수 없어요.'); return; }
    g.putImageData(undo.pop(), 0, 0);
    dirty = true;
    paintUndo();
  }
  function paintUndo() { undoBtn.disabled = !undo.length; }

  function clearAll() {
    ui().ask({
      title: '그림을 모두 지울까요?',
      message: '지금까지 그린 그림이 사라져요.',
      ok: '지우기', cancel: '취소', danger: true
    }).then(function (yes) {
      if (!yes) return;
      pushUndo();
      g.clearRect(0, 0, SIZE, SIZE);
      dirty = true;
    });
  }

  /* ---------- 그리기 ---------- */
  function point(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height };
  }

  function onDown(e) {
    if (photo || stroke || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'pen') penSeen = true;
    else if (penSeen && e.pointerType === 'touch') return;
    e.preventDefault();
    var p = point(e);
    pf = pressureOf(e);
    if (tool === 'bucket') {
      pushUndo();
      if (fill(p)) dirty = true; else undo.pop(), paintUndo();
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
    pushUndo();
    stroke = { id: e.pointerId, last: p, carry: 0 };
    dab(p);
    dirty = true;
  }

  function onMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    e.preventDefault();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    if (!list.length) list = [e];
    for (var i = 0; i < list.length; i++) {
      var p = point(list[i]);
      pf = pressureOf(list[i]);
      segment(stroke.last, p);
      stroke.last = p;
    }
  }

  // 애플펜슬 등 필압이 있는 펜: 살살 그리면 가늘게, 꾹 누르면 굵게 (0.35배 ~ 1.65배)
  function pressureOf(e) {
    return e.pointerType === 'pen' && e.pressure > 0 ? 0.35 + 1.3 * e.pressure : 1;
  }

  function onUp(e) {
    if (stroke && e.pointerId === stroke.id) stroke = null;
  }

  function prep(mode) {
    g.globalCompositeOperation = mode || 'source-over';
    g.globalAlpha = 1;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }

  function dab(p) {
    if (tool === 'brush') { brushStamp(p.x, p.y); return; }
    if (tool === 'pencil') { pencilSpecks(p.x, p.y); return; }
    prep(tool === 'eraser' ? 'destination-out' : 'source-over');
    g.fillStyle = color;
    g.beginPath();
    g.arc(p.x, p.y, size * TOOL_SCALE[tool] * pf / 2, 0, Math.PI * 2);
    g.fill();
  }

  function segment(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (tool === 'pen' || tool === 'eraser') {
      prep(tool === 'eraser' ? 'destination-out' : 'source-over');
      g.strokeStyle = color;
      g.lineWidth = size * TOOL_SCALE[tool] * pf;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      return;
    }
    if (tool === 'pencil') {
      // 연필: 옅은 심 + 흩뿌린 흑연 가루로 거친 질감
      prep();
      g.globalAlpha = 0.35;
      g.strokeStyle = color;
      g.lineWidth = Math.max(1, size * TOOL_SCALE.pencil * 0.55);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      var steps = Math.max(1, Math.ceil(dist / 1.5));
      for (var i = 1; i <= steps; i++) pencilSpecks(a.x + dx * i / steps, a.y + dy * i / steps);
      return;
    }
    // 브러시: 부드러운 원형 도장을 촘촘히 찍는다
    var spacing = Math.max(1, size * TOOL_SCALE.brush * 0.12);
    var t = stroke.carry;
    while (t <= dist) {
      brushStamp(a.x + dx * (t / (dist || 1)), a.y + dy * (t / (dist || 1)));
      t += spacing;
    }
    stroke.carry = t - dist;
  }

  function pencilSpecks(x, y) {
    var w = Math.max(1.4, size * TOOL_SCALE.pencil * pf);
    prep();
    g.fillStyle = color;
    for (var k = 0; k < 3; k++) {
      g.globalAlpha = 0.18 + Math.random() * 0.4;
      g.fillRect(x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * w, 1.6, 1.6);
    }
  }

  function brushStamp(x, y) {
    if (!stamp) {
      var r = Math.max(2, size * TOOL_SCALE.brush / 2);
      var c = document.createElement('canvas');
      c.width = c.height = Math.ceil(r * 2);
      var sg = c.getContext('2d');
      var grad = sg.createRadialGradient(r, r, 0, r, r, r);
      var rgb = hexToRgb(color);
      var base = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',';
      grad.addColorStop(0, base + '0.55)');
      grad.addColorStop(0.55, base + '0.35)');
      grad.addColorStop(1, base + '0)');
      sg.fillStyle = grad;
      sg.fillRect(0, 0, c.width, c.height);
      stamp = { canvas: c, r: r };
    }
    prep();
    var r = stamp.r * pf;
    g.drawImage(stamp.canvas, x - r, y - r, r * 2, r * 2);
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) || [0, '2b', '21', '18'];
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  /* ---------- 페인트 통 (스캔라인 채우기) ----------
     800×800 캔버스 전체도 수십 ms 안에 끝나므로 화면이 멈추지 않는다.
     가장자리의 반투명 픽셀은 채우는 색 위에 겹쳐서 하얀 틈이 남지 않게 한다. */
  function fill(p) {
    var x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
    var W = SIZE, H = SIZE;
    var img = g.getImageData(0, 0, W, H), d = img.data;
    var fc = hexToRgb(color);
    var i0 = (y * W + x) * 4;
    var ta = d[i0 + 3];
    var tr = d[i0] * ta / 255, tg = d[i0 + 1] * ta / 255, tb = d[i0 + 2] * ta / 255;
    if (ta === 255 && Math.abs(d[i0] - fc.r) + Math.abs(d[i0 + 1] - fc.g) + Math.abs(d[i0 + 2] - fc.b) < 6) return false;

    function match(i) {
      var a = d[i + 3];
      return Math.abs(d[i] * a / 255 - tr) + Math.abs(d[i + 1] * a / 255 - tg) +
        Math.abs(d[i + 2] * a / 255 - tb) + Math.abs(a - ta) <= FILL_TOLERANCE;
    }

    var mask = new Uint8Array(W * H);
    var stack = [x, y];
    while (stack.length) {
      var sy = stack.pop(), sx = stack.pop();
      var row = sy * W;
      if (mask[row + sx] || !match((row + sx) * 4)) continue;
      var l = sx, r = sx;
      while (l > 0 && !mask[row + l - 1] && match((row + l - 1) * 4)) l--;
      while (r < W - 1 && !mask[row + r + 1] && match((row + r + 1) * 4)) r++;
      var upOpen = false, downOpen = false;
      for (var xx = l; xx <= r; xx++) {
        mask[row + xx] = 1;
        if (sy > 0) {
          var u = row - W + xx, okU = !mask[u] && match(u * 4);
          if (okU && !upOpen) stack.push(xx, sy - 1);
          upOpen = okU;
        }
        if (sy < H - 1) {
          var dn = row + W + xx, okD = !mask[dn] && match(dn * 4);
          if (okD && !downOpen) stack.push(xx, sy + 1);
          downOpen = okD;
        }
      }
    }

    for (var i = 0, n = W * H; i < n; i++) {
      var o = i * 4;
      if (mask[i]) {
        d[o] = fc.r; d[o + 1] = fc.g; d[o + 2] = fc.b; d[o + 3] = 255;
      } else if (d[o + 3] < 255) {
        var px = i % W;
        var edge = (px > 0 && mask[i - 1]) || (px < W - 1 && mask[i + 1]) || (i >= W && mask[i - W]) || (i < n - W && mask[i + W]);
        if (edge) {
          var a = d[o + 3] / 255;
          d[o] = Math.round(d[o] * a + fc.r * (1 - a));
          d[o + 1] = Math.round(d[o + 1] * a + fc.g * (1 - a));
          d[o + 2] = Math.round(d[o + 2] * a + fc.b * (1 - a));
          d[o + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return true;
  }

  /* ---------- 사진 ---------- */
  function loadPhoto(file) {
    if (file.type && !/^image\//.test(file.type)) {
      ui().toast('사진 파일만 넣을 수 있어요. JPG나 PNG 사진을 골라 주세요.');
      return;
    }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var fit = Math.min(SIZE * 0.8 / im.naturalWidth, SIZE * 0.8 / im.naturalHeight);
      photo = { img: im, url: url, x: SIZE / 2, y: SIZE / 2, fit: fit, s: fit, drag: null };
      photoImg.src = url;
      photoScale.value = 100;
      photoLayer.hidden = false;
      photoBar.hidden = false;
      placePhoto();
      ui().toast('사진을 끌어서 옮기고, 아래에서 크기를 맞춘 뒤 ‘사진 붙이기’를 눌러요.', 3600);
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      ui().toast('이 사진은 열 수 없는 형식이에요. JPG나 PNG 사진으로 다시 골라 주세요.', 3600);
    };
    im.src = url;
  }

  function placePhoto() {
    var w = photo.img.naturalWidth * photo.s, h = photo.img.naturalHeight * photo.s;
    photoImg.style.width = (w / SIZE * 100) + '%';
    photoImg.style.left = ((photo.x - w / 2) / SIZE * 100) + '%';
    photoImg.style.top = ((photo.y - h / 2) / SIZE * 100) + '%';
  }

  function onPhotoDown(e) {
    if (!photo) return;
    e.preventDefault();
    try { photoImg.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
    photo.drag = { id: e.pointerId, start: point(e), x: photo.x, y: photo.y };
  }
  function onPhotoMove(e) {
    if (!photo || !photo.drag || photo.drag.id !== e.pointerId) return;
    var p = point(e);
    photo.x = photo.drag.x + p.x - photo.drag.start.x;
    photo.y = photo.drag.y + p.y - photo.drag.start.y;
    placePhoto();
  }
  function onPhotoUp() { if (photo) photo.drag = null; }

  function commitPhoto() {
    if (!photo) return;
    var w = photo.img.naturalWidth * photo.s, h = photo.img.naturalHeight * photo.s;
    pushUndo();
    prep();
    g.drawImage(photo.img, photo.x - w / 2, photo.y - h / 2, w, h);
    dirty = true;
    cancelPhoto();
  }

  function cancelPhoto() {
    if (photo) URL.revokeObjectURL(photo.url);
    photo = null;
    if (photoLayer) { photoLayer.hidden = true; photoBar.hidden = true; photoImg.removeAttribute('src'); }
  }

  /* ---------- 내보내기: 그림이 있는 부분만 잘라 투명 PNG로 ---------- */
  function exportTrimmed() {
    var d = g.getImageData(0, 0, SIZE, SIZE).data;
    var minX = SIZE, minY = SIZE, maxX = -1, maxY = -1;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (d[(y * SIZE + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    var pad = 10;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(SIZE - 1, maxX + pad); maxY = Math.min(SIZE - 1, maxY + pad);
    var w = maxX - minX + 1, h = maxY - minY + 1;
    var s = Math.min(1, EXPORT_MAX / Math.max(w, h));
    var out = document.createElement('canvas');
    out.width = Math.round(w * s);
    out.height = Math.round(h * s);
    out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  window.StarSoupEditor = { open: open };
})();

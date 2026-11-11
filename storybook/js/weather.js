/* 별빛스프 — #1 날씨 효과 (가장 위층)
   StarSoupWeather.start(canvas, kind) → stop 함수
   kind: sunny(흰 구름 몇 개) · rain(빗줄기) · snow(눈송이) · cloudy(구름이 잔뜩 끼어 흘러감) — 구름은 받은 구름 그림
   날씨는 #1의 핵심 장면이라 '움직임 줄이기'(갤럭시 '애니메이션 제거' 등)가 켜져 있어도 끄지 않고 절반 속도로 움직인다. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rand(a, b) { return a + Math.random() * (b - a); }

  // 받은 구름 그림 (assets/weather/cloud-1·2.png, 반투명한 흰 구름). 맑은 날용은 알파를 키워 흰색으로 또렷하게 만든다
  var clouds = [], whiteClouds = [];
  ['cloud-1', 'cloud-2'].forEach(function (n, i) {
    var im = new Image();
    im.onload = function () {
      clouds[i] = im;
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var x = c.getContext('2d'); for (var k = 0; k < 3; k++) x.drawImage(im, 0, 0);   // 세 번 겹쳐 흰색으로
      whiteClouds[i] = c;
    };
    im.src = 'assets/weather/' + n + '.png';
  });
  function drawSprite(g, im, x, y, w, h, alpha, flip) {
    if (!im) return;
    g.globalAlpha = alpha;
    if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, -w / 2, y - h / 2, w, h); g.restore(); }
    else g.drawImage(im, x - w / 2, y - h / 2, w, h);
    g.globalAlpha = 1;
  }

  var kinds = {
    sunny: {
      // 맑은 날: 받은 구름 그림을 흰색으로 더 또렷하게, 가로만 줄여(0.6) 동글게
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 5; i++) list.push({ x: rand(0, w), y: h * (0.08 + i * 0.15) + rand(-h * 0.03, h * 0.03), s: Math.max(40, rand(h * 0.16, h * 0.24)), v: rand(0.1, 0.25), k: i % 2, f: Math.random() < 0.5 });
        return list;
      },
      step: function (g, list, w, h, t, move) {
        list.forEach(function (c) {
          var cw = c.s * 2.9 * 0.6;
          if (move !== false) c.x += c.v;
          if (c.x - cw / 2 > w) c.x = -cw / 2;
          drawSprite(g, whiteClouds[c.k], c.x, c.y, cw, c.s, 1, c.f);
        });
      }
    },
    cloudy: {
      // 흐린 날: 받은 구름 그림이 하늘 위쪽에 잔뜩 흘러간다
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 14; i++) list.push({ x: rand(-w * 0.1, w * 1.1), y: rand(-h * 0.04, h * 0.42), s: Math.max(50, rand(h * 0.22, h * 0.4)), v: rand(0.12, 0.4), a: rand(0.75, 1), k: i % 2, f: Math.random() < 0.5 });
        list.sort(function (a, b) { return a.s - b.s; });
        return list;
      },
      step: function (g, list, w, h, t, move) {
        g.fillStyle = 'rgba(120, 128, 150, .22)';
        g.fillRect(0, 0, w, h);
        list.forEach(function (c) {
          var cw = c.s * 2.9;
          if (move !== false) c.x += c.v;
          if (c.x - cw / 2 > w) c.x = -cw / 2;
          drawSprite(g, clouds[c.k], c.x, c.y, cw, c.s, c.a, c.f);
        });
      }
    },
    rain: {
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 150; i++) list.push({ x: rand(0, w), y: rand(0, h), l: rand(h * 0.03, h * 0.06), v: rand(h * 0.012, h * 0.02), a: rand(0.35, 0.75) });
        return list;
      },
      step: function (g, list, w, h, t, move) {
        g.fillStyle = 'rgba(40, 55, 90, .18)';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#dbe8ff';
        g.lineCap = 'round';
        list.forEach(function (d) {
          if (move !== false) { d.y += d.v; d.x -= d.v * 0.25; }
          if (d.y > h) { d.y = -d.l; d.x = rand(0, w * 1.1); }
          g.globalAlpha = d.a;
          g.lineWidth = Math.max(1, h * 0.0025);
          g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.25, d.y + d.l); g.stroke();
        });
        g.globalAlpha = 1;
      }
    },
    snow: {
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 120; i++) list.push({ x: rand(0, w), y: rand(0, h), r: Math.max(1.6, rand(h * 0.004, h * 0.01)), v: Math.max(0.35, rand(h * 0.0008, h * 0.0022)), ph: rand(0, 6.28), a: rand(0.65, 1) });
        return list;
      },
      step: function (g, list, w, h, t, move) {
        g.fillStyle = '#ffffff';
        list.forEach(function (f) {
          if (move !== false) { f.y += f.v; f.x += Math.sin(t / 1400 + f.ph) * 0.35; }
          if (f.y - f.r > h) { f.y = -f.r; f.x = rand(0, w); }
          g.globalAlpha = f.a;
          g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
        });
        g.globalAlpha = 1;
      }
    }
  };

  function start(canvas, kind) {
    var fx = kinds[kind];
    var g = canvas.getContext && canvas.getContext('2d');
    if (!fx || !g) return function () {};
    var w = 0, h = 0, raf = 0, list = null;

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (!r.width) return;
      var first = !w;
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (first || !list) list = fx.make(w, h);
    }
    var speed = reduce ? 0.5 : 1;
    var last = 0;
    function frame(t) {
      if (!w) resize();
      if (w) {
        // 속도를 줄일 때는 두 프레임에 한 번만 움직인다 (그리기는 매번)
        var move = speed >= 1 || (t - last) > 30;
        if (move) last = t;
        g.clearRect(0, 0, w, h);
        fx.step(g, list, w, h, t || 0, move);
      }
      raf = requestAnimationFrame(frame);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    raf = requestAnimationFrame(function (t) { resize(); if (ro) ro.observe(canvas); frame(t); });
    return function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }

  window.StarSoupWeather = { start: start };
})();

/* 별빛스프 — #1 날씨 효과 (가장 위층)
   StarSoupWeather.start(canvas, kind) → stop 함수
   kind: sunny(작고 푸른 그림자가 있는 구름 몇 개) · rain(빗줄기) · snow(눈송이) · cloudy(구름이 잔뜩 끼어 흘러감)
   '움직임 줄이기'가 켜져 있으면 한 장면만 그리고 멈춘다. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rand(a, b) { return a + Math.random() * (b - a); }

  // 구름 한 덩이: 겹친 동그라미 + 아래쪽 푸른 그림자
  function drawCloud(g, x, y, s, body, shade, alpha) {
    var bumps = [[-0.9, 0.1, 0.55], [-0.4, -0.25, 0.75], [0.25, -0.35, 0.85], [0.85, 0, 0.6], [0, 0.15, 0.7]];
    g.globalAlpha = alpha * 0.9;
    g.fillStyle = shade;
    bumps.forEach(function (b) { g.beginPath(); g.arc(x + b[0] * s, y + b[1] * s + s * 0.22, b[2] * s, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = alpha;
    g.fillStyle = body;
    bumps.forEach(function (b) { g.beginPath(); g.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
  }

  var kinds = {
    sunny: {
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 5; i++) list.push({ x: rand(0, w), y: rand(h * 0.06, h * 0.45), s: rand(h * 0.045, h * 0.075), v: rand(0.08, 0.2), a: rand(0.8, 0.95) });
        return list;
      },
      step: function (g, list, w, h) {
        list.forEach(function (c) {
          c.x += c.v;
          if (c.x - c.s * 2 > w) c.x = -c.s * 2;
          drawCloud(g, c.x, c.y, c.s, '#ffffff', 'rgba(110, 150, 215, .38)', c.a);
        });
      }
    },
    cloudy: {
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 24; i++) list.push({ x: rand(-w * 0.1, w * 1.1), y: rand(-h * 0.08, h * 0.75), s: rand(h * 0.1, h * 0.2), v: rand(0.12, 0.45), a: rand(0.55, 0.9), tone: Math.random() });
        list.sort(function (a, b) { return a.s - b.s; });
        return list;
      },
      step: function (g, list, w, h) {
        g.fillStyle = 'rgba(120, 128, 150, .22)';
        g.fillRect(0, 0, w, h);
        list.forEach(function (c) {
          c.x += c.v;
          if (c.x - c.s * 2 > w) c.x = -c.s * 2;
          var body = c.tone < 0.5 ? '#d9dce6' : '#c3c8d6';
          drawCloud(g, c.x, c.y, c.s, body, 'rgba(90, 98, 125, .45)', c.a);
        });
      }
    },
    rain: {
      make: function (w, h) {
        var list = [];
        for (var i = 0; i < 150; i++) list.push({ x: rand(0, w), y: rand(0, h), l: rand(h * 0.03, h * 0.06), v: rand(h * 0.012, h * 0.02), a: rand(0.35, 0.75) });
        return list;
      },
      step: function (g, list, w, h) {
        g.fillStyle = 'rgba(40, 55, 90, .18)';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#dbe8ff';
        g.lineCap = 'round';
        list.forEach(function (d) {
          d.y += d.v; d.x -= d.v * 0.25;
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
        for (var i = 0; i < 110; i++) list.push({ x: rand(0, w), y: rand(0, h), r: rand(h * 0.003, h * 0.009), v: rand(h * 0.0008, h * 0.0022), ph: rand(0, 6.28), a: rand(0.6, 1) });
        return list;
      },
      step: function (g, list, w, h, t) {
        g.fillStyle = '#ffffff';
        list.forEach(function (f) {
          f.y += f.v;
          f.x += Math.sin(t / 1400 + f.ph) * 0.35;
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
    function frame(t) {
      if (!w) resize();
      if (w) {
        g.clearRect(0, 0, w, h);
        fx.step(g, list, w, h, t || 0);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    raf = requestAnimationFrame(function (t) { resize(); if (ro) ro.observe(canvas); frame(t); });
    return function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }

  window.StarSoupWeather = { start: start };
})();

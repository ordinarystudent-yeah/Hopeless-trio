/* 별빛스프 — 소리 (파일 없이 브라우저에서 바로 만든다)
   StarSoupSound.flip()   책장 넘기는 소리 (사각— 하는 종이 소리)
   StarSoupSound.start()  배경 음악: 오르골처럼 맑은 음이 느릿하게 반복 (아주 작게)
   StarSoupSound.toggle() 켜기/끄기 (기억해 둔다)
   소리는 사람이 처음 화면을 누른 뒤에만 날 수 있어서(브라우저 규칙), 시작하기를 누를 때 켠다. */
(function () {
  'use strict';
  var KEY = 'starsoup:sound';
  var on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 저장소를 못 쓰면 켜 둔다 */ }
  var ctx = null, master = null, music = null, timer = 0, step = 0, started = false;

  function audio() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
    // 음악 줄: 작은 소리 + 은은한 메아리
    music = ctx.createGain(); music.gain.value = 0.11;
    var delay = ctx.createDelay(1); delay.delayTime.value = 0.32;
    var fb = ctx.createGain(); fb.gain.value = 0.28;
    var wet = ctx.createGain(); wet.gain.value = 0.35;
    music.connect(master); music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    return ctx;
  }

  // 오르골 음 하나: 맑은 사인파 + 살짝 높은 배음, 톡 치고 천천히 사라짐
  function bell(freq, t, len, vol) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    var g2 = ctx.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
  }

  // 느린 자장가 같은 선율 (다장조 5음계), 한 마디 = 8박
  var N = { C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784 };
  var MELODY = ['E5', 'G4', 'C5', 'G4', 'D5', 'G4', 'C5', 'E4',
                'E5', 'A4', 'C5', 'A4', 'D5', 'G4', 'E5', null,
                'G5', 'E5', 'D5', 'C5', 'D5', 'A4', 'C5', 'G4',
                'E5', 'D5', 'C5', 'A4', 'G4', 'E4', 'C5', null];
  var BASS = ['C4', null, null, null, 'A4', null, null, null, 'D4', null, null, null, 'G4', null, null, null];
  var BEAT = 0.52;
  function tick() {
    if (!ctx || !on) return;
    var t = ctx.currentTime + 0.05;
    var m = MELODY[step % MELODY.length], b = BASS[step % BASS.length];
    if (m) bell(N[m], t, 1.6, 0.22);
    if (b) bell(N[b] / 2, t, 2.6, 0.12);
    step++;
  }

  function start() {
    if (!audio()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    timer = setInterval(tick, BEAT * 1000);
  }

  // 책장 넘기는 소리: 종이를 스치는 잡음을 위아래로 훑는다
  function flip() {
    if (!on || !audio()) return;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime, len = 0.55;
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.22); bp.frequency.exponentialRampToValueAtTime(1400, t + len);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
    src.start(t); src.stop(t + len);
  }

  function setOn(v) {
    on = v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 무시 */ }
    if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
    if (on) start();
  }

  window.StarSoupSound = {
    start: start, flip: flip,
    isOn: function () { return on; },
    toggle: function () { setOn(!on); return on; }
  };
})();

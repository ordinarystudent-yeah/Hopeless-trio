/* 별빛스프 — 소리 (파일 없이 브라우저에서 바로 만든다)
   StarSoupSound.flip()   책장 넘기는 소리 (사각— 하는 종이 소리)
   StarSoupSound.start()  배경 음악: 오르골처럼 맑은 음이 느릿하게 반복 (아주 작게)
   StarSoupSound.toggle() 켜기/끄기 (기억해 둔다)
   ambient('dishes'): #4 5쪽 식탁의 달그락 소리 (그 쪽을 떠날 때까지)
   효과음: stir() 스프 젓기(휘— 찰랑), stirDone() 다 저었을 때(반짝 화음), plop() 재료 퐁당,
           dip() 숟가락이 스프에 잠김, gulp() 한입 꿀꺽, chime() 날씨 고르기(바람 풍경)
   소리는 사람이 처음 화면을 누른 뒤에만 날 수 있어서(브라우저 규칙), 시작하기를 누를 때 켠다. */
(function () {
  'use strict';
  var KEY = 'starsoup:sound';
  var on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 저장소를 못 쓰면 켜 둔다 */ }
  var ctx = null, master = null, music = null, sfx = null, ui = null, timer = 0, step = 0, started = false;

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
    // 효과음 줄: 음악보다 또렷하게, 메아리는 조금만
    sfx = ctx.createGain(); sfx.gain.value = 0.55;
    var sw = ctx.createGain(); sw.gain.value = 0.18;
    sfx.connect(master); sfx.connect(sw); sw.connect(delay);
    // 고르기(선택지 누르기) 소리 줄: 효과음보다 10dB 작게 (≈ 0.316배)
    ui = ctx.createGain(); ui.gain.value = 0.316; ui.connect(sfx);
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
    // 10dB 작게 (0.32 → 0.1)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.038, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
    src.start(t); src.stop(t + len);
  }

  /* ---------- 효과음 ---------- */
  function ready() {
    if (!on || !audio()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  // 음 하나 (모양·높이 미끄러짐·크기)
  function tone(freq, t, len, vol, type, to, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + len * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + len + 0.05);
  }
  // 걸러 낸 잡음 (물·바람 소리)
  function noise(t, len, vol, f0, f1, q, dest) {
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q || 1.2;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + len);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(g); g.connect(dest || sfx);
    src.start(t); src.stop(t + len);
  }
  // 물방울(거품) 하나: 액체 소리의 핵심은 '음이 짧게 쑥 올라가는' 작은 공명 (실제 물방울 소리처럼)
  function bubble(t, f, len, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (1.6 + Math.random() * 0.8), t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t + len + 0.02);
  }
  // 낮게 걸러 낸 물결 소리 (찰랑)
  function slosh(t, len, vol, f) {
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < d.length; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.2; d[i] = last; }   // 부드러운(갈색) 잡음
    var src = ctx.createBufferSource(); src.buffer = buf;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(f * 0.6, t); lp.frequency.exponentialRampToValueAtTime(f, t + len * 0.4); lp.frequency.exponentialRampToValueAtTime(f * 0.5, t + len);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + len * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(lp); lp.connect(g); g.connect(sfx);
    src.start(t); src.stop(t + len);
  }
  // 스프 젓기: 찰랑— 하고 물결이 돌며 보글보글 작은 거품들
  function stir() {
    if (!ready()) return;
    var t = ctx.currentTime;
    // 보글보글 거품만 (바람 같은 '훅' 소리는 뺐다)
    for (var i = 0; i < 9; i++) bubble(t + Math.random() * 0.6, 260 + Math.random() * 560, 0.035 + Math.random() * 0.05, 0.09 + Math.random() * 0.09);
  }
  // 다 저었을 때: 반짝이는 화음이 빠르게 올라간다
  function stirDone() {
    if (!ready()) return;
    var t = ctx.currentTime;
    [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone(f, t + i * 0.045, 0.9, 0.16); tone(f * 2.01, t + i * 0.045, 0.5, 0.04); });
    tone(2637, t + 0.2, 1.2, 0.08);
  }
  // 재료 퐁당: 물에 톡 떨어지는 '퐁'(음이 쑥 올라가는 물방울) + 찰랑 튀는 물 + 뒤따르는 작은 거품
  function plop() {
    if (!ready()) return;
    var t = ctx.currentTime;
    // '퐁' 한 번 뒤로 거품이 보글보글 길게 올라오며 잦아든다 (휙 소리는 뺐다)
    bubble(t, 380, 0.12, 0.45);
    for (var i = 0; i < 12; i++) {
      var at = 0.12 + i * 0.09 + Math.random() * 0.06, fade = 1 - i / 13;
      bubble(t + at, 420 + Math.random() * 600, 0.04 + Math.random() * 0.03, 0.09 * fade + 0.02);
    }
  }
  // 숟가락이 스프에 살짝 잠김
  function dip() {
    if (!ready()) return;
    var t = ctx.currentTime;
    noise(t, 0.35, 0.25, 700, 300, 1.2);
    tone(420, t + 0.03, 0.18, 0.12, 'sine', 210);
  }
  // 한입 꿀꺽 + 별빛 반짝
  function gulp() {
    if (!ready()) return;
    var t = ctx.currentTime;
    tone(300, t, 0.2, 0.32, 'sine', 110);
    tone(240, t + 0.16, 0.16, 0.18, 'sine', 120);
    [1568, 2093, 2637].forEach(function (f, i) { tone(f, t + 0.36 + i * 0.07, 0.8, 0.07); });
  }
  // 날씨 고르기: 바람결에 풍경이 딸랑 (5음계에서 몇 개를 흩뿌린다)
  function chime() {
    if (!ready()) return;
    var t = ctx.currentTime;
    var notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    noise(t, 0.9, 0.06, 500, 1400, 0.7, ui);
    for (var i = 0; i < 4; i++) {
      var f = notes[Math.floor(Math.random() * notes.length)];
      tone(f, t + 0.05 + i * (0.08 + Math.random() * 0.06), 1.2, 0.11, 'sine', 0, ui);
      tone(f * 2.76, t + 0.05 + i * 0.1, 0.4, 0.025, 'sine', 0, ui);
    }
  }
  // 마림바 음 하나 (나무를 톡 치는 느낌)
  function mallet(f, t, vol) { tone(f, t, 0.45, vol, 'sine', 0, ui); tone(f * 4, t, 0.07, vol * 0.2, 'sine', 0, ui); }
  // 음식 고르기: 음식마다 다른 소리 (고르기 소리 줄, 10dB 작게)
  function pick(id) {
    if (!ready()) return;
    var t = ctx.currentTime, i;
    if (id === 'cotton-candy') {          // 폭신폭신: 높고 부드럽게 사르르 올라가는 세 음
      [1046.5, 1318.5, 1568].forEach(function (f, k) { tone(f, t + k * 0.07, 0.7, 0.18, 'sine', 0, ui); });
    } else if (id === 'pudding') {        // 말랑말랑: 음이 뽀잉 하고 출렁
      var o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.frequency.value = 520; l.frequency.value = 9; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(ui); o.start(t); l.start(t); o.stop(t + 0.55); l.stop(t + 0.55);
    } else if (id === 'chicken') {        // 바삭바삭: 짧게 바스락 터지는 소리
      for (i = 0; i < 6; i++) noise(t + i * 0.045 + Math.random() * 0.02, 0.04, 0.5, 3000 + Math.random() * 2000, 2200, 2, ui);
    } else if (id === 'bread') {          // 따끈따끈: 낮고 포근한 두 음
      mallet(392, t, 0.32); mallet(523.3, t + 0.12, 0.28);
    } else if (id === 'omurice') {        // 포슬포슬: 통통 튀는 세 음
      mallet(659.3, t, 0.3); mallet(784, t + 0.08, 0.28); mallet(987.8, t + 0.16, 0.26);
    } else if (id === 'rice-ball') {      // 동글동글: 동그랗게 굴러가는 음 (오르락내리락)
      [587.3, 784, 659.3, 880].forEach(function (f, k) { mallet(f, t + k * 0.065, 0.22); });
    } else {                              // 직접 그리기: 연필 사각사각
      for (i = 0; i < 4; i++) noise(t + i * 0.09, 0.07, 0.4, 3500 + Math.random() * 1500, 2500, 3, ui);
    }
  }
  // 때 고르기: 때마다 다른 소리
  function timePick(id) {
    if (!ready()) return;
    var t = ctx.currentTime;
    if (id === 'dawn') {                  // 어스름한 새벽: 멀리서 은은하게 번지는 낮은 두 음
      tone(392, t, 1.4, 0.2, 'sine', 0, ui); tone(587.3, t + 0.25, 1.4, 0.14, 'sine', 0, ui);
    } else if (id === 'morning') {        // 밝은 아침: 맑게 올라가는 아르페지오
      [523.3, 659.3, 784, 1046.5].forEach(function (f, k) { mallet(f, t + k * 0.07, 0.26); });
    } else if (id === 'day') {            // 한낮: 밝고 또렷한 화음 한 번
      [659.3, 784, 1046.5].forEach(function (f) { tone(f, t, 0.8, 0.16, 'triangle', 0, ui); });
    } else if (id === 'evening') {        // 노을 진 저녁: 천천히 내려오는 따뜻한 음
      [784, 659.3, 523.3].forEach(function (f, k) { tone(f, t + k * 0.14, 1.0, 0.2, 'sine', 0, ui); });
    } else {                              // 깜깜한 밤: 작고 높은 별 반짝임 두 번
      tone(1568, t, 1.2, 0.14, 'sine', 0, ui); tone(2093, t + 0.18, 1.4, 0.12, 'sine', 0, ui);
    }
  }
  // 박수: 사람들이 손뼉을 짝짝짝 — 손뼉 한 번은 '아주 짧고 날카롭게 튀는 넓은 잡음'(10ms 남짓에 사라짐) + 손바닥이 맞닿는 낮은 울림.
  // 여러 사람이 저마다 조금씩 다른 빠르기(초당 4~6번)·음색으로 치고, 다 같이 커졌다가 잦아든다
  var clapBuf = null;
  function clapBuffer() {
    if (clapBuf) return clapBuf;
    var len = Math.floor(ctx.sampleRate * 0.09);
    clapBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = clapBuf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var tt = i / ctx.sampleRate;
      // 손뼉은 아주 빠르게 몇 번 겹쳐 튀었다가(1~3ms 간격) 짧게 사라진다
      var env = Math.exp(-tt / 0.011) + 0.5 * Math.exp(-Math.max(0, tt - 0.0025) / 0.009) * (tt > 0.0025 ? 1 : 0);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    return clapBuf;
  }
  function clap() {
    if (!ready()) return;
    var t0 = ctx.currentTime + 0.02, dur = 2.6, buf = clapBuffer();
    for (var p = 0; p < 9; p++) {
      var rate = 4 + Math.random() * 2.2, f = 900 + Math.random() * 1500, q = 0.7 + Math.random() * 0.8, pv = 0.5 + Math.random() * 0.5;
      var start = Math.random() * 0.35, stop = dur - Math.random() * 0.6;
      for (var at = start; at < stop; at += (1 / rate) * (0.88 + Math.random() * 0.24)) {
        var x = at / dur, env = Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.15)), 0.6);
        var src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = 0.85 + Math.random() * 0.3;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.92 + Math.random() * 0.16); bp.Q.value = q;
        var g = ctx.createGain(); g.gain.value = 0.55 * pv * env;
        src.connect(bp); bp.connect(g); g.connect(sfx);
        src.start(t0 + at);
      }
    }
  }
  // 맛 카드: 맛마다 다른 소리
  function taste(id) {
    if (!ready()) return;
    var t = ctx.currentTime, i;
    if (id === 'galaxy') {          // 은하수처럼 달콤: 하프처럼 사르르 올라가는 화음
      [523.3, 659.3, 784, 987.8, 1174.7, 1568].forEach(function (f, k) { tone(f, t + k * 0.06, 1.3, 0.12); tone(f * 2.01, t + k * 0.06, 0.5, 0.025); });
    } else if (id === 'spark') {    // 별빛이 톡톡 터지는 짜릿함: 작은 불꽃 소리 + '팡'
      noise(t, 0.12, 0.3, 3000, 1500, 1);
      tone(1760, t, 0.25, 0.12, 'triangle', 2637);
      for (i = 0; i < 14; i++) tone(2400 + Math.random() * 3000, t + 0.05 + Math.random() * 0.5, 0.03, 0.06 + Math.random() * 0.05, 'square');
    } else if (id === 'cloud') {    // 구름처럼 포근: 후— 부드러운 바람과 낮고 둥근 음
      noise(t, 0.9, 0.22, 300, 900, 0.6);
      tone(392, t + 0.05, 0.9, 0.1); tone(587.3, t + 0.2, 0.9, 0.07);
    } else {                        // 직접 그리기: 연필이 사각사각
      for (i = 0; i < 5; i++) noise(t + i * 0.09, 0.07, 0.16, 3500 + Math.random() * 1500, 2500, 3);
    }
  }
  // 창문 열기: 나무 창이 '삐걱' 하고, 걸쇠 '딸깍', 바깥 바람이 '휘—'
  function windowOpen() {
    if (!ready()) return;
    var t = ctx.currentTime;
    noise(t, 0.04, 0.3, 2500, 1800, 2);                                  // 딸깍
    var o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(170, t + 0.06); o.frequency.linearRampToValueAtTime(230, t + 0.5);
    lfo.frequency.value = 26; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);   // 삐걱이는 떨림
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t + 0.06); g.gain.exponentialRampToValueAtTime(0.12, t + 0.14); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(bp); bp.connect(g); g.connect(sfx);
    o.start(t + 0.06); lfo.start(t + 0.06); o.stop(t + 0.6); lfo.stop(t + 0.6);
    noise(t + 0.25, 1.1, 0.2, 300, 1200, 0.7);                            // 휘—
  }
  // 종이 소리: 접힌 메모를 펼칠 때 바스락
  function paper() {
    if (!ready()) return;
    var t = ctx.currentTime;
    noise(t, 0.18, 0.28, 2200, 4200, 0.8);
    noise(t + 0.12, 0.22, 0.2, 3600, 1800, 0.9);
    noise(t + 0.3, 0.12, 0.12, 2600, 3400, 1);
  }

  /* ---------- #1 날씨 배경 소리 (반복) ----------
     ambient(id): 그 날씨의 소리를 은은하게 켜고, 끄는 함수를 돌려준다. 같은 날씨를 다시 켜면 이어서 쓴다 */
  var amb = null;   // { id, refs, gain, stopAll, timer }
  function loopNoise(len, brown) {
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < d.length; i++) { var w = Math.random() * 2 - 1; if (brown) { last = last * 0.97 + w * 0.15; d[i] = last * 2.5; } else d[i] = w; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    return src;
  }
  function buildAmbient(id) {
    var out = ctx.createGain(); out.gain.value = 0.0001; out.connect(master);
    var nodes = [], timers = [];
    var chain = function (src, filters, vol) {
      var g = ctx.createGain(); g.gain.value = vol;
      var prev = src; filters.forEach(function (f) { prev.connect(f); prev = f; }); prev.connect(g); g.connect(out);
      src.start(); nodes.push(src); return g;
    };
    var filt = function (type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    var lfo = function (param, rate, depth) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); nodes.push(o); };
    var every = function (min, max, fn) { var go = function () { fn(); timers.push(setTimeout(go, min + Math.random() * (max - min))); }; timers.push(setTimeout(go, min * Math.random())); };
    var blip = function (f, len, vol, glide) {   // 짧은 음 (빗방울·새·방울). glide: 음이 올라가는 정도 (1이면 그대로)
      var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f, t); if ((glide || 1.5) !== 1) o.frequency.exponentialRampToValueAtTime(f * (glide || 1.5), t + len * 0.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
    };
    var pad = function (freqs, vol) {   // 아주 천천히 들고 나는 부드러운 화음 (눈)
      freqs.forEach(function (f) {
        var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 6.1);
      });
    };
    if (id === 'rain') {
      // 청량한 빗소리: 낮은 웅웅거림은 빼고 높고 맑은 '솨아—' + 또르륵 맑게 튀는 빗방울
      chain(loopNoise(2.5), [filt('highpass', 1600), filt('lowpass', 8000)], 0.16);
      chain(loopNoise(3), [filt('bandpass', 4200, 0.6)], 0.08);
      every(45, 160, function () { blip(2200 + Math.random() * 2800, 0.02 + Math.random() * 0.02, 0.03 + Math.random() * 0.05); });
    } else if (id === 'snow') {
      // 소복소복: 아주 낮고 포근한 '쉬—' 바람 + 천천히 들고 나는 부드러운 화음
      var g1 = chain(loopNoise(4, true), [filt('lowpass', 320)], 0.3);
      lfo(g1.gain, 0.06, 0.12);
      var chords = [[261.6, 329.6, 392], [220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6]], ci = 0;
      every(4200, 5200, function () { pad(chords[ci++ % chords.length], 0.035); });
    } else if (id === 'cloudy') {
      // 흐린 날: 살랑이는 바람 + 멀리서 지저귀는 새
      chain(loopNoise(4, true), [filt('lowpass', 700)], 0.18);
      every(2200, 5200, function () {
        var base = 2600 + Math.random() * 900, n = 2 + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) (function (k) { setTimeout(function () { if (amb && amb.out === out) blip(base * (1 + k * 0.06), 0.09, 0.035); }, k * 120); })(i);
      });
    } else if (id === 'sunny') {
      // 화창한 날: 맑은 소리 — 햇살이 반짝이듯 유리 방울이 높고 맑게 딸랑 (5음계) + 아주 가벼운 바람
      chain(loopNoise(4, true), [filt('lowpass', 900)], 0.08);
      var bright = [1318.5, 1568, 1760, 2093, 2349, 2637, 3136];
      every(500, 1400, function () {
        var f = bright[Math.floor(Math.random() * bright.length)];
        blip(f, 1.6, 0.03, 1); blip(f * 2, 0.6, 0.008, 1);
      });
    } else if (id === 'dishes') {
      // #4 5쪽 식탁: 숟가락·포크가 그릇에 닿는 '쨍'·'달그락' (금속은 맞지 않는 배음이 높게 짧게 울리고, 사기그릇은 낮고 둔하게 톡)
      var clink = function (vol) {
        var t = ctx.currentTime, base = 1800 + Math.random() * 1600;
        [1, 2.76, 5.4, 8.93].forEach(function (r, k) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = base * r * (0.98 + Math.random() * 0.04);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol / (k + 1), t + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 / (k * 0.6 + 1));
          o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
        });
      };
      var clatter = function (vol) {   // 사기그릇 달그락
        var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 700 + Math.random() * 500;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.08);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
      };
      chain(loopNoise(4, true), [filt('lowpass', 500)], 0.05);   // 식탁 둘레의 아주 작은 웅성임
      every(350, 1300, function () {
        var r = Math.random();
        if (r < 0.45) clink(0.05 + Math.random() * 0.04);
        else if (r < 0.75) { clatter(0.08); setTimeout(function () { if (amb && amb.out === out) clatter(0.05); }, 70 + Math.random() * 60); }
        else { clink(0.06); setTimeout(function () { if (amb && amb.out === out) clink(0.035); }, 110 + Math.random() * 90); }
      });
    } else {
      // 직접 그린 날씨: 은은한 바람
      chain(loopNoise(4, true), [filt('lowpass', 600)], 0.25);
    }
    out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);   // 천천히 커진다
    return { id: id, refs: 0, out: out, stopAll: function () {
      timers.forEach(clearTimeout);
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      setTimeout(function () { nodes.forEach(function (n) { try { n.stop(); } catch (e) { /* 이미 멈춤 */ } }); out.disconnect(); }, 1600);
    } };
  }
  function ambient(id) {
    if (!id || !audio()) return function () {};
    if (amb && amb.id !== id) { amb.stopAll(); amb = null; }
    if (!amb) amb = buildAmbient(id);
    clearTimeout(amb.timer);
    amb.refs++;
    var mine = amb, done = false;
    return function () {
      if (done) return; done = true;
      mine.refs--;
      if (mine.refs <= 0) mine.timer = setTimeout(function () { if (mine.refs <= 0) { mine.stopAll(); if (amb === mine) amb = null; } }, 300);
    };
  }

  function setOn(v) {
    on = v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 무시 */ }
    if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
    if (on) start();
  }

  window.StarSoupSound = {
    start: start, flip: flip, ambient: ambient, pick: pick, timePick: timePick, clap: clap, taste: taste, windowOpen: windowOpen, paper: paper, stir: stir, stirDone: stirDone, plop: plop, dip: dip, gulp: gulp, chime: chime,
    isOn: function () { return on; },
    toggle: function () { setOn(!on); return on; }
  };
})();

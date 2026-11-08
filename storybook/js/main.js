/* 별빛스프 — 책 화면, 장면 넘기기, 스티커 */
(function () {
  'use strict';

  var S = window.StarSoup;
  var store = window.StarSoupStorage;
  var LAST = S.scenes.length - 1;
  var IMG_FOOD = 'food-custom';
  var IMG_BOARD = 'board-draw';     // #6 10쪽 보드에 그린 그림
  var IMG_DEED = 'deed-art';        // 착한 일 꾸미기 완성 그림 (메모지 포함)
  var IMG_DEED_BASE = 'deed-base';  // 메모지 없는 그림만 (다시 꾸밀 때)
  var IMG_WEATHER = 'weather-custom'; // #1 날씨를 직접 그린 그림
  var IMG_TASTE = 'taste-custom';       // #9 맛을 직접 그린 그림 (16쪽에 펼쳐진다)
  var IMG_WAKE = 'wake-weather-custom'; // #10 깨어나 본 창 밖 날씨를 직접 그린 그림

  var book = document.getElementById('book');
  var progress = document.getElementById('progress');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var endActions = document.getElementById('end-actions');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function freshState() {
    return {
      version: 2, layout: 2, scene: 0, page: 0, maxScene: 0,
      time: null, weather: null, customWeatherName: '', wakeWeather: null, wakeWeatherName: '',
      soup: [],   // 별빛스프 재료 (최대 5개) { id, name, u, v, w, r }: u·v·w는 스프 그림 기준 비율
      soupStirs: 0, // 스프를 저은 횟수 (10번이면 완성)
      name: '', food: null, customFoodName: '', deed: '', taste: null, customTasteName: '',
      stickers: {}, deedMemo: null, returnTo: null,
      fortuneFell: false,   // #10 황금빛 메모가 한 번 날아 들어왔는지 (그 뒤로는 창틀에 놓인 채로)
      padBg: {}   // 쪽 안 그림판의 바탕색 { 'board-draw': '#ffe1ea', ... } (그림과 따로)
    };
  }
  var state = freshState();
  var images = {};      // 직접 그린 그림 (IndexedDB에서 불러온 data URL)
  var direction = 1;
  var mode = 'spread';  // spread: 두 쪽을 함께 / single: 한 쪽씩

  /* ---------- 작은 도우미 ---------- */
  // 효과음 (js/sound.js). 소리를 끄면 나지 않는다
  function sfx(name) { var snd = window.StarSoupSound; if (snd && snd[name]) { try { snd[name](); } catch (e) { /* 소리 없이 계속 */ } } }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  function sceneIndex(id) { for (var i = 0; i < S.scenes.length; i++) if (S.scenes[i].id === id) return i; return 0; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function customFood(c) {
    var label = state.customFoodName.trim() || S.customFood.fallbackName;
    return {
      id: 'custom', custom: true, name: label, noun: label, emoji: '🎨',
      image: images[IMG_FOOD] || null,
      desc: c.you + S.josa(c.you, '이/가') + ' 직접 그린 ' + label + S.josa(label, '을/를') +
        ' 한입 먹으니, 세상에 하나뿐인 맛이 입 안 가득 퍼졌어요.'
    };
  }

  function ctx() {
    var name = state.name.trim();
    var c = { name: name, hasName: !!name, you: name || '당신', deed: state.deed.trim() };
    c.food = state.food === 'custom' ? customFood(c) : (S.foods.find(function (f) { return f.id === state.food; }) || null);
    c.taste = state.taste === 'custom' ? customTaste() : (S.tastes.find(function (t) { return t.id === state.taste; }) || null);
    c.time = S.times.find(function (t) { return t.id === state.time; }) || null;
    c.weather = weatherOf(state.weather, state.customWeatherName);
    c.wakeWeather = weatherOf(state.wakeWeather, state.wakeWeatherName);
    return c;
  }

  // 고른 날씨 → 문장에 쓸 정보 (직접 그린 날씨는 적은 이름으로)
  // 직접 그린 맛: 이름(안 쓰면 '내가 그린 맛')과 그림
  function customTaste() {
    var tn = (state.customTasteName || '').trim();
    return { id: 'custom', label: tn || S.customTaste.fallbackName, short: tn || S.customTaste.fallbackName, art: images[IMG_TASTE] || null };
  }
  function weatherOf(id, customName) {
    if (id !== 'custom') return S.weathers.find(function (w) { return w.id === id; }) || null;
    var wn = (customName || '').trim();
    return { id: 'custom', label: wn || S.customWeather.label, day: S.customWeather.day,
      pre: wn ? '‘' + wn + '’ 하늘이 펼쳐진' : S.customWeather.pre,
      feel: wn ? '내가 그린 ‘' + wn + '’ 하늘처럼 특별한 기분이 들었어요.' : S.customWeather.feel,
      seen: wn ? '내가 그린 ‘' + wn + '’ 하늘이 펼쳐져 있었어요.' : S.customWeather.seen };
  }

  // 문단 배열 → <p>들. 사용자 값은 textContent로만 넣는다.
  function paragraphs(list) {
    return list.map(function (para) {
      var coda = !Array.isArray(para) && para.coda;
      var p = el('p', { class: 'story' + (coda ? ' is-coda' : '') });
      (coda ? para.parts : para).forEach(function (seg) {
        if (typeof seg === 'string') p.append(document.createTextNode(seg));
        else p.append(el('span', { class: 'v' + (seg.quote ? ' is-quote' : ''), text: seg.v }));
      });
      return p;
    });
  }

  /* ---------- 알림 ---------- */
  var toastEl = document.getElementById('toast');
  var toastTimer = 0;
  function toast(message, ms) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 2600);
  }

  /* ---------- 확인창 (브라우저 confirm 대신 직접 만든 창) ---------- */
  var modal = document.getElementById('modal');
  function ask(opts) {
    return new Promise(function (resolve) {
      var okBtn = document.getElementById('modal-ok');
      var cancelBtn = document.getElementById('modal-cancel');
      document.getElementById('modal-title').textContent = opts.title;
      document.getElementById('modal-msg').textContent = opts.message || '';
      okBtn.textContent = opts.ok || '확인';
      cancelBtn.textContent = opts.cancel || '취소';
      okBtn.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      var before = document.activeElement;

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
        }
      }
      function onBackdrop(e) { if (e.target === modal) done(null); }
      function done(result) {
        modal.hidden = true;
        okBtn.onclick = cancelBtn.onclick = null;
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey, true);
        if (before && before.focus) before.focus({ preventScroll: true });
        resolve(result);
      }
      okBtn.onclick = function () { done(true); };
      cancelBtn.onclick = function () { done(false); };
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey, true);
      modal.hidden = false;
      cancelBtn.focus(); // 실수로 누르지 않도록 기본은 "취소"
    });
  }
  window.StarSoupUI = { ask: ask, toast: toast };

  /* ---------- 누르는 느낌 (손을 대는 순간 살짝 눌리고, 떼면 부드럽게 돌아온다) ---------- */
  var PRESSABLE = '.btn, .tile, .chip, .tool, .swatch, .icon-btn, .link-btn';
  var pressed = null;
  function release() { if (pressed) { pressed.classList.remove('is-pressed'); pressed = null; } }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(PRESSABLE);
    if (!t || t.disabled) return;
    release();
    pressed = t;
    t.classList.add('is-pressed');
  }, true);
  ['pointerup', 'pointercancel', 'dragstart'].forEach(function (type) { document.addEventListener(type, release, true); });
  document.addEventListener('pointerout', function (e) { if (pressed && e.target === pressed && !pressed.contains(e.relatedTarget)) release(); }, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && e.target.matches && e.target.matches(PRESSABLE)) e.target.classList.add('is-pressed');
  });
  document.addEventListener('keyup', function (e) { if (e.target.classList) e.target.classList.remove('is-pressed'); });

  /* ---------- 저장 ---------- */
  var saveTimer = 0;
  var warnedSave = false;
  function saveNow() {
    clearTimeout(saveTimer);
    var res = store.save(state);
    if (!res.ok && !warnedSave) {
      warnedSave = true;
      toast(res.quota
        ? '저장 공간이 부족해서 진행 기록을 저장하지 못했어요. 동화는 계속 읽을 수 있어요.'
        : '이 브라우저에서는 진행 기록을 저장할 수 없어요. 동화는 계속 읽을 수 있어요.', 4200);
    }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }

  function saveImage(key, dataUrl) {
    images[key] = dataUrl;
    return store.putImage(key, dataUrl).catch(function (err) {
      toast(store.isQuotaError(err)
        ? '저장 공간이 부족해서 그림을 이 기기에 보관하지 못했어요. 지금 화면에서는 그대로 보여요.'
        : '그림을 이 기기에 보관하지 못했어요. 지금 화면에서는 그대로 보여요.', 4200);
    });
  }

  function sanitize(raw) {
    var s = freshState();
    var str = function (v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; };
    var num = function (v, lo, hi, dflt) { return typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : dflt; };
    s.name = str(raw.name, S.limits.name);
    s.deed = str(raw.deed, S.limits.deed);
    s.customFoodName = str(raw.customFoodName, S.limits.foodName);
    s.food = raw.food === 'custom' || S.foods.some(function (f) { return f.id === raw.food; }) ? raw.food : null;
    s.taste = raw.taste === 'custom' || S.tastes.some(function (t) { return t.id === raw.taste; }) ? raw.taste : null;
    s.customTasteName = str(raw.customTasteName, S.limits.tasteName);
    s.time = S.times.some(function (t) { return t.id === raw.time; }) ? raw.time : null;
    s.weather = raw.weather === 'custom' || S.weathers.some(function (w) { return w.id === raw.weather; }) ? raw.weather : null;
    s.customWeatherName = str(raw.customWeatherName, S.limits.weatherName);
    s.wakeWeather = raw.wakeWeather === 'custom' || S.weathers.some(function (w) { return w.id === raw.wakeWeather; }) ? raw.wakeWeather : null;
    s.wakeWeatherName = str(raw.wakeWeatherName, S.limits.weatherName);
    s.soupStirs = Number.isInteger(raw.soupStirs) ? clamp(raw.soupStirs, 0, 10) : 0;
    s.soup = Array.isArray(raw.soup) ? raw.soup.filter(function (g) { return g && typeof g.id === 'string' && /^[a-z0-9]+$/.test(g.id); })
      .slice(0, S.limits.ingredients).map(function (g) {
        return { id: g.id, name: str(g.name, S.limits.ingredient), u: num(g.u, 0, 1, 0.5), v: num(g.v, 0, 1, 0.5), w: num(g.w, 0.06, 0.4, 0.16), r: num(g.r, -180, 180, 0) };
      }) : [];
    // layout 2: 콘티대로 #2·3을 한 펼침면으로 합친 9장면 구성. 그 전 기록은 장면 번호를 하나씩 당긴다.
    var move = raw.layout === 2 ? function (i) { return i; } : function (i) { return i >= 2 ? i - 1 : i; };
    s.maxScene = Number.isInteger(raw.maxScene) ? clamp(move(raw.maxScene), 0, LAST) : 0;
    s.scene = Number.isInteger(raw.scene) ? clamp(move(raw.scene), 0, s.maxScene) : 0;
    s.page = raw.page === 1 ? 1 : 0;
    // 예전 버전은 PC에서 음식 스티커를 #5에 붙였다 → 이제는 #4 오른쪽 쪽에만 붙으므로 정리
    delete s.stickers.fairies;
    s.fortuneFell = raw.fortuneFell === true;
    if (raw.padBg && typeof raw.padBg === 'object') {
      [IMG_BOARD, IMG_TASTE].forEach(function (k) { var v = raw.padBg[k]; if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) s.padBg[k] = v; });
    }
    if (raw.deedMemo && typeof raw.deedMemo === 'object') {
      s.deedMemo = { x: num(raw.deedMemo.x, 0, 1, 0.5), y: num(raw.deedMemo.y, 0, 1, 0.2) };
    }
    if (raw.stickers && typeof raw.stickers === 'object') {
      S.scenes.forEach(function (sc) {
        var list = raw.stickers[sc.id];
        if (!Array.isArray(list)) return;
        s.stickers[sc.id] = list.filter(function (st) {
          return st && (st.kind === 'food' || st.kind === 'deed' || st.kind === 'favfood');
        }).slice(0, 8).map(function (st) {
          return {
            kind: st.kind, x: num(st.x, 0, 1, 0.5), y: num(st.y, 0, 1, 0.5),
            w: num(st.w, 0.04, 0.6, 0.12), r: num(st.r, -180, 180, 0)
          };
        });
      });
    }
    return s;
  }

  /* ---------- 화면 모드: 넓은 가로 화면은 펼침면, 그 밖은 한 쪽씩 ---------- */
  // 아이패드·태블릿: 컴퓨터처럼 항상 펼침면 (세로로 들면 가로로 돌려 달라는 안내가 덮는다)
  var isTablet = (function () {
    // 손가락이 주된 입력이고(마우스가 아닌) 화면의 짧은 쪽이 600px 이상이면 태블릿으로 본다 (휴대폰은 짧은 쪽이 500px 안팎)
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    var shortSide = Math.min(window.screen.width, window.screen.height);
    return touch && coarse && shortSide >= 600;
  })();
  if (isTablet) document.documentElement.classList.add('is-tablet');

  function pickMode() {
    if (isTablet) return 'spread';
    var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome')) || 172;
    var w = (document.getElementById('app').clientWidth || window.innerWidth - 32);
    var h = window.innerHeight - chrome;
    var ratio = 1.4143;
    var spreadPage = Math.min(w / 2, h * ratio);   // 펼침면일 때 한 쪽의 너비
    var singlePage = Math.min(w, h * ratio);       // 한 쪽씩일 때 한 쪽의 너비
    // 두 쪽을 함께 볼 수 있으면 펼침면(가로 휴대폰·가로 아이패드·PC), 쪽이 너무 작아지면 한 쪽씩(세로 휴대폰·세로 아이패드).
    // 가로로 넓은 화면(PC·가로 휴대폰)은 쪽이 너무 작지 않으면 늘 펼침면 (큰 모니터에서 한 쪽씩으로 바뀌던 문제)
    if (window.innerWidth > window.innerHeight && spreadPage >= 220) return 'spread';
    return spreadPage >= 270 && spreadPage >= singlePage * 0.55 ? 'spread' : 'single';
  }

  /* ---------- 삽화 자리 (임시 그림) ---------- */
  function motif(name, pos) {
    if (!name || !S.motifs[name]) return null;
    var box = el('div', { class: 'pg-art', 'data-pos': pos || 'center', 'aria-hidden': 'true' });
    box.insertAdjacentHTML('beforeend', S.motifs[name]); // 코드에 고정된 그림만
    return box;
  }

  function eyebrow(scene, index, page) {
    var act = S.acts[scene.act];
    var no = (page && page.no) || scene.no || String(index + 1);
    return el('p', { class: 'eyebrow' },
      el('span', { text: act.label + ' · ' + act.title }),
      el('span', { class: 'no', text: '#' + no }));
  }

  /* ---------- 한 장면(펼침면) 만들기 ---------- */
  function buildLeaf(index) {
    var scene = S.scenes[index];
    var c = ctx();
    var leaf = el('article', { class: 'leaf', 'data-page': state.page, 'aria-label': '#' + (index + 1) + ' 장면' });
    leaf._teardown = [];
    var spread = el('div', { class: 'spread', 'data-tone': scene.tone });

    var bg = el('div', { class: 'spread-bg', 'aria-hidden': 'true' });
    if (scene.image) {
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onload = function () { leaf.classList.add('has-image'); img.classList.add('is-loaded'); };
      img.onerror = function () { img.remove(); };
      img.src = scene.image;
      // 미리 불러 둔 그림이면 서서히 나타나지 않고 바로
      if (img.complete && img.naturalWidth) { leaf.classList.add('has-image'); img.classList.add('is-loaded', 'is-instant'); }
      // #1처럼 삽화를 효과 레이어로 겹칠 때 (예: 스크린 70%) — 아래의 하늘색이 비쳐 보인다
      if (scene.imageBlend) { img.style.mixBlendMode = scene.imageBlend.mode; img.style.opacity = String(scene.imageBlend.opacity); }
      bg.append(img);
      // 그 위에 놓는 그림(투명 PNG, 예: #1 도심)
      if (scene.overlay) bg.append(el('img', { class: 'spread-overlay', src: scene.overlay, alt: '', decoding: 'async' }));
      if (S.showAssetNotes) bg.append(el('span', { class: 'asset-note', text: '펼침면 삽화 자리 · ' + scene.image }));
    }
    // #1: 가장 아래층에 고른 때의 하늘색
    if (scene.sky) {
      // sky가 때 id면 그 때로 고정 (#10 창 밖은 화창한 아침), true면 #1 앞에서 고른 때
      var skyId = typeof scene.sky === 'string' ? scene.sky : state.time;
      var t = S.times.find(function (x) { return x.id === skyId; });
      bg.style.background = t ? t.sky : S.times[S.times.length - 1].sky;
      bg.setAttribute('data-sky', t ? t.id : 'night');
    }
    spread.append(bg);
    // #1: 가장 위층에 고른 날씨의 움직이는 효과 (글 상자는 그 위에 놓여 읽기 쉽게)
    var wKey = scene.weatherFx === 'wake' ? 'wake' : 'weather';
    var wId = wKey === 'wake' ? state.wakeWeather : state.weather;
    if (scene.weatherFx && wId) {
      var fx = el('div', { class: 'weather-fx', 'aria-hidden': 'true' });
      var wImg = images[wKey === 'wake' ? IMG_WAKE : IMG_WEATHER];
      if (wId === 'custom') {
        if (wImg) fx.append(el('img', { class: 'weather-art', src: wImg, alt: '' }));
      } else if (window.StarSoupWeather) {
        var cvs = el('canvas', { class: 'weather-canvas' });
        fx.append(cvs);
        leaf._teardown.push(window.StarSoupWeather.start(cvs, wId));
      }
      spread.append(fx);
      // #1: 고른 날씨의 배경 소리 (빗소리·바람·새소리…). 이 장면을 떠나면 천천히 꺼진다
      if (scene.id === 'intro' && !printing && window.StarSoupSound && window.StarSoupSound.ambient) leaf._teardown.push(window.StarSoupSound.ambient(wId));
    }

    scene.pages.forEach(function (p, pi) {
      var page = el('section', {
        class: 'page page--' + (pi ? 'right' : 'left'),
        'aria-label': (pi ? '오른쪽' : '왼쪽') + ' 쪽'
      });
      // 펼침 보기에서 쪽 사이에 묻는 장면(#10): 묻기 전에는 그 쪽(18쪽)을 덮어 두었다가, 고른 뒤에 펼친다
      if (mode === 'spread' && scene.askAt === pi && state.page < pi) {
        page.classList.add('is-veiled');
        page.append(el('div', { class: 'page-veil', 'aria-hidden': 'true' }, el('span', { text: '…' })));
        spread.append(page);
        return;
      }
      var pg = el('div', { class: 'pg' + (p.tight ? ' pg--tight' : ''), 'data-place': p.place || 'top' });
      if (p.fade) page.classList.add('is-fade');
      if (p.low) pg.classList.add('pg--low');   // 글을 쪽 맨 아래 가까이 (#5 8쪽 보랏빛 연기 위)
      if (p.window) {
        page.classList.add('has-image', 'has-window'); page.append(roomWindow(leaf));
        if (state.wakeWeather && !printing) page.append(fortuneNote(leaf, page));
      }
      // 그림 속 말풍선 안에 넣는 글 (#6: 내가 적은 착한 일)
      if (p.bubble) {
        var bt = p.bubble.text(c), bb = el('div', { class: 'bubble-text' + (bt.empty ? ' is-empty' : '') }, el('p', { text: bt.text }));
        bb.style.left = p.bubble.x * 100 + '%'; bb.style.top = p.bubble.y * 100 + '%';
        bb.style.width = p.bubble.w * 100 + '%'; bb.style.height = p.bubble.h * 100 + '%';
        bb.style.setProperty('--fs', (bt.text.length <= 16 ? 7 : bt.text.length <= 32 ? 5.8 : bt.text.length <= 52 ? 4.8 : 4) + 'cqh');
        page.append(bb);
      }
      // 이 쪽만의 하늘(아래층)과 날씨(위층): 펼침면 삽화를 덮는다
      if (p.sky) {
        var pt = S.times.find(function (x) { return x.id === (typeof p.sky === 'string' ? p.sky : state.time); }) || S.times[1];
        page.append(el('div', { class: 'page-sky', 'data-sky': pt.id, 'aria-hidden': 'true', style: 'background:' + pt.sky }));
        page.classList.add('has-image');
      }
      if (p.weatherFx) {
        var pwId = p.weatherFx === 'wake' ? state.wakeWeather : state.weather;
        var pwImg = images[p.weatherFx === 'wake' ? IMG_WAKE : IMG_WEATHER];
        if (pwId) {
          var pfx = el('div', { class: 'weather-fx', 'aria-hidden': 'true' });
          if (pwId === 'custom') { if (pwImg) pfx.append(el('img', { class: 'weather-art', src: pwImg, alt: '' })); }
          else if (window.StarSoupWeather) {
            var pcv = el('canvas', { class: 'weather-canvas' });
            pfx.append(pcv);
            leaf._teardown.push(window.StarSoupWeather.start(pcv, pwId));
          }
          page.append(pfx);
        }
      }
      var pageImage = typeof p.image === 'function' ? p.image(c) : p.image;
      if (pageImage) {
        var pimg = new Image();
        pimg.alt = '';
        // 직접 그린 그림(투명한 PNG)은 종이 바탕 위에 놓아, 펼침면 삽화가 비쳐 보이지 않게 한다
        pimg.className = 'page-img' + (/^data:/.test(pageImage) ? ' page-img--drawn' : '');
        pimg.decoding = 'async';
        pimg.onload = function () { page.classList.add('has-image'); pimg.classList.add('is-loaded'); };
        pimg.onerror = function () { pimg.remove(); };
        pimg.src = pageImage;
        if (pimg.complete && pimg.naturalWidth) { page.classList.add('has-image'); pimg.classList.add('is-loaded', 'is-instant'); }
        page.append(pimg);
        // #6 10쪽: 다른 사람들의 메모가 보드 뒤로 떠다닌다 (보드 앞판을 그 위에 다시 얹는다)
        // 보드 안쪽 판 색 (그림판의 바탕색으로 고른 색) → 그 판 안에서만 다른 사람들의 메모가 떠다닌다
        // 다른 사람들의 메모는 보드 뒤(벽)로 떠다닌다: 메모 층 위에 보드 앞판을 다시 얹고, 그 위에 안쪽 판 색
        if (p.board && !printing) page.append(boardFloat(leaf), el('img', { class: 'page-img board-front is-loaded is-instant', src: 'assets/backgrounds/06-board-front.png', alt: '', draggable: 'false' }));
        if (p.board) { var tint = el('div', { class: 'board-tint', 'aria-hidden': 'true' }); page.append(tint); leaf._boardTint = tint; paintPadBg(leaf, IMG_BOARD); }
      }
      // 임시 그림(motif)은 삽화가 없는 쪽에만 그린다. 삽화가 있으면 그 아래에 아무것도 깔지 않는다
      if (p.art && !scene.image && !pageImage && !p.window) {
        var m = motif(p.art, p.artPos);
        if (p.faint) m.classList.add('is-faint');
        pg.append(m);
      }
      if (p.text) {
        var body = typeof p.text === 'function' ? p.text(c) : scene.text(c);
      }
      var block = null;
      // 그려 준 곡선을 따라 글자를 한 자씩 놓는 나레이션 (curve). 이때는 보통 글 상자를 만들지 않는다
      var curveDone = false;
      if (p.curve) {
        var ct = p.curve.text ? p.curve.text(c) : (body ? { body: flatText(body) } : null);
        if (ct) {
          page.append(curveText(page, p.curve, ct, p.curve.eyebrowAt ? eyebrow(scene, index, p) : null));
          curveDone = true;
        }
      }
      if (p.text && body && !curveDone) {
        var block = el('div', { class: 'pg-text is-panel' + (p.ink === 'dark' ? ' is-ink' : '') + (p.narrow ? ' is-narrow' : '') + (p.align === 'end' ? ' is-end' : '') + (p.board ? ' is-over-pad' : '') + (p.bare ? ' is-bare' : '') }, eyebrow(scene, index, p), paragraphs(body));
        if (p.wave) waveText(block, p.wave);
        if (p.tilt) block.style.transform = 'rotate(' + p.tilt + 'deg)';
        if (p.wide) block.style.maxWidth = p.wide * 100 + '%';   // 삽화의 물결을 따라 살짝 기울이기
        pg.append(block);
      }
      // 작은 안내 (#4 5쪽: 스티커 붙이기, #6 10쪽: 보드 꾸미기). noteAt 'bottom'이면 쪽 아래 왼쪽에 따로
      var noteText = p.note === 'food-sticker' ? (c.food ? foodStickerHint() : '') : typeof p.note === 'function' ? p.note(c) : '';
      if (noteText) {
        var noteEl = el('p', { class: 'hint pg-note' + (p.note === 'food-sticker' ? ' sticker-hint' : '') + (p.noteAt === 'bottom' ? ' pg-note--bottom' : ''), text: noteText });
        if (p.noteAt === 'bottom') page.append(noteEl);
        else if (block) block.append(noteEl);
      }
      if (p.nameplate) page.append(nameplateInput(leaf, p.nameplate));
      (p.widgets || []).forEach(function (w) { if (!(curveDone && p.curve.replacesWidgets)) append(pg, widget(w, c, leaf, index)); });
      page.append(pg, el('span', { class: 'folio', 'aria-hidden': 'true', text: index * 2 + pi + 1 }));
      spread.append(page);
    });

    if (scene.effect === 'sparkles') {
      var cv = el('canvas', { class: 'sparkles', 'aria-hidden': 'true' });
      spread.append(cv);
      leaf._teardown.push(sparkles(cv, scene.sparkles));
    }

    // #4 5·6쪽(식탁)에 있는 동안 식기가 달그락거리는 배경 소리 (다음 장면으로 넘기면 천천히 꺼진다)
    if (scene.id === 'food' && !printing && window.StarSoupSound && window.StarSoupSound.ambient) leaf._teardown.push(window.StarSoupSound.ambient('dishes'));
    var layer = el('div', { class: 'stickers' });
    spread.append(layer);
    leaf._stickers = layer;
    leaf._sceneId = scene.id;
    if (scene.id === 'deed') {
      ensureBoardStickers();
      // 내 착한 일·좋아하는 음식 메모를 다른 사람들의 보드 뒤로 띄워 보낸다 (아티팩트에서만)
      if (window.StarSoupShared && !printing && c.deed) shareMyMemo(c);
    }
    paintStickers(leaf);

    leaf.append(spread);
    // 스티커 바깥을 누르면 선택 해제
    leaf.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.sticker')) selectSticker(leaf, null);
    });
    return leaf;
  }

  /* ---------- #10 18쪽: 방 창문 ----------
     닫혀 있으면 살짝 반짝이며 눌러 보라고 알려 준다. 누르면 두 창이 바깥으로 열리고 '한결 달라진 기분으로 창문을 여니…' 화면으로.
     고른 뒤에는 열린 창 너머로 아침 하늘과 그 날씨(움직이는 효과, 직접 그렸다면 그 그림)가 보인다. 다시 누르면 바꿀 수 있다. */
  function roomWindow(leaf) {
    var chosen = !!state.wakeWeather;
    var view = el('div', { class: 'win-view', 'aria-hidden': 'true' });
    var morning = S.times.find(function (x) { return x.id === 'morning'; });
    view.style.background = morning ? morning.sky : '#bfe0f5';
    if (chosen) {
      if (state.wakeWeather === 'custom') {
        if (images[IMG_WAKE]) view.append(el('img', { class: 'win-art', src: images[IMG_WAKE], alt: '' }));
      } else if (window.StarSoupWeather) {
        var cv = el('canvas', { class: 'weather-canvas' });
        view.append(cv);
        leaf._teardown.push(window.StarSoupWeather.start(cv, state.wakeWeather));
      }
    }
    var paneL = el('span', { class: 'win-pane win-pane--l' }), paneR = el('span', { class: 'win-pane win-pane--r' });
    var hint = el('span', { class: 'win-hint', 'aria-hidden': 'true', text: chosen ? '눌러서 바꿀 수 있어요' : '창문을 눌러 열어 보세요' });
    var glow = el('span', { class: 'win-glow', 'aria-hidden': 'true' });
    var btn = el(printing ? 'div' : 'button', { type: printing ? null : 'button', class: 'win' + (chosen ? ' is-open' : ' is-closed'),
      'aria-label': chosen ? '창 밖 날씨 바꾸기' : '창문 열기' },
      glow, view, el('span', { class: 'win-frame', 'aria-hidden': 'true' }), paneL, paneR, el('span', { class: 'win-sill', 'aria-hidden': 'true' }), hint);
    // 움직임은 JS로 (기기의 '움직임 줄이기'에도 멈추지 않게)
    var OPEN_L = 'rotateY(76deg)', OPEN_R = 'rotateY(-76deg)';   // 원근은 .win의 perspective로
    // 열린 모습은 CSS(.win.is-open)에서 덧창을 창 양옆에 평면으로 펼쳐 둔다 — 앱과 PDF 저장본이 같은 모양
    if (chosen) { /* is-open 클래스로 */ }
    else if (glow.animate) {
      // 닫힌 창: 금빛이 천천히 숨 쉬듯 번지고, 창이 살짝 들썩여 눌러 보고 싶게
      glow.animate([{ opacity: 0.15, transform: 'scale(0.98)' }, { opacity: 0.9, transform: 'scale(1.03)' }, { opacity: 0.15, transform: 'scale(0.98)' }],
        { duration: 2000, iterations: Infinity, easing: 'ease-in-out' });
      [paneL, paneR].forEach(function (pn, i) {
        pn.animate([{ transform: 'none' }, { transform: 'rotateY(' + (i ? -7 : 7) + 'deg)', offset: 0.12 }, { transform: 'none', offset: 0.24 }, { transform: 'none' }],
          { duration: 3200, delay: 900, iterations: Infinity, easing: 'ease-in-out' });
      });
      hint.animate([{ opacity: 0.55 }, { opacity: 1 }, { opacity: 0.55 }], { duration: 2000, iterations: Infinity });
    }
    btn.addEventListener('click', function () {
      if (switching) return;
      if (chosen || !paneL.animate) { showAsk('wake', 1); return; }
      // 두 창이 바깥으로 활짝 열리는 걸 보여 준 다음 묻는다
      btn.classList.remove('is-closed');
      sfx('windowOpen');
      [glow, paneL, paneR, hint].forEach(function (n) { n.getAnimations().forEach(function (a) { a.cancel(); }); });
      hint.style.opacity = '0';
      // 덧창이 바깥으로 활짝 펼쳐지며 창 양옆에 접힌다 (닫힌 자리 → 양옆)
      var openL = [{ left: '3cqh', width: 'calc(50% - 3cqh)' }, { left: '-15%', width: '15%' }];
      var openR = [{ right: '3cqh', width: 'calc(50% - 3cqh)' }, { right: '-15%', width: '15%' }];
      // 두 창이 다 열리고 나서 0.2초 뒤에 묻는 화면이 나온다 (열리는 도중에 넘어가며 튕기지 않게)
      var aL = paneL.animate(openL, { duration: 750, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
      var aR = paneR.animate(openR, { duration: 750, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
      Promise.all([aL.finished, aR.finished]).then(function () {
        setTimeout(function () { if (btn.isConnected) showAsk('wake', 1); }, 200);
      }, function () {});
    });
    return btn;
  }

  /* ---------- #10 18쪽: 황금빛 메모 (운세·조언) ----------
     창 밖 날씨를 처음 고르고 이 쪽에 오면, 금빛 메모가 창 너머에서 팔랑팔랑 떨어져 창 안으로 들어와 창틀에 내려앉는다 (한 번만).
     그 뒤로는 창틀에 놓여 있다. 스프 떠먹기처럼 '터치' 안내가 깜빡이고, 누르면 메모가 커지며 펼쳐진다 (위에 × 닫기).
     내용은 펼칠 때마다 지금 고른 조합으로 다시 만든다 → 선택지를 바꾸면 메모 내용도 바뀐다 (다시 떨어지지는 않음). */
  function fortuneBody(c) {
    // 조합별 문구(fortune.text)가 정해지면 공통 문구 아래에 나온다. 아직은 공통 문구만
    var f = S.fortune || {}, lines = f.text ? f.text(c) : null;
    var box = el('div', { class: 'fortune-body' });
    if (lines && lines.length) box.append(paragraphs(lines));
    return box;
  }
  function fortuneNote(leaf, page) {
    var wrap = el('div', { class: 'fortune' });
    var fly = el('div', { class: 'fortune-fly' });
    // 황금빛 편지봉투 (tools/envelope_art.py). 떨어질 땐 흔들리며, 창틀에서는 납작하게 누워 있다
    var note = el('button', { type: 'button', class: 'fortune-note', 'aria-label': '황금빛 편지 열기' },
      el('img', { src: 'assets/fortune/envelope-closed.png', alt: '', draggable: 'false' }));
    var ring = el('span', { class: 'fortune-glow', 'aria-hidden': 'true' });   // 동그란 원 대신 메모 자체가 은은하게 빛난다
    var label = el('span', { class: 'scoop-label fortune-touch', 'aria-hidden': 'true', text: '터치' });
    fly.append(note);
    wrap.append(fly, label);   // '터치'는 돌아가지 않게 봉투 밖에
    var beat = { duration: 2400, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' };
    var hints = [];
    function showHint() {
      if (!ring.animate) return;
      hints = [note.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.12) drop-shadow(0 0 1.6cqh rgb(255 220 120 / 0.9))' }], beat), label.animate([{ opacity: 0.7 }, { opacity: 1 }], beat)];
    }
    function hideHint() { hints.forEach(function (a) { a.cancel(); }); hints = []; ring.style.opacity = label.style.opacity = '0'; }
    var visible = function () { return mode === 'spread' || state.page === 1; };
    if (!state.fortuneFell && visible() && fly.animate) {
      state.fortuneFell = true; saveSoon();
      ring.style.opacity = label.style.opacity = '0';
      fly.style.opacity = '0';
      setTimeout(function () {
        if (!fly.isConnected) return;
        // 진자처럼: 마름모 메모가 줄에 매달린 듯 좌우로 길게 호를 그리며(양 끝에서 살짝 떠오르며 기울어) 천천히 내려온다.
        // 창 밖(창 너머 하늘)에서만 보이도록 창 안쪽 자리로 잘라 두고 위에서부터 떨어지다가,
        // 창 아래쪽까지 내려오면 자르기를 풀어 창 안(방)으로 들어와 창틀에 마름모로 앉는다.
        // 크기는 그대로, 종이가 기울 때마다 세로(Y)만 납작해져 원근을 낸다.
        var u = page.clientHeight / 100;   // 1cqh (px)
        var view = page.querySelector('.win-view');
        var wr = wrap.getBoundingClientRect(), vr = view ? view.getBoundingClientRect() : null;
        var half = fly.offsetWidth * 0.5;                        // 봉투의 반 너비 (흔들려도 이 안)
        var cy = wr.top + wr.height / 2;
        var y0 = vr ? (vr.top - cy) - half * 1.2 : -48 * u;       // 창 너머 위쪽, 보이지 않는 곳에서 시작
        var ySw = vr ? Math.min(-0.5 * u, (vr.bottom - cy) - half - 0.6 * u) : -6 * u;   // 창 아래쪽(아직 창 밖)
        if (vr) wrap.style.clipPath = 'inset(' + [vr.top - wr.top, wr.right - vr.right, wr.bottom - vr.bottom, vr.left - wr.left].map(function (v) { return v.toFixed(1) + 'px'; }).join(' ') + ')';
        var N = 100, D = 9500, frames = [], T_IN = 0.86, PERS = Math.round(30 * u);   // 원근 거리 (30cqh)
        var L = 20 * u, SWINGS = 3;
        for (var i = 0; i <= N; i++) {
          var t = i / N;
          var amp = 0.62 * Math.pow(Math.max(0, 1 - t / 0.9), 0.8);   // 흔들림은 점점 잦아든다 (라디안)
          var th = amp * Math.sin(t * SWINGS * 2 * Math.PI / 0.9);      // 진자의 각도
          var k = Math.min(1, t / T_IN), ease = 1 - Math.pow(1 - k, 1.8);   // 처음부터 빠르게 떨어지기 시작해 점점 느려진다
          var yb = t <= T_IN ? y0 + (ySw - y0) * ease : ySw * (1 - Math.sin((t - T_IN) / (1 - T_IN) * Math.PI / 2));
          var x = -16 * u * (1 - Math.min(1, t / 0.9)) + L * Math.sin(th);
          var y = yb - L * (1 - Math.cos(th));                          // 호의 양 끝에서는 살짝 떠오른다
          // 기울수록 세로가 납작 (원근). 마지막에는 창틀에 누운 모양(세로 0.45)으로 스르르
          var lie = t < 0.8 ? 0 : Math.pow((t - 0.8) / 0.2, 2) * (3 - 2 * (t - 0.8) / 0.2) / 1;
          lie = Math.min(1, Math.max(0, lie));
          var sy = Math.max(0.35, Math.cos(th * 1.9)) * (1 - lie) + 0.53 * lie;
          var rot = th * 180 / Math.PI * 0.6;
          // 세로로 납작해지는 만큼 앞으로 눕힌다(rotateX) → 먼 쪽인 봉투 윗면이 원근으로 좁아진다
          var ax = Math.acos(Math.min(1, sy)) * 180 / Math.PI;
          frames.push({ transform: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) perspective(' + PERS + 'px) rotateX(' + ax.toFixed(1) + 'deg) rotate(' + rot.toFixed(1) + 'deg)', offset: t });
        }
        frames[N].transform = 'translate(0px,0px) perspective(' + PERS + 'px) rotateX(58deg) rotate(0deg)';
        setTimeout(function () { wrap.style.clipPath = ''; }, D * T_IN);   // 창 안으로 들어온다
        var a = fly.animate(frames, { duration: D, easing: 'linear', fill: 'forwards' });
        fly.style.opacity = '';
        wrap._fall = a;
        a.finished.then(function () { a.commitStyles && a.commitStyles(); a.cancel(); if (fly.isConnected) { ring.style.opacity = label.style.opacity = ''; showHint(); } }, function () {});
      }, mode === 'spread' ? 900 : 700);
    } else showHint();
    note.addEventListener('click', function (e) {
      e.stopPropagation();
      if (switching) return;
      hideHint();
      sfx('paper');
      openFortune(leaf, page, note, function () { if (fly.isConnected) { ring.style.opacity = label.style.opacity = ''; showHint(); } });
    });
    return wrap;
  }
  function openFortune(leaf, page, from, onClose) {
    if (page.querySelector('.fortune-open')) return;
    var c = ctx();
    var close = el('button', { type: 'button', class: 'fortune-close', 'aria-label': '메모 닫기' }, '×');
    var ft = S.fortune && S.fortune.title, title = typeof ft === 'function' ? ft(c) : (ft || '요정의 한마디!');
    // 펼친 모습: 덮개가 열린 봉투가 비스듬히 놓이고, 그 위로 편지지가 쏙 나와 있다 (글은 편지지에)
    var paper = el('div', { class: 'fortune-paper' }, close, el('h3', { class: 'fortune-title', text: title }), fortuneBody(c));
    var card = el('div', { class: 'fortune-letter', role: 'dialog', 'aria-label': title },
      el('img', { class: 'fortune-env', src: 'assets/fortune/envelope-open.png', alt: '', draggable: 'false' }), paper);
    var veil = el('div', { class: 'fortune-open' }, card);
    page.append(veil);
    // 창틀의 메모 자리에서 커지며 펼쳐진다
    var fr = from.getBoundingClientRect(), cr = card.getBoundingClientRect();
    var dx = (fr.left + fr.width / 2) - (cr.left + cr.width / 2), dy = (fr.top + fr.height / 2) - (cr.top + cr.height / 2), sc = fr.width / cr.width;
    var start = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') rotate(-6deg)';
    if (card.animate) {
      veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
      card.animate([{ transform: start, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    var shut = function () {
      if (!veil.isConnected) return;
      var done = function () { if (veil._off) veil._off(); veil.remove(); if (onClose) onClose(); };
      if (!card.animate) return done();
      veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      card.animate([{ transform: 'none', opacity: 1 }, { transform: start, opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' })
        .finished.then(done, done);
    };
    close.addEventListener('click', function (e) { e.stopPropagation(); shut(); });
    veil.addEventListener('click', function (e) { if (e.target === veil) shut(); });
    var onKey = function (e) { if (e.key === 'Escape' && veil.isConnected) { e.preventDefault(); shut(); } };
    document.addEventListener('keydown', onKey);
    veil._off = function () { document.removeEventListener('keydown', onKey); };
  }

  /* ---------- 곡선 글씨: 삽화 위에 그려 준 선을 따라 글자를 한 자씩 놓는다 ----------
     lines: 곡선 목록(쪽 기준 0~1 좌표 점들, 부드럽게 이어 그림). head 곡선에는 제목, 나머지에는 본문을 단어 단위로 채운다.
     글이 곡선보다 길면 글씨를 줄여 맞춘다. 쪽 크기가 바뀌면 다시 놓는다. */
  function flatText(body) {
    return body.map(function (para) {
      var parts = Array.isArray(para) ? para : para.parts;
      return parts.map(function (x) { return typeof x === 'string' ? x : x.v; }).join('');
    }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function curveText(page, cv, ct, eyebrowEl) {
    var box = el('div', { class: 'curve-text curve-text--' + (cv.ink || 'dark'), 'aria-label': [ct.head, ct.body].filter(Boolean).join(' ') });
    if (eyebrowEl) {
      eyebrowEl.classList.add('curve-eyebrow');
      eyebrowEl.style.left = cv.eyebrowAt[0] * 100 + '%';
      eyebrowEl.style.top = cv.eyebrowAt[1] * 100 + '%';
      box.append(eyebrowEl);
    }
    var layer = el('div', { class: 'curve-chars', 'aria-hidden': 'true' });
    box.append(layer);
    var measure = document.createElement('canvas').getContext('2d');
    // Catmull-Rom으로 점들을 부드럽게 이어 촘촘한 점 목록으로
    var sample = function (pts, W, H) {
      var P = pts.map(function (q) { return [q[0] * W, q[1] * H]; }), out = [];
      if (P.length === 2) P = [P[0], [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], P[1]];
      for (var i = 0; i < P.length - 1; i++) {
        var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
        for (var k = 0; k < 24; k++) {
          var t = k / 24, t2 = t * t, t3 = t2 * t;
          out.push([0, 1].map(function (j) {
            return 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
          }));
        }
      }
      out.push(P[P.length - 1]);
      var acc = [0];
      for (var m = 1; m < out.length; m++) acc.push(acc[m - 1] + Math.hypot(out[m][0] - out[m - 1][0], out[m][1] - out[m - 1][1]));
      return { pts: out, acc: acc, len: acc[acc.length - 1] };
    };
    var at = function (S, d) {
      var i = 1; while (i < S.acc.length - 1 && S.acc[i] < d) i++;
      var a = S.pts[i - 1], b = S.pts[i], seg = (S.acc[i] - S.acc[i - 1]) || 1, t = Math.min(1, Math.max(0, (d - S.acc[i - 1]) / seg));
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    };
    var family = getComputedStyle(document.body).fontFamily;
    var layout = function () {
      var W = page.clientWidth, H = page.clientHeight;
      if (!W) return;
      layer.replaceChildren();
      var heads = [], bodies = [];
      cv.lines.forEach(function (ln) { (ln.head ? heads : bodies).push(sample(ln.pts, W, H)); });
      // 단어 단위로 곡선에 채워 본다. 마지막 곡선을 넘치면 글씨를 조금씩 줄여 다시 (최대 16번)
      var fill = function (curves, text, fs, font, cls) {
        if (!text || !curves.length) return;
        var words = text.split(' ');
        for (var tries = 0; tries < 16; tries++) {
          measure.font = fs + 'px ' + font;
          var space = measure.measureText(' ').width, li = 0, d = 0, out = [], over = false;
          for (var wi = 0; wi < words.length && !over; wi++) {
            var w = words[wi], ww = measure.measureText(w).width;
            while (d > 0 && d + ww > curves[li].len) {
              if (li === curves.length - 1) { over = true; break; }
              li++; d = 0;
            }
            if (over) break;
            if (d + ww > curves[li].len) { over = true; break; }
            Array.from(w).forEach(function (ch) {
              var cw = measure.measureText(ch).width;
              out.push({ ch: ch, S: curves[li], d: d + cw / 2 }); d += cw;
            });
            d += space;
          }
          if (!over) {
            out.forEach(function (o) {
              var q = at(o.S, o.d), sp = el('span', { class: cls, text: o.ch });
              sp.style.left = q.x + 'px'; sp.style.top = q.y + 'px'; sp.style.fontSize = fs + 'px';
              sp.style.transform = 'translate(-50%, -78%) rotate(' + (q.ang * 180 / Math.PI).toFixed(1) + 'deg)';
              layer.append(sp);
            });
            return;
          }
          fs *= 0.93;
        }
      };
      var base = H * (mode === 'single' && Math.min(window.innerWidth, window.innerHeight) < 600 ? 0.042 : 0.047);
      fill(heads, ct.head, base * 0.8, family, 'cch cch--head');
      fill(bodies, ct.body, base, family, 'cch');
    };
    requestAnimationFrame(function () { requestAnimationFrame(layout); });
    if (window.ResizeObserver) { var last = 0; new ResizeObserver(function () { if (page.clientWidth !== last) { last = page.clientWidth; layout(); } }).observe(page); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    return box;
  }

  /* ---------- 물결 글씨: 삽화의 흐름을 따라 글자가 위아래로 굽이친다 ----------
     글자마다 span으로 나누고, 상자 안 가로 위치(상자 너비 대비)에 따라 sin 곡선만큼 올리고 내린다.
     rise는 오른쪽으로 갈수록 올라가는 정도(cqh). 크기가 바뀌면 다시 계산한다. */
  function waveText(block, w) {
    var chars = [];
    block.querySelectorAll('.story').forEach(function (p) {
      var walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walk.nextNode())) nodes.push(n);
      nodes.forEach(function (t) {
        var frag = document.createDocumentFragment();
        Array.from(t.nodeValue).forEach(function (ch) {
          if (ch === '\n') { frag.append(document.createElement('br')); return; }
          var sp = el('span', { class: 'wch', text: ch });
          chars.push(sp); frag.append(sp);
        });
        t.replaceWith(frag);
      });
    });
    var place = function () {
      var r = block.getBoundingClientRect(), bw = block.clientWidth || 1;
      if (!r.width) return;
      var scale = r.width / bw;
      chars.forEach(function (sp) {
        var x = (sp.getBoundingClientRect().left - r.left) / scale / bw;
        var y = w.amp * Math.sin((x / w.len) * Math.PI * 2 + (w.phase || 0)) + (w.rise || 0) * x;
        sp.style.transform = 'translateY(' + y.toFixed(2) + 'cqh)';
      });
    };
    requestAnimationFrame(function () { requestAnimationFrame(place); });
    if (window.ResizeObserver) new ResizeObserver(function () { place(); }).observe(block);
  }

  /* ---------- 함께 보는 메모: 보드 뒤로 떠다니는 다른 사람들의 메모 ---------- */
  // 아티팩트로 열었을 때만 (js/shared.js). 메모가 없으면 빈 층만 남는다
  var FLOAT_LANES = [
    // 위쪽: 보드 위 벽을 가로질러 천천히 (아래쪽 일부는 보드 뒤로 숨는다). sm: 휴대폰처럼 작은 쪽에서는 더 위로
    { kind: 'across', top: 16, sm: 3, dur: 70 }, { kind: 'across', top: 17.5, sm: 8, dur: 88 }, { kind: 'across', top: 18.5, sm: 12, dur: 96, back: true },
    // 양옆: 보드 가장자리 뒤에서 살짝 고개를 내밀며 위로 (cqh)
    { kind: 'rise', left: -9, dur: 46 }, { kind: 'rise', right: -9, dur: 54 }, { kind: 'rise', left: -11, dur: 62 }, { kind: 'rise', right: -12, dur: 74 }
  ];
  function boardFloat(leaf) {
    var layer = el('div', { class: 'board-float', 'aria-hidden': 'true' });
    var Sh = window.StarSoupShared;
    if (!Sh) return layer;
    // 메모마다 종이 색·테이프 색·크기·기울기를 다르게 (같은 메모라도 지나갈 때마다 조금씩 다르게)
    var PAPERS = [['#fff6d6', '#9a7323'], ['#ffe1ea', '#b0506e'], ['#dff5e8', '#3f8a5e'], ['#dfefff', '#3d6fa8'], ['#ece4ff', '#6e56b0'], ['#ffe6d2', '#b8643a']];
    var TAPES = ['rgb(255 198 90 / 0.8)', 'rgb(150 196 255 / 0.75)', 'rgb(255 160 190 / 0.75)', 'rgb(150 220 170 / 0.75)', 'rgb(200 170 255 / 0.75)'];
    var HEADS = ['친구의 착한 일', '누군가의 착한 일', '오늘의 착한 일', '반짝이는 착한 일'];
    var pool = [], next = 0, turn = 0;
    function fill(card, m) {
      turn++;
      var look = PAPERS[(hash(m.id) + turn) % PAPERS.length];
      var paper = el('div', { class: 'float-paper' + (m.pic ? ' has-pic' : '') },
        el('span', { class: 'memo-tape', style: 'background:' + TAPES[(hash(m.id) * 3 + turn) % TAPES.length] }));
      paper.style.background = look[0];
      if (m.deed || m.pic) paper.append(el('span', { class: 'float-head', text: HEADS[(hash(m.id) + turn) % HEADS.length], style: 'color:' + look[1] }));
      // 꾸민 착한 일 종이(그림 속에 글도 들어 있다)가 있으면 그 그림을, 없으면 글을
      if (m.pic) paper.append(el('img', { class: 'float-pic', src: m.pic, alt: '', draggable: 'false' }));
      else if (m.deed) paper.append(el('span', { class: 'float-text', text: m.deed.length > 34 ? m.deed.slice(0, 33) + '…' : m.deed }));
      if (m.food) {
        var fimg = memoFoodImage(m);
        var fl = el('span', { class: 'float-food' });
        if (fimg) fl.append(el('img', { class: 'float-food-img', src: fimg, alt: '', draggable: 'false' }));
        else if (m.emoji) fl.append(el('span', { text: m.emoji }));
        fl.append(el('span', { text: m.food }));
        paper.append(fl);
      }
      card.replaceChildren(paper);
      card.style.setProperty('--tilt', ((turn % 2 ? 1 : -1) * (2 + (turn * 7) % 6)) + 'deg');
      card.style.setProperty('--size', (0.85 + ((hash(m.id) + turn * 5) % 5) * 0.07).toFixed(2));
    }
    function hash(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973; return h; }
    // 다음에 띄울 메모: 지금 다른 길에 떠 있는 메모는 되도록 피해서, 모든 메모가 골고루 돌아가며 나온다
    function take(layerCards) {
      var showing = {};
      layerCards.forEach(function (c) { if (c._memo) showing[c._memo.id] = (showing[c._memo.id] || 0) + 1; });
      for (var k = 0; k < pool.length; k++) {
        var m = pool[(next + k) % pool.length];
        if (!showing[m.id]) { next = (next + k + 1) % pool.length; return m; }
      }
      var m2 = pool[next % pool.length]; next = (next + 1) % pool.length; return m2;
    }
    function paint(list) {
      if (!layer.isConnected && layer._painted) return;
      layer._painted = true;
      // 매번 순서를 섞어, 열 때마다 다른 메모부터 보이게
      pool = list.slice().sort(function () { return Math.random() - 0.5; });
      next = 0;
      layer.replaceChildren();
      if (!pool.length) return;
      // 길 수: 메모가 적으면 같은 메모가 줄줄이 반복되지 않게 길을 줄인다 (메모 1장 → 2길, 2장 → 4길 … 최대 7길)
      var lanes = Math.min(FLOAT_LANES.length, Math.max(2, pool.length * 2));
      var cards = [];
      for (var i = 0; i < lanes; i++) {
        var lane = FLOAT_LANES[i];
        var card = el('div', { class: 'float-memo float-memo--' + lane.kind + (lane.back ? ' is-back' : '') });
        cards.push(card);
        var m = take(cards); card._memo = m; fill(card, m);
        card.style.setProperty('--dur', lane.dur + 's');
        card.style.setProperty('--delay', -(lane.dur * ((i * 0.37) % 1)).toFixed(1) + 's');
        card.style.setProperty('--bob', (5 + (i * 3) % 4) + 's');
        if (lane.top != null) { card.style.setProperty('--top', lane.top + 'cqh'); card.style.setProperty('--top-sm', lane.sm + 'cqh'); }
        if (lane.left != null) card.style.left = lane.left + 'cqh';
        if (lane.right != null) card.style.right = lane.right + 'cqh';
        // 화면 밖으로 나갔다가 다시 들어올 때마다 다른 메모로 바꿔 단다
        card.addEventListener('animationiteration', function (e) {
          if (e.target !== e.currentTarget) return;
          var c = e.currentTarget; c._memo = null;
          var nm = take(cards); c._memo = nm; fill(c, nm);
        });
        layer.append(card);
      }
    }
    paint(Sh.memos());
    leaf._teardown.push(Sh.onChange(paint));
    return layer;
  }

  // 쪽 안 그림판의 바탕색을 화면에 바로 칠한다
  function paintPadBg(leaf, key) {
    var c = state.padBg[key] || '';
    // 보드: 고른 색(없으면 원래 청록) 위에 크레용 결(06-board-crayon.png)을 얹어, 어떤 색이어도 같은 질감
    if (key === IMG_BOARD && leaf._boardTint) leaf._boardTint.style.backgroundColor = c || '#c4eade';
    if (key === IMG_TASTE) leaf.querySelectorAll('.tdraw-paper').forEach(function (p) { p.style.background = c; });
  }

  // 내 메모 올리기: 착한 일 글 + (꾸민 착한 일 종이가 있으면) 그 그림 + 고른 음식 (직접 그렸으면 그 그림)
  // 그림은 작게 줄여서(가로세로 최대 240px) 함께 보낸다
  function thumb(src, max, opaque) {
    return new Promise(function (resolve) {
      if (!src) return resolve('');
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
        var g = cv.getContext('2d');
        if (opaque) { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, cv.width, cv.height); }
        g.drawImage(im, 0, 0, cv.width, cv.height);
        var out = cv.toDataURL(opaque ? 'image/jpeg' : 'image/webp', 0.8);
        if (!opaque && out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/png');   // webp를 못 만드는 브라우저
        resolve(out.length < 150000 ? out : '');
      };
      im.onerror = function () { resolve(''); };
      im.src = src;
    });
  }
  function shareMyMemo(c) {
    var f = c.food;
    Promise.all([thumb(images[IMG_DEED], 240, true), f && f.custom ? thumb(images[IMG_FOOD], 160, false) : '']).then(function (pics) {
      window.StarSoupShared.share({
        deed: c.deed, food: f ? (f.name || '') : '', emoji: f && !f.custom ? (f.emoji || '') : '',
        foodId: f && !f.custom ? f.id : '', pic: pics[0], foodPic: pics[1]
      });
    });
  }
  // 떠다니는 메모에 쓸 음식 그림: 고른 음식이면 그 음식 그림, 직접 그렸으면 그 사람이 그린 그림
  function memoFoodImage(m) {
    if (m.foodPic) return m.foodPic;
    var f = m.foodId && S.foods.find(function (x) { return x.id === m.foodId; });
    return f ? f.image : '';
  }

  /* ---------- 쪽 위의 입력 도구 ---------- */
  function widget(name, c, leaf, index) {
    switch (name) {
      case 'food-result': return foodResult(c);
      case 'board-draw': return drawPad(leaf, { key: IMG_BOARD, title: '보드에 그림 그리기', clear: true,
        tip: '메모지는 끌어서 옮기고, 노란 손잡이로 크기를 바꿀 수 있어요.' });
      case 'deed-hint': return images[IMG_DEED]
        ? el('p', { class: 'hint sticker-hint pg-hint' }, '꾸민 착한 일 종이를 끌어서 원하는 곳에 옮겨 보세요.')
        : null;
      case 'taste': return tasteCarousel();
      case 'soup-ingredients': return soupIngredients(false);
      case 'soup-scoop': return soupScoop();
      case 'soup-ui': return mode === 'spread' && !printing ? inlineAsk('soup') : null;
      case 'taste-ui': return mode === 'spread' && !printing ? inlineAsk('taste') : null;
      case 'taste-draw': return state.taste === 'custom' ? drawPad(leaf, { key: IMG_TASTE, title: '무슨 맛이 났는지 그리기', clear: true, paper: true }) : null;
      // #8: 꾸민 착한 일 종이(메모지)를 스프가 놓인 식탁 한구석에
      case 'deed-note': return images[IMG_DEED]
        ? el('div', { class: 'soup-note', 'aria-label': '꾸민 착한 일 종이' }, el('img', { src: images[IMG_DEED], alt: '' }))
        : null;
      case 'recap': return recap(c);
    }
    return null;
  }

  // 그림 속 이름표 앞면에 바로 이름을 쓴다 (종이책에서는 이 자리가 빈칸으로 남아 손으로 쓴다)
  function nameplateInput(leaf, box) {
    // PDF 저장본: 입력칸 대신 적은 이름을 글자로 (html2canvas가 입력칸 글자를 제대로 못 그림)
    if (printing) {
      var np = el('div', { class: 'nameplate-input nameplate-print', text: state.name.trim() });
      np.style.left = box.x * 100 + '%'; np.style.top = box.y * 100 + '%';
      np.style.width = box.w * 100 + '%'; np.style.height = box.h * 100 + '%';
      np.style.setProperty('--r', (box.r || 0) + 'deg');
      return np;
    }
    var input = el('input', {
      class: 'nameplate-input', id: 'input-name', type: 'text', maxlength: S.limits.name,
      placeholder: printing ? '' : '여기에 이름을 써요', autocomplete: 'off', enterkeyhint: 'done',
      'aria-label': '나의 이름 (비워 두면 이야기 속에서 ‘당신’이라고 불러요)'
    });
    input.style.left = box.x * 100 + '%';
    input.style.top = box.y * 100 + '%';
    input.style.width = box.w * 100 + '%';
    input.style.height = box.h * 100 + '%';
    input.style.setProperty('--r', (box.r || 0) + 'deg');
    input.value = state.name;
    input.addEventListener('input', function () {
      state.name = input.value.slice(0, S.limits.name);
      paintAuthor();
      updateControls();
      saveSoon();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); }
    });
    return input;
  }

  function tile(opts) {
    var art = el('span', { class: 'tile-art', 'aria-hidden': 'true' });
    if (opts.glow) art.style.setProperty('--glow', opts.glow);
    if (opts.bg) art.style.background = opts.bg;
    var fallback = el('span', { class: 'tile-emoji', text: opts.emoji });
    art.append(fallback);
    if (opts.image) {
      var img = el('img', { alt: '' });
      img.onload = function () { fallback.remove(); };
      img.onerror = function () { img.remove(); };
      img.src = opts.image;
      art.append(img);
    }
    return el('button', {
      type: 'button', class: 'tile' + (opts.extra ? ' ' + opts.extra : ''),
      'aria-pressed': opts.pressed ? 'true' : 'false', 'data-id': opts.id,
      onclick: opts.onclick
    }, art, el('span', { class: 'tile-label', text: opts.label }),
      el('span', { class: 'check', 'aria-hidden': 'true' }, svgCheck()));
  }

  function svgCheck() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  function markPressed(grid, id) {
    grid.querySelectorAll('.tile').forEach(function (t) {
      t.setAttribute('aria-pressed', t.getAttribute('data-id') === id ? 'true' : 'false');
    });
  }

  // 음식 카드 격자 ('음식 고르기' 화면). 그림 위를 가리지 않도록 책 밖 화면에 둔다.
  function foodGrid() {
    var grid = el('div', { class: 'grid grid--food choice-grid', role: 'group', 'aria-label': '음식 고르기' });
    S.foods.forEach(function (f) {
      grid.append(tile({
        id: f.id, label: f.name, image: f.image, emoji: f.emoji, glow: f.glow, pressed: state.food === f.id,
        onclick: function () { pickFood(f.id); }
      }));
    });
    // 직접 그리기: 그림이 있으면 그 그림이 카드가 되고, 고른 상태에서 한 번 더 누르면 다시 그린다
    var has = !!images[IMG_FOOD];
    grid.append(tile({
      id: 'custom', extra: 'tile--draw' + (has ? ' has-art' : ''),
      label: has ? (state.customFoodName.trim() || S.customFood.fallbackName) : S.customFood.label,
      image: images[IMG_FOOD], emoji: '✏️', glow: '#3a4a7a', pressed: state.food === 'custom',
      onclick: function () {
        if (!images[IMG_FOOD] || state.food === 'custom') drawFood();
        else pickFood('custom');
      }
    }));
    return grid;
  }

  function foodResult(c) {
    var f = c.food;
    // 노란 빈자리 위에 상자 없이 진한 글씨로
    return el('div', { class: 'pg-text is-panel is-ink reveal' + (f ? '' : ' is-empty'), 'aria-live': 'polite' },
      el('p', { class: 'eyebrow', text: f ? '한입 냠, ' + f.name : '음식을 고르면' }),
      el('p', { class: 'story story--sm', text: f ? f.desc : '아직 먹고 싶은 음식을 고르지 않았어요.' }),
      f ? null
        : el('button', { type: 'button', class: 'btn btn-soft btn-small', text: '음식 고르러 가기', onclick: function () { showAsk('food', -1); } }));
  }

  function foodStickerHint() {
    var where = foodStickerScene();
    if (!where) return '스티커가 나타나면 끌어서 원하는 곳에 붙여 보세요.';
    if (where !== 'food') return '고른 음식 스티커는 다음 장면에 붙어 있어요.';
    return '스티커를 끌어서 원하는 곳에 붙여 보세요. 모서리를 끌면 크기와 방향이 바뀌어요.';
  }

  function pickFood(id) {
    var changed = state.food !== id;
    var snd = window.StarSoupSound; if (snd && snd.pick) snd.pick(id);   // 음식마다 다른 소리
    state.food = id;
    var grid = document.getElementById('food-choice-grid');
    if (grid) markPressed(grid, id);
    paintAskNote();
    // 이미 붙인 스티커가 있으면 그 자리에서 그림만 바뀐다 (스티커는 #4 첫 쪽에 나타난다)
    if (changed) saveSoon();
  }

  function drawFood() {
    window.StarSoupEditor.open({
      title: '음식 그리기', image: images[IMG_FOOD], askName: true, name: state.customFoodName, noBg: true
    }).then(function (res) {
      if (!res) return;
      state.customFoodName = res.name.slice(0, S.limits.foodName);
      saveImage(IMG_FOOD, res.image);
      state.food = 'custom';
      if (askId === 'food') paintAsk();   // 카드에 내 그림이 보이도록
      saveNow();
    });
  }

  function deedInput() {
    var area = el('textarea', {
      class: 'input', id: 'input-deed', maxlength: S.limits.deed, rows: 2,
      placeholder: '예: 동생에게 장난감을 양보했어요', 'aria-labelledby': 'ask-text'
    });
    area.value = state.deed;
    var counter = el('span', { class: 'counter' });
    function count() { counter.textContent = area.value.length + ' / ' + S.limits.deed; }
    count();
    area.addEventListener('input', function () {
      state.deed = area.value.slice(0, S.limits.deed);
      count();
      saveSoon();
    });
    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': '착한 일 예시' },
      S.deedExamples.map(function (ex) {
        return el('button', {
          type: 'button', class: 'chip', text: ex,
          onclick: function () { area.value = ex; state.deed = ex; count(); saveSoon(); }
        });
      }));
    return el('div', { class: 'ask-deed' }, el('div', { class: 'field' }, area, el('div', { class: 'field-foot' }, el('span'), counter)), chips);
  }

  /* ---------- 맛 고르기 회전 카드 (#9 16쪽) ----------
     가운데 카드는 앞에 크게, 좌우 카드는 살짝 뒤로 비스듬히. 옆으로 밀거나 ‹ › 를 누르면 원을 그리듯 돈다.
     옆 카드를 누르면 가운데로 오고, 가운데 카드를 누르면 그 맛을 고른다. */
  // 무슨 맛이 났나요? 회전 카드. 가운데 카드가 곧 고른 맛. 마지막 카드는 '직접 그리기'
  function tasteCarousel() {
    var hasArt = !!images[IMG_TASTE];
    var list = S.tastes.concat([{ id: 'custom', label: S.customTaste.label,
      emoji: '✏️', glow: '#3a4a7a', art: images[IMG_TASTE] || null, draw: true }]);
    var n = list.length;
    var focus = Math.max(0, list.findIndex(function (t) { return t.id === state.taste; }));
    var stage = el('div', { class: 'carousel-stage' });
    var cards = list.map(function (t, i) {
      var art = el('span', { class: 'c-art', 'aria-hidden': 'true' });
      art.style.setProperty('--glow', t.glow);
      var emoji = el('span', { class: 'c-emoji', text: t.emoji });
      art.append(emoji);
      var src = t.art || t.image;
      if (src) {
        var img = el('img', { alt: '' });
        img.onload = function () { emoji.remove(); };
        img.onerror = function () { img.remove(); };
        img.src = src;
        art.append(img);
      }
      var card = el('button', { type: 'button', class: 'c-card' + (t.draw ? ' c-card--draw' + (t.art ? ' has-art' : '') : ''), 'data-id': t.id, 'aria-label': t.label },
        art, el('span', { class: 'c-label', text: t.label }),
        el('span', { class: 'check', 'aria-hidden': 'true' }, svgCheck()));
      card.addEventListener('click', function () {
        if (Date.now() - swipedAt < 350) return;    // 밀어서 돌린 직후의 클릭은 무시
        if (i !== focus) { turnTo(i); return; }
        card.animate([{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], { duration: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        updateControls();
        saveSoon();
      });
      stage.append(card);
      return card;
    });
    var relOf = function (i) { var rel = ((i - focus) % n + n) % n; if (rel > n / 2) rel -= n; return rel; };
    function apply() {
      // 가운데(보고 있는) 카드가 곧 고른 맛. '직접 그리기'도 다른 카드처럼 고르기만 하고, 그림은 16쪽 위에 바로 그린다
      var t = list[focus];
      state.taste = t.id;
      cards.forEach(function (card, i) {
        var rel = relOf(i);
        card.setAttribute('data-pos', rel);
        card.setAttribute('aria-pressed', state.taste === list[i].id ? 'true' : 'false');
        card.tabIndex = rel === 0 ? 0 : -1;
      });
      var wrapEl = box.closest && box.closest('.ask-taste');
      var nameField = wrapEl ? wrapEl.querySelector('.taste-name-field') : document.querySelector('#ask-body .taste-name-field');
      if (nameField) {
        var on = t.id === 'custom';
        nameField.classList.toggle('is-on', on);
        nameField.setAttribute('aria-hidden', on ? 'false' : 'true');
        nameField.querySelector('input').tabIndex = on ? 0 : -1;
      }
      paintAskNote();
      saveSoon();
    }
    // 돌릴 때: 지금 모습 → 새 자리로 직접 움직인다 (CSS 전환에 맡기지 않아 어느 기기에서나 부드럽게)
    // 뒤를 돌아 반대편으로 가는 카드는 뒤로 작아지며 사라졌다가 반대편에서 나타난다
    var moving = [];
    function turnTo(i) {
      if (i === focus) return;
      var before = cards.map(function (c) { var cs = getComputedStyle(c); return { t: cs.transform, o: cs.opacity, f: cs.filter, rel: Number(c.getAttribute('data-pos')) }; });
      moving.forEach(function (a) { a.cancel(); });
      moving = [];
      focus = i;
      apply();
      // 가운데로 온 맛 카드마다 다른 소리 (은하수: 사르르 화음, 별빛: 톡톡 불꽃, 구름: 후— 바람, 직접 그리기: 사각사각)
      var snd = window.StarSoupSound; if (snd && snd.taste) snd.taste(list[focus].id);
      cards.forEach(function (c, k) {
        if (!c.animate) return;
        var cs = getComputedStyle(c), to = { t: cs.transform, o: cs.opacity, f: cs.filter }, from = before[k];
        if (from.t === to.t && from.o === to.o) return;
        var jump = Math.abs(from.rel - Number(c.getAttribute('data-pos'))) > 1;
        var frames = jump
          ? [{ transform: from.t, opacity: from.o, filter: from.f },
             { transform: from.t + ' scale(0.8)', opacity: 0, filter: from.f, offset: 0.45 },
             { transform: to.t + ' scale(0.8)', opacity: 0, filter: to.f, offset: 0.55 },
             { transform: to.t, opacity: to.o, filter: to.f }]
          : [{ transform: from.t, opacity: from.o, filter: from.f }, { transform: to.t, opacity: to.o, filter: to.f }];
        moving.push(c.animate(frames, { duration: 620, easing: 'cubic-bezier(.25,.8,.25,1)' }));
      });
    }
    function turn(d) { turnTo((focus + d + n) % n); }
    var prevBtn = el('button', { type: 'button', class: 'c-nav c-nav--prev', 'aria-label': '이전 맛', onclick: function () { turn(-1); } }, '‹');
    var nextBtn = el('button', { type: 'button', class: 'c-nav c-nav--next', 'aria-label': '다음 맛', onclick: function () { turn(1); } }, '›');
    var box = el('div', { class: 'carousel', role: 'group', 'aria-label': '스프의 맛 고르기 (옆으로 넘기면 가운데에 보이는 맛이 골라져요)' }, stage, prevBtn, nextBtn);

    // 카드 위에서 옆으로 밀면 돈다 (책장은 넘어가지 않음)
    var swipe = null, swipedAt = 0;
    box.addEventListener('pointerdown', function (e) { swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
    box.addEventListener('pointerup', function (e) {
      if (!swipe || e.pointerId !== swipe.id) return;
      var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) { swipedAt = Date.now(); turn(dx < 0 ? 1 : -1); }
    });
    box.addEventListener('pointercancel', function () { swipe = null; });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); turn(e.key === 'ArrowLeft' ? -1 : 1); cards[focus].focus(); }
    });
    apply();
    return box;
  }

  /* ---------- #9 16쪽: '직접 그리기' 맛 ----------
     맛 카드에서 '직접 그리기'를 고르면 16쪽(삽화 옆 쪽)에 음식 그리기와 같은 그림판이 그대로 놓인다.
     따로 창을 열거나 버튼을 누르지 않고 그 쪽에서 바로 그리며, 손을 뗄 때마다 저장된다. */
  function drawPad(leaf, o) {
    // PDF로 저장할 때는 그림판 대신 저장된 그림만
    if (printing) {
      var ph = el('div', { class: 'tdraw-host' });
      if (o.paper) ph.append(el('img', { class: 'pdf-fill', src: fadedSheet(state.padBg[o.key] || '#fdfaf4'), alt: '' }));
      if (images[o.key]) ph.append(el('img', { class: 'pdf-fill', src: images[o.key], alt: '' }));
      return ph;
    }
    var host = el('div', { class: 'tdraw-host' });
    // 바탕 종이를 그림판과 따로 깔면, 종이만 서서히 나타나게 하고 그린 선은 어디서나 또렷하게 보인다 (#9 16쪽)
    if (o.paper) host.append(el('div', { class: 'tdraw-paper', 'aria-hidden': 'true', style: state.padBg[o.key] ? 'background:' + state.padBg[o.key] : null }));
    var mounted = false;
    var dock = null;
    var mount = function () {
      if (mounted || !host.isConnected) return;
      mounted = true;
      // 쪽 전체가 그림판, 도구는 캔버스 밖(책 아래)으로. 세로 화면은 여러 줄, 펼침 화면은 가로 한 줄로.
      // 도구가 차지하는 높이만큼 책을 줄여 한 화면에 함께 들어가게 한다
      // 가로로 돌린 휴대폰(높이가 낮은 화면)은 아래에 두면 책이 너무 작아지므로 책 옆에 세로 줄로 (아이패드처럼 책을 크게)
      var side = mode === 'spread' && window.innerHeight < 520;
      dock = el('div', { class: 'tdraw-dock' + (side ? ' is-side' : mode === 'spread' ? ' is-row' : ''), role: 'toolbar', 'aria-label': '그리기 도구' });
      var stageEl = book.parentNode;
      stageEl.insertBefore(dock, book.nextSibling);
      stageEl.classList.add('has-dock');
      stageEl.classList.toggle('has-side-dock', side);
      var fitDock = function () {
        if (!dock.isConnected) return;
        if (side) stageEl.style.setProperty('--dock-w', (dock.offsetWidth + 12) + 'px');
        else stageEl.style.setProperty('--dock-h', (dock.offsetHeight + 12) + 'px');
      };
      if (dock.animate) dock.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (window.ResizeObserver) { var dro = new ResizeObserver(fitDock); dro.observe(dock); leaf._teardown.push(function () { dro.disconnect(); }); }
      requestAnimationFrame(fitDock);
      window.StarSoupEditor.open({
        inline: host, dock: dock, aspect: 297 / 210, title: o.title, base: images[o.key], clear: o.clear,
        onChange: function (data) { saveImage(o.key, data); },
        // 바탕색: 보드는 안쪽 판 색이, 16쪽은 종이 색이 바로 바뀐다 (그림에 굽지 않고 따로 저장)
        bg: state.padBg[o.key] || null,
        onBg: function (c) {
          if (c) state.padBg[o.key] = c; else delete state.padBg[o.key];
          saveNow();
          paintPadBg(leaf, o.key);
        }
      });
      if (o.tip) setTimeout(function () { if (host.isConnected) toast(o.tip, 3600); }, 400);
    };
    // 쪽이 화면에 붙은 뒤에 그림판을 옮겨 온다 (한 쪽씩 보기에서는 16쪽을 볼 때만)
    var visible = function () { return mode === 'spread' || state.page === 1; };
    requestAnimationFrame(function () { if (visible()) mount(); });
    leaf._mountTaste = function () { if (visible()) mount(); };
    leaf._teardown.push(function () {
      if (mounted) window.StarSoupEditor.unmount(host);
      if (dock) {
        dock.remove();
        if (!document.querySelector('.tdraw-dock')) {
          book.parentNode.classList.remove('has-dock', 'has-side-dock');
          book.parentNode.style.removeProperty('--dock-h');
          book.parentNode.style.removeProperty('--dock-w');
        }
      }
    });
    return host;
  }

  // 별빛스프 재료 스티커들. editable이면 요리 화면에서 끌어 옮기고 뗄 수 있다.
  function soupIngredients(editable) {
    var box = el('div', { class: 'soup-ings' + (editable ? ' is-editable' : ''), 'aria-label': '별빛스프에 넣은 재료' });
    state.soup.forEach(function (g) {
      var src = images['soup-' + g.id];
      var item = el('div', { class: 'soup-ing', 'data-id': g.id },
        el('div', { class: 'soup-ing-art' }, src ? el('img', { src: src, alt: '', draggable: 'false' }) : el('span', { text: '✨' })),
        el('span', { class: 'soup-ing-name', text: g.name || '비밀 재료' }));
      item.style.left = g.u * 100 + '%';
      item.style.top = g.v * 100 + '%';
      item.style.width = g.w * 100 + '%';
      item.style.setProperty('--r', g.r + 'deg');
      if (editable) {
        var del = el('button', { type: 'button', class: 'st-del', 'aria-label': (g.name || '재료') + ' 빼기' }, '×');
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          state.soup = state.soup.filter(function (x) { return x.id !== g.id; });
          state.soupStirs = 0;
          delete images['soup-' + g.id];
          store.deleteImage('soup-' + g.id).catch(function () {});
          saveNow();
          refreshAskUI();
        });
        item.append(del, el('span', { class: 'st-handle ing-handle', 'aria-hidden': 'true' }));
        // 끌면 옮기고, 노란 손잡이를 끌거나 두 손가락으로 벌리면 크기·방향이 바뀐다
        var touches = {}, drag = null, pinch = null;
        var place = function () {
          item.style.left = g.u * 100 + '%';
          item.style.top = g.v * 100 + '%';
          item.style.width = g.w * 100 + '%';
          item.style.setProperty('--r', g.r + 'deg');
        };
        var count = function () { return Object.keys(touches).length; };
        item.addEventListener('pointerdown', function (e) {
          if (e.target.closest('.st-del')) return;
          e.preventDefault();
          try { item.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
          touches[e.pointerId] = { x: e.clientX, y: e.clientY };
          item.classList.add('is-dragging');
          var r = box.getBoundingClientRect();
          var cx = r.left + g.u * r.width, cy = r.top + g.v * r.height;
          if (count() === 2) {
            var ids = Object.keys(touches), p1 = touches[ids[0]], p2 = touches[ids[1]];
            pinch = { d: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, a: Math.atan2(p2.y - p1.y, p2.x - p1.x), w: g.w, r: g.r };
            drag = null;
            return;
          }
          if (count() > 2) return;
          drag = { id: e.pointerId, r: r, handle: !!e.target.closest('.ing-handle'), cx: cx, cy: cy,
            dx: e.clientX - cx, dy: e.clientY - cy,
            d: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, a: Math.atan2(e.clientY - cy, e.clientX - cx), w: g.w, r0: g.r };
        });
        item.addEventListener('pointermove', function (e) {
          if (!touches[e.pointerId]) return;
          touches[e.pointerId] = { x: e.clientX, y: e.clientY };
          if (pinch && count() >= 2) {
            var ids = Object.keys(touches), p1 = touches[ids[0]], p2 = touches[ids[1]];
            g.w = clamp(pinch.w * Math.hypot(p2.x - p1.x, p2.y - p1.y) / pinch.d, 0.06, 0.4);
            g.r = Math.round(pinch.r + (Math.atan2(p2.y - p1.y, p2.x - p1.x) - pinch.a) * 180 / Math.PI);
          } else if (drag && e.pointerId === drag.id) {
            if (drag.handle) {
              g.w = clamp(drag.w * Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) / drag.d, 0.06, 0.4);
              g.r = Math.round(drag.r0 + (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a) * 180 / Math.PI);
            } else {
              g.u = clamp((e.clientX - drag.dx - drag.r.left) / drag.r.width, 0.05, 0.95);
              g.v = clamp((e.clientY - drag.dy - drag.r.top) / drag.r.height, 0.06, 0.94);
            }
          } else return;
          if (g.r > 180) g.r -= 360;
          if (g.r < -180) g.r += 360;
          place();
        });
        var end = function (e) {
          if (!touches[e.pointerId]) return;
          delete touches[e.pointerId];
          if (count() < 2) pinch = null;
          if (drag && drag.id === e.pointerId) drag = null;
          if (!count()) { item.classList.remove('is-dragging'); saveSoon(); }
        };
        item.addEventListener('pointerup', end);
        item.addEventListener('pointercancel', end);
      }
      box.append(item);
    });
    return box;
  }

  // 재료를 하나 더 넣는다: 이름을 적고 직접 그린다 (최대 5개)
  function addIngredient() {
    if (state.soup.length >= S.limits.ingredients) { toast('재료는 다섯 개까지 넣을 수 있어요.'); return; }
    window.StarSoupEditor.open({
      title: '별빛스프 재료 그리기', askName: true, name: '',
      nameLabel: '어떤 재료인가요?', namePlaceholder: '예: 별사탕', allowNameOnly: true, noBg: true
    }).then(function (res) {
      if (!res) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      // 그릇 안 빈자리에 놓는다 (스프 그림의 그릇은 가운데, 반지름 약 0.33)
      var n = state.soup.length, a = n * 2.4 + 0.6, rr = n ? 0.2 : 0.05;
      state.soup.push({ id: id, name: res.name.slice(0, S.limits.ingredient), u: 0.5 + Math.cos(a) * rr * 0.72, v: 0.51 + Math.sin(a) * rr, w: 0.15, r: Math.round(Math.random() * 24 - 12) });
      if (res.image) saveImage('soup-' + id, res.image);
      state.soupStirs = 0;   // 새 재료를 넣었으니 다시 저어야 한다
      saveNow();
      refreshAskUI();
      setTimeout(function () { sfx('plop'); }, 120);   // 퐁당
    });
  }

  function recap(c) {
    function row(label, value, sceneIndex, page, emptyText, open) {
      return el('div', { class: 'recap-row' },
        el('dt', { text: label }),
        el('dd', { class: value ? '' : 'is-empty', text: value || emptyText }),
        el('button', {
          type: 'button', class: 'link-btn', text: '고치기', 'aria-label': label + ' 고치기',
          onclick: function () { state.returnTo = LAST; if (open) open(); else go(sceneIndex, page); }
        }));
    }
    return el('div', { class: 'pg-text is-panel recap' },
      el('h2', { text: c.you + '의 별빛스프 이야기' }),
      el('dl', null,
        row('때', c.time && c.time.label, 0, 0, '고르지 않았어요', function () { showAsk('time', -1); }),
        row('날씨', c.weather && c.weather.label, 0, 0, '고르지 않았어요', function () { showAsk('weather', -1); }),
        row('이름', c.name, sceneIndex('name'), 1, '아직 비어 있어요'),
        row('고른 음식', c.food && c.food.name, sceneIndex('food'), 0, '고르지 않았어요', function () { showAsk('food', -1); }),
        row('착한 일', c.deed, sceneIndex('deed'), 1, '비워 두었어요', function () { showAsk('deed', -1); }),
        row('스프 재료', state.soup.map(function (g) { return g.name || '비밀 재료'; }).join(', '), sceneIndex('soup'), 0, '넣지 않았어요', function () { showAsk('soup', -1); }),
        row('스프의 맛', c.taste && c.taste.label, sceneIndex('taste'), 1, '고르지 않았어요', function () { showAsk('taste', -1); })));
  }

  /* ---------- 스티커 ----------
     위치는 펼침면 기준 비율(0~1)로 저장해서 화면 크기·모드가 바뀌어도 같은 자리에 붙어 있다. */
  function findSticker(sceneId, kind) {
    return (state.stickers[sceneId] || []).find(function (s) { return s.kind === kind; }) || null;
  }

  function stickerSource(st) {
    var f = ctx().food;
    if (st.kind === 'deed') {
      if (images[IMG_DEED]) return { image: images[IMG_DEED], paper: true, label: '내가 꾸민 착한 일 종이' };
      var d = state.deed.trim();
      return d ? { memo: true, head: '내가 한 착한 일', text: d, label: '착한 일 메모지' } : null;
    }
    if (st.kind === 'favfood') {
      if (!f) return null;
      return { memo: true, head: '가장 좋아하는 음식!', image: f.custom ? images[IMG_FOOD] : f.image, emoji: f.emoji, text: f.name, label: '가장 좋아하는 음식 메모지' };
    }
    if (!f) return null;
    return { image: f.custom ? images[IMG_FOOD] : f.image, emoji: f.emoji, label: f.name + ' 스티커' };
  }

  // 음식 스티커가 붙어 있는 장면 id (없으면 null)
  function foodStickerScene() {
    var ids = Object.keys(state.stickers);
    for (var i = 0; i < ids.length; i++) if (findSticker(ids[i], 'food')) return ids[i];
    return null;
  }

  function repaintFoodStickers() {
    var leaf = currentLeaf();
    if (leaf) paintStickers(leaf);
    var hint = leaf && leaf.querySelector('.sticker-hint');
    if (hint) hint.textContent = foodStickerHint();
  }

  // 음식을 고른 화면에서 다음 화면으로 넘기면, 도착한 화면에 스티커가 톡 나타난다
  // (한 쪽씩 보기: #4 오른쪽 쪽 / 펼침면: #5 요정 장면)
  // 음식 스티커는 '음식 고르기' 화면에서 고른 뒤 #4 펼침면이 열릴 때 첫 쪽(5쪽)에 톡 나타난다
  function spawnFoodSticker(delay) {
    if (!state.food || foodStickerScene()) return;
    var spot = S.stickerSpots.food;
    var st = { kind: 'food', x: spot.x, y: spot.y, w: spot.w, r: spot.r };
    (state.stickers.food = state.stickers.food || []).push(st);
    saveNow();
    var leaf = currentLeaf();
    setTimeout(function () {
      if (!leaf || !leaf.isConnected || leaf.classList.contains('is-leaving') || leaf._sceneId !== 'food') return;
      paintStickers(leaf);
      var hint = leaf.querySelector('.sticker-hint');
      if (hint) hint.textContent = foodStickerHint();
      var node = leaf._stickers.querySelector('[data-kind="food"]');
      if (!node) return;
      if (mode === 'spread') selectSticker(leaf, node);
      node.querySelector('.st-body').animate([
        { transform: 'scale(.2) rotate(-25deg)', opacity: 0 },
        { transform: 'scale(1.18) rotate(8deg)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 }
      ], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
      toast('고른 음식이 스티커가 되었어요! 끌어서 붙여 보세요.');
    }, delay || 0);
  }

  function paintStickers(leaf) {
    var layer = leaf._stickers;
    layer.replaceChildren();
    (state.stickers[leaf._sceneId] || []).forEach(function (st) {
      var src = stickerSource(st);
      if (!src) return;
      if (src.paper || src.memo) { layer.append(paperSticker(leaf, st, src)); return; }
      var body = el('div', { class: 'st-body' });
      var emoji = el('span', { class: 'st-emoji', text: src.emoji });
      body.append(emoji);
      if (src.image) {
        var img = el('img', { alt: '', draggable: 'false' });
        img.onload = function () { emoji.remove(); };
        img.onerror = function () { img.remove(); };
        img.src = src.image;
        body.append(img);
      }
      var node = el('div', {
        class: 'sticker', tabindex: '0', role: 'img', 'aria-label': src.label + ' (끌어서 옮기기, Delete 키로 떼기)', 'data-kind': st.kind
      }, body,
        el('button', { type: 'button', class: 'st-del', 'aria-label': '스티커 떼기' }, '×'),
        el('span', { class: 'st-handle', 'aria-hidden': 'true' }));
      node._st = st;
      positionSticker(node);
      bindSticker(leaf, node);
      layer.append(node);
    });
  }

  // 메모지: 착한 일 종이(꾸민 그림) 또는 글 메모지(착한 일·좋아하는 음식). 옮기고, 노란 손잡이·두 손가락으로 크기와 방향을 바꾼다
  function paperSticker(leaf, st, src) {
    var body;
    if (src.paper) {
      body = el('figure', { class: 'st-body paper-body' },
        el('img', { src: src.image, alt: '', draggable: 'false' }),
        el('figcaption', { text: '내가 한 착한 일' }));
    } else {
      body = el('div', { class: 'st-body memo-body' + (st.kind === 'favfood' ? ' memo-body--food' : '') },
        el('span', { class: 'memo-tape', 'aria-hidden': 'true' }),
        el('span', { class: 'memo-head', text: src.head }));
      if (src.image || src.emoji) {
        var pic = el('span', { class: 'memo-pic' });
        if (src.image) pic.append(el('img', { src: src.image, alt: '', draggable: 'false' }));
        else pic.append(el('span', { class: 'memo-emoji', text: src.emoji }));
        body.append(pic);
      }
      body.append(el('span', { class: 'memo-text', text: src.text }));
    }
    var node = el('div', {
      class: 'sticker sticker--paper', tabindex: '0', role: 'img', 'data-kind': st.kind,
      'aria-label': src.label + ' (끌어서 옮기기, 노란 손잡이로 크기 바꾸기)'
    }, body, el('span', { class: 'st-handle', 'aria-hidden': 'true' }));
    node._st = st;
    positionSticker(node);
    bindSticker(leaf, node);
    return node;
  }

  // #6 10쪽 보드: 착한 일 메모지와 '가장 좋아하는 음식!' 메모지를 붙여 둔다 (처음 한 번 자리 잡기)
  function ensureBoardStickers() {
    var list = state.stickers.deed || (state.stickers.deed = []);
    [['deed', S.stickerSpots.boardDeed], ['favfood', S.stickerSpots.boardFood]].forEach(function (k) {
      if (!findSticker('deed', k[0])) list.push({ kind: k[0], x: k[1].x, y: k[1].y, w: k[1].w, r: k[1].r });
    });
  }
  function ensureDeedSticker() { ensureBoardStickers(); }

  function positionSticker(node) {
    var st = node._st;
    node.style.left = st.x * 100 + '%';
    node.style.top = st.y * 100 + '%';
    node.style.width = st.w * 100 + '%';
    node.style.setProperty('--w', st.w);
    node.style.setProperty('--r', st.r + 'deg');
  }

  // 내 메모지·스티커가 놓인 쪽(페이지) 밖으로 나가지 않게: 화면에 보이는 크기(돌린 모양 포함)로 재서 안으로 밀어 넣는다
  // 스티커 가운데가 놓인 쪽 (끌기 시작할 때 정해 두고, 끄는 동안 그 쪽 안에만 머문다)
  function pageOf(leaf, node) {
    var body = node.querySelector('.st-body') || node, B = body.getBoundingClientRect();
    var cx = (B.left + B.right) / 2, cy = (B.top + B.bottom) / 2, found = null, best = Infinity;
    leaf.querySelectorAll('.page').forEach(function (pg) {
      var r = pg.getBoundingClientRect();
      if (!r.width || getComputedStyle(pg).visibility === 'hidden') return;
      var d = Math.max(r.left - cx, 0, cx - r.right) + Math.max(r.top - cy, 0, cy - r.bottom);
      if (d < best) { best = d; found = pg; }
    });
    return found;
  }
  function keepInPage(leaf, node, pageEl) {
    var spread = leaf.querySelector('.spread'), body = node.querySelector('.st-body') || node;
    if (!spread) return;
    pageEl = pageEl || pageOf(leaf, node);
    if (!pageEl) return;
    var R = spread.getBoundingClientRect(), B = body.getBoundingClientRect(), page = pageEl.getBoundingClientRect();
    if (!R.width || !B.width || !page.width) return;
    var st = node._st;
    // 쪽보다 크면 먼저 줄인다
    var k = Math.min(1, page.width * 0.98 / B.width, page.height * 0.98 / B.height);
    if (k < 1) { st.w = Math.max(0.04, st.w * k); positionSticker(node); B = body.getBoundingClientRect(); }
    var mx = 0, my = 0;
    if (B.left < page.left) mx = page.left - B.left; else if (B.right > page.right) mx = page.right - B.right;
    if (B.top < page.top) my = page.top - B.top; else if (B.bottom > page.bottom) my = page.bottom - B.bottom;
    if (mx || my) { st.x += mx / R.width; st.y += my / R.height; positionSticker(node); }
  }

  function selectSticker(leaf, node) {
    leaf.querySelectorAll('.sticker.is-selected').forEach(function (n) { if (n !== node) n.classList.remove('is-selected'); });
    if (node) node.classList.add('is-selected');
  }

  function removeSticker(leaf, node) {
    var list = state.stickers[leaf._sceneId] || [];
    var i = list.indexOf(node._st);
    if (i >= 0) list.splice(i, 1);
    node.remove();
    saveNow();
    toast('스티커를 뗐어요. 음식 카드를 다시 누르면 새로 붙일 수 있어요.');
  }

  function bindSticker(leaf, node) {
    var drag = null;
    var touches = {};   // 스티커 위에 닿은 손가락들
    var pinch = null;
    var spreadEl = function () { return leaf.querySelector('.spread'); };
    var count = function () { return Object.keys(touches).length; };

    function startPinch() {
      var ids = Object.keys(touches);
      var a = touches[ids[0]], b = touches[ids[1]];
      pinch = {
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        w: node._st.w, r: node._st.r
      };
      drag = null;
    }

    node.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.st-del')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!node.hasAttribute('data-fixed')) selectSticker(leaf, node);
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      node.classList.add('is-dragging');
      if (count() === 2) { if (!node.hasAttribute('data-fixed')) startPinch(); return; }
      if (count() > 2) return;
      node._page = pageOf(leaf, node);
      var rect = spreadEl().getBoundingClientRect();
      var st = node._st;
      var cx = rect.left + st.x * rect.width, cy = rect.top + st.y * rect.height;
      drag = {
        id: e.pointerId, rect: rect, handle: !!e.target.closest('.st-handle'),
        dx: e.clientX - cx, dy: e.clientY - cy,
        startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        w: st.w, r: st.r, cx: cx, cy: cy
      };
    });
    node.addEventListener('pointermove', function (e) {
      if (!touches[e.pointerId]) return;
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      var st = node._st;
      if (pinch && count() >= 2) {
        // 두 손가락: 벌리면 커지고, 돌리면 돌아간다
        var ids = Object.keys(touches);
        var a = touches[ids[0]], b = touches[ids[1]];
        st.w = clamp(pinch.w * Math.hypot(b.x - a.x, b.y - a.y) / pinch.dist, 0.04, 0.6);
        st.r = Math.round(pinch.r + (Math.atan2(b.y - a.y, b.x - a.x) - pinch.angle) * 180 / Math.PI);
      } else if (drag && e.pointerId === drag.id) {
        if (drag.handle) {
          // 모서리 손잡이: 가운데를 기준으로 크기와 방향을 함께 바꾼다
          var dist = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
          var ang = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
          st.w = clamp(drag.w * dist / drag.startDist, 0.04, 0.6);
          st.r = Math.round(drag.r + (ang - drag.startAngle) * 180 / Math.PI);
        } else {
          st.x = clamp((e.clientX - drag.dx - drag.rect.left) / drag.rect.width, 0.02, 0.98);
          st.y = clamp((e.clientY - drag.dy - drag.rect.top) / drag.rect.height, 0.04, 0.96);
        }
      } else {
        return;
      }
      if (st.r > 180) st.r -= 360;
      if (st.r < -180) st.r += 360;
      positionSticker(node);
      keepInPage(leaf, node, node._page);
    });
    function end(e) {
      if (!touches[e.pointerId]) return;
      delete touches[e.pointerId];
      if (count() < 2) pinch = null;
      if (drag && e.pointerId === drag.id) drag = null;
      if (count() === 0) {
        drag = null;
        node.classList.remove('is-dragging');
        saveNow();
      }
    }
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    var del = node.querySelector('.st-del');
    if (del) del.addEventListener('click', function (e) { e.stopPropagation(); removeSticker(leaf, node); });
    node.addEventListener('keydown', function (e) {
      var st = node._st, step = e.shiftKey ? 0.05 : 0.01;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !node.hasAttribute('data-fixed')) { e.preventDefault(); removeSticker(leaf, node); return; }
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!moves[e.key]) return;
      e.preventDefault();
      e.stopPropagation();
      st.x = clamp(st.x + moves[e.key][0], 0.02, 0.98);
      st.y = clamp(st.y + moves[e.key][1], 0.04, 0.96);
      positionSticker(node);
      keepInPage(leaf, node);
      saveSoon();
    });
    node.addEventListener('focus', function () { selectSticker(leaf, node); });
  }

  /* ---------- 별빛 효과 (#8) ---------- */
  function sparkles(canvas, count) {
    var g = canvas.getContext && canvas.getContext('2d');
    if (!g) return function () {};
    var w = 0, h = 0, raf = 0, list = [];

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(anywhere) {
      return {
        x: w * (0.08 + Math.random() * 0.6),
        y: anywhere ? h * (0.1 + Math.random() * 0.7) : h * (0.55 + Math.random() * 0.15),
        r: 1.4 + Math.random() * 3,
        vy: 0.12 + Math.random() * 0.35,
        ph: Math.random() * 6.28,
        life: anywhere ? Math.random() * 200 : 0,
        max: 240 + Math.random() * 260
      };
    }
    function drawStar(x, y, r, alpha) {
      g.globalAlpha = alpha;
      g.beginPath();
      g.moveTo(x, y - r * 2);
      g.quadraticCurveTo(x, y, x + r * 2, y);
      g.quadraticCurveTo(x, y, x, y + r * 2);
      g.quadraticCurveTo(x, y, x - r * 2, y);
      g.quadraticCurveTo(x, y, x, y - r * 2);
      g.fill();
    }
    function frame(t) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#ffe3a0';
      g.shadowColor = 'rgba(255, 198, 90, .9)';
      g.shadowBlur = 10;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        var sp = reduceMotion ? 0.5 : 1;
        s.life += sp;
        s.y -= s.vy * sp;
        s.x += Math.sin(t / 900 + s.ph) * 0.22 * sp;
        if (s.life > s.max || s.y < -10) { list[i] = spawn(false); continue; }
        var fade = Math.max(0, Math.min(1, s.life / 40, (s.max - s.life) / 60));
        drawStar(s.x, s.y, s.r, fade * (0.55 + 0.45 * Math.sin(t / 280 + s.ph)));
      }
      g.globalAlpha = 1;
      // 반짝이는 별은 표지의 핵심 장면이라 '움직임 줄이기'가 켜져 있어도 멈추지 않는다 (그때는 천천히)
      raf = requestAnimationFrame(frame);
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    raf = requestAnimationFrame(function (t) {
      resize();
      if (ro) ro.observe(canvas);
      for (var i = 0; i < (count || 44); i++) list.push(spawn(true));
      frame(t);
    });
    return function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }

  /* ---------- 진행 표시와 버튼 ---------- */
  function renderProgress() {
    progress.replaceChildren();
    S.acts.forEach(function (act, ai) {
      var group = el('div', { class: 'act' + (S.scenes[state.scene].act === ai ? ' is-now' : '') },
        el('span', { class: 'act-label', text: act.label, 'aria-hidden': 'true' }));
      S.scenes.forEach(function (sc, i) {
        if (sc.act !== ai) return;
        var cls = 'pip' + (i === state.scene ? ' is-now' : i <= state.maxScene ? ' is-done' : '');
        group.append(el('button', {
          type: 'button', class: cls, disabled: i > state.maxScene,
          'aria-label': act.label + ' · ' + (i + 1) + '번 장면' + (i > state.maxScene ? ' (아직 읽지 않음)' : ''),
          'aria-current': i === state.scene ? 'step' : null,
          onclick: function () { if (i !== state.scene) go(i, 0); }
        }));
      });
      progress.append(group);
    });
  }

  function missing(scene) { return scene.require && !state[scene.require]; }

  // 지금 쪽을 떠날 때 꼭 골라야 하는 값이 비어 있는지
  function blockedHere() {
    var scene = S.scenes[state.scene];
    if (!missing(scene)) return false;
    return mode === 'spread' || state.page >= scene.requirePage;
  }

  function atLastStep() {
    return state.scene === LAST && leavingNow() && !missing(S.scenes[LAST]);
  }

  // 이 장면을 떠날 차례인지: 한 쪽씩 보기는 두 번째 쪽, 펼침 보기는 보통 바로.
  // 단, 쪽 사이에 묻는 화면이 있는 장면(#10)은 펼침 보기에서도 '묻기 전(18쪽 가림) → 물은 뒤(18쪽 보임)' 두 단계
  function leavingNow() {
    var sc = S.scenes[state.scene];
    if (mode === 'spread') return state.page >= (sc.askAt || 0);
    return state.page === lastPage(sc);
  }
  // 한 쪽씩 보기에서 이 장면의 마지막 쪽 (onePage 장면은 첫 쪽만 보고 넘어간다: #7)
  function lastPage(sc) { return sc && sc.onePage ? 0 : 1; }

  function updateControls() {
    var scene = S.scenes[state.scene];
    btnPrev.disabled = state.scene === 0 && (mode === 'spread' || state.page === 0) && !S.scenes[0].asks;
    var last = atLastStep();
    btnNext.hidden = last;
    endActions.hidden = !last;
    if (last) return;
    var leavingScene = leavingNow();
    var label = '다음';
    if (leavingScene) {
      label = typeof scene.nextLabel === 'function' ? scene.nextLabel(ctx()) : (scene.nextLabel || '다음');
      if (state.returnTo != null && state.scene < state.returnTo) label = '엔딩으로 돌아가기';
    } else {
      label = '다음 쪽';
    }
    btnNext.textContent = label;
    btnNext.toggleAttribute('data-blocked', blockedHere());
  }

  /* ---------- 넘기기 ---------- */
  function currentLeaf() { return book.querySelector('.leaf:not(.is-leaving)'); }

  function retire(leaf) {
    (leaf._teardown || []).forEach(function (fn) { fn(); });
    leaf.remove();
  }

  // 장면이 바뀔 때: 지금 장면은 카드처럼 호를 그리며 빠지고, 다음 장면이 반대편에서 호를 그리며 들어온다.
  // 두 장이 같은 시간·같은 곡선으로 움직여 한 덩어리처럼 이어지고, 투명도는 겹치는 가운데 구간에서만 바뀐다.
  // 책장 넘김은 이 책의 핵심 동작이라 '움직임 줄이기'(갤럭시 '애니메이션 제거' 등)가 켜져 있어도 끄지 않고,
  // 그때는 각도만 줄여 부드럽게 넘긴다.
  var ARC = reduceMotion
    ? { deg: 8, duration: 900, easing: 'cubic-bezier(.65,0,.35,1)' }
    : { deg: 18, duration: 1000, easing: 'cubic-bezier(.65,0,.35,1)' };
  var dragFrom = null;   // 손가락으로 밀던 각도 (그 자리에서 이어서 넘어간다)

  function arcOut(leaf, dir) {
    leaf.classList.add('is-leaving');
    var d = -ARC.deg * dir;
    var anim = leaf.animate([
      { transform: (leaf._from || 'rotate(0deg)') + ' scale(1)', opacity: 1 },
      { transform: 'rotate(' + d * 0.45 + 'deg) scale(.975)', opacity: 1, offset: 0.4 },
      { transform: 'rotate(' + d + 'deg) scale(.94)', opacity: 0 }
    ], { duration: ARC.duration, easing: ARC.easing, fill: 'forwards' });
    anim.finished.then(function () { retire(leaf); }, function () { retire(leaf); });
    return anim;
  }

  function arcIn(leaf, dir) {
    var d = ARC.deg * dir;
    leaf.classList.add('is-entering');
    var anim = leaf.animate([
      { transform: 'rotate(' + d + 'deg) scale(.94)', opacity: 0 },
      { transform: 'rotate(' + d * 0.45 + 'deg) scale(.975)', opacity: 1, offset: 0.6 },
      { transform: 'rotate(0deg) scale(1)', opacity: 1 }
    ], { duration: ARC.duration, easing: ARC.easing, fill: 'backwards' });
    var done = function () { leaf.classList.remove('is-entering'); };
    anim.finished.then(done, done);
    return anim;
  }

  // 새 장면을 다 그린 뒤 다음 프레임에 움직이기 시작해야 첫 몇 프레임이 끊기지 않는다
  function nextFrame(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

  // 넘어가는 동안에는 새로 누른 '다음/이전'·밀기를 받지 않는다.
  // (넘기는 도중에 또 누르면 넘김이 처음부터 다시 시작되어 같은 움직임이 반복되고 끊겨 보였다)
  // 쪽을 떠날 때 그 쪽의 그림 도구도 함께 부드럽게 사라지고, 도구 자리만큼 줄었던 책이 원래 크기로 돌아간다
  function hideDocks() {
    var docks = document.querySelectorAll('.tdraw-dock:not(.is-hiding)');
    if (!docks.length) return;
    var stageEl = book.parentNode;
    docks.forEach(function (d) {
      d.classList.add('is-hiding');
      var done = function () {
        d.style.display = 'none';
        if (!document.querySelector('.tdraw-dock:not(.is-hiding)')) {
          stageEl.classList.remove('has-dock', 'has-side-dock');
          stageEl.style.removeProperty('--dock-h');
          stageEl.style.removeProperty('--dock-w');
        }
      };
      if (!d.animate) { done(); return; }
      d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px)' }],
        { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.then(done, done);
    });
  }

  function arc(oldLeaf, newLeaf, dir) {
    hideDocks();
    if (window.StarSoupSound) window.StarSoupSound.flip();
    oldLeaf._from = dragFrom;
    if (dragFrom) oldLeaf.style.transform = dragFrom;
    oldLeaf.classList.add('is-leaving');
    newLeaf.style.opacity = '0';
    switching = true;
    var release = function () { switching = false; };
    nextFrame(function () {
      newLeaf.style.opacity = '';
      arcOut(oldLeaf, dir);
      arcIn(newLeaf, dir).finished.then(release, release);
    });
  }

  // #7 11쪽(요정들이 박수를 보내는 쪽)에 들어설 때 박수 소리 (같은 쪽에서 다시 그릴 때는 나지 않게)
  var heardAt = '';
  function sceneSounds() {
    var sc = S.scenes[state.scene], key = state.scene + ':' + (mode === 'single' ? state.page : 0);
    if (key === heardAt) return;
    heardAt = key;
    if (sc.id === 'serve' && (mode === 'spread' || state.page === 0)) setTimeout(function () { sfx('clap'); }, 450);
  }

  function render(animate) {
    book.querySelectorAll('.leaf.is-leaving').forEach(retire);
    var oldLeaf = currentLeaf();
    if (oldLeaf) { stopAnims(oldLeaf); oldLeaf.classList.remove('is-entering'); oldLeaf.style.opacity = ''; }
    var leaf = buildLeaf(state.scene);
    book.append(leaf);
    if (oldLeaf) {
      if (animate && leaf.animate) arc(oldLeaf, leaf, direction);
      else retire(oldLeaf);
    }
    renderProgress();
    updateControls();
    sceneSounds();
    return leaf;
  }

  function rerender() { render(false); }

  function go(index, page) {
    index = clamp(index, 0, LAST);
    direction = index >= state.scene ? 1 : -1;
    state.scene = index;
    state.page = mode === 'single' ? Math.min(page || 0, lastPage(S.scenes[index])) : 0;
    state.maxScene = Math.max(state.maxScene, index);
    if (index === LAST && state.returnTo === LAST) state.returnTo = null;
    saveNow();
    render(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // 같은 장면 안에서 왼쪽 쪽 ↔ 오른쪽 쪽 (한 쪽씩 보기에서만). 장면을 넘길 때와 같은 호를 그리며 넘어간다.
  function flipPage(page) {
    if (page === state.page) return;
    direction = page > state.page ? 1 : -1;
    state.page = page;
    saveNow();
    render(true);
  }

  function next() {
    if (switching || atLastStep()) return;
    if (blockedHere()) {
      var scene = S.scenes[state.scene];
      toast(scene.requireMessage);
      var grid = currentLeaf() && currentLeaf().querySelector('.grid, .carousel, .win');
      if (grid) { grid.classList.remove('is-shake'); void grid.offsetWidth; grid.classList.add('is-shake'); }
      return;
    }
    var here = S.scenes[state.scene].id;
    var leavingScene = leavingNow();
    // 다음 장면의 그림을 보여 주기 전에 묻는 화면(음식·착한 일·맛)을 먼저 연다
    var upcoming = S.scenes[forwardTarget()];
    // 펼침 화면 #8: 14쪽에서 맛을 고르지 않았으면 넘어가지 않는다
    if (leavingScene && mode === 'spread' && here === 'soup' && !state.taste) { toast('14쪽에서 무슨 맛이 났는지 골라 주세요.'); return; }
    var upAsks = upcoming && asksOf(upcoming);
    if (leavingScene && upAsks && !askPage(upcoming)) { showAsk(upAsks[0], 1); return; }
    // 한 쪽씩 보기: 이 장면 안의 그 쪽 앞에서 묻는다 (#10: 17쪽 → 창 밖을 보니… → 18쪽)
    var curSc = S.scenes[state.scene];
    if (asksOf(curSc) && askPage(curSc) && state.page === askPage(curSc) - 1) { showAsk(asksOf(curSc)[0], 1); return; }
    if (mode === 'single' && state.page < lastPage(curSc)) flipPage(1);
    else if (!leavingScene) return;
    else go(forwardTarget(), 0);
  }

  function forwardTarget() {
    return state.returnTo != null && state.scene < state.returnTo ? state.returnTo : state.scene + 1;
  }

  // 착한 일을 적은 뒤 나오는 꾸미기 화면 (동화 쪽이 아닌 별도 화면).
  // 그림이나 사진을 넣고, 적은 착한 일이 메모지로 나와 끌어서 옮길 수 있다. 완성 그림은 #7에 붙는다.
  function openDeedDecor() {
    var m = state.deedMemo || {};
    window.StarSoupEditor.open({
      title: '착한 일 꾸미기',
      base: images[IMG_DEED_BASE],
      memo: { text: state.deed.trim(), x: m.x, y: m.y },
      doneLabel: '다 꾸몄어요'
    }).then(function (res) {
      if (!res) return; // '동화로'를 누르면 안내 화면에 그대로 머문다
      state.deedMemo = res.memo;
      [[IMG_DEED_BASE, res.base], [IMG_DEED, res.image]].forEach(function (pair) {
        if (pair[1]) saveImage(pair[0], pair[1]);
        else { delete images[pair[0]]; store.deleteImage(pair[0]).catch(function () {}); }
      });
      ensureDeedSticker();
      saveNow();
      leaveThen(document.getElementById('deed-prompt-card'), 1, function () { enterBook(forwardTarget(), 0, 1); });
    });
  }

  /* ---------- 묻는 화면 (동화 쪽이 아님) ----------
     입력 도구가 삽화를 가리지 않도록, 그 장면의 그림을 보여 주기 전에 따로 묻는다.
     - food : #2·3 다음, #4 앞  → 고른 음식은 #4 첫 쪽(5쪽)에 스티커로
     - deed : #5 다음, #6 앞    → 적은 착한 일은 #7 문장에
     - taste: #8 다음, #9 앞    → 고른 맛의 그림이 #9 두 번째 쪽(16쪽)에 */
  var askId = null;
  var ASK = {
    time: {
      scene: 'intro',
      text: function () { return [['지금은 어느 때인가요?']]; },
      body: function () {
        var g = el('div', { class: 'grid grid--food choice-grid choice-grid--5', role: 'group', 'aria-label': '때 고르기' });
        S.times.forEach(function (t) {
          g.append(tile({ id: t.id, label: t.label, bg: t.sky, emoji: '', pressed: state.time === t.id,
            onclick: function () { state.time = t.id; markPressed(g, t.id); paintAskNote(); saveSoon(); var snd = window.StarSoupSound; if (snd && snd.timePick) snd.timePick(t.id); } }));
        });
        return g;
      },
      note: function () {
        var t = ctx().time;
        return t ? t.label + S.josa(t.label, '을/를') + ' 골랐어요. ' + t.mood + '이에요.' : '지금 기분과 가장 닮은 때를 골라 보세요.';
      },
      ready: function () { return !!state.time; },
      requireMessage: '지금 기분과 닮은 때를 하나 골라 주세요.'
    },
    weather: weatherAsk({ key: 'weather', scene: 'intro', field: 'weather', nameField: 'customWeatherName', img: IMG_WEATHER,
      question: '당신이 느끼는 오늘의 날씨는 어떤가요?', where: '#1 하늘에 그 날씨가 펼쳐져요.' }),
    wake: weatherAsk({ key: 'wake', scene: 'ending', field: 'wakeWeather', nameField: 'wakeWeatherName', img: IMG_WAKE,
      question: '한결 달라진 기분으로 창문을 여니…', where: '열린 창 너머로 그 날씨가 펼쳐져요.', landPage: 1 }),
    soup: {
      text: function () {
        return [
          ['요정이 살짝 속삭였어요.'],
          ['“별빛스프에 좋아하는 재료를 넣으면, 세상에 하나뿐인 맛이 난대요!”'],
          ['별빛스프에 무엇을 넣을까요?']
        ];
      },
      body: function () {
        var full = state.soup.length >= S.limits.ingredients;
        var pot = el('div', { class: 'soup-pot' }, el('img', { class: 'soup-pot-img', src: 'assets/backgrounds/08-soup-top.jpg', alt: '위에서 내려다본 별빛스프' }), el('div', { class: 'soup-galaxy' }), soupIngredients(true), potSpoon());
        var add = el('button', {
          type: 'button', class: 'btn btn-soft btn-small soup-add', disabled: full,
          text: full ? '재료를 다섯 개 다 넣었어요' : '+ 재료 넣기 (' + state.soup.length + '/' + S.limits.ingredients + ')',
          onclick: addIngredient
        });
        return el('div', { class: 'soup-cook' }, pot, add);
      },
      note: function () {
        return state.soup.length ? '재료를 끌어서 옮기고, 노란 손잡이(또는 두 손가락)로 크기를 바꿔요. ×를 누르면 뺄 수 있어요.'
          : '재료 이름을 적고 직접 그려서 넣어요. 다섯 개까지 넣을 수 있고, 안 넣어도 괜찮아요.';
      },
      // 재료를 넣거나 빼서 안내 문장이 바뀌어도 높이가 그대로이도록 (두 문장 중 긴 쪽으로 자리 잡기)
      notes: function () {
        return ['재료를 끌어서 옮기고, 노란 손잡이(또는 두 손가락)로 크기를 바꿔요. ×를 누르면 뺄 수 있어요.',
          '재료 이름을 적고 직접 그려서 넣어요. 다섯 개까지 넣을 수 있고, 안 넣어도 괜찮아요.'];
      },
      ready: function () { return true; }
    },
    // 재료를 넣은 다음: 스프를 10번 톡톡 눌러 저어서 완성한다 (한 번에 36°, 10번이면 한 바퀴)
    stir: {
      scene: 'soup',
      text: function () { return [['이제 별빛스프를 휘휘 저어 볼까요?'], ['스프를 10번 톡톡 눌러서 저어 주세요.']]; },
      body: function () {
        var galaxy = el('div', { class: 'soup-galaxy' });
        // 층: 그릇 그림(고정) / 그릇 바닥(고정, 스프가 밀려나면 드러남) / 출렁이는 층[ 도는 스프(금빛 스프·은하빛·빛결) + 떠 있는 재료 ]
        var goo = el('canvas', { class: 'stir-goo', 'aria-hidden': 'true' });
        var liquid = el('div', { class: 'stir-spin' }, el('div', { class: 'stir-soup', 'aria-hidden': 'true' }), galaxy, goo);
        var ingBox = soupIngredients(false);
        var floats = el('div', { class: 'stir-spin' }, ingBox);
        // slosh: 스프 가장자리 모양을 매 프레임 다시 그려 오려 낸다(한쪽만 볼록·납작). surface는 가장자리 윤곽선(메니스커스)
        var slosh = el('div', { class: 'stir-spin stir-slosh' }, liquid);
        var surface = el('div', { class: 'stir-spin stir-surface' }, slosh);
        var count = el('div', { class: 'stir-count', 'aria-live': 'polite' });
        var pot = el('button', { type: 'button', class: 'soup-pot stir-pot', 'aria-label': '스프 젓기 (눌러서 저어요)' },
          el('img', { class: 'soup-pot-img', src: 'assets/backgrounds/08-soup-top.jpg', alt: '' }),
          el('div', { class: 'stir-floor', 'aria-hidden': 'true' }), surface, floats, potSpoon(), count);
        // 물성: 걸쭉한 스프를 숟가락으로 미는 느낌
        //  - 힘이 서서히 실려 천천히 출발(슬로우 인), 관성으로 살짝 지나쳤다가 되돌아와 멈춤
        //  - 재료는 액체보다 늦게, 더 크게 흔들리며 따라옴
        //  - 출렁임(slosh): 스프 전체가 아니라 가장자리 일부만 변한다. 숟가락이 민 쪽은 벽을 타고 볼록 올라가고,
        //    빠르게 흐르는 쪽은 혀처럼 길게 늘어나며(stretch, 빠를수록 가늘고 길게), 반대쪽은 그만큼 물러난다(squash).
        //    매 프레임 가장자리 넓이를 재서 처음 넓이와 같도록 맞춘다 → 모양이 바뀌어도 부피는 그대로.
        //  - 재료: 저마다 무게가 달라 스프보다 크게 밀려났다 통통 튀며 돌아오고, 빙글 돌고, 누른 자리에서 밀려난다
        var phy = { a: state.soupStirs * 36, v: 0, b: state.soupStirs * 36, bv: 0, sw: 0, tap: -1, raf: 0, last: 0,
          dx: 0, dy: 0, vx: 0, vy: 0 };
        var pushes = []; // 숟가락이 미는 힘 { t0, fx, fy }
        var ings = Array.prototype.map.call(ingBox.querySelectorAll('.soup-ing'), function (node, i) {
          return { node: node, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, gain: 2.2 + (i % 3) * 0.5, k: 16 + (i * 5) % 10 };
        });
        var SPOKES = 64, EDGE_X = 23.35, EDGE_Y = 33; // 스프 원의 반지름 (쪽 너비·높이에 대한 %)
        var lobe = function (d, w) { d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.exp(-d * d / (2 * w * w)); };
        var waves = [];  // 누른 자리에서 퍼지는 파문 { t0, ang }
        var gctx = goo.getContext && goo.getContext('2d');
        // 파문: 누른 쪽에서 바깥으로 넓게 퍼져 나가며 빛의 결을 크게 물결지게 밀었다가 잦아든다
        var waveAt = function (r, th, now) {
          var d = 0;
          for (var i = 0; i < waves.length; i++) {
            var tau = (now - waves[i].t0) / 1000, front = 0.1 + tau * 0.55, x = r - front;
            var side = Math.max(0, Math.cos(th - waves[i].ang));
            d += 0.08 * Math.exp(-1.6 * tau) * Math.sin(x * Math.PI * 2 * 1.3) * Math.exp(-(x * x) / 0.18) * (0.2 + 0.8 * side * side);
          }
          return d;
        };
        var drawGoo = function () {
          if (!gctx) return;
          var dpr = Math.min(2, window.devicePixelRatio || 1);
          var W = Math.round(goo.clientWidth * dpr);
          if (!W) return;
          if (goo.width !== W) { goo.width = W; goo.height = W; }
          var R = W / 2, g = gctx, now = performance.now();
          g.clearRect(0, 0, W, W);
          var rad = Math.PI / 180;
          // 빛나는 소용돌이 결: 가는 동심원 고리들에 같은 빛 무늬를 칠한다. 파문이 지나가면 고리가 출렁여 빛이 물결진다
          var glow = Math.min(1, 0.35 + Math.abs(phy.v) / 90);
          var paintStyle = 'rgba(255, 250, 230, ' + (0.22 * glow).toFixed(3) + ')';
          if (g.createConicGradient) {
            var cg = g.createConicGradient(phy.sw * rad, R, R);
            cg.addColorStop(0, 'rgba(255,255,255,0)');
            cg.addColorStop(0.12, 'rgba(255,255,255,' + (0.42 * glow).toFixed(3) + ')');
            cg.addColorStop(0.28, 'rgba(255,255,255,0)');
            cg.addColorStop(0.55, 'rgba(255,236,180,' + (0.36 * glow).toFixed(3) + ')');
            cg.addColorStop(0.72, 'rgba(255,255,255,0)');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            paintStyle = cg;
          }
          var NG = 20, gap = 0.97 / NG, SEG = 72;
          g.strokeStyle = paintStyle;
          g.lineWidth = gap * R;
          for (var gi = 0; gi < NG; gi++) {
            var rr = gap * (gi + 0.5);
            g.beginPath();
            for (var si = 0; si <= SEG; si++) {
              var th = si / SEG * Math.PI * 2;
              var rw = Math.max(0, rr + (waves.length ? waveAt(rr, th, now) : 0)) * R;
              var px = R + Math.cos(th) * rw, py = R + Math.sin(th) * rw;
              if (si) g.lineTo(px, py); else g.moveTo(px, py);
            }
            g.stroke();
          }
        };
        var draw = function () {
          // 1.3배로 키워 두고 가장자리 모양으로 오려 낸다 (볼록 나온 자리에도 스프 무늬가 있게)
          liquid.style.transform = 'rotate(' + phy.a.toFixed(2) + 'deg) scale(1.3)';
          floats.style.transform = 'rotate(' + phy.b.toFixed(2) + 'deg)';
          // 가장자리 모양: 쏠린 쪽 볼록(벽 타기) + 흐르는 쪽 혀처럼 늘어남 + 파문이 가장자리에 닿으면 출렁
          var sp = Math.sqrt(phy.vx * phy.vx + phy.vy * phy.vy), dd = Math.sqrt(phy.dx * phy.dx + phy.dy * phy.dy);
          var ad = Math.min(0.22, dd * 8), av = Math.min(0.18, sp * 1.4);
          var td = Math.atan2(phy.dy, phy.dx), tv = Math.atan2(phy.vy, phy.vx);
          var wv = 0.65 - 0.33 * Math.min(1, sp / 0.15); // 빠를수록 가늘고 길게
          var now = performance.now(), rs = [], area = 0, i;
          for (i = 0; i < SPOKES; i++) {
            var th = i / SPOKES * Math.PI * 2;
            var r = 1 + ad * lobe(th - td, 0.85) + av * lobe(th - tv, wv) - 0.35 * ad * lobe(th - td - Math.PI, 1.1);
            for (var wi = 0; wi < waves.length; wi++) {
              var tau = (now - waves[wi].t0) / 1000, fr = 0.1 + tau * 0.55 - 1;
              r += 0.035 * Math.exp(-1.6 * tau) * Math.exp(-fr * fr / 0.03) * lobe(th - waves[wi].ang - phy.a * Math.PI / 180, 0.6);
            }
            rs.push(r); area += r * r;
          }
          var norm = Math.sqrt(SPOKES / area); // ½∑r²Δθ = π 이 되도록 → 넓이(부피) 유지
          var pts = [];
          for (i = 0; i < SPOKES; i++) {
            var t2 = i / SPOKES * Math.PI * 2, rr = rs[i] * norm;
            pts.push((50 + Math.cos(t2) * rr * EDGE_X).toFixed(2) + '% ' + (51 + Math.sin(t2) * rr * EDGE_Y).toFixed(2) + '%');
          }
          slosh.style.clipPath = 'polygon(' + pts.join(',') + ')';
          // 재료: 각자 출렁임에 밀려나 통통 튀며 돌아온다 (도는 층 안이므로 방향을 그 층 기준으로 돌려서 넣는다)
          var W = pot.clientWidth || 1, rb = -phy.b * Math.PI / 180, cb = Math.cos(rb), sb = Math.sin(rb);
          for (i = 0; i < ings.length; i++) {
            var g = ings[i], lx = g.x * cb - g.y * sb, ly = g.x * sb + g.y * cb;
            g.node.style.translate = (lx * W).toFixed(2) + 'px ' + (ly * W).toFixed(2) + 'px';
            g.node.style.rotate = g.r.toFixed(2) + 'deg';
          }
        };
        var step = function (now) {
          var dt = Math.min(0.033, (now - (phy.last || now)) / 1000);
          phy.last = now;
          var target = state.soupStirs * 36;
          // 슬로우 인: 누른 직후엔 미는 힘이 약하다가 0.45초에 걸쳐 부드럽게 다 실린다
          var t = phy.tap < 0 ? 1 : Math.min(1, (now - phy.tap) / 450);
          var ramp = t * t * (3 - 2 * t);
          var k = 38 * (0.08 + 0.92 * ramp), c = 2 * 0.62 * Math.sqrt(38);
          phy.v += (k * (target - phy.a) - c * phy.v) * dt;
          phy.a += phy.v * dt;
          // 재료: 액체 각도를 느슨한 용수철로 따라감 (더 늦고 더 출렁)
          phy.bv += (22 * (phy.a - phy.b) - 2 * 0.42 * Math.sqrt(22) * phy.bv) * dt;
          phy.b += phy.bv * dt;
          // 소용돌이 결은 액체보다 빠르게 흐른다
          phy.sw += phy.v * 2.2 * dt;
          // 출렁임: 숟가락 힘도 서서히 실렸다 빠지고(0.5초), 스프는 물처럼 넘실대다 가라앉는다
          var fx = 0, fy = 0, T = 0.5;
          pushes = pushes.filter(function (p) {
            var u = (now - p.t0) / 1000;
            if (u > T) return false;
            var bell = Math.pow(Math.sin(Math.PI * u / T), 2) * 2 / T;
            fx += p.fx * bell; fy += p.fy * bell;
            return true;
          });
          var ks = 55, cs = 2 * 0.3 * Math.sqrt(55);
          var ax = fx - ks * phy.dx - cs * phy.vx, ay = fy - ks * phy.dy - cs * phy.vy;
          phy.vx += (fx - ks * phy.dx - cs * phy.vx) * dt;
          phy.vy += (fy - ks * phy.dy - cs * phy.vy) * dt;
          // 쏠린 물결은 도는 스프를 따라 그릇 둘레로 조금 흘러간다
          var turn = phy.v * Math.PI / 180 * 0.5 * dt, co = Math.cos(turn), si2 = Math.sin(turn);
          var ndx = phy.dx * co - phy.dy * si2; phy.dy = phy.dx * si2 + phy.dy * co; phy.dx = ndx;
          phy.dx += phy.vx * dt; phy.dy += phy.vy * dt;
          // 재료: 스프 쏠림의 몇 배로 끌려가는 통통한 용수철 + 흐름에 따라 빙글
          var ingCalm = true;
          for (var ii = 0; ii < ings.length; ii++) {
            var g = ings[ii], kc = g.k, cc2 = 2 * 0.4 * Math.sqrt(kc);
            g.vx += (kc * (phy.dx * g.gain - g.x) - cc2 * g.vx) * dt;
            g.vy += (kc * (phy.dy * g.gain - g.y) - cc2 * g.vy) * dt;
            g.x += g.vx * dt; g.y += g.vy * dt;
            g.vr += (-12 * g.r - 2 * 0.45 * Math.sqrt(12) * g.vr + (phy.v - phy.bv) * 0.5) * dt;
            g.r += g.vr * dt;
            if (Math.abs(g.x) + Math.abs(g.y) > 0.0003 || Math.abs(g.vx) + Math.abs(g.vy) > 0.002 || Math.abs(g.r) > 0.1 || Math.abs(g.vr) > 0.5) ingCalm = false;
          }
          draw();
          var calm = Math.abs(target - phy.a) < 0.05 && Math.abs(phy.v) < 0.05 && Math.abs(phy.a - phy.b) < 0.05 &&
            Math.abs(phy.bv) < 0.05 && !pushes.length && Math.abs(phy.dx) + Math.abs(phy.dy) < 0.0002 && Math.abs(phy.vx) + Math.abs(phy.vy) < 0.001 && ingCalm;
          waves = waves.filter(function (wv) { return now - wv.t0 < 2200; });
          calm = calm && !waves.length;
          if (calm) {
            phy.dx = phy.dy = phy.vx = phy.vy = 0;
            ings.forEach(function (g) { g.x = g.y = g.vx = g.vy = g.r = g.vr = 0; });
            draw();
          }
          drawGoo();
          if (calm || !pot.isConnected) { phy.raf = 0; phy.last = 0; return; }
          phy.raf = requestAnimationFrame(step);
        };
        var kick = function () { if (!phy.raf) { phy.last = 0; phy.raf = requestAnimationFrame(step); } };
        var paint = function () {
          count.textContent = state.soupStirs >= 10 ? '완성!' : state.soupStirs + ' / 10';
          count.classList.toggle('is-done', state.soupStirs >= 10);
          // 푸른 은하빛이 한 번 저을 때마다 10%씩 걷히고 아래의 금빛이 드러난다
          galaxy.style.opacity = String(Math.max(0, 1 - state.soupStirs / 10));
        };
        paint();
        draw();
        // 처음 그릴 때는 화면에 붙은 뒤에 크기를 알 수 있다
        if (window.ResizeObserver) new ResizeObserver(function () { if (!phy.raf) drawGoo(); }).observe(goo);
        else requestAnimationFrame(function () { requestAnimationFrame(drawGoo); });
        pot.addEventListener('pointerdown', function (e) {
          if (state.soupStirs >= 10) return;
          state.soupStirs++;
          sfx('stir');
          paint();
          phy.tap = performance.now();
          kick();
          var pr = pot.getBoundingClientRect();
          var nx = (e.clientX - pr.left) / pr.width - 0.5;
          // 파문은 누른 쪽에서 시작 (돌아가는 스프 기준의 방향으로 바꿔 넣는다)
          waves.push({ t0: phy.tap, ang: Math.atan2((e.clientY - pr.top) / pr.height - 0.51, nx) - phy.a * Math.PI / 180 });
          if (waves.length > 4) waves.shift();
          // 숟가락이 스프를 미는 힘: 젓는 방향(시계 방향 접선)으로, 누른 쪽에서 조금 바깥으로
          var ta = Math.atan2((e.clientY - pr.top) / pr.height - 0.51, nx);
          // 누른 자리 가까운 재료는 톡 밀려난다
          ings.forEach(function (g) {
            var ib = g.node.getBoundingClientRect();
            var gx = (ib.left + ib.width / 2 - e.clientX) / pr.width, gy = (ib.top + ib.height / 2 - e.clientY) / pr.width;
            var dist = Math.sqrt(gx * gx + gy * gy) || 0.01, f = 0.35 * Math.exp(-dist / 0.18);
            g.vx += gx / dist * f; g.vy += gy / dist * f;
            g.vr += (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 40);
          });
          pushes.push({ t0: phy.tap, fx: -Math.sin(ta) * 0.3 + Math.cos(ta) * 0.1, fy: Math.cos(ta) * 0.3 + Math.sin(ta) * 0.1 });
          var ripple = el('span', { class: 'stir-ripple', 'aria-hidden': 'true' });
          pot.append(ripple);
          setTimeout(function () { ripple.remove(); }, 900);
          // 누른 자리에 별빛이 톡
          var r = pot.getBoundingClientRect();
          for (var k = 0; k < 5; k++) {
            var sp = el('span', { class: 'stir-spark', text: '✦' });
            sp.style.left = (e.clientX - r.left) + 'px';
            sp.style.top = (e.clientY - r.top) + 'px';
            sp.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
            sp.style.setProperty('--dy', (Math.random() * -70 - 10) + 'px');
            pot.append(sp);
            setTimeout(function (n) { return function () { n.remove(); }; }(sp), 800);
          }
          if (state.soupStirs >= 10) {
            pot.classList.add('is-done');
            starBurst(pot);
            sfx('stirDone');
            toast('별빛스프 완성! 세상에 하나뿐인 맛이 됐어요.');
          }
          paintAskNote();
          saveSoon();
        });
        return el('div', { class: 'soup-cook' }, pot);
      },
      note: function () { return state.soupStirs >= 10 ? '보글보글, 별빛스프가 완성됐어요!' : '스프를 눌러 저어요. 한 번 누를 때마다 휘휘 돌아가요.'; },
      notes: function () { return ['보글보글, 별빛스프가 완성됐어요!', '스프를 눌러 저어요. 한 번 누를 때마다 휘휘 돌아가요.']; },
      ready: function () { return state.soupStirs >= 10; },
      requireMessage: '스프를 10번 눌러서 다 저어 주세요.'
    },
    food: {
      text: function (sc, c) { return sc.text(c); },
      body: function () { var g = foodGrid(); g.id = 'food-choice-grid'; g.classList.add('food-grid'); return g; },   // 스타일은 클래스로: 넘어갈 때 띄우는 복제본(아이디가 지워짐)에도 똑같이
      note: function () { return '가장 좋아하는 음식을 골라보세요!'; },
      ready: function () { return !!state.food; },
      after: function () { spawnFoodSticker(ARC.duration * 0.8); }
    },
    deed: {
      text: function (sc, c) { return sc.question(c); },
      body: function () { return deedInput(); },
      note: function () { return '비워 두어도 이야기는 이어져요. 다음 장면을 본 뒤 그림으로 꾸밀 수도 있어요.'; },
      ready: function () { return true; }
    },
    taste: {
      text: function (sc, c) { return sc.text(c); },
      body: function () {
        // '직접 그리기'를 고르면 그 맛의 이름을 적는 칸이 카드 아래에 나온다 (자리는 늘 잡아 두어 화면이 움직이지 않게)
        var input = el('input', { type: 'text', class: 'input input-sm', id: 'taste-name', maxlength: String(S.limits.tasteName),
          placeholder: '어떤 맛이었나요? 예: 무지개 맛 (안 써도 돼요)', autocomplete: 'off', value: state.customTasteName || '' });
        input.addEventListener('input', function () { state.customTasteName = input.value.slice(0, S.limits.tasteName); saveSoon(); });
        var field = el('div', { class: 'field taste-name-field' },
          el('label', { for: 'taste-name', text: '내가 고른 맛의 이름' }), input);
        var on = state.taste === 'custom';
        field.classList.toggle('is-on', on);
        field.setAttribute('aria-hidden', on ? 'false' : 'true');
        input.tabIndex = on ? 0 : -1;
        var wrap = el('div', { class: 'ask-taste' }, el('div', { class: 'ask-carousel' }, tasteCarousel()), field);
        return wrap;
      },
      note: function () {
        var t = ctx().taste;
        if (t && t.id === 'custom') return S.customTaste.hint;
        return t ? t.label + S.josa(t.label, '을/를') + ' 골랐어요. 다음으로 넘기면 그 맛이 그림으로 펼쳐져요.' : S.scenes[sceneIndex('taste')].hint;
      },
      // 안내 문장이 될 수 있는 것들: 가장 긴 문장 높이로 자리를 잡아 카드를 돌려도 화면이 움직이지 않게
      notes: function () {
        var name = (state.customTasteName || '').trim() || S.customTaste.fallbackName;
        return S.tastes.map(function (t) { return t.label; }).concat([name]).map(function (l) {
          return l + S.josa(l, '을/를') + ' 골랐어요. 다음으로 넘기면 그 맛이 그림으로 펼쳐져요.';
        }).concat([S.scenes[sceneIndex('taste')].hint, S.customTaste.hint]);  // custom → hint
      },
      ready: function () { return !!state.taste; }
    }
  };
  // 날씨 묻는 화면 만들기 (#1 앞의 오늘 날씨, #10 깨어나서 본 창 밖 날씨)
  function weatherAsk(o) {
    return {
      scene: o.scene,
      text: function () { return [[o.question]]; },
      body: function () {
        var g = el('div', { class: 'grid grid--food choice-grid choice-grid--5', role: 'group', 'aria-label': '날씨 고르기' });
        var pick = function (id) { state[o.field] = id; markPressed(g, id); paintAskNote(); saveSoon(); sfx('chime'); };
        S.weathers.forEach(function (w) {
          g.append(tile({ id: w.id, label: w.label, emoji: w.emoji, glow: w.glow, pressed: state[o.field] === w.id,
            onclick: function () { pick(w.id); } }));
        });
        var has = !!images[o.img];
        g.append(tile({
          id: 'custom', extra: 'tile--draw' + (has ? ' has-art' : ''),
          label: has ? (state[o.nameField].trim() || '내가 그린 날씨') : S.customWeather.label,
          image: images[o.img], emoji: '✏️', glow: '#3a4a7a', pressed: state[o.field] === 'custom',
          onclick: function () {
            if (!images[o.img] || state[o.field] === 'custom') drawWeather(o);
            else pick('custom');
          }
        }));
        return g;
      },
      note: function () {
        var w = weatherOf(state[o.field], state[o.nameField]);
        return w ? w.label + S.josa(w.label, '을/를') + ' 골랐어요. ' + o.where : '‘직접 그리기’로 오늘의 날씨를 그려도 좋아요.';
      },
      ready: function () { return !!state[o.field]; },
      landPage: o.landPage,
      requireMessage: '오늘의 날씨를 하나 골라 주세요.'
    };
  }

  // 한 쪽씩 보기에서 이 장면의 몇 번째 쪽 앞에 묻는지 (0이면 장면 앞)
  // 이 장면의 몇 번째 쪽 앞에서 묻는지 (0이면 장면 앞). #10은 한 쪽씩·펼침 보기 모두 17쪽과 18쪽 사이
  function askPage(sc) { return sc.askAt || 0; }

  function askScene(id) { return sceneIndex(ASK[id].scene || id); }
  function askList(id) { return asksOf(S.scenes[askScene(id)]) || [id]; }
  // 이 장면 앞에서 묻는 화면들 (펼침 화면은 쪽 안에 넣은 것을 뺀다)
  function asksOf(sc) {
    var a = mode === 'spread' && sc.spreadAsks ? sc.spreadAsks : sc.asks;
    return a && a.length ? a : null;
  }

  // 오늘의 날씨를 직접 그린다 → 그 그림이 #1 가장 위층에 그대로 놓인다 (움직이지 않음)
  // 날씨를 직접 그린다 → 그 그림이 하늘 위층에 그대로 놓인다 (움직이지 않음)
  function drawWeather(o) {
    window.StarSoupEditor.open({
      title: '오늘의 날씨 그리기', image: images[o.img], askName: true, name: state[o.nameField],
      nameLabel: '어떤 날씨인가요? (안 써도 돼요)', namePlaceholder: '예: 무지개 뜬 날'
    }).then(function (res) {
      if (!res) return;
      state[o.nameField] = res.name.slice(0, S.limits.weatherName);
      saveImage(o.img, res.image);
      state[o.field] = 'custom';
      sfx('chime');
      if (askId === o.key) paintAsk();
      saveNow();
    });
  }

  // fromEl: 지금 보이는 카드(표지·다른 묻는 화면)에서 바로 넘어올 때
  function showAsk(id, dir, fromEl) {
    var leaf = currentLeaf();
    var show = function () {
      if (leaf && !fromEl) retire(leaf);
      askId = id;
      paintAsk();
      showScreen('ask');
      measureAskNote();
      fitSoupPot();
      enterCard(document.getElementById('ask-card'), dir);
    };
    if (fromEl) leaveThen(fromEl, dir, show);
    else if (leaf) { stopAnims(leaf); leaveThen(leaf, dir, show); }
    else if (!switching) { switching = true; show(); }
  }

  // 묻는 화면이면 다시 그리고, 쪽 안에 넣은 화면(펼침 화면의 재료 넣기)이면 그 쪽을 다시 그린다
  // 묻는 화면이 지금 보이고 있으면 그 화면을, 아니면 책 쪽(펼침면 안의 재료 넣기·맛 고르기)을 다시 그린다
  // (예전에는 묻는 화면을 한 번 보고 나면 askId가 남아, 책 쪽에서 재료를 넣어도 숨은 묻는 화면만 다시 그려졌다)
  function refreshAskUI() { if (askId && app.getAttribute('data-screen') === 'ask') paintAsk(); else rerender(); }

  // 펼침 화면: 묻는 화면(재료 넣기·맛 고르기)을 쪽 안에 그대로 넣는다
  function inlineAsk(id) {
    var cfg = ASK[id], sc = S.scenes[askScene(id)];
    var note = el('p', { class: 'prompt-text ask-note inline-note', text: cfg.note() });
    var box = el('div', { class: 'inline-ask', 'data-ask': id },
      el('div', { class: 'choice-text' }, paragraphs(cfg.text(sc, ctx()))),
      el('div', { class: 'ask-body' }, cfg.body()), note);
    return box;
  }

  function paintAsk() {
    var cfg = ASK[askId], scene = S.scenes[askScene(askId)];
    var card = document.getElementById('ask-card');
    card.setAttribute('data-ask', askId);
    document.getElementById('ask-kicker').textContent = S.acts[scene.act].label + ' · ' + S.acts[scene.act].title + ' #' + scene.no;
    var q = document.getElementById('ask-text');
    q.replaceChildren.apply(q, paragraphs(cfg.text(scene, ctx())));
    var body = document.getElementById('ask-body');
    body.replaceChildren(cfg.body());
    var note = document.getElementById('ask-note');
    note.textContent = '';
    note.style.minHeight = '';
    paintAskNote();
    measureAskNote();
    fitSoupPot();
  }

  // 스프 그릇(재료 넣기·젓기)은 화면에 남은 공간만큼 최대한 크게: 카드 너비까지 키운 뒤, 화면을 넘치면 넘친 만큼 줄인다
  function fitSoupPot() {
    var pot = document.querySelector('#ask-body .soup-pot');
    if (!pot || !pot.offsetParent) return;
    var box = pot.parentNode;
    pot.style.width = box.clientWidth + 'px';
    var over = document.documentElement.scrollHeight - window.innerHeight;
    if (over > 0) {
      var h = pot.getBoundingClientRect().height - over - 6;
      pot.style.width = Math.max(150, Math.min(box.clientWidth, h * 1.414)) + 'px';
    }
  }
  window.addEventListener('resize', function () { if (askId === 'soup' || askId === 'stir') fitSoupPot(); });

  // 이 화면에서 나올 수 있는 안내 문장 중 가장 긴 것의 높이로 자리를 잡는다 (보이는 상태에서만 잴 수 있다)
  function measureAskNote() {
    var cfg = askId && ASK[askId], noteEl = document.getElementById('ask-note');
    if (!cfg || !cfg.notes || !noteEl.offsetParent) return;
    var keep = noteEl.textContent, h = noteEl.offsetHeight;
    noteEl.style.minHeight = '';
    cfg.notes().forEach(function (t) { noteEl.textContent = t; h = Math.max(h, noteEl.offsetHeight); });
    noteEl.textContent = keep;
    noteEl.style.minHeight = h + 'px';
  }

  function paintAskNote() {
    document.querySelectorAll('.leaf .inline-ask').forEach(function (b) {
      var n = b.querySelector('.inline-note'); if (n) n.textContent = ASK[b.getAttribute('data-ask')].note();
    });
    if (!askId) return;
    // 같은 화면 안에서 안내 문장이 짧아져도(두 줄 → 한 줄) 높이를 줄이지 않는다
    // → 스프 완성 때처럼 문장이 바뀌어도 카드가 줄어들며 그릇·버튼이 튀지 않는다
    var noteEl = document.getElementById('ask-note');
    if (noteEl.offsetHeight) noteEl.style.minHeight = noteEl.offsetHeight + 'px';
    noteEl.textContent = ASK[askId].note();
    document.getElementById('btn-ask-next').toggleAttribute('data-blocked', !ASK[askId].ready());
  }

  document.getElementById('btn-ask-next').addEventListener('click', function () {
    if (switching || !askId) return;
    var cfg = ASK[askId], card = document.getElementById('ask-card');
    if (!cfg.ready()) {
      toast(cfg.requireMessage || S.scenes[askScene(askId)].requireMessage);
      var g = document.getElementById('ask-body').firstElementChild;
      if (g) { g.classList.remove('is-shake'); void g.offsetWidth; g.classList.add('is-shake'); }
      return;
    }
    saveNow();
    // 같은 장면 앞에 묻는 화면이 더 있으면 차례로 (#1: 때 → 날씨)
    var list = askList(askId), pos = list.indexOf(askId);
    if (pos >= 0 && pos < list.length - 1 && state.returnTo == null) { showAsk(list[pos + 1], 1, card); return; }
    // 착한 일을 적은 다음에는 #6으로 가기 전에 '그림으로 남겨볼까요?' (#5 두 번째 쪽 다음 자리)
    if (askId === 'deed' && state.returnTo == null) { leaveThen(card, 1, function () { openDeedPromptScreen(1); }); return; }
    var target = state.returnTo != null ? state.returnTo : askScene(askId);
    var after = cfg.after;
    var landPage = target === askScene(askId) ? (cfg.landPage != null ? cfg.landPage : askPage(S.scenes[target])) : 0;
    leaveThen(card, 1, function () {
      enterBook(target, landPage, 1);
      if (after) after();
    });
  });
  document.getElementById('btn-ask-back').addEventListener('click', function () {
    if (switching || !askId) return;
    var card = document.getElementById('ask-card');
    // 스프 젓기 화면에서 뒤로 가면 저은 것을 되돌린다 → 다시 오면 처음부터 다시 저을 수 있다
    if (askId === 'stir' && state.soupStirs) { state.soupStirs = 0; saveSoon(); }
    var list = askList(askId), pos = list.indexOf(askId);
    if (pos > 0) { showAsk(list[pos - 1], -1, card); return; }
    var here = S.scenes[askScene(askId)];
    // 쪽 안에서 연 화면(#10 창 밖)은 그 쪽으로 돌아간다
    if (ASK[askId].landPage != null) { var lp = ASK[askId].landPage, sc0 = askScene(askId); leaveThen(card, -1, function () { enterBook(sc0, lp, -1); }); return; }
    if (askPage(here)) { leaveThen(card, -1, function () { enterBook(askScene(askId), askPage(here) - 1, -1); }); return; }
    var back = askScene(askId) - 1;
    if (back < 0) {
      // #1 앞의 첫 질문에서 뒤로 → 표지
      leaveThen(card, -1, function () { showScreen('cover'); enterCard(document.getElementById('cover-card'), -1); });
      return;
    }
    leaveThen(card, -1, function () { enterBook(back, 1, -1); });
  });

  // 착한 일을 적은 뒤 나오는 안내 화면 (동화 쪽이 아님): 가운데 버튼을 눌러야 꾸미기 화면으로 간다
  // 안내 화면은 착한 일을 적은 뒤(묻는 화면에서) 또는 #6에서 뒤로 올 때 열린다.
  // 이 화면에 있는 동안 state.scene은 #5라서, 다음은 #6(forwardTarget)으로 간다.
  function openDeedPromptScreen(dir) {
    state.scene = sceneIndex('deed') - 1;
    paintDeedPrompt();
    showScreen('deedPrompt');
    enterCard(document.getElementById('deed-prompt-card'), dir);
  }
  function showDeedPrompt() {
    var leaf = currentLeaf();
    if (!leaf) return;
    stopAnims(leaf);
    leaveThen(leaf, -1, function () { retire(leaf); openDeedPromptScreen(-1); });
  }

  function paintDeedPrompt() {
    var box = document.getElementById('deed-prompt-preview');
    var deed = state.deed.trim();
    box.replaceChildren();
    if (images[IMG_DEED]) {
      box.append(el('figure', { class: 'paper-body prompt-paper' },
        el('img', { src: images[IMG_DEED], alt: '지난번에 꾸민 착한 일 그림' }), el('figcaption', { text: '내가 한 착한 일' })));
    } else if (deed) {
      box.append(el('div', { class: 'prompt-memo' }, el('span', { class: 'prompt-memo-head', text: '내가 한 착한 일' }), el('span', { text: deed })));
    }
    document.getElementById('btn-deed-draw').textContent = images[IMG_DEED] ? '그림 다시 꾸미기' : '그림 그리러 가기';
  }

  document.getElementById('btn-deed-draw').addEventListener('click', function () { if (!switching) openDeedDecor(); });
  document.getElementById('btn-deed-skip').addEventListener('click', function () {
    leaveThen(document.getElementById('deed-prompt-card'), 1, function () { enterBook(forwardTarget(), 0, 1); });
  });
  document.getElementById('btn-deed-back').addEventListener('click', function () {
    // 뒤로: 착한 일을 적는 화면으로
    showAsk('deed', -1, document.getElementById('deed-prompt-card'));
  });

  function prev() {
    if (switching) return;
    var cur = S.scenes[state.scene];
    if (asksOf(cur) && askPage(cur) && state.page === askPage(cur)) { var ca = asksOf(cur); showAsk(ca[ca.length - 1], -1); return; }
    if (mode === 'single' && state.page === 1) { flipPage(0); return; }
    // #6 첫 쪽에서 뒤로 → 그림으로 남기기 안내 화면
    if (cur.id === 'deed' && state.returnTo == null) { showDeedPrompt(); return; }
    // 묻는 화면이 있는 장면의 첫 쪽에서 뒤로 가면 그 화면으로
    var asks = asksOf(S.scenes[state.scene]);
    if (asks && !askPage(S.scenes[state.scene])) { showAsk(asks[asks.length - 1], -1); return; }
    if (state.scene > 0) go(state.scene - 1, lastPage(S.scenes[state.scene - 1]));
  }

  /* ---------- PDF로 저장하기 ----------
     장면마다 펼침면을 화면 밖에서 새로 만들어(설명·버튼·손잡이 같은 UI는 숨김) 그림으로 찍고,
     왼쪽·오른쪽 쪽으로 나눠 가로 A4 한 장씩 넣는다. 맨 앞은 표지. 한 쪽짜리 장면(#7·#8)은 왼쪽 쪽만.
     html2canvas는 혼합 모드·마스크를 못 그리므로 #1 하늘(스크린 70%)과 16쪽 그라데이션은 미리 그림으로 합쳐 둔다. */
  var printing = false;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[data-lib="' + src + '"]')) { res(); return; }
      var sc = document.createElement('script'); sc.src = src; sc.setAttribute('data-lib', src);
      sc.onload = res; sc.onerror = function () { rej(new Error('불러오지 못함: ' + src)); };
      document.head.append(sc);
    });
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function imgReady(img) {
    return img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (r) { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); setTimeout(r, 4000); });
  }
  var FADE = [[0, 0], [0.001, 0], [0.14, 1]];   // 16쪽: 왼쪽 1/10 투명 → 57%에서 다 보임 (css의 mask와 같게)
  function fadeAlpha(g, w, h) {
    var gr = g.createLinearGradient(0, 0, w, 0);
    FADE.forEach(function (f) { gr.addColorStop(f[0], 'rgba(0,0,0,' + f[1] + ')'); });
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  }
  function fadedSheet(color) {
    var cv = document.createElement('canvas'); cv.width = 600; cv.height = 424;
    var g = cv.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 600, 424); fadeAlpha(g, 600, 424);
    return cv.toDataURL('image/png');
  }
  function fadedImage(img) {
    var cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    var g = cv.getContext('2d'); g.drawImage(img, 0, 0); fadeAlpha(g, cv.width, cv.height);
    return cv.toDataURL('image/png');
  }
  // CSS 'linear-gradient(180deg, #a 0%, #b 55%, #c 100%)'를 캔버스 세로 그러데이션으로
  function paintSky(g, css, w, h) {
    var stops = (css || '').match(/#[0-9a-f]{3,8}\s+[\d.]+%/gi) || [];
    var gr = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (st) { var m = st.split(/\s+/); gr.addColorStop(parseFloat(m[1]) / 100, m[0]); });
    g.fillStyle = stops.length ? gr : '#1d2452'; g.fillRect(0, 0, w, h);
  }
  function prepForPrint(leaf, scene) {
    var jobs = [];
    var bg = leaf.querySelector('.spread-bg'), bimg = bg && bg.querySelector('img:not(.spread-overlay)');
    if (scene.imageBlend && bimg) {
      jobs.push(imgReady(bimg).then(function () {
        if (!bimg.naturalWidth) return;
        var cv = document.createElement('canvas'); cv.width = bimg.naturalWidth; cv.height = bimg.naturalHeight;
        var g = cv.getContext('2d');
        paintSky(g, bg.style.background, cv.width, cv.height);
        g.globalAlpha = scene.imageBlend.opacity; g.globalCompositeOperation = scene.imageBlend.mode;
        g.drawImage(bimg, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        bimg.style.mixBlendMode = ''; bimg.style.opacity = '';
        bimg.src = cv.toDataURL('image/jpeg', 0.92);
        return imgReady(bimg);
      }));
    }
    leaf.querySelectorAll('.page.is-fade .page-img').forEach(function (pi) {
      jobs.push(imgReady(pi).then(function () { if (pi.naturalWidth) { pi.src = fadedImage(pi); return imgReady(pi); } }));
    });
    return Promise.all(jobs);
  }
  function pdfBusy(text) {
    var box = document.getElementById('pdf-busy');
    if (!text) { if (box) box.remove(); return; }
    if (!box) { box = el('div', { class: 'pdf-busy', id: 'pdf-busy', role: 'status' }, el('div', { class: 'pdf-busy-card' }, el('span', { class: 'pdf-spin', 'aria-hidden': 'true' }), el('p'))); document.body.append(box); }
    box.querySelector('p').textContent = text;
  }
  // PDF 저장: '기본'(화면처럼 가운데 접힌 그림자) 또는 '인쇄용'(접힌 그림자 없이 평평하게) 중에서 고른다
  function choosePdf() {
    if (printing || document.getElementById('pdf-busy')) return;
    ask({
      title: 'PDF로 저장할까요?',
      message: '기본: 화면에서 보는 것처럼 책 가운데가 접힌 모습으로 저장해요.\n인쇄용: 가운데 접힌 그림자 없이 평평하게 저장해요. 종이에 뽑아 제본할 때 좋아요.',
      ok: '인쇄용', cancel: '기본'
    }).then(function (r) {
      if (r === null) return;     // 바깥을 누르거나 Esc → 저장하지 않음
      makePdf({ flat: r === true });
    });
  }

  function makePdf(opt) {
    opt = opt || {};
    if (printing || document.getElementById('pdf-busy')) return;
    pdfBusy('PDF를 만들 준비를 하고 있어요…');
    var host = el('div', { class: 'pdf-host', 'aria-hidden': 'true' });
    var pbook = el('div', { class: 'book is-print' + (opt.flat ? ' is-flat' : ''), 'data-mode': 'spread' });
    host.append(pbook);
    document.body.append(host);
    // 표지는 가로 A4 한 장, 장면은 펼침면(가로 A4 두 쪽을 나란히, 594×210mm) 한 장으로
    var pdf, PH = 210, first = true, pendingHalf = null;
    var addCanvas = function (cv, sx, sw) {
      var part = document.createElement('canvas'); part.width = sw; part.height = cv.height;
      part.getContext('2d').drawImage(cv, sx, 0, sw, cv.height, 0, 0, sw, cv.height);
      var w = Math.round(PH * sw / cv.height);
      if (!first) pdf.addPage([w, PH], 'landscape');
      else if (w !== 297) { pdf.deletePage(1); pdf.addPage([w, PH], 'landscape'); }
      first = false;
      pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, PH);
    };
    var shoot = function (node) { return window.html2canvas(node, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true, logging: false }); };
    var chain = Promise.all([loadScript('js/vendor/jspdf.umd.min.js'), loadScript('js/vendor/html2canvas.min.js')]).then(function () {
      pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      // 표지
      pdfBusy('표지를 담고 있어요…');
      paintAuthor();
      var cover = document.getElementById('cover-card').cloneNode(true);
      cover.removeAttribute('id'); cover.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      cover.classList.add('is-print-cover');
      host.append(cover);
      return wait(300).then(function () { return shoot(cover); }).then(function (cv) { addCanvas(cv, 0, cv.width); cover.remove(); });
    });
    S.scenes.forEach(function (sc, i) {
      chain = chain.then(function () {
        pdfBusy('PDF를 만들고 있어요… (' + (i + 1) + ' / ' + S.scenes.length + ')');
        var keep = mode; mode = 'spread'; printing = true;
        var leaf;
        try { leaf = buildLeaf(i); } finally { printing = false; mode = keep; }
        leaf.classList.add('is-print-leaf');
        pbook.replaceChildren(leaf);
        var imgs = Array.prototype.slice.call(leaf.querySelectorAll('img'));
        return Promise.all(imgs.map(imgReady)).then(function () { return prepForPrint(leaf, sc); })
          .then(function () { return wait(700); })   // 글자 곡선·날씨 그림이 자리 잡을 때까지
          .then(function () { return shoot(pbook); })
          .then(function (cv) {
            if (sc.onePage) {
              // 한 쪽짜리 장면(#7 11쪽, #8 13쪽)은 왼쪽 쪽만 떼어 두었다가 둘을 이어 한 장으로 (빈 12·14쪽은 넣지 않는다)
              var halfW = Math.round(cv.width / 2), part = document.createElement('canvas');
              part.width = halfW; part.height = cv.height;
              part.getContext('2d').drawImage(cv, 0, 0, halfW, cv.height, 0, 0, halfW, cv.height);
              if (!pendingHalf) { pendingHalf = part; }
              else {
                var both = document.createElement('canvas'); both.width = pendingHalf.width + halfW; both.height = cv.height;
                var bg = both.getContext('2d'); bg.drawImage(pendingHalf, 0, 0); bg.drawImage(part, pendingHalf.width, 0);
                pendingHalf = null;
                addCanvas(both, 0, both.width);
              }
            } else {
              if (pendingHalf) { addCanvas(pendingHalf, 0, pendingHalf.width); pendingHalf = null; }
              addCanvas(cv, 0, cv.width);   // 펼침면 그대로 (양면)
            }
            (leaf._teardown || []).forEach(function (fn) { fn(); });
          });
      });
    });
    chain.then(function () {
      if (pendingHalf) { addCanvas(pendingHalf, 0, pendingHalf.width); pendingHalf = null; }
      pdfBusy('');
      host.remove();
      var n = (state.name || '').trim();
      pdf.save('별빛스프' + (n ? '-' + n : '') + '.pdf');
      toast('PDF로 저장했어요.');
    }, function (err) {
      pdfBusy('');
      host.remove();
      toast('PDF를 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
      if (window.console) console.error(err);
    });
  }

  /* ---------- 별빛스프 숟가락 ----------
     그릇 그림(08-soup-top.jpg)에는 숟가락이 없고, 같은 자리에 따로 놓는다 (tools/soup_top.py가 08-spoon.png와 자리를 만든다).
     그림과 같은 297:210 상자 안에서 % 위치라 재료 화면·젓기 화면·#8 13쪽 어디서나 같은 자리 */
  var SPOON = { x: 0.761, y: 0.069, w: 0.256, h: 0.912, hx: 0.58, hy: 0.13 };   // hx·hy: 숟가락 머리(오목한 곳) 위치
  function potSpoon() {
    // 바깥(.pot-spoon): 옮기기, 안(.pot-spoon-in): 손잡이 끝을 축으로 기울이기
    var inner = el('div', { class: 'pot-spoon-in' },
      el('img', { src: 'assets/backgrounds/08-spoon.png', alt: '', draggable: 'false' }),
      el('span', { class: 'pot-spoon-sink' }),     // 스프에 잠긴 부분 (숟가락 머리의 3/4을 덮는 스프)
      el('span', { class: 'pot-spoon-soup' }));    // 뜬 스프 (머리 가득)
    var wrap = el('div', { class: 'pot-spoon', 'aria-hidden': 'true' }, inner);
    wrap.style.left = SPOON.x * 100 + '%'; wrap.style.top = SPOON.y * 100 + '%';
    wrap.style.width = SPOON.w * 100 + '%'; wrap.style.height = SPOON.h * 100 + '%';
    wrap.style.transformOrigin = SPOON.hx * 100 + '% ' + SPOON.hy * 100 + '%';
    inner.style.transformOrigin = SPOON.hx * 100 + '% 96%';
    return wrap;
  }

  /* ---------- #8 13쪽: 떠먹기 ----------
     그릇 가운데 점선 원이 느릿하게 깜빡인다. 누르면
     ① 숟가락을 느릿하게 들어 올리고(슬로우 아웃) ② 그릇 가운데로 옮겨 ③ 슬로우 인으로 스프에 담가 머리의 3/4까지 잠기고 0.5초 기다린다
     ④ 살짝 뒤로 빼며 잠겼던 머리가 드러나면 스프가 가득 담겨 있고 ⑤ 손잡이를 축으로 왼쪽으로 기울며 떠 올리는 동안 스프가 점점 작아진다
     ⑥ 제자리로 돌아간다 */
  function soupScoop() {
    var box = el('div', { class: 'scoop-layer' });
    if (printing) { box.append(potSpoon()); return box; }
    var spoon = potSpoon(), inner = spoon.firstChild;
    var sink = spoon.querySelector('.pot-spoon-sink'), soup = spoon.querySelector('.pot-spoon-soup');
    var ring = el('button', { type: 'button', class: 'scoop-target', 'aria-label': '별빛스프 한 숟갈 떠먹기' });
    // '터치'는 원 위에 따로 얹어, 원과 같은 박자로 깜빡이되 더 밝게 (원은 0.25~1, 글자는 0.7~1). 누르면 아래 원이 받는다
    var label = el('span', { class: 'scoop-label', 'aria-hidden': 'true', text: '터치' });
    box.append(spoon, ring, label);
    var beat = { duration: 2400, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' };
    var blink = ring.animate ? ring.animate([{ opacity: 0.25 }, { opacity: 1 }], beat) : null;
    var blinkLabel = label.animate ? label.animate([{ opacity: 0.7 }, { opacity: 1 }], beat) : null;
    var busy = false;
    ring.addEventListener('click', function (e) {
      e.stopPropagation();
      if (busy || !spoon.animate) return;
      busy = true;
      if (blink) blink.pause();
      if (blinkLabel) blinkLabel.pause();
      // 한 번 떠먹으면 원과 '터치'는 사라진다 (다른 쪽에 갔다가 이 쪽으로 다시 오면 쪽을 새로 그리므로 다시 나타난다)
      ring.animate([{ opacity: getComputedStyle(ring).opacity }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      label.animate([{ opacity: getComputedStyle(label).opacity }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      ring.disabled = true;
      var W = box.clientWidth, H = box.clientHeight;
      var hx = (SPOON.x + SPOON.w * SPOON.hx) * W, hy = (SPOON.y + SPOON.h * SPOON.hy) * H;
      var tx = 0.5 * W - hx, ty = 0.51 * H - hy;
      var T = function (x, y, rot, sc) { return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot + 'deg) scale(' + sc + ')'; };
      var D = 5200, at = function (ms) { return ms / D; };
      var ease = { out: 'cubic-bezier(.15,.6,.3,1)', in: 'cubic-bezier(.55,0,.9,.4)', io: 'cubic-bezier(.45,0,.35,1)' };
      var back = H * 0.025;   // 살짝 뒤로(손잡이 쪽, 아래로) 빼기
      var a = spoon.animate([
        { transform: T(0, 0, 0, 1), easing: ease.out },
        { transform: T(-W * 0.02, -H * 0.05, -6, 1.06), offset: at(800), easing: ease.io },          // ① 느릿하게 들기 (슬로우 아웃)
        { transform: T(tx, ty - H * 0.06, -20, 1.06), offset: at(1650), easing: ease.in },             // ② 그릇 위로
        { transform: T(tx, ty, -20, 0.97), offset: at(2250) },                                       // ③ 슬로우 인으로 잠김
        { transform: T(tx, ty, -20, 0.97), offset: at(2750), easing: ease.io },                      //    0.5초 대기
        { transform: T(tx, ty + back, -20, 0.98), offset: at(3150), easing: ease.io },               // ④ 살짝 뒤로 빼기
        { transform: T(tx - W * 0.03, ty + back - H * 0.04, -20, 1.02), offset: at(4300), easing: ease.io },
        { transform: T(0, 0, 0, 1) }                                                                 // ⑥ 제자리
      ], { duration: D });
      inner.animate([                                                                                // ⑤ 손잡이를 축으로 왼쪽으로 기울기
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(0deg)', offset: at(3150), easing: ease.io },
        { transform: 'rotate(-26deg)', offset: at(4300), easing: ease.io },
        { transform: 'rotate(0deg)' }
      ], { duration: D });
      sink.animate([
        { opacity: 0 }, { opacity: 0, offset: at(1900), easing: ease.in },
        { opacity: 1, offset: at(2250) }, { opacity: 1, offset: at(2750), easing: ease.io },
        { opacity: 0, offset: at(3150) }, { opacity: 0 }
      ], { duration: D });
      soup.animate([
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1)', offset: at(2800) },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: at(3150), easing: ease.io },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(0.25)', offset: at(4300) },            //    떠 올리며 점점 작아짐
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.1)', offset: at(4500) },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.1)' }
      ], { duration: D });
      setTimeout(function () { sfx('dip'); }, 2150);     // 숟가락이 잠기는 소리
      setTimeout(function () { sfx('gulp'); }, 4300);    // 떠 올려 한입 꿀꺽
      setTimeout(function () {   // 잠기는 순간 파문
        var rip = el('span', { class: 'scoop-ring', 'aria-hidden': 'true' });
        box.append(rip);
        rip.animate([{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 }], { duration: 1000, easing: 'ease-out', fill: 'forwards' });
        setTimeout(function () { rip.remove(); }, 1020);
      }, 2150);
      var done = function () { ring.remove(); label.remove(); };
      a.finished.then(done, done);
    });
    return box;
  }

  /* ---------- 스프 완성: 그릇 가운데에서 별이 팡 튀어 오르고 금빛이 번진다 ----------
     카드 밖까지 날아가도록 화면 맨 위층(body)에 잠깐 붙였다 뗀다 */
  function starBurst(pot) {
    var r = pot.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.51, size = r.width * 0.467;
    var layer = el('div', { class: 'burst-layer', 'aria-hidden': 'true' });
    var flash = el('div', { class: 'burst-flash' });
    flash.style.left = cx + 'px'; flash.style.top = cy + 'px';
    flash.style.width = flash.style.height = size + 'px';
    layer.append(flash);
    if (flash.animate) {
      flash.animate([{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.95 }, { transform: 'translate(-50%, -50%) scale(1.9)', opacity: 0 }],
        { duration: 1600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    var glyphs = ['★', '✦', '★', '✧', '★'], colors = ['#ffd45e', '#fff3c4', '#ffb938', '#ffffff', '#ffe08a'];
    for (var i = 0; i < 22; i++) {
      var star = el('span', { class: 'burst-star', text: glyphs[i % glyphs.length] });
      var ang = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      var dist = size * (0.55 + Math.random() * 0.75);
      var px = Math.cos(ang) * dist, py = Math.sin(ang) * dist * 0.85 - size * 0.25;
      var fs = 20 + Math.random() * 20, spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360);
      star.style.left = cx + 'px'; star.style.top = cy + 'px';
      star.style.fontSize = fs + 'px'; star.style.color = colors[i % colors.length];
      layer.append(star);
      if (star.animate) {
        // 팡 튀어 나갔다가(빠르게) 꼭대기에서 잠깐 머물고, 살짝 떨어지며 반짝 사라진다
        star.animate([
          { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(0.2) rotate(0deg)', opacity: 1 },
          { transform: 'translate(-50%, -50%) translate(' + px.toFixed(1) + 'px, ' + py.toFixed(1) + 'px) scale(1.25) rotate(' + (spin * 0.6).toFixed(0) + 'deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(-50%, -50%) translate(' + (px * 1.08).toFixed(1) + 'px, ' + (py + size * 0.35).toFixed(1) + 'px) scale(0.5) rotate(' + spin.toFixed(0) + 'deg)', opacity: 0 }
        ], { duration: 2000 + Math.random() * 600, delay: Math.random() * 200, easing: 'cubic-bezier(.15,.8,.35,1)', fill: 'forwards' });
      }
    }
    document.body.append(layer);
    setTimeout(function () { layer.remove(); }, 3000);
  }

  /* ---------- 밀어서 넘기기 (터치·펜슬) ----------
     왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전. 미는 동안 책이 손가락을 살짝 따라온다. */
  var swipe = null;
  book.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || swipe || switching) return;
    if (e.target.closest('.sticker, input, textarea, .chips, .carousel, .tdraw-host, .win, .scoop-target, .inline-ask')) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dir: null, leaf: currentLeaf() };
  });
  book.addEventListener('pointermove', function (e) {
    if (!swipe || e.pointerId !== swipe.id || !swipe.leaf) return;
    var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (!swipe.dir && Math.hypot(dx, dy) > 10) swipe.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    if (swipe.dir !== 'h') return;
    var w = book.clientWidth || 1;
    swipe.leaf.style.transform = 'rotate(' + clamp(dx / w * 7, -7, 7) + 'deg)';
  });
  function endSwipe(e, cancelled) {
    if (!swipe || e.pointerId !== swipe.id) return;
    var s = swipe;
    swipe = null;
    var dx = e.clientX - s.x, dy = e.clientY - s.y;
    var fast = Math.abs(dx) / Math.max(1, performance.now() - s.t) > 0.5;
    var go2 = !cancelled && s.dir === 'h' && (Math.abs(dx) > 60 || (fast && Math.abs(dx) > 30)) && Math.abs(dx) > Math.abs(dy);
    if (s.leaf && s.leaf.style.transform) {
      var from = s.leaf.style.transform;
      s.leaf.style.transform = '';
      var atStart = state.scene === 0 && (mode === 'spread' || state.page === 0) && !S.scenes[0].asks;
      var turns = go2 && !(dx < 0 && (blockedHere() || atLastStep())) && !(dx > 0 && atStart);
      if (!turns) {
        // 넘기지 않을 때는 제자리로 부드럽게 돌아온다
        s.leaf.animate([{ transform: from }, { transform: 'rotate(0deg)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        dragFrom = from;
      }
    }
    if (go2) { if (dx < 0) next(); else prev(); }
    dragFrom = null;
  }
  book.addEventListener('pointerup', function (e) { endSwipe(e, false); });
  book.addEventListener('pointercancel', function (e) { endSwipe(e, true); });

  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  document.getElementById('btn-reread').addEventListener('click', function () { state.returnTo = null; go(0, 0); });
  var recapModal = document.getElementById('recap-modal');
  function closeRecap() { recapModal.hidden = true; }
  document.getElementById('btn-pdf').addEventListener('click', choosePdf);
  document.getElementById('btn-recap').addEventListener('click', function () {
    var body = document.getElementById('recap-body');
    body.replaceChildren(recap(ctx()));
    // '고치기'를 누르면 기록 창을 닫고 그 화면으로
    body.querySelectorAll('.link-btn').forEach(function (b) { b.addEventListener('click', closeRecap, true); });
    recapModal.hidden = false;
    document.getElementById('btn-recap-close').focus();
  });
  document.getElementById('btn-recap-close').addEventListener('click', closeRecap);
  recapModal.addEventListener('click', function (e) { if (e.target === recapModal) closeRecap(); });
  document.getElementById('btn-restart').addEventListener('click', function () {
    ask({
      title: '처음부터 다시 할까요?',
      message: '이름, 고른 음식, 착한 일, 스프의 맛, 직접 그린 그림과 스티커가 모두 지워져요.',
      ok: '다시 하기', cancel: '취소', danger: true
    }).then(function (yes) {
      if (!yes) return;
      resetAll();
      var leaf = currentLeaf();
      var toCover = function () {
        if (leaf) retire(leaf);
        showScreen('cover');
        enterCard(document.getElementById('cover-card'), -1);
        toast('새 이야기를 시작할 준비가 됐어요.');
      };
      if (leaf) leaveThen(leaf, -1, toCover); else toCover();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.hidden || document.documentElement.classList.contains('is-editing')) return;
    if (app.getAttribute('data-screen') !== 'book') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.classList.contains('sticker') || (t.closest && t.closest('.carousel')))) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  window.addEventListener('pagehide', saveNow);
  window.addEventListener('orientationchange', function () { window.dispatchEvent(new Event('resize')); });

  // 화면 모양이 바뀌면 펼침면/한 쪽 보기를 다시 고른다.
  // 단, 글을 입력하는 동안에는 바꾸지 않는다: 휴대폰 키보드가 올라오면 화면 높이가 확 줄어드는데,
  // 그때 책을 다시 그리면 입력칸이 새로 만들어져 키보드가 닫히고 글자가 써지지 않는다 (특히 가로 모드).
  var resizeTimer = 0;
  var modePending = false;
  function typingInBook() {
    var a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && book.contains(a);
  }
  function applyMode() {
    var m = pickMode();
    if (m === mode) return;
    mode = m;
    book.setAttribute('data-mode', mode);
    if (mode === 'spread' && !S.scenes[state.scene].askAt) state.page = 0;
    if (app.getAttribute('data-screen') === 'book') rerender();
  }
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (typingInBook()) { modePending = true; return; }
      applyMode();
    }, 120);
  });
  // 입력하는 동안에는 책 크기도 그대로 둔다 (키보드 때문에 책과 글자가 갑자기 작아지지 않게)
  book.addEventListener('focusin', function (e) {
    if (!typingInBook()) return;
    var r = book.getBoundingClientRect();
    book.style.width = r.width + 'px';
    book.style.maxWidth = 'none';
  });
  book.addEventListener('focusout', function () {
    setTimeout(function () {
      if (typingInBook()) return;
      book.style.width = '';
      book.style.maxWidth = '';
      if (modePending) { modePending = false; applyMode(); }
    }, 250);
  });

  /* ---------- 표지·사용 설명·책 화면 ---------- */
  var app = document.getElementById('app');
  var screens = {
    cover: document.getElementById('cover'),
    guide: document.getElementById('guide'),
    book: document.getElementById('stage'),
    deedPrompt: document.getElementById('deed-prompt'),
    ask: document.getElementById('ask')
  };
  var controlsEl = document.getElementById('controls');
  var stopCoverSparkles = null;
  var rotateHinted = false;

  function showScreen(name) {
    if (name !== 'ask') askId = null;   // 묻는 화면을 떠나면 '지금 묻는 중' 표시도 지운다
    if (name !== 'book') heardAt = '';   // 책을 떠났다 돌아오면 그 쪽의 소리를 다시
    if (name === 'cover') paintAuthor();
    app.setAttribute('data-screen', name);
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
    controlsEl.hidden = name !== 'book';
    if (name === 'cover' && !stopCoverSparkles) {
      var cv = el('canvas', { class: 'sparkles', 'aria-hidden': 'true' });
      document.getElementById('cover-art').append(cv);
      stopCoverSparkles = sparkles(cv);
    } else if (name !== 'cover' && stopCoverSparkles) {
      stopCoverSparkles();
      stopCoverSparkles = null;
      var old = document.querySelector('#cover-art .sparkles');
      if (old) old.remove();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // 화면 하나가 카드처럼 빠진 다음 다른 화면으로 바꾼다
  // 화면이 바뀌는 동안에는 새 입력을 받지 않는다 (두 번 눌러 애니메이션이 겹치지 않게)
  var switching = false;
  function stopAnims(elm) { if (elm && elm.getAnimations) elm.getAnimations().forEach(function (a) { a.cancel(); }); }

  // 나가는 화면의 '사진'(복제본)을 그 자리에 띄워 두고, 새 화면을 바로 준비해서 둘이 동시에 움직인다.
  // (예전에는 나가는 화면이 다 빠진 뒤에야 새 화면을 그리고 들어와서, 같은 움직임이 두 번 이어지고
  //  그 사이에 화면을 그리느라 멈칫했다. 이제 그리는 일은 움직이기 전에 끝내고, 책장처럼 한 번에 넘어간다)
  function ghostOf(elm) {
    var r = elm.getBoundingClientRect();
    var layer = el('div', { class: 'ghost-layer', 'aria-hidden': 'true' });
    var clone = elm.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    // 캔버스(날씨·반짝이·스프)는 복제되지 않으니 지금 그림을 옮겨 그린다
    var from = elm.querySelectorAll('canvas'), to = clone.querySelectorAll('canvas');
    for (var i = 0; i < from.length && i < to.length; i++) {
      try { to[i].width = from[i].width; to[i].height = from[i].height; to[i].getContext('2d').drawImage(from[i], 0, 0); } catch (e) { /* 그릴 수 없으면 비워 둔다 */ }
    }
    var box = clone;
    if (elm.classList.contains('leaf')) {
      // 책장은 책 틀(한 쪽/펼침 보기 규칙)이 있어야 제 모양이라 빈 책 틀에 넣는다
      var br = book.getBoundingClientRect();
      box = el('div', { class: 'book', 'data-mode': book.getAttribute('data-mode') || '' }, clone);
      r = br;
      clone.classList.add('is-leaving');
    }
    box.style.position = 'fixed';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    box.style.margin = '0';
    box.style.maxWidth = 'none';
    box.style.aspectRatio = 'auto';
    layer.append(box);
    document.body.append(layer);
    return { layer: layer, el: clone };
  }

  function leaveThen(card, dir, fn) {
    if (switching) return;
    switching = true;
    controlsEl.hidden = true;
    stopAnims(card);
    if (!card.animate) { fn(); return; }
    hideDocks();
    if (window.StarSoupSound) window.StarSoupSound.flip();
    var g = ghostOf(card);
    fn();                       // 새 화면을 지금 그린다 (들어오는 움직임은 다음 프레임에 시작)
    var d = -ARC.deg * dir;
    nextFrame(function () {
      // 나가는 화면은 들어오는 화면보다 빨리, 점점 빨라지며 끝까지 투명해진다
      // (끝에서 느려지면 거의 투명한 채로 머물러 걸린 듯 보이고, 들어오는 삽화와 오래 겹친다)
      var anim = g.el.animate([
        { transform: 'rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'rotate(' + d * 0.6 + 'deg) scale(.96)', opacity: 0 }
      ], { duration: Math.round(ARC.duration * 0.5), easing: 'cubic-bezier(.45,0,.85,.45)', fill: 'forwards' });
      var drop = function () { g.layer.remove(); };
      anim.finished.then(drop, drop);
    });
  }
  function enterCard(card, dir) {
    var done = function () { switching = false; };
    if (!card.animate) { done(); return; }
    stopAnims(card);
    var actions = card.parentNode.querySelector('.intro-actions');
    card.style.opacity = '0';
    if (actions) actions.style.opacity = '0';
    nextFrame(function () {
      card.style.opacity = '';
      if (actions) actions.style.opacity = '';
      // 나가는 화면과 같은 시간·같은 곡선으로 반대편에서 들어온다 (책장 넘김과 같은 움직임)
      var d = ARC.deg * dir;
      var anim = card.animate([
        { transform: 'rotate(' + d + 'deg) scale(.94)', opacity: 0 },
        { transform: 'rotate(' + d * 0.45 + 'deg) scale(.975)', opacity: 1, offset: 0.6 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1 }
      ], { duration: ARC.duration, easing: ARC.easing });
      // 아래 버튼들은 카드가 거의 자리 잡은 뒤 살며시 나타난다
      if (actions) actions.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 360, delay: ARC.duration * 0.6, easing: 'ease-out', fill: 'backwards' });
      anim.finished.then(done, done);
    });
  }

  function openGuide() {
    leaveThen(document.getElementById('cover-card'), 1, function () {
      showScreen('guide');
      enterCard(document.getElementById('guide-card'), 1);
    });
  }
  function backToCover() {
    leaveThen(document.getElementById('guide-card'), -1, function () {
      showScreen('cover');
      enterCard(document.getElementById('cover-card'), -1);
    });
  }

  function enterBook(index, page, dir) {
    state.scene = clamp(index, 0, LAST);
    state.page = mode === 'single' || S.scenes[state.scene].askAt ? Math.min(page || 0, mode === 'single' ? lastPage(S.scenes[state.scene]) : 1) : 0;
    state.maxScene = Math.max(state.maxScene, state.scene);
    showScreen('book');
    saveNow();
    if (mode === 'single' && window.innerHeight > window.innerWidth && window.innerWidth < 700 && !rotateHinted) {
      rotateHinted = true;
      setTimeout(function () { toast('휴대폰을 가로로 돌리면 펼친 책으로 크게 볼 수 있어요.', 4200); }, 900);
    }
    var leaf = render(false);
    if (leaf.animate) {
      leaf.style.opacity = '0';
      nextFrame(function () {
        leaf.style.opacity = '';
        var a = arcIn(leaf, dir || 1);
        a.finished.then(function () { switching = false; }, function () { switching = false; });
      });
    } else {
      switching = false;
    }
  }

  // 지난 기록(이름·선택·그림·스티커)을 모두 지운다
  function resetAll() {
    state = freshState();
    images = {};
    saved = { scene: 0, page: 0 };
    store.clear();
  }

  function start(card) {
    if (switching) return;
    var resumeAt = saved.scene, resumePage = saved.page;
    var begin = function (i, p) {
      var first = S.scenes[0].asks;
      if (i === 0 && !p && first) { showAsk(first[0], 1, card); return; }
      leaveThen(card, 1, function () { enterBook(i, p); });
    };
    if (resumeAt > 0 || resumePage > 0) {
      ask({
        title: '읽던 이야기가 있어요',
        message: '#' + (resumeAt + 1) + ' 장면까지 읽었어요. 처음부터 새로 하면 지난번에 적은 이름, 고른 음식, 그림이 모두 지워져요.',
        ok: '이어서 읽기', cancel: '처음부터 새로'
      }).then(function (answer) {
        if (answer === null) return;          // 창 바깥을 누르면 아무것도 하지 않음
        if (answer) { saved = { scene: 0, page: 0 }; begin(resumeAt, resumePage); }
        else { resetAll(); begin(0, 0); toast('지난 기록을 지우고 새로 시작해요.'); }
      });
    } else {
      begin(0, 0);
    }
  }

  document.getElementById('btn-start').addEventListener('click', function () {
    if (window.StarSoupSound) window.StarSoupSound.start();   // 처음 누를 때 배경 음악을 켠다 (브라우저는 누르기 전엔 소리를 막는다)
    sfx('begin');
    start(document.getElementById('cover-card'));
  });
  // 소리 켜기/끄기 (오른쪽 위)
  var soundBtn = document.getElementById('btn-sound');
  var paintSound = function () {
    var on = window.StarSoupSound && window.StarSoupSound.isOn();
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
  };
  if (soundBtn) {
    paintSound();
    soundBtn.addEventListener('click', function () { if (window.StarSoupSound) { window.StarSoupSound.toggle(); paintSound(); } });
  }
  document.getElementById('btn-guide').addEventListener('click', function () { sfx('tap'); openGuide(); });
  document.getElementById('btn-guide-back').addEventListener('click', function () { sfx('tap'); backToCover(); });
  document.getElementById('btn-guide-start').addEventListener('click', function () {
    if (window.StarSoupSound) window.StarSoupSound.start();
    sfx('begin');
    start(document.getElementById('guide-card'));
  });

  // 표지의 저자: 이름을 정하기 전에는 '당신', 정한 뒤에는 그 이름
  function paintAuthor() {
    var n = (state.name || '').trim(), box = document.getElementById('cover-author');
    if (box) box.textContent = '저자: ' + (n || '당신');
  }

  function paintCover() {
    var c = S.cover;
    document.getElementById('cover-kicker').textContent = c.kicker;
    document.getElementById('cover-title').textContent = c.title;
    document.getElementById('cover-sub').textContent = c.subtitle;
    paintAuthor();
    document.getElementById('build-tag').textContent = 'V' + S.version;
    var artBox = document.getElementById('cover-art');
    artBox.insertAdjacentHTML('beforeend', S.motifs.coverArt || S.motifs.soup); // 코드에 고정된 그림만
    if (c.image) {
      var img = new Image();
      img.alt = '';
      img.onload = function () { artBox.classList.add('has-image'); img.classList.add('is-loaded'); };
      img.onerror = function () { img.remove(); };
      img.src = c.image;
      artBox.append(img);
    }
  }

  /* ---------- 시작 ---------- */
  var saved = { scene: 0, page: 0 };
  function loadImages() {
    var keys = [IMG_FOOD, IMG_DEED, IMG_DEED_BASE, IMG_WEATHER, IMG_WAKE, IMG_TASTE, IMG_BOARD].concat(state.soup.map(function (g) { return 'soup-' + g.id; }));
    return Promise.all(keys.map(function (k) {
      return store.getImage(k).then(function (v) { if (typeof v === 'string') images[k] = v; }, function () {});
    }));
  }

  /* ---------- 그림 미리 불러 두기 ----------
     책을 펴기 전에 삽화·음식·스프 그림을 차례로 받아 풀어 둔다(decode). 쪽에 들어갈 때 그림을 새로 받느라 멈칫하지 않게.
     지금 장면 둘레부터 먼저, 한 번에 두 장씩 */
  var preloaded = [];
  function preloadArt() {
    var urls = [];
    var add = function (u) { if (u && typeof u === 'string' && !/^data:/.test(u) && urls.indexOf(u) < 0) urls.push(u); };
    var order = S.scenes.map(function (sc, i) { return i; }).sort(function (a, b) { return Math.abs(a - state.scene) - Math.abs(b - state.scene); });
    order.forEach(function (i) {
      var sc = S.scenes[i];
      add(sc.image); add(sc.overlay);
      sc.pages.forEach(function (p) { if (typeof p.image === 'string') add(p.image); });
    });
    S.foods.forEach(function (f) { add(f.image); });
    S.tastes.forEach(function (t) { add(t.image); });
    ['assets/backgrounds/08-spoon.png', 'assets/backgrounds/08-soup-raw.png'].forEach(add);
    var next = function () {
      var u = urls.shift();
      if (!u) return;
      var im = new Image();
      im.decoding = 'async';
      im.src = u;
      preloaded.push(im);
      var go = function () { setTimeout(next, 30); };
      (im.decode ? im.decode() : Promise.reject()).then(go, function () { im.onload = go; im.onerror = go; if (im.complete) go(); });
    };
    next(); next();
  }

  function boot() {
    mode = pickMode();
    book.setAttribute('data-mode', mode);
    paintCover();
    showScreen('cover');
    setTimeout(preloadArt, 300);   // 표지를 먼저 그린 뒤 그림을 미리 받아 둔다
    var res = store.load();
    if (res.error) toast('지난번 기록을 불러오지 못했어요. 처음부터 시작할게요.', 3600);
    if (res.data) state = sanitize(res.data);
    saved = { scene: state.scene, page: state.page };
    loadImages().then(function () {
      ensureDeedSticker();
      if (state.food === 'custom' && !images[IMG_FOOD]) {
        state.food = null;
        toast('지난번에 그린 음식 그림을 불러오지 못했어요. 다시 골라 주세요.', 3600);
      }
    });
  }

  boot();
})();

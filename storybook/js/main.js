/* 별빛스프 — 화면 그리기와 장면 이동 */
(function () {
  'use strict';

  var S = window.StarSoup;
  var store = window.StarSoupStorage;
  var LAST = S.scenes.length - 1;
  var ENDING = LAST;

  var stage = document.getElementById('stage');
  var progress = document.getElementById('progress');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var controls = document.getElementById('controls');

  function freshState() {
    return { version: 1, scene: 0, maxScene: 0, name: '', food: null, deed: '', taste: null, returnTo: null };
  }
  var state = freshState();
  var teardown = [];
  var direction = 1;

  /* ---------- 작은 도우미 ---------- */
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

  function ctx() {
    var name = state.name.trim();
    return {
      name: name,
      hasName: !!name,
      you: name || '당신',
      deed: state.deed.trim(),
      food: S.foods.find(function (f) { return f.id === state.food; }) || null,
      taste: S.tastes.find(function (t) { return t.id === state.taste; }) || null
    };
  }

  // 문단 배열 → <p>들. 사용자 값은 textContent로만 넣는다.
  function paragraphs(list) {
    return list.map(function (para) {
      var coda = !Array.isArray(para) && para.coda;
      var parts = coda ? para.parts : para;
      var p = el('p', { class: 'story' + (coda ? ' is-coda' : '') });
      parts.forEach(function (seg) {
        if (typeof seg === 'string') p.append(document.createTextNode(seg));
        else p.append(el('span', { class: 'v' + (seg.quote ? ' is-quote' : ''), text: seg.v }));
      });
      return p;
    });
  }

  function eyebrow(scene, index) {
    var act = S.acts[scene.act];
    return el('p', { class: 'eyebrow' },
      el('span', { text: act.label + ' · ' + act.title }),
      el('span', { class: 'no', text: '#' + (index + 1) }));
  }

  // 삽화 자리: 임시 그림을 깔고, 실제 이미지가 불러와지면 그 위를 덮는다.
  function art(opts) {
    var box = el('div', { class: 'art', 'data-fit': opts.fit });
    var ph = el('div', { class: 'ph', 'data-tone': opts.tone || 'night', 'aria-hidden': 'true' });
    if (opts.glow) ph.style.setProperty('--glow', opts.glow);
    if (opts.emoji) ph.append(el('span', { class: 'ph-emoji', text: opts.emoji }));
    else if (opts.motif && S.motifs[opts.motif]) ph.insertAdjacentHTML('beforeend', S.motifs[opts.motif]); // 코드에 고정된 그림만
    if (opts.note && opts.image && S.showAssetNotes) ph.append(el('span', { class: 'ph-note', text: '삽화 자리 · ' + opts.image }));
    box.append(ph);
    if (opts.image) {
      var img = new Image();
      img.alt = opts.alt || '';
      img.decoding = 'async';
      img.onload = function () { img.classList.add('is-loaded'); };
      img.onerror = function () { img.remove(); };
      img.src = opts.image;
      box.append(img);
    }
    return box;
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
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Tab') { // 두 버튼 사이에서만 포커스가 돈다
          e.preventDefault();
          (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
        }
      }
      function onBackdrop(e) { if (e.target === modal) done(false); }
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

  function sanitize(raw) {
    var s = freshState();
    var str = function (v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; };
    s.name = str(raw.name, S.limits.name);
    s.deed = str(raw.deed, S.limits.deed);
    s.food = S.foods.some(function (f) { return f.id === raw.food; }) ? raw.food : null;
    s.taste = S.tastes.some(function (t) { return t.id === raw.taste; }) ? raw.taste : null;
    var n = function (v) { return Number.isInteger(v) ? Math.max(0, Math.min(LAST, v)) : 0; };
    s.maxScene = n(raw.maxScene);
    s.scene = Math.min(n(raw.scene), s.maxScene);
    return s;
  }

  /* ---------- 장면 만들기 ---------- */
  function buildScene(index) {
    var scene = S.scenes[index];
    var c = ctx();
    var root = el('section', { class: 'scene scene--' + scene.layout + (direction < 0 ? ' is-back' : ''), 'aria-labelledby': 'scene-title' });
    var head = eyebrow(scene, index);
    head.id = 'scene-title';

    if (scene.layout === 'hero' || scene.layout === 'ending') {
      var a = art({ image: scene.image, alt: scene.alt, tone: scene.tone, motif: scene.motif, note: true });
      if (scene.effect === 'sparkles') {
        var cv = el('canvas', { class: 'sparkles', 'aria-hidden': 'true' });
        a.append(cv);
        teardown.push(sparkles(cv));
      }
      if (scene.layout === 'hero') {
        a.append(el('div', { class: 'overlay' }, head, paragraphs(scene.text(c))));
        root.append(el('div', { class: 'card' }, a));
      } else {
        root.append(el('div', { class: 'card' }, a, el('div', { class: 'body' }, head, paragraphs(scene.text(c)))));
        root.append(endingLower(c));
      }
      return root;
    }

    if (scene.layout === 'split') {
      var art2 = art({ image: scene.image, alt: scene.alt, tone: scene.tone, motif: scene.motif, note: true });
      var body = el('div', { class: 'body' }, head, paragraphs(scene.text(c)));
      if (scene.input === 'name') nameInput(body, art2);
      if (scene.input === 'deed') deedInput(body);
      root.append(el('div', { class: 'card card--split' }, art2, body));
      return root;
    }

    // choice
    var side = el('div', { class: 'choice-side' },
      el('div', { class: 'card' }, el('div', { class: 'body' }, head, paragraphs(scene.text(c)))));
    var picker = scene.choice === 'food' ? foodPicker(side) : tastePicker(side);
    root.append(side, picker);
    return root;
  }

  function nameInput(body, artBox) {
    var plate = el('div', { class: 'nameplate', 'aria-hidden': 'true' });
    function paint() {
      var v = state.name.trim();
      plate.textContent = v || '이름표';
      plate.classList.toggle('is-empty', !v);
    }
    paint();
    artBox.append(plate);

    var input = el('input', {
      class: 'input', id: 'input-name', type: 'text', maxlength: S.limits.name,
      placeholder: '예: 하늘', autocomplete: 'off', enterkeyhint: 'next'
    });
    input.value = state.name;
    input.addEventListener('input', function () {
      state.name = input.value.slice(0, S.limits.name);
      paint();
      updateControls();
      saveSoon();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); next(); }
    });
    body.append(el('div', { class: 'field' },
      el('label', { for: 'input-name', text: '나의 이름' }),
      input,
      el('p', { class: 'hint', text: '비워 두면 이야기 속에서 ‘당신’이라고 불러요.' })));
  }

  function deedInput(body) {
    var area = el('textarea', {
      class: 'input', id: 'input-deed', maxlength: S.limits.deed, rows: 3,
      placeholder: '예: 동생에게 장난감을 양보했어요'
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
          onclick: function () { area.value = ex; state.deed = ex; count(); saveSoon(); area.focus(); }
        });
      }));
    body.append(
      el('div', { class: 'field' },
        el('label', { for: 'input-deed', text: '내가 한 착한 일' }),
        area,
        el('div', { class: 'field-foot' },
          el('p', { class: 'hint', text: '비워 두어도 이야기는 이어져요.' }),
          counter)),
      chips,
      el('button', { type: 'button', class: 'btn btn-soft btn-small', disabled: true, text: '그림으로 장면 꾸미기 · 준비 중' }));
  }

  function tile(item, pressed, onPick, sub) {
    return el('button', {
      type: 'button', class: 'tile', 'aria-pressed': pressed ? 'true' : 'false', 'data-id': item.id,
      onclick: function () { onPick(item); }
    },
      (function () {
        var a = art({ image: item.image, alt: '', tone: 'tile', glow: item.glow, emoji: item.emoji });
        a.append(el('span', { class: 'check', 'aria-hidden': 'true' },
          svgCheck()));
        return a;
      })(),
      el('span', { class: 'tile-label' }, item.name || item.label, sub ? el('small', { text: sub }) : null));
  }

  function svgCheck() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3');
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

  function foodPicker(side) {
    var reveal = el('div', { class: 'card reveal', 'aria-live': 'polite' });
    function paintReveal(pop) {
      var f = ctx().food;
      reveal.replaceChildren(el('div', { class: 'body' },
        el('p', { class: 'eyebrow', text: f ? '한입 냠, ' + f.name : '고르면 맛이 보여요' }),
        el('p', { class: 'story', text: f ? f.desc : '카드를 눌러 먹고 싶은 음식을 골라 보세요.' })));
      reveal.classList.toggle('is-empty', !f);
      if (pop) { reveal.classList.remove('is-pop'); void reveal.offsetWidth; reveal.classList.add('is-pop'); }
    }
    paintReveal(false);
    side.append(reveal);

    var grid = el('div', { class: 'grid', role: 'group', 'aria-label': '음식 고르기' });
    S.foods.forEach(function (f) {
      grid.append(tile(f, state.food === f.id, function (item) {
        state.food = item.id;
        markPressed(grid, item.id);
        paintReveal(true);
        updateControls();
        saveSoon();
      }));
    });
    return grid;
  }

  function tastePicker(side) {
    var line = el('p', { class: 'hint' });
    function paintLine() {
      var t = ctx().taste;
      line.textContent = t ? '입 안 가득 ' + t.label + S.josa(t.label, '이/가') + ' 퍼졌어요.' : '하나를 골라 주세요. 나중에 엔딩에서 바꿀 수도 있어요.';
    }
    paintLine();
    side.querySelector('.body').append(line);

    var grid = el('div', { class: 'grid grid--taste', role: 'group', 'aria-label': '스프의 맛 고르기' });
    S.tastes.forEach(function (t) {
      grid.append(tile(t, state.taste === t.id, function (item) {
        state.taste = item.id;
        markPressed(grid, item.id);
        paintLine();
        updateControls();
        saveSoon();
      }));
    });
    return grid;
  }

  function endingLower(c) {
    function row(label, value, sceneIndex, emptyText) {
      return el('div', { class: 'recap-row' },
        el('dt', { text: label }),
        el('dd', { class: value ? '' : 'is-empty', text: value || emptyText }),
        el('button', { type: 'button', class: 'link-btn', text: '고치기', 'aria-label': label + ' 고치기', onclick: function () { editFrom(sceneIndex); } }));
    }
    var recap = el('div', { class: 'card recap' }, el('div', { class: 'body' },
      el('h2', { text: c.you + '의 별빛스프 이야기' }),
      el('dl', null,
        row('이름', c.name, 2, '아직 비어 있어요'),
        row('처음 고른 음식', c.food && c.food.name, 3, '고르지 않았어요'),
        row('착한 일', c.deed, 5, '비워 두었어요'),
        row('스프의 맛', c.taste && c.taste.label, 8, '고르지 않았어요'))));

    var actions = el('div', { class: 'card' }, el('div', { class: 'body' },
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn btn-primary', text: '완성된 동화 다시 보기', onclick: function () { state.returnTo = null; go(0); } }),
        el('button', { type: 'button', class: 'btn btn-ghost', text: '처음부터 다시 하기', onclick: restart }),
        el('button', { type: 'button', class: 'btn btn-soft', disabled: true, text: 'PDF로 저장하기' })),
      el('p', { class: 'soon', text: 'PDF 저장은 다음 단계에서 열려요.' })));

    return el('div', { class: 'ending-lower' }, recap, actions);
  }

  function editFrom(index) {
    state.returnTo = ENDING;
    go(index);
  }

  function restart() {
    ask({
      title: '처음부터 다시 할까요?',
      message: '이름, 고른 음식, 착한 일, 스프의 맛이 모두 지워져요.',
      ok: '다시 하기', cancel: '취소', danger: true
    }).then(function (yes) {
      if (!yes) return;
      state = freshState();
      store.clear();
      go(0);
      toast('새 이야기를 시작해요.');
    });
  }

  /* ---------- 별빛 효과 (#8) ---------- */
  function sparkles(canvas) {
    var g = canvas.getContext && canvas.getContext('2d');
    if (!g) return function () {};
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        x: w * (0.22 + Math.random() * 0.56),
        y: anywhere ? h * (0.15 + Math.random() * 0.6) : h * (0.55 + Math.random() * 0.12),
        r: 1.6 + Math.random() * 3.6,
        vy: 0.15 + Math.random() * 0.4,
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
        s.life++;
        s.y -= s.vy;
        s.x += Math.sin(t / 900 + s.ph) * 0.22;
        if (s.life > s.max || s.y < -10) { list[i] = spawn(false); continue; }
        var fade = Math.max(0, Math.min(1, s.life / 40, (s.max - s.life) / 60));
        drawStar(s.x, s.y, s.r, fade * (0.55 + 0.45 * Math.sin(t / 280 + s.ph)));
      }
      g.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    // 화면에 붙은 다음 프레임에 크기를 재고 시작한다
    raf = requestAnimationFrame(function (t) {
      resize();
      if (ro) ro.observe(canvas);
      for (var i = 0; i < 30; i++) list.push(spawn(true));
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
          onclick: function () { if (i !== state.scene) go(i); }
        }));
      });
      progress.append(group);
    });
  }

  function missing(scene) {
    return scene.require && !state[scene.require];
  }

  function updateControls() {
    var scene = S.scenes[state.scene];
    btnPrev.disabled = state.scene === 0;
    controls.hidden = false;
    btnNext.hidden = state.scene === LAST;
    if (state.scene === LAST) return;
    var label = typeof scene.nextLabel === 'function' ? scene.nextLabel(ctx()) : (scene.nextLabel || '다음');
    if (state.returnTo != null && state.scene < state.returnTo) label = '엔딩으로 돌아가기';
    btnNext.textContent = label;
    btnNext.toggleAttribute('data-blocked', !!missing(scene));
  }

  /* ---------- 이동 ---------- */
  function render(focus) {
    teardown.forEach(function (fn) { fn(); });
    teardown = [];
    stage.replaceChildren(buildScene(state.scene));
    renderProgress();
    updateControls();
    if (focus) {
      var title = document.getElementById('scene-title');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    }
  }

  function go(index) {
    index = Math.max(0, Math.min(LAST, index));
    direction = index >= state.scene ? 1 : -1;
    state.scene = index;
    state.maxScene = Math.max(state.maxScene, index);
    if (index === ENDING) state.returnTo = null;
    saveNow();
    render(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function next() {
    var scene = S.scenes[state.scene];
    if (state.scene >= LAST) return;
    if (missing(scene)) {
      toast(scene.requireMessage);
      var grid = stage.querySelector('.grid');
      if (grid) { grid.classList.remove('is-shake'); void grid.offsetWidth; grid.classList.add('is-shake'); }
      return;
    }
    go(state.returnTo != null && state.scene < state.returnTo ? state.returnTo : state.scene + 1);
  }

  function prev() { if (state.scene > 0) go(state.scene - 1); }

  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);

  document.addEventListener('keydown', function (e) {
    if (!modal.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  window.addEventListener('pagehide', saveNow);

  /* ---------- 시작 ---------- */
  function boot() {
    var res = store.load();
    if (res.error) toast('지난번 기록을 불러오지 못했어요. 처음부터 시작할게요.', 3600);
    if (res.data) state = sanitize(res.data);
    var resumeAt = state.scene;
    state.scene = 0;
    render(false);
    if (resumeAt > 0) {
      ask({
        title: '읽던 이야기가 있어요',
        message: '#' + (resumeAt + 1) + ' 장면까지 읽었어요. 이어서 읽을까요?',
        ok: '이어서 읽기', cancel: '첫 장면부터'
      }).then(function (yes) { if (yes) go(resumeAt); });
    }
  }

  boot();
})();

/* 별빛스프 — 책 화면, 장면 넘기기, 스티커 */
(function () {
  'use strict';

  var S = window.StarSoup;
  var store = window.StarSoupStorage;
  var LAST = S.scenes.length - 1;
  var IMG_FOOD = 'food-custom';
  var IMG_DEED = 'deed-art';

  var book = document.getElementById('book');
  var progress = document.getElementById('progress');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var endActions = document.getElementById('end-actions');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function freshState() {
    return {
      version: 2, scene: 0, page: 0, maxScene: 0,
      name: '', food: null, customFoodName: '', deed: '', taste: null,
      stickers: {}, returnTo: null
    };
  }
  var state = freshState();
  var images = {};      // 직접 그린 그림 (IndexedDB에서 불러온 data URL)
  var direction = 1;
  var mode = 'spread';  // spread: 두 쪽을 함께 / single: 한 쪽씩

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
    c.taste = S.tastes.find(function (t) { return t.id === state.taste; }) || null;
    return c;
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
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Tab') {
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
    s.taste = S.tastes.some(function (t) { return t.id === raw.taste; }) ? raw.taste : null;
    s.maxScene = Number.isInteger(raw.maxScene) ? clamp(raw.maxScene, 0, LAST) : 0;
    s.scene = Number.isInteger(raw.scene) ? clamp(raw.scene, 0, s.maxScene) : 0;
    s.page = raw.page === 1 ? 1 : 0;
    if (raw.stickers && typeof raw.stickers === 'object') {
      S.scenes.forEach(function (sc) {
        var list = raw.stickers[sc.id];
        if (!Array.isArray(list)) return;
        s.stickers[sc.id] = list.filter(function (st) {
          return st && (st.kind === 'food' || st.kind === 'deed');
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
  function pickMode() {
    return window.innerWidth >= 900 && window.innerWidth / window.innerHeight >= 1.15 ? 'spread' : 'single';
  }

  /* ---------- 삽화 자리 (임시 그림) ---------- */
  function motif(name, pos) {
    if (!name || !S.motifs[name]) return null;
    var box = el('div', { class: 'pg-art', 'data-pos': pos || 'center', 'aria-hidden': 'true' });
    box.insertAdjacentHTML('beforeend', S.motifs[name]); // 코드에 고정된 그림만
    return box;
  }

  function eyebrow(scene, index) {
    var act = S.acts[scene.act];
    return el('p', { class: 'eyebrow' },
      el('span', { text: act.label + ' · ' + act.title }),
      el('span', { class: 'no', text: '#' + (index + 1) }));
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
      bg.append(img);
      if (S.showAssetNotes) bg.append(el('span', { class: 'asset-note', text: '펼침면 삽화 자리 · ' + scene.image }));
    }
    spread.append(bg);

    scene.pages.forEach(function (p, pi) {
      var page = el('section', {
        class: 'page page--' + (pi ? 'right' : 'left'),
        'aria-label': (pi ? '오른쪽' : '왼쪽') + ' 쪽'
      });
      var dense = (p.widgets || []).indexOf('food-grid') >= 0;
      var pg = el('div', { class: 'pg' + (dense ? ' pg--dense' : ''), 'data-place': p.place || 'top' });
      if (p.image) {
        var pimg = new Image();
        pimg.alt = '';
        pimg.className = 'page-img';
        pimg.decoding = 'async';
        pimg.onload = function () { page.classList.add('has-image'); pimg.classList.add('is-loaded'); };
        pimg.onerror = function () { pimg.remove(); };
        pimg.src = p.image;
        page.append(pimg);
      }
      if (p.art) {
        var m = motif(p.art, p.artPos);
        if (p.faint) m.classList.add('is-faint');
        pg.append(m);
      }
      if (p.text) {
        var block = el('div', { class: 'pg-text is-panel' }, eyebrow(scene, index), paragraphs(scene.text(c)));
        if (index === 0 && pi === 1) block.id = 'scene-title';
        pg.append(block);
      }
      (p.widgets || []).forEach(function (w) { append(pg, widget(w, c, leaf, index)); });
      page.append(pg, el('span', { class: 'folio', 'aria-hidden': 'true', text: index * 2 + pi + 1 }));
      spread.append(page);
    });

    if (scene.effect === 'sparkles') {
      var cv = el('canvas', { class: 'sparkles', 'aria-hidden': 'true' });
      spread.append(cv);
      leaf._teardown.push(sparkles(cv));
    }

    var layer = el('div', { class: 'stickers' });
    spread.append(layer);
    leaf._stickers = layer;
    leaf._sceneId = scene.id;
    paintStickers(leaf);

    leaf.append(spread);
    // 스티커 바깥을 누르면 선택 해제
    leaf.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.sticker')) selectSticker(leaf, null);
    });
    return leaf;
  }

  /* ---------- 쪽 위의 입력 도구 ---------- */
  function widget(name, c, leaf, index) {
    switch (name) {
      case 'nameplate': {
        var v = c.name;
        return el('div', { class: 'nameplate' + (v ? '' : ' is-empty'), 'aria-hidden': 'true', text: v || '이름표' });
      }
      case 'name': return nameField(leaf);
      case 'food-grid': return foodGrid(leaf);
      case 'food-result': return foodResult(c);
      case 'deed': return deedField(leaf);
      case 'deed-art': return images[IMG_DEED]
        ? el('figure', { class: 'polaroid' }, el('img', { src: images[IMG_DEED], alt: '내가 그린 착한 일' }), el('figcaption', { text: '내가 한 착한 일' }))
        : null;
      case 'taste': return tasteList(leaf);
      case 'recap': return recap(c);
    }
    return null;
  }

  function nameField(leaf) {
    var input = el('input', {
      class: 'input', id: 'input-name', type: 'text', maxlength: S.limits.name,
      placeholder: '예: 하늘', autocomplete: 'off', enterkeyhint: 'next'
    });
    input.value = state.name;
    input.addEventListener('input', function () {
      state.name = input.value.slice(0, S.limits.name);
      var plate = leaf.querySelector('.nameplate');
      if (plate) {
        plate.textContent = state.name.trim() || '이름표';
        plate.classList.toggle('is-empty', !state.name.trim());
      }
      updateControls();
      saveSoon();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); next(); }
    });
    return el('div', { class: 'field' },
      el('label', { for: 'input-name', text: '나의 이름' }),
      input,
      el('p', { class: 'hint', text: '비워 두면 이야기 속에서 ‘당신’이라고 불러요.' }));
  }

  function tile(opts) {
    var art = el('span', { class: 'tile-art', 'aria-hidden': 'true' });
    if (opts.glow) art.style.setProperty('--glow', opts.glow);
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

  function foodGrid(leaf) {
    var grid = el('div', { class: 'grid grid--food', role: 'group', 'aria-label': '음식 고르기' });
    S.foods.forEach(function (f) {
      grid.append(tile({
        id: f.id, label: f.name, image: f.image, emoji: f.emoji, glow: f.glow, pressed: state.food === f.id,
        onclick: function (e) { pickFood(leaf, f.id, e.currentTarget); }
      }));
    });
    // 직접 그리기: 그림이 있으면 그 그림이 카드가 되고, 고른 상태에서 한 번 더 누르면 다시 그린다
    var has = !!images[IMG_FOOD];
    grid.append(tile({
      id: 'custom', extra: 'tile--draw' + (has ? ' has-art' : ''),
      label: has ? (state.customFoodName.trim() || S.customFood.fallbackName) : S.customFood.label,
      image: images[IMG_FOOD], emoji: '✏️', glow: '#3a4a7a', pressed: state.food === 'custom',
      onclick: function (e) {
        if (!images[IMG_FOOD] || state.food === 'custom') drawFood(leaf);
        else pickFood(leaf, 'custom', e.currentTarget);
      }
    }));
    return grid;
  }

  function foodResult(c) {
    var f = c.food;
    return el('div', { class: 'pg-text reveal' + (f ? '' : ' is-empty'), 'aria-live': 'polite' },
      el('p', { class: 'eyebrow', text: f ? '한입 냠, ' + f.name : '음식을 고르면' }),
      el('p', { class: 'story story--sm', text: f ? f.desc : '왼쪽에서 먹고 싶은 음식을 골라 보세요. 고른 음식은 스티커가 되어 이 책에 붙어요.' }),
      f ? el('p', { class: 'hint sticker-hint', text: '스티커를 끌어서 원하는 곳에 붙여 보세요. 모서리를 끌면 크기와 방향이 바뀌어요.' }) : null);
  }

  function pickFood(leaf, id, fromEl) {
    var changed = state.food !== id;
    state.food = id;
    markPressed(leaf.querySelector('.grid--food'), id);
    // 오른쪽 쪽 설명 다시 그리기
    var old = leaf.querySelector('.reveal');
    if (old) {
      var fresh = foodResult(ctx());
      old.replaceWith(fresh);
      fresh.classList.add('is-pop');
    }
    if (changed || !findSticker('food', 'food')) placeSticker(leaf, 'food', 'food', fromEl);
    updateControls();
    saveSoon();
    // 한 쪽씩 보는 화면에서는 스티커가 붙는 오른쪽 쪽을 펼쳐 보여 준다 (장면은 넘어가지 않음)
    if (mode === 'single' && state.page === 0) setTimeout(function () { if (state.scene === 3 && state.page === 0) flipPage(1); }, 520);
  }

  function drawFood(leaf) {
    window.StarSoupEditor.open({
      title: '음식 그리기', image: images[IMG_FOOD], askName: true, name: state.customFoodName
    }).then(function (res) {
      if (!res) return;
      state.customFoodName = res.name.slice(0, S.limits.foodName);
      saveImage(IMG_FOOD, res.image);
      state.food = 'custom';
      // 카드에 내 그림이 보이도록 장면을 새로 그린 뒤 스티커를 붙인다
      rerender();
      var fresh = currentLeaf();
      placeSticker(fresh, 'food', 'food', fresh.querySelector('.tile[data-id="custom"]'));
      updateControls();
      saveNow();
      if (mode === 'single' && state.page === 0) setTimeout(function () { if (state.scene === 3 && state.page === 0) flipPage(1); }, 520);
    });
  }

  function deedField(leaf) {
    var area = el('textarea', {
      class: 'input', id: 'input-deed', maxlength: S.limits.deed, rows: 2,
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
          onclick: function () { area.value = ex; state.deed = ex; count(); saveSoon(); }
        });
      }));
    var has = !!images[IMG_DEED];
    var draw = el('button', {
      type: 'button', class: 'btn btn-soft btn-small', text: has ? '착한 일 그림 다시 그리기' : '그림이나 사진으로 꾸미기',
      onclick: function () {
        window.StarSoupEditor.open({ title: '착한 일 그리기', image: images[IMG_DEED] }).then(function (res) {
          if (!res) return;
          saveImage(IMG_DEED, res.image);
          rerender();
          placeSticker(currentLeaf(), 'deed', 'deed', null);
          saveNow();
        });
      }
    });
    return el('div', { class: 'pg-widget' },
      el('div', { class: 'field' },
        el('label', { for: 'input-deed', text: '내가 한 착한 일' }),
        area,
        el('div', { class: 'field-foot' }, el('p', { class: 'hint', text: '비워 두어도 이야기는 이어져요.' }), counter)),
      chips, draw);
  }

  function tasteList(leaf) {
    var grid = el('div', { class: 'grid grid--taste', role: 'group', 'aria-label': '스프의 맛 고르기' });
    S.tastes.forEach(function (t) {
      grid.append(tile({
        id: t.id, label: t.label, image: t.image, emoji: t.emoji, glow: t.glow, pressed: state.taste === t.id,
        onclick: function () {
          state.taste = t.id;
          markPressed(grid, t.id);
          updateControls();
          saveSoon();
        }
      }));
    });
    return grid;
  }

  function recap(c) {
    function row(label, value, sceneIndex, page, emptyText) {
      return el('div', { class: 'recap-row' },
        el('dt', { text: label }),
        el('dd', { class: value ? '' : 'is-empty', text: value || emptyText }),
        el('button', {
          type: 'button', class: 'link-btn', text: '고치기', 'aria-label': label + ' 고치기',
          onclick: function () { state.returnTo = LAST; go(sceneIndex, page); }
        }));
    }
    return el('div', { class: 'pg-text recap' },
      el('h2', { text: c.you + '의 별빛스프 이야기' }),
      el('dl', null,
        row('이름', c.name, 2, 1, '아직 비어 있어요'),
        row('고른 음식', c.food && c.food.name, 3, 0, '고르지 않았어요'),
        row('착한 일', c.deed, 5, 1, '비워 두었어요'),
        row('스프의 맛', c.taste && c.taste.label, 8, 1, '고르지 않았어요')));
  }

  /* ---------- 스티커 ----------
     위치는 펼침면 기준 비율(0~1)로 저장해서 화면 크기·모드가 바뀌어도 같은 자리에 붙어 있다. */
  function findSticker(sceneId, kind) {
    return (state.stickers[sceneId] || []).find(function (s) { return s.kind === kind; }) || null;
  }

  function stickerSource(st) {
    if (st.kind === 'deed') return { image: images[IMG_DEED], emoji: '💛', label: '착한 일 그림 스티커' };
    var f = ctx().food;
    if (!f) return null;
    return { image: f.custom ? images[IMG_FOOD] : f.image, emoji: f.emoji, label: f.name + ' 스티커' };
  }

  function placeSticker(leaf, sceneId, kind, fromEl) {
    var list = state.stickers[sceneId] || (state.stickers[sceneId] = []);
    var st = findSticker(sceneId, kind);
    if (!st) {
      var spot = S.stickerSpots[kind];
      st = { kind: kind, x: spot.x, y: spot.y, w: spot.w, r: spot.r };
      list.push(st);
    }
    paintStickers(leaf);
    var node = leaf._stickers.querySelector('[data-kind="' + kind + '"]');
    if (!node) return;
    selectSticker(leaf, node);
    // 고른 카드에서 스티커가 톡 튀어나와 붙는 자리로 날아간다
    if (reduceMotion) return;
    var to = node.getBoundingClientRect();
    var from = fromEl && fromEl.getBoundingClientRect();
    var dx = 0, dy = 0;
    if (from && mode === 'spread') {
      dx = from.left + from.width / 2 - (to.left + to.width / 2);
      dy = from.top + from.height / 2 - (to.top + to.height / 2);
    }
    node.querySelector('.st-body').animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.4) rotate(-20deg)', opacity: 0.4 },
      { transform: 'translate(' + dx * 0.2 + 'px,' + (dy * 0.2 - 30) + 'px) scale(1.15) rotate(6deg)', opacity: 1, offset: 0.7 },
      { transform: 'none', opacity: 1 }
    ], { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function paintStickers(leaf) {
    var layer = leaf._stickers;
    layer.replaceChildren();
    (state.stickers[leaf._sceneId] || []).forEach(function (st) {
      var src = stickerSource(st);
      if (!src) return;
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

  function positionSticker(node) {
    var st = node._st;
    node.style.left = st.x * 100 + '%';
    node.style.top = st.y * 100 + '%';
    node.style.width = st.w * 100 + '%';
    node.style.setProperty('--w', st.w);
    node.style.setProperty('--r', st.r + 'deg');
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
    var spreadEl = function () { return leaf.querySelector('.spread'); };

    node.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.st-del')) return;
      e.preventDefault();
      e.stopPropagation();
      selectSticker(leaf, node);
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
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
      node.classList.add('is-dragging');
    });
    node.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var st = node._st;
      if (drag.handle) {
        // 모서리 손잡이: 가운데를 기준으로 크기와 방향을 함께 바꾼다
        var dist = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
        var ang = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
        st.w = clamp(drag.w * dist / drag.startDist, 0.04, 0.6);
        st.r = Math.round(drag.r + (ang - drag.startAngle) * 180 / Math.PI);
        if (st.r > 180) st.r -= 360;
        if (st.r < -180) st.r += 360;
      } else {
        st.x = clamp((e.clientX - drag.dx - drag.rect.left) / drag.rect.width, 0.02, 0.98);
        st.y = clamp((e.clientY - drag.dy - drag.rect.top) / drag.rect.height, 0.04, 0.96);
      }
      positionSticker(node);
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      node.classList.remove('is-dragging');
      saveNow();
    }
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.querySelector('.st-del').addEventListener('click', function (e) { e.stopPropagation(); removeSticker(leaf, node); });
    node.addEventListener('keydown', function (e) {
      var st = node._st, step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSticker(leaf, node); return; }
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!moves[e.key]) return;
      e.preventDefault();
      e.stopPropagation();
      st.x = clamp(st.x + moves[e.key][0], 0.02, 0.98);
      st.y = clamp(st.y + moves[e.key][1], 0.04, 0.96);
      positionSticker(node);
      saveSoon();
    });
    node.addEventListener('focus', function () { selectSticker(leaf, node); });
  }

  /* ---------- 별빛 효과 (#8) ---------- */
  function sparkles(canvas) {
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
        s.life++;
        s.y -= s.vy;
        s.x += Math.sin(t / 900 + s.ph) * 0.22;
        if (s.life > s.max || s.y < -10) { list[i] = spawn(false); continue; }
        var fade = Math.max(0, Math.min(1, s.life / 40, (s.max - s.life) / 60));
        drawStar(s.x, s.y, s.r, fade * (0.55 + 0.45 * Math.sin(t / 280 + s.ph)));
      }
      g.globalAlpha = 1;
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    raf = requestAnimationFrame(function (t) {
      resize();
      if (ro) ro.observe(canvas);
      for (var i = 0; i < 44; i++) list.push(spawn(true));
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
    return state.scene === LAST && (mode === 'spread' || state.page === 1);
  }

  function updateControls() {
    var scene = S.scenes[state.scene];
    btnPrev.disabled = state.scene === 0 && (mode === 'spread' || state.page === 0);
    var last = atLastStep();
    btnNext.hidden = last;
    endActions.hidden = !last;
    if (last) return;
    var leavingScene = mode === 'spread' || state.page === 1;
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
  var ARC = { deg: 18, duration: 820, easing: 'cubic-bezier(.65,0,.35,1)' };

  function arcOut(leaf, dir) {
    leaf.classList.add('is-leaving');
    var d = -ARC.deg * dir;
    var anim = leaf.animate([
      { transform: 'rotate(0deg) scale(1)', opacity: 1 },
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

  function arc(oldLeaf, newLeaf, dir) {
    oldLeaf.classList.add('is-leaving');
    newLeaf.style.opacity = '0';
    nextFrame(function () {
      newLeaf.style.opacity = '';
      arcOut(oldLeaf, dir);
      arcIn(newLeaf, dir);
    });
  }

  function render(animate) {
    var oldLeaf = currentLeaf();
    var leaf = buildLeaf(state.scene);
    book.append(leaf);
    if (oldLeaf) {
      if (animate && !reduceMotion && leaf.animate) arc(oldLeaf, leaf, direction);
      else retire(oldLeaf);
    }
    renderProgress();
    updateControls();
    return leaf;
  }

  function rerender() { render(false); }

  function go(index, page) {
    index = clamp(index, 0, LAST);
    direction = index >= state.scene ? 1 : -1;
    state.scene = index;
    state.page = mode === 'single' ? (page || 0) : 0;
    state.maxScene = Math.max(state.maxScene, index);
    if (index === LAST && state.returnTo === LAST) state.returnTo = null;
    saveNow();
    render(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // 같은 장면 안에서 왼쪽 쪽 ↔ 오른쪽 쪽 (한 쪽씩 보기에서만)
  function flipPage(page) {
    state.page = page;
    var leaf = currentLeaf();
    if (leaf) leaf.setAttribute('data-page', page);
    saveNow();
    updateControls();
  }

  function next() {
    if (atLastStep()) return;
    if (blockedHere()) {
      var scene = S.scenes[state.scene];
      toast(scene.requireMessage);
      var grid = currentLeaf() && currentLeaf().querySelector('.grid');
      if (grid) { grid.classList.remove('is-shake'); void grid.offsetWidth; grid.classList.add('is-shake'); }
      return;
    }
    if (mode === 'single' && state.page === 0) { flipPage(1); return; }
    go(state.returnTo != null && state.scene < state.returnTo ? state.returnTo : state.scene + 1, 0);
  }

  function prev() {
    if (mode === 'single' && state.page === 1) { flipPage(0); return; }
    if (state.scene > 0) go(state.scene - 1, 1);
  }

  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  document.getElementById('btn-reread').addEventListener('click', function () { state.returnTo = null; go(0, 0); });
  document.getElementById('btn-restart').addEventListener('click', function () {
    ask({
      title: '처음부터 다시 할까요?',
      message: '이름, 고른 음식, 착한 일, 스프의 맛, 직접 그린 그림과 스티커가 모두 지워져요.',
      ok: '다시 하기', cancel: '취소', danger: true
    }).then(function (yes) {
      if (!yes) return;
      state = freshState();
      images = {};
      saved = { scene: 0, page: 0 };
      store.clear();
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
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.classList.contains('sticker'))) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  window.addEventListener('pagehide', saveNow);

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var m = pickMode();
      if (m === mode) return;
      mode = m;
      book.setAttribute('data-mode', mode);
      if (mode === 'spread') state.page = 0;
      if (app.getAttribute('data-screen') === 'book') rerender();
    }, 120);
  });

  /* ---------- 표지·사용 설명·책 화면 ---------- */
  var app = document.getElementById('app');
  var screens = {
    cover: document.getElementById('cover'),
    guide: document.getElementById('guide'),
    book: document.getElementById('stage')
  };
  var controlsEl = document.getElementById('controls');
  var stopCoverSparkles = null;

  function showScreen(name) {
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
  function leaveThen(card, dir, fn) {
    if (reduceMotion || !card.animate) { fn(); return; }
    var anim = card.animate([
      { transform: 'rotate(0deg) scale(1)', opacity: 1 },
      { transform: 'rotate(' + (-ARC.deg * dir) + 'deg) scale(.94)', opacity: 0 }
    ], { duration: 520, easing: 'cubic-bezier(.55,0,.75,.3)' });
    anim.finished.then(fn, fn);
  }
  function enterCard(card, dir) {
    if (reduceMotion || !card.animate) return;
    nextFrame(function () {
      card.animate([
        { transform: 'rotate(' + (ARC.deg * dir) + 'deg) scale(.94)', opacity: 0 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1 }
      ], { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' });
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

  function enterBook(index, page) {
    state.scene = clamp(index, 0, LAST);
    state.page = mode === 'single' ? (page || 0) : 0;
    state.maxScene = Math.max(state.maxScene, state.scene);
    showScreen('book');
    saveNow();
    var leaf = render(false);
    if (!reduceMotion && leaf.animate) { leaf.style.opacity = '0'; nextFrame(function () { leaf.style.opacity = ''; arcIn(leaf, 1); }); }
  }

  function start(card) {
    var resumeAt = saved.scene, resumePage = saved.page;
    var begin = function (i, p) { leaveThen(card, 1, function () { enterBook(i, p); }); };
    if (resumeAt > 0 || resumePage > 0) {
      ask({
        title: '읽던 이야기가 있어요',
        message: '#' + (resumeAt + 1) + ' 장면까지 읽었어요. 이어서 읽을까요?',
        ok: '이어서 읽기', cancel: '첫 장면부터'
      }).then(function (yes) { saved = { scene: 0, page: 0 }; begin(yes ? resumeAt : 0, yes ? resumePage : 0); });
    } else {
      begin(0, 0);
    }
  }

  document.getElementById('btn-start').addEventListener('click', function () { start(document.getElementById('cover-card')); });
  document.getElementById('btn-guide').addEventListener('click', openGuide);
  document.getElementById('btn-guide-back').addEventListener('click', backToCover);
  document.getElementById('btn-guide-start').addEventListener('click', function () { start(document.getElementById('guide-card')); });

  function paintCover() {
    var c = S.cover;
    document.getElementById('cover-kicker').textContent = c.kicker;
    document.getElementById('cover-title').textContent = c.title;
    document.getElementById('cover-sub').textContent = c.subtitle;
    document.getElementById('build-tag').textContent = 'v' + S.version;
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
    var keys = [IMG_FOOD, IMG_DEED];
    return Promise.all(keys.map(function (k) {
      return store.getImage(k).then(function (v) { if (typeof v === 'string') images[k] = v; }, function () {});
    }));
  }

  function boot() {
    mode = pickMode();
    book.setAttribute('data-mode', mode);
    paintCover();
    showScreen('cover');
    var res = store.load();
    if (res.error) toast('지난번 기록을 불러오지 못했어요. 처음부터 시작할게요.', 3600);
    if (res.data) state = sanitize(res.data);
    saved = { scene: state.scene, page: state.page };
    loadImages().then(function () {
      if (state.food === 'custom' && !images[IMG_FOOD]) {
        state.food = null;
        toast('지난번에 그린 음식 그림을 불러오지 못했어요. 다시 골라 주세요.', 3600);
      }
    });
  }

  boot();
})();

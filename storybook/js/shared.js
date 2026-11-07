/* 별빛스프 — 함께 보는 메모 (온라인)
   claude.ai 아티팩트로 열었을 때만 동작한다. 다른 곳(깃허브 페이지 등)에서는 조용히 아무것도 하지 않는다.
   - memos/{내 id} : 내가 적은 착한 일·좋아하는 음식 (한 사람당 한 장, 다시 적으면 덮어씀)
   - 다른 사람들의 메모는 #6 10쪽 보드 뒤로 둥실둥실 떠다닌다 */
(function () {
  'use strict';
  var LIMIT = 30;
  var memos = [];          // 다른 사람들의 메모 [{ id, deed, food, emoji, at }]
  var listeners = [];
  var db = null, myId = null, ready = null, lastSent = '';

  function clean(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }

  // claude.ai가 window.claude를 조금 늦게 붙이기도 해서, 잠깐(최대 15초) 기다렸다가 연결한다
  function waitClaude() {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function check() {
        var c = window.claude;
        if (c && typeof c.use === 'function') return resolve(c);
        if (Date.now() - t0 > 15000) return resolve(null);
        setTimeout(check, 250);
      })();
    });
  }

  function start() {
    if (ready) return ready;
    ready = (async function () {
      var c = await waitClaude();
      if (!c) return false;
      try {
        var res = await Promise.all([c.use('db'), c.use('user')]);
        db = res[0];
        var user = res[1];
        if (!db) { console.info('[별빛스프] 공유 메모: db를 쓸 수 없어요'); return false; }
        try { myId = user ? await user.id() : null; } catch (e) { myId = null; }
        db.collection('memos').limit(200).onSnapshot(function (snap) {
          memos = snap.docs.filter(function (d) { return d.exists && d.id !== myId; }).map(function (d) {
            var v = d.data() || {};
            return { id: d.id, at: +v.at || 0, deed: clean(v.deed, 80), food: clean(v.food, 12), emoji: clean(v.emoji, 8) };
          }).filter(function (m) { return m.deed || m.food; })
            .sort(function (a, b) { return b.at - a.at; }).slice(0, LIMIT);
          listeners.forEach(function (fn) { try { fn(memos); } catch (e) { /* 그리기 실패는 무시 */ } });
        }, function (e) { console.info('[별빛스프] 공유 메모 연결 끊김', e && e.code); });
        return true;
      } catch (e) { console.info('[별빛스프] 공유 메모 연결 실패', e && e.code); return false; }
    })();
    return ready;
  }

  // 내 메모를 올린다 (바뀌었을 때만, 한 번에 하나씩)
  var sending = false, queued = null;
  async function share(m) {
    var body = { deed: clean(m.deed, 80), food: clean(m.food, 12), emoji: clean(m.emoji, 8) };
    if (!body.deed) return;
    var key = JSON.stringify(body);
    if (key === lastSent) return;
    if (sending) { queued = m; return; }
    if (!(await start()) || !myId) return;
    sending = true;
    try {
      body.at = Date.now();
      await db.collection('memos').doc(myId).set(body);
      lastSent = key;
    } catch (e) { /* 보기 전용으로 열었거나 거절되면 나누지 않는다 */ lastSent = key; }
    sending = false;
    if (queued) { var q = queued; queued = null; share(q); }
  }

  function onChange(fn) { listeners.push(fn); start(); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

  window.StarSoupShared = { start: start, share: share, onChange: onChange, memos: function () { return memos; } };
  start();
})();

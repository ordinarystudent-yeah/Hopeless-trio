/* 별빛스프 — 함께 보는 메모 (온라인)
   다른 사람들의 착한 일·좋아하는 음식 메모가 #6 10쪽 보드 뒤로 둥실둥실 떠다닌다.
   - 저장소: Firebase Firestore (memos/{익명 로그인 uid}) — 깃허브 링크든 아티팩트든 같은 메모를 본다
   - Firebase에 닿지 못하면(예: 막힌 네트워크) claude.ai 아티팩트의 공유 DB로 대신 한다
   - 둘 다 안 되면 조용히 아무것도 하지 않는다 (동화는 그대로) */
(function () {
  'use strict';
  var FIREBASE = {
    apiKey: 'AIzaSyDaiUvxNolTCJ3P0Uqkptu0hgXHv9pFZxo',
    authDomain: 'hopeless-trio.firebaseapp.com',
    projectId: 'hopeless-trio',
    storageBucket: 'hopeless-trio.firebasestorage.app',
    messagingSenderId: '605087450891',
    appId: '1:605087450891:web:f96db641a74f9c660b840e'
  };
  var SDK = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
  var LIMIT = 30;
  var memos = [];          // 다른 사람들의 메모 [{ id, at, deed, food, emoji }]
  var listeners = [];
  var backend = null;      // { myId, write(body) }
  var ready = null, lastSent = '';

  function clean(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }
  function log() { try { console.info.apply(console, ['[별빛스프 공유 메모]'].concat([].slice.call(arguments))); } catch (e) { /* 없음 */ } }

  function deliver(docs, myId) {
    memos = docs.filter(function (d) { return d.id !== myId; }).map(function (d) {
      var v = d.v || {};
      var at = v.at && typeof v.at.toMillis === 'function' ? v.at.toMillis() : +v.at || 0;
      return { id: d.id, at: at, deed: clean(v.deed, 80), food: clean(v.food, 12), emoji: clean(v.emoji, 8) };
    }).filter(function (m) { return m.deed || m.food; })
      .sort(function (a, b) { return b.at - a.at; }).slice(0, LIMIT);
    listeners.forEach(function (fn) { try { fn(memos); } catch (e) { /* 그리기 실패는 무시 */ } });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve; s.onerror = function () { reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function timeout(ms) { return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); }); }

  /* ---------- Firebase ---------- */
  async function useFirebase() {
    if (!window.firebase || !window.firebase.firestore) {
      var base = (document.querySelector('script[src*="js/shared.js"]') || {}).src || '';
      base = base ? base.replace(/js\/shared\.js.*$/, '') : '';
      for (var i = 0; i < SDK.length; i++) await loadScript(base + 'js/vendor/firebase/' + SDK[i]);
    }
    var fb = window.firebase;
    var app = fb.apps.length ? fb.app() : fb.initializeApp(FIREBASE);
    var store = app.firestore();
    var myId = null;
    try {
      var cred = await Promise.race([app.auth().signInAnonymously(), timeout(10000)]);
      myId = cred && cred.user ? cred.user.uid : null;
    } catch (e) { log('익명 로그인 실패 — 보기만 해요', e && (e.code || e.message)); }
    // 첫 소식이 와야 연결된 것으로 본다
    await Promise.race([new Promise(function (resolve, reject) {
      store.collection('memos').orderBy('at', 'desc').limit(LIMIT + 1).onSnapshot(function (snap) {
        deliver(snap.docs.map(function (d) { return { id: d.id, v: d.data({ serverTimestamps: 'estimate' }) }; }), myId);
        resolve();
      }, function (e) { log('읽기 실패', e && e.code); reject(e); });
    }), timeout(10000)]);
    return {
      name: 'firebase', myId: myId,
      write: function (body) {
        body.at = fb.firestore.FieldValue.serverTimestamp();
        return store.collection('memos').doc(myId).set(body);
      }
    };
  }

  /* ---------- claude.ai 아티팩트 공유 DB (대신) ---------- */
  function waitClaude(ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function check() {
        var c = window.claude;
        if (c && typeof c.use === 'function') return resolve(c);
        if (Date.now() - t0 > ms) return resolve(null);
        setTimeout(check, 250);
      })();
    });
  }
  async function useClaude() {
    var c = await waitClaude(5000);
    if (!c) throw new Error('no claude');
    var res = await Promise.all([c.use('db'), c.use('user')]);
    var db = res[0], user = res[1];
    if (!db) throw new Error('no db');
    var myId = null;
    try { myId = user ? await user.id() : null; } catch (e) { myId = null; }
    db.collection('memos').limit(200).onSnapshot(function (snap) {
      deliver(snap.docs.filter(function (d) { return d.exists; }).map(function (d) { return { id: d.id, v: d.data() }; }), myId);
    }, function (e) { log('아티팩트 DB 끊김', e && e.code); });
    return {
      name: 'claude', myId: myId,
      write: function (body) { body.at = Date.now(); return db.collection('memos').doc(myId).set(body); }
    };
  }

  function start() {
    if (ready) return ready;
    ready = (async function () {
      try { backend = await useFirebase(); }
      catch (e) {
        log('Firebase에 닿지 못했어요', e && (e.code || e.message));
        try { backend = await useClaude(); } catch (e2) { backend = null; }
      }
      if (backend) log('연결됨:', backend.name);
      return !!backend;
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
    sending = true;
    try {
      if ((await start()) && backend.myId) { await backend.write(body); }
    } catch (e) { log('메모 올리기 실패', e && (e.code || e.message)); }
    lastSent = key;
    sending = false;
    if (queued) { var q = queued; queued = null; share(q); }
  }

  function onChange(fn) { listeners.push(fn); start(); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

  window.StarSoupShared = { start: start, share: share, onChange: onChange, memos: function () { return memos; } };
  // 첫 화면을 그리는 데 방해되지 않게, 조금 뒤에 연결을 시작한다
  if (document.readyState === 'complete') setTimeout(start, 1500);
  else window.addEventListener('load', function () { setTimeout(start, 1500); });
})();

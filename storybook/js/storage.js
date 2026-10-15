/* 별빛스프 — 저장
   - 이름·선택·현재 장면·스티커 위치 같은 작은 글자 데이터 → localStorage
   - 직접 그린 그림(이미지) → IndexedDB
   개인 브라우저 설정에 따라 저장이 막혀 있을 수 있으므로 모든 접근을 실패해도 괜찮게 감싼다. */
(function () {
  'use strict';

  var KEY = 'starsoup:story:v1';
  var DB_NAME = 'starsoup';
  var STORE = 'images';

  function isQuotaError(err) {
    return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);
  }

  /* ---------- IndexedDB ---------- */
  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB를 쓸 수 없는 브라우저예요')); return; }
      var req;
      try { req = window.indexedDB.open(DB_NAME, 1); } catch (err) { reject(err); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('다른 탭에서 저장소를 쓰고 있어요')); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function run(mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = work(tx.objectStore(STORE));
        tx.oncomplete = function () { resolve(req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  window.StarSoupStorage = {
    isQuotaError: isQuotaError,

    /** @returns {{data: object|null, error: Error|null}} */
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return { data: null, error: null };
        var data = JSON.parse(raw);
        if (!data || typeof data !== 'object') throw new Error('저장된 기록의 형식이 올바르지 않아요');
        return { data: data, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    /** @returns {{ok: boolean, quota: boolean, error: Error|null}} */
    save: function (state) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
        return { ok: true, quota: false, error: null };
      } catch (err) {
        return { ok: false, quota: isQuotaError(err), error: err };
      }
    },

    clear: function () {
      try { window.localStorage.removeItem(KEY); } catch (err) { /* 저장소를 쓸 수 없으면 지울 것도 없다 */ }
      return run('readwrite', function (s) { return s.clear(); }).catch(function () {});
    },

    /* 그림: 값은 PNG data URL 문자열 */
    putImage: function (key, dataUrl) { return run('readwrite', function (s) { return s.put(dataUrl, key); }); },
    getImage: function (key) { return run('readonly', function (s) { return s.get(key); }); },
    deleteImage: function (key) { return run('readwrite', function (s) { return s.delete(key); }); }
  };
})();

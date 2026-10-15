/* 별빛스프 — 동화 진행 기록 저장
   이름·선택·현재 장면 같은 작은 글자 데이터는 localStorage에 둔다.
   (그림처럼 큰 데이터는 7단계에서 IndexedDB로 따로 저장할 예정)
   개인 브라우저 설정에 따라 저장이 막혀 있을 수 있으므로 모든 접근을 try/catch로 감싼다. */
(function () {
  'use strict';

  var KEY = 'starsoup:story:v1';

  function isQuotaError(err) {
    return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);
  }

  window.StarSoupStorage = {
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
    }
  };
})();

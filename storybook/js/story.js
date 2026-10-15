/* 별빛스프 — 동화 내용과 이미지 경로 설정
   ─────────────────────────────────────────────
   삽화를 바꾸려면 아래 image 경로에 맞춰 assets/ 폴더에 파일을 넣기만 하면 된다.
   파일이 아직 없으면 화면에는 자동으로 임시 그림(플레이스홀더)이 나온다.
   문장은 text(c) 함수가 문단 배열을 돌려주는 형태다.
   - 문자열은 그대로 출력
   - { v: '값' } 은 사용자가 넣은 값으로, 금빛으로 강조해 출력 (항상 textContent로 넣으므로 HTML로 해석되지 않음)
   - 문단 안의 '\n'은 줄바꿈 */
(function () {
  'use strict';

  /* ---------- 한국어 조사 ---------- */
  // pair: '이/가', '은/는', '을/를', '과/와' 처럼 "받침 있을 때/없을 때" 순서
  function josa(word, pair) {
    var forms = pair.split('/');
    var last = word.charCodeAt(word.length - 1);
    if (isNaN(last) || last < 0xac00 || last > 0xd7a3) return forms[0] + '(' + forms[1] + ')';
    return (last - 0xac00) % 28 > 0 ? forms[0] : forms[1];
  }

  // 사용자 이름(없으면 "당신") + 조사. 이름을 입력했을 때만 강조한다.
  function you(c, pair) {
    var seg = c.hasName ? { v: c.you } : c.you;
    return pair ? [seg, josa(c.you, pair)] : [seg];
  }

  /* ---------- 4단 구성 ---------- */
  var acts = [
    { label: '기', title: '꿈속 식탁' },
    { label: '승', title: '음식과 요정' },
    { label: '전', title: '착한 일과 별빛스프' },
    { label: '결', title: '맛과 엔딩' }
  ];

  /* ---------- #4 음식 6종 ---------- */
  // glow: 이미지가 없을 때 카드 바탕에 은은하게 깔리는 색
  var foods = [
    {
      id: 'cotton-candy', name: '폭신폭신 솜사탕', noun: '솜사탕',
      image: 'assets/foods/cotton-candy.png', emoji: '☁️', glow: '#8f5a8f',
      desc: '폭신폭신한 솜사탕을 한입 베어먹었더니, 입 안에서 사르르 녹아 달콤한 맛이 났어요.'
    },
    {
      id: 'pudding', name: '말랑말랑 푸딩', noun: '푸딩',
      image: 'assets/foods/pudding.png', emoji: '🍮', glow: '#8a6a2e',
      desc: '말랑말랑한 푸딩을 한 숟가락 떠서 입에 넣으니, 입 안에서 몽글몽글하게 부서지며 달콤한 맛이 났어요.'
    },
    {
      id: 'chicken', name: '바삭바삭 치킨', noun: '치킨',
      image: 'assets/foods/chicken.png', emoji: '🍗', glow: '#8a4f2c',
      desc: '바삭바삭한 치킨의 제일 맛있는 부위를 들어 한입 베어먹으니, 짭짤하고, 고소한 맛이 났어요.'
    },
    {
      id: 'bread', name: '따끈따끈 빵', noun: '빵',
      image: 'assets/foods/bread.png', emoji: '🍞', glow: '#7d5c34',
      desc: '빵을 들어 한입 베어먹으니, 입 안이 노른노른 편안해졌어요.'
    },
    {
      id: 'omurice', name: '포슬포슬 오므라이스', noun: '오므라이스',
      image: 'assets/foods/omurice.png', emoji: '🍳', glow: '#8a7a2a',
      desc: '포슬포슬한 오므라이스를 한 숟가락 떠먹으니, 부드러운 계란과, 맛있는 볶음밥의 맛이 느껴졌어요.'
    },
    {
      id: 'rice-ball', name: '동글동글 주먹밥', noun: '주먹밥',
      image: 'assets/foods/rice-ball.png', emoji: '🍙', glow: '#4f6a6a',
      desc: '동글동글한 주먹밥을 한입에 쏙, 넣었더니, 짭짤하고 담백한 맛이 입 안에서 굴러갔어요.'
    }
  ];

  /* ---------- #9 스프의 맛 3종 ---------- */
  var tastes = [
    { id: 'galaxy', label: '은하수가 퍼지는 듯한 달콤한 맛', short: '달콤한 맛', image: 'assets/icons/taste-galaxy.png', emoji: '🌌', glow: '#5a4f9a' },
    { id: 'spark', label: '별빛이 입 안에서 터지는 듯한 짜릿한 맛', short: '짜릿한 맛', image: 'assets/icons/taste-spark.png', emoji: '✨', glow: '#8a6a24' },
    { id: 'cloud', label: '구름을 입에 머금은 듯한 포근한 맛', short: '포근한 맛', image: 'assets/icons/taste-cloud.png', emoji: '☁️', glow: '#5f6f9a' }
  ];

  /* ---------- 착한 일 예시 (눌러서 바로 채우기) ---------- */
  var deedExamples = [
    '동생에게 장난감을 양보했어요',
    '엄마의 설거지를 도와드렸어요',
    '친구에게 먼저 인사했어요',
    '넘어진 친구를 일으켜 줬어요'
  ];

  /* ---------- 10개 장면 ----------
     layout: hero(큰 삽화 위에 글) · split(삽화 + 글 카드) · choice(카드 고르기) · ending
     input: name | deed      choice: food | taste      require: 다음으로 가기 전 꼭 골라야 하는 것 */
  var scenes = [
    {
      id: 'intro', act: 0, layout: 'hero',
      image: 'assets/backgrounds/01-intro-night.png', alt: '모두가 잠든 밤하늘과 꿈', tone: 'night', motif: 'moon',
      nextLabel: '꿈속으로 들어가기',
      text: function () { return [['모두가 잠이 든 밤.\n아이들의 꿈속에는 특별한 일이 일어나고 있어요.']]; }
    },
    {
      id: 'table', act: 0, layout: 'split',
      image: 'assets/backgrounds/02-dream-table.png', alt: '갖가지 음식이 차려진 꿈속 식탁', tone: 'table', motif: 'table',
      text: function () { return [['아이들의 앞에는 갖가지 음식이 차려진 식탁이 있네요?']]; }
    },
    {
      id: 'name', act: 0, layout: 'split', input: 'name',
      image: 'assets/backgrounds/03-nameplate.png', alt: '빈 이름표가 놓인 나의 자리', tone: 'table', motif: 'seat',
      nextLabel: function (c) { return c.hasName ? '이 이름으로 앉기' : '이름 없이 앉기'; },
      text: function () { return [['당신의 자리도 있어요.\n당신의 이름은 무엇인가요?']]; }
    },
    {
      id: 'food', act: 1, layout: 'choice', choice: 'food', require: 'food',
      requireMessage: '먹고 싶은 음식을 하나 골라 주세요.',
      text: function () { return [['자리에 앉아 앞을 바라보니 맛있는 음식들이 잔뜩 있어요.\n어떤 것부터 먹고 싶나요?']]; }
    },
    {
      id: 'fairies', act: 1, layout: 'split',
      image: 'assets/fairies/05-fairies-arrive.png', alt: '특별한 음식을 들고 오는 요정들', tone: 'fairy', motif: 'fairies',
      text: function (c) {
        var ate = c.food ? [{ v: c.food.noun }, josa(c.food.noun, '을/를')] : ['음식을'];
        return [
          ['그렇게 '].concat(ate, [' 먹다 보니 요정들이 무언가 음식을 가져오네요.']),
          ['가장 착한 아이에게 주는 음식이래요!']
        ];
      }
    },
    {
      id: 'deed', act: 2, layout: 'split', input: 'deed',
      image: 'assets/fairies/06-fairy-praise.png', alt: '아이들의 착한 일을 하나하나 말해 주는 요정', tone: 'fairy', motif: 'bubble',
      text: function (c) {
        return [
          ['요정은 아이들이 했던 착한 일들을 하나하나 말해주었어요.'],
          you(c, '이/가').concat([' 한 착한 일도 말해주네요?\n']).concat(you(c, '이/가'), [' 한 착한 일은 무엇인가요?'])
        ];
      }
    },
    {
      id: 'serve', act: 2, layout: 'split',
      image: 'assets/fairies/07-fairies-serve.png', alt: '박수를 치며 음식을 놓아 주는 요정들', tone: 'gold', motif: 'cloche',
      text: function (c) {
        if (c.deed) {
          return [
            ['와! ', { v: '“' + c.deed + '”', quote: true }],
            you(c, '이/가').concat([' 한 이 착한 일로 요정들은 박수를 보내며 ']).concat(you(c), ['의 앞에 그 음식을 놓아주었어요.'])
          ];
        }
        // 착한 일을 비워 두었을 때의 기본 문장
        return [
          ['와! 요정들은 '].concat(you(c, '이/가'), [' 한 착한 일들을 떠올리며 박수를 보냈어요.']),
          ['그리고 '].concat(you(c), ['의 앞에 그 음식을 놓아주었어요.'])
        ];
      }
    },
    {
      id: 'soup', act: 2, layout: 'hero', effect: 'sparkles',
      image: 'assets/backgrounds/08-starlight-soup.png', alt: '별빛이 동동 떠다니는 스프', tone: 'gold', motif: 'soup',
      text: function (c) {
        return [
          ['뚜껑을 여니, 별빛이 동동 떠다니는 스프가 있어요.\n'].concat(you(c, '은/는'), [' 한입 스프를 입에 넣었어요.'])
        ];
      }
    },
    {
      id: 'taste', act: 3, layout: 'choice', choice: 'taste', require: 'taste',
      requireMessage: '스프에서 어떤 맛이 났는지 하나 골라 주세요.',
      nextLabel: '잠에서 깨기',
      text: function () { return [['무슨 맛이 났나요?']]; }
    },
    {
      id: 'ending', act: 3, layout: 'ending',
      image: 'assets/backgrounds/10-wake-up.png', alt: '아침 햇살 속에서 잠에서 깬 아이', tone: 'dawn', motif: 'dawn',
      text: function (c) {
        var taste = c.taste ? [{ v: c.taste.label }, josa(c.taste.label, '이/가')] : ['별빛스프의 맛이'];
        return [
          you(c, '은/는').concat([' 우물거리며 잠에서 깼어요.\n']).concat(you(c), ['의 입 안에는 아직 ']).concat(taste, [' 느껴지는 것 같아요.']),
          { coda: true, parts: ['오늘도, 먹을 수 있을까요?\n착한 아이에게 주는 별빛 스프를!'] }
        ];
      }
    }
  ];

  /* ---------- 임시 그림 (실제 삽화가 들어오기 전까지만 사용) ---------- */
  function star(x, y, r) {
    return 'M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
      'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z';
  }
  function stars(list, fill) {
    return list.map(function (s) { return '<path d="' + star(s[0], s[1], s[2]) + '" fill="' + (fill || '#fff3cf') + '"/>'; }).join('');
  }
  var V = '<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">';
  var motifs = {
    moon: V +
      '<mask id="m-moon"><rect width="200" height="160" fill="#fff"/><circle cx="122" cy="62" r="40" fill="#000"/></mask>' +
      '<circle cx="100" cy="78" r="46" fill="#ffd98a" mask="url(#m-moon)"/>' +
      stars([[150, 34, 7], [168, 92, 4], [36, 40, 5], [52, 118, 3.5], [140, 128, 5]]) + '</svg>',
    table: V +
      '<path d="M18 108 Q100 84 182 108 L176 132 Q100 150 24 132Z" fill="#f2e6cf"/>' +
      '<ellipse cx="100" cy="106" rx="82" ry="14" fill="#fbf4e4"/>' +
      '<ellipse cx="52" cy="102" rx="18" ry="6" fill="#ffffff"/><circle cx="52" cy="96" r="8" fill="#ff9e8c"/>' +
      '<ellipse cx="100" cy="98" rx="20" ry="6" fill="#ffffff"/><path d="M86 96 Q100 72 114 96Z" fill="#ffc65a"/>' +
      '<ellipse cx="148" cy="102" rx="18" ry="6" fill="#ffffff"/><circle cx="142" cy="96" r="6" fill="#9fd3a8"/><circle cx="153" cy="95" r="6" fill="#f5efe2"/>' +
      stars([[30, 40, 5], [170, 46, 6], [100, 30, 4]]) + '</svg>',
    seat: V +
      '<rect x="56" y="30" width="88" height="62" rx="16" fill="#3f4a86"/>' +
      '<ellipse cx="100" cy="104" rx="70" ry="16" fill="#fbf4e4"/>' +
      '<ellipse cx="100" cy="100" rx="30" ry="9" fill="#ffffff"/>' +
      '<rect x="138" y="88" width="5" height="26" rx="2.5" fill="#d9cdb4"/><rect x="56" y="88" width="5" height="26" rx="2.5" fill="#d9cdb4"/>' +
      stars([[34, 34, 5], [168, 30, 4]]) + '</svg>',
    fairies: V +
      '<ellipse cx="62" cy="66" rx="18" ry="28" fill="#cfe0ff" opacity=".55" transform="rotate(-24 62 66)"/>' +
      '<ellipse cx="86" cy="66" rx="18" ry="28" fill="#cfe0ff" opacity=".55" transform="rotate(24 86 66)"/>' +
      '<circle cx="74" cy="78" r="14" fill="#ffd6e2"/>' +
      '<ellipse cx="132" cy="54" rx="14" ry="22" fill="#e6d6ff" opacity=".55" transform="rotate(-24 132 54)"/>' +
      '<ellipse cx="150" cy="54" rx="14" ry="22" fill="#e6d6ff" opacity=".55" transform="rotate(24 150 54)"/>' +
      '<circle cx="141" cy="64" r="11" fill="#fff0c9"/>' +
      '<ellipse cx="108" cy="124" rx="34" ry="8" fill="#fbf4e4"/><path d="M80 122 Q108 86 136 122Z" fill="#e9d9b8"/><circle cx="108" cy="100" r="4" fill="#ffc65a"/>' +
      stars([[44, 36, 5], [176, 98, 5], [104, 30, 4]], '#ffd98a') + '</svg>',
    bubble: V +
      '<rect x="66" y="26" width="112" height="62" rx="22" fill="#fbf4e4"/><path d="M84 84 L72 106 L102 86Z" fill="#fbf4e4"/>' +
      stars([[98, 57, 9], [122, 57, 9], [146, 57, 9]], '#ffc65a') +
      '<ellipse cx="38" cy="104" rx="14" ry="22" fill="#cfe0ff" opacity=".55" transform="rotate(-24 38 104)"/>' +
      '<ellipse cx="60" cy="104" rx="14" ry="22" fill="#cfe0ff" opacity=".55" transform="rotate(24 60 104)"/>' +
      '<circle cx="49" cy="116" r="12" fill="#ffd6e2"/></svg>',
    cloche: V +
      '<ellipse cx="100" cy="120" rx="70" ry="14" fill="#fbf4e4"/>' +
      '<path d="M44 116 Q46 56 100 54 Q154 56 156 116Z" fill="#e9d9b8"/><circle cx="100" cy="50" r="7" fill="#ffc65a"/>' +
      '<path d="M62 100 Q66 74 88 66" stroke="#fff8e8" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>' +
      stars([[30, 60, 7], [172, 52, 8], [52, 30, 4], [150, 26, 5]], '#ffd98a') + '</svg>',
    soup: V +
      '<path d="M34 84 H166 Q160 138 100 140 Q40 138 34 84Z" fill="#fbf4e4"/>' +
      '<ellipse cx="100" cy="84" rx="66" ry="14" fill="#ffc65a"/>' +
      '<ellipse cx="100" cy="84" rx="54" ry="9" fill="#ffd98a"/>' +
      stars([[80, 83, 5], [106, 81, 6], [128, 85, 4]], '#fffbe9') +
      '<rect x="70" y="140" width="60" height="6" rx="3" fill="#e9d9b8"/></svg>',
    dawn: V +
      '<circle cx="152" cy="40" r="20" fill="#ffd27a"/>' +
      '<rect x="22" y="78" width="70" height="34" rx="16" fill="#fbf4e4"/>' +
      '<circle cx="66" cy="84" r="17" fill="#ffd9c2"/>' +
      '<path d="M58 84 q4 3 8 0 M70 84 q4 3 8 0" stroke="#5a3d2e" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M40 100 Q100 82 184 100 L184 140 L40 140Z" fill="#8fa6e8"/>' +
      '<path d="M40 100 Q100 82 184 100" stroke="#b8c8f5" stroke-width="5" fill="none"/>' +
      stars([[180, 70, 4], [120, 24, 3]], '#fff3cf') + '</svg>'
  };

  window.StarSoup = {
    acts: acts,
    foods: foods,
    tastes: tastes,
    scenes: scenes,
    deedExamples: deedExamples,
    motifs: motifs,
    josa: josa,
    limits: { name: 12, deed: 80 },
    // 삽화 자리에 "어떤 파일을 넣으면 되는지" 경로를 표시한다. 실제 삽화를 다 넣은 뒤에는 false로 바꾼다.
    showAssetNotes: true
  };
})();

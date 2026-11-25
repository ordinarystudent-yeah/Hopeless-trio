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

  // '(으)로': 받침이 없거나 ㄹ이면 '로', 그 밖의 받침은 '으로'
  function ro(word) {
    var last = word.charCodeAt(word.length - 1);
    if (isNaN(last) || last < 0xac00 || last > 0xd7a3) return '(으)로';
    var j = (last - 0xac00) % 28;
    return j === 0 || j === 8 ? '로' : '으로';
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
    { id: 'galaxy', label: '은하수가 퍼지는 듯한 달콤한 맛', short: '달콤한 맛', image: 'assets/backgrounds/09-taste-galaxy.jpg', emoji: '🌌', glow: '#5a4f9a' },
    { id: 'spark', label: '별빛이 입 안에서 터지는 듯한 짜릿한 맛', short: '짜릿한 맛', image: 'assets/backgrounds/09-taste-spark.jpg', emoji: '✨', glow: '#8a6a24' },
    { id: 'cloud', label: '구름을 입에 머금은 듯한 포근한 맛', short: '포근한 맛', image: 'assets/backgrounds/09-taste-cloud.jpg', emoji: '☁️', glow: '#5f6f9a' }
  ];

  /* ---------- 착한 일 예시 (눌러서 바로 채우기) ---------- */
  var deedExamples = [
    '동생에게 장난감을 양보했어요',
    '엄마의 설거지를 도와드렸어요',
    '혼자서 신발 끈을 묶었어요',
    '넘어진 친구를 일으켜 줬어요'
  ];

  /* ---------- 10개 장면 ----------
     장면 하나 = 펼친 책 한 면 = 가로 A4 두 쪽(왼쪽 쪽, 오른쪽 쪽).
     image  : 펼침면 전체에 깔리는 삽화 한 장 (가로:세로 = 594:210, 약 2.83:1)
              실제 동화책처럼 모든 쪽에 삽화가 들어가며, 글은 삽화 위의 글 상자에 놓인다.
              쪽마다 따로 그린 삽화를 쓰려면 pages의 각 쪽에 image(가로 A4, 297:210)를 넣는다.
     pages  : [왼쪽 쪽, 오른쪽 쪽] 구성
       image    이 쪽에만 쓰는 삽화 (선택. 있으면 펼침면 삽화 위에 이 쪽을 덮음). 함수면 고른 값에 따라 (#9 16쪽)
       art      임시 그림 종류 (실제 삽화가 들어오면 자동으로 숨겨짐)
       faint    true면 임시 그림을 입력 도구 뒤에 옅게 깐다
       artPos   임시 그림 위치 top | bottom (기본은 가운데)
       text     true면 장면 본문(text)을 놓고, 함수면 이 쪽만의 본문 (#2·3처럼 한 펼침면에 두 장면일 때)
       no       글 위에 붙는 장면 번호 (없으면 장면의 no)
       ink      'dark'면 삽화가 들어왔을 때 글 상자 없이 진한 글씨로 그림 위에 쓴다 (말풍선·밝은 여백용)
       nameplate 그림 속 이름표 자리 {x, y, w, h, r} (이 쪽 기준 비율). 여기에 바로 이름을 입력한다
       place    본문 세로 위치 top | center | bottom
       widgets  이 쪽에 놓을 것 (food-result, deed-hint, recap)
     asks        이 장면 앞에 차례로 묻는 화면들 time | weather | food | deed | taste (입력 도구가 그림을 가리지 않게)
     askAt       한 쪽씩 보기에서 묻는 화면을 이 쪽 앞에 둔다 (#10: 17쪽과 18쪽 사이)
     sky         true면 가장 아래층에 고른 때의 하늘색을 깐다 (#1). 쪽(pages)에 쓰면 그 쪽만, 때 id면 그 때로 고정
     weatherFx   true면 가장 위층에 고른 날씨의 움직이는 효과를 얹는다 (#1)
     question    묻는 화면에 나오는 질문 (#6)
     require     다음 장면으로 가기 전에 꼭 골라야 하는 값
     requirePage 그 값을 고르는 쪽 (휴대폰에서 한 쪽씩 넘길 때 이 쪽을 떠나기 전에 확인) */
  var scenes = [
    {
      // #1 앞에서 '때'와 '날씨'를 묻는다. 층 순서: 위) 날씨 효과 / 중간) 삽화 / 아래) 하늘색
      // 층 순서 (위에서 아래로): 날씨 효과 / 도심(01-city.png) / 밤하늘 삽화(01-intro.jpg, 스크린 70%) / 고른 때의 하늘색
      id: 'intro', act: 0, tone: 'night', no: '1', asks: ['time', 'weather'], sky: true, weatherFx: true,
      image: 'assets/backgrounds/01-intro.jpg', alt: '초승달과 별이 걸린 하늘 아래 알록달록한 마을',
      // 삽화를 고른 때의 하늘색 위에 효과로 겹친다: 밤은 효과 없이 삽화 그대로, 나머지는 스크린 (노을은 어두운 마젠타 위에)
      imageBlend: function (time) {
        if (time === 'night') return null;

        return { mode: 'screen', opacity: 0.7 };
      },
      overlay: 'assets/backgrounds/01-city.png',
      pages: [
        { text: function (c) { return introOpening(c); }, place: 'top' },
        { text: function (c) { return introSky(c); }, place: 'bottom' }
      ],
      nextLabel: '꿈속으로 들어가기',
      text: function () { return []; }
    },
    {
      // 콘티의 #2와 #3은 펼침면 한 장: 왼쪽 쪽 #2(식탁), 오른쪽 쪽 #3(이름표)
      id: 'name', act: 0, tone: 'table', no: '2·3',
      image: 'assets/backgrounds/02-03-dream-table.jpg', alt: '하늘에 떠 있는 꿈속 식탁과 빈 이름표가 놓인 나의 자리',
      pages: [
        { no: '2', text: function (c) { return [you(c).concat(['의 꿈속에는 ']).concat(you(c, '을/를'), [' 위한 식탁이 준비되어 있어요.'])]; }, place: 'bottom', art: 'table' },
        {
          no: '3', text: function () { return [['당신의 자리도 있어요.\n당신의 이름은 무엇인가요?']]; },
          place: 'top', ink: 'dark', art: 'seat', artPos: 'bottom', textAt: { x: 0.24, y: 0.09 },   // 글은 흰 여백에: 쪽 왼쪽에서 24%, 위에서 9% 자리부터
          // 그림 속 이름표 앞면 자리(이 쪽 기준 비율). 앱에서는 여기에 바로 이름을 쓰고, 종이책에서는 빈칸으로 남는다.
          // r: 기울기 — 오른쪽이 조금 내려가게 (점선이 이름표 윗면과 나란하도록)
          nameplate: { x: 0.34, y: 0.5, w: 0.46, h: 0.19, r: 3 }
        }
      ],
      nextLabel: function (c) { return c.hasName ? '이 이름으로 앉기' : '이름 없이 앉기'; }
    },
    {
      id: 'food', act: 1, tone: 'table', no: '4', asks: ['food'],
      image: 'assets/backgrounds/04-food-choice.jpg', alt: '맛있는 음식이 잔뜩 놓인 식탁에 앉은 주인공',
      // 음식 카드는 이 펼침면 앞의 '음식 고르기' 화면에서 고른다 (그림을 가리지 않게).
      // 이 펼침면에는 글과 고른 음식의 설명, 그리고 첫 쪽(5쪽)에 붙는 음식 스티커만 있다.
      // 5쪽: 글은 위, 스티커 안내는 아래 식탁보 위 / 6쪽: 고른 음식 설명은 가운데 노란 빈자리
      pages: [{ text: true, place: 'top', ink: 'dark', art: 'table', note: 'food-sticker', noteAt: 'bottom' }, {
        widgets: ['food-result'], place: 'center', art: 'feast', artPos: 'bottom',
        // 6쪽: 고른 음식의 글은 손글씨 식자 그림(assets/lettering, 투명 PNG)으로.
        // 직접 그린 음식에 이름을 적었으면 그 이름이 들어가야 하므로, 식자 그림과 같은 자리·같은 곡선을 따라 글꼴로 쓴다
        lettering: function (c) {
          if (!c.food) return null;
          // 직접 그린 음식에 이름을 적었으면: 식자 그림에서 '직접 고른 음식을'만 지운 그림 위에,
          // 그 자리(윗줄 원의 호)를 따라 같은 크기의 글꼴로 '직접 고른 (이름)을/를'을 쓴다
          if (c.food.custom && c.food.typedName) {
            var nm = c.food.name;
            return { src: 'assets/lettering/06-food-custom-rest.png', arc: {
              text: '직접 고른 ' + nm + josa(nm, '을/를'),
              // 식자 그림(쪽 856×624px) 기준: 윗줄 글자 가운데를 지나는 원, '을'이 끝나던 자리, 글씨 크기(px)
              w: 856, h: 624, cx: 382.9, cy: -34.5, r: 374.5, endX: 366, size: 39.5, track: 0.867, gap: 0, minX: 30
            } };
          }
          return 'assets/lettering/06-food-' + (c.food.custom ? 'custom' : c.food.id) + '.png';
        },
        curve: {
          ink: 'dark', replacesWidgets: true,
          text: function (c) { return c.food ? { body: c.food.desc } : null; },
          lines: [
            { pts: [[0.235, 0.475], [0.36, 0.525], [0.50, 0.54], [0.66, 0.515], [0.80, 0.455]] },
            { pts: [[0.235, 0.60], [0.36, 0.655], [0.50, 0.665], [0.66, 0.635], [0.80, 0.555]] }
          ]
        }
      }],
      requireMessage: '먹고 싶은 음식을 하나 골라 주세요.',
      text: function () { return [['자리에 앉아 앞을 바라보니 맛있는 음식들이 잔뜩 있어요.\n어떤 것부터 먹고 싶나요?']]; }
    },
    {
      id: 'fairies', act: 1, tone: 'fairy', no: '5',
      image: 'assets/backgrounds/05-fairies-arrive.jpg', alt: '뚜껑 덮인 음식을 트레이에 끌고 오는 요정과 그 모습을 바라보는 주인공',
      // 왼쪽 쪽: 위에 트레이를 끌고 오는 요정, 그 아래 빈 자리에 글 / 오른쪽 쪽: 다 먹은 식탁에서 요정을 보는 주인공
      pages: [
        // 7쪽: 글은 위쪽 연기 물결 안에 — 손글씨 식자 그림으로
        { text: true, place: 'top', ink: 'dark', art: 'fairies', artPos: 'top', lettering: 'assets/lettering/07-fairies.png',
          curve: { ink: 'dark', eyebrowAt: [0.24, 0.04], lines: [
            { pts: [[0.24, 0.10], [0.39, 0.15], [0.54, 0.12]] },
            { pts: [[0.18, 0.25], [0.43, 0.26], [0.58, 0.22], [0.72, 0.25]] },
            { pts: [[0.45, 0.37], [0.63, 0.35], [0.82, 0.40]] }
          ] } },
        // 8쪽: 글은 왼쪽 아래 보랏빛 연기 위에, 연기 흐름을 따라 비스듬히
        { text: function () { return [['요정은 아이들이 했던 착한 일들을 하나하나 말해주었어요.']]; }, place: 'bottom', lettering: 'assets/lettering/08-fairies.png', letterRotate: { deg: 3, at: '50% 86%' },   // 글씨 가운데를 축으로 시계 방향 3°
          curve: { ink: 'light', eyebrowAt: [0.30, 0.71], lines: [
            { pts: [[0.30, 0.79], [0.46, 0.82], [0.63, 0.87]] },
            { pts: [[0.26, 0.86], [0.43, 0.89], [0.61, 0.93]] },
            { pts: [[0.23, 0.91], [0.33, 0.95]] }
          ] } }
      ],
      text: function () {
        return [
          ['그렇게 음식을 먹다 보니 요정들이 무언가 음식을 가져오네요.'],
          ['가장 착한 아이에게 주는 음식이래요!']
        ];
      }
    },
    {
      id: 'deed', act: 2, tone: 'fairy', no: '6', asks: ['deed'],
      image: 'assets/backgrounds/06-fairy-praise.jpg', alt: '요정의 큰 말풍선과 별이 담긴 그릇',
      // 착한 일은 이 펼침면 앞의 묻는 화면에서 적는다 (입력칸이 그림을 가리지 않게).
      // 왼쪽 쪽의 큰 말풍선 안에 내가 적은 착한 일 (나레이션은 #5 두 번째 쪽으로 옮김) / 오른쪽 쪽은 삽화만
      pages: [
        // 글은 그림 속 말풍선 몸통의 한가운데(쪽 기준 가로 59%, 세로 51%)에
        { bubble: { x: 0.34, y: 0.29, w: 0.5, h: 0.44, text: function (c) { return c.deed ? { text: '“' + c.deed + '”' } : { text: '나의 착한 일', empty: true }; } } },
        // 10쪽: 나에 대해 적는 보드 (tools/board_art.py). 착한 일 메모지·좋아하는 음식 메모지가 붙고, 그 위에 그림을 그린다
        { image: 'assets/backgrounds/06-board.jpg', widgets: ['board-draw'], place: 'top', ink: 'dark', board: true,
          text: function (c) { return [['요정이 '].concat(you(c), ['의 착한 일을 적어 보여주었어요.'])]; },
          note: function () { return '보드를 마음껏 꾸며보세요.'; }, noteAt: 'bottom' }
      ],
      text: function () { return []; },
      // 펼침면 앞의 묻는 화면에 나오는 질문
      question: function (c) { return [you(c, '이/가').concat([' 한 일 중 가장 뿌듯했던 일, 보람 있었던 일은 무엇인가요?'])]; }
    },
    {
      // 한 쪽짜리 장면: 11쪽(뚜껑을 연 음식 + 글)만 보고 바로 별빛스프 꾸미기로 (한 쪽씩 보기에서 12쪽은 건너뜀)
      id: 'serve', act: 2, tone: 'gold', no: '7', onePage: true,
      image: 'assets/backgrounds/07-fairies-serve.jpg', alt: '박수를 치며 음식을 놓아 주는 요정들',
      pages: [{ text: true, place: 'top', ink: 'dark' }, { widgets: ['soup-ui'] }],
      // 와! 당신이 한 (착한 일)로 요정들은 박수를 보내며 당신의 앞에 그 음식을 놓아주었어요.
      text: function (c) {
        // 문장으로 끝나는 착한 일(…했어요)은 '‘…’라는 착한 일로', 짧은 말(설거지 돕기)은 '…로'
        var d = (c.deed || '').replace(/[.!?。]+$/, '');
        var deed = !d ? ['착한 일로'] : /[요다]$/.test(d) ? [{ v: '‘' + d + '’' }, '라는 착한 일로'] : [{ v: d }, ro(d)];
        return [
          ['와! '].concat(you(c, '이/가'), [' 한 '], deed, [' 요정들은 박수를 보내며 ']).concat(you(c), ['의 앞에 그 음식을 놓아주었어요.'])
        ];
      }
    },
    {
      // 이 펼침면 앞의 '요리' 화면에서 별빛스프에 넣을 재료(최대 5개)를 이름을 적고 그린다.
      // 왼쪽 쪽(13쪽)은 위에서 내려다본 스프 그릇(임시 아트워크, tools/soup_top.py), 그 위에 재료 스티커.
      // 한 쪽짜리 장면: 13쪽(스프 그릇 + 글)만 보고 바로 '무슨 맛이 났나요?'로 (한 쪽씩 보기에서 14쪽은 건너뜀)
      // 펼침 화면에서는 재료 넣기를 #7 12쪽에, 맛 고르기를 14쪽에 넣으므로 그 앞의 묻는 화면은 젓기만 (spreadAsks)
      id: 'soup', act: 2, tone: 'gold', no: '8', effect: 'sparkles', sparkles: 12, asks: ['soup', 'stir'], spreadAsks: ['stir'], onePage: true,
      image: null, alt: '위에서 내려다본 별빛스프',
      pages: [
        { image: 'assets/backgrounds/08-soup-top.jpg', widgets: ['soup-ingredients', 'deed-note', 'soup-scoop'], text: true, place: 'top', ink: 'dark' },
        { art: 'starsky', artPos: 'bottom', widgets: ['taste-ui'] }
      ],
      text: function (c) {
        return [
          ['뚜껑을 여니, 별빛이 동동 떠다니는 스프가 있어요. '].concat(you(c, '은/는'), [' 한입 스프를 입에 넣었어요.'])
        ];
      }
    },
    {
      id: 'taste', act: 3, tone: 'gold', no: '9', asks: ['taste'], spreadAsks: [],
      image: 'assets/backgrounds/09-taste.jpg', alt: '별빛스프의 맛이 소용돌이처럼 퍼지는 순간',
      // '무슨 맛이 났나요?'는 이 펼침면 앞의 묻는 화면에서 회전 카드로 고른다.
      // 왼쪽 쪽은 삽화, 오른쪽 쪽(16쪽)에는 고른 맛에 맞춘 그림(assets/backgrounds/09-taste-<맛>.jpg)만 (글 없음)
      pages: [
        { art: 'soup' },
        {
          // '직접 그리기'를 고르면 이 쪽이 도화지가 되어 바로 그릴 수 있다
          image: function (c) { return c.taste && c.taste.id !== 'custom' ? 'assets/backgrounds/09-taste-' + c.taste.id + '.jpg' : null; },
          widgets: ['taste-draw'],
          // 15쪽 삽화가 이어지게: 왼쪽 1/3은 투명, 거기서부터 서서히 나타난다
          fade: true,
          art: 'starsky'
        }
      ],
      requireMessage: '스프에서 어떤 맛이 났는지 하나 골라 주세요.',
      nextLabel: '잠에서 깨기',
      text: function () { return [['무슨 맛이 났나요?']]; },
      hint: '옆으로 넘겨 보세요. 가운데에 보이는 맛이 골라져요.'
    },
    {
      // #10: 17쪽 잠에서 깸 / 18쪽 창 밖 (삽화를 빼고 화창한 아침 하늘 + '창 밖을 보니…'에서 고른 날씨)
      // 날씨는 '창 밖을 보니…' 묻는 화면에서 고른다: 한 쪽씩 보기는 17쪽과 18쪽 사이, 펼침면은 이 장면 앞.
      // 18쪽: 닫힌 창문 그림. 창문을 누르면 열리며 '창 밖을 보니…'를 묻고, 고르면 열린 창 너머에 그 날씨가 보인다
      id: 'ending', act: 3, tone: 'dawn', no: '10',
      require: 'wakeWeather', requirePage: 1, requireMessage: '창문을 눌러 창 밖을 봐 주세요.',
      image: 'assets/backgrounds/10-wake-up.jpg', alt: '아침에 잠에서 깬 아이의 방',
      pages: [
        { text: true, place: 'top', art: 'dawn', artPos: 'bottom' },
        { window: true, text: function (c) { return windowText(c); }, place: 'bottom' }
      ],
      text: function (c) {
        var taste = c.taste ? [{ v: c.taste.label }, josa(c.taste.label, '이/가')] : ['별빛스프의 맛이'];
        return [
          you(c, '은/는').concat([' 우물거리며 잠에서 깼어요.\n']).concat(you(c), ['의 입 안에는 아직 ']).concat(taste, [' 느껴지는 것 같아요.'])
        ];
      }
    }
  ];

  /* ---------- 스티커 기본 자리 (펼침면 기준 비율: x·y는 가운데 위치, w는 펼침면 너비 대비 크기) ---------- */
  var stickerSpots = {
    // 음식 스티커는 음식을 고른 다음 화면에 나타난다
    food: { x: 0.27, y: 0.7, w: 0.11, r: -6 },      // #4 첫 쪽(5쪽) 식탁 위
    serve: { x: 0.37, y: 0.66, w: 0.13, r: 5 },     // (예전) #7 11쪽 착한 일 종이
    boardDeed: { x: 0.66, y: 0.62, w: 0.14, r: -4 },  // #6 10쪽 보드: 착한 일 메모지
    boardFood: { x: 0.86, y: 0.64, w: 0.11, r: 5 }    // #6 10쪽 보드: 가장 좋아하는 음식 메모지
  };


  /* ---------- #1 앞: 때와 날씨 ----------
     때는 그날의 기분에 빗댄다. sky는 #1의 가장 아래층에 깔리는 하늘색. */
  var times = [
    { id: 'dawn', phrase: '어스름한 새벽', label: '어스름한 새벽', word: '새벽', mood: '아직 잠이 덜 깬 기분',
      say: '어스름한 새벽이에요.', after: '집들이 하나 둘 깨기 시작했지만, 역시 아직 자고 싶어요.',
      sky: 'linear-gradient(180deg, #232a66 0%, #6d5fa6 55%, #e9a4a0 100%)' },
    { id: 'morning', phrase: '밝은 아침', label: '밝은 아침', word: '아침', mood: '막 눈을 뜬 상쾌한 기분',
      say: '밝은 아침이에요.', after: '밝은 아침에도 아직 피곤해요... 더 자고 싶은 당신은 꾸벅꾸벅 눈이 감겨요.',
      sky: 'linear-gradient(180deg, #8cc6f0 0%, #cfe7f6 55%, #fde6c4 100%)' },
    { id: 'day', phrase: '환한 낮', label: '환한 낮', word: '낮', mood: '햇살처럼 들뜬 기분',
      say: '환한 낮이에요.', after: '낮이지만, 꿈뻑꿈뻑 졸려요.',
      sky: 'linear-gradient(180deg, #3b8de0 0%, #7cc0f2 55%, #cdeafb 100%)' },
    { id: 'evening', phrase: '노을 진 저녁', label: '노을이 진 저녁', word: '저녁', mood: '노곤노곤 지친 기분',
      say: '노을이 진 저녁이네요.', after: '잠을 자기에는 이르지만, 노곤노곤 몸이 피곤해지는 시간이에요.',
      sky: 'linear-gradient(180deg, #3a2f6b 0%, #b85c7c 55%, #f6a65a 100%)',
      // #1 효과 레이어: 조금 어두운 마젠타 위에 삽화를 스크린으로
      fxSky: 'linear-gradient(180deg, #6a1458 0%, #7e1a68 100%)' },
    { id: 'night', phrase: '깜깜한 밤', label: '깜깜한 밤', word: '밤', mood: '고요하고 졸린 기분',
      say: '깜깜한 밤이에요.', pre: '모두가 잠이 든 시간이에요.', after: '불 꺼진 밖을 보니 저절로 잠이 와요.',
      sky: 'linear-gradient(180deg, #0b1030 0%, #1d2452 60%, #2d2f6c 100%)' }
  ];

  // 날씨: #1의 가장 위층에 움직이는 효과(js/weather.js). 직접 그리기를 고르면 그린 그림이 그 층에 그대로 놓인다(움직이지 않음).
  var weathers = [
    { id: 'sunny', pre: '맑게 갠', label: '화창한 날', day: '화창한', emoji: '☀️', glow: '#d9a23a', feel: '맑고 청명한 기분이 들었어요.', seen: '맑은 햇살이 반짝반짝 쏟아지고 있었어요.' },
    { id: 'rain', pre: '비가 오는', label: '비 오는 날', day: '비가 내리는', emoji: '🌧️', glow: '#4a6f9a', feel: '톡톡 떨어지는 빗소리에 마음이 차분해졌어요.', seen: '보슬보슬 비가 내리고 있었어요.' },
    { id: 'snow', pre: '눈이 오는', label: '눈 오는 날', day: '눈이 내리는', emoji: '❄️', glow: '#8aa6c8', feel: '소복소복 내리는 눈에 마음이 포근해졌어요.', seen: '하얀 눈이 소복소복 내리고 있었어요.' },
    { id: 'cloudy', pre: '구름이 낀', label: '흐린 날', day: '흐린', emoji: '☁️', glow: '#6b7390', feel: '구름이 잔뜩 낀 하늘처럼 마음이 몽글몽글했어요.', seen: '몽실몽실 구름이 하늘을 덮고 있었어요.' }
  ];
  var customWeather = { label: '직접 그리기', day: '특별한', pre: '특별한 하늘이 펼쳐진', feel: '내가 그린 하늘처럼 특별한 기분이 들었어요.', seen: '내가 그린 하늘이 펼쳐져 있었어요.' };

  // #1 왼쪽 쪽: 하루를 보내고 창문을 여니…
  function introOpening(c) {
    return [['하루를 보내고 창문을 여니…']];
  }
  // #1 오른쪽 쪽: 날씨와 때를 한 문장으로("비가 오는 깜깜한 밤이에요.") + 잠이 들었던 (선택한 시간)…
  function introSky(c) {
    var t = c.time, w = c.weather;
    var first = [];
    if (t) first.push({ v: w ? w.pre + ' ' + t.phrase + '이에요.' : t.say });
    else if (w) first.push(w.feel);
    if (t && t.pre) first.push(' ' + t.pre);
    if (t) first.push(' ' + t.after);
    var out = [];
    if (first.length) out.push(first);
    out.push(t ? ['잠이 들었던 ', { v: t.word }, '. 당신의 꿈속에는 특별한 일이 일어나고 있어요.'] : ['모두가 잠이 든 밤. 당신의 꿈속에는 특별한 일이 일어나고 있어요.']);
    return out;
  }

  // #10 18쪽: 한결 달라진 기분으로 창문을 여니, (날씨) + 오늘도, 먹을 수 있을까요?
  function windowText(c) {
    var w = c.wakeWeather;
    if (!w) return null;   // 창을 열기 전에는 글 없이 창문만
    return [
      ['한결 달라진 기분으로 창문을 여니, '].concat(w ? [{ v: w.seen }] : ['밝은 아침이 와 있었어요.']),
      { coda: true, parts: ['오늘도, 먹을 수 있을까요?\n착한 아이에게 주는 별빛 스프를!'] }
    ];
  }

  /* ---------- 표지 ---------- */
  var cover = {
    image: 'assets/backgrounds/00-cover.jpg?v=1.45',          // 앞표지 그림 (가로 A4, 297:210) — 제목·소제목 글씨가 그림 안에 들어 있다
    backImage: 'assets/backgrounds/00-back-cover.jpg?v=1.45', // 뒷표지: 화면에는 안 띄우고 PDF 맨 끝에만
    kicker: '꿈속 식탁 이야기',
    title: '별빛스프',
    subtitle: '착한 아이에게 주는 특별한 스프'
  };


  /* ---------- #10 18쪽 황금빛 편지: 요정의 한마디 (오늘의 운세 같은 짧고 쉬운 한 문장) ----------
     조합 = [때(지금 기분과 닮은 때) 5] × [스프 맛(바라는 위로) 4] × [잠에서 깨어 본 창 밖 날씨(오늘 하루) 5] = 100가지.
     조합마다 한 문장을 따로 썼다. 꿈속 날씨·음식은 문장에 쓰지 않는다.
     심리 치유 근거 (기분별):
       새벽(아직 덜 깬 막막함) → 수용, 작은 첫걸음        아침(상쾌한 시작) → 음미, 하루의 다짐
       낮(들뜬 기운) → 나눔, 몸 움직이기, 쉼표          저녁(노곤한 지침) → 자기 칭찬, 흘려보내기, 쉼의 허락
       밤(고요·외로움) → 감사, 걱정 내려놓기, 잠자리 돌봄
     맛: 달콤(작은 보상·기쁨) · 짜릿(활력·용기) · 포근(쉼·안정) · 직접 그리기(나만의 방식) */
  var fortuneLines = {   // [때][맛][창 밖 날씨]
    dawn: {
      galaxy: {
        sunny: '햇살이 달콤한 시작을 열어 줄 거예요.',
        rain: '따뜻한 음료 한 잔이면 충분해요.',
        snow: '천천히 깨어나도 괜찮아요.',
        cloudy: '작은 간식이 큰 위로가 돼요.',
        custom: '나에게 작은 선물을 해 주세요.'
      },
      spark: {
        sunny: '기지개 한 번이 용기가 돼요.',
        rain: '작은 한 걸음이면 성공이에요.',
        snow: '오늘의 첫 발자국은 당신 거예요.',
        cloudy: '흐린 날의 도전이 더 반짝여요.',
        custom: '설렘은 천천히 깨어나요.'
      },
      cloud: {
        sunny: '햇볕 아래 크게 숨 쉬어 보세요.',
        rain: '이불 속 5분, 괜찮아요.',
        snow: '느린 아침도 멋져요.',
        cloudy: '지금도 잘하고 있어요.',
        custom: '내 속도로 걸어도 돼요.'
      },
      custom: {
        sunny: '오늘은 당신이 그리는 대로 펼쳐져요.',
        rain: '비 오는 날의 기분도 소중해요.',
        snow: '오늘을 마음껏 그려 보세요.',
        cloudy: '내 방식이 곧 정답이에요.',
        custom: '내 마음의 소리를 따라가요.'
      }
    },
    morning: {
      galaxy: {
        sunny: '좋아하는 노래가 행운을 불러요.',
        rain: '고마운 일 하나를 떠올려 봐요.',
        snow: '작은 기쁨을 크게 기뻐해요.',
        cloudy: '다정한 말을 먼저 건네 봐요.',
        custom: '기대되는 일 하나를 품고 출발해요.'
      },
      spark: {
        sunny: '시작만 해도 대성공이에요.',
        rain: '비 오는 날의 도전은 두 배로 빛나요.',
        snow: '처음 해 보는 일이 행운이 돼요.',
        cloudy: '당신의 생각은 오늘도 반짝여요.',
        custom: '엉뚱한 생각이 오늘을 특별하게 해요.'
      },
      cloud: {
        sunny: '잠깐 걸으면 마음이 가벼워져요.',
        rain: '할 일을 하나 줄여도 괜찮아요.',
        snow: '천천히 가면 더 많이 보여요.',
        cloudy: '지금 모습 그대로 충분해요.',
        custom: '편안한 마음으로 하루를 보내요.'
      },
      custom: {
        sunny: '오늘의 주인공은 당신이에요.',
        rain: '나만의 즐거움을 찾아봐요.',
        snow: '다른 길로 가면 선물이 있어요.',
        cloudy: '비교하지 않는 하루가 가장 맑아요.',
        custom: '좋아하는 일을 하나 더 해 봐요.'
      }
    },
    day: {
      galaxy: {
        sunny: '기쁨을 누군가와 나눠 봐요.',
        rain: '달콤한 휴식이 최고의 상이에요.',
        snow: '좋은 순간을 천천히 음미해요.',
        cloudy: '당신의 웃음이 누군가의 햇살이에요.',
        custom: '오늘 받은 칭찬을 기억해 두세요.'
      },
      spark: {
        sunny: '몸을 움직이면 행운이 와요.',
        rain: '집중하면 놀라운 일을 해내요.',
        snow: '새 친구에게 먼저 인사해 봐요.',
        cloudy: '당신의 열정은 꺼지지 않아요.',
        custom: '하고 싶던 일, 오늘 해 봐요.'
      },
      cloud: {
        sunny: '하늘을 한 번 올려다봐요.',
        rain: '마음에 쉼표를 찍어 주세요.',
        snow: '천천히 해도 다 해낼 수 있어요.',
        cloudy: '쉬는 것도 하루의 일이에요.',
        custom: '고마운 사람에게 말을 건네 봐요.'
      },
      custom: {
        sunny: '당신의 생각을 보여 줄 날이에요.',
        rain: '마음껏 상상해 보세요.',
        snow: '당신은 세상에 하나뿐이에요.',
        cloudy: '내 마음에 들면 충분해요.',
        custom: '규칙 하나를 살짝 바꿔 봐요.'
      }
    },
    evening: {
      galaxy: {
        sunny: '수고한 나를 칭찬해 주세요.',
        rain: '걱정은 빗물에 흘려보내요.',
        snow: '따뜻한 차 한 잔으로 마음을 녹여요.',
        cloudy: '좋았던 순간 하나는 꼭 있었어요.',
        custom: '행복했던 순간을 떠올려 봐요.'
      },
      spark: {
        sunny: '짧은 산책이 힘을 줘요.',
        rain: '힘든 만큼 자라고 있어요.',
        snow: '오늘 해낸 일을 세어 봐요.',
        cloudy: '내일의 설렘을 남겨 두세요.',
        custom: '"정말 잘했어"라고 말해 주세요.'
      },
      cloud: {
        sunny: '일찍 쉬는 것도 좋은 선택이에요.',
        rain: '못한 일은 내일 해도 돼요.',
        snow: '나를 포근히 안아 주세요.',
        cloudy: '힘들면 힘들다고 말해도 돼요.',
        custom: '아무것도 안 해도 괜찮아요.'
      },
      custom: {
        sunny: '나만의 방법으로 하루를 마무리해요.',
        rain: '오늘 마음을 한 줄로 적어 봐요.',
        snow: '내일은 더 나다운 하루예요.',
        cloudy: '완벽하지 않아도 의미 있었어요.',
        custom: '좋아하는 것으로 하루를 닫아요.'
      }
    },
    night: {
      galaxy: {
        sunny: '고마운 일 세 가지를 떠올려 봐요.',
        rain: '빗소리에 마음을 내려놓아요.',
        snow: '즐거운 상상을 하며 잠들어요.',
        cloudy: '당신은 누군가의 별이에요.',
        custom: '나를 웃게 한 사람을 떠올려요.'
      },
      spark: {
        sunny: '푹 자면 내일이 반짝여요.',
        rain: '걱정은 종이에 적어 두세요.',
        snow: '깊은 잠이 내일의 힘이 돼요.',
        cloudy: '밤이 지나면 꼭 아침이 와요.',
        custom: '내일 해 보고 싶은 일을 꿈꿔 봐요.'
      },
      cloud: {
        sunny: '천천히 숨을 내쉬어 보세요.',
        rain: '휴대폰을 내려놓고 쉬어요.',
        snow: '쉬는 동안에도 힘이 쌓여요.',
        cloudy: '당신 곁엔 늘 아끼는 마음이 있어요.',
        custom: '무사히 지나간 하루에 감사해요.'
      },
      custom: {
        sunny: '당신의 꿈은 소중한 이야기예요.',
        rain: '일기를 쓰면 마음이 편해져요.',
        snow: '내일 무엇을 그릴지 기대해요.',
        cloudy: '있는 그대로의 나를 안아 줘요.',
        custom: '오늘 밤은 나를 가장 아껴 주세요.'
      }
    }
  };
  // 아직 고르지 않은 값이 있을 때 (편지는 창 밖 날씨를 고른 뒤에 나오지만, 앞 선택이 비었을 수 있다)
  var fortuneFallback = '오늘도 당신 자신에게 다정한 하루를 선물해 주세요.';
  function fortuneLine(c) {
    var t = c.time && c.time.id, ta = c.taste && c.taste.id, ww = c.wakeWeather && c.wakeWeather.id;
    return ((fortuneLines[t] || {})[ta] || {})[ww] || fortuneFallback;
  }


  /* 행운의 주문: 음식 × #1 꿈속 날씨 35가지마다 따로 쓴 한 줄 (운세의 '행운 아이템'처럼).
     item = '<날씨> <음식 이름>', tip = 오늘 해 볼 작은 행동 (감각 깨우기·음미하기·작은 보살핌 등). */
  var luckyWeather = { sunny: '햇살 가득한 날의', rain: '비 오는 날의', snow: '눈 오는 날의', cloudy: '구름 낀 날의', custom: '내가 그린 하늘 아래' };
  var luckyTips = {   // [음식][꿈속 날씨]
    'cotton-candy': {
      sunny: '창문을 열고 바람을 한 번 느껴 보세요',
      rain: '무거운 생각은 빗물에 살살 녹여 보내요',
      snow: '하얀 것을 보면 소원을 하나 빌어 보세요',
      cloudy: '구름 모양에서 재미있는 그림을 찾아보세요',
      custom: '좋아하는 색 물건을 하나 챙겨 다니세요'
    },
    pudding: {
      sunny: '말랑한 미소로 먼저 인사해 보세요',
      rain: '흔들려도 괜찮아요, 천천히 숨 쉬어요',
      snow: '부드러운 담요를 덮고 잠깐 쉬어 가요',
      cloudy: '말랑한 것을 손에 쥐고 마음을 풀어 보세요',
      custom: '오늘의 기분을 맛으로 표현해 보세요'
    },
    chicken: {
      sunny: '좋아하는 사람과 맛있는 것을 나눠 보세요',
      rain: '바삭한 소리처럼 크게 한 번 웃어 보세요',
      snow: '신나는 노래에 맞춰 몸을 흔들어 보세요',
      cloudy: '제일 좋아하는 것을 나에게 먼저 주세요',
      custom: '오늘의 나에게 작은 상을 하나 주세요'
    },
    bread: {
      sunny: '햇살 아래에서 기지개를 쭉 켜 보세요',
      rain: '따뜻한 것 하나를 가까이 두세요',
      snow: '천천히 꼭꼭 씹으며 맛을 느껴 보세요',
      cloudy: '고소한 냄새처럼 좋은 기억을 떠올려 보세요',
      custom: '나만의 작은 습관 하나를 만들어 보세요'
    },
    omurice: {
      sunny: '나에게 다정한 말 한 줄을 써 주세요',
      rain: '포근한 이불 속에서 잠깐 눈을 감아요',
      snow: '가족에게 고맙다는 말을 전해 보세요',
      cloudy: '케첩으로 웃는 얼굴을 그리듯 미소 지어요',
      custom: '오늘 하루를 그림 한 장으로 남겨 보세요'
    },
    'rice-ball': {
      sunny: '가벼운 산책길에 작은 간식을 챙겨요',
      rain: '작은 일 하나를 끝내고 나를 칭찬해요',
      snow: '손을 꼭 쥐었다 펴며 내 힘을 느껴 보세요',
      cloudy: '물 한 잔을 천천히 마셔 보세요',
      custom: '오늘 할 일을 딱 하나만 정해 보세요'
    },
    custom: {   // 직접 그린 음식
      sunny: '떠오르는 생각을 그림으로 그려 보세요',
      rain: '빗소리를 들으며 상상 여행을 떠나요',
      snow: '하얀 종이에 오늘의 소원을 적어 보세요',
      cloudy: '좋아하는 색으로 하루를 채워 보세요',
      custom: '세상에 없는 나만의 것을 하나 만들어 보세요'
    }
  };
  function fortuneLucky(c) {
    if (fortuneSecret(c)) return { item: '세상에 하나뿐인 당신의 그림', tip: '오늘 그린 그림에 이름을 붙여 소중히 간직해 보세요', label: '🌈 비밀 주문' };
    var f = c.food, w = c.weather;
    var tip = f && w && (luckyTips[f.id] || {})[w.id];
    if (!tip) return null;
    return { item: luckyWeather[w.id] + ' ' + (f.name || ''), tip: tip };
  }


  /* 이스터 에그: 꿈속 날씨·음식·스프 맛·창 밖 날씨를 모두 '직접 그리기'로 고르면 비밀 편지가 나온다 ('때'에는 직접 그리기가 없다).
     제목·한마디·행운의 주문이 모두 바뀌고, 편지지가 무지갯빛으로 반짝인다 (style.css .fortune-paper.is-secret) */
  function fortuneSecret(c) {
    return ['weather', 'food', 'taste', 'wakeWeather'].every(function (k) { return c[k] && c[k].id === 'custom'; });
  }

  window.StarSoup = {
    version: '1.49',   // 게시할 때마다 0.01씩 올린다 (1.19 → 1.20 …, index.html의 ?v= 와 맞춘다)
    cover: cover,
    acts: acts,
    foods: foods,
    tastes: tastes,
    times: times,
    weathers: weathers,
    customWeather: customWeather,
    scenes: scenes,
    deedExamples: deedExamples,
    stickerSpots: stickerSpots,
    customFood: { label: '직접 그리기', fallbackName: '내가 그린 음식' },
    customTaste: { label: '직접 그리기', fallbackName: '내가 그린 맛', hint: '직접 그리기를 골랐어요. 다음으로 넘기면 16쪽에서 어떤 맛이었는지 바로 그릴 수 있어요.' },
    josa: josa,
    limits: { name: 12, deed: 80, foodName: 7,   // 음식 이름 7자: 6쪽 식자 윗줄 원을 따라 글씨가 줄지 않고 자연스럽게 들어가는 길이
              weatherName: 12, ingredient: 10, ingredients: 5, tasteName: 12 },
    // #10 18쪽: 창 밖 날씨를 고르면 창문으로 날아 들어오는 황금빛 메모 (요정의 한마디)
    // text(c): 지금까지 고른 조합(c.time, c.taste, c.wakeWeather)에 맞는 한 문장 → 위의 fortuneLine
    fortune: {
      // 모든 조합에 공통으로 맨 위에 나오는 문구 (이름이 없으면 '당신')
      title: function (c) { return fortuneSecret(c) ? '🎨 ' + c.you + '에게만 보이는 비밀 편지!' : c.you + '에게 하는 요정의 한마디!'; },
      text: function (c) {
        return [[fortuneSecret(c) ? '하늘도, 음식도, 맛도 모두 직접 그려 낸 당신은 이미 멋진 이야기의 작가예요.' : fortuneLine(c)]];
      },
      secret: fortuneSecret,
      line: fortuneLine,
      lucky: fortuneLucky   // { item, tip } 또는 null (음식·꿈속 날씨를 안 골랐을 때)
    },
    // 삽화 자리에 "어떤 파일을 넣으면 되는지" 경로를 표시한다. 실제 삽화를 다 넣은 뒤에는 false로 바꾼다.
    showAssetNotes: false
  };
})();

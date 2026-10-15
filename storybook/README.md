# 별빛스프 — 인터랙티브 웹 동화책

아이가 이름을 적고, 음식을 고르고, 착한 일을 이야기하면 그 내용이 동화 속 문장에 들어가는 10장면 웹 동화책입니다.
서버 없이 `index.html`을 브라우저로 열면 바로 동작합니다.

## 실행

```bash
# 폴더에서 아무 정적 서버나 사용 (파일을 더블클릭해서 열어도 동작합니다)
cd storybook
python3 -m http.server 8000
# → http://localhost:8000
```

## 진행 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1 | 기본 화면과 10개 장면 | 완료 |
| 2 | 이름 입력, 음식 선택, 착한 일 입력, 맛 선택 | 완료 |
| 3 | 모바일·태블릿·PC 반응형 | 완료 |
| 4 | 캔버스, 펜 3종, 지우개, 브러시 크기, 팔레트 | 예정 |
| 5 | 페인트 통, 실행 취소, 전체 지우기 확인창 | 예정 |
| 6 | 사진 삽입, 스티커 편집 | 예정 |
| 7 | 그림 저장, 이어하기, 동화에 반영 | 예정 |
| 8 | PDF 내보내기와 미리보기 | 예정 |
| 9 | 기기별 테스트 및 오류 수정 | 예정 |

## 파일 구조

```
storybook/
├─ index.html        화면 뼈대 (진행 표시, 장면 영역, 이전/다음 버튼, 알림, 확인창)
├─ css/style.css     디자인 토큰, 카드형 레이아웃, 반응형
├─ js/story.js       ★ 동화 문장 · 음식 · 맛 · 이미지 경로 설정 (내용 수정은 여기서)
├─ js/storage.js     진행 기록 저장 (localStorage)
├─ js/main.js        장면 그리기, 이동, 입력 처리
└─ assets/           삽화 파일을 넣는 곳
```

## 삽화 넣기

`js/story.js`에 적힌 경로대로 파일을 넣으면 코드 수정 없이 바로 바뀝니다.
파일이 없으면 임시 그림이 나오고, 왼쪽 위에 "삽화 자리 · 경로"가 표시됩니다.
모든 삽화를 넣은 뒤에는 `story.js` 맨 아래 `showAssetNotes`를 `false`로 바꾸세요.

| 장면 | 파일 경로 |
| --- | --- |
| #1 도입 | `assets/backgrounds/01-intro-night.png` |
| #2 식탁 | `assets/backgrounds/02-dream-table.png` |
| #3 이름표 | `assets/backgrounds/03-nameplate.png` (이름표는 그림 위에 자동으로 겹쳐 표시) |
| #5 요정의 등장 | `assets/fairies/05-fairies-arrive.png` |
| #6 착한 일 | `assets/fairies/06-fairy-praise.png` |
| #7 음식 받기 | `assets/fairies/07-fairies-serve.png` |
| #8 별빛스프 | `assets/backgrounds/08-starlight-soup.png` (별빛 효과가 위에 겹쳐짐) |
| #10 엔딩 | `assets/backgrounds/10-wake-up.png` |

| 음식 (#4) | 파일 경로 |
| --- | --- |
| 폭신폭신 솜사탕 | `assets/foods/cotton-candy.png` |
| 말랑말랑 푸딩 | `assets/foods/pudding.png` |
| 바삭바삭 치킨 | `assets/foods/chicken.png` |
| 따끈따끈 빵 | `assets/foods/bread.png` |
| 포슬포슬 오므라이스 | `assets/foods/omurice.png` |
| 동글동글 주먹밥 | `assets/foods/rice-ball.png` |

| 맛 (#9) | 파일 경로 |
| --- | --- |
| 은하수가 퍼지는 듯한 달콤한 맛 | `assets/icons/taste-galaxy.png` |
| 별빛이 입 안에서 터지는 듯한 짜릿한 맛 | `assets/icons/taste-spark.png` |
| 구름을 입에 머금은 듯한 포근한 맛 | `assets/icons/taste-cloud.png` |

- 확장자가 다르면(`.jpg`, `.webp`) `story.js`의 경로만 고치면 됩니다.
- 이미지는 카드에 꽉 차게(`cover`) 들어가며 비율은 찌그러지지 않습니다. 잘리지 않게 전체를 보이고 싶은 장면은 `art({ fit: 'contain' })`을 쓰도록 바꿀 수 있습니다.
- 권장 비율: 장면 삽화 4:3 또는 3:4, 음식·맛 카드 1:1.

## 이야기 속 개인화

- 이름을 입력하면 이후 장면의 "당신"이 이름으로 바뀌고, 조사(이/가, 은/는, 을/를)도 받침에 맞춰 자동으로 붙습니다.
- 고른 음식은 #5 문장("그렇게 푸딩을 먹다 보니…")에 들어갑니다.
- 착한 일을 비워 두면 #7은 별도의 기본 문장을 사용합니다.
- 맛은 엔딩 문장에 들어가고, 엔딩의 기록 카드에서 "고치기"를 누르면 해당 장면으로 갔다가 바로 엔딩으로 돌아옵니다.
- 사용자 입력은 항상 `textContent`로만 화면에 넣으므로 HTML로 해석되지 않습니다.

## 조작

- 이전/다음 버튼, 키보드 ← → 키(입력 중이 아닐 때), 상단 진행 표시의 칸(이미 읽은 장면만)
- 음식과 맛은 고르지 않으면 다음으로 넘어가지 않고 안내 문구가 나옵니다. 이름과 착한 일은 비워도 됩니다.
- 진행 기록은 이 기기의 브라우저에만 저장되며, 다시 열면 "이어서 읽기"를 물어봅니다.

## 외부 라이브러리

현재 없음. 글꼴만 Google Fonts에서 불러옵니다 (Jua, Gowun Dodum — 둘 다 SIL Open Font License).

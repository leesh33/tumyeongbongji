# 투명봉지

과자·음료·라면·키즈 간식의 영양성분표를 **눈에 보이는 단위**로 바꿔 보여주는 웹앱입니다.

- 나트륨 mg → 라면 국물 국자 (1국자 = 220mg)
- 당류 g → 각설탕 개수 (1개 = 3g)
- 지방 g → 밥숟가락 (1스푼 = 10g)

그리고 그 값들을 **투명 봉지 단면**에 무거운 층부터 아래에서 위로 쌓아 보여줍니다.
카드 한 장은 PNG로 저장하거나 공유할 수 있습니다.

- 라이브: https://tumyeongbongji.vercel.app
- 소스: https://github.com/leesh33/tumyeongbongji (public)

## 구성

```
index.html            앱 셸
styles.css            390px 기준 모바일 레이아웃
app.js                화면·라우팅·PNG 내보내기
config.js             앱 이름, 고지 문구, 환산 기준값 (이름 바꿀 때 여기만)
data/products.js      제품 34종 (과자 11 · 음료 9 · 라면·간편식 7 · 아기·키즈 7)
lib/units.js          단위 환산 (mg→국자, g→각설탕, g→스푼)
lib/stack.js          층 무게·비율 계산, 카테고리별 기본 원재료, 대체 간식
lib/model.js          제품 → 카드 모델
lib/card-svg.js       카드 SVG 생성 (봉지·층·라벨·아이콘)
lib/text.js           글자 폭 어림·줄바꿈 (SVG에는 자동 줄바꿈이 없음)
test/*.test.js        node --test 단위 테스트 37개
data/nutrition-sources.md  과자 영양값 대조표·출처 (2026-11)
tools/                로컬 확인용 스크립트·스크린샷 (배포 제외)
```

## 실행

```bash
python3 -m http.server 4173     # 아무 정적 서버나 가능 (ES 모듈이라 file://은 안 됨)
open http://localhost:4173
```

## 테스트

```bash
node --test
```

- 환산 값이 맞는지 (100mg → 0.5국자, 37g → 12.3개, 4.6g → 0.5스푼 …)
- 층 무게 합 = 제품 무게, 당류·지방 층은 영양성분표 값 그대로, 최소 높이 보정 후에도 합 1
- 34종 데이터 무결성 (id 중복·범위·과자 11종 실제 표기값·열량과 탄수/단백/지방 계산 일치)
- 카드 SVG에 NaN/undefined가 없고, 고지 문구·원재료·층 라벨이 들어가는지

## 제품 추가하기

`data/products.js`에 객체 하나를 더 넣으면 목록·검색·카드·대체 간식에 자동으로 들어갑니다.

```js
{
  id: 'saewoo-kang',
  name: '새우깡', brand: '농심', category: 'snack', unit: 'g',
  weight: 90, kcal: 465, sodium: 610, sugar: 5, fat: 25, carbs: 54, protein: 6,
  ingredients: ['밀가루', '전분', '새우살 6.6%', '설탕', '정제소금'],
  // 당류·지방을 뺀 나머지 무게를 나눌 원재료 비중(상대값, 자동 정규화)
  bulk: [
    { kind: 'flour', label: '밀가루·전분', sub: '소맥분·전분', share: 3.6 },
    { kind: 'seasoning', label: '새우조미분말', sub: '새우살 6.6%·정제소금', share: 0.8 },
  ],
}
```

`category`는 `snack` · `drink` · `noodle` · `kids`이고, `bulk`를 생략하면 카테고리 기본 원재료를 씁니다.
`kind`는 층 색·질감을 정합니다 (`flour`, `grain`, `noodle`, `sugar`, `fat`, `cocoa`, `seasoning`,
`salt`, `dairy`, `liquid`, `water`, `fruit`, `soup`, `dried`).

## 앱 이름 바꾸기

`config.js`의 `APP.name` 한 곳만 고치면 카드 워드마크·헤더·공유 이미지에 모두 반영됩니다.
`index.html`의 `<title>`, `manifest.webmanifest`, `package.json` 이름도 함께 바꾸면 좋습니다.

## 배포

정적 사이트입니다. `vercel --prod`로 올리면 끝이고, `vercel.json`에 cleanUrls와 보안 헤더가 들어 있습니다.
`downloads/`, `tools/`, `test/`, `*.md`는 `.vercelignore`로 제외됩니다.

## 데이터·표현 주의

- 영양값은 각 제품의 실제 영양성분 표기값(총 내용량 기준)입니다. 과자 11종은 2026-11 제조사 공식 제품정보·식약처 DB로 대조했고 출처는 `data/nutrition-sources.md`에 있습니다. 제조사 개정에 따라 실제와 다를 수 있습니다.
- 카드에 고정 고지를 넣습니다: "본 이미지는 영양성분표를 바탕으로 환산해 구현한 참고용 이미지로,
  특정 제품의 광고나 비하 의도는 없습니다."
- 성분표 사진은 기기 안에서만 미리보기로 쓰고 어디에도 보내지 않습니다 (자동 숫자 인식은 다음 버전).

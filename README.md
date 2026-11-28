# 속보이네

과자·음료·라면·키즈 간식의 영양성분표를 **눈에 보이는 단위**로 바꿔 보여주는 웹앱입니다.

- 나트륨 mg → 라면 국물 국자 (1국자 = 220mg)
- 당류 g → 각설탕 개수 (1개 = 3g)
- 지방 g → 밥숟가락 (1스푼 = 10g)

그리고 그 값들을 **투명 봉지 단면**에 무거운 층부터 아래에서 위로 쌓아 보여줍니다.
카드 한 장은 PNG로 저장하거나 공유할 수 있습니다.

- 라이브: https://sokboyne.vercel.app
- 소스: https://github.com/leesh33/tumyeongbongji (public)

## 구성

```
index.html            앱 셸
styles.css            390px 기준 모바일 레이아웃
app.js                화면·라우팅·PNG 내보내기·게시판·댓글 UI
config.js             앱 이름, 고지 문구, 환산 기준값, Supabase 공개 키 (이름 바꿀 때 여기만)
data/products.js      제품 34종 (과자 11 · 음료 9 · 라면·간편식 7 · 아기·키즈 7)
lib/units.js          단위 환산 (mg→국자, g→각설탕, g→스푼)
lib/nutrition-ocr.js  성분표 OCR 텍스트 파서 (지금은 화면에 연결하지 않은 예비 파서)
lib/analyze-food-core.js  사진 인식 요청 검증·프롬프트·Gemini 응답 파싱·IP 요청 제한 (순수)
api/analyze-food.js   POST /api/analyze-food — Gemini Vision(gemini-3.5-flash) 서버리스 함수
lib/stack.js          층 무게·비율 계산, 카테고리별 기본 원재료, 대체 간식
lib/model.js          제품 → 카드 모델
lib/brand-badge.js    제조사 미니 심볼(SVG) + 이름 딱지 (상표권 안전 자체 도형)
lib/card-svg.js       카드 SVG 생성 (봉지·층·라벨·아이콘)
lib/text.js           글자 폭 어림·줄바꿈 (SVG에는 자동 줄바꿈이 없음)
lib/board.js          게시판·댓글 순수 로직 (글자 수 검증, 상대 시간, 정렬)
lib/auth.js           Supabase GoTrue 소셜 로그인(OAuth+PKCE)·세션·프로필 (fetch만 사용)
lib/supabase.js       Supabase REST 클라이언트 (fetch만 사용, 오류→한국어 안내)
test/*.test.js        node --test 단위 테스트 (현재 207개)
data/nutrition-sources.md  34종 영양값 대조표·출처 (2026-11)
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
- 34종 데이터 무결성 (id 중복·범위·34종 실제 표기값·열량과 탄수/단백/지방 계산 일치)
- 카드 SVG에 NaN/undefined가 없고, 고지 문구·원재료·층 라벨이 들어가는지
- 성분표 OCR 텍스트 파싱: 붙여쓰기·공백·소수점/천단위 쉼표·`%` 일일영양성분기준치·트랜스/포화지방 제외·`g`가 `8·0·9`로 읽힌 경우·영어 라벨
- 게시판·댓글 로직: 글자 수 경계(2/80, 2/600, 1/300, 닉네임 20), 빈 닉네임→`익명`, 줄바꿈 정리, 상대 시간(방금/분/시간/어제/일/날짜), 분류 필터·정렬
- Supabase 클라이언트: 쿼리·헤더·오류 상태(401/400/500)→한국어 안내, 네트워크·시간 초과 처리 (fetch 모킹)

## 폰트

화면 글꼴은 **고운돋움(Gowun Dodum)** 입니다(`index.html`의 Google Fonts + `styles.css`의 `body` font-family).
카드 SVG도 `Gowun Dodum`을 먼저 쓰고, PNG로 내보낼 때는 카드에 나온 글자만 담은 Google Fonts 서브셋을 받아
SVG 안에 `@font-face`(base64)로 심습니다(`lib/font-embed.js`). SVG를 `<img>`로 그리면 문서 폰트를 쓰지 못해
기본 글꼴로 떨어지기 때문입니다.

## 제안·제보 게시판 · 제품별 댓글

홈 오른쪽 위 **제안·제보** 버튼으로 `#/board`에 들어갑니다.

- 분류 필터: 전체 · 제품 추가 요청 · 성분 수정 제보 · 기능 제안 (`#/board/fix_info`처럼 주소로 바로 열 수 있음)
- 최신순 목록, 상태 배지(접수됨/반영됨), 닉네임·상대 시간
- 글쓰기: 제목 2~80자, 내용 2~600자, 닉네임 1~20자(비우면 `익명`). 글자 수 카운터·중복 제출 방지·실패 시 한국어 안내
- 글은 이 기기에 초안으로 남아 화면을 오가도 사라지지 않고, 한 번 쓴 닉네임은 다음에도 채워집니다
- 제품 상세(`#/p/:id`) 아래 **아이템별 댓글**: 오래된 순 목록, 댓글 1~300자, 등록 즉시 반영, 빈 상태 안내
- 사용자가 쓴 글은 모두 `textContent`로 그려 XSS가 실행되지 않습니다

저장소는 Supabase REST(`/rest/v1`)입니다. 테이블은 `public.tumyeongbongji_feedback`, `public.tumyeongbongji_comments`,
`public.tumyeongbongji_profiles`(로그인 닉네임)이고, RLS로
- 게시판: `anon`에 **SELECT·INSERT** (익명 허용)
- 댓글: SELECT는 누구나, **INSERT·DELETE는 로그인한 본인만**(`auth.uid() = user_id`), UPDATE는 차단

합니다. 접속 값은 `config.js`의 `SUPABASE`에 있으며 공개(publishable) 키라서 브라우저에 실려 나가도 되는 값입니다.
비밀 키(service_role)는 어디에도 넣지 않습니다.

## 로그인(카카오·구글·애플) · 기명 댓글

영양정보 조회·저장·비교는 로그인 없이 그대로 쓸 수 있고, **댓글만 기명**으로 남깁니다.

- 홈·상세 오른쪽 위 `로그인` → 카카오(`#FEE500`)·구글·애플 버튼 시트
- Supabase GoTrue OAuth를 SDK 없이 **PKCE(flow_type=pkce, S256)** 로 직접 구현 (`lib/auth.js`)
  - `code_verifier` → `localStorage` → `/auth/v1/authorize` → 콜백 `?code=`를 `/auth/v1/token?grant_type=pkce`로 교환
  - 로그인 전 화면 해시를 기억해 두고 돌아오면 그 화면으로 복귀, `?code=`는 주소창에서 제거
  - 만료 60초 전 자동 refresh, 로그아웃은 `/auth/v1/logout`
- 처음 로그인하면 `tumyeongbongji_profiles`에 닉네임 한 줄을 만들고(카카오·구글·애플 프로필 이름), 상단 닉네임 칩에서 **닉네임 변경·로그아웃**
- 댓글은 `Authorization: Bearer <user_access_token>`으로 저장하고, 내 댓글에만 `[삭제]`가 붙습니다(최종 판단은 RLS)
- 적용한 SQL: `tools/migrations/2026-11-27-auth-comments.sql`

## 사진 자동 인식 (Gemini Vision · `/api/analyze-food`)

`#/custom`에서 사진을 고르면 **바로** 읽습니다. 사진은 브라우저에서 최대 1280px JPEG(품질 0.82, 보통 0.1~0.6MB)로
줄여 `POST /api/analyze-food`로 보내고, Vercel 서버리스 함수가 Gemini Vision(`gemini-3.5-flash`)에 넘깁니다.
버튼(`다시 인식하기`)으로 언제든 다시 시도할 수 있습니다.

- **뒷면 성분표 사진**: 인쇄된 총 내용량·열량·나트륨·당류·지방·탄수화물·단백질·원재료를 그대로 읽어 채웁니다.
- **앞면 제품 사진**(예: "파파 ZOOS 배도라지" 100ml 45kcal): 제품명·브랜드·용량을 읽고 모델이 아는
  공식 영양성분으로 채웁니다. 사진만으로 읽은 값이 아니므로 **추정 안내 배너**를 띄우고 `note`에 출처를 적습니다.
  포장지 숫자와 다른 부분은 입력칸에서 바로 고칠 수 있습니다.
  Google Search grounding은 Gemini **무료 등급에서 제공되지 않아**(429) 기본은 꺼 두었습니다. 유료 등급이면
  Vercel 환경변수 `GEMINI_SEARCH_GROUNDING=1`로 켤 수 있고, 켠 상태에서 거절당하면 자동으로 도구를 빼고 다시 부릅니다.
- 값은 입력칸에만 채우고, 사용자가 직접 적어 둔 칸은 건드리지 않습니다.
- 서버: 키는 환경변수 `GEMINI_API_KEY`, 모델은 `GEMINI_MODEL`(기본 `gemini-3.5-flash`). 없으면 503 `{error:"missing_api_key", message}`로 친절히 안내하고,
  IP별 분당 8회·하루 60회(메모리 Map, best-effort)로 제한합니다. 사진 원본 3MB 초과는 413
  (Vercel 요청 본문 4.5MB 한도 때문에 base64 기준이 아니라 원본 기준으로 잡았습니다).
- 키가 없거나 AI가 실패해도 **수동 입력과 카드 생성은 그대로** 동작합니다.
- 확인 스크립트: `tools/verify_vision.py [base_url] [tag]` (목 응답/실제 호출 둘 다).

## 아이템 번호 · 어드민(#/admin) · 대체상품 링크

- 제품은 이제 DB(`tumyeongbongji_products`)가 원본이고, `data/products.js` 34종은 DB를 못 읽을 때의 fallback입니다.
- 각 아이템에는 **아이템 번호(`item_no`, `#001`)** 가 붙습니다. 홈 목록·상세 상단에 보이고, 검색창에 `#004`·`4`처럼 번호로 찾을 수 있습니다.
- 관리자(`andy.leesh33@gmail.com`)로 로그인하면 헤더 기어 버튼과 프로필 시트에 **어드민 관리**가 나타납니다. `#/admin`은 3개 탭입니다.
  1. **아이템·성분**: 번호·이름·제조사 검색, 새 아이템 추가, 수정(아이템 번호·제품명·제조사·카테고리·단위·중량·열량·나트륨·당류·지방·탄수화물·단백질·원재료·한줄 설명·노출 여부·삭제)
  2. **댓글**: 전체 댓글 최신순, 삭제
  3. **제안·제보**: 상태 변경(대기/완료), 삭제
- **대체상품 링크**: 아이템마다 `alt_links`(상품명·플랫폼 `쿠팡`/`네이버 쇼핑`/`기타`·URL·메모)를 넣을 수 있고, 상세 화면 `저당·대체 간식 보기` 아래에 `target="_blank" rel="noopener noreferrer"` 링크 카드로 보입니다. `http(s)` 주소만 저장되고 `javascript:` 같은 주소는 폼에서 거부합니다.
- 권한은 DB가 최종 판단합니다: `tb_is_admin()`(관리자 명단 `tumyeongbongji_admins`)만 상품 쓰기·댓글 삭제·제보 수정/삭제를 할 수 있고, 숨김(`is_active=false`) 아이템은 관리자에게만 보입니다.
- 마이그레이션: `tools/migrations/2026-11-27-admin-products.sql` (34종 시드 포함, 여러 번 실행해도 안전).

## 제품 추가하기

간단히는 어드민 `#/admin` → **+ 새 아이템**으로 추가합니다(저장 즉시 앱 목록 갱신, 아이템 번호 자동 채번).
시드나 fallback 목록을 늘리려면 `data/products.js`에 객체 하나를 더 넣으면 됩니다.

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

정적 사이트 + `/api/*` 서버리스 함수입니다. `main`에 머지하면 Vercel이 자동 배포하고, `vercel.json`에
cleanUrls·보안 헤더·`api/analyze-food.js`의 `maxDuration: 30`이 들어 있습니다.
`downloads/`, `tools/`, `test/`, `*.md`는 `.vercelignore`로 제외되고, `api/`가 ESM(`"type":"module"`)으로 해석되도록
`package.json`은 배포에 포함합니다. 환경변수 `GEMINI_API_KEY`는 Vercel 프로젝트에 등록되어 있습니다.

## 데이터·표현 주의

- 영양값은 각 제품의 실제 영양성분 표기값(총 내용량 기준)입니다. 34종 모두 2026-11 제조사 공식 제품정보·식약처 DB·공식 판매페이지 표기로 대조했고 출처는 `data/nutrition-sources.md`에 있습니다. 제조사 개정에 따라 실제와 다를 수 있습니다.
- 카드에 고정 고지를 넣습니다: "본 이미지는 영양성분표를 바탕으로 환산해 구현한 참고용 이미지로,
  특정 제품의 광고나 비하 의도는 없습니다."
- 사진을 고르면 그 사진은 성분을 읽기 위해 **Google Gemini API로 전송**됩니다(최대 1280px JPEG로 줄여서). 서버는 사진을 저장하지 않고 응답을 돌려준 뒤 버립니다. 화면 안내 문구에도 이 사실을 적어 두었습니다.
- 자동 인식 값은 참고값입니다. 인식된 칸은 그대로 수정할 수 있고, 키 미설정·AI 오류·네트워크 실패에도 수동 입력과 카드 생성은 그대로 동작합니다.

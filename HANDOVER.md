# 인수인계 — 속보이네 (2026-11-27)

과자·음료·라면·키즈 간식의 영양성분표를 **국자·각설탕·밥숟가락** 단위와 **투명 봉지 단면**으로 보여주는 정적 웹앱.

- 라이브(프로덕션): https://sokboyne.vercel.app
- 저장소: https://github.com/leesh33/tumyeongbongji (public, `main`)
- Vercel 프로젝트: `tumyeongbongji` (`prj_6JRWVoy7RbyaacGYE4QuUo54vx2Y`, 개인 계정 leesh33)
- 현재 상태: 2026-11-27 Vercel 프로젝트에 GitHub(`leesh33/tumyeongbongji`) 자동 배포를 연결했습니다. 이후 `main`에 머지되는 커밋은 Vercel이 자동 배포합니다. 첫 자동 배포에는 PR #1(23종 성분표 수정)과 PR #2(성분표 OCR)가 함께 들어갑니다.
- 2026-11-27 이름·도메인·폰트 변경: 앱 이름 **속보이네**(구 투명봉지), 라이브 주소 **https://sokboyne.vercel.app** — Vercel 프로젝트 `tumyeongbongji`의 Production 도메인으로 추가했고 기존 `tumyeongbongji.vercel.app`도 같은 배포를 계속 서빙합니다. 화면·카드 폰트는 **고운돋움(Gowun Dodum)**. Supabase(꼬리핀과 공유하는 ref `nhdzexqkibotubfovbpa`) Authentication > URL Configuration > Redirect URLs에 `https://sokboyne.vercel.app/**`를 추가했습니다(기존 6개 항목과 Site URL `https://ggoripin.vercel.app`은 그대로). 저장소명과 Supabase 테이블명 `tumyeongbongji_*`는 유지합니다.

## 기술 구성

- 빌드 없는 정적 사이트(HTML/CSS/ES 모듈). `index.html` + `app.js` + `lib/*` + `data/products.js`.
- 단위 기준은 `config.js`: 나트륨 220mg = 라면 국물 1국자, 당류 3g = 각설탕 1개, 지방 10g = 밥숟가락 1스푼.- 카드 SVG는 `lib/card-svg.js`, 층 계산은 `lib/stack.js`. 당류·지방은 영양성분표 값을 그대로 층 무게로 쓰고, 나머지 무게를 `bulk` 비중으로 나눕니다. 무거운 층이 아래.
- PNG 내보내기: 카드 SVG → 1080×2076 PNG (`#save`), iOS는 Web Share.
- 직접 입력: `#/custom` + 성분표 사진 촬영/업로드. 사진은 기기 안에서만 처리하고, `성분표 숫자 자동으로 읽기`를 누를 때만 Tesseract.js(`kor+eng`, `4.0.0_fast`)를 CDN에서 lazy-load해 브라우저에서 OCR합니다. 오프스크린 canvas 그레이스케일·대비 강화 전처리, 순수 파서 `lib/nutrition-ocr.js`, 인식값은 입력칸에서 수정 가능.

## 데이터

- `data/products.js` 제품 34종 = 과자 11 · 음료 9 · 라면·간편식 7 · 아기·키즈 7.
- 34종 전부(과자 11 · 음료 9 · 라면·간편식 7 · 아기·키즈 7) 2026-11 **실제 영양성분 표기값(총 내용량 기준)** 으로 대조 완료. 근거 표는 `data/nutrition-sources.md`.
- `weight`는 봉지 전체 중량, 영양값도 전체 기준입니다. 1회 제공량 기준 제품(예: 쵸코하임)은 총 내용량 기준으로 환산해 넣었습니다.

## 검증

- `npm test`(= `node --test`) 58/58 통과. 실제 표기값 34종 회귀 테스트 + 열량-탄단지 정합성 테스트 + 성분표 OCR 파서 테스트 20개 포함.
- 라이브 390×844(iPhone UA) Playwright 점검: 6종 상세 카드 값·환산 문구 일치, 콘솔/페이지 오류 0. 캡처: `downloads/snack-xray/label-check/*.png`, 대표 카드 `downloads/snack-xray/02-detail-card.png`.
- 성분표 OCR 라이브 검증(390×844): 테스트 라벨 `tools/label-kr.png` 업로드 → 자동 인식 → 7개 값 자동 입력 → 카드 생성, 콘솔 오류 0. 캡처는 `verification/tumyeongbongji/`.
- 캡처 스크립트: `tools/final_shots.py`(라이브 전체), `tools/verify.py`(기능 점검), `tools/shots.py`(로컬).
  Chromium 실행에 `LD_LIBRARY_PATH=/workspace/.local/chromelibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu:/workspace/.local/sysroot/usr/lib/x86_64-linux-gnu`가 필요했습니다.

## 다음 단계 후보

1. ~~성분표 사진 OCR로 숫자 자동 채우기~~ (2026-11-27 PR #2로 구현).
2. 저당·대체 간식 자리에 제휴 링크 연결.
3. 제품 추가(저당·대체 간식 등) 및 리뉴얼 시 영양값 재대조.
4. 공유 URL(카드 링크) · PWA 설치 유도.
5. Vercel–GitHub 자동 배포 연결.

## 배포 시 주의

- Vercel 액세스 토큰은 **프로젝트 한정 + 1시간 만료**로 발급해 쓰고, 배포 직후 삭제했습니다(삭제 후 같은 토큰 API 호출 403 `invalidToken: true` 확인). 토큰 값은 어디에도 저장하지 않았습니다.
- `vercel.json`에 cleanUrls·보안 헤더, `.vercelignore`로 `downloads/ tools/ test/ *.md` 배포 제외.

## 2026-11-27 추가 — 제안·제보 게시판 · 제품별 댓글 · 전수 UX 점검

- **게시판(`#/board`)**: 홈 우측 상단 `제안·제보` 버튼. 분류 필터(전체·제품 추가 요청·성분 수정 제보·기능 제안, `#/board/<분류>` 딥링크), 최신순 목록, 상태 배지(접수됨/반영됨), 글쓰기 폼(제목 2~80·내용 2~600·닉네임 1~20 또는 익명), 글자 수 카운터, 중복 제출 방지(30초), 실패 시 한국어 안내, 빈 상태·오류 상태 + 다시 불러오기.
- **제품별 댓글**: 제품 상세(`#/p/:id`) 하단. 오래된 순, 댓글 1~300자, 등록 즉시 반영, 빈 상태("첫 번째 한마디를 남겨 보세요"), 오류 시 재시도. 직접 입력 카드(`#/c`)에는 붙지 않음.
- **저장소**: Supabase `public.tumyeongbongji_feedback` / `public.tumyeongbongji_comments`. `anon`에 **SELECT·INSERT만** GRANT(2026-11-27 추가), UPDATE·DELETE는 42501로 차단 확인. 접속 값은 `config.js`의 `SUPABASE`.
  - 주의: 이 프로젝트(ref `nhdzexqkibotubfovbpa`)는 대시보드상 이름이 **꼬리핀**입니다. 꼬리핀과 같은 Supabase 프로젝트 안에 속보이네용 테이블 두 개가 따로 들어 있습니다.
  - 공개 키는 새 방식 `sb_publishable_…`입니다. 예전에 브리프에 적혀 있던 `anon` JWT는 ref가 `…ovbpia`로 잘못 적혀 있어 서버가 `Invalid API key`로 거절했습니다.
- **UX 전수 점검에서 고친 것**
  - 카드 SVG 긴 층 이름이 카드 오른쪽으로 잘리던 문제(이름/값 두 줄 배치 + 라벨 간격 자동 확대)
  - 카드의 `*47g 기준` 앞 별표 제거
  - 홈 검색이 글자마다 화면을 다시 그려 한글 조합이 끊기던 문제 → 목록 부분만 갱신, 검색어 지우기 버튼 추가
  - 상세·게시판·직접 입력에서 뒤로가기가 앱 밖으로 나가던 문제(곧바로 링크로 들어온 경우 홈으로)
  - 종류(select) 칸에 드롭다운 화살표가 없던 문제
  - 대체 간식 비교에서 숫자만 보이던 값 → `당 xg / 나 ymg`로 명확히
  - 게시판 분류 칩이 390px에서 잘리던 문제(짧은 라벨)
  - 게시판 목록을 이미 받아 둔 상태에서 새로 고침이 실패하면 아무 안내가 없던 문제 → 상단 배너 + 다시 불러오기
  - 빈 게시판에서 같은 버튼이 두 번 보이던 문제
  - 제보 링크·터치 영역 확대, 화면 전환 시 제목으로 초점 이동(화면낭독기)
- **테스트**: `node --test` **79/79 통과**(board 15개, supabase 10개 추가).
- **점검 스크립트**: `tools/audit_ux.py` — 390×844(+데스크톱)에서 홈·검색·상세·댓글·게시판·직접 입력·PNG 저장을 실제로 눌러 보고, Supabase는 메모리 목으로 가로챕니다. XSS 주입·오류 상태·빈 상태·가로 넘침·터치 영역까지 확인합니다.

## 2026-11-27 추가 — 카카오·구글·애플 로그인 · 기명 댓글

- **로그인**: 외부 SDK 없이 `lib/auth.js`가 Supabase GoTrue OAuth(**PKCE, flow_type=pkce**)를 직접 다룹니다.
  - `code_verifier`(48바이트 난수, base64url) → `localStorage` → `S256 code_challenge` → `/auth/v1/authorize?provider={kakao|google|apple}`
  - 돌아올 화면 해시(`#/p/choco-heim` 등)도 저장해 두고, 콜백 `?code=`를 `POST /auth/v1/token?grant_type=pkce`(`auth_code`+`code_verifier`)로 교환한 뒤 원래 화면으로 복원하면서 주소창의 `?code=`를 지웁니다.
  - 만료 60초 전부터 `refresh_token` 자동 갱신, 로그아웃은 `/auth/v1/logout` 후 기기 세션 삭제.
- **프로필**: `public.tumyeongbongji_profiles`(user_id PK, nickname 1~20자, provider). OAuth `user_metadata`(nickname·name·full_name·preferred_username·이메일 앞부분)에서 첫 닉네임을 만들고, 처음 로그인하면 upsert(merge-duplicates)로 한 줄 만듭니다. 상단 닉네임 칩 → 닉네임 변경·로그아웃 시트.
- **기명 댓글**: 목록은 누구나 읽고, 작성·삭제는 로그인한 본인만.
  - `tumyeongbongji_comments.user_id` 추가, `anon`의 INSERT/UPDATE/DELETE 회수, `authenticated`에 INSERT·DELETE만 GRANT.
  - 정책: INSERT `with check (auth.uid() = user_id)`, DELETE `using (auth.uid() = user_id)`, UPDATE 정책 없음(차단 유지).
  - 앱은 `Authorization: Bearer <user_access_token>`으로 보내고, 내 댓글에만 `[삭제]` 버튼이 붙습니다(RLS가 최종 판단).
  - 비로그인 화면은 입력 폼 대신 "기명으로 댓글을 남기려면 로그인이 필요해요." + 카카오·구글·애플 로그인 버튼.
- **게시판(제안·제보)** 은 그대로 익명 작성 가능하며, 로그인했으면 닉네임 칸이 내 닉네임으로 미리 채워집니다.
- **적용한 SQL**: `tools/migrations/2026-11-27-auth-comments.sql` (Supabase 프로젝트 `nhdzexqkibotubfovbpa`, 꼬리핀과 공유 — `tumyeongbongji_*`만 변경).
- **테스트**: `node --test` **127/127 통과**(`test/auth.test.js` 27개 추가: PKCE·콜백·세션 갱신·닉네임·프로필 upsert, `test/supabase.test.js`에 기명 등록·삭제·비로그인 차단 5개 추가).
- **검증 스크립트**: `tools/verify_auth.py [base_url] [tag]` — 390×844·데스크톱에서 로그인 시트(3종 버튼·색), 실제 authorize URL(PKCE), 비로그인 댓글 가드, 로그인 상태(세션 주입+응답 목)에서 기명 등록 헤더·user_id·삭제, 프로필 시트, 가로 넘침·콘솔 오류를 확인합니다. 스크린샷은 `verification/tumyeongbongji/auth-*.png`.
- **남은 확인**: 실제 카카오·구글·애플 계정으로 로그인해 댓글을 남기는 실측은 사용자 계정이 필요해 직접 확인해야 합니다(Supabase 쪽 프로바이더 3종은 302로 각 provider authorize 페이지까지 넘어가는 것 확인).

## 2026-11-27 추가 — 어드민(#/admin) · 아이템 번호 · 성분/대체상품 링크 · 댓글·제보 관리

- **DB(라이브 적용 완료, `nhdzexqkibotubfovbpa` 공유 프로젝트, `tumyeongbongji_*`만 변경)**
  - `tumyeongbongji_admins(email PK)` + 초기 행 `andy.leesh33@gmail.com`, RLS·anon 권한 회수.
  - `tb_is_admin()` — JWT email이 관리자 명단에 있으면 true (`security definer`, `stable`).
  - `tumyeongbongji_products` 신규: `item_no` identity(1~34)·`id`(슬러그)·이름·제조사·카테고리·단위·중량·열량·나트륨·당류·지방·탄수화물·단백질·`ingredients`·`bulk`·`note`·**`alt_links`**·`is_active`·created_at·updated_at.
    - SELECT는 `anon,authenticated`(`is_active or tb_is_admin()`), INSERT/UPDATE/DELETE는 `tb_is_admin()`만.
    - 34종 시드(파일 순서 = item_no 1~34), 시퀀스를 34로 setval.
  - 댓글 `tb_comments_delete_admin`, 제보 `tb_feedback_update_admin`·`tb_feedback_delete_admin` 정책 추가 + authenticated UPDATE/DELETE grant.
  - 마이그레이션 파일 `tools/migrations/2026-11-27-admin-products.sql` (반복 실행 안전).
- **앱**
  - `lib/catalog.js` — DB 목록을 쓰고 실패하면 `data/products.js` 34종 fallback. 앱 시작 시 `fetchProducts()`로 로드.
  - `lib/admin.js` — 아이템 번호 표기(`#004`), `http(s)`만 허용하는 링크 검증(`javascript:`·`data:`·제어문자 거부), 입력 검증, DB 행↔상품 변환, 슬러그·다음 번호.
  - `lib/supabase.js` — `fetchProducts/createProduct/updateProduct/deleteProduct/checkIsAdmin/fetchAllCommentsForAdmin/deleteCommentByAdmin/fetchAllFeedbackForAdmin/updateFeedbackStatus/deleteFeedbackByAdmin`.
  - 홈·검색: 목록에 `#001` 번호 칩, 검색창에서 번호로도 찾기. 상세: 상단에 아이템 번호, `저당·대체 간식` 아래에 대체상품 링크 카드 + "제휴 링크가 포함될 수 있어요" 안내(링크가 없으면 기존 준비 중 문구).
  - `#/admin`: 3탭(아이템·성분 / 댓글 / 제안·제보). 아이템 폼에서 번호·성분·원재료·노출 여부·대체상품 링크(행 추가/삭제, 플랫폼 선택, URL, 메모)를 고치고 저장하면 DB 반영 + 앱 목록 즉시 갱신. 관리자가 아니면 관리자 이메일 안내 + 로그인/홈 버튼.
  - 헤더 기어 버튼·프로필 시트의 `어드민 관리`는 `tb_is_admin()`이 true일 때만 보인다.
- **폰트**: 페이퍼로지(Paperlogy) 적용 — `fonts/`에 둔 woff2 5굵기(400·500·600·700·800)를 `styles.css`의 `@font-face`로 서빙하고 `body`는 `'Paperlogy'` 먼저(구글 폰트 링크 없음, `index.html`은 400 preload). 카드 SVG도 Paperlogy, PNG 내보내기는 카드가 쓴 굵기의 woff2를 그대로 base64 `@font-face`로 심는다(`lib/font-embed.js`) — SVG를 `<img>`로 그리면 문서 폰트가 전달되지 않기 때문. 글리프 확인은 `tools/check_glyphs.py`(한글 11,172자 전부 + `·`·`%`·`kcal`·`mg`·`g`).
- **테스트**: `node --test` **210/210 통과**(admin 20, catalog 5, font-embed 10, supabase 13 포함).
- **검증**: `tools/verify_font.py [base_url] [tag]` — 390×844로 화면 글꼴·굵기별 로드·구글 폰트 요청 0·글리프 샘플·카드 SVG 글꼴·PNG 내보내기(저장소 폰트 요청 + 폰트 심은/안 심은 렌더 픽셀 비교). 전체 검증은 `tools/verify_admin.py [base_url] [tag]` — 실제 DB 34종 로드·번호 미노출·이름 검색, 비관리자 차단, 관리자(세션 주입+응답 목) 3탭·폼 검증(잘못된 URL 거부·정상 URL 저장)·댓글 삭제·제보 상태 변경·삭제, 상세 링크 카드, Paperlogy 적용·저장소 폰트 요청, 가로 넘침·콘솔 오류 0. 스크린샷 `verification/tumyeongbongji/admin-*.png`.
- **남은 확인**: 실제 관리자 구글 계정으로 로그인해 라이브에서 저장·삭제를 눌러 보는 실측(현재는 응답 목으로 검증). 로컬 검증 55/55 통과.

## 2026-11-28 추가 — 사진 자동 인식을 Gemini Vision(`/api/analyze-food`)으로 교체

- **왜**: Tesseract.js 기기 내 OCR은 첫 실행에 엔진+언어 모델 약 7MB를 CDN에서 받아야 하고, 앞면 제품 사진(예: "파파 ZOOS 배도라지")에서는 숫자를 못 읽어 "사진에서 숫자를 찾지 못했어요"만 떴습니다. 앞면 사진도 처리하려고 서버리스 + Vision AI로 바꿨습니다.
- **백엔드** `api/analyze-food.js` (Vercel Node 함수, ESM 기본 export, `vercel.json`에서 `maxDuration: 30`)
  - `POST /api/analyze-food` ← `{ imageBase64, mimeType }` (data URL로 와도 됨). 응답 `{ ok:true, mode, estimated, name, brand, category, servingG, unit, kcal, sodiumMg, sugarG, fatG, carbsG, proteinG, ingredients[], note, sources[] }`.
  - 모델 `gemini-3.5-flash` (환경변수 `GEMINI_MODEL`로 교체 가능). 2026-11-28 실측: `gemini-2.5-flash`는 신규 키에 404 "no longer available to new users", `gemini-3.8-flash`·`3.7-flash`는 무료 등급에서 503(high demand)이 잦고 20~55초 응답 없이 매달렸습니다. `gemini-3.5-flash`는 같은 사진을 1~3초에 정확히 읽었습니다. 503이면 0.3초 뒤 한 번만 더 부릅니다.
  - `generationConfig.thinkingConfig.thinkingLevel = "low"` — 기본 medium은 사진 한 장에도 오래 걸립니다. Gemini 3는 `temperature`를 무시합니다. 도구를 쓰지 않을 때는 `responseMimeType: "application/json"`으로 JSON을 강제합니다.
  - **Google Search grounding은 Gemini 무료 등급에서 제공되지 않습니다**(유료 전용, 호출하면 429 `RESOURCE_EXHAUSTED`). 그래서 기본은 도구 없이 모델 지식으로 채우고, 유료 등급이면 `GEMINI_SEARCH_GROUNDING=1`로 켭니다. 켠 상태에서 429/도구 거절이 오면 그 인스턴스에서는 자동으로 도구를 빼고 다시 호출합니다.
  - 무료 등급 한도는 `gemini-3.8-flash` 기준 분당 5회·하루 20회 정도라, 앱에서 오래 쓰려면 결제 연결이 필요합니다(초과 시 앱은 "요청 한도" 안내 + 직접 입력 유도). **`responseMimeType: "application/json"`은 grounding과 함께 쓰면 Gemini가 거절**해서 쓰지 않고, 프롬프트로 JSON만 출력하게 한 뒤 코드에서 `{...}`를 추출합니다(코드펜스·앞뒤 설명·끝 쉼표 허용). JSON이 아니면 같은 사진으로 한 번만 더 요청합니다.
  - 환경변수 `GEMINI_API_KEY`(Vercel Production에 등록됨, Google AI Studio 무료 등급 `Sokboyne`). 없으면 503 `{error:"missing_api_key"}`.
  - 원본 3MB 초과 413(Vercel 요청 본문 4.5MB 한도 때문 — base64가 아니라 원본 기준), 잘못된 형식 400, IP당 분당 8회·하루 60회 429(메모리 Map, 인스턴스별 best-effort), Gemini 429는 429 `upstream_quota`, JSON 실패 502 `bad_model_output`, 25초 타임아웃 504.
  - CORS(`*`)·OPTIONS 204, 모든 응답 `Cache-Control: no-store`.
- **순수 로직** `lib/analyze-food-core.js`: 요청 검증(base64 패딩 계산·파일 앞머리로 형식 확인), 프롬프트, Gemini 응답 파싱, 별칭 키·단위·범위 정규화(카테고리는 앱 키 `snack/drink/noodle/kids`로 매핑 — 모델이 "ramen"이라고 답해도 `noodle`), "100ml" 같은 용량 표기에서 unit 추론, IP 요청 제한, 본문 읽기.
- **프론트** `app.js` `#/custom`
  - Tesseract CDN lazy-load·전처리 코드 삭제. 사진을 고르면 **바로** 실행: canvas에서 최대 1280px·JPEG 0.82(실측 0.1~0.12MB)로 줄여 POST → 1~3초.
  - name·brand·category·중량·열량·나트륨·당류·지방·탄수화물·단백질·원재료를 채움. AI가 알려 준 단위(ml/g)는 숨은 입력 `#ai-unit`에 두어, 100ml 키즈 음료가 카드에서 "100g"으로 나오지 않게 했습니다. 사용자가 직접 적어 둔 칸은 덮어쓰지 않고, AI가 채운 칸(`.ocr-filled`)은 다시 인식하면 갱신.
  - `mode === "product_lookup"` 또는 `estimated === true`면 `.ai-banner`에 "앞면 제품명으로 성분을 찾아 채웠어요…" + `note`(출처) 표시.
  - 문구: 사진 버튼 "성분표나 제품 앞면을 찍으면 AI가 자동으로 숫자를 채워 드려요", 사진 아래 "사진은 성분을 읽기 위해 AI(Google Gemini)로 전송돼요…" — 옛 "기기 안에서만/어디에도 보내지 않습니다" 문구는 제거(사실과 달라짐).
  - `lib/nutrition-ocr.js`와 그 테스트는 남겨 두었지만 화면에는 더 이상 연결되어 있지 않습니다(예비 파서).
- **배포 설정**: `.vercelignore`에서 `package.json` 제외를 뺐습니다(빼면 `api/*.js`가 CJS로 해석되어 ESM import가 깨짐). `vercel.json`에 `functions["api/analyze-food.js"].maxDuration=30` 추가.
- **테스트**: `node --test` **207/207 통과**(`test/analyze-food.test.js` 35개: 요청 검증·프롬프트·JSON 추출·정규화·요청 제한·핸들러 200/400/413/429/502/503/504, Gemini fetch 모킹).
- **검증**: `tools/verify_vision.py` — 로컬(목 응답) 29/29, 390×844. 앞면 사진 → 제품명·용량·음료·원재료 + 배너, 성분표 `label-kr.png` → 75·320·100·37·4.6, 503 → 안내·다시 시도·직접 입력으로 카드 생성, Tesseract/CDN 요청 0, 가로 넘침 0, 콘솔 오류 0. 스크린샷 `verification/tumyeongbongji/vision-*.png`.

### 라이브 E2E 결과 (2026-11-28, 390×844, 실제 Gemini 호출)

- **앞면 "파파 ZOOS 배도라지" 사진** (`attachments/2026-11-28/1000000035-…jpg`) → **2.0초**에 `name "파파 ZOOS 배도라지"`, `category kids`, `servingG 100 / unit ml`, `kcal 45`, 포장에 보이는 원재료(배혼합농축액·도라지혼합농축액·모과농축액)를 채우고 추정 안내 배너에 note("포장 앞면 표기 확인(45kcal, 100ml) 및 AI가 아는 정보")를 표시. 나트륨·당류·지방은 추측하지 않고 비워 두어 "직접 채워 주세요"로 안내.
- **뒷면 성분표** (`tools/label-kr.png`) → **3.0초**에 75g·320kcal·나트륨 100mg·당류 37g·지방 4.6g·탄수화물 66g·단백질 3.2g 을 정확히 채우고 추정 배너는 숨김.
- 그 밖에 문구·가로 넘침 0·콘솔 오류 0·Tesseract/CDN 요청 0 확인. 캡처 `verification/tumyeongbongji/vision-live-*.png`, 기록 `vision-live.json`(22개 중 21개 PASS — 남은 1개는 검증 스크립트가 종류를 `drink`로만 기대했는데 실제 응답은 `kids`였던 것. 키즈 음료라 `kids`가 맞아 스크립트를 `drink|kids`로 고쳤습니다).
- **한도 주의**: 무료 등급 키라 분당 5회·하루 20회 수준입니다. 앱 서버 제한(IP당 분당 8·하루 60)보다 Gemini 쪽 한도가 먼저 걸리면 429 `upstream_quota` → "지금은 AI 사진 인식을 쓸 수 없어요(요청 한도)" 안내와 함께 직접 입력으로 넘어갑니다. 공개 앱으로 오래 쓰려면 결제 연결이 필요합니다.
- Google Search grounding은 무료 등급에서 안 되므로(429) 기본은 모델 지식으로 채우고 추정 배너로 알립니다. 유료 등급이면 `GEMINI_SEARCH_GROUNDING=1`.

## 2026-11-28 추가 — 폰트를 페이퍼로지(Paperlogy)로 교체

- **왜**: 화면·카드 글꼴을 고운돋움에서 **페이퍼로지**로 바꿔 달라는 요청. 고운돋움은 굵기가 400 하나뿐이라 700·800 제목이 브라우저 합성 굵기였는데, 페이퍼로지는 9굵기(OFL)라 400·500·600·700·800이 실제 굵기로 나옵니다.
- **서빙**: `fonts/Paperlogy-{4Regular,5Medium,6SemiBold,7Bold,8ExtraBold}.woff2`(각 159~165KB, 한글 11,172자)를 저장소에 두고 `styles.css`의 `@font-face` 5개로 직접 서빙. `index.html`의 구글 폰트 링크·preconnect는 지우고 400만 `preload`합니다(굵기는 화면에 쓰인 것만 내려받음). 라이선스 전문은 `fonts/OFL.txt`, 출처는 `fonts/README.md`.
- **카드 PNG**: `lib/card-svg.js`의 FONT가 `'Paperlogy'` 먼저. `lib/font-embed.js`는 카드 SVG의 `<text font-weight>`를 읽어 **쓰인 굵기의 `fonts/*.woff2`만** base64 `@font-face`로 심습니다(외부 CDN 요청 없음, 굵기 하나 약 160KB). 없는 굵기(900 등)는 가장 가까운 파일로 붙습니다. `app.js`는 커진 SVG를 `data:` 대신 **blob URL**로 `<img>`에 넘깁니다(모바일 Safari의 data URL 길이 제한 회피).
- **글리프**: `python3 tools/check_glyphs.py` — 앱 코드·데이터의 803자(한글·영문·숫자·`·`·`%`·`kcal`·`mg`·`g`·`㎎` 등)가 5굵기 모두에 있고 누락 0. 이모지·그림문자 24자만 대체 글꼴.
- **테스트**: `node --test` **210/210 통과**. `test/font-embed.test.js`는 굵기 수집·가장 가까운 파일 선택·굵기별 @font-face·캐시·부분 실패 시 나머지 유지·실패 시 원본 반환을 확인.
- **검증**: `tools/verify_font.py [base_url] [tag]` 16/16 — 390×844에서 body·400/700/800 로드, 구글 폰트 요청 0, 글리프 샘플, 카드 SVG 폰트·폭 넘침 0, 카드 렌더 픽셀 비교(폰트 심은 그림 vs 안 심은 그림 15,271px 차이 = 실제로 글꼴이 그려짐), PNG 내보내기에서 저장소 폰트 요청 + 파일 저장. 스크린샷 `verification/tumyeongbongji/*paperlogy*.png`.

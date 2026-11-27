# 인수인계 — 투명봉지 (2026-11-27)

과자·음료·라면·키즈 간식의 영양성분표를 **국자·각설탕·밥숟가락** 단위와 **투명 봉지 단면**으로 보여주는 정적 웹앱.

- 라이브(프로덕션): https://tumyeongbongji.vercel.app
- 저장소: https://github.com/leesh33/tumyeongbongji (public, `main`)
- Vercel 프로젝트: `tumyeongbongji` (`prj_6JRWVoy7RbyaacGYE4QuUo54vx2Y`, 개인 계정 leesh33)
- 현재 상태: 2026-11-27 Vercel 프로젝트에 GitHub(`leesh33/tumyeongbongji`) 자동 배포를 연결했습니다. 이후 `main`에 머지되는 커밋은 Vercel이 자동 배포합니다. 첫 자동 배포에는 PR #1(23종 성분표 수정)과 PR #2(성분표 OCR)가 함께 들어갑니다.

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
  - 주의: 이 프로젝트(ref `nhdzexqkibotubfovbpa`)는 대시보드상 이름이 **꼬리핀**입니다. 꼬리핀과 같은 Supabase 프로젝트 안에 투명봉지용 테이블 두 개가 따로 들어 있습니다.
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

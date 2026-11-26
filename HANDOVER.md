# 인수인계 — 투명봉지 (2026-11-27)

과자·음료·라면·키즈 간식의 영양성분표를 **국자·각설탕·밥숟가락** 단위와 **투명 봉지 단면**으로 보여주는 정적 웹앱.

- 라이브(프로덕션): https://tumyeongbongji.vercel.app
- 저장소: https://github.com/leesh33/tumyeongbongji (public, `main`)
- Vercel 프로젝트: `tumyeongbongji` (`prj_6JRWVoy7RbyaacGYE4QuUo54vx2Y`, 개인 계정 leesh33)
- 현재 상태: 2026-11-27 Vercel 프로젝트에 GitHub(`leesh33/tumyeongbongji`) 자동 배포를 연결했습니다. 이후 `main`에 머지되는 커밋은 Vercel이 자동 배포합니다. 첫 자동 배포에는 PR #1(23종 성분표 수정)과 PR #2(성분표 OCR)가 함께 들어갑니다.

## 기술 구성

- 빌드 없는 정적 사이트(HTML/CSS/ES 모듈). `index.html` + `app.js` + `lib/*` + `data/products.js`.
- 단위 기준은 `config.js`: 나트륨 220mg = 라면 국물 1국자, 당류 3g = 각설탕 1개, 지방 10g = 밥숟가락 1스푼.
- 카드 SVG는 `lib/card-svg.js`, 층 계산은 `lib/stack.js`. 당류·지방은 영양성분표 값을 그대로 층 무게로 쓰고, 나머지 무게를 `bulk` 비중으로 나눕니다. 무거운 층이 아래.
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

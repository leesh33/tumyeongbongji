## 무엇을 했나

**카카오·구글·애플 소셜 로그인(회원가입 포함)** 과 **기명 댓글**을 넣었습니다. 영양정보 조회·저장·비교는 지금처럼 로그인 없이 그대로 쓸 수 있고, **댓글만 기명**으로 남깁니다.

### 1. 로그인 (SDK 없이 GoTrue OAuth + PKCE)
- `lib/auth.js` 신규: 외부 npm/CDN 의존성 없이 fetch로만 Supabase GoTrue를 다룹니다.
  - `code_verifier`(48바이트 난수, base64url) → `localStorage` → `S256 code_challenge` → `/auth/v1/authorize?provider={kakao|google|apple}&flow_type=pkce`
  - 로그인 전 화면 해시(`#/p/choco-heim` 등)를 저장해 두고, 콜백 `?code=`를 `POST /auth/v1/token?grant_type=pkce`(`auth_code`+`code_verifier`)로 교환한 뒤 **원래 화면으로 복귀**하며 주소창의 `?code=`를 지웁니다.
  - 만료 60초 전부터 `refresh_token` 자동 갱신, 로그아웃은 `/auth/v1/logout` 후 기기 세션 삭제.
  - OAuth `user_metadata`(`nickname`·`name`·`full_name`·`preferred_username`·이메일 앞부분)에서 첫 닉네임을 만들고 `tumyeongbongji_profiles`에 upsert.

### 2. 화면
- 홈·제품 상세 상단 오른쪽 `[로그인]` 버튼 → 로그인하면 **내 닉네임 칩**(누르면 프로필 시트). 390px에서 줄바꿈·넘침 없음(좁은 폭에서는 `제안·제보`가 아이콘만).
- **로그인 시트**: 카카오(`#FEE500`) · 구글(흰색+테두리) · 애플(`#000000`) + "기명 댓글과 내 댓글 관리를 위해 로그인해요. 영양정보 조회·저장·비교는 로그인 없이 이용할 수 있어요."
- **내 프로필 시트**: 닉네임(1~20자) 변경 + 로그아웃.
- **제품 상세 댓글**
  - 비로그인: 목록은 읽히고, 입력 폼 대신 "기명으로 댓글을 남기려면 로그인이 필요해요." + `[카카오·구글·애플로 로그인]`
  - 로그인: 작성자 이름 입력칸 대신 `댓글은 ○○ 이름으로 남아요 · 닉네임 변경`, 등록은 `Authorization: Bearer <user_access_token>`, 내 댓글에만 `[삭제]`
  - 세션 만료·권한 오류는 "로그인 정보가 만료됐어요. 다시 로그인해 주세요." + 로그인 시트로 유도
- 제안·제보 게시판은 계속 익명 작성 가능(로그인했으면 닉네임 자동 채움).

### 3. DB (Supabase `nhdzexqkibotubfovbpa`, 꼬리핀과 공유 프로젝트)
`tools/migrations/2026-11-27-auth-comments.sql` — `tumyeongbongji_*`만 건드립니다.
- `public.tumyeongbongji_profiles` 신규(user_id PK → auth.users, nickname 1~20자 check, provider, created_at/updated_at)
- `public.tumyeongbongji_comments.user_id` 추가
- GRANT: profiles SELECT(anon, authenticated) / INSERT·UPDATE(authenticated), comments SELECT(anon, authenticated) / INSERT·DELETE(authenticated), **anon의 INSERT·UPDATE·DELETE 회수**
- RLS: profiles SELECT 전체·INSERT/UPDATE 본인(`auth.uid() = user_id`), comments INSERT `with check (auth.uid() = user_id)`, DELETE `using (auth.uid() = user_id)`, UPDATE 정책 없음(차단 유지)

## 검증
- `node --test` **127/127 통과** (`test/auth.test.js` 27개 신규: PKCE 파라미터·S256 challenge, 콜백 교환/복귀/오류, 세션 만료·refresh, 닉네임 추출·길이, 프로필 upsert·닉네임 변경, `test/supabase.test.js`에 기명 등록 헤더·user_id·삭제·비로그인 차단 5개 추가)
- `tools/verify_auth.py` **43/43 통과**(로컬 390×844·데스크톱): 로그인 시트 3종 버튼·색상, **실제 authorize URL 생성**(provider/redirect_to/code_challenge/method=s256/flow_type=pkce), 비로그인 댓글 가드, 로그인 상태(세션 주입+응답 목)에서 기명 등록 `Authorization: Bearer`·`user_id`·삭제, 콜백 복귀(`?code=` 교환 → `#/p/choco-heim` 복원 → 주소창 정리), 프로필 시트, 가로 넘침 0, 콘솔/페이지 오류 0
- Supabase authorize 엔드포인트 실측: 카카오·구글·애플 모두 **302 → 각 provider authorize 페이지**(카카오 client_id, 구글 client_id, 애플 `com.ggoripin.app.web`)로 넘어가는 것 확인 — 3종 프로바이더가 켜져 있고 `https://tumyeongbongji.vercel.app/` redirect_to가 허용됨
- DB 실측(anon publishable 키): comments·profiles **SELECT 200**, comments INSERT / DELETE / profiles INSERT **42501 권한 거부**

## 남은 확인 (사용자 계정 필요)
- 실제 카카오·구글·애플 계정으로 로그인해 댓글을 남기고 삭제하는 실측은 OAuth 로그인 화면 특성상 사용자가 직접 확인해야 합니다.

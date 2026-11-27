import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  NICKNAME_MAX,
  RETURN_KEY,
  SESSION_KEY,
  VERIFIER_KEY,
  AuthError,
  buildAuthorizeUrl,
  challengeForVerifier,
  cleanCallbackUrl,
  createAuthClient,
  ensureProfile,
  hasAuthParams,
  isSessionExpired,
  isValidNickname,
  memoryStorage,
  nicknameFromUser,
  randomVerifier,
  readAuthParams,
  sanitizeNickname,
  sessionFromTokenResponse,
  toBase64Url,
} from '../lib/auth.js';

const BASE = 'https://proj.supabase.co';
const KEY = 'sb_publishable_test';
const REDIRECT = 'https://sokboine.vercel.app/';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function makeClient({ handlers = {}, storage = memoryStorage(), hash = '#/p/choco-heim' } = {}) {
  const calls = [];
  const navigations = [];
  const client = createAuthClient({
    url: `${BASE}/`,
    key: KEY,
    storage,
    redirectTo: REDIRECT,
    navigate: async (href) => {
      navigations.push(href);
    },
    location: { origin: 'https://sokboine.vercel.app', pathname: '/', hash, search: '' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      for (const [needle, handler] of Object.entries(handlers)) {
        if (url.includes(needle)) return handler(url, init);
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });
  return { client, calls, navigations, storage };
}

const TOKEN = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'u-1', email: 'sujin@example.com', user_metadata: { full_name: '김수진' }, app_metadata: { provider: 'kakao' } },
};

/* ── PKCE ───────────────────────────────────── */

test('code_verifier는 URL-safe 43자 이상 난수', () => {
  const a = randomVerifier(48);
  const b = randomVerifier(48);
  assert.match(a, /^[A-Za-z0-9_-]{43,}$/);
  assert.notEqual(a, b);
  assert.ok(a.length >= 43);
});

test('code_challenge는 SHA-256 base64url', async () => {
  const verifier = 'test-verifier-1234567890';
  const expected = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(await challengeForVerifier(verifier), expected);
  assert.equal(toBase64Url(new Uint8Array([251, 255, 191])), '-_-_');
});

test('authorize 주소에 provider·redirect_to·PKCE 파라미터가 들어간다', () => {
  const url = buildAuthorizeUrl({
    baseUrl: `${BASE}/`,
    provider: 'google',
    redirectTo: REDIRECT,
    codeChallenge: 'challenge-abc',
  });
  assert.ok(url.startsWith(`${BASE}/auth/v1/authorize?`));
  const q = new URL(url).searchParams;
  assert.equal(q.get('provider'), 'google');
  assert.equal(q.get('redirect_to'), REDIRECT);
  assert.equal(q.get('code_challenge'), 'challenge-abc');
  assert.equal(q.get('code_challenge_method'), 's256');
  assert.equal(q.get('flow_type'), 'pkce');
});

test('모르는 provider는 거절한다', () => {
  assert.throws(
    () => buildAuthorizeUrl({ baseUrl: BASE, provider: 'naver', redirectTo: REDIRECT, codeChallenge: 'x' }),
    (err) => err instanceof AuthError && err.kind === 'provider',
  );
});

/* ── 닉네임 ─────────────────────────────────── */

test('닉네임 정리: 공백·제어문자 정리, 앞뒤 공백 제거, 20자 제한', () => {
  assert.equal(sanitizeNickname('  김 수진  '), '김 수진');
  assert.equal(sanitizeNickname('가\n나\t다'), '가 나 다');
  assert.equal(sanitizeNickname('   '), '');
  assert.equal(sanitizeNickname(null), '');
  assert.equal([...sanitizeNickname('가'.repeat(30))].length, NICKNAME_MAX);
  assert.equal(isValidNickname('수'), true);
  assert.equal(isValidNickname('   '), false);
  // 21자 이상은 20자로 잘려서 저장된다
  assert.equal([...sanitizeNickname('가'.repeat(21))].length, NICKNAME_MAX);
  assert.equal(isValidNickname(sanitizeNickname('가'.repeat(21))), true);
});

test('OAuth 메타데이터에서 닉네임을 고른다 (카카오·구글·이메일·기본값)', () => {
  assert.equal(nicknameFromUser({ user_metadata: { full_name: '김수진' } }), '김수진');
  assert.equal(nicknameFromUser({ user_metadata: { name: 'Sujin Kim' } }), 'Sujin Kim');
  assert.equal(nicknameFromUser({ user_metadata: { nickname: '수진' }, email: 'a@b.c' }), '수진');
  assert.equal(nicknameFromUser({ user_metadata: {}, email: 'andy.leesh33@gmail.com' }), 'andy.leesh33');
  assert.equal(nicknameFromUser({}, '기본이름'), '기본이름');
  assert.equal(nicknameFromUser({ user_metadata: { name: '가'.repeat(40) } }).length, NICKNAME_MAX);
});

/* ── 세션 ───────────────────────────────────── */

test('토큰 응답을 세션으로 정리한다 (expires_at·expires_in·user)', () => {
  const nowMs = 1_700_000_000_000;
  const session = sessionFromTokenResponse(TOKEN, nowMs);
  assert.equal(session.accessToken, 'access-1');
  assert.equal(session.refreshToken, 'refresh-1');
  assert.equal(session.expiresAt, Math.floor(nowMs / 1000) + 3600);
  assert.equal(session.provider, 'kakao');
  assert.equal(session.user.id, 'u-1');

  const fixed = sessionFromTokenResponse({ ...TOKEN, expires_at: 1_800_000_000 }, nowMs);
  assert.equal(fixed.expiresAt, 1_800_000_000);
});

test('access_token이 없는 응답은 response 오류', () => {
  assert.throws(() => sessionFromTokenResponse({}), (err) => err instanceof AuthError && err.kind === 'response');
});

test('만료 판정은 60초 여유를 둔다', () => {
  const nowMs = 1_700_000_000_000;
  const soon = { accessToken: 'a', expiresAt: Math.floor(nowMs / 1000) + 30 };
  const later = { accessToken: 'a', expiresAt: Math.floor(nowMs / 1000) + 600 };
  assert.equal(isSessionExpired(soon, nowMs), true);
  assert.equal(isSessionExpired(later, nowMs), false);
  assert.equal(isSessionExpired(null, nowMs), true);
});

/* ── 콜백 파라미터 ──────────────────────────── */

test('콜백 파라미터 읽기와 주소 정리', () => {
  assert.deepEqual(readAuthParams('?code=abc&foo=1'), { code: 'abc', error: '', errorDescription: '' });
  assert.equal(hasAuthParams('?code=abc'), true);
  assert.equal(hasAuthParams('?foo=1'), false);
  assert.equal(hasAuthParams('?error=access_denied'), true);

  const cleaned = cleanCallbackUrl('https://sokboine.vercel.app/?code=abc&state=xyz#/p/choco-heim');
  assert.equal(cleaned, '/#/p/choco-heim');
  assert.equal(cleanCallbackUrl('not a url'), '/');
});

/* ── 로그인 시작 ────────────────────────────── */

test('로그인 시작: verifier를 저장하고 authorize 주소로 이동한다', async () => {
  const { client, navigations, storage } = makeClient();
  const url = await client.signIn('kakao');
  assert.equal(navigations.length, 1);
  assert.equal(url, navigations[0]);
  const q = new URL(url).searchParams;
  assert.equal(q.get('provider'), 'kakao');
  assert.equal(q.get('redirect_to'), REDIRECT);
  assert.equal(q.get('flow_type'), 'pkce');
  assert.equal(q.get('code_challenge_method'), 's256');

  const verifier = storage.get(VERIFIER_KEY);
  assert.ok(verifier && verifier.length >= 43);
  assert.equal(await challengeForVerifier(verifier), q.get('code_challenge'));
  // 돌아올 화면도 기억해 둔다
  assert.equal(storage.get(RETURN_KEY), '#/p/choco-heim');
});

/* ── 콜백 처리 ──────────────────────────────── */

test('콜백: ?code= 를 auth_code+verifier로 교환하고 세션을 저장한다', async () => {
  const { client, calls, storage } = makeClient({
    handlers: { '/auth/v1/token?grant_type=pkce': () => jsonResponse(TOKEN) },
  });
  await client.signIn('apple');
  const verifier = storage.get(VERIFIER_KEY);

  const result = await client.handleCallback('?code=code-123');
  assert.equal(result.status, 'ok');
  assert.equal(result.session.accessToken, 'access-1');
  assert.equal(result.returnTo, '#/p/choco-heim');

  const { url, init } = calls.find((c) => c.url.includes('grant_type=pkce'));
  assert.equal(url, `${BASE}/auth/v1/token?grant_type=pkce`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.apikey, KEY);
  assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(JSON.parse(init.body), { auth_code: 'code-123', code_verifier: verifier });

  const stored = JSON.parse(storage.get(SESSION_KEY));
  assert.equal(stored.accessToken, 'access-1');
  assert.equal(storage.get(VERIFIER_KEY), null);
});

test('콜백: 원래 화면 해시는 한 번만 꺼내고 지운다', async () => {
  const { client } = makeClient({ handlers: { 'grant_type=pkce': () => jsonResponse(TOKEN) } });
  await client.signIn('google');
  const result = await client.handleCallback('?code=code-123');
  assert.equal(client.consumeReturnPath(), result.returnTo);
  assert.equal(client.consumeReturnPath(), '');
});

test('콜백: 사용자가 취소하면 친절한 한국어 안내', async () => {
  const { client } = makeClient();
  const result = await client.handleCallback('?error=access_denied&error_description=denied');
  assert.equal(result.status, 'error');
  assert.match(result.message, /취소/);
});

test('콜백: verifier가 없으면 다시 로그인하도록 안내', async () => {
  const { client } = makeClient();
  const result = await client.handleCallback('?code=abc');
  assert.equal(result.status, 'error');
  assert.match(result.message, /다시 로그인/);
});

test('콜백: 토큰 교환이 실패하면 error 상태이고 verifier를 지운다', async () => {
  const { client, storage } = makeClient({
    handlers: { 'grant_type=pkce': () => jsonResponse({ msg: 'invalid flow state' }, 400) },
  });
  await client.signIn('kakao');
  const result = await client.handleCallback('?code=bad');
  assert.equal(result.status, 'error');
  assert.equal(storage.get(VERIFIER_KEY), null);
  assert.equal(storage.get(SESSION_KEY), null);
});

test('콜백: code가 없으면 none', async () => {
  const { client, calls } = makeClient();
  const result = await client.handleCallback('');
  assert.equal(result.status, 'none');
  assert.equal(calls.length, 0);
});

/* ── 세션 갱신·로그아웃 ─────────────────────── */

function storedSession(overrides = {}) {
  return JSON.stringify({
    accessToken: 'access-old',
    refreshToken: 'refresh-old',
    expiresAt: 1,
    user: TOKEN.user,
    provider: 'kakao',
    ...overrides,
  });
}

test('만료된 세션은 refresh_token으로 갱신한다', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: storedSession() });
  const { client, calls } = makeClient({
    storage,
    handlers: {
      'grant_type=refresh_token': () =>
        jsonResponse({ access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600, user: TOKEN.user }),
    },
  });
  const session = await client.ensureSession();
  assert.equal(session.accessToken, 'access-new');
  assert.equal(JSON.parse(storage.get(SESSION_KEY)).refreshToken, 'refresh-new');
  assert.deepEqual(JSON.parse(calls[0].init.body), { refresh_token: 'refresh-old' });
});

test('유효한 세션은 그대로 쓰고 요청하지 않는다', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: storedSession({ expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
  const { client, calls } = makeClient({ storage });
  const session = await client.ensureSession();
  assert.equal(session.accessToken, 'access-old');
  assert.equal(calls.length, 0);
});

test('갱신이 실패하면 세션을 지우고 null', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: storedSession() });
  const { client } = makeClient({
    storage,
    handlers: { 'grant_type=refresh_token': () => jsonResponse({ msg: 'invalid refresh token' }, 400) },
  });
  assert.equal(await client.ensureSession(), null);
  assert.equal(storage.get(SESSION_KEY), null);
});

test('로그아웃: 서버 로그아웃 요청 후 이 기기 세션을 지운다', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: storedSession({ expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
  const { client, calls } = makeClient({ storage, handlers: { '/auth/v1/logout': () => jsonResponse('', 204) } });
  await client.signOut();
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer access-old');
  assert.equal(storage.get(SESSION_KEY), null);
});

test('로그아웃: 서버가 실패해도 기기 세션은 지운다', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: storedSession({ expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
  const { client } = makeClient({ storage, handlers: { '/auth/v1/logout': () => jsonResponse({ msg: 'nope' }, 500) } });
  await client.signOut();
  assert.equal(storage.get(SESSION_KEY), null);
});

/* ── 프로필 ─────────────────────────────────── */

const SESSION = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: TOKEN.user,
  provider: 'kakao',
};

test('프로필 조회: 내 user_id로 한 줄 읽고 사용자 토큰을 쓴다', async () => {
  const { client, calls } = makeClient({
    handlers: { '/rest/v1/tumyeongbongji_profiles?select=': () => jsonResponse([{ user_id: 'u-1', nickname: '수진' }]) },
  });
  const row = await client.fetchProfile(SESSION);
  assert.equal(row.nickname, '수진');
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('user_id'), 'eq.u-1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer access-1');
});

test('프로필 저장: upsert(merge-duplicates)로 닉네임을 만든다', async () => {
  const { client, calls } = makeClient({
    handlers: { '/rest/v1/tumyeongbongji_profiles': () => jsonResponse([{ user_id: 'u-1', nickname: '김수진' }]) },
  });
  const row = await client.saveProfile(SESSION, { nickname: '  김수진  ', provider: 'kakao' });
  assert.equal(row.nickname, '김수진');
  const { url, init } = calls[0];
  assert.equal(url, `${BASE}/rest/v1/tumyeongbongji_profiles`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  const body = JSON.parse(init.body);
  assert.equal(body.user_id, 'u-1');
  assert.equal(body.nickname, '김수진');
  assert.equal(body.provider, 'kakao');
  assert.ok(body.updated_at);
});

test('닉네임 변경: 내 행만 PATCH하고 1~20자를 검사한다', async () => {
  const { client, calls } = makeClient({
    handlers: { '/rest/v1/tumyeongbongji_profiles?user_id=': () => jsonResponse([{ user_id: 'u-1', nickname: '새이름' }]) },
  });
  const row = await client.updateNickname(SESSION, '새이름');
  assert.equal(row.nickname, '새이름');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(new URL(calls[0].url).searchParams.get('user_id'), 'eq.u-1');
  assert.equal(JSON.parse(calls[0].init.body).nickname, '새이름');

  await assert.rejects(
    () => client.updateNickname(SESSION, '   '),
    (err) => err instanceof AuthError && err.kind === 'validation',
  );
});

test('처음 로그인: 프로필이 없으면 OAuth 이름으로 만들어 둔다', async () => {
  let posted = null;
  const { client } = makeClient({
    handlers: {
      '/rest/v1/tumyeongbongji_profiles?select=': () => jsonResponse([]),
      '/rest/v1/tumyeongbongji_profiles': (url, init) => {
        posted = JSON.parse(init.body);
        return jsonResponse([{ user_id: 'u-1', nickname: posted.nickname }]);
      },
    },
  });
  const row = await ensureProfile(client, SESSION);
  assert.equal(row.nickname, '김수진');
  assert.equal(posted.provider, 'kakao');
});

test('처음 로그인: 이미 프로필이 있으면 새로 만들지 않는다', async () => {
  let posted = 0;
  const { client } = makeClient({
    handlers: {
      '/rest/v1/tumyeongbongji_profiles?select=': () => jsonResponse([{ user_id: 'u-1', nickname: '기존' }]),
      '/rest/v1/tumyeongbongji_profiles': () => {
        posted += 1;
        return jsonResponse([]);
      },
    },
  });
  const row = await ensureProfile(client, SESSION);
  assert.equal(row.nickname, '기존');
  assert.equal(posted, 0);
});

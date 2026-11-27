// Supabase GoTrue 소셜 로그인(OAuth + PKCE)을 SDK 없이 fetch로만 다루는 모듈.
//
// 흐름
//  1) signIn(provider)
//     code_verifier 생성 → localStorage 저장 → SHA-256 code_challenge
//     → /auth/v1/authorize?provider=...&flow_type=pkce 로 이동
//     (로그인 전 화면 해시도 함께 저장해 두고 돌아와서 복원한다)
//  2) 콜백: /?code=...
//     POST /auth/v1/token?grant_type=pkce { auth_code, code_verifier } → 세션 저장
//  3) 만료 60초 전부터 refresh_token 으로 자동 갱신, 로그아웃은 /auth/v1/logout
//  4) 프로필(닉네임)은 public.tumyeongbongji_profiles 에 upsert
import { SUPABASE } from '../config.js';

export const PROVIDERS = [
  { key: 'kakao', name: '카카오' },
  { key: 'google', name: '구글' },
  { key: 'apple', name: '애플' },
];

export const NICKNAME_MIN = 1;
export const NICKNAME_MAX = 20;
export const DEFAULT_NICKNAME = '속보이네 사용자';

export const SESSION_KEY = 'tb-auth-session';
export const VERIFIER_KEY = 'tb-auth-verifier';
export const RETURN_KEY = 'tb-auth-return';
export const REFRESH_MARGIN_SEC = 60;

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state', 'provider_token'];

const MESSAGES = {
  network: '인터넷 연결이 불안정해요. 연결을 확인하고 다시 시도해 주세요.',
  timeout: '로그인 서버 응답이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.',
  auth: '로그인 정보가 만료됐어요. 다시 로그인해 주세요.',
  validation: '로그인 요청 시간이 지났어요. 다시 시도해 주세요.',
  server: '로그인 서버에 잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.',
  response: '로그인 응답을 읽지 못했어요. 다시 시도해 주세요.',
  provider: '지원하지 않는 로그인 방식이에요.',
  profile: '내 프로필을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.',
};

/** 화면에 그대로 보여 줄 수 있는 한국어 메시지를 가진 오류 */
export class AuthError extends Error {
  constructor(kind, message, { status = 0, detail = '' } = {}) {
    super(message);
    this.name = 'AuthError';
    this.kind = kind; // network | timeout | auth | validation | server | response | provider | profile
    this.status = status;
    this.detail = detail;
  }
}

export function friendlyAuthMessage(err) {
  if (err instanceof AuthError && err.message) return err.message;
  return '로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.';
}

/* ── 순수 함수 ───────────────────────────────── */

export function providerName(key) {
  return PROVIDERS.find((p) => p.key === key)?.name ?? '';
}

export function isProvider(key) {
  return PROVIDERS.some((p) => p.key === key);
}

/** Uint8Array → base64url (패딩 없이) */
export function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_verifier: 32바이트 이상 난수 → base64url (RFC 7636) */
export function randomVerifier(byteLength = 48, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.getRandomValues) throw new AuthError('response', '이 브라우저에서는 로그인을 쓸 수 없어요.');
  const bytes = new Uint8Array(byteLength);
  cryptoImpl.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** code_challenge = BASE64URL(SHA256(verifier)) */
export async function challengeForVerifier(verifier, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) throw new AuthError('response', '이 브라우저에서는 로그인을 쓸 수 없어요.');
  const data = new TextEncoder().encode(String(verifier));
  const digest = await cryptoImpl.subtle.digest('SHA-256', data);
  return toBase64Url(new Uint8Array(digest));
}

export async function createPkcePair(cryptoImpl = globalThis.crypto, byteLength = 48) {
  const verifier = randomVerifier(byteLength, cryptoImpl);
  const challenge = await challengeForVerifier(verifier, cryptoImpl);
  return { verifier, challenge };
}

/** /auth/v1/authorize 주소 (provider·redirect_to·PKCE 파라미터) */
export function buildAuthorizeUrl({ baseUrl, provider, redirectTo, codeChallenge }) {
  if (!isProvider(provider)) throw new AuthError('provider', MESSAGES.provider);
  const params = new URLSearchParams();
  params.set('provider', provider);
  params.set('redirect_to', String(redirectTo ?? ''));
  params.set('code_challenge', String(codeChallenge ?? ''));
  params.set('code_challenge_method', 's256');
  params.set('flow_type', 'pkce');
  return `${String(baseUrl ?? '').replace(/\/+$/, '')}/auth/v1/authorize?${params.toString()}`;
}

/** 콜백 쿼리에서 code / error 만 뽑는다 */
export function readAuthParams(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  return {
    code: params.get('code') || '',
    error: params.get('error') || '',
    errorDescription: params.get('error_description') || '',
  };
}

export function hasAuthParams(search = '') {
  const { code, error } = readAuthParams(search);
  return Boolean(code || error);
}

/** 로그인 파라미터를 지운 주소(경로+해시) — 주소창을 깨끗하게 되돌린다 */
export function cleanCallbackUrl(href, removeKeys = AUTH_PARAMS) {
  try {
    const url = new URL(String(href));
    for (const key of removeKeys) url.searchParams.delete(key);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

/** 공백 정리 + 제어문자 제거 + 20자 제한 (코드 포인트 기준) */
export function sanitizeNickname(value) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...text].slice(0, NICKNAME_MAX).join('').trim();
}

export function isValidNickname(value) {
  const length = [...sanitizeNickname(value)].length;
  return length >= NICKNAME_MIN && length <= NICKNAME_MAX;
}

/** OAuth user_metadata 에서 쓸 만한 이름을 고른다 (카카오 nickname/full_name, 구글 name, 애플 email 등) */
export function nicknameFromUser(user, fallback = DEFAULT_NICKNAME) {
  const meta = user?.user_metadata ?? {};
  const email = String(user?.email ?? '');
  const local = email.includes('@') ? email.split('@')[0] : email;
  for (const candidate of [
    meta.nickname,
    meta.name,
    meta.full_name,
    meta.preferred_username,
    meta.user_name,
    local,
  ]) {
    const nickname = sanitizeNickname(candidate);
    if (nickname) return nickname;
  }
  return sanitizeNickname(fallback) || DEFAULT_NICKNAME;
}

export function sessionFromTokenResponse(data, nowMs = Date.now()) {
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    throw new AuthError('response', MESSAGES.response);
  }
  const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;
  const expiresAt = Number(data.expires_at) > 0 ? Number(data.expires_at) : Math.floor(nowMs / 1000) + expiresIn;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : '',
    expiresAt,
    tokenType: data.token_type || 'bearer',
    user: data.user ?? null,
    provider: data.user?.app_metadata?.provider || '',
  };
}

export function isSessionExpired(session, nowMs = Date.now(), marginSec = REFRESH_MARGIN_SEC) {
  if (!session?.accessToken) return true;
  const expiresAt = Number(session.expiresAt) || 0;
  if (!expiresAt) return false;
  return expiresAt * 1000 - marginSec * 1000 <= nowMs;
}

export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => (map.has(key) ? map.get(key) : null),
    set: (key, value) => {
      map.set(key, String(value));
    },
    remove: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

function browserStorage() {
  try {
    const probe = '__tb-auth-probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return {
      get: (key) => globalThis.localStorage.getItem(key),
      set: (key, value) => globalThis.localStorage.setItem(key, value),
      remove: (key) => globalThis.localStorage.removeItem(key),
    };
  } catch {
    // 시크릿 모드처럼 저장이 막힌 브라우저에서는 이번 방문에만 세션을 들고 있는다
    return memoryStorage();
  }
}

function defaultRedirectTo(location) {
  if (!location) return '';
  return `${location.origin}${location.pathname}`;
}

/* ── 클라이언트 ─────────────────────────────── */

/**
 * @param {{url?:string,key?:string,fetchImpl?:Function,storage?:object,cryptoImpl?:object,now?:Function,redirectTo?:string,navigate?:Function,timeoutMs?:number,profilesTable?:string}} [options]
 */
export function createAuthClient(options = {}) {
  const baseUrl = String(options.url ?? SUPABASE.url).replace(/\/+$/, '');
  const key = options.key ?? SUPABASE.key;
  const fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const storage = options.storage ?? browserStorage();
  const cryptoImpl = options.cryptoImpl ?? globalThis.crypto;
  const now = options.now ?? (() => Date.now());
  const location = options.location ?? globalThis.location;
  const redirectTo = options.redirectTo ?? defaultRedirectTo(location);
  const navigate =
    options.navigate ??
    ((href) => {
      globalThis.location.assign(href);
    });
  const timeoutMs = options.timeoutMs ?? 12000;
  const profilesTable = options.profilesTable ?? 'tumyeongbongji_profiles';

  function errorFromResponse(status, data) {
    const detail = String(data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? '');
    const options = { status, detail };
    if (status === 400 || status === 422) return new AuthError('validation', MESSAGES.validation, options);
    if (status === 401 || status === 403) return new AuthError('auth', MESSAGES.auth, options);
    if (status >= 500) return new AuthError('server', MESSAGES.server, options);
    return new AuthError('response', MESSAGES.response, options);
  }

  async function request(path, { method = 'GET', body, token, prefer, query = '' } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const headers = { apikey: key, Accept: 'application/json' };
    headers.Authorization = `Bearer ${token || key}`;
    if (body != null) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}${query}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (err?.name === 'AbortError') throw new AuthError('timeout', MESSAGES.timeout);
      throw new AuthError('network', MESSAGES.network, { detail: String(err?.message ?? err) });
    }
    if (timer) clearTimeout(timer);

    const text = typeof res.text === 'function' ? await res.text() : '';
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) throw errorFromResponse(res.status, data);
    return data;
  }

  function readSession() {
    const raw = storage.get(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.accessToken || !parsed?.user?.id) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    try {
      storage.set(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* 저장 실패는 무시 (이번 방문 동안만 유지) */
    }
    return session;
  }

  function clearSession() {
    storage.remove(SESSION_KEY);
    storage.remove(VERIFIER_KEY);
  }

  const client = {
    redirectTo,

    getSession() {
      return readSession();
    },

    /** 로그인 시작: PKCE 준비 → authorize 주소로 이동 (테스트에서는 이동 대신 주소를 돌려준다) */
    async signIn(provider) {
      if (!isProvider(provider)) throw new AuthError('provider', MESSAGES.provider);
      const { verifier, challenge } = await createPkcePair(cryptoImpl);
      storage.set(VERIFIER_KEY, verifier);
      const returnHash = location?.hash || '';
      storage.set(RETURN_KEY, returnHash);
      const url = buildAuthorizeUrl({ baseUrl, provider, redirectTo, codeChallenge: challenge });
      await navigate(url);
      return url;
    },

    /**
     * 콜백 처리. 주소창에 ?code= 가 있으면 토큰으로 교환한다.
     * @returns {Promise<{status:'none'|'ok'|'error', message?:string, session?:object, returnTo?:string}>}
     */
    async handleCallback(search = location?.search ?? '') {
      const { code, error, errorDescription } = readAuthParams(search);
      if (error) {
        storage.remove(VERIFIER_KEY);
        storage.remove(RETURN_KEY);
        return {
          status: 'error',
          message:
            error === 'access_denied'
              ? '로그인을 취소했어요. 다시 시도해 주세요.'
              : `로그인을 마치지 못했어요.${errorDescription ? ` (${errorDescription})` : ''} 다시 시도해 주세요.`,
        };
      }
      if (!code) return { status: 'none' };

      const verifier = storage.get(VERIFIER_KEY);
      if (!verifier) {
        return {
          status: 'error',
          message: '로그인 요청 시간이 지났어요. 다시 로그인해 주세요.',
        };
      }

      try {
        const data = await request('/auth/v1/token?grant_type=pkce', {
          method: 'POST',
          body: { auth_code: code, code_verifier: verifier },
        });
        const session = writeSession(sessionFromTokenResponse(data, now()));
        storage.remove(VERIFIER_KEY);
        return { status: 'ok', session, returnTo: storage.get(RETURN_KEY) || '' };
      } catch (err) {
        storage.remove(VERIFIER_KEY);
        storage.remove(RETURN_KEY);
        return { status: 'error', message: friendlyAuthMessage(err) };
      }
    },

    /** 콜백에서 저장해 둔 원래 화면 해시를 꺼내고 지운다 */
    consumeReturnPath() {
      const value = storage.get(RETURN_KEY) || '';
      storage.remove(RETURN_KEY);
      return value;
    },

    /** 유효한 세션을 보장한다 (만료 임박·만료면 refresh) */
    async ensureSession() {
      const session = readSession();
      if (!session) return null;
      if (!isSessionExpired(session, now())) return session;
      if (!session.refreshToken) {
        clearSession();
        return null;
      }
      try {
        const data = await request('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          body: { refresh_token: session.refreshToken },
        });
        const next = sessionFromTokenResponse({ ...data, user: data?.user ?? session.user }, now());
        next.provider = next.provider || session.provider;
        return writeSession(next);
      } catch {
        clearSession();
        return null;
      }
    },

    async signOut() {
      const session = readSession();
      clearSession();
      if (!session?.accessToken) return;
      try {
        await request('/auth/v1/logout', { method: 'POST', token: session.accessToken });
      } catch {
        /* 서버 로그아웃 실패해도 이 기기에서는 세션을 지운다 */
      }
    },

    /** 내 프로필 한 줄 (없으면 null) */
    async fetchProfile(session) {
      const userId = session?.user?.id;
      if (!userId) throw new AuthError('auth', MESSAGES.auth);
      const query = `?select=user_id,nickname,provider,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}`;
      const rows = await request(`/rest/v1/${profilesTable}`, { token: session.accessToken, query });
      return Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);
    },

    /** 프로필 upsert (처음 로그인하면 자동으로 한 줄 만든다) */
    async saveProfile(session, { nickname, provider }) {
      const userId = session?.user?.id;
      if (!userId) throw new AuthError('auth', MESSAGES.auth);
      const clean = sanitizeNickname(nickname) || nicknameFromUser(session.user);
      if (!isValidNickname(clean)) throw new AuthError('validation', '닉네임은 1~20자로 적어 주세요.');
      const rows = await request(`/rest/v1/${profilesTable}`, {
        method: 'POST',
        token: session.accessToken,
        prefer: 'resolution=merge-duplicates,return=representation',
        body: {
          user_id: userId,
          nickname: clean,
          provider: String(provider ?? ''),
          updated_at: new Date(now()).toISOString(),
        },
      });
      return Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);
    },

    /** 닉네임만 바꾼다 */
    async updateNickname(session, nickname) {
      const userId = session?.user?.id;
      if (!userId) throw new AuthError('auth', MESSAGES.auth);
      const clean = sanitizeNickname(nickname);
      if (!isValidNickname(clean)) throw new AuthError('validation', '닉네임은 1~20자로 적어 주세요.');
      const rows = await request(`/rest/v1/${profilesTable}`, {
        method: 'PATCH',
        token: session.accessToken,
        prefer: 'return=representation',
        query: `?user_id=eq.${encodeURIComponent(userId)}`,
        body: { nickname: clean, updated_at: new Date(now()).toISOString() },
      });
      return Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);
    },
  };

  return client;
}

/** 로그인한 사람의 프로필을 읽고, 없으면 OAuth 이름으로 만들어 둔다 */
export async function ensureProfile(client, session) {
  if (!session?.user?.id) return null;
  const existing = await client.fetchProfile(session);
  if (existing?.nickname) return existing;
  const nickname = nicknameFromUser(session.user);
  const provider = session.provider || session.user?.app_metadata?.provider || '';
  return client.saveProfile(session, { nickname, provider });
}

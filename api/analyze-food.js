// POST /api/analyze-food — 사진 한 장을 Gemini Vision에 보내
// 영양성분을 읽어 JSON으로 돌려주는 Vercel 서버리스 함수.
//
// - 외부 npm 패키지 없이 내장 fetch만 쓴다.
// - 키는 환경변수 GEMINI_API_KEY (Vercel 프로젝트 Production/Preview 환경변수).
// - 모델은 GEMINI_MODEL(기본 gemini-3.8-flash).
// - 케이스 A(뒷면 성분표) / 케이스 B(앞면 제품 조회) 모두 처리.
//   Google Search grounding은 Gemini 무료 등급에서 쓸 수 없어서 기본은 끄고,
//   GEMINI_SEARCH_GROUNDING=1일 때만 켠다(거절되면 자동으로 끄고 다시 시도).

import {
  GEMINI_MODEL,
  MAX_IMAGE_MB,
  buildGeminiRequest,
  clientIp,
  createRateLimiter,
  geminiUrl,
  parseAiOutput,
  parseGeminiResponse,
  readJsonBody,
  validateAnalyzeRequest,
} from '../lib/analyze-food-core.js';

const REQUEST_TIMEOUT_MS = 55_000;
const MODEL = String(process.env.GEMINI_MODEL || GEMINI_MODEL).trim();
const searchEnabled = () => String(process.env.GEMINI_SEARCH_GROUNDING || '').trim() === '1';
const JSON_ONLY =
  '이전 답이 JSON이 아니었습니다. 이번에는 설명 없이 {"mode":...} 로 시작하는 JSON 객체 하나만 출력하세요.';

// 무료 등급에서 grounding을 거절하면 이 인스턴스에서는 다시 시도하지 않는다.
let groundingBlocked = false;

const limiter = createRateLimiter({ perMinute: 8, perDay: 60 });

function send(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

function sendError(res, status, error, message, extraHeaders, extra = {}) {
  send(res, status, { ok: false, error, message, ...extra }, extraHeaders);
}

/** Gemini 오류 응답을 사용자에게 보여 줄 한국어로 바꾼다. */
function mapUpstreamError(status) {
  if (status === 429) {
    return {
      status: 429,
      error: 'upstream_quota',
      message:
        '지금은 AI 사진 인식을 쓸 수 없어요(요청 한도). 잠시 뒤 다시 시도하거나 아래에 직접 적어 주세요.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 503,
      error: 'ai_unavailable',
      message: 'AI 사진 인식을 지금 쓸 수 없어요(서버 설정 확인 필요). 아래에 직접 적어 카드를 만들 수 있어요.',
    };
  }
  if (status === 400 || status === 404) {
    return {
      status: 502,
      error: 'upstream_rejected',
      message: 'AI가 사진을 읽지 못했어요. 사진을 다시 찍거나 아래에 직접 적어 주세요.',
    };
  }
  return {
    status: 502,
    error: 'upstream_error',
    message: 'AI 쪽 문제로 읽지 못했어요. 잠시 뒤 다시 시도하거나 아래에 직접 적어 주세요.',
  };
}

function upstreamDetail(payload) {
  return String(payload?.error?.message || '').slice(0, 300);
}

/** grounding을 못 쓰는 상황(무료 등급 429/도구 거절)인지 */
function isGroundingRefusal(status, message) {
  if (status === 429) return true;
  return status === 400 && /grounding|google_search|tool/i.test(message);
}

async function generate(apiKey, image, { search, extra = '', json, thinking, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(geminiUrl(MODEL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiRequest(image, extra, { search, json, thinking })),
      signal: controller.signal,
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return { status: res.status, payload, raw: text, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** 사진 한 장 → 결과. grounding 거절·JSON 실패를 각각 한 번씩만 되짚는다. */
async function analyze(apiKey, image, opts = {}) {
  const wantSearch = searchEnabled() && !groundingBlocked;
  let gen = await generate(apiKey, image, { ...opts, search: opts.search ?? wantSearch });

  if (gen.status !== 200 && wantSearch && isGroundingRefusal(gen.status, upstreamDetail(gen.payload))) {
    groundingBlocked = true;
    console.warn('[analyze-food] search grounding refused, retry without tools:', gen.status, upstreamDetail(gen.payload));
    gen = await generate(apiKey, image, { ...opts, search: false });
  }

  if (gen.status !== 200) {
    console.warn('[analyze-food] gemini', gen.status, (gen.raw || '').slice(0, 500));
    return {
      ok: false,
      ...mapUpstreamError(gen.status),
      upstream: { status: gen.status, message: upstreamDetail(gen.payload), ms: gen.ms },
    };
  }

  let parsed = parseGeminiResponse(gen.payload);
  let result = parseAiOutput(parsed.text);

  if (!result) {
    const again = await generate(apiKey, image, {
      ...opts,
      search: opts.search ?? (searchEnabled() && !groundingBlocked),
      extra: JSON_ONLY,
    });
    if (again.status === 200) {
      const retried = parseGeminiResponse(again.payload);
      result = parseAiOutput(retried.text);
      if (result) {
        parsed = retried;
      } else {
        parsed = { ...retried, text: retried.text || parsed.text, blocked: retried.blocked || parsed.blocked };
      }
    } else {
      console.warn('[analyze-food] retry failed', again.status, (again.raw || '').slice(0, 300));
    }
  }

  if (result) return { ok: true, result, sources: parsed.sources, debug: { ms: gen.ms, status: gen.status } };

  console.warn('[analyze-food] unparsable output', { blocked: parsed.blocked, text: String(parsed.text).slice(0, 300) });
  if (parsed.blocked) {
    return {
      ok: false,
      status: 422,
      error: 'blocked',
      message: '이 사진은 AI가 읽을 수 없었어요. 다른 사진으로 다시 시도하거나 아래에 직접 적어 주세요.',
    };
  }
  return {
    ok: false,
    status: 502,
    error: 'bad_model_output',
    message: 'AI가 성분을 정리하지 못했어요. 사진을 다시 찍거나 아래에 직접 적어 주세요.',
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed', 'POST로만 사진을 보낼 수 있어요.');
    return;
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    sendError(
      res,
      503,
      'missing_api_key',
      'AI 사진 인식이 아직 설정되지 않았어요(서버 키 없음). 아래에 직접 적으면 카드를 만들 수 있어요.',
    );
    return;
  }

  const ip = clientIp(req.headers || {});
  const limit = limiter.check(ip);
  if (!limit.ok) {
    sendError(
      res,
      429,
      'rate_limited',
      limit.reason === 'day'
        ? '오늘 사진 인식 횟수를 다 썼어요. 내일 다시 시도하거나 아래에 직접 적어 주세요.'
        : `잠깐 요청이 많았어요. ${limit.retryAfter}초 뒤에 다시 시도해 주세요.`,
      { 'Retry-After': String(limit.retryAfter) },
    );
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    console.warn('[analyze-food] body read failed', err?.message);
    body = null;
  }
  if (body == null) {
    sendError(res, 400, 'invalid_json', '사진 데이터를 읽지 못했어요. 다시 시도해 주세요.');
    return;
  }

  const checked = validateAnalyzeRequest(body);
  if (!checked.ok) {
    sendError(res, checked.status, checked.error, checked.message);
    return;
  }

  // 진단용 스위치 (?debug=1 과 함께 쓸 때만 동작). 원인을 좁힌 뒤 지운다.
  const url = String(req.url || '');
  const flag = (k) => new RegExp(`[?&]${k}=1\\b`).test(url) && /[?&]debug=1\b/.test(url);
  const opts = {};
  if (flag('nojson')) opts.json = false;
  if (flag('nothink')) opts.thinking = null;
  if (flag('tools')) opts.search = true;
  const timeoutParam = /[?&]timeout=(\d{1,5})\b/.exec(url);
  if (timeoutParam) opts.timeoutMs = Math.min(55_000, Math.max(3000, Number(timeoutParam[1])));

  let out;
  try {
    out = await analyze(apiKey, checked, opts);
  } catch (err) {
    if (err?.name === 'AbortError') {
      sendError(
        res,
        504,
        'upstream_timeout',
        'AI 응답이 너무 늦어요. 잠시 뒤 다시 시도하거나 아래에 직접 적어 주세요.',
      );
      return;
    }
    console.error('[analyze-food] failed', err?.message || err);
    sendError(res, 502, 'network_error', 'AI에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    return;
  }

  if (!out.ok) {
    // 원인 확인용: ?debug=1일 때만 Gemini가 준 오류 문장을 함께 돌려준다(키는 포함되지 않는다).
    const debug = /[?&]debug=1\b/.test(String(req.url || ''));
    const extra = out.upstream
      ? {
          upstreamStatus: out.upstream.status,
          ...(debug ? { upstreamMessage: out.upstream.message, upstreamMs: out.upstream.ms } : {}),
        }
      : {};
    sendError(res, out.status, out.error, out.message, undefined, extra);
    return;
  }

  send(res, 200, {
    ok: true,
    ...out.result,
    sources: out.sources,
    maxImageMb: MAX_IMAGE_MB,
    ...(/[?&]debug=1\b/.test(String(req.url || '')) ? { debug: out.debug } : {}),
  });
}

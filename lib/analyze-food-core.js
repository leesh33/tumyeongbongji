// 성분표·제품 앞면 사진 → 영양성분 JSON (Gemini Vision 호출부의 순수 로직).
//
// 여기에는 DOM·네트워크가 없다. 요청 검증, 프롬프트, Gemini 응답 파싱, 값 정규화,
// IP 요청 제한만 두고 `api/analyze-food.js`가 fetch로 Gemini를 부른다.
// 같은 모듈을 노드 테스트와 서버리스 함수가 같이 쓴다.

/* ── 한도 ───────────────────────────────────────────────
   Vercel 서버리스 함수의 요청 본문 한도가 4.5MB라서, base64로 부풀기 전 원본을
   3MB로 잡는다(3MB → base64 약 4.0MB + JSON 머리말). 화면에서는 1280px JPEG로
   줄여 보내므로 실제로는 0.2~0.6MB다. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_MB = Math.round((MAX_IMAGE_BYTES / (1024 * 1024)) * 10) / 10;
export const MIN_BASE64_CHARS = 64;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const CATEGORY_KEYS = ['snack', 'drink', 'noodle', 'kids'];

/* 케이스 B(앞면 제품 조회)는 공식 표기와 다를 수 있으니 note에 출처를 남기게 한다. */
export const PROMPT = `너는 한국 과자·음료·라면·키즈 간식의 영양성분을 읽어 주는 도우미다.
사진 한 장이 주어진다. 사진 종류에 따라 둘 중 하나로 답한다.

[케이스 A] 사진이 영양성분표(영양정보) 뒷면이면:
- 인쇄된 값을 그대로 읽는다. 보이지 않는 값은 추측하지 말고 null로 둔다.
- mode는 "label", estimated는 false.
- servingG에는 "총 내용량"을 쓴다. 총 내용량이 없고 1회 제공량만 있으면 1회 제공량을 쓰고 note에 그 사실을 적는다.
- 영양값은 servingG와 같은 기준으로 맞춘다(총 내용량 기준). 1회 제공량 기준 표기만 있으면 총 내용량으로 환산한다.
- 원재료명이 인쇄되어 있으면 ingredients에 쉼표로 나눠 담는다.

[케이스 B] 사진이 앞면 포장지나 제품명(예: "파파 ZOOS 배도라지" 100ml 45kcal)이면:
- 제품명은 포장에 인쇄된 글자를 그대로 옮긴다. 영문·숫자도 그대로 쓴다("ZOOS"를 "주스"로 바꾸지 않는다).
- 브랜드·용량도 포장에서 읽는다. 용량이 인쇄되어 있으면 그 값을 쓴다.
- 영양성분은 확실히 아는 공식 표기만 채운다. 확실하지 않은 값은 지어내지 말고 null로 둔다.
- mode는 "product_lookup". 공식 포장 표기가 확인되면 estimated는 false, 검색 결과나 일반적 수치로 채웠으면 true.
- note에는 어디서 가져왔는지(예: "제조사 공식 표기", "AI가 아는 정보 · 포장 확인 필요", "확인 못 함")를 60자 이내 한국어로 적는다.
- 제품을 알아보지 못하면 name만 채우고 나머지는 null, note에 "제품을 확인하지 못했어요"라고 적는다.

[공통 규칙]
- category는 "snack"(과자), "drink"(음료), "noodle"(라면·간편식), "kids"(아기·키즈) 중 하나. 모르면 null.
- 숫자 칸은 단위를 빼고 숫자만 넣는다. 예: 100mg → 100, 4.6g → 4.6, 45kcal → 45.
- servingG는 g 또는 ml 단위의 용량 숫자(100ml → 100), unit은 "g" 또는 "ml".
- ingredients는 원재료 이름만 담은 문자열 배열(최대 12개). 포장에 보이는 원재료를 먼저 담고,
  보이지 않으면 확실히 아는 공식 원재료만 담는다. 추측해서 넣지 말고 모르면 [].
- name은 40자 이내, brand는 20자 이내.
- 설명이나 인사말 없이 아래 형식의 JSON 객체 하나만 출력한다. 코드블록 표시(\`\`\`)도 쓰지 않는다.

{"mode":"label|product_lookup","estimated":true|false,"name":"문자열|null","brand":"문자열|null","category":"snack|drink|noodle|kids|null","servingG":숫자|null,"unit":"g|ml|null","kcal":숫자|null,"sodiumMg":숫자|null,"sugarG":숫자|null,"fatG":숫자|null,"carbsG":숫자|null,"proteinG":숫자|null,"ingredients":["문자열"],"note":"문자열"}`;

/* ── 데이터 URL·base64 ───────────────────────────────── */

/** data URL이면 mimeType과 base64 본문을 나눈다. */
export function splitDataUrl(value) {
  if (typeof value !== 'string') return { mimeType: '', base64: '' };
  const m = /^data:([\w.+\/-]+)?(?:;[\w=.+-]+)*;base64,/i.exec(value.trim());
  if (!m) return { mimeType: '', base64: value.trim() };
  return { mimeType: (m[1] || '').toLowerCase(), base64: value.trim().slice(m[0].length) };
}

/** base64 문자열이 담고 있는 원본 바이트 수(패딩 반영). */
export function base64Bytes(value) {
  const s = String(value ?? '').replace(/\s+/g, '');
  if (!s) return 0;
  const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

/** 파일 앞머리로 실제 형식을 본다(브라우저가 mimeType을 흘릴 때 대비). */
export function sniffMime(base64) {
  const s = String(base64 ?? '').slice(0, 24);
  if (s.startsWith('/9j/')) return 'image/jpeg';
  if (s.startsWith('iVBOR')) return 'image/png';
  if (s.startsWith('UklGR')) return 'image/webp';
  if (/^AAAA(?:[A-Za-z0-9+/]{4})?(?:[A-Za-z0-9+/])*(?:F|G|I|M)/.test(s)) return 'image/heic';
  return '';
}

/**
 * POST /api/analyze-food 바디 검증.
 * @returns {{ok:true, imageBase64:string, mimeType:string, bytes:number}
 *   | {ok:false, status:number, error:string, message:string}}
 */
export function validateAnalyzeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'invalid_request', '사진 데이터를 찾지 못했어요. 사진을 다시 올려 주세요.');
  }

  const raw = body.imageBase64 ?? body.image ?? body.dataUrl;
  if (typeof raw !== 'string' || !raw.trim()) {
    return fail(400, 'missing_image', '사진 데이터가 비어 있어요. 사진을 다시 올려 주세요.');
  }

  const split = splitDataUrl(raw);
  const base64 = split.base64.replace(/\s+/g, '');
  if (!base64) {
    return fail(400, 'missing_image', '사진 데이터가 비어 있어요. 사진을 다시 올려 주세요.');
  }
  if (base64.length < MIN_BASE64_CHARS) {
    return fail(400, 'invalid_base64', '사진이 너무 작아서 읽을 수 없어요. 다시 찍어 올려 주세요.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return fail(400, 'invalid_base64', '사진 형식이 올바르지 않아요. 다시 찍어 올려 주세요.');
  }

  const declared = normalizeMime(body.mimeType) || split.mimeType;
  const sniffed = sniffMime(base64);
  const mimeType = ALLOWED_MIME.includes(declared) ? declared : sniffed;
  if (!mimeType) {
    return fail(400, 'unsupported_type', 'JPG·PNG·WEBP 사진만 읽을 수 있어요. 사진을 다시 올려 주세요.');
  }

  const bytes = base64Bytes(base64);
  if (bytes > MAX_IMAGE_BYTES) {
    return fail(
      413,
      'image_too_large',
      `사진이 너무 커요(${Math.round(bytes / 1024)}KB). ${MAX_IMAGE_MB}MB 이하로 다시 올려 주세요.`,
    );
  }

  return { ok: true, imageBase64: base64, mimeType, bytes };
}

function fail(status, error, message) {
  return { ok: false, status, error, message };
}

export function normalizeMime(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return '';
  const base = v.split(';')[0].trim();
  return base === 'image/jpg' ? 'image/jpeg' : base;
}

/* ── Gemini 요청 ─────────────────────────────────────── */

// 2026-11-28 실측: gemini-2.5-flash는 신규 키에 404("no longer available to new users"),
// gemini-3.8-flash·3.7-flash는 무료 등급에서 503(high demand)이나 응답 없이 매달리는 일이 잦았고,
// gemini-3.5-flash는 같은 사진을 1~3초에 정확히 읽었다. 모델은 GEMINI_MODEL로 바꿀 수 있다.
export const GEMINI_MODEL = 'gemini-3.5-flash';
export function geminiUrl(model = GEMINI_MODEL) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
export const GEMINI_URL = geminiUrl();

/**
 * Gemini REST 요청 본문.
 * responseMimeType:"application/json"은 도구와 함께 쓸 수 없어서 쓰지 않고,
 * JSON은 프롬프트로 강제한 뒤 코드에서 뽑아낸다.
 */
export function buildGeminiRequest(
  { imageBase64, mimeType },
  extraInstruction = '',
  { search = true, json = !search, thinking = 'low' } = {},
) {
  const text = extraInstruction ? `${PROMPT}\n\n${extraInstruction}` : PROMPT;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text }],
      },
    ],
    // Gemini 3.8 Flash는 기본 thinking이 medium이라 사진 한 장에도 오래 걸린다.
    // 사용자가 기다리는 화면이라 low로 낮춘다(온도 같은 샘플링 값은 Gemini 3에서 무시된다).
    generationConfig: { maxOutputTokens: 1024 },
  };
  // Google Search grounding은 Gemini 무료 등급에서 제공되지 않는다(429 RESOURCE_EXHAUSTED).
  // 그래서 기본은 끄고, 유료 등급이면 GEMINI_SEARCH_GROUNDING=1로 켠다.
  // 도구를 쓰지 않을 때만 JSON 모드를 켤 수 있다(도구와 구조화 출력은 함께 못 씀).
  if (thinking) body.generationConfig.thinkingConfig = { thinkingLevel: thinking };
  if (search) body.tools = [{ google_search: {} }];
  else if (json) body.generationConfig.responseMimeType = 'application/json';
  return body;
}

/* ── Gemini 응답 파싱 ───────────────────────────────── */

/** candidates[0]의 텍스트와 grounding 출처(있으면)를 꺼낸다. */
export function parseGeminiResponse(payload) {
  if (!payload || typeof payload !== 'object') return { text: '', sources: [], blocked: '' };
  const blocked = payload.promptFeedback?.blockReason || '';
  const cand = Array.isArray(payload.candidates) ? payload.candidates[0] : null;
  const parts = cand?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  const seen = new Set();
  const sources = [];
  const chunks = cand?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const c of chunks) {
      const label = String(c?.web?.title || c?.web?.uri || '').trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      sources.push(label.slice(0, 80));
      if (sources.length >= 3) break;
    }
  }
  return { text, sources, blocked: String(blocked) };
}

/** 모델이 JSON 앞뒤에 말을 붙이거나 코드펜스를 쓴 경우를 견딘다. */
export function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();

  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(t);
  if (fence && fence[1].trim()) t = fence[1].trim();

  const start = t.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = t.slice(start, end >= 0 ? end + 1 : t.length);
  return parseJsonLoose(slice);
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* 흔한 손상만 고쳐 한 번 더 */
  }
  const repaired = text
    .replace(/,\s*([}\]])/g, '$1') // 끝 쉼표
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":'); // 키 따옴표 누락
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/* ── 값 정규화 ───────────────────────────────────────── */

const ALIASES = {
  mode: ['mode', 'type'],
  estimated: ['estimated', 'isEstimated', 'is_estimated'],
  name: ['name', 'productName', 'product_name', 'title'],
  brand: ['brand', 'brandName', 'brand_name', 'manufacturer', 'maker', 'company'],
  category: ['category', 'type_name', 'kind'],
  servingG: ['servingG', 'serving_g', 'servingSize', 'serving_size', 'contentAmount', 'volume', 'weight', 'netWeight'],
  unit: ['unit', 'unitName', 'servingUnit'],
  kcal: ['kcal', 'calories', 'calorie', 'energyKcal', 'energy'],
  sodiumMg: ['sodiumMg', 'sodium_mg', 'sodium'],
  sugarG: ['sugarG', 'sugar_g', 'sugar', 'sugars', 'totalSugar'],
  fatG: ['fatG', 'fat_g', 'fat', 'totalFat'],
  carbsG: ['carbsG', 'carbs_g', 'carbs', 'carbohydrate', 'carbohydrates', 'totalCarbohydrate'],
  proteinG: ['proteinG', 'protein_g', 'protein'],
  ingredients: ['ingredients', 'ingredientList', 'rawMaterials'],
  note: ['note', 'notes', 'source', 'comment'],
};

function pick(raw, field) {
  for (const key of ALIASES[field] ?? [field]) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key];
  }
  return undefined;
}

/** "45kcal", "100 mg", "4,6g", "1,200" 같은 표기를 숫자로. */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  // 천 단위 쉼표만 지우고, 소수점 쉼표("4,6")는 점으로 바꾼다.
  const cleaned = value
    .replace(/\s+/g, '')
    .replace(/(\d),(?=\d{3}(\D|$))/g, '$1')
    .replace(',', '.');
  const m = /-?\d+(?:\.\d+)?/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max, digits = 1) {
  if (value == null) return null;
  if (value < min) return null;
  const bounded = Math.min(value, max);
  const f = 10 ** digits;
  return Math.round(bounded * f) / f;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const t = value.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeCategory(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (CATEGORY_KEYS.includes(v)) return v;
  if (['ramen', 'noodle', 'noodles', 'ramyeon', '라면', '간편식'].includes(v)) return 'noodle';
  if (['과자', '스낵', 'snack', 'cookie', 'cookies', 'chips', 'cracker'].includes(v)) return 'snack';
  if (['음료', '주스', 'drink', 'beverage', 'juice'].includes(v)) return 'drink';
  if (['키즈', 'kids', 'baby', '아기', '유아'].includes(v)) return 'kids';
  return null;
}

export function normalizeIngredients(value) {
  let list = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(/[,·\n]/);
  const out = [];
  for (const item of list) {
    const name = cleanText(typeof item === 'string' ? item : String(item?.name ?? ''), 40)
      .replace(/^[-•\s]+/, '')
      .replace(/[.。]$/, '');
    if (!name) continue;
    if (out.includes(name)) continue;
    out.push(name);
    if (out.length >= 12) break;
  }
  return out;
}

const RANGES = {
  servingG: [0.1, 5000, 1],
  kcal: [0, 5000, 0],
  sodiumMg: [0, 30000, 0],
  sugarG: [0, 1000, 1],
  fatG: [0, 1000, 1],
  carbsG: [0, 1000, 1],
  proteinG: [0, 1000, 1],
};

/**
 * 모델 JSON → 앱이 쓰는 결과 형태. 단위·범위를 정리하고, 쓸 만한 값이 없으면 null.
 * @returns {null | {mode:'label'|'product_lookup', estimated:boolean, name:string,
 *   brand:string, category:string|null, servingG:number|null, unit:'g'|'ml'|null,
 *   kcal:number|null, sodiumMg:number|null, sugarG:number|null, fatG:number|null,
 *   carbsG:number|null, proteinG:number|null, ingredients:string[], note:string}}
 */
export function normalizeAiResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const mode = String(pick(raw, 'mode') ?? '').toLowerCase() === 'product_lookup' ? 'product_lookup' : 'label';
  const estimatedRaw = pick(raw, 'estimated');
  const estimated =
    estimatedRaw === true || String(estimatedRaw).toLowerCase() === 'true'
      ? true
      : estimatedRaw === false || String(estimatedRaw).toLowerCase() === 'false'
        ? false
        : mode === 'product_lookup';

  const result = {
    mode,
    estimated,
    name: cleanText(pick(raw, 'name'), 40),
    brand: cleanText(pick(raw, 'brand'), 20),
    category: normalizeCategory(pick(raw, 'category')),
    servingG: null,
    unit: null,
    kcal: null,
    sodiumMg: null,
    sugarG: null,
    fatG: null,
    carbsG: null,
    proteinG: null,
    ingredients: normalizeIngredients(pick(raw, 'ingredients')),
    note: cleanText(pick(raw, 'note'), 120),
  };

  for (const [key, [min, max, digits]] of Object.entries(RANGES)) {
    result[key] = clamp(toNumber(pick(raw, key)), min, max, digits);
  }

  const unitRaw = String(pick(raw, 'unit') ?? '').toLowerCase();
  if (unitRaw.includes('ml')) result.unit = 'ml';
  else if (unitRaw.includes('g')) result.unit = 'g';
  else {
    // unit을 빼고 "100ml"처럼 용량 칸에 단위를 붙여 준 경우
    const serving = pick(raw, 'servingG');
    if (typeof serving === 'string') {
      if (/\d\s*(ml|mL|ML)\b/.test(serving)) result.unit = 'ml';
      else if (/\d\s*(g|G|그램|mg)\b/.test(serving)) result.unit = 'g';
    }
  }

  const numeric = ['servingG', 'kcal', 'sodiumMg', 'sugarG', 'fatG', 'carbsG', 'proteinG'].some(
    (k) => result[k] != null,
  );
  if (!result.name && !numeric) return null;
  return result;
}

/** 모델 텍스트 → 결과. JSON이 아니면 null. */
export function parseAiOutput(text) {
  const json = extractJson(text);
  return normalizeAiResult(json);
}

/* ── IP별 요청 제한 (메모리 Map, best-effort) ────────────
   서버리스 인스턴스마다 따로 세므로 정확한 차단이 아니라 과도한 호출을 줄이는 용도다. */
export function createRateLimiter({ perMinute = 8, perDay = 60, minuteMs = 60_000, dayMs = 86_400_000 } = {}) {
  const hits = new Map();

  return {
    /** @returns {{ok:true, remainingMinute:number} | {ok:false, reason:'minute'|'day', retryAfter:number}} */
    check(key, now = Date.now()) {
      const id = String(key || 'unknown');
      let entry = hits.get(id);

      if (!entry || now - entry.dayStart >= dayMs) {
        entry = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0 };
      } else if (now - entry.minuteStart >= minuteMs) {
        entry.minuteStart = now;
        entry.minuteCount = 0;
      }

      if (entry.dayCount >= perDay) {
        hits.set(id, entry);
        return { ok: false, reason: 'day', retryAfter: Math.max(1, Math.ceil((entry.dayStart + dayMs - now) / 1000)) };
      }
      if (entry.minuteCount >= perMinute) {
        hits.set(id, entry);
        return {
          ok: false,
          reason: 'minute',
          retryAfter: Math.max(1, Math.ceil((entry.minuteStart + minuteMs - now) / 1000)),
        };
      }

      entry.minuteCount++;
      entry.dayCount++;
      hits.set(id, entry);
      if (hits.size > 400) sweep(hits, now, dayMs);
      return { ok: true, remainingMinute: perMinute - entry.minuteCount };
    },
    size() {
      return hits.size;
    },
  };
}

function sweep(hits, now, dayMs) {
  for (const [key, entry] of hits) {
    if (now - entry.dayStart >= dayMs) hits.delete(key);
  }
}

/* ── 요청 본문 읽기 ───────────────────────────────────── */

/** Vercel은 JSON 바디를 req.body에 넣어 준다. 문자열·스트림으로 올 때도 받는다. */
export async function readJsonBody(req, { maxBytes = 6 * 1024 * 1024 } = {}) {
  const body = req?.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return parseJsonText(body);
  if (Buffer.isBuffer(body)) return parseJsonText(body.toString('utf8'));
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return null;

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) return null;
    chunks.push(buf);
  }
  return parseJsonText(Buffer.concat(chunks).toString('utf8'));
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** x-forwarded-for에서 첫 IP. 로컬 개발이면 'local'. */
export function clientIp(headers = {}) {
  const raw = headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? '';
  const first = String(raw).split(',')[0].trim();
  return first || 'local';
}

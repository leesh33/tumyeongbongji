import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  base64Bytes,
  buildGeminiRequest,
  clientIp,
  createRateLimiter,
  extractJson,
  normalizeAiResult,
  parseAiOutput,
  parseGeminiResponse,
  readJsonBody,
  sniffMime,
  splitDataUrl,
  toNumber,
  validateAnalyzeRequest,
} from '../lib/analyze-food-core.js';
import handler from '../api/analyze-food.js';

// 1×1 투명 PNG
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPEG_HEAD = '/9j/4AAQSkZJRgABAQAAAQABAAD';

function geminiReply(text, sources = []) {
  return {
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
        groundingMetadata: sources.length
          ? { groundingChunks: sources.map((title) => ({ web: { title, uri: `https://example.com/${title}` } })) }
          : undefined,
        finishReason: 'STOP',
      },
    ],
  };
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    bodyText: '',
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(chunk) {
      this.bodyText = chunk ? String(chunk) : '';
    },
    get json() {
      return this.bodyText ? JSON.parse(this.bodyText) : null;
    },
  };
}

function req({ method = 'POST', body, ip = '1.1.1.1' } = {}) {
  return { method, body, headers: { 'x-forwarded-for': ip } };
}

function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = real;
    });
}

/* ── 요청 검증 ───────────────────────────────────── */

test('data URL에서 mimeType과 base64를 나눈다', () => {
  const r = splitDataUrl(`data:image/jpeg;base64,${PNG}`);
  assert.equal(r.mimeType, 'image/jpeg');
  assert.equal(r.base64, PNG);
  assert.deepEqual(splitDataUrl(PNG), { mimeType: '', base64: PNG });
});

test('base64 원본 바이트 수에 패딩을 반영한다', () => {
  assert.equal(base64Bytes('aGVsbG8='), 5);
  assert.equal(base64Bytes('aGVsbG8h'), 6);
  assert.equal(base64Bytes(''), 0);
});

test('파일 앞머리로 사진 형식을 알아낸다', () => {
  assert.equal(sniffMime(PNG), 'image/png');
  assert.equal(sniffMime(JPEG_HEAD), 'image/jpeg');
  assert.equal(sniffMime('UklGRiQAAABXRUJQVlA4'), 'image/webp');
  assert.equal(sniffMime('hello'), '');
});

test('사진이 없으면 400', () => {
  const r = validateAnalyzeRequest({});
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.error, 'missing_image');
});

test('base64가 아닌 글자는 400', () => {
  const r = validateAnalyzeRequest({ imageBase64: '<svg>not an image</svg>'.repeat(10) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'invalid_base64');
});

test('알아볼 수 없는 형식은 400 unsupported_type', () => {
  const r = validateAnalyzeRequest({ imageBase64: 'abcdef'.repeat(20), mimeType: 'application/pdf' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'unsupported_type');
});

test('한도(3MB)를 넘는 사진은 413', () => {
  const big = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1000) / 3) * 4);
  const r = validateAnalyzeRequest({ imageBase64: big, mimeType: 'image/jpeg' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.error, 'image_too_large');
});

test('정상 사진은 base64와 mimeType을 돌려준다', () => {
  const r = validateAnalyzeRequest({ imageBase64: `data:image/png;base64,${PNG}`, mimeType: 'image/png' });
  assert.equal(r.ok, true);
  assert.equal(r.base64 || r.imageBase64, PNG);
  assert.equal(r.mimeType, 'image/png');
  assert.ok(r.bytes > 0);
});

/* ── Gemini 요청 ─────────────────────────────────── */

test('Gemini 요청에 사진과 JSON 지시가 들어간다', () => {
  const body = buildGeminiRequest({ imageBase64: PNG, mimeType: 'image/png' });
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.equal(body.contents[0].parts[0].inlineData.data, PNG);
  assert.deepEqual(body.tools, [{ google_search: {} }], '요청했을 때는 grounding 도구를 넣는다');
  const prompt = body.contents[0].parts[1].text;
  assert.match(prompt, /케이스 A/);
  assert.match(prompt, /케이스 B/);
  assert.match(prompt, /product_lookup/);
  // 구조화 출력은 도구와 함께 못 쓰므로 responseMimeType은 보내지 않는다.
  assert.equal(body.generationConfig.responseMimeType, undefined);
});

test('search:false면 도구 없이 보낸다(무료 등급 기본)', () => {
  const body = buildGeminiRequest({ imageBase64: PNG, mimeType: 'image/png' }, '', { search: false });
  assert.equal(body.tools, undefined);
});

/* ── 응답 파싱 ───────────────────────────────────── */

test('코드펜스에 싸인 JSON을 읽는다', () => {
  const json = extractJson('```json\n{"name":"파파 ZOOS 배도라지","kcal":45}\n```');
  assert.deepEqual(json, { name: '파파 ZOOS 배도라지', kcal: 45 });
});

test('앞뒤 설명이 붙어도 JSON 객체만 뽑는다', () => {
  const json = extractJson('네, 사진을 읽었습니다.\n{"mode":"label","sodiumMg":100}\n더 필요한 게 있으면 말씀하세요.');
  assert.deepEqual(json, { mode: 'label', sodiumMg: 100 });
});

test('끝 쉼표가 있어도 읽는다', () => {
  assert.deepEqual(extractJson('{"kcal": 45, "sugarG": 8,}'), { kcal: 45, sugarG: 8 });
});

test('JSON이 없으면 null', () => {
  assert.equal(extractJson('사진에서 성분표를 찾지 못했습니다.'), null);
  assert.equal(extractJson(''), null);
});

test('숫자 표기를 숫자로 바꾼다', () => {
  assert.equal(toNumber('45kcal'), 45);
  assert.equal(toNumber('100 mg'), 100);
  assert.equal(toNumber('4,6g'), 4.6);
  assert.equal(toNumber('1,200'), 1200);
  assert.equal(toNumber(0), 0);
  assert.equal(toNumber('모름'), null);
});

test('제품 조회 결과의 별칭 키와 범위를 정리한다', () => {
  const r = normalizeAiResult({
    mode: 'product_lookup',
    product_name: '파파 ZOOS 배도라지',
    manufacturer: '일동후디스',
    category: '주스',
    volume: '100ml',
    energy: '45 kcal',
    sodium: '5mg',
    sugar: '8g',
    totalFat: '0g',
    ingredients: '배즙, 도라지, 배추',
    source: '제조사 표기',
  });
  assert.equal(r.name, '파파 ZOOS 배도라지');
  assert.equal(r.brand, '일동후디스');
  assert.equal(r.mode, 'product_lookup');
  assert.equal(r.estimated, true, 'mode가 product_lookup이면 estimated 기본값은 true');
  assert.equal(r.category, 'drink');
  assert.equal(r.servingG, 100);
  assert.equal(r.unit, 'ml');
  assert.equal(r.kcal, 45);
  assert.equal(r.sodiumMg, 5);
  assert.equal(r.sugarG, 8);
  assert.equal(r.fatG, 0);
  assert.deepEqual(r.ingredients, ['배즙', '도라지', '배추']);
  assert.equal(r.note, '제조사 표기');
});

test('라면 계열 카테고리는 앱 키인 noodle로 바꾼다', () => {
  assert.equal(normalizeAiResult({ mode: 'label', category: 'ramen', kcal: 500 }).category, 'noodle');
  assert.equal(normalizeAiResult({ mode: 'label', category: 'snack', kcal: 100 }).category, 'snack');
  assert.equal(normalizeAiResult({ mode: 'label', category: '과자', kcal: 100 }).category, 'snack');
  assert.equal(normalizeAiResult({ mode: 'label', category: '이상함', kcal: 100 }).category, null);
});

test('범위를 벗어난 값은 버리고, 읽은 값이 없으면 null', () => {
  const r = normalizeAiResult({ mode: 'label', kcal: 99999, sodiumMg: -5, servingG: 0 });
  assert.equal(r.kcal, 5000);
  assert.equal(r.sodiumMg, null);
  assert.equal(r.servingG, null);
  assert.equal(normalizeAiResult({ mode: 'label' }), null);
  assert.equal(normalizeAiResult('nope'), null);
});

test('성분표 읽기 결과는 estimated가 false로 남는다', () => {
  const r = parseAiOutput('{"mode":"label","name":"바나나킥","servingG":75,"kcal":355,"sodiumMg":100}');
  assert.equal(r.mode, 'label');
  assert.equal(r.estimated, false);
  assert.equal(r.servingG, 75);
});

test('Gemini 응답에서 텍스트와 출처를 꺼낸다', () => {
  const parsed = parseGeminiResponse(geminiReply('{"kcal":45}', ['일동후디스 공식몰', '쿠팡']));
  assert.equal(parsed.text, '{"kcal":45}');
  assert.deepEqual(parsed.sources, ['일동후디스 공식몰', '쿠팡']);
  assert.equal(parseGeminiResponse(null).text, '');
  assert.equal(parseGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }).blocked, 'SAFETY');
});

/* ── 요청 제한 ───────────────────────────────────── */

test('분당 한도를 넘으면 막고, 1분이 지나면 풀린다', () => {
  const limiter = createRateLimiter({ perMinute: 2, perDay: 10 });
  const t0 = 1_000_000;
  assert.equal(limiter.check('a', t0).ok, true);
  assert.equal(limiter.check('a', t0 + 1000).ok, true);
  const blocked = limiter.check('a', t0 + 2000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'minute');
  assert.ok(blocked.retryAfter > 0);
  assert.equal(limiter.check('a', t0 + 61_000).ok, true);
  assert.equal(limiter.check('b', t0 + 2000).ok, true, '다른 IP는 따로 센다');
});

test('일일 한도를 넘으면 다음 날까지 막는다', () => {
  const limiter = createRateLimiter({ perMinute: 5, perDay: 2 });
  const t0 = 5_000_000;
  assert.equal(limiter.check('a', t0).ok, true);
  assert.equal(limiter.check('a', t0 + 61_000).ok, true);
  const blocked = limiter.check('a', t0 + 122_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'day');
  assert.ok(blocked.retryAfter > 60);
  assert.equal(limiter.check('a', t0 + 86_400_000 + 1).ok, true);
});

/* ── 본문·IP ─────────────────────────────────────── */

test('본문이 객체·문자열·스트림 어느 쪽이어도 읽는다', async () => {
  assert.deepEqual(await readJsonBody({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(await readJsonBody({ body: '{"a":2}' }), { a: 2 });
  async function* stream() {
    yield Buffer.from('{"a":');
    yield Buffer.from('3}');
  }
  assert.deepEqual(await readJsonBody({ [Symbol.asyncIterator]: stream }), { a: 3 });
  assert.equal(await readJsonBody({ body: '{oops' }), null);
  assert.equal(await readJsonBody({}), null);
});

test('x-forwarded-for의 첫 IP를 쓴다', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), '203.0.113.9');
  assert.equal(clientIp({}), 'local');
});

/* ── 핸들러 ─────────────────────────────────────── */

test('OPTIONS는 204로 CORS만 답한다', async () => {
  const res = fakeRes();
  await handler({ method: 'OPTIONS', headers: {} }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-origin'], '*');
});

test('POST가 아니면 405', async () => {
  const res = fakeRes();
  await handler(req({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.json.error, 'method_not_allowed');
});

test('GEMINI_API_KEY가 없으면 503 missing_api_key', async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = fakeRes();
    await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.9' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json.error, 'missing_api_key');
    assert.match(res.json.message, /직접 적/);
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});

test('사진이 비어 있으면 400', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const res = fakeRes();
  await handler(req({ body: {}, ip: '9.9.9.8' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'missing_image');
});

test('성분표 사진이면 값을 채워 200으로 돌려준다', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  let sent = null;
  await withFetch(
    async (url, init) => {
      sent = { url, init };
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify(
            geminiReply(
              '{"mode":"label","estimated":false,"name":"바나나킥","brand":"농심","category":"snack","servingG":75,"unit":"g","kcal":355,"sodiumMg":100,"sugarG":12,"fatG":4.6,"carbsG":66,"proteinG":3.2,"ingredients":["옥수수","설탕"],"note":"포장지 인쇄값"}',
            ),
          ),
      };
    },
    async () => {
      const res = fakeRes();
      await handler(req({ body: { imageBase64: `data:image/png;base64,${PNG}`, mimeType: 'image/png' }, ip: '9.9.9.7' }), res);
      assert.equal(res.statusCode, 200);
      const out = res.json;
      assert.equal(out.ok, true);
      assert.equal(out.name, '바나나킥');
      assert.equal(out.servingG, 75);
      assert.equal(out.sodiumMg, 100);
      assert.equal(out.sugarG, 12);
      assert.equal(out.fatG, 4.6);
      assert.equal(out.estimated, false);
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.match(String(sent.url), /gemini-3\.8-flash:generateContent$/);
      assert.equal(sent.init.headers['x-goog-api-key'], 'test-key');
    },
  );
});

test('앞면 제품 사진은 제품 조회 결과와 출처를 돌려준다', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  let promptText = '';
  await withFetch(
    async (url, init) => {
      promptText = JSON.parse(init.body).contents[0].parts[1].text;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify(
            geminiReply(
              '```json\n{"mode":"product_lookup","name":"파파 ZOOS 배도라지","brand":"일동후디스","category":"drink","servingG":100,"unit":"ml","kcal":45,"sodiumMg":5,"sugarG":8,"fatG":0,"ingredients":["배즙","도라지"],"note":"제조사 공식 표기"}\n```',
              ['일동후디스 공식몰'],
            ),
          ),
      };
    },
    async () => {
      const res = fakeRes();
      await handler(req({ body: { imageBase64: JPEG_HEAD + PNG, mimeType: 'image/jpeg' }, ip: '9.9.9.6' }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.mode, 'product_lookup');
      assert.equal(res.json.estimated, true);
      assert.equal(res.json.servingG, 100);
      assert.equal(res.json.unit, 'ml');
      assert.deepEqual(res.json.sources, ['일동후디스 공식몰']);
      assert.match(promptText, /공식 영양성분/);
    },
  );
});

test('JSON이 아니면 한 번 더 물어보고, 두 번째에 성공하면 200', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      const text = calls === 1 ? '죄송해요, 잘 읽지 못했습니다.' : '{"mode":"label","kcal":45}';
      return { ok: true, status: 200, text: async () => JSON.stringify(geminiReply(text)) };
    },
    async () => {
      const res = fakeRes();
      await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.5' }), res);
      assert.equal(calls, 2);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.kcal, 45);
    },
  );
});

test('두 번 다 JSON이 아니면 502 bad_model_output', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => JSON.stringify(geminiReply('모르겠어요')) }),
    async () => {
      const res = fakeRes();
      await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.4' }), res);
      assert.equal(res.statusCode, 502);
      assert.equal(res.json.error, 'bad_model_output');
    },
  );
});

test('Gemini가 429를 주면 사용자에게 429 upstream_quota로 알린다', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_SEARCH_GROUNDING;
  await withFetch(
    async () => ({ ok: false, status: 429, text: async () => '{"error":{"code":429}}' }),
    async () => {
      const res = fakeRes();
      await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.3' }), res);
      assert.equal(res.statusCode, 429);
      assert.equal(res.json.error, 'upstream_quota');
    },
  );
});

test('grounding을 켰다가 거절되면 도구를 빼고 다시 호출한다', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_SEARCH_GROUNDING = '1';
  const bodies = [];
  try {
    await withFetch(
      async (url, init) => {
        bodies.push(JSON.parse(init.body));
        if (bodies.length === 1) {
          return {
            ok: false,
            status: 429,
            text: async () =>
              '{"error":{"code":429,"message":"You exceeded your current quota"}}',
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify(geminiReply('{"mode":"product_lookup","name":"파파 ZOOS 배도라지","kcal":45}')),
        };
      },
      async () => {
        const res = fakeRes();
        await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.2' }), res);
        assert.equal(res.statusCode, 200, res.bodyText);
        assert.equal(bodies.length, 2);
        assert.ok(bodies[0].tools, '첫 호출은 grounding 포함');
        assert.equal(bodies[1].tools, undefined, '두 번째 호출은 도구 없이');
        assert.equal(res.json.kcal, 45);
      },
    );

    // 한 번 거절되면 이 인스턴스에서는 처음부터 도구 없이 보낸다.
    let calls = 0;
    await withFetch(
      async (url, init) => {
        calls++;
        assert.equal(JSON.parse(init.body).tools, undefined);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(geminiReply('{"mode":"label","kcal":100}')),
        };
      },
      async () => {
        const res = fakeRes();
        await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip: '9.9.9.1' }), res);
        assert.equal(calls, 1);
        assert.equal(res.statusCode, 200);
      },
    );
  } finally {
    delete process.env.GEMINI_SEARCH_GROUNDING;
  }
});

test('IP당 분당 호출을 넘기면 429 rate_limited', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  await withFetch(
    async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(geminiReply('{"mode":"label","kcal":45}')),
    }),
    async () => {
      const ip = '203.0.113.77';
      for (let i = 0; i < 8; i++) {
        const res = fakeRes();
        await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip }), res);
        assert.equal(res.statusCode, 200);
      }
      const res = fakeRes();
      await handler(req({ body: { imageBase64: PNG, mimeType: 'image/png' }, ip }), res);
      assert.equal(res.statusCode, 429);
      assert.equal(res.json.error, 'rate_limited');
    },
  );
});

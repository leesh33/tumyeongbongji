import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FONT_FAMILY,
  FONT_FILES,
  createFontEmbedder,
  fontFaceCss,
  pickFontFile,
  toBase64,
  weightsUsedInSvg,
  withFontFace,
} from '../lib/font-embed.js';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<text font-size="12">바나나킥</text>' +
  '<text x="4" font-weight="700">· 355 kcal</text>' +
  '<text x="4" font-weight="800">나트륨 100mg</text>' +
  '</svg>';

test('카드 SVG가 쓰는 굵기를 모은다(속성 없으면 400, 중복 제거, 오름차순)', () => {
  assert.deepEqual(weightsUsedInSvg(SVG), [400, 700, 800]);
  assert.deepEqual(weightsUsedInSvg('<svg><text font-weight="600">a</text><text font-weight="600">b</text></svg>'), [600]);
  assert.deepEqual(weightsUsedInSvg('<svg></svg>'), [400]);
  assert.deepEqual(weightsUsedInSvg(''), [400]);
});

test('굵기에 맞는 폰트 파일을 고른다', () => {
  assert.equal(pickFontFile(700).file, 'fonts/Paperlogy-7Bold.woff2');
  assert.equal(pickFontFile(500).weight, 500);
  // 없는 굵기는 가장 가까운 파일로
  assert.equal(pickFontFile(900).weight, 800);
  assert.equal(pickFontFile(100).weight, 400);
  assert.equal(pickFontFile(650).weight, 700);
  assert.equal(pickFontFile(700, []), null);
});

test('내보내는 폰트 파일은 화면과 같은 fonts/ 안의 woff2다', () => {
  assert.equal(FONT_FAMILY, 'Paperlogy');
  const weights = FONT_FILES.map((f) => f.weight);
  assert.deepEqual(weights, [400, 500, 600, 700, 800]);
  for (const f of FONT_FILES) {
    assert.ok(f.file.startsWith('fonts/Paperlogy-'), f.file);
    assert.ok(f.file.endsWith('.woff2'), f.file);
  }
});

test('@font-face 문자열은 굵기와 data:base64를 담는다', () => {
  const css = fontFaceCss('AAAA', { weight: 600 });
  assert.ok(css.includes("font-family:'Paperlogy'"), css);
  assert.ok(css.includes('font-weight:600'), css);
  assert.ok(css.includes('data:font/woff2;base64,AAAA'), css);
  assert.ok(css.includes("format('woff2')"), css);
});

test('SVG 여는 태그 뒤에 <style>을 끼워 넣는다', () => {
  const out = withFontFace(SVG, '@font-face{font-family:Paperlogy}');
  assert.ok(out.indexOf('<defs><style') > out.indexOf('<svg'));
  assert.ok(out.includes('@font-face{font-family:Paperlogy}'));
  assert.equal(withFontFace(SVG, ''), SVG);
});

test('바이트를 base64로 바꾼다', () => {
  assert.equal(toBase64(new Uint8Array([104, 105])), 'aGk=');
  const big = new Uint8Array(70000).fill(7);
  assert.equal(toBase64(big), btoa(String.fromCharCode(...new Uint8Array(70000).fill(7))));
});

test('내보내기 임베더: 카드가 쓴 굵기의 폰트만 받아 SVG에 심는다', async () => {
  const calls = [];
  const embed = createFontEmbedder({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    },
  });
  const out = await embed(SVG);
  assert.ok(out.includes('data:font/woff2;base64,AQID'));
  assert.ok(out.includes('font-weight:400'));
  assert.ok(out.includes('font-weight:700'));
  assert.ok(out.includes('font-weight:800'));
  assert.deepEqual(calls.sort(), [
    'fonts/Paperlogy-4Regular.woff2',
    'fonts/Paperlogy-7Bold.woff2',
    'fonts/Paperlogy-8ExtraBold.woff2',
  ]);

  // 같은 굵기면 캐시를 써서 다시 받지 않는다
  await embed(SVG);
  assert.equal(calls.length, 3);
});

test('없는 굵기(900)는 가장 가까운 파일(800)을 심는다', async () => {
  const calls = [];
  const embed = createFontEmbedder({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer };
    },
  });
  const out = await embed('<svg><text font-weight="900">가</text></svg>');
  assert.deepEqual(calls, ['fonts/Paperlogy-8ExtraBold.woff2']);
  assert.ok(out.includes('font-weight:800'));
});

test('폰트를 못 받으면 원본 SVG를 그대로 돌려준다', async () => {
  const embed = createFontEmbedder({
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(await embed(SVG), SVG);
});

test('한 굵기만 실패해도 나머지 굵기는 심는다', async () => {
  const embed = createFontEmbedder({
    fetchImpl: async (url) => {
      if (url.includes('7Bold')) return { ok: false, status: 404 };
      return { ok: true, arrayBuffer: async () => new Uint8Array([4]).buffer };
    },
  });
  const out = await embed(SVG);
  assert.ok(out.includes('font-weight:400'));
  assert.ok(out.includes('font-weight:800'));
  assert.ok(!out.includes('font-weight:700'));
});

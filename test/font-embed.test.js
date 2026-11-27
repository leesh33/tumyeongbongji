import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSubsetFontCssUrl,
  charsUsedInSvg,
  createFontEmbedder,
  extractFontUrl,
  fontFaceCss,
  toBase64,
  unescapeXml,
  withFontFace,
} from '../lib/font-embed.js';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg"><text font-size="12">바나나킥 &amp; 킥</text><text x="4">#001</text></svg>`;

test('SVG의 <text> 글자만 모아 중복 없이 정렬한다', () => {
  const chars = charsUsedInSvg(SVG);
  assert.ok(chars.includes('바'));
  assert.ok(chars.includes('#'));
  assert.ok(chars.includes('&'));
  assert.equal([...chars].filter((c) => c === '킥').length, 1);
  assert.equal(chars, [...chars].sort().join(''));
  assert.equal(charsUsedInSvg(''), '');
});

test('XML 엔티티를 원래 글자로 되돌린다', () => {
  assert.equal(unescapeXml('a &amp; b &lt;c&gt; &quot;d&quot;'), 'a & b <c> "d"');
});

test('Google Fonts 서브셋 주소에 글자와 display=swap을 넣는다', () => {
  const url = buildSubsetFontCssUrl('가나·다');
  assert.ok(url.startsWith('https://fonts.googleapis.com/css2?family=Jua'));
  assert.ok(url.includes('display=swap'));
  assert.ok(url.includes(`text=${encodeURIComponent('가나·다')}`));
});

test('CSS에서 woff2 주소를 뽑는다', () => {
  const css = `@font-face{font-family:'Jua';src:url(https://fonts.gstatic.com/s/jua/v1/x.woff2) format('woff2');}`;
  assert.equal(extractFontUrl(css), 'https://fonts.gstatic.com/s/jua/v1/x.woff2');
  const woff = `src:url('https://a.com/y.woff') format('woff')`;
  assert.equal(extractFontUrl(woff), 'https://a.com/y.woff');
  assert.equal(extractFontUrl('nothing'), '');
});

test('@font-face 문자열은 data:base64를 담는다', () => {
  const css = fontFaceCss('AAAA', { format: 'woff2' });
  assert.ok(css.includes("font-family:'Jua'"));
  assert.ok(css.includes('data:font/woff2;base64,AAAA'));
  assert.ok(css.includes("format('woff2')"));
});

test('SVG 여는 태그 뒤에 <style>을 끼워 넣는다', () => {
  const out = withFontFace(SVG, '@font-face{font-family:Jua}');
  assert.ok(out.indexOf('<defs><style') > out.indexOf('<svg'));
  assert.ok(out.includes('@font-face{font-family:Jua}'));
  assert.equal(withFontFace(SVG, ''), SVG);
});

test('바이트를 base64로 바꾼다', () => {
  assert.equal(toBase64(new Uint8Array([104, 105])), 'aGk=');
  const big = new Uint8Array(70000).fill(7);
  assert.equal(toBase64(big), btoa(String.fromCharCode(...new Uint8Array(70000).fill(7))));
});

test('내보내기 임베더: 서브셋 폰트를 받아 SVG에 심는다', async () => {
  const calls = [];
  const embed = createFontEmbedder({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.startsWith('https://fonts.googleapis.com')) {
        return { ok: true, text: async () => `src:url(https://fonts.gstatic.com/jua.woff2) format('woff2')` };
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    },
  });
  const out = await embed(SVG);
  assert.ok(out.includes('data:font/woff2;base64,AQID'));
  assert.equal(calls.length, 2);

  // 같은 글자면 캐시를 써서 다시 받지 않는다
  await embed(SVG);
  assert.equal(calls.length, 2);
});

test('폰트를 못 받으면 원본 SVG를 그대로 돌려준다', async () => {
  const embed = createFontEmbedder({
    fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }),
  });
  assert.equal(await embed(SVG), SVG);
});

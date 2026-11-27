// 카드 PNG로 내보낼 때 웹폰트(Jua)를 SVG 안에 심는다.
// SVG를 <img>로 그려 canvas에 옮기면 문서의 웹폰트를 쓰지 못해 기본 글꼴로 떨어진다.
// 그래서 카드에 실제로 나온 글자만 골라 Google Fonts의 text= 서브셋을 받아
// base64 @font-face로 SVG 안에 넣는다(카드 한 장당 수십 KB).
export const FONT_FAMILY = 'Jua';

const XML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function unescapeXml(str) {
  return String(str ?? '').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => XML_ENTITIES[m] ?? m);
}

/** SVG 문자열에서 <text> 안의 글자만 모아 중복 없이 정렬한다 */
export function charsUsedInSvg(xml) {
  const chars = new Set();
  const re = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(String(xml ?? '')))) {
    const text = unescapeXml(m[1]).replace(/\s+/g, ' ');
    for (const ch of text) {
      if (ch === ' ') continue;
      chars.add(ch);
    }
  }
  return [...chars].sort().join('');
}

/** Google Fonts 서브셋 CSS 주소 (그 글자만 담긴 woff2를 준다) */
export function buildSubsetFontCssUrl(chars, family = FONT_FAMILY) {
  const text = String(chars ?? '').trim();
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}

/** CSS 본문에서 첫 woff2(없으면 woff/ttf) 주소를 뽑는다 */
export function extractFontUrl(css) {
  const body = String(css ?? '');
  for (const format of ['woff2', 'woff', 'truetype']) {
    const re = new RegExp(`url\\((['"]?)([^'")]+\\.${format === 'truetype' ? 'ttf' : format})\\1\\)`, 'i');
    const m = body.match(re);
    if (m) return m[2];
  }
  const any = body.match(/url\((['"]?)(https?:\/\/[^'")]+)\1\)/i);
  return any ? any[2] : '';
}

/** data:font/woff2;base64,... 를 담은 @font-face */
export function fontFaceCss(base64, { family = FONT_FAMILY, format = 'woff2' } = {}) {
  const mime = format === 'woff' ? 'font/woff' : format === 'ttf' ? 'font/ttf' : 'font/woff2';
  return (
    `@font-face{font-family:'${family}';font-style:normal;font-weight:400;font-display:block;` +
    `src:url(data:${mime};base64,${base64}) format('${format}');}`
  );
}

/** SVG 문자열에 <style>@font-face</style>를 끼워 넣는다 */
export function withFontFace(xml, css) {
  const source = String(xml ?? '');
  if (!css) return source;
  const at = source.indexOf('>');
  if (at < 0) return source;
  return `${source.slice(0, at + 1)}<defs><style type="text/css">${css}</style></defs>${source.slice(at + 1)}`;
}

/** Uint8Array → base64 (큰 배열에서도 스택이 넘치지 않게 나눠서) */
export function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < arr.length; i += step) {
    binary += String.fromCharCode(...arr.subarray(i, i + step));
  }
  return btoa(binary);
}

/**
 * 카드 SVG에 Jua 서브셋 폰트를 심는다. 실패하면 원본을 그대로 돌려준다
 * (내보내기 자체가 막히면 안 되므로 조용히 기본 글꼴로 넘어간다).
 */
export function createFontEmbedder({ fetchImpl, cacheLimit = 8 } = {}) {
  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const cache = new Map();

  async function fetchBase64(chars) {
    if (cache.has(chars)) return cache.get(chars);
    const cssRes = await doFetch(buildSubsetFontCssUrl(chars));
    if (!cssRes.ok) throw new Error('font-css-failed');
    const css = await cssRes.text();
    const fontUrl = extractFontUrl(css);
    if (!fontUrl) throw new Error('font-url-missing');
    const fontRes = await doFetch(fontUrl);
    if (!fontRes.ok) throw new Error('font-file-failed');
    const buf = new Uint8Array(await fontRes.arrayBuffer());
    if (!buf.length) throw new Error('font-empty');
    const format = /\.woff2(\?|$)/i.test(fontUrl) ? 'woff2' : /\.woff(\?|$)/i.test(fontUrl) ? 'woff' : 'ttf';
    const base64 = toBase64(buf);
    if (cache.size >= cacheLimit) cache.delete(cache.keys().next().value);
    cache.set(chars, { base64, format });
    return { base64, format };
  }

  return async function embed(xml) {
    try {
      const chars = charsUsedInSvg(xml);
      if (!chars) return xml;
      const { base64, format } = await fetchBase64(chars);
      return withFontFace(xml, fontFaceCss(base64, { format }));
    } catch {
      return xml;
    }
  };
}

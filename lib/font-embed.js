// 카드 PNG로 내보낼 때 웹폰트(Paperlogy)를 SVG 안에 심는다.
// SVG를 <img>로 그려 canvas에 옮기면 문서의 웹폰트를 쓰지 못해 기본 글꼴로 떨어진다.
// 그래서 화면과 같은 fonts/ 안의 woff2를, 카드가 실제로 쓰는 굵기만큼 base64 @font-face로 넣는다
// (굵기 하나 약 160KB → base64 215KB, 결과 PNG는 화면 카드와 같은 글자 모양이 된다).
// 외부 CDN을 부르지 않으므로 오프라인·CDN 장애에도 결과가 같다.

export const FONT_FAMILY = 'Paperlogy';

// 굵기 → 파일. styles.css의 @font-face와 같은 파일을 쓴다.
export const FONT_FILES = [
  { weight: 400, file: 'fonts/Paperlogy-4Regular.woff2' },
  { weight: 500, file: 'fonts/Paperlogy-5Medium.woff2' },
  { weight: 600, file: 'fonts/Paperlogy-6SemiBold.woff2' },
  { weight: 700, file: 'fonts/Paperlogy-7Bold.woff2' },
  { weight: 800, file: 'fonts/Paperlogy-8ExtraBold.woff2' },
];

/** SVG의 <text>가 실제로 쓰는 font-weight 값(속성이 없으면 400) */
export function weightsUsedInSvg(xml) {
  const used = new Set();
  const re = /<text\b[^>]*>/g;
  let m;
  while ((m = re.exec(String(xml ?? '')))) {
    const attr = m[0].match(/font-weight\s*=\s*"\s*([0-9]+)\s*"/);
    used.add(attr ? Number(attr[1]) : 400);
  }
  if (!used.size) used.add(400);
  return [...used].sort((a, b) => a - b);
}

/** 그 굵기에 가장 가까운 파일을 고른다(정확히 있으면 그 파일, 없으면 가까운 굵기) */
export function pickFontFile(weight, files = FONT_FILES) {
  const list = [...(files ?? [])].sort((a, b) => a.weight - b.weight);
  if (!list.length) return null;
  const target = Number(weight) || 400;
  let best = list[0];
  for (const f of list) {
    const d = Math.abs(f.weight - target);
    const bestD = Math.abs(best.weight - target);
    if (d < bestD || (d === bestD && f.weight > best.weight)) best = f;
  }
  return best;
}

/** data:font/woff2;base64,... 를 담은 @font-face (굵기 지정) */
export function fontFaceCss(base64, { family = FONT_FAMILY, weight = 400, format = 'woff2' } = {}) {
  const mime = format === 'woff' ? 'font/woff' : format === 'ttf' ? 'font/ttf' : 'font/woff2';
  return (
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;` +
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
 * 카드 SVG에 Paperlogy(쓰인 굵기만)를 심는다.
 * 파일을 못 받으면 그 굵기는 화면 글꼴로 두고, 하나도 못 받으면 원본 SVG를 그대로 돌려준다
 * (내보내기 자체가 막히면 안 되므로 조용히 넘어간다).
 */
export function createFontEmbedder({ fetchImpl, files = FONT_FILES, cacheLimit = 12 } = {}) {
  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const cache = new Map();

  async function fontBase64(file) {
    if (cache.has(file)) return cache.get(file);
    const res = await doFetch(file);
    if (!res.ok) throw new Error('font-file-failed');
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) throw new Error('font-empty');
    const base64 = toBase64(buf);
    if (cache.size >= cacheLimit) cache.delete(cache.keys().next().value);
    cache.set(file, base64);
    return base64;
  }

  return async function embed(xml) {
    try {
      // 같은 파일로 모이는 굵기(예: 900 → 800)는 한 번만 심는다.
      const picked = new Map();
      for (const w of weightsUsedInSvg(xml)) {
        const f = pickFontFile(w, files);
        if (f) picked.set(f.weight, f.file);
      }
      const weights = [...picked.keys()].sort((a, b) => a - b);
      if (!weights.length) return xml;

      const faces = await Promise.allSettled(
        weights.map(async (w) => fontFaceCss(await fontBase64(picked.get(w)), { weight: w })),
      );
      const css = faces.filter((r) => r.status === 'fulfilled').map((r) => r.value).join('');
      return css ? withFontFace(xml, css) : xml;
    } catch {
      return xml;
    }
  };
}

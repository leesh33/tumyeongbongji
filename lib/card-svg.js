// 카드 한 장을 SVG 문자열로 만든다. 화면 표시와 PNG 내보내기가 같은 SVG를 쓰므로 결과가 똑같다.
import { APP } from '../config.js';
import { escapeXml as esc, textWidth, wrapText } from './text.js';

const FONT =
  "'Pretendard','-apple-system',BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";

const INK = '#241A10';
const MUTED = '#8C7B66';
const FAINT = '#A79683';
const ACCENT = '#C0512A';

const W = 358;
const PAD = 18;

const PATTERN_BY_KIND = {
  dots: 'p-dots',
  crystals: 'p-crystals',
  specks: 'p-specks',
  sheen: 'p-sheen',
  strands: 'p-strands',
  bubbles: 'p-bubbles',
  fine: 'p-fine',
};

function text(x, y, str, o = {}) {
  const {
    size = 12,
    weight = 400,
    fill = INK,
    anchor = 'start',
    spacing = 0,
    opacity = 1,
  } = o;
  const ls = spacing ? ` letter-spacing="${spacing}"` : '';
  const op = opacity !== 1 ? ` opacity="${opacity}"` : '';
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}${op}>${esc(str)}</text>`;
}

function fitFontSize(str, maxW, start, min = 15) {
  let size = start;
  while (size > min && textWidth(str, size) > maxW) size -= 1;
  return size;
}

function defs() {
  return `<defs>
  <linearGradient id="film" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.86"/>
    <stop offset="0.45" stop-color="#FFFDF8" stop-opacity="0.62"/>
    <stop offset="1" stop-color="#F6EDDD" stop-opacity="0.72"/>
  </linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="0.14" stop-color="#FFFFFF" stop-opacity="0.05"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.82" stop-color="#FFFFFF" stop-opacity="0.16"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.42"/>
  </linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F4F5F7"/>
    <stop offset="0.45" stop-color="#C9CBD0"/>
    <stop offset="1" stop-color="#8E9096"/>
  </linearGradient>
  <linearGradient id="broth" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#D9663B"/>
    <stop offset="1" stop-color="#A93215"/>
  </linearGradient>
  <linearGradient id="oil" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F3D273"/>
    <stop offset="1" stop-color="#C58C1B"/>
  </linearGradient>
  <linearGradient id="sugarTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.55" stop-color="#FDFBF6"/>
    <stop offset="1" stop-color="#EAE3D4"/>
  </linearGradient>
  <linearGradient id="bagEdge" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7A5F36" stop-opacity="0.10"/>
    <stop offset="0.10" stop-color="#7A5F36" stop-opacity="0.02"/>
    <stop offset="0.90" stop-color="#7A5F36" stop-opacity="0.02"/>
    <stop offset="1" stop-color="#7A5F36" stop-opacity="0.10"/>
  </linearGradient>
  <pattern id="p-dots" width="10" height="10" patternUnits="userSpaceOnUse">
    <circle cx="2.2" cy="3" r="1.05" fill="#FFFFFF" opacity="0.55"/>
    <circle cx="6.5" cy="7.2" r="0.95" fill="#8A6B3A" opacity="0.13"/>
    <circle cx="8.4" cy="1.8" r="0.6" fill="#8A6B3A" opacity="0.10"/>
  </pattern>
  <pattern id="p-crystals" width="9" height="9" patternUnits="userSpaceOnUse">
    <rect x="0.4" y="0.6" width="3.4" height="3.4" rx="0.7" fill="#FFFFFF" stroke="#D6CEBE" stroke-width="0.55"/>
    <rect x="4.9" y="4.4" width="3" height="3" rx="0.6" fill="#FCFAF5" stroke="#E0D9CB" stroke-width="0.45"/>
    <rect x="5.6" y="0.8" width="1.5" height="1.5" rx="0.35" fill="#FFFFFF"/>
    <rect x="1.2" y="5" width="1.4" height="1.4" rx="0.3" fill="#FFFFFF" opacity="0.9"/>
  </pattern>
  <pattern id="p-specks" width="9" height="9" patternUnits="userSpaceOnUse">
    <circle cx="1.8" cy="2" r="0.95" fill="#000000" opacity="0.18"/>
    <circle cx="6.2" cy="5.6" r="0.8" fill="#FFFFFF" opacity="0.24"/>
    <circle cx="7.6" cy="1.4" r="0.7" fill="#000000" opacity="0.12"/>
    <circle cx="3.4" cy="7.4" r="0.6" fill="#FFFFFF" opacity="0.18"/>
  </pattern>
  <pattern id="p-sheen" width="26" height="9" patternUnits="userSpaceOnUse">
    <rect x="1" y="3" width="16" height="1.5" rx="0.75" fill="#FFFFFF" opacity="0.45"/>
    <rect x="6" y="6.6" width="10" height="1" rx="0.5" fill="#FFFFFF" opacity="0.28"/>
  </pattern>
  <pattern id="p-strands" width="12" height="11" patternUnits="userSpaceOnUse">
    <path d="M0,3 Q3,1 6,3 T12,3" stroke="#8A6B3A" stroke-opacity="0.16" fill="none" stroke-width="1"/>
    <path d="M0,8 Q3,6 6,8 T12,8" stroke="#FFFFFF" stroke-opacity="0.55" fill="none" stroke-width="1"/>
  </pattern>
  <pattern id="p-bubbles" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="3.2" cy="4" r="1.7" fill="#FFFFFF" opacity="0.5"/>
    <circle cx="9.4" cy="10.2" r="1.2" fill="#FFFFFF" opacity="0.36"/>
  </pattern>
  <pattern id="p-fine" width="6" height="6" patternUnits="userSpaceOnUse">
    <circle cx="1.4" cy="1.6" r="0.55" fill="#000000" opacity="0.07"/>
  </pattern>
</defs>`;
}

// ── 단위 아이콘 ───────────────────────────────────────────
function ladleIcon(frac, x, y, sc = 1) {
  const f = Math.max(0, Math.min(1, frac));
  const top = 6 + (1 - f) * 12;
  const id = `ld${Math.round(x * 10)}_${Math.round(y * 10)}_${Math.round(f * 100)}`;
  return `<g transform="translate(${x},${y}) scale(${sc})">
    <path d="M14,6 L21,-0.5" stroke="url(#metal)" stroke-width="3" stroke-linecap="round"/>
    <clipPath id="${id}">
      <path d="M1,5.5 H16 C16,15 12,20 8.5,20 C5,20 1,15 1,5.5 Z"/>
    </clipPath>
    <path d="M1,5.5 H16 C16,15 12,20 8.5,20 C5,20 1,15 1,5.5 Z" fill="#B9BBC1"/>
    <g clip-path="url(#${id})"><rect x="0" y="${top}" width="18" height="16" fill="url(#broth)"/></g>
    <ellipse cx="8.5" cy="5.6" rx="7.5" ry="2.1" fill="#E8E9EC" stroke="#8A8C92" stroke-width="0.7"/>
    <g clip-path="url(#${id})"><ellipse cx="8.5" cy="6.2" rx="7.5" ry="2.1" fill="url(#broth)" opacity="${f > 0.05 ? 0.9 : 0}"/></g>
    <path d="M4,3.4 L7,3.4" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
    <path d="M1,5.5 H16 C16,15 12,20 8.5,20 C5,20 1,15 1,5.5 Z" fill="none" stroke="#6F7178" stroke-opacity="0.4" stroke-width="0.7"/>
  </g>`;
}

function spoonIcon(frac, x, y, sc = 1) {
  const f = Math.max(0, Math.min(1, frac));
  const top = 4.5 + (1 - f) * 17;
  const id = `sp${Math.round(x * 10)}_${Math.round(y * 10)}_${Math.round(f * 100)}`;
  return `<g transform="translate(${x},${y}) scale(${sc})">
    <path d="M11.5,8.5 L21.5,0.5" stroke="url(#metal)" stroke-width="3.2" stroke-linecap="round"/>
    <clipPath id="${id}"><ellipse cx="7.4" cy="13.4" rx="6.8" ry="8"/></clipPath>
    <ellipse cx="7.4" cy="13.4" rx="6.8" ry="8" fill="#C6C8CD"/>
    <g clip-path="url(#${id})"><rect x="0" y="${top}" width="15" height="22" fill="url(#oil)"/></g>
    <ellipse cx="7.4" cy="13.4" rx="6.8" ry="8" fill="none" stroke="#75777E" stroke-opacity="0.45" stroke-width="0.8"/>
    <ellipse cx="4.8" cy="9.6" rx="1.7" ry="2.6" fill="#FFFFFF" opacity="0.55"/>
    <path d="M1.2,13.8 H13.6" stroke="#8A8C92" stroke-opacity="0.35" stroke-width="0.8"/>
  </g>`;
}

function cubeIcon(frac, x, y, size = 12.5) {
  const f = Math.max(0, Math.min(1, frac));
  const h = size * f;
  const r = 2.2;
  return `<g transform="translate(${x},${y})">
    <rect x="0.5" y="1" width="${size - 1}" height="${size - 1}" rx="${r}" fill="#8A7A5E" opacity="0.16"/>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="#EFEADF" stroke="#BDB29D" stroke-width="1"/>
    <rect x="0" y="${size - h}" width="${size}" height="${h}" rx="${r}" fill="url(#sugarTop)" stroke="#D8CFBC" stroke-width="0.7"/>
    <path d="M2,2.3 L${size - 3.2},2.3" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M2,${size - 2.1} L${size - 2},${size - 2.1}" stroke="#EBE4D6" stroke-width="1.1" stroke-linecap="round"/>
  </g>`;
}

function iconStrip(kind, value, rightX, cy) {
  const v = Math.max(0, Number(value) || 0);
  if (v <= 0.001) return '';
  if (kind === 'cube') {
    const n = Math.min(18, Math.ceil(v - 1e-9));
    const full = Math.min(n, Math.floor(v + 1e-9));
    const perRow = 6;
    const cols = Math.min(perRow, n);
    const rows = Math.ceil(n / perRow);
    const gap = 3.2;
    const size = 12.5;
    const gridW = cols * size + (cols - 1) * gap;
    const gridH = rows * size + (rows - 1) * gap;
    const left = rightX - gridW;
    const top = cy - gridH / 2;
    let out = '';
    for (let i = 0; i < n; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const frac = i < full ? 1 : Math.max(0.08, v - full);
      out += cubeIcon(frac, left + col * (size + gap), top + row * (size + gap), size);
    }
    return out;
  }
  const n = Math.min(9, Math.ceil(v - 1e-9));
  const full = Math.floor(v + 1e-9);
  const perRow = n <= 4 ? n : 5;
  const rows = Math.ceil(n / perRow);
  const gap = 2.4;
  const iconW = n <= 4 ? 23 : 19;
  const sc = iconW / 23;
  const rowH = 22 * sc + 1;
  const rowWidth = (count) => count * iconW + (count - 1) * gap;
  let out = '';
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const rowLeft = rightX - rowWidth(inRow);
    const x = rowLeft + col * (iconW + gap);
    const y = cy - (rows * rowH) / 2 + row * rowH;
    const frac = i < full ? 1 : Math.max(0.06, v - full);
    out += kind === 'ladle' ? ladleIcon(frac, x, y, sc) : spoonIcon(frac, x, y, sc);
  }
  return out;
}

// ── 층 쌓기 ───────────────────────────────────────────────
function wobble(seed, i) {
  return Math.sin(seed * 1.9 + i * 2.4) * 2.1;
}

function layerPath(x, w, topY, bottomY, seed) {
  const steps = 4;
  const stepW = w / steps;
  let d = `M${x},${bottomY} L${x},${topY + wobble(seed, -1) * 0.4}`;
  for (let i = 0; i < steps; i++) {
    const x0 = x + i * stepW;
    const dy = wobble(seed, i);
    const dy2 = wobble(seed, i + 1);
    d += ` C${(x0 + stepW * 0.35).toFixed(1)},${(topY + dy).toFixed(1)} ${(x0 + stepW * 0.65).toFixed(1)},${(topY + dy2).toFixed(1)} ${(x0 + stepW).toFixed(1)},${(topY + dy2 * 0.5).toFixed(1)}`;
  }
  d += ` L${x + w},${bottomY} Z`;
  return d;
}

export function spreadLabels(ys, minGap, top, bottom) {
  const items = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  if (!items.length) return [];
  for (let k = 1; k < items.length; k++) {
    if (items[k].y - items[k - 1].y < minGap) items[k].y = items[k - 1].y + minGap;
  }
  const over = items[items.length - 1].y - bottom;
  if (over > 0) {
    items[items.length - 1].y = bottom;
    for (let k = items.length - 2; k >= 0; k--) {
      if (items[k + 1].y - items[k].y < minGap) items[k].y = items[k + 1].y - minGap;
    }
  }
  const under = top - items[0].y;
  if (under > 0) {
    for (const it of items) it.y += under;
  }
  const out = new Array(ys.length);
  for (const it of items) out[it.i] = it.y;
  return out;
}

function pouchBlock(model, top, height) {
  const PX = 26;
  const PW = 148;
  const sealH = 16;
  const bodyTop = top + sealH - 1;
  const bodyBottom = top + height - 6;
  const sealBottomH = 12;
  const inner = { x: PX + 6, y: bodyTop + 7, w: PW - 12, h: bodyBottom - sealBottomH - bodyTop - 9 };
  const innerBottom = inner.y + inner.h;
  const labelX = 200;
  const labelW = W - PAD - labelX; // 140
  const layers = model.layers;

  let out = '';

  // 바닥 그림자
  out += `<ellipse cx="${PX + PW / 2}" cy="${bodyBottom + 5}" rx="${PW / 2 - 9}" ry="5.5" fill="#8A6B3A" opacity="0.12"/>`;

  // 필름 본체
  out += `<rect x="${PX}" y="${bodyTop}" width="${PW}" height="${bodyBottom - bodyTop}" rx="8" fill="url(#film)" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="1.4"/>`;
  out += `<rect x="${PX + 0.8}" y="${bodyTop + 0.8}" width="${PW - 1.6}" height="${bodyBottom - bodyTop - 1.6}" rx="7.4" fill="none" stroke="#DDD0BA" stroke-opacity="0.6" stroke-width="0.8"/>`;
  out += `<clipPath id="bagClip"><rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" rx="3"/></clipPath>`;
  out += `<clipPath id="bodyClip"><rect x="${PX}" y="${bodyTop}" width="${PW}" height="${bodyBottom - bodyTop}" rx="8"/></clipPath>`;

  // 층 (아래 = 무거운 층)
  let cum = 0;
  const bands = [];
  layers.forEach((layer, i) => {
    const h = inner.h * layer.fill;
    const topY = innerBottom - cum - h;
    const bottomY = innerBottom - cum;
    bands.push({ top: topY, bottom: bottomY, mid: topY + h / 2 });
    cum += h;
    const d = layerPath(inner.x, inner.w, topY, bottomY, i + 1);
    const pat = PATTERN_BY_KIND[layer.style.pattern];
    out += `<path d="${d}" fill="${layer.style.fill}" stroke="${layer.style.edge}" stroke-width="0.6"/>`;
    if (pat) {
      out += `<clipPath id="lc${i}"><path d="${d}"/></clipPath>`;
      out += `<g clip-path="url(#lc${i})"><rect x="${inner.x}" y="${topY - 4}" width="${inner.w}" height="${bottomY - topY + 8}" fill="url(#${pat})"/></g>`;
    }
    // 층 경계 하이라이트
    out += `<path d="M${inner.x},${topY} L${inner.x + inner.w},${topY}" stroke="#FFFFFF" stroke-opacity="0.32" stroke-width="1"/>`;
  });

  // 유리 반사 · 주름
  out += `<g clip-path="url(#bodyClip)">
    <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="url(#bagEdge)"/>
    <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="url(#gloss)" opacity="0.9"/>
    <path d="M${PX + 7},${bodyTop + 20} C${PX + 18},${bodyTop + 28} ${PX + 26},${bodyTop + 21} ${PX + 37},${bodyTop + 31}" stroke="#FFFFFF" stroke-opacity="0.62" fill="none" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M${PX + PW - 8},${bodyTop + 44} C${PX + PW - 20},${bodyTop + 52} ${PX + PW - 13},${bodyTop + 62} ${PX + PW - 24},${bodyTop + 68}" stroke="#FFFFFF" stroke-opacity="0.5" fill="none" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M${PX + 5},${bodyBottom - 16} C${PX + 16},${bodyBottom - 24} ${PX + 30},${bodyBottom - 12} ${PX + 46},${bodyBottom - 20}" stroke="#FFFFFF" stroke-opacity="0.45" fill="none" stroke-width="1.1" stroke-linecap="round"/>
    <rect x="${PX}" y="${bodyTop}" width="${PW}" height="7" fill="#FFFFFF" opacity="0.35"/>
  </g>`;

  // 좌우 필름 엣지
  out += `<path d="M${PX + 1.6},${bodyTop + 6} L${PX + 1.6},${bodyBottom - 6}" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="2.2" stroke-linecap="round"/>`;
  out += `<path d="M${PX + PW - 1.6},${bodyTop + 6} L${PX + PW - 1.6},${bodyBottom - 6}" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/>`;

  // 상단 지퍼 씰
  const sealY = top;
  out += `<g>
    <rect x="${PX - 2}" y="${sealY}" width="${PW + 4}" height="${sealH - 1}" rx="4" fill="#FFFFFF" fill-opacity="0.88" stroke="#EADFCD" stroke-width="0.8"/>
    <path d="${zipPath(PX + 2, sealY + 4, PW - 4, 4)}" fill="none" stroke="#D8CFBF" stroke-width="1"/>
    <path d="${zipPath(PX + 2, sealY + 8.5, PW - 4, 4)}" fill="none" stroke="#E4DCCD" stroke-width="1"/>
    <path d="M${PX - 2},${sealY + sealH - 1.4} H${PX + PW + 2}" stroke="#DFD4C1" stroke-width="0.9"/>
  </g>`;

  // 하단 밀봉 (크림프)
  out += `<g>
    <rect x="${PX - 2}" y="${bodyBottom - sealBottomH}" width="${PW + 4}" height="${sealBottomH}" rx="3" fill="#FFFFFF" fill-opacity="0.9" stroke="#EADFCD" stroke-width="0.8"/>
    <path d="${crimpPath(PX, bodyBottom - sealBottomH + 2, PW, sealBottomH - 4)}" fill="none" stroke="#DCD2BF" stroke-width="0.9"/>
    <path d="M${PX - 2},${bodyBottom - sealBottomH + 0.6} H${PX + PW + 2}" stroke="#DFD4C1" stroke-width="0.8"/>
  </g>`;
  // 옆 거셋 접힘
  out += `<path d="M${PX + 2},${bodyBottom - sealBottomH - 2} L${PX + 14},${bodyBottom - sealBottomH + 4}" stroke="#CFC2AB" stroke-opacity="0.5" stroke-width="0.9"/>`;
  out += `<path d="M${PX + PW - 2},${bodyBottom - sealBottomH - 2} L${PX + PW - 14},${bodyBottom - sealBottomH + 4}" stroke="#CFC2AB" stroke-opacity="0.5" stroke-width="0.9"/>`;

  // 라벨
  const labelYs = spreadLabels(
    bands.map((b) => b.mid),
    38,
    bodyTop + 12,
    bodyBottom - 12,
  );

  layers.forEach((layer, i) => {
    const by = bands[i].mid;
    const ly = labelYs[i];
    const conn = `M${PX + PW + 2},${by} L${labelX - 16},${by} L${labelX - 7},${ly - 3} L${labelX - 3},${ly - 3}`;
    out += `<path d="${conn}" fill="none" stroke="#B4A28C" stroke-width="0.8" stroke-opacity="0.85" stroke-linejoin="round"/>`;
    out += `<circle cx="${PX + PW + 2}" cy="${by}" r="1.5" fill="#B4A28C"/>`;
    const nameSize = 11.5;
    const nameW = textWidth(layer.label, nameSize);
    out += `<text x="${labelX}" y="${ly}" font-family="${FONT}" font-size="${nameSize}" font-weight="700" fill="${INK}">${esc(layer.label)}</text>`;
    out += `<text x="${labelX + nameW + 5}" y="${ly}" font-family="${FONT}" font-size="9" font-weight="600" fill="${FAINT}">${layer.grams}${model.unit === 'ml' ? 'ml' : 'g'} · ${layer.percent}%</text>`;
    const subLines = wrapText(layer.sub, 9, labelW, 2);
    subLines.forEach((line, k) => {
      out += `<text x="${labelX}" y="${ly + 11 + k * 10.5}" font-family="${FONT}" font-size="9" font-weight="400" fill="${MUTED}">${esc(line)}</text>`;
    });
  });

  return out;
}

function crimpPath(x, y, w, h) {
  const teeth = Math.round(w / 5);
  const step = w / teeth;
  let d = `M${x},${y}`;
  for (let i = 0; i < teeth; i++) {
    d += ` L${x + step * (i + 0.5)},${y + h} L${x + step * (i + 1)},${y}`;
  }
  return d;
}

function zipPath(x, y, w, h) {
  const teeth = Math.max(8, Math.round(w / 6));
  const step = w / teeth;
  let d = `M${x},${y + h}`;
  for (let i = 0; i < teeth; i++) {
    d += ` L${x + step * (i + 0.5)},${y} L${x + step * (i + 1)},${y + h}`;
  }
  return d;
}

// ── 카드 전체 ─────────────────────────────────────────────
export function cardSVG(model, options = {}) {
  const width = options.width ?? W;
  const nameSize = fitFontSize(model.name, W - PAD * 2 - 4, 25, 16);

  const chipText = `${model.categoryName} · ${model.brand}`;
  const chipW = textWidth(chipText, 10.5) + 22;

  const rowsTop = 124;
  const rowH = 48;
  const pouchTop = rowsTop + rowH * 3 + 12;
  const pouchH = 300;
  const afterPouch = pouchTop + pouchH;
  const ingTop = afterPouch + 4;
  const ingLines = wrapText(model.ingredients.join(', '), 10.5, W - PAD * 2 - 44, 3);
  const ingBlockH = ingLines.length ? 12 + ingLines.length * 13 : 0;
  const disTop = ingTop + ingBlockH + 6;
  const disLines = wrapText(APP.disclaimer, 9.2, W - PAD * 2 - 8, 3);
  const footerTop = disTop + disLines.length * 12 + 10;
  const H = footerTop + 26;

  let s = '';
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="#FFFCF7"/>`;
  s += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" stroke="#E3D6C4" stroke-width="1"/>`;
  s += `<path d="M0,24 A24,24 0 0 1 24,0 L${W - 24},0 A24,24 0 0 1 ${W},24 L${W},120 L0,120 Z" fill="#F7EEE0" opacity="0.75"/>`;

  // 헤더
  s += `<rect x="${PAD}" y="22" width="${chipW}" height="22" rx="11" fill="#EFE1CE"/>`;
  s += text(PAD + 11, 37, chipText, { size: 10.5, weight: 600, fill: '#7B6A55' });
  s += text(PAD, 78, model.name, { size: nameSize, weight: 800, fill: INK, spacing: -0.3 });
  s += text(PAD, 101, model.serving, { size: 12, weight: 600, fill: MUTED });
  const servingW = textWidth(model.serving, 12);
  if (model.kcal != null) {
    s += text(PAD + servingW + 6, 101, `· ${model.kcal} kcal`, { size: 12, weight: 700, fill: ACCENT });
  }
  s += `<line x1="${PAD}" y1="114" x2="${W - PAD}" y2="114" stroke="#E7DAC7" stroke-width="1"/>`;

  // 단위 환산 3줄
  model.rows.forEach((row, i) => {
    const y0 = rowsTop + i * rowH;
    const labelW = textWidth(row.label, 10.5);
    const [amountNum, amountUnit] = row.amount.split(' ');
    s += text(PAD, y0 + 17, row.label, { size: 10.5, weight: 600, fill: FAINT });
    s += text(PAD + labelW + 7, y0 + 18, amountNum, { size: 15, weight: 700, fill: INK });
    const amountW = textWidth(amountNum, 15);
    s += text(PAD + labelW + 9 + amountW, y0 + 18, amountUnit ?? '', {
      size: 10.5,
      weight: 600,
      fill: MUTED,
    });
    s += text(PAD, y0 + 40, row.phrase, { size: 13.5, weight: 800, fill: ACCENT });
    s += iconStrip(row.kind, row.value, W - PAD, y0 + 24);
    if (i < 2) {
      s += `<line x1="${PAD}" y1="${y0 + 46}" x2="${W - PAD}" y2="${y0 + 46}" stroke="#EFE4D4" stroke-width="1" stroke-dasharray="2 5" stroke-linecap="round"/>`;
    }
  });

  // 봉지
  s += pouchBlock(model, pouchTop, pouchH);

  // 원재료
  if (ingLines.length) {
    s += text(PAD, ingTop + 12, '원재료', { size: 10, weight: 700, fill: FAINT, spacing: 0.4 });
    ingLines.forEach((line, i) => {
      s += text(PAD + 40, ingTop + 12 + i * 13, line, { size: 10.5, weight: 500, fill: '#5B4A38' });
    });
  }

  // 고지
  disLines.forEach((line, i) => {
    s += text(W / 2, disTop + 11 + i * 12, line, {
      size: 9.2,
      weight: 500,
      fill: FAINT,
      anchor: 'middle',
    });
  });

  // 워드마크
  s += `<g>
    <rect x="${W - PAD - 74}" y="${footerTop + 3}" width="12" height="14" rx="2.5" fill="none" stroke="#C9B9A2" stroke-width="1"/>
    <path d="M${W - PAD - 72},${footerTop + 8} L${W - PAD - 64},${footerTop + 8}" stroke="#C9B9A2" stroke-width="1.4"/>
    ${text(W - PAD, footerTop + 14, APP.name, { size: 9.5, weight: 700, fill: '#B7A794', anchor: 'end', spacing: 1.2 })}
  </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round((H * width) / W)}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${model.name} 영양성분 시각화 카드`)}">${defs()}${s}</svg>`;
  return { svg, width: W, height: H };
}

// 제조사 미니 심볼 + 이름 딱지.
// 공식 CI 이미지를 복제하지 않고, 각 회사의 대표 색과 상징만 살린 자체 SVG를 그린다.
// (상표권 안전: 로고 파일을 쓰지 않고 16×16 격자에 직접 그린 도형만 사용)
import { escapeXml } from './text.js';

// 제조사별 대표 색. 21곳 모두 서로 다른 색을 쓴다.
export const BRAND_COLORS = Object.freeze({
  농심: '#DE2A1F',
  오리온: '#23398C',
  크라운: '#C0861B',
  해태: '#EA7A2A',
  롯데: '#C92A46',
  코카콜라: '#A81C22',
  빙그레: '#2A88D0',
  스타벅스: '#0E6B45',
  동아오츠카: '#1F6FB2',
  남양유업: '#173A6B',
  썬키스트: '#F2A11C',
  삼양: '#C0272D',
  오뚜기: '#D9541F',
  팔도: '#2E8B72',
  CJ제일제당: '#3F63B5',
  GS25: '#00A05A',
  매일유업: '#6BB8DE',
  서울우유: '#14549E',
  아이얌: '#E4718E',
  광동제약: '#0E8C8C',
  서흥: '#7A4FB5',
});

// 목록에 없는 제조사(직접 입력·향후 추가)에 쓰는 중립 심볼 색 — 따뜻한 베이지 브라운
export const DEFAULT_BRAND_COLOR = '#B08A5E';

const CAP = 'stroke-linecap="round" stroke-linejoin="round"';

// 각 심볼은 16×16 격자 안에서 4~12 영역에 그린다. 13px로 줄여도 형태가 남도록 굵게.
const GLYPHS = {
  // 밀 이삭 — 농심
  농심: (c) => `<path d="M8 13.2V4.6" stroke="${c}" stroke-width="1.6" ${CAP}/>
    <path d="M8 7.4 5.5 5.7M8 7.4l2.5-1.7M8 10.2 5.8 8.8M8 10.2l2.2-1.4" stroke="${c}" stroke-width="1.4" ${CAP}/>`,
  // 별 — 오리온(오리온자리)
  오리온: (c) =>
    `<path d="M8 3.5 9.1 6.6 12.4 6.8 9.8 8.8 10.7 11.9 8 10.1 5.3 11.9 6.2 8.8 3.6 6.8 6.9 6.6z" fill="${c}"/>`,
  // 왕관 — 크라운
  크라운: (c) =>
    `<path d="M3.2 6.3 6.1 8.2 8 4.3l1.9 3.9 2.9-1.9-.7 5.4H3.9z" fill="${c}"/>
     <rect x="3.6" y="11.5" width="8.8" height="1.5" rx=".75" fill="${c}"/>`,
  // 해(태양) — 해태
  해태: (c) =>
    `<circle cx="8" cy="8" r="2.4" fill="${c}"/>
     <path d="M8 2.9v1.3M8 11.8v1.3M2.9 8h1.3M11.8 8h1.3M4.4 4.4l.9.9M10.7 10.7l.9.9M11.6 4.4l-.9.9M5.3 10.7l-.9.9" stroke="${c}" stroke-width="1.4" ${CAP}/>`,
  // 링 — 롯데
  롯데: (c) => `<circle cx="8" cy="8" r="3.9" fill="none" stroke="${c}" stroke-width="2.4"/>`,
  // 리본 물결 — 코카콜라
  코카콜라: (c) =>
    `<path d="M2.9 11.4c2.3.2 3.7-1.7 4.9-3.4 1.1-1.6 2.2-2.6 3.6-2.6" stroke="${c}" stroke-width="2" fill="none" ${CAP}/>
     <path d="M4.6 6c.7-1.3 1.8-2 3.1-2" stroke="${c}" stroke-width="1.4" fill="none" ${CAP}/>`,
  // 웃는 얼굴 — 빙그레
  빙그레: (c) =>
    `<circle cx="5.6" cy="6.5" r=".9" fill="${c}"/><circle cx="10.4" cy="6.5" r=".9" fill="${c}"/>
     <path d="M4.4 8.7c.9 1.9 2.2 2.9 3.6 2.9s2.7-1 3.6-2.9" stroke="${c}" stroke-width="1.8" fill="none" ${CAP}/>`,
  // 원두 — 스타벅스
  스타벅스: (c) =>
    `<ellipse cx="8" cy="8" rx="3.3" ry="4.4" transform="rotate(-20 8 8)" fill="${c}"/>
     <path d="M8.6 4.2c-1.9 2.2.7 3.7-1.1 5.9" stroke="#fff" stroke-width="1.1" fill="none" ${CAP}/>`,
  // 번개 — 동아오츠카(이온음료)
  동아오츠카: (c) => `<path d="M9.1 2.7 4.3 9h2.9l-1 4.3L11.7 6.5H8.4z" fill="${c}"/>`,
  // 물방울 — 남양유업
  남양유업: (c) =>
    `<path d="M8 3.1c0 0-4 4.2-4 6.4a4 4 0 0 0 8 0c0-2.2-4-6.4-4-6.4z" fill="${c}"/>
     <circle cx="6.6" cy="9.6" r=".9" fill="#fff" opacity=".85"/>`,
  // 오렌지 단면 — 썬키스트
  썬키스트: (c) =>
    `<circle cx="8" cy="8" r="4.3" fill="${c}"/>
     <path d="M8 3.9v8.2M3.9 8h8.2" stroke="#fff" stroke-width="1.1" ${CAP}/>`,
  // 불꽃 — 삼양
  삼양: (c) =>
    `<path d="M8 2.5c.6 2.1 2.8 3.3 2.8 6a2.8 2.8 0 0 1-5.6 0c0-1.4.7-2.5 1.4-3.3.1.9.5 1.5 1 1.8-.3-1.8-.1-3.3.4-4.5z" fill="${c}"/>`,
  // 밥그릇 — 오뚜기
  오뚜기: (c) =>
    `<path d="M3.3 8.7h9.4a4.7 4.7 0 0 1-9.4 0z" fill="${c}"/>
     <path d="M6.5 6.7c.4-.9-.4-1.5 0-2.4M9.5 6.7c.4-.9-.4-1.5 0-2.4" stroke="${c}" stroke-width="1.3" fill="none" ${CAP}/>`,
  // 산맥 — 팔도(팔도)
  팔도: (c) => `<path d="M2.5 11.6 6.4 5.2l2.5 4 1.1-1.7 3.5 4.1z" fill="${c}"/>`,
  // 쌀알 두 톨 — CJ제일제당(햇반)
  CJ제일제당: (c) =>
    `<ellipse cx="6.3" cy="9.5" rx="1.55" ry="2.75" transform="rotate(-25 6.3 9.5)" fill="${c}"/>
     <ellipse cx="9.9" cy="6.5" rx="1.55" ry="2.75" transform="rotate(-25 9.9 6.5)" fill="${c}"/>`,
  // 가게 — GS25
  GS25: (c) =>
    `<path d="M2.9 7.3 8 3.5l5.1 3.8z" fill="${c}"/>
     <path d="M4.4 8.2h7.2v4.3H4.4z" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`,
  // 우유팩 — 매일유업
  매일유업: (c) =>
    `<path d="M5.1 12V7.6L8 4.5l2.9 3.1V12z" fill="${c}"/>
     <path d="M5.1 9.3h5.8" stroke="#fff" stroke-width="1" ${CAP}/>`,
  // 우유병 — 서울우유
  서울우유: (c) =>
    `<path d="M6.6 6.1V3.8h2.8v2.3c0 .9.9 1.3.9 2.5V12H5.7V8.6c0-1.2.9-1.6.9-2.5z" fill="${c}"/>
     <rect x="6.2" y="3.2" width="3.6" height="1.1" rx=".55" fill="${c}"/>`,
  // 새싹 — 아이얌
  아이얌: (c) =>
    `<path d="M8 12.4V7.6" stroke="${c}" stroke-width="1.6" ${CAP}/>
     <path d="M8 8.6C6.2 8.6 4.9 7.3 4.9 5.5c1.8 0 3.1 1 3.1 3.1z" fill="${c}"/>
     <path d="M8 10c1.8 0 3.1-1.3 3.1-3.1-1.8 0-3.1 1-3.1 3.1z" fill="${c}"/>`,
  // 알약 — 광동제약
  광동제약: (c) =>
    `<g transform="rotate(-35 8 8)"><rect x="3.2" y="6.1" width="9.6" height="3.8" rx="1.9" fill="none" stroke="${c}" stroke-width="1.6"/>
     <path d="M8 6.1v3.8" stroke="${c}" stroke-width="1.4"/>
     <path d="M3.2 8h4.8v1.9H5.1a1.9 1.9 0 0 1-1.9-1.9z" fill="${c}"/></g>`,
  // 병 — 서흥
  서흥: (c) =>
    `<path d="M6.6 3.4h2.8v1.5l1.1 1.2v6.5H5.5V6.1l1.1-1.2z" fill="none" stroke="${c}" stroke-width="1.5"/>
     <path d="M6.6 9.2h2.8" stroke="${c}" stroke-width="1.3" ${CAP}/>`,
  // 기본값 — 이름표 구멍 점
  __default: (c) => `<circle cx="8" cy="8" r="2.7" fill="${c}"/><circle cx="8" cy="8" r=".9" fill="#fff"/>`,
};

export const KNOWN_BRANDS = Object.keys(BRAND_COLORS);

/** 'CJ 제일제당'처럼 띄어쓰기만 다른 표기도 같은 제조사로 본다. */
function normalize(brand) {
  return String(brand ?? '')
    .replace(/\s+/g, '')
    .trim();
}

/** 제조사 이름으로 색·도형을 찾는다. 목록에 없으면 기본 중립 심볼. */
export function brandStyle(brand) {
  const name = String(brand ?? '').trim();
  const key = normalize(name);
  for (const known of KNOWN_BRANDS) {
    if (normalize(known) === key) {
      return { color: BRAND_COLORS[known], glyph: GLYPHS[known], known: true };
    }
  }
  return { color: DEFAULT_BRAND_COLOR, glyph: GLYPHS.__default, known: false };
}

/**
 * 16×16 좌표계의 심볼 도형(원 + 글리프)만 돌려준다.
 * 다른 SVG(카드 이미지) 안에 <g transform>으로 넣을 때 쓴다. 브랜드가 비면 빈 문자열.
 */
export function brandSymbolShapes(brand) {
  if (!String(brand ?? '').trim()) return '';
  const { color, glyph } = brandStyle(brand);
  return `<circle cx="8" cy="8" r="7.2" fill="${color}" fill-opacity="0.13"/>
  <circle cx="8" cy="8" r="7.2" fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="1"/>
  ${glyph(color)}`;
}

/** 13px 원형 미니 심볼 SVG. 브랜드가 비어 있으면 빈 문자열. */
export function brandSymbol(brand, { size = 13 } = {}) {
  const shapes = brandSymbolShapes(brand);
  if (!shapes) return '';
  return `<svg class="bsym" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  ${shapes}
</svg>`;
}

/**
 * [심볼 + 제조사 이름] 알약 딱지. 브랜드가 비면 아무것도 그리지 않는다.
 * 이름은 escapeXml로 감싸 마크업이 그대로 실행되지 않게 한다.
 */
export function brandBadge(brand, { extraClass = '' } = {}) {
  const name = String(brand ?? '').trim();
  if (!name) return '';
  const cls = `brand-badge${extraClass ? ` ${extraClass}` : ''}`;
  return `<span class="${cls}">${brandSymbol(name)}<span class="bname">${escapeXml(name)}</span></span>`;
}

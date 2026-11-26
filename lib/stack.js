// 영양성분표 → 투명 봉지 단면의 층 계산.
// 당류·지방은 영양성분표 값을 그대로 층의 무게로 쓰고, 나머지 무게를
// 제품별 원재료 비중(bulk)으로 나눈 뒤 무거운 층을 아래에 쌓는다.
import { num } from './units.js';

export const KIND_STYLE = {
  flour: { fill: '#EFE2C2', edge: 'rgba(150,120,70,.28)', pattern: 'dots', name: '가루' },
  grain: { fill: '#E8D6AE', edge: 'rgba(150,120,70,.28)', pattern: 'dots', name: '곡물' },
  noodle: { fill: '#F3E8CD', edge: 'rgba(150,120,70,.25)', pattern: 'strands', name: '면발' },
  sugar: { fill: '#FBFAF5', edge: 'rgba(150,140,120,.30)', pattern: 'crystals', name: '설탕' },
  fat: { fill: '#E6B24A', edge: 'rgba(180,130,30,.35)', pattern: 'sheen', name: '기름' },
  cocoa: { fill: '#4A2C1C', edge: 'rgba(30,15,5,.45)', pattern: 'specks', name: '초콜릿' },
  seasoning: { fill: '#C06A2C', edge: 'rgba(140,70,20,.35)', pattern: 'specks', name: '시즈닝' },
  salt: { fill: '#F6F1E6', edge: 'rgba(150,140,120,.28)', pattern: 'fine', name: '소금' },
  dairy: { fill: '#FBF2E0', edge: 'rgba(160,140,100,.25)', pattern: 'dots', name: '유가공품' },
  liquid: { fill: '#F0E5D0', edge: 'rgba(150,130,90,.22)', pattern: 'bubbles', name: '액상' },
  fruit: { fill: '#EDB455', edge: 'rgba(180,120,20,.30)', pattern: 'dots', name: '과즙' },
  soup: { fill: '#B4552A', edge: 'rgba(120,40,10,.40)', pattern: 'specks', name: '스프' },
  dried: { fill: '#C9B089', edge: 'rgba(140,110,60,.35)', pattern: 'dots', name: '건더기' },
  water: { fill: '#EDF0EB', edge: 'rgba(120,140,120,.22)', pattern: 'bubbles', name: '물' },
};

export const CATEGORY_BULK = {
  snack: [
    { kind: 'flour', label: '밀가루·전분', sub: '밀가루·옥수수전분', share: 0.8 },
    { kind: 'seasoning', label: '정제소금·조미분말', sub: '정제소금·조미분말', share: 0.2 },
  ],
  drink: [
    { kind: 'water', label: '정제수', sub: '정제수·탄산수', share: 0.72 },
    { kind: 'seasoning', label: '향료·산미료', sub: '향료·산미료·착색료', share: 0.28 },
  ],
  noodle: [
    { kind: 'noodle', label: '소맥분(면발)', sub: '소맥분·팜유', share: 0.62 },
    { kind: 'soup', label: '분말스프', sub: '분말스프·조미료', share: 0.26 },
    { kind: 'dried', label: '건더기', sub: '건더기·후레이크', share: 0.12 },
  ],
  kids: [
    { kind: 'grain', label: '쌀·곡물가루', sub: '쌀·곡물가루', share: 0.58 },
    { kind: 'dairy', label: '유가공품·분유', sub: '유가공품·분유', share: 0.26 },
    { kind: 'fruit', label: '과일농축액', sub: '과일농축액·향료', share: 0.16 },
  ],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeBulk(bulk) {
  const list = (bulk ?? []).filter((b) => b && b.share > 0);
  const sum = list.reduce((s, b) => s + num(b.share), 0);
  if (!sum) return [];
  return list.map((b) => ({ ...b, share: num(b.share) / sum }));
}

/**
 * 층 계산.
 * @returns {{key:string,kind:string,label:string,sub:string,grams:number,ratio:number,fill:number,percent:number}[]}
 *   무거운 층이 index 0 (봉지 바닥).
 */
export function stackLayers(product, { minRatio = 0.055 } = {}) {
  const weight = Math.max(0.1, num(product.weight));
  const fat = clamp(num(product.fat), 0, weight);
  const sugar = clamp(num(product.sugar), 0, weight - fat);
  const rest = Math.max(0, weight - fat - sugar);

  const bulk = normalizeBulk(
    Array.isArray(product.bulk) && product.bulk.length
      ? product.bulk
      : CATEGORY_BULK[product.category] ?? CATEGORY_BULK.snack,
  );

  const raw = [];
  for (const b of bulk) {
    raw.push({
      key: b.kind + '-' + raw.length,
      kind: b.kind,
      label: b.label,
      sub: b.sub ?? '',
      grams: rest * b.share,
    });
  }
  if (sugar > 0.05) {
    raw.push({ key: 'sugar', kind: 'sugar', label: '설탕·당류', sub: '설탕·액상과당·시럽', grams: sugar });
  }
  if (fat > 0.05) {
    raw.push({ key: 'fat', kind: 'fat', label: '기름·지방', sub: '식용유·팜유·쇼트닝', grams: fat });
  }

  const kept = raw.filter((l) => l.grams > 0.01);
  kept.sort((a, b) => b.grams - a.grams);

  const fills = spreadFill(
    kept.map((l) => l.grams / weight),
    minRatio,
  );

  return kept.map((l, i) => ({
    ...l,
    grams: Math.round(l.grams * 10) / 10,
    ratio: l.grams / weight,
    fill: fills[i],
    percent: Math.round((l.grams / weight) * 1000) / 10,
    style: KIND_STYLE[l.kind] ?? KIND_STYLE.flour,
  }));
}

/** 작은 층도 보이도록 최소 높이를 주고 합이 1이 되게 맞춘다. */
export function spreadFill(ratios, minRatio = 0.055) {
  let fills = ratios.slice();
  if (!fills.length) return fills;
  for (let iter = 0; iter < 8; iter++) {
    const smallCount = fills.filter((f) => f < minRatio).length;
    if (!smallCount) break;
    const smallSum = fills.filter((f) => f < minRatio).reduce((a, b) => a + b, 0);
    const bigSum = 1 - smallSum;
    const room = Math.max(0, 1 - smallCount * minRatio);
    fills = fills.map((f) =>
      f < minRatio ? minRatio : f * (room / Math.max(bigSum, 1e-9)),
    );
  }
  const sum = fills.reduce((a, b) => a + b, 0);
  return sum > 0 ? fills.map((f) => f / sum) : fills;
}

/** 같은 카테고리에서 당류가 적은 대체 간식 (제휴 자리 검증용) */
export function lowSugarAlternatives(product, products, limit = 3) {
  const per100 = (p, key) => (num(p[key]) / Math.max(1, num(p.weight))) * 100;
  return products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .map((p) => ({ ...p, sugar100: Math.round(per100(p, 'sugar') * 10) / 10, sodium100: Math.round(per100(p, 'sodium')) }))
    .sort((a, b) => a.sugar100 - b.sugar100 || a.sodium100 - b.sodium100)
    .slice(0, limit);
}

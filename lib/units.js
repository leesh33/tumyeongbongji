// 영양성분 → 눈에 보이는 단위 환산.
// 기준: 라면 국물 한 국자 220mg 나트륨, 각설탕 한 개 3g, 밥숟가락 한 스푼 10g 지방.
import { APP } from '../config.js';

export const SODIUM_MG_PER_LADLE = APP.sodiumMgPerLadle; // 220
export const SUGAR_G_PER_CUBE = APP.sugarGPerCube; // 3
export const FAT_G_PER_SPOON = APP.fatGPerSpoon; // 10

export function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function round1(v) {
  return Math.round(v * 10) / 10;
}

/** 나트륨 mg → 라면 국물 국자 수 */
export function toLadle(mg) {
  return round1(num(mg) / SODIUM_MG_PER_LADLE);
}

/** 당류 g → 각설탕 개수 */
export function toCubes(g) {
  return round1(num(g) / SUGAR_G_PER_CUBE);
}

/** 지방 g → 밥숟가락 수 */
export function toSpoons(g) {
  return round1(num(g) / FAT_G_PER_SPOON);
}

/** 0.5 → "0.5", 2 → "2", 12.34 → "12.3" */
export function fmt(v) {
  const r = round1(num(v));
  if (Object.is(r, -0)) return '0';
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 값 표기: 100, 4.6, 0 */
export function fmtAmount(v) {
  const n = num(v);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

export function unitRows(product) {
  return [
    {
      key: 'sodium',
      kind: 'ladle',
      label: '나트륨',
      amount: `${fmtAmount(product.sodium)} mg`,
      value: toLadle(product.sodium),
      phrase: `라면 국물 ${fmt(toLadle(product.sodium))}국자`,
      short: `국자 ${fmt(toLadle(product.sodium))}`,
    },
    {
      key: 'sugar',
      kind: 'cube',
      label: '당류',
      amount: `${fmtAmount(product.sugar)} g`,
      value: toCubes(product.sugar),
      phrase: `각설탕 ${fmt(toCubes(product.sugar))}개`,
      short: `각설탕 ${fmt(toCubes(product.sugar))}`,
    },
    {
      key: 'fat',
      kind: 'spoon',
      label: '지방',
      amount: `${fmtAmount(product.fat)} g`,
      value: toSpoons(product.fat),
      phrase: `밥숟가락 ${fmt(toSpoons(product.fat))}스푼`,
      short: `숟가락 ${fmt(toSpoons(product.fat))}`,
    },
  ];
}

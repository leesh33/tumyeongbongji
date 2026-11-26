// 카드 SVG를 실제로 그려 보는 개발용 스크립트: node tools/preview.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { PRODUCTS } from '../data/products.js';
import { buildModel } from '../lib/model.js';
import { cardSVG } from '../lib/card-svg.js';

const ids = process.argv.slice(2);
const picks = ids.length ? ids.map((id) => PRODUCTS.find((p) => p.id === id)) : [
  PRODUCTS.find((p) => p.id === 'banana-kick'),
  PRODUCTS.find((p) => p.id === 'kkobuk-choco'),
  PRODUCTS.find((p) => p.id === 'shin-ramyun'),
  PRODUCTS.find((p) => p.id === 'coca-cola'),
];

const cards = picks
  .filter(Boolean)
  .map((p) => `<div class="slot">${cardSVG(buildModel(p)).svg}</div>`)
  .join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  body{margin:0;background:#E8DDD0;font-family:'Pretendard','-apple-system','Apple SD Gothic Neo',sans-serif;padding:16px}
  .slot{margin:0 0 20px;width:358px}
  .slot svg{display:block;filter:drop-shadow(0 6px 18px rgba(80,55,25,.14))}
</style></head><body>${cards}</body></html>`;

mkdirSync('downloads', { recursive: true });
writeFileSync('downloads/preview-cards.html', html);
console.log('wrote downloads/preview-cards.html', picks.length, 'cards');

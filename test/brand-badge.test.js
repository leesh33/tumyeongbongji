import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_COLORS,
  DEFAULT_BRAND_COLOR,
  KNOWN_BRANDS,
  brandBadge,
  brandStyle,
  brandSymbol,
  brandSymbolShapes,
} from '../lib/brand-badge.js';
import { PRODUCTS } from '../data/products.js';

const EXPECTED = [
  '농심',
  '오리온',
  '크라운',
  '해태',
  '롯데',
  '코카콜라',
  '빙그레',
  '스타벅스',
  '동아오츠카',
  '남양유업',
  '썬키스트',
  '삼양',
  '오뚜기',
  '팔도',
  'CJ제일제당',
  'GS25',
  '매일유업',
  '서울우유',
  '아이얌',
];

test('19개 제조사를 모두 덮는다', () => {
  assert.equal(KNOWN_BRANDS.length, EXPECTED.length);
  for (const name of EXPECTED) assert.ok(name in BRAND_COLORS, name);
});

test('색상은 모두 유효한 hex이고 서로 겹치지 않는다', () => {
  const colors = Object.values(BRAND_COLORS);
  for (const c of colors) assert.match(c, /^#[0-9A-F]{6}$/);
  assert.equal(new Set(colors).size, colors.length, '중복 색상이 있다');
});

test('카탈로그의 모든 제품 브랜드가 전용 심볼을 갖는다', () => {
  for (const p of PRODUCTS) {
    assert.ok(p.brand in BRAND_COLORS, `${p.id}: ${p.brand}`);
    assert.equal(brandStyle(p.brand).known, true, p.brand);
  }
});

test('심볼은 16×16 원형 SVG이고 브랜드 색을 쓴다', () => {
  for (const name of EXPECTED) {
    const svg = brandSymbol(name);
    assert.match(svg, /^<svg /, name);
    assert.match(svg, /viewBox="0 0 16 16"/, name);
    assert.match(svg, /aria-hidden="true"/, name);
    assert.ok(svg.includes(BRAND_COLORS[name]), `${name} 색 미적용`);
    assert.ok(svg.includes('</svg>'), name);
    assert.ok(!/<script/i.test(svg), name);
  }
});

test('제조사마다 도형이 다르다', () => {
  const shapes = EXPECTED.map((name) => brandSymbol(name));
  assert.equal(new Set(shapes).size, EXPECTED.length);
});

test('목록에 없는 제조사는 기본 중립 심볼', () => {
  const style = brandStyle('동네과자점');
  assert.equal(style.known, false);
  assert.equal(style.color, DEFAULT_BRAND_COLOR);
  const svg = brandSymbol('동네과자점');
  assert.ok(svg.includes(DEFAULT_BRAND_COLOR));
});

test('띄어쓰기가 달라도 같은 제조사로 본다', () => {
  assert.equal(brandStyle('CJ 제일제당').color, BRAND_COLORS['CJ제일제당']);
  assert.equal(brandStyle('  농심 ').color, BRAND_COLORS['농심']);
});

test('브랜드가 비면 딱지를 그리지 않는다', () => {
  for (const empty of ['', '   ', null, undefined]) {
    assert.equal(brandBadge(empty), '');
    assert.equal(brandSymbol(empty), '');
  }
});

test('딱지는 심볼 + 제조사 이름을 담는다', () => {
  const html = brandBadge('농심');
  assert.match(html, /^<span class="brand-badge">/);
  assert.ok(html.includes('class="bsym"'));
  assert.ok(html.includes('<span class="bname">농심</span>'));
  assert.match(brandBadge('오리온', { extraClass: 'sm' }), /class="brand-badge sm"/);
});

test('심볼 도형은 다른 SVG 안에 넣을 수 있게 내보낸다', () => {
  const shapes = brandSymbolShapes('농심');
  assert.ok(shapes.includes(BRAND_COLORS['농심']), '브랜드 색');
  assert.ok(!shapes.includes('<svg'), '바깥 <svg> 없이 도형만');
  assert.equal(brandSymbolShapes(''), '');
  assert.equal(brandSymbolShapes('   '), '');
  // brandSymbol은 같은 도형을 <svg>로 감싼 것
  assert.ok(brandSymbol('농심').includes(shapes));
  assert.ok(!brandSymbolShapes('<img src=x onerror="alert(1)">').includes('<img'));
});

test('제조사 이름은 XSS 안전하게 이스케이프된다', () => {
  const evil = '<img src=x onerror="alert(1)">';
  const html = brandBadge(evil);
  assert.ok(!html.includes('<img'), html);
  assert.ok(!html.includes('onerror="'), html);
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'), html);
  const svg = brandSymbol(evil);
  assert.ok(!svg.includes('<img'), svg);
});

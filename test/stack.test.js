import test from 'node:test';
import assert from 'node:assert/strict';
import { stackLayers, spreadFill, normalizeBulk, lowSugarAlternatives, CATEGORY_BULK } from '../lib/stack.js';
import { PRODUCTS } from '../data/products.js';

const bananaKick = PRODUCTS.find((p) => p.id === 'banana-kick');

test('층 무게 합은 제품 무게와 같다', () => {
  const layers = stackLayers(bananaKick);
  const sum = layers.reduce((s, l) => s + l.grams, 0);
  assert.ok(Math.abs(sum - bananaKick.weight) < 0.4, `sum=${sum}`);
});

test('당류·지방 층은 영양성분표 값 그대로', () => {
  const layers = stackLayers(bananaKick);
  const sugar = layers.find((l) => l.kind === 'sugar');
  const fat = layers.find((l) => l.kind === 'fat');
  assert.equal(sugar.grams, 37);
  assert.equal(fat.grams, 4.6);
});

test('무거운 층이 아래(앞)에 온다', () => {
  const layers = stackLayers(bananaKick);
  for (let i = 1; i < layers.length; i++) {
    assert.ok(layers[i - 1].grams >= layers[i].grams, '정렬이 무너짐');
  }
  assert.equal(layers[0].kind, 'sugar'); // 37g
});

test('fill 비율 합은 1이고 최소 높이를 지킨다', () => {
  for (const p of PRODUCTS) {
    const layers = stackLayers(p);
    const sum = layers.reduce((s, l) => s + l.fill, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `${p.id} fill sum=${sum}`);
    for (const l of layers) {
      assert.ok(l.fill >= 0.05 - 1e-9, `${p.id} ${l.label} fill=${l.fill}`);
      assert.ok(l.fill <= 1);
      assert.ok(l.percent >= 0);
    }
  }
});

test('당류+지방이 무게를 넘으면 잘라낸다', () => {
  const layers = stackLayers({ weight: 40, sugar: 60, fat: 10, category: 'snack' });
  const sum = layers.reduce((s, l) => s + l.grams, 0);
  assert.ok(sum <= 40.001, `sum=${sum}`);
});

test('당류·지방이 0이면 그 층은 만들지 않는다', () => {
  const layers = stackLayers({ weight: 350, sugar: 0, fat: 0, category: 'drink' });
  assert.ok(!layers.some((l) => l.kind === 'sugar'));
  assert.ok(!layers.some((l) => l.kind === 'fat'));
});

test('제품별 bulk가 있으면 그 비중을 쓴다', () => {
  const layers = stackLayers(bananaKick);
  assert.ok(layers.some((l) => l.label.includes('콘밀')));
  assert.ok(layers.some((l) => l.label.includes('바나나')));
});

test('bulk가 없으면 카테고리 기본값', () => {
  const layers = stackLayers({ weight: 100, sugar: 10, fat: 5, category: 'noodle' });
  const labels = layers.map((l) => l.label);
  assert.ok(labels.includes(CATEGORY_BULK.noodle[0].label));
});

test('normalizeBulk는 합을 1로 맞춘다', () => {
  const b = normalizeBulk([{ kind: 'flour', share: 2 }, { kind: 'salt', share: 1 }]);
  assert.equal(b.length, 2);
  assert.ok(Math.abs(b.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  assert.equal(normalizeBulk([]).length, 0);
});

test('spreadFill은 작은 값을 끌어올리고 합을 1로 유지', () => {
  const fills = spreadFill([0.9, 0.08, 0.02], 0.055);
  assert.ok(Math.abs(fills.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(fills.every((f) => f >= 0.055 - 1e-9));
});

test('저당 대체 간식은 같은 카테고리에서 당류가 적은 순', () => {
  const alts = lowSugarAlternatives(bananaKick, PRODUCTS, 3);
  assert.equal(alts.length, 3);
  assert.ok(alts.every((p) => p.category === 'snack' && p.id !== bananaKick.id));
  assert.ok(alts[0].sugar100 <= alts[1].sugar100);
});

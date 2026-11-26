import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, CATEGORIES, productById, categoryName } from '../data/products.js';

test('제품은 30종 이상', () => {
  assert.ok(PRODUCTS.length >= 30, `count=${PRODUCTS.length}`);
});

test('id는 중복이 없고 비어 있지 않다', () => {
  const ids = PRODUCTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PRODUCTS) assert.ok(p.id && p.id.length > 1);
});

test('네 카테고리를 모두 채운다', () => {
  for (const c of CATEGORIES) {
    const n = PRODUCTS.filter((p) => p.category === c.key).length;
    assert.ok(n >= 6, `${c.name} ${n}종`);
  }
});

test('필수 영양값이 숫자이고 범위를 지킨다', () => {
  for (const p of PRODUCTS) {
    for (const key of ['weight', 'kcal', 'sodium', 'sugar', 'fat']) {
      assert.equal(typeof p[key], 'number', `${p.id}.${key}`);
      assert.ok(p[key] >= 0, `${p.id}.${key}=${p[key]}`);
    }
    assert.ok(p.name && p.brand, p.id);
    assert.ok(p.ingredients.length >= 1, p.id);
    assert.ok(p.weight > 0, p.id);
    // 당류+지방은 무게를 넘지 않는다
    assert.ok(p.sugar + p.fat <= p.weight + 0.001, `${p.id} sugar+fat > weight`);
    // 열량 상한 (지방 9kcal/g + 탄수 4kcal/g 기준의 여유)
    assert.ok(p.kcal <= p.weight * 9 + 5, `${p.id} kcal=${p.kcal}`);
  }
});

test('bulk 비중은 양수이고 정규화하면 1이 된다', async () => {
  const { normalizeBulk } = await import('../lib/stack.js');
  for (const p of PRODUCTS) {
    if (!p.bulk) continue;
    for (const b of p.bulk) {
      assert.ok(b.kind && b.label, p.id);
      assert.ok(b.share > 0, `${p.id} share`);
    }
    const sum = normalizeBulk(p.bulk).reduce((s, b) => s + b.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${p.id} normalized=${sum}`);
  }
});

test('실제 영양성분 표기값을 반영한 과자 11종', () => {
  // 2026-11 제조사 공식 제품정보·식약처 DB 대조값(총 내용량 기준). 출처: data/nutrition-sources.md
  const expected = [
    ['banana-kick', 75, 320, 100, 37, 4.6],
    ['kkobuk-choco', 80, 426, 190, 26, 22],
    ['choco-songi', 50, 266, 110, 20, 14],
    ['choco-heim', 47, 250, 65, 17, 14],
    ['postick', 84, 395, 530, 3, 13],
    ['honey-butter-chip', 60, 325, 230, 3, 19],
    ['shrimp-cracker', 90, 465, 610, 5, 25],
    ['pocachip', 66, 377, 280, 0, 25],
    ['home-run-ball', 46, 270, 70, 15, 18],
    ['oyes', 30, 150, 60, 10, 9],
    ['pepero', 54, 270, 250, 15, 12],
  ];
  for (const [id, weight, kcal, sodium, sugar, fat] of expected) {
    const p = productById(id);
    assert.ok(p, id);
    assert.equal(p.weight, weight, `${id}.weight`);
    assert.equal(p.kcal, kcal, `${id}.kcal`);
    assert.equal(p.sodium, sodium, `${id}.sodium`);
    assert.equal(p.sugar, sugar, `${id}.sugar`);
    assert.equal(p.fat, fat, `${id}.fat`);
  }
});

test('열량이 탄수·단백·지방 계산값과 크게 어긋나지 않는다', () => {
  for (const p of PRODUCTS) {
    const macro = p.carbs * 4 + p.protein * 4 + p.fat * 9;
    const diff = Math.abs(macro - p.kcal);
    assert.ok(diff <= Math.max(12, p.kcal * 0.12), `${p.id} kcal=${p.kcal} macro=${Math.round(macro)}`);
  }
});

test('카테고리 이름 조회', () => {
  assert.equal(categoryName('snack'), '과자');
  assert.equal(categoryName('drink'), '음료');
  assert.equal(categoryName('noodle'), '라면·간편식');
  assert.equal(categoryName('kids'), '아기·키즈');
  assert.equal(categoryName('nope'), 'nope');
});

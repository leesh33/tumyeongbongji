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

test('실제 영양성분 표기값을 반영한 음료·라면·키즈 23종', () => {
  // 2026-11 제조사 공식 제품정보·식약처 DB·공식 판매페이지 표기(총 내용량 기준). 출처: data/nutrition-sources.md
  const expected = [
    ['coca-cola', 355, 152, 11, 38, 0, 38, 0],
    ['coke-zero', 355, 0, 22, 0, 0, 0, 0],
    ['banana-milk', 240, 208, 110, 27, 8, 27, 7],
    ['starbucks-double-shot', 200, 115, 85, 19, 2.4, 20, 3.8],
    ['starbucks-americano', 200, 20, 16, 0, 0, 5, 0],
    ['gatorade', 600, 160, 300, 39, 0, 40, 0],
    ['choco-emong', 250, 205, 110, 27, 6, 30, 7.5],
    ['sunkist-orange', 180, 85, 5, 18, 0, 21, 0],
    ['pocari-sweat', 500, 120, 250, 29, 0, 30, 0],
    ['shin-ramyun', 120, 500, 1790, 4, 16, 79, 10],
    ['buldak', 140, 530, 1280, 7, 16, 85, 12],
    ['jjapageti', 140, 610, 1100, 7, 20, 96, 11],
    ['cup-noodle', 37.8, 120, 890, 3, 0, 29, 1],
    ['bibim-myeon', 130, 525, 1090, 12, 19, 80, 9],
    ['haetban', 210, 315, 15, 0, 1.5, 68, 6],
    ['tuna-gimbap', 112, 224, 397, 1, 8, 32, 6],
    ['pororo-barley', 220, 0, 5, 0, 0, 0, 0],
    ['pororo-apple', 235, 75, 30, 11, 0, 20, 0],
    ['yomi-tteokppong', 30, 110, 15, 0, 0, 26, 2],
    ['baby-cheese', 18, 61, 47, 0, 5.2, 0, 3.5],
    ['maeil-milk', 200, 125, 100, 9, 7, 9, 6],
    ['iyum-apple-ring', 30, 110, 5, 0, 0.2, 25, 2],
    ['kids-yogurt', 80, 50, 25, 7, 0, 11, 1],
  ];
  assert.equal(expected.length, 23);
  for (const [id, weight, kcal, sodium, sugar, fat, carbs, protein] of expected) {
    const p = productById(id);
    assert.ok(p, id);
    assert.equal(p.weight, weight, `${id}.weight`);
    assert.equal(p.kcal, kcal, `${id}.kcal`);
    assert.equal(p.sodium, sodium, `${id}.sodium`);
    assert.equal(p.sugar, sugar, `${id}.sugar`);
    assert.equal(p.fat, fat, `${id}.fat`);
    assert.equal(p.carbs, carbs, `${id}.carbs`);
    assert.equal(p.protein, protein, `${id}.protein`);
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

test('2026-11-28 추가 27종 — 식약처 K-FIND·제조사 공식 표기값', () => {
  // 해태·팔도 공식 제품정보의 원재료 + 식약처 K-FIND 영양성분 DB(100g당)를 총 내용량으로 환산.
  // 출처·환산 기준: data/nutrition-sources.md
  const expected = [
    ['ace', 121, 653, 593, 9.7, 36.3, 73.8, 8.5],
    ['guun-gamja', 27, 130, 210, 2.0, 6.0, 19.0, 0.7],
    ['butterring-gold', 194, 1034, 421, 38.8, 52.4, 129.2, 12.9],
    ['butterring-esh', 86, 458, 187, 17.2, 25.8, 51.6, 5.7],
    ['sable', 252, 1235, 479, 70.6, 50.4, 181.4, 13.4],
    ['cream-wafer', 50, 255, 100, 14.0, 13.0, 32.0, 3.0],
    ['strawberry-wafer', 50, 245, 85, 14.0, 11.0, 34.0, 3.0],
    ['rolypoly', 62, 295, 110, 29.0, 10.0, 45.0, 6.0],
    ['oyes-mini', 192, 927, 417, 63.9, 51.3, 103.7, 12.8],
    ['oyes-coldbrew', 360, 1800, 1199, 119.9, 96.1, 204.1, 24.0],
    ['pocky', 46, 225, 160, 15.0, 10.0, 30.0, 4.0],
    ['pocky-thin', 44, 225, 150, 15.0, 11.0, 28.0, 4.0],
    ['khanchuricon', 90, 525, 720, 9.0, 36.0, 48.0, 3.0],
    ['guun-yangpa', 60, 350, 260, 3, 23, 33, 3],
    ['garubi-original', 55, 320, 180, 1.0, 21.0, 30.0, 3.0],
    ['garubi-salmon', 55, 305, 370, 3.0, 19.0, 31.0, 3.0],
    ['freetime', 36, 172, 55, 19.0, 8.0, 22.0, 3.0],
    ['freetime-cookies', 30, 135, 50, 16.8, 4.6, 22.0, 1.0],
    ['freetime-deul', 60, 295, 95, 27.0, 14.4, 36.0, 5.4],
    ['sunkist', 125, 521, 0, 78.1, 0.0, 130.2, 0.0],
    ['osatsu', 120, 720, 480, 20.0, 48.0, 68.0, 4.0],
    ['frenchpie-strawberry', 192, 887, 444, 59.1, 38.4, 118.1, 10.4],
    ['frenchpie-apple', 192, 887, 369, 59.1, 34.0, 132.9, 10.4],
    ['tayo', 140, 238, 147, 8.4, 9.8, 33.6, 4.2],
    ['ari-energy-lemon', 355, 10, 280, 0, 0, 2, 1],
    ['ari-energy-orange', 355, 10, 280, 0, 0, 2, 1],
    ['ari-energy-berry', 355, 10, 280, 0, 0, 2, 1],
  ];
  assert.equal(expected.length, 27);
  for (const [id, weight, kcal, sodium, sugar, fat, carbs, protein] of expected) {
    const p = productById(id);
    assert.ok(p, id);
    assert.equal(p.weight, weight, `${id}.weight`);
    assert.equal(p.kcal, kcal, `${id}.kcal`);
    assert.equal(p.sodium, sodium, `${id}.sodium`);
    assert.equal(p.sugar, sugar, `${id}.sugar`);
    assert.equal(p.fat, fat, `${id}.fat`);
    assert.equal(p.carbs, carbs, `${id}.carbs`);
    assert.equal(p.protein, protein, `${id}.protein`);
  }
});

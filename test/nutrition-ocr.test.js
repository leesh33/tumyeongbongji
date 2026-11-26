import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNutritionLabel, normalizeOcrText } from '../lib/nutrition-ocr.js';

test('표준 한국어 영양성분표를 모두 읽는다', () => {
  const r = parseNutritionLabel(`
    영양정보
    총 내용량 75 g
    열량 320 kcal
    나트륨 100mg (5%)
    탄수화물 66g (20%)
    당류 37g (37%)
    지방 4.6g (9%)
    트랜스지방 0g
    포화지방 2g (13%)
    단백질 3.2g (6%)
  `);
  assert.equal(r.weight, 75);
  assert.equal(r.unit, 'g');
  assert.equal(r.kcal, 320);
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 37);
  assert.equal(r.fat, 4.6);
  assert.equal(r.carbs, 66);
  assert.equal(r.protein, 3.2);
  assert.deepEqual(r.missing, []);
  assert.equal(r.found.length, 7);
});

test('붙여 쓴 OCR 텍스트도 읽는다', () => {
  const r = parseNutritionLabel(
    '총내용량75g열량320kcal나트륨100mg(5%)당류37g(37%)지방4.6g(9%)탄수화물66g단백질3.2g',
  );
  assert.equal(r.weight, 75);
  assert.equal(r.kcal, 320);
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 37);
  assert.equal(r.fat, 4.6);
  assert.equal(r.carbs, 66);
  assert.equal(r.protein, 3.2);
});

test('% 일일영양성분기준치 숫자를 값으로 쓰지 않는다', () => {
  const r = parseNutritionLabel('나트륨 100mg (5%)\n당류 12g 12%\n지방 4g [7 %]');
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 12);
  assert.equal(r.fat, 4);
});

test('소수점 쉼표와 천 단위 쉼표를 구분한다', () => {
  const r = parseNutritionLabel(`
    총 내용량 1,200 g
    나트륨 1,200mg (60%)
    당류 0,5 g
    지방 4,6 g
  `);
  assert.equal(r.weight, 1200);
  assert.equal(r.sodium, 1200);
  assert.equal(r.sugar, 0.5);
  assert.equal(r.fat, 4.6);
});

test('트랜스·포화지방은 순수 지방 값으로 쓰지 않는다', () => {
  const r = parseNutritionLabel('트랜스지방 0g\n포화지방 2g\n지방 12g');
  assert.equal(r.fat, 12);
});

test('포화지방만 있으면 지방은 비워 둔다', () => {
  const r = parseNutritionLabel('포화지방 2g\n트랜스지방 0g');
  assert.equal(r.fat, null);
});

test('단위가 표 머리글에 있는 표 형식도 읽는다', () => {
  const r = parseNutritionLabel('나트륨(mg) 100 5\n당류(g) 12 12\n지방(g) 4.6 9\n단백질(g) 5 9');
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 12);
  assert.equal(r.fat, 4.6);
  assert.equal(r.protein, 5);
});

test('OCR 숫자 혼동(O·l)을 보정한다', () => {
  const r = parseNutritionLabel('나트륨 1OOmg (5%)\n당류 l2g (12%)\n열량 32Okcal\n지방 4.6g');
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 12);
  assert.equal(r.kcal, 320);
  assert.equal(r.fat, 4.6);
});

test('ml 표기는 단위를 ml로 돌려준다', () => {
  const r = parseNutritionLabel('총 내용량 240 ml\n열량 208 kcal\n나트륨 110mg\n당류 27g\n지방 8g');
  assert.equal(r.weight, 240);
  assert.equal(r.unit, 'ml');
  assert.equal(r.kcal, 208);
});

test('글자 사이 공백이 끼어도 읽는다', () => {
  const r = parseNutritionLabel('나 트 륨 100 mg\n당 류 12 g\n탄 수 화 물 50 g\n단 백 질 5 g');
  assert.equal(r.sodium, 100);
  assert.equal(r.sugar, 12);
  assert.equal(r.carbs, 50);
  assert.equal(r.protein, 5);
});

test('총 내용량과 열량이 한 줄에 있어도 읽는다', () => {
  const r = parseNutritionLabel('총 내용량 75g / 355 kcal\n나트륨 100mg');
  assert.equal(r.weight, 75);
  assert.equal(r.kcal, 355);
  assert.equal(r.sodium, 100);
});

test('1회 제공량은 총 내용량으로 쓰지 않는다', () => {
  const r = parseNutritionLabel('총 내용량 120g (1회 제공량 30g)\n열량 500kcal\n지방 20g');
  assert.equal(r.weight, 120);
});

test('영어 라벨은 한국어로 못 읽은 칸만 보충한다', () => {
  const r = parseNutritionLabel(
    'Serving size 60 g\nCalories 280 kcal\nSodium 180 mg\nSugars 9 g\nFat 12 g\nSaturated Fat 3 g\nCarbohydrate 38 g\nProtein 4 g',
  );
  assert.equal(r.weight, 60);
  assert.equal(r.unit, 'g');
  assert.equal(r.kcal, 280);
  assert.equal(r.sodium, 180);
  assert.equal(r.sugar, 9);
  assert.equal(r.fat, 12);
  assert.equal(r.carbs, 38);
  assert.equal(r.protein, 4);
});

test('읽을 수 있는 값이 없으면 전부 null이고 예외를 내지 않는다', () => {
  for (const input of ['', '   ', null, undefined, '성분표를 못 읽었어요']) {
    const r = parseNutritionLabel(input);
    assert.equal(r.weight, null);
    assert.equal(r.kcal, null);
    assert.equal(r.sodium, null);
    assert.equal(r.sugar, null);
    assert.equal(r.fat, null);
    assert.equal(r.carbs, null);
    assert.equal(r.protein, null);
    assert.equal(r.found.length, 0);
    assert.equal(r.missing.length, 7);
    assert.equal(typeof r.text, 'string');
  }
});

test('일부만 읽히면 found/missing을 정확히 나눈다', () => {
  const r = parseNutritionLabel('나트륨 100mg\n당류 12g');
  assert.deepEqual(r.found, ['sodium', 'sugar']);
  assert.deepEqual(r.missing, ['weight', 'kcal', 'fat', 'carbs', 'protein']);
});

test('g를 8로 읽은 OCR 결과를 총 내용량·열량에 맞춰 되돌린다', () => {
  // 실제 Tesseract kor+eng가 Noto Sans KR 라벨에서 낸 텍스트
  const r = parseNutritionLabel(`
    종 내용량 75 8
    열량 320 kcal
    나트륨 100 mg 5%
    탄수화물 668 20%
    당류 378 37%
    지방 4.68 9%
    트랜스지방 08
    포화지방 28 13%
    단백질 3.28 6%
  `);
  assert.equal(r.weight, 75);
  assert.equal(r.kcal, 320);
  assert.equal(r.sodium, 100);
  assert.equal(r.carbs, 66);
  assert.equal(r.sugar, 37);
  assert.equal(r.fat, 4.6);
  assert.equal(r.protein, 3.2);
  assert.deepEqual(r.missing, []);
});

test('g를 0·9로 읽고 총 내용량까지 붙은 경우도 열량 정합성으로 되돌린다', () => {
  const r = parseNutritionLabel(`
    총 내용량 759
    열량 320 kcal
    나트륨 100 mg 5%
    탄수화물 669 20%
    당류 370 37%
    지방 4.69 9%
    단백질 3.2 0 6%
  `);
  assert.equal(r.carbs, 66);
  assert.equal(r.sugar, 37);
  assert.equal(r.fat, 4.6);
  assert.equal(r.protein, 3.2);
});

test('단위가 멀쩡히 읽혔거나 값이 그럴듯하면 건드리지 않는다', () => {
  const r = parseNutritionLabel('총 내용량 75g\n당류 18g\n탄수화물 38g\n지방 8g\n단백질 8g');
  assert.equal(r.sugar, 18);
  assert.equal(r.carbs, 38);
  assert.equal(r.fat, 8);
  assert.equal(r.protein, 8);

  const noUnit = parseNutritionLabel('총 내용량 200g\n열량 500kcal\n탄수화물 100 g\n단백질 8\n지방 10');
  assert.equal(noUnit.carbs, 100);
  assert.equal(noUnit.protein, 8);
  assert.equal(noUnit.fat, 10);
});

test('당류가 탄수화물보다 크면 단위 오인식으로 보고 줄인다', () => {
  const r = parseNutritionLabel('총 내용량 75g\n열량 320kcal\n탄수화물 66\n당류 378');
  assert.equal(r.carbs, 66);
  assert.equal(r.sugar, 37);
});

test('normalizeOcrText는 ㎎·㎖와 전각 문자를 반각으로 바꾼다', () => {
  assert.equal(normalizeOcrText('나트륨 １００㎎'), '나트륨 100mg');
  assert.equal(normalizeOcrText('내용량 ２４０㎖'), '내용량 240ml');
});

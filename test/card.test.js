import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSVG, spreadLabels } from '../lib/card-svg.js';
import { buildModel } from '../lib/model.js';
import { PRODUCTS } from '../data/products.js';
import { wrapText, textWidth } from '../lib/text.js';

const model = buildModel(PRODUCTS.find((p) => p.id === 'banana-kick'));

test('카드는 SVG 문자열로 만들어진다', () => {
  const { svg, width, height } = cardSVG(model);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.equal(width, 358);
  assert.ok(height > 600 && height < 900, `height=${height}`);
  assert.ok(svg.includes('바나나킥'));
  assert.ok(svg.includes('투명봉지'));
});

test('깨진 값이 들어가지 않는다', () => {
  for (const p of PRODUCTS) {
    const { svg } = cardSVG(buildModel(p));
    assert.ok(!svg.includes('NaN'), `${p.id} NaN`);
    assert.ok(!svg.includes('undefined'), `${p.id} undefined`);
    assert.ok(!svg.includes('null'), `${p.id} null`);
    assert.ok(!svg.includes('Infinity'), `${p.id} Infinity`);
  }
});

test('층마다 라벨과 무게가 그려진다', () => {
  const { svg } = cardSVG(model);
  for (const layer of model.layers) {
    assert.ok(svg.includes(layer.label), layer.label);
    assert.ok(svg.includes(`${layer.grams}g`), `${layer.grams}g`);
  }
});

test('고지 문구가 들어간다', () => {
  const { svg } = cardSVG(model);
  assert.ok(svg.includes('광고나 비하 의도'));
});

test('직접 입력값(원재료 없음)도 카드가 된다', () => {
  const m = buildModel({ id: 'custom', name: '내 과자', brand: '', category: 'snack', weight: 60, kcal: 300, sodium: 300, sugar: 12, fat: 8 });
  const { svg, height } = cardSVG(m);
  assert.ok(svg.includes('내 과자'));
  assert.ok(height > 500);
  assert.ok(!svg.includes('원재료'), '원재료 줄이 없어야 함');
});

test('긴 제품명은 글자를 줄여 카드 폭에 맞춘다', () => {
  const m = buildModel({ ...PRODUCTS[0], name: '아주아주아주아주아주 긴 이름의 특별한 과자 신제품' });
  const { svg } = cardSVG(m);
  assert.ok(svg.includes('font-size="16"') || svg.includes('font-size="17"'));
});

test('spreadLabels는 최소 간격을 지킨다', () => {
  const ys = spreadLabels([100, 104, 106, 300], 30, 90, 320);
  const sorted = [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i] - sorted[i - 1] >= 29.999, `${sorted[i - 1]} → ${sorted[i]}`);
  }
  assert.ok(sorted[0] >= 89.999);
  assert.ok(sorted[sorted.length - 1] <= 320.001);
});

test('wrapText는 폭을 넘지 않고 줄 수를 지킨다', () => {
  const lines = wrapText('옥수수(콘밀), 설탕, 팜올레인유, 바나나분말 1.6%, 정제소금, 향료', 10.5, 200, 2);
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(textWidth(line, 10.5) <= 200.5, line);
});

test('wrapText는 다 들어가면 …를 붙이지 않는다', () => {
  const d =
    '본 이미지는 영양성분표를 바탕으로 환산해 구현한 참고용 이미지로, 특정 제품의 광고나 비하 의도는 없습니다.';
  const lines = wrapText(d, 9.2, 314, 3);
  assert.ok(!lines.some((l) => l.endsWith('…')), lines.join(' / '));
  assert.equal(lines.join(' ').replace(/\s+/g, ''), d.replace(/\s+/g, ''));
});

test('wrapText는 넘치면 마지막 줄을 …로 자른다', () => {
  const d = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사';
  const lines = wrapText(d, 10, 60, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
});

test('wrapText는 한 단어가 길어도 폭을 넘지 않는다', () => {
  const lines = wrapText('아주아주아주아주아주아주아주긴단어', 10, 40, 2);
  for (const line of lines) assert.ok(textWidth(line, 10) <= 40.5, line);
});

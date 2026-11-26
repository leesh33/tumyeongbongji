import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toLadle,
  toCubes,
  toSpoons,
  fmt,
  unitRows,
  SODIUM_MG_PER_LADLE,
  SUGAR_G_PER_CUBE,
  FAT_G_PER_SPOON,
} from '../lib/units.js';

test('환산 기준값', () => {
  assert.equal(SODIUM_MG_PER_LADLE, 220);
  assert.equal(SUGAR_G_PER_CUBE, 3);
  assert.equal(FAT_G_PER_SPOON, 10);
});

test('나트륨: 참고 이미지 값과 같게 나온다', () => {
  assert.equal(fmt(toLadle(100)), '0.5');
  assert.equal(fmt(toLadle(110)), '0.5');
  assert.equal(fmt(toLadle(200)), '0.9');
  assert.equal(fmt(toLadle(230)), '1');
  assert.equal(fmt(toLadle(570)), '2.6');
});

test('당류: 3g 한 개 기준', () => {
  assert.equal(fmt(toCubes(37)), '12.3');
  assert.equal(fmt(toCubes(24)), '8');
  assert.equal(fmt(toCubes(20)), '6.7');
  assert.equal(fmt(toCubes(3)), '1');
  assert.equal(fmt(toCubes(0)), '0');
});

test('지방: 10g 한 스푼 기준', () => {
  assert.equal(fmt(toSpoons(4.6)), '0.5');
  assert.equal(fmt(toSpoons(22)), '2.2');
  assert.equal(fmt(toSpoons(14)), '1.4');
  assert.equal(fmt(toSpoons(15)), '1.5');
  assert.equal(fmt(toSpoons(19)), '1.9');
  assert.equal(fmt(toSpoons(9.5)), '1');
});

test('숫자 아닌 입력은 0으로 본다', () => {
  assert.equal(toLadle(''), 0);
  assert.equal(toLadle(undefined), 0);
  assert.equal(toCubes('abc'), 0);
});

test('fmt는 소수 한 자리까지만', () => {
  assert.equal(fmt(2), '2');
  assert.equal(fmt(2.33), '2.3');
  assert.equal(fmt(0.04), '0');
});

test('unitRows는 세 줄과 문구를 만든다', () => {
  const rows = unitRows({ sodium: 100, sugar: 37, fat: 4.6 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.key), ['sodium', 'sugar', 'fat']);
  assert.equal(rows[0].amount, '100 mg');
  assert.equal(rows[0].phrase, '라면 국물 0.5국자');
  assert.equal(rows[1].phrase, '각설탕 12.3개');
  assert.equal(rows[2].phrase, '밥숟가락 0.5스푼');
});

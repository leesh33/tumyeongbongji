import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogSource,
  isCatalogProduct,
  listProducts,
  productById,
  removeProduct,
  resetProducts,
  setProducts,
  upsertProduct,
} from '../lib/catalog.js';
import { PRODUCTS } from '../data/products.js';

test('처음에는 내장 34종을 쓴다', () => {
  resetProducts();
  assert.equal(listProducts().length, PRODUCTS.length);
  assert.equal(catalogSource(), 'fallback');
  assert.equal(productById('banana-kick').name, '바나나킥');
});

test('DB 목록으로 바꾸면 아이템 번호 순서로 정렬한다', () => {
  setProducts([
    { id: 'b', itemNo: 2, name: 'B' },
    { id: 'a', itemNo: 1, name: 'A' },
  ]);
  assert.deepEqual(
    listProducts().map((p) => p.id),
    ['a', 'b'],
  );
  assert.equal(catalogSource(), 'db');
});

test('빈 목록을 넣으면 내장 목록으로 되돌아간다', () => {
  setProducts([]);
  assert.equal(catalogSource(), 'fallback');
  assert.equal(listProducts().length, PRODUCTS.length);
});

test('수정·추가하면 목록에 바로 반영된다', () => {
  resetProducts();
  upsertProduct({ id: 'banana-kick', itemNo: 1, name: '바나나킥 새 이름' });
  assert.equal(productById('banana-kick').name, '바나나킥 새 이름');

  upsertProduct({ id: 'new-item', itemNo: 40, name: '새 아이템' });
  assert.equal(productById('new-item').name, '새 아이템');
  assert.equal(listProducts().length, PRODUCTS.length + 1);
});

test('삭제하면 목록에서 빠지고 카탈로그 판정도 바뀐다', () => {
  resetProducts();
  assert.equal(isCatalogProduct('banana-kick'), true);
  removeProduct('banana-kick');
  assert.equal(isCatalogProduct('banana-kick'), false);
  assert.equal(productById('banana-kick'), null);
  resetProducts();
  assert.equal(isCatalogProduct('banana-kick'), true);
});

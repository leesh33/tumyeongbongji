import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_EMAIL,
  ALT_PLATFORMS,
  PRODUCT_LIMITS,
  formatItemNo,
  isHttpUrl,
  itemNoQuery,
  matchesProductQuery,
  nextItemNo,
  normalizeAltLinks,
  parseIngredients,
  productToRow,
  rowToProduct,
  sanitizeAltLink,
  slugify,
  validateProductInput,
} from '../lib/admin.js';

const base = {
  name: '테스트 과자',
  brand: '농심',
  category: 'snack',
  unit: 'g',
  weight: 80,
  kcal: 400,
  sodium: 200,
  sugar: 10,
  fat: 12,
  carbs: 50,
  protein: 4,
  ingredients: '밀가루, 설탕, 팜유',
  note: '한줄 설명',
  altLinks: [],
};

test('아이템 번호: 세 자리로 채우고 잘못된 값은 빈 문자열', () => {
  assert.equal(formatItemNo(3), '#003');
  assert.equal(formatItemNo(34), '#034');
  assert.equal(formatItemNo(1234), '#1234');
  assert.equal(formatItemNo(0), '');
  assert.equal(formatItemNo(-2), '');
  assert.equal(formatItemNo('abc'), '');
  assert.equal(formatItemNo(null), '');
});

test('관리자 이메일은 브리프의 계정이다', () => {
  assert.equal(ADMIN_EMAIL, 'andy.leesh33@gmail.com');
});

test('대체상품 링크 주소는 http(s)만 허용한다', () => {
  assert.equal(isHttpUrl('https://www.coupang.com/vp/products/1'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('  https://example.com  '), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('JavaScript:alert(1)'), false);
  assert.equal(isHttpUrl('java\nscript:alert(1)'), false);
  assert.equal(isHttpUrl('data:text/html,<script>'), false);
  assert.equal(isHttpUrl('vbscript:msgbox'), false);
  assert.equal(isHttpUrl('//example.com'), false);
  assert.equal(isHttpUrl('ftp://example.com'), false);
  assert.equal(isHttpUrl(''), false);
  assert.equal(isHttpUrl(null), false);
  assert.equal(isHttpUrl(`https://example.com/${'a'.repeat(600)}`), false);
});

test('링크 한 건: 제목·주소가 맞아야 남고 플랫폼은 아는 값만', () => {
  const link = sanitizeAltLink({
    title: '  무설탕 쿠키  ',
    url: ' https://link.coupang.com/a/xyz ',
    platform: 'coupang',
    note: ' 당류 0g ',
  });
  assert.deepEqual(link, {
    title: '무설탕 쿠키',
    url: 'https://link.coupang.com/a/xyz',
    platform: 'coupang',
    note: '당류 0g',
  });

  assert.equal(sanitizeAltLink({ title: '', url: 'https://a.com' }), null);
  assert.equal(sanitizeAltLink({ title: 'x', url: 'javascript:alert(1)' }), null);
  assert.equal(sanitizeAltLink(null), null);

  const unknown = sanitizeAltLink({ title: 'x', url: 'https://a.com', platform: 'ebay' });
  assert.equal(unknown.platform, 'etc');

  const long = sanitizeAltLink({ title: 'a'.repeat(120), url: 'https://a.com' });
  assert.equal(long.title.length, PRODUCT_LIMITS.altTitleMax);
});

test('링크 목록: 잘못된 항목은 버리고 최대 개수까지만', () => {
  const list = normalizeAltLinks([
    { title: 'ok', url: 'https://a.com' },
    { title: 'bad', url: 'javascript:alert(1)' },
    null,
    { title: 'ok2', url: 'http://b.com', platform: 'naver' },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[1].platform, 'naver');

  const many = normalizeAltLinks(
    Array.from({ length: 10 }, (_, i) => ({ title: `t${i}`, url: `https://a.com/${i}` })),
  );
  assert.equal(many.length, PRODUCT_LIMITS.altLinksMax);
  assert.deepEqual(normalizeAltLinks('nope'), []);
});

test('원재료 문자열은 쉼표로 나누고 빈 항목을 버린다', () => {
  assert.deepEqual(parseIngredients(' 밀가루, 설탕 ,, 팜유 '), ['밀가루', '설탕', '팜유']);
  assert.deepEqual(parseIngredients(''), []);
  assert.deepEqual(parseIngredients(['밀가루', '']), ['밀가루']);
});

test('아이템 입력: 올바른 값이면 숫자·배열로 정리해 돌려준다', () => {
  const { ok, errors, value } = validateProductInput({ ...base, itemNo: '7' });
  assert.deepEqual(errors, {});
  assert.equal(ok, true);
  assert.equal(value.itemNo, 7);
  assert.equal(value.weight, 80);
  assert.deepEqual(value.ingredients, ['밀가루', '설탕', '팜유']);
  assert.deepEqual(value.altLinks, []);
  assert.equal(value.isActive, true);
});

test('아이템 입력: 이름·카테고리·단위·숫자 오류를 칸별로 알려 준다', () => {
  const { ok, errors } = validateProductInput({
    ...base,
    name: '   ',
    category: 'pizza',
    unit: 'kg',
    weight: '',
    kcal: '많이',
    sodium: -1,
  });
  assert.equal(ok, false);
  assert.match(errors.name, /제품명/);
  assert.match(errors.category, /카테고리/);
  assert.match(errors.unit, /g 또는 ml/);
  assert.match(errors.weight, /중량/);
  assert.match(errors.kcal, /열량/);
  assert.match(errors.sodium, /나트륨/);
});

test('아이템 입력: 링크 주소가 http(s)가 아니면 altLinks 오류', () => {
  const { ok, errors } = validateProductInput({
    ...base,
    altLinks: [{ title: '쿠팡', url: 'javascript:alert(1)', platform: 'coupang' }],
  });
  assert.equal(ok, false);
  assert.match(errors.altLinks, /http/);
});

test('아이템 입력: 링크 상품명이 비면 altLinks 오류', () => {
  const { ok, errors } = validateProductInput({
    ...base,
    altLinks: [{ title: ' ', url: 'https://a.com' }],
  });
  assert.equal(ok, false);
  assert.match(errors.altLinks, /상품명/);
});

test('아이템 입력: 아이템 번호가 정수가 아니면 오류', () => {
  const { ok, errors } = validateProductInput({ ...base, itemNo: '1.5' });
  assert.equal(ok, false);
  assert.match(errors.itemNo, /정수/);
});

test('DB 행 → 상품: 숫자는 Number로, alt_links는 정리해서', () => {
  const product = rowToProduct({
    item_no: '5',
    id: 'banana-kick',
    name: '바나나킥',
    brand: '농심',
    category: 'snack',
    unit: 'g',
    weight: '75',
    kcal: '320',
    sodium: '100',
    sugar: '37',
    fat: '4.6',
    carbs: '66',
    protein: '3.2',
    ingredients: ['옥수수'],
    bulk: [{ kind: 'flour', share: 1 }],
    note: '메모',
    alt_links: [
      { title: '쿠팡', url: 'https://a.com', platform: 'coupang' },
      { title: 'bad', url: 'javascript:1' },
    ],
    is_active: false,
  });
  assert.equal(product.itemNo, 5);
  assert.equal(product.weight, 75);
  assert.equal(product.fat, 4.6);
  assert.equal(product.altLinks.length, 1);
  assert.equal(product.isActive, false);
});

test('상품 → DB 행: alt_links·is_active·item_no 이름을 맞춘다', () => {
  const row = productToRow({
    ...base,
    id: 'x',
    itemNo: 12,
    altLinks: [{ title: '쿠팡', url: 'https://a.com', platform: 'coupang', note: '' }],
    isActive: false,
  });
  assert.equal(row.item_no, 12);
  assert.equal(row.is_active, false);
  assert.equal(row.alt_links.length, 1);
  assert.equal(row.altLinks, undefined);
});

test('상품 → DB 행: 아이템 번호가 없으면 item_no를 보내지 않는다(자동 채번)', () => {
  const row = productToRow({ ...base, id: 'x' });
  assert.equal('item_no' in row, false);
});

test('슬러그: 이름에서 URL용 아이디를 만든다', () => {
  assert.equal(slugify('쵸코 하임'), '쵸코-하임');
  assert.equal(slugify('  Choco  Heim!! '), 'choco-heim');
  assert.equal(slugify(''), '');
});

test('다음 아이템 번호는 지금 최대 + 1', () => {
  assert.equal(nextItemNo([{ itemNo: 3 }, { itemNo: 34 }, { itemNo: null }]), 35);
  assert.equal(nextItemNo([]), 1);
});

test('번호 검색: #012·12·012를 모두 받는다', () => {
  assert.equal(itemNoQuery('#012'), 12);
  assert.equal(itemNoQuery('12'), 12);
  assert.equal(itemNoQuery('012'), 12);
  assert.equal(itemNoQuery('바나나'), null);
  assert.equal(itemNoQuery(''), null);
});

test('목록 검색: 이름·제조사·원재료·번호로 찾는다', () => {
  const product = { itemNo: 4, name: '쵸코하임', brand: '크라운', ingredients: ['헤이즐넛페이스트'] };
  assert.equal(matchesProductQuery(product, '쵸코'), true);
  assert.equal(matchesProductQuery(product, '크라운'), true);
  assert.equal(matchesProductQuery(product, '헤이즐넛'), true);
  assert.equal(matchesProductQuery(product, '#004'), true);
  assert.equal(matchesProductQuery(product, '4'), true);
  assert.equal(matchesProductQuery(product, '농심'), false);
  assert.equal(matchesProductQuery(product, ''), true);
});

test('고객용 검색: 번호를 빼면 이름·제조사·원재료로만 찾는다', () => {
  const product = { itemNo: 4, name: '쵸코하임', brand: '크라운', ingredients: ['헤이즐넛페이스트'] };
  const opts = { includeItemNo: false };
  assert.equal(matchesProductQuery(product, '쵸코', opts), true);
  assert.equal(matchesProductQuery(product, '크라운', opts), true);
  assert.equal(matchesProductQuery(product, '헤이즐넛', opts), true);
  assert.equal(matchesProductQuery(product, '#004', opts), false);
  assert.equal(matchesProductQuery(product, '4', opts), false);
  assert.equal(matchesProductQuery(product, '012', opts), false);
  assert.equal(matchesProductQuery(product, '', opts), true);
});

test('플랫폼 목록은 쿠팡·네이버 쇼핑·기타', () => {
  assert.deepEqual(
    ALT_PLATFORMS.map((p) => p.key),
    ['coupang', 'naver', 'etc'],
  );
});

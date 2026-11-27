// 앱이 화면에 쓰는 상품 목록.
// DB(tumyeongbongji_products)에서 불러오면 그 목록을 쓰고,
// 네트워크·DB 문제가 있으면 data/products.js의 34종을 그대로 쓴다.
import { PRODUCTS } from '../data/products.js';

const FALLBACK = PRODUCTS;

let list = FALLBACK.slice();
let source = 'fallback';

export function listProducts() {
  return list;
}

export function catalogSource() {
  return source;
}

/** DB에서 받은 상품 목록으로 바꾼다 (빈 목록이면 fallback 유지) */
export function setProducts(next) {
  const rows = Array.isArray(next) ? next.filter((p) => p && p.id) : [];
  if (!rows.length) {
    list = FALLBACK.slice();
    source = 'fallback';
    return list;
  }
  list = rows.slice().sort((a, b) => (a.itemNo ?? 1e9) - (b.itemNo ?? 1e9));
  source = 'db';
  return list;
}

/** fallback으로 되돌린다 (DB를 못 읽었을 때) */
export function resetProducts() {
  list = FALLBACK.slice();
  source = 'fallback';
  return list;
}

export function productById(id) {
  return list.find((p) => p.id === id) ?? null;
}

/** 카탈로그에 있는(상세·댓글이 붙는) 제품인지 */
export function isCatalogProduct(id) {
  return list.some((p) => p.id === id);
}

/** 저장 직후 목록에 반영 (수정: 같은 id 교체 / 추가: 끝에 붙임) */
export function upsertProduct(product) {
  if (!product?.id) return list;
  const idx = list.findIndex((p) => p.id === product.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...product };
  else list.push(product);
  list = list.slice().sort((a, b) => (a.itemNo ?? 1e9) - (b.itemNo ?? 1e9));
  return list;
}

export function removeProduct(id) {
  list = list.filter((p) => p.id !== id);
  return list;
}

export const FALLBACK_PRODUCTS = FALLBACK;

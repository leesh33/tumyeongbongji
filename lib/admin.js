// 어드민(#/admin)에서 쓰는 순수 계산: 아이템 번호 표기, 대체상품 링크 검증,
// 상품 입력값 검증, DB 행 ↔ 앱 상품 변환.
// DOM 없이 돌아가므로 단위 테스트로 그대로 확인한다.
import { CATEGORIES } from '../data/products.js';

/** 관리자 계정 — 이 이메일로 로그인했을 때만 어드민 화면이 열린다. */
export const ADMIN_EMAIL = 'andy.leesh33@gmail.com';

export const PRODUCT_UNITS = [
  { key: 'g', label: 'g' },
  { key: 'ml', label: 'ml' },
];

/** 대체상품 링크 플랫폼 */
export const ALT_PLATFORMS = [
  { key: 'coupang', label: '쿠팡' },
  { key: 'naver', label: '네이버 쇼핑' },
  { key: 'etc', label: '기타' },
];

export const PLATFORM_LABEL = Object.fromEntries(ALT_PLATFORMS.map((p) => [p.key, p.label]));

export const PRODUCT_LIMITS = {
  nameMax: 40,
  brandMax: 20,
  noteMax: 80,
  ingredientMax: 40,
  ingredientsMax: 30,
  altLinksMax: 6,
  altTitleMax: 60,
  altNoteMax: 40,
  urlMax: 500,
  itemNoMax: 99999,
};

export const ADMIN_TABS = [
  { key: 'items', label: '아이템·성분' },
  { key: 'comments', label: '댓글' },
  { key: 'feedback', label: '제안·제보' },
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

/** 3 → '#003', 34 → '#034' */
export function formatItemNo(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return '';
  return `#${String(n).padStart(3, '0')}`;
}

/**
 * 링크 주소는 http(s)만 허용한다.
 * `javascript:`·`data:`·`vbscript:` 같은 스킴은 상세 화면에서 그대로 href로 쓰이므로
 * 여기서 막아야 한다(대소문자·공백·제어문자 우회 포함).
 */
export function isHttpUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > PRODUCT_LIMITS.urlMax) return false;
  // 제어문자/공백이 섞이면 브라우저가 다르게 해석할 수 있어 거절한다
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f]/.test(raw)) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

const clampText = (value, max) => String(value ?? '').trim().slice(0, max);

/** 링크 한 건 정리 — 제목이나 주소가 없거나 주소가 http(s)가 아니면 null */
export function sanitizeAltLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clampText(raw.title, PRODUCT_LIMITS.altTitleMax);
  const url = String(raw.url ?? '').trim();
  if (!title || !isHttpUrl(url)) return null;
  const platform = ALT_PLATFORMS.some((p) => p.key === raw.platform) ? raw.platform : 'etc';
  return { title, url, platform, note: clampText(raw.note, PRODUCT_LIMITS.altNoteMax) };
}

/** 링크 목록 정리 — 잘못된 항목은 버리고 최대 개수까지만 */
export function normalizeAltLinks(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const link = sanitizeAltLink(item);
    if (link) out.push(link);
    if (out.length >= PRODUCT_LIMITS.altLinksMax) break;
  }
  return out;
}

/** 입력 폼의 '원재료 쉼표 구분' 문자열 → 배열 */
export function parseIngredients(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  return list
    .map((v) => clampText(v, PRODUCT_LIMITS.ingredientMax))
    .filter(Boolean)
    .slice(0, PRODUCT_LIMITS.ingredientsMax);
}

const asNumber = (value) => (value === '' || value === null || value === undefined ? NaN : Number(value));

/**
 * 아이템 추가·수정 폼 검증. 실패하면 errors에 칸별 한국어 안내를 담는다.
 * @param {object} input 폼 값 (문자열 그대로)
 * @returns {{ok:boolean, errors:Record<string,string>, value:object|null}}
 */
export function validateProductInput(input = {}) {
  const errors = {};

  const name = clampText(input.name, PRODUCT_LIMITS.nameMax);
  if (!name) errors.name = '제품명을 입력해 주세요.';

  const brand = clampText(input.brand, PRODUCT_LIMITS.brandMax);

  const category = String(input.category ?? '');
  if (!CATEGORY_KEYS.includes(category)) errors.category = '카테고리를 골라 주세요.';

  const unit = String(input.unit ?? 'g');
  if (!PRODUCT_UNITS.some((u) => u.key === unit)) errors.unit = '단위는 g 또는 ml만 쓸 수 있어요.';

  const numbers = {};
  const numberRules = [
    ['weight', '중량', { min: 0.1, max: 100000 }],
    ['kcal', '열량', { min: 0, max: 5000 }],
    ['sodium', '나트륨', { min: 0, max: 20000 }],
    ['sugar', '당류', { min: 0, max: 1000 }],
    ['fat', '지방', { min: 0, max: 1000 }],
    ['carbs', '탄수화물', { min: 0, max: 1000 }],
    ['protein', '단백질', { min: 0, max: 1000 }],
  ];
  for (const [key, label, { min, max }] of numberRules) {
    const n = asNumber(input[key] === undefined && key === 'carbs' ? 0 : input[key]);
    if (!Number.isFinite(n)) errors[key] = `${label}을 숫자로 입력해 주세요.`;
    else if (n < min || n > max) errors[key] = `${label}은 ${min}~${max} 사이로 입력해 주세요.`;
    else numbers[key] = n;
  }

  let itemNo = null;
  if (input.itemNo !== '' && input.itemNo !== null && input.itemNo !== undefined) {
    const n = Number(input.itemNo);
    if (!Number.isInteger(n) || n <= 0 || n > PRODUCT_LIMITS.itemNoMax) {
      errors.itemNo = `아이템 번호는 1~${PRODUCT_LIMITS.itemNoMax} 사이 정수예요.`;
    } else {
      itemNo = n;
    }
  }

  const note = clampText(input.note, PRODUCT_LIMITS.noteMax);
  const ingredients = parseIngredients(input.ingredients);

  // 링크: 제목·주소 중 하나라도 적었는데 주소가 http(s)가 아니면 알려 준다
  const rawLinks = Array.isArray(input.altLinks) ? input.altLinks : [];
  if (rawLinks.length > PRODUCT_LIMITS.altLinksMax) {
    errors.altLinks = `대체상품 링크는 ${PRODUCT_LIMITS.altLinksMax}개까지 넣을 수 있어요.`;
  }
  for (const link of rawLinks) {
    const hasAny = String(link?.title ?? '').trim() || String(link?.url ?? '').trim();
    if (!hasAny) continue;
    if (!String(link.title ?? '').trim()) errors.altLinks = '링크 상품명을 입력해 주세요.';
    else if (!isHttpUrl(link.url)) errors.altLinks = '링크 주소는 http:// 또는 https://로 시작해야 해요.';
  }
  const altLinks = normalizeAltLinks(rawLinks);

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          ...(itemNo ? { itemNo } : {}),
          name,
          brand,
          category,
          unit,
          ...numbers,
          ingredients,
          note,
          altLinks,
          isActive: input.isActive === undefined ? true : Boolean(input.isActive),
        }
      : null,
  };
}

/** DB 행(PostgREST) → 앱이 쓰는 상품 객체 */
export function rowToProduct(row) {
  if (!row || typeof row !== 'object') return null;
  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    id: String(row.id ?? ''),
    itemNo: Number.isInteger(Number(row.item_no)) ? Number(row.item_no) : null,
    name: String(row.name ?? ''),
    brand: String(row.brand ?? ''),
    category: String(row.category ?? 'snack'),
    unit: row.unit === 'ml' ? 'ml' : 'g',
    weight: num(row.weight),
    kcal: num(row.kcal),
    sodium: num(row.sodium),
    sugar: num(row.sugar),
    fat: num(row.fat),
    carbs: num(row.carbs),
    protein: num(row.protein),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    bulk: Array.isArray(row.bulk) ? row.bulk : [],
    note: String(row.note ?? ''),
    altLinks: normalizeAltLinks(row.alt_links),
    isActive: row.is_active !== false,
  };
}

/** 앱 상품 객체 → 저장할 행(POST/PATCH 본문) */
export function productToRow(product = {}) {
  const row = {
    id: String(product.id ?? '').trim(),
    name: String(product.name ?? '').trim(),
    brand: String(product.brand ?? '').trim(),
    category: String(product.category ?? 'snack'),
    unit: product.unit === 'ml' ? 'ml' : 'g',
    weight: Number(product.weight),
    kcal: Number(product.kcal),
    sodium: Number(product.sodium),
    sugar: Number(product.sugar),
    fat: Number(product.fat),
    carbs: Number(product.carbs ?? 0),
    protein: Number(product.protein ?? 0),
    ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
    bulk: Array.isArray(product.bulk) ? product.bulk : [],
    note: String(product.note ?? ''),
    alt_links: normalizeAltLinks(product.altLinks),
    is_active: product.isActive !== false,
  };
  if (Number.isInteger(Number(product.itemNo)) && Number(product.itemNo) > 0) {
    row.item_no = Number(product.itemNo);
  }
  return row;
}

/** 제품명에서 URL에 쓸 수 있는 슬러그를 만든다 (한글은 그대로 두고 공백만 -로) */
export function slugify(value) {
  const base = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s/\\?#&%]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base;
}

/** 새 아이템 기본 번호 (지금 목록의 최대 + 1) */
export function nextItemNo(products = []) {
  const max = products.reduce((m, p) => (Number.isInteger(p.itemNo) && p.itemNo > m ? p.itemNo : m), 0);
  return max + 1;
}

/** 검색어가 아이템 번호(#012, 12, 012)인지 */
export function itemNoQuery(value) {
  const raw = String(value ?? '').trim();
  const m = raw.match(/^#?\s*(\d{1,5})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 목록·검색: 이름·제조사·원재료·아이템 번호로 찾는다 */
export function matchesProductQuery(product, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const no = itemNoQuery(q);
  if (no !== null) return Number(product.itemNo) === no;
  const hay = [
    product.name,
    product.brand,
    ...(product.ingredients ?? []),
    product.itemNo ? formatItemNo(product.itemNo) : '',
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

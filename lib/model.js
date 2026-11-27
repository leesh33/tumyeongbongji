// 제품(또는 직접 입력) → 카드에 그릴 하나의 모델.
import { CATEGORIES } from '../data/products.js';
import { stackLayers } from './stack.js';
import { unitRows, fmtAmount } from './units.js';

export function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.name ?? '기타';
}

export function buildModel(product) {
  const rows = unitRows(product);
  const unit = product.unit === 'ml' ? 'ml' : 'g';
  const weight = fmtAmount(product.weight);
  return {
    id: product.id ?? 'custom',
    name: product.name || '이름 없는 간식',
    brand: String(product.brand ?? '').trim(),
    category: product.category ?? 'snack',
    categoryName: categoryLabel(product.category ?? 'snack'),
    unit,
    weight,
    serving: `${weight}${unit} 기준`,
    kcal: product.kcal === '' || product.kcal == null ? null : Math.round(Number(product.kcal)),
    rows,
    layers: stackLayers({ ...product, category: product.category ?? 'snack' }),
    ingredients: (product.ingredients ?? []).filter(Boolean),
    note: product.note ?? '',
  };
}

export function summaryLine(model) {
  const kcal = model.kcal == null ? '열량 미표기' : `${model.kcal} kcal`;
  return `${model.serving.replace('*', '')} · ${kcal}`;
}

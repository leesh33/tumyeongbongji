// 영양성분표 OCR 텍스트 → 숫자 필드 파서.
// 순수 함수만 둔다. DOM·Tesseract에 의존하지 않아 노드 테스트와 브라우저에서 같이 쓴다.
//
// 다루는 표기 변형:
//   - "총 내용량 75g", "총내용량 75 g", "내용량 240ml"
//   - "열량 320 kcal", "칼로리 152", "355kcal" (열량 라벨 없이 단위만 있는 경우)
//   - "나트륨 100mg (5%)", "나트륨(mg) 100 5" → 괄호·%의 일일영양성분기준치 숫자를 버리고 100
//   - "당류 37 g", "당 류 12g", "당뉴 12g"(류 오인식)
//   - "트랜스지방 0g", "포화지방 2g"은 지방 값으로 쓰지 않는다.
//   - 소수점 쉼표 "4,6g" → 4.6, 천 단위 쉼표 "1,200mg" → 1200
//   - OCR 숫자 혼동 "1OOmg" → 100, "l2g" → 12
//   - 단위 g가 8·0·9·6으로 읽힌 경우("668" = 66g, "3.28" = 3.2g)는
//     총 내용량·열량과의 정합성으로 되돌린다.
//
// 자동 인식 값은 참고값이다. 화면에서 사용자가 고칠 수 있게 두는 것을 전제로 한다.

const FIELDS = ['weight', 'kcal', 'sodium', 'sugar', 'fat', 'carbs', 'protein'];

// g를 잘못 읽을 때 흔히 나오는 글자
const G_CONFUSION = /[0689q]$/i;

/** OCR이 흔히 흘리는 문자를 숫자 문맥에서만 보정하고, %·쉼표 표기를 정리한다. */
export function normalizeOcrText(raw) {
  if (raw == null) return '';
  let t = String(raw).normalize('NFKC'); // 전각·㎎·㎖ → mg·ml
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/[\u00a0\u2000-\u200b\u3000]/g, ' ');
  t = t.replace(/[|│┃¦]/g, ' ');

  // 일일영양성분기준치 비율(%)은 값이 아니다. 먼저 지운다. "(5%)", "[5 %]", "5%" 모두.
  t = t.replace(/[([{]?\s*\d{1,3}(?:[.,]\d+)?\s*%\s*[)\]}]?/g, ' ');

  // 천 단위 쉼표: 1,200mg → 1200mg / 소수점 쉼표: 4,6g → 4.6g
  t = t.replace(/(\d),(?=\d{3}(?!\d)\s*(?:mg|g|ml|kg|kcal))/gi, '$1');
  t = t.replace(/(\d),(?=\d{1,2}\s*(?:mg|g|ml|kg|kcal))/gi, '$1.');

  // "4. 6g"처럼 소수점 뒤가 떨어진 경우
  t = t.replace(/(\d)\.\s+(\d{1,2})\s*(?=(?:mg|g|ml|kg|kcal)\b)/gi, '$1.$2');

  // OCR 숫자 혼동 — 숫자 사이 또는 숫자+단위 사이에 낀 O/o/Q, l/I
  // "1OOmg"처럼 여러 글자가 붙은 경우도 숫자 개수만큼 0으로 되돌린다.
  t = t.replace(/(\d)([OoQ]+)(?=\d|\s*(?:mg|g|ml|kg|kcal)\b)/gi, (_, d, run) => d + '0'.repeat(run.length));
  t = t.replace(/(\d)([lI]+)(?=\s*(?:mg|g|ml|kg|kcal)\b)/g, (_, d, run) => d + '1'.repeat(run.length));
  t = t.replace(/(\d)[OoQ](?=\d)/g, '$10');
  t = t.replace(/(\d)[OoQ](?=\s*(?:mg|g|ml|kg|kcal)\b)/gi, '$10');
  t = t.replace(/(^|[^\w가-힣])[lI](?=\d)/g, '$11');
  t = t.replace(/(\d)[lI](?=\s*(?:mg|g|ml|kg|kcal)\b)/gi, '$11');

  return t;
}

function toNumber(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** 라벨 바로 뒤의 숫자 하나. 단위는 있는지만 본다. */
function firstValue(text, re) {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m ? toNumber(m[1]) : null;
}

/** g 단위 영양소 한 칸: 값·원문·단위가 읽혔는지 */
function extractGram(text, re) {
  re.lastIndex = 0;
  const m = re.exec(text);
  if (!m) return null;
  const value = toNumber(m[1]);
  if (value == null) return null;
  return { value, raw: String(m[1]), unitSeen: Boolean(m[2]) };
}

const RE_SUGAR = /(?:총\s*)?당\s*[류뉴]\s*(?:\(\s*g\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(g(?![a-z]))?/i;
const RE_CARBS = /탄\s*수\s*화\s*물\s*(?:\(\s*g\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(g(?![a-z]))?/i;
const RE_PROTEIN = /단\s*백\s*질\s*(?:\(\s*g\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(g(?![a-z]))?/i;
const RE_FAT =
  /(트랜스|포화|불포화)?\s*지\s*방\s*(?:\(\s*g\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(g(?![a-z]))?/gi;

function parseWeight(text) {
  const re =
    /(?:총\s*)?(?:내\s*용\s*량|중\s*량)\s*(?:\(\s*(g|ml)\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(g|ml|kg)?/i;
  const m = re.exec(text);
  if (!m) return null;
  let value = toNumber(m[2]);
  if (!(value > 0)) return null;
  let unit = (m[1] || m[3] || '').toLowerCase() || null;
  if (unit === 'kg') {
    value = Math.round(value * 1000);
    unit = 'g';
  }
  return { value, unit: unit === 'ml' ? 'ml' : unit === 'g' ? 'g' : null, raw: String(m[2]) };
}

function parseFat(text) {
  // 트랜스/포화/불포화 지방은 건너뛰고 순수 "지방" 행만 쓴다.
  RE_FAT.lastIndex = 0;
  let m;
  while ((m = RE_FAT.exec(text))) {
    if (m[1]) continue;
    const value = toNumber(m[2]);
    if (value == null) continue;
    return { value, raw: String(m[2]), unitSeen: Boolean(m[3]) };
  }
  return null;
}

function decimalPlaces(raw) {
  const m = /[.,](\d+)$/.exec(String(raw));
  return m ? m[1].length : 0;
}

/** "3.28"(=3.2g), "668"(=66g)처럼 단위 g가 숫자로 붙은 경우를 한 글자 줄여 본다. */
function trimmed(field) {
  if (!field || field.unitSeen) return null;
  const raw = field.raw;
  if (raw.length < 2 || !G_CONFUSION.test(raw)) return null;
  const nextRaw = raw.slice(0, -1);
  const value = toNumber(nextRaw);
  if (value == null || value < 0) return null;
  return { value, raw: nextRaw, unitSeen: false };
}

/**
 * 단위가 사라진 g 값들을 서로 맞춰 본다.
 * - 소수 두 자리 이상이면 끝 글자는 단위 오인식으로 본다(3.28 → 3.2).
 * - 총 내용량보다 훨씬 큰 값은 끝 글자를 뗀다(668 → 66).
 * - 열량과 탄·단·지 계산이 크게 어긋나면 끝 글자를 떼어 본다.
 * - 당류가 탄수화물보다 크면 당류 끝 글자를 뗀다.
 */
function repairGramFields(weight, kcal, fields) {
  const list = Object.values(fields).filter(Boolean);

  for (const f of list) {
    const t = trimmed(f);
    if (t && decimalPlaces(f.raw) >= 2) Object.assign(f, t);
  }

  if (weight > 0) {
    for (const f of list) {
      for (let i = 0; i < 2 && f.value > weight * 1.5; i++) {
        const t = trimmed(f);
        if (!t) break;
        Object.assign(f, t);
      }
    }
  }

  const macroError = () => {
    if (!(kcal > 0) || !fields.carbs || !fields.fat || !fields.protein) return null;
    const est = 4 * fields.carbs.value + 4 * fields.protein.value + 9 * fields.fat.value;
    return Math.abs(est - kcal) / kcal;
  };

  let err = macroError();
  if (err != null && err > 0.25) {
    for (const key of ['carbs', 'fat', 'protein']) {
      const t = trimmed(fields[key]);
      if (!t) continue;
      const before = fields[key].value;
      Object.assign(fields[key], t);
      const next = macroError();
      if (next == null || next < err - 0.1) err = next;
      else fields[key].value = before; // 되돌리기
    }
  }

  if (fields.sugar && fields.carbs && fields.sugar.value > fields.carbs.value) {
    const t = trimmed(fields.sugar);
    if (t && t.value <= fields.carbs.value) Object.assign(fields.sugar, t);
  }
}

function parseEnglish(text) {
  // 수입 과자 라벨 보조. 한국어 라벨에서 못 찾은 칸만 채운다.
  const out = {};
  const serving = /serv(?:ing)?\s*size\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(g|ml)/i.exec(text);
  if (serving) {
    out.weight = toNumber(serving[1]);
    out.unit = serving[2].toLowerCase();
  }
  const kcal = /(?:calories|energy)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kcal)?/i.exec(text);
  if (kcal) out.kcal = toNumber(kcal[1]);
  const sodium = /sodium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i.exec(text);
  if (sodium) out.sodium = toNumber(sodium[1]);
  const sugar = /(?:total\s*)?sugars?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i.exec(text);
  if (sugar) out.sugar = toNumber(sugar[1]);
  const carbs = /(?:total\s*)?carbohydrates?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i.exec(text);
  if (carbs) out.carbs = toNumber(carbs[1]);
  const protein = /protein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i.exec(text);
  if (protein) out.protein = toNumber(protein[1]);

  const fatRe = /(saturated|trans|polyunsaturated|monounsaturated)?\s*fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/gi;
  let m;
  while ((m = fatRe.exec(text))) {
    if (m[1]) continue;
    out.fat = toNumber(m[2]);
    break;
  }
  return out;
}

/**
 * 영양성분표 OCR 텍스트를 필드로 바꾼다.
 * @param {string} rawText Tesseract가 낸 텍스트
 * @returns {{weight:number|null, unit:'g'|'ml'|null, kcal:number|null,
 *   sodium:number|null, sugar:number|null, fat:number|null, carbs:number|null,
 *   protein:number|null, found:string[], missing:string[], text:string}}
 */
export function parseNutritionLabel(rawText) {
  const text = normalizeOcrText(rawText);

  const weight = parseWeight(text);
  let kcal =
    firstValue(text, /(?:열\s*량|칼로리)\s*(?:\(\s*kcal\s*\))?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:kcal|cal)?/i) ??
    firstValue(text, /(\d+(?:[.,]\d+)?)\s*kcal/i);
  const sodium = firstValue(
    text,
    /나\s*트\s*륨\s*(?:\(\s*mg\s*\)|mg)?\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:mg)?/i,
  );

  const fields = {
    sugar: extractGram(text, RE_SUGAR),
    fat: parseFat(text),
    carbs: extractGram(text, RE_CARBS),
    protein: extractGram(text, RE_PROTEIN),
  };

  // 한국어 라벨에서 못 읽은 칸만 영어 표기로 보충한다.
  const en = parseEnglish(text);
  const weightValue = weight?.value ?? (en.weight ?? null);
  if (kcal == null && en.kcal != null) kcal = en.kcal;

  repairGramFields(weightValue ?? 0, kcal ?? 0, fields);

  const result = {
    weight: weightValue,
    unit: weight?.unit ?? en.unit ?? null,
    kcal: kcal ?? null,
    sodium: sodium ?? en.sodium ?? null,
    sugar: fields.sugar?.value ?? en.sugar ?? null,
    fat: fields.fat?.value ?? en.fat ?? null,
    carbs: fields.carbs?.value ?? en.carbs ?? null,
    protein: fields.protein?.value ?? en.protein ?? null,
  };

  result.found = FIELDS.filter((k) => result[k] != null);
  result.missing = FIELDS.filter((k) => result[k] == null);
  result.text = text;
  return result;
}

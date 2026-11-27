// 제안·제보 게시판과 제품별 댓글의 순수 로직.
// 네트워크는 lib/supabase.js가 맡고, 여기서는 문자열·배열만 다룬다(테스트하기 쉽게).

export const BOARD_CATEGORIES = [
  { key: 'new_product', name: '제품 추가 요청', emoji: '🙋', short: '제품 추가' },
  { key: 'fix_info', name: '성분 수정 제보', emoji: '🔍', short: '성분 수정' },
  { key: 'feature', name: '기능 제안', emoji: '💡', short: '기능 제안' },
];

/** 글자 수 한도 (서버의 char_length 검사와 같은 범위) */
export const FEEDBACK_LIMITS = { titleMin: 2, titleMax: 80, bodyMin: 2, bodyMax: 600, nicknameMax: 20 };
export const COMMENT_LIMITS = { bodyMin: 1, bodyMax: 300, nicknameMax: 20 };

export const DEFAULT_NICKNAME = '익명';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const isBoardCategory = (key) => BOARD_CATEGORIES.some((c) => c.key === key);

export function categoryName(key) {
  return BOARD_CATEGORIES.find((c) => c.key === key)?.name ?? '기타';
}

export function categoryEmoji(key) {
  return BOARD_CATEGORIES.find((c) => c.key === key)?.emoji ?? '📝';
}

/** 접수됨 / 반영됨 */
export function statusLabel(status) {
  return status === 'done' ? '반영됨' : '접수됨';
}

/** 코드 포인트 기준 글자 수 (Postgres char_length와 같은 셈) */
export function countChars(value) {
  return [...String(value ?? '')].length;
}

/** 여러 줄 글: 줄바꿈 정리 + 앞뒤 공백 제거. 세 줄 이상 빈 줄은 두 줄로. */
export function normalizeBody(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 닉네임: 한 줄로 눌러 쓰고, 비면 '익명' */
export function normalizeNickname(value) {
  return (
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim() || DEFAULT_NICKNAME
  );
}

/** 본문에 쓸 때 줄바꿈만 살린 한 줄 제목 */
export function normalizeTitle(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 게시판 글 검증.
 * @returns {{ok:boolean, errors:Record<string,string>, value:{category:string,title:string,body:string,nickname:string}}}
 */
export function validateFeedback(input = {}) {
  const category = isBoardCategory(input.category) ? input.category : '';
  const title = normalizeTitle(input.title);
  const body = normalizeBody(input.body);
  const nickname = normalizeNickname(input.nickname);
  const errors = {};

  if (!category) errors.category = '분류를 하나 골라 주세요.';

  const titleLen = countChars(title);
  if (titleLen < FEEDBACK_LIMITS.titleMin) errors.title = '제목을 2자 이상 적어 주세요.';
  else if (titleLen > FEEDBACK_LIMITS.titleMax)
    errors.title = `제목은 80자까지 쓸 수 있어요. 지금 ${titleLen}자예요.`;

  const bodyLen = countChars(body);
  if (bodyLen < FEEDBACK_LIMITS.bodyMin) errors.body = '내용을 2자 이상 적어 주세요.';
  else if (bodyLen > FEEDBACK_LIMITS.bodyMax)
    errors.body = `내용은 600자까지 쓸 수 있어요. 지금 ${bodyLen}자예요.`;

  if (countChars(nickname) > FEEDBACK_LIMITS.nicknameMax)
    errors.nickname = `닉네임은 20자까지 쓸 수 있어요. (지금 ${countChars(nickname)}자)`;

  return { ok: Object.keys(errors).length === 0, errors, value: { category, title, body, nickname } };
}

/**
 * 제품별 댓글 검증.
 * @returns {{ok:boolean, errors:Record<string,string>, value:{productId:string,body:string,nickname:string}}}
 */
export function validateComment(input = {}) {
  const productId = String(input.productId ?? '').trim();
  const body = normalizeBody(input.body);
  const nickname = normalizeNickname(input.nickname);
  const errors = {};

  if (!productId) errors.productId = '제품 정보를 찾지 못했어요. 새로고침해 주세요.';

  const bodyLen = countChars(body);
  if (bodyLen < COMMENT_LIMITS.bodyMin) errors.body = '댓글 내용을 적어 주세요.';
  else if (bodyLen > COMMENT_LIMITS.bodyMax)
    errors.body = `댓글은 300자까지 쓸 수 있어요. 지금 ${bodyLen}자예요.`;

  if (countChars(nickname) > COMMENT_LIMITS.nicknameMax)
    errors.nickname = `닉네임은 20자까지 쓸 수 있어요. (지금 ${countChars(nickname)}자)`;

  return { ok: Object.keys(errors).length === 0, errors, value: { productId, body, nickname } };
}

/** 분류 필터: 'all'이면 그대로 */
export function filterFeedback(list, category) {
  const rows = Array.isArray(list) ? list : [];
  if (!category || category === 'all') return rows.slice();
  return rows.filter((row) => row?.category === category);
}

const timeOf = (row) => new Date(row?.created_at ?? 0).getTime() || 0;

/** 최신 글이 위 */
export function sortNewestFirst(list) {
  return (Array.isArray(list) ? list : [])
    .slice()
    .sort((a, b) => timeOf(b) - timeOf(a));
}

/** 오래된 글이 위 (댓글은 대화처럼 읽힌다) */
export function sortOldestFirst(list) {
  return (Array.isArray(list) ? list : [])
    .slice()
    .sort((a, b) => timeOf(a) - timeOf(b));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 2026. 11. 27. / 올해면 11월 27일 */
export function formatDate(iso, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const nowDate = new Date(typeof now === 'number' ? now : new Date(now).getTime());
  if (Number.isNaN(nowDate.getTime())) return '';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === nowDate.getFullYear()) return `${month}월 ${day}일`;
  return `${d.getFullYear()}. ${pad2(month)}. ${pad2(day)}.`;
}

/** 달력 기준 날짜 차이 (자정 넘김을 '어제'로) */
function calendarDayDiff(then, now) {
  const a = new Date(then);
  const b = new Date(now);
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((dayB - dayA) / DAY);
}

/** '방금 전' · '3분 전' · '5시간 전' · '어제' · '3일 전' · '11월 20일' */
export function relativeTime(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return '';
  const diff = nowMs - then;

  if (diff < -MINUTE) return formatDate(iso, nowMs); // 시계 오차로 미래면 날짜로
  if (diff < MINUTE) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;

  const days = calendarDayDiff(then, nowMs);
  if (days <= 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return formatDate(iso, nowMs);
}

/** 목록에서 오늘 몇 건이 올라왔는지 (빈 상태 안내에 쓴다) */
export function todayCount(list, now = Date.now()) {
  const nowDate = new Date(typeof now === 'number' ? now : new Date(now).getTime());
  return (Array.isArray(list) ? list : []).filter((row) => {
    const d = new Date(row?.created_at ?? 0);
    return (
      d.getFullYear() === nowDate.getFullYear() &&
      d.getMonth() === nowDate.getMonth() &&
      d.getDate() === nowDate.getDate()
    );
  }).length;
}

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_CATEGORIES,
  COMMENT_LIMITS,
  FEEDBACK_LIMITS,
  categoryEmoji,
  categoryName,
  countChars,
  filterFeedback,
  formatDate,
  isBoardCategory,
  normalizeBody,
  normalizeNickname,
  relativeTime,
  sortNewestFirst,
  sortOldestFirst,
  statusLabel,
  todayCount,
  validateComment,
  validateFeedback,
} from '../lib/board.js';

const NOW = new Date('2026-11-27T09:00:00+09:00').getTime();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

test('분류는 세 가지이고 이름·이모지가 붙는다', () => {
  assert.deepEqual(
    BOARD_CATEGORIES.map((c) => c.key),
    ['new_product', 'fix_info', 'feature'],
  );
  assert.equal(categoryName('new_product'), '제품 추가 요청');
  assert.equal(categoryName('fix_info'), '성분 수정 제보');
  assert.equal(categoryName('feature'), '기능 제안');
  assert.equal(categoryName('nope'), '기타');
  assert.equal(categoryEmoji('feature'), '💡');
  assert.equal(isBoardCategory('feature'), true);
  assert.equal(isBoardCategory('all'), false);
});

test('접수 상태 문구', () => {
  assert.equal(statusLabel('open'), '접수됨');
  assert.equal(statusLabel('done'), '반영됨');
  assert.equal(statusLabel(undefined), '접수됨');
});

test('글자 수는 코드 포인트로 센다', () => {
  assert.equal(countChars('바나나킥'), 4);
  assert.equal(countChars('🙂'), 1);
  assert.equal(countChars(''), 0);
  assert.equal(countChars(null), 0);
});

test('본문·닉네임 정리', () => {
  assert.equal(normalizeBody('  첫 줄\r\n둘째 줄  \n\n\n\n셋째  '), '첫 줄\n둘째 줄\n\n셋째');
  assert.equal(normalizeNickname('   '), '익명');
  assert.equal(normalizeNickname('  과자   러버 '), '과자 러버');
});

test('제안·제보 검증: 정상 입력은 다듬어서 통과', () => {
  const result = validateFeedback({
    category: 'new_product',
    title: '  초코파이 추가해 주세요  ',
    body: ' 편의점에 있어요 ',
    nickname: '   ',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, {
    category: 'new_product',
    title: '초코파이 추가해 주세요',
    body: '편의점에 있어요',
    nickname: '익명',
  });
});

test('제안·제보 검증: 분류·제목·내용·닉네임 오류를 각각 알려 준다', () => {
  const result = validateFeedback({ category: '', title: '가', body: '', nickname: 'ㄱ'.repeat(21) });
  assert.equal(result.ok, false);
  assert.equal(result.errors.category, '분류를 하나 골라 주세요.');
  assert.match(result.errors.title, /2자 이상/);
  assert.match(result.errors.body, /2자 이상/);
  assert.match(result.errors.nickname, /20자/);
});

test('제안·제보 검증: 한도(80·600자)를 넘으면 거절', () => {
  const longTitle = 'ㄱ'.repeat(FEEDBACK_LIMITS.titleMax + 1);
  const longBody = 'ㄴ'.repeat(FEEDBACK_LIMITS.bodyMax + 1);
  const result = validateFeedback({ category: 'feature', title: longTitle, body: longBody });
  assert.equal(result.ok, false);
  assert.match(result.errors.title, /80자/);
  assert.match(result.errors.body, /600자/);

  const edge = validateFeedback({
    category: 'feature',
    title: 'ㄱ'.repeat(FEEDBACK_LIMITS.titleMax),
    body: 'ㄴ'.repeat(FEEDBACK_LIMITS.bodyMax),
  });
  assert.equal(edge.ok, true);
});

test('댓글 검증: 1~300자, 닉네임은 비면 익명', () => {
  const ok = validateComment({ productId: 'chocoheim', body: ' 달아요 ', nickname: '' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { productId: 'chocoheim', body: '달아요', nickname: '익명' });

  const empty = validateComment({ productId: 'chocoheim', body: '   ' });
  assert.equal(empty.ok, false);
  assert.match(empty.errors.body, /적어 주세요/);

  const tooLong = validateComment({ productId: 'chocoheim', body: 'ㄱ'.repeat(COMMENT_LIMITS.bodyMax + 1) });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.errors.body, /300자/);

  const noProduct = validateComment({ productId: '', body: '좋아요' });
  assert.equal(noProduct.ok, false);
  assert.match(noProduct.errors.productId, /제품/);
});

test('상대 시간: 방금·분·시간·어제·일·날짜', () => {
  assert.equal(relativeTime(iso(10 * 1000), NOW), '방금 전');
  assert.equal(relativeTime(iso(5 * 60 * 1000), NOW), '5분 전');
  assert.equal(relativeTime(iso(3 * 60 * 60 * 1000), NOW), '3시간 전');
  assert.equal(relativeTime(new Date('2026-11-26T10:00:00+09:00').toISOString(), NOW), '23시간 전');
  assert.equal(relativeTime(new Date('2026-11-26T07:00:00+09:00').toISOString(), NOW), '어제');
  assert.equal(relativeTime(new Date('2026-11-24T10:00:00+09:00').toISOString(), NOW), '3일 전');
  assert.equal(relativeTime(new Date('2026-10-01T10:00:00+09:00').toISOString(), NOW), '10월 1일');
  assert.equal(relativeTime(new Date('2025-12-31T10:00:00+09:00').toISOString(), NOW), '2025. 12. 31.');
  assert.equal(relativeTime('이상한 값', NOW), '');
  // 기기 시계가 조금 빠른 경우
  assert.equal(relativeTime(iso(-5 * 60 * 1000), NOW), '11월 27일');
});

test('날짜 표기', () => {
  assert.equal(formatDate(new Date('2026-11-27T00:10:00+09:00').toISOString(), NOW), '11월 27일');
  assert.equal(formatDate(new Date('2024-03-05T00:10:00+09:00').toISOString(), NOW), '2024. 03. 05.');
  assert.equal(formatDate('nope', NOW), '');
});

test('필터·정렬', () => {
  const rows = [
    { id: 'a', category: 'feature', created_at: '2026-11-27T00:00:00+00:00' },
    { id: 'b', category: 'new_product', created_at: '2026-11-26T00:00:00+00:00' },
    { id: 'c', category: 'feature', created_at: '2026-11-25T00:00:00+00:00' },
  ];
  assert.deepEqual(
    filterFeedback(rows, 'feature').map((r) => r.id),
    ['a', 'c'],
  );
  assert.equal(filterFeedback(rows, 'all').length, 3);
  assert.equal(filterFeedback(null, 'all').length, 0);
  assert.deepEqual(
    sortNewestFirst(rows).map((r) => r.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    sortOldestFirst(rows).map((r) => r.id),
    ['c', 'b', 'a'],
  );
});

test('오늘 올라온 글 수', () => {
  const rows = [
    { created_at: new Date('2026-11-27T01:00:00+09:00').toISOString() },
    { created_at: new Date('2026-11-26T23:00:00+09:00').toISOString() },
  ];
  assert.equal(todayCount(rows, NOW), 1);
  assert.equal(todayCount([], NOW), 0);
});

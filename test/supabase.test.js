import test from 'node:test';
import assert from 'node:assert/strict';

import { BoardError, createBoardApi, friendlyMessage } from '../lib/supabase.js';

const URL_BASE = 'https://example.supabase.co';
const KEY = 'sb_publishable_test';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function apiWith(handler) {
  const calls = [];
  const api = createBoardApi({
    url: `${URL_BASE}/`,
    key: KEY,
    timeoutMs: 50,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return handler(url, init);
    },
  });
  return { api, calls };
}

test('게시판 목록: 분류·정렬·개수를 쿼리로 보낸다', async () => {
  const { api, calls } = apiWith(() =>
    jsonResponse([{ id: '1', category: 'feature', title: 't', body: 'b', nickname: '익명', status: 'open', created_at: 'x' }]),
  );
  const rows = await api.listFeedback({ category: 'feature', limit: 20 });
  assert.equal(rows.length, 1);
  const { url, init } = calls[0];
  assert.ok(url.startsWith(`${URL_BASE}/rest/v1/tumyeongbongji_feedback?`));
  const query = new URL(url).searchParams;
  assert.equal(query.get('select'), 'id,category,title,body,nickname,status,created_at');
  assert.equal(query.get('category'), 'eq.feature');
  assert.equal(query.get('order'), 'created_at.desc');
  assert.equal(query.get('limit'), '20');
  assert.equal(init.method, 'GET');
  assert.equal(init.headers.apikey, KEY);
  assert.equal(init.headers.Accept, 'application/json');
  assert.equal(init.body, undefined);
});

test('게시판 목록: 전체면 category 조건을 빼고, 응답이 배열이 아니면 빈 배열', async () => {
  const { api, calls } = apiWith(() => jsonResponse(null));
  const rows = await api.listFeedback();
  assert.deepEqual(rows, []);
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get('category'), null);
  assert.equal(query.get('limit'), '50');
});

test('글 등록: POST 본문과 Prefer 헤더, 저장된 행 반환', async () => {
  const { api, calls } = apiWith(() =>
    jsonResponse([{ id: 'abc', category: 'fix_info', title: '제목', body: '내용', nickname: '익명', status: 'open', created_at: 'x' }], 201),
  );
  const row = await api.createFeedback({ category: 'fix_info', title: '제목', body: '내용', nickname: '익명' });
  assert.equal(row.id, 'abc');
  const { url, init } = calls[0];
  assert.equal(url, `${URL_BASE}/rest/v1/tumyeongbongji_feedback`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Prefer, 'return=representation');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { category: 'fix_info', title: '제목', body: '내용', nickname: '익명' });
});

test('댓글 목록: 제품 아이디를 인코딩하고 오래된 순', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c1', product_id: 'choco-heim', nickname: '익명', body: '굿', created_at: 'x' }]));
  const rows = await api.listComments('choco heim&x=1');
  assert.equal(rows.length, 1);
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get('product_id'), 'eq.choco heim&x=1');
  assert.equal(query.get('order'), 'created_at.asc');
  assert.equal(query.get('select'), 'id,product_id,nickname,body,created_at');
});

test('댓글 등록: product_id로 POST하고 행을 돌려준다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c2', product_id: 'chocoheim', nickname: '익명', body: '굿', created_at: 'x' }], 201));
  const row = await api.createComment({ productId: 'chocoheim', nickname: '익명', body: '굿' });
  assert.equal(row.id, 'c2');
  assert.deepEqual(JSON.parse(calls[0].init.body), { product_id: 'chocoheim', nickname: '익명', body: '굿' });
});

test('등록 응답에 id가 없으면 response 오류', async () => {
  const { api } = apiWith(() => jsonResponse([], 201));
  await assert.rejects(() => api.createFeedback({ category: 'feature', title: 'a', body: 'b', nickname: '익명' }), (err) => {
    assert.ok(err instanceof BoardError);
    assert.equal(err.kind, 'response');
    return true;
  });
});

test('오류 상태를 종류별 한국어 안내로 바꾼다', async () => {
  const cases = [
    [401, 'auth'],
    [403, 'auth'],
    [400, 'validation'],
    [409, 'validation'],
    [500, 'server'],
    [418, 'response'],
  ];
  for (const [status, kind] of cases) {
    const { api } = apiWith(() => jsonResponse({ message: 'nope' }, status));
    await assert.rejects(
      () => api.listFeedback(),
      (err) => {
        assert.equal(err.kind, kind, `status ${status}`);
        assert.equal(err.status, status);
        assert.ok(err.message.length > 5);
        return true;
      },
    );
  }
});

test('네트워크 실패·시간 초과 안내', async () => {
  const net = apiWith(() => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    () => net.api.listFeedback(),
    (err) => err.kind === 'network' && /인터넷/.test(err.message),
  );

  const aborted = apiWith(() => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  });
  await assert.rejects(
    () => aborted.api.listFeedback(),
    (err) => err.kind === 'timeout' && /늦/.test(err.message),
  );
});

test('friendlyMessage는 BoardError의 안내를 그대로 쓴다', () => {
  assert.match(friendlyMessage(new BoardError('network', '인터넷 연결을 확인해 주세요.')), /인터넷/);
  assert.match(friendlyMessage(new Error('boom')), /문제/);
});

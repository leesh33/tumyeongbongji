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
  assert.equal(query.get('select'), 'id,product_id,nickname,body,user_id,created_at');
});

test('댓글 등록: 로그인 토큰·user_id를 실어 POST하고 행을 돌려준다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c2', product_id: 'chocoheim', nickname: '수진', body: '굿', user_id: 'u-1', created_at: 'x' }], 201));
  const row = await api.createComment(
    { productId: 'chocoheim', nickname: '수진', body: '굿', userId: 'u-1' },
    { accessToken: 'user-token' },
  );
  assert.equal(row.id, 'c2');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { product_id: 'chocoheim', nickname: '수진', body: '굿', user_id: 'u-1' });
});

test('댓글 등록: 로그인 토큰이 없으면 요청을 보내지 않고 login 오류', async () => {
  const { api, calls } = apiWith(() => jsonResponse([], 201));
  await assert.rejects(
    () => api.createComment({ productId: 'chocoheim', nickname: '수진', body: '굿', userId: 'u-1' }),
    (err) => err instanceof BoardError && err.kind === 'login' && /로그인/.test(err.message),
  );
  assert.equal(calls.length, 0);
});

test('댓글 등록: user_id가 없으면 validation 오류', async () => {
  const { api } = apiWith(() => jsonResponse([], 201));
  await assert.rejects(
    () => api.createComment({ productId: 'chocoheim', nickname: '수진', body: '굿' }, { accessToken: 't' }),
    (err) => err instanceof BoardError && err.kind === 'validation',
  );
});

test('내 댓글 삭제: 토큰과 id 조건으로 DELETE하고, 지워졌는지 돌려준다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c1' }]));
  const removed = await api.deleteComment('c1', { accessToken: 'user-token' });
  assert.equal(removed, true);
  const { url, init } = calls[0];
  assert.equal(init.method, 'DELETE');
  assert.equal(init.headers.Authorization, 'Bearer user-token');
  assert.equal(init.headers.Prefer, 'return=representation');
  const query = new URL(url).searchParams;
  assert.equal(query.get('id'), 'eq.c1');
  assert.equal(query.get('select'), 'id');
  assert.equal(init.body, undefined);
});

test('내 댓글 삭제: 지워진 행이 없으면 false (남의 댓글·이미 삭제)', async () => {
  const { api } = apiWith(() => jsonResponse([]));
  assert.equal(await api.deleteComment('c9', { accessToken: 'user-token' }), false);
});

test('내 댓글 삭제: 로그인 토큰이 없으면 보내지 않고 login 오류', async () => {
  const { api, calls } = apiWith(() => jsonResponse([]));
  await assert.rejects(
    () => api.deleteComment('c1'),
    (err) => err instanceof BoardError && err.kind === 'login',
  );
  assert.equal(calls.length, 0);
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

/* ── 아이템(상품) · 어드민 ─────────────────── */

const TOKEN = 'user-access-token';

test('아이템 목록: 번호 오름차순, 노출 중인 것만 기본으로', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ item_no: 1, id: 'a' }]));
  const rows = await api.fetchProducts();
  assert.equal(rows.length, 1);
  const { url, init } = calls[0];
  assert.ok(url.startsWith(`${URL_BASE}/rest/v1/tumyeongbongji_products?`));
  const query = new URL(url).searchParams;
  assert.equal(query.get('order'), 'item_no.asc');
  assert.equal(query.get('is_active'), 'eq.true');
  assert.ok(query.get('select').includes('alt_links'));
  assert.equal(init.method, 'GET');
});

test('아이템 목록: 관리자는 숨김까지 모두 받는다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([]));
  await api.fetchProducts({ includeInactive: true, accessToken: TOKEN });
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get('is_active'), null);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
});

test('아이템 추가: 로그인 토큰과 함께 POST, 저장된 행을 돌려준다', async () => {
  const { api, calls } = apiWith(() =>
    jsonResponse([{ item_no: 35, id: 'new-snack', name: '새 과자', alt_links: [] }], 201),
  );
  const saved = await api.createProduct(
    { id: 'new-snack', name: '새 과자', alt_links: [{ title: '쿠팡', url: 'https://a.com' }] },
    { accessToken: TOKEN },
  );
  assert.equal(saved.item_no, 35);
  const { url, init } = calls[0];
  assert.equal(url, `${URL_BASE}/rest/v1/tumyeongbongji_products`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(JSON.parse(init.body).alt_links.length, 1);
});

test('아이템 추가·수정·삭제: 토큰이 없으면 요청하지 않고 관리자 로그인 오류', async () => {
  const { api, calls } = apiWith(() => jsonResponse([], 201));
  for (const run of [
    () => api.createProduct({ id: 'x', name: 'y' }),
    () => api.updateProduct(1, { name: 'y' }),
    () => api.deleteProduct(1),
    () => api.fetchAllCommentsForAdmin(),
    () => api.updateFeedbackStatus('id', 'done'),
  ]) {
    await assert.rejects(
      run,
      (err) => err instanceof BoardError && err.kind === 'login' && /관리자/.test(err.message),
    );
  }
  assert.equal(calls.length, 0);
});

test('아이템 수정: item_no 조건으로 PATCH하고 바뀐 행을 돌려준다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ item_no: 3, id: 'choco-heim', name: '쵸코하임' }]));
  const saved = await api.updateProduct(3, { name: '쵸코하임', item_no: 9 }, { accessToken: TOKEN });
  assert.equal(saved.item_no, 3);
  const { url, init } = calls[0];
  assert.ok(url.startsWith(`${URL_BASE}/rest/v1/tumyeongbongji_products?item_no=eq.3`));
  assert.equal(init.method, 'PATCH');
  assert.equal(JSON.parse(init.body).item_no, 9);
});

test('아이템 수정: 권한이 없어 아무 행도 안 바뀌면 auth 오류', async () => {
  const { api } = apiWith(() => jsonResponse([]));
  await assert.rejects(
    () => api.updateProduct(3, { name: 'x' }, { accessToken: TOKEN }),
    (err) => err instanceof BoardError && err.kind === 'auth',
  );
});

test('아이템 삭제: 지워졌는지 true/false로 알려 준다', async () => {
  const gone = apiWith(() => jsonResponse([{ item_no: 3, id: 'x' }]));
  assert.equal(await gone.api.deleteProduct(3, { accessToken: TOKEN }), true);
  assert.equal(gone.calls[0].init.method, 'DELETE');
  assert.ok(gone.calls[0].url.includes('item_no=eq.3'));

  const none = apiWith(() => jsonResponse([]));
  assert.equal(await none.api.deleteProduct(3, { accessToken: TOKEN }), false);
});

test('관리자 판별: rpc/tb_is_admin에 토큰을 실어 묻는다', async () => {
  const { api, calls } = apiWith(() => jsonResponse(true));
  assert.equal(await api.checkIsAdmin({ accessToken: TOKEN }), true);
  assert.equal(calls[0].url, `${URL_BASE}/rest/v1/rpc/tb_is_admin`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {});

  const noToken = apiWith(() => jsonResponse(true));
  assert.equal(await noToken.api.checkIsAdmin(), false);
  assert.equal(noToken.calls.length, 0);
});

test('어드민 댓글 목록: 최신순으로 전체를 받는다', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c1', product_id: 'x', body: '굿' }]));
  const rows = await api.fetchAllCommentsForAdmin({ accessToken: TOKEN, limit: 30 });
  assert.equal(rows.length, 1);
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get('order'), 'created_at.desc');
  assert.equal(query.get('limit'), '30');
  assert.equal(query.get('select'), 'id,product_id,nickname,body,user_id,created_at');
});

test('관리자 댓글 삭제: id 조건으로 DELETE', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'c1' }]));
  assert.equal(await api.deleteCommentByAdmin('c1', { accessToken: TOKEN }), true);
  assert.ok(calls[0].url.includes('tumyeongbongji_comments?id=eq.c1'));
  assert.equal(calls[0].init.method, 'DELETE');
});

test('어드민 제보 목록과 상태 변경: PATCH status', async () => {
  const list = apiWith(() => jsonResponse([{ id: 'f1', status: 'open' }]));
  await list.api.fetchAllFeedbackForAdmin({ accessToken: TOKEN });
  assert.equal(new URL(list.calls[0].url).searchParams.get('order'), 'created_at.desc');

  const patch = apiWith(() => jsonResponse([{ id: 'f1', status: 'done' }]));
  const saved = await patch.api.updateFeedbackStatus('f1', 'done', { accessToken: TOKEN });
  assert.equal(saved.status, 'done');
  assert.equal(patch.calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(patch.calls[0].init.body), { status: 'done' });

  const bad = apiWith(() => jsonResponse([]));
  await assert.rejects(
    () => bad.api.updateFeedbackStatus('f1', 'archived', { accessToken: TOKEN }),
    (err) => err instanceof BoardError && err.kind === 'validation',
  );
  assert.equal(bad.calls.length, 0);
});

test('관리자 제보 삭제: 지워졌는지 true/false', async () => {
  const { api, calls } = apiWith(() => jsonResponse([{ id: 'f1' }]));
  assert.equal(await api.deleteFeedbackByAdmin('f1', { accessToken: TOKEN }), true);
  assert.ok(calls[0].url.includes('tumyeongbongji_feedback?id=eq.f1'));
});

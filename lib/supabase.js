// Supabase REST(/rest/v1) 얇은 클라이언트. SDK 없이 fetch만 쓴다.
// 테이블: tumyeongbongji_feedback(제안·제보), tumyeongbongji_comments(제품별 댓글)
// - 게시판(feedback): 로그인 없이도 SELECT·INSERT (익명 허용)
// - 댓글(comments): 목록은 누구나, 작성·삭제는 로그인한 본인만
//   (Authorization: Bearer <user_access_token> 를 실어 보내고 RLS가 auth.uid()를 검사한다)
import { SUPABASE } from '../config.js';

/** 화면에 그대로 보여 줄 수 있는 한국어 메시지를 가진 오류 */
export class BoardError extends Error {
  constructor(kind, message, { status = 0, detail = '' } = {}) {
    super(message);
    this.name = 'BoardError';
    this.kind = kind; // network | timeout | auth | validation | server | response
    this.status = status;
    this.detail = detail;
  }
}

const MESSAGES = {
  network: '인터넷 연결이 불안정해요. 연결을 확인하고 다시 시도해 주세요.',
  timeout: '서버 응답이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.',
  auth: '지금은 서버가 글을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  validation: '입력한 내용이 서버 규칙에 맞지 않아요. 글자 수를 확인해 주세요.',
  server: '서버에 잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.',
  response: '서버 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.',
  login: '기명 댓글은 로그인한 뒤에 남길 수 있어요. 로그인해 주세요.',
  session: '로그인 정보가 만료됐어요. 다시 로그인해 주세요.',
  admin: '관리자 계정으로 로그인해야 할 수 있어요.',
};

export function friendlyMessage(err) {
  if (err instanceof BoardError && err.message) return err.message;
  return '알 수 없는 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.';
}

function errorFromResponse(status, data) {
  const detail = String(data?.message ?? data?.error_description ?? '');
  const options = { status, detail };
  if (status === 401 || status === 403) return new BoardError('auth', MESSAGES.auth, options);
  if (status === 400 || status === 409 || status === 422)
    return new BoardError('validation', MESSAGES.validation, options);
  if (status >= 500) return new BoardError('server', MESSAGES.server, options);
  return new BoardError('response', MESSAGES.response, options);
}

/**
 * @param {{url?:string, key?:string, fetchImpl?:Function, timeoutMs?:number, tables?:{feedback:string,comments:string,products:string}}} [options]
 */
export function createBoardApi(options = {}) {
  const url = String(options.url ?? SUPABASE.url).replace(/\/+$/, '');
  const key = options.key ?? SUPABASE.key;
  const tables = {
    feedback: options.tables?.feedback ?? SUPABASE.feedbackTable,
    comments: options.tables?.comments ?? SUPABASE.commentsTable,
    products: options.tables?.products ?? SUPABASE.productsTable,
  };
  const timeoutMs = options.timeoutMs ?? 12000;
  const fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

  function headers(hasBody, accessToken, prefer) {
    const h = {
      apikey: key,
      // 로그인한 사용자의 토큰을 그대로 실어 RLS가 auth.uid()를 볼 수 있게 한다
      Authorization: `Bearer ${accessToken || key}`,
      Accept: 'application/json',
    };
    if (hasBody) h['Content-Type'] = 'application/json';
    if (prefer || hasBody) h.Prefer = prefer || 'return=representation';
    return h;
  }

  async function request(path, { method = 'GET', body, accessToken, prefer } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(`${url}/rest/v1/${path}`, {
        method,
        headers: headers(body != null, accessToken, prefer),
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (err?.name === 'AbortError') throw new BoardError('timeout', MESSAGES.timeout);
      throw new BoardError('network', MESSAGES.network, { detail: String(err?.message ?? err) });
    }
    if (timer) clearTimeout(timer);

    const text = typeof res.text === 'function' ? await res.text() : '';
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) throw errorFromResponse(res.status, data);
    if (data == null && method !== 'GET') throw new BoardError('response', MESSAGES.response);
    return data;
  }

  /** RPC(/rest/v1/rpc/...) — tb_is_admin() 처럼 DB 함수를 부를 때 */
  async function callRpc(name, args, { accessToken } = {}) {
    const res = await request(`rpc/${name}`, { method: 'POST', body: args ?? {}, accessToken });
    return res;
  }

  /** 관리자 쓰기 요청은 로그인 토큰이 없으면 서버에 보내지 않는다 */
  function requireAdminToken(accessToken) {
    if (!accessToken) throw new BoardError('login', MESSAGES.admin);
  }

  const asRow = (data) => (Array.isArray(data) ? data[0] : data);

  /** 상품 행에서 앱이 쓰는 컬럼만 고른다 */
  const PRODUCT_COLUMNS =
    'item_no,id,name,brand,category,unit,weight,kcal,sodium,sugar,fat,carbs,protein,ingredients,bulk,note,alt_links,is_active';

  return {
    /** 최신순 제안·제보 목록 */
    async listFeedback({ category = 'all', limit = 50 } = {}) {
      const query = new URLSearchParams();
      query.set('select', 'id,category,title,body,nickname,status,created_at');
      if (category && category !== 'all') query.set('category', `eq.${category}`);
      query.set('order', 'created_at.desc');
      query.set('limit', String(limit));
      const data = await request(`${tables.feedback}?${query.toString()}`);
      return Array.isArray(data) ? data : [];
    },

    /** 글 한 건 등록 (성공하면 저장된 행을 돌려준다) */
    async createFeedback(payload) {
      const data = await request(tables.feedback, {
        method: 'POST',
        body: {
          category: payload.category,
          title: payload.title,
          body: payload.body,
          nickname: payload.nickname,
        },
      });
      const row = asRow(data);
      if (!row?.id) throw new BoardError('response', MESSAGES.response);
      return row;
    },

    /** 제품 하나의 댓글 (오래된 순) — user_id 로 내 댓글에 삭제 버튼을 붙인다 */
    async listComments(productId, { limit = 100 } = {}) {
      const query = new URLSearchParams();
      query.set('select', 'id,product_id,nickname,body,user_id,created_at');
      query.set('product_id', `eq.${productId}`);
      query.set('order', 'created_at.asc');
      query.set('limit', String(limit));
      const data = await request(`${tables.comments}?${query.toString()}`);
      return Array.isArray(data) ? data : [];
    },

    /**
     * 기명 댓글 등록. 로그인 사용자의 access token 이 없으면 보내지 않는다.
     * @param {{productId:string,nickname:string,body:string,userId:string}} payload
     * @param {{accessToken?:string}} [options]
     */
    async createComment(payload, { accessToken } = {}) {
      if (!accessToken) throw new BoardError('login', MESSAGES.login);
      if (!payload?.userId) throw new BoardError('validation', MESSAGES.session);
      const data = await request(tables.comments, {
        method: 'POST',
        accessToken,
        body: {
          product_id: payload.productId,
          nickname: payload.nickname,
          body: payload.body,
          user_id: payload.userId,
        },
      });
      const row = asRow(data);
      if (!row?.id) throw new BoardError('response', MESSAGES.response);
      return row;
    },

    /**
     * 내 댓글 삭제 (RLS가 본인 댓글만 지우게 한다).
     * 실제로 지워졌는지까지 확인해서 돌려준다.
     */
    async deleteComment(id, { accessToken } = {}) {
      if (!accessToken) throw new BoardError('login', MESSAGES.login);
      const commentId = String(id ?? '').trim();
      if (!commentId) throw new BoardError('validation', '지울 댓글을 찾지 못했어요. 새로고침해 주세요.');
      const data = await request(`${tables.comments}?id=eq.${encodeURIComponent(commentId)}&select=id`, {
        method: 'DELETE',
        accessToken,
        prefer: 'return=representation',
      });
      return Array.isArray(data) && data.length > 0;
    },

    /* ── 상품(아이템) ───────────────────────────────
       목록은 누구나(숨김 제외), 추가·수정·삭제는 관리자만. RLS가 최종 판단한다. */

    /** 아이템 목록 (아이템 번호 오름차순) */
    async fetchProducts({ includeInactive = false, accessToken } = {}) {
      const query = new URLSearchParams();
      query.set('select', PRODUCT_COLUMNS);
      if (!includeInactive) query.set('is_active', 'eq.true');
      query.set('order', 'item_no.asc');
      const data = await request(`${tables.products}?${query.toString()}`, { accessToken });
      return Array.isArray(data) ? data : [];
    },

    /** 아이템 추가 — 저장된 행을 돌려준다 */
    async createProduct(row, { accessToken } = {}) {
      requireAdminToken(accessToken);
      if (!row?.id || !row?.name) throw new BoardError('validation', '새 아이템 정보가 올바르지 않아요.');
      const data = await request(tables.products, { method: 'POST', body: row, accessToken });
      const saved = asRow(data);
      if (!saved?.id) throw new BoardError('response', MESSAGES.response);
      return saved;
    },

    /** 아이템 수정 (item_no 기준) — 실제로 바뀐 행을 돌려준다 */
    async updateProduct(itemNo, patch, { accessToken } = {}) {
      requireAdminToken(accessToken);
      const no = Number(itemNo);
      if (!Number.isInteger(no) || no <= 0) throw new BoardError('validation', '수정할 아이템 번호를 찾지 못했어요.');
      const data = await request(
        `${tables.products}?item_no=eq.${no}&select=${PRODUCT_COLUMNS}`,
        { method: 'PATCH', body: patch, accessToken, prefer: 'return=representation' },
      );
      const saved = asRow(data);
      if (!saved?.id) throw new BoardError('auth', MESSAGES.admin);
      return saved;
    },

    /** 아이템 삭제 — 실제로 지워졌는지까지 확인한다 */
    async deleteProduct(itemNo, { accessToken } = {}) {
      requireAdminToken(accessToken);
      const no = Number(itemNo);
      if (!Number.isInteger(no) || no <= 0) throw new BoardError('validation', '지울 아이템 번호를 찾지 못했어요.');
      const data = await request(`${tables.products}?item_no=eq.${no}&select=item_no,id`, {
        method: 'DELETE',
        accessToken,
        prefer: 'return=representation',
      });
      return Array.isArray(data) && data.length > 0;
    },

    /** 지금 로그인한 계정이 관리자인지 (DB의 tb_is_admin()) */
    async checkIsAdmin({ accessToken } = {}) {
      if (!accessToken) return false;
      const data = await callRpc('tb_is_admin', {}, { accessToken });
      return data === true || data === 'true';
    },

    /** 어드민 댓글 관리: 전체 댓글 최신순 */
    async fetchAllCommentsForAdmin({ accessToken, limit = 200 } = {}) {
      requireAdminToken(accessToken);
      const query = new URLSearchParams();
      query.set('select', 'id,product_id,nickname,body,user_id,created_at');
      query.set('order', 'created_at.desc');
      query.set('limit', String(limit));
      const data = await request(`${tables.comments}?${query.toString()}`, { accessToken });
      return Array.isArray(data) ? data : [];
    },

    /** 관리자 댓글 삭제 */
    async deleteCommentByAdmin(id, { accessToken } = {}) {
      requireAdminToken(accessToken);
      const commentId = String(id ?? '').trim();
      if (!commentId) throw new BoardError('validation', '지울 댓글을 찾지 못했어요. 새로고침해 주세요.');
      const data = await request(`${tables.comments}?id=eq.${encodeURIComponent(commentId)}&select=id`, {
        method: 'DELETE',
        accessToken,
        prefer: 'return=representation',
      });
      return Array.isArray(data) && data.length > 0;
    },

    /** 어드민 제보 관리: 전체 제안·제보 최신순 */
    async fetchAllFeedbackForAdmin({ accessToken, limit = 200 } = {}) {
      requireAdminToken(accessToken);
      const query = new URLSearchParams();
      query.set('select', 'id,category,title,body,nickname,status,created_at');
      query.set('order', 'created_at.desc');
      query.set('limit', String(limit));
      const data = await request(`${tables.feedback}?${query.toString()}`, { accessToken });
      return Array.isArray(data) ? data : [];
    },

    /** 제보 상태 변경 ('open' | 'done') */
    async updateFeedbackStatus(id, status, { accessToken } = {}) {
      requireAdminToken(accessToken);
      if (status !== 'open' && status !== 'done') {
        throw new BoardError('validation', '상태는 대기/완료 중 하나예요.');
      }
      const feedbackId = String(id ?? '').trim();
      if (!feedbackId) throw new BoardError('validation', '바꿀 글을 찾지 못했어요. 새로고침해 주세요.');
      const data = await request(
        `${tables.feedback}?id=eq.${encodeURIComponent(feedbackId)}&select=id,status`,
        { method: 'PATCH', body: { status }, accessToken, prefer: 'return=representation' },
      );
      const saved = asRow(data);
      if (!saved?.id) throw new BoardError('auth', MESSAGES.admin);
      return saved;
    },

    /** 관리자 제보 삭제 */
    async deleteFeedbackByAdmin(id, { accessToken } = {}) {
      requireAdminToken(accessToken);
      const feedbackId = String(id ?? '').trim();
      if (!feedbackId) throw new BoardError('validation', '지울 글을 찾지 못했어요. 새로고침해 주세요.');
      const data = await request(`${tables.feedback}?id=eq.${encodeURIComponent(feedbackId)}&select=id`, {
        method: 'DELETE',
        accessToken,
        prefer: 'return=representation',
      });
      return Array.isArray(data) && data.length > 0;
    },
  };
}

export const boardApi = createBoardApi();

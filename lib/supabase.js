// Supabase REST(/rest/v1) 얇은 클라이언트. SDK 없이 fetch만 쓴다.
// 테이블: tumyeongbongji_feedback(제안·제보), tumyeongbongji_comments(제품별 댓글)
// anon 키에는 SELECT·INSERT만 허용되고 UPDATE·DELETE는 막혀 있다.
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
 * @param {{url?:string, key?:string, fetchImpl?:Function, timeoutMs?:number, tables?:{feedback:string,comments:string}}} [options]
 */
export function createBoardApi(options = {}) {
  const url = String(options.url ?? SUPABASE.url).replace(/\/+$/, '');
  const key = options.key ?? SUPABASE.key;
  const tables = {
    feedback: options.tables?.feedback ?? SUPABASE.feedbackTable,
    comments: options.tables?.comments ?? SUPABASE.commentsTable,
  };
  const timeoutMs = options.timeoutMs ?? 12000;
  const fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

  function headers(hasBody) {
    const h = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    };
    if (hasBody) {
      h['Content-Type'] = 'application/json';
      h.Prefer = 'return=representation';
    }
    return h;
  }

  async function request(path, { method = 'GET', body } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(`${url}/rest/v1/${path}`, {
        method,
        headers: headers(body != null),
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

  const asRow = (data) => (Array.isArray(data) ? data[0] : data);

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

    /** 제품 하나의 댓글 (오래된 순) */
    async listComments(productId, { limit = 100 } = {}) {
      const query = new URLSearchParams();
      query.set('select', 'id,product_id,nickname,body,created_at');
      query.set('product_id', `eq.${productId}`);
      query.set('order', 'created_at.asc');
      query.set('limit', String(limit));
      const data = await request(`${tables.comments}?${query.toString()}`);
      return Array.isArray(data) ? data : [];
    },

    /** 댓글 한 건 등록 */
    async createComment(payload) {
      const data = await request(tables.comments, {
        method: 'POST',
        body: {
          product_id: payload.productId,
          nickname: payload.nickname,
          body: payload.body,
        },
      });
      const row = asRow(data);
      if (!row?.id) throw new BoardError('response', MESSAGES.response);
      return row;
    },
  };
}

export const boardApi = createBoardApi();

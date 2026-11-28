import { APP } from './config.js';
import { CATEGORIES } from './data/products.js';
import {
  isCatalogProduct,
  listProducts,
  productById,
  removeProduct,
  resetProducts,
  setProducts,
  upsertProduct,
} from './lib/catalog.js';
import {
  ADMIN_EMAIL,
  ADMIN_TABS,
  ALT_PLATFORMS,
  PLATFORM_LABEL,
  PRODUCT_LIMITS,
  PRODUCT_UNITS,
  formatItemNo,
  itemNoQuery,
  matchesProductQuery,
  nextItemNo,
  productToRow,
  rowToProduct,
  slugify,
  validateProductInput,
} from './lib/admin.js';
import { createFontEmbedder } from './lib/font-embed.js';
import {
  BOARD_CATEGORIES,
  COMMENT_LIMITS,
  FEEDBACK_LIMITS,
  categoryEmoji,
  categoryName,
  countChars,
  filterFeedback,
  isBoardCategory,
  relativeTime,
  sortNewestFirst,
  sortOldestFirst,
  statusLabel,
  validateComment,
  validateFeedback,
} from './lib/board.js';
import { BoardError, boardApi, friendlyMessage } from './lib/supabase.js';
import {
  NICKNAME_MAX,
  PROVIDERS,
  cleanCallbackUrl,
  createAuthClient,
  ensureProfile,
  friendlyAuthMessage,
  isValidNickname,
  nicknameFromUser,
  sanitizeNickname,
} from './lib/auth.js';
import { buildModel } from './lib/model.js';
import { brandBadge } from './lib/brand-badge.js';
import { cardSVG } from './lib/card-svg.js';
import { fmt, fmtAmount, toCubes, toLadle, toSpoons } from './lib/units.js';
import { lowSugarAlternatives } from './lib/stack.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const state = {
  category: 'all',
  q: '',
  custom: null,
  altOpen: false,
  photoDataUrl: null,
};

// 제안·제보 화면 상태. 화면을 떠났다 돌아와도 쓰던 글이 남도록 초안도 들고 있는다.
const board = {
  category: 'all',
  items: [],
  loading: false,
  error: '',
  submitting: false,
  formOpen: false,
  loaded: false,
  token: 0,
  draft: { category: 'new_product', title: '', body: '', nickname: '' },
};

// 기명 댓글용 로그인: Supabase GoTrue 소셜 로그인 세션 + 내 프로필(닉네임)
const auth = createAuthClient();
const authState = { session: null, profile: null, isAdmin: false };
const SESSION_ERROR = '로그인 정보가 만료됐어요. 다시 로그인해 주세요.';

const isSignedIn = () => Boolean(authState.session?.user?.id);

function myName() {
  if (authState.profile?.nickname) return authState.profile.nickname;
  return authState.session ? nicknameFromUser(authState.session.user) : '';
}

/** 세션 만료 직전이면 refresh까지 해서 유효한 세션을 돌려준다 */
async function currentSession() {
  const session = await auth.ensureSession();
  authState.session = session;
  if (!session) authState.profile = null;
  return session;
}

/** 댓글 요청 오류: 토큰 만료는 재로그인으로 안내하고, 나머지는 서버 문구를 쓴다 */
function commentErrorMessage(err) {
  if (err instanceof BoardError && err.kind === 'auth') return SESSION_ERROR;
  return friendlyMessage(err);
}

// 상세 화면을 떠나면 늦게 도착한 댓글 응답을 버리기 위한 번호
let commentsToken = 0;
// 앱 안에서 몇 번 이동했는지 (곧바로 상세 링크로 들어온 경우 뒤로가기는 홈으로)
let navCount = 0;

const has = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

// 닉네임은 한 번 적으면 다음에도 쓰게 이 기기에만 기억해 둔다.
const NICK_KEY = 'tb-nickname';
function readNickname() {
  try {
    return String(localStorage.getItem(NICK_KEY) ?? '').slice(0, 20);
  } catch {
    return '';
  }
}
function rememberNickname(value) {
  const nick = String(value ?? '').trim();
  if (!nick || nick === '익명') return;
  try {
    localStorage.setItem(NICK_KEY, nick.slice(0, 20));
  } catch {
    /* 저장이 막힌 브라우저면 그냥 넘어간다 */
  }
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 2600);
}

const LOGO = `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
  <rect x="1" y="1" width="38" height="38" rx="11" fill="#F3E8D8" stroke="#DCCBB4"/>
  <rect x="10" y="7" width="20" height="27" rx="4.5" fill="#FFFCF7" stroke="#C9B79C"/>
  <path d="M11 12.5h18" stroke="#E4D8C6"/>
  <path d="M12 13v18a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 28 31V13z" fill="#FBF5EA"/>
  <rect x="13" y="20" width="14" height="6.2" fill="#E6B24A" opacity="0.9"/>
  <rect x="13" y="26" width="14" height="5" fill="#EFE2C2"/>
  <rect x="13" y="17" width="14" height="3" fill="#FBFAF5"/>
  <path d="M13 27.2h14" stroke="#FFFFFF" stroke-opacity=".7"/>
</svg>`;

/* ── 로그인·프로필 시트 ────────────────────── */
const PROVIDER_MARKS = {
  kakao: `<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.3c-4.5 0-8.1 2.8-8.1 6.2 0 2.2 1.5 4.2 3.7 5.3l-.9 3.1c-.1.4.3.7.6.5l3.6-2.3c.4.1.7.1 1.1.1 4.5 0 8.1-2.8 8.1-6.2S16.5 4.3 12 4.3z" fill="#241A10"/></svg>`,
  google: `<span class="pmark g" aria-hidden="true">G</span>`,
  apple: `<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.9.9-3.6.9s-1.9-.9-3.1-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3.1.7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6-.1 0-2.4-1-2.4-3.7z" fill="#FFF"/><path d="M14.2 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z" fill="#FFF"/></svg>`,
};

let activeSheet = null;

function closeSheet() {
  if (!activeSheet) return;
  const { el, onKey, restoreFocus } = activeSheet;
  document.removeEventListener('keydown', onKey);
  el.remove();
  activeSheet = null;
  if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus({ preventScroll: true });
}

/** 화면 아래에서 올라오는 시트. 바깥을 누르거나 Escape로 닫힌다. */
function openSheet(fill) {
  closeSheet();
  // 시트 밑에서 토스트가 겹쳐 보이지 않게 지운다
  toastEl.hidden = true;
  clearTimeout(showToast._t);
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const focusables = () =>
    [...sheet.querySelectorAll('button, input, a[href]')].filter((n) => !n.disabled && n.offsetParent !== null);

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) closeSheet();
  });

  activeSheet = { el: backdrop, onKey, restoreFocus: document.activeElement };
  fill(sheet);
  requestAnimationFrame(() => {
    if (activeSheet?.el === backdrop) sheet.querySelector('button, input')?.focus({ preventScroll: true });
  });
  return sheet;
}

/** 카카오·구글·애플 3종 로그인 시트 */
function openLoginSheet(message = '') {
  return openSheet((sheet) => {
    sheet.innerHTML = `
      <div class="sheet-grab" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheet-title">로그인</h2>
      <p class="sheet-note">기명 댓글과 내 댓글 관리를 위해 로그인해요. 영양정보 조회·저장·비교는 로그인 없이 이용할 수 있어요.</p>
      ${message ? `<p class="sheet-alert" role="alert">${esc(message)}</p>` : ''}
      <div class="provider-list" aria-labelledby="sheet-title">
        ${PROVIDERS.map(
          (p) =>
            `<button type="button" class="provider ${p.key}" data-provider="${p.key}">
              ${PROVIDER_MARKS[p.key]}<span>${p.name}로 계속하기</span></button>`,
        ).join('')}
      </div>
      <p class="sheet-fine">처음이면 자동으로 가입돼요. 댓글에는 내 닉네임이 함께 남습니다.</p>
      <button type="button" class="sheet-cancel">닫기</button>
    `;
    sheet.querySelectorAll('[data-provider]').forEach((btn) => {
      btn.addEventListener('click', () => startLogin(btn.dataset.provider));
    });
    sheet.querySelector('.sheet-cancel').addEventListener('click', closeSheet);
  });
}

async function startLogin(provider) {
  try {
    // 성공하면 Supabase 로그인 화면으로 이동한다(돌아오면 bootstrap이 이어받는다)
    await auth.signIn(provider);
  } catch (err) {
    closeSheet();
    showToast(friendlyAuthMessage(err));
  }
}

/** 닉네임 변경·로그아웃 시트 */
function openProfileSheet() {
  return openSheet((sheet) => {
    sheet.innerHTML = `
      <div class="sheet-grab" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheet-title">내 프로필</h2>
      <p class="sheet-note">댓글에 남는 내 이름이에요. 1~20자까지 바꿀 수 있어요.</p>
      <form class="nick-form" id="nick-form" novalidate>
        <label class="sr-only" for="nick-input">닉네임</label>
        <input id="nick-input" type="text" maxlength="${NICKNAME_MAX}" value="${esc(myName())}" autocomplete="nickname" />
        <p class="field-error" id="nick-error" role="alert" hidden></p>
        <button class="btn" type="submit" id="nick-save">닉네임 저장</button>
      </form>
      ${
        isAdminUser()
          ? `<a class="sheet-admin" href="#/admin" id="admin-enter"><span aria-hidden="true">⚙</span> 어드민 관리</a>`
          : ''
      }
      <button type="button" class="sheet-signout" id="signout">로그아웃</button>
    `;
    const form = sheet.querySelector('#nick-form');
    const input = sheet.querySelector('#nick-input');
    const error = sheet.querySelector('#nick-error');
    const saveBtn = sheet.querySelector('#nick-save');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nickname = sanitizeNickname(input.value);
      if (!isValidNickname(nickname)) {
        error.hidden = false;
        error.textContent = '닉네임은 1~20자로 적어 주세요.';
        input.classList.add('invalid');
        input.focus();
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '저장 중...';
      try {
        const session = await currentSession();
        if (!session) throw new Error('session');
        const row = await auth.updateNickname(session, nickname);
        authState.profile = { ...(authState.profile ?? {}), ...(row ?? {}), nickname };
        rememberNickname(nickname);
        closeSheet();
        showToast('닉네임을 바꿨어요.');
        route();
      } catch (err) {
        error.hidden = false;
        error.textContent = err?.message === 'session' ? SESSION_ERROR : friendlyAuthMessage(err);
        saveBtn.disabled = false;
        saveBtn.textContent = '닉네임 저장';
      }
    });

    sheet.querySelector('#admin-enter')?.addEventListener('click', () => closeSheet());

    sheet.querySelector('#signout').addEventListener('click', async () => {
      const btn = sheet.querySelector('#signout');
      btn.disabled = true;
      btn.textContent = '로그아웃 중...';
      await auth.signOut();
      authState.session = null;
      authState.profile = null;
      closeSheet();
      showToast('로그아웃했어요.');
      route();
    });
  });
}

/** 상단 바 오른쪽: 로그인 버튼 / 내 닉네임 칩 */
function authChipHtml() {
  if (isSignedIn()) {
    return `<button type="button" class="auth-chip on" id="auth-btn" aria-haspopup="dialog" aria-label="내 프로필 열기"><span>${esc(myName())}</span></button>`;
  }
  return `<button type="button" class="auth-chip" id="auth-btn" aria-haspopup="dialog">로그인</button>`;
}

function bindAuthChip() {
  app.querySelector('#auth-btn')?.addEventListener('click', () => {
    if (isSignedIn()) openProfileSheet();
    else openLoginSheet();
  });
}

function thumbStyle(model) {
  let acc = 0;
  const stops = model.layers.map((l) => {
    const from = acc * 100;
    acc += l.fill;
    return `${l.style.fill} ${from.toFixed(1)}% ${(acc * 100).toFixed(1)}%`;
  });
  return `background:linear-gradient(to top, ${stops.join(', ')});`;
}

function productThumb(product) {
  return thumbStyle(buildModel(product));
}

function filteredProducts() {
  return listProducts().filter((p) => {
    if (state.category !== 'all' && p.category !== state.category) return false;
    return matchesProductQuery(p, state.q, { includeItemNo: false });
  });
}

/* ── 홈 ─────────────────────────────────────── */
const BOARD_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4.2 6.2A2.7 2.7 0 0 1 6.9 3.5h10.2a2.7 2.7 0 0 1 2.7 2.7v7.6a2.7 2.7 0 0 1-2.7 2.7h-6.3l-4.4 3.8v-3.8h-.2a2.7 2.7 0 0 1-2-2.7z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
  <circle cx="8.6" cy="10" r=".95" fill="currentColor"/><circle cx="12" cy="10" r=".95" fill="currentColor"/><circle cx="15.4" cy="10" r=".95" fill="currentColor"/>
</svg>`;

const GEAR_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.9"/>
  <path d="M12 3.2v2.1M12 18.7v2.1M4.8 12H2.7M21.3 12h-2.1M6.9 6.9 5.4 5.4M18.6 18.6l-1.5-1.5M6.9 17.1l-1.5 1.5M18.6 5.4l-1.5 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

/** 홈의 검색 결과 부분만 다시 그린다(입력 중 재렌더로 한글 조합이 끊기지 않게). */
function renderHomeFeed() {
  const wrap = app.querySelector('#home-feed');
  if (!wrap) return;
  const list = filteredProducts();
  const q = state.q.trim();
  const heading =
    state.category === 'all'
      ? '인기 간식'
      : (CATEGORIES.find((c) => c.key === state.category)?.name ?? '간식');
  const rows = list
    .map((p) => {
      const m = buildModel(p);
      const sodium = fmt(toLadle(p.sodium));
      const sugar = fmt(toCubes(p.sugar));
      return `<li><a class="item" href="#/p/${p.id}">
        <span class="thumb" style="${thumbStyle(m)}"></span>
        <span class="info">
          ${brandBadge(p.brand)}
          <b>${esc(p.name)}</b>
          <em>${fmtAmount(p.weight)}${p.unit} · ${p.kcal} kcal</em>
        </span>
        <span class="mini">
          <i class="${Number(sodium) >= 2 ? 'hot' : ''}">나트륨 ${sodium}국자</i>
          <i class="${Number(sugar) >= 6 ? 'hot' : ''}">당 ${sugar}개</i>
        </span>
      </a></li>`;
    })
    .join('');
  const emptyHtml = q
    ? `<p class="empty">‘${esc(q)}’에 맞는 간식이 없어요.<br />다른 이름으로 찾아보거나, 위의 ‘직접 입력해서 보기’로 카드를 만들어 보세요.</p>`
    : `<p class="empty">이 분류에는 아직 간식이 없어요.</p>`;

  wrap.innerHTML = `
    <div class="section-head"><h2>${esc(heading)}</h2><span>${list.length}개</span></div>
    ${rows ? `<ul class="feed">${rows}</ul>` : emptyHtml}
  `;
  const clear = app.querySelector('#search-clear');
  if (clear) clear.hidden = !state.q;
}

function renderHome() {
  document.title = `${APP.name} — 과자 성분을 눈으로 보기`;

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">${LOGO}<div class="brand-text"><h1>${APP.name}</h1><p>${APP.tagline}</p></div></div>
      ${
        isAdminUser()
          ? `<a class="admin-link" href="#/admin" aria-label="어드민 관리" title="어드민 관리">${GEAR_ICON}</a>`
          : ''
      }
      <a class="board-link" href="#/board" aria-label="제안·제보 게시판">${BOARD_ICON}<span>제안·제보</span></a>
      ${authChipHtml()}
    </header>
    <div class="search-wrap">
      <label class="search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input id="q" type="search" value="${esc(state.q)}" placeholder="제품 이름으로 찾기 (예: 바나나킥)" aria-label="제품 검색" autocomplete="off" />
        <button type="button" class="search-clear" id="search-clear" aria-label="검색어 지우기"${state.q ? '' : ' hidden'}>✕</button>
      </label>
    </div>
    <nav class="chips" aria-label="카테고리">
      <button class="chip" data-cat="all" aria-pressed="${state.category === 'all'}">전체 ${listProducts().length}</button>
      ${CATEGORIES.map(
        (c) =>
          `<button class="chip" data-cat="${c.key}" aria-pressed="${state.category === c.key}">${c.emoji} ${c.short ?? c.name}</button>`,
      ).join('')}
    </nav>
    <button class="cta" id="custom-cta">
      <span class="cta-emoji">📷</span>
      <span><b>직접 입력해서 보기</b><small>성분표 사진을 찍고 숫자만 적으면 카드가 나와요</small></span>
      <span class="arrow">›</span>
    </button>
    <div id="home-feed"></div>
    <p class="foot-note">${esc(APP.dataNote)}<br />${esc(APP.disclaimer)}</p>
  `;

  const input = app.querySelector('#q');
  input.addEventListener('input', () => {
    state.q = input.value;
    renderHomeFeed();
  });

  app.querySelector('#search-clear').addEventListener('click', () => {
    state.q = '';
    input.value = '';
    renderHomeFeed();
    input.focus();
  });

  app.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.category === btn.dataset.cat) return;
      state.category = btn.dataset.cat;
      app
        .querySelectorAll('[data-cat]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.category)));
      renderHomeFeed();
    });
  });

  app.querySelector('#custom-cta').addEventListener('click', () => {
    location.hash = '#/custom';
  });

  bindAuthChip();
  renderHomeFeed();
}

/* ── 상세 ───────────────────────────────────── */
function renderDetail(product) {
  const model = buildModel(product);
  const { svg } = cardSVG(model);
  document.title = `${model.name} — ${APP.name}`;
  const alts = lowSugarAlternatives(product, listProducts(), 3);
  const currentSugar100 = Math.round((product.sugar / Math.max(1, product.weight)) * 1000) / 10;
  const maxSugar = Math.max(currentSugar100, ...alts.map((a) => a.sugar100), 1);
  const maxSodium = Math.max(
    Math.round((product.sodium / Math.max(1, product.weight)) * 100),
    ...alts.map((a) => a.sodium100),
    1,
  );

  const altRows = alts
    .map(
      (a) => `<div class="alt-row">
        <span class="alt-name"><b>${esc(a.name)}</b>${brandBadge(a.brand)}</span>
        <span class="alt-bars">
          <span class="bar"><span style="width:${((a.sugar100 / maxSugar) * 100).toFixed(0)}%"></span></span>
          <span class="bar sodium"><span style="width:${((a.sodium100 / maxSodium) * 100).toFixed(0)}%"></span></span>
        </span>
        <span class="alt-val"><b>당 ${a.sugar100}g</b><em>나트륨 ${a.sodium100}mg</em></span>
      </div>`,
    )
    .join('');
  const isCatalog = isCatalogProduct(product.id);
  const altLinks = Array.isArray(product.altLinks) ? product.altLinks : [];

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title">${esc(model.name)}</span>
      ${authChipHtml()}
    </header>
    <div class="card-wrap" id="card-wrap">${svg}</div>
    <div class="actions">
      <button class="btn" id="save">이미지 저장</button>
      <button class="btn secondary" id="share">공유하기</button>
    </div>
    <section class="panel ${state.altOpen ? 'open' : 'panel-body-closed'}" id="alt-panel">
      <button class="panel-head" id="alt-toggle" aria-expanded="${state.altOpen}" aria-controls="alt-body">
        <span>🍃</span><span>저당·대체 간식 보기</span><span class="chev">⌄</span>
      </button>
      <div class="panel-body" id="alt-body">
        <p class="alt-note">같은 카테고리에서 당류가 적은 순서예요. 100g당 기준으로 나란히 비교했습니다.<br />
        이 제품: 당류 ${currentSugar100}g · 나트륨 ${Math.round((product.sodium / Math.max(1, product.weight)) * 100)}mg / 100g</p>
        ${altRows || '<p class="alt-note">비교할 다른 제품이 아직 없어요.</p>'}
        <div class="legend"><span><i style="background:#4f6b48"></i>당류</span><span><i style="background:#c0512a"></i>나트륨</span></div>
        ${altLinksBlock(altLinks, product)}
      </div>
    </section>
    <section class="facts">
      <h3>영양성분 · ${model.serving}</h3>
      <div class="fact-grid">
        <div class="fact"><span>열량</span><b>${model.kcal ?? '-'} kcal</b></div>
        <div class="fact"><span>탄수화물</span><b>${has(product.carbs) ? `${fmtAmount(product.carbs)} g` : '—'}</b></div>
        <div class="fact"><span>단백질</span><b>${has(product.protein) ? `${fmtAmount(product.protein)} g` : '—'}</b></div>
        <div class="fact"><span>당류</span><b>${fmtAmount(product.sugar)} g</b></div>
        <div class="fact"><span>지방</span><b>${fmtAmount(product.fat)} g</b></div>
        <div class="fact"><span>나트륨</span><b>${fmtAmount(product.sodium)} mg</b></div>
      </div>
      <p class="foot-note">${esc(APP.dataNote)}</p>
      ${isCatalog ? '<p class="report-link"><a href="#/board/fix_info">성분 정보가 실제와 다른가요? 제보하기 ›</a></p>' : ''}
    </section>
    ${
      isCatalog
        ? `<section class="comments" id="comments">
      <div class="comments-head">
        <h3>💬 아이템별 댓글</h3>
        <span class="comments-total" id="comments-total"></span>
      </div>
      ${
        isSignedIn()
          ? `<p class="comments-note comment-me">댓글은 <b>${esc(myName())}</b> 이름으로 남아요. <button type="button" class="link-btn" id="nick-edit">닉네임 변경</button></p>
      <form class="comment-form" id="comment-form" novalidate>
        <label class="sr-only" for="cm-body">댓글 내용</label>
        <textarea id="cm-body" maxlength="${COMMENT_LIMITS.bodyMax}" rows="2" placeholder="이 간식, 어떠셨나요?"></textarea>
        <p class="field-error" id="cm-error" role="alert" hidden></p>
        <div class="comment-foot">
          <span class="counter" id="cm-counter">0/${COMMENT_LIMITS.bodyMax}</span>
          <button class="comment-submit" type="submit" id="cm-submit">댓글 남기기</button>
        </div>
      </form>`
          : `<p class="comments-note">댓글은 누구나 읽을 수 있어요. 기명으로 남기려면 로그인해 주세요.</p>
      <div class="comment-gate">
        <p>기명으로 댓글을 남기려면 로그인이 필요해요.<br /><span>카카오·구글·애플 계정으로 바로 시작할 수 있어요.</span></p>
        <button type="button" class="comment-submit gate" id="comment-login">카카오·구글·애플로 로그인</button>
      </div>`
      }
      <ul class="comment-list" id="comment-list"></ul>
    </section>`
        : ''
    }
  `;

  app.querySelector('#back').addEventListener('click', goBack);

  app.querySelector('#alt-toggle').addEventListener('click', () => {
    state.altOpen = !state.altOpen;
    const panel = app.querySelector('#alt-panel');
    panel.classList.toggle('panel-body-closed', !state.altOpen);
    panel.classList.toggle('open', state.altOpen);
    app.querySelector('#alt-toggle').setAttribute('aria-expanded', String(state.altOpen));
  });

  const svgEl = app.querySelector('#card-wrap svg');
  app.querySelector('#save').addEventListener('click', () => exportCard(svgEl, model, 'save'));
  app.querySelector('#share').addEventListener('click', () => exportCard(svgEl, model, 'share'));

  if (isCatalog) setupComments(product.id);
  bindAuthChip();
}

/* ── 사진 자동 인식 (Gemini Vision · POST /api/analyze-food) ─────────
   고른 사진을 1280px JPEG로 줄여 서버리스 함수로 보내면, 서버가 Gemini로
   성분표 숫자나 앞면 제품 정보를 읽어 돌려준다. 값은 입력칸에만 채운다. */
const VISION_MAX_PX = 1280;
const VISION_QUALITY = 0.82;
const VISION_MAX_BASE64 = 4 * 1024 * 1024; // 원본 3MB 한도 ≈ base64 4MB

/** 사진 → 최대 1280px JPEG data URL. 투명 PNG가 검게 나오지 않게 흰 바탕을 깐다. */
function canvasJpeg(imgEl, quality) {
  const nw = imgEl.naturalWidth || imgEl.width;
  const nh = imgEl.naturalHeight || imgEl.height;
  if (!nw || !nh) throw new Error('empty-image');
  const scale = Math.min(1, VISION_MAX_PX / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(imgEl, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** /api/analyze-food 요청 바디. 너무 크면 품질을 낮춰 한 번 더 줄인다. */
function imagePayload(imgEl) {
  let quality = VISION_QUALITY;
  let dataUrl = canvasJpeg(imgEl, quality);
  while (dataUrl.length > VISION_MAX_BASE64 && quality > 0.5) {
    quality = Math.round((quality - 0.12) * 100) / 100;
    dataUrl = canvasJpeg(imgEl, quality);
  }
  return { mimeType: 'image/jpeg', imageBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

/* 응답 키 → 입력칸. 값이 있는 칸만 채우고, 손대면 강조를 지운다. */
const AI_FIELDS = {
  name: { id: 'f-name', label: '제품 이름' },
  brand: { id: 'f-brand', label: '브랜드' },
  servingG: { id: 'f-weight', label: '중량' },
  kcal: { id: 'f-kcal', label: '열량' },
  sodiumMg: { id: 'f-sodium', label: '나트륨' },
  sugarG: { id: 'f-sugar', label: '당류' },
  fatG: { id: 'f-fat', label: '지방' },
  carbsG: { id: 'f-carbs', label: '탄수화물' },
  proteinG: { id: 'f-protein', label: '단백질' },
};

/** 서버 오류 → 사용자가 다음에 할 일이 보이는 문장. */
function aiErrorText(status, data) {
  const code = data?.error;
  if (status === 503 || code === 'missing_api_key' || code === 'ai_unavailable') {
    return 'AI 사진 인식을 지금 쓸 수 없어요. 아래에 직접 적어도 카드를 만들 수 있어요.';
  }
  if (status === 429) {
    return data?.message || '잠깐 요청이 많았어요. 조금 뒤에 다시 시도해 주세요.';
  }
  if (status === 413) {
    return '사진이 너무 커요. 다시 찍거나 3MB 이하 사진으로 올려 주세요.';
  }
  if (status === 400) {
    return '사진을 읽지 못했어요. 밝은 곳에서 다시 찍어 주세요.';
  }
  if (status === 504) {
    return 'AI 응답이 늦어지고 있어요. 잠시 뒤 다시 시도하거나 아래에 직접 적어 주세요.';
  }
  return 'AI가 사진을 읽지 못했어요. 다시 시도하거나 아래에 직접 적어 주세요.';
}

/* ── 직접 입력 ───────────────────────────────── */
function renderCustomForm() {
  document.title = `직접 입력 — ${APP.name}`;
  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title">직접 입력해서 보기</span>
    </header>
    <form class="form" id="custom-form" novalidate>
      <div class="photo-zone">
        <button type="button" class="photo-btn" id="photo-btn">
          <span class="big">📷</span>
          <b>성분표 사진 찍기 / 올리기</b>
          <small>성분표나 제품 앞면을 찍으면 AI가 자동으로 숫자를 채워 드려요</small>
        </button>
        <input type="file" id="photo-input" accept="image/*" capture="environment" class="sr-only" />
        <input type="file" id="album-input" accept="image/*" class="sr-only" />
        <div class="photo-preview" id="photo-preview" hidden>
          <img id="photo-img" alt="성분표 미리보기" />
          <button type="button" class="remove" id="photo-remove" aria-label="사진 지우기">✕</button>
        </div>
        <p class="form-note" id="photo-hint" hidden>사진은 성분을 읽기 위해 AI(Google Gemini)로 전송돼요. 읽은 값은 아래에서 바로 고칠 수 있고, 사진은 저장하지 않아요.</p>
        <div class="ocr-box" id="ocr-box" hidden>
          <button type="button" class="ocr-btn" id="ocr-btn">✨ 사진에서 성분 자동 채우기</button>
          <p class="ocr-status" id="ocr-status" role="status" aria-live="polite" hidden></p>
        </div>
        <div class="ai-banner" id="ai-banner" role="status" aria-live="polite" hidden></div>
        <button type="button" class="chip" id="album-btn" style="margin-top:8px">앨범에서 고르기</button>
      </div>

      <div class="field">
        <label for="f-name">제품 이름</label>
        <input id="f-name" name="name" type="text" placeholder="예: 우리 집 과자" maxlength="40" required />
      </div>
      <div class="row-2">
        <div class="field">
          <label for="f-brand">브랜드 (선택)</label>
          <input id="f-brand" name="brand" type="text" placeholder="예: 농심" maxlength="20" />
        </div>
        <div class="field">
          <label for="f-cat">종류</label>
          <select id="f-cat" name="category">
            ${CATEGORIES.map((c) => `<option value="${c.key}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field">
          <label for="f-weight">중량 (g 또는 ml)</label>
          <input id="f-weight" name="weight" type="number" inputmode="decimal" placeholder="75" min="1" max="5000" required />
        </div>
        <div class="field">
          <label for="f-kcal">열량 (kcal)</label>
          <input id="f-kcal" name="kcal" type="number" inputmode="numeric" placeholder="355" min="0" max="5000" />
        </div>
      </div>
      <div class="row-2">
        <div class="field">
          <label for="f-sodium">나트륨 (mg)</label>
          <input id="f-sodium" name="sodium" type="number" inputmode="decimal" placeholder="100" min="0" max="30000" required />
        </div>
        <div class="field">
          <label for="f-sugar">당류 (g)</label>
          <input id="f-sugar" name="sugar" type="number" inputmode="decimal" placeholder="12" min="0" max="1000" required />
        </div>
      </div>
      <div class="field">
        <label for="f-fat">지방 (g)</label>
        <input id="f-fat" name="fat" type="number" inputmode="decimal" placeholder="4.6" min="0" max="1000" required />
      </div>
      <div class="row-2">
        <div class="field">
          <label for="f-carbs">탄수화물 (g)</label>
          <input id="f-carbs" name="carbs" type="number" inputmode="decimal" placeholder="50" min="0" max="1000" />
        </div>
        <div class="field">
          <label for="f-protein">단백질 (g)</label>
          <input id="f-protein" name="protein" type="number" inputmode="decimal" placeholder="5" min="0" max="1000" />
        </div>
      </div>
      <div class="field">
        <label for="f-ing">원재료 (선택)</label>
        <textarea id="f-ing" name="ingredients" rows="2" placeholder="예: 옥수수, 설탕, 팜유, 정제소금"></textarea>
        <p class="hint">적지 않으면 종류에 맞는 기본 원재료로 쌓아요.</p>
      </div>
      <button class="submit" type="submit">속보이네로 보기</button>
      <p class="form-note">입력한 값으로만 카드를 만들고, 어디에도 저장하지 않아요.</p>
    </form>
  `;

  app.querySelector('#back').addEventListener('click', goBack);

  const photoInput = app.querySelector('#photo-input');
  const albumInput = app.querySelector('#album-input');
  const preview = app.querySelector('#photo-preview');
  const img = app.querySelector('#photo-img');
  const hint = app.querySelector('#photo-hint');
  const ocrBox = app.querySelector('#ocr-box');
  const ocrBtn = app.querySelector('#ocr-btn');
  const ocrStatus = app.querySelector('#ocr-status');
  let ocrBusy = false;

  const setOcrStatus = (msg, kind = 'info') => {
    ocrStatus.hidden = false;
    ocrStatus.textContent = msg;
    ocrStatus.className = `ocr-status${kind === 'error' ? ' error' : kind === 'busy' ? ' busy' : ''}`;
  };

  app.querySelector('#photo-btn').addEventListener('click', () => photoInput.click());
  app.querySelector('#album-btn').addEventListener('click', () => albumInput.click());

  const loadPhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photoDataUrl = reader.result;
      img.src = reader.result;
      preview.hidden = false;
      hint.hidden = false;
      ocrBox.hidden = false;
      ocrStatus.hidden = true;
      app.querySelector('#ai-banner').hidden = true;
      ocrBtn.disabled = false;
      ocrBtn.textContent = '✨ 사진에서 성분 자동 채우기';
      runVision(); // 사진을 고르면 바로 읽는다. 버튼으로 다시 시도할 수 있다.
    };
    reader.readAsDataURL(file);
  };

  photoInput.addEventListener('change', (e) => loadPhoto(e.target.files?.[0]));
  albumInput.addEventListener('change', (e) => loadPhoto(e.target.files?.[0]));
  app.querySelector('#photo-remove').addEventListener('click', () => {
    state.photoDataUrl = null;
    preview.hidden = true;
    hint.hidden = true;
    ocrBox.hidden = true;
    ocrStatus.hidden = true;
    app.querySelector('#ai-banner').hidden = true;
    img.removeAttribute('src');
    photoInput.value = '';
    albumInput.value = '';
  });

  // 인식된 값은 바로 수정할 수 있게 칸에만 넣고, 손대면 강조를 지운다.
  const fillFromAi = (result) => {
    let filled = 0;
    for (const [key, field] of Object.entries(AI_FIELDS)) {
      const value = result[key];
      if (value == null || value === '') continue;
      const input = app.querySelector(`#${field.id}`);
      if (!input) continue;
      // 사용자가 직접 적어 둔 칸은 건드리지 않는다(AI가 채운 칸은 새 값으로 갱신).
      if (input.value.trim() && !input.classList.contains('ocr-filled')) continue;
      input.value = String(value);
      input.classList.add('ocr-filled');
      input.addEventListener('input', () => input.classList.remove('ocr-filled'), { once: true });
      filled++;
    }

    const cat = app.querySelector('#f-cat');
    if (cat && result.category && CATEGORIES.some((c) => c.key === result.category)) {
      cat.value = result.category;
      cat.classList.add('ocr-filled');
      cat.addEventListener('change', () => cat.classList.remove('ocr-filled'), { once: true });
    } else if (cat && result.unit === 'ml' && cat.value === 'snack') {
      cat.value = 'drink';
      cat.classList.add('ocr-filled');
      cat.addEventListener('change', () => cat.classList.remove('ocr-filled'), { once: true });
    }

    const ing = app.querySelector('#f-ing');
    if (ing && Array.isArray(result.ingredients) && result.ingredients.length) {
      if (!ing.value.trim() || ing.classList.contains('ocr-filled')) {
        ing.value = result.ingredients.join(', ');
        ing.classList.add('ocr-filled');
        ing.addEventListener('input', () => ing.classList.remove('ocr-filled'), { once: true });
        filled++;
      }
    }
    return filled;
  };

  // 앞면 제품명으로 찾아 채운 값은 포장지와 다를 수 있어서 따로 알려 준다.
  const showAiBanner = (result) => {
    const banner = app.querySelector('#ai-banner');
    if (!banner) return;
    if (result.mode !== 'product_lookup' && result.estimated !== true) {
      banner.hidden = true;
      return;
    }
    let msg =
      result.mode === 'product_lookup'
        ? '앞면 제품명으로 성분을 찾아 채웠어요. 실제 포장지 숫자와 다른 부분이 있으면 아래에서 바로 수정해 주세요.'
        : '사진만으로 추정해 채운 값이 있어요. 실제 포장지 숫자와 다른 부분이 있으면 아래에서 바로 수정해 주세요.';
    if (result.note) msg += ` 참고: ${result.note}`;
    banner.textContent = msg;
    banner.hidden = false;
  };

  const runVision = async () => {
    if (ocrBusy || !img.src) return;
    ocrBusy = true;
    ocrBtn.disabled = true;
    ocrBtn.textContent = '사진 읽는 중...';
    app.querySelector('#ai-banner').hidden = true;
    setOcrStatus('AI가 사진에서 성분을 찾는 중이에요... (보통 2~3초)', 'busy');
    const started = Date.now();

    try {
      if (img.decode) {
        try {
          await img.decode();
        } catch {
          /* 이미 로드된 사진이면 그냥 진행 */
        }
      }
      const payload = imagePayload(img);
      let res;
      try {
        res = await fetch('/api/analyze-food', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error('AI 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 아래에 직접 적어 주세요.');
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data || data.ok === false) {
        throw new Error(aiErrorText(res.status, data));
      }

      const filled = fillFromAi(data);
      showAiBanner(data);
      const sec = ((Date.now() - started) / 1000).toFixed(1);
      if (filled === 0) {
        setOcrStatus(
          '사진에서 성분을 찾지 못했어요. 성분표가 잘 보이게 다시 찍거나, 아래에 직접 적어 주세요.',
          'error',
        );
        ocrBtn.textContent = '다시 인식하기';
      } else {
        let msg = `${sec}초 만에 ${filled}개 항목을 채웠어요. 틀린 숫자가 없는지 확인하고 카드를 만들어 보세요!`;
        const gaps = ['name', 'servingG', 'sodiumMg', 'fatG'].filter((k) => data[k] == null);
        if (gaps.length) msg += ` ${gaps.map((k) => AI_FIELDS[k].label).join('·')}은(는) 직접 채워 주세요.`;
        setOcrStatus(msg, 'ok');
        ocrBtn.textContent = '다시 인식하기';
      }
    } catch (err) {
      console.warn('[analyze-food] failed', err?.message || err);
      setOcrStatus(
        err?.message || 'AI가 사진을 읽지 못했어요. 다시 시도하거나 아래에 직접 적어 주세요.',
        'error',
      );
      ocrBtn.textContent = '다시 시도';
    } finally {
      ocrBusy = false;
      ocrBtn.disabled = false;
    }
  };

  ocrBtn.addEventListener('click', runVision);

  app.querySelector('#custom-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const weight = parseFloat(f.weight.value);
    const sodium = parseFloat(f.sodium.value);
    const sugar = parseFloat(f.sugar.value);
    const fat = parseFloat(f.fat.value);
    if (!name) return showToast('제품 이름을 적어 주세요.');
    if (!(weight > 0)) return showToast('중량을 숫자로 적어 주세요.');
    if ([sodium, sugar, fat].some((v) => !Number.isFinite(v) || v < 0)) {
      return showToast('나트륨·당류·지방을 숫자로 적어 주세요.');
    }
    const kcalRaw = parseFloat(f.kcal.value);
    const carbsRaw = parseFloat(f.carbs.value);
    const proteinRaw = parseFloat(f.protein.value);
    const optional = (v) => (Number.isFinite(v) && v >= 0 ? v : '');
    const product = {
      id: 'custom',
      name,
      brand: f.brand.value.trim(),
      category: f.category.value,
      unit: f.category.value === 'drink' ? 'ml' : 'g',
      weight,
      kcal: Number.isFinite(kcalRaw) ? kcalRaw : null,
      sodium,
      sugar,
      fat,
      carbs: optional(carbsRaw),
      protein: optional(proteinRaw),
      ingredients: f.ingredients.value
        .split(/[,·\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
      note: '',
    };
    state.custom = product;
    state.altOpen = false;
    location.hash = '#/c';
  });
}

/**
 * 같은 내용이 30초 안에 또 올라오는 것을 막는다(버튼 연타·새로고침 뒤 재전송).
 * 글을 보내기 전에 기록하고, 실패하면 지운다.
 */
const recentPosts = { feedback: { sig: '', at: 0 }, comment: { sig: '', at: 0 } };
function isDuplicatePost(kind, signature) {
  const now = Date.now();
  const last = recentPosts[kind];
  if (last.sig === signature && now - last.at < 30000) return true;
  recentPosts[kind] = { sig: signature, at: now };
  return false;
}
function clearDuplicatePost(kind) {
  recentPosts[kind] = { sig: '', at: 0 };
}

/* ── 제품별 댓글 ─────────────────────────────── */
const isMyComment = (row) => Boolean(row?.user_id && row.user_id === authState.session?.user?.id);

function commentItem(row, { highlight = false, mine = false } = {}) {
  const li = document.createElement('li');
  li.className = `comment${highlight ? ' new' : ''}`;
  if (row.id) li.dataset.id = String(row.id);

  const top = document.createElement('div');
  top.className = 'comment-top';
  const nick = document.createElement('b');
  nick.textContent = row.nickname || '익명';
  const time = document.createElement('time');
  if (row.created_at) {
    time.dateTime = row.created_at;
    time.title = new Date(row.created_at).toLocaleString('ko-KR');
  }
  time.textContent = relativeTime(row.created_at);
  top.append(nick, time);

  if (mine) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'comment-del';
    del.dataset.deleteId = String(row.id);
    del.textContent = '삭제';
    del.setAttribute('aria-label', `${row.nickname || '내'} 댓글 삭제`);
    top.appendChild(del);
  }

  const body = document.createElement('p');
  body.className = 'comment-body';
  body.textContent = row.body || '';

  li.append(top, body);
  return li;
}

function setupComments(productId) {
  const form = app.querySelector('#comment-form');
  const bodyInput = app.querySelector('#cm-body');
  const errEl = app.querySelector('#cm-error');
  const listEl = app.querySelector('#comment-list');
  const counter = app.querySelector('#cm-counter');
  const submitBtn = app.querySelector('#cm-submit');
  const totalEl = app.querySelector('#comments-total');
  if (!listEl) return;

  const token = ++commentsToken;
  const alive = () => token === commentsToken;
  let items = [];
  let busy = false;
  let deleting = false;

  // 비로그인 안내의 로그인 버튼 / 로그인한 사람의 '닉네임 변경' 링크
  app.querySelector('#comment-login')?.addEventListener('click', () => openLoginSheet());
  app.querySelector('#nick-edit')?.addEventListener('click', () => openProfileSheet());

  const setEmpty = (text, { retry = false } = {}) => {
    listEl.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'comment-empty';
    const p = document.createElement('p');
    p.textContent = text;
    li.appendChild(p);
    if (retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'retry-btn';
      btn.textContent = '다시 불러오기';
      btn.addEventListener('click', () => load());
      li.appendChild(btn);
    }
    listEl.appendChild(li);
  };

  const renderList = (highlightId = '') => {
    if (!alive()) return;
    totalEl.textContent = items.length ? `${items.length}개` : '';
    listEl.innerHTML = '';
    if (!items.length) {
      setEmpty('아직 댓글이 없어요. 첫 번째 한마디를 남겨 보세요.');
      return;
    }
    for (const row of items) {
      listEl.appendChild(commentItem(row, { highlight: String(row.id) === String(highlightId), mine: isMyComment(row) }));
    }
  };

  async function load() {
    if (!alive()) return;
    listEl.innerHTML = '';
    const sk = document.createElement('li');
    sk.className = 'comment-skeleton';
    sk.innerHTML = '<span></span><span></span>';
    listEl.appendChild(sk);
    try {
      const rows = await boardApi.listComments(productId);
      if (!alive()) return;
      items = sortOldestFirst(rows);
      renderList();
    } catch (err) {
      if (!alive()) return;
      totalEl.textContent = '';
      setEmpty(`${friendlyMessage(err)}`, { retry: true });
    }
  }

  // 내 댓글 [삭제] — RLS가 본인 댓글만 지우게 하고, 지워졌는지까지 확인한다
  listEl.addEventListener('click', async (event) => {
    const btn = event.target.closest?.('[data-delete-id]');
    if (!btn || !alive() || deleting) return;
    const id = btn.dataset.deleteId;
    deleting = true;
    btn.disabled = true;
    try {
      const session = await currentSession();
      if (!session?.accessToken) {
        openLoginSheet(SESSION_ERROR);
        return;
      }
      const removed = await boardApi.deleteComment(id, { accessToken: session.accessToken });
      if (!alive()) return;
      if (!removed) {
        showToast('이미 지워졌거나 내 댓글이 아니에요.');
        await load();
        return;
      }
      items = items.filter((row) => String(row.id) !== String(id));
      renderList();
      showToast('댓글을 지웠어요.');
    } catch (err) {
      if (!alive()) return;
      if (err instanceof BoardError && err.kind === 'auth') {
        openLoginSheet(SESSION_ERROR);
        return;
      }
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = commentErrorMessage(err);
      }
    } finally {
      deleting = false;
      if (btn.isConnected) btn.disabled = false;
    }
  });

  // 입력 폼은 로그인했을 때만 있다. 비로그인이면 목록만 읽는다.
  if (form && bodyInput && counter && submitBtn && errEl) {
    bodyInput.addEventListener('input', () => {
      counter.textContent = `${countChars(bodyInput.value)}/${COMMENT_LIMITS.bodyMax}`;
      bodyInput.classList.remove('invalid');
      bodyInput.removeAttribute('aria-invalid');
      errEl.hidden = true;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const check = validateComment({ productId, nickname: myName(), body: bodyInput.value });
      if (!check.ok) {
        errEl.hidden = false;
        errEl.textContent = check.errors.body || check.errors.nickname || '내용을 확인해 주세요.';
        bodyInput.classList.add('invalid');
        bodyInput.setAttribute('aria-invalid', 'true');
        bodyInput.focus();
        return;
      }

      busy = true;
      submitBtn.disabled = true;
      submitBtn.textContent = '남기는 중...';
      errEl.hidden = true;
      if (isDuplicatePost('comment', `${check.value.productId}|${check.value.body}`)) {
        busy = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '댓글 남기기';
        errEl.hidden = false;
        errEl.textContent = '방금 같은 댓글을 남겼어요. 잠시 뒤 다시 시도해 주세요.';
        return;
      }
      try {
        const session = await currentSession();
        if (!session?.user?.id) {
          openLoginSheet(SESSION_ERROR);
          return;
        }
        const row = await boardApi.createComment(
          { ...check.value, nickname: myName(), userId: session.user.id },
          { accessToken: session.accessToken },
        );
        if (!alive()) return;
        items = sortOldestFirst([...items, row]);
        renderList(row.id);
        rememberNickname(myName());
        bodyInput.value = '';
        counter.textContent = `0/${COMMENT_LIMITS.bodyMax}`;
        const created = listEl.querySelector(`[data-id="${row.id}"]`);
        created?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        showToast('댓글을 남겼어요.');
      } catch (err) {
        if (!alive()) return;
        clearDuplicatePost('comment');
        if (err instanceof BoardError && err.kind === 'auth') {
          openLoginSheet(SESSION_ERROR);
          return;
        }
        errEl.hidden = false;
        errEl.textContent = commentErrorMessage(err);
      } finally {
        busy = false;
        if (alive() && submitBtn.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = '댓글 남기기';
        }
      }
    });
  }

  load();
}

/* ── 제안·제보 게시판 ───────────────────────── */
const BOARD_PAGE_SIZE = 50;

function boardTag(row) {
  const tag = document.createElement('span');
  tag.className = `tag tag-${isBoardCategory(row.category) ? row.category : 'etc'}`;
  tag.textContent = `${categoryEmoji(row.category)} ${categoryName(row.category)}`;
  return tag;
}

function boardCard(row) {
  const li = document.createElement('li');
  li.className = 'post';

  const top = document.createElement('div');
  top.className = 'post-top';
  const status = document.createElement('span');
  status.className = `status ${row.status === 'done' ? 'done' : 'open'}`;
  status.textContent = statusLabel(row.status);
  top.append(boardTag(row), status);

  const title = document.createElement('h3');
  title.className = 'post-title';
  title.textContent = row.title || '(제목 없음)';

  const body = document.createElement('p');
  body.className = 'post-body';
  body.textContent = row.body || '';

  const meta = document.createElement('div');
  meta.className = 'post-meta';
  const nick = document.createElement('b');
  nick.textContent = row.nickname || '익명';
  const time = document.createElement('time');
  if (row.created_at) {
    time.dateTime = row.created_at;
    time.title = new Date(row.created_at).toLocaleString('ko-KR');
  }
  time.textContent = relativeTime(row.created_at);
  meta.append(nick, document.createTextNode(' · '), time);

  li.append(top, title, body, meta);
  return li;
}

function boardSkeleton() {
  const li = document.createElement('li');
  li.className = 'post skeleton-card';
  li.innerHTML =
    '<span class="sk sk-tag"></span><span class="sk sk-title"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span>';
  return li;
}

function boardStatePanel({ title, detail, actionLabel, onAction }) {
  const li = document.createElement('li');
  li.className = 'board-state';
  const p = document.createElement('p');
  const strong = document.createElement('b');
  strong.textContent = title;
  p.appendChild(strong);
  if (detail) {
    const span = document.createElement('span');
    span.textContent = detail;
    p.appendChild(span);
  }
  li.appendChild(p);
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'retry-btn';
    btn.textContent = actionLabel;
    btn.addEventListener('click', onAction);
    li.appendChild(btn);
  }
  return li;
}

function renderBoardList() {
  const listEl = app.querySelector('#board-list');
  if (!listEl) return;
  const countEl = app.querySelector('#board-count');
  if (countEl) countEl.textContent = board.items.length ? `${board.items.length}건` : '';
  listEl.innerHTML = '';

  if (board.loading && !board.items.length) {
    for (let i = 0; i < 3; i++) listEl.appendChild(boardSkeleton());
    return;
  }
  if (board.error && !board.items.length) {
    listEl.appendChild(
      boardStatePanel({
        title: '글을 불러오지 못했어요.',
        detail: board.error,
        actionLabel: '다시 불러오기',
        onAction: () => loadBoard(),
      }),
    );
    return;
  }
  if (!board.items.length) {
    listEl.appendChild(
      boardStatePanel({
        title: '아직 남겨진 글이 없어요.',
        detail: '위의 ‘글 남기기’로 첫 번째 제안을 남겨 주시면 이 자리에 보여 드려요.',
      }),
    );
    return;
  }
  if (board.error) {
    // 이미 받아 둔 글이 있으면 목록은 그대로 두고, 새로 고치지 못했다는 것만 알린다
    const banner = document.createElement('li');
    banner.className = 'board-banner';
    const text = document.createElement('span');
    text.textContent = '새 글을 불러오지 못했어요.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'banner-retry';
    btn.textContent = '다시 불러오기';
    btn.addEventListener('click', () => loadBoard());
    banner.append(text, btn);
    listEl.appendChild(banner);
  }
  for (const row of board.items) listEl.appendChild(boardCard(row));
  if (board.items.length >= BOARD_PAGE_SIZE) {
    const note = document.createElement('li');
    note.className = 'board-note';
    note.textContent = `최근 ${BOARD_PAGE_SIZE}건까지 보여 드려요.`;
    listEl.appendChild(note);
  }
}

async function loadBoard() {
  const token = ++board.token;
  board.loading = true;
  board.error = '';
  renderBoardList();
  try {
    const rows = await boardApi.listFeedback({ category: board.category, limit: BOARD_PAGE_SIZE });
    if (token !== board.token) return;
    board.items = sortNewestFirst(filterFeedback(rows, board.category));
    board.loaded = true;
  } catch (err) {
    if (token !== board.token) return;
    board.error = friendlyMessage(err);
  } finally {
    if (token === board.token) {
      board.loading = false;
      renderBoardList();
    }
  }
}

function replaceBoardHash() {
  const target = board.category === 'all' ? '#/board' : `#/board/${board.category}`;
  if (location.hash !== target) {
    try {
      history.replaceState(null, '', target);
    } catch {
      /* 해시만 바꾸는 replaceState가 막힌 환경이면 주소는 그대로 둔다 */
    }
  }
}

function renderBoard() {
  document.title = `제안·제보 — ${APP.name}`;
  const chipList = [{ key: 'all', name: '전체' }, ...BOARD_CATEGORIES];

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title">제안·제보</span>
      <span class="topbar-note" id="board-count"></span>
    </header>
    <p class="board-intro">목록에 없는 간식, 성분표가 실제와 다른 점, 있으면 좋겠는 기능을 남겨 주세요. 로그인 없이 익명으로 쓸 수 있어요.</p>
    <nav class="chips board-chips" aria-label="제보 분류">
      ${chipList
        .map(
          (c) =>
            `<button class="chip" data-board-cat="${c.key}" aria-pressed="${board.category === c.key}">${
              c.key === 'all' ? '전체' : `${categoryEmoji(c.key)} ${c.short ?? c.name}`
            }</button>`,
        )
        .join('')}
    </nav>
    <div class="board-tools">
      <button class="write-btn" id="write-toggle" aria-expanded="${board.formOpen}" aria-controls="board-form-wrap">
        <span aria-hidden="true">✍️</span><span>${board.formOpen ? '글쓰기 닫기' : '글 남기기'}</span>
      </button>
    </div>
    <section class="board-form-wrap" id="board-form-wrap" ${board.formOpen ? '' : 'hidden'}>
      <form class="board-form" id="board-form" novalidate>
        <div class="field">
          <label for="b-cat">분류</label>
          <select id="b-cat">
            ${BOARD_CATEGORIES.map((c) => `<option value="${c.key}">${c.emoji} ${c.name}</option>`).join('')}
          </select>
          <p class="field-error" id="e-cat" hidden></p>
        </div>
        <div class="field">
          <label for="b-title">제목 <span class="counter" id="c-title">0/${FEEDBACK_LIMITS.titleMax}</span></label>
          <input id="b-title" type="text" maxlength="${FEEDBACK_LIMITS.titleMax}" placeholder="예: 오리온 초코파이도 추가해 주세요" autocomplete="off" />
          <p class="field-error" id="e-title" hidden></p>
        </div>
        <div class="field">
          <label for="b-body">내용 <span class="counter" id="c-body">0/${FEEDBACK_LIMITS.bodyMax}</span></label>
          <textarea id="b-body" rows="4" maxlength="${FEEDBACK_LIMITS.bodyMax}" placeholder="어떤 제품인지, 어디서 보셨는지 적어 주시면 큰 도움이 돼요."></textarea>
          <p class="field-error" id="e-body" hidden></p>
        </div>
        <div class="field">
          <label for="b-nick">닉네임 (선택)</label>
          <input id="b-nick" type="text" maxlength="${FEEDBACK_LIMITS.nicknameMax}" placeholder="비우면 익명으로 남아요" autocomplete="nickname" />
          <p class="field-error" id="e-nick" hidden></p>
        </div>
        <p class="form-error" id="board-form-error" role="alert" hidden></p>
        <div class="form-actions">
          <button class="btn secondary" type="button" id="form-cancel">취소</button>
          <button class="btn" type="submit" id="form-submit">등록하기</button>
        </div>
      </form>
    </section>
    <ul class="board-list" id="board-list"></ul>
    <p class="foot-note">광고·비방·개인정보가 담긴 글은 따로 알리지 않고 정리될 수 있어요.<br />남겨 주신 글은 서비스 개선에만 씁니다.</p>
  `;

  app.querySelector('#back').addEventListener('click', goBack);

  const formWrap = app.querySelector('#board-form-wrap');
  const toggle = app.querySelector('#write-toggle');
  const catSel = app.querySelector('#b-cat');
  const titleEl = app.querySelector('#b-title');
  const bodyEl = app.querySelector('#b-body');
  const nickEl = app.querySelector('#b-nick');
  const titleCounter = app.querySelector('#c-title');
  const bodyCounter = app.querySelector('#c-body');
  const formError = app.querySelector('#board-form-error');
  const submitBtn = app.querySelector('#form-submit');

  // 쓰던 초안 복원 (화면을 떠났다 돌아와도 날아가지 않게)
  if (isBoardCategory(board.draft.category)) catSel.value = board.draft.category;
  titleEl.value = board.draft.title;
  bodyEl.value = board.draft.body;
  nickEl.value = board.draft.nickname || readNickname() || myName();
  titleCounter.textContent = `${countChars(titleEl.value)}/${FEEDBACK_LIMITS.titleMax}`;
  bodyCounter.textContent = `${countChars(bodyEl.value)}/${FEEDBACK_LIMITS.bodyMax}`;

  const saveDraft = () => {
    board.draft = { category: catSel.value, title: titleEl.value, body: bodyEl.value, nickname: nickEl.value };
  };

  const clearFieldErrors = () => {
    for (const id of ['e-cat', 'e-title', 'e-body', 'e-nick']) {
      const node = app.querySelector(`#${id}`);
      if (node) {
        node.hidden = true;
        node.textContent = '';
      }
    }
    for (const field of [catSel, titleEl, bodyEl, nickEl]) {
      field.classList.remove('invalid');
      field.removeAttribute('aria-invalid');
    }
    formError.hidden = true;
  };

  const showErrors = (errors) => {
    const map = {
      category: ['e-cat', catSel],
      title: ['e-title', titleEl],
      body: ['e-body', bodyEl],
      nickname: ['e-nick', nickEl],
    };
    for (const [key, msg] of Object.entries(errors)) {
      const entry = map[key];
      if (!entry) continue;
      const [id, field] = entry;
      const node = app.querySelector(`#${id}`);
      if (node) {
        node.hidden = false;
        node.textContent = msg;
      }
      field.classList.add('invalid');
      field.setAttribute('aria-invalid', 'true');
    }
  };

  const setFormOpen = (open) => {
    board.formOpen = open;
    formWrap.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.lastElementChild.textContent = open ? '글쓰기 닫기' : '글 남기기';
  };

  const resetForm = () => {
    if (isBoardCategory(board.draft.category)) catSel.value = board.draft.category;
    titleEl.value = '';
    bodyEl.value = '';
    nickEl.value = '';
    titleCounter.textContent = `0/${FEEDBACK_LIMITS.titleMax}`;
    bodyCounter.textContent = `0/${FEEDBACK_LIMITS.bodyMax}`;
    clearFieldErrors();
  };

  toggle.addEventListener('click', () => {
    const open = !board.formOpen;
    setFormOpen(open);
    if (open) {
      titleEl.focus();
      formWrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  app.querySelector('#form-cancel').addEventListener('click', () => {
    setFormOpen(false);
    saveDraft();
  });

  catSel.addEventListener('change', saveDraft);
  titleEl.addEventListener('input', () => {
    titleCounter.textContent = `${countChars(titleEl.value)}/${FEEDBACK_LIMITS.titleMax}`;
    saveDraft();
  });
  bodyEl.addEventListener('input', () => {
    bodyCounter.textContent = `${countChars(bodyEl.value)}/${FEEDBACK_LIMITS.bodyMax}`;
    saveDraft();
  });
  nickEl.addEventListener('input', saveDraft);

  app.querySelector('#board-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (board.submitting) return;
    clearFieldErrors();
    const check = validateFeedback({
      category: catSel.value,
      title: titleEl.value,
      body: bodyEl.value,
      nickname: nickEl.value,
    });
    if (!check.ok) {
      showErrors(check.errors);
      const firstField = [catSel, titleEl, bodyEl, nickEl].find((f) => f.classList.contains('invalid'));
      firstField?.focus();
      return;
    }

    board.submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';
    if (isDuplicatePost('feedback', `${check.value.category}|${check.value.title}|${check.value.body}`)) {
      board.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = '등록하기';
      formError.hidden = false;
      formError.textContent = '방금 같은 글을 올렸어요. 잠시 뒤 다시 시도해 주세요.';
      return;
    }
    try {
      const row = await boardApi.createFeedback(check.value);
      // 올린 글이 항상 보이도록 다른 분류를 보고 있었다면 '전체'로 돌아간다
      if (board.category !== 'all' && board.category !== row.category) {
        board.category = 'all';
        app
          .querySelectorAll('[data-board-cat]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.boardCat === 'all')));
        replaceBoardHash();
      }
      board.items = sortNewestFirst([row, ...board.items]);
      board.error = '';
      rememberNickname(check.value.nickname);
      board.draft = { category: row.category, title: '', body: '', nickname: check.value.nickname === '익명' ? '' : check.value.nickname };
      setFormOpen(false);
      resetForm();
      renderBoardList();
      showToast('제보를 접수했어요. 살펴보고 반영할게요!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      clearDuplicatePost('feedback');
      formError.hidden = false;
      formError.textContent = friendlyMessage(err);
    } finally {
      board.submitting = false;
      if (submitBtn.isConnected) {
        submitBtn.disabled = false;
        submitBtn.textContent = '등록하기';
      }
    }
  });

  app.querySelectorAll('[data-board-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.boardCat;
      if (board.category === next) return;
      board.category = next;
      app
        .querySelectorAll('[data-board-cat]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.boardCat === next)));
      replaceBoardHash();
      board.items = [];
      loadBoard();
    });
  });

  loadBoard();
}

/* ── 어드민 (#/admin) ─────────────────────────────
   관리자(ADMIN_EMAIL)로 로그인했을 때만 열린다. 실제 쓰기 권한은 DB의
   tb_is_admin() 정책이 최종으로 판단하고, 이 화면은 쓰기 UI만 담당한다. */
const admin = {
  tab: 'items',
  q: '',
  products: [],
  productsLoaded: false,
  productsLoading: false,
  comments: [],
  commentsLoaded: false,
  commentsLoading: false,
  feedback: [],
  feedbackLoaded: false,
  feedbackLoading: false,
  form: null, // { mode:'new'|'edit', originalItemNo, values, altLinks }
  saving: false,
  error: '',
};

function isAdminUser() {
  return Boolean(authState.isAdmin);
}

/** 로그인한 계정이 관리자인지 DB(tb_is_admin)에 물어본다 */
async function refreshAdminFlag() {
  const session = authState.session;
  if (!session?.accessToken) {
    authState.isAdmin = false;
    return false;
  }
  try {
    authState.isAdmin = await boardApi.checkIsAdmin({ accessToken: session.accessToken });
  } catch {
    // 네트워크 문제면 이메일만으로 판단하지 않고 보수적으로 false
    authState.isAdmin = false;
  }
  return authState.isAdmin;
}

/** 관리자 요청에 쓸 유효한 세션 (만료 직전이면 갱신) */
async function adminSession() {
  const session = await currentSession();
  if (!session?.accessToken) throw new BoardError('login', SESSION_ERROR);
  return session;
}

function renderAdminGate() {
  document.title = `어드민 — ${APP.name}`;
  const signedIn = isSignedIn();
  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title" tabindex="-1">관리자 전용</span>
      ${authChipHtml()}
    </header>
    <section class="admin-gate">
      <p class="admin-gate-emoji" aria-hidden="true">🔒</p>
      <h2>관리자 계정으로 로그인해 주세요</h2>
      <p>어드민 화면은 관리자(<b>${esc(ADMIN_EMAIL)}</b>) 계정으로만 열 수 있어요.${
        signedIn && authState.session?.user?.email
          ? `<br />지금은 <b>${esc(authState.session.user.email)}</b> 계정으로 로그인되어 있어요.`
          : ''
      }</p>
      <div class="admin-gate-actions">
        ${
          signedIn
            ? `<button class="btn" id="gate-login">다른 계정으로 로그인</button>
               <button class="btn secondary" id="gate-home">홈으로</button>`
            : `<button class="btn" id="gate-login">구글·카카오·애플로 로그인</button>
               <button class="btn secondary" id="gate-home">홈으로</button>`
        }
      </div>
    </section>
  `;
  app.querySelector('#back').addEventListener('click', goBack);
  app.querySelector('#gate-home').addEventListener('click', () => {
    location.hash = '#/';
  });
  app.querySelector('#gate-login').addEventListener('click', async () => {
    if (signedIn) {
      await auth.signOut();
      authState.session = null;
      authState.profile = null;
      authState.isAdmin = false;
    }
    openLoginSheet('관리자 계정으로 로그인해 주세요.');
  });
  bindAuthChip();
}

function renderAdmin() {
  if (!isSignedIn() || !isAdminUser()) {
    renderAdminGate();
    return;
  }
  document.title = `어드민 — ${APP.name}`;

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title" tabindex="-1">어드민 관리</span>
      <span class="admin-who" title="관리자 계정">${esc(authState.session?.user?.email || ADMIN_EMAIL)}</span>
      ${authChipHtml()}
    </header>
    <nav class="admin-tabs" role="tablist" aria-label="어드민 탭">
      ${ADMIN_TABS.map(
        (t) =>
          `<button type="button" role="tab" class="admin-tab" data-tab="${t.key}" aria-selected="${admin.tab === t.key}">${t.label}</button>`,
      ).join('')}
    </nav>
    <div class="admin-body" id="admin-body"></div>
  `;

  app.querySelector('#back').addEventListener('click', goBack);
  app.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (admin.tab === btn.dataset.tab) return;
      admin.tab = btn.dataset.tab;
      admin.form = null;
      admin.error = '';
      app.querySelectorAll('.admin-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === admin.tab)));
      renderAdminBody();
      loadAdminTab();
    });
  });
  bindAuthChip();
  renderAdminBody();
  loadAdminTab();
}

/** 지금 탭에 필요한 자료를 처음 한 번 불러온다 */
function loadAdminTab() {
  if (admin.tab === 'items' && !admin.productsLoaded && !admin.productsLoading) loadAdminProducts();
  if (admin.tab === 'comments' && !admin.commentsLoaded && !admin.commentsLoading) loadAdminComments();
  if (admin.tab === 'feedback' && !admin.feedbackLoaded && !admin.feedbackLoading) loadAdminFeedback();
}

function adminStatePanel({ title, detail, actionLabel, onAction }) {
  return `<div class="board-state">
    <b>${esc(title)}</b>
    <p>${esc(detail)}</p>
    ${actionLabel ? `<button type="button" class="retry-btn" id="admin-retry">${esc(actionLabel)}</button>` : ''}
  </div>`;
}

function renderAdminBody() {
  const body = app.querySelector('#admin-body');
  if (!body) return;
  if (admin.tab === 'items') renderAdminItems(body);
  else if (admin.tab === 'comments') renderAdminComments(body);
  else renderAdminFeedback(body);
}

function bindAdminRetry(run) {
  app.querySelector('#admin-retry')?.addEventListener('click', run);
}

/* ── 탭 1: 아이템·성분 ───────────────────────── */
function renderAdminItems(body) {
  if (admin.form) {
    renderAdminForm(body);
    return;
  }
  if (admin.productsLoading) {
    body.innerHTML = adminStatePanel({ title: '아이템을 불러오는 중이에요', detail: '잠시만 기다려 주세요.' });
    return;
  }
  if (admin.error) {
    body.innerHTML = adminStatePanel({
      title: '아이템을 불러오지 못했어요',
      detail: admin.error,
      actionLabel: '다시 불러오기',
    });
    bindAdminRetry(() => loadAdminProducts(true));
    return;
  }

  body.innerHTML = `
    <div class="admin-bar">
      <label class="search admin-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input id="admin-q" type="search" value="${esc(admin.q)}" placeholder="번호·이름·제조사 검색" aria-label="아이템 검색" autocomplete="off" />
      </label>
      <button type="button" class="btn small" id="admin-new">+ 새 아이템</button>
    </div>
    <div id="admin-list"></div>
  `;

  const input = body.querySelector('#admin-q');
  input.addEventListener('input', () => {
    admin.q = input.value;
    renderAdminList();
  });
  body.querySelector('#admin-new').addEventListener('click', () => startAdminForm('new'));
  renderAdminList();
}

function renderAdminList() {
  const wrap = app.querySelector('#admin-list');
  if (!wrap) return;
  const list = admin.products.filter((p) => matchesProductQuery(p, admin.q));
  if (!list.length) {
    wrap.innerHTML = admin.products.length
      ? `<p class="empty">‘${esc(admin.q)}’에 맞는 아이템이 없어요.</p>`
      : `<p class="empty">아직 아이템이 없어요. <b>+ 새 아이템</b>으로 첫 아이템을 추가해 보세요.</p>`;
    return;
  }
  wrap.innerHTML = `<p class="admin-count">${list.length}개 · 전체 ${admin.products.length}개</p>
    <ul class="admin-list">
      ${list
        .map((p) => {
          const cat = CATEGORIES.find((c) => c.key === p.category)?.name ?? p.category;
          return `<li class="admin-row${p.isActive ? '' : ' off'}">
            <span class="item-no">${p.itemNo ? formatItemNo(p.itemNo) : '—'}</span>
            <span class="admin-row-main">
              <b>${esc(p.name)}</b>
              <em>${esc(p.brand || '제조사 없음')} · ${esc(cat)} · ${fmtAmount(p.weight)}${p.unit} · ${p.kcal} kcal${
                Array.isArray(p.altLinks) && p.altLinks.length ? ` · 링크 ${p.altLinks.length}` : ''
              }</em>
            </span>
            ${p.isActive ? '' : '<span class="admin-hidden-badge">숨김</span>'}
            <button type="button" class="btn small ghost" data-edit="${esc(p.id)}">수정</button>
          </li>`;
        })
        .join('')}
    </ul>`;

  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = admin.products.find((p) => p.id === btn.dataset.edit);
      if (product) startAdminForm('edit', product);
    });
  });
}

function startAdminForm(mode, product) {
  const base = product ?? {};
  admin.form = {
    mode,
    originalItemNo: product?.itemNo ?? null,
    originalId: product?.id ?? '',
    bulk: Array.isArray(product?.bulk) ? product.bulk : [],
    values: {
      itemNo: mode === 'new' ? nextItemNo(admin.products) : (product?.itemNo ?? ''),
      name: base.name ?? '',
      brand: base.brand ?? '',
      category: base.category ?? 'snack',
      unit: base.unit ?? 'g',
      weight: base.weight ?? '',
      kcal: base.kcal ?? '',
      sodium: base.sodium ?? '',
      sugar: base.sugar ?? '',
      fat: base.fat ?? '',
      carbs: base.carbs ?? 0,
      protein: base.protein ?? 0,
      ingredients: Array.isArray(base.ingredients) ? base.ingredients.join(', ') : '',
      note: base.note ?? '',
      isActive: base.isActive !== false,
    },
    altLinks: Array.isArray(base.altLinks) ? base.altLinks.map((l) => ({ ...l })) : [],
  };
  admin.error = '';
  renderAdminBody();
}

function altLinkRowHtml(link = {}) {
  const platform = ALT_PLATFORMS.some((p) => p.key === link.platform) ? link.platform : 'coupang';
  return `<li class="alt-edit-row">
    <div class="alt-edit-top">
      <label class="sr-only">링크 상품명</label>
      <input class="alt-title" type="text" maxlength="${PRODUCT_LIMITS.altTitleMax}" placeholder="상품명 (예: 무설탕 버터쿠키 200g)" value="${esc(link.title ?? '')}" />
      <button type="button" class="alt-remove" aria-label="이 링크 삭제">✕</button>
    </div>
    <div class="alt-edit-mid">
      <label class="sr-only">플랫폼</label>
      <select class="alt-platform">
        ${ALT_PLATFORMS.map((p) => `<option value="${p.key}"${p.key === platform ? ' selected' : ''}>${p.label}</option>`).join('')}
      </select>
      <label class="sr-only">링크 주소</label>
      <input class="alt-url" type="url" inputmode="url" maxlength="${PRODUCT_LIMITS.urlMax}" placeholder="https://..." value="${esc(link.url ?? '')}" />
    </div>
    <label class="sr-only">짧은 메모</label>
    <input class="alt-note" type="text" maxlength="${PRODUCT_LIMITS.altNoteMax}" placeholder="메모 (선택, 예: 당류 0g)" value="${esc(link.note ?? '')}" />
  </li>`;
}

function renderAdminForm(body) {
  const { mode, values, altLinks } = admin.form;
  const editing = mode === 'edit';
  const err = (key) => `<p class="field-error" data-err="${key}" role="alert" hidden></p>`;

  body.innerHTML = `
    <section class="admin-form-card">
      <div class="admin-form-head">
        <h2>${editing ? `아이템 수정 · ${esc(values.name || admin.form.originalId)}` : '새 아이템 추가'}</h2>
        <button type="button" class="btn small ghost" id="admin-cancel">취소</button>
      </div>
      <form class="form admin-form" id="admin-form" novalidate>
        <p class="form-error" id="admin-form-error" role="alert" hidden></p>
        <div class="row-2">
          <div class="field">
            <label for="f-itemno">아이템 번호</label>
            <input id="f-itemno" type="number" min="1" max="${PRODUCT_LIMITS.itemNoMax}" inputmode="numeric" value="${esc(values.itemNo)}" />
            <p class="hint">비우면 새 번호(${nextItemNo(admin.products)}번)로 붙어요</p>
            ${err('itemNo')}
          </div>
          <div class="field">
            <label for="f-name">제품명 *</label>
            <input id="f-name" type="text" maxlength="${PRODUCT_LIMITS.nameMax}" value="${esc(values.name)}" />
            ${err('name')}
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-brand">제조사</label>
            <input id="f-brand" type="text" maxlength="${PRODUCT_LIMITS.brandMax}" value="${esc(values.brand)}" />
            ${err('brand')}
          </div>
          <div class="field">
            <label for="f-category">카테고리</label>
            <select id="f-category">
              ${CATEGORIES.map((c) => `<option value="${c.key}"${c.key === values.category ? ' selected' : ''}>${c.emoji} ${c.name}</option>`).join('')}
            </select>
            ${err('category')}
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-unit">단위</label>
            <select id="f-unit">
              ${PRODUCT_UNITS.map((u) => `<option value="${u.key}"${u.key === values.unit ? ' selected' : ''}>${u.label}</option>`).join('')}
            </select>
            ${err('unit')}
          </div>
          <div class="field">
            <label for="f-weight">중량 (g/ml)</label>
            <input id="f-weight" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.weight)}" />
            ${err('weight')}
          </div>
        </div>
        <div class="admin-grid">
          <div class="field"><label for="f-kcal">열량 (kcal)</label><input id="f-kcal" type="number" step="1" min="0" inputmode="decimal" value="${esc(values.kcal)}" />${err('kcal')}</div>
          <div class="field"><label for="f-sodium">나트륨 (mg)</label><input id="f-sodium" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.sodium)}" />${err('sodium')}</div>
          <div class="field"><label for="f-sugar">당류 (g)</label><input id="f-sugar" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.sugar)}" />${err('sugar')}</div>
          <div class="field"><label for="f-fat">지방 (g)</label><input id="f-fat" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.fat)}" />${err('fat')}</div>
          <div class="field"><label for="f-carbs">탄수화물 (g)</label><input id="f-carbs" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.carbs)}" />${err('carbs')}</div>
          <div class="field"><label for="f-protein">단백질 (g)</label><input id="f-protein" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(values.protein)}" />${err('protein')}</div>
        </div>
        <div class="field">
          <label for="f-ingredients">원재료 (쉼표로 구분)</label>
          <textarea id="f-ingredients" rows="2" placeholder="밀가루, 설탕, 팜유">${esc(values.ingredients)}</textarea>
        </div>
        <div class="field">
          <label for="f-note">한줄 설명</label>
          <input id="f-note" type="text" maxlength="${PRODUCT_LIMITS.noteMax}" value="${esc(values.note)}" />
          ${err('note')}
        </div>

        <div class="admin-alt-block">
          <div class="admin-alt-head">
            <b>대체상품 링크</b>
            <span class="hint">상세 화면의 ‘저당·대체 간식’ 아래에 보여요</span>
          </div>
          <ul class="alt-edit-list" id="alt-edit-list">
            ${altLinks.map((l) => altLinkRowHtml(l)).join('')}
          </ul>
          <p class="field-error" data-err="altLinks" role="alert" hidden></p>
          <button type="button" class="btn small secondary" id="alt-add">+ 링크 추가</button>
          <p class="admin-alt-note">쿠팡 파트너스·네이버 쇼핑 등 제휴 링크를 넣을 수 있어요. 주소는 http:// 또는 https://만 저장돼요.</p>
        </div>

        <label class="admin-toggle">
          <input type="checkbox" id="f-active"${values.isActive ? ' checked' : ''} />
          <span>앱에 노출하기 (끄면 관리자만 볼 수 있어요)</span>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn" id="admin-save">${editing ? '저장' : '추가하기'}</button>
          <button type="button" class="btn secondary" id="admin-cancel-2">취소</button>
          ${editing ? '<button type="button" class="btn danger" id="admin-delete">삭제</button>' : ''}
        </div>
      </form>
    </section>
  `;

  const list = body.querySelector('#alt-edit-list');
  body.querySelector('#alt-add').addEventListener('click', () => {
    if (list.children.length >= PRODUCT_LIMITS.altLinksMax) {
      showToast(`링크는 ${PRODUCT_LIMITS.altLinksMax}개까지 넣을 수 있어요.`);
      return;
    }
    list.insertAdjacentHTML('beforeend', altLinkRowHtml({}));
    list.lastElementChild.querySelector('.alt-title')?.focus();
  });
  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.alt-remove');
    if (btn) btn.closest('.alt-edit-row').remove();
  });

  const back = () => {
    admin.form = null;
    renderAdminBody();
  };
  body.querySelector('#admin-cancel').addEventListener('click', back);
  body.querySelector('#admin-cancel-2').addEventListener('click', back);
  body.querySelector('#admin-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveAdminProduct();
  });
  body.querySelector('#admin-delete')?.addEventListener('click', () => deleteAdminProduct());
}

/** 폼에 적힌 값을 그대로 읽는다 (입력 중 다시 그리지 않아 한글 조합이 끊기지 않게) */
function readAdminFormValues() {
  const val = (id) => app.querySelector(`#${id}`)?.value ?? '';
  const altLinks = [...app.querySelectorAll('#alt-edit-list .alt-edit-row')].map((row) => ({
    title: row.querySelector('.alt-title')?.value ?? '',
    url: row.querySelector('.alt-url')?.value ?? '',
    platform: row.querySelector('.alt-platform')?.value ?? 'etc',
    note: row.querySelector('.alt-note')?.value ?? '',
  }));
  return {
    itemNo: val('f-itemno'),
    name: val('f-name'),
    brand: val('f-brand'),
    category: val('f-category'),
    unit: val('f-unit'),
    weight: val('f-weight'),
    kcal: val('f-kcal'),
    sodium: val('f-sodium'),
    sugar: val('f-sugar'),
    fat: val('f-fat'),
    carbs: val('f-carbs'),
    protein: val('f-protein'),
    ingredients: val('f-ingredients'),
    note: val('f-note'),
    isActive: Boolean(app.querySelector('#f-active')?.checked),
    altLinks,
  };
}

function showAdminFormError(message) {
  const box = app.querySelector('#admin-form-error');
  if (!box) return;
  box.hidden = !message;
  box.textContent = message || '';
}

async function saveAdminProduct() {
  if (!admin.form || admin.saving) return;
  const { ok, errors, value } = validateProductInput(readAdminFormValues());

  app.querySelectorAll('[data-err]').forEach((el) => {
    const key = el.dataset.err;
    el.hidden = !errors[key];
    el.textContent = errors[key] ?? '';
  });
  app.querySelectorAll('.field input, .field select, .field textarea').forEach((el) => el.classList.remove('invalid'));
  if (!ok) {
    showAdminFormError('입력한 값을 다시 확인해 주세요.');
    const first = Object.keys(errors)[0];
    const el = app.querySelector(`[data-err="${first}"]`);
    const field = el?.parentElement?.querySelector('input, select, textarea');
    field?.classList.add('invalid');
    field?.focus();
    return;
  }

  const saveBtn = app.querySelector('#admin-save');
  admin.saving = true;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }
  showAdminFormError('');

  try {
    const session = await adminSession();
    const isNew = admin.form.mode === 'new';
    const id = isNew ? uniqueProductId(value.name, value.itemNo) : admin.form.originalId;
    const row = productToRow({ ...value, id, bulk: admin.form.bulk });
    if (isNew) {
      const saved = await boardApi.createProduct(row, { accessToken: session.accessToken });
      showToast(`${formatItemNo(saved.item_no) || ''} ${saved.name} 추가했어요.`.trim());
    } else {
      delete row.id; // id(슬러그)는 그대로 둔다
      const saved = await boardApi.updateProduct(admin.form.originalItemNo, row, {
        accessToken: session.accessToken,
      });
      showToast(`${formatItemNo(saved.item_no) || ''} ${saved.name} 수정했어요.`.trim());
    }
    admin.form = null;
    admin.saving = false;
    await reloadAdminProducts();
  } catch (err) {
    showAdminFormError(friendlyMessage(err));
    admin.saving = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }
}

function uniqueProductId(name, itemNo) {
  const base = slugify(name) || `item-${itemNo || Date.now()}`;
  const taken = new Set(admin.products.map((p) => p.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

async function deleteAdminProduct() {
  if (!admin.form || admin.form.mode !== 'edit') return;
  const name = admin.form.values.name || admin.form.originalId;
  if (!window.confirm(`‘${name}’ 아이템을 삭제할까요? 이 아이템의 댓글은 그대로 남아요.`)) return;
  const btn = app.querySelector('#admin-delete');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '삭제 중...';
  }
  try {
    const session = await adminSession();
    const removed = await boardApi.deleteProduct(admin.form.originalItemNo, { accessToken: session.accessToken });
    if (!removed) throw new BoardError('auth', '이 아이템을 지우지 못했어요. 관리자 계정인지 확인해 주세요.');
    showToast(`‘${name}’ 삭제했어요.`);
    admin.form = null;
    await reloadAdminProducts();
  } catch (err) {
    showToast(friendlyMessage(err));
    if (btn) {
      btn.disabled = false;
      btn.textContent = '삭제';
    }
  }
}

/** 아이템 목록을 DB에서 다시 읽어 화면·앱 목록을 함께 갱신한다 */
async function reloadAdminProducts() {
  admin.productsLoaded = false;
  const ok = await loadAdminProducts(true);
  if (ok) {
    const active = admin.products.filter((p) => p.isActive);
    setProducts(active);
    if (!active.length) resetProducts();
  }
  renderAdminBody();
}

async function loadAdminProducts(force = false) {
  if (admin.productsLoading) return false;
  if (admin.productsLoaded && !force) return true;
  admin.productsLoading = true;
  admin.error = '';
  renderAdminBody();
  try {
    const session = await adminSession();
    const rows = await boardApi.fetchProducts({ includeInactive: true, accessToken: session.accessToken });
    admin.products = rows.map(rowToProduct).filter(Boolean);
    admin.productsLoaded = true;
    admin.productsLoading = false;
    renderAdminBody();
    return true;
  } catch (err) {
    admin.productsLoading = false;
    admin.error = friendlyMessage(err);
    renderAdminBody();
    return false;
  }
}

/* ── 탭 2: 댓글 관리 ─────────────────────────── */
async function loadAdminComments(force = false) {
  if (admin.commentsLoading) return;
  if (admin.commentsLoaded && !force) return;
  admin.commentsLoading = true;
  admin.error = '';
  renderAdminBody();
  try {
    const session = await adminSession();
    admin.comments = await boardApi.fetchAllCommentsForAdmin({ accessToken: session.accessToken });
    admin.commentsLoaded = true;
  } catch (err) {
    admin.error = friendlyMessage(err);
  } finally {
    admin.commentsLoading = false;
    renderAdminBody();
  }
}

function productNameById(id) {
  return admin.products.find((p) => p.id === id)?.name ?? id;
}

function renderAdminComments(body) {
  if (admin.commentsLoading) {
    body.innerHTML = adminStatePanel({ title: '댓글을 불러오는 중이에요', detail: '잠시만 기다려 주세요.' });
    return;
  }
  if (admin.error) {
    body.innerHTML = adminStatePanel({
      title: '댓글을 불러오지 못했어요',
      detail: admin.error,
      actionLabel: '다시 불러오기',
    });
    bindAdminRetry(() => loadAdminComments(true));
    return;
  }
  if (!admin.comments.length) {
    body.innerHTML = `<p class="empty">아직 남겨진 댓글이 없어요.</p>`;
    return;
  }
  body.innerHTML = `
    <p class="admin-count">전체 ${admin.comments.length}개 · 최신순</p>
    <ul class="admin-comments">
      ${admin.comments
        .map(
          (c) => `<li class="admin-comment" data-id="${esc(c.id)}">
        <div class="admin-comment-top">
          <span class="admin-comment-product">${esc(productNameById(c.product_id))}</span>
          <time datetime="${esc(c.created_at)}">${esc(relativeTime(c.created_at))}</time>
        </div>
        <p class="admin-comment-body">${esc(c.body)}</p>
        <div class="admin-comment-foot">
          <span class="admin-comment-nick">${esc(c.nickname || '익명')}</span>
          <button type="button" class="btn small ghost danger" data-del-comment="${esc(c.id)}">삭제</button>
        </div>
      </li>`,
        )
        .join('')}
    </ul>
  `;
  body.querySelectorAll('[data-del-comment]').forEach((btn) => {
    btn.addEventListener('click', () => deleteAdminComment(btn.dataset.delComment, btn));
  });
}

async function deleteAdminComment(id, btn) {
  const row = admin.comments.find((c) => c.id === id);
  if (!row) return;
  if (!window.confirm(`‘${row.nickname || '익명'}’님의 댓글을 삭제할까요?\n\n${row.body.slice(0, 80)}`)) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '삭제 중...';
  }
  try {
    const session = await adminSession();
    const removed = await boardApi.deleteCommentByAdmin(id, { accessToken: session.accessToken });
    if (!removed) throw new BoardError('auth', '이 댓글을 지우지 못했어요. 관리자 계정인지 확인해 주세요.');
    admin.comments = admin.comments.filter((c) => c.id !== id);
    showToast('댓글을 삭제했어요.');
    renderAdminBody();
  } catch (err) {
    showToast(friendlyMessage(err));
    if (btn) {
      btn.disabled = false;
      btn.textContent = '삭제';
    }
  }
}

/* ── 탭 3: 제안·제보 관리 ────────────────────── */
async function loadAdminFeedback(force = false) {
  if (admin.feedbackLoading) return;
  if (admin.feedbackLoaded && !force) return;
  admin.feedbackLoading = true;
  admin.error = '';
  renderAdminBody();
  try {
    const session = await adminSession();
    admin.feedback = await boardApi.fetchAllFeedbackForAdmin({ accessToken: session.accessToken });
    admin.feedbackLoaded = true;
  } catch (err) {
    admin.error = friendlyMessage(err);
  } finally {
    admin.feedbackLoading = false;
    renderAdminBody();
  }
}

function renderAdminFeedback(body) {
  if (admin.feedbackLoading) {
    body.innerHTML = adminStatePanel({ title: '제안·제보를 불러오는 중이에요', detail: '잠시만 기다려 주세요.' });
    return;
  }
  if (admin.error) {
    body.innerHTML = adminStatePanel({
      title: '제안·제보를 불러오지 못했어요',
      detail: admin.error,
      actionLabel: '다시 불러오기',
    });
    bindAdminRetry(() => loadAdminFeedback(true));
    return;
  }
  if (!admin.feedback.length) {
    body.innerHTML = `<p class="empty">아직 들어온 제안·제보가 없어요.</p>`;
    return;
  }
  const openCount = admin.feedback.filter((f) => f.status !== 'done').length;
  body.innerHTML = `
    <p class="admin-count">전체 ${admin.feedback.length}개 · 대기 ${openCount}개</p>
    <ul class="admin-feedback">
      ${admin.feedback
        .map((f) => {
          const cat = BOARD_CATEGORIES.find((c) => c.key === f.category);
          const done = f.status === 'done';
          return `<li class="admin-fb" data-id="${esc(f.id)}">
        <div class="admin-fb-top">
          <span class="tag ${esc(f.category)}">${esc(cat?.name ?? f.category)}</span>
          <span class="status ${done ? 'done' : 'open'}">${done ? '완료' : '대기'}</span>
          <time datetime="${esc(f.created_at)}">${esc(relativeTime(f.created_at))}</time>
        </div>
        <b class="admin-fb-title">${esc(f.title)}</b>
        <p class="admin-fb-body">${esc(f.body)}</p>
        <div class="admin-fb-foot">
          <span class="admin-comment-nick">${esc(f.nickname || '익명')}</span>
          <span class="admin-fb-actions">
            <button type="button" class="btn small secondary" data-toggle-fb="${esc(f.id)}">${done ? '대기로' : '완료로'}</button>
            <button type="button" class="btn small ghost danger" data-del-fb="${esc(f.id)}">삭제</button>
          </span>
        </div>
      </li>`;
        })
        .join('')}
    </ul>
  `;
  body.querySelectorAll('[data-toggle-fb]').forEach((btn) => {
    btn.addEventListener('click', () => toggleAdminFeedback(btn.dataset.toggleFb, btn));
  });
  body.querySelectorAll('[data-del-fb]').forEach((btn) => {
    btn.addEventListener('click', () => deleteAdminFeedback(btn.dataset.delFb, btn));
  });
}

async function toggleAdminFeedback(id, btn) {
  const row = admin.feedback.find((f) => f.id === id);
  if (!row) return;
  const next = row.status === 'done' ? 'open' : 'done';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '바꾸는 중...';
  }
  try {
    const session = await adminSession();
    await boardApi.updateFeedbackStatus(id, next, { accessToken: session.accessToken });
    row.status = next;
    showToast(next === 'done' ? '완료로 바꿨어요.' : '대기로 되돌렸어요.');
    renderAdminBody();
  } catch (err) {
    showToast(friendlyMessage(err));
    if (btn) {
      btn.disabled = false;
      btn.textContent = '다시 시도';
    }
  }
}

async function deleteAdminFeedback(id, btn) {
  const row = admin.feedback.find((f) => f.id === id);
  if (!row) return;
  if (!window.confirm(`‘${row.title}’ 글을 삭제할까요?`)) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '삭제 중...';
  }
  try {
    const session = await adminSession();
    const removed = await boardApi.deleteFeedbackByAdmin(id, { accessToken: session.accessToken });
    if (!removed) throw new BoardError('auth', '이 글을 지우지 못했어요. 관리자 계정인지 확인해 주세요.');
    admin.feedback = admin.feedback.filter((f) => f.id !== id);
    showToast('글을 삭제했어요.');
    renderAdminBody();
  } catch (err) {
    showToast(friendlyMessage(err));
    if (btn) {
      btn.disabled = false;
      btn.textContent = '삭제';
    }
  }
}

/* ── 상세 화면: 대체상품 링크 ─────────────────── */
function altLinksBlock(links, product) {
  const safe = (links ?? []).filter((l) => l && /^https?:\/\//i.test(String(l.url ?? '')));
  if (!safe.length) {
    return `<div class="affiliate"><span>🛒</span><span>대체 간식 구매 링크(제휴)는 준비 중이에요. 지금은 비교 정보만 보여 드립니다.</span></div>`;
  }
  return `<div class="alt-links">
    <p class="alt-links-head">🛒 ${esc(product.name)} 구매 링크</p>
    <div class="alt-link-list">
      ${safe
        .map(
          (l) => `<a class="alt-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
        <span class="alt-pf ${esc(l.platform || 'etc')}">${esc(PLATFORM_LABEL[l.platform] ?? '기타')}</span>
        <span class="alt-link-body">
          <b>${esc(l.title)}</b>
          ${l.note ? `<em>${esc(l.note)}</em>` : ''}
        </span>
        <span class="alt-go" aria-hidden="true">›</span>
      </a>`,
        )
        .join('')}
    </div>
    <p class="alt-links-note">제휴 링크가 포함될 수 있어요. 가격·재고는 판매처 기준입니다.</p>
  </div>`;
}

/* ── PNG 내보내기 ────────────────────────────── */
const embedCardFont = createFontEmbedder();

/** 앱 시작: DB 상품 목록을 먼저 받아 오고, 실패하면 data/products.js를 쓴다 */
async function loadCatalog() {
  try {
    const rows = await boardApi.fetchProducts();
    const products = rows.map(rowToProduct).filter((p) => p && p.id);
    if (products.length) setProducts(products);
    else resetProducts();
  } catch {
    resetProducts();
  }
}

async function svgToBlob(svgEl, targetWidth = 1080) {
  const vb = svgEl.viewBox.baseVal;
  const ratio = targetWidth / vb.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vb.width * ratio);
  canvas.height = Math.round(vb.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFCF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', canvas.width);
  clone.setAttribute('height', canvas.height);
  // 카드 PNG에는 Gowun Dodum 글꼴을 SVG 안에 심어서 내보낸다(문서 폰트는 <img>에 전달되지 않는다)
  const serialized = new XMLSerializer().serializeToString(clone);
  const xml = await embedCardFont(serialized);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  const img = new Image();
  img.decoding = 'sync';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('svg-load-failed'));
    img.src = url;
  });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95));
}

async function exportCard(svgEl, model, mode) {
  if (!svgEl) return showToast('카드를 찾지 못했어요. 새로고침해 주세요.');
  try {
    const blob = await svgToBlob(svgEl, 1080);
    if (!blob) throw new Error('no-blob');
    const safeName = model.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 30) || '속보이네';
    const filename = `속보이네_${safeName}.png`;
    const file = new File([blob], filename, { type: 'image/png' });

    if (mode === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `${model.name} · ${APP.name}` });
      return;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    showToast('이미지를 저장했어요. 안 보이면 길게 눌러 저장해 주세요.');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    showToast('이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}

/* ── 라우터 ─────────────────────────────────── */
function goBack() {
  // 곧바로 상세·게시판 링크로 들어왔으면 앱 밖으로 나가지 않고 홈으로
  if (navCount > 0) history.back();
  else location.hash = '#/';
}

function route() {
  // 화면이 바뀌면 항상 맨 위부터 (목록에서 스크롤한 상태로 상세에 들어가면 카드 윗부분이 잘린다)
  window.scrollTo(0, 0);
  const hash = (location.hash || '#/').replace(/\/+$/, '') || '#/';
  // 어드민은 표가 많아 데스크톱에서 조금 넓게 쓴다
  app.classList.toggle('app-wide', hash.startsWith('#/admin'));

  if (hash === '#/admin' || hash.startsWith('#/admin/')) {
    if (hash !== '#/admin') history.replaceState(null, '', `${location.pathname}${location.search}#/admin`);
    renderAdmin();
    return focusScreenTitle();
  }

  const bm = hash.match(/^#\/board(?:\/([a-z_]+))?$/);
  if (bm) {
    board.category = bm[1] && isBoardCategory(bm[1]) ? bm[1] : 'all';
    renderBoard();
    return focusScreenTitle();
  }

  const m = hash.match(/^#\/p\/([\w-]+)$/);
  if (m) {
    const product = productById(m[1]);
    if (product) {
      renderDetail(product);
      return focusScreenTitle();
    }
    showToast('그 간식을 찾지 못했어요. 목록으로 돌아갔어요.');
    location.hash = '#/';
    return;
  }
  if (hash === '#/c' && state.custom) {
    renderDetail(state.custom);
    return focusScreenTitle();
  }
  if (hash === '#/custom') {
    renderCustomForm();
    return focusScreenTitle();
  }
  renderHome();
}

/** 화면이 바뀌면 제목으로 초점을 옮겨 화면낭독기가 새 화면을 읽게 한다 */
function focusScreenTitle() {
  const title = app.querySelector('.topbar .title');
  if (!title) return;
  title.setAttribute('tabindex', '-1');
  title.focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => {
  navCount += 1;
  route();
});

/** 앱 시작: 소셜 로그인 콜백(있다면) 처리 → 세션·프로필 준비 → 첫 화면 */
async function bootstrap() {
  const callback = await auth.handleCallback();

  if (callback.status !== 'none') {
    // ?code=... 를 주소창에서 지우고, 로그인 전에 보던 화면으로 돌아간다
    const returnTo = auth.consumeReturnPath() || callback.returnTo || '';
    const clean = cleanCallbackUrl(location.href);
    try {
      history.replaceState(null, '', `${clean}${returnTo.startsWith('#') ? returnTo : ''}`);
    } catch {
      /* 주소 정리가 막힌 환경이면 해시만 그대로 둔다 */
    }
  }

  authState.session = callback.session ?? (await auth.ensureSession());
  if (authState.session) {
    try {
      authState.profile = await ensureProfile(auth, authState.session);
    } catch (err) {
      console.warn('[auth] 내 프로필을 불러오지 못했어요', err);
      authState.profile = null;
    }
    await refreshAdminFlag();
  }

  // 홈·상세에 쓸 상품 목록: DB → 실패하면 내장 34종
  await loadCatalog();

  route();

  if (callback.status === 'ok') {
    const name = myName();
    showToast(name ? `${name}님, 로그인됐어요.` : '로그인됐어요.');
    if (location.hash.startsWith('#/p/')) {
      app.querySelector('#comments')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  } else if (callback.status === 'error') {
    openLoginSheet(callback.message);
  }
}

bootstrap();

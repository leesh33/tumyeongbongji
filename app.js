import { APP } from './config.js';
import { PRODUCTS, CATEGORIES, productById } from './data/products.js';
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
import { boardApi, friendlyMessage } from './lib/supabase.js';
import { buildModel } from './lib/model.js';
import { brandBadge } from './lib/brand-badge.js';
import { cardSVG } from './lib/card-svg.js';
import { fmt, fmtAmount, toCubes, toLadle, toSpoons } from './lib/units.js';
import { lowSugarAlternatives } from './lib/stack.js';
import { parseNutritionLabel } from './lib/nutrition-ocr.js';

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
  const q = state.q.trim().toLowerCase();
  return PRODUCTS.filter((p) => {
    if (state.category !== 'all' && p.category !== state.category) return false;
    if (!q) return true;
    const hay = [p.name, p.brand, ...(p.ingredients ?? [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/* ── 홈 ─────────────────────────────────────── */
const BOARD_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4.2 6.2A2.7 2.7 0 0 1 6.9 3.5h10.2a2.7 2.7 0 0 1 2.7 2.7v7.6a2.7 2.7 0 0 1-2.7 2.7h-6.3l-4.4 3.8v-3.8h-.2a2.7 2.7 0 0 1-2-2.7z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
  <circle cx="8.6" cy="10" r=".95" fill="currentColor"/><circle cx="12" cy="10" r=".95" fill="currentColor"/><circle cx="15.4" cy="10" r=".95" fill="currentColor"/>
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
          <i class="${Number(sodium) >= 2 ? 'hot' : ''}">나 ${sodium}국자</i>
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
      <a class="board-link" href="#/board" aria-label="제안·제보 게시판">${BOARD_ICON}<span>제안·제보</span></a>
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
      <button class="chip" data-cat="all" aria-pressed="${state.category === 'all'}">전체 ${PRODUCTS.length}</button>
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

  renderHomeFeed();
}

/* ── 상세 ───────────────────────────────────── */
function renderDetail(product) {
  const model = buildModel(product);
  const { svg } = cardSVG(model);
  document.title = `${model.name} — ${APP.name}`;
  const alts = lowSugarAlternatives(product, PRODUCTS, 3);
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
        <span class="alt-val"><b>당 ${a.sugar100}g</b><em>나 ${a.sodium100}mg</em></span>
      </div>`,
    )
    .join('');
  const isCatalog = PRODUCTS.some((p) => p.id === product.id);

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" id="back" aria-label="뒤로">‹</button>
      <span class="title">${esc(model.name)}</span>
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
        <div class="affiliate"><span>🛒</span><span>대체 간식 구매 링크(제휴)는 다음 업데이트에서 열려요. 지금은 비교 정보만 보여 드립니다.</span></div>
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
      <p class="comments-note">로그인 없이 익명으로 남길 수 있어요. 이 간식에 대한 한마디를 들려주세요.</p>
      <form class="comment-form" id="comment-form" novalidate>
        <label class="sr-only" for="cm-nick">닉네임 (선택)</label>
        <input id="cm-nick" class="comment-nick" type="text" maxlength="20" placeholder="닉네임 (선택 · 비우면 익명)" autocomplete="nickname" />
        <label class="sr-only" for="cm-body">댓글 내용</label>
        <textarea id="cm-body" maxlength="300" rows="2" placeholder="이 간식, 어떠셨나요?"></textarea>
        <p class="field-error" id="cm-error" role="alert" hidden></p>
        <div class="comment-foot">
          <span class="counter" id="cm-counter">0/${COMMENT_LIMITS.bodyMax}</span>
          <button class="comment-submit" type="submit" id="cm-submit">댓글 남기기</button>
        </div>
      </form>
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
}

/* ── 성분표 사진 자동 인식 (전부 기기 안에서) ────────────
   Tesseract.js는 사진을 올리고 자동 인식을 누른 뒤에만 CDN에서 내려받는다.
   사진은 어디에도 업로드하지 않고 <canvas>에서 읽는다. */
const TESSERACT_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js',
];
const TESSERACT_OPTIONS = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
};

let tesseractLoader = null;

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (tesseractLoader) return tesseractLoader;
  tesseractLoader = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= TESSERACT_SCRIPTS.length) {
        tesseractLoader = null;
        reject(new Error('tesseract-load-failed'));
        return;
      }
      const s = document.createElement('script');
      let done = false;
      const giveUp = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        s.remove();
        next();
      };
      const timer = setTimeout(giveUp, 20000);
      s.src = TESSERACT_SCRIPTS[i++];
      s.async = true;
      s.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (globalThis.Tesseract) resolve(globalThis.Tesseract);
        else next();
      };
      s.onerror = giveUp;
      document.head.appendChild(s);
    };
    next();
  });
  return tesseractLoader;
}

/** 사진 → 그레이스케일 + 대비 강화 캔버스 (오프스크린, 기기 안에서만) */
function preprocessLabelImage(imgEl) {
  const nw = imgEl.naturalWidth || imgEl.width;
  const nh = imgEl.naturalHeight || imgEl.height;
  if (!nw || !nh) throw new Error('empty-image');
  const wide = Math.max(nw, nh);
  const scale = wide > 1500 ? 1500 / wide : Math.min(2, Math.max(1, 1500 / wide));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgEl, 0, 0, w, h);

  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const count = w * h;
  const gray = new Uint8ClampedArray(count);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    const v = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[p] = v;
    hist[v | 0]++;
  }

  // 위아래 2%씩 잘라 밝기 범위를 늘린다(그림자·반사 완화). 단색에 가까우면 그대로 둔다.
  const need = count * 0.02;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= need) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= need) {
      hi = v;
      break;
    }
  }
  const span = hi - lo;
  const stretch = span >= 40;

  for (let p = 0, i = 0; p < count; p++, i += 4) {
    let v = gray[p];
    if (stretch) v = ((v - lo) * 255) / span;
    v = (v - 128) * 1.22 + 128;
    px[i] = px[i + 1] = px[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const OCR_FIELDS = {
  weight: { id: 'f-weight', label: '총 내용량' },
  kcal: { id: 'f-kcal', label: '열량' },
  sodium: { id: 'f-sodium', label: '나트륨' },
  sugar: { id: 'f-sugar', label: '당류' },
  fat: { id: 'f-fat', label: '지방' },
  carbs: { id: 'f-carbs', label: '탄수화물' },
  protein: { id: 'f-protein', label: '단백질' },
};

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
          <small>찍어 올리면 숫자를 자동으로 읽어 채워 드려요</small>
        </button>
        <input type="file" id="photo-input" accept="image/*" capture="environment" class="sr-only" />
        <input type="file" id="album-input" accept="image/*" class="sr-only" />
        <div class="photo-preview" id="photo-preview" hidden>
          <img id="photo-img" alt="성분표 미리보기" />
          <button type="button" class="remove" id="photo-remove" aria-label="사진 지우기">✕</button>
        </div>
        <p class="form-note" id="photo-hint" hidden>사진은 이 기기 안에서만 읽어요. 자동 인식 프로그램은 처음 한 번만 내려받고, 사진은 어디에도 보내지 않습니다.</p>
        <div class="ocr-box" id="ocr-box" hidden>
          <button type="button" class="ocr-btn" id="ocr-btn">✨ 성분표 숫자 자동으로 읽기</button>
          <p class="ocr-status" id="ocr-status" role="status" aria-live="polite" hidden></p>
        </div>
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
      <button class="submit" type="submit">투명봉지로 보기</button>
      <p class="form-note">입력한 값으로만 계산해요. 저장되거나 밖으로 나가지 않습니다.</p>
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
      ocrBtn.disabled = false;
      ocrBtn.textContent = '✨ 성분표 숫자 자동으로 읽기';
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
    img.removeAttribute('src');
    photoInput.value = '';
    albumInput.value = '';
  });

  // 인식된 값은 바로 수정할 수 있게 칸에만 넣고, 손대면 강조를 지운다.
  const fillFromOcr = (result) => {
    let filled = 0;
    for (const [key, field] of Object.entries(OCR_FIELDS)) {
      const value = result[key];
      if (value == null) continue;
      const input = app.querySelector(`#${field.id}`);
      if (!input) continue;
      input.value = String(value);
      input.classList.add('ocr-filled');
      input.addEventListener(
        'input',
        () => input.classList.remove('ocr-filled'),
        { once: true },
      );
      filled++;
    }
    if (result.unit === 'ml') {
      const cat = app.querySelector('#f-cat');
      if (cat && cat.value === 'snack') {
        cat.value = 'drink';
        cat.classList.add('ocr-filled');
        cat.addEventListener('change', () => cat.classList.remove('ocr-filled'), { once: true });
      }
    }
    return filled;
  };

  const runOcr = async () => {
    if (ocrBusy || !img.src) return;
    ocrBusy = true;
    ocrBtn.disabled = true;
    ocrBtn.textContent = '성분표 읽는 중...';
    setOcrStatus('성분표 읽는 중...', 'busy');
    let last = '';
    try {
      if (img.decode) {
        try {
          await img.decode();
        } catch {
          /* 이미 로드된 사진이면 그냥 진행 */
        }
      }
      const Tesseract = await loadTesseract();
      const canvas = preprocessLabelImage(img);
      const worker = await Tesseract.createWorker('kor+eng', 1, {
        ...TESSERACT_OPTIONS,
        logger: (m) => {
          if (!m) return;
          if (m.status === 'recognizing text') {
            const msg = `성분표 읽는 중... ${Math.round((m.progress || 0) * 100)}%`;
            if (msg !== last) {
              last = msg;
              setOcrStatus(msg, 'busy');
            }
          } else if (m.status === 'loading language traineddata') {
            if (last !== 'lang') {
              last = 'lang';
              setOcrStatus('한국어 인식 데이터 준비 중...', 'busy');
            }
          }
        },
        errorHandler: (e) => console.warn('[ocr]', e?.message || e),
      });
      let text = '';
      try {
        const { data } = await worker.recognize(canvas);
        text = data?.text ?? '';
      } finally {
        await worker.terminate().catch(() => {});
      }

      const result = parseNutritionLabel(text);
      const filled = fillFromOcr(result);
      if (filled === 0) {
        setOcrStatus(
          '사진에서 숫자를 찾지 못했어요. 밝은 곳에서 성분표만 다시 찍거나, 아래에 직접 적어 주세요.',
          'error',
        );
        ocrBtn.textContent = '다시 인식하기';
      } else {
        let msg = `${filled}개 항목을 자동으로 채웠어요. 틀린 숫자만 확인 후 카드를 만들어 보세요!`;
        if (result.missing.length) {
          msg += ` 못 읽은 항목(${result.missing.map((k) => OCR_FIELDS[k].label).join('·')})은 직접 채워 주세요.`;
        }
        if (result.unit === 'ml') msg += ' ml 표기라 종류를 음료로 바꿨어요.';
        setOcrStatus(msg, 'ok');
        ocrBtn.textContent = '다시 인식하기';
      }
    } catch (err) {
      console.warn('[ocr] failed', err);
      setOcrStatus(
        '자동 인식을 불러오지 못했어요. 인터넷 연결을 확인하거나 사진을 다시 찍어 주세요. 지금도 아래에 직접 적어 카드를 만들 수 있어요.',
        'error',
      );
      ocrBtn.textContent = '다시 시도';
    } finally {
      ocrBusy = false;
      ocrBtn.disabled = false;
    }
  };

  ocrBtn.addEventListener('click', runOcr);

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
function commentItem(row, highlight = false) {
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

  const body = document.createElement('p');
  body.className = 'comment-body';
  body.textContent = row.body || '';

  li.append(top, body);
  return li;
}

function setupComments(productId) {
  const form = app.querySelector('#comment-form');
  const bodyInput = app.querySelector('#cm-body');
  const nickInput = app.querySelector('#cm-nick');
  const errEl = app.querySelector('#cm-error');
  const listEl = app.querySelector('#comment-list');
  const counter = app.querySelector('#cm-counter');
  const submitBtn = app.querySelector('#cm-submit');
  const totalEl = app.querySelector('#comments-total');
  if (!form || !listEl) return;

  const token = ++commentsToken;
  const alive = () => token === commentsToken;
  let items = [];
  let busy = false;

  if (!nickInput.value) nickInput.value = readNickname();

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
    for (const row of items) listEl.appendChild(commentItem(row, row.id === highlightId));
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

  bodyInput.addEventListener('input', () => {
    counter.textContent = `${countChars(bodyInput.value)}/${COMMENT_LIMITS.bodyMax}`;
    bodyInput.classList.remove('invalid');
    bodyInput.removeAttribute('aria-invalid');
    errEl.hidden = true;
  });
  nickInput.addEventListener('input', () => {
    nickInput.classList.remove('invalid');
    nickInput.removeAttribute('aria-invalid');
    errEl.hidden = true;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const check = validateComment({ productId, nickname: nickInput.value, body: bodyInput.value });
    if (!check.ok) {
      errEl.hidden = false;
      errEl.textContent = check.errors.body || check.errors.nickname || '내용을 확인해 주세요.';
      const bad = check.errors.body ? bodyInput : nickInput;
      bad.classList.add('invalid');
      bad.setAttribute('aria-invalid', 'true');
      bad.focus();
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
      const row = await boardApi.createComment(check.value);
      if (!alive()) return;
      items = sortOldestFirst([...items, row]);
      renderList(row.id);
      rememberNickname(check.value.nickname);
      bodyInput.value = '';
      counter.textContent = `0/${COMMENT_LIMITS.bodyMax}`;
      const created = listEl.querySelector(`[data-id="${row.id}"]`);
      created?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      showToast('댓글을 남겼어요.');
    } catch (err) {
      if (!alive()) return;
      clearDuplicatePost('comment');
      errEl.hidden = false;
      errEl.textContent = friendlyMessage(err);
    } finally {
      busy = false;
      if (alive()) {
        submitBtn.disabled = false;
        submitBtn.textContent = '댓글 남기기';
      }
    }
  });

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
  nickEl.value = board.draft.nickname || readNickname();
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

/* ── PNG 내보내기 ────────────────────────────── */
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
  const xml = new XMLSerializer().serializeToString(clone);
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
    const safeName = model.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 30) || '투명봉지';
    const filename = `투명봉지_${safeName}.png`;
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
route();

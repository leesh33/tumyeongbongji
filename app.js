import { APP } from './config.js';
import { PRODUCTS, CATEGORIES, productById } from './data/products.js';
import { buildModel } from './lib/model.js';
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

const has = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

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
function renderHome() {
  document.title = `${APP.name} — 과자 성분을 눈으로 보기`;
  const list = filteredProducts();
  const rows = list
    .map((p) => {
      const m = buildModel(p);
      const sodium = fmt(toLadle(p.sodium));
      const sugar = fmt(toCubes(p.sugar));
      return `<li><a class="item" href="#/p/${p.id}">
        <span class="thumb" style="${thumbStyle(m)}"></span>
        <span class="info">
          <b>${esc(p.name)}</b>
          <em>${esc(p.brand)} · ${fmtAmount(p.weight)}${p.unit} · ${p.kcal} kcal</em>
        </span>
        <span class="mini">
          <i class="${Number(sodium) >= 2 ? 'hot' : ''}">나 ${sodium}국자</i>
          <i class="${Number(sugar) >= 6 ? 'hot' : ''}">당 ${sugar}개</i>
        </span>
      </a></li>`;
    })
    .join('');

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">${LOGO}<div><h1>${APP.name}</h1><p>${APP.tagline}</p></div></div>
    </header>
    <div class="search-wrap">
      <label class="search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input id="q" type="search" value="${esc(state.q)}" placeholder="제품 이름으로 찾기 (예: 바나나킥)" aria-label="제품 검색" />
      </label>
    </div>
    <nav class="chips" aria-label="카테고리">
      <button class="chip" data-cat="all" aria-pressed="${state.category === 'all'}">전체 ${PRODUCTS.length}</button>
      ${CATEGORIES.map(
        (c) =>
          `<button class="chip" data-cat="${c.key}" aria-pressed="${state.category === c.key}">${c.emoji} ${c.name}</button>`,
      ).join('')}
    </nav>
    <button class="cta" id="custom-cta">
      <span class="cta-emoji">📷</span>
      <span><b>직접 입력해서 보기</b><small>성분표 사진을 찍고 숫자만 적으면 카드가 나와요</small></span>
      <span class="arrow">›</span>
    </button>
    <div class="section-head"><h2>${state.category === 'all' ? '인기 간식' : CATEGORIES.find((c) => c.key === state.category).name}</h2><span>${list.length}개</span></div>
    ${rows ? `<ul class="feed">${rows}</ul>` : `<p class="empty">‘${esc(state.q)}’에 맞는 간식이 없어요.<br />직접 입력해서 카드를 만들어 보세요.</p>`}
    <p class="foot-note">${esc(APP.dataNote)}<br />${esc(APP.disclaimer)}</p>
  `;

  const input = app.querySelector('#q');
  input.addEventListener('input', (e) => {
    state.q = e.target.value;
    const pos = e.target.selectionStart;
    renderHome();
    const next = app.querySelector('#q');
    next.focus();
    next.setSelectionRange(pos, pos);
  });

  app.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderHome();
    });
  });

  app.querySelector('#custom-cta').addEventListener('click', () => {
    location.hash = '#/custom';
  });
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
        <span class="alt-name"><b>${esc(a.name)}</b><em>${esc(a.brand)} · ${a.sugar100}g/100g</em></span>
        <span class="alt-bars">
          <span class="bar"><span style="width:${((a.sugar100 / maxSugar) * 100).toFixed(0)}%"></span></span>
          <span class="bar sodium"><span style="width:${((a.sodium100 / maxSodium) * 100).toFixed(0)}%"></span></span>
        </span>
        <span class="alt-val">나 ${a.sodium100}mg</span>
      </div>`,
    )
    .join('');

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
      <button class="panel-head" id="alt-toggle">
        <span>🍃</span><span>저당·대체 간식 보기</span><span class="chev">⌄</span>
      </button>
      <div class="panel-body">
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
    </section>
  `;

  app.querySelector('#back').addEventListener('click', () => history.back());

  app.querySelector('#alt-toggle').addEventListener('click', () => {
    state.altOpen = !state.altOpen;
    app.querySelector('#alt-panel').classList.toggle('panel-body-closed', !state.altOpen);
    app.querySelector('#alt-panel').classList.toggle('open', state.altOpen);
  });

  const svgEl = app.querySelector('#card-wrap svg');
  app.querySelector('#save').addEventListener('click', () => exportCard(svgEl, model, 'save'));
  app.querySelector('#share').addEventListener('click', () => exportCard(svgEl, model, 'share'));
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
          <small>영양성분표를 찍어 두고 아래 숫자를 적어 주세요</small>
        </button>
        <input type="file" id="photo-input" accept="image/*" capture="environment" class="sr-only" />
        <input type="file" id="album-input" accept="image/*" class="sr-only" />
        <div class="photo-preview" id="photo-preview" hidden>
          <img id="photo-img" alt="성분표 미리보기" />
          <button type="button" class="remove" id="photo-remove" aria-label="사진 지우기">✕</button>
        </div>
        <p class="form-note" id="photo-hint" hidden>사진은 이 기기에서만 보여요. 숫자 자동 인식은 다음 버전에서 붙일게요.</p>
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
      <div class="field">
        <label for="f-ing">원재료 (선택)</label>
        <textarea id="f-ing" name="ingredients" rows="2" placeholder="예: 옥수수, 설탕, 팜유, 정제소금"></textarea>
        <p class="hint">적지 않으면 종류에 맞는 기본 원재료로 쌓아요.</p>
      </div>
      <button class="submit" type="submit">투명봉지로 보기</button>
      <p class="form-note">입력한 값으로만 계산해요. 저장되거나 밖으로 나가지 않습니다.</p>
    </form>
  `;

  app.querySelector('#back').addEventListener('click', () => history.back());

  const photoInput = app.querySelector('#photo-input');
  const albumInput = app.querySelector('#album-input');
  const preview = app.querySelector('#photo-preview');
  const img = app.querySelector('#photo-img');
  const hint = app.querySelector('#photo-hint');

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
    };
    reader.readAsDataURL(file);
  };

  photoInput.addEventListener('change', (e) => loadPhoto(e.target.files?.[0]));
  albumInput.addEventListener('change', (e) => loadPhoto(e.target.files?.[0]));
  app.querySelector('#photo-remove').addEventListener('click', () => {
    state.photoDataUrl = null;
    preview.hidden = true;
    hint.hidden = true;
    img.removeAttribute('src');
    photoInput.value = '';
    albumInput.value = '';
  });

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
      carbs: '',
      protein: '',
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
function route() {
  // 화면이 바뀌면 항상 맨 위부터 (목록에서 스크롤한 상태로 상세에 들어가면 카드 윗부분이 잘린다)
  window.scrollTo(0, 0);
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/p\/([\w-]+)$/);
  if (m) {
    const product = productById(m[1]);
    if (product) return renderDetail(product);
    location.hash = '#/';
    return;
  }
  if (hash === '#/c' && state.custom) return renderDetail(state.custom);
  if (hash === '#/custom') return renderCustomForm();
  renderHome();
}

window.addEventListener('hashchange', route);
route();

import { APP } from './config.js';
import { PRODUCTS, CATEGORIES, productById } from './data/products.js';
import { buildModel } from './lib/model.js';
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

  app.querySelector('#back').addEventListener('click', () => history.back());

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

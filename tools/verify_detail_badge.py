"""상세 화면 카드 헤더의 제조사 딱지 검증 — 390×844 모바일.

상세 화면(#/p/:id)에서 카드 SVG 헤더에 카테고리 알약 + 제조사 심볼·이름 딱지가
나란히 그려지는지, [이미지 저장]의 PNG 내보내기(1080px)에도 그대로 나오는지 확인한다.
콘솔/페이지 오류 0건, 가로 넘침 0건도 함께 본다.

사용: LD_LIBRARY_PATH=... python3 tools/verify_detail_badge.py [base_url] [tag]
"""

import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path('/workspace/verification/tumyeongbongji')
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4177/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'live'

report = {'base': BASE, 'checks': [], 'console': [], 'pageerrors': [], 'cards': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4177), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


httpd = None
if '127.0.0.1' in BASE:
    httpd = serve()

OVERFLOW_JS = """() => {
  const d = document.documentElement;
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 0.5)
    .slice(0, 5)
    .map((el) => `${el.tagName}.${el.className}`.slice(0, 60));
  return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide };
}"""

# 카드 SVG 안의 헤더 딱지: fill #FAF4EA 사각형 + 그 안 텍스트/심볼
HEADER_JS = """() => {
  const svg = document.querySelector('#card-wrap svg');
  if (!svg) return { ok: false, why: 'no-svg' };
  const rects = [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('y') === '22');
  const cat = rects.find((r) => r.getAttribute('fill') === '#EFE1CE');
  const pill = rects.find((r) => r.getAttribute('fill') === '#FAF4EA');
  const texts = [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('y') === '37');
  const vb = svg.viewBox.baseVal;
  const gap = cat && pill ? Number(pill.getAttribute('x')) - (Number(cat.getAttribute('x')) + Number(cat.getAttribute('width'))) : null;
  return {
    ok: !!cat,
    cat: cat ? { x: +cat.getAttribute('x'), w: +cat.getAttribute('width'), text: texts[0]?.textContent } : null,
    pill: pill ? { x: +pill.getAttribute('x'), w: +pill.getAttribute('width'), rx: pill.getAttribute('rx'), stroke: pill.getAttribute('stroke'), text: texts[1]?.textContent } : null,
    gap,
    symbols: svg.querySelectorAll('g[transform*="scale(0.8125)"]').length,
    badgeRight: pill ? +pill.getAttribute('x') + +pill.getAttribute('width') : null,
    cardRight: vb.width - 18,
  };
}"""

# PNG 내보내기(1080px) 결과를 캔버스에 그려 픽셀까지 확인
EXPORT_JS = """async () => {
  const svgEl = document.querySelector('#card-wrap svg');
  const vb = svgEl.viewBox.baseVal;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const w = 1080;
  const h = Math.round((vb.height * w) / vb.width);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.decoding = 'sync';
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg-load-failed')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFCF7';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const s = w / vb.width;
  // 딱지 배경색(#FAF4EA)과 테두리(#E3D6C4)가 실제로 칠해졌는지 픽셀 확인
  const pill = [...svgEl.querySelectorAll('rect')].find((r) => r.getAttribute('fill') === '#FAF4EA');
  const px = pill ? ctx.getImageData(Math.round((+pill.getAttribute('x') + +pill.getAttribute('width') / 2) * s), Math.round((22 + 3) * s), 1, 1).data : null;
  const sym = [...svgEl.querySelectorAll('circle')].find((c) => c.getAttribute('fill-opacity') === '0.13');
  const symPx = sym ? (() => {
    const g = sym.closest('g[transform*="scale(0.8125)"]');
    const m = /translate\\(([\\d.]+),([\\d.]+)\\)/.exec(g.getAttribute('transform'));
    return ctx.getImageData(Math.round((Number(m[1]) + 8) * s), Math.round((Number(m[2]) + 8) * s), 1, 1).data;
  })() : null;
  return {
    url: c.toDataURL('image/png'),
    width: w, height: h,
    pillPixel: px ? [...px] : null,
    symbolPixel: symPx ? [...symPx] : null,
  };
}"""


def rgba_to_hex(px):
    return '#%02X%02X%02X' % tuple(px[:3])


def near(px, hex_color, tol=12):
    if not px:
        return False
    r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
    return abs(px[0] - r) <= tol and abs(px[1] - g) <= tol and abs(px[2] - b) <= tol


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
    )
    page = ctx.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))

    for pid, brand in (('choco-heim', '크라운'), ('banana-kick', '농심')):
        page.goto(BASE + f'#/p/{pid}', wait_until='networkidle')
        page.wait_for_selector('#card-wrap svg')
        page.wait_for_timeout(200)
        h = page.evaluate(HEADER_JS)
        report['cards'].append({'id': pid, **h})
        check(f'{pid}: 카테고리 알약 칩', bool(h['cat']), json.dumps(h.get('cat'), ensure_ascii=False))
        check(
            f'{pid}: 제조사 딱지({brand})',
            bool(h['pill']) and h['pill']['text'] == brand and h['pill']['rx'] == '11' and h['pill']['stroke'] == '#E3D6C4',
            json.dumps(h.get('pill'), ensure_ascii=False),
        )
        check(f'{pid}: 칩과 딱지 간격 6px', h['gap'] is not None and abs(h['gap'] - 6) < 0.01, h['gap'])
        check(f'{pid}: 원형 심볼 1개', h['symbols'] == 1, h['symbols'])
        check(
            f'{pid}: 딱지가 카드 안에 들어감',
            h['badgeRight'] is not None and h['badgeRight'] <= h['cardRight'] + 0.01,
            f"right={h['badgeRight']} card={h['cardRight']}",
        )
        ov = page.evaluate(OVERFLOW_JS)
        check(f'{pid}: 가로 넘침 없음', ov['scrollW'] <= ov['clientW'] and not ov['wide'], json.dumps(ov, ensure_ascii=False))

        exp = page.evaluate(EXPORT_JS)
        report['cards'][-1].update({'export': {k: exp[k] for k in ('width', 'height')}})
        check(f'{pid}: PNG 내보내기 {exp["width"]}×{exp["height"]}', exp['width'] == 1080, f"{exp['width']}×{exp['height']}")
        check(
            f'{pid}: PNG에 딱지 배경 #FAF4EA',
            near(exp['pillPixel'], '#FAF4EA'),
            rgba_to_hex(exp['pillPixel'] or []),
        )
        check(
            f'{pid}: PNG에 심볼 색',
            exp['symbolPixel'] is not None and not near(exp['symbolPixel'], '#FFFCF7', 4),
            rgba_to_hex(exp['symbolPixel'] or []),
        )
        if pid == 'choco-heim':
            page.screenshot(path=str(OUT / f'detail-brand-badge-{TAG}-390.png'))
            png = OUT / f'detail-brand-badge-{TAG}-export.png'
            png.write_bytes(__import__('base64').b64decode(exp['url'].split(',', 1)[1]))
            print('wrote', png)

    page.close()

    # 직접 입력(브랜드 미입력) — 카테고리 칩만
    page2 = ctx.new_page()
    page2.on('pageerror', lambda e: report['pageerrors'].append(f'[custom] {e}'))
    page2.goto(BASE + '#/custom', wait_until='networkidle')
    page2.fill('#f-name', '테스트 과자')
    page2.fill('#f-weight', '60')
    page2.fill('#f-kcal', '300')
    page2.fill('#f-sodium', '300')
    page2.fill('#f-sugar', '12')
    page2.fill('#f-fat', '8')
    page2.click('button[type="submit"], #custom-form button[type="submit"]', timeout=5000)
    page2.wait_for_selector('#card-wrap svg', timeout=8000)
    page2.wait_for_timeout(200)
    h2 = page2.evaluate(HEADER_JS)
    check('직접 입력(브랜드 없음): 카테고리 칩만', bool(h2['cat']) and h2['pill'] is None, json.dumps(h2, ensure_ascii=False))
    ov2 = page2.evaluate(OVERFLOW_JS)
    check('직접 입력: 가로 넘침 없음', ov2['scrollW'] <= ov2['clientW'] and not ov2['wide'], json.dumps(ov2, ensure_ascii=False))
    page2.screenshot(path=str(OUT / f'detail-brand-badge-{TAG}-390-custom.png'))
    browser.close()

errs = [c for c in report['console'] if c.startswith('error')] + report['pageerrors']
check('콘솔·페이지 오류 0건', not errs, errs[:3])
report['ok'] = all(c['ok'] for c in report['checks'])
(OUT / f'detail-brand-badge-{TAG}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print('RESULT', 'OK' if report['ok'] else 'NG', f"{sum(c['ok'] for c in report['checks'])}/{len(report['checks'])}")
sys.exit(0 if report['ok'] else 1)

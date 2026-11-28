"""속보이네 폰트(페이퍼로지) 검증 (390×844 · iPhone UA).
화면 글꼴 적용 · 굵기별 로드 · 외부(구글) 폰트 요청 0 · 글리프 샘플 · 카드 SVG 글꼴 ·
PNG 내보내기(저장소 폰트 요청 + 실제 글꼴이 그려졌는지 픽셀 비교) · 잘림/넘침 · 콘솔 오류 0
사용: python3 tools/verify_font.py [base_url] [tag]
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
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://sokboyne.vercel.app/').rstrip('/') + '/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'live'

report = {'base': BASE, 'checks': [], 'console': [], 'font_requests': [], 'export_requests': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


httpd = None
if '127.0.0.1' in BASE:
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4179), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

GLYPH_SAMPLE = """
<div id="glyph-sample" style="position:fixed;left:0;top:0;right:0;z-index:99999;background:#FFFCF7;
  border-bottom:2px solid #C0512A;padding:10px 12px;font-family:'Paperlogy',sans-serif;color:#241A10">
  <div style="font-weight:400;font-size:15px">400 · 355 kcal · 나트륨 100mg · 당류 37g · 49.3%</div>
  <div style="font-weight:500;font-size:15px">500 · 355 kcal · 나트륨 100mg · 당류 37g · 49.3%</div>
  <div style="font-weight:600;font-size:15px">600 · 355 kcal · 나트륨 100mg · 당류 37g · 49.3%</div>
  <div style="font-weight:700;font-size:15px">700 · 바나나킥 꼬북칩 초코츄러스 신라면</div>
  <div style="font-weight:800;font-size:15px">800 · 바나나킥 꼬북칩 초코츄러스 신라면</div>
  <div style="font-weight:400;font-size:13px">기호 · (가운뎃점) % (퍼센트) ㎎? mg g kcal 0.5국자 각설탕 12.3개</div>
</div>
"""

PIXEL_COMPARE_JS = """
async () => {
  const svg = document.querySelector('#card-wrap svg');
  if (!svg) return { error: 'no-card' };
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);

  const b64 = async (url) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };

  const weights = [['400', 'fonts/Paperlogy-4Regular.woff2'], ['700', 'fonts/Paperlogy-7Bold.woff2'],
                   ['800', 'fonts/Paperlogy-8ExtraBold.woff2']];
  let css = '';
  for (const [w, file] of weights) {
    css += `@font-face{font-family:'Paperlogy';font-style:normal;font-weight:${w};`
        +  `src:url(data:font/woff2;base64,${await b64(file)}) format('woff2');}`;
  }

  const vb = svg.viewBox.baseVal;
  const width = Math.round(vb.width);
  const height = Math.round(vb.height);

  const render = async (withFont) => {
    const doc = withFont
      ? xml.replace(/>/, '><defs><style type="text/css">' + css + '</style></defs>')
      : xml;
    const blob = new Blob([doc], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFCF7';
    ctx.fillRect(0, 0, width, height);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('svg-load-failed'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    return ctx.getImageData(0, 0, width, height).data;
  };

  const withFont = await render(true);
  const withoutFont = await render(false);
  let diff = 0;
  for (let i = 0; i < withFont.length; i += 4) {
    if (Math.abs(withFont[i] - withoutFont[i]) > 24
        || Math.abs(withFont[i + 1] - withoutFont[i + 1]) > 24
        || Math.abs(withFont[i + 2] - withoutFont[i + 2]) > 24) diff += 1;
  }
  return { diff, total: width * height };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
        accept_downloads=True,
    )
    page = ctx.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)

    def on_request(req):
        u = req.url
        if 'fonts.googleapis.com' in u or 'fonts.gstatic.com' in u or '/fonts/Paperlogy-' in u:
            report['font_requests'].append(u)

    page.on('request', on_request)

    # 1. 홈 화면 글꼴
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1200)
    font = page.evaluate("""() => ({
        body: getComputedStyle(document.body).fontFamily,
        loaded400: document.fonts.check('16px "Paperlogy"'),
        loaded700: document.fonts.check('700 16px "Paperlogy"'),
        loaded800: document.fonts.check('800 16px "Paperlogy"'),
        faces: [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status),
        links: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href),
      })""")
    report['font'] = font
    check('body 글꼴에 Paperlogy', 'Paperlogy' in font['body'], font['body'][:80])
    check('Paperlogy 400 실제 로드됨', font['loaded400'] is True, font['loaded400'])
    check('Paperlogy 700 실제 로드됨', font['loaded700'] is True, font['loaded700'])
    check('Paperlogy 800 실제 로드됨', font['loaded800'] is True, font['loaded800'])
    check('스타일시트에 외부(구글) 폰트 링크 없음',
          not any('fonts.googleapis' in h or 'fonts.gstatic' in h for h in font['links']), font['links'])
    report['faces'] = font['faces']

    google = [u for u in report['font_requests'] if 'googleapis.com' in u or 'gstatic.com' in u]
    local = [u for u in report['font_requests'] if '/fonts/Paperlogy-' in u]
    check('구글 폰트 요청 0', len(google) == 0, google[:2])
    check('저장소 폰트(fonts/Paperlogy-*) 요청', len(local) >= 1,
          [u.rsplit('/', 1)[-1] for u in local])

    # 굵기 샘플을 띄워 글리프(·, %, kcal, mg, g)가 깨지지 않는지 눈으로 확인할 수 있게 남긴다
    page.evaluate("(html) => document.body.insertAdjacentHTML('afterbegin', html)", GLYPH_SAMPLE)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / f'{TAG}-glyphs-390.png'))
    print('shot:', OUT / f'{TAG}-glyphs-390.png')
    page.evaluate("() => document.getElementById('glyph-sample')?.remove()")
    page.screenshot(path=str(OUT / f'{TAG}-home-font-390.png'))

    # 2. 상세 카드 글꼴
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(1200)
    svg_font = page.evaluate(
        "() => [...document.querySelectorAll('#card-wrap svg text')].slice(0, 8).map(t => t.getAttribute('font-family'))"
    )
    check('카드 SVG font-family = Paperlogy',
          bool(svg_font) and all((f or '').startswith("'Paperlogy'") for f in svg_font), svg_font[:2])
    weights = page.evaluate(
        "() => [...new Set([...document.querySelectorAll('#card-wrap svg text')]"
        ".map(t => t.getAttribute('font-weight') || '400'))].sort()"
    )
    report['card_weights'] = weights
    check('카드가 쓰는 굵기', set(weights) <= {'400', '500', '600', '700', '800'}, weights)
    # 카드 텍스트가 카드 밖으로 넘치지 않는지: text bbox가 viewBox 폭 안에 있는지
    overflow = page.evaluate(
        """() => {
          const svg = document.querySelector('#card-wrap svg');
          if (!svg) return null;
          const vb = svg.viewBox.baseVal;
          let worst = 0;
          for (const t of svg.querySelectorAll('text')) {
            const bb = t.getBBox();
            worst = Math.max(worst, bb.x + bb.width - (vb.x + vb.width));
            worst = Math.max(worst, vb.x - bb.x);
          }
          return Math.round(worst * 10) / 10;
        }"""
    )
    check('카드 텍스트가 카드 폭 안에 들어옴', overflow is not None and overflow <= 1, f'overflow={overflow}px')
    page.screenshot(path=str(OUT / f'{TAG}-card-font-390.png'))
    print('shot:', OUT / f'{TAG}-card-font-390.png')

    # 2b. 카드 SVG를 폰트 심은 것/안 심은 것으로 그려 픽셀 차이를 본다(= 내보내기가 글꼴을 실제로 쓴다)
    try:
        cmp = page.evaluate(PIXEL_COMPARE_JS)
        report['pixel_compare'] = cmp
        check('카드 렌더: 폰트 심은 그림과 안 심은 그림이 다르다(글꼴이 실제로 그려짐)',
              'error' not in cmp and cmp['diff'] > 200, cmp)
    except Exception as err:  # noqa: BLE001
        check('카드 렌더: 폰트 심은 그림과 안 심은 그림이 다르다(글꼴이 실제로 그려짐)', False, str(err)[:140])

    # 3. PNG 내보내기 → 저장소 폰트 요청 + 다운로드
    page.on('request', lambda r: report['export_requests'].append(r.url)
            if '/fonts/Paperlogy-' in r.url or 'fonts.googleapis' in r.url or 'fonts.gstatic' in r.url else None)
    with page.expect_download(timeout=30000) as dl:
        page.get_by_role('button', name='이미지 저장').click()
    saved = OUT / f'{TAG}-card-export-1080.png'
    dl.value.save_as(saved)
    page.wait_for_timeout(1500)
    exported = [u.rsplit('/', 1)[-1] for u in report['export_requests'] if '/fonts/Paperlogy-' in u]
    report['export_fonts'] = exported
    check('PNG 내보내기: 저장소 폰트를 심는다', len(exported) >= 1, exported)
    check('PNG 내보내기: 구글 폰트 요청 없음',
          not any('google' in u for u in report['export_requests']), len(report['export_requests']))
    check('PNG 파일 저장', saved.exists() and saved.stat().st_size > 30000, f'{saved.stat().st_size if saved.exists() else 0}B')
    print('export:', saved)

    check('가로 넘침 없음(390)', page.evaluate('document.documentElement.scrollWidth <= 390'),
          page.evaluate('document.documentElement.scrollWidth'))
    check('콘솔 오류 0', len(report['console']) == 0, '; '.join(report['console'][:3]))

    b.close()

if httpd:
    httpd.shutdown()

Path('/workspace/verification/tumyeongbongji').mkdir(parents=True, exist_ok=True)
Path(f'/workspace/verification/tumyeongbongji/font-report-{TAG}.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

fails = [c for c in report['checks'] if not c['ok']]
print(f"\n{len(report['checks']) - len(fails)}/{len(report['checks'])} PASS")
sys.exit(1 if fails else 0)

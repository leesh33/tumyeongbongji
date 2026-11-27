"""속보이네 폰트(고운돋움) 검증 (390×844 · iPhone UA).
화면 글꼴 적용 · 카드 SVG 글꼴 · PNG 내보내기 서브셋 요청 · 잘림/넘침 · 콘솔 오류 0
사용: python3 tools/verify_font.py [base_url] [tag]
"""
import functools
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

report = {'base': BASE, 'checks': [], 'console': [], 'font_requests': [], 'subset': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


httpd = None
if '127.0.0.1' in BASE:
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4179), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

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
        if 'fonts.googleapis.com/css2' in u:
            report['font_requests'].append(u)
            if 'text=' in u:
                report['subset'].append(u)

    page.on('request', on_request)

    # 1. 홈 화면 글꼴
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1200)
    font = page.evaluate(
        "() => ({ body: getComputedStyle(document.body).fontFamily,"
        " loaded: document.fonts.check('16px \"Gowun Dodum\"') })"
    )
    check('body 글꼴에 Gowun Dodum', 'Gowun Dodum' in font['body'], font['body'][:70])
    check('Gowun Dodum 실제 로드됨(document.fonts)', font['loaded'] is True, font['loaded'])
    link = page.evaluate("() => [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).join(' ')")
    check('Google Fonts 링크 = Gowun+Dodum', 'family=Gowun+Dodum' in link, link[:120])
    check('Jua 링크 없음', 'family=Jua' not in link)
    page.screenshot(path=str(OUT / f'{TAG}-home-font-390.png'))
    print('shot:', OUT / f'{TAG}-home-font-390.png')

    # 2. 상세 카드 글꼴
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(1000)
    svg_font = page.evaluate(
        "() => [...document.querySelectorAll('#card-wrap svg text')].slice(0, 8).map(t => t.getAttribute('font-family'))"
    )
    check('카드 SVG font-family = Gowun Dodum', bool(svg_font) and all('Gowun Dodum' in f for f in svg_font), svg_font[:2])
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

    # 3. PNG 내보내기 → 서브셋 폰트 요청 + 다운로드
    page.evaluate('window.__subsetBefore = 0')
    report['subset'].clear()
    with page.expect_download(timeout=30000) as dl:
        page.get_by_role('button', name='이미지 저장').click()
    saved = OUT / f'{TAG}-card-export-1080.png'
    dl.value.save_as(saved)
    page.wait_for_timeout(1500)
    check('PNG 내보내기 시 Gowun Dodum 서브셋 요청', len(report['subset']) >= 1,
          (report['subset'][0][:140] if report['subset'] else 'none'))
    check('PNG 파일 저장', saved.exists() and saved.stat().st_size > 30000, f'{saved.stat().st_size if saved.exists() else 0}B')
    print('export:', saved)

    check('가로 넘침 없음(390)', page.evaluate('document.documentElement.scrollWidth <= 390'),
          page.evaluate('document.documentElement.scrollWidth'))
    check('콘솔 오류 0', len(report['console']) == 0, '; '.join(report['console'][:3]))

    b.close()

fails = [c for c in report['checks'] if not c['ok']]
print(f"\n{len(report['checks']) - len(fails)}/{len(report['checks'])} PASS")
sys.exit(1 if fails else 0)

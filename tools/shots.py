"""로컬 스크린샷 + 콘솔 오류 점검 (390×844 · iPhone UA).
같은 프로세스에서 정적 서버를 띄우고 Playwright로 찍는다.
사용: python3 tools/shots.py [url]
"""
import functools
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'downloads' / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 390, 844
CHROME = '/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)


def serve(port=4173):
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
    httpd = None if base.startswith('http') and '127.0.0.1' not in base else serve()
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = browser.new_context(
            viewport={'width': W, 'height': H},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale='ko-KR',
            user_agent=IPHONE_UA,
        )
        page = ctx.new_page()
        page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

        page.goto(base, wait_until='networkidle')
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / '01-home.png'))

        page.click('a.item')
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / '02-detail-top.png'))
        page.screenshot(path=str(OUT / '02-detail-full.png'), full_page=True)

        page.click('#alt-toggle')
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#alt-panel').scrollIntoView({block:'center'})")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / '03-alt.png'))

        page.goto(base + '#/custom', wait_until='networkidle')
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / '04-custom.png'), full_page=True)

        print('console/page errors:', errors if errors else 'clean (0)')
        browser.close()

    if httpd:
        httpd.shutdown()


if __name__ == '__main__':
    main()

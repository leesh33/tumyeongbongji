"""카드 SVG만 크게(3x) 캡처해서 픽셀 확인."""
import functools
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'downloads' / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome'
TAG = sys.argv[1] if len(sys.argv) > 1 else 'zoom'


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4174), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)
    page.goto('http://127.0.0.1:4174/#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(500)
    page.locator('#card-wrap svg').screenshot(path=str(OUT / f'card-{TAG}.png'))
    b.close()
httpd.shutdown()
print('ok')

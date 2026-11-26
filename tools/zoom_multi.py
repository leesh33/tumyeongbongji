"""여러 제품 카드를 3x로 캡처."""
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'downloads' / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome'
IDS = ['kkobuk-choco', 'shin-ramyun', 'coca-cola', 'pororo-apple', 'honey-butter-chip']


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4175), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    for pid in IDS:
        page.goto(f'http://127.0.0.1:4175/#/p/{pid}', wait_until='networkidle')
        page.wait_for_timeout(400)
        page.locator('#card-wrap svg').screenshot(path=str(OUT / f'card-{pid}.png'))
    b.close()
httpd.shutdown()
print('ok')

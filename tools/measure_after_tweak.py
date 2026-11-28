"""로컬 styles.css로 390px 레이아웃을 재며 잘린 제품명 초과 폭을 확인한다."""
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
server = subprocess.Popen([sys.executable, '-m', 'http.server', '4173'], cwd=str(ROOT),
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        page.goto('http://127.0.0.1:4173', wait_until='networkidle')
        page.wait_for_timeout(1500)
        rows = page.eval_on_selector_all('.feed .item', '''els => els.map(el => {
          const b = el.querySelector('.info b'); const mini = el.querySelector('.mini');
          return {name: b.textContent.trim(), over: b.scrollWidth - b.clientWidth,
                  miniW: Math.round(mini.getBoundingClientRect().width),
                  badge: el.querySelector('.mini i').textContent.trim()};
        })''')
        rows.sort(key=lambda r: -r['over'])
        print('mini max width:', max(r['miniW'] for r in rows))
        for r in rows[:5]:
            print(r)
        print('clipped:', sum(1 for r in rows if r['over'] > 0))
        page.screenshot(path='/workspace/verification/tumyeongbongji/badge-tweak-local-list-390x844.png')
        b.close()
finally:
    server.terminate()

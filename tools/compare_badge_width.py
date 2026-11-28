"""새 배지('나트륨 X국자')와 옛 배지('나 X국자')에서 제품명 잘림 개수를 비교한다."""
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'


def measure(page, label_mode):
    page.evaluate('''(mode) => {
      document.querySelectorAll('.feed .item .mini i').forEach((el, i) => {
        const t = el.textContent.trim();
        if (i % 2 === 0 && mode === 'old') {
          el.textContent = t.replace(/^나트륨 /, '나 ');
        }
      });
    }''', label_mode)
    page.wait_for_timeout(200)
    rows = page.eval_on_selector_all('.feed .item', '''els => els.map(el => {
      const b = el.querySelector('.info b'); const mini = el.querySelector('.mini');
      return {
        name: b.textContent.trim(),
        clipped: b.scrollWidth > b.clientWidth + 1,
        miniW: Math.round(mini.getBoundingClientRect().width),
      };
    })''')
    return rows


def main():
    server = None
    if BASE.startswith('http://127.0.0.1'):
        server = subprocess.Popen([sys.executable, '-m', 'http.server', '4173'], cwd=str(ROOT),
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.2)
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
            page.goto(BASE, wait_until='networkidle')
            page.wait_for_timeout(1500)
            new = measure(page, 'new')
            page.reload(wait_until='networkidle')
            page.wait_for_timeout(1500)
            old = measure(page, 'old')
            cn = [r['name'] for r in new if r['clipped']]
            co = [r['name'] for r in old if r['clipped']]
            print('rows:', len(new))
            print('mini width newest:', max(r['miniW'] for r in new), 'oldest:', max(r['miniW'] for r in old))
            print('clipped 새 배지 %d: %s' % (len(cn), cn))
            print('clipped 옛 배지 %d: %s' % (len(co), co))
            b.close()
    finally:
        if server:
            server.terminate()


if __name__ == '__main__':
    main()

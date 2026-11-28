"""390px에서 잘린 제품명의 초과 폭(px)을 측정한다."""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://sokboyne.vercel.app'

with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1500)
    rows = page.eval_on_selector_all('.feed .item', '''els => els.map(el => {
      const b = el.querySelector('.info b'); const info = el.querySelector('.info');
      return {name: b.textContent.trim(), over: b.scrollWidth - b.clientWidth,
              infoW: Math.round(info.getBoundingClientRect().width),
              nameW: Math.round(b.scrollWidth)};
    })''')
    rows.sort(key=lambda r: -r['over'])
    for r in rows[:6]:
        print(r)
    b.close()

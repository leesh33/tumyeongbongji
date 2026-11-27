"""제조사 미니 심볼·딱지 검증 — 390×844 모바일 + 데스크톱.
홈(전체) · 카테고리 필터 · 검색 결과 · 제품 상세(대체 간식 펼침) 화면을 훑고
콘솔/페이지 오류 0건, 가로 넘침·딱지 잘림 없음을 확인하고 스크린샷을 남긴다.

사용: LD_LIBRARY_PATH=... python3 tools/verify_brand_badge.py [base_url] [tag]
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

report = {'base': BASE, 'checks': [], 'console': [], 'pageerrors': []}


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

BADGE_JS = """() => {
  const rows = [...document.querySelectorAll('.info')];
  const bad = [];
  let count = 0;
  for (const info of rows) {
    const badge = info.querySelector('.brand-badge');
    if (badge) {
      count++;
      const b = badge.getBoundingClientRect();
      const i = info.getBoundingClientRect();
      if (b.right > i.right + 0.5 || b.left < i.left - 0.5) bad.push(info.innerText.slice(0, 30));
      const name = badge.querySelector('.bname');
      if (name && name.scrollWidth > name.clientWidth + 1) bad.push('잘림: ' + name.textContent);
      const sym = badge.querySelector('svg.bsym');
      if (!sym) bad.push('심볼없음: ' + info.innerText.slice(0, 20));
    }
  }
  const first = document.querySelector('.item .info');
  return {
    items: document.querySelectorAll('.item').length,
    count,
    bad,
    meta: first ? first.querySelector('em')?.textContent : null,
    badgeText: first ? first.querySelector('.brand-badge .bname')?.textContent : null,
  };
}"""

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

    # 1) 홈 · 전체
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_selector('.item')
    info = page.evaluate(BADGE_JS)
    check('홈 전체: 모든 카드에 제조사 딱지', info['count'] == info['items'] and not info['bad'], f"items={info['items']} count={info['count']} bad={info['bad']}")
    check('홈 전체: 메타 줄은 무게·열량만', ' · ' in (info['meta'] or '') and '농심' not in (info['meta'] or ''), info['meta'])
    check('홈 전체: 첫 카드 딱지 = 농심', info['badgeText'] == '농심', info['badgeText'])
    ov = page.evaluate(OVERFLOW_JS)
    check('홈 전체: 가로 넘침 없음', ov['scrollW'] <= ov['clientW'] and not ov['wide'], json.dumps(ov, ensure_ascii=False))
    page.screenshot(path=str(OUT / f'brand-badge-{TAG}-390-home.png'), full_page=True)
    page.screenshot(path=str(OUT / f'brand-badge-{TAG}-390-home-viewport.png'))

    # 2) 카테고리 필터 (음료)
    page.click('button[data-cat="drink"]')
    page.wait_for_timeout(250)
    info = page.evaluate(BADGE_JS)
    check('음료 필터: 딱지·잘림 없음', info['count'] == info['items'] and info['items'] > 0 and not info['bad'], f"items={info['items']} count={info['count']} bad={info['bad']}")
    ov = page.evaluate(OVERFLOW_JS)
    check('음료 필터: 가로 넘침 없음', ov['scrollW'] <= ov['clientW'] and not ov['wide'], json.dumps(ov, ensure_ascii=False))
    page.screenshot(path=str(OUT / f'brand-badge-{TAG}-390-category.png'), full_page=True)

    # 3) 검색 (제조사 이름으로도 찾힘)
    page.click('button[data-cat="all"]')
    page.fill('#q', 'CJ제일제당')
    page.wait_for_timeout(300)
    info = page.evaluate(BADGE_JS)
    check('검색 결과: CJ제일제당 1건 + 딱지', info['count'] == 1 and info['badgeText'] == 'CJ제일제당', f"count={info['count']} text={info['badgeText']}")
    page.screenshot(path=str(OUT / f'brand-badge-{TAG}-390-search.png'), full_page=True)
    page.fill('#q', '')
    page.wait_for_timeout(250)

    # 4) 제품 상세 + 대체 간식 펼침
    page.click('.item')
    page.wait_for_selector('.card-wrap svg')
    page.click('#alt-toggle')
    page.wait_for_timeout(350)
    alt = page.evaluate(
        """() => {
      const rows = [...document.querySelectorAll('.alt-row')];
      const bad = rows.filter((r) => {
        const badge = r.querySelector('.brand-badge');
        const name = r.querySelector('.alt-name');
        return !badge || !name || badge.getBoundingClientRect().right > name.getBoundingClientRect().right + 0.5;
      }).length;
      return { rows: rows.length, bad, first: rows[0]?.innerText.replace(/\\n/g, ' | ') };
    }"""
    )
    check('상세: 대체 간식 줄에 제조사 딱지', alt['rows'] >= 1 and alt['bad'] == 0, json.dumps(alt, ensure_ascii=False))
    ov = page.evaluate(OVERFLOW_JS)
    check('상세: 가로 넘침 없음', ov['scrollW'] <= ov['clientW'] and not ov['wide'], json.dumps(ov, ensure_ascii=False))
    page.screenshot(path=str(OUT / f'brand-badge-{TAG}-390-detail.png'), full_page=True)
    page.close()

    # 5) 데스크톱
    dctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, locale='ko-KR')
    dpage = dctx.new_page()
    dpage.on('console', lambda m: report['console'].append(f'[desktop] {m.type}: {m.text}') if m.type == 'error' else None)
    dpage.on('pageerror', lambda e: report['pageerrors'].append(f'[desktop] {e}'))
    dpage.goto(BASE, wait_until='networkidle')
    dpage.wait_for_selector('.item')
    ov = dpage.evaluate(OVERFLOW_JS)
    dinfo = dpage.evaluate(BADGE_JS)
    check('데스크톱: 가로 넘침 없음', ov['scrollW'] <= ov['clientW'] and not ov['wide'], json.dumps(ov, ensure_ascii=False))
    check('데스크톱: 딱지 잘림 없음', dinfo['count'] == dinfo['items'] and not dinfo['bad'], f"items={dinfo['items']} count={dinfo['count']} bad={dinfo['bad']}")
    dpage.screenshot(path=str(OUT / f'brand-badge-{TAG}-desktop.png'), full_page=True)
    browser.close()

errs = [c for c in report['console'] if c.startswith('error')] + report['pageerrors']
check('콘솔·페이지 오류 0건', not errs, errs[:3])
report['ok'] = all(c['ok'] for c in report['checks'])
(OUT / f'brand-badge-{TAG}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print('RESULT', 'OK' if report['ok'] else 'NG', f"{sum(c['ok'] for c in report['checks'])}/{len(report['checks'])}")
sys.exit(0 if report['ok'] else 1)

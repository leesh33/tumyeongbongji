"""속보이네: 일반 화면에서 아이템 번호(#001)가 사라졌는지, 대체 간식 줄이 '나트륨'으로 나오는지 확인한다.

  python3 tools/verify_itemno_hidden.py [base_url] [tag]
  (기본: https://sokboyne.vercel.app/ live / 로컬: http://127.0.0.1:4173 local)

확인 항목
  1) 홈 목록 카드: 아이템 번호 배지 없음, 제조사 딱지만 남음
  2) 홈 검색: 번호(#004)·숫자(4)로는 결과가 없고, 이름·제조사로는 그대로 찾아진다
  3) 상세 헤더(#/p/:id): 번호 배지 없음
  4) 상세 '저당·대체 간식' 줄: '나트륨 XXXmg' 한 줄 유지, 값 칸·막대 폭이 줄마다 같음
  5) #/board: 게시판·글쓰기 폼이 그대로 열리고 번호가 노출되지 않는다
  6) 390px 가로 넘침 0
"""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path('/workspace/verification/tumyeongbongji')
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://sokboyne.vercel.app/').rstrip('/') + '/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'live'
ITEM_NO_RE = re.compile(r'#\d{2,4}\b')

report = {'base': BASE, 'tag': TAG, 'checks': [], 'console': [], 'pageerrors': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def overflow(page):
    return page.evaluate('document.documentElement.scrollWidth - window.innerWidth')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', user_agent=IPHONE_UA)
    page = ctx.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))

    # ── 1) 홈 ────────────────────────────────────────────
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1500)
    count = page.locator('.feed .item').count()
    check('홈: 목록 렌더', count >= 20, f'{count}개')
    badges = page.evaluate("() => [...document.querySelectorAll('.feed .item .item-no')].map(e => e.textContent.trim())")
    check('홈: 아이템 번호 배지 없음', len(badges) == 0, badges[:3])
    brands = page.evaluate("() => [...document.querySelectorAll('.feed .item .brand-badge')].slice(0, 3).map(e => e.textContent.trim())")
    check('홈: 제조사 딱지는 그대로', len(brands) > 0, brands)
    home_text = page.inner_text('#home-feed')
    check('홈: 화면 글자에 #001 꼴 번호 없음', not ITEM_NO_RE.search(home_text),
          ITEM_NO_RE.findall(home_text)[:3])
    page.screenshot(path=str(OUT / f'itemno-{TAG}-home-390.png'))
    check('홈 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    # ── 2) 홈 검색 ───────────────────────────────────────
    page.fill('#q', '#004')
    page.wait_for_timeout(250)
    by_no = page.evaluate("() => [...document.querySelectorAll('.feed .item b')].map(e => e.textContent.trim())")
    check('홈 검색: 번호(#004)로는 결과 없음', by_no == [], by_no)
    page.fill('#q', '#034')
    page.wait_for_timeout(250)
    by_digit = page.evaluate("() => [...document.querySelectorAll('.feed .item b')].map(e => e.textContent.trim())")
    check('홈 검색: 번호(#034)로도 결과 없음', by_digit == [], by_digit)
    page.fill('#q', '농심')
    page.wait_for_timeout(250)
    by_brand = page.evaluate("() => [...document.querySelectorAll('.feed .item b')].map(e => e.textContent.trim())")
    check('홈 검색: 제조사(농심) 검색은 그대로', len(by_brand) > 0, by_brand[:3])
    page.fill('#q', '')
    page.wait_for_timeout(200)

    # ── 3) 상세 헤더 ─────────────────────────────────────
    page.goto(f'{BASE}#/p/choco-heim', wait_until='networkidle')
    page.wait_for_timeout(800)
    detail_badges = page.evaluate("() => [...document.querySelectorAll('.topbar .item-no')].map(e => e.textContent.trim())")
    check('상세: 헤더 번호 배지 없음', len(detail_badges) == 0, detail_badges)
    topbar_text = page.inner_text('.topbar')
    check('상세: 헤더 글자에 #004 없음', '#004' not in topbar_text, topbar_text.replace('\n', ' '))
    page.screenshot(path=str(OUT / f'itemno-{TAG}-detail-390.png'))
    check('상세 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    # ── 4) 저당·대체 간식 줄 ─────────────────────────────
    if page.get_attribute('#alt-toggle', 'aria-expanded') != 'true':
        page.click('#alt-toggle')
    page.wait_for_timeout(400)
    rows = page.evaluate("""() => [...document.querySelectorAll('.alt-row')].map(el => {
        const r = n => n.getBoundingClientRect();
        const em = el.querySelector('.alt-val em');
        const range = document.createRange();
        range.selectNodeContents(em);
        const lines = [...range.getClientRects()].filter(x => x.height > 0).length;
        return {
          name: el.querySelector('.alt-name b').textContent.trim(),
          sodium: em.textContent.trim(),
          lines,
          valW: Math.round(r(el.querySelector('.alt-val')).width),
          barW: Math.round(r(el.querySelector('.alt-bars')).width),
        };
      })""")
    check('대체 간식: 줄이 보인다', len(rows) >= 1, len(rows))
    check('대체 간식: 나트륨 표기가 ‘나트륨 XXXmg’',
          all(re.fullmatch(r'나트륨 \d+(\.\d+)?mg', row['sodium']) for row in rows),
          [row['sodium'] for row in rows])
    check('대체 간식: 나트륨 줄이 한 줄', all(row['lines'] == 1 for row in rows),
          [(row['sodium'], row['lines']) for row in rows])
    check('대체 간식: 값 칸·막대 폭이 줄마다 같다',
          len({(row['valW'], row['barW']) for row in rows}) == 1,
          [(row['valW'], row['barW']) for row in rows])
    check('대체 간식 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    page.locator('#alt-panel').screenshot(path=str(OUT / f'itemno-{TAG}-alt-panel-390.png'))

    # ── 5) 제안·제보 게시판 ──────────────────────────────
    page.goto(f'{BASE}#/board', wait_until='networkidle')
    page.wait_for_timeout(1200)
    check('게시판: 목록이 열린다', page.locator('#board-list, .board-item, .board').count() > 0,
          page.title())
    board_text = page.inner_text('body')
    check('게시판: 글자에 #001 꼴 번호 없음', not ITEM_NO_RE.search(board_text), ITEM_NO_RE.findall(board_text)[:3])
    page.screenshot(path=str(OUT / f'itemno-{TAG}-board-390.png'))
    if page.get_attribute('#write-toggle', 'aria-expanded') != 'true':
        page.click('#write-toggle')
        page.wait_for_timeout(500)
    check('게시판: 글쓰기 폼이 열린다', page.locator('#board-form').is_visible(), page.locator('#board-form').count())
    check('게시판 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    page.screenshot(path=str(OUT / f'itemno-{TAG}-board-form-390.png'))

    # ── 6) 사후 확인 ─────────────────────────────────────
    check('콘솔 오류 0', len(report['console']) == 0, report['console'][:3])
    check('페이지 오류 0', len(report['pageerrors']) == 0, report['pageerrors'][:3])
    ctx.close()
    browser.close()

passed = sum(1 for c in report['checks'] if c['ok'])
print(f"\n{passed}/{len(report['checks'])} 통과 · report {OUT / f'itemno-{TAG}-report.json'}")
(OUT / f'itemno-{TAG}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
sys.exit(0 if passed == len(report['checks']) else 1)

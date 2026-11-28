"""속보이네 2026-11-28 2차 추가 31종 라이브 검증 (390×844).

  python3 tools/verify_products31.py [base_url] [tag]
  (기본: https://sokboyne.vercel.app/ 실서비스)
"""
import json
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

TOTAL = 92
CATS = {'snack': ('과자', 41), 'drink': ('음료', 20), 'noodle': ('라면·간편식', 17), 'kids': ('아기·키즈', 14)}

DETAILS = [
    # id, 이름, 열량 표기, 나트륨 표기
    ('jin-ramyun-hot', '진라면 매운맛', '500 kcal', '1860 mg'),
    ('samyang-ramyun', '삼양라면', '495 kcal', '1790 mg'),
    ('wangttukkeong', '왕뚜껑', '495 kcal', '1689.6 mg'),
    ('chilsung-cider', '칠성사이다', '153 kcal', '7.1 mg'),
    ('pepsi-zero', '펩시 제로슈거', '0 kcal', '47.5 mg'),
    ('jjayo-strawberry', '짜요짜요 딸기', '285 kcal', '210 mg'),
    ('sangha-cheese', '상하치즈 유기농 첫치즈', '60 kcal', '46.1 mg'),
    ('kkokkalcon', '꼬깔콘 고소한맛', '391 kcal', '348.4 mg'),
]

report = {'base': BASE, 'tag': TAG, 'checks': [], 'console': [], 'pageerrors': [], 'screens': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, user_agent=IPHONE_UA)
    page.on('console', lambda m: report['console'].append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_selector('.feed a.item', timeout=20000)
    page.wait_for_timeout(600)

    count_text = page.inner_text('.section-head span')
    items = page.locator('.feed a.item').count()
    check('홈 목록 총 개수 표기가 92개', count_text.strip() == f'{TOTAL}개', count_text)
    check('홈 목록 항목 수 92개', items == TOTAL, items)

    shot = OUT / f'products31-home-390x844.png'
    page.screenshot(path=str(shot))
    report['screens'].append(str(shot))

    for key, (label, expected) in CATS.items():
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_selector('.feed a.item')
        page.click(f'[data-cat="{key}"]')
        page.wait_for_timeout(350)
        n = page.locator('.feed a.item').count()
        txt = page.inner_text('.section-head span').strip()
        check(f'{label} 목록 {expected}개', n == expected and txt == f'{expected}개', f'{txt} / {n}')
    page.goto(BASE, wait_until='networkidle')

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_selector('.feed a.item')
    overflow = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    check('390px 가로 넘침 없음', overflow <= 0, overflow)

    for pid, name, kcal, sodium in DETAILS:
        page.goto(BASE + f'#/p/{pid}', wait_until='networkidle')
        page.wait_for_selector('.facts', timeout=15000)
        page.wait_for_timeout(350)
        title = page.inner_text('.topbar .title').strip()
        facts = page.inner_text('.facts')
        ok = title == name and kcal in facts and sodium in facts
        check(f'상세 {name} — 열량/나트륨 표기 일치', ok, f'title={title} kcal={kcal in facts} na={sodium in facts}')
        of = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        check(f'상세 {name} 가로 넘침 없음', of <= 0, of)
        shot = OUT / f'products31-detail-{pid}-390x844.png'
        page.screenshot(path=str(shot))
        report['screens'].append(str(shot))

    # 새 제조사 심볼(광동제약·서흥)이 목록에 그려지는지
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_selector('.feed a.item')
    badges = page.evaluate(
        "Array.from(document.querySelectorAll('.feed .bname')).map((n) => n.textContent)"
    )
    check('새 제조사 배지(광동제약) 노출', '광동제약' in badges, sorted(set(badges)))
    check('새 제조사 배지(서흥) 노출', '서흥' in badges)

    check('콘솔 오류 0건', len(report['console']) == 0, report['console'][:3])
    check('페이지 오류 0건', len(report['pageerrors']) == 0, report['pageerrors'][:3])
    browser.close()

fails = [c for c in report['checks'] if not c['ok']]
report['summary'] = {'total': len(report['checks']), 'pass': len(report['checks']) - len(fails), 'fail': len(fails)}
(OUT / f'products31-{TAG}.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
print(json.dumps(report['summary'], ensure_ascii=False))
sys.exit(1 if fails else 0)

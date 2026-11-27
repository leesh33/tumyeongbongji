"""속보이네 이름 변경 라이브 검증 (390×844 · iPhone UA).
<title> · 홈 헤더 · 카드 워터마크 · manifest · 콘솔 오류 0
사용: python3 tools/verify_rename.py [base_url]
"""
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

report = {'base': BASE, 'checks': [], 'console': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
    )
    page = ctx.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)

    # 1. 홈
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(700)
    check('title = 속보이네', page.title().startswith('속보이네'), page.title())
    h1 = page.locator('.brand h1').inner_text().strip() if page.locator('.brand h1').count() else '(없음)'
    check('홈 헤더 = 속보이네', h1 == '속보이네', h1)
    check('이전 이름 잔존 없음(홈)', '투명봉지' not in page.content())
    page.screenshot(path=str(OUT / 'sokboine-home-390.png'))
    print('shot:', OUT / 'sokboine-home-390.png')

    # 2. 상세 카드 워터마크
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(900)
    check('상세 title = 제품 — 속보이네', page.title().endswith('속보이네'), page.title())
    check('상세 카드 SVG 1개', page.locator('#card-wrap svg').count() == 1)
    svg = page.locator('#card-wrap svg').first
    svg_text = svg.evaluate('el => el.textContent') if svg.count() else ''
    check('카드 워터마크 = 속보이네', '속보이네' in svg_text, svg_text.replace('\n', ' | ')[-80:])
    check('이전 이름 잔존 없음(상세)', '투명봉지' not in page.content())
    page.screenshot(path=str(OUT / 'sokboine-card-390.png'))
    print('shot:', OUT / 'sokboine-card-390.png')
    # 카드 자체만 크게 한 장 (워터마크 확인용)
    svg.screenshot(path=str(OUT / 'sokboine-card-svg-390.png'))

    # 3. 직접 입력 폼 버튼 문구
    page.goto(BASE + '#/custom', wait_until='networkidle')
    page.wait_for_timeout(400)
    btn = page.locator('button.submit').inner_text().strip()
    check('직접 입력 버튼 문구', btn == '속보이네로 보기', btn)

    # 4. manifest
    man = page.evaluate("""async () => (await fetch('/manifest.webmanifest')).json()""")
    check('manifest name = 속보이네', man.get('name') == '속보이네', f"{man.get('name')} / {man.get('short_name')}")

    # 5. 가로 넘침 · 콘솔
    check('가로 넘침 없음(390)', page.evaluate('document.documentElement.scrollWidth <= 390'),
          page.evaluate('document.documentElement.scrollWidth'))
    check('콘솔 오류 0', len(report['console']) == 0, '; '.join(report['console'][:3]))

    b.close()

fails = [c for c in report['checks'] if not c['ok']]
print(f"\n{len(report['checks']) - len(fails)}/{len(report['checks'])} PASS")
sys.exit(1 if fails else 0)

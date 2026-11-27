"""최종 라이브 스크린샷 (390×844 · iPhone UA) → downloads/snack-xray/
스티키 헤더가 full-page 캡처에서 겹쳐 보이므로 뷰포트 단위로 찍는다.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'downloads' / 'snack-xray'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://sokboine.vercel.app/'
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', user_agent=UA,
                        accept_downloads=True)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    def shot(name):
        page.screenshot(path=str(OUT / name))

    # 1. 홈
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(500)
    shot('01-home.png')
    page.evaluate('window.scrollTo(0, 420)')
    page.wait_for_timeout(300)
    shot('01b-home-feed.png')

    # 2. 상세
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(600)
    shot('02-detail-top.png')
    page.locator('#card-wrap svg').screenshot(path=str(OUT / '02-detail-card.png'))
    page.evaluate("document.querySelector('.facts').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    shot('02b-detail-bottom.png')

    # 3. 대체 간식
    page.goto(BASE + '#/p/honey-butter-chip', wait_until='networkidle')
    page.wait_for_timeout(500)
    page.click('#alt-toggle')
    page.wait_for_timeout(300)
    page.evaluate("document.querySelector('#alt-panel').scrollIntoView({block:'center'})")
    page.wait_for_timeout(250)
    shot('03-alt.png')

    # 4. 직접 입력 (사진 첨부)
    page.goto(BASE + '#/custom', wait_until='networkidle')
    page.wait_for_timeout(300)
    shot('04-custom-form.png')
    page.set_input_files('#photo-input', str(ROOT / 'tools' / 'label-sample.png'))
    page.fill('#f-name', '우리집 쿠키')
    page.fill('#f-brand', '직접 입력')
    page.fill('#f-weight', '60')
    page.fill('#f-kcal', '280')
    page.fill('#f-sodium', '180')
    page.fill('#f-sugar', '9')
    page.fill('#f-fat', '12')
    page.fill('#f-ing', '밀가루, 버터, 설탕, 소금')
    page.wait_for_timeout(400)
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(300)
    shot('05-custom-with-photo.png')

    page.click('.submit')
    page.wait_for_timeout(600)
    shot('06-custom-result.png')
    page.locator('#card-wrap svg').screenshot(path=str(OUT / '06b-custom-card.png'))

    with page.expect_download() as dl:
        page.click('#save')
    dl.value.save_as(str(OUT / '07-export-1080.png'))

    # 5. 다른 제품 카드
    for pid in ['kkobuk-choco', 'shin-ramyun', 'coca-cola', 'pororo-barley']:
        page.goto(BASE + f'#/p/{pid}', wait_until='networkidle')
        page.wait_for_timeout(450)
        page.locator('#card-wrap svg').screenshot(path=str(OUT / f'card-{pid}.png'))

    print('console errors:', errors if errors else 'clean (0)')
    b.close()

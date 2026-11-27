"""투명봉지 기능 검증 (390×844 · iPhone UA).
홈피드 · 카테고리 · 검색 · 상세 카드 · PNG 저장 · 직접 입력(사진 첨부) · 콘솔 오류 0
"""
import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'downloads'
SHOTS = OUT / 'shots'
SHOTS.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4176/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'

report = {'base': BASE, 'checks': [], 'errors': [], 'console': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', 4176), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


httpd = None
if '127.0.0.1' in BASE:
    httpd = serve()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
        accept_downloads=True,
    )
    page = ctx.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['errors'].append(str(e)))

    # 1. 홈
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(300)
    items = page.locator('a.item')
    check('홈 피드 34종', items.count() == 34, f'{items.count()}개')
    check('제목', '투명봉지' in page.title(), page.title())
    page.screenshot(path=str(SHOTS / f'{TAG}-01-home.png'))

    # 2. 카테고리 필터
    page.click('[data-cat="drink"]')
    page.wait_for_timeout(250)
    check('음료 필터 9종', page.locator('a.item').count() == 9, page.locator('a.item').count())

    # 3. 검색
    page.click('[data-cat="all"]')
    page.wait_for_timeout(150)
    page.fill('#q', '바나나')
    page.wait_for_timeout(300)
    n = page.locator('a.item').count()
    check('검색 "바나나" 결과', n >= 1, f'{n}개')
    page.fill('#q', '없는과자이름')
    page.wait_for_timeout(300)
    check('검색 결과 없음 안내', page.locator('.empty').count() == 1)
    page.fill('#q', '')
    page.wait_for_timeout(200)

    # 4. 상세
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(500)
    text = page.inner_text('#app')
    check('상세 카드 렌더', page.locator('#card-wrap svg').count() == 1)
    check('환산 문구', '라면 국물 0.5국자' in text and '각설탕 12.3개' in text and '밥숟가락 0.5스푼' in text, text[:0])
    check('고지 문구', '광고나 비하 의도' in text)
    check('층 라벨', page.locator('#card-wrap svg text').count() >= 10, page.locator('#card-wrap svg text').count())
    page.screenshot(path=str(SHOTS / f'{TAG}-02-detail.png'))
    page.screenshot(path=str(SHOTS / f'{TAG}-02-detail-full.png'), full_page=True)

    # 5. 대체 간식
    page.click('#alt-toggle')
    page.wait_for_timeout(250)
    check('대체 간식 3개', page.locator('.alt-row').count() == 3, page.locator('.alt-row').count())
    page.evaluate("document.querySelector('#alt-panel').scrollIntoView({block:'center'})")
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / f'{TAG}-03-alt.png'))

    # 6. PNG 저장
    with page.expect_download(timeout=15000) as dl:
        page.click('#save')
    download = dl.value
    png_path = SHOTS / f'{TAG}-export.png'
    download.save_as(str(png_path))
    size = png_path.stat().st_size
    check('PNG 저장', size > 20000, f'{size} bytes · {download.suggested_filename}')

    try:
        from PIL import Image

        im = Image.open(png_path)
        check('PNG 해상도 1080폭', im.width == 1080, f'{im.width}×{im.height}')
    except Exception as exc:  # noqa: BLE001
        check('PNG 해상도 확인', False, str(exc))

    # 7. 직접 입력 + 사진
    page.goto(BASE + '#/custom', wait_until='networkidle')
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f'{TAG}-04-custom.png'), full_page=True)
    check('사진 버튼', page.locator('#photo-btn').count() == 1)
    capture_attr = page.get_attribute('#photo-input', 'capture')
    accept_attr = page.get_attribute('#photo-input', 'accept')
    check('카메라 input 속성', capture_attr == 'environment' and accept_attr == 'image/*', f'{accept_attr}/{capture_attr}')
    page.set_input_files('#photo-input', str(SHOTS / 'card-z3.png'))
    page.wait_for_timeout(400)
    check('사진 미리보기', page.locator('#photo-preview:not([hidden])').count() == 1)
    page.screenshot(path=str(SHOTS / f'{TAG}-05-custom-photo.png'), full_page=True)

    page.fill('#f-name', '테스트 과자')
    page.fill('#f-brand', '테스트')
    page.select_option('#f-cat', 'snack')
    page.fill('#f-weight', '80')
    page.fill('#f-kcal', '400')
    page.fill('#f-sodium', '660')
    page.fill('#f-sugar', '15')
    page.fill('#f-fat', '10')
    page.fill('#f-ing', '밀가루, 설탕, 팜유, 정제소금')
    page.click('.submit')
    page.wait_for_timeout(600)
    text2 = page.inner_text('#app')
    check('직접 입력 카드', '테스트 과자' in text2 and '라면 국물 3국자' in text2 and '각설탕 5개' in text2, '')
    page.screenshot(path=str(SHOTS / f'{TAG}-06-custom-result.png'), full_page=True)

    # 8. 뒤로 가기
    page.go_back()
    page.wait_for_timeout(400)
    check('뒤로 가기', page.locator('#custom-form').count() == 1)

    check('콘솔 오류 0', len(report['console']) == 0, report['console'][:3])
    check('페이지 오류 0', len(report['errors']) == 0, report['errors'][:3])

    b.close()

if httpd:
    httpd.shutdown()

report['ok'] = all(c['ok'] for c in report['checks'])
(OUT / f'verify-{TAG}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('ALL OK' if report['ok'] else 'SOME FAILED')

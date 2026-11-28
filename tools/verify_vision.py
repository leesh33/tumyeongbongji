"""속보이네: #/custom 사진 자동 인식(Gemini Vision · /api/analyze-food) 동작 확인.

  python3 -m http.server 4173          (또는 터미널에서 npm run serve)
  python3 tools/verify_vision.py http://127.0.0.1:4173 local     ← 응답 목(mock)
  python3 tools/verify_vision.py https://sokboyne.vercel.app live ← 실제 Gemini 호출

확인 항목
  1) #/custom 문구: "AI가 자동으로", Gemini 전송 안내. 옛 "기기 안에서만" 문구 없음
  2) 사진을 고르면 자동으로 /api/analyze-food로 POST(1280px 이하 JPEG, data URL 아님)
  3) 앞면 제품 사진: name/brand/category/용량/열량/원재료 자동 채움 + 추정 안내 배너
  4) 뒷면 성분표 사진: 숫자 6개 자동 채움, 추정 배너 없음
  5) Tesseract·CDN 요청 0 (클라이언트 OCR 제거 확인)
  6) API 오류(503): 친절한 안내 + 직접 입력으로 카드 생성 유지
  7) 390×844 가로 넘침 0, 콘솔/페이지 오류 0
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
ROOT = Path(__file__).resolve().parent.parent
FRONT_PHOTO = Path('/workspace/attachments/2026-11-28/1000000035-1edeea02d6ce471b9aa71c3784a6bffe.jpg')
LABEL_PHOTO = ROOT / 'tools' / 'label-kr.png'

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173').rstrip('/') + '/'
TAG = sys.argv[2] if len(sys.argv) > 2 else ('local' if '127.0.0.1' in BASE else 'live')
MOCK = '127.0.0.1' in BASE or 'localhost' in BASE

report = {'base': BASE, 'tag': TAG, 'mock': MOCK, 'checks': [], 'requests': [], 'console': [], 'pageerrors': []}

FRONT_REPLY = {
    'ok': True,
    'mode': 'product_lookup',
    'estimated': True,
    'name': '파파 ZOOS 배도라지',
    'brand': '일동후디스',
    'category': 'drink',
    'servingG': 100,
    'unit': 'ml',
    'kcal': 45,
    'sodiumMg': 5,
    'sugarG': 8,
    'fatG': 0,
    'carbsG': 11,
    'proteinG': 0,
    'ingredients': ['배즙', '도라지', '배추'],
    'note': '제조사 공식 표기 기준',
    'sources': ['일동후디스 공식몰'],
}
LABEL_REPLY = {
    'ok': True,
    'mode': 'label',
    'estimated': False,
    'name': '',
    'brand': '',
    'category': 'snack',
    'servingG': 75,
    'unit': 'g',
    'kcal': 320,
    'sodiumMg': 100,
    'sugarG': 37,
    'fatG': 4.6,
    'carbsG': 66,
    'proteinG': 3.2,
    'ingredients': ['밀가루', '설탕', '팜유', '코코아분말', '정제소금'],
    'note': '포장지 인쇄값',
    'sources': [],
}
ERROR_REPLY = {
    'ok': False,
    'error': 'missing_api_key',
    'message': 'AI 사진 인식이 아직 설정되지 않았어요(서버 키 없음). 아래에 직접 적으면 카드를 만들 수 있어요.',
}

scenario = {'name': 'front', 'status': 200, 'body': FRONT_REPLY, 'seen': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def value(page, rid):
    return page.eval_on_selector(rid, 'el => el.value')


def overflow(page):
    return page.evaluate('document.documentElement.scrollWidth - window.innerWidth')


def wait_ai(page, timeout=45000):
    """상태 줄이 '읽는 중'에서 끝날 때까지 기다린다."""
    page.wait_for_function(
        """() => {
             const s = document.querySelector('#ocr-status');
             if (!s || s.hidden) return false;
             return !s.classList.contains('busy') && s.textContent.trim().length > 0;
           }""",
        timeout=timeout,
    )
    return page.inner_text('#ocr-status')


def upload(page, path, timeout=45000):
    page.set_input_files('#album-input', str(path))
    page.wait_for_function(
        "() => !document.querySelector('#photo-preview').hidden", timeout=15000
    )
    return wait_ai(page, timeout)


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
    def on_console(m):
        if m.type != 'error':
            return
        # 오류 시나리오에서 일부러 낸 503은 앱이 처리하는 정상 흐름이라 뺀다.
        if 'Failed to load resource' in m.text and ('503' in m.text or '429' in m.text):
            return
        report['console'].append(f'{m.type}: {m.text}')

    page.on('console', on_console)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))
    page.on('request', lambda r: report['requests'].append(r.url))

    if MOCK:
        def route_api(route):
            payload = json.loads(route.request.post_data or '{}')
            b64 = str(payload.get('imageBase64') or '')
            scenario['seen'].append(
                {
                    'scenario': scenario['name'],
                    'mimeType': payload.get('mimeType'),
                    'base64_len': len(b64),
                    'is_data_url': b64.startswith('data:'),
                    'magic': b64[:8],
                }
            )
            route.fulfill(
                status=scenario['status'],
                content_type='application/json; charset=utf-8',
                body=json.dumps(scenario['body'], ensure_ascii=False),
            )

        page.route('**/api/analyze-food', route_api)

    # ── 1) 화면·문구 ────────────────────────────────────
    page.goto(BASE + '#/custom', wait_until='networkidle')
    page.wait_for_timeout(800)
    body_text = page.inner_text('.form')
    check('화면: 직접 입력 폼이 열린다', page.locator('#custom-form').count() == 1)
    small = page.inner_text('#photo-btn small')
    check('문구: 사진 버튼이 AI 자동 채움을 안내', 'AI가 자동으로' in small, small)
    check('문구: Gemini 전송 안내', 'Gemini' in body_text or 'AI' in body_text)
    check('문구: 옛 "기기 안에서만" 문구 없음', '기기 안에서만' not in body_text, '')
    check('문구: 옛 "어디에도 보내지 않습니다" 없음', '보내지 않습니다' not in body_text, '')
    page.screenshot(path=str(OUT / f'vision-{TAG}-1-empty.png'))
    check('390 가로 넘침 0 (빈 화면)', overflow(page) <= 0, f'{overflow(page)}px')

    # ── 2) 앞면 제품 사진 ───────────────────────────────
    scenario['name'], scenario['status'], scenario['body'] = 'front', 200, FRONT_REPLY
    status = upload(page, FRONT_PHOTO)
    check('앞면: 인식 완료 문구', '채웠어요' in status or '채웠' in status, status)
    name = value(page, '#f-name')
    weight = value(page, '#f-weight')
    kcal = value(page, '#f-kcal')
    cat = page.eval_on_selector('#f-cat', 'el => el.value')
    ing = value(page, '#f-ing')
    banner = page.query_selector('#ai-banner')
    banner_hidden = banner.evaluate('el => el.hidden') if banner else True
    banner_text = page.inner_text('#ai-banner') if banner else ''
    check('앞면: 제품명 채움', bool(name), name)
    check('앞면: 용량·열량 채움', bool(weight) and bool(kcal), f'{weight} / {kcal}')
    check('앞면: 종류를 음료/키즈로', cat in ('drink', 'kids'), cat)
    unit = page.eval_on_selector('#ai-unit', 'el => el.value')
    check('앞면: 단위 ml 유지(용량 100ml)', unit == 'ml', unit)
    check('앞면: 원재료 채움', bool(ing), ing)
    check('앞면: 추정 안내 배너 표시', not banner_hidden and '앞면 제품명' in banner_text, banner_text[:80])
    page.screenshot(path=str(OUT / f'vision-{TAG}-2-front.png'))
    check('390 가로 넘침 0 (앞면 인식)', overflow(page) <= 0, f'{overflow(page)}px')

    # ── 3) 뒷면 성분표 사진 ─────────────────────────────
    page.click('#photo-remove')
    scenario['name'], scenario['status'], scenario['body'] = 'label', 200, LABEL_REPLY
    status = upload(page, LABEL_PHOTO)
    num = {k: value(page, f'#f-{k}') for k in ('weight', 'kcal', 'sodium', 'sugar', 'fat', 'carbs', 'protein')}
    banner = page.query_selector('#ai-banner')
    check('성분표: 숫자 채움', all(num.values()), num)
    check(
        '성분표: 값이 응답과 같다',
        num['weight'] == '75' and num['kcal'] == '320' and num['sodium'] == '100'
        and num['sugar'] == '37' and num['fat'] == '4.6',
        num,
    )
    check('성분표: 추정 배너는 숨김', banner.evaluate('el => el.hidden') if banner else True, '')
    page.screenshot(path=str(OUT / f'vision-{TAG}-3-label.png'))

    # ── 4) 전송한 사진 형식 (목 모드에서만 확인 가능) ────────
    if MOCK:
        check('요청 2건을 /api/analyze-food로 보냈다', len(scenario['seen']) == 2, scenario['seen'])
        shapes = scenario['seen']
        check('요청: data URL이 아닌 순수 base64', all(not s['is_data_url'] for s in shapes), shapes[0]['is_data_url'] if shapes else '')
        check('요청: JPEG로 압축', all(s['mimeType'] == 'image/jpeg' for s in shapes), [s['mimeType'] for s in shapes])
        check('요청: base64가 충분히 큼(>10KB)', all(s['base64_len'] > 10000 for s in shapes), [s['base64_len'] for s in shapes])
        check('요청: JPEG 앞머리', all(s['magic'].startswith('/9j/') for s in shapes), [s['magic'] for s in shapes])

    # ── 5) API 오류(503, 목 전용)와 직접 입력 ──────────────
    page.click('#photo-remove')
    if MOCK:
        scenario['name'], scenario['status'], scenario['body'] = 'error', 503, ERROR_REPLY
        status = upload(page, LABEL_PHOTO)
        check('오류: 친절한 안내', '지금 쓸 수 없어요' in status or '직접 적' in status, status)
        check('오류: 다시 시도 버튼', page.inner_text('#ocr-btn').strip() == '다시 시도', page.inner_text('#ocr-btn'))
    page.fill('#f-name', '직접 적은 과자')
    page.fill('#f-weight', '60')
    page.fill('#f-kcal', '280')
    page.fill('#f-sodium', '120')
    page.fill('#f-sugar', '9')
    page.fill('#f-fat', '5')
    page.screenshot(path=str(OUT / f'vision-{TAG}-4-error.png'))
    page.click('#custom-form .submit')
    page.wait_for_timeout(900)
    check('직접 입력: 카드 화면으로 이동', '#/c' in page.url, page.url)
    card_text = page.inner_text('#app')
    check('직접 입력: 입력한 이름이 카드에 보인다', '직접 적은 과자' in card_text, '')
    page.screenshot(path=str(OUT / f'vision-{TAG}-5-card.png'))
    check('390 가로 넘침 0 (카드)', overflow(page) <= 0, f'{overflow(page)}px')

    # ── 6) Tesseract·CDN 흔적 ──────────────────────────
    cdn = [u for u in report['requests'] if 'tesseract' in u.lower() or 'jsdelivr' in u or 'unpkg' in u]
    check('Tesseract·CDN 요청 0', len(cdn) == 0, cdn[:3])

    check('콘솔 오류 0', len(report['console']) == 0, report['console'][:3])
    check('페이지 오류 0', len(report['pageerrors']) == 0, report['pageerrors'][:3])

    browser.close()

passed = sum(1 for c in report['checks'] if c['ok'])
total = len(report['checks'])
report['summary'] = f'{passed}/{total}'
(OUT / f'vision-{TAG}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'\n{passed}/{total} 통과 — {OUT / f"vision-{TAG}.json"}')
sys.exit(0 if passed == total else 1)

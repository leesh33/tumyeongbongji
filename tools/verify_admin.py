"""속보이네 어드민(#/admin)·아이템 번호·성분·대체상품 링크 검증 (로컬/라이브 공용).

  python3 tools/verify_admin.py [base_url] [tag]
  (기본: https://sokboyne.vercel.app/ live)
"""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path('/workspace/verification/tumyeongbongji')
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://sokboyne.vercel.app/').rstrip('/') + '/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'live'
ADMIN_EMAIL = 'andy.leesh33@gmail.com'
USER_ID = 'test-admin-1'
SESSION = {
    'accessToken': 'test-admin-token',
    'refreshToken': 'test-refresh-token',
    'expiresAt': 4102444800,
    'tokenType': 'bearer',
    'provider': 'google',
    'user': {
        'id': USER_ID,
        'email': ADMIN_EMAIL,
        'user_metadata': {'full_name': '이상훈'},
        'app_metadata': {'provider': 'google'},
    },
}

report = {'base': BASE, 'tag': TAG, 'checks': [], 'console': [], 'pageerrors': [], 'results': {}}
captured = []


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


MOCK_PRODUCTS = [
    {
        'item_no': 1, 'id': 'banana-kick', 'name': '바나나킥', 'brand': '농심', 'category': 'snack', 'unit': 'g',
        'weight': 75, 'kcal': 320, 'sodium': 100, 'sugar': 37, 'fat': 4.6, 'carbs': 66, 'protein': 3.2,
        'ingredients': ['옥수수(콘밀)', '설탕'],
        'bulk': [{'kind': 'flour', 'label': '콘밀', 'sub': '옥수수', 'share': 1}],
        'note': '달콤한 바나나 향', 'alt_links': [], 'is_active': True,
    },
    {
        'item_no': 4, 'id': 'choco-heim', 'name': '쵸코하임', 'brand': '크라운', 'category': 'snack', 'unit': 'g',
        'weight': 47, 'kcal': 250, 'sodium': 65, 'sugar': 17, 'fat': 14, 'carbs': 28, 'protein': 4,
        'ingredients': ['밀가루', '헤이즐넛페이스트'],
        'bulk': [{'kind': 'flour', 'label': '밀가루', 'sub': '밀', 'share': 1}],
        'note': '얇은 웨이퍼 사이 크림',
        'alt_links': [
            {'title': '무설탕 통밀 크래커 200g', 'url': 'https://link.coupang.com/a/abc123', 'platform': 'coupang', 'note': '당류 0g'},
            {'title': '저당 버터쿠키', 'url': 'https://search.shopping.naver.com/catalog/1', 'platform': 'naver', 'note': ''},
        ],
        'is_active': True,
    },
    {
        'item_no': 20, 'id': 'pocari-sweat', 'name': '포카리스웨트', 'brand': '동아오츠카', 'category': 'drink', 'unit': 'ml',
        'weight': 500, 'kcal': 125, 'sodium': 245, 'sugar': 30, 'fat': 0, 'carbs': 31, 'protein': 0,
        'ingredients': ['정제수', '설탕'],
        'bulk': [{'kind': 'water', 'label': '정제수', 'sub': '물', 'share': 1}],
        'note': '이온 음료', 'alt_links': [], 'is_active': True,
    },
]

MOCK_COMMENTS = [
    {'id': 'c-1', 'product_id': 'choco-heim', 'nickname': '수진', 'body': '각설탕 6개면 확실히 많네요.',
     'user_id': 'u2', 'created_at': '2026-11-27T08:00:00+00:00'},
    {'id': 'c-2', 'product_id': 'banana-kick', 'nickname': '민호', 'body': '바나나킥 당류가 이렇게 높았어요?',
     'user_id': 'u3', 'created_at': '2026-11-26T10:00:00+00:00'},
]

MOCK_FEEDBACK = [
    {'id': 'f-1', 'category': 'new_product', 'title': '저당 그래놀라 추가해 주세요', 'body': '아이 간식으로 찾고 있어요.',
     'nickname': '수진', 'status': 'open', 'created_at': '2026-11-27T07:00:00+00:00'},
    {'id': 'f-2', 'category': 'fix_info', 'title': '쵸코하임 당류 수치 제보', 'body': '봉지에는 17g으로 나옵니다.',
     'nickname': '익명', 'status': 'done', 'created_at': '2026-11-26T06:00:00+00:00'},
]


def echo_product(body, fallback_item_no=35):
    row = dict(body or {})
    base = next((p for p in MOCK_PRODUCTS if p['id'] == row.get('id')), None)
    merged = {**MOCK_PRODUCTS[0], **row} if base is None else {**base, **row}
    merged.setdefault('item_no', row.get('item_no', fallback_item_no))
    merged['id'] = merged.get('id') or 'new-item'
    merged.setdefault('alt_links', [])
    return merged


CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
}


def fulfill(route, status, body):
    route.fulfill(status=status, content_type='application/json', headers=CORS, body=body)


def mock_supabase(route):
    req = route.request
    url = req.url
    method = req.method
    if method == 'OPTIONS':
        fulfill(route, 204, '')
        return
    body = None
    if req.post_data:
        try:
            body = json.loads(req.post_data)
        except Exception:
            body = req.post_data
    captured.append({'method': method, 'url': url, 'body': body, 'headers': dict(req.headers)})

    if 'rpc/tb_is_admin' in url:
        fulfill(route, 200, 'true')
        return
    if '/tumyeongbongji_products' in url:
        if method == 'GET':
            fulfill(route, 200, json.dumps(MOCK_PRODUCTS))
            return
        if method == 'POST':
            fulfill(route, 201, json.dumps([echo_product(body)]))
            return
        if method == 'PATCH':
            fulfill(route, 200, json.dumps([echo_product(body)]))
            return
        if method == 'DELETE':
            item_no = parse_qs(urlparse(url).query).get('item_no', [''])[0].replace('eq.', '')
            fulfill(route, 200, json.dumps([{'item_no': int(item_no or 0), 'id': 'x'}]))
            return
    if '/tumyeongbongji_profiles' in url:
        fulfill(route, 200, json.dumps([{'user_id': USER_ID, 'nickname': '관리자', 'provider': 'google'}]))
        return
    if '/tumyeongbongji_comments' in url:
        if method == 'DELETE':
            cid = parse_qs(urlparse(url).query).get('id', [''])[0].replace('eq.', '')
            fulfill(route, 200, json.dumps([{'id': cid}]))
            return
        fulfill(route, 200, json.dumps(MOCK_COMMENTS))
        return
    if '/tumyeongbongji_feedback' in url:
        if method == 'PATCH':
            bid = parse_qs(urlparse(url).query).get('id', [''])[0].replace('eq.', '')
            fulfill(route, 200, json.dumps([{'id': bid, 'status': (body or {}).get('status')}]))
            return
        if method == 'DELETE':
            bid = parse_qs(urlparse(url).query).get('id', [''])[0].replace('eq.', '')
            fulfill(route, 200, json.dumps([{'id': bid}]))
            return
        fulfill(route, 200, json.dumps(MOCK_FEEDBACK))
        return
    route.continue_()


def overflow(page):
    return page.evaluate('document.documentElement.scrollWidth - window.innerWidth')


def console_hook(page):
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])

    # ── 1) 390×844 일반 사용자 (실제 DB) ────────────────
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True,
                              has_touch=True, locale='ko-KR', user_agent=IPHONE_UA)
    page = ctx.new_page()
    console_hook(page)
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(500)

    count = page.evaluate("() => document.querySelectorAll('.feed .item').length")
    check('홈: 아이템 목록이 보인다', count >= 20, f'{count}개')
    report['results']['home_count'] = count
    nos = page.evaluate("() => [...document.querySelectorAll('.feed .item .item-no')].map(e => e.textContent.trim())")
    check('홈: 아이템 번호(#001) 미노출', len(nos) == 0, nos[:3])
    check('홈: 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    font = page.evaluate('() => ({ body: getComputedStyle(document.body).fontFamily, paperlogy: document.fonts.check(`16px "Paperlogy"`) })')
    report['results']['font'] = font
    check('Paperlogy 폰트: body에 적용', 'Paperlogy' in font['body'], font['body'][:60])
    check('Paperlogy 폰트: 실제 로드됨(document.fonts)', font['paperlogy'] is True, font['paperlogy'])

    page.fill('#q', '#004')
    page.wait_for_timeout(250)
    hits = page.evaluate("() => [...document.querySelectorAll('.feed .item b')].map(e => e.textContent.trim())")
    check('홈: 번호(#004) 검색은 더 이상 결과를 내지 않는다', hits == [], hits)
    page.fill('#q', '쵸코')
    page.wait_for_timeout(250)
    hits = page.evaluate("() => [...document.querySelectorAll('.feed .item b')].map(e => e.textContent.trim())")
    check('홈: 이름(쵸코) 검색은 그대로 동작', any('쵸코' in h for h in hits), hits)
    page.fill('#q', '')
    page.wait_for_timeout(200)

    page.goto(f'{BASE}#/p/choco-heim', wait_until='networkidle')
    page.wait_for_timeout(400)
    detail_no = page.locator('.topbar .item-no').inner_text() if page.locator('.topbar .item-no').count() else ''
    check('상세: 아이템 번호 미노출', detail_no.strip() == '', detail_no)
    panel_text = page.locator('#alt-body').inner_text()
    check('상세: 링크 없는 제품은 기존 준비 중 안내', '준비 중' in panel_text, panel_text[-60:])
    alt_vals = page.evaluate("() => [...document.querySelectorAll('.alt-row .alt-val em')].map(e => e.textContent.trim())")
    check('상세: 대체 간식 나트륨 표기가 나트륨 Xmg',
          bool(alt_vals) and all(v.startswith('나트륨 ') for v in alt_vals), alt_vals[:3])
    page.screenshot(path=str(OUT / f'admin-01-detail-itemno-hidden-390.png'))
    check('상세 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    page.goto(f'{BASE}#/admin', wait_until='networkidle')
    page.wait_for_timeout(400)
    gate = page.locator('.admin-gate')
    gate_text = gate.inner_text() if gate.count() else ''
    check('비관리자: #/admin 차단 화면', gate.count() == 1 and ADMIN_EMAIL in gate_text, gate_text[:80].replace('\n', ' '))
    check('비관리자: 로그인·홈 버튼 제공',
          page.locator('#gate-login').count() == 1 and page.locator('#gate-home').count() == 1)
    page.screenshot(path=str(OUT / f'admin-02-gate-390.png'))
    check('차단 화면 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    ctx.close()

    # ── 2) 390×844 관리자 (세션 주입 + 응답 목) ─────────────────
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True,
                              has_touch=True, locale='ko-KR', user_agent=IPHONE_UA)
    ctx.add_init_script("localStorage.setItem('tb-auth-session', %s)" % json.dumps(json.dumps(SESSION)))
    ctx.route('**/rest/v1/**', mock_supabase)
    page = ctx.new_page()
    console_hook(page)
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(500)

    check('관리자: 헤더에 어드민 버튼', page.locator('.admin-link').count() == 1)
    page.locator('.auth-chip').click()
    page.wait_for_selector('.sheet', state='visible')
    check('관리자: 프로필 시트에 어드민 관리 버튼', page.locator('.sheet-admin').count() == 1)
    page.screenshot(path=str(OUT / f'admin-03-profile-sheet-390.png'))
    page.locator('.sheet-admin').click()
    page.wait_for_timeout(500)

    check('관리자: #/admin 진입', page.url.endswith('#/admin'), page.url)
    tabs = page.locator('.admin-tab')
    check('관리자: 탭 3개', tabs.count() == 3, [tabs.nth(i).inner_text() for i in range(tabs.count())])
    rows = page.locator('.admin-row')
    check('아이템 탭: 목록 렌더', rows.count() == len(MOCK_PRODUCTS), rows.count())
    row_text = rows.nth(0).inner_text()
    check('아이템 탭: 번호·이름·성분 요약', '#001' in row_text and '바나나킥' in row_text, row_text.replace('\n', ' '))
    page.screenshot(path=str(OUT / f'admin-04-items-390.png'))
    check('아이템 탭 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    page.fill('#admin-q', '#004')
    page.wait_for_timeout(250)
    check('아이템 탭: 번호 검색', page.locator('.admin-row').count() == 1, page.locator('.admin-row').count())
    page.fill('#admin-q', '')
    page.wait_for_timeout(200)

    page.locator('.admin-row', has_text='쵸코하임').locator('[data-edit]').click()
    page.wait_for_timeout(300)
    check('수정 폼: 아이템 번호·제품명 채워짐',
          page.input_value('#f-itemno') == '4' and page.input_value('#f-name') == '쵸코하임')
    alt_rows = page.locator('#alt-edit-list .alt-edit-row')
    check('수정 폼: 기존 대체상품 링크 2개', alt_rows.count() == 2, alt_rows.count())
    check('수정 폼: 플랫폼 선택(쿠팡) 유지',
          alt_rows.nth(0).locator('.alt-platform').input_value() == 'coupang')
    page.screenshot(path=str(OUT / f'admin-05-edit-form-390.png'))

    alt_rows.nth(0).locator('.alt-url').fill('javascript:alert(1)')
    page.locator('#admin-save').click()
    page.wait_for_timeout(300)
    err_text = page.locator('[data-err="altLinks"]').inner_text() if page.locator('[data-err="altLinks"]').count() else ''
    check('수정 폼: javascript: 링크는 저장 거부', 'http' in err_text, err_text)
    check('수정 폼: 거부 시 PATCH 요청 없음',
          not any(c['method'] == 'PATCH' and '/products' in c['url'] for c in captured))

    alt_rows.nth(0).locator('.alt-url').fill('https://link.coupang.com/a/newlink')
    page.locator('#alt-add').click()
    page.wait_for_timeout(200)
    new_row = page.locator('#alt-edit-list .alt-edit-row').nth(2)
    new_row.locator('.alt-title').fill('저당 그래놀라 300g')
    new_row.locator('.alt-platform').select_option('naver')
    new_row.locator('.alt-url').fill('https://search.shopping.naver.com/catalog/99')
    new_row.locator('.alt-note').fill('당류 3g')
    page.locator('#f-note').fill('얇은 웨이퍼 사이 헤이즐넛 크림')
    page.locator('#admin-save').click()
    page.wait_for_timeout(600)

    patch = next((c for c in captured if c['method'] == 'PATCH' and '/tumyeongbongji_products' in c['url']), None)
    check('저장: item_no 조건 PATCH', bool(patch) and 'item_no=eq.4' in patch['url'], patch['url'] if patch else 'none')
    sent_links = (patch or {}).get('body', {}).get('alt_links') if patch else None
    check('저장: alt_links 3개(플랫폼·메모 포함) 전송',
          isinstance(sent_links, list) and len(sent_links) == 3 and sent_links[2]['platform'] == 'naver'
          and sent_links[2]['note'] == '당류 3g', json.dumps(sent_links, ensure_ascii=False)[:160])
    check('저장: Authorization 토큰 실림',
          bool(patch) and patch['headers'].get('authorization', '').startswith('Bearer '),
          patch['headers'].get('authorization') if patch else '')
    page.wait_for_timeout(400)
    check('저장 후 목록으로 복귀', page.locator('.admin-list').count() == 1)

    page.locator('#admin-new').click()
    page.wait_for_timeout(300)
    check('새 아이템 폼: 다음 번호 자동', page.input_value('#f-itemno') == '21', page.input_value('#f-itemno'))
    page.fill('#f-name', '저당 그래놀라')
    page.fill('#f-brand', '테스트')
    page.fill('#f-weight', '300')
    page.fill('#f-kcal', '420')
    page.fill('#f-sodium', '120')
    page.fill('#f-sugar', '3')
    page.fill('#f-fat', '12')
    page.fill('#f-ingredients', '귀리, 아몬드, 꿀')
    page.locator('#alt-add').click()
    page.wait_for_timeout(150)
    row0 = page.locator('#alt-edit-list .alt-edit-row').nth(0)
    row0.locator('.alt-title').fill('쿠팡 저당 그래놀라')
    row0.locator('.alt-url').fill('https://link.coupang.com/a/granola')
    page.locator('#admin-save').click()
    page.wait_for_timeout(600)
    post = next((c for c in captured if c['method'] == 'POST' and '/tumyeongbongji_products' in c['url']), None)
    check('새 아이템: POST로 추가', bool(post), post['url'] if post else 'none')
    if post:
        b = post['body']
        check('새 아이템: 이름·번호·링크 전송',
              b.get('name') == '저당 그래놀라' and b.get('item_no') == 21 and len(b.get('alt_links', [])) == 1,
              json.dumps({k: b.get(k) for k in ('name', 'item_no', 'alt_links')}, ensure_ascii=False)[:160])

    page.locator('.admin-tab', has_text='댓글').click()
    page.wait_for_timeout(600)
    comments = page.locator('.admin-comment')
    check('댓글 탭: 전체 댓글 목록', comments.count() == 2, comments.count())
    c_text = comments.nth(0).inner_text()
    check('댓글 탭: 제품명·작성자·내용',
          '쵸코하임' in c_text and '수진' in c_text and '각설탕' in c_text, c_text.replace('\n', ' ')[:80])
    page.screenshot(path=str(OUT / f'admin-06-comments-390.png'))
    page.once('dialog', lambda d: d.accept())
    comments.nth(0).locator('[data-del-comment]').click()
    page.wait_for_timeout(500)
    dele = next((c for c in captured if c['method'] == 'DELETE' and 'tumyeongbongji_comments' in c['url']), None)
    check('댓글 탭: 삭제 요청', bool(dele) and 'id=eq.c-1' in dele['url'], dele['url'] if dele else 'none')
    check('댓글 탭: 삭제 후 1개', page.locator('.admin-comment').count() == 1, page.locator('.admin-comment').count())

    page.locator('.admin-tab', has_text='제안·제보').click()
    page.wait_for_timeout(600)
    fbs = page.locator('.admin-fb')
    check('제보 탭: 목록', fbs.count() == 2, fbs.count())
    check('제보 탭: 대기/완료 배지', '대기' in fbs.nth(0).inner_text() and '완료' in fbs.nth(1).inner_text())
    page.screenshot(path=str(OUT / f'admin-07-feedback-390.png'))
    fbs.nth(0).locator('[data-toggle-fb]').click()
    page.wait_for_timeout(500)
    patch_fb = next((c for c in captured if c['method'] == 'PATCH' and 'tumyeongbongji_feedback' in c['url']), None)
    check('제보 탭: 상태 변경 PATCH status=done',
          bool(patch_fb) and patch_fb['body'].get('status') == 'done', patch_fb['body'] if patch_fb else 'none')
    page.once('dialog', lambda d: d.accept())
    page.locator('.admin-fb').nth(0).locator('[data-del-fb]').click()
    page.wait_for_timeout(500)
    check('제보 탭: 삭제', any(c['method'] == 'DELETE' and 'tumyeongbongji_feedback' in c['url'] for c in captured))
    check('제보 탭 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    page.goto(f'{BASE}#/p/choco-heim', wait_until='networkidle')
    page.wait_for_timeout(500)
    links = page.locator('.alt-link')
    check('상세: 대체상품 링크 카드 렌더', links.count() == 2, links.count())
    if links.count():
        attrs = links.nth(0).evaluate(
            "el => ({href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel')})")
        check('상세: 새 탭 + noopener noreferrer',
              attrs['target'] == '_blank' and 'noopener' in attrs['rel'] and 'noreferrer' in attrs['rel'], attrs)
        check('상세: 쿠팡 플랫폼 라벨', '쿠팡' in links.nth(0).inner_text())
    note = page.locator('.alt-links-note').inner_text()
    check('상세: 제휴 링크 안내 문구', '제휴' in note, note)
    page.screenshot(path=str(OUT / f'admin-08-detail-alts-390.png'))
    check('상세 390 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')

    font_requests = []
    page.on('request', lambda r: font_requests.append(r.url)
            if '/fonts/Paperlogy-' in r.url or 'fonts.googleapis.com' in r.url or 'fonts.gstatic.com' in r.url else None)
    try:
        with page.expect_download(timeout=15000) as dl:
            page.locator('#save').click()
        download = dl.value
        check('PNG 내보내기: 파일 생성', download.suggested_filename.endswith('.png'), download.suggested_filename)
        page.wait_for_timeout(800)
        local_fonts = [u for u in font_requests if '/fonts/Paperlogy-' in u]
        check('PNG 내보내기: 저장소 폰트(fonts/Paperlogy-*) 요청', len(local_fonts) >= 1,
              (local_fonts[0].rsplit('/', 1)[-1] if local_fonts else 'none'))
        check('PNG 내보내기: 외부(구글) 폰트 요청 없음',
              not any('fonts.googleapis.com' in u or 'fonts.gstatic.com' in u for u in font_requests),
              len(font_requests))
    except Exception as err:  # noqa: BLE001
        check('PNG 내보내기: 파일 생성', False, str(err)[:120])

    ctx.close()

    # ── 3) 데스크톱 ────────────────────────────────────────────
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='ko-KR')
    ctx.add_init_script("localStorage.setItem('tb-auth-session', %s)" % json.dumps(json.dumps(SESSION)))
    ctx.route('**/rest/v1/**', mock_supabase)
    page = ctx.new_page()
    console_hook(page)
    page.goto(f'{BASE}#/admin', wait_until='networkidle')
    page.wait_for_timeout(700)
    width = page.evaluate("() => Math.round(document.querySelector('.app').getBoundingClientRect().width)")
    check('데스크톱: 어드민 화면이 넓게(>430px) 쓰인다', width > 430, f'{width}px')
    check('데스크톱: 3개 탭·목록 렌더',
          page.locator('.admin-tab').count() == 3 and page.locator('.admin-row').count() >= 3)
    check('데스크톱 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    page.screenshot(path=str(OUT / f'admin-09-items-desktop.png'))
    page.goto(f'{BASE}#/p/choco-heim', wait_until='networkidle')
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f'admin-10-detail-desktop.png'))
    check('데스크톱 상세 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    ctx.close()
    browser.close()

check('콘솔 오류 0', len(report['console']) == 0, report['console'][:3])
check('페이지 오류 0', len(report['pageerrors']) == 0, report['pageerrors'][:3])

errors = [c for c in report['checks'] if not c['ok']]
report['results']['checks'] = report['checks']
report['results']['passed'] = len(report['checks']) - len(errors)
report['results']['failed'] = len(errors)
report['results']['console'] = report['console']
report['results']['pageerrors'] = report['pageerrors']
out = OUT / f'admin-{TAG}-report.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'\n{len(report["checks"]) - len(errors)}/{len(report["checks"])} 통과 · report {out}')
sys.exit(0 if not errors else 1)

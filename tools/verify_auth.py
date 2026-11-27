"""속보이네 소셜 로그인·기명 댓글 검증 (로컬/라이브 공용).

  python3 tools/verify_auth.py [base_url] [tag]
  (기본: https://sokboyne.vercel.app/ live)

확인하는 것
- 홈 상단 [로그인] 버튼, 390px 가로 넘침 0
- 로그인 시트: 카카오/구글/애플 3종 버튼 + 색상 + 실제 authorize URL(PKCE) 생성
- 제품 상세 비로그인: 댓글 목록은 보이고, 입력 폼 대신 로그인 안내
- 로그인 상태(세션 주입 + Supabase 응답 목): 닉네임 칩, 내 이름 표시, 기명 등록(Authorization 헤더·user_id),
  내 댓글 [삭제], 프로필 시트(닉네임 변경·로그아웃)
- 390×844 / 데스크톱, 콘솔·페이지 오류 0
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
DETAIL = '#/p/choco-heim'
USER_ID = 'test-user-1'
SESSION = {
    'accessToken': 'test-access-token',
    'refreshToken': 'test-refresh-token',
    'expiresAt': 4102444800,  # 2100-01-01
    'tokenType': 'bearer',
    'provider': 'kakao',
    'user': {
        'id': USER_ID,
        'email': 'sujin@example.com',
        'user_metadata': {'full_name': '테스트수진'},
        'app_metadata': {'provider': 'kakao'},
    },
}

report = {
    'base': BASE,
    'tag': TAG,
    'checks': [],
    'console': [],
    'pageerrors': [],
    'requests_failed': [],
    'oauth': {},
}
created = []
deleted = []


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def mock_supabase(route):
    """로그인 상태 화면 검증용 Supabase 응답 목 (실제 DB는 건드리지 않는다)."""
    req = route.request
    url = req.url
    if '/tumyeongbongji_profiles' in url:
        if req.method == 'PATCH':
            body = json.loads(req.post_data or '{}')
            route.fulfill(
                status=200,
                content_type='application/json',
                body=json.dumps([{'user_id': USER_ID, 'nickname': body.get('nickname', '수진'), 'provider': 'kakao'}]),
            )
            return
        route.fulfill(
            status=200,
            content_type='application/json',
            body=json.dumps([{'user_id': USER_ID, 'nickname': '수진', 'provider': 'kakao'}]),
        )
        return
    if '/tumyeongbongji_comments' in url:
        if req.method == 'POST':
            body = json.loads(req.post_data or '{}')
            created.append({'headers': dict(req.headers), 'body': body})
            route.fulfill(
                status=201,
                content_type='application/json',
                body=json.dumps(
                    [
                        {
                            'id': 'new-comment',
                            'product_id': body.get('product_id'),
                            'nickname': body.get('nickname'),
                            'body': body.get('body'),
                            'user_id': body.get('user_id'),
                            'created_at': '2026-11-27T09:00:00+00:00',
                        }
                    ]
                ),
            )
            return
        if req.method == 'DELETE':
            cid = parse_qs(urlparse(url).query).get('id', [''])[0].replace('eq.', '')
            deleted.append({'id': cid, 'headers': dict(req.headers)})
            route.fulfill(status=200, content_type='application/json', body=json.dumps([{'id': cid}]))
            return
        route.fulfill(
            status=200,
            content_type='application/json',
            body=json.dumps(
                [
                    {
                        'id': 'c-other',
                        'product_id': 'choco-heim',
                        'nickname': '다른사람',
                        'body': '저는 초코하임 좋아해요.',
                        'user_id': 'other-user',
                        'created_at': '2026-11-26T09:00:00+00:00',
                    },
                    {
                        'id': 'c-mine',
                        'product_id': 'choco-heim',
                        'nickname': '수진',
                        'body': '각설탕 6개면 확실히 많네요.',
                        'user_id': USER_ID,
                        'created_at': '2026-11-27T08:00:00+00:00',
                    },
                ]
            ),
        )
        return
    route.continue_()


def overflow(page):
    return page.evaluate('document.documentElement.scrollWidth - window.innerWidth')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])

    # ── 1) 390×844 비로그인 ──────────────────────────────
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

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(400)
    chip = page.locator('.auth-chip')
    check('홈 상단 로그인 버튼이 보인다', chip.is_visible() and chip.inner_text().strip() == '로그인', chip.inner_text() if chip.count() else '')
    check('390 홈 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    bar = page.evaluate(
        """() => {
          const r = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect();
            return { x: Math.round(b.x), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
          return { brand: r('.brand'), board: r('.board-link'), chip: r('.auth-chip'), vw: window.innerWidth };
        }"""
    )
    ok_bar = all(v is not None for v in [bar['brand'], bar['board'], bar['chip']]) and bar['chip']['right'] <= bar['vw']
    check('상단 바: 브랜드·제안·제보·로그인 칩이 겹치지 않고 한 줄', ok_bar, json.dumps(bar, ensure_ascii=False))

    # 로그인 시트
    chip.click()
    page.wait_for_selector('.sheet', state='visible')
    page.wait_for_timeout(250)
    providers = page.locator('.provider')
    check('로그인 시트: 소셜 로그인 3종 버튼', providers.count() == 3, providers.count())
    labels = [providers.nth(i).inner_text().strip() for i in range(providers.count())]
    check('로그인 시트: 카카오·구글·애플 문구', all(any(k in t for t in labels) for k in ['카카오', '구글', '애플']), labels)
    colors = page.evaluate(
        """() => Object.fromEntries(['kakao','google','apple'].map((k) => {
             const el = document.querySelector('.provider.' + k);
             return [k, el ? getComputedStyle(el).backgroundColor : 'none'];
           }))"""
    )
    check('로그인 버튼 색: 카카오 #FEE500 / 구글 흰색 / 애플 검정',
          colors.get('kakao') == 'rgb(254, 229, 0)' and colors.get('google') == 'rgb(255, 255, 255)' and colors.get('apple') == 'rgb(0, 0, 0)',
          colors)
    note = page.locator('.sheet-note').inner_text()
    check('로그인 시트 안내 문구', '기명 댓글' in note and '로그인 없이' in note, note[:60])
    page.screenshot(path=str(OUT / f'auth-login-modal-390.png'))
    check('390 로그인 시트 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    check('Escape로 로그인 시트가 닫힌다', page.locator('.sheet').count() == 0)

    # 실제 OAuth 이동 URL(카카오·구글·애플) — 이동 직전 요청을 가로채 확인
    for provider in ['kakao', 'google', 'apple']:
        page2 = ctx.new_page()
        captured = {}

        def grab(route, provider=provider, captured=captured):
            captured['url'] = route.request.url
            captured['headers'] = dict(route.request.headers)
            route.fulfill(status=200, content_type='text/html', body='<html><body>oauth-route-blocked</body></html>')

        page2.route('**/auth/v1/authorize**', grab)
        page2.goto(f'{BASE}', wait_until='networkidle')
        page2.locator('.auth-chip').click()
        page2.locator(f'.provider.{provider}').click()
        page2.wait_for_timeout(800)
        url = captured.get('url', '')
        q = parse_qs(urlparse(url).query) if url else {}
        # verifier는 우리 사이트 오리진의 localStorage에 남으므로, 그 화면(page)에서 읽는다
        stored = page.evaluate(
            """() => ({ verifier: localStorage.getItem('tb-auth-verifier'), ret: localStorage.getItem('tb-auth-return') })"""
        )
        ok = (
            '/auth/v1/authorize' in url
            and q.get('provider') == [provider]
            and q.get('code_challenge_method') == ['s256']
            and q.get('flow_type') == ['pkce']
            and len(q.get('code_challenge', [''])[0]) >= 40
            and q.get('redirect_to', [''])[0].startswith('http')
            and bool(stored.get('verifier'))
        )
        report['oauth'][provider] = {
            'url': url,
            'params': {k: v[0] if v else '' for k, v in q.items()},
            'verifier_len': len(stored.get('verifier') or ''),
            'return_to': stored.get('ret'),
        }
        check(f'{provider} 로그인: PKCE authorize URL 생성', ok, (url[:120] + '…') if url else 'no request')
        page2.close()

    # 비로그인 상세
    page.goto(f'{BASE}{DETAIL}', wait_until='networkidle')
    page.wait_for_timeout(500)
    try:
        page.wait_for_selector('#comment-list .comment, #comment-list .comment-empty', timeout=15000)
    except Exception:
        pass
    check('비로그인 상세: 댓글 목록은 읽힌다', page.locator('#comment-list .comment, #comment-list .comment-empty').count() >= 1,
          page.locator('#comment-list .comment').count())
    gate = page.locator('.comment-gate')
    check('비로그인 상세: 로그인 안내', gate.is_visible() and '로그인이 필요해요' in gate.inner_text(), gate.inner_text().replace('\n', ' ')[:60])
    check('비로그인 상세: 댓글 입력 폼이 없고 로그인 버튼만', page.locator('#cm-body').count() == 0 and page.locator('#comment-login').is_visible())
    page.locator('#comments').scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / f'auth-detail-comments-390.png'))
    check('390 비로그인 상세 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    # 안내의 로그인 버튼 → 시트
    page.locator('#comment-login').click()
    page.wait_for_selector('.sheet', state='visible')
    check('비로그인 안내의 버튼이 로그인 시트를 연다', page.locator('.provider').count() == 3)
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    check('Escape로 로그인 시트가 닫힌다', page.locator('.sheet').count() == 0)

    # 게시판(상단 바 제목 flex 변경 회귀 확인)
    page.goto(f'{BASE}#/board', wait_until='networkidle')
    try:
        page.wait_for_selector('.board-list .post, .board-list .board-state', timeout=15000)
    except Exception:
        pass
    check(
        '게시판: 제목·글이 정상 표시',
        page.locator('.topbar .title').inner_text().strip() == '제안·제보' and page.locator('.board-list li').count() >= 1,
        page.locator('.board-list li').count(),
    )
    check('390 게시판 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    ctx.close()

    # ── 2) 로그인 상태(목 응답) ─────────────────────────
    ctx2 = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
    )
    ctx2.add_init_script(
        "localStorage.setItem('tb-auth-session', %s);" % json.dumps(json.dumps(SESSION))
    )
    ctx2.route('**/rest/v1/tumyeongbongji_*', mock_supabase)
    page = ctx2.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))

    page.goto(f'{BASE}{DETAIL}', wait_until='networkidle')
    page.wait_for_timeout(600)
    chip = page.locator('.auth-chip')
    check('로그인 상태: 상단 칩이 내 닉네임', chip.is_visible() and chip.inner_text().strip() == '수진', chip.inner_text())
    note = page.locator('.comment-me').inner_text().replace('\n', ' ')
    check('로그인 상태: 내 이름으로 남는다는 안내 + 닉네임 변경', '수진' in note and page.locator('#nick-edit').is_visible(), note[:70])
    check('로그인 상태: 댓글 입력 폼이 보인다', page.locator('#cm-body').is_visible())
    check('로그인 상태: 입력칸에 작성자 이름을 따로 받지 않는다', page.locator('#cm-nick').count() == 0)
    check('내 댓글에만 삭제 버튼', page.locator('.comment-del').count() == 1, page.locator('.comment-del').count())
    page.locator('#comments').scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / f'auth-signed-in-comments-390.png'))

    # 기명 댓글 등록
    page.locator('#cm-body').fill('댓글도 기명으로 남겨 봅니다.')
    page.locator('#cm-submit').click()
    page.wait_for_timeout(900)
    check('기명 댓글 등록 요청 1건', len(created) == 1, len(created))
    if created:
        body = created[0]['body']
        hdr = created[0]['headers']
        auth_hdr = next((v for k, v in hdr.items() if k.lower() == 'authorization'), '')
        check('등록 요청: 사용자 토큰(Bearer)으로 전송', auth_hdr == f'Bearer {SESSION["accessToken"]}', auth_hdr)
        check('등록 요청: user_id·닉네임·본문', body.get('user_id') == USER_ID and body.get('nickname') == '수진', body)
    check('등록 후 목록에 새 댓글', '기명으로 남겨 봅니다' in page.locator('#comment-list').inner_text())

    # 내 댓글 삭제
    page.locator('.comment-del').first.click()
    page.wait_for_timeout(800)
    check('삭제 요청: DELETE + 사용자 토큰', len(deleted) == 1 and deleted[0]['headers'].get('authorization') == f'Bearer {SESSION["accessToken"]}', deleted[:1])
    check('삭제 후 목록에서 사라짐', '각설탕 6개면' not in page.locator('#comment-list').inner_text())

    # 프로필 시트: 닉네임 변경·로그아웃
    page.locator('.auth-chip').click()
    page.wait_for_selector('.sheet', state='visible')
    page.wait_for_timeout(250)
    nick_input = page.locator('#nick-input')
    check('프로필 시트: 닉네임이 채워져 있다', nick_input.input_value() == '수진', nick_input.input_value())
    check('프로필 시트: 로그아웃 버튼', page.locator('#signout').is_visible())
    page.screenshot(path=str(OUT / f'auth-profile-sheet-390.png'))
    nick_input.fill('')
    page.locator('#nick-save').click()
    page.wait_for_timeout(200)
    check('닉네임 1자 미만은 저장되지 않는다', page.locator('#nick-error').is_visible(), page.locator('#nick-error').inner_text())
    nick_input.fill('수진2')
    page.locator('#nick-save').click()
    page.wait_for_timeout(700)
    check('닉네임 변경 → 상단 칩 갱신', page.locator('.auth-chip').inner_text().strip() == '수진2', page.locator('.auth-chip').inner_text())
    check('390 로그인 상태 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    ctx2.close()

    # ── 4) OAuth 콜백 복귀(?code= → 토큰 교환 → 원래 화면) ─────
    ctx4 = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='ko-KR',
        user_agent=IPHONE_UA,
    )
    ctx4.add_init_script(
        "localStorage.setItem('tb-auth-verifier', 'verifier-abc');"
        "localStorage.setItem('tb-auth-return', '#/p/choco-heim');"
    )
    exchange = {}

    def mock_callback(route):
        req = route.request
        if '/auth/v1/token' in req.url:
            exchange['url'] = req.url
            exchange['body'] = json.loads(req.post_data or '{}')
            route.fulfill(
                status=200,
                content_type='application/json',
                body=json.dumps(
                    {
                        'access_token': 'cb-access',
                        'refresh_token': 'cb-refresh',
                        'expires_in': 3600,
                        'token_type': 'bearer',
                        'user': {
                            'id': 'cb-user-1',
                            'email': 'return@example.com',
                            'user_metadata': {'full_name': '복귀수진'},
                            'app_metadata': {'provider': 'google'},
                        },
                    }
                ),
            )
            return
        if '/tumyeongbongji_profiles' in req.url and req.method == 'POST':
            body = json.loads(req.post_data or '{}')
            route.fulfill(
                status=201,
                content_type='application/json',
                body=json.dumps([{'user_id': 'cb-user-1', 'nickname': body.get('nickname'), 'provider': 'google'}]),
            )
            return
        if '/tumyeongbongji_profiles' in req.url:
            route.fulfill(status=200, content_type='application/json', body='[]')
            return
        route.fulfill(status=200, content_type='application/json', body='[]')

    ctx4.route('**/rest/v1/tumyeongbongji_*', mock_callback)
    ctx4.route('**/auth/v1/token*', mock_callback)
    page = ctx4.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))
    page.goto(f'{BASE}?code=fake-code-123', wait_until='networkidle')
    page.wait_for_timeout(1200)
    check('콜백: auth_code+code_verifier로 토큰 교환',
          exchange.get('body') == {'auth_code': 'fake-code-123', 'code_verifier': 'verifier-abc'}, exchange.get('body'))
    check('콜백: 로그인 전 화면(#/p/choco-heim)으로 복귀', page.url.endswith('#/p/choco-heim') and 'code=' not in page.url, page.url)
    chip = page.locator('.auth-chip')
    check('콜백: 상단 칩이 프로필 닉네임', chip.inner_text().strip() == '복귀수진', chip.inner_text())
    stored = page.evaluate("() => localStorage.getItem('tb-auth-session')")
    check('콜백: 세션 저장(accessToken)', bool(stored) and json.loads(stored)['accessToken'] == 'cb-access', (stored or '')[:40])
    page.screenshot(path=str(OUT / f'auth-callback-restore-390.png'))
    ctx4.close()

    # ── 3) 데스크톱 ─────────────────────────────────────
    ctx3 = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='ko-KR')
    page = ctx3.new_page()
    page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(300)
    check('데스크톱: 로그인 버튼', page.locator('.auth-chip').is_visible())
    check('데스크톱 가로 넘침 0', overflow(page) <= 0, f'{overflow(page)}px')
    page.locator('.auth-chip').click()
    page.wait_for_selector('.sheet', state='visible')
    page.wait_for_timeout(300)
    box = page.locator('.sheet').bounding_box()
    check('데스크톱: 가운데 모달(최대 400px)', bool(box) and box['width'] <= 400, box)
    page.screenshot(path=str(OUT / f'auth-login-modal-desktop.png'))
    ctx3.close()
    browser.close()

summary = {
    'tag': TAG,
    'base': BASE,
    'total': len(report['checks']),
    'passed': sum(1 for c in report['checks'] if c['ok']),
    'failed': [c for c in report['checks'] if not c['ok']],
    'console': report['console'],
    'pageerrors': report['pageerrors'],
    'oauth': report['oauth'],
    'created_request': created[:1],
    'deleted_request': deleted[:1],
}
(OUT / f'auth-report-{TAG}.json').write_text(json.dumps({**summary, 'checks': report['checks']}, ensure_ascii=False, indent=2))
print('\n' + json.dumps({k: summary[k] for k in ['total', 'passed', 'console', 'pageerrors']}, ensure_ascii=False))
for c in summary['failed']:
    print('FAILED:', c['name'], '—', c['detail'])
sys.exit(0 if not summary['failed'] and not summary['pageerrors'] and not summary['console'] else 1)

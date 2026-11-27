"""속보이네 전수 UX 점검 (로컬 · 390×844 iPhone UA + 데스크톱).

게시판·댓글은 Supabase 대신 메모리 저장소로 가로채서(local mock) 화면 동작만 본다.
실제 DB 쓰기는 라이브 검증 스크립트에서 한 번만 한다.

실행:
  LD_LIBRARY_PATH=... python3 tools/audit_ux.py [outdir]
"""
import functools
import json
import sys
import threading
import uuid
from datetime import datetime, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'downloads' / 'audit'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
IPHONE_UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
)
PORT = 4177
BASE = f'http://127.0.0.1:{PORT}/'
KST = timezone(timedelta(hours=9))

report = {'checks': [], 'console': [], 'pageerrors': [], 'requests_failed': [], 'notes': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


now = datetime.now(KST)


def iso(minutes_ago):
    return (now - timedelta(minutes=minutes_ago)).astimezone(timezone.utc).isoformat()


TABLE_MAP = {'tumyeongbongji_feedback': 'feedback', 'tumyeongbongji_comments': 'comments'}

store = {
    'feedback': [
        {
            'id': str(uuid.uuid4()),
            'category': 'new_product',
            'title': '오리온 초코파이도 추가해 주세요',
            'body': '편의점에서 파는 초코파이 영양성분도 보고 싶어요.',
            'nickname': '과자러버',
            'status': 'open',
            'created_at': iso(5),
        },
        {
            'id': str(uuid.uuid4()),
            'category': 'fix_info',
            'title': '쵸코하임 나트륨 표기가 달라요',
            'body': '봉지에는 1회 제공량 기준으로 적혀 있어서 헷갈려요.',
            'nickname': '익명',
            'status': 'done',
            'created_at': iso(180),
        },
        {
            'id': str(uuid.uuid4()),
            'category': 'feature',
            'title': '검색에 초성 검색도 되면 좋겠어요',
            'body': 'ㅂㄴㄴ 치면 바나나킥이 나오는 식으로요.',
            'nickname': '초성맨',
            'status': 'open',
            'created_at': iso(60 * 30),
        },
    ],
    'comments': [
        {
            'id': str(uuid.uuid4()),
            'product_id': 'choco-heim',
            'nickname': '달콤이',
            'body': '각설탕 5개면 생각보다 많네요.',
            'created_at': iso(120),
        },
        {
            'id': str(uuid.uuid4()),
            'product_id': 'choco-heim',
            'nickname': '익명',
            'body': '커피랑 같이 먹으면 딱이에요.',
            'created_at': iso(20),
        },
    ],
}
fail_mode = {'on': False}


def handle_api(route, request):
    from urllib.parse import urlparse, parse_qs

    if fail_mode['on']:
        route.fulfill(status=500, body=json.dumps({'message': 'boom'}), headers={'content-type': 'application/json'})
        return

    url = urlparse(request.url)
    table = TABLE_MAP.get(url.path.rsplit('/', 1)[-1], url.path.rsplit('/', 1)[-1])
    query = parse_qs(url.query)
    rows = store.setdefault(table, [])

    if request.method == 'POST':
        body = json.loads(request.post_data or '{}')
        row = dict(body)
        row['id'] = str(uuid.uuid4())
        row['created_at'] = datetime.now(timezone.utc).isoformat()
        if table == 'feedback':
            row.setdefault('status', 'open')
        rows.append(row)
        route.fulfill(status=201, body=json.dumps([row]), headers={'content-type': 'application/json'})
        return

    if 'category' in query:
        want = query['category'][0].replace('eq.', '')
        rows = [r for r in rows if r.get('category') == want]
    if 'product_id' in query:
        want = query['product_id'][0].replace('eq.', '')
        rows = [r for r in rows if r.get('product_id') == want]
    order = query.get('order', ['created_at.desc'])[0]
    reverse = 'desc' in order
    rows = sorted(rows, key=lambda r: r.get('created_at', ''), reverse=reverse)
    limit = int(query.get('limit', ['100'])[0])
    rows = rows[:limit]
    route.fulfill(status=200, body=json.dumps(rows), headers={'content-type': 'application/json'})


def main():
    serve()
    clients = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])

        def new_page(width, height, mobile=True):
            ctx = browser.new_context(
                viewport={'width': width, 'height': height},
                device_scale_factor=2 if mobile else 1,
                is_mobile=mobile,
                has_touch=mobile,
                locale='ko-KR',
                user_agent=IPHONE_UA if mobile else None,
                accept_downloads=True,
            )
            page = ctx.new_page()
            page.on('console', lambda m: report['console'].append(f'{m.type}: {m.text}') if m.type == 'error' else None)
            page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))
            page.on('requestfailed', lambda r: report['requests_failed'].append(f'{r.method} {r.url} {r.failure}'))
            page.route('**/rest/v1/**', handle_api)
            clients[id(page)] = page
            return page

        page = new_page(390, 844)
        page.goto(BASE, wait_until='networkidle')

        # ── 1. 홈 ────────────────────────────────────────────────
        page.screenshot(path=str(OUT / '01-home-390x844.png'), full_page=False)
        report['notes'].append(
            'header: ' + json.dumps(page.evaluate("""() => {
                const b = document.querySelector('.brand').getBoundingClientRect();
                const l = document.querySelector('.board-link').getBoundingClientRect();
                const h1 = document.querySelector('.brand h1').getBoundingClientRect();
                return {brandRight: Math.round(b.right), linkLeft: Math.round(l.left), linkRight: Math.round(l.right),
                        linkH: Math.round(l.height), h1Right: Math.round(h1.right), h1W: Math.round(h1.width),
                        vw: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth};
            }"""))
        )
        head = json.loads(report['notes'][-1].split(': ', 1)[1])
        check('홈: 제안·제보 버튼이 헤더 안에 들어온다', head['linkRight'] <= 390 and head['linkLeft'] >= head['h1Right'], head)
        check('홈: 가로 스크롤 없음', head['overflow'] <= 0, head['overflow'])
        check('홈: 제안·제보 버튼 터치 높이 36px 이상', head['linkH'] >= 36, head['linkH'])
        check('홈: 제품 34개', page.locator('.feed .item').count() == 34, page.locator('.feed .item').count())

        # 검색 (조합 입력 흉내: 한 글자씩)
        q = page.locator('#q')
        q.click()
        q.press_sequentially('바나나', delay=60)
        page.wait_for_timeout(200)
        check('검색: 바나나 → 2건 (바나나킥, 바나나맛우유)', page.locator('.feed .item').count() == 2, page.locator('.feed .item').count())
        check('검색: 입력 중 포커스가 유지된다', page.evaluate("document.activeElement && document.activeElement.id === 'q'"))
        page.screenshot(path=str(OUT / '02-home-search-390x844.png'))
        page.locator('#search-clear').click()
        page.wait_for_timeout(100)
        check('검색: 지우기 버튼이 값을 비운다', page.locator('#q').input_value() == '' and page.locator('.feed .item').count() == 34)
        check('검색: 결과 없음 안내', _search_empty(page))

        # 카테고리
        page.locator('.chip[data-cat="drink"]').click()
        page.wait_for_timeout(100)
        check('카테고리: 음료 9개', page.locator('.feed .item').count() == 9, page.locator('.feed .item').count())
        check('카테고리: 눌린 상태 표시', page.locator('.chip[data-cat="drink"]').get_attribute('aria-pressed') == 'true')
        check('카테고리: 목록 제목은 긴 이름', '음료' in page.locator('.section-head h2').inner_text())
        fit_home = page.evaluate("""() => { const n = document.querySelector('.chips'); return {sw: n.scrollWidth, cw: n.clientWidth}; }""")
        check('홈: 카테고리 칩 다섯 개가 한 줄에 다 보인다', fit_home['sw'] <= fit_home['cw'] + 1, fit_home)
        page.locator('.chip[data-cat="all"]').click()
        page.wait_for_timeout(100)

        # ── 2. 제품 상세 + 댓글 ─────────────────────────────────
        page.goto(BASE + '#/p/choco-heim', wait_until='networkidle')
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / '03-detail-top-390x844.png'))
        page.locator('#comments').scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / '04-detail-comments-390x844.png'))
        check('상세: 카드 SVG 렌더', page.locator('#card-wrap svg').count() == 1)
        spill = page.evaluate("""() => {
            const svg = document.querySelector('#card-wrap svg');
            const right = svg.getBoundingClientRect().right;
            return [...svg.querySelectorAll('text')]
              .filter(t => t.textContent.trim() && t.getBoundingClientRect().right > right - 2)
              .map(t => t.textContent.trim().slice(0, 24));
        }""")
        check('상세: 카드 오른쪽으로 잘리는 글자 없음', len(spill) == 0, spill)
        check('상세: 댓글 2건 표시', page.locator('#comment-list .comment').count() == 2, page.locator('#comment-list .comment').count())
        check('상세: 댓글은 오래된 순', '달콤이' in page.locator('#comment-list .comment').first.inner_text())
        check('상세: 댓글 수 표기', page.locator('#comments-total').inner_text() == '2개', page.locator('#comments-total').inner_text())

        # 댓글 검증
        page.locator('#cm-submit').click()
        page.wait_for_timeout(150)
        check('댓글: 빈 내용이면 안내', page.locator('#cm-error').is_visible(), page.locator('#cm-error').inner_text())
        # XSS 시도
        payload = '<img src=x onerror="window.__xss=1">'
        page.fill('#cm-nick', '<b>공격</b>')
        page.fill('#cm-body', payload)
        page.locator('#cm-submit').click()
        page.wait_for_timeout(500)
        check('댓글: 등록 후 3건', page.locator('#comment-list .comment').count() == 3, page.locator('#comment-list .comment').count())
        check('댓글: XSS 미실행', page.evaluate("window.__xss === undefined"))
        check(
            '댓글: 원문이 글자로만 보인다',
            page.locator('#comment-list .comment').last.locator('img').count() == 0
            and payload in page.locator('#comment-list .comment').last.inner_text(),
        )
        check('댓글: 닉네임도 글자로만', page.locator('#comment-list .comment').last.locator('b').all_inner_texts() == ['<b>공격</b>'])
        page.screenshot(path=str(OUT / '05-detail-comment-posted-390x844.png'))

        # 오류 상태
        fail_mode['on'] = True
        page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
        page.locator('#comments').scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        check('댓글: 서버 오류 시 안내 + 다시 불러오기', '다시 불러오기' in page.locator('#comment-list').inner_text())
        page.screenshot(path=str(OUT / '06-detail-comments-error-390x844.png'))
        fail_mode['on'] = False

        # ── 3. 게시판 ────────────────────────────────────────────
        page.goto(BASE + '#/board', wait_until='networkidle')
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / '07-board-390x844.png'))
        fit = page.evaluate("""() => { const n = document.querySelector('.board-chips'); return {sw: n.scrollWidth, cw: n.clientWidth}; }""")
        check('게시판: 분류 칩 네 개가 한 줄에 다 보인다', fit['sw'] <= fit['cw'] + 1, fit)
        check('게시판: 글 3건', page.locator('#board-list .post').count() == 3, page.locator('#board-list .post').count())
        check('게시판: 최신 글이 맨 위', '초코파이' in page.locator('.post-title').first.inner_text())
        check('게시판: 반영됨 배지', page.locator('.status.done').count() == 1)
        check('게시판: 분류 태그', page.locator('.tag-fix_info, .tag-new_product, .tag-feature').count() == 3)

        # 필터
        page.locator('.chip[data-board-cat="fix_info"]').click()
        page.wait_for_timeout(400)
        check('게시판: 분류 필터 1건', page.locator('#board-list .post').count() == 1, page.locator('#board-list .post').count())
        check('게시판: 필터가 주소에 반영', page.url.endswith('#/board/fix_info'), page.url)
        page.screenshot(path=str(OUT / '08-board-filter-390x844.png'))
        page.locator('.chip[data-board-cat="all"]').click()
        page.wait_for_timeout(400)

        # 글쓰기 폼 검증
        page.locator('#write-toggle').click()
        page.wait_for_timeout(200)
        check('게시판: 글쓰기 폼이 열린다', page.locator('#b-title').is_visible())
        page.locator('#form-submit').click()
        page.wait_for_timeout(200)
        errs = page.locator('.field-error:not([hidden])').all_inner_texts()
        check('게시판: 빈 제출 시 오류 2건(제목·내용)', len(errs) == 2, errs)
        page.screenshot(path=str(OUT / '09-board-form-errors-390x844.png'))

        page.select_option('#b-cat', 'feature')
        page.fill('#b-title', '다크 모드도 있으면 좋겠어요')
        page.fill('#b-body', '밤에 보면 화면이 너무 밝아요.')
        page.fill('#b-nick', '')
        page.wait_for_timeout(100)
        check('게시판: 글자 수 카운터', page.locator('#c-title').inner_text() == '15/80', page.locator('#c-title').inner_text())
        page.locator('#form-submit').click()
        page.wait_for_timeout(700)
        check('게시판: 등록 후 4건', page.locator('#board-list .post').count() == 4, page.locator('#board-list .post').count())
        check('게시판: 새 글이 맨 위', '다크 모드' in page.locator('.post-title').first.inner_text())
        check('게시판: 닉네임 비우면 익명', '익명' in page.locator('.post-meta').first.inner_text())
        check('게시판: 토스트 안내', page.locator('#toast').is_visible() and '접수' in page.locator('#toast').inner_text(), page.locator('#toast').inner_text())
        check('게시판: 등록 후 폼이 닫힌다', page.locator('#b-title').is_hidden())
        page.screenshot(path=str(OUT / '10-board-posted-390x844.png'))

        # XSS 게시글
        page.locator('#write-toggle').click()
        page.select_option('#b-cat', 'fix_info')
        page.fill('#b-title', '<script>window.__boardXss=1</script>제목')
        page.fill('#b-body', '<img src=x onerror="window.__boardXss=2">')
        page.locator('#form-submit').click()
        page.wait_for_timeout(700)
        check('게시판: XSS 미실행', page.evaluate("window.__boardXss === undefined"))
        check(
            '게시판: 제목·내용이 글자로만',
            page.locator('.post').first.locator('script, img').count() == 0,
        )
        page.screenshot(path=str(OUT / '11-board-xss-390x844.png'))

        # 빈 목록
        page.goto(BASE + '#/board/kids_none', wait_until='networkidle')
        page.wait_for_timeout(300)
        # 알 수 없는 분류는 전체로
        check('게시판: 알 수 없는 분류는 전체로', page.locator('#board-list .post').count() >= 1)

        # 서버 오류
        fail_mode['on'] = True
        page.goto(BASE + '#/board', wait_until='networkidle')
        page.wait_for_timeout(600)
        check('게시판: 오류 상태와 재시도 버튼', page.locator('.board-state .retry-btn').count() == 1 or page.locator('.board-banner .banner-retry').count() == 1, page.locator('#board-list').inner_text()[:60])
        page.screenshot(path=str(OUT / '12-board-error-390x844.png'))
        fail_mode['on'] = False
        page.locator('.retry-btn, .banner-retry').first.click()
        page.wait_for_timeout(600)
        check('게시판: 재시도로 복구', page.locator('#board-list .post').count() >= 3, page.locator('#board-list .post').count())

        # 빈 상태
        store['feedback'].clear()
        page.goto(BASE + '#/', wait_until='networkidle')
        page.goto(BASE + '#/board', wait_until='networkidle')
        page.wait_for_timeout(400)
        check('게시판: 빈 상태 안내', '아직 남겨진 글이 없어요' in page.locator('#board-list').inner_text())
        page.screenshot(path=str(OUT / '17-board-empty-390x844.png'))
        page.locator('#write-toggle').click()
        page.wait_for_timeout(250)
        check('게시판: 빈 상태에서 글쓰기 폼이 열린다', page.locator('#b-title').is_visible())

        # 댓글 빈 상태
        store['comments'].clear()
        page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
        page.wait_for_timeout(500)
        check('댓글: 빈 상태 문구', '첫 번째 한마디' in page.locator('#comment-list').inner_text(), page.locator('#comment-list').inner_text())

        # 대체 간식 패널
        page.locator('#alt-toggle').click()
        page.wait_for_timeout(300)
        check('상세: 대체 간식 패널이 열린다', page.locator('#alt-body').is_visible())
        check('상세: 패널 aria-expanded=true', page.locator('#alt-toggle').get_attribute('aria-expanded') == 'true')
        page.screenshot(path=str(OUT / '18-alt-panel-390x844.png'))

        # 닉네임 기억
        page.fill('#cm-nick', '기억된닉')
        page.fill('#cm-body', '닉네임 기억 확인')
        page.locator('#cm-submit').click()
        page.wait_for_timeout(600)
        check('댓글: 닉네임을 기기에 기억', page.evaluate("localStorage.getItem('tb-nickname')") == '기억된닉', page.evaluate("localStorage.getItem('tb-nickname')"))

        # 뒤로가기: 공유 링크로 곧바로 들어온 새 방문에서
        fresh = new_page(390, 844)
        fresh.goto(BASE + '#/board', wait_until='networkidle')
        fresh.wait_for_timeout(300)
        fresh.locator('#back').click()
        fresh.wait_for_timeout(400)
        check('뒤로가기: 앱 밖으로 나가지 않고 홈', fresh.locator('#home-feed').count() == 1, fresh.url)

        # 뒤로가기: 홈 → 상세 → 뒤로
        page.goto(BASE, wait_until='networkidle')
        page.locator('.feed .item').first.click()
        page.wait_for_timeout(400)
        page.locator('#back').click()
        page.wait_for_timeout(400)
        check('뒤로가기: 상세에서 홈으로', page.locator('#home-feed').count() == 1, page.url)

        # ── 4. 직접 입력 + PNG ─────────────────────────────────
        page.goto(BASE + '#/custom', wait_until='networkidle')
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / '13-custom-390x844.png'))
        check(
            '직접 입력: 종류 선택에 화살표 표시',
            'data:image/svg' in (page.evaluate("getComputedStyle(document.querySelector('#f-cat')).backgroundImage") or ''),
            page.evaluate("getComputedStyle(document.querySelector('#f-cat')).backgroundImage")[:40],
        )
        page.fill('#f-name', '우리 집 과자')
        page.fill('#f-weight', '75')
        page.fill('#f-kcal', '355')
        page.fill('#f-sodium', '100')
        page.fill('#f-sugar', '12')
        page.fill('#f-fat', '4.6')
        page.locator('button.submit').click()
        page.wait_for_timeout(500)
        check('직접 입력: 카드 생성', page.locator('#c').count() == 0 and page.locator('#card-wrap svg').count() == 1)
        check('직접 입력: 댓글 영역은 숨김', page.locator('#comments').count() == 0)
        page.screenshot(path=str(OUT / '14-custom-card-390x844.png'))

        # 카탈로그 상세에서 PNG 저장
        page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
        page.wait_for_timeout(400)
        with page.expect_download(timeout=15000) as dl:
            page.locator('#save').click()
        download = dl.value
        png_path = OUT / '15-export-1080x2076.png'
        download.save_as(str(png_path))
        check('PNG 저장: 파일 생성', png_path.exists() and png_path.stat().st_size > 50000, png_path.stat().st_size)

        # 터치 영역·가로 넘침 전수
        for name, url in [
            ('홈', BASE),
            ('상세', BASE + '#/p/choco-heim'),
            ('게시판', BASE + '#/board'),
            ('직접 입력', BASE + '#/custom'),
        ]:
            page.goto(url, wait_until='networkidle')
            page.wait_for_timeout(350)
            small = page.evaluate("""() => [...document.querySelectorAll('button, a, input, select, textarea')]
                .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32; })
                .map(el => (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ':' + Math.round(el.getBoundingClientRect().height))""")
            report['notes'].append(f'터치 영역 32px 미만 · {name}: {small}')
            over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
            check(f'{name}: 가로 넘침 없음', over <= 0, over)

        # ── 5. 데스크톱 ────────────────────────────────────────
        desk = new_page(1280, 900, mobile=False)
        for name, url in [('home', BASE), ('detail', BASE + '#/p/choco-heim'), ('board', BASE + '#/board')]:
            desk.goto(url, wait_until='networkidle')
            desk.wait_for_timeout(500)
            desk.screenshot(path=str(OUT / f'16-desktop-{name}.png'), full_page=False)
            check(f'데스크톱 {name}: 가로 넘침 없음', desk.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)

        browser.close()


def _search_empty(page):
    page.fill('#q', '없는과자명')
    page.wait_for_timeout(150)
    ok = '맞는 간식이 없어요' in page.locator('#home-feed').inner_text()
    page.locator('#search-clear').click()
    page.wait_for_timeout(100)
    return ok


if __name__ == '__main__':
    main()
    (OUT / 'audit.json').write_text(
        json.dumps(
            {
                'checks': report['checks'],
                'console': report['console'],
                'pageerrors': report['pageerrors'],
                'requests_failed': report['requests_failed'],
                'notes': report['notes'],
                'failed': [c for c in report['checks'] if not c['ok']],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print('\nFAILED:', len([c for c in report['checks'] if not c['ok']]))
    print('console errors:', len(report['console']), 'page errors:', len(report['pageerrors']))

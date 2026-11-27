"""속보이네 라이브 검증 — 게시판·댓글 실제 저장/표시 (390×844 · iPhone UA).

실제 Supabase에 글 1건·댓글 1건을 남겨 화면에 나타나는지 확인하고,
확인 뒤에는 스크립트가 남긴 id를 출력한다(정리는 SQL로 따로 한다).

  LD_LIBRARY_PATH=... python3 tools/verify_live_board.py
"""
import json
import sys
from datetime import datetime, timezone
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
BASE = 'https://sokboine.vercel.app/'

TITLE = '성분표 사진 인식이 잘 되네요'
BODY = '매번 성분표를 직접 적기 번거로웠는데 사진으로 채워지니 편해요.'
NICK = '오돌2'
COMMENT = '카드에 각설탕으로 보여 주니 양이 바로 와닿네요.'

report = {'base': BASE, 'checks': [], 'console': [], 'pageerrors': [], 'requests_failed': []}


def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = browser.new_context(
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
    page.on('pageerror', lambda e: report['pageerrors'].append(str(e)))
    page.on('requestfailed', lambda r: report['requests_failed'].append(f'{r.method} {r.url} {r.failure}'))

    # 1) 홈
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(500)
    check('라이브 홈: 제품 34개', page.locator('.feed .item').count() == 34, page.locator('.feed .item').count())
    check('라이브 홈: 제안·제보 버튼', page.locator('.board-link').is_visible())
    page.screenshot(path=str(OUT / 'live-01-home-390x844.png'))

    # 2) 게시판 (실제 DB 읽기)
    page.locator('.board-link').click()
    page.wait_for_timeout(1200)
    body_text = page.locator('#board-list').inner_text()
    check('라이브 게시판: 화면이 정상 로딩', '불러오지 못했' not in body_text, body_text[:40].replace('\n', ' '))
    page.screenshot(path=str(OUT / 'live-02-board-before-390x844.png'))

    # 3) 글 작성 (실제 INSERT)
    page.locator('#write-toggle').click()
    page.wait_for_timeout(300)
    page.select_option('#b-cat', 'feature')
    score_before = page.locator('#board-list .post').count()
    page.fill('#b-title', TITLE)
    page.fill('#b-body', BODY)
    page.fill('#b-nick', NICK)
    page.screenshot(path=str(OUT / 'live-03-board-form-390x844.png'))
    page.locator('#form-submit').click()
    page.wait_for_timeout(2000)
    score_after = page.locator('#board-list .post').count()
    check('라이브 게시판: 글이 목록에 추가', score_after == score_before + 1, f'{score_before}→{score_after}')
    top_text = page.locator('#board-list .post').first.inner_text() if score_after else ''
    check('라이브 게시판: 새 글이 맨 위에 실제 내용으로', TITLE in top_text and BODY in top_text and NICK in top_text, top_text[:60].replace('\n', ' '))
    toast = page.locator('#toast').inner_text() if page.locator('#toast').is_visible() else ''
    check('라이브 게시판: 접수 토스트', '접수' in toast, toast)
    page.screenshot(path=str(OUT / 'live-04-board-posted-390x844.png'))

    # 4) 새로고침 뒤에도 남아 있는지 (서버 저장 확인)
    page.reload(wait_until='networkidle')
    page.wait_for_timeout(1200)
    titles = page.locator('.post-title').all_inner_texts()
    check('라이브 게시판: 새로고침 후에도 서버에 저장됨', TITLE in titles, titles[:3])

    # 5) 제품 상세 댓글 (실제 INSERT)
    page.goto(BASE + '#/p/choco-heim', wait_until='networkidle')
    page.wait_for_timeout(1500)
    before = page.locator('#comment-list .comment').count()
    page.locator('#comments').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / 'live-05-detail-comments-before-390x844.png'))
    page.fill('#cm-nick', NICK)
    page.fill('#cm-body', COMMENT)
    page.locator('#cm-submit').click()
    page.wait_for_timeout(2000)
    after = page.locator('#comment-list .comment').count()
    check('라이브 댓글: 등록 후 목록에 추가', after == before + 1, f'{before}→{after}')
    last = page.locator('#comment-list .comment').last.inner_text() if after else ''
    check('라이브 댓글: 실제 내용 표시', COMMENT in last and NICK in last, last[:60].replace('\n', ' '))
    page.screenshot(path=str(OUT / 'live-06-detail-comment-posted-390x844.png'))

    page.reload(wait_until='networkidle')
    page.wait_for_timeout(1500)
    lasts = page.locator('#comment-list .comment').all_inner_texts()
    check('라이브 댓글: 새로고침 후에도 서버에 저장됨', any(COMMENT in t for t in lasts), len(lasts))

    # 6) 나머지 화면 라이브 확인
    page.goto(BASE + '#/p/banana-kick', wait_until='networkidle')
    page.wait_for_timeout(1200)
    spill = page.evaluate("""() => {
        const svg = document.querySelector('#card-wrap svg');
        const right = svg.getBoundingClientRect().right;
        return [...svg.querySelectorAll('text')]
          .filter(t => t.textContent.trim() && t.getBoundingClientRect().right > right - 2).length;
    }""")
    check('라이브 상세: 카드 오른쪽 잘림 없음', spill == 0, spill)
    check('라이브 상세: 영양성분 기준 표기', '기준' in page.locator('.facts h3').inner_text(), page.locator('.facts h3').inner_text())
    with page.expect_download(timeout=20000) as dl:
        page.locator('#save').click()
    download = dl.value
    png = OUT / 'live-07-export-1080x2076.png'
    download.save_as(str(png))
    from PIL import Image

    with Image.open(png) as im:
        check('라이브 PNG 저장: 1080폭', im.width == 1080, f'{im.width}×{im.height}')

    page.goto(BASE + '#/custom', wait_until='networkidle')
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / 'live-08-custom-390x844.png'))
    check('라이브 직접 입력: 종류 화살표', 'data:image/svg' in (page.evaluate("getComputedStyle(document.querySelector('#f-cat')).backgroundImage") or ''))

    # 콘솔·페이지 오류
    check('라이브: 콘솔 오류 0', len(report['console']) == 0, report['console'][:3])
    check('라이브: 페이지 오류 0', len(report['pageerrors']) == 0, report['pageerrors'][:3])
    check('라이브: 실패한 요청 0', len(report['requests_failed']) == 0, report['requests_failed'][:3])

    browser.close()

Path(OUT / 'live-board-check.json').write_text(
    json.dumps(
        {
            'checked_at': datetime.now(timezone.utc).isoformat(),
            'test_data': {'board_title': TITLE, 'comment': COMMENT, 'nickname': NICK},
            **report,
            'failed': [c for c in report['checks'] if not c['ok']],
        },
        ensure_ascii=False,
        indent=2,
    )
)
print('\nFAILED:', len([c for c in report['checks'] if not c['ok']]))
sys.exit(0)

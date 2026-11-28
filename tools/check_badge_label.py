"""목록 우측 배지 '나트륨 X국자 / 당 X개' 표기와 390px 레이아웃을 확인한다."""
import pathlib
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path('/workspace/verification/tumyeongbongji')
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT.mkdir(parents=True, exist_ok=True)


def fmt(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def main():
    server = None
    if BASE.startswith('http://127.0.0.1'):
        server = subprocess.Popen([sys.executable, '-m', 'http.server', '4173'], cwd=str(ROOT),
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.2)
    fails = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
            page.goto(BASE, wait_until='networkidle')
            page.wait_for_timeout(1500)
            badges = page.eval_on_selector_all('.feed .item .mini i', 'els => els.map(e => e.textContent.trim())')
            print('badge samples:', badges[:8], 'total:', len(badges))
            if not badges:
                fails.append('목록 배지 없음')
            ok_na = [t for t in badges if re.fullmatch(r'나트륨 \d+(\.\d)?국자', t)]
            ok_dang = [t for t in badges if re.fullmatch(r'당 \d+(\.\d)?개', t)]
            na_all = [t for t in badges if t.startswith('나')]
            dang_all = [t for t in badges if t.startswith('당')]
            print('나트륨 배지 %d/%d, 당 배지 %d/%d' % (len(ok_na), len(na_all), len(ok_dang), len(dang_all)))
            if len(ok_na) != len(na_all) or len(ok_dang) != len(dang_all) or not na_all or not dang_all:
                fails.append('배지 문구 불일치: %r' % badges[:8])

            # 줄바꿈/겹침 검사: 각 행에서 info 텍스트가 두 줄을 넘지 않고, mini와 겹치지 않는지
            rows = page.eval_on_selector_all('.feed .item', '''els => els.map(el => {
              const info = el.querySelector('.info'); const mini = el.querySelector('.mini');
              const b = info.querySelector('b'); const em = info.querySelector('em');
              const ib = info.getBoundingClientRect(), mb = mini.getBoundingClientRect();
              const bb = b.getBoundingClientRect(), eb = em.getBoundingClientRect();
              return {
                name: b.textContent.trim(),
                overlap: ib.right > mb.left + 0.5,
                bOneLine: bb.height <= 24,
                emOneLine: eb.height <= 20,
                nameClipped: b.scrollWidth > b.clientWidth + 1,
                miniWidth: Math.round(mb.width),
                right: Math.round(mb.right),
                viewport: window.innerWidth,
              };
            })''')
            over = [r for r in rows if r['overlap']]
            multi = [r for r in rows if not (r['bOneLine'] and r['emOneLine'])]
            clipped = [r for r in rows if r['nameClipped']]
            print('rows:', len(rows), 'overlap:', len(over), 'multi-line:', len(multi), 'name clipped:', len(clipped))
            print('mini width max:', max([r['miniWidth'] for r in rows], default=0), 'right max:', max([r['right'] for r in rows], default=0))
            if over:
                fails.append('배지와 제품 정보 겹침: %r' % over[:3])
            if multi:
                fails.append('제품명/중량 줄바꿈 깨짐: %r' % multi[:3])
            for r in clipped[:3]:
                print('  ellipsis(정상 처리):', r['name'])

            page.screenshot(path=str(OUT / f'badge-{TAG}-home-390x844.png'), full_page=False)
            page.evaluate('window.scrollTo(0, 520)')
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f'badge-{TAG}-list-390x844.png'))
            b.close()
    finally:
        if server:
            server.terminate()
    print('FAILS:', fails if fails else 'none')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())

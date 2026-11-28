"""속보이네가 쓰는 글자에 페이퍼로지(Paperlogy) 글리프가 다 있는지 확인한다.

사용: python3 tools/check_glyphs.py
필요: pip install fonttools brotli   (woff2를 읽으려면 brotli가 있어야 한다)

- 앱 코드(data/products.js, app.js, lib/, api/, index.html, styles.css, config.js)에 나온 글자를
  fonts/Paperlogy-*.woff2의 cmap과 굵기별로 대조한다.
- 한글·영문·숫자·문장부호(·, %, ., -, kcal, mg, g 등)가 하나라도 빠지면 exit 1.
- 이모지·그림문자·전각 문자는 대체 글꼴이 그리므로 '대체 글꼴 사용'으로만 알린다.
"""
import sys
import unicodedata
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / 'fonts'

# 화면과 카드가 실제로 찍는 글자를 담은 파일들
APP_FILES = [
    'index.html',
    'styles.css',
    'app.js',
    'config.js',
    'manifest.webmanifest',
    'data/products.js',
    'data/nutrition-sources.md',
]
APP_DIRS = ['lib', 'api']

# 폰트에 반드시 있어야 하는 글자(단위·기호 포함)
REQUIRED = (
    '·%()[]{}<>~-–—×÷±°≈…“”‘’'
    'kcal mgg 0123456789'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
)


def app_text():
    chunks = []
    for rel in APP_FILES:
        p = ROOT / rel
        if p.exists():
            chunks.append(p.read_text(encoding='utf-8'))
    for rel in APP_DIRS:
        d = ROOT / rel
        if not d.is_dir():
            continue
        for p in sorted(d.rglob('*')):
            if p.suffix in {'.js', '.css', '.html', '.json'}:
                chunks.append(p.read_text(encoding='utf-8'))
    return '\n'.join(chunks)


def cmap_of(path):
    font = TTFont(path)
    return set(font.getBestCmap().keys())


def describe(ch):
    if ch == ' ':
        return 'space'
    name = unicodedata.name(ch, '?')
    return f'U+{ord(ch):04X} {name}'


def main():
    fonts = sorted(FONT_DIR.glob('Paperlogy-*.woff2'))
    if not fonts:
        print(f'FAIL: {FONT_DIR}에 Paperlogy woff2가 없습니다')
        return 1

    text = app_text()
    app_chars = {c for c in text if c not in '\r\n\t'}
    required = {c for c in REQUIRED if c != ' '}

    ok = True
    for path in fonts:
        try:
            cmap = cmap_of(path)
        except ImportError:
            print('FAIL: woff2를 읽으려면 brotli가 필요합니다 (pip install brotli)')
            return 1
        missing_required = sorted(c for c in required if ord(c) not in cmap)
        missing_app = sorted(c for c in app_chars if ord(c) not in cmap)
        # 대체 글꼴로 그려도 되는 글자: 이모지·그림문자·전각·문장부호(CJK)·폭 없는 선택자
        def is_fallback(c):
            cp = ord(c)
            if unicodedata.category(c) in {'So', 'Cs', 'Co', 'Cf', 'Mn'}:
                return True
            return (
                0xFF00 <= cp <= 0xFFEF
                or 0x2500 <= cp <= 0x257F
                or 0x2300 <= cp <= 0x23FF
                or 0x3000 <= cp <= 0x303F
                or 0xFE00 <= cp <= 0xFE0F
            )

        fallback = [c for c in missing_app if is_fallback(c)]
        missing = [c for c in missing_app if not is_fallback(c)]

        status = 'PASS' if not missing_required and not missing else 'FAIL'
        if status == 'FAIL':
            ok = False
        print(f'{status} {path.name}: 글리프 {len(cmap):,}자 · 앱 글자 {len(app_chars)}자 중 누락 {len(missing)}자'
              f' · 대체 글꼴 {len(fallback)}자')
        if missing_required:
            print('  필수 글자 누락: ' + ', '.join(f'{c}({describe(c)})' for c in missing_required))
        if missing:
            print('  앱 글자 누락: ' + ', '.join(f'{c}({describe(c)})' for c in missing))
        if fallback:
            print('  대체 글꼴로 그리는 글자: ' + ''.join(fallback))

    print('\n' + ('모든 굵기에서 필수 글자가 있습니다.' if ok else '글리프가 빠진 굵기가 있습니다.'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

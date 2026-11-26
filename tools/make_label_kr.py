"""OCR 검증용 한국어 영양성분표 이미지 생성 (테스트 전용, 배포 제외)."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1000, 1280
FONT = '/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf'

img = Image.new('RGB', (W, H), '#FFFFFF')
d = ImageDraw.Draw(img)

f_title = ImageFont.truetype(FONT, 54)
f_head = ImageFont.truetype(FONT, 38)
f_row = ImageFont.truetype(FONT, 40)
f_small = ImageFont.truetype(FONT, 30)

# 바깥 테두리
d.rectangle([28, 28, W - 28, H - 28], outline='#111111', width=4)

# 제목
d.text((64, 62), '영양정보', font=f_title, fill='#111111', stroke_width=2, stroke_fill='#111111')
d.line([64, 140, W - 64, 140], fill='#111111', width=3)

# 총 내용량 · 열량
d.text((64, 172), '총 내용량 75 g', font=f_row, fill='#111111')
d.text((560, 172), '열량 320 kcal', font=f_row, fill='#111111')
d.line([64, 240, W - 64, 240], fill='#111111', width=2)

# 표 머리글
d.text((64, 268), '항목', font=f_small, fill='#333333')
d.text((430, 268), '함량', font=f_small, fill='#333333')
d.text((700, 268), '1일 영양성분기준치', font=f_small, fill='#333333')
d.line([64, 322, W - 64, 322], fill='#999999', width=2)

rows = [
    ('나트륨', '100 mg', '5 %', 0),
    ('탄수화물', '66 g', '20 %', 0),
    ('당류', '37 g', '37 %', 1),
    ('지방', '4.6 g', '9 %', 0),
    ('트랜스지방', '0 g', '', 1),
    ('포화지방', '2 g', '13 %', 1),
    ('단백질', '3.2 g', '6 %', 0),
]
y = 352
for name, amount, pct, indent in rows:
    x = 64 + (28 if indent else 0)
    d.text((x, y), name, font=f_row, fill='#111111')
    d.text((430, y), amount, font=f_row, fill='#111111')
    if pct:
        d.text((700, y), pct, font=f_row, fill='#111111')
    d.line([64, y + 74, W - 64, y + 74], fill='#DDDDDD', width=2)
    y += 92

d.line([64, y + 6, W - 64, y + 6], fill='#111111', width=2)
d.text((64, y + 34), '* 1일 영양성분기준치에 대한 비율(%)입니다.', font=f_small, fill='#555555')
d.text((64, y + 84), '원재료명: 밀가루, 설탕, 팜유, 코코아분말, 정제소금', font=f_small, fill='#555555')

img.save('/workspace/tumyeongbongji/tools/label-kr.png')
print('saved', img.size)

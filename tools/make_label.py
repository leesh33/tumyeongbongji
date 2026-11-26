from PIL import Image, ImageDraw, ImageFont
w, h = 720, 900
img = Image.new('RGB', (w, h), '#FFFFFF')
d = ImageDraw.Draw(img)
try:
    font_b = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 46)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 34)
except Exception:
    font_b = font = ImageFont.load_default()

d.rectangle([0, 0, w, 130], fill='#F3F0EA')
d.text((40, 42), 'NUTRITION FACTS', font=font_b, fill='#222')
rows = [
    ('Serving size', '60 g'),
    ('Calories', '280 kcal'),
    ('Sodium', '180 mg'),
    ('Sugars', '9 g'),
    ('Fat', '12 g'),
    ('Carbohydrate', '38 g'),
    ('Protein', '4 g'),
]
y = 180
for k, v in rows:
    d.text((40, y), k, font=font, fill='#333')
    d.text((460, y), v, font=font, fill='#111')
    d.line([40, y + 56, w - 40, y + 56], fill='#DDD', width=2)
    y += 90
img.save('/workspace/snack-xray-web/tools/label-sample.png')
print('ok')

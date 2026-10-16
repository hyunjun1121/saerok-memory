from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

src = Path(
    r"C:\Users\mnb92\.grok\sessions"
    r"\C%3A%5Cproject%5Csaerok-memory%5C%ED%94%BC%EC%9A%B0%EB%8B%A4%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8"
    r"%5C%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C%5C%EA%B2%B0%EC%84%A0%EB%B0%9C%ED%91%9C"
    r"\01a02dd3-369b-70b0-8754-9b19c20d6f2b\images\1.jpg"
)
out = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt\media\image3.png")
font_path = Path(r"C:\Users\mnb92\AppData\Local\Microsoft\Windows\Fonts\NanumSquareRoundEB.ttf")

mark = Image.open(src).convert("RGBA")
arr = np.array(mark)
# near-white -> transparent
rgb = arr[:, :, :3].astype(np.int16)
white = (rgb[:, :, 0] > 242) & (rgb[:, :, 1] > 242) & (rgb[:, :, 2] > 242)
arr[white, 3] = 0
mark = Image.fromarray(arr)

# crop to visible mark
bbox = mark.getbbox()
mark = mark.crop(bbox)
# slight trim of remaining halo
mark = mark.crop(mark.getbbox())

# canvas matching original logo aspect ~ 900 x 459, render at 2x
W, H = 1800, 918
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

# scale mark to ~78% of canvas height
target_h = int(H * 0.78)
ratio = target_h / mark.height
target_w = int(mark.width * ratio)
mark_r = mark.resize((target_w, target_h), Image.Resampling.LANCZOS)
mark_y = (H - target_h) // 2
mark_x = 40
canvas.paste(mark_r, (mark_x, mark_y), mark_r)

# wordmark
text = "치매링고"
font = ImageFont.truetype(str(font_path), 210)
draw = ImageDraw.Draw(canvas)
# measure
tb = draw.textbbox((0, 0), text, font=font)
tw, th = tb[2] - tb[0], tb[3] - tb[1]
text_x = mark_x + target_w + 48
text_y = (H - th) // 2 - tb[1]
navy = (27, 45, 58, 255)  # #1B2D3A
draw.text((text_x, text_y), text, font=font, fill=navy)

# crop unused right if needed but keep original aspect by centering content
content_right = text_x + tw + 40
if content_right < W:
    # pad equally conceptually; keep width for aspect
    pass

canvas.save(out)
print("wrote", out, canvas.size, "content_right", content_right)

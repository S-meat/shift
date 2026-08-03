from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "app-icon-source.jpg"


def create_icon(size: int, filename: str, content_ratio: float = 1.0) -> None:
    source = Image.open(SOURCE).convert("RGB")
    limit = round(size * content_ratio)
    source.thumbnail((limit, limit), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (size, size), "white")
    x = (size - source.width) // 2
    y = (size - source.height) // 2
    canvas.paste(source, (x, y))
    canvas.save(ROOT / "assets" / filename, "PNG", optimize=True)


create_icon(32, "app-icon-32.png")
create_icon(180, "app-icon-180.png")
create_icon(192, "app-icon-192.png")
create_icon(512, "app-icon-512.png")
create_icon(512, "app-icon-maskable-512.png", content_ratio=0.72)

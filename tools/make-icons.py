from pathlib import Path

from PIL import Image, ImageDraw

ACCENT = (129, 152, 144, 255)
INK = (19, 21, 22, 255)
S = 1024


def build() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.23), fill=ACCENT)

    bar_h = int(S * 0.085)
    gap = int(S * 0.085)
    widths = (0.54, 0.40, 0.28)
    x = int(S * 0.23)
    y = (S - (bar_h * len(widths) + gap * (len(widths) - 1))) // 2

    for width in widths:
        draw.rounded_rectangle(
            [x, y, x + int(S * width), y + bar_h],
            radius=bar_h // 2,
            fill=INK,
        )
        y += bar_h + gap

    return img


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)
    source = build()
    for size in (16, 32, 48, 128):
        source.resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png")
        print(f"wrote {out / f'icon-{size}.png'}")


if __name__ == "__main__":
    main()

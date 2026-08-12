"""Build the raster k8lab identity from the selected connected-cluster mark.

The source direction is option 02 from the logo exploration board. Production
artwork is drawn at high resolution and downsampled so every exported PNG has
consistent geometry, color, padding, and small-size rendering.
"""

from __future__ import annotations

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / "public" / "brand"
APP_DIR = ROOT / "src" / "app"
FONT_PATH = Path("C:/Windows/Fonts/seguisb.ttf")

BLUE = "#0878F9"
CYAN = "#25BEE8"
INK = "#101828"
WHITE = "#FFFFFF"
LIGHT = "#F7F8FA"

SCALE = 6
RESAMPLE = Image.Resampling.LANCZOS


def render_mark(size: int, treatment: str = "color") -> Image.Image:
    canvas_size = size * SCALE
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    center = canvas_size / 2
    orbit = canvas_size * 0.305
    center_radius = canvas_size * 0.140
    outer_radius = canvas_size * 0.084
    connector_width = round(canvas_size * 0.040)

    if treatment == "white":
        node_colors = [WHITE] * 6
        center_color = WHITE
        diagonal_connector = WHITE
        vertical_connector = WHITE
    elif treatment == "black":
        node_colors = [INK] * 6
        center_color = INK
        diagonal_connector = INK
        vertical_connector = INK
    else:
        node_colors = [CYAN, BLUE, INK, CYAN, BLUE, INK]
        center_color = BLUE
        diagonal_connector = INK
        vertical_connector = BLUE

    positions: list[tuple[float, float]] = []
    for index, angle_degrees in enumerate((-90, -30, 30, 90, 150, 210)):
        angle = math.radians(angle_degrees)
        x = center + orbit * math.cos(angle)
        y = center + orbit * math.sin(angle)
        positions.append((x, y))
        connector_color = vertical_connector if index in (0, 3) else diagonal_connector
        draw.line((center, center, x, y), fill=connector_color, width=connector_width)

    for (x, y), color in zip(positions, node_colors, strict=True):
        draw.ellipse(
            (x - outer_radius, y - outer_radius, x + outer_radius, y + outer_radius),
            fill=color,
        )

    draw.ellipse(
        (
            center - center_radius,
            center - center_radius,
            center + center_radius,
            center + center_radius,
        ),
        fill=center_color,
    )

    return image.resize((size, size), RESAMPLE)


def save_mark_variants() -> dict[str, Image.Image]:
    color = render_mark(1024)
    white = render_mark(1024, "white")
    black = render_mark(1024, "black")

    color.save(BRAND_DIR / "k8lab-mark.png", optimize=True)
    color.save(BRAND_DIR / "k8lab-cluster-mark.png", optimize=True)
    white.save(BRAND_DIR / "k8lab-mark-white.png", optimize=True)
    white.save(BRAND_DIR / "k8lab-cluster-mark-white.png", optimize=True)
    black.save(BRAND_DIR / "k8lab-mark-black.png", optimize=True)
    black.save(BRAND_DIR / "k8lab-cluster-mark-black.png", optimize=True)
    color.save(BRAND_DIR / "k8lab-mark-approved-source.png", optimize=True)

    for size in (16, 32, 64, 512):
        render_mark(size).save(BRAND_DIR / f"k8lab-mark-{size}.png", optimize=True)

    return {"color": color, "white": white, "black": black}


def render_lockup(word_color: str) -> Image.Image:
    mark_size = 512
    mark = render_mark(mark_size)
    font = ImageFont.truetype(str(FONT_PATH), 400)
    text = "k8lab"
    text_box = font.getbbox(text)
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    gap = 20
    canvas = Image.new("RGBA", (mark_size + gap + text_width + 48, mark_size), (0, 0, 0, 0))
    canvas.alpha_composite(mark, (0, 0))

    draw = ImageDraw.Draw(canvas)
    text_x = mark_size + gap
    text_y = (mark_size - text_height) / 2 - text_box[1]
    draw.text((text_x, text_y), text, font=font, fill=word_color)

    bounds = canvas.getbbox()
    if bounds is None:
        raise RuntimeError("Lockup rendered without visible pixels")
    cropped = canvas.crop(bounds)
    padding = 18
    output = Image.new(
        "RGBA",
        (cropped.width + padding * 2, cropped.height + padding * 2),
        (0, 0, 0, 0),
    )
    output.alpha_composite(cropped, (padding, padding))
    return output


def save_lockups() -> dict[str, Image.Image]:
    on_dark = render_lockup(WHITE)
    on_light = render_lockup(INK)

    for name in (
        "k8lab-lockup.png",
        "k8lab-lockup-on-dark.png",
        "k8lab-lockup-approved-source.png",
        "k8lab-cluster-lockup-on-dark.png",
    ):
        on_dark.save(BRAND_DIR / name, optimize=True)

    for name in (
        "k8lab-lockup-on-light.png",
        "k8lab-lockup-on-light-approved.png",
        "k8lab-cluster-lockup-on-light.png",
    ):
        on_light.save(BRAND_DIR / name, optimize=True)

    return {"dark": on_dark, "light": on_light}


def render_app_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), LIGHT)
    mark_size = round(size * 0.86)
    mark = render_mark(mark_size)
    offset = (size - mark_size) // 2
    image.alpha_composite(mark, (offset, offset))
    return image


def save_application_icons() -> None:
    icon_512 = render_app_icon(512)
    icon_192 = render_app_icon(192)
    favicon = render_mark(64)

    for name in (
        "k8lab-app-icon.png",
        "k8lab-app-icon-512.png",
        "k8lab-app-icon-approved-source.png",
        "k8lab-cluster-app-icon.png",
    ):
        icon_512.save(BRAND_DIR / name, optimize=True)

    for name in ("k8lab-app-icon-192.png", "k8lab-app-icon-192-approved.png"):
        icon_192.save(BRAND_DIR / name, optimize=True)

    favicon.save(BRAND_DIR / "k8lab-favicon.png", optimize=True)
    favicon.save(BRAND_DIR / "k8lab-cluster-favicon.png", optimize=True)
    favicon.save(BRAND_DIR / "k8lab-favicon-approved-source.png", optimize=True)
    favicon.save(APP_DIR / "icon.png", optimize=True)
    render_app_icon(180).save(APP_DIR / "apple-icon.png", optimize=True)


def fit_height(image: Image.Image, height: int) -> Image.Image:
    width = round(image.width * height / image.height)
    return image.resize((width, height), RESAMPLE)


def refresh_readme_poster(lockup: Image.Image) -> None:
    png_path = BRAND_DIR / "readme" / "k8lab-readme-poster.png"
    webp_path = BRAND_DIR / "readme" / "k8lab-readme-poster.webp"
    poster = Image.open(png_path).convert("RGB")

    # The left side was intentionally designed as a near-black identity field.
    # Repaint only the two old lockup locations, including the tiny in-product nav.
    draw = ImageDraw.Draw(poster)
    draw.rectangle((45, 48, 370, 174), fill="#050505")
    draw.rectangle((555, 211, 625, 239), fill="#050505")

    primary = fit_height(lockup, 82)
    poster.paste(primary, (70, 75), primary)
    embedded = fit_height(lockup, 17)
    poster.paste(embedded, (560, 216), embedded)

    poster.save(png_path, optimize=True)
    poster.save(webp_path, "WEBP", quality=90, method=6)


def main() -> None:
    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    save_mark_variants()
    lockups = save_lockups()
    save_application_icons()
    refresh_readme_poster(lockups["dark"])

    generated_source = Path(
        r"C:/Users/armaa/.codex/generated_images/019fea2f-aea6-7b62-9fdf-fcc1a7b73a03/"
        r"exec-ef3d7018-db58-45a6-9aa1-ad68ddf692b3.png"
    )
    concept_destination = BRAND_DIR / "concepts" / "k8lab-option-02-refined-source.png"
    if generated_source.exists() and not concept_destination.exists():
        shutil.copy2(generated_source, concept_destination)


if __name__ == "__main__":
    main()

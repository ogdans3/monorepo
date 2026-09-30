#!/usr/bin/env python3
"""Every icon and launch image the app ships, cut from one picture.

    python3 -m pip install pillow      # once
    python3 tool/icon/make.py          # from app/

`swaply-icon.png` beside this file is the icon the product owner chose on
30.09.2026: a two-part «S», white over green, on deep green, drawn to the edge
of the square. A new icon is a new picture there and one more run of this. It
writes over what it made last time and touches nothing else.

What it makes, and why each is the shape it is:

- The icon itself, as the square it was drawn: every size iOS's asset catalog
  lists (iOS rounds the corners itself and wants no transparency), Android's
  launcher icon for 7.x, the web's icons and favicon, and the 512 Play Console
  asks for on the store listing.
- Android's adaptive icon, from 8.0: the S alone as the foreground, the
  icon's own green as the background, and the S again as the monochrome layer
  Android 13 tints for themed icons. The launcher masks the layers into its own
  shape, so the S is set as large in the visible part as it is in the square.
- The launch screens: the S alone, on the app's deep green, 104 points tall
  in the middle of the screen, on iOS, on Android before 12 and on Android 12's
  own splash. Screen 01 draws the same S in the same place, so nothing moves
  when the app takes over from the system, and it is the S Flutter bundles.
"""
from pathlib import Path
import json
import statistics

from PIL import Image

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
SOURCE = HERE / 'swaply-icon.png'
RES = APP / 'android/app/src/main/res'

# The app's deep green (`SwaplyColors.greenDeep`), and not the icon's own, a
# shade lighter: the launch screen hands over to 01, and the two have to be one
# colour. The adaptive icon keeps the icon's, since it is the icon.
SPLASH_GREEN = '#064E3B'

# How tall the S stands on every launch screen and on 01, in points.
SPLASH_S = 104

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def hexed(rgb):
    return '#%02X%02X%02X' % rgb


def pixels(img):
    """Every pixel in order, by the name the Pillow at hand has for it."""
    return img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata()


def background_of(img):
    """The icon's green, from the frame round the edge: the median, since the
    picture carries a little noise."""
    w, h = img.size
    px = img.load()
    frame = [px[x, y] for x in range(0, w, 3) for y in (2, h - 3)]
    frame += [px[x, y] for y in range(0, h, 3) for x in (2, w - 3)]
    return tuple(int(statistics.median(p[i] for p in frame)) for i in range(3))


def inks_of(img, bg):
    """The two colours the S is drawn in, from the pixels far from the green:
    the light one and the other one."""
    far = [p for p in pixels(img) if sum(abs(a - b) for a, b in zip(p, bg)) > 150]
    light = [p for p in far if min(p) > 200]
    rest = [p for p in far if min(p) <= 200]
    median = lambda ps: tuple(int(statistics.median(p[i] for p in ps)) for i in range(3))
    return [median(light), median(rest)]


def the_s(img, bg, inks):
    """The S on nothing. Every pixel is taken as one of the inks laid over the
    green at some strength, the ink it lies on the way to, and the strength is
    its alpha: the edges keep their smoothing and lose the green behind them."""
    out = []
    lines = [(c, tuple(b - a for a, b in zip(bg, c))) for c in inks]
    lines = [(c, d, sum(x * x for x in d)) for c, d in lines]
    for p in pixels(img):
        v = (p[0] - bg[0], p[1] - bg[1], p[2] - bg[2])
        best = None
        for c, d, dd in lines:
            t = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dd
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            miss = sum((v[i] - t * d[i]) ** 2 for i in range(3))
            if best is None or miss < best[0]:
                best = (miss, c, t)
        _, c, t = best
        # The noise in the green is not ink, and the middle of a stroke is all.
        a = 0 if t < 0.04 else 255 if t > 0.96 else round(t * 255)
        out.append((c[0], c[1], c[2], a))
    s = Image.new('RGBA', img.size)
    s.putdata(out)
    return s


def reach_of(s):
    """How far the S reaches from the middle of the square, as a share of the
    side: the farthest pixel with ink in it, not the corner of the box round
    it, which the round ends never fill."""
    w, h = s.size
    alpha = s.getchannel('A').load()
    far = max((x + 0.5 - w / 2) ** 2 + (y + 0.5 - h / 2) ** 2
              for y in range(h) for x in range(w) if alpha[x, y] > 8)
    return far ** 0.5 / w


def fit(img, size):
    """[img] at [size], resampled without the edge going grey: through
    premultiplied alpha when it has any."""
    if img.mode == 'RGBA':
        return img.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    return img.resize(size, Image.LANCZOS)


def s_at(s, height):
    return fit(s, (max(1, round(s.width * height / s.height)), round(height)))


def centred(s, canvas, height):
    """The S [height] tall in the middle of a transparent square [canvas] wide."""
    out = Image.new('RGBA', (round(canvas), round(canvas)))
    mark = s_at(s, height)
    out.alpha_composite(mark, ((out.width - mark.width) // 2, (out.height - mark.height) // 2))
    return out


def save(img, path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert('RGB') if rgb else img).save(path, optimize=True)
    return path


def main():
    square = Image.open(SOURCE).convert('RGB')
    if square.width != square.height:
        raise SystemExit(f'{SOURCE.name} is {square.size}, and an icon is a square.')
    bg = background_of(square)
    inks = inks_of(square, bg)
    whole = the_s(square, bg, inks)
    # How far the S reaches from the middle, which a mask needs, and how much
    # of the square it takes, which the adaptive icon keeps.
    reach = reach_of(whole)
    s = whole.crop(whole.getbbox())
    share = s.height / square.height
    print(f'background {hexed(bg)}, inks {[hexed(i) for i in inks]}, '
          f'S {s.width}x{s.height} ({share:.0%} of the square, reaching {reach:.0%} out)')
    # A maskable web icon keeps what matters inside the circle 80% across.
    if reach > 0.4:
        raise SystemExit('The S reaches too far out for a maskable icon; pad the picture.')

    made = []

    # iOS, every size the asset catalog lists, square and opaque.
    ios = APP / 'ios/Runner/Assets.xcassets/AppIcon.appiconset'
    for entry in json.loads((ios / 'Contents.json').read_text())['images']:
        side = round(float(entry['size'].split('x')[0]) * int(entry['scale'][0]))
        made.append(save(fit(square, (side, side)), ios / entry['filename'], rgb=True))

    # Android 7.x, and the adaptive icon from 8.0.
    for name, d in DENSITIES.items():
        made.append(save(fit(square, (round(48 * d),) * 2), RES / f'mipmap-{name}/ic_launcher.png'))
        # 108 across, of which a launcher shows the middle 72.
        front = centred(s, 108 * d, 72 * share * d)
        made.append(save(front, RES / f'mipmap-{name}/ic_launcher_foreground.png'))
        mono = Image.new('RGBA', front.size, (255, 255, 255, 0))
        mono.putalpha(front.getchannel('A'))
        made.append(save(mono, RES / f'mipmap-{name}/ic_launcher_monochrome.png'))
        # Before Android 12: the S in the middle of the launch window.
        made.append(save(s_at(s, SPLASH_S * d), RES / f'drawable-{name}/splash_s.png'))
        # Android 12 and later draw a 288 square in the middle of the screen,
        # and whatever is in it at the size it is drawn at.
        made.append(save(centred(s, 288 * d, SPLASH_S * d), RES / f'drawable-{name}/splash_icon.png'))
    adaptive = RES / 'mipmap-anydpi-v26/ic_launcher.xml'
    adaptive.parent.mkdir(parents=True, exist_ok=True)
    adaptive.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- Made by tool/icon/make.py. -->\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
        '</adaptive-icon>\n')
    made.append(adaptive)
    colours = RES / 'values/colors.xml'
    colours.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- Made by tool/icon/make.py. -->\n'
        '<resources>\n'
        '    <!-- The icon\'s own green, behind the S in the adaptive icon. -->\n'
        f'    <color name="ic_launcher_background">{hexed(bg)}</color>\n'
        '    <!-- The app\'s deep green, which the launch screen hands over to 01 on. -->\n'
        f'    <color name="splash_background">{SPLASH_GREEN}</color>\n'
        '</resources>\n')
    made.append(colours)

    # iOS's launch screen draws LaunchImage at its own size in the middle.
    launch = APP / 'ios/Runner/Assets.xcassets/LaunchImage.imageset'
    for scale, name in ((1, 'LaunchImage.png'), (2, 'LaunchImage@2x.png'), (3, 'LaunchImage@3x.png')):
        made.append(save(s_at(s, SPLASH_S * scale), launch / name))

    # 01's S, as a Flutter asset with its variants.
    for scale, folder in ((1, ''), (2, '2.0x/'), (3, '3.0x/')):
        made.append(save(s_at(s, SPLASH_S * scale), APP / f'assets/brand/{folder}s.png'))

    # The web: the tab, a home screen on iOS, and the manifest's four.
    web = APP / 'web'
    made.append(save(fit(square, (64, 64)), web / 'favicon.png'))
    made.append(save(fit(square, (180, 180)), web / 'icons/apple-touch-icon.png', rgb=True))
    for side in (192, 512):
        made.append(save(fit(square, (side, side)), web / f'icons/swaply-{side}.png'))
        made.append(save(fit(square, (side, side)), web / f'icons/swaply-maskable-{side}.png'))

    # Play Console's store listing: 512 square, 32-bit.
    made.append(save(fit(square, (512, 512)).convert('RGBA'), HERE / 'play-store-512.png'))

    print(f'{len(made)} files')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Build Lucide SVG sprite from fetched icons, emit as HTML snippet."""
import glob, os, re, html

def load_icons():
    icons = {}
    for f in glob.glob('/tmp/lucide/*.svg'):
        name = os.path.basename(f)[:-4]
        svg = open(f).read()
        # extract inner content of the svg
        m = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S)
        if m:
            icons[name] = m.group(1).strip()
    return icons

def build_sprite():
    icons = load_icons()
    symbols = []
    for name in sorted(icons):
        symbols.append(f'<symbol id="i-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{icons[name]}</symbol>')
    sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' + '\n'.join(symbols) + '</svg>'
    return sprite, icons

if __name__ == '__main__':
    sprite, icons = build_sprite()
    out = '/home/ubuntu/murah-plastic/icon-sprite.html'
    with open(out, 'w') as f:
        f.write(sprite)
    print(f"Sprite written: {len(icons)} icons, {len(sprite)} chars -> {out}")
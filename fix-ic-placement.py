#!/usr/bin/env python3
"""Fix misplaced IC helper: remove it wherever it is, then inject it at the
first EXECUTABLE <script> (not ld+json, not external src)."""
import re, os, importlib.util

spec = importlib.util.spec_from_file_location("ricon", "replace-icons3.py")
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
IC_HELPER = r.IC_HELPER

# Pattern to remove any existing IC helper block (with leading whitespace/newline)
HELPER_RE = re.compile(
    r'\n?\s*// ── Icon helper: returns inline SVG <use> referencing the sprite ──\n'
    r'\s*window\.IC = .*?\n'
    r'\s*var IC = window\.IC;\n?',
    re.DOTALL
)

files = ['public/index.html', 'public/admin.html', 'public/akun.html', 'public/cart.html',
         'public/checkout.html', 'public/tentang-kami.html', 'public/faq.html', 'public/artikel.html']

for fname in files:
    src = open(fname).read()
    # 1) remove existing misplaced helpers
    src2 = HELPER_RE.sub('', src)
    # 2) inject at first executable script if not present
    if 'window.IC =' not in src2:
        m = re.search(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>', src2)
        if m:
            pos = m.end()
            src2 = src2[:pos] + '\n' + IC_HELPER + src2[pos:]
    if src2 != src:
        open(fname, 'w').write(src2)
        print(f'{fname}: IC helper repositioned ({len(src)} -> {len(src2)})')
    else:
        print(f'{fname}: unchanged')

# Verify placement
print('\n=== verify ===')
for fname in files:
    src = open(fname).read()
    idx = src.find('window.IC =')
    if idx < 0:
        print(f'{fname}: IC NOT FOUND!')
        continue
    prev_script = src.rfind('<script', 0, idx)
    tag = src[prev_script:src.find('>', prev_script)+1]
    ok = 'src=' not in tag and 'ld+json' not in tag
    print(f'{fname}: {"OK " if ok else "BAD"} {tag}')
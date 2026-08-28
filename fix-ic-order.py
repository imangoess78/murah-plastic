#!/usr/bin/env python3
"""Fix IC helper placement: must be BEFORE <script src="/assets/site.js">.
site.js calls IC() at load; if IC is defined after, ReferenceError kills the header."""
import re, importlib.util

spec = importlib.util.spec_from_file_location("ricon", "replace-icons3.py")
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
IC_HELPER = r.IC_HELPER

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
    src2 = HELPER_RE.sub('', src)

    sitejs = src2.find('<script src="/assets/site.js">')
    if sitejs >= 0:
        # Inject right BEFORE site.js (must be defined before it runs)
        inject = IC_HELPER
        src2 = src2[:sitejs] + f'<script>\n{inject}</script>\n' + src2[sitejs:]
    else:
        # No site.js — inject at first executable script (admin.html style)
        if 'window.IC =' not in src2:
            m = re.search(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>', src2)
            if m:
                pos = m.end()
                src2 = src2[:pos] + '\n' + IC_HELPER + src2[pos:]

    if src2 != src:
        open(fname, 'w').write(src2)
        print(f'{fname}: IC helper moved before site.js' if sitejs >= 0 else f'{fname}: IC helper kept at first exec script')
    else:
        print(f'{fname}: unchanged')

# Verify
print('\n=== verify ===')
for fname in files:
    src = open(fname).read()
    sitejs = src.find('<script src="/assets/site.js">')
    ic = src.find('window.IC =')
    if sitejs >= 0:
        ok = ic >= 0 and ic < sitejs
        print(f'{fname}: {"OK" if ok else "STILL BUG"} (IC@{ic} site.js@{sitejs})')
    else:
        idx = src.find('window.IC =')
        prev = src.rfind('<script', 0, idx)
        tag = src[prev:src.find('>', prev)+1]
        ok = 'src=' not in tag and 'ld+json' not in tag
        print(f'{fname}: {"OK" if ok else "BAD"} (no site.js, IC in {tag})')
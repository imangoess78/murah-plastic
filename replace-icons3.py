#!/usr/bin/env python3
"""
Replace emoji icons with Lucide SVG references across ALL murah-plastic pages.
Context-aware: HTML outside <script> → inline SVG; JS strings → concat splice;
template literals → ${IC('name')}; textContent → innerHTML+IC (for hearts);
placeholder/data/WA-message/rating → keep emoji (data, not icons).

KEY SAFETY RULES:
- WA message templates (backtick strings containing \\n or %0A or *markdown*)
  MUST keep emoji — they are sent as WhatsApp TEXT, not rendered as HTML.
- Courier logos (logo:'...'), product specs ("Food Grade": "✅ ..."), ratings
  (★☆), country flags (🇮🇩), payment brand dots (💚💜🟡) → keep emoji.
- IC helper injected as `window.IC` + `var IC` (safe for multi-script-block pages).
"""
import re, sys, os

# ── Emoji → icon mapping (single codepoints, normalized) ──
EMOJI_MAP = {
    '\U0001f4ca': 'layout-dashboard', '\U0001f4e6': 'package', '\U0001f6cd': 'shopping-bag',
    '\U0001f4c2': 'folder', '\U0001f465': 'users', '\U0001f6e0': 'wrench',
    '\U0001f4ac': 'message-circle', '\U0001f4dd': 'file-text', '\U0001f4c8': 'trending-up',
    '\U0001f4b3': 'credit-card', '\U0001f9d1': 'user', '\U0001f4bc': 'briefcase',
    '\u2699': 'settings', '\u2630': 'menu', '\U0001f310': 'globe', '\U0001f504': 'refresh-cw',
    '\U0001f441': 'eye', '\u2192': 'arrow-right', '\u2705': 'check-circle-2',
    '\u270f': 'pencil', '\u274c': 'x-circle', '\u2716': 'x', '\u2715': 'x', '\U0001f5d1': 'trash-2',
    '\u2795': 'plus', '\U0001f4cb': 'clipboard-list', '\U0001f4be': 'save',
    '\U0001f464': 'user', '\U0001f4e5': 'download', '\U0001f69a': 'truck',
    '\U0001f50d': 'search', '\U0001f4f1': 'smartphone', '\U0001f4b0': 'dollar-sign',
    '\U0001f4ed': 'inbox', '\U0001f389': 'gift', '\U0001f5a8': 'printer',
    '\U0001f4f7': 'camera', '\U0001f4a1': 'lightbulb', '\U0001f5bc': 'image',
    '\U0001f3e6': 'landmark', '\u2b50': 'star', '\u275d': 'quote', '\u2709': 'mail',
    '\U0001f6d2': 'shopping-cart', '\U0001f6ab': 'ban', '\U0001f4f9': 'video', '\U0001f4ec': 'mail', '\U0001f4c6': 'calendar',
    '\U0001f4c5': 'calendar', '\U0001f3f7': 'tag', '\U0001f3c6': 'trophy', '\u2b07': 'download',
    '\u2753': 'help-circle', '\u26a0': 'alert-triangle', '\U0001f680': 'rocket',
    '\U0001f648': 'eye-off', '\U0001f553': 'clock', '\U0001f552': 'clock',
    '\U0001f517': 'link', '\U0001f510': 'lock', '\U0001f451': 'crown', '\U0001f3ea': 'store',
 '\U0001f3e0': 'home', '\U0001f3b5': 'music', '\U0001f35e': 'wheat',
 '\u26a1': 'zap', '\U0001f512': 'lock',
    '\U0001f3a7': 'headphones', '\U0001f9f9': 'broom', '\u2764': 'heart',
    '\U0001f6aa': 'log-out', '\u2714': 'check', '\U0001f4af': 'award', '\U0001f3a5': 'video', '\U0001f4f8': 'camera',
    '\U0001f4f2': 'smartphone', '\U0001f4ee': 'mail', '\U0001f4e8': 'mail',
    '\U0001f4cd': 'map-pin', '\u27a1': 'arrow-right', '\u2190': 'arrow-left',
    '\U0001f64f': 'hand', '\U0001f79f': 'bandage', '\U0001f514': 'bell',
    '\u2757': 'alert-circle', '\U0001f4e9': 'mail', '\U0001f4e4': 'upload',
    '\U0001f4c1': 'folder', '\U0001f4ad': 'message-circle', '\u2197': 'arrow-up-right',
    '\u2196': 'arrow-up-left', '\u21bb': 'refresh-cw', '\u27f0': 'arrow-up',
    '\u23f3': 'clock', '\u231b': 'clock', '\u26a1': 'zap',
    '\U0001f4a5': 'sparkles', '\U0001f4ab': 'sparkles', '\u2728': 'sparkles',
    '\U0001f4b8': 'dollar-sign', '\U0001f4b9': 'trending-up', '\U0001f4c9': 'trending-up',
    '\U0001f4c4': 'file-text', '\U0001f4cc': 'pin', '\U0001f4ce': 'paperclip',
    '\U0001f4cf': 'ruler', '\U0001f4d1': 'bookmark', '\U0001f4d6': 'book',
    '\U0001f4da': 'library', '\U0001f4db': 'database', '\U0001f4dc': 'scroll',
    '\U0001f4de': 'phone', '\U0001f4e0': 'smartphone', '\U0001f4e2': 'bell', '\U0001f4e3': 'bell',
    '\U0001f4e7': 'mail', '\U0001f4ea': 'mail', '\U0001f4eb': 'mail',
    '\U0001f4f0': 'mail', '\U0001f4f6': 'antenna', '\U0001f4fa': 'monitor', '\U0001f4fb': 'monitor',
    '\U0001f500': 'refresh-cw', '\U0001f501': 'refresh-cw', '\U0001f502': 'refresh-cw',
    '\U0001f503': 'refresh-cw', '\U0001f507': 'speaker', '\U0001f508': 'speaker',
    '\U0001f509': 'speaker', '\U0001f50a': 'speaker', '\U0001f50b': 'battery',
    '\U0001f50c': 'zap', '\U0001f50e': 'search', '\U0001f50f': 'lock', '\U0001f511': 'key',
    '\U0001f512': 'lock', '\U0001f513': 'unlock', '\U0001f515': 'bell-off',
    '\U0001f516': 'bookmark', '\U0001f519': 'arrow-left', '\U0001f51a': 'arrow-right',
    '\U0001f51b': 'arrow-right', '\U0001f51c': 'arrow-right', '\U0001f51d': 'arrow-right',
    '\U0001f51e': 'ban', '\U0001f527': 'wrench', '\U0001f528': 'hammer', '\U0001f52a': 'scissors',
    '\U0001f52c': 'microscope', '\U0001f52d': 'telescope', '\U0001f533': 'square',
    '\U0001f532': 'square', '\U0001f53a': 'triangle', '\U0001f53c': 'arrow-up',
    '\U0001f53d': 'arrow-down', '\U0001f550': 'clock', '\U0001f551': 'clock',
    '\U0001f554': 'clock', '\U0001f555': 'clock', '\U0001f556': 'clock',
    '\U0001f557': 'clock', '\U0001f558': 'clock', '\U0001f559': 'clock',
    '\U0001f55a': 'clock', '\U0001f55b': 'clock', '\U0001f55c': 'clock',
    '\U0001f55d': 'clock', '\U0001f55e': 'clock', '\U0001f55f': 'clock',
    '\U0001f560': 'clock', '\U0001f561': 'clock', '\U0001f562': 'clock',
    '\U0001f563': 'clock', '\U0001f564': 'clock', '\U0001f565': 'clock',
    '\U0001f566': 'clock', '\U0001f567': 'clock', '\U0001f574': 'user',
    '\U0001f575': 'user', '\U0001f576': 'eye-off', '\U0001f57a': 'user',
    '\U0001f58a': 'pencil', '\U0001f58b': 'pencil', '\U0001f58c': 'pencil',
    '\U0001f58d': 'pencil', '\U0001f590': 'hand', '\U0001f595': 'hand',
    '\U0001f596': 'hand', '\U0001f5a4': 'heart', '\U0001f5a5': 'monitor',
    '\U0001f5b1': 'save', '\U0001f5b2': 'save', '\U0001f5c2': 'folder',
    '\U0001f5c3': 'folder', '\U0001f5c4': 'archive', '\U0001f5d2': 'trash-2',
    '\U0001f5d3': 'calendar', '\U0001f5dd': 'lock', '\U0001f5de': 'mail',
    '\U0001f5e3': 'message-circle', '\U0001f5e8': 'message-circle', '\U0001f5fa': 'globe',
    '\U0001f5fb': 'landmark', '\U0001f5fc': 'landmark', '\U0001f5fd': 'landmark',
    '\U0001f5fe': 'map-pin', '\U0001f5ff': 'landmark',
    # emoji faces → generic smile
    '\U0001f642': 'smile', '\U0001f643': 'smile', '\U0001f600': 'smile',
    '\U0001f601': 'smile', '\U0001f602': 'smile', '\U0001f603': 'smile',
    '\U0001f604': 'smile', '\U0001f605': 'smile', '\U0001f606': 'smile',
    '\U0001f609': 'smile', '\U0001f60a': 'smile', '\U0001f60d': 'heart',
    '\U0001f60e': 'smile', '\U0001f610': 'smile', '\U0001f611': 'smile',
    '\U0001f612': 'smile', '\U0001f613': 'smile', '\U0001f614': 'smile',
    '\U0001f615': 'smile', '\U0001f616': 'smile', '\U0001f617': 'smile',
    '\U0001f618': 'smile', '\U0001f619': 'smile', '\U0001f61a': 'smile',
    '\U0001f61b': 'smile', '\U0001f61c': 'smile', '\U0001f61d': 'smile',
    '\U0001f61e': 'smile', '\U0001f61f': 'smile', '\U0001f620': 'smile',
    '\U0001f621': 'smile', '\U0001f622': 'smile', '\U0001f623': 'smile',
    '\U0001f624': 'smile', '\U0001f625': 'smile', '\U0001f626': 'smile',
    '\U0001f627': 'smile', '\U0001f628': 'smile', '\U0001f629': 'smile',
    '\U0001f62a': 'smile', '\U0001f62b': 'smile', '\U0001f62c': 'smile',
    '\U0001f62d': 'smile', '\U0001f62e': 'smile', '\U0001f62f': 'smile',
    '\U0001f630': 'smile', '\U0001f631': 'smile', '\U0001f632': 'smile',
    '\U0001f633': 'smile', '\U0001f634': 'smile', '\U0001f635': 'smile',
    '\U0001f636': 'smile', '\U0001f637': 'smile', '\U0001f638': 'smile',
    '\U0001f639': 'smile', '\U0001f63a': 'smile', '\U0001f63b': 'smile',
    '\U0001f63c': 'smile', '\U0001f63d': 'smile', '\U0001f63e': 'smile',
    '\U0001f63f': 'smile', '\U0001f640': 'smile',
    '\U0001f44b': 'hand',  # 👋 wave
    '\U0001f49a': 'heart',  # 💚
    '\U0001f49c': 'heart',  # 💜
    '\U0001f4b2': 'dollar-sign',  # 💲
    '\U0001f534': 'circle',  # 🔴
    '\U0001f6a8': 'alert-triangle',  # 🚨
    '\U0001f6e1': 'shield',  # 🛡
    '\U0001f6f5': 'bike',  # 🛵
    '\U0001f7e1': 'circle',  # 🟡
    '\U0001f90d': 'heart',  # 🤍
    '\U0001f91d': 'handshake',  # 🤝
    '\U0001f950': 'croissant',  # 🥐
    '\U0001f9fe': 'receipt',  # 🧾
    '\u27a4': 'arrow-right',  # ➤
    '\U0001f35e': 'wheat',  # 🍞
    '\U0001f3ac': 'clapperboard',  # 🎬
    '\U0001f331': 'sprout',  # 🌱
    '\U0001f3e2': 'building',  # 🏢
    '\U0001f30d': 'globe',  # 🌍
    '\U0001f30f': 'globe',  # 🌏
    '\U0001f381': 'gift',  # 🎁
    '\U0001f44d': 'thumbs-up',  # 👍
    '\U0001f44e': 'thumbs-down',  # 👎
    '\U0001f4a3': 'bomb',  # 💣
    '\U0001f525': 'flame',  # 🔥
    '\U0001f4a6': 'droplet',  # 💦
}

# Multi-codepoint emoji
MULTI = {
    '\U0001f9d1\u200d\U0001f4bc': 'briefcase',  # 🧑‍💼
    '\U0001f469\u200d\U0001f4bc': 'briefcase',  # 👩‍💼
    '\u2764\ufe0f': 'heart',
    '\u2139\ufe0f': 'info',
    '\u2192\ufe0f': 'arrow-right',
    '\u2b50\ufe0f': 'star',
    '\u2699\ufe0f': 'settings',
    '\u26a0\ufe0f': 'alert-triangle',
    '\u270f\ufe0f': 'pencil',
    '\u2714\ufe0f': 'check',
    '\u2716\ufe0f': 'x',
    '\u2709\ufe0f': 'mail',
    '\u2197\ufe0f': 'arrow-up-right',
    '\u2764\ufe0f': 'heart',
}

# Emoji that MUST stay as emoji (data / text, not icons)
KEEP_EMOJI = set('★☆✓➤🇮🇩'.split())  # ratings, checks, flags
KEEP_EMOJI = {'\u2605', '\u2606', '\u2713', '\U0001f1ee', '\U0001f1e9', '\u27a4'}


def build_pattern():
    multi = sorted(MULTI.keys(), key=len, reverse=True)
    single = sorted(EMOJI_MAP.keys(), key=len, reverse=True)
    parts = [re.escape(m) for m in multi] + [re.escape(s) for s in single]
    return re.compile('|'.join(parts))


def lookup(seq):
    if seq in MULTI:
        return MULTI[seq]
    if seq in EMOJI_MAP:
        return EMOJI_MAP[seq]
    return None


def line_flags(ln):
    """Per-line context flags."""
    return {
        # WhatsApp message templates — emoji are TEXT content, keep them!
        'wa': bool(re.search(r'\\n|%0A|\*[A-Za-z]|wa\.me|window\.open\(`?[\'"]?https://wa', ln)) and bool(re.search(r'`|\+ *\'', ln)),
        # placeholder / textContent / alert / confirm — data or text, keep emoji
        'strip': bool(re.search(r'\.textContent\s*=|placeholder=|alert\(|confirm\(|setTitle\(|prompt\(', ln)),
        # category icon input value — data
        'keep': bool(re.search(r'catIcon|cat\.icon|category\.icon', ln)),
        # product specs data ("Food Grade": "✅ Ya...")
        'specs': bool(re.search(r'"[^"]+":\s*"', ln)) and bool(re.search(r'[\U0001F000-\U0001FAFF\u2600-\u27BF]', ln)),
    }


SVG_HTML = '<svg class="ic" aria-hidden="true"><use href="#i-{n}"/></svg>'


def replace_in_html(text, emoji_re):
    """Replace emoji in HTML context (outside <script>)."""
    def rep(m):
        seq = m.group(0)
        if seq in KEEP_EMOJI:
            return seq
        n = lookup(seq)
        return SVG_HTML.format(n=n) if n else seq
    return emoji_re.sub(rep, text)


def process_js_block(js, emoji_re):
    """Process a full JS block char-by-char, respecting string/template/comment
    states that persist across lines. Flags are precomputed per line.

    Uses an explicit stack to track nested template literals and their
    ${...} interpolations, so state always returns correctly. Each stack
    entry stores (return_state, saved_brace_depth) so object-literal braces
    inside a ${...} expression are tracked PER EXPRESSION LEVEL (not global):
      - 'bt' + '$'+'{'  -> push ('bt', brace_depth); brace_depth=0; state='code'
      - 'code'(expr) + '}' (brace_depth==0) -> pop -> restore brace_depth, back to 'bt'
      - 'code' + '`' (nested template) -> push ('code', brace_depth); state='bt'
      - 'bt' + '`' (template close) -> pop -> restore brace_depth and state
    """
    out = []
    i = 0
    n = len(js)
    state = 'code'  # code | sq | dq | bt | lc | bc | re
    stack = []       # (return_state, saved_brace_depth) for template nesting
    brace_depth = 0  # object-literal/function-body braces inside current ${...} expr

    lines = js.split('\n')
    flags_list = [line_flags(ln) for ln in lines]
    offsets = [0]
    for ln in lines:
        offsets.append(offsets[-1] + len(ln) + 1)
    line_idx = 0
    cur_flags = flags_list[0]

    def in_expr():
        return state == 'code' and stack and stack[-1][0] == 'bt'

    def push(s):
        stack.append((s, brace_depth))

    def pop_state():
        nonlocal brace_depth
        st, bd = stack.pop() if stack else ('code', 0)
        brace_depth = bd
        return st

    while i < n:
        ch = js[i]
        nxt = js[i+1] if i+1 < n else ''
        while line_idx + 1 < len(offsets) and i >= offsets[line_idx + 1]:
            line_idx += 1
            cur_flags = flags_list[line_idx]

        m = emoji_re.match(js, i)
        if m:
            seq = m.group(0)
            icon = lookup(seq)
            if icon:
                if seq in KEEP_EMOJI:
                    out.append(seq)
                elif cur_flags.get('wa'):
                    out.append(seq)  # keep emoji in WA messages
                elif cur_flags.get('keep') or cur_flags.get('specs'):
                    out.append(seq)
                elif cur_flags.get('strip'):
                    out.append(seq)  # keep emoji (textContent hearts etc)
                elif state == 'code':
                    out.append(f'IC("{icon}")')
                elif state == 'sq':
                    out.append(f'\' + IC("{icon}") + \'')
                elif state == 'dq':
                    out.append(f'" + IC(\'{icon}\') + "')
                elif state == 'bt':
                    out.append(f'${{IC("{icon}")}}')
                else:  # comment
                    out.append(seq)
            else:
                out.append(seq)
            i = m.end()
            continue
        if ch == '\n':
            if state == 'lc':
                state = 'code'
            out.append(ch)
            i += 1
            continue
        if state == 'code':
            if ch == '/' and nxt == '/':
                state = 'lc'; out.append(ch); out.append(nxt); i += 2; continue
            if ch == '/' and nxt == '*':
                state = 'bc'; out.append(ch); out.append(nxt); i += 2; continue
            if ch == '/' and nxt in ('"', "'", '\\'):
                state = 're'; out.append(ch); i += 1; continue
            if ch == '\\' and nxt in ('"', "'"):
                out.append(ch); out.append(nxt); i += 2; continue
            if in_expr():
                # inside ${...} expression: handle quotes, braces, nested templates
                if ch == "'":
                    state = 'sq'
                elif ch == '"':
                    state = 'dq'
                elif ch == '`':
                    push('code'); state = 'bt'
                elif ch == '{':
                    brace_depth += 1
                elif ch == '}' and brace_depth > 0:
                    brace_depth -= 1
                elif ch == '}' and brace_depth == 0:
                    state = pop_state()
                out.append(ch); i += 1; continue
            if ch == "'":
                state = 'sq'
            elif ch == '"':
                state = 'dq'
            elif ch == '`':
                push('code'); state = 'bt'
            out.append(ch); i += 1; continue
        elif state == 're':
            if ch == '\\':
                out.append(ch); out.append(nxt if i+1 < n else ''); i += 2; continue
            if ch == '/':
                state = 'code'
            out.append(ch); i += 1; continue
        elif state == 'lc':
            out.append(ch); i += 1; continue
        elif state == 'bc':
            if ch == '*' and nxt == '/':
                state = 'code'; out.append(ch); out.append(nxt); i += 2; continue
            out.append(ch); i += 1; continue
        elif state == 'sq':
            if ch == '\\':
                out.append(ch); out.append(nxt if i+1 < n else ''); i += 2; continue
            if ch == "'":
                state = 'code'
            out.append(ch); i += 1; continue
        elif state == 'dq':
            if ch == '\\':
                out.append(ch); out.append(nxt if i+1 < n else ''); i += 2; continue
            if ch == '"':
                state = 'code'
            out.append(ch); i += 1; continue
        elif state == 'bt':
            if ch == '\\':
                out.append(ch); out.append(nxt if i+1 < n else ''); i += 2; continue
            if ch == '`':
                state = pop_state()
            elif ch == '$' and nxt == '{':
                push('bt')
                brace_depth = 0
                state = 'code'
                out.append(ch); out.append(nxt); i += 2; continue
            out.append(ch); i += 1; continue
    return ''.join(out)


CSS = '''
.ic{width:1.1em;height:1.1em;vertical-align:-0.15em;display:inline-block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.wish-btn .ic,.icon .ic{width:18px;height:18px;vertical-align:middle}
'''

IC_HELPER = '''
// ── Icon helper: returns inline SVG <use> referencing the sprite ──
window.IC = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
var IC = window.IC;
'''


def process_file(path, sprite_html, css, inject_helper=True):
    src = open(path).read()
    emoji_re = build_pattern()

    # Split into HTML context and script blocks
    parts = re.split(r'(<script[^>]*>.*?</script>)', src, flags=re.DOTALL)
    out_parts = []
    for p in parts:
        if p.startswith('<script'):
            m = re.match(r'(<script[^>]*>)(.*?)(</script>)', p, re.DOTALL)
            open_tag, js, close_tag = m.group(1), m.group(2), m.group(3)
            # Skip JSON-LD / external src blocks
            if 'src=' in open_tag or 'application/ld+json' in open_tag:
                out_parts.append(p)
                continue
            out_parts.append(open_tag + process_js_block(js, emoji_re) + close_tag)
        else:
            out_parts.append(replace_in_html(p, emoji_re))
    result = ''.join(out_parts)

    # Inject sprite + CSS before </body> (idempotent)
    if inject_helper and 'Lucide SVG Icon Sprite' not in result:
        inject = f'\n<!-- ===== Lucide SVG Icon Sprite ===== -->\n{sprite_html}\n<style>{css}</style>\n'
        result = result.replace('</body>', inject + '</body>')

    # Inject IC() helper at top of first EXECUTABLE script (idempotent)
    # Must skip ld+json and external-src scripts (browser doesn't run their body)
    if inject_helper and 'window.IC =' not in result:
        m = re.search(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>', result)
        if m:
            pos = m.end()
            result = result[:pos] + '\n' + IC_HELPER + result[pos:]

    return result


if __name__ == '__main__':
    sprite = open('/home/ubuntu/murah-plastic/icon-sprite.html').read()
    files = sys.argv[1:] or [
        'public/index.html', 'public/admin.html', 'public/akun.html',
        'public/cart.html', 'public/checkout.html', 'public/tentang-kami.html',
        'public/faq.html', 'public/artikel.html', 'public/offline.html',
    ]
    for fname in files:
        path = f'/home/ubuntu/murah-plastic/{fname}'
        if not os.path.exists(path):
            print(f'SKIP {fname} (not found)')
            continue
        result = process_file(path, sprite, CSS)
        if result is None or result == open(path).read():
            print(f'  {fname}: no changes')
            continue
        # Backup
        bak = path + '.bak3'
        if not os.path.exists(bak):
            os.rename(path, bak)
        with open(path, 'w') as f:
            f.write(result)
        orig = len(open(bak).read())
        new = len(result)
        print(f'  {fname}: {orig} → {new} chars')

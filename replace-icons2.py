#!/usr/bin/env python3
"""
Replace emoji icons with Lucide SVG references in admin.html and akun.html.
Context-aware: HTML outside <script> → inline SVG; JS strings → concat splice;
template literals → ${IC('name')}; textContent/placeholder/data → strip/keep.
"""
import re, sys

# ── Emoji → icon mapping (single codepoints) ──
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
    '\U0001f3a7': 'headphones', '\U0001f9f9': 'broom', '\u2764': 'heart',
    '\U0001f6aa': 'log-out', '\u2714': 'check', '\U0001f4af': 'award', '\U0001f3a5': 'video', '\U0001f4f8': 'camera',
    '\U0001f4f2': 'smartphone', '\U0001f4ee': 'mail', '\U0001f4e8': 'mail',
    '\U0001f4cd': 'map-pin', '\u27a1': 'arrow-right', '\u2190': 'arrow-left',
    '\U0001f64f': 'hand', '\U0001f79f': 'bandage', '\U0001f514': 'bell',
    '\u2757': 'alert-circle', '\U0001f4e9': 'mail', '\U0001f4e4': 'upload',
    '\U0001f4c1': 'folder', '\U0001f4ad': 'message-circle', '\u2197': 'arrow-up-right',
    '\u2196': 'arrow-up-left', '\u21bb': 'refresh-cw', '\u27f0': 'arrow-up',
    '\u23f3': 'clock', '\u231b': 'clock', '\u26a1': 'zap', '\u26bd': 'circle',
    '\U0001f3c1': 'trophy', '\U0001f3c5': 'award', '\U0001f947': 'award',
    '\U0001f948': 'award', '\U0001f949': 'award', '\U0001f44d': 'thumbs-up',
    '\U0001f525': 'flame', '\U0001f4a5': 'sparkles', '\U0001f4ab': 'sparkles',
    '\u2728': 'sparkles', '\U0001f4b8': 'dollar-sign', '\U0001f4b9': 'trending-up',
    '\U0001f4c9': 'trending-up', '\U0001f4c4': 'file-text', '\U0001f4cc': 'pin',
    '\U0001f4ce': 'paperclip', '\U0001f4cf': 'ruler', '\U0001f4d1': 'bookmark',
    '\U0001f4d6': 'book', '\U0001f4da': 'library', '\U0001f4db': 'database',
    '\U0001f4dc': 'scroll', '\U0001f4de': 'phone', '\U0001f4e0': 'smartphone',
    '\U0001f4e2': 'bell', '\U0001f4e3': 'bell', '\U0001f4e6': 'package',
    '\U0001f4e7': 'mail', '\U0001f4ea': 'mail', '\U0001f4eb': 'mail',
    '\U0001f4f0': 'mail', '\U0001f4f6': 'antenna', '\U0001f4fa': 'monitor',
    '\U0001f4fb': 'monitor', '\U0001f500': 'refresh-cw', '\U0001f501': 'refresh-cw',
    '\U0001f502': 'refresh-cw', '\U0001f503': 'refresh-cw', '\U0001f507': 'speaker',
    '\U0001f508': 'speaker', '\U0001f509': 'speaker', '\U0001f50a': 'speaker',
    '\U0001f50b': 'battery', '\U0001f50c': 'zap', '\U0001f50e': 'search',
    '\U0001f50f': 'lock', '\U0001f511': 'key', '\U0001f512': 'lock',
    '\U0001f513': 'unlock', '\U0001f515': 'bell-off', '\U0001f516': 'bookmark',
    '\U0001f519': 'arrow-left', '\U0001f51a': 'arrow-right', '\U0001f51b': 'arrow-right',
    '\U0001f51c': 'arrow-right', '\U0001f51d': 'arrow-right', '\U0001f51e': 'ban',
    '\U0001f527': 'wrench', '\U0001f528': 'hammer', '\U0001f52a': 'scissors',
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
    # emoji faces → keep mapping minimal, use generic
    '\U0001f642': 'smile', '\U0001f643': 'smile', '\U0001f600': 'smile',
    '\U0001f601': 'smile', '\U0001f602': 'smile', '\U0001f603': 'smile',
    '\U0001f604': 'smile', '\U0001f605': 'smile', '\U0001f606': 'smile',
    '\U0001f609': 'smile', '\U0001f60a': 'smile', '\U0001f60d': 'heart',
    '\U0001f60e': 'smile', '\U0001f610': 'smile', '\U0001f611': 'smile',
    '\U0001f612': 'smile', '\U0001f613': 'smile', '\U0001f614': 'smile',
    '\U0001f615': 'smile', '\U0001f616': 'smile', '\U0001f617': 'smile',
    '\U0001f618': 'smile', '\U0001f61a': 'smile', '\U0001f61b': 'smile',
    '\U0001f61c': 'smile', '\U0001f61d': 'smile', '\U0001f61e': 'smile',
    '\U0001f61f': 'smile', '\U0001f620': 'smile', '\U0001f621': 'smile',
    '\U0001f622': 'smile', '\U0001f623': 'smile', '\U0001f624': 'smile',
    '\U0001f625': 'smile', '\U0001f626': 'smile', '\U0001f627': 'smile',
    '\U0001f628': 'smile', '\U0001f629': 'smile', '\U0001f62a': 'smile',
    '\U0001f62b': 'smile', '\U0001f62c': 'smile', '\U0001f62d': 'smile',
    '\U0001f62e': 'smile', '\U0001f62f': 'smile', '\U0001f630': 'smile',
    '\U0001f631': 'smile', '\U0001f632': 'smile', '\U0001f633': 'smile',
    '\U0001f634': 'smile', '\U0001f635': 'smile', '\U0001f636': 'smile',
    '\U0001f637': 'smile', '\U0001f638': 'smile', '\U0001f639': 'smile',
    '\U0001f63a': 'smile', '\U0001f63b': 'smile', '\U0001f63c': 'smile',
    '\U0001f63d': 'smile', '\U0001f63e': 'smile', '\U0001f63f': 'smile',
    '\U0001f640': 'smile', '\U0001f641': 'smile', '\U0001f644': 'smile',
    '\U0001f645': 'hand', '\U0001f646': 'hand', '\U0001f647': 'hand',
    '\U0001f64b': 'user', '\U0001f64c': 'hand', '\U0001f64d': 'hand',
    '\U0001f64e': 'hand',
    # misc used in code
    '\u26aa': 'circle', '\u26ab': 'circle', '\u2b1b': 'square', '\u2b1c': 'square',
    '\u2702': 'scissors', '\u2708': 'plane', '\u270a': 'hand', '\u270b': 'hand',
    '\u270c': 'hand', '\u270d': 'pencil', '\u2712': 'pencil', '\u271d': 'star',
    '\u2721': 'star', '\u2733': 'star', '\u2734': 'star', '\u2744': 'snowflake',
    '\u2747': 'sparkles', '\u274e': 'x-circle', '\u2754': 'help-circle',
    '\u2755': 'help-circle', '\u2763': 'heart', '\u2796': 'minus', '\u2797': 'divide',
    '\u2934': 'arrow-up-right', '\u2935': 'arrow-right', '\u2b05': 'arrow-left',
    '\u2b06': 'arrow-up', '\u2b55': 'circle', '\u3030': 'minus', '\u2764\ufe0f': 'heart',
    '\u2139': 'info', '\u2139\ufe0f': 'info', '\u2192\ufe0f': 'arrow-right', '\u2b50\ufe0f': 'star', '\u2699\ufe0f': 'settings',
    '\u26a0\ufe0f': 'alert-triangle', '\u270f\ufe0f': 'pencil', '\u2714\ufe0f': 'check',
    '\u2716\ufe0f': 'x', '\u2709\ufe0f': 'mail', '\u2197\ufe0f': 'arrow-up-right',
    '\u2764\ufe0f': 'heart',
}

# Multi-codepoint (longest first)
MULTI = {
    '\U0001f9d1\u200d\U0001f4bc': 'user-cog',  # 🧑‍💼
    '\U0001f6cd\ufe0f': 'shopping-bag',
    '\U0001f6e0\ufe0f': 'wrench',
    '\u2699\ufe0f': 'settings',
    '\u26a0\ufe0f': 'alert-triangle',
    '\u2b50\ufe0f': 'star',
    '\u2764\ufe0f': 'heart',
    '\u270f\ufe0f': 'pencil',
    '\u2714\ufe0f': 'check',
    '\u2716\ufe0f': 'x',
    '\u2709\ufe0f': 'mail',
    '\u2197\ufe0f': 'arrow-up-right',
    '\u2192\ufe0f': 'arrow-right',
    '\u23f3\ufe0f': 'clock',
    '\u2b07\ufe0f': 'download',
    '\u27a1\ufe0f': 'arrow-right',
    '\u21bb\ufe0f': 'refresh-cw',
    '\u2630\ufe0f': 'menu',
    '\u26a1\ufe0f': 'zap',
    '\u2757\ufe0f': 'alert-circle',
    '\u2753\ufe0f': 'help-circle',
    '\u2795\ufe0f': 'plus',
    '\u2796\ufe0f': 'minus',
}

# Build combined multi-char alternatives
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

# Line-level context flags
def line_flags(ln):
    return {
        'strip': bool(re.search(r'\.textContent\s*=|placeholder=|alert\(|confirm\(|setTitle\(|prompt\(', ln)),
        'keep': bool(re.search(r'catIcon|cat\.icon|category\.icon', ln)),
        'def_line': bool(re.search(r'(ROLE_LABELS|TAB_TITLES|TAB_TITLES_EXTRA)\s*=', ln)),
    }

SVG_HTML = '<svg class="ic" aria-hidden="true"><use href="#i-{n}"/></svg>'

def replace_in_html(text, emoji_re):
    """Replace emoji in HTML context (outside <script>)."""
    def rep(m):
        n = lookup(m.group(0))
        return SVG_HTML.format(n=n) if n else m.group(0)
    return emoji_re.sub(rep, text)

def process_js_block(js, emoji_re):
    """Process a full JS block char-by-char, respecting string/template/comment
    states that persist across lines. Flags are precomputed per line."""
    out = []
    i = 0
    n = len(js)
    state = 'code'  # code | sq | dq | bt | lc | bc | re
    expr_depth = 0  # inside ${ } of template literal

    # precompute per-line flags and offsets
    lines = js.split('\n')
    flags_list = [line_flags(ln) for ln in lines]
    offsets = [0]
    for ln in lines:
        offsets.append(offsets[-1] + len(ln) + 1)  # +1 for newline
    line_idx = 0
    cur_flags = flags_list[0]

    while i < n:
        ch = js[i]
        nxt = js[i+1] if i+1 < n else ''
        # advance line index if we've crossed into a new line
        while line_idx + 1 < len(offsets) and i >= offsets[line_idx + 1]:
            line_idx += 1
            cur_flags = flags_list[line_idx]

        m = emoji_re.match(js, i)
        if m:
            seq = m.group(0)
            icon = lookup(seq)
            if icon:
                if cur_flags.get('keep'):
                    out.append(seq)
                elif cur_flags.get('strip') or cur_flags.get('def_line'):
                    out.append('')
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
        # newline handling: line comment resets
        if ch == '\n':
            if state == 'lc':
                state = 'code'
            out.append(ch)
            i += 1
            continue
        # state transitions
        if state == 'code':
            if ch == '/' and nxt == '/':
                state = 'lc'; out.append(ch); out.append(nxt); i += 2; continue
            if ch == '/' and nxt == '*':
                state = 'bc'; out.append(ch); out.append(nxt); i += 2; continue
            if ch == '/' and nxt in ('"', "'", '\\'):
                # regex literal start (heuristic: /" or /' cannot be division)
                state = 're'; out.append(ch); i += 1; continue
            if ch == '\\' and nxt in ('"', "'"):
                # escape for regex literal — don't enter string
                out.append(ch); out.append(nxt); i += 2; continue
            if ch == "'":
                state = 'sq'
            elif ch == '"':
                state = 'dq'
            elif ch == '`':
                state = 'bt'
            out.append(ch); i += 1; continue
        elif state == 're':
            # inside regex literal: skip until unescaped /
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
                state = 'code'
            elif ch == '$' and nxt == '{':
                expr_depth += 1
            elif ch == '}' and expr_depth > 0:
                expr_depth -= 1
            out.append(ch); i += 1; continue
    return ''.join(out)

def process_file(path, sprite_html, css):
    src = open(path).read()
    emoji_re = build_pattern()
    # Split into segments by <script>...</script>
    script_re = re.compile(r'(<script(?![^>]*src=)[^>]*>)(.*?)(</script>)', re.S)
    parts = []
    last = 0
    for m in script_re.finditer(src):
        parts.append(('html', src[last:m.start()]))
        parts.append(('js', m.group(1), m.group(2), m.group(3)))
        last = m.end()
    parts.append(('html', src[last:]))
    
    out_parts = []
    for part in parts:
        if part[0] == 'html':
            out_parts.append(replace_in_html(part[1], emoji_re))
        else:
            open_tag, js, close_tag = part[1], part[2], part[3]
            processed = process_js_block(js, emoji_re)
            out_parts.append(open_tag + processed + close_tag)
    
    result = ''.join(out_parts)
    # Inject sprite + CSS before </body> (idempotent)
    if 'Lucide SVG Icon Sprite' not in result:
        inject = f'\n<!-- ===== Lucide SVG Icon Sprite ===== -->\n{sprite_html}\n<style>{css}</style>\n'
        result = result.replace('</body>', inject + '</body>')
    # Inject IC() helper at top of first script (idempotent)
    ic_helper = '''
// ── Icon helper: returns inline SVG <use> referencing the sprite ──
const IC = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
'''
    if 'const IC =' not in result:
        m = re.search(r'<script[^>]*>', result)
        if m:
            pos = m.end()
            result = result[:pos] + '\n' + ic_helper + result[pos:]
    return result

CSS = '''
.ic{width:1.1em;height:1.1em;vertical-align:-0.18em;display:inline-block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.nav-item .icon .ic{width:18px;height:18px;vertical-align:middle}
.stat-label .ic{width:14px;height:14px;vertical-align:-2px}
.empty-icon .ic{width:40px;height:40px;vertical-align:middle}
.toast .ic{width:15px;height:15px;vertical-align:-2px}
'''

if __name__ == '__main__':
    sprite = open('/home/ubuntu/murah-plastic/icon-sprite.html').read()
    for fname in ['public/admin.html', 'public/akun.html']:
        path = f'/home/ubuntu/murah-plastic/{fname}'
        print(f'Processing {fname}...')
        result = process_file(path, sprite, CSS)
        # backup
        import shutil
        shutil.copy2(path, path + '.bak2')
        with open(path, 'w') as f:
            f.write(result)
        print(f'  done: {len(result)} chars (was {len(open(path+".bak2").read())})')
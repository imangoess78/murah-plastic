#!/usr/bin/env python3
"""Process site.js emoji with context-aware state machine (reuse replace-icons3.py)."""
import os, re, importlib.util

# load replace-icons3 as a module
spec = importlib.util.spec_from_file_location("ricon", "/home/ubuntu/murah-plastic/replace-icons3.py")
ricon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ricon)

process_js_block = ricon.process_js_block
emoji_re = ricon.build_pattern()

path = 'public/assets/site.js'
bak = path + '.bak3'
src = open(path).read()

# Backup
if not os.path.exists(bak):
    os.rename(path, bak)

# Process the entire .js file as a single JS block
result = process_js_block(src, emoji_re)

# Build reverse map: icon_name -> original emoji (longest first)
EMOJI_TO_ICON = {}
for k, v in ricon.EMOJI_MAP.items():
    EMOJI_TO_ICON[v] = k
for k, v in ricon.MULTI.items():
    EMOJI_TO_ICON[v] = k

# Post-process: restore emoji in DATA contexts (chat, quick replies, notif data).
# process_js_block already replaces emoji with IC(...) concat/template forms;
# here we revert those back to the original emoji ONLY inside data-context strings.
DATA_PATTERNS = [
    # Quick reply labels: {label:'💳 Pembayaran', ...}
    r"label:\s*'([^']*)'",
    # Notif icon data: icon: '💳'
    r"icon:\s*'([^']*)'",
    # Notif title/desc data
    r"(?:title|desc):\s*'([^']*)'",
    # Chat response backtick templates
    r"response\s*=\s*`([^`]*)`",
    # CHAT_RESPONSES[key] = '...'
    r"CHAT_RESPONSES\[\s*[^]]+\]\s*=\s*'([^']*)'",
    # Notif body backtick
    r"body:\s*`([^`]*)`",
]

def restore_emoji_inner(inner):
    """Revert IC(...) concat/template forms back to original emoji."""
    # single-quote concat: '' + IC("name") + ''
    new = re.sub(
        r"''\s*\+\s*IC\(['\"]([^'\"]+)['\"]\)\s*\+\s*''",
        lambda m: EMOJI_TO_ICON.get(m.group(1), m.group(0)),
        inner
    )
    # double-quote concat: "" + IC('name') + ""
    new = re.sub(
        r'""\s*\+\s*IC\(["\']([^"\']+)["\']\)\s*\+\s*""',
        lambda m: EMOJI_TO_ICON.get(m.group(1), m.group(0)),
        new
    )
    # template literal: ${IC("name")}
    new = re.sub(
        r'\$\{IC\(["\']([^"\']+)["\']\)\}',
        lambda m: EMOJI_TO_ICON.get(m.group(1), m.group(0)),
        new
    )
    # spaced concat: ' ' + IC("name") + ' '
    new = re.sub(
        r"' ?\+ ?IC\(['\"]?([^'\"\)]+)['\"]?\) ?\+ ?'",
        lambda m: EMOJI_TO_ICON.get(m.group(1), m.group(0)),
        new
    )
    return new

def restore_emoji(text):
    for pat in DATA_PATTERNS:
        def replacer(m):
            full = m.group(0)
            inner = m.group(1)
            if 'IC(' not in inner:
                return full
            new_inner = restore_emoji_inner(inner)
            if new_inner == inner:
                return full
            return full.replace(inner, new_inner)
        text = re.sub(pat, replacer, text)
    return text

result = restore_emoji(result)

if result != src:
    open(path, 'w').write(result)
    print(f'  {path}: {len(src)} -> {len(result)} chars')
else:
    print(f'  {path}: no changes')
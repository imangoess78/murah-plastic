#!/usr/bin/env python3
"""
Replace all emoji icons in admin.html and akun.html with Lucide SVG icons.
Strategy:
- HTML context: emoji → inline SVG <use> reference
- JS context (template literals): emoji → ${IC('name')}
- JS textContent/placeholder: strip emoji
- ROLE_LABELS, TAB_TITLES: strip emoji (clean text), add IC at render point
- Special: topbarTitle → use innerHTML + IC
"""
import re, sys, os

# ── Emoji → Lucide icon name mapping ──
# Keys are the actual emoji characters (normalized, without VS16)
EMOJI_MAP = {
    '\U0001f4ca': 'layout-dashboard',  # 📊 chart
    '\U0001f4e6': 'package',  # 📦 package
    '\U0001f6cd': 'shopping-bag',  # 🛍 shopping bags
    '\U0001f4c2': 'folder',  # 📂 folder
    '\U0001f465': 'users',  # 👥 users
    '\U0001f6e0': 'wrench',  # 🛠 wrench
    '\U0001f4ac': 'message-circle',  # 💬 chat
    '\U0001f4dd': 'file-text',  # 📝 memo
    '\U0001f4c8': 'trending-up',  # 📈 chart up
    '\U0001f4b3': 'credit-card',  # 💳 card
    '\U0001f9d1': 'user',  # 🧑 person
    '\U0001f4bc': 'briefcase',  # 💼 briefcase
    '\u2699': 'settings',  # ⚙ gear
    '\u2630': 'menu',  # ☰ menu
    '\U0001f310': 'globe',  # 🌐 globe
    '\U0001f504': 'refresh-cw',  # 🔄 refresh
    '\U0001f441': 'eye',  # 👁 eye
    '\u2192': 'arrow-right',  # →
    '\u2705': 'check-circle-2',  # ✅ check
    '\u270f': 'pencil',  # ✏ pencil
    '\u274c': 'x-circle',  # ❌ x
    '\u2716': 'x',  # ✕
    '\U0001f5d1': 'trash-2',  # 🗑 trash
    '\u2795': 'plus',  # ➕
    '\U0001f4cb': 'clipboard-list',  # 📋 clipboard
    '\U0001f4be': 'save',  # 💾 save
    '\U0001f464': 'user',  # 👤 user
    '\U0001f4e5': 'download',  # 📥 download
    '\U0001f69a': 'truck',  # 🚚 truck
    '\U0001f50d': 'search',  # 🔍 search
    '\U0001f4f1': 'smartphone',  # 📱 phone
    '\U0001f4b0': 'dollar-sign',  # 💰 money
    '\U0001f4ed': 'inbox',  # 📭 inbox
    '\U0001f389': 'gift',  # 🎉 party
    '\U0001f5a8': 'printer',  # 🖨 printer
    '\U0001f4f7': 'camera',  # 📷 camera
    '\U0001f4a1': 'lightbulb',  # 💡 lightbulb
    '\U0001f5bc': 'image',  # 🖼 image
    '\U0001f3e6': 'landmark',  # 🏦 bank
    '\u2b50': 'star',  # ⭐ star
    '\u275d': 'quote',  # ❝ quote
    '\u2709': 'mail',  # ✉ mail
    '\U0001f6ab': 'ban',  # 🚫 ban
    '\U0001f4f9': 'video',  # 📹 video
    '\U0001f4ec': 'mail',  # 📬 mail
    '\U0001f4c6': 'calendar',  # 📆 calendar
    '\U0001f4c5': 'calendar',  # 📅 calendar
    '\U0001f3f7': 'tag',  # 🏷 tag
    '\U0001f3c6': 'trophy',  # 🏆 trophy
    '\u2b07': 'download',  # ⬇ download
    '\u2753': 'help-circle',  # ❓ help
    '\u26a0': 'alert-triangle',  # ⚠ warning
    '\U0001f680': 'rocket',  # 🚀 rocket
    '\U0001f648': 'eye-off',  # 🙈 hide
    '\U0001f553': 'clock',  # 🕓 clock
    '\U0001f552': 'clock',  # 🕒 clock
    '\U0001f517': 'link',  # 🔗 link
    '\U0001f510': 'lock',  # 🔐 lock
    '\U0001f451': 'crown',  # 👑 crown
    '\U0001f3ea': 'store',  # 🏪 store
    '\U0001f3a7': 'headphones',  # 🎧 headphones
    '\U0001f9f9': 'broom',  # 🧹 broom
    '\u2764': 'heart',  # ❤ heart
    '\U0001f6aa': 'log-out',  # 🚪 logout
    '\u2714': 'check',  # ✔ check
    '\u2605': 'star',  # ★ star
    '\U0001f4af': 'award',  # 💯 100
    '\U0001f3a5': 'video',  # 🎥 video
    '\U0001f4f8': 'camera',  # 📸 camera
    '\U0001f4f2': 'smartphone',  # 📲 phone
    '\U0001f4ee': 'mail',  # 📮 postbox
    '\U0001f4e8': 'mail',  # 📨 mail
    '\U0001f4cd': 'map-pin',  # 📍 pin
    '\U0001f5b1': 'save',  # 🖱? no, this is...
    '\u27a1': 'arrow-right',  # ➡ arrow
    '\U0001f4d6': 'book',  # 📖 book
    '\u2190': 'arrow-left',  # ←
    '\U0001f4d1': 'bookmark',  # 📑 bookmark
    '\U0001f4c4': 'file-text',  # 📄 file
    '\U0001f4c3': 'clipboard-list',  # 📃 clipboard
    '\U0001f64f': 'hand',  # 🙏 pray
    '\U0001f79f': 'bandage',  # 🩹 bandage
    '\U0001f514': 'bell',  # 🔔 bell
    '\U0001f4e9': 'mail',  # 📩 mail
    '\U0001f4e4': 'mail',  # 📤 send
    '\u2757': 'alert-circle',  # ❗ exclamation
    '\U0001f4c1': 'folder',  # 📁 folder
    '\U0001f4ad': 'message-circle',  # 💭 thought
    '\U0001f4a0': 'award',  # 💠 diamond
    '\U0001f3b2': 'dice',  # 🎲 dice
    '\U0001f4b5': 'dollar-sign',  # 💵 dollar
    '\U0001f4b6': 'dollar-sign',  # 💶 euro? no
    '\U0001f4b2': 'dollar-sign',  # 💲 dollar
    '\U0001f38a': 'gift',  # 🎊 confetti
    '\U0001f381': 'gift',  # 🎁 gift
    '\U0001f3c1': 'trophy',  # 🏁 flag
    '\U0001f3c5': 'award',  # 🏅 medal
    '\U0001f947': 'award',  # 🥇 gold
    '\U0001f948': 'award',  # 🥈 silver
    '\U0001f949': 'award',  # 🥉 bronze
    '\U0001f44d': 'thumbs-up',  # 👍 like
    '\U0001f44e': 'thumbs-down',  # 👎 unlike
    '\U0001f4a3': 'bomb',  # 💣 bomb
    '\U0001f525': 'flame',  # 🔥 fire
    '\U0001f4a6': 'droplet',  # 💦 droplet
    '\U0001f4a2': 'alert-circle',  # 💢 anger
    '\U0001f4a5': 'sparkles',  # 💥 boom
    '\U0001f4a8': 'wind',  # 💨 dash
    '\U0001f4aa': 'hand',  # 💪 muscle
    '\U0001f4ab': 'sparkles',  # 💫 dizzy
    '\U0001f4ae': 'sparkles',  # 💮 white flower
    '\U0001f4b8': 'dollar-sign',  # 💸 money
    '\U0001f4b9': 'dollar-sign',  # 💹 chart
    '\U0001f4bc': 'briefcase',  # 💼 bag -> already
    '\U0001f4bd': 'save',  # 💽 disk
    '\U0001f4be': 'save',  # 💾 floppy
    '\U0001f4bf': 'disc',  # 💿 cd
    '\U0001f4c0': 'disc',  # 📀 dvd
    '\U0001f4c4': 'file-text',  # 📄 file
    '\U0001f4c9': 'trending-up',  # 📉 chart down
    '\U0001f4ca': 'layout-dashboard',  # 📊 -> already
    '\U0001f4cb': 'clipboard-list',  # 📋 -> already
    '\U0001f4cc': 'pin',  # 📌 pin
    '\U0001f4cd': 'map-pin',  # 📍 -> already
    '\U0001f4ce': 'paperclip',  # 📎 paperclip
    '\U0001f4cf': 'ruler',  # 📏 ruler
    '\U0001f4d0': 'triangle',  # 📐 triangle
    '\U0001f4d1': 'bookmark',  # 📑 -> already
    '\U0001f4d2': 'edit-3',  # 📒 ledger
    '\U0001f4d3': 'book',  # 📓 notebook
    '\U0001f4d4': 'book',  # 📔 book
    '\U0001f4d5': 'book',  # 📕 book
    '\U0001f4d6': 'book',  # 📖 book
    '\U0001f4d7': 'book',  # 📗 book
    '\U0001f4d8': 'book',  # 📘 book
    '\U0001f4d9': 'book',  # 📙 book
    '\U0001f4da': 'library',  # 📚 books
    '\U0001f4db': 'database',  # 📛 name badge
    '\U0001f4dc': 'scroll',  # 📜 scroll
    '\U0001f4dd': 'file-text',  # 📝 -> already
    '\U0001f4de': 'phone',  # 📞 phone
    '\U0001f4df': 'phone',  # 📟 pager
    '\U0001f4e0': 'smartphone',  # 📠 fax
    '\U0001f4e1': 'smartphone',  # 📡 satellite
    '\U0001f4e2': 'bell',  # 📢 loudspeaker
    '\U0001f4e3': 'bell',  # 📣 megaphone
    '\U0001f4e4': 'upload',  # 📤 outbox
    '\U0001f4e5': 'download',  # 📥 -> already
    '\U0001f4e6': 'package',  # 📦 -> already
    '\U0001f4e7': 'mail',  # 📧 email
    '\U0001f4e8': 'mail',  # 📨 -> already
    '\U0001f4e9': 'mail',  # 📩 -> already
    '\U0001f4ea': 'mail',  # 📪 mailbox
    '\U0001f4eb': 'mail',  # 📫 mailbox
    '\U0001f4ec': 'mail',  # 📬 -> already
    '\U0001f4ed': 'inbox',  # 📭 -> already
    '\U0001f4ee': 'mail',  # 📮 -> already
    '\U0001f4ef': 'mail',  # 📯 posthorn
    '\U0001f4f0': 'mail',  # 📰 newspaper
    '\U0001f4f1': 'smartphone',  # 📱 -> already
    '\U0001f4f2': 'smartphone',  # 📲 -> already
    '\U0001f4f3': 'smartphone',  # 📳 vibration
    '\U0001f4f4': 'smartphone',  # 📴 mobile off
    '\U0001f4f5': 'ban',  # 📵 no mobile
    '\U0001f4f6': 'antenna',  # 📶 signal
    '\U0001f4f7': 'camera',  # 📷 -> already
    '\U0001f4f8': 'camera',  # 📸 -> already
    '\U0001f4f9': 'video',  # 📹 -> already
    '\U0001f4fa': 'monitor',  # 📺 tv
    '\U0001f4fb': 'monitor',  # 📻 radio
    '\U0001f4fc': 'monitor',  # 📽 projector
    '\U0001f4fd': 'monitor',  # 📽 film
    '\U0001f4ff': 'monitor',  # 📿 prayer
    '\U0001f500': 'refresh-cw',  # 🔀 shuffle
    '\U0001f501': 'refresh-cw',  # 🔁 repeat
    '\U0001f502': 'refresh-cw',  # 🔂 repeat once
    '\U0001f503': 'refresh-cw',  # 🔃 arrows clockwise
    '\U0001f504': 'refresh-cw',  # 🔄 -> already
    '\U0001f505': 'sun',  # 🔅 brightness
    '\U0001f506': 'sun',  # 🔆 brightness
    '\U0001f507': 'speaker',  # 🔇 mute
    '\U0001f508': 'speaker',  # 🔈 speaker
    '\U0001f509': 'speaker',  # 🔉 speaker
    '\U0001f50a': 'speaker',  # 🔊 speaker
    '\U0001f50b': 'battery',  # 🔋 battery
    '\U0001f50c': 'battery',  # 🔌 plug
    '\U0001f50d': 'search',  # 🔍 -> already
    '\U0001f50e': 'search',  # 🔎 search
    '\U0001f50f': 'lock',  # 🔏 lock
    '\U0001f510': 'lock',  # 🔐 -> already
    '\U0001f511': 'key',  # 🔑 key
    '\U0001f512': 'lock',  # 🔒 lock
    '\U0001f513': 'unlock',  # 🔓 unlock
    '\U0001f514': 'bell',  # 🔔 -> already
    '\U0001f515': 'bell-off',  # 🔕 bell off
    '\U0001f516': 'bookmark',  # 🔖 bookmark
    '\U0001f517': 'link',  # 🔗 -> already
    '\U0001f518': 'radio',  # 🔘 radio
    '\U0001f519': 'arrow-left',  # 🔙 back
    '\U0001f51a': 'arrow-up-right',  # 🔚 end
    '\U0001f51b': 'arrow-up-right',  # 🔛 on
    '\U0001f51c': 'arrow-up-right',  # 🔜 soon
    '\U0001f51d': 'arrow-up-right',  # 🔝 top
    '\U0001f51e': 'ban',  # 🔞 no
    '\U0001f51f': 'refresh-cw',  # 🔟 keycap
    '\U0001f520': 'alphabet',  # 🔠 input
    '\U0001f521': 'alphabet',  # 🔡 input
    '\U0001f522': 'alphabet',  # 🔢 input
    '\U0001f523': 'alphabet',  # 🔣 input
    '\U0001f524': 'alphabet',  # 🔤 input
    '\U0001f525': 'flame',  # 🔥 -> already
    '\U0001f526': 'flashlight',  # 🔦 flashlight
    '\U0001f527': 'wrench',  # 🔧 wrench
    '\U0001f528': 'hammer',  # 🔨 hammer
    '\U0001f529': 'wrench',  # 🔩 nut
    '\U0001f52a': 'knife',  # 🔪 knife
    '\U0001f52b': 'gun',  # 🔫 gun
    '\U0001f52c': 'microscope',  # 🔬 microscope
    '\U0001f52d': 'telescope',  # 🔭 telescope
    '\U0001f52e': 'crystal-ball',  # 🔮 crystal
    '\U0001f52f': 'star',  # 🔯 star
    '\U0001f530': 'alphabet',  # 🔰 beginner
    '\U0001f531': 'trillium',  # 🔱 trident
    '\U0001f532': 'square',  # 🔲 button
    '\U0001f533': 'square',  # 🔳 -> white square
    '\U0001f534': 'circle',  # 🔴 red circle
    '\U0001f535': 'circle',  # 🔵 blue circle
    '\U0001f536': 'circle',  # 🔶 orange diamond
    '\U0001f537': 'circle',  # 🔷 blue diamond
    '\U0001f538': 'circle',  # 🔸 small orange
    '\U0001f539': 'circle',  # 🔹 small blue
    '\U0001f53a': 'triangle',  # 🔺 triangle
    '\U0001f53b': 'triangle',  # 🔻 triangle
    '\U0001f53c': 'arrow-up',  # 🔼 up
    '\U0001f53d': 'arrow-down',  # 🔽 down
    '\U0001f549': 'om',  # 🕉 om
    '\U0001f54a': 'dove',  # 🕊 dove
    '\U0001f54b': 'kaaba',  # 🕋 kaaba
    '\U0001f54c': 'mosque',  # 🕌 mosque
    '\U0001f54d': 'synagogue',  # 🕍 synagogue
    '\U0001f54e': 'menorah',  # 🕎 menorah
    '\U0001f550': 'clock',  # 🕐 clock
    '\U0001f551': 'clock',  # 🕑 clock
    '\U0001f552': 'clock',  # 🕒 -> already
    '\U0001f553': 'clock',  # 🕓 -> already
    '\U0001f554': 'clock',  # 🕔 clock
    '\U0001f555': 'clock',  # 🕕 clock
    '\U0001f556': 'clock',  # 🕖 clock
    '\U0001f557': 'clock',  # 🕗 clock
    '\U0001f558': 'clock',  # 🕘 clock
    '\U0001f559': 'clock',  # 🕙 clock
    '\U0001f55a': 'clock',  # 🕚 clock
    '\U0001f55b': 'clock',  # 🕛 clock
    '\U0001f55c': 'clock',  # 🕜 clock
    '\U0001f55d': 'clock',  # 🕝 clock
    '\U0001f55e': 'clock',  # 🕞 clock
    '\U0001f55f': 'clock',  # 🕟 clock
    '\U0001f560': 'clock',  # 🕠 clock
    '\U0001f561': 'clock',  # 🕡 clock
    '\U0001f562': 'clock',  # 🕢 clock
    '\U0001f563': 'clock',  # 🕣 clock
    '\U0001f564': 'clock',  # 🕤 clock
    '\U0001f565': 'clock',  # 🕥 clock
    '\U0001f566': 'clock',  # 🕦 clock
    '\U0001f567': 'clock',  # 🕧 clock
    '\U0001f56f': 'candle',  # 🕯 candle
    '\U0001f570': 'clock',  # 🕰 clock
    '\U0001f573': 'link',  # 🕳 hole
    '\U0001f574': 'user',  # 🕴 man
    '\U0001f575': 'user',  # 🕵 spy
    '\U0001f576': 'eye-off',  # 🕶 sunglasses
    '\U0001f577': 'spider',  # 🕷 spider
    '\U0001f578': 'spider',  # 🕸 web
    '\U0001f579': 'joystick',  # 🕹 joystick
    '\U0001f57a': 'user',  # 🕺 dancer
    '\U0001f587': 'paperclip',  # 🖇 link
    '\U0001f58a': 'pencil',  # 🖊 pen
    '\U0001f58b': 'pencil',  # 🖋 pen
    '\U0001f58c': 'pencil',  # 🖌 pen
    '\U0001f58d': 'pencil',  # 🖍 crayon
    '\U0001f590': 'hand',  # 🖐 hand
    '\U0001f595': 'hand',  # 🖕 middle
    '\U0001f596': 'hand',  # 🖖 vulcan
    '\U0001f5a4': 'heart',  # 🖤 black heart
    '\U0001f5a5': 'monitor',  # 🖥 desktop
    '\U0001f5a8': 'printer',  # 🖨 -> already
    '\U0001f5b1': 'save',  # 🖱 mouse
    '\U0001f5b2': 'save',  # 🖲 trackball
    '\U0001f5bc': 'image',  # 🖼 -> already
    '\U0001f5c2': 'folder',  # 🗂 folders
    '\U0001f5c3': 'folder',  # 🗃 folder
    '\U0001f5c4': 'folder',  # 🗄 file cabinet
    '\U0001f5d1': 'trash-2',  # 🗑 -> already
    '\U0001f5d2': 'trash-2',  # 🗒 note
    '\U0001f5d3': 'calendar',  # 🗓 calendar
    '\U0001f5dc': 'archive',  # 🗜 clamp
    '\U0001f5dd': 'lock',  # 🗝 key
    '\U0001f5de': 'mail',  # 🗞 newspaper
    '\U0001f5e1': 'ban',  # 🗡 dagger
    '\U0001f5e3': 'message-circle',  # 🗣 speaking
    '\U0001f5e8': 'message-circle',  # 🗨 speech
    '\U0001f5ef': 'ban',  # 🗯 thought
    '\U0001f5f3': 'flag',  # 🗳 ballot
    '\U0001f5fa': 'globe',  # 🗺 world map
    '\U0001f5fb': 'landmark',  # 🗻 mountain
    '\U0001f5fc': 'landmark',  # 🗼 tower
    '\U0001f5fd': 'landmark',  # 🗽 statue
    '\U0001f5fe': 'landmark',  # 🗾 map
    '\U0001f5ff': 'landmark',  # 🗿 moyai
    '\U0001f600': 'smile',  # 😀
    '\U0001f601': 'smile',  # 😁
    '\U0001f602': 'smile',  # 😂
    '\U0001f603': 'smile',  # 😃
    '\U0001f604': 'smile',  # 😄
    '\U0001f605': 'smile',  # 😅
    '\U0001f606': 'smile',  # 😆
    '\U0001f607': 'smile',  # 😇
    '\U0001f608': 'smile',  # 😈
    '\U0001f609': 'smile',  # 😉
    '\U0001f60a': 'smile',  # 😊
    '\U0001f60b': 'smile',  # 😋
    '\U0001f60c': 'smile',  # 😌
    '\U0001f60d': 'heart',  # 😍
    '\U0001f60e': 'smile',  # 😎
    '\U0001f60f': 'smile',  # 😏
    '\U0001f610': 'smile',  # 😐
    '\U0001f611': 'smile',  # 😑
    '\U0001f612': 'smile',  # 😒
    '\U0001f613': 'smile',  # 😓
    '\U0001f614': 'smile',  # 😔
    '\U0001f615': 'smile',  # 😕
    '\U0001f616': 'smile',  # 😖
    '\U0001f617': 'smile',  # 😗
    '\U0001f618': 'smile',  # 😘
    '\U0001f619': 'smile',  # 😙
    '\U0001f61a': 'smile',  # 😚
    '\U0001f61b': 'smile',  # 😛
    '\U0001f61c': 'smile',  # 😜
    '\U0001f61d': 'smile',  # 😝
    '\U0001f61e': 'smile',  # 😞
    '\U0001f61f': 'smile',  # 😟
    '\U0001f620': 'smile',  # 😠
    '\U0001f621': 'smile',  # 😡
    '\U0001f622': 'smile',  # 😢
    '\U0001f623': 'smile',  # 😣
    '\U0001f624': 'smile',  # 😤
    '\U0001f625': 'smile',  # 😥
    '\U0001f626': 'smile',  # 😦
    '\U0001f627': 'smile',  # 😧
    '\U0001f628': 'smile',  # 😨
    '\U0001f629': 'smile',  # 😩
    '\U0001f62a': 'smile',  # 😪
    '\U0001f62b': 'smile',  # 😫
    '\U0001f62c': 'smile',  # 😬
    '\U0001f62d': 'smile',  # 😭
    '\U0001f62e': 'smile',  # 😮
    '\U0001f62f': 'smile',  # 😯
    '\U0001f630': 'smile',  # 😰
    '\U0001f631': 'smile',  # 😱
    '\U0001f632': 'smile',  # 😲
    '\U0001f633': 'smile',  # 😳
    '\U0001f634': 'smile',  # 😴
    '\U0001f635': 'smile',  # 😵
    '\U0001f636': 'smile',  # 😶
    '\U0001f637': 'smile',  # 😷
    '\U0001f638': 'smile',  # 😸
    '\U0001f639': 'smile',  # 😹
    '\U0001f63a': 'smile',  # 😺
    '\U0001f63b': 'smile',  # 😻
    '\U0001f63c': 'smile',  # 😼
    '\U0001f63d': 'smile',  # 😽
    '\U0001f63e': 'smile',  # 😾
    '\U0001f63f': 'smile',  # 😿
    '\U0001f640': 'smile',  # 🙀
    '\U0001f641': 'smile',  # 🙁
    '\U0001f642': 'smile',  # 🙂
    '\U0001f643': 'smile',  # 🙃
    '\U0001f644': 'smile',  # 🙄
    '\U0001f645': 'hand',  # 🙅
    '\U0001f646': 'hand',  # 🙆
    '\U0001f647': 'hand',  # 🙇
    '\U0001f648': 'eye-off',  # 🙈 -> already
    '\U0001f649': 'eye-off',  # 🙉
    '\U0001f64a': 'eye-off',  # 🙊
    '\U0001f64b': 'user',  # 🙋
    '\U0001f64c': 'hand',  # 🙌
    '\U0001f64d': 'hand',  # 🙍
    '\U0001f64e': 'hand',  # 🙎
    '\U0001f64f': 'hand',  # 🙏 -> already
    '\U0001f680': 'rocket',  # 🚀 -> already
    '\U0001f681': 'rocket',  # 🚁
    '\U0001f682': 'truck',  # 🚂
    '\U0001f683': 'truck',  # 🚃
    '\U0001f684': 'truck',  # 🚄
    '\U0001f685': 'truck',  # 🚅
    '\U0001f686': 'truck',  # 🚆
    '\U0001f687': 'truck',  # 🚇
    '\U0001f688': 'truck',  # 🚈
    '\U0001f689': 'truck',  # 🚉
    '\U0001f68a': 'truck',  # 🚊
    '\U0001f68b': 'truck',  # 🚋
    '\U0001f68c': 'truck',  # 🚌
    '\U0001f68d': 'truck',  # 🚍
    '\U0001f68e': 'truck',  # 🚎
    '\U0001f68f': 'truck',  # 🚏
    '\U0001f690': 'truck',  # 🚐
    '\U0001f691': 'truck',  # 🚑
    '\U0001f692': 'truck',  # 🚒
    '\U0001f693': 'truck',  # 🚓
    '\U0001f694': 'truck',  # 🚔
    '\U0001f695': 'truck',  # 🚕
    '\U0001f696': 'truck',  # 🚖
    '\U0001f697': 'truck',  # 🚗
    '\U0001f698': 'truck',  # 🚘
    '\U0001f699': 'truck',  # 🚙
    '\U0001f69a': 'truck',  # 🚚 -> already
    '\U0001f69b': 'truck',  # 🚛
    '\U0001f69c': 'truck',  # 🚜
    '\U0001f69d': 'truck',  # 🚝
    '\U0001f69e': 'truck',  # 🚞
    '\U0001f69f': 'truck',  # 🚟
    '\U0001f6a0': 'truck',  # 🚠
    '\U0001f6a1': 'truck',  # 🚡
    '\U0001f6a2': 'truck',  # 🚢
    '\U0001f6a3': 'user',  # 🚣
    '\U0001f6a4': 'truck',  # 🚤
    '\U0001f6a5': 'truck',  # 🚥
    '\U0001f6a6': 'truck',  # 🚦
    '\U0001f6a7': 'truck',  # 🚧
    '\U0001f6a8': 'bell',  # 🚨
    '\U0001f6a9': 'flag',  # 🚩
    '\U0001f6aa': 'log-out',  # 🚪 -> already
    '\U0001f6ab': 'ban',  # 🚫 -> already
    '\U0001f6ac': 'smoke',  # 🚬
    '\U0001f6ad': 'ban',  # 🚭
    '\U0001f6ae': 'ban',  # 🚮
    '\U0001f6af': 'ban',  # 🚯
    '\U0001f6b0': 'ban',  # 🚰
    '\U0001f6b1': 'ban',  # 🚱
    '\U0001f6b2': 'bike',  # 🚲
    '\U0001f6b3': 'ban',  # 🚳
    '\U0001f6b4': 'bike',  # 🚴
    '\U0001f6b5': 'bike',  # 🚵
    '\U0001f6b6': 'user',  # 🚶
    '\U0001f6b7': 'ban',  # 🚷
    '\U0001f6b8': 'ban',  # 🚸
    '\U0001f6b9': 'ban',  # 🚹
    '\U0001f6ba': 'ban',  # 🚺
    '\U0001f6bb': 'ban',  # 🚻
    '\U0001f6bc': 'ban',  # 🚼
    '\U0001f6bd': 'ban',  # 🚽
    '\U0001f6be': 'ban',  # 🚾
    '\U0001f6bf': 'ban',  # 🚿
    '\U0001f6c0': 'ban',  # 🛀
    '\U0001f6c1': 'ban',  # 🛁
    '\U0001f6c2': 'ban',  # 🛂
    '\U0001f6c3': 'ban',  # 🛃
    '\U0001f6c4': 'ban',  # 🛄
    '\U0001f6c5': 'ban',  # 🛅
    '\U0001f6c6': 'triangle',  # 🛆
    '\U0001f6c7': 'ban',  # 🛇
    '\u2194': 'arrow-right',  # ↔
    '\u2195': 'arrow-up',  # ↕
    '\u2196': 'arrow-up-right',  # ↖
    '\u2197': 'arrow-up-right',  # ↗
    '\u2198': 'arrow-down',  # ↘
    '\u2199': 'arrow-down',  # ↙
    '\u21a9': 'arrow-left',  # ↩
    '\u21aa': 'arrow-right',  # ↪
    '\u21b0': 'arrow-up',  # ↰
    '\u21b1': 'arrow-down',  # ↱
    '\u21b2': 'arrow-down',  # ↲
    '\u21b3': 'arrow-down',  # ↳
    '\u21b4': 'arrow-right',  # ↴
    '\u21b5': 'arrow-down',  # ↵
    '\u21b6': 'refresh-cw',  # ↶
    '\u21b7': 'refresh-cw',  # ↷
    '\u21ba': 'refresh-cw',  # ↺
    '\u21bb': 'refresh-cw',  # ↻
    '\u21bc': 'arrow-left',  # ↼
    '\u21bd': 'arrow-left',  # ↽
    '\u21be': 'arrow-up',  # ↾
    '\u21bf': 'arrow-up',  # ↿
    '\u21c0': 'arrow-right',  # ⇀
    '\u21c1': 'arrow-right',  # ⇁
    '\u21c2': 'arrow-down',  # ⇂
    '\u21c3': 'arrow-down',  # ⇃
    '\u21c4': 'arrow-right',  # ⇄
    '\u21c5': 'arrow-up',  # ⇅
    '\u21c6': 'arrow-right',  # ⇆
    '\u21c7': 'arrow-right',  # ⇇
    '\u21c8': 'arrow-up',  # ⇈
    '\u21c9': 'arrow-right',  # ⇉
    '\u21ca': 'arrow-down',  # ⇊
    '\u21cb': 'arrow-right',  # ⇋
    '\u21cc': 'arrow-right',  # ⇌
    '\u21cd': 'arrow-right',  # ⇍
    '\u21ce': 'arrow-right',  # ⇎
    '\u21cf': 'arrow-right',  # ⇏
    '\u21d0': 'arrow-left',  # ⇐
    '\u21d1': 'arrow-up',  # ⇑
    '\u21d2': 'arrow-right',  # ⇒
    '\u21d3': 'arrow-down',  # ⇓
    '\u21d4': 'arrow-right',  # ⇔
    '\u21d5': 'arrow-up',  # ⇕
    '\u21d6': 'arrow-up-right',  # ⇖
    '\u21d7': 'arrow-up-right',  # ⇗
    '\u21d8': 'arrow-down',  # ⇘
    '\u21d9': 'arrow-down',  # ⇙
    '\u21da': 'arrow-left',  # ⇚
    '\u21db': 'arrow-right',  # ⇛
    '\u21dc': 'arrow-right',  # ⇜
    '\u21dd': 'arrow-right',  # ⇝
    '\u21de': 'arrow-up',  # ⇞
    '\u21df': 'arrow-down',  # ⇟
    '\u21e0': 'arrow-right',  # ⇠
    '\u21e1': 'arrow-up',  # ⇡
    '\u21e2': 'arrow-right',  # ⇢
    '\u21e3': 'arrow-down',  # ⇣
    '\u21e4': 'arrow-left',  # ⇤
    '\u21e5': 'arrow-right',  # ⇥
    '\u21e6': 'arrow-left',  # ⇦
    '\u21e7': 'arrow-up',  # ⇧
    '\u21e8': 'arrow-right',  # ⇨
    '\u21e9': 'arrow-down',  # ⇩
    '\u21ea': 'arrow-up',  # ⇪
    '\u21eb': 'arrow-up',  # ⇫
    '\u21ec': 'arrow-up',  # ⇬
    '\u21ed': 'arrow-up',  # ⇭
    '\u21ee': 'arrow-up',  # ⇮
    '\u21ef': 'arrow-up',  # ⇯
    '\u21f0': 'arrow-right',  # ⇰
    '\u21f1': 'arrow-down',  # ⇱
    '\u21f2': 'arrow-down',  # ⇲
    '\u21f3': 'arrow-up',  # ⇳
    '\u21f4': 'arrow-right',  # ⇴
    '\u21f5': 'arrow-down',  # ⇵
    '\u21f6': 'arrow-right',  # ⇶
    '\u21f7': 'arrow-left',  # ⇷
    '\u21f8': 'arrow-right',  # ⇸
    '\u21f9': 'arrow-right',  # ⇹
    '\u21fa': 'arrow-left',  # ⇺
    '\u21fb': 'arrow-right',  # ⇻
    '\u21fc': 'arrow-right',  # ⇼
    '\u21fd': 'arrow-left',  # ⇽
    '\u21fe': 'arrow-right',  # ⇾
    '\u21ff': 'arrow-left',  # ⇿
    '\u231a': 'watch',  # ⌚
    '\u231b': 'clock',  # ⌛
    '\u23e9': 'arrow-right',  # ⏩
    '\u23ea': 'arrow-left',  # ⏪
    '\u23eb': 'arrow-up',  # ⏫
    '\u23ec': 'arrow-down',  # ⏬
    '\u23ed': 'arrow-right',  # ⏭
    '\u23ee': 'arrow-left',  # ⏮
    '\u23ef': 'play',  # ⏯
    '\u23f0': 'clock',  # ⏰
    '\u23f1': 'clock',  # ⏱
    '\u23f2': 'clock',  # ⏲
    '\u23f3': 'clock',  # ⏳
    '\u23f8': 'pause',  # ⏸
    '\u23f9': 'stop',  # ⏹
    '\u23fa': 'record',  # ⏺
    '\u24c2': 'circle',  # Ⓜ
    '\u25aa': 'square',  # ▪
    '\u25ab': 'square',  # ▫
    '\u25b6': 'play',  # ▶
    '\u25c0': 'play',  # ◀
    '\u25fb': 'square',  # ◻
    '\u25fc': 'square',  # ◼
    '\u25fd': 'square',  # ◽
    '\u25fe': 'square',  # ◾
    '\u2600': 'sun',  # ☀
    '\u2601': 'cloud',  # ☁
    '\u2602': 'umbrella',  # ☂
    '\u2603': 'snowflake',  # ☃
    '\u2604': 'comet',  # ☄
    '\u260e': 'phone',  # ☎
    '\u2611': 'check-square',  # ☑
    '\u2614': 'umbrella',  # ☔
    '\u2615': 'coffee',  # ☕
    '\u261d': 'hand',  # ☝
    '\u2622': 'ban',  # ☢
    '\u2623': 'ban',  # ☣
    '\u2626': 'star',  # ☦
    '\u262a': 'star',  # ☪
    '\u262e': 'peace',  # ☮
    '\u262f': 'star',  # ☯
    '\u2638': 'star',  # ☸
    '\u2639': 'smile',  # ☹
    '\u263a': 'smile',  # ☺
    '\u2648': 'star',  # ♈
    '\u2649': 'star',  # ♉
    '\u264a': 'star',  # ♊
    '\u264b': 'star',  # ♋
    '\u264c': 'star',  # ♌
    '\u264d': 'star',  # ♍
    '\u264e': 'star',  # ♎
    '\u264f': 'star',  # ♏
    '\u2650': 'star',  # ♐
    '\u2651': 'star',  # ♑
    '\u2652': 'star',  # ♒
    '\u2653': 'star',  # ♓
    '\u2660': 'spade',  # ♠
    '\u2663': 'club',  # ♣
    '\u2665': 'heart',  # ♥
    '\u2666': 'diamond',  # ♦
    '\u2668': 'sun',  # ♨
    '\u267b': 'refresh-cw',  # ♻
    '\u267f': 'wheelchair',  # ♿
    '\u2692': 'hammer',  # ⚒
    '\u2693': 'anchor',  # ⚓
    '\u2694': 'sword',  # ⚔
    '\u2695': 'medical',  # ⚕
    '\u2696': 'scale',  # ⚖
    '\u2697': 'flask',  # ⚗
    '\u2698': 'flower',  # ⚘
    '\u2699': 'settings',  # ⚙ -> already
    '\u269a': 'star',  # ⚚
    '\u269b': 'atom',  # ⚛
    '\u269c': 'star',  # ⚜
    '\u26a0': 'alert-triangle',  # ⚠ -> already
    '\u26a1': 'zap',  # ⚡
    '\u26aa': 'circle',  # ⚪
    '\u26ab': 'circle',  # ⚫
    '\u26b0': 'coffin',  # ⚰
    '\u26b1': 'urn',  # ⚱
    '\u26bd': 'football',  # ⚽
    '\u26be': 'baseball',  # ⚾
    '\u26bf': 'basketball',  # ⚿
    '\u26c0': 'ban',  # 🛀? no
    '\u26c4': 'snowman',  # ⛄
    '\u26c5': 'sun',  # ⛅
    '\u26c8': 'cloud',  # ⛈
    '\u26ce': 'car',  # ⛎
    '\u26cf': 'wrench',  # ⛏
    '\u26d1': 'package',  # ⛑
    '\u26d3': 'link',  # ⛓
    '\u26d4': 'ban',  # ⛔
    '\u26e9': 'landmark',  # ⛩
    '\u26ea': 'landmark',  # ⛪
    '\u26f0': 'landmark',  # ⛰
    '\u26f1': 'landmark',  # ⛱
    '\u26f2': 'landmark',  # ⛲
    '\u26f3': 'landmark',  # ⛳
    '\u26f4': 'truck',  # ⛴
    '\u26f5': 'truck',  # ⛵
    '\u26f7': 'landmark',  # ⛷
    '\u26f8': 'landmark',  # ⛸
    '\u26f9': 'user',  # ⛹
    '\u26fa': 'landmark',  # ⛺
    '\u26fd': 'truck',  # ⛽
    '\u2702': 'scissors',  # ✂
    '\u2705': 'check-circle-2',  # ✅ -> already
    '\u2708': 'plane',  # ✈
    '\u2709': 'mail',  # ✉ -> already
    '\u270a': 'hand',  # ✊
    '\u270b': 'hand',  # ✋
    '\u270c': 'hand',  # ✌
    '\u270d': 'pencil',  # ✍
    '\u270f': 'pencil',  # ✏ -> already
    '\u2712': 'pencil',  # ✒
    '\u2714': 'check',  # ✔ -> already
    '\u2716': 'x',  # ✕ -> already
    '\u271d': 'star',  # ✝
    '\u2721': 'star',  # ✡
    '\u2728': 'sparkles',  # ✨
    '\u2733': 'star',  # ✳
    '\u2734': 'star',  # ✴
    '\u2744': 'snowflake',  # ❄
    '\u2747': 'sparkles',  # ❇
    '\u274c': 'x-circle',  # ❌ -> already
    '\u274e': 'x-circle',  # ❎
    '\u2753': 'help-circle',  # ❓ -> already
    '\u2754': 'help-circle',  # ❔
    '\u2755': 'help-circle',  # ❕
    '\u2757': 'alert-circle',  # ❗ -> already
    '\u2763': 'heart',  # ❣
    '\u2764': 'heart',  # ❤ -> already
    '\u2795': 'plus',  # ➕ -> already
    '\u2796': 'minus',  # ➖
    '\u2797': 'divide',  # ➗
    '\u27a1': 'arrow-right',  # ➡ -> already
    '\u27b0': 'refresh-cw',  # ➰
    '\u27bf': 'star',  # ➿
    '\u2934': 'arrow-up-right',  # ⤴
    '\u2935': 'arrow-right',  # ⤵
    '\u2b05': 'arrow-left',  # ⬅
    '\u2b06': 'arrow-up',  # ⬆
    '\u2b07': 'download',  # ⬇ -> already
    '\u2b1b': 'square',  # ⬛
    '\u2b1c': 'square',  # ⬜
    '\u2b50': 'star',  # ⭐ -> already
    '\u2b55': 'circle',  # ⭕
    '\u3030': 'wave',  # 〰
    '\u303d': 'star',  # 〽
    '\u3297': 'star',  # ㊗
    '\u3299': 'star',  # ㊙
}

# Multi-codepoint emoji patterns (longer first, exact match)
MULTI_EMOJI = {
    '\U0001f9d1\u200d\U0001f4bc': 'user-cog',  # 🧑‍💼
    '\U0001f6cd\ufe0f': 'shopping-bag',  # 🛍️
    '\U0001f6e0\ufe0f': 'wrench',  # 🛠️
    '\u26a0\ufe0f': 'alert-triangle',  # ⚠️
    '\u2699\ufe0f': 'settings',  # ⚙️
    '\u2b50\ufe0f': 'star',  # ⭐️
    '\u2764\ufe0f': 'heart',  # ❤️
    '\u2605\ufe0f': 'star',  # ★️
    '\u2714\ufe0f': 'check',  # ✔️
    '\u2716\ufe0f': 'x',  # ✕️
    '\u270f\ufe0f': 'pencil',  # ✏️
    '\u2709\ufe0f': 'mail',  # ✉️
    '\u2197\ufe0f': 'arrow-up-right',  # ↗️
    '\u2197': 'arrow-up-right',  # ↗
    '\u2190\ufe0f': 'arrow-left',  # ◀️
    '\u21bb\ufe0f': 'refresh-cw',  # ↻
    '\u21bb': 'refresh-cw',  # ↻
    '\u2630\ufe0f': 'menu',  # ☰️
    '\u27a1\ufe0f': 'arrow-right',  # ➡️
    '\u2b07\ufe0f': 'download',  # ⬇️
    '\u23f3\ufe0f': 'clock',  # ⏳️
    '\u23f3': 'clock',  # ⏳
    '\u231b\ufe0f': 'clock',  # ⌛️
    '\u231b': 'clock',  # ⌛
    '\u26a1\ufe0f': 'zap',  # ⚡️
    '\u2757\ufe0f': 'alert-circle',  # ❗️
    '\u2753\ufe0f': 'help-circle',  # ❓️
    '\u2795\ufe0f': 'plus',  # ➕️
    '\u2796\ufe0f': 'minus',  # ➖️
    '\u2192\ufe0f': 'arrow-right',  # ️→
    '\u2192': 'arrow-right',  # →
    '\u2190': 'arrow-left',  # ←
}

SVG_LITERAL = '<svg class="ic" aria-hidden="true"><use href="#i-{name}"/></svg>'
IC_FUNC = 'IC("{name}")'

def build_emoji_regex():
    """Build regex that matches all emoji patterns (multi-codepoint first)."""
    # Sort multi-codepoint by length descending
    multi = sorted(MULTI_EMOJI.keys(), key=len, reverse=True)
    single = sorted(EMOJI_MAP.keys(), key=lambda c: -ord(c) if len(c) == 1 else 0)
    # Also match VS16 (U+FE0F) as optional suffix for single emoji
    all_patterns = []
    for m in multi:
        all_patterns.append(re.escape(m))
    for s in single:
        if len(s) == 1:
            all_patterns.append(re.escape(s) + '\ufe0f?')
        else:
            all_patterns.append(re.escape(s))
    pattern = '|'.join(all_patterns)
    return re.compile(pattern)

def get_icon_name(emoji_seq):
    """Get lucide icon name for an emoji sequence."""
    norm = emoji_seq.rstrip('\ufe0f')
    if emoji_seq in MULTI_EMOJI:
        return MULTI_EMOJI[emoji_seq]
    if norm in MULTI_EMOJI:
        return MULTI_EMOJI[norm]
    if norm in EMOJI_MAP:
        return EMOJI_MAP[norm]
    # Try without VS16 merged
    clean = emoji_seq.replace('\ufe0f', '')
    if clean in EMOJI_MAP:
        return EMOJI_MAP[clean]
    return None

def process_file(path, sprite_html, css_block):
    src = open(path).read()
    emoji_re = build_emoji_regex()
    lines = src.split('\n')
    out_lines = []
    
    in_script = False
    in_backtick = False  # template literal state
    
    modified = False
    
    for i, ln in enumerate(lines):
        # Toggle script state
        stripped = ln.strip()
        if '<script' in stripped and 'src=' not in stripped and not stripped.startswith('</'):
            in_script = True
            if '`' in ln:
                in_backtick = (ln.count('`') % 2 == 1)
        elif '</script>' in stripped:
            in_script = False
            in_backtick = False
        
        # Detect backtick state for template literals
        if in_script:
            bt_count = ln.count('`')
            if bt_count:
                in_backtick = (bt_count % 2 == 1) if not in_backtick else (bt_count % 2 == 0)
        
        # Check if this line is a textContent assignment
        is_textcontent = '.textContent =' in ln or 'textContent =' in ln
        is_placeholder = 'placeholder=' in ln
        
        # Check for emoji in this line
        if not emoji_re.search(ln):
            out_lines.append(ln)
            continue
        
        # Replace emoji based on context
        def replace_emoji(m):
            emoji = m.group(0)
            name = get_icon_name(emoji)
            if not name:
                return emoji  # keep as-is if no mapping
            
            if not in_script:
                # HTML context: inline SVG
                return SVG_LITERAL.format(name=name)
            else:
                # JS context
                if is_textcontent or is_placeholder:
                    # textContent/placeholder: strip emoji
                    return ''
                elif in_backtick:
                    # Template literal: use IC() function
                    return '${' + IC_FUNC.format(name=name) + '}'
                else:
                    # Regular JS string: use inline SVG literal (string)
                    # But be careful about context - could be single/double quoted
                    return SVG_LITERAL.format(name=name)
            
        new_ln = emoji_re.sub(replace_emoji, ln)
        if new_ln != ln:
            modified = True
        out_lines.append(new_ln)
    
    if not modified:
        return None
    
    # Inject sprite and CSS
    result = '\n'.join(out_lines)
    
    # Add sprite right after <body> (or near top)
    body_close = '</body>'
    head_close = '</head>'
    
    # Inject sprite before </body>
    inject = f'\n<!-- SVG Icons -->\n{sprite_html}\n<style>{css_block}</style>\n'
    result = result.replace(body_close, inject + body_close)
    
    # Add IC() helper function before first usage point - add right after <script>
    ic_helper = '''
// Icon helper: returns SVG use element string
const IC = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
'''
    # Inject after the first <script> opening tag
    # More reliable: inject after the first script tag start
    # Actually, add at the very beginning of the first script block
    result = result.replace('<script>', '<script>\n' + ic_helper, 1)
    
    return result

# ── CSS for icons ──
CSS = '''
.ic{width:1.1em;height:1.1em;vertical-align:-0.15em;display:inline-block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-item .icon .ic{width:18px;height:18px;vertical-align:middle}
'''

# ── Main ──
if __name__ == '__main__':
    sprite = open('/home/ubuntu/murah-plastic/icon-sprite.html').read()
    
    for fname in ['public/admin.html', 'public/akun.html']:
        path = f'/home/ubuntu/murah-plastic/{fname}'
        print(f'Processing {fname}...')
        result = process_file(path, sprite, CSS)
        if result is None:
            print('  No changes needed.')
            continue
        
        # Write backup
        os.rename(path, path + '.bak')
        with open(path, 'w') as f:
            f.write(result)
        
        # Count changes
        orig = len(open(path + '.bak').read())
        new = len(result)
        print(f'  Written ({orig} → {new} chars)')
        print(f'  Backup at {path}.bak')
/* Murah Plastic — shared site JS (navbar, footer, cart localStorage) */
(function () {
  'use strict';

  // ── Cart localStorage (key sama dengan SPA index.html) ──
  const CART_KEY = 'mp_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function getTQ() { return getCart().reduce((s, c) => s + (c.qty || 0), 0); }
  function updateCartBadge() {
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      const n = getTQ();
      el.textContent = n;
      el.style.display = n > 0 ? 'inline-block' : 'none';
    });
  }
  function addToCart(productId, productName, variantName, price, qty, img) {
    const cart = getCart();
    const key = productId + '|' + variantName;
    const ex = cart.find(c => c.key === key);
    if (ex) ex.qty += qty;
    else cart.push({ key, productId, productName, variantName, price, qty, img: img || '' });
    saveCart(cart);
    updateCartBadge();
  }

  const fmt = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── Navbar + footer markup ──
  const NAVBAR = `
  <div class="topbar">
    <div class="topbar-links">
      <a href="/admin.html" style="color:var(--gold-bright);font-weight:700">⚡ Admin</a>
      <a href="/tentang-kami">Tentang Kami</a>
      <a href="/artikel">📝 Artikel</a>
      <a href="/faq">FAQ</a>
      <a href="https://shopee.co.id/murahplastic" target="_blank" rel="noopener">Toko Shopee</a>
    </div>
    <div class="topbar-right">
      <span>💬 WA Partai:</span>
      <a href="https://wa.me/628129153811" target="_blank" rel="noopener" class="wa-link">0812-915-3811</a>
      <span>|</span>
      <a href="https://wa.me/6285104778700" target="_blank" rel="noopener" class="wa-link">0851-0477-8700</a>
      <span style="opacity:0.4">(No Call)</span>
    </div>
  </div>
  <nav class="navbar" id="siteNavbar">
    <div class="navbar-inner">
      <button class="nav-toggle" type="button" onclick="MP.toggleMenu()" aria-label="Buka menu">
        <span></span><span></span><span></span>
      </button>
      <a class="brand" href="/">
        <div class="brand-logo">M</div>
        <div><div class="brand-name">Murah Plastic</div><div class="brand-sub">by MUPA Group</div></div>
      </a>
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" type="text" id="globalSearch" placeholder="Cari plastik OPP, ukuran, jenis..." onkeydown="if(event.key==='Enter'){MP.goSearch(this.value)}">
        <button class="search-btn" type="button" onclick="MP.goSearch(document.getElementById('globalSearch').value)">Cari</button>
      </div>
      <div class="nav-links">
        <a class="nav-link" href="/">🏠 Home</a>
        <a class="nav-link" href="/shop">🛍️ Shop</a>
        <a class="nav-link" href="/artikel">📝 Artikel</a>
        <a class="nav-link" href="/tentang-kami">Tentang Kami</a>
        <a class="nav-link" href="/faq">FAQ</a>
      </div>
      <div class="nav-right">
        <button class="notif-bell-btn" id="mpNotifBell" type="button" onclick="MP.toggleNotif(event)" title="Notifikasi">🔔<span class="notif-badge" id="mpNotifBadge" style="display:none">0</span></button>
        <button class="nav-auth" type="button" id="navAuthBtn" onclick="MP.authAction()">👤 Masuk</button>
        <a class="cart-btn" href="/cart">🛒 <span class="cart-label">Keranjang</span> <span class="cart-count" data-cart-count>0</span></a>
      </div>
    </div>
  </nav>
    <!-- Mobile sidebar drawer -->
    <div class="sidebar" id="mobileSidebar">
      <div class="sb-head">
        <a class="brand" href="/">
          <div class="brand-logo">M</div>
          <div><div class="brand-name">Murah Plastic</div><div class="brand-sub">by MUPA Group</div></div>
        </a>
        <button class="sb-close" type="button" onclick="MP.closeMenu()" aria-label="Tutup menu">✕</button>
      </div>
      <div class="sb-body">
        <div class="sb-auth" id="sbAuth">
          <a class="sb-link" href="javascript:void(0)" onclick="MP.authAction()"><span class="sb-ic">👤</span> <span id="sbAuthText">Masuk / Daftar</span></a>
          <a class="sb-link" href="/akun" style="display:none" id="sbAccountLink"><span class="sb-ic">📦</span> Pesanan Saya</a>
          <a class="sb-link" href="javascript:void(0)" onclick="MP.logout()" style="display:none" id="sbLogoutLink"><span class="sb-ic">🚪</span> Keluar</a>
        </div>
        <div class="sb-label">Menu Utama</div>
        <a class="sb-link" href="/"><span class="sb-ic">🏠</span> Home</a>
        <a class="sb-link" href="/shop"><span class="sb-ic">🛍️</span> Shop</a>
        <a class="sb-link" href="/artikel"><span class="sb-ic">📝</span> Artikel</a>
        <a class="sb-link" href="/tentang-kami"><span class="sb-ic">ℹ️</span> Tentang Kami</a>
        <a class="sb-link" href="/faq"><span class="sb-ic">❓</span> FAQ</a>
        <div class="sb-label" style="margin-top: 6px">Kategori Produk</div>
        <a class="sb-link" href="/shop"><span class="sb-ic">📦</span> Semua Produk</a>
        <a class="sb-link" href="/kategori/opp-lem-tipis"><span class="sb-ic">📋</span> OPP Lem Tipis</a>
        <a class="sb-link" href="/kategori/opp-lem-tebal"><span class="sb-ic">📋</span> OPP Lem Tebal</a>
        <a class="sb-link" href="/kategori/opp-lem-super-tebal"><span class="sb-ic">📋</span> Super Tebal</a>
        <a class="sb-link" href="/kategori/plastik-ziplock-klip"><span class="sb-ic">🔒</span> Ziplock / Klip</a>
        <a class="sb-link" href="/kategori/opp-tanpa-lem"><span class="sb-ic">📋</span> Tanpa Lem</a>
        <a class="sb-link" href="/kategori/plastik-gusset-roti"><span class="sb-ic">🍞</span> Gusset Roti</a>
      </div>
      <div class="sb-foot">
        <a class="sb-wa-btn" href="https://wa.me/628129153811" target="_blank" rel="noopener">💬 Chat WhatsApp</a>
        <div class="sb-contact">0812-915-3811 · 0851-0477-8700</div>
      </div>
    </div>
    <div class="sidebar-overlay" onclick="MP.closeMenu()"></div>
  <div class="cat-nav">
    <div class="cat-nav-inner">
      <a class="cat-nav-item" href="/shop">Semua Produk</a>
      <a class="cat-nav-item" href="/kategori/opp-lem-tipis">OPP Lem Tipis</a>
      <a class="cat-nav-item" href="/kategori/opp-lem-tebal">OPP Lem Tebal</a>
      <a class="cat-nav-item" href="/kategori/opp-lem-super-tebal">Super Tebal</a>
      <a class="cat-nav-item" href="/kategori/opp-tanpa-lem">Tanpa Lem</a>
      <a class="cat-nav-item" href="/kategori/plastik-gusset-roti">Gusset Roti</a>
      <a class="cat-nav-item" href="/kategori/plastik-ziplock-klip">Ziplock / Klip</a>
    </div>
  </div>`;

  const FOOTER = `
  <div class="footer-gold"></div>
  <div class="footer-main">
    <div class="footer-grid">
      <div>
        <a class="brand" href="/" style="margin-bottom:12px">
          <div class="brand-logo">M</div>
          <div><div class="brand-name" style="color:#fff">Murah Plastic</div><div class="brand-sub">by MUPA Group</div></div>
        </a>
        <p class="f-desc">Distributor plastik OPP terpercaya dari MUPA Group. Melayani UMKM, bakery, garment, dan kemasan sejak 2004.</p>
        <div class="f-col-title">Grup Toko Online</div>
        <div class="f-brands"><div class="f-brand-item">Murah Plastic</div><div class="f-brand-item">Dongbo Store</div><div class="f-brand-item">Maju Plastic</div><div class="f-brand-item">Plastikin.aja</div></div>
        <div class="f-socials">
          <a class="f-social" href="https://shopee.co.id/murahplastic" target="_blank" rel="noopener">🛒</a>
          <a class="f-social" href="https://tiktok.com/@mupaplastic" target="_blank" rel="noopener">🎵</a>
          <a class="f-social" href="https://www.instagram.com/murahplastic" target="_blank" rel="noopener">📸</a>
        </div>
      </div>
      <div>
        <div class="f-col-title">Kategori</div>
        <ul class="f-links">
          <li><a href="/shop">🛍️ Shop Semua Produk</a></li>
          <li><a href="/produk">📦 Arsip Produk</a></li>
          <li><a href="/kategori/opp-lem-tipis">OPP Lem Tipis</a></li>
          <li><a href="/kategori/opp-lem-tebal">OPP Lem Tebal</a></li>
          <li><a href="/kategori/opp-lem-super-tebal">Super Tebal</a></li>
          <li><a href="/kategori/plastik-ziplock-klip">Ziplock / Klip</a></li>
        </ul>
      </div>
      <div>
        <div class="f-col-title">Informasi</div>
        <ul class="f-links">
          <li><a href="/shop">🛍️ Shop</a></li>
          <li><a href="/produk">📦 Semua Produk</a></li>
          <li><a href="/artikel">📝 Artikel & Tips</a></li>
          <li><a href="/tentang-kami">Tentang Kami</a></li>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/cart">🛒 Keranjang</a></li>
          <li><a href="/checkout">Checkout</a></li>
          <li><a href="https://shopee.co.id/murahplastic" target="_blank" rel="noopener">Toko Shopee</a></li>
        </ul>
      </div>
      <div>
        <div class="f-col-title">Hubungi Kami</div>
        <div class="f-contact">
          <div class="f-contact-item">💬 <a href="https://wa.me/628129153811" target="_blank" rel="noopener">0812-915-3811</a> <span style="color:var(--gold);font-size:11px">(No Call)</span></div>
          <div class="f-contact-item">💬 <a href="https://wa.me/6285104778700" target="_blank" rel="noopener">0851-0477-8700</a> <span style="color:var(--gold);font-size:11px">(No Call)</span></div>
          <div class="f-contact-item">✉️ <a href="mailto:murahplastic@gmail.com">murahplastic@gmail.com</a></div>
          <div class="f-contact-item">📍 Nerogtog, Tangerang 15145</div>
        </div>
        <div class="f-col-title" style="margin-top:16px">Pembayaran</div>
        <div class="f-pay"><span class="f-badge">Transfer</span><span class="f-badge">GoPay</span><span class="f-badge">OVO</span><span class="f-badge">QRIS</span></div>
        <div class="f-col-title" style="margin-top:12px">Ekspedisi</div>
        <div class="f-pay"><span class="f-badge">JNE</span><span class="f-badge">J&T</span><span class="f-badge">SiCepat</span><span class="f-badge">Anteraja</span></div>
      </div>
    </div>
    <hr class="f-divider">
    <div class="f-bottom"><span>© 2024 Murah Plastic · MUPA Group · PD Sangaloy est. 2004</span><span>Nerogtog, Tangerang 15145 · Indonesia</span></div>
  </div>`;

  // ── Floating widgets (WA + LiveChat) ──
  const FLOATING_WIDGETS = `
  <div class="wa-float">
    <div class="wa-popup" id="waPopup">
      <div class="wa-popup-title">💬 Hubungi Kami</div>
      <div class="wa-popup-sub">Chat langsung, kami siap bantu!</div>
      <a href="https://wa.me/628129153811" target="_blank" class="wa-popup-btn"><div>💬</div><div><div class="wa-popup-label">WA Utama (No Call)</div><div class="wa-popup-num">0812-915-3811</div></div></a>
      <a href="https://wa.me/6285104778700" target="_blank" class="wa-popup-btn"><div>💬</div><div><div class="wa-popup-label">WA Alternatif (No Call)</div><div class="wa-popup-num">0851-0477-8700</div></div></a>
    </div>
    <div style="position:relative" onclick="toggleWA()">
      <a class="wa-float-btn">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      </a>
      <div class="wa-pulse"></div>
    </div>
  </div>
  <div class="livechat-btn">
    <div class="livechat-trigger" onclick="toggleLiveChat()" title="Live Chat">💬</div>
  </div>
  <div class="livechat-overlay" id="livechatOverlay">
    <div class="livechat-head">
      <div class="livechat-avatar">M</div>
      <div class="livechat-info">
        <div class="livechat-name">Murah Plastic Support</div>
        <div class="livechat-status"><span class="livechat-online-dot"></span>Online sekarang</div>
      </div>
      <button class="livechat-close" onclick="toggleLiveChat()">✕</button>
    </div>
    <div class="livechat-messages" id="chatMessages"></div>
    <div class="chat-quick-replies" id="chatQuickReplies"></div>
    <div class="livechat-input-row">
      <input class="livechat-input" type="text" id="chatInput" placeholder="Ketik pesan..."
        onkeydown="if(event.key==='Enter')sendChatMsg()">
      <button class="livechat-send" onclick="sendChatMsg()">➤</button>
    </div>
  </div>`;

  // ── Live Chat JS ──
  let chatOpen = false;
  let chatInitialized = false;

  const CHAT_RESPONSES = {
    'harga': 'Harga produk kami mulai dari Rp3.500/pack (isi 100 pcs). Cek semua harga di halaman produk ya! 😊',
    'ongkir': 'Gratis ongkir untuk pembelian min. Rp500.000! Untuk estimasi ongkir, cek di halaman produk → Cek Ongkir.',
    'diskon': 'Ada diskon otomatis: beli 5 pack -2%, 10 pack -5%, 50 pack -10%, 100 pack -20%. Plus diskon member 10% kalau login!',
    'minimal': 'Minimal pembelian 5 pack per produk. Bisa mix ukuran ya!',
    'pembayaran': 'Kami terima Transfer Bank (BCA/Mandiri/BRI), GoPay, OVO, dan QRIS.',
    'retur': 'Retur bisa dilakukan dalam 3 hari setelah produk diterima. Klik menu Retur di topbar untuk info lengkap.',
    'ukuran': 'Tersedia banyak ukuran! Mulai dari 6x10 sampai 35x45 cm. Cek di halaman produk untuk pilihan lengkap.',
    'tebal': 'Kami punya 4 ketebalan: Tipis (17-18 mic), Tebal (26-32 mic), Super Tebal (38 mic), dan Double Seal.',
    'food grade': 'Ya, semua produk OPP kami food grade dan aman untuk kemasan makanan! ✅',
    'grosir': 'Untuk pembelian partai besar/grosir, hubungi WA 0812-915-3811. Ada harga spesial!',
    'pengiriman': 'Kami kirim via JNE, J&T, SiCepat, dan Anteraja ke seluruh Indonesia. International shipping juga tersedia!',
    'stok': 'Stok selalu tersedia! Kalau ada ukuran yang kosong, silakan hubungi WA kami.',
  };

  const QUICK_REPLIES = [
    {label:'💰 Harga produk', key:'harga'},
    {label:'🚚 Info ongkir', key:'ongkir'},
    {label:'🏷️ Diskon', key:'diskon'},
    {label:'📦 Minimal order', key:'minimal'},
    {label:'💳 Pembayaran', key:'pembayaran'},
    {label:'✅ Food grade?', key:'food grade'},
  ];

  function renderQuickReplies(){
    const el = document.getElementById('chatQuickReplies');
    if(!el) return;
    el.innerHTML = QUICK_REPLIES.map(q =>
      `<button class="chat-quick-btn" onclick="sendQuickReply('${q.key}','${q.label}')">${q.label}</button>`
    ).join('');
  }

  function addChatMsg(text, isUser){
    const msgs = document.getElementById('chatMessages');
    if(!msgs) return;
    const now = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    const div = document.createElement('div');
    div.className = `chat-msg ${isUser?'user':'bot'}`;
    div.innerHTML = text + `<div class="chat-msg-time">${now}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function initChat(){
    chatInitialized = true;
    const msgs = document.getElementById('chatMessages');
    if(msgs) msgs.innerHTML = `<div class="chat-msg bot">Halo! 👋 Selamat datang di <strong>Murah Plastic</strong>!<br>Ada yang bisa kami bantu?<div class="chat-msg-time">${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    renderQuickReplies();
  }

  window.toggleLiveChat = function(){
    chatOpen = !chatOpen;
    const el = document.getElementById('livechatOverlay');
    if(el) el.classList.toggle('open', chatOpen);
    if(chatOpen && !chatInitialized) initChat();
  };

  window.sendQuickReply = function(key, label){
    addChatMsg(label, true);
    const el = document.getElementById('chatQuickReplies');
    if(el) el.innerHTML = '';
    setTimeout(()=>{
      const response = CHAT_RESPONSES[key] || 'Terima kasih pertanyaannya! Untuk info lebih lanjut, hubungi WA kami ya 😊';
      addChatMsg(response, false);
      setTimeout(()=>{
        addChatMsg('Ada pertanyaan lain? Atau mau langsung chat dengan tim kami via WhatsApp?<br><a href="https://wa.me/628129153811" target="_blank" style="color:#25D366;font-weight:700">💬 Lanjut di WhatsApp →</a>', false);
        renderQuickReplies();
      }, 800);
    }, 600);
  };

  window.sendChatMsg = function(){
    const input = document.getElementById('chatInput');
    const text = (input||{}).value||'';
    if(!text.trim()) return;
    input.value = '';
    addChatMsg(text, true);
    const el = document.getElementById('chatQuickReplies');
    if(el) el.innerHTML = '';
    setTimeout(()=>{
      const lower = text.toLowerCase();
      let response = null;
      for(const [key, val] of Object.entries(CHAT_RESPONSES)){
        if(lower.includes(key)){response = val;break;}
      }
      if(!response){
        response = `Terima kasih pesannya! 😊 Untuk pertanyaan lebih detail, silakan chat langsung via WA ya:<br><a href="https://wa.me/628129153811?text=${encodeURIComponent(text)}" target="_blank" style="color:#25D366;font-weight:700">💬 Lanjut di WhatsApp →</a>`;
      }
      addChatMsg(response, false);
      renderQuickReplies();
    }, 700);
  };

  window.toggleWA = function(){
    const p = document.getElementById('waPopup');
    if(p) p.classList.toggle('show');
  };

  document.addEventListener('click', function(e){
    const wf = document.querySelector('.wa-float');
    if(wf && !wf.contains(e.target)) {
      const p = document.getElementById('waPopup');
      if(p) p.classList.remove('show');
    }
  });

  function injectLayout() {
    const navSlot = document.getElementById('site-nav');
    if (navSlot) navSlot.innerHTML = NAVBAR;
    const footSlot = document.getElementById('site-footer');
    if (footSlot) footSlot.innerHTML = FOOTER;
    // Inject floating widgets (WA + LiveChat) if not already present
    if (!document.querySelector('.wa-float')) {
      document.body.insertAdjacentHTML('beforeend', FLOATING_WIDGETS);
    }
    // Highlight active nav link
    const path = location.pathname;
    document.querySelectorAll('.nav-link, .sb-link').forEach(l => {
      const href = l.getAttribute('href');
      if (href === path || (path !== '/' && href !== '/' && path.startsWith(href))) {
        l.classList.add('active');
      }
    });
    updateCartBadge();
  }

  function toggleMenu() {
    document.body.classList.toggle('nav-open');
  }
  function closeMenu() {
    document.body.classList.remove('nav-open');
  }
  function goSearch(q) {
    q = (q || '').trim();
    if (q) location.href = '/shop?q=' + encodeURIComponent(q);
    else location.href = '/shop';
  }

  // ═══════════════ MEMBER AUTH (shared login/register) ═══════════════
  const AUTH_KEY = 'mp_user';
  const TOKEN_KEY = 'mp_token';

  function getUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

  const AUTH_MODAL = `
  <div class="mp-auth-overlay" id="mpAuthOverlay" onclick="if(event.target===this)MP.closeAuth()">
    <div class="mp-auth-modal">
      <button class="mp-auth-x" type="button" onclick="MP.closeAuth()" aria-label="Tutup">✕</button>
      <div class="mp-auth-head">
        <div class="brand-logo">M</div>
        <div class="mp-auth-title">Murah Plastic Member</div>
        <div class="mp-auth-sub">Login & dapatkan diskon member 10% 🎉</div>
      </div>
      <div class="mp-auth-body">
        <div class="mp-member-badge">🏷️ Member mendapat diskon tambahan <strong>10%</strong> + riwayat pesanan di dashboard!</div>
        <div class="mp-auth-tabs">
          <button class="mp-auth-tab active" data-tab="login" onclick="MP.switchAuthTab('login')">Masuk</button>
          <button class="mp-auth-tab" data-tab="register" onclick="MP.switchAuthTab('register')">Daftar</button>
        </div>
        <div class="mp-auth-pane active" id="mpPaneLogin">
          <form onsubmit="MP.submitLogin();return false">
          <div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="mpLoginEmail" placeholder="email@kamu.com" autocomplete="email"></div>
          <div class="fg"><label class="fl">Password</label><input class="fi" type="password" id="mpLoginPass" placeholder="••••••••" autocomplete="current-password"></div>
          <button class="mp-auth-btn" type="submit">Masuk →</button>
          </form>
        </div>
        <div class="mp-auth-pane" id="mpPaneRegister">
          <form onsubmit="MP.submitRegister();return false">
          <div class="fg"><label class="fl">Nama Lengkap</label><input class="fi" type="text" id="mpRegName" placeholder="Nama kamu" autocomplete="name"></div>
          <div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="mpRegEmail" placeholder="email@kamu.com" autocomplete="email"></div>
          <div class="fg"><label class="fl">Password</label><input class="fi" type="password" id="mpRegPass" placeholder="Min. 6 karakter" autocomplete="new-password"></div>
          <button class="mp-auth-btn" type="submit">Daftar & Dapatkan Diskon →</button>
          </form>
        </div>
        <div class="mp-auth-msg" id="mpAuthMsg"></div>
      </div>
    </div>
  </div>`;

  function setAuthMsg(msg, isErr) {
    const el = document.getElementById('mpAuthMsg');
    if (el) { el.textContent = msg || ''; el.style.color = isErr ? 'var(--red)' : '#16A34A'; }
  }

  function openAuth(tab) {
    let ov = document.getElementById('mpAuthOverlay');
    if (!ov) {
      document.body.insertAdjacentHTML('beforeend', AUTH_MODAL);
      ov = document.getElementById('mpAuthOverlay');
    }
    if (tab) switchAuthTab(tab);
    setAuthMsg('');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeAuth() {
    const ov = document.getElementById('mpAuthOverlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }
  function switchAuthTab(tab) {
    document.querySelectorAll('.mp-auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const lp = document.getElementById('mpPaneLogin');
    const rp = document.getElementById('mpPaneRegister');
    if (lp) lp.classList.toggle('active', tab === 'login');
    if (rp) rp.classList.toggle('active', tab === 'register');
    setAuthMsg('');
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function submitLogin() {
    const email = (document.getElementById('mpLoginEmail') || {}).value || '';
    const pass = (document.getElementById('mpLoginPass') || {}).value || '';
    if (!email || !pass) { setAuthMsg('Email dan password wajib diisi!', true); return; }
    setAuthMsg('⏳ Memproses...');
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: btoa(pass) })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Gagal login';
        setAuthMsg(msg.includes('not found') ? 'Email tidak terdaftar. Silakan daftar dulu!' : msg.includes('wrong') ? 'Password salah!' : msg, true);
        return;
      }
      loginSuccess(data);
    } catch (e) { setAuthMsg('Gagal login. Coba lagi ya!', true); }
  }

  async function submitRegister() {
    const name = (document.getElementById('mpRegName') || {}).value || '';
    const email = (document.getElementById('mpRegEmail') || {}).value || '';
    const pass = (document.getElementById('mpRegPass') || {}).value || '';
    if (!name.trim()) { setAuthMsg('Nama wajib diisi!', true); return; }
    if (!email || !email.includes('@')) { setAuthMsg('Email tidak valid!', true); return; }
    if (pass.length < 6) { setAuthMsg('Password minimal 6 karakter!', true); return; }
    setAuthMsg('⏳ Memproses...');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email, password: btoa(pass) })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Gagal daftar';
        setAuthMsg(msg.includes('exists') ? 'Email sudah terdaftar!' : msg, true);
        return;
      }
      loginSuccess(data);
    } catch (e) { setAuthMsg('Gagal daftar. Coba lagi ya!', true); }
  }

  function loginSuccess(user) {
    const u = { id: user.id, name: user.name, email: user.email, joinDate: user.joinDate || '', method: user.method || 'email' };
    localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    if (user.token) localStorage.setItem(TOKEN_KEY, user.token);
    closeAuth();
    updateAuthUI();
    window.dispatchEvent(new CustomEvent('mp:auth', { detail: u }));
    // Toast
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:76px;right:20px;background:#16A34A;color:white;padding:14px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:3000;box-shadow:0 4px 20px rgba(0,0,0,.2)';
    t.innerHTML = `🎉 Halo, ${u.name.split(' ')[0]}!<br><span style="font-size:12px;font-weight:500;opacity:.9">Diskon member 10% aktif!</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  async function logout() {
    const t = getToken();
    if (t) fetch('/api/users/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } }).catch(() => {});
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    updateAuthUI();
    window.dispatchEvent(new CustomEvent('mp:auth', { detail: null }));
    if (location.pathname.startsWith('/akun')) location.href = '/';
  }

  function authAction() {
    const u = getUser();
    if (u) location.href = '/akun';
    else openAuth('login');
  }

  function updateAuthUI() {
    const u = getUser();
    const btn = document.getElementById('navAuthBtn');
    if (btn) {
      if (u) {
        btn.innerHTML = '👤 ' + u.name.split(' ')[0];
        btn.title = 'Akun Saya';
      } else {
        btn.innerHTML = '👤 Masuk';
        btn.title = 'Masuk / Daftar';
      }
    }
    const sbText = document.getElementById('sbAuthText');
    if (sbText) sbText.textContent = u ? u.name : 'Masuk / Daftar';
    const acct = document.getElementById('sbAccountLink');
    const lg = document.getElementById('sbLogoutLink');
    if (acct) acct.style.display = u ? 'flex' : 'none';
    if (lg) lg.style.display = u ? 'flex' : 'none';
  }

  document.addEventListener('DOMContentLoaded', () => { injectLayout(); updateAuthUI(); initNotif(); });
  window.addEventListener('storage', e => { if (e.key === CART_KEY) updateCartBadge(); });

  // ═══════════════ NOTIFIKASI CUSTOMER (semua halaman) ═══════════════
  const NOTIF_STYLE = `
  .notif-bell-btn{position:relative;background:var(--light,#f5f0ea);border:1px solid var(--border,#e5ddd2);border-radius:50%;width:38px;height:38px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .15s}
  .notif-bell-btn:hover{border-color:var(--gold,#c9890a)}
  .notif-badge{position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;border-radius:10px;min-width:17px;height:17px;padding:0 4px;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
  .mp-notif-panel{position:fixed;top:60px;right:12px;width:370px;max-width:calc(100vw - 24px);background:#fff;border:1px solid var(--border,#e5ddd2);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.18);z-index:9999;display:none;overflow:hidden;font-family:var(--font,'Plus Jakarta Sans',sans-serif)}
  .mp-notif-panel.open{display:block}
  .mp-notif-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#e5ddd2);font-size:14px;font-weight:800;color:var(--dark,#1a1005);background:var(--light,#f5f0ea)}
  .mp-notif-head button{background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted,#8a7f6f);font-weight:800}
  .mp-notif-list{max-height:420px;overflow-y:auto}
  .mp-notif-item{display:flex;gap:11px;padding:13px 16px;cursor:pointer;border-bottom:1px solid #f0ebe2;transition:background .15s}
  .mp-notif-item:hover{background:#faf7f2}
  .mp-notif-item.unread{background:#fff8e6}
  .mp-notif-ico{font-size:21px;flex-shrink:0;margin-top:1px}
  .mp-notif-t{font-size:13px;font-weight:800;color:var(--dark,#1a1005)}
  .mp-notif-d{font-size:12px;color:var(--mid,#6b6152);margin-top:2px;line-height:1.45}
  .mp-notif-date{font-size:10.5px;color:var(--muted,#8a7f6f);margin-top:4px}
  .mp-notif-empty{text-align:center;padding:42px 20px;color:var(--muted,#8a7f6f)}
  .mp-notif-empty div:first-child{font-size:44px;margin-bottom:10px}
  @media(max-width:768px){.mp-notif-panel{top:56px;right:8px;width:calc(100vw - 16px)}.notif-bell-btn{width:36px;height:36px}}`;
  if (!document.getElementById('mpNotifStyle')) {
    const st = document.createElement('style');
    st.id = 'mpNotifStyle';
    st.textContent = NOTIF_STYLE;
    document.head.appendChild(st);
  }

  const NOTIF_ICONS = { order: '🛒', order_status: '📦', komplain: '🛠️', qna_answer: '❓', question: '❓', review: '⭐' };
  let MP_NOTIFS = [];
  let mpNotifInit = false;

  function escN(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function notifPanelHTML() {
    return `<div class="mp-notif-panel" id="mpNotifPanel">
      <div class="mp-notif-head"><span>🔔 Notifikasi</span><button type="button" onclick="MP.toggleNotif(event)">✕</button></div>
      <div class="mp-notif-list" id="mpNotifList"><div style="text-align:center;padding:30px;color:var(--muted,#8a7f6f)">⏳ Memuat...</div></div>
    </div>`;
  }

  function initNotif() {
    if (mpNotifInit) return;
    mpNotifInit = true;
    document.body.insertAdjacentHTML('beforeend', notifPanelHTML());
    document.addEventListener('click', e => {
      const p = document.getElementById('mpNotifPanel');
      const b = document.getElementById('mpNotifBell');
      if (p && p.classList.contains('open') && b && !p.contains(e.target) && !b.contains(e.target)) p.classList.remove('open');
    });
    updateNotifBadge();
    setInterval(updateNotifBadge, 30000);
  }

  function toggleNotif(e) {
    if (e) e.stopPropagation();
    const p = document.getElementById('mpNotifPanel');
    if (!p) return;
    p.classList.toggle('open');
    if (p.classList.contains('open')) loadNotifs();
  }

  // Server notif (member login) — localStorage fallback (guest, dari tracking order)
  async function serverNotifs() {
    const token = localStorage.getItem('mp_token');
    if (!token) return { list: [], unread: 0 };
    try {
      const h = { 'Content-Type': 'application/json' };
      if (token) h['Authorization'] = 'Bearer ' + token;
      const [list, ur] = await Promise.all([
        fetch('/api/notifications?unread=1', { headers: h }).then(r => r.ok ? r.json() : []),
        fetch('/api/notifications/unread-count', { headers: h }).then(r => r.ok ? r.json() : { count: 0 })
      ]);
      return { list: Array.isArray(list) ? list : [], unread: (ur && ur.count) || 0 };
    } catch (e) { return { list: [], unread: 0 }; }
  }

  async function guestNotifs() {
    const notifs = [];
    const myOrderIds = JSON.parse(localStorage.getItem('mp_my_order_ids') || '[]').slice(0, 20);
    for (const id of myOrderIds) {
      try {
        const r = await fetch('/api/orders/' + id);
        if (!r.ok) continue;
        const o = await r.json();
        const st = o.status || '';
        if (st === 'Menunggu Pembayaran') notifs.push({ key: 'order_' + id, icon: '💳', title: 'Menunggu Pembayaran', desc: 'Order ' + id + ' — selesaikan pembayaran sebelum batas waktu.', date: o.date || new Date().toISOString(), action: () => { location.href = '/'; setTimeout(() => { try { openTracking(); trackOrder(id); } catch (e) { location.href = '/'; } }, 400); } });
        else if (st === 'Dikirim') notifs.push({ key: 'order_' + id, icon: '🚚', title: 'Pesanan Dikirim', desc: 'Order ' + id + ' sedang dalam perjalanan. Pantau terus ya!', date: o.date || new Date().toISOString(), action: () => { location.href = '/'; setTimeout(() => { try { openTracking(); trackOrder(id); } catch (e) { location.href = '/'; } }, 400); } });
        else if (st === 'Selesai') notifs.push({ key: 'order_' + id, icon: '✅', title: 'Pesanan Selesai', desc: 'Order ' + id + ' telah selesai. Terima kasih sudah belanja! 🎉', date: o.date || new Date().toISOString(), action: () => { location.href = '/'; setTimeout(() => { try { openTracking(); trackOrder(id); } catch (e) { location.href = '/'; } }, 400); } });
      } catch (e) { continue; }
    }
    const myQIds = JSON.parse(localStorage.getItem('mp_my_question_ids') || '[]').slice(0, 20);
    for (const qid of myQIds) {
      try {
        const r = await fetch('/api/questions/' + qid);
        if (!r.ok) continue;
        const q = await r.json();
        if (q && q.answer) notifs.push({ key: 'qna_' + qid, icon: '💬', title: 'Pertanyaan Dijawab', desc: 'Jawaban untuk pertanyaanmu di produk "' + (q.product_name || '') + '" sudah tersedia.', date: q.answered_at || q.date || new Date().toISOString(), action: () => { location.href = '/'; setTimeout(() => { try { openProduct(q.product_id); } catch (e) { location.href = '/'; } }, 400); } });
      } catch (e) { continue; }
    }
    return { list: notifs, unread: notifs.length };
  }

  async function getNotifs() {
    const isGuest = !localStorage.getItem('mp_token');
    const src = isGuest ? await guestNotifs() : await serverNotifs();
    const readKeys = JSON.parse(localStorage.getItem('mp_notif_read') || '[]');
    return src.list.map(n => Object.assign({}, n, { unread: n.unread !== undefined ? n.unread : !readKeys.includes(n.key) }));
  }

  async function updateNotifBadge() {
    const badge = document.getElementById('mpNotifBadge');
    if (!badge) return;
    let unread = 0;
    if (localStorage.getItem('mp_token')) {
      try { const r = await serverNotifs(); unread = r.unread; } catch (e) { unread = 0; }
    } else {
      try { const n = await getNotifs(); unread = n.filter(x => x.unread).length; } catch (e) { unread = 0; }
    }
    if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }

  async function loadNotifs() {
    const el = document.getElementById('mpNotifList');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted,#8a7f6f)">⏳ Memuat...</div>';
    const notifs = await getNotifs();
    MP_NOTIFS = notifs;
    if (!notifs.length) {
      el.innerHTML = `<div class="mp-notif-empty"><div>🔔</div><div style="font-size:13px;font-weight:700">Belum ada notifikasi</div><div style="font-size:12px;margin-top:4px">Update pesanan & jawaban bakal muncul di sini.</div></div>`;
    } else {
      el.innerHTML = notifs.map((n, i) => {
        const d = new Date(n.date);
        const ds = isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return `<div class="mp-notif-item ${n.unread ? 'unread' : ''}" onclick="MP.openNotif(${i})">
          <div class="mp-notif-ico">${n.icon || '🔔'}</div>
          <div style="flex:1;min-width:0">
            <div class="mp-notif-t">${escN(n.title)}</div>
            <div class="mp-notif-d">${escN(n.desc || n.message || '')}</div>
            <div class="mp-notif-date">${ds}</div>
          </div>
        </div>`;
      }).join('');
    }
    // Mark all read (member: server; guest: localStorage)
    if (localStorage.getItem('mp_token')) {
      try {
        const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('mp_token') };
        fetch('/api/notifications/read-all', { method: 'PUT', headers: h }).catch(() => {});
      } catch (e) {}
    } else {
      localStorage.setItem('mp_notif_read', JSON.stringify(notifs.map(n => n.key).filter(Boolean)));
    }
    updateNotifBadge();
  }

  function openNotif(i) {
    const n = MP_NOTIFS[i];
    if (!n) return;
    document.getElementById('mpNotifPanel').classList.remove('open');
    if (n.action) { n.action(); return; }
    if (n.link) location.href = n.link;
  }

  document.addEventListener('DOMContentLoaded', () => { updateNotifBadge(); setInterval(updateNotifBadge, 30000); });

  // Expose helpers
  window.MP = {
    getCart, saveCart, getTQ, updateCartBadge, addToCart, fmt, esc, toggleMenu, closeMenu, goSearch,
    getUser, getToken, authHeaders,
    openAuth, closeAuth, switchAuthTab, submitLogin, submitRegister, loginSuccess, logout, authAction, updateAuthUI,
    toggleNotif, openNotif, initNotif
  };
})();

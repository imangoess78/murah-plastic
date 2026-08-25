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
  <nav class="navbar">
    <div class="navbar-inner">
      <a class="brand" href="/">
        <div class="brand-logo">M</div>
        <div><div class="brand-name">Murah Plastic</div><div class="brand-sub">by MUPA Group</div></div>
      </a>
      <div class="nav-links">
        <a class="nav-link" href="/">🏠 Home</a>
        <a class="nav-link" href="/artikel">📝 Artikel</a>
        <a class="nav-link" href="/tentang-kami">Tentang Kami</a>
        <a class="nav-link" href="/faq">FAQ</a>
      </div>
      <div class="nav-right">
        <a class="cart-btn" href="/cart">🛒 Keranjang <span class="cart-count" data-cart-count>0</span></a>
      </div>
    </div>
  </nav>
  <div class="cat-nav">
    <div class="cat-nav-inner">
      <a class="cat-nav-item" href="/#produkSection">Semua Produk</a>
      <a class="cat-nav-item" href="/#produkSection">OPP Lem Tipis</a>
      <a class="cat-nav-item" href="/#produkSection">OPP Lem Tebal</a>
      <a class="cat-nav-item" href="/#produkSection">Super Tebal</a>
      <a class="cat-nav-item" href="/#produkSection">Tanpa Lem</a>
      <a class="cat-nav-item" href="/#produkSection">Gusset Roti</a>
      <a class="cat-nav-item" href="/#produkSection">Ziplock / Klip</a>
    </div>
  </div>`;

  const FOOTER = `
  <div class="footer-gold"></div>
  <div class="footer-main">
    <div class="footer-grid">
      <div>
        <div class="f-logo">M</div>
        <div class="f-name">Murah Plastic</div>
        <p class="f-desc">Distributor plastik OPP terpercaya dari MUPA Group. Melayani UMKM, bakery, garment, dan kemasan sejak 2004.</p>
        <div class="f-col-title">Grup Toko Online</div>
        <div class="f-brands"><div class="f-brand-item">Murah Plastic</div><div class="f-brand-item">Dongbo Store</div><div class="f-brand-item">Maju Plastic</div><div class="f-brand-item">Plastikin.aja</div></div>
        <div class="f-socials">
          <a class="f-social" href="https://shopee.co.id/murahplastic" target="_blank" rel="noopener">🛒</a>
          <a class="f-social" href="https://tiktok.com/@mupaplastic" target="_blank" rel="noopener">🎵</a>
          <a class="f-social" href="#" target="_blank" rel="noopener">📸</a>
        </div>
      </div>
      <div>
        <div class="f-col-title">Kategori</div>
        <ul class="f-links">
          <li><a href="/#produkSection">OPP Lem Tipis</a></li>
          <li><a href="/#produkSection">OPP Lem Tebal</a></li>
          <li><a href="/#produkSection">Super Tebal</a></li>
          <li><a href="/#produkSection">Tanpa Lem</a></li>
          <li><a href="/#produkSection">Gusset Roti</a></li>
          <li><a href="/#produkSection">Ziplock / Klip</a></li>
        </ul>
      </div>
      <div>
        <div class="f-col-title">Informasi</div>
        <ul class="f-links">
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

  function injectLayout() {
    const navSlot = document.getElementById('site-nav');
    if (navSlot) navSlot.innerHTML = NAVBAR;
    const footSlot = document.getElementById('site-footer');
    if (footSlot) footSlot.innerHTML = FOOTER;
    updateCartBadge();
  }

  document.addEventListener('DOMContentLoaded', injectLayout);
  window.addEventListener('storage', e => { if (e.key === CART_KEY) updateCartBadge(); });

  // Expose helpers
  window.MP = { getCart, saveCart, getTQ, updateCartBadge, addToCart, fmt, esc };
})();

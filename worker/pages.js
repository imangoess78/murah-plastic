/* Murah Plastic — SSR pages (single product, single post, artikel list) */

const ORIGIN = 'https://murah-plastic.imangoess78.workers.dev';
const SITE_NAME = 'Murah Plastic';
const TAGLINE = 'Distributor Plastik OPP — Harga Grosir, Food Grade, Kirim Seluruh Indonesia';
const WA_STORE = 'https://wa.me/628129153811';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}
function imgUrl(p) {
  if (p && p.img) return p.img.replace(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\//, '/img/');
  return '';
}
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  const t = stripHtml(s);
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
}
function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return String(d || '').slice(0, 10); }
}
function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'artikel-' + Date.now();
}

// ── Layout shell ──
function layout({ title, desc, canonical, ogImage, jsonLd, body, bodyClass = '', script = '' }) {
  const descText = truncate(desc || TAGLINE, 158);
  const jsonLdHtml = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(descText)}">
<link rel="canonical" href="${esc(canonical || ORIGIN + '/')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(descText)}">
<meta property="og:url" content="${esc(canonical || ORIGIN + '/')}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(descText)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23C8191A'/><text x='50' y='68' font-size='50' font-weight='900' fill='white' text-anchor='middle'>M</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${jsonLdHtml}
</head>
<body class="${bodyClass}">
<div id="site-nav"></div>
<main>${body}</main>
<footer class="footer" id="site-footer"></footer>
<script src="/assets/site.js"></script>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

// ── Breadcrumb ──
function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="breadcrumb">
    <a href="/">Home</a>
    ${items.map(it => `<span class="sep">›</span><a href="${it.href}">${esc(it.label)}</a>`).join('')}
  </nav>`;
}

// ── Single Product ──
export async function renderProduct(env, p) {
  // p sudah berupa objek product lengkap (dari findProduct); dukung juga string id utk backward-compat
  if (typeof p === 'string') {
    const row = await env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(p).first();
    if (!row) return null;
    p = { ...row, variants: JSON.parse(row.variants || '[]'), specs: JSON.parse(row.specs || '{}') };
  }
  if (!p || !p.id) return null;

  // Diskusi / tanya jawab produk (SSR — daftar pertanyaan + jawaban)
  let qnaList = [];
  try {
    const qres = await env.DB.prepare("SELECT id,user_name,question,answer,date,answered_at FROM questions WHERE product_id=? ORDER BY date DESC LIMIT 50").bind(p.id).all();
    qnaList = qres.results || [];
  } catch (e) {}

  const prices = (p.variants || []).filter(v => v.price > 0).map(v => v.price);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const priceLabel = minP === maxP ? fmt(minP) : `${fmt(minP)} – ${fmt(maxP)}`;
  const img = imgUrl(p);
  const fullImg = img ? (img.startsWith('http') ? img : ORIGIN + img) : '';

  // Related products (same category, exclude self)
  const { results: relatedRows } = await env.DB.prepare(
    'SELECT id,slug,name,short_name,category,img,min_price,max_price,variants FROM products WHERE active=1 AND category=? AND id<>? ORDER BY min_price LIMIT 4'
  ).bind(p.category || '', p.id).all();
  const related = (relatedRows.length >= 2 ? relatedRows : []);
  if (related.length < 4) {
    const { results: more } = await env.DB.prepare(
      'SELECT id,slug,name,short_name,category,img,min_price,max_price,variants FROM products WHERE active=1 AND id<>? ORDER BY min_price LIMIT ?'
    ).bind(p.id, 4 - related.length).all();
    for (const m of more) if (!related.find(r => r.id === m.id)) related.push(m);
  }

  // Specs table
  const sortedVars = [...p.variants].filter(v => v.price > 0).sort((a, b) => a.price - b.price);
  const sizes = sortedVars.map(v => v.name.split(' ')[0]).slice(0, 8).join(', ') + (sortedVars.length > 8 ? ` ...(+${sortedVars.length - 8})` : '');
  const allSpecs = { 'Kategori': p.category, ...p.specs, 'Ukuran Tersedia': sizes, 'Jumlah Varian': sortedVars.length + ' pilihan' };
  const specRows = Object.entries(allSpecs).filter(([, v]) => v).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('');

  // Variant options
  const varOpts = sortedVars.map((v, i) => `
    <div class="pd-var-opt${i === 0 ? ' sel' : ''}" data-price="${v.price}" onclick="selVar(this,'${esc(v.name).replace(/'/g, "\\'")}',${v.price})">
      <div class="pd-var-name">${esc(v.name)}</div>
      <div class="pd-var-price">${fmt(v.price)}</div>
    </div>`).join('');

  // Badges
  const badges = ['📦 Isi 100 pcs/pack', '🚚 Gratis Ongkir min. Rp500rb'];
  if (p.specs && p.specs['Food Grade']) badges.unshift('✅ Food Grade');
  const discTiers = [{ min: 100, pct: 20 }, { min: 50, pct: 10 }, { min: 10, pct: 5 }, { min: 5, pct: 2 }];

  const minPackNote = `📦 Minimum <strong>5 pack</strong> per produk. Boleh campur ukuran!`;

  const relatedHtml = related.length ? `
    <div class="pd-related-title">🛍️ Produk Serupa</div>
    <div class="p-grid">
      ${related.map(r => homeCard(r)).join('')}
    </div>` : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: fullImg ? [fullImg] : undefined,
    description: stripHtml(p.desc || p.name),
    category: p.category,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'IDR',
      lowPrice: minP,
      highPrice: maxP || minP,
      offerCount: sortedVars.length,
      availability: 'https://schema.org/InStock',
      url: ORIGIN + '/produk/' + (p.slug || p.id)
    }
  };

  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/shop', label: 'Shop' }, { href: '/produk/' + (p.slug || p.id), label: (p.short_name || p.name).substring(0, 40) }])}
    <div class="pd-main">
      <div class="pd-gallery">
        <div class="pd-img-box">
          ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" onerror="this.outerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;font-size:72px&quot;>📦</div>'">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:72px">📦</div>'}
        </div>
        <div class="pd-badges">${badges.map(b => `<span class="pd-badge">${b}</span>`).join('')}</div>
      </div>
      <div>
        <div class="pd-cat">${esc(p.category || 'Produk')}</div>
        <h1 class="pd-name">${esc(p.name)}</h1>
        <div class="pd-price" id="pdPrice">${priceLabel}</div>
        <div class="pd-price-sub">per pack isi 100 pcs · ${sortedVars.length} pilihan ukuran${minP !== maxP ? ' · mulai ' + fmt(minP) : ''}</div>
        <div class="pd-disc-row">${discTiers.map(t => `<span class="pd-disc-badge">${t.pct}% (${t.min}+ pack)</span>`).join('')}</div>

        ${minPackNote}
        <div class="pd-lbl">Pilih Ukuran & Jumlah</div>
        <div class="pd-var-grid" id="varGrid">${varOpts}</div>

        <div class="pd-qty-row" style="display:flex;align-items:center;gap:12px;margin:18px 0">
          <span style="font-size:13px;font-weight:700;color:var(--mid)">Jumlah:</span>
          <button class="cqb" type="button" onclick="chQty(-1)">−</button>
          <input type="number" id="qtyLbl" value="5" min="5" step="1" inputmode="numeric" aria-label="Jumlah pesanan" oninput="qtyInput()" onchange="qtyCommit()" style="width:72px;text-align:center;font-weight:900;font-size:16px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;background:white;color:var(--dark);font-family:var(--font)">
          <button class="cqb" type="button" onclick="chQty(1)">+</button>
          <span id="qtyHint" style="font-size:12px;color:var(--muted)"></span>
        </div>

        <div id="pdSumBox" class="pd-sum-box" style="background:var(--light);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin:16px 0"></div>

        <div class="pd-actions">
          <button class="pd-cart-btn" id="addCartBtn" onclick="doCart(false)">🛒 Tambah ke Keranjang</button>
          <button class="pd-buy-btn" id="buyBtn" onclick="doCart(true)">⚡ Beli Sekarang</button>
        </div>
        <div style="margin-top:10px">
          <button class="wl-btn" id="wlBtn" onclick="toggleWish()">🤍 Simpan ke Wishlist</button>
        </div>
        <div id="toastMsg" class="toast"></div>
      </div>
    </div>

    <div class="pd-panel">
      <div class="pd-panel-title">📋 Spesifikasi Produk</div>
      <table class="pd-specs-table">${specRows}</table>
    </div>

    <div class="pd-panel">
      <div class="pd-panel-title">📝 Deskripsi Produk</div>
      <div class="pd-desc">${esc(p.desc || 'Tidak ada deskripsi.')}</div>
    </div>

    <div class="pd-panel">
      <div class="pd-panel-title">⭐ Review Pembeli</div>
      <div id="reviewBox">
        <div style="font-size:13px;color:var(--muted);padding:8px 0">⏳ Memuat review...</div>
      </div>
    </div>

    <div class="pd-panel">
      <div class="pd-panel-title">💬 Diskusi Produk (${qnaList.length})</div>
      <div id="qnaBox">
        ${qnaList.length === 0 ? '<div style="font-size:13px;color:var(--muted);padding:8px 0">Belum ada pertanyaan. Jadi yang pertama bertanya tentang produk ini!</div>' :
          qnaList.map(q => `
          <div style="border:1px solid #eee;border-radius:10px;padding:12px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="width:26px;height:26px;border-radius:50%;background:var(--red);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">${esc((maskName(q.user_name)||'A')[0])}</div>
              <div><div style="font-size:12px;font-weight:800;color:var(--dark)">${esc(maskName(q.user_name))}</div><div style="font-size:11px;color:var(--muted)">${q.date ? new Date(q.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : ''}</div></div>
            </div>
            <div style="font-size:13px;color:var(--dark)">❔ ${esc(q.question)}</div>
            ${q.answer ? `<div style="background:var(--light);border-radius:8px;padding:10px 12px;margin-top:8px;font-size:13px;color:var(--mid)">💬 <strong>Jawaban Toko:</strong> ${esc(q.answer)}</div>` : '<div style="font-size:12px;color:var(--muted);margin-top:6px;font-style:italic">⏳ Menunggu jawaban dari penjual</div>'}
          </div>`).join('')}
        <div id="qnaLoginBox" style="margin-top:12px;padding:12px;background:var(--light);border-radius:8px;text-align:center;font-size:13px;color:var(--muted)">
          🔒 <a href="#" onclick="MP.openAuth('login');return false" style="color:var(--red);font-weight:700;text-decoration:underline">Masuk</a> untuk bertanya
        </div>
        <div id="qnaForm" style="display:none;margin-top:12px">
          <textarea id="qnaQuestion" class="rv-textarea" placeholder="Tanya apa aja soal produk ini, mis. bahan, ketebalan, cara pesan..." style="min-height:70px"></textarea>
          <button class="btn-red" style="border:none;cursor:pointer;margin-top:8px" onclick="submitQna()">📤 Kirim Pertanyaan</button>
        </div>
      </div>
    </div>

    <div class="pd-panel">
      <div class="pd-panel-title">💬 Butuh Bantuan?</div>
      <p style="font-size:13px;color:var(--mid);line-height:1.7;margin-bottom:14px">Punya pertanyaan soal produk ini, ukuran, atau pesan partai besar? Tim kami siap bantu via WhatsApp.</p>
      <a class="btn-red" href="${WA_STORE}?text=${encodeURIComponent('Halo, saya mau tanya produk: ' + p.name)}" target="_blank" rel="noopener">💬 Chat WhatsApp</a>
    </div>

    ${relatedHtml}
  </div>`;

  const script = `
  let qty = 5, curPrice = ${sortedVars.length ? sortedVars[0].price : 0};
  const MIN_PACK = 5;
  const MAX_QTY = 100000;
  const pid = ${JSON.stringify(p.id)};
  const pname = ${JSON.stringify(p.short_name || p.name)};
  const pimg = ${JSON.stringify(img)};
  function selVar(el, name, price) {
    document.querySelectorAll('.pd-var-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel'); curPrice = price;
    if (qty < MIN_PACK) { qty = MIN_PACK; document.getElementById('qtyLbl').value = qty; }
    updatePrice();
  }
  function getQty() {
    const v = parseInt(document.getElementById('qtyLbl').value, 10);
    return isNaN(v) || v < 1 ? 0 : v;
  }
  function chQty(d) {
    let v = getQty() || MIN_PACK;
    v = Math.max(MIN_PACK, v + d);
    qty = v;
    document.getElementById('qtyLbl').value = v;
    updatePrice();
  }
  function qtyInput() { // live preview saat mengetik (tanpa clamp biar gampang ngetik)
    const v = getQty();
    if (v > 0) { qty = v; updatePrice(); }
  }
  function qtyCommit() { // saat blur/enter — clamp ke min & max
    let v = getQty();
    if (v < MIN_PACK) v = MIN_PACK;
    if (v > MAX_QTY) v = MAX_QTY;
    qty = v;
    document.getElementById('qtyLbl').value = v;
    updatePrice();
  }
  const DISC_TIERS = [{min:100,pct:20},{min:50,pct:10},{min:10,pct:5},{min:5,pct:2}];
  function getDiscPct(q){ for (const t of DISC_TIERS) if (q >= t.min) return t.pct; return 0; }
  function updatePrice() {
    const pct = getDiscPct(qty);
    const sub = curPrice * qty;
    const disc = Math.round(sub * pct / 100);
    const total = sub - disc;
    document.getElementById('pdPrice').textContent = MP.fmt(curPrice);
    document.getElementById('qtyHint').textContent = pct > 0 ? '🏷️ Diskon ' + pct + '% berlaku' : '';
    document.getElementById('pdSumBox').innerHTML =
      '<div class="sum-row"><span>Harga Satuan</span><span>' + MP.fmt(curPrice) + '</span></div>' +
      '<div class="sum-row"><span>Jumlah</span><span>' + qty + ' pack</span></div>' +
      '<div class="sum-row"><span>Subtotal</span><span>' + MP.fmt(sub) + '</span></div>' +
      (pct > 0
        ? '<div class="sum-row"><span style="color:#16A34A;font-weight:700">🏷️ Diskon ' + pct + '%</span><span class="neg">-' + MP.fmt(disc) + '</span></div>'
        : '') +
      '<div class="sum-row grand"><span>Total Harga</span><span>' + MP.fmt(total) + '</span></div>';
  }
  function doCart(buy) {
    qtyCommit(); // normalisasi nilai yang diketik user
    if (qty < MIN_PACK) { showToast('Minimal ' + MIN_PACK + ' pack!'); return; }
    if (qty > MAX_QTY) { showToast('Maksimal ' + MAX_QTY.toLocaleString('id-ID') + ' pack per produk'); return; }
    const sel = document.querySelector('.pd-var-opt.sel');
    const vname = sel ? sel.querySelector('.pd-var-name').textContent : 'Standar';
    MP.addToCart(pid, pname, vname, curPrice, qty, pimg);
    if (buy) {
      showToast('⚡ ' + qty + ' pack ' + vname + ' → checkout');
      setTimeout(() => location.href = '/checkout', 600);
    } else {
      // Tetap di halaman supaya user bisa tambah varian lain / lanjut belanja
      showCartToast('✅ ' + qty + ' pack ' + vname + ' masuk keranjang');
    }
  }
  function showCartToast(msg) {
    const el = document.getElementById('toastMsg');
    if (!el) return;
    el.innerHTML = msg + ' <a href="/cart" style="color:white;font-weight:800;text-decoration:underline;white-space:nowrap">Lihat Keranjang →</a>';
    el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4000);
  }
  function showToast(t) {
    const el = document.getElementById('toastMsg');
    el.textContent = t; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2000);
  }
  // ── Wishlist ──
  let wlOn = false;
  function wlBtnHtml() {
    const b = document.getElementById('wlBtn');
    if (b) b.innerHTML = wlOn ? '❤️ <span style="font-size:12px;font-weight:700">Di Wishlist</span>' : '🤍 <span style="font-size:12px;font-weight:700">Simpan ke Wishlist</span>';
  }
  async function initWish() {
    const u = MP.getUser(), tok = MP.getToken();
    if (!u || !tok) { wlBtnHtml(); return; }
    try {
      const res = await fetch('/api/account/wishlist/ids', { headers: { 'Authorization': 'Bearer ' + tok } });
      if (res.ok) {
        const ids = await res.json();
        wlOn = ids.includes(pid);
        wlBtnHtml();
      }
    } catch (e) {}
  }
  async function toggleWish() {
    const u = MP.getUser(), tok = MP.getToken();
    if (!u || !tok) { MP.openAuth('login'); return; }
    try {
      if (wlOn) {
        await fetch('/api/account/wishlist?product_id=' + encodeURIComponent(pid), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tok } });
        wlOn = false;
        showToast('Dihapus dari wishlist');
      } else {
        await fetch('/api/account/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify({ product_id: pid }) });
        wlOn = true;
        showToast('❤️ Disimpan ke wishlist');
      }
      wlBtnHtml();
    } catch (e) { showToast('Gagal memproses wishlist'); }
  }
  // ── Review ──
  let myRating = 0;
  function starRow() {
    return [1,2,3,4,5].map(n => '<span class="rv-star' + (myRating >= n ? ' sel' : '') + '" data-n="' + n + '" onclick="pickStar(' + n + ')">★</span>').join('');
  }
  function pickStar(n) {
    myRating = n;
    const cont = document.getElementById('rvStars');
    if (cont) cont.innerHTML = starRow();
  }
  function escT(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  async function loadReviews() {
    const box = document.getElementById('reviewBox');
    try {
      const res = await fetch('/api/reviews?productId=' + encodeURIComponent(pid));
      const list = res.ok ? await res.json() : [];
      const u = MP.getUser();
      const avg = list.length ? (list.reduce((s, r) => s + (r.rating || 5), 0) / list.length).toFixed(1) : 0;
      let items = '';
      if (list.length) {
        items = list.map(function (r) {
          const v = r.verified ? ' <span class="rv-item-verified">✔ Pembelian Terverifikasi</span>' : '';
          const d = new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
          return '<div class="rv-item"><div class="rv-item-head"><span class="rv-item-name">' + escT(r.user_name ? r.user_name.slice(0, 2) + '***' : 'Anonim') + v + '</span><span class="rv-item-date">' + d + '</span></div><div class="rv-item-stars">' + '★'.repeat(Math.max(1, Math.min(5, r.rating))) + '</div><div class="rv-item-comment">' + escT(r.comment) + '</div></div>';
        }).join('');
      } else {
        items = '<div class="wl-empty" style="padding:24px"><div class="wl-empty-icon">💬</div><div class="akun-empty-sub" style="font-size:13px;color:var(--muted)">Belum ada review. Jadilah yang pertama memberi review!</div></div>';
      }
      let html = '';
      if (list.length) html += '<div style="font-size:13px;font-weight:800;color:var(--dark);margin-bottom:12px">⭐ ' + avg + ' / 5 dari ' + list.length + ' review</div>';
      html += '<div class="rv-list" style="margin-top:0">' + items + '</div>';
      if (u) {
        try {
          const tok = MP.getToken();
          const res = await fetch('/api/account/orders', {headers:{'Authorization':'Bearer '+tok}});
          let canReview = false;
          if (res.ok) {
            const orders = await res.json();
            canReview = orders.some(function(o){return o.status==='Selesai'&&JSON.stringify(o.items||[]).includes(pname);});
          }
          if (canReview) {
            html += '<div style="border-top:1px dashed #ddd;margin-top:14px;padding-top:14px"><div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:8px">✍️ Tulis Review Kamu</div><div class="rv-stars" id="rvStars">' + starRow() + '</div><textarea class="rv-textarea" id="rvComment" placeholder="Bagaimana kualitas produk ini? Ceritakan pengalamanmu... (wajib)" maxlength="1000"></textarea><div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button class="akun-form-save" onclick="submitReview()">Kirim Review</button><span id="rvStatus" style="font-size:12px;color:var(--muted)"></span></div></div>';
          } else {
            html += '<div style="border-top:1px dashed #ddd;margin-top:14px;padding-top:12px;font-size:12.5px;color:var(--muted)">🛍️ Beli produk ini dan tunggu pesanan Selesai untuk memberi review.</div>';
          }
        } catch(e) {
          html += '<div style="border-top:1px dashed #ddd;margin-top:14px;padding-top:12px;font-size:12.5px;color:var(--muted)">🔐 <a href="javascript:MP.openAuth(\\'login\\')" style="color:var(--red);font-weight:700">Masuk</a> untuk menulis review.</div>';
        }
      } else {
        html += '<div style="border-top:1px dashed #ddd;margin-top:14px;padding-top:12px;font-size:12.5px;color:var(--muted)">🔐 <a href="javascript:MP.openAuth(\\\'login\\\')" style="color:var(--red);font-weight:700">Masuk</a> untuk menulis review.</div>';
      }
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">Review gagal dimuat.</div>';
    }
  }
  async function submitReview() {
    const comment = document.getElementById('rvComment').value.trim();
    const status = document.getElementById('rvStatus');
    const u = MP.getUser(), tok = MP.getToken();
    if (!u || !tok) { MP.openAuth('login'); return; }
    if (!myRating) { status.textContent = '⚠️ Pilih rating dulu (1-5 bintang)'; return; }
    if (!comment) { status.textContent = '⚠️ Tulis komentar review dulu'; return; }
    status.textContent = 'Mengirim...';
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ product_id: pid, rating: myRating, comment })
      });
      if (res.ok) {
        status.style.color = '#16A34A';
        status.textContent = '✔ Review terkirim! Terima kasih.';
        myRating = 0;
        document.getElementById('rvComment').value = '';
        const rv = document.getElementById('rvStars');
        if (rv) rv.innerHTML = starRow();
        setTimeout(loadReviews, 1200);
      } else {
        const e = await res.json().catch(() => ({}));
        status.textContent = '❌ ' + (e.error || 'Gagal mengirim review');
      }
    } catch (e) { status.textContent = '❌ Gagal mengirim review'; }
  }
  initWish();
  loadReviews();
  updatePrice();
  ${WISH_SCRIPT}
  // ── Diskusi Produk (QnA) ──
  (function(){
    const tok = window.MP && MP.getToken ? MP.getToken() : null;
    const form = document.getElementById('qnaForm'), loginBox = document.getElementById('qnaLoginBox');
    if (form && loginBox) {
      if (tok) { form.style.display = 'block'; loginBox.style.display = 'none'; }
      else { form.style.display = 'none'; loginBox.style.display = 'block'; }
    }
  })();
  async function submitQna(){
    const u = MP.getUser(), tok = MP.getToken();
    if (!u || !tok) { MP.openAuth('login'); return; }
    const q = (document.getElementById('qnaQuestion')||{}).value || '';
    if (!q.trim()) { alert('Pertanyaan wajib diisi!'); return; }
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ id: 'Q-' + Date.now().toString(36).toUpperCase(), productId: pid, productName: pname, userName: u.name, question: q.trim(), date: new Date().toISOString(), answer: null, answerDate: null })
      });
      if (res.ok) { alert('Pertanyaan terkirim! ✅'); location.reload(); }
      else { const e = await res.json().catch(()=>({})); alert('❌ ' + (e.error || 'Gagal mengirim pertanyaan')); }
    } catch (e) { alert('❌ Gagal mengirim pertanyaan'); }
  }
  ${QUICKMODAL_SCRIPT}`;

  return { html: layout({ title: `${p.name} — ${SITE_NAME}`, desc: truncate(p.desc || p.name, 155), canonical: ORIGIN + '/produk/' + (p.slug || p.id), ogImage: fullImg, jsonLd, body, bodyClass: 'page-product', script }), script };
}

// ── Single Post ──
export async function renderPost(env, slug) {
  // Seed artikel jika belum ada (biar halaman tidak kosong)
  await ensureArticles(env);
  const row = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='Published'").bind(slug).first();
  if (!row) return null;
  // increment views (best-effort)
  try { await env.DB.prepare('UPDATE articles SET views=views+1 WHERE id=?').bind(row.id).run(); } catch (e) {}

  const title = row.title || 'Artikel';
  const img = (row.image || '').replace(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\//, '/img/');
  const fullImg = img ? (img.startsWith('http') ? img : ORIGIN + img) : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    image: fullImg ? [fullImg] : undefined,
    datePublished: row.created_at,
    dateModified: row.updated_at || row.created_at,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    description: truncate(stripHtml(row.content || ''), 155),
    mainEntityOfPage: ORIGIN + '/artikel/' + slug
  };

  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/artikel', label: 'Artikel' }, { href: '/artikel/' + slug, label: title.substring(0, 40) }])}
    <article>
      <div class="post-hero">
        <div class="post-cat">${esc(row.category || 'Blog')}</div>
        <h1 class="post-title">${esc(title)}</h1>
        <div class="post-meta">
          <span>📅 ${fmtDate(row.created_at)}</span>
          <span>👁️ ${Number(row.views || 0) + 1}x dibaca</span>
        </div>
      </div>
      ${img ? `<div class="post-thumb"><img src="${esc(img)}" alt="${esc(title)}" onerror="this.style.display='none'"></div>` : ''}
      <div class="post-body">
        <div class="post-content">${row.content || '<p>Konten belum tersedia.</p>'}</div>
        <div class="post-share">
          <span class="post-share-label">Bagikan:</span>
          <button class="share-btn" onclick="shareWA()">💬 WhatsApp</button>
          <button class="share-btn" onclick="shareFB()">📘 Facebook</button>
          <button class="share-btn" onclick="shareTW()">🐦 X / Twitter</button>
        </div>
      </div>
    </article>
  </div>`;

  const script = `
  function shareWA() { window.open('https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + location.href), '_blank'); }
  function shareFB() { window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href), '_blank'); }
  function shareTW() { window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(document.title + ' ' + location.href), '_blank'); }`;

  return { html: layout({ title: `${title} — ${SITE_NAME}`, desc: truncate(stripHtml(row.content || ''), 155), canonical: ORIGIN + '/artikel/' + slug, ogImage: fullImg, jsonLd, body, bodyClass: 'page-post', script }), script };
}

// ── Seed artikel default (hanya jika tabel kosong) ──
const DEFAULT_ARTICLES = [
  {
    slug: 'cara-pilih-plastik-opp-untuk-bisnis-bakery',
    title: 'Cara Pilih Plastik OPP untuk Bisnis Bakery',
    category: 'Bakery & Makanan',
    emoji: '🥐',
    content: `<p>Plastik OPP (Oriented Polypropylene) adalah plastik kemasan paling populer untuk produk bakery karena <strong>bening, ringan, dan aman untuk makanan</strong>. Tapi memilih ketebalan yang salah bisa membuat produkmu terlihat murahan — atau malah merusak tekstur kue.</p>
<h2>Kenapa ketebalan itu penting?</h2>
<p>Ketebalan plastik OPP diukur dalam <strong>mikron</strong> (µ). Makin besar angka mikron, makin tebal dan kuat plastiknya. Pilihan yang umum: 18, 26, 29, dan 38 mikron.</p>
<ul>
<li><strong>18 mikron</strong> — tipis & murah, cocok untuk roti manis, snack ringan, dan produk yang langsung dikonsumsi.</li>
<li><strong>26 mikron</strong> — sedang, cocok untuk roti tawar, kue kering, dan kemasan yang butuh daya tahan lebih.</li>
<li><strong>29 mikron</strong> — tebal, cocok untuk kue basah, brownies, dan produk yang agak berat.</li>
<li><strong>38 mikron</strong> — super tebal, cocok untuk produk premium, hampers, dan kemasan yang ingin terlihat mewah.</li>
</ul>
<h2>Tips memilih yang tepat</h2>
<p>Perhatikan bobot produk dan seberapa sering kemasan akan dibuka-tutup. Untuk produk premium, jangan pelit di ketebalan — kemasan yang kokoh menaikkan persepsi nilai jual.</p>
<p>Butuh bantuan menentukan ukuran? <strong>Chat admin kami via WhatsApp</strong> — gratis konsultasi, tanpa syarat!</p>`
  },
  {
    slug: 'bedanya-plastik-tipis-tebal-dan-super-tebal',
    title: 'Bedanya Plastik Tipis, Tebal, dan Super Tebal',
    category: 'Panduan Produk',
    emoji: '📏',
    content: `<p>Di pasaran, plastik OPP sering dibedakan jadi <strong>lem tipis, lem tebal, dan lem super tebal</strong>. Apa sebenarnya bedanya? Ini penting supaya kamu tidak salah beli.</p>
<h2>1. OPP Lem Tipis</h2>
<p>Ketebalan sekitar <strong>18–20 mikron</strong>. Lembut, mudah ditekuk, dan paling ekonomis. Cocok untuk pengemasan cepat produk ringan seperti snack, kerupuk, dan roti manis dalam jumlah banyak.</p>
<h2>2. OPP Lem Tebal</h2>
<p>Ketebalan sekitar <strong>26–29 mikron</strong>. Lebih kokoh, tetap bening, dan daya lem lebih kuat. Pilihan favorit untuk roti tawar, kue kering, dan produk dengan bobot sedang.</p>
<h2>3. OPP Lem Super Tebal</h2>
<p>Ketebalan <strong>38 mikron ke atas</strong>. Kaku, premium, dan sangat awet. Ideal untuk hampers, produk ekspor, dan kemasan yang ingin tampil mewah. Harganya memang lebih tinggi, tapi kesan produkmu jadi jauh lebih baik.</p>
<h2>Jadi pilih yang mana?</h2>
<p>Mulailah dari kebutuhan dan budget. Kalau ragu, pesan sampel dari beberapa ketebalan lalu bandingkan langsung. Tim Murah Plastic siap bantu rekomendasi sesuai produkmu.</p>`
  },
  {
    slug: 'tips-packaging-produk-biar-lebih-premium',
    title: 'Tips Packaging Produk Biar Lebih Premium',
    category: 'Tips UMKM',
    emoji: '✨',
    content: `<p>Kemasan adalah <strong>"pakaian"</strong> produkmu. Kemasan yang tepat bisa menaikkan nilai jual hingga berkali-kali lipat. Berikut tips packaging ala Murah Plastic:</p>
<h2>1. Pilih plastik bening berkualitas</h2>
<p>Plastik OPP bening yang jernih (bukan buram) membuat produk terlihat segar dan menggugah selera. Pilih ketebalan yang sesuai — jangan sampai kemasan kusut karena terlalu tipis.</p>
<h2>2. Tambahkan stiker logo</h2>
<p>Kombinasi plastik bening + stiker logo yang rapi adalah formula paling efektif. Konsumen langsung mengenali brand-mu, dan produk terlihat profesional meski buatan rumahan.</p>
<h2>3. Jaga kebersihan & kerapian</h2>
<p>Lem yang rapi, lipatan yang presisi, dan seal yang kuat memberi kesan produk berkualitas. Kerapian adalah detail kecil yang sangat diperhatikan pelanggan.</p>
<h2>4. Gunakan ukuran yang pas</h2>
<p>Kemasan yang terlalu longgar membuat produk "berenang" di dalamnya; terlalu sempit membuatnya penyok. Pilih ukuran yang pas — Murah Plastic punya puluhan pilihan ukuran.</p>
<p>Lihat koleksi lengkapnya di halaman produk kami, atau tanya admin untuk rekomendasi ukuran yang paling cocok!</p>`
  }
];

async function ensureArticles(env) {
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM articles').first();
    if (row && row.c > 0) return;
    const now = new Date().toISOString();
    for (const a of DEFAULT_ARTICLES) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO articles (id, slug, title, category, content, image, status, views, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).bind('art-' + a.slug, a.slug, a.title, a.category, a.content, '', 'Published', 0, now, now).run();
    }
  } catch (e) {
    // best-effort; jangan gagalkan halaman kalau seed error
  }
}

// ── Artikel List ──
export async function renderArticles(env) {
  await ensureArticles(env);
  const { results } = await env.DB.prepare("SELECT id,slug,title,category,content,image,views,created_at FROM articles WHERE status='Published' ORDER BY created_at DESC LIMIT 50").all();

  let cards;
  if (!results.length) {
    cards = `<div class="cart-empty" style="padding:60px 0">
      <div class="cart-empty-icon">📝</div>
      <div class="cart-empty-title">Belum Ada Artikel</div>
      <div class="cart-empty-sub">Artikel & tips seputar plastik OPP akan segera hadir. Sambil menunggu, yuk lihat koleksi produk kami.</div>
      <a class="btn-red" href="/#produkSection">🛒 Lihat Produk</a>
    </div>`;
  } else {
    cards = `<div class="a-grid">${results.map(a => {
      const img = (a.image || '').replace(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\//, '/img/');
      return `<a class="a-card" href="/artikel/${esc(a.slug)}">
        ${img ? `<div class="a-thumb"><img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy" onerror="this.parentElement.textContent='📝'"></div>` : `<div class="a-thumb">📝</div>`}
        <div class="a-body">
          <div class="a-tag">${esc(a.category || 'Blog')}</div>
          <div class="a-title">${esc(a.title)}</div>
          <div class="a-desc">${esc(truncate(stripHtml(a.content || ''), 110))}</div>
          <div class="a-meta">📅 ${fmtDate(a.created_at)} · 👁️ ${Number(a.views || 0)}x dibaca</div>
          <div class="a-read">Baca selengkapnya →</div>
        </div>
      </a>`;}).join('')}</div>`;
  }

  const body = `
  <div class="wrap">
    <div class="page-head">
      <div class="page-title">📝 Artikel & Tips</div>
      <div class="page-sub">Panduan memilih plastik OPP, tips packaging untuk UMKM, dan info seputar kemasan produk.</div>
    </div>
    ${cards}
  </div>`;

  return { html: layout({ title: `Artikel & Tips — ${SITE_NAME}`, desc: 'Panduan memilih plastik OPP, tips packaging UMKM, dan info seputar kemasan produk dari Murah Plastic.', canonical: ORIGIN + '/artikel', body, bodyClass: 'page-artikel', script: '' }), script: '' };
}

// Mask nama untuk tampilan publik: "Agus" → "Ag***"
function maskName(n){
  const s = String(n || '').trim();
  if (!s || s.toLowerCase() === 'anonim') return 'Anonim';
  return s.slice(0, 2) + '***';
}

// ── Kartu produk (sama persis dengan card di home — index.html renderProducts) ──
const BESTSELLER_IDS = ['29463366459','19626400134'];
// Script wishlist untuk halaman SSR (shop/archive/kategori/produk)
const WISH_SCRIPT = `function toggleWish(id,e){if(e&&e.preventDefault)e.preventDefault();if(e&&e.stopPropagation)e.stopPropagation();let w=JSON.parse(localStorage.getItem('mp_wish')||'[]');const i=w.indexOf(id);if(i>-1)w.splice(i,1);else w.push(id);localStorage.setItem('mp_wish',JSON.stringify(w));const b=e&&e.currentTarget;if(b){b.classList.toggle('active',i>-1);b.textContent=i>-1?'🤍':'❤️';}}
function quickAdd(btn,e){if(e){e.preventDefault();e.stopPropagation();}const d=btn.dataset;try{let c=JSON.parse(localStorage.getItem('mp_cart')||'[]');const k=d.id+'|'+d.variant;const ex=c.find(x=>x.key===k);if(ex){ex.qty+=Number(d.minpack||5);}else{c.push({key:k,productId:d.id,slug:d.slug,productName:d.name,variantName:d.variant,price:Number(d.price),qty:Number(d.minpack||5),img:d.img});}localStorage.setItem('mp_cart',JSON.stringify(c));if(window.MP&&MP.updateCartBadge)MP.updateCartBadge();showToast('✓ Ditambahkan ke keranjang');}catch(err){alert('Gagal menambahkan ke keranjang');}}
function showToast(msg){var t=document.createElement('div');t.textContent=msg;Object.assign(t.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'#16A34A',color:'white',padding:'10px 24px',borderRadius:'30px',fontSize:'14px',fontWeight:'700',zIndex:9999,boxShadow:'0 4px 16px rgba(0,0,0,0.2)',transition:'opacity 0.3s'});document.body.appendChild(t);setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove()},300)},2000);}
document.querySelectorAll('.wish-btn').forEach(function(b){if(JSON.parse(localStorage.getItem('mp_wish')||'[]').includes(b.getAttribute('data-id'))){b.classList.add('active');b.textContent='❤️';}});`;
// Script pemilih varian untuk kartu produk di halaman SSR (override quickAdd lama:
// klik "+ Keranjang" → pilih varian + qty dulu, TIDAK langsung masuk keranjang)
const QUICKMODAL_SCRIPT = `
function escQA(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function qaFmt(n){return 'Rp' + Math.round(n).toLocaleString('id-ID');}
function qaDisc(q){var t=[[100,20],[50,10],[10,5],[5,2]];for(var i=0;i<t.length;i++){if(q>=t[i][0])return t[i][1];}return 0;}
var qaD=null,qaV=null,qaQ=5;
function openQA(p){qaD=p;qaV=p.variants[0]||null;qaQ=Number(p.minpack||5);renderQA();document.getElementById('qaOverlay').classList.add('open');document.body.style.overflow='hidden';}
function closeQA(){document.getElementById('qaOverlay').classList.remove('open');document.body.style.overflow='';}
function qaPick(n){if(!qaD)return;for(var i=0;i<qaD.variants.length;i++){if(qaD.variants[i].name===n){qaV=qaD.variants[i];break;}}renderQA();}
function qaCh(d){qaQ=Math.max(Number(qaD.minpack||5),Math.min(100000,(qaQ||Number(qaD.minpack||5))+d));var el=document.getElementById('qaQty');if(el)el.value=qaQ;qaUpdateSum();}
function qaSet(){var el=document.getElementById('qaQty');if(!el)return;var v=parseInt(el.value)||0;if(v<Number(qaD.minpack||5))v=Number(qaD.minpack||5);if(v>100000)v=100000;qaQ=v;el.value=v;qaUpdateSum();}
function qaSumHtml(){
  if(!qaD||!qaV)return '';
  var disc=qaDisc(qaQ);
  var sub=qaV.price*qaQ;
  var discAmt=Math.round(sub*disc/100);
  var total=sub-discAmt;
  var h='<div class="qa-sum-row"><span>Harga Satuan</span><span>'+qaFmt(qaV.price)+'</span></div>';
  h+='<div class="qa-sum-row"><span>Jumlah</span><span>'+qaQ+' pack</span></div>';
  h+='<div class="qa-sum-row"><span>Subtotal</span><span>'+qaFmt(sub)+'</span></div>';
  if(disc>0)h+='<div class="qa-sum-row"><span style="color:#16A34A;font-weight:700">🏷️ Diskon '+disc+'%</span><span class="neg">-'+qaFmt(discAmt)+'</span></div>';
  h+='<div class="qa-sum-row grand"><span>Total Harga</span><span>'+qaFmt(total)+'</span></div>';
  return h;
}
function qaUpdateSum(){var b=document.getElementById('qaSumBox');if(b)b.innerHTML=qaSumHtml();}
function renderQA(){
  if(!qaD||!qaV)return;
  var p=qaD,vsHtml='';
  for(var i=0;i<p.variants.length;i++){
    var v=p.variants[i];
    vsHtml+='<div class="qa-var'+(v.name===qaV.name?' sel':'')+'" onclick="qaPick(\\''+String(v.name).replace(/'/g,"\\\\'")+'\\')">'+
      '<div style="display:flex;align-items:center;gap:10px"><div class="qa-var-radio"></div><div class="qa-var-name">'+escQA(v.name)+'</div></div>'+
      '<div class="qa-var-price">'+qaFmt(v.price)+'</div></div>';
  }
  var el=document.getElementById('qaModal');
  el.innerHTML='<div class="qa-head">'+
    '<div class="qa-thumb">'+(p.img?'<img src="'+p.img+'" alt="" onerror="this.parentElement.innerHTML=\\'📦\\'">':'📦')+'</div>'+
    '<div class="qa-name">'+escQA(p.name)+'</div>'+
    '<button class="qa-close-btn" onclick="closeQA()">✕</button></div>'+
    '<div class="qa-lbl">Pilih Ukuran</div>'+vsHtml+
    '<div class="qa-qty-row"><span style="font-size:12px;font-weight:700;color:var(--mid)">Jumlah:</span>'+
    '<button class="cqb" type="button" onclick="qaCh(-1)">−</button>'+
    '<input type="number" id="qaQty" value="'+qaQ+'" min="'+(p.minpack||5)+'" step="1" inputmode="numeric" oninput="qaSet()" style="width:72px;text-align:center;font-weight:900;font-size:16px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;background:white;color:var(--dark);font-family:var(--font)">'+
    '<button class="cqb" type="button" onclick="qaCh(1)">+</button></div>'+
    '<div class="qa-sum" id="qaSumBox">'+qaSumHtml()+'</div>'+
    '<div class="qa-actions"><button class="qa-cart-btn" onclick="qaAdd(false)">🛒 Tambah ke Keranjang</button><button class="qa-buy-btn" onclick="qaAdd(true)">⚡ Beli Sekarang</button></div>';
}
function qaAdd(buy){
  if(!qaD||!qaV)return;
  if(window.MP&&MP.addToCart)MP.addToCart(qaD.id,qaD.name,qaV.name,qaV.price,qaQ,qaD.img||'');
  if(window.MP&&MP.updateCartBadge)MP.updateCartBadge();
  closeQA();
  if(buy){setTimeout(function(){location.href='/checkout';},300);return;}
  showQAToast('✅ '+qaQ+' pack '+qaV.name+' masuk keranjang');
}
function showQAToast(msg){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#16A34A;color:white;padding:10px 20px;border-radius:30px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;transition:opacity 0.3s';
  var link=document.createElement('a');
  link.textContent='Lihat Keranjang →';
  link.href='/cart';
  link.style.cssText='color:white;font-weight:800;text-decoration:underline;font-size:13px;white-space:nowrap';
  t.appendChild(document.createTextNode(msg));
  t.appendChild(link);
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove()},300)},3500);
}
if(!document.getElementById('qaOverlay')){
  var ov=document.createElement('div');
  ov.className='qa-overlay';ov.id='qaOverlay';
  ov.onclick=function(e){if(e.target===ov)closeQA();};
  ov.innerHTML='<div class="qa-modal" id="qaModal"></div>';
  document.body.appendChild(ov);
}
function quickAdd(btn,e){if(e){e.preventDefault();e.stopPropagation();}var d=btn.dataset;var vars=[];try{vars=JSON.parse(d.variants||'[]');}catch(err){}if(!vars.length){alert('Produk belum punya varian harga');return;}openQA({id:d.id,slug:d.slug,name:d.name||'Produk',img:d.img||'',variants:vars,minpack:Number(d.minpack||5)});}
window.openQA=openQA;window.closeQA=closeQA;
`;
function homeCard(p) {
  const img = imgUrl(p);
  const min = Number(p.min_price) || 0;
  const max = Number(p.max_price) || 0;
  const price = min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  const name = esc(p.short_name || p.name);
  const tag = esc((p.category || '').replace('OPP ', '').replace('Plastik ', ''));
  const best = BESTSELLER_IDS.includes(p.id)
    ? `<span class="p-pill" style="left:auto;right:8px;top:8px;background:var(--red);color:white">🔥 Terlaris</span>`
    : '';
  let vcount = 0, vFirst = null;
  try {
    const vs = JSON.parse(p.variants || '[]');
    if (Array.isArray(vs)) {
      vcount = vs.length;
      vFirst = vs.filter(v => Number(v.price) > 0).sort((a, b) => Number(a.price) - Number(b.price))[0] || null;
    }
  } catch (e) {}
  const minPack = 5;
  const imgHtml = img
    ? `<div class="p-img"><img src="${esc(img)}" alt="${name}" loading="lazy" onerror="this.parentElement.innerHTML='📦'"></div>`
    : `<div class="p-img" style="display:flex;align-items:center;justify-content:center;font-size:42px">📦</div>`;
  let variantsJson = '[]';
  try {
    const vsj = JSON.parse(p.variants || '[]');
    if (Array.isArray(vsj)) variantsJson = JSON.stringify(vsj.filter(v => Number(v.price) > 0).map(v => ({ name: String(v.name || ''), price: Number(v.price) })));
  } catch (e) {}
  const d = 'data-id="' + esc(p.id) + '" data-slug="' + esc(p.slug || p.id) + '" data-name="' + String(name).replace(/"/g, '&quot;') + '" data-img="' + esc(img) + '" data-minpack="' + minPack + '" data-variants=\'' + variantsJson.replace(/'/g, '&#39;') + '\'';
  return `<a class="p-card" href="/produk/${esc(p.slug || p.id)}">
    <div class="p-img" style="position:relative">
      ${imgHtml}
      ${tag ? `<span class="p-pill">${tag}</span>` : ''}
      ${best}
      <button class="wish-btn" data-id="${esc(p.id)}" onclick="toggleWish('${esc(p.id)}',event)">🤍</button>
    </div>
    <div class="p-body">
      <div class="p-name">${name}</div>
      <div class="p-price">${price}</div>
      <div class="p-sub">per pack isi 100 pcs</div>
      ${vcount ? `<div class="p-vars">${vcount} pilihan ukuran</div>` : ''}
      <button class="p-btn" ${d} onclick="quickAdd(this,event)">+ Keranjang</button>
    </div>
  </a>`;
}

// ── Halaman Shop (katalog modern: filter kategori, harga, sort, search) ──
export async function renderShop(env, searchQuery) {
  const { results } = await env.DB.prepare(
    'SELECT id,slug,name,short_name,category,img,min_price,max_price,variants FROM products WHERE active=1 ORDER BY category, min_price'
  ).all();
  const products = results;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const dataJson = JSON.stringify(products.map(p => ({
    id: p.id, slug: p.slug, name: p.short_name || p.name, category: p.category,
    img: imgUrl(p), min: Number(p.min_price) || 0, max: Number(p.max_price) || 0,
    variants: (() => { try { return JSON.parse(p.variants || '[]'); } catch (e) { return []; } })(),
  }))).replace(/</g, '\\u003c');

  const catHtml = cats.map(c => `
    <label class="shop-cat"><input type="checkbox" value="${esc(c)}" onchange="applyShop()">${esc(c)}<span class="count">${products.filter(p => p.category === c).length}</span></label>`).join('');

  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/shop', label: 'Shop' }])}
    <div class="shop-hero">
      <h1>🛍️ Shop Produk Murah Plastic</h1>
      <p>Temukan semua produk plastik OPP, plastik klip/ziplock, dan kemasan grosir untuk UMKM. Filter berdasarkan kategori, harga, dan ukuran dengan mudah.</p>
      <div class="shop-stats">
        <div class="shop-stat"><b>${products.length}</b><span>Produk</span></div>
        <div class="shop-stat"><b>${cats.length}</b><span>Kategori</span></div>
        <div class="shop-stat"><b>100+</b><span>Ukuran</span></div>
        <div class="shop-stat"><b>Grosir</b><span>Harga Pabrik</span></div>
      </div>
    </div>
    <div class="shop-layout">
      <aside class="shop-side" id="shopSide">
        <div class="shop-side-group">
          <div class="shop-side-title">🔍 Cari Produk</div>
          <input class="shop-search" id="shopSearch" placeholder="Cari nama / ukuran..." oninput="applyShop()">
        </div>
        <div class="shop-side-group">
          <div class="shop-side-title">📂 Kategori</div>
          ${catHtml}
        </div>
        <div class="shop-side-group">
          <div class="shop-side-title">💰 Rentang Harga</div>
          <div class="shop-range">
            <input type="number" id="priceMin" placeholder="Min" min="0" oninput="applyShop()">
            <span class="sep">–</span>
            <input type="number" id="priceMax" placeholder="Max" min="0" oninput="applyShop()">
          </div>
        </div>
        <div class="shop-side-group">
          <div class="shop-side-title">↕️ Urutkan</div>
          <select class="shop-sort" id="shopSort" onchange="applyShop()">
            <option value="default">Default</option>
            <option value="priceAsc">Harga Terendah</option>
            <option value="priceDesc">Harga Tertinggi</option>
            <option value="nameAsc">Nama A–Z</option>
          </select>
        </div>
        <button class="shop-reset" onclick="resetShop()">⟲ Reset Filter</button>
      </aside>
      <main class="shop-main">
        <div class="shop-toolbar">
          <button class="shop-filter-toggle" style="display:none" onclick="document.getElementById('shopSide').classList.toggle('open')">⚙️ Filter</button>
          <div class="shop-count">Menampilkan <b id="shopTotal">${products.length}</b> produk</div>
          <select class="shop-sort shop-sort-mobile" id="shopSortM" onchange="document.getElementById('shopSort').value=this.value;applyShop()">
            <option value="default">Default</option>
            <option value="priceAsc">Harga Terendah</option>
            <option value="priceDesc">Harga Tertinggi</option>
            <option value="nameAsc">Nama A–Z</option>
          </select>
        </div>
        <div class="shop-grid" id="shopGrid">
          ${products.map(homeCard).join('')}
        </div>
      </main>
    </div>
  </div>`;

  const script = `
    const PRODUCTS = ${dataJson};
    const cards = ${JSON.stringify(products.map(p => ({ id: p.id, slug: p.slug, img: imgUrl(p), name: p.short_name || p.name, cat: p.category, min: Number(p.min_price) || 0, max: Number(p.max_price) || 0, variants: (() => { try { return JSON.parse(p.variants || '[]'); } catch (e) { return []; } })() }))).replace(/</g, '\\\\u003c')};
    function cardHtml(p){
      const q = String.fromCharCode(39);
      const price = p.min === p.max ? 'Rp' + Math.round(p.min).toLocaleString('id-ID') : 'Rp' + Math.round(p.min).toLocaleString('id-ID') + ' – Rp' + Math.round(p.max).toLocaleString('id-ID');
      const tag = (p.cat || '').replace('OPP ','').replace('Plastik ','');
      const best = ['29463366459','19626400134'].includes(p.id) ? '<span class="p-pill" style="left:auto;right:8px;top:8px;background:var(--red);color:white">🔥 Terlaris</span>' : '';
      const vs = p.variants || [];
      const vFirst = vs.filter(function(v){return Number(v.price)>0}).sort(function(a,b){return Number(a.price)-Number(b.price)})[0] || null;
      const vcount = vs.length;
      const onerr = 'onerror="this.parentElement.innerHTML=' + q + '&#128230;' + q + '"';
      const img = p.img ? '<div class="p-img"><img src="' + p.img + '" alt="' + p.name.replace(/"/g,'&quot;') + '" loading="lazy" ' + onerr + '></div>' : '<div class="p-img" style="display:flex;align-items:center;justify-content:center;font-size:42px">&#128230;</div>';
      const d = 'data-id="' + p.id + '" data-slug="' + encodeURIComponent(p.slug) + '" data-name="' + p.name.replace(/"/g,'&quot;') + '" data-img="' + p.img + '" data-minpack="5" data-variants=\'' + JSON.stringify(vs.filter(function(v){return Number(v.price)>0}).map(function(v){return {name:String(v.name||''),price:Number(v.price)}})).replace(/'/g,'&#39;') + '\'';
      return '<a class="p-card" href="/produk/' + encodeURIComponent(p.slug) + '">' +
        '<div class="p-img" style="position:relative">' + img +
        (tag ? '<span class="p-pill">' + tag.replace(/</g,'&lt;') + '</span>' : '') +
        best +
        '<button class="wish-btn" data-id="' + p.id + '" onclick="toggleWish(' + q + p.id + q + ',event)">' + (isWished(p.id) ? '❤️' : '🤍') + '</button></div>' +
        '<div class="p-body"><div class="p-name">' + p.name.replace(/</g,'&lt;') + '</div><div class="p-price">' + price + '</div><div class="p-sub">per pack isi 100 pcs</div>' +
        (vcount ? '<div class="p-vars">' + vcount + ' pilihan ukuran</div>' : '') +
        '<button class="p-btn" ' + d + ' onclick="quickAdd(this,event)">+ Keranjang</button></div></a>';
    }
    function toggleWish(id,e){if(e&&e.preventDefault)e.preventDefault();if(e&&e.stopPropagation)e.stopPropagation();let w=JSON.parse(localStorage.getItem('mp_wish')||'[]');const i=w.indexOf(id);if(i>-1)w.splice(i,1);else w.push(id);localStorage.setItem('mp_wish',JSON.stringify(w));const b=e&&e.currentTarget;if(b){b.classList.toggle('active',i>-1);b.textContent=i>-1?'🤍':'❤️';}}
    function isWished(id){try{return JSON.parse(localStorage.getItem('mp_wish')||'[]').includes(id);}catch(err){return false;}}
    function quickAdd(btn,e){if(e){e.preventDefault();e.stopPropagation();}try{var c=JSON.parse(localStorage.getItem('mp_cart')||'[]');var d=btn.dataset;var k=d.id+'|'+d.variant;var ex=c.find(function(x){return x.key===k});if(ex){ex.qty+=Number(d.minpack||5);}else{c.push({key:k,productId:d.id,slug:d.slug,productName:d.name,variantName:d.variant,price:Number(d.price),qty:Number(d.minpack||5),img:d.img});}localStorage.setItem('mp_cart',JSON.stringify(c));if(window.MP&&MP.updateCartBadge)MP.updateCartBadge();showToast('✓ Ditambahkan ke keranjang');}catch(err){alert('Gagal menambahkan ke keranjang');}}
    function showToast(msg){var t=document.createElement('div');t.textContent=msg;Object.assign(t.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'#16A34A',color:'white',padding:'10px 24px',borderRadius:'30px',fontSize:'14px',fontWeight:'700',zIndex:9999,boxShadow:'0 4px 16px rgba(0,0,0,0.2)',transition:'opacity 0.3s'});document.body.appendChild(t);setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove()},300)},2000);}
    function applyShop(){
    const q = (document.getElementById('shopSearch').value || '').toLowerCase().trim();
    const selCats = [...document.querySelectorAll('.shop-cat input:checked')].map(i => i.value);
    const pMin = parseFloat(document.getElementById('priceMin').value) || 0;
    const pMax = parseFloat(document.getElementById('priceMax').value) || Infinity;
    const sort = document.getElementById('shopSort').value;
    let list = cards.filter(p =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (selCats.length === 0 || selCats.includes(p.cat)) &&
      p.max >= pMin && p.min <= pMax
    );
    if (sort === 'priceAsc') list.sort((a,b) => a.min - b.min);
    else if (sort === 'priceDesc') list.sort((a,b) => b.min - a.min);
    else if (sort === 'nameAsc') list.sort((a,b) => a.name.localeCompare(b.name,'id'));
    document.getElementById('shopGrid').innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="shop-empty"><span class="big">🔍</span>Tidak ada produk yang cocok dengan filter. Coba ubah pencarian atau reset filter.</div>';
    document.getElementById('shopTotal').textContent = list.length;
  }
  function resetShop(){
    document.getElementById('shopSearch').value = '';
    document.querySelectorAll('.shop-cat input').forEach(i => i.checked = false);
    document.getElementById('priceMin').value = ''; document.getElementById('priceMax').value = '';
    document.getElementById('shopSort').value = 'default';
    document.getElementById('shopSortM').value = 'default';
    applyShop();
  }
  // tampilkan tombol filter di mobile
  if (window.innerWidth <= 1024) document.querySelector('.shop-filter-toggle').style.display = 'inline-flex';
  // Terapkan query search dari header (?q=...)
  const headerQ = ${JSON.stringify(searchQuery || '')};
  if (headerQ) { document.getElementById('shopSearch').value = headerQ; applyShop(); }`;

  return { html: layout({ title: `Shop Produk Plastik OPP Grosir — ${SITE_NAME}`, desc: 'Katalog lengkap produk plastik OPP, plastik klip ziplock, dan kemasan grosir Murah Plastic. Harga pabrik, food grade, kirim seluruh Indonesia.', canonical: ORIGIN + '/shop', body, bodyClass: 'page-shop', script: script + QUICKMODAL_SCRIPT }), script };
}

// ── Halaman Product Archive (semua produk, grouped by category) ──
export async function renderArchive(env) {
  const { results } = await env.DB.prepare(
    'SELECT id,slug,name,short_name,category,img,min_price,max_price,variants FROM products WHERE active=1 ORDER BY category, min_price'
  ).all();
  const products = results;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const groups = cats.map(c => {
    const items = products.filter(p => p.category === c);
    return `<div class="arch-group">
      <div class="arch-cat">
        <span class="arch-cat-icon">📦</span>
        <h2>${esc(c)}</h2>
        <span class="arch-count">${items.length} produk</span>
      </div>
      <div class="p-grid">${items.map(homeCard).join('')}</div>
    </div>`;
  }).join('');

  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/produk', label: 'Semua Produk' }])}
    <div class="page-head">
      <div class="page-title">📦 Arsip Produk</div>
      <div class="page-sub">Seluruh ${products.length} produk Murah Plastic dikelompokkan berdasarkan kategori. Klik produk untuk melihat detail, ukuran, dan harga.</div>
    </div>
    ${groups}
  </div>`;

  return { html: layout({ title: `Semua Produk (${products.length}) — ${SITE_NAME}`, desc: `Arsip lengkap ${products.length} produk plastik OPP, klip ziplock, dan kemasan grosir Murah Plastic, dikelompokkan per kategori.`, canonical: ORIGIN + '/produk', body, bodyClass: 'page-archive', script: WISH_SCRIPT + QUICKMODAL_SCRIPT }), script: '' };
}

// ── Slug SEO standar per kategori ──
const CATEGORY_SLUGS = {
  'OPP Lem Super Tebal': 'opp-lem-super-tebal',
  'OPP Lem Tebal': 'opp-lem-tebal',
  'OPP Lem Tipis': 'opp-lem-tipis',
  'OPP Tanpa Lem': 'opp-tanpa-lem',
  'Plastik Gusset Roti': 'plastik-gusset-roti',
  'Plastik Ziplock/Klip': 'plastik-ziplock-klip'
};

export function categorySlug(name) {
  if (CATEGORY_SLUGS[name]) return CATEGORY_SLUGS[name];
  return String(name || '').toLowerCase().trim()
    .replace(/&/g, 'dan')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryBySlug(slug) {
  for (const [name, s] of Object.entries(CATEGORY_SLUGS)) if (s === slug) return name;
  return null;
}

// ── Halaman Kategori (SSR) — produk per kategori dengan slug SEO standar ──
export async function renderCategory(env, slug) {
  // Kategori dinamis dari tabel categories (dikelola admin), fallback ke slug map lama
  let catInfo = null;
  try { catInfo = await env.DB.prepare('SELECT * FROM categories WHERE slug=? AND active=1').bind(slug).first(); } catch (e) {}
  const name = catInfo ? catInfo.name : categoryBySlug(slug);
  if (!name) return null;
  const { results } = await env.DB.prepare(
    'SELECT id,slug,name,short_name,category,img,min_price,max_price,variants FROM products WHERE active=1 AND category=? ORDER BY min_price'
  ).bind(name).all();

  const items = results.map(homeCard).join('');
  const featImg = catInfo && catInfo.featured_image ? catInfo.featured_image.replace(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\//, '/img/') : imgUrl(results[0] || {});
  const desc = catInfo && catInfo.description ? catInfo.description : `${results.length} produk ${name} tersedia di Murah Plastic.`;
  const icon = catInfo && catInfo.icon ? catInfo.icon : '📂';
  const emptyMsg = results.length ? '' : `<div class="wl-empty" style="padding:32px"><div class="wl-empty-icon">📭</div><div class="akun-empty-sub" style="font-size:14px;color:var(--muted)">Belum ada produk di kategori <strong>${esc(name)}</strong>.<br>Kategori ini baru dibuat — produk akan tampil di sini begitu ditambahkan.</div></div>`;
  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/shop', label: 'Shop' }, { href: '/kategori/' + slug, label: name }])}
    <div class="page-head">
      <div class="page-title">${icon} ${esc(name)}</div>
      <div class="page-sub">${esc(desc)}</div>
    </div>
    <div class="p-grid">${items}</div>
    ${emptyMsg}
    <div style="text-align:center;margin:28px 0 8px">
      <a class="btn-red" style="text-decoration:none;display:inline-block" href="/shop">🛍️ Lihat Semua Produk</a>
    </div>
  </div>`;

  return { html: layout({ title: `Jual ${name} Grosir — ${SITE_NAME}`, desc: `Beli ${name} harga grosir di Murah Plastic. ${results.length} varian ukuran, food grade, kirim seluruh Indonesia.`, canonical: ORIGIN + '/kategori/' + slug, ogImage: featImg, body, bodyClass: 'page-category', script: WISH_SCRIPT + QUICKMODAL_SCRIPT }), script: '' };
}

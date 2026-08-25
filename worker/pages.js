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
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
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
export async function renderProduct(env, id) {
  const row = await env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(id).first();
  if (!row) return null;
  const p = { ...row, variants: JSON.parse(row.variants || '[]'), specs: JSON.parse(row.specs || '{}') };

  const prices = (p.variants || []).filter(v => v.price > 0).map(v => v.price);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const priceLabel = minP === maxP ? fmt(minP) : `${fmt(minP)} – ${fmt(maxP)}`;
  const img = imgUrl(p);
  const fullImg = img ? (img.startsWith('http') ? img : ORIGIN + img) : '';

  // Related products (same category, exclude self)
  const { results: relatedRows } = await env.DB.prepare(
    'SELECT id,name,short_name,category,img,min_price,max_price FROM products WHERE active=1 AND category=? AND id<>? ORDER BY min_price LIMIT 4'
  ).bind(p.category || '', p.id).all();
  const related = (relatedRows.length >= 2 ? relatedRows : []);
  if (related.length < 4) {
    const { results: more } = await env.DB.prepare(
      'SELECT id,name,short_name,category,img,min_price,max_price FROM products WHERE active=1 AND id<>? ORDER BY min_price LIMIT ?'
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
      ${related.map(r => {
        const rImg = imgUrl(r);
        const rMin = Number(r.min_price) || 0;
        const rMax = Number(r.max_price) || 0;
        const rPrice = rMin === rMax ? fmt(rMin) : `${fmt(rMin)} – ${fmt(rMax)}`;
        return `<a class="p-card" href="/produk/${esc(r.id)}">
          ${rImg ? `<div class="p-img"><img src="${esc(rImg)}" alt="${esc(r.short_name || r.name)}" loading="lazy" onerror="this.parentElement.innerHTML='📦'"></div>` : `<div class="p-img" style="display:flex;align-items:center;justify-content:center;font-size:42px">📦</div>`}
          <div class="p-body">
            <div class="p-name">${esc(r.short_name || r.name)}</div>
            <div class="p-price">${rPrice}</div>
          </div>
        </a>`;}).join('')}
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
      url: ORIGIN + '/produk/' + p.id
    }
  };

  const body = `
  <div class="wrap">
    ${breadcrumb([{ href: '/#produkSection', label: 'Produk' }, { href: '/produk/' + p.id, label: (p.short_name || p.name).substring(0, 40) }])}
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
        <div class="pd-price">${priceLabel}</div>
        <div class="pd-price-sub">per pack isi 100 pcs · ${sortedVars.length} pilihan ukuran</div>
        <div class="pd-disc-row">${discTiers.map(t => `<span class="pd-disc-badge">${t.pct}% (${t.min}+ pack)</span>`).join('')}</div>

        ${minPackNote}
        <div class="pd-lbl">Pilih Ukuran & Jumlah</div>
        <div class="pd-var-grid" id="varGrid">${varOpts}</div>

        <div class="pd-qty-row" style="display:flex;align-items:center;gap:12px;margin:18px 0">
          <span style="font-size:13px;font-weight:700;color:var(--mid)">Jumlah:</span>
          <button class="cqb" onclick="chQty(-1)">−</button>
          <span id="qtyLbl" style="font-weight:900;min-width:26px;text-align:center;font-size:16px">5</span>
          <button class="cqb" onclick="chQty(1)">+</button>
          <span id="qtyHint" style="font-size:12px;color:var(--muted)"></span>
        </div>

        <div class="pd-actions">
          <button class="pd-cart-btn" id="addCartBtn" onclick="doCart(false)">🛒 Tambah ke Keranjang</button>
          <button class="pd-buy-btn" id="buyBtn" onclick="doCart(true)">⚡ Beli Sekarang</button>
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
      <div class="pd-panel-title">💬 Butuh Bantuan?</div>
      <p style="font-size:13px;color:var(--mid);line-height:1.7;margin-bottom:14px">Punya pertanyaan soal produk ini, ukuran, atau pesan partai besar? Tim kami siap bantu via WhatsApp.</p>
      <a class="btn-red" href="${WA_STORE}?text=${encodeURIComponent('Halo, saya mau tanya produk: ' + p.name)}" target="_blank" rel="noopener">💬 Chat WhatsApp</a>
    </div>

    ${relatedHtml}
  </div>`;

  const script = `
  let qty = 5, curPrice = ${sortedVars.length ? sortedVars[0].price : 0};
  const MIN_PACK = 5;
  const pid = ${JSON.stringify(p.id)};
  const pname = ${JSON.stringify(p.short_name || p.name)};
  const pimg = ${JSON.stringify(img)};
  function selVar(el, name, price) {
    document.querySelectorAll('.pd-var-opt').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel'); curPrice = price;
    if (qty < MIN_PACK) { qty = MIN_PACK; document.getElementById('qtyLbl').textContent = qty; }
    updateHint();
  }
  function chQty(d) {
    qty = Math.max(MIN_PACK, qty + d);
    document.getElementById('qtyLbl').textContent = qty;
    updateHint();
  }
  function updateHint() {
    const h = document.getElementById('qtyHint');
    const t = Math.min(qty, 100); let pct = 0;
    if (t >= 100) pct = 20; else if (t >= 50) pct = 10; else if (t >= 10) pct = 5; else if (t >= 5) pct = 2;
    h.textContent = pct > 0 ? '🏷️ Diskon ' + pct + '% berlaku' : '';
  }
  function doCart(buy) {
    if (qty < MIN_PACK) { showToast('Minimal ' + MIN_PACK + ' pack!'); return; }
    const sel = document.querySelector('.pd-var-opt.sel');
    const vname = sel ? sel.querySelector('.pd-var-name').textContent : 'Standar';
    MP.addToCart(pid, pname, vname, curPrice, qty, pimg);
    showToast('✅ ' + qty + ' pack masuk keranjang');
    if (buy) setTimeout(() => location.href = '/checkout', 600);
    else setTimeout(() => location.href = '/cart', 900);
  }
  function showToast(t) {
    const el = document.getElementById('toastMsg');
    el.textContent = t; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2000);
  }
  updateHint();`;

  return { html: layout({ title: `${p.name} — ${SITE_NAME}`, desc: truncate(p.desc || p.name, 155), canonical: ORIGIN + '/produk/' + p.id, ogImage: fullImg, jsonLd, body, bodyClass: 'page-product', script }), script };
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

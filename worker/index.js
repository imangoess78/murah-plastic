async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function verifyPassword(stored, incoming) {
  if (!stored || !incoming) return false;
  if (stored === incoming) return true;
  // legacy raw vs btoa
  try { if (stored === atob(incoming)) return true; } catch (e) {}
  try { if (stored === btoa(incoming)) return true; } catch (e) {}
  // sha256$hex format
  if (stored.startsWith('sha256$')) {
    const hex = stored.slice(7);
    // incoming could be raw or btoa — try both
    const candidates = [incoming];
    try { candidates.push(atob(incoming)); } catch (e) {}
    for (const c of candidates) {
      if (await sha256Hex(c) === hex) return true;
    }
  }
  return false;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Pakasir payment gateway (QRIS otomatis, seperti project sebelumnya) ──
const PAKASIR_BASE = 'https://app.pakasir.com';
async function pakasir(env, path, body) {
  const project = env.PAKASIR_PROJECT || 'seo-enthusisast';
  const api_key = env.PAKASIR_API_KEY;
  const res = await fetch(PAKASIR_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, project, api_key }),
  });
  return res.json();
}
async function pakasirGet(env, path, params) {
  const project = env.PAKASIR_PROJECT || 'seo-enthusisast';
  const api_key = env.PAKASIR_API_KEY;
  const qs = new URLSearchParams({ ...params, project, api_key });
  const res = await fetch(PAKASIR_BASE + path + '?' + qs.toString());
  return res.json();
}

// Rewrite URL gambar R2 publik -> route lokal /img/ (anti blokir domain eksternal di jaringan pengguna)
const IMG_RE = /https:\/\/pub-[a-f0-9]+\.r2\.dev\/products\//g;
function rewriteImg(v) {
  if (typeof v === 'string') return v.replace(IMG_RE, '/img/products/');
  if (Array.isArray(v)) return v.map(rewriteImg);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = rewriteImg(v[k]); return o; }
  return v;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(rewriteImg(data)), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

import { PRODUCTS_SEED } from './products_seed.js';
import { CITIES, RATES, COURIER_NAMES } from './shipping_seed.js';
import { renderProduct, renderPost, renderArticles, renderShop, renderArchive, renderCategory } from './pages.js';

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'artikel-' + Date.now();
}

// ── Customer session (member login/register, token di user_sessions) ──
async function ensureUserSessions(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )`).run();
  } catch (e) { /* ignore */ }
}
async function ensureOrdersUserCol(env) {
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(orders)').all();
    if (!cols.results.some(c => c.name === 'user_id')) {
      await env.DB.prepare("ALTER TABLE orders ADD COLUMN user_id TEXT DEFAULT ''").run();
    }
    if (!cols.results.some(c => c.name === 'timeline')) {
      await env.DB.prepare("ALTER TABLE orders ADD COLUMN timeline TEXT DEFAULT '[]'").run();
    }
  } catch (e) { /* ignore */ }
}
async function ensureUserCols(env) {
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(users)').all();
    if (!cols.results.some(c => c.name === 'phone')) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''").run();
    }
    if (!cols.results.some(c => c.name === 'address')) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN address TEXT DEFAULT ''").run();
    }
    if (!cols.results.some(c => c.name === 'city')) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''").run();
    }
  } catch (e) { /* ignore */ }
}
async function ensureWishlistReviews(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS wishlist (
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, product_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id TEXT DEFAULT '',
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    comment TEXT DEFAULT '',
    date TEXT NOT NULL,
    verified INTEGER DEFAULT 0
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(date DESC)').run();
}
async function ensureCustomersTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customers (
    phone TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}
async function ensureQuestionsUserCol(env) {
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(questions)').all();
    if (!cols.results.some(c => c.name === 'user_id')) {
      await env.DB.prepare("ALTER TABLE questions ADD COLUMN user_id TEXT DEFAULT ''").run();
    }
  } catch (e) { /* ignore */ }
}

// ── Admin staff management (role-based) ──
async function ensureAdminUsers(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
  } catch (e) { /* ignore */ }
}
async function ensureAdminSessionUserCol(env) {
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(admin_sessions)').all();
    if (!cols.results.some(c => c.name === 'user_id')) {
      await env.DB.prepare("ALTER TABLE admin_sessions ADD COLUMN user_id TEXT DEFAULT ''").run();
    }
    if (!cols.results.some(c => c.name === 'role')) {
      await env.DB.prepare("ALTER TABLE admin_sessions ADD COLUMN role TEXT DEFAULT 'super_admin'").run();
    }
  } catch (e) { /* ignore */ }
}
async function getAdminByToken(env, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const s = await env.DB.prepare('SELECT * FROM admin_sessions WHERE token=?').bind(token).first();
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) return null;
  return { token, user_id: s.user_id || '', role: s.role || 'super_admin', expires_at: s.expires_at };
}
async function isAdminRole(request, env, roles) {
  const adm = await getAdminByToken(env, request);
  if (!adm) return false;
  if (!roles) return true;
  return roles.includes(adm.role);
}

// ── Payment methods (bank transfer + QRIS statis) ──
async function ensurePaymentMethods(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,          -- bank | qris
      label TEXT NOT NULL,         -- nama tampilan: 'BCA', 'GoPay', 'OVO', 'QRIS'
      account_name TEXT DEFAULT '',-- atas nama (bank)
      account_number TEXT DEFAULT '',-- nomor rekening / nomor gopay / nomor ovo
      phone TEXT DEFAULT '',       -- nomor tujuan (gopay/ovo)
      image_url TEXT DEFAULT '',   -- QRIS statis image path /img/...
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
  } catch (e) { /* ignore */ }
}

// ── Settings (diskon, promo, konfigurasi toko) ──
async function ensureSettings(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
    // Seed defaults
    const row = await env.DB.prepare("SELECT COUNT(*) as c FROM settings").first();
    if (row && row.c === 0) {
      const defaults = [
        ['discount_tiers', JSON.stringify([{min:100,pct:20},{min:50,pct:10},{min:10,pct:5},{min:5,pct:2}])],
        ['member_discount', '10'],
        ['free_ship_min', '500000'],
      ];
      for (const [k, v] of defaults) {
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?,?)").bind(k, v).run();
      }
    }
  } catch (e) { /* ignore */ }
}

// ── Payment confirmations (bukti bayar manual) ──
async function ensurePaymentConfirmations(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payment_confirmations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      user_id TEXT DEFAULT '',
      method TEXT DEFAULT '',       -- metode yang dipilih customer
      amount INTEGER DEFAULT 0,
      image_url TEXT DEFAULT '',    -- bukti transfer di R2
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi',  -- Menunggu Verifikasi | Terverifikasi | Ditolak
      admin_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT DEFAULT ''
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pc_order ON payment_confirmations(order_id)').run();
  } catch (e) { /* ignore */ }
}
async function ensurePaymentProofCol(env) {
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(orders)').all();
    if (!cols.results.some(c => c.name === 'payment_proof')) {
      await env.DB.prepare("ALTER TABLE orders ADD COLUMN payment_proof TEXT DEFAULT ''").run();
    }
  } catch (e) { /* ignore */ }
}
async function appendTimeline(env, orderId, status, note) {
  try {
    const row = await env.DB.prepare('SELECT timeline FROM orders WHERE id=?').bind(orderId).first();
    let tl = [];
    try { tl = row?.timeline ? JSON.parse(row.timeline) : []; } catch (e) { tl = []; }
    tl.push({ status, note: note || '', at: new Date().toISOString() });
    await env.DB.prepare('UPDATE orders SET timeline=? WHERE id=?').bind(JSON.stringify(tl), orderId).run();
  } catch (e) { /* ignore */ }
}
function parseTimeline(r) {
  try { return r.timeline ? JSON.parse(r.timeline) : []; } catch (e) { return []; }
}
async function createUserSession(env, userId) {
  const token = nanoid() + nanoid();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .bind(token, userId, expires).run();
  return token;
}
async function getUserByToken(env, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const s = await env.DB.prepare('SELECT * FROM user_sessions WHERE token=?').bind(token).first();
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) return null;
  return { token, user_id: s.user_id };
}

async function ensureProducts(env) {
  // Migration: tambah kolom slug jika belum ada
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(products)').all();
    if (!cols.results.some(c => c.name === 'slug')) {
      await env.DB.prepare('ALTER TABLE products ADD COLUMN slug TEXT DEFAULT \'\'').run();
    }
  } catch (e) { /* ignore */ }

  const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').all();
  if (results[0].n > 0) {
    // Backfill slug untuk produk existing yang belum punya
    await backfillSlugs(env);
    return;
  }
  // Seed from embedded data
  for (const p of PRODUCTS_SEED) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO products (id, slug, name, short_name, desc, category, img_key, img, min_price, max_price, variants, specs, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`
    ).bind(
      p.id, p.slug || slugify(p.short_name || p.name), p.name, p.short_name || '', p.desc || '', p.category || '',
      p.img_key || '', p.img || '', p.min_price || 0, p.max_price || 0,
      JSON.stringify(p.variants || []), JSON.stringify(p.specs || {})
    ).run();
  }
  await backfillSlugs(env);
}

async function backfillSlugs(env) {
  // 1) Sinkronkan slug dari PRODUCTS_SEED (sumber kebenaran slug produk asli — lebih pendek & SEO friendly)
  for (const p of PRODUCTS_SEED) {
    if (!p.slug) continue;
    await env.DB.prepare('UPDATE products SET slug=? WHERE id=? AND slug<>?').bind(p.slug, p.id, p.slug).run();
  }
  // 2) Isi slug kosong (produk custom yang dibuat via admin)
  const { results } = await env.DB.prepare("SELECT id, slug, short_name, name FROM products WHERE slug IS NULL OR slug=''").all();
  for (const r of results) {
    const s = slugify(r.short_name || r.name);
    if (!s) continue;
    // pastikan unik
    let cand = s, i = 2;
    while (true) {
      const dup = await env.DB.prepare('SELECT 1 FROM products WHERE slug=? AND id<>? LIMIT 1').bind(cand, r.id).first();
      if (!dup) break;
      cand = s + '-' + i++;
    }
    await env.DB.prepare('UPDATE products SET slug=? WHERE id=?').bind(cand, r.id).run();
  }
}

// ── Shipping: seed kota + tarif (seperti RajaOngkir, tanpa API key) ──
async function ensureShipping(env) {
  // Pastikan tabel ada (self-healing, tidak bergantung schema.sql)
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS shipping_cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    zone INTEGER NOT NULL DEFAULT 1
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS shipping_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courier TEXT NOT NULL,
    zone INTEGER NOT NULL,
    cost_per_kg INTEGER NOT NULL,
    etd TEXT DEFAULT ''
  )`).run();

  // Migration: tambah kolom shipping di orders bila belum ada
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(orders)').all();
    if (!cols.results.some(c => c.name === 'shipping')) {
      await env.DB.prepare("ALTER TABLE orders ADD COLUMN shipping TEXT DEFAULT '{}'").run();
    }
    if (!cols.results.some(c => c.name === 'shipping_cost')) {
      await env.DB.prepare('ALTER TABLE orders ADD COLUMN shipping_cost INTEGER DEFAULT 0').run();
    }
  } catch (e) { /* fresh DB sudah punya kolom */ }

  // Seed kota jika kosong
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM shipping_cities').all();
  if (results[0].n === 0) {
    const stmt = env.DB.prepare('INSERT INTO shipping_cities (city, province, zone) VALUES (?,?,?)');
    for (const [city, province, zone] of CITIES) await stmt.bind(city, province, zone).run();
  }
  // Seed tarif jika kosong
  const rc = await env.DB.prepare('SELECT COUNT(*) AS n FROM shipping_rates').all();
  if (rc.results[0].n === 0) {
    const stmt = env.DB.prepare('INSERT INTO shipping_rates (courier, zone, cost_per_kg, etd) VALUES (?,?,?,?)');
    for (const r of RATES) {
      for (let z = 0; z < r.costs.length; z++) {
        if (r.costs[z] <= 0) continue;
        await stmt.bind(r.courier, z + 1, r.costs[z], r.ets[z]).run();
      }
    }
  }
}

// Hitung ongkir: cari zona kota -> tarif per kg kurir -> round up ke kg berikutnya
function calcShipping(cityName, weightGram, courierCode) {
  const city = CITIES.find(c => c[0].toLowerCase() === String(cityName || '').toLowerCase().trim());
  if (!city) return null;
  const zone = city[2];
  const rate = RATES.find(r => r.courier === courierCode);
  if (!rate) return null;
  const idx = zone - 1;
  const costPerKg = rate.costs[idx];
  if (!costPerKg || costPerKg <= 0) return null;
  const kg = Math.max(1, Math.ceil((Number(weightGram) || 0) / 1000));
  return {
    courier: courierCode,
    courier_name: rate.name,
    city: city[0],
    province: city[1],
    zone,
    weight_gram: Number(weightGram) || 0,
    weight_kg: kg,
    cost_per_kg: costPerKg,
    cost: costPerKg * kg,
    etd: rate.ets[idx] || '-'
  };
}

async function findProduct(env, key) {
  // cari by slug dulu, fallback by id (untuk URL lama)
  let row = await env.DB.prepare('SELECT * FROM products WHERE slug=? AND active=1').bind(key).first();
  if (!row) row = await env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(key).first();
  if (!row) return null;
  return { ...row, variants: JSON.parse(row.variants || '[]'), specs: JSON.parse(row.specs || '{}') };
}

function nanoid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function isAdmin(request, env) {
  const adm = await getAdminByToken(env, request);
  if (adm) return true;
  // Fallback: legacy token
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;
  const s = await env.DB.prepare(
    "SELECT token FROM admin_sessions WHERE token=? AND expires_at > datetime('now')"
  ).bind(token).first();
  return !!s;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // ── GET /img/* — serve gambar produk dari R2 binding (domain sendiri, cache permanen) ──
    if (path.startsWith('/img/')) {
      const key = path.slice(1).replace(/^img\//, ''); // "products/img_001.jpeg"
      if (!key || key.split('/').length < 2) return new Response('Not Found', { status: 404 });
      const obj = await env.R2.get(key);
      if (!obj) return new Response('Not Found', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(obj.body, { headers });
    }

    // ── Halaman publik: single product, single post, artikel list, cart, checkout, tentang kami, faq ──
    if (path === '/shop') {
      await ensureProducts(env);
      const q = url.searchParams.get('q') || '';
      const page = await renderShop(env, q);
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }
    if (path === '/produk') {
      await ensureProducts(env);
      const page = await renderArchive(env);
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }
    if (path.startsWith('/produk/')) {
      const key = decodeURIComponent(path.slice('/produk/'.length));
      await ensureProducts(env);
      const prod = await findProduct(env, key);
      if (!prod) return new Response('Produk tidak ditemukan', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      // URL lama pakai id angka -> redirect 301 ke slug baru (SEO friendly)
      if (key !== prod.slug) {
        return new Response(null, {
          status: 301,
          headers: { Location: '/produk/' + prod.slug, 'Cache-Control': 'public, max-age=86400' },
        });
      }
      const page = await renderProduct(env, prod);
      if (!page) return new Response('Produk tidak ditemukan', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }
    if (path.startsWith('/kategori/')) {
      const slug = decodeURIComponent(path.slice('/kategori/'.length));
      await ensureProducts(env);
      const page = await renderCategory(env, slug);
      if (!page) return new Response('Kategori tidak ditemukan', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }
    if (path.startsWith('/artikel/')) {
      const slug = decodeURIComponent(path.slice('/artikel/'.length));
      const page = await renderPost(env, slug);
      if (!page) return new Response('Artikel tidak ditemukan', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }
    if (path === '/artikel') {
      const page = await renderArticles(env);
      return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }

    // ── Sitemap XML (dinamis: produk, kategori, artikel) ──
    if (path === '/sitemap.xml') {
      const ORIGIN = 'https://murah-plastic.imangoess78.workers.dev';
      const today = new Date().toISOString().slice(0, 10);
      const urls = [
        { loc: '/', prio: '1.0', freq: 'daily' },
        { loc: '/shop', prio: '0.9', freq: 'daily' },
        { loc: '/produk', prio: '0.8', freq: 'weekly' },
        { loc: '/artikel', prio: '0.7', freq: 'weekly' },
        { loc: '/tentang-kami', prio: '0.5', freq: 'monthly' },
        { loc: '/faq', prio: '0.5', freq: 'monthly' },
      ];
      try {
        await ensureProducts(env);
        const prods = await env.DB.prepare("SELECT slug, updated_at FROM products WHERE active=1 AND slug IS NOT NULL AND slug<>''").all();
        for (const p of prods.results || []) urls.push({ loc: '/produk/' + p.slug, prio: '0.8', freq: 'weekly', lastmod: p.updated_at ? p.updated_at.slice(0, 10) : undefined });
        const cats = await env.DB.prepare('SELECT slug FROM categories').all();
        for (const c of cats.results || []) urls.push({ loc: '/kategori/' + c.slug, prio: '0.7', freq: 'weekly' });
        const arts = await env.DB.prepare("SELECT slug, created_at FROM articles WHERE status='Published'").all();
        for (const a of arts.results || []) urls.push({ loc: '/artikel/' + a.slug, prio: '0.7', freq: 'monthly', lastmod: a.created_at ? a.created_at.slice(0, 10) : undefined });
      } catch (e) { /* sitemap tetap jalan walau DB error */ }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${ORIGIN}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n')}\n</urlset>`;
      return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }

    // ── robots.txt (override asset) ──
    if (path === '/robots.txt') {
      const robots = `User-agent: *\nAllow: /\n\nDisallow: /api/\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /akun\n\nSitemap: https://murah-plastic.imangoess78.workers.dev/sitemap.xml\n`;
      return new Response(robots, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    // ── POST /api/admin/login ──
    if (path === '/api/admin/login' && request.method === 'POST') {
      await ensureAdminUsers(env);
      await ensureAdminSessionUserCol(env);
      const { email, password } = await request.json();
      if (!email || !String(email).trim()) return json({ error: 'Email wajib diisi' }, 400);
      let name = 'Super Admin', role = 'super_admin', userId = '';
      // Cek staff admin_users dulu
      const staff = await env.DB.prepare('SELECT * FROM admin_users WHERE email=? AND is_active=1').bind(email.toLowerCase().trim()).first();
      if (staff) {
        if (!await verifyPassword(staff.password, password)) return json({ error: 'Email atau password salah' }, 401);
        name = staff.name; role = staff.role; userId = staff.id;
      } else {
        // Fallback master password HANYA jika belum ada admin terdaftar (bootstrap awal)
        const total = (await env.DB.prepare('SELECT COUNT(*) AS c FROM admin_users').first())?.c || 0;
        if (total === 0 && password === env.ADMIN_PASSWORD) {
          name = 'Super Admin'; role = 'super_admin'; userId = '';
        } else {
          return json({ error: 'Email atau password salah' }, 401);
        }
      }
      const token = nanoid() + nanoid();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        'INSERT INTO admin_sessions (token, expires_at, user_id, role) VALUES (?, ?, ?, ?)'
      ).bind(token, expires, userId, role).run();
      return json({ token, name, role });
    }

    // ── POST /api/admin/change-password ── (ganti password admin yang login)
    if (path === '/api/admin/change-password' && request.method === 'POST') {
      const adm = await getAdminByToken(env, request);
      if (!adm) return json({ error: 'Unauthorized' }, 401);
      if (!adm.user_id) return json({ error: 'Akun bootstrap tidak bisa ganti password — buat admin user dulu' }, 400);
      const { old_password, new_password } = await request.json();
      if (!old_password || !new_password) return json({ error: 'Password lama & baru wajib diisi' }, 400);
      if (String(new_password).length < 8) return json({ error: 'Password baru minimal 8 karakter' }, 400);
      const cur = await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(adm.user_id).first();
      if (!cur) return json({ error: 'User tidak ditemukan' }, 404);
      if (!await verifyPassword(cur.password, String(old_password))) return json({ error: 'Password lama salah' }, 401);
      const hashed = 'sha256$' + await sha256Hex(String(new_password));
      await env.DB.prepare('UPDATE admin_users SET password=? WHERE id=?').bind(hashed, adm.user_id).run();
      return json({ ok: true });
    }

    // ── POST /api/admin/logout ──
    if (path === '/api/admin/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace('Bearer ', '').trim();
      if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token=?').bind(token).run();
      return json({ ok: true });
    }

    // ── GET /api/admin/me ── (info admin yang login)
    if (path === '/api/admin/me' && request.method === 'GET') {
      const adm = await getAdminByToken(env, request);
      if (!adm) return json({ error: 'Unauthorized' }, 401);
      return json({ id: adm.user_id, role: adm.role, name: adm.user_id ? (await env.DB.prepare('SELECT name FROM admin_users WHERE id=?').bind(adm.user_id).first())?.name || '' : 'Super Admin' });
    }

    // ── Admin users CRUD (super_admin only) ──
    if (path === '/api/admin/users' && request.method === 'GET') {
      if (!await isAdminRole(request, env, ['super_admin'])) return json({ error: 'Forbidden' }, 403);
      await ensureAdminUsers(env);
      const { results } = await env.DB.prepare('SELECT id, name, email, role, is_active, created_at FROM admin_users ORDER BY created_at ASC').all();
      return json(results);
    }
    if (path === '/api/admin/users' && request.method === 'POST') {
      if (!await isAdminRole(request, env, ['super_admin'])) return json({ error: 'Forbidden' }, 403);
      await ensureAdminUsers(env);
      const { name, email, password, role } = await request.json();
      if (!name || !email || !password || !role) return json({ error: 'name, email, password, role wajib diisi' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM admin_users WHERE email=?').bind(email.toLowerCase().trim()).first();
      if (existing) return json({ error: 'Email sudah terdaftar' }, 409);
      const id = 'A-' + nanoid();
      const hashedAdmin = password.startsWith('sha256$') ? password : 'sha256$' + await sha256Hex(String(password));
      await env.DB.prepare('INSERT INTO admin_users (id, name, email, password, role) VALUES (?,?,?,?,?)')
        .bind(id, name, email.toLowerCase().trim(), hashedAdmin, role).run();
      return json({ id });
    }
    if (path.startsWith('/api/admin/users/') && request.method === 'PUT') {
      if (!await isAdminRole(request, env, ['super_admin'])) return json({ error: 'Forbidden' }, 403);
      const uid = decodeURIComponent(path.split('/').pop());
      const { name, email, password, role, is_active } = await request.json();
      await ensureAdminUsers(env);
      const cur = await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(uid).first();
      if (!cur) return json({ error: 'User tidak ditemukan' }, 404);
      const upd = [];
      const vals = [];
      if (name !== undefined) { upd.push('name=?'); vals.push(name); }
      if (email !== undefined) { upd.push('email=?'); vals.push(email.toLowerCase().trim()); }
      if (role !== undefined) { upd.push('role=?'); vals.push(role); }
      if (is_active !== undefined) { upd.push('is_active=?'); vals.push(is_active ? 1 : 0); }
      if (password !== undefined && password) { upd.push('password=?'); vals.push(password.startsWith('sha256$') ? password : 'sha256$' + await sha256Hex(String(password))); }
      if (!upd.length) return json({ error: 'Tidak ada perubahan' }, 400);
      vals.push(uid);
      await env.DB.prepare(`UPDATE admin_users SET ${upd.join(',')} WHERE id=?`).bind(...vals).run();
      return json({ ok: true });
    }
    if (path.startsWith('/api/admin/users/') && request.method === 'DELETE') {
      if (!await isAdminRole(request, env, ['super_admin'])) return json({ error: 'Forbidden' }, 403);
      const uid = decodeURIComponent(path.split('/').pop());
      const adm = await getAdminByToken(env, request);
      if (adm.user_id === uid) return json({ error: 'Tidak bisa menghapus akun sendiri' }, 400);
      await env.DB.prepare('DELETE FROM admin_users WHERE id=?').bind(uid).run();
      await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(uid).run();
      return json({ ok: true });
    }

    // ── Payment methods: public (checkout) + admin CRUD ──
    if (path === '/api/payment-methods' && request.method === 'GET') {
      await ensurePaymentMethods(env);
      const { results } = await env.DB.prepare("SELECT * FROM payment_methods WHERE is_active=1 ORDER BY sort_order ASC, created_at ASC").all();
      return json(results);
    }
    if (path === '/api/payment-methods/all' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensurePaymentMethods(env);
      const { results } = await env.DB.prepare('SELECT * FROM payment_methods ORDER BY sort_order ASC, created_at ASC').all();
      return json(results);
    }
    if (path === '/api/payment-methods' && request.method === 'POST') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance'])) return json({ error: 'Forbidden' }, 403);
      await ensurePaymentMethods(env);
      const { type, label, account_name, account_number, phone, image_url, is_active, sort_order } = await request.json();
      if (!type || !label) return json({ error: 'type & label wajib diisi' }, 400);
      const id = 'PM-' + nanoid();
      await env.DB.prepare('INSERT INTO payment_methods (id, type, label, account_name, account_number, phone, image_url, is_active, sort_order) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, type, label, account_name || '', account_number || '', phone || '', image_url || '', is_active === undefined ? 1 : (is_active ? 1 : 0), sort_order || 0).run();
      return json({ id });
    }
    if (path.startsWith('/api/payment-methods/') && request.method === 'PUT') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance'])) return json({ error: 'Forbidden' }, 403);
      const mid = decodeURIComponent(path.split('/').pop());
      const { type, label, account_name, account_number, phone, image_url, is_active, sort_order } = await request.json();
      await env.DB.prepare('UPDATE payment_methods SET type=?, label=?, account_name=?, account_number=?, phone=?, image_url=?, is_active=?, sort_order=? WHERE id=?')
        .bind(type, label, account_name || '', account_number || '', phone || '', image_url || '', is_active === undefined ? 1 : (is_active ? 1 : 0), sort_order || 0, mid).run();
      return json({ ok: true });
    }
    if (path.startsWith('/api/payment-methods/') && request.method === 'DELETE') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance'])) return json({ error: 'Forbidden' }, 403);
      const mid = decodeURIComponent(path.split('/').pop());
      await env.DB.prepare('DELETE FROM payment_methods WHERE id=?').bind(mid).run();
      return json({ ok: true });
    }

    // ── Settings toko (diskon, gratis ongkir, dll) ──
    if (path === '/api/settings' && request.method === 'GET') {
      await ensureSettings(env);
      const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
      const out = {};
      for (const r of results) out[r.key] = r.value;
      return json(out);
    }
    if (path === '/api/settings' && request.method === 'PUT') {
      if (!await isAdminRole(request, env, ['super_admin'])) return json({ error: 'Forbidden' }, 403);
      await ensureSettings(env);
      const body = await request.json();
      const { key, value } = body;
      if (!key) return json({ error: 'key wajib diisi' }, 400);
      const ALLOWED = ['discount_tiers', 'member_discount', 'free_ship_min'];
      if (!ALLOWED.includes(key)) return json({ error: 'Setting tidak dikenal: ' + key }, 400);
      await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
        .bind(key, String(value ?? '')).run();
      return json({ ok: true, key, value: String(value ?? '') });
    }

    // ── Payment confirmations ──
    if (path === '/api/payment-confirmations' && request.method === 'GET') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance', 'operations'])) return json({ error: 'Forbidden' }, 403);
      await ensurePaymentConfirmations(env);
      const { results } = await env.DB.prepare('SELECT * FROM payment_confirmations ORDER BY created_at DESC LIMIT 100').all();
      return json(results);
    }
    if (path.startsWith('/api/payment-confirmations/') && request.method === 'PUT') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance'])) return json({ error: 'Forbidden' }, 403);
      const cid = decodeURIComponent(path.split('/').pop());
      const { status, admin_note } = await request.json();
      await ensurePaymentConfirmations(env);
      const row = await env.DB.prepare('SELECT * FROM payment_confirmations WHERE id=?').bind(cid).first();
      if (!row) return json({ error: 'Konfirmasi tidak ditemukan' }, 404);
      const newStatus = (status === 'Terverifikasi' || status === 'Ditolak') ? status : 'Menunggu Verifikasi';
      await env.DB.prepare('UPDATE payment_confirmations SET status=?, admin_note=?, confirmed_at=? WHERE id=?')
        .bind(newStatus, admin_note || '', newStatus === 'Menunggu Verifikasi' ? '' : new Date().toISOString(), cid).run();
      // Update order: verifikasi → Diproses; ditolak → Menunggu Pembayaran
      if (newStatus === 'Terverifikasi') {
        const ord = await env.DB.prepare('SELECT user_id, customer_name FROM orders WHERE id=?').bind(row.order_id).first();
        await env.DB.prepare("UPDATE orders SET status='Diproses', payment_proof=? WHERE id=?").bind(row.image_url || '', row.order_id).run();
        await appendTimeline(env, row.order_id, 'Diproses', 'Pembayaran terverifikasi (bukti transfer)');
        await addNotif(env, {
          role: 'customer', user_id: ord?.user_id || '', type: 'order_status',
          title: '✅ Pembayaran Terverifikasi',
          message: `Pembayaran order ${row.order_id} sudah diverifikasi. Pesanan sedang diproses.`,
          link: '/akun'
        });
      } else if (newStatus === 'Ditolak') {
        const ord = await env.DB.prepare('SELECT user_id FROM orders WHERE id=?').bind(row.order_id).first();
        await env.DB.prepare("UPDATE orders SET status='Menunggu Pembayaran' WHERE id=?").bind(row.order_id).run();
        await appendTimeline(env, row.order_id, 'Menunggu Pembayaran', 'Bukti bayar ditolak: ' + (admin_note || '-'));
        await addNotif(env, {
          role: 'customer', user_id: ord?.user_id || '', type: 'order_status',
          title: '⚠️ Bukti Pembayaran Ditolak',
          message: `Bukti pembayaran order ${row.order_id} ditolak. ${admin_note || 'Silakan kirim ulang bukti yang benar.'}`,
          link: '/akun'
        });
      }
      return json({ ok: true, status: newStatus });
    }

    // ── POST /api/users/register ──
    if (path === '/api/users/register' && request.method === 'POST') {
      await ensureUserSessions(env);
      const { name, email, password } = await request.json();
      if (!name || !email || !password) return json({ error: 'Missing fields' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
      if (existing) return json({ error: 'Email already exists' }, 409);
      const id = 'U-' + nanoid();
      const joinDate = new Date().toLocaleDateString('id-ID');
      // password datang sebagai btoa(pass) dari frontend → hash raw-nya
      let rawReg = String(password);
      try { const dec = atob(rawReg); if (btoa(dec) === rawReg) rawReg = dec; } catch (e) {}
      const hashedReg = 'sha256$' + await sha256Hex(rawReg);
      await env.DB.prepare(
        'INSERT INTO users (id, name, email, password, join_date) VALUES (?,?,?,?,?)'
      ).bind(id, name, email, hashedReg, joinDate).run();
      const token = await createUserSession(env, id);
      return json({ id, name, email, joinDate, method: 'email', token });
    }

    // ── POST /api/users/login ──
    if (path === '/api/users/login' && request.method === 'POST') {
      await ensureUserSessions(env);
      const { email, password } = await request.json();
      if (!email || !password) return json({ error: 'Missing fields' }, 400);
      const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      if (!user) return json({ error: 'Email not found' }, 404);
      if (!await verifyPassword(user.password, password)) return json({ error: 'Wrong password' }, 401);
      const token = await createUserSession(env, user.id);
      return json({ id: user.id, name: user.name, email: user.email, joinDate: user.join_date, method: 'email', token });
    }

    // ── POST /api/users/logout ──
    if (path === '/api/users/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace('Bearer ', '').trim();
      if (token) await env.DB.prepare('DELETE FROM user_sessions WHERE token=?').bind(token).run();
      return json({ ok: true });
    }

    // ── GET /api/account/me ── (profil member)
    if (path === '/api/account/me' && request.method === 'GET') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureUserCols(env);
      const user = await env.DB.prepare('SELECT id, name, email, phone, address, city, join_date FROM users WHERE id=?').bind(sess.user_id).first();
      if (!user) return json({ error: 'Not found' }, 404);
      return json({ id: user.id, name: user.name, email: user.email, phone: user.phone || '', address: user.address || '', city: user.city || '', joinDate: user.join_date });
    }

    // ── PUT /api/account/me ── (update profil & alamat member)
    if (path === '/api/account/me' && request.method === 'PUT') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureUserCols(env);
      const b = await request.json();
      const fields = [], vals = [];
      if (b.name !== undefined)       { fields.push('name=?');    vals.push(String(b.name).slice(0, 100)); }
      if (b.phone !== undefined)      { fields.push('phone=?');   vals.push(String(b.phone).slice(0, 30)); }
      if (b.address !== undefined)    { fields.push('address=?'); vals.push(String(b.address).slice(0, 500)); }
      if (b.city !== undefined)       { fields.push('city=?');    vals.push(String(b.city).slice(0, 100)); }
      if (b.password !== undefined && b.password) {
        let rawPw = String(b.password);
        // frontend kirim btoa(pass) → decode dulu agar hash konsisten
        try { const dec = atob(rawPw); if (btoa(dec) === rawPw) rawPw = dec; } catch (e) {}
        if (rawPw.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
        fields.push('password=?'); vals.push('sha256$' + await sha256Hex(rawPw));
      }
      if (!fields.length) return json({ error: 'Nothing to update' }, 400);
      vals.push(sess.user_id);
      await env.DB.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
      const user = await env.DB.prepare('SELECT id, name, email, phone, address, city, join_date FROM users WHERE id=?').bind(sess.user_id).first();
      return json({ id: user.id, name: user.name, email: user.email, phone: user.phone || '', address: user.address || '', city: user.city || '', joinDate: user.join_date });
    }

    // ── Wishlist member ──
    // GET /api/account/wishlist (daftar + info produk) | POST {product_id} | DELETE ?product_id=
    if (path === '/api/account/wishlist') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureWishlistReviews(env);
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT w.product_id, w.created_at, p.name, p.short_name, p.slug, p.category, p.img, p.min_price, p.max_price, p.active
           FROM wishlist w LEFT JOIN products p ON p.id = w.product_id
           WHERE w.user_id=? ORDER BY w.created_at DESC LIMIT 100`
        ).bind(sess.user_id).all();
        return json(results);
      }
      if (request.method === 'POST') {
        const b = await request.json();
        if (!b.product_id) return json({ error: 'product_id required' }, 400);
        await env.DB.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)').bind(sess.user_id, b.product_id).run();
        return json({ ok: true });
      }
      if (request.method === 'DELETE') {
        const pid = url.searchParams.get('product_id');
        if (!pid) return json({ error: 'product_id required' }, 400);
        await env.DB.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').bind(sess.user_id, pid).run();
        return json({ ok: true });
      }
    }

    // GET /api/account/wishlist/ids — daftar product_id milik member (untuk tombol wishlist di halaman produk)
    if (path === '/api/account/wishlist/ids' && request.method === 'GET') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureWishlistReviews(env);
      const { results } = await env.DB.prepare('SELECT product_id FROM wishlist WHERE user_id=?').bind(sess.user_id).all();
      return json(results.map(r => r.product_id));
    }

    // ── Review produk ──
    // GET /api/reviews/mine — reviews milik member yang login
    if (path === '/api/reviews/mine' && request.method === 'GET') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureWishlistReviews(env);
      const { results } = await env.DB.prepare(
        'SELECT id, product_id, rating, comment, date, verified FROM reviews WHERE user_id=? ORDER BY date DESC LIMIT 200'
      ).bind(sess.user_id).all();
      return json(results);
    }
    // GET /api/reviews?productId= (publik) | POST {product_id, rating, comment} (member)
    if (path === '/api/reviews' && request.method === 'GET') {
      const pid = url.searchParams.get('productId');
      await ensureWishlistReviews(env);
      const { results } = await env.DB.prepare(
        'SELECT id, product_id, user_name, rating, comment, date, verified FROM reviews WHERE product_id=? ORDER BY date DESC LIMIT 50'
      ).bind(pid || '').all();
      return json(results);
    }
    if (path === '/api/reviews' && request.method === 'POST') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureWishlistReviews(env);
      const b = await request.json();
      if (!b.product_id) return json({ error: 'product_id required' }, 400);
      const rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
      const comment = String(b.comment || '').slice(0, 1000);
      if (!comment) return json({ error: 'Tulis komentar review dulu ya' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM reviews WHERE user_id=? AND product_id=? LIMIT 1').bind(sess.user_id, b.product_id).first();
      if (existing) return json({ error: 'Kamu sudah mereview produk ini', already: true }, 400);
      const user = await env.DB.prepare('SELECT name FROM users WHERE id=?').bind(sess.user_id).first();
      // cek user pernah order produk ini (verified badge)
      const ordered = await env.DB.prepare(
        "SELECT 1 FROM orders WHERE user_id=? AND status IN ('Lunas','Dikirim','Selesai') AND items LIKE ? LIMIT 1"
      ).bind(sess.user_id, '%' + b.product_id + '%').first();
      const id = 'R-' + nanoid();
      await env.DB.prepare(
        'INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, date, verified) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(id, b.product_id, sess.user_id, user?.name || 'Member', rating, comment, new Date().toISOString(), ordered ? 1 : 0).run();
      return json({ id, ok: true, verified: ordered ? 1 : 0 });
    }

    // ── GET /api/account/orders ── (riwayat pesanan member)
    if (path === '/api/account/orders' && request.method === 'GET') {
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Unauthorized' }, 401);
      await ensureOrdersUserCol(env);
      const { results } = await env.DB.prepare(
        'SELECT * FROM orders WHERE user_id=? ORDER BY date DESC LIMIT 100'
      ).bind(sess.user_id).all();
      return json(results.map(r => ({
        ...r,
        items: JSON.parse(r.items || '[]'),
        complaint: r.complaint ? JSON.parse(r.complaint) : null,
        shipping: r.shipping ? JSON.parse(r.shipping) : {},
        timeline: parseTimeline(r)
      })));
    }

    // ── GET /api/orders ── (admin only)
    if (path === '/api/orders' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const status = url.searchParams.get('status');
      let q = 'SELECT * FROM orders WHERE 1=1';
      const p = [];
      if (status) { q += ' AND status=?'; p.push(status); }
      q += ' ORDER BY date DESC LIMIT 200';
      const { results } = await env.DB.prepare(q).bind(...p).all();
      return json(results.map(r => ({
        ...r,
        items: JSON.parse(r.items || '[]'),
        complaint: r.complaint ? JSON.parse(r.complaint) : null,
        shipping: r.shipping ? JSON.parse(r.shipping) : {}
      })));
    }

    // ── POST /api/orders ── (create order)
    if (path === '/api/orders' && request.method === 'POST') {
      await ensureOrdersUserCol(env);
      const o = await request.json();
      const id = o.id || ('MP-' + nanoid());
      const shippingCost = Math.max(0, Number(o.shipping?.cost) || 0);
      const shipping = o.shipping ? {
        city: o.shipping.city || '',
        province: o.shipping.province || '',
        courier: o.shipping.courier || '',
        courier_name: o.shipping.courier_name || '',
        cost: shippingCost,
        etd: o.shipping.etd || '',
        weight_kg: o.shipping.weight_kg || 0
      } : {};
      await env.DB.prepare(`
        INSERT INTO orders (id, date, customer_name, customer_phone, customer_address, customer_note,
          items, sub, disc, disc_amt, member_disc, member_amt, voucher_amt, total, payment, status, shipping, shipping_cost, user_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, o.date || new Date().toISOString(),
        o.customer.name, o.customer.phone, o.customer.address, o.customer.note || '',
        JSON.stringify(o.items), o.sub, o.disc || 0, o.discAmt || 0,
        o.memberDisc || 0, o.memberAmt || 0, o.voucherAmt || 0,
        o.total, o.payment, o.status || 'Menunggu Pembayaran',
        JSON.stringify(shipping), shippingCost, o.user_id || ''
      ).run();
      await addNotif(env, {
        role: 'admin', type: 'order',
        title: '🛒 Order Baru Masuk',
        message: `${o.customer.name} — ${o.items.length} item · Rp${Number(o.total).toLocaleString('id-ID')} (${o.payment || '-'})`,
        link: '/admin'
      });
      return json({ id });
    }

    // ── POST /api/payment/create ── (QRIS via Pakasir)
    if (path === '/api/payment/create' && request.method === 'POST') {
      const { order_id, amount } = await request.json();
      if (!order_id || !amount) return json({ error: 'order_id & amount required' }, 400);
      const data = await pakasir(env, '/api/transactioncreate/qris', { order_id, amount: Number(amount), callback_url: `${new URL(request.url).origin}/api/payment/callback` });
      if (!data.payment) return json({ error: data.message || 'Gagal membuat pembayaran', raw: data }, 502);
      const p = data.payment;
      return json({
        order_id: p.order_id,
        qr: p.payment_number,          // string QRIS
        total: p.total_payment,        // amount + fee
        fee: p.fee,
        amount: p.amount,
        expired_at: p.expired_at
      });
    }

    // ── GET /api/payment/check ── (cek status QRIS, auto-update order saat lunas)
    if (path === '/api/payment/check' && request.method === 'GET') {
      const order_id = url.searchParams.get('order_id');
      const amount = url.searchParams.get('amount');
      if (!order_id || !amount) return json({ error: 'order_id & amount required' }, 400);
      const data = await pakasirGet(env, '/api/transactiondetail', { order_id, amount: Number(amount) });
      const t = data.transaction || {};
      const paid = t.status === 'completed';
      if (paid) {
        // Auto-update status order jadi Lunas
        await env.DB.prepare("UPDATE orders SET status='Lunas' WHERE id=? AND status != 'Lunas'")
          .bind(order_id).run();
      }
      return json({ order_id, status: t.status, paid, completed_at: t.completed_at });
    }

    // ── POST /api/payment/cancel ── (batalkan transaksi QRIS)
    if (path === '/api/payment/cancel' && request.method === 'POST') {
      const { order_id, amount } = await request.json();
      if (!order_id || !amount) return json({ error: 'order_id & amount required' }, 400);
      const data = await pakasir(env, '/api/transactioncancel', { order_id, amount: Number(amount) });
      return json({ ok: !data.message, message: data.message || 'Dibatalkan', raw: data });
    }

    // ── POST /api/payment/callback ── (webhook dari Pakasir saat pembayaran berubah status)
    if (path === '/api/payment/callback' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const t = body.transaction || body.data || body;
      const order_id = body.order_id || t.order_id || t.merchant_ref || t.ref;
      const status = String(t.status || body.status || '').toLowerCase();
      if (order_id && (status === 'completed' || status === 'paid' || status === 'success' || t.paid === true)) {
        await env.DB.prepare("UPDATE orders SET status='Lunas' WHERE id=? AND status != 'Lunas'")
          .bind(order_id).run();
      }
      return json({ ok: true });
    }

    // ── GET /api/orders/:id ── (public — lacak pesanan)
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderMatch[1]).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json({
        ...row,
        items: JSON.parse(row.items || '[]'),
        complaint: row.complaint ? JSON.parse(row.complaint) : null,
        shipping: row.shipping ? JSON.parse(row.shipping) : {},
        timeline: parseTimeline(row)
      });
    }

    // ── PUT /api/orders/:id ──
    if (orderMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json();
      const prevRow = await env.DB.prepare('SELECT status, complaint, user_id FROM orders WHERE id=?').bind(orderMatch[1]).first();
      const fields = [];
      const vals = [];
      if (body.status !== undefined)      { fields.push('status=?');    vals.push(body.status); }
      if (body.resi !== undefined)        { fields.push('resi=?');      vals.push(body.resi); }
      if (body.deadline !== undefined)    { fields.push('deadline=?');  vals.push(body.deadline); }
      if (body.receivedDate !== undefined){ fields.push('complaint=?'); 
        // store receivedDate inside complaint JSON
        const row = await env.DB.prepare('SELECT complaint FROM orders WHERE id=?').bind(orderMatch[1]).first();
        const c = row?.complaint ? JSON.parse(row.complaint) : {};
        c.receivedDate = body.receivedDate;
        vals.push(JSON.stringify(c));
      }
      if (body.complaint !== undefined)   {
        // Merge complaint: simpan reply/history + riwayat perubahan status komplain
        const row = await env.DB.prepare('SELECT complaint FROM orders WHERE id=?').bind(orderMatch[1]).first();
        let prev = {};
        try { prev = row?.complaint ? JSON.parse(row.complaint) : {}; } catch (e) { prev = {}; }
        const next = Object.assign({}, prev, body.complaint);
        if (next.status && next.status !== prev.status) {
          const hist = Array.isArray(prev.history) ? prev.history : [];
          hist.push({ from: prev.status || '', to: next.status, at: new Date().toISOString(), by: 'admin' });
          next.history = hist;
        }
        next.updated_at = new Date().toISOString();
        fields.push('complaint=?'); vals.push(JSON.stringify(next));
      }
      if (body.customer_name !== undefined) { fields.push('customer_name=?'); vals.push(body.customer_name); }
      if (body.customer_phone !== undefined) { fields.push('customer_phone=?'); vals.push(body.customer_phone); }
      if (body.customer_address !== undefined) { fields.push('customer_address=?'); vals.push(body.customer_address); }
      if (!fields.length) return json({ error: 'Nothing to update' }, 400);
      vals.push(orderMatch[1]);
      await env.DB.prepare(`UPDATE orders SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
      // Timeline otomatis untuk perubahan status & resi
      if (body.status !== undefined) {
        await appendTimeline(env, orderMatch[1], body.status, body.note || '');
      } else if (body.resi !== undefined && body.resi) {
        await appendTimeline(env, orderMatch[1], 'Dikirim', 'Resi: ' + body.resi);
      }
      // ── Notifikasi otomatis ──
      if (prevRow) {
        // Status order berubah → notif customer
        if (body.status !== undefined && prevRow.status !== body.status) {
          await addNotif(env, {
            user_id: prevRow.user_id || '', role: 'customer', type: 'order_status',
            title: '📦 Status Pesanan Diperbarui',
            message: `Order ${orderMatch[1]}: ${prevRow.status} → ${body.status}`,
            link: '/akun'
          });
        }
        // Komplain
        if (body.complaint !== undefined) {
          let prevC = {};
          try { prevC = prevRow.complaint ? JSON.parse(prevRow.complaint) : {}; } catch (e) { prevC = {}; }
          const isNew = !prevRow.complaint || !prevC.status;
          if (isNew) {
            // Komplain baru masuk → notif admin
            await addNotif(env, {
              role: 'admin', type: 'komplain',
              title: '🛠️ Komplain Baru Masuk',
              message: `Order ${orderMatch[1]} — ${body.complaint.type || body.complaint.reason || 'Komplain'} dari ${prevRow.user_id ? 'member' : 'guest'}`,
              link: '/admin'
            });
          } else if ((body.complaint.status && body.complaint.status !== prevC.status) || body.complaint.adminReply || body.complaint.reply) {
            // Komplain direspons admin → notif customer
            await addNotif(env, {
              user_id: prevRow.user_id || '', role: 'customer', type: 'komplain',
              title: '🛠️ Komplain Diperbarui',
              message: `Order ${orderMatch[1]}: ${body.complaint.status || prevC.status}${(body.complaint.adminReply || body.complaint.reply) ? ' · Ada balasan dari admin' : ''}`,
              link: '/akun'
            });
          }
        }
      }
      return json({ ok: true });
    }

    // ── DELETE /api/orders/:id ──
    if (orderMatch && request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM orders WHERE id=?').bind(orderMatch[1]).run();
      return json({ ok: true });
    }

    // ── GET /api/questions ──
    if (path === '/api/questions' && request.method === 'GET') {
      const pid = url.searchParams.get('productId');
      let q = 'SELECT * FROM questions WHERE 1=1';
      const p = [];
      if (pid) { q += ' AND product_id=?'; p.push(pid); }
      q += ' ORDER BY date DESC LIMIT 100';
      const { results } = await env.DB.prepare(q).bind(...p).all();
      return json(results);
    }

    // ── POST /api/questions ──
    if (path === '/api/questions' && request.method === 'POST') {
      await ensureQuestionsUserCol(env);
      const q = await request.json();
      const id = q.id || ('Q-' + nanoid());
      const sess = await getUserByToken(env, request);
      if (!sess) return json({ error: 'Login required' }, 401);
      const uid = sess.user_id || '';
      await env.DB.prepare(`
        INSERT INTO questions (id, product_id, product_name, question, user_name, date, user_id)
        VALUES (?,?,?,?,?,?,?)
      `).bind(id, q.productId, q.productName || '', q.question, q.userName || q.name || 'Anonim', new Date().toISOString(), uid).run();
      await addNotif(env, {
        role: 'admin', type: 'question',
        title: '❓ Pertanyaan Baru',
        message: `${q.userName || 'Anonim'} — ${(q.question || '').substring(0, 80)}`,
        link: '/admin'
      });
      return json({ id });
    }

    // ── PUT /api/questions/:id ── (admin answer)
    const qMatch = path.match(/^\/api\/questions\/([^/]+)$/);
    if (qMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { answer } = await request.json();
      await env.DB.prepare('UPDATE questions SET answer=?, answered_at=? WHERE id=?')
        .bind(answer, new Date().toISOString(), qMatch[1]).run();
      // Notif ke customer yang bertanya (jika member login)
      const qRow = await env.DB.prepare('SELECT user_id, question FROM questions WHERE id=?').bind(qMatch[1]).first();
      if (qRow && qRow.user_id) {
        await addNotif(env, {
          user_id: qRow.user_id, role: 'customer', type: 'qna_answer',
          title: '❓ Pertanyaanmu Dijawab',
          message: `"${(qRow.question || '').substring(0, 60)}" — ${answer ? (String(answer).substring(0, 60)) : ''}`,
          link: '/akun'
        });
      }
      return json({ ok: true });
    }

    // ── DELETE /api/questions/:id ── (admin hapus pertanyaan spam/duplikat)
    if (qMatch && request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM questions WHERE id=?').bind(qMatch[1]).run();
      return json({ ok: true });
    }

    // ── POST /api/upload/product ── (upload gambar produk ke R2, return /img/ path)
    if (path === '/api/upload/product' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return json({ error: 'Missing file' }, 400);
      const ext = (file.name || 'jpg').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      const key = `products/${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      return json({ url: '/img/' + key });
    }

    // ── POST /api/upload/article ── (upload gambar artikel ke R2)
    if (path === '/api/upload/article' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return json({ error: 'Missing file' }, 400);
      const ext = (file.name || 'jpg').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      const key = `articles/${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      return json({ url: '/img/' + key });
    }

    // ── POST /api/upload/content ── (upload inline image konten ke R2)
    if (path === '/api/upload/content' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return json({ error: 'Missing file' }, 400);
      const ext = (file.name || 'jpg').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      const key = `content/${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      return json({ url: '/img/' + key });
    }

    // ── POST /api/upload/qris ── (upload gambar QRIS statis ke R2, admin)
    if (path === '/api/upload/qris' && request.method === 'POST') {
      if (!await isAdminRole(request, env, ['super_admin', 'finance'])) return json({ error: 'Forbidden' }, 403);
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return json({ error: 'Missing file' }, 400);
      const ext = (file.name || 'png').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
      const key = `qris/${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/png' },
      });
      return json({ url: '/img/' + key });
    }

    // ── POST /api/upload/payment ── (customer upload bukti bayar manual ke R2)
    if (path === '/api/upload/payment' && request.method === 'POST') {
      await ensurePaymentConfirmations(env);
      await ensurePaymentProofCol(env);
      const formData = await request.formData();
      const file = formData.get('file');
      const orderId = formData.get('orderId');
      const note = formData.get('note') || '';
      const method = formData.get('method') || '';
      if (!file || !orderId) return json({ error: 'Missing file or orderId' }, 400);
      const ext = (file.name || 'jpg').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      const key = `payments/${orderId}-${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      const publicUrl = `https://pub-62025364d604448fb3fc875c6dcf73b2.r2.dev/${key}`;
      // Auth: customer yang punya order (atau guest via WA)
      const sess = await getUserByToken(env, request);
      const ord = await env.DB.prepare('SELECT user_id, total FROM orders WHERE id=?').bind(orderId).first();
      if (sess && ord && ord.user_id && sess.user_id !== ord.user_id) {
        return json({ error: 'Order ini bukan milik kamu' }, 403);
      }
      const cid = 'PC-' + nanoid();
      await env.DB.prepare('INSERT INTO payment_confirmations (id, order_id, user_id, method, amount, image_url, note) VALUES (?,?,?,?,?,?,?)')
        .bind(cid, orderId, sess?.user_id || ord?.user_id || '', method, Number(ord?.total) || 0, publicUrl, note).run();
      await env.DB.prepare('UPDATE orders SET payment_proof=?, status=? WHERE id=?')
        .bind(publicUrl, 'Menunggu Konfirmasi', orderId).run();
      await appendTimeline(env, orderId, 'Menunggu Konfirmasi', 'Bukti pembayaran diterima, menunggu verifikasi admin');
      const o2 = await env.DB.prepare('SELECT customer_name FROM orders WHERE id=?').bind(orderId).first();
      await addNotif(env, {
        role: 'admin', type: 'order',
        title: '💳 Bukti Pembayaran Masuk',
        message: `${o2?.customer_name || ''} mengirim bukti bayar untuk ${orderId} — menunggu verifikasi.`,
        link: '/admin'
      });
      return json({ url: publicUrl, confirmation_id: cid });
    }

    // ── GET /api/products ── (public — seed otomatis jika kosong)
    if (path === '/api/products' && request.method === 'GET') {
      await ensureProducts(env);
      const { results } = await env.DB.prepare(
        'SELECT * FROM products WHERE active=1 ORDER BY category, name'
      ).all();
      return json(results.map(p => ({ ...p, variants: JSON.parse(p.variants || '[]'), specs: JSON.parse(p.specs || '{}') })));
    }

    // ── GET /api/shipping/cities ── daftar provinsi + kota (untuk dropdown checkout)
    if (path === '/api/shipping/cities' && request.method === 'GET') {
      await ensureShipping(env);
      const { results } = await env.DB.prepare('SELECT city, province, zone FROM shipping_cities ORDER BY province, city').all();
      const provinces = [...new Set(results.map(r => r.province))];
      return json({ provinces, cities: results });
    }

    // ── GET /api/shipping/cost?city=...&weight=...&courier=... ── hitung ongkir semua kurir
    if (path === '/api/shipping/cost' && request.method === 'GET') {
      await ensureShipping(env);
      const city = url.searchParams.get('city') || '';
      const weight = Math.max(1, Number(url.searchParams.get('weight')) || 0);
      const courierFilter = url.searchParams.get('courier');
      const cityRow = await env.DB.prepare('SELECT city, province, zone FROM shipping_cities WHERE city=? LIMIT 1').bind(city).first();
      if (!cityRow) return json({ error: 'Kota tidak ditemukan' }, 404);

      const { results: rates } = await env.DB.prepare(
        'SELECT courier, cost_per_kg, etd FROM shipping_rates WHERE zone=? ORDER BY cost_per_kg'
      ).bind(cityRow.zone).all();

      const kg = Math.max(1, Math.ceil(weight / 1000));
      const costs = rates
        .filter(r => !courierFilter || r.courier === courierFilter)
        .map(r => ({
          courier: r.courier,
          courier_name: COURIER_NAMES[r.courier] || r.courier,
          cost: r.cost_per_kg * kg,
          cost_per_kg: r.cost_per_kg,
          etd: r.etd || '-',
          weight_kg: kg
        }))
        .sort((a, b) => a.cost - b.cost);

      return json({ city: cityRow.city, province: cityRow.province, zone: cityRow.zone, weight_gram: weight, weight_kg: kg, costs });
    }

    // ── POST /api/products ── (admin)
    if (path === '/api/products' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const id = b.id || ('P-' + nanoid());
      await env.DB.prepare(
        `INSERT INTO products (id, name, short_name, desc, category, img_key, img, min_price, max_price, variants, specs, active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, b.name || '', b.short_name || '', b.desc || '', b.category || '',
        b.img_key || '', b.img || '', Number(b.min_price) || 0, Number(b.max_price) || 0,
        JSON.stringify(b.variants || []), JSON.stringify(b.specs || {}), b.active === undefined ? 1 : (b.active ? 1 : 0)
      ).run();
      return json({ id });
    }

    // ── PUT /api/products/:id ── (admin)
    const pMatch = path.match(/^\/api\/products\/([^/]+)$/);
    if (pMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const fields = [], vals = [];
      if (b.name !== undefined)         { fields.push('name=?');         vals.push(b.name); }
      if (b.short_name !== undefined)   { fields.push('short_name=?');   vals.push(b.short_name); }
      if (b.desc !== undefined)         { fields.push('desc=?');         vals.push(b.desc); }
      if (b.category !== undefined)     { fields.push('category=?');     vals.push(b.category); }
      if (b.img_key !== undefined)      { fields.push('img_key=?');      vals.push(b.img_key); }
      if (b.img !== undefined)          { fields.push('img=?');          vals.push(b.img); }
      if (b.min_price !== undefined)    { fields.push('min_price=?');    vals.push(Number(b.min_price)); }
      if (b.max_price !== undefined)    { fields.push('max_price=?');    vals.push(Number(b.max_price)); }
      if (b.variants !== undefined)     { fields.push('variants=?');     vals.push(JSON.stringify(b.variants)); }
      if (b.specs !== undefined)        { fields.push('specs=?');        vals.push(JSON.stringify(b.specs)); }
      if (b.active !== undefined)       { fields.push('active=?');       vals.push(b.active ? 1 : 0); }
      if (!fields.length) return json({ error: 'Nothing to update' }, 400);
      fields.push("updated_at=datetime('now')");
      vals.push(pMatch[1]);
      await env.DB.prepare(`UPDATE products SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
      return json({ ok: true });
    }

    // ── DELETE /api/products/:id ── (admin)
    if (pMatch && request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM products WHERE id=?').bind(pMatch[1]).run();
      return json({ ok: true });
    }

    // ── GET /api/articles ── (public read; admin via ?all=1)
    if (path === '/api/articles' && request.method === 'GET') {
      const isAdm = await isAdmin(request, env);
      const all = url.searchParams.get('all') === '1';
      let q = 'SELECT * FROM articles';
      if (!(isAdm && all)) q += " WHERE status='Published'";
      q += ' ORDER BY created_at DESC LIMIT 100';
      const { results } = await env.DB.prepare(q).all();
      return json(results);
    }

    // ── POST /api/articles ── (admin)
    if (path === '/api/articles' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const id = b.id || ('A-' + nanoid());
      const slug = b.slug || slugify(b.title);
      await env.DB.prepare(
        `INSERT INTO articles (id, slug, title, category, content, image, status) VALUES (?,?,?,?,?,?,?)`
      ).bind(id, slug, b.title || '', b.category || 'Blog', b.content || '', b.image || '', b.status || 'Draft').run();
      return json({ id, slug });
    }

    // ── PUT /api/articles/:id ── (admin)
    const aMatch = path.match(/^\/api\/articles\/([^/]+)$/);
    if (aMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const fields = [], vals = [];
      if (b.title !== undefined)    { fields.push('title=?');    vals.push(b.title); }
      if (b.slug !== undefined)     { fields.push('slug=?');     vals.push(b.slug); }
      if (b.category !== undefined) { fields.push('category=?'); vals.push(b.category); }
      if (b.content !== undefined)  { fields.push('content=?');  vals.push(b.content); }
      if (b.image !== undefined)    { fields.push('image=?');    vals.push(b.image); }
      if (b.status !== undefined)   { fields.push('status=?');   vals.push(b.status); }
      if (!fields.length) return json({ error: 'Nothing to update' }, 400);
      fields.push("updated_at=datetime('now')");
      vals.push(aMatch[1]);
      await env.DB.prepare(`UPDATE articles SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
      return json({ ok: true });
    }

    // ── DELETE /api/articles/:id ── (admin)
    if (aMatch && request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(aMatch[1]).run();
      return json({ ok: true });
    }

    // ── /api/customers ── (admin CRUD; merge tabel manual + derive dari orders)
    const custMatch = path.match(/^\/api\/customers\/([^/]+)$/);
    if (path === '/api/customers' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensureCustomersTable(env);
      const { results: orders } = await env.DB.prepare('SELECT * FROM orders ORDER BY date DESC').all();
      const { results: manual } = await env.DB.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
      const map = new Map();
      for (const c of manual) {
        map.set(c.phone.trim(), {
          name: c.name || '-', phone: c.phone, email: c.email || '',
          address: c.address || '', city: c.city || '', note: c.note || '',
          source: 'manual', orders: 0, total: 0, first_order: '', last_order: '',
          created_at: c.created_at,
        });
      }
      for (const o of orders) {
        const key = (o.customer_phone || '').trim() || (o.customer_name || '?').trim();
        if (!map.has(key)) {
          map.set(key, {
            name: o.customer_name || '-', phone: o.customer_phone || '',
            email: '', address: o.customer_address || '', city: '',
            note: '', source: 'order', orders: 0, total: 0,
            first_order: o.date, last_order: o.date, created_at: o.date,
          });
        }
        const c = map.get(key);
        c.orders += 1;
        c.total += o.total || 0;
        if (o.date > c.last_order) c.last_order = o.date;
        if (!c.first_order || o.date < c.first_order) c.first_order = o.date;
        if (!c.name || c.name === '-') c.name = o.customer_name || '-';
        if (!c.address && o.customer_address) c.address = o.customer_address;
      }
      return json([...map.values()].sort((a, b) => b.total - a.total));
    }

    // ── GET /api/customers/:phone ── (detail + riwayat pesanan)
    if (custMatch && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const phone = decodeURIComponent(custMatch[1]);
      await ensureCustomersTable(env);
      const manual = await env.DB.prepare('SELECT * FROM customers WHERE phone=?').bind(phone).first();
      const { results: orderRows } = await env.DB.prepare(
        'SELECT * FROM orders WHERE customer_phone=? ORDER BY date DESC'
      ).bind(phone).all();
      const profile = {
        name: manual?.name || (orderRows[0]?.customer_name || '-'),
        phone, email: manual?.email || '', address: manual?.address || (orderRows[0]?.customer_address || ''),
        city: manual?.city || '', note: manual?.note || '',
        orders: orderRows.length,
        total: orderRows.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0),
        first_order: orderRows.length ? orderRows[orderRows.length - 1].date : '',
        last_order: orderRows.length ? orderRows[0].date : '',
        orderList: orderRows.map(o => ({
          id: o.id, date: o.date, status: o.status, total: o.total,
          payment: o.payment, items: (() => { try { return JSON.parse(o.items || '[]'); } catch (e) { return []; } })()
        }))
      };
      return json(profile);
    }

    // ── POST /api/customers ── (admin buat customer manual)
    if (path === '/api/customers' && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensureCustomersTable(env);
      const b = await request.json();
      const phone = String(b.phone || '').trim().replace(/[^0-9+]/g, '');
      if (!phone || !String(b.name || '').trim()) return json({ error: 'Nama & No. HP wajib diisi' }, 400);
      const existing = await env.DB.prepare('SELECT phone FROM customers WHERE phone=?').bind(phone).first();
      if (existing) return json({ error: 'Customer dengan nomor ini sudah ada' }, 409);
      await env.DB.prepare(
        'INSERT INTO customers (phone, name, email, address, city, note) VALUES (?,?,?,?,?,?)'
      ).bind(phone, String(b.name).trim(), b.email || '', b.address || '', b.city || '', b.note || '').run();
      return json({ ok: true, phone });
    }

    // ── PUT /api/customers/:phone ── (admin edit)
    if (custMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensureCustomersTable(env);
      const phone = decodeURIComponent(custMatch[1]);
      const b = await request.json();
      const existing = await env.DB.prepare('SELECT phone FROM customers WHERE phone=?').bind(phone).first();
      if (!existing) {
        // Belum ada di tabel manual → buat baru (upsert dari data order)
        await env.DB.prepare(
          'INSERT INTO customers (phone, name, email, address, city, note) VALUES (?,?,?,?,?,?)'
        ).bind(phone, b.name || '', b.email || '', b.address || '', b.city || '', b.note || '').run();
      } else {
        await env.DB.prepare(
          'UPDATE customers SET name=?, email=?, address=?, city=?, note=?, updated_at=datetime(\'now\') WHERE phone=?'
        ).bind(b.name || '', b.email || '', b.address || '', b.city || '', b.note || '', phone).run();
      }
      return json({ ok: true });
    }

    // ── DELETE /api/customers/:phone ── (admin hapus dari daftar manual; riwayat order tetap)
    if (custMatch && request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensureCustomersTable(env);
      await env.DB.prepare('DELETE FROM customers WHERE phone=?').bind(decodeURIComponent(custMatch[1])).run();
      return json({ ok: true });
    }

    // ── GET /api/stats ── (admin dashboard)
    if (path === '/api/stats' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      await ensureWishlistReviews(env);  // safety: tabel reviews untuk query di bawah
      const { results: orders } = await env.DB.prepare('SELECT * FROM orders').all();
      const { results: prods } = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').all();
      const { results: qs } = await env.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE answer='' OR answer IS NULL").all();
      const { results: arts } = await env.DB.prepare('SELECT COUNT(*) AS n FROM articles').all();
      const { results: rvs } = await env.DB.prepare('SELECT COUNT(*) AS n FROM reviews').all();
      await ensureCustomersTable(env);
      const { results: custs } = await env.DB.prepare('SELECT COUNT(*) AS n FROM customers').all();

      const revenue = orders.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const monthPrefix = today.slice(0, 7);
      const todayCount = orders.filter(o => (o.date || '').slice(0, 10) === today).length;
      const monthOrders = orders.filter(o => (o.date || '').slice(0, 7) === monthPrefix);
      const monthRevenue = monthOrders.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0);
      const pending = orders.filter(o => o.status === 'Menunggu Pembayaran').length;
      const cancelled = orders.filter(o => o.status === 'Dibatalkan').length;
      const komplainList = orders.filter(o => o.complaint);
      const komplainOpen = komplainList.filter(o => {
        try { const c = typeof o.complaint === 'string' ? JSON.parse(o.complaint) : o.complaint; return (c.status || 'Menunggu Diproses') !== 'Selesai'; } catch (e) { return true; }
      }).length;

      // Last 14 days series
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const list = orders.filter(o => (o.date || '').slice(0, 10) === d);
        days.push({ date: d, orders: list.length, revenue: list.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0) });
      }

      // Top products
      const prodCount = {};
      const prodRev = {};
      for (const o of orders) {
        let items = [];
        try { items = JSON.parse(o.items || '[]'); } catch (e) {}
        for (const it of items) {
          const k = it.productName || it.name || 'Produk';
          prodCount[k] = (prodCount[k] || 0) + (it.qty || 1);
          prodRev[k] = (prodRev[k] || 0) + ((it.price || 0) * (it.qty || 1));
        }
      }
      const topProducts = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, qty]) => ({ name, qty, revenue: prodRev[name] || 0 }));

      // Status breakdown
      const byStatus = {};
      for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

      return json({
        revenue, ordersCount: orders.length, todayCount, pending, cancelled,
        productCount: prods[0].n, unanswered: qs[0].n, articleCount: arts[0].n,
        reviewCount: rvs[0].n, customerCount: custs[0].n,
        komplainTotal: komplainList.length, komplainOpen,
        monthRevenue, monthOrders: monthOrders.length,
        days, topProducts, byStatus
      });
    }

    // ── GET /api/reports ── (admin — laporan per periode: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
    if (path === '/api/reports' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { results: orders } = await env.DB.prepare('SELECT * FROM orders').all();
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const inRange = o => {
        const d = (o.date || '').slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };
      const list = orders.filter(inRange);
      const valid = list.filter(o => o.status !== 'Dibatalkan');

      // Omset (Gross Revenue) = subtotal produk sebelum diskon
      const grossRevenue = valid.reduce((s, o) => s + (o.sub || 0), 0);
      // Total diskon (disc nominal + member amount + voucher)
      const totalDiscount = valid.reduce((s, o) => s + (o.disc || 0) + (o.member_amt || 0) + (o.voucher_amt || 0), 0);
      // Pendapatan bersih produk = omset - diskon
      const netRevenue = grossRevenue - totalDiscount;
      // Biaya pengiriman
      const shippingCost = valid.reduce((s, o) => {
        let shp = {};
        try { shp = typeof o.shipping === 'string' ? JSON.parse(o.shipping) : (o.shipping || {}); } catch (e) { shp = {}; }
        return s + (shp.cost || 0);
      }, 0);
      // Total diterima (termasuk ongkir) = sum(total)
      const totalCollected = valid.reduce((s, o) => s + (o.total || 0), 0);
      // Profit kotor = pendapatan bersih - biaya kirim
      const profit = netRevenue - shippingCost;
      const customers = new Set(list.map(o => (o.customer_phone || '').trim()).filter(Boolean));

      // Per hari
      const byDayMap = {};
      for (const o of list) {
        const d = (o.date || '').slice(0, 10);
        byDayMap[d] = byDayMap[d] || { date: d, orders: 0, gross: 0, discount: 0, shipping: 0, net: 0 };
        byDayMap[d].orders += 1;
        if (o.status !== 'Dibatalkan') {
          byDayMap[d].gross += o.sub || 0;
          byDayMap[d].discount += (o.disc || 0) + (o.member_amt || 0) + (o.voucher_amt || 0);
          let shp = {};
          try { shp = typeof o.shipping === 'string' ? JSON.parse(o.shipping) : (o.shipping || {}); } catch (e) { shp = {}; }
          byDayMap[d].shipping += shp.cost || 0;
          byDayMap[d].net += o.total || 0;
        }
      }
      const byDay = Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date));

      // Per kategori produk
      const byCategory = {};
      for (const o of valid) {
        let items = [];
        try { items = JSON.parse(o.items || '[]'); } catch (e) {}
        for (const it of items) {
          const cat = it.category || 'Lainnya';
          byCategory[cat] = byCategory[cat] || { category: cat, qty: 0, gross: 0 };
          byCategory[cat].qty += it.qty || 1;
          byCategory[cat].gross += (it.price || 0) * (it.qty || 1);
        }
      }

      // Per kurir
      const byCourier = {};
      for (const o of valid) {
        let shp = {};
        try { shp = typeof o.shipping === 'string' ? JSON.parse(o.shipping) : (o.shipping || {}); } catch (e) { shp = {}; }
        const c = shp.courier_name || shp.courier || 'Lainnya';
        byCourier[c] = byCourier[c] || { courier: c, orders: 0, shippingCost: 0 };
        byCourier[c].orders += 1;
        byCourier[c].shippingCost += shp.cost || 0;
      }

      // Per metode pembayaran
      const byPayment = {};
      for (const o of list) {
        const p = o.payment || 'Lainnya';
        byPayment[p] = byPayment[p] || { payment: p, orders: 0 };
        byPayment[p].orders += 1;
      }

      // Per status
      const byStatus = {};
      for (const o of list) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

      // Top produk
      const prodCount = {};
      const prodRev = {};
      for (const o of valid) {
        let items = [];
        try { items = JSON.parse(o.items || '[]'); } catch (e) {}
        for (const it of items) {
          const k = it.productName || it.name || 'Produk';
          prodCount[k] = (prodCount[k] || 0) + (it.qty || 1);
          prodRev[k] = (prodRev[k] || 0) + ((it.price || 0) * (it.qty || 1));
        }
      }
      const topProducts = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([name, qty]) => ({ name, qty, gross: prodRev[name] || 0 }));

      // Produk terjual total
      const productSold = Object.values(prodCount).reduce((s, n) => s + n, 0);

      return json({
        from: from || null, to: to || null,
        summary: {
          grossRevenue, totalDiscount, netRevenue, shippingCost, totalCollected, profit,
          ordersCount: list.length, validOrders: valid.length,
          avgOrder: valid.length ? Math.round(netRevenue / valid.length) : 0,
          productSold, uniqueCustomers: customers.size,
        },
        byDay, byCategory: Object.values(byCategory).sort((a, b) => b.gross - a.gross),
        byCourier: Object.values(byCourier).sort((a, b) => b.shippingCost - a.shippingCost),
        byPayment: Object.values(byPayment).sort((a, b) => b.orders - a.orders),
        byStatus, topProducts
      });
    }

    // ── GET /api/categories ── (publik: active=1; admin: ?all=1 + count produk)
    if (path === '/api/categories' && request.method === 'GET') {
      const isAdminReq = url.searchParams.get('all') === '1';
      if (isAdminReq && !(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
      const q = isAdminReq
        ? 'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category=c.name AND p.active=1) AS product_count FROM categories c ORDER BY c.sort_order, c.id'
        : 'SELECT * FROM categories WHERE active=1 ORDER BY sort_order, id';
      const { results } = await env.DB.prepare(q).all();
      return json(results);
    }

    // ── POST /api/categories ── (admin create)
    if (path === '/api/categories' && request.method === 'POST') {
      if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const name = String(b.name || '').trim();
      if (!name) return json({ error: 'Nama kategori wajib diisi' }, 400);
      const slug = String(b.slug || '').trim() || slugify(name);
      const icon = String(b.icon || '📦').trim();
      const featured = String(b.featured_image || '').trim();
      const desc = String(b.description || '').trim();
      const order = Number(b.sort_order) || 0;
      const active = b.active === false ? 0 : 1;
      try {
        const r = await env.DB.prepare(
          'INSERT INTO categories (slug, name, icon, featured_image, description, sort_order, active) VALUES (?,?,?,?,?,?,?)'
        ).bind(slug, name, icon, featured, desc, order, active).run();
        return json({ id: r.meta.last_row_id, slug, name });
      } catch (e) {
        return json({ error: 'Slug atau nama sudah dipakai' }, 409);
      }
    }

    // ── PUT /api/categories/:id ── (admin update)
    const catMatch = path.match(/^\/api\/categories\/(\d+)$/);
    if (catMatch && request.method === 'PUT') {
      if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
      const b = await request.json();
      const name = String(b.name || '').trim();
      if (!name) return json({ error: 'Nama kategori wajib diisi' }, 400);
      const slug = String(b.slug || '').trim() || slugify(name);
      const icon = String(b.icon || '📦').trim();
      const featured = String(b.featured_image || '').trim();
      const desc = String(b.description || '').trim();
      const order = Number(b.sort_order) || 0;
      const active = b.active === false ? 0 : 1;
      try {
        await env.DB.prepare(
          'UPDATE categories SET slug=?, name=?, icon=?, featured_image=?, description=?, sort_order=?, active=? WHERE id=?'
        ).bind(slug, name, icon, featured, desc, order, active, catMatch[1]).run();
        return json({ ok: true, slug });
      } catch (e) {
        return json({ error: 'Slug atau nama sudah dipakai' }, 409);
      }
    }

    // ── DELETE /api/categories/:id ── (admin)
    if (catMatch && request.method === 'DELETE') {
      if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM categories WHERE id=?').bind(catMatch[1]).run();
      return json({ ok: true });
    }

    if (path.startsWith('/api/notifications')) {
      const nr = await notifRoutes(request, env, url, path, json);
      if (nr) return nr;
    }

    return json({ error: 'Not found' }, 404);
  }
};

// ── NOTIFICATIONS: helper + API ──
async function addNotif(env, { user_id = '', role = 'customer', type = '', title = '', message = '', link = '' }) {
  try {
    await env.DB.prepare(
      'INSERT INTO notifications (user_id, role, type, title, message, link) VALUES (?,?,?,?,?,?)'
    ).bind(user_id, role, type, title, message, link).run();
  } catch (e) { console.error('addNotif err', e); }
}

async function notifRoutes(request, env, url, path, json) {
  const isAdm = await isAdmin(request, env);
  const sess = isAdm ? null : await getUserByToken(env, request);
  if (!isAdm && !sess) return json({ error: 'Unauthorized' }, 401);

  // GET /api/notifications — list (admin: role=admin; customer: by user_id)
  if (path === '/api/notifications' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      isAdm
        ? "SELECT * FROM notifications WHERE role='admin' ORDER BY created_at DESC, id DESC LIMIT 50"
        : "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 50"
    ).bind(...(isAdm ? [] : [sess.user_id])).all();
    return json(results);
  }

  // GET /api/notifications/unread-count
  if (path === '/api/notifications/unread-count' && request.method === 'GET') {
    const row = await env.DB.prepare(
      isAdm
        ? "SELECT COUNT(*) AS c FROM notifications WHERE role='admin' AND is_read=0"
        : "SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0"
    ).bind(...(isAdm ? [] : [sess.user_id])).first();
    return json({ count: row?.c || 0 });
  }

  // PUT /api/notifications/read-all
  if (path === '/api/notifications/read-all' && request.method === 'PUT') {
    await env.DB.prepare(
      isAdm
        ? "UPDATE notifications SET is_read=1 WHERE role='admin'"
        : "UPDATE notifications SET is_read=1 WHERE user_id=?"
    ).bind(...(isAdm ? [] : [sess.user_id])).run();
    return json({ ok: true });
  }

  // PUT /api/notifications/:id/read
  const nMatch = path.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (nMatch && request.method === 'PUT') {
    await env.DB.prepare(
      isAdm
        ? "UPDATE notifications SET is_read=1 WHERE id=? AND role='admin'"
        : "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?"
    ).bind(...(isAdm ? [nMatch[1]] : [nMatch[1], sess.user_id])).run();
    return json({ ok: true });
  }

  return null; // bukan route notifikasi → biarkan 404 utama
}

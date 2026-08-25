const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'artikel-' + Date.now();
}

async function ensureProducts(env) {
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').all();
  if (results[0].n > 0) return;
  // Seed from embedded data
  for (const p of PRODUCTS_SEED) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO products (id, name, short_name, desc, category, img_key, img, min_price, max_price, variants, specs, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`
    ).bind(
      p.id, p.name, p.short_name || '', p.desc || '', p.category || '',
      p.img_key || '', p.img || '', p.min_price || 0, p.max_price || 0,
      JSON.stringify(p.variants || []), JSON.stringify(p.specs || {})
    ).run();
  }
}

function nanoid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT token FROM admin_sessions WHERE token=? AND expires_at > datetime('now')"
  ).bind(token).first();
  return !!row;
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

    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    // ── POST /api/admin/login ──
    if (path === '/api/admin/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
      const token = nanoid() + nanoid();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)'
      ).bind(token, expires).run();
      return json({ token });
    }

    // ── POST /api/admin/logout ──
    if (path === '/api/admin/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace('Bearer ', '').trim();
      if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token=?').bind(token).run();
      return json({ ok: true });
    }

    // ── POST /api/users/register ──
    if (path === '/api/users/register' && request.method === 'POST') {
      const { name, email, password } = await request.json();
      if (!name || !email || !password) return json({ error: 'Missing fields' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
      if (existing) return json({ error: 'Email already exists' }, 409);
      const id = 'U-' + nanoid();
      const joinDate = new Date().toLocaleDateString('id-ID');
      await env.DB.prepare(
        'INSERT INTO users (id, name, email, password, join_date) VALUES (?,?,?,?,?)'
      ).bind(id, name, email, password, joinDate).run();
      return json({ id, name, email, joinDate, method: 'email' });
    }

    // ── POST /api/users/login ──
    if (path === '/api/users/login' && request.method === 'POST') {
      const { email, password } = await request.json();
      if (!email || !password) return json({ error: 'Missing fields' }, 400);
      const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      if (!user) return json({ error: 'Email not found' }, 404);
      if (user.password !== password) return json({ error: 'Wrong password' }, 401);
      return json({ id: user.id, name: user.name, email: user.email, joinDate: user.join_date, method: 'email' });
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
        complaint: r.complaint ? JSON.parse(r.complaint) : null
      })));
    }

    // ── POST /api/orders ── (create order)
    if (path === '/api/orders' && request.method === 'POST') {
      const o = await request.json();
      const id = o.id || ('MP-' + nanoid());
      await env.DB.prepare(`
        INSERT INTO orders (id, date, customer_name, customer_phone, customer_address, customer_note,
          items, sub, disc, disc_amt, member_disc, member_amt, voucher_amt, total, payment, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, o.date || new Date().toISOString(),
        o.customer.name, o.customer.phone, o.customer.address, o.customer.note || '',
        JSON.stringify(o.items), o.sub, o.disc || 0, o.discAmt || 0,
        o.memberDisc || 0, o.memberAmt || 0, o.voucherAmt || 0,
        o.total, o.payment, o.status || 'Menunggu Pembayaran'
      ).run();
      return json({ id });
    }

    // ── GET /api/orders/:id ── (public — lacak pesanan)
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderMatch[1]).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json({
        ...row,
        items: JSON.parse(row.items || '[]'),
        complaint: row.complaint ? JSON.parse(row.complaint) : null
      });
    }

    // ── PUT /api/orders/:id ──
    if (orderMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json();
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
      if (body.complaint !== undefined)   { fields.push('complaint=?'); vals.push(JSON.stringify(body.complaint)); }
      if (!fields.length) return json({ error: 'Nothing to update' }, 400);
      vals.push(orderMatch[1]);
      await env.DB.prepare(`UPDATE orders SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
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
      const q = await request.json();
      const id = q.id || ('Q-' + nanoid());
      await env.DB.prepare(`
        INSERT INTO questions (id, product_id, product_name, question, user_name, date)
        VALUES (?,?,?,?,?,?)
      `).bind(id, q.productId, q.productName || '', q.question, q.userName || 'Anonim', new Date().toISOString()).run();
      return json({ id });
    }

    // ── PUT /api/questions/:id ── (admin answer)
    const qMatch = path.match(/^\/api\/questions\/([^/]+)$/);
    if (qMatch && request.method === 'PUT') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { answer } = await request.json();
      await env.DB.prepare('UPDATE questions SET answer=?, answered_at=? WHERE id=?')
        .bind(answer, new Date().toISOString(), qMatch[1]).run();
      return json({ ok: true });
    }

    // ── POST /api/upload/payment ── (upload bukti bayar ke R2)
    if (path === '/api/upload/payment' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const orderId = formData.get('orderId');
      if (!file || !orderId) return json({ error: 'Missing file or orderId' }, 400);
      const ext = (file.name || 'jpg').split('.').pop();
      const key = `payments/${orderId}-${nanoid()}.${ext}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      const publicUrl = `https://pub-62025364d604448fb3fc875c6dcf73b2.r2.dev/${key}`;
      const row = await env.DB.prepare('SELECT complaint FROM orders WHERE id=?').bind(orderId).first();
      const complaint = row?.complaint ? JSON.parse(row.complaint) : {};
      complaint.proofUrl = publicUrl;
      await env.DB.prepare('UPDATE orders SET complaint=? WHERE id=?')
        .bind(JSON.stringify(complaint), orderId).run();
      return json({ url: publicUrl });
    }

    // ── GET /api/products ── (public — seed otomatis jika kosong)
    if (path === '/api/products' && request.method === 'GET') {
      await ensureProducts(env);
      const { results } = await env.DB.prepare(
        'SELECT * FROM products WHERE active=1 ORDER BY category, name'
      ).all();
      return json(results.map(p => ({ ...p, variants: JSON.parse(p.variants || '[]'), specs: JSON.parse(p.specs || '{}') })));
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

    // ── GET /api/customers ── (admin — derive unik dari orders)
    if (path === '/api/customers' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY date DESC').all();
      const map = new Map();
      for (const o of results) {
        const key = (o.customer_phone || o.customer_name || '?').trim();
        if (!map.has(key)) {
          map.set(key, {
            name: o.customer_name || '-', phone: o.customer_phone || '',
            address: o.customer_address || '', orders: 0, total: 0,
            first_order: o.date, last_order: o.date,
          });
        }
        const c = map.get(key);
        c.orders += 1;
        c.total += o.total || 0;
        if (o.date > c.last_order) c.last_order = o.date;
        if (o.date < c.first_order) c.first_order = o.date;
      }
      return json([...map.values()].sort((a, b) => b.total - a.total));
    }

    // ── GET /api/stats ── (admin dashboard)
    if (path === '/api/stats' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { results: orders } = await env.DB.prepare('SELECT * FROM orders').all();
      const { results: prods } = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').all();
      const { results: qs } = await env.DB.prepare('SELECT COUNT(*) AS n FROM questions WHERE answer=\'\' OR answer IS NULL').all();
      const { results: arts } = await env.DB.prepare('SELECT COUNT(*) AS n FROM articles').all();

      const revenue = orders.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = orders.filter(o => (o.date || '').slice(0, 10) === today).length;
      const pending = orders.filter(o => o.status === 'Menunggu Pembayaran').length;
      const cancelled = orders.filter(o => o.status === 'Dibatalkan').length;

      // Last 7 days series
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const list = orders.filter(o => (o.date || '').slice(0, 10) === d);
        days.push({ date: d, orders: list.length, revenue: list.filter(o => o.status !== 'Dibatalkan').reduce((s, o) => s + (o.total || 0), 0) });
      }

      // Top products
      const prodCount = {};
      for (const o of orders) {
        let items = [];
        try { items = JSON.parse(o.items || '[]'); } catch (e) {}
        for (const it of items) {
          const k = it.productName || it.name || 'Produk';
          prodCount[k] = (prodCount[k] || 0) + (it.qty || 1);
        }
      }
      const topProducts = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, qty]) => ({ name, qty }));

      // Status breakdown
      const byStatus = {};
      for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

      return json({ revenue, ordersCount: orders.length, todayCount, pending, cancelled, productCount: prods[0].n, unanswered: qs[0].n, articleCount: arts[0].n, days, topProducts, byStatus });
    }

    return json({ error: 'Not found' }, 404);
  }
};

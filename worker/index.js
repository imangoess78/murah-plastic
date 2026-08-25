const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
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

    return json({ error: 'Not found' }, 404);
  }
};

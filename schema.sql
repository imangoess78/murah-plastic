-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_note TEXT DEFAULT '',
  items TEXT NOT NULL,        -- JSON array
  sub INTEGER NOT NULL,
  disc INTEGER DEFAULT 0,
  disc_amt INTEGER DEFAULT 0,
  member_disc INTEGER DEFAULT 0,
  member_amt INTEGER DEFAULT 0,
  voucher_amt INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  payment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu Pembayaran',
  resi TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  complaint TEXT DEFAULT '',  -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Questions / Tanya Jawab
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  user_name TEXT DEFAULT 'Anonim',
  date TEXT NOT NULL,
  answered_at TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_product ON questions(product_id);
CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(date DESC);

-- Admin sessions (simple token auth, no Firebase)
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Users (member login/register)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  join_date TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- Products (admin CRUD + frontpage source)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT DEFAULT '',
  desc TEXT DEFAULT '',
  category TEXT DEFAULT '',
  img_key TEXT DEFAULT '',
  img TEXT DEFAULT '',
  min_price INTEGER DEFAULT 0,
  max_price INTEGER DEFAULT 0,
  variants TEXT DEFAULT '[]',
  specs TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Articles / Blog
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Blog',
  content TEXT DEFAULT '',
  image TEXT DEFAULT '',
  status TEXT DEFAULT 'Draft',
  views INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);

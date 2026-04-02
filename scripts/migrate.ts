import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "lux-quotes.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const ddl = `
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT DEFAULT 'Leyard V-Team',
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pixel_pitch REAL,
  cabinet_size TEXT,
  brightness INTEGER,
  refresh_rate INTEGER,
  led_type TEXT,
  ip_rating TEXT,
  controller_model TEXT,
  installation_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  fx_rate REAL NOT NULL DEFAULT 0.625,
  default_margin REAL NOT NULL DEFAULT 0.50,
  gst_rate REAL NOT NULL DEFAULT 0.10,
  deposit_pct REAL NOT NULL DEFAULT 0.50,
  second_tranche_pct REAL NOT NULL DEFAULT 0.25,
  screen_size TEXT,
  panel_config TEXT,
  total_resolution TEXT,
  supplier_quote_date TEXT,
  supplier_quote_ref TEXT,
  cached_total_usd REAL DEFAULT 0,
  cached_total_aud_cost REAL DEFAULT 0,
  cached_total_aud_sell_ex_gst REAL DEFAULT 0,
  cached_total_aud_sell_inc_gst REAL DEFAULT 0,
  cached_total_gross_profit REAL DEFAULT 0,
  notes TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  item_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'PCS',
  qty REAL NOT NULL DEFAULT 1,
  usd_unit_price REAL DEFAULT 0,
  margin_override REAL,
  is_local INTEGER NOT NULL DEFAULT 0,
  aud_local_cost REAL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  product_variant_id INTEGER REFERENCES product_variants(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

sqlite.exec(ddl);

// Migrations - add columns if they don't exist
const migrations = [
  `ALTER TABLE quotes ADD COLUMN default_reseller_margin REAL NOT NULL DEFAULT 0.30`,
  `ALTER TABLE quote_line_items ADD COLUMN reseller_margin_override REAL`,
  `ALTER TABLE quotes ADD COLUMN product_id INTEGER REFERENCES products(id)`,
  `ALTER TABLE quotes ADD COLUMN product_variant_id INTEGER REFERENCES product_variants(id)`,
];

for (const migration of migrations) {
  try {
    sqlite.exec(migration);
    console.log("Migration applied:", migration.slice(0, 60) + "...");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column")) {
      // Column already exists, skip
    } else {
      throw e;
    }
  }
}

console.log("Database created at:", dbPath);
console.log("Tables created successfully.");
sqlite.close();

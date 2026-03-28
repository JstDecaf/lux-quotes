import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "lux-quotes.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// Clear existing data
db.exec(`
  DELETE FROM quote_history;
  DELETE FROM quote_line_items;
  DELETE FROM quotes;
  DELETE FROM product_variants;
  DELETE FROM products;
  DELETE FROM projects;
  DELETE FROM clients;
`);

// === CLIENTS ===
const insertClient = db.prepare(`
  INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const nbcsId = insertClient.run("NBCS", "Northern Beaches Christian School", null, null, "Frenchs Forest, Sydney NSW", "Projects: NBCS-AMP-01 (amplification area), NBCS-SIG-01 (signage area). sCube, VFO products purchased.").lastInsertRowid;
const c3Id = insertClient.run("C3 Centrewest", "C3 Church Sydney — Centrewest", null, null, "Silverwater, NSW", "Shopping centre / venue. CDI and LN rental screen quotes.").lastInsertRowid;
const mpacId = insertClient.run("MPAC", null, null, null, null, "MPAC STEM Building project. CDI-F, MG-2, and VFO screen quotes.").lastInsertRowid;

console.log(`Clients: NBCS(${nbcsId}), C3(${c3Id}), MPAC(${mpacId})`);

// === PRODUCTS ===
const insertProduct = db.prepare(`
  INSERT INTO products (name, brand, category) VALUES (?, ?, ?)
`);

const mg2Id = insertProduct.run("MG-2 Series", "Leyard", "Fine Pitch").lastInsertRowid;
const vhdId = insertProduct.run("VHD-VHC Series", "Leyard", "Indoor Fixed").lastInsertRowid;
const vfoId = insertProduct.run("VFO Series", "Leyard", "Indoor Fixed").lastInsertRowid;
const lnId = insertProduct.run("LN Series", "Leyard", "Indoor Rental").lastInsertRowid;
const cddId = insertProduct.run("CDD Series", "Leyard", "Indoor Fixed").lastInsertRowid;
const ecoDotId = insertProduct.run("EcoDot4", "Leyard", "Outdoor").lastInsertRowid;
const iskyId = insertProduct.run("Isky Pro", "Leyard", "Transparent LED").lastInsertRowid;
const sCubeId = insertProduct.run("sCube", "Leyard", "Indoor Fixed").lastInsertRowid;
const tfreeId = insertProduct.run("Tfree-Pro-S", "Leyard", "Transparent LED").lastInsertRowid;
const thId = insertProduct.run("TH Series", "Leyard", "Indoor Fixed").lastInsertRowid;
const vtfId = insertProduct.run("VTF", "Leyard", "Flexible LED").lastInsertRowid;
const mokId = insertProduct.run("MOK Series", "Leyard", "Outdoor").lastInsertRowid;
const vxProId = insertProduct.run("VX Pro - VX2000", "NovaStar", "Controller").lastInsertRowid;

console.log(`Products: ${13} created`);

// === PRODUCT VARIANTS (MG-2 Series) ===
const insertVariant = db.prepare(`
  INSERT INTO product_variants (product_id, pixel_pitch, cabinet_size, brightness, refresh_rate, led_type, ip_rating, installation_type, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertVariant.run(mg2Id, 1.5625, "600 x 337.5 x 45mm", 800, 3840, "SMD1010", "IP30", "Front install & front maintenance", "Standard - $1,245/sqm USD");
insertVariant.run(mg2Id, 1.5625, "600 x 337.5 x 45mm", 800, 3840, "GOB SMD1010", "IP30", "Front install & front maintenance", "GOB version - $1,400/sqm USD");
insertVariant.run(mg2Id, 2.5, "600 x 337.5 x 45mm", 800, 3840, "SMD1010", "IP30", "Front install & front maintenance", "Standard - $880/sqm USD");
insertVariant.run(mg2Id, 2.5, "600 x 337.5 x 45mm", 800, 3840, "GOB SMD1010", "IP30", "Front install & front maintenance", "GOB version - $1,140/sqm USD");

console.log("Product variants: 4 MG-2 variants created");

// === PROJECTS ===
const insertProject = db.prepare(`
  INSERT INTO projects (client_id, name, description, status) VALUES (?, ?, ?, ?)
`);

const mpcProjectId = insertProject.run(nbcsId, "MPC Side Screens", "2x LED screens for NBCS Hall. Leyard MG2 series, 2.4m x 1.35m each (6.48 sqm total). Front install, wall mounted.", "active").lastInsertRowid;

console.log(`Projects: MPC Side Screens(${mpcProjectId})`);

// === QUOTES ===
const insertQuote = db.prepare(`
  INSERT INTO quotes (project_id, quote_number, name, status, fx_rate, default_margin, gst_rate,
    screen_size, panel_config, total_resolution, supplier_quote_date, supplier_quote_ref, notes,
    cached_total_usd, cached_total_aud_cost, cached_total_aud_sell_ex_gst, cached_total_aud_sell_inc_gst, cached_total_gross_profit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const p15QuoteId = insertQuote.run(
  mpcProjectId, "NBCS-MPC-P15", "MG2 P1.5 Option", "draft", 0.625, 0.50, 0.10,
  "2x 2.4m W x 1.35m H (6.48 sqm total)", "4W x 4H = 16 cabinets per screen",
  "1536 x 864 per screen", "2026-03-26", "Leyard-Vteam MG2 P1.5",
  "MG2 P1.5 option. Higher resolution (1536x864 per screen). VX600 Pro controller. EXW Shenzhen.",
  11913.60, 19061.76, 38123.52, 41935.87, 19061.76
).lastInsertRowid;

const p25QuoteId = insertQuote.run(
  mpcProjectId, "NBCS-MPC-P25", "MG2 P2.5 Option", "draft", 0.625, 0.50, 0.10,
  "2x 2.4m W x 1.35m H (6.48 sqm total)", "4W x 4H = 16 cabinets per screen",
  "960 x 540 per screen", "2026-03-26", "Leyard-Vteam MG2 P2.5",
  "MG2 P2.5 option. Lower cost, lower resolution (960x540 per screen). VX400 Pro controller. EXW Shenzhen.",
  8532.40, 13651.84, 27303.68, 30034.05, 13651.84
).lastInsertRowid;

console.log(`Quotes: P1.5(${p15QuoteId}), P2.5(${p25QuoteId})`);

// === LINE ITEMS ===
const insertItem = db.prepare(`
  INSERT INTO quote_line_items (quote_id, sort_order, item_name, description, unit, qty, usd_unit_price, margin_override, is_local, aud_local_cost, is_free)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// P1.5 Quote line items
insertItem.run(p15QuoteId, 1, "MG2 P1.5 LED Panel", "P1.5625mm. 600-800 nits, copper wire LED. Front install & front maintenance.", "SQM", 6.48, 1245, null, 0, 0, 0);
insertItem.run(p15QuoteId, 2, "Wall Mounting Bracket", "For wall mounting installation, including black surround bits.", "SET", 2, 540, null, 0, 0, 0);
insertItem.run(p15QuoteId, 3, "Control System (VX600 Pro)", "Nova VX600 Pro all-in-one video processor. Max 3.9M pixels, 6 ethernet outputs.", "PCS", 1, 1200, null, 0, 0, 0);
insertItem.run(p15QuoteId, 4, "Spare Module", "300x337.5mm. 10% spare parts.", "PCS", 13, 102, null, 0, 0, 0);
insertItem.run(p15QuoteId, 5, "Spare Receiving Card + HUB", "5% spare parts.", "PCS", 2, 30, null, 0, 0, 0);
insertItem.run(p15QuoteId, 6, "Spare Power Supply", "Spare power supply units.", "PCS", 2, 40, null, 0, 0, 0);
insertItem.run(p15QuoteId, 7, "Wooden Case", "Special wooden case for shipping.", "PCS", 2, 50, null, 0, 0, 0);
insertItem.run(p15QuoteId, 8, "Freight", "International & domestic freight. TBC.", "JOB", 1, 0, null, 1, 0, 0);
insertItem.run(p15QuoteId, 9, "Local Frame Build", "Local fabrication / install frame. TBC.", "JOB", 1, 0, null, 1, 0, 0);

// P2.5 Quote line items
insertItem.run(p25QuoteId, 1, "MG2 P2.5 LED Panel", "P2.5mm. 600-800 nits, copper wire LED. Front install & front maintenance.", "SQM", 6.48, 830, null, 0, 0, 0);
insertItem.run(p25QuoteId, 2, "Wall Mounting Bracket", "For wall mounting installation, including black surround bits.", "SET", 2, 540, null, 0, 0, 0);
insertItem.run(p25QuoteId, 3, "Control System (VX400 Pro)", "Nova VX400 Pro all-in-one video processor.", "PCS", 1, 950, null, 0, 0, 0);
insertItem.run(p25QuoteId, 4, "Spare Module", "300x337.5mm. 10% spare parts.", "PCS", 13, 68, null, 0, 0, 0);
insertItem.run(p25QuoteId, 5, "Spare Receiving Card + HUB", "5% spare parts.", "PCS", 2, 30, null, 0, 0, 0);
insertItem.run(p25QuoteId, 6, "Spare Power Supply", "Spare power supply units.", "PCS", 2, 40, null, 0, 0, 0);
insertItem.run(p25QuoteId, 7, "Wooden Case", "Special wooden case for shipping.", "PCS", 2, 50, null, 0, 0, 0);
insertItem.run(p25QuoteId, 8, "Freight", "International & domestic freight. TBC.", "JOB", 1, 0, null, 1, 0, 0);
insertItem.run(p25QuoteId, 9, "Local Frame Build", "Local fabrication / install frame. TBC.", "JOB", 1, 0, null, 1, 0, 0);

console.log("Line items: 9 per quote (18 total)");

db.close();
console.log("\nSeed complete!");

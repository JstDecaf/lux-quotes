import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "lux-quotes.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`DELETE FROM quote_history; DELETE FROM quote_line_items; DELETE FROM quotes; DELETE FROM product_variants; DELETE FROM products; DELETE FROM projects; DELETE FROM clients;`);

const ins = {
  client: db.prepare(`INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes) VALUES (?, ?, ?, ?, ?, ?)`),
  product: db.prepare(`INSERT INTO products (name, brand, category) VALUES (?, ?, ?)`),
  variant: db.prepare(`INSERT INTO product_variants (product_id, pixel_pitch, cabinet_size, brightness, refresh_rate, led_type, ip_rating, installation_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  project: db.prepare(`INSERT INTO projects (client_id, name, description, status) VALUES (?, ?, ?, ?)`),
  quote: db.prepare(`INSERT INTO quotes (project_id, quote_number, name, status, fx_rate, default_margin, gst_rate, deposit_pct, second_tranche_pct, screen_size, panel_config, total_resolution, supplier_quote_date, notes, cached_total_usd, cached_total_aud_cost, cached_total_aud_sell_ex_gst, cached_total_aud_sell_inc_gst, cached_total_gross_profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  item: db.prepare(`INSERT INTO quote_line_items (quote_id, sort_order, item_name, description, unit, qty, usd_unit_price, margin_override, is_local, aud_local_cost, is_free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
};

// ===================== CLIENTS =====================
const nbcs = ins.client.run("NBCS", "Northern Beaches Christian School", null, null, "Frenchs Forest, Sydney NSW", "Education. Projects: NBCS-AMP-01, NBCS-SIG-01, MPC Side Screens.").lastInsertRowid as number;
const c3 = ins.client.run("C3 Centrewest", "C3 Church Sydney — Centrewest", null, null, "Silverwater, NSW", "Church. CDI and LN rental screen quotes.").lastInsertRowid as number;
const mpac = ins.client.run("MPAC", null, null, null, null, "MPAC STEM Building project. CDI-F, MG-2, VFO quotes.").lastInsertRowid as number;
const inspire = ins.client.run("Inspire Church", null, null, null, null, "Church. MG2 P2.5 quote for 2x screens.").lastInsertRowid as number;
const rhac = ins.client.run("RHAC", null, null, null, null, "RHAC Hall project. VMF floor, CDI wall, MG2 GOB quotes.").lastInsertRowid as number;
const stlukes = ins.client.run("St Lukes", null, null, null, null, "St Lukes Hall. Multiple MG P1.5 GOB quotes over time.").lastInsertRowid as number;
console.log("Clients: 6");

// ===================== PRODUCTS =====================
const mg2 = ins.product.run("MG-2 Series", "Leyard", "Fine Pitch").lastInsertRowid as number;
const vhd = ins.product.run("VHD-VHC Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const vfo = ins.product.run("VFO Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const ln = ins.product.run("LN Series", "Leyard", "Indoor Rental").lastInsertRowid as number;
const cdi = ins.product.run("CDI Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const cdd = ins.product.run("CDD Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const eco = ins.product.run("EcoDot4", "Leyard", "Outdoor").lastInsertRowid as number;
const isky = ins.product.run("Isky Pro", "Leyard", "Transparent LED").lastInsertRowid as number;
const scube = ins.product.run("sCube", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const tfree = ins.product.run("Tfree-Pro-S", "Leyard", "Transparent LED").lastInsertRowid as number;
const th = ins.product.run("TH Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const vtf = ins.product.run("VTF", "Leyard", "Flexible LED").lastInsertRowid as number;
const mok = ins.product.run("MOK Series", "Leyard", "Outdoor").lastInsertRowid as number;
const vmf = ins.product.run("VMF Series", "Leyard", "Indoor Fixed").lastInsertRowid as number;
const vxpro = ins.product.run("VX Pro - VX2000", "NovaStar", "Controller").lastInsertRowid as number;
console.log("Products: 15");

// MG-2 Variants
ins.variant.run(mg2, 1.5625, "600x337.5x45mm", 800, 3840, "SMD1010", "IP30", "Front install", "Standard $1,245/sqm");
ins.variant.run(mg2, 1.5625, "600x337.5x45mm", 800, 3840, "GOB SMD1010", "IP30", "Front install", "GOB $1,400/sqm");
ins.variant.run(mg2, 2.5, "600x337.5x45mm", 800, 3840, "SMD1010", "IP30", "Front install", "Standard $880/sqm");
ins.variant.run(mg2, 2.5, "600x337.5x45mm", 800, 3840, "GOB SMD1010", "IP30", "Front install", "GOB $1,140/sqm");
// CDI Variants
ins.variant.run(cdi, 1.9, "500x500x39.5mm", 800, 3840, "SMD", "IP30", "Front/back install", "Die-cast aluminium, magnet front access");
ins.variant.run(cdi, 2.6, "500x500x39.5mm", 800, 3840, "GOB", "IP30", "Front/back install", "With GOB");
// VMF Variant
ins.variant.run(vmf, 2.5, "500x500mm", 1000, 3840, "Copper wire", "IP30", "Floor", "LED floor screen, non-interactive");
console.log("Variants: 7");

// ===================== PROJECTS =====================
const pMpc = ins.project.run(nbcs, "MPC Side Screens", "2x LED screens for NBCS Hall. MG2 series.", "active").lastInsertRowid as number;
const pNbcsAmp = ins.project.run(nbcs, "NBCS-AMP-01", "Amplification area screens.", "active").lastInsertRowid as number;
const pNbcsSig = ins.project.run(nbcs, "NBCS-SIG-01", "Signage area screens.", "active").lastInsertRowid as number;
const pC3Proj1 = ins.project.run(c3, "C3 Project 1", "VHC32 P2.5, P4, MG P1.5/P2.5 quotes.", "active").lastInsertRowid as number;
const pC3Silver = ins.project.run(c3, "C3 Silverwater", "CDI P1.9 and P2.6 wall screens. 5m x 3m = 15 sqm.", "active").lastInsertRowid as number;
const pInspire = ins.project.run(inspire, "Inspire Church Screens", "2x screens, 3.0m x 1.6875m each. MG2 P2.5.", "active").lastInsertRowid as number;
const pRhac = ins.project.run(rhac, "RHAC Hall", "VMF floor + CDI/MG2 wall screens. 5m x 3m = 15 sqm (x2).", "active").lastInsertRowid as number;
const pStLukes = ins.project.run(stlukes, "St Lukes Hall", "MG P1.5 GOB hall screen. Multiple quote revisions.", "active").lastInsertRowid as number;
console.log("Projects: 8");

// ===================== QUOTES =====================
// Helper to add standard items
function addItems(qid: number, items: [string, string, string, number, number, number | null, boolean, number, boolean][]) {
  items.forEach(([name, desc, unit, qty, usdPrice, margin, isLocal, audLocal, isFree], i) => {
    ins.item.run(qid, i + 1, name, desc, unit, qty, usdPrice, margin, isLocal ? 1 : 0, audLocal, isFree ? 1 : 0);
  });
}

// --- NBCS MPC P1.5 ---
const q1 = ins.quote.run(pMpc, "NBCS-MPC-P15", "MG2 P1.5 Option", "draft", 0.625, 0.5, 0.1, 0.5, 0.25,
  "2x 2.4m W x 1.35m H (6.48 sqm total)", "4Wx4H = 16 cabinets/screen", "1536x864/screen", "2026-03-26",
  "MG2 P1.5. VX600 Pro controller. EXW Shenzhen.", 11913.6, 19061.76, 38123.52, 41935.87, 19061.76).lastInsertRowid as number;
addItems(q1, [
  ["MG2 P1.5 LED Panel", "P1.5625mm. 600-800 nits, copper wire LED. Front install.", "SQM", 6.48, 1245, null, false, 0, false],
  ["Wall Mounting Bracket", "For wall mounting, incl. black surround bits.", "SET", 2, 540, null, false, 0, false],
  ["Control System (VX600 Pro)", "Nova VX600 Pro. Max 3.9M pixels, 6 ethernet outputs.", "PCS", 1, 1200, null, false, 0, false],
  ["Spare Module", "300x337.5mm. 10% spare parts.", "PCS", 13, 102, null, false, 0, false],
  ["Spare Receiving Card + HUB", "5% spare parts.", "PCS", 2, 30, null, false, 0, false],
  ["Spare Power Supply", "Spare power supply units.", "PCS", 2, 40, null, false, 0, false],
  ["Wooden Case", "Special wooden case for shipping.", "PCS", 2, 50, null, false, 0, false],
  ["Freight", "International & domestic freight. TBC.", "JOB", 1, 0, null, true, 0, false],
  ["Local Frame Build", "Local fabrication / install frame. TBC.", "JOB", 1, 0, null, true, 0, false],
]);

// --- NBCS MPC P2.5 ---
const q2 = ins.quote.run(pMpc, "NBCS-MPC-P25", "MG2 P2.5 Option", "draft", 0.625, 0.5, 0.1, 0.5, 0.25,
  "2x 2.4m W x 1.35m H (6.48 sqm total)", "4Wx4H = 16 cabinets/screen", "960x540/screen", "2026-03-26",
  "MG2 P2.5. VX400 Pro controller. EXW Shenzhen.", 8532.4, 13651.84, 27303.68, 30034.05, 13651.84).lastInsertRowid as number;
addItems(q2, [
  ["MG2 P2.5 LED Panel", "P2.5mm. 600-800 nits, copper wire LED. Front install.", "SQM", 6.48, 830, null, false, 0, false],
  ["Wall Mounting Bracket", "For wall mounting, incl. black surround bits.", "SET", 2, 540, null, false, 0, false],
  ["Control System (VX400 Pro)", "Nova VX400 Pro all-in-one video processor.", "PCS", 1, 950, null, false, 0, false],
  ["Spare Module", "300x337.5mm. 10% spare parts.", "PCS", 13, 68, null, false, 0, false],
  ["Spare Receiving Card + HUB", "5% spare parts.", "PCS", 2, 30, null, false, 0, false],
  ["Spare Power Supply", "Spare power supply units.", "PCS", 2, 40, null, false, 0, false],
  ["Wooden Case", "Special wooden case for shipping.", "PCS", 2, 50, null, false, 0, false],
  ["Freight", "International & domestic freight. TBC.", "JOB", 1, 0, null, true, 0, false],
  ["Local Frame Build", "Local fabrication / install frame. TBC.", "JOB", 1, 0, null, true, 0, false],
]);

// --- Inspire Church MG2 P2.5 ---
const q3 = ins.quote.run(pInspire, "LUX-2026-0003", "MG2 P2.5 — Inspire Church", "draft", 0.65, 0.3, 0.1, 0.5, 0.4,
  "3.0m W x 1.6875m H = 5.0625 sqm (x2 = 10.125 sqm)", "5Wx5H = 25 panels/screen (600x337.5mm)", "1200x675/screen", "2026-03-19",
  "MG2 P2.5. FX 0.65, Margin 30%. VX600 Pro.", 11675, 17961.54, 25659.34, 28225.27, 7697.80).lastInsertRowid as number;
addItems(q3, [
  ["MG2 P2.5 LED Display Panel", "600-800 nits, copper wire LED. Front install & front maintenance.", "SQM", 10.125, 840, null, false, 0, false],
  ["Wall Mounting Bracket", "For wall mounting installation.", "SET", 2, 500, null, false, 0, false],
  ["Control System (2 screens)", "Nova VX600 Pro. Max 3.9M pixels, 6 ethernet outputs.", "PCS", 1, 1150, null, false, 0, false],
  ["Spare Module", "300x337.5mm, 10% spare parts.", "PCS", 10, 68, null, false, 0, false],
  ["Spare Receiving Card + HUB", "5% spare parts.", "PCS", 2, 30, null, false, 0, false],
  ["Spare Power Supply", "Spare parts.", "PCS", 2, 40, null, false, 0, false],
  ["Wooden Case", "Special wooden case for shipping.", "PCS", 4, 50, null, false, 0, false],
  ["Freight", "International & domestic freight.", "JOB", 1, 0, null, true, 2000, false],
  ["Local Frame Build", "Local fabrication / installation frame.", "JOB", 1, 0, null, true, 500, false],
]);

// --- RHAC VMF P2.5 Floor ---
const q4 = ins.quote.run(pRhac, "LUX-2026-0004", "VMF P2.5 LED Floor — RHAC", "draft", 0.625, 0.5, 0.1, 0.5, 0.25,
  "5.0m W x 3.0m H = 15 sqm (x2 = 30 sqm)", "10Wx6H = 60 panels/screen (500x500mm)", "2000x1200/screen", "2026-03-19",
  "VMF P2.5 floor. FX 0.625, Margin 50%.", 51257, 82011.2, 164022.4, 180424.64, 82011.2).lastInsertRowid as number;
addItems(q4, [
  ["VMF P2.5mm LED Floor Panel", "Indoor, 800-1000 nits, 3840Hz, non-interactive, copper wire. Die cast aluminium 500x500mm.", "SQM", 30, 1470, null, false, 0, false],
  ["Control System", "Nova VX1000 Pro.", "PCS", 1, 1500, null, false, 0, false],
  ["Hanging Bar", "1m long, for hanging installation.", "PCS", 10, 90, null, false, 0, false],
  ["Front Maintenance Tool", "For front maintenance.", "PCS", 1, 285, null, false, 0, false],
  ["Spare Module", "250x250mm, 10% spare parts.", "PCS", 48, 74, null, false, 0, false],
  ["Spare Power Supply", "400W, 5% spare parts.", "PCS", 6, 40, null, false, 0, false],
  ["Spare Receiving Card", "5% spare parts.", "PCS", 6, 30, null, false, 0, false],
  ["Wooden Case", "12-in-1 wooden case for shipping.", "PCS", 10, 50, null, false, 0, false],
  ["Freight", "International & domestic freight.", "JOB", 1, 0, null, true, 0, false],
  ["Local Frame Build", "Local fabrication / installation frame.", "JOB", 1, 0, null, true, 0, false],
]);

// --- RHAC CDI P2.6 GOB ---
const q5 = ins.quote.run(pRhac, "LUX-2026-0005", "CDI P2.6 GOB — RHAC", "draft", 0.625, 0.5, 0.1, 0.5, 0.25,
  "5.0m W x 3.0m H = 15 sqm (x2 = 30 sqm)", "10Wx6H = 60 panels/screen (500x500mm)", "1920x1152/screen", "2026-03-19",
  "CDI P2.6 with GOB. FX 0.625, Margin 50%.", 36208, 57932.8, 115865.6, 127452.16, 57932.8).lastInsertRowid as number;
addItems(q5, [
  ["CDI Indoor P2.6 LED Panel", "Die-cast aluminium, magnet front access, 800 nits, 3840Hz, with GOB. 500x500x39.5mm.", "SQM", 30, 1020, null, false, 0, false],
  ["Controller", "Nova VX1000 Pro.", "PCS", 1, 1500, null, false, 0, false],
  ["Hanging Bar", "1m long, for hanging installation.", "PCS", 10, 90, null, false, 0, false],
  ["Spare Module", "250x250mm, 10% spare parts.", "PCS", 48, 51, null, false, 0, false],
  ["Spare Power Supply", "5% spare parts.", "PCS", 6, 40, null, false, 0, false],
  ["Spare Receiving Card", "Nova A5S Plus, 5% spare parts.", "PCS", 6, 20, null, false, 0, false],
  ["Wooden Case", "Wooden case for shipping.", "PCS", 8, 50, null, false, 0, false],
  ["Freight", "International & domestic freight.", "JOB", 1, 0, null, true, 0, false],
  ["Local Frame Build", "Local fabrication / installation frame.", "JOB", 1, 0, null, true, 0, false],
]);

// --- RHAC MG2 P2.5 GOB ---
const q6 = ins.quote.run(pRhac, "LUX-2026-0006", "MG2 P2.5 GOB — RHAC", "draft", 0.65, 0.3, 0.1, 0.5, 0.25,
  "4.8m W x 2.7m H = 12.96 sqm (x2 = 25.92 sqm)", "8Wx8H = 64 panels/screen (600x337.5mm)", "1920x1080/screen", "2026-03-20",
  "MG2 P2.5 GOB. FX 0.65, Margin 30%.", 31631.2, 48663.38, 69519.12, 76471.03, 20855.74).lastInsertRowid as number;
addItems(q6, [
  ["MG2 P2.5mm LED Panel", "600-800 nits, with GOB, copper wire. 600x337.5x45mm. Front install.", "SQM", 25.92, 960, null, false, 0, false],
  ["Wall Mounting Bracket", "For wall mounting installation.", "SET", 2, 1200, null, false, 0, false],
  ["Control System", "Nova VX1000 Pro. Max 6.5M pixels, 10 ethernet outputs.", "PCS", 1, 1500, null, false, 0, false],
  ["Spare Module", "300x337.5mm, 10% spare parts.", "PCS", 26, 78, null, false, 0, false],
  ["Spare Receiving Card + HUB", "5% spare parts.", "PCS", 6, 30, null, false, 0, false],
  ["Spare Power Supply", "5% spare parts.", "PCS", 6, 40, null, false, 0, false],
  ["Wooden Case", "Wooden case for shipping.", "PCS", 8, 50, null, false, 0, false],
  ["Freight", "International & domestic freight.", "JOB", 1, 0, null, true, 0, false],
  ["Local Frame Build", "Local fabrication / installation frame.", "JOB", 1, 0, null, true, 0, false],
]);

// --- C3 Silverwater CDI P1.9 ---
const q7 = ins.quote.run(pC3Silver, "LUX-2026-0007", "CDI P1.9 — C3 Silverwater", "draft", 0.625, 0.3, 0.1, 0.5, 0.25,
  "5.0m W x 3.0m H = 15 sqm", "10Wx6H = 60 panels (500x500mm)", "2560x1536 = 3.9M dots", "2026-02-06",
  "CDI P1.9 for C3 Church Silverwater. FX 0.625, Margin 30%.", 19492, 38187.2, 51553.14, 56708.46, 13365.94).lastInsertRowid as number;
addItems(q7, [
  ["CDI Indoor P1.9 LED Display Panel", "Die-cast aluminium, magnet front access, 800 nits, 3840Hz. 500x500x39.5mm.", "SQM", 15, 1020, null, false, 0, false],
  ["Controller", "Nova VX1000 Pro.", "PCS", 1, 1400, null, false, 0, false],
  ["Wall Mounting Bracket", "Wall mounting bracket (per sqm).", "SQM", 15, 120, null, false, 0, false],
  ["Spare Module", "250x250mm, 5% spare.", "PCS", 12, 51, null, false, 0, false],
  ["Spare Power Supply", "Recommended spare stock.", "PCS", 3, 40, null, false, 0, false],
  ["Spare Receiving Card", "Nova A5S Plus.", "PCS", 3, 20, null, false, 0, false],
  ["Wooden Case", "Export packaging.", "PCS", 4, 50, null, false, 0, false],
  ["Spare Parts (Free)", "LEDs, ICs, power supply, receiving card, cables.", "LOT", 1, 0, null, false, 0, true],
  ["Freight", "International & domestic freight.", "JOB", 1, 0, null, true, 5000, false],
  ["Local Frame Build", "Local fabrication / installation frame.", "JOB", 1, 0, null, true, 2000, false],
]);

console.log("Quotes: 7 with full line items");

db.close();
console.log("\nFull seed complete!");

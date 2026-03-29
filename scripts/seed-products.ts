import Database from "better-sqlite3";

const db = new Database("data/lux-quotes.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Drop and recreate products/variants tables with new schema
db.exec(`DROP TABLE IF EXISTS product_variants`);
db.exec(`DROP TABLE IF EXISTS products`);

db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT DEFAULT 'Leyard',
    sub_brand TEXT DEFAULT 'Standard',
    category TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    description TEXT,
    applications TEXT,
    image_url TEXT,
    drive_folder TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pixel_pitch TEXT,
    price_per_sqm_usd REAL,
    cabinet_size TEXT,
    cabinet_resolution TEXT,
    pixel_config TEXT,
    brightness TEXT,
    contrast_ratio TEXT,
    refresh_rate TEXT,
    viewing_angle TEXT,
    weight TEXT,
    power_avg TEXT,
    power_max TEXT,
    ip_rating TEXT,
    operating_temp TEXT,
    gob INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertProduct = db.prepare(`
  INSERT INTO products (name, brand, sub_brand, category, status, description, applications)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertVariant = db.prepare(`
  INSERT INTO product_variants (product_id, name, pixel_pitch, price_per_sqm_usd, cabinet_size, cabinet_resolution, pixel_config, brightness, contrast_ratio, refresh_rate, viewing_angle, weight, power_avg, power_max, ip_rating, operating_temp, gob)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// === 1. MG-2 Series ===
const mg2 = insertProduct.run("MG-2 Series", "Leyard", "Standard", "Fine Pitch", "Active",
  "Fine pitch indoor LED for high-res close-viewing. Ideal for control rooms, boardrooms, broadcast studios.",
  JSON.stringify(["Control Room", "Broadcast", "Corporate", "Retail"])
).lastInsertRowid;

insertVariant.run(mg2, "MG-2 P1.5", "P1.5", 1245, "600 x 337.5 x 45mm", "480 x 270", "SMD-TOP", "600-800 nits", "5000:1", "3840 Hz", "160/140", "4.5 kg/cab (22.2 kg/m²)", "158 W/m²", "515 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(mg2, "MG-2 P1.5 GOB", "P1.5", 1400, "600 x 337.5 x 45mm", "480 x 270", "GOB SMD-TOP", "600-800 nits", "5000:1", "3840 Hz", "160/140", "4.5 kg/cab (22.2 kg/m²)", "158 W/m²", "515 W/m²", null, "-20 to 40°C", 1);
insertVariant.run(mg2, "MG-2 P2.5", "P2.5", 880, "600 x 337.5 x 45mm", "240 x 135", "SMD-TOP", "600-800 nits", "5000:1", "3840 Hz", "160/140", "4.5 kg/cab (22.2 kg/m²)", "77 W/m²", "397 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(mg2, "MG-2 P2.5 GOB", "P2.5", 1140, "600 x 337.5 x 45mm", "240 x 135", "GOB SMD-TOP", "600-800 nits", "5000:1", "3840 Hz", "160/140", "4.5 kg/cab (22.2 kg/m²)", "77 W/m²", "397 W/m²", null, "-20 to 40°C", 1);

// === 2. CDI Series ===
const cdi = insertProduct.run("CDI Series", "Leyard", "Standard", "Indoor Fixed", "Active",
  "Commercial Design Indoor LED for retail and corporate environments. Well-documented with brochures.",
  JSON.stringify(["Retail", "Corporate", "Hospitality", "Events & Staging"])
).lastInsertRowid;

insertVariant.run(cdi, "CDI P2.6", "P2.6", 830, "500 x 500 x 39.5mm", "192 x 192", "SMD", "1000 nits", "4000:1", "7680 Hz", "160/140", "20 kg/m²", "187 W/m²", "560 W/m²", "IP30", "-20 to 40°C", 0);
insertVariant.run(cdi, "CDI P3.9", "P3.9", 760, "500 x 500 x 39.5mm", "128 x 128", "SMD", "1000 nits", "4000:1", "7680 Hz", "160/140", "20 kg/m²", "187 W/m²", "560 W/m²", "IP30", "-20 to 40°C", 0);

// === 3. VHD-VHC Series ===
const vhd = insertProduct.run("VHD-VHC Series", "Leyard", "Standard", "Flexible LED", "Active",
  "Flexible LED modules for curved and creative shapes. Ideal for pillars, arches, and complex surfaces.",
  JSON.stringify(["Architecture", "Events & Staging", "Entertainment", "Retail"])
).lastInsertRowid;

insertVariant.run(vhd, "VHD P1.25", "P1.25", 1420, "640 x 480 x 72mm", "512 x 384", null, "600 nits", "5000:1", "3840 Hz", "160/140", "30 kg/m²", "255 W/m²", "580 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(vhd, "VHD P1.59", "P1.59", 1000, "640 x 480 x 72mm", "402 x 302", null, "600 nits", "5000:1", "3840 Hz", "160/140", "30 kg/m²", "225 W/m²", "530 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(vhd, "VHD P1.88", "P1.88", 790, "640 x 480 x 72mm", "340 x 256", null, "600 nits", "5000:1", "3840 Hz", "160/140", "30 kg/m²", "205 W/m²", "510 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(vhd, "VHC27 P2.5", "P2.5", 980, "600 x 337.5 x 72mm", "240 x 135", null, "600 nits", "5000:1", "3840 Hz", "160/140", "28 kg/m²", "180 W/m²", "460 W/m²", null, "-20 to 40°C", 0);
insertVariant.run(vhd, "VHD32F P2.5", "P2.5", 650, "640 x 480 x 72mm", "256 x 192", null, "600 nits", "5000:1", "3840 Hz", "160/140", "30 kg/m²", "180 W/m²", "460 W/m²", null, "-20 to 40°C", 0);

// === 4. VFO Series ===
const vfo = insertProduct.run("VFO Series", "Leyard", "Standard", "Outdoor", "Limited Docs",
  "Outdoor LED display series for corporate, retail, and event installations.",
  JSON.stringify(["Corporate", "Retail", "Events & Staging"])
).lastInsertRowid;

insertVariant.run(vfo, "VFO P1.25 GOB", "P1.25", 5350, null, null, null, null, null, null, null, null, null, null, null, null, 1);
insertVariant.run(vfo, "VFO P2.6", "P2.6", 1980, null, null, null, null, null, null, null, null, null, null, null, null, 0);
insertVariant.run(vfo, "VFO P2.6 GOB", "P2.6", 2180, null, null, null, null, null, null, null, null, null, null, null, null, 1);
insertVariant.run(vfo, "VFO P3.9 GOB", "P3.9", 1580, null, null, null, null, null, null, null, null, null, null, null, null, 1);

// === 5. LN Series ===
const ln = insertProduct.run("LN Series", "Leyard", "Standard", "Indoor Rental", "Limited Docs",
  "Indoor rental LED panels for events and staging.",
  JSON.stringify(["Events & Staging", "Entertainment"])
).lastInsertRowid;

insertVariant.run(ln, "LN P2.6", "P2.6", 990, null, null, null, null, null, null, null, null, null, null, null, null, 0);
insertVariant.run(ln, "LN P3.9", "P3.9", 880, null, null, null, null, null, null, null, null, null, null, null, null, 0);

// === 6. VMF Interactive Floor ===
const vmf = insertProduct.run("VMF Interactive Floor", "Leyard", "Vteam", "Interactive", "Active",
  "Interactive LED floor with real-time motion sensing for immersive experiences.",
  JSON.stringify(["Retail", "Entertainment", "Museums & Exhibitions", "Events & Staging"])
).lastInsertRowid;

insertVariant.run(vmf, "VMF P1.5", "P1.5", 3000, "500 x 500 x 92mm", "256 x 256", null, "800 nits", null, "1920/3840 Hz", "120/120", null, null, null, "IP54/IP43", "0 to 40°C", 0);
insertVariant.run(vmf, "VMF P1.9", "P1.9", 2300, "500 x 500 x 92mm", "192 x 192", null, "1000 nits", null, "1920/3840 Hz", "120/120", null, null, null, "IP65/IP54", "0 to 40°C", 0);
insertVariant.run(vmf, "VMF P2.5", "P2.5", 1460, "500 x 500 x 92mm", "168 x 168", null, "1000 nits", null, "1920/3840 Hz", "120/120", null, null, null, "IP65/IP54", "0 to 40°C", 0);
insertVariant.run(vmf, "VMF P3.9", "P3.9", null, "500 x 500 x 92mm", "128 x 128", null, "1000 nits", null, "1920/3840 Hz", "120/120", null, null, null, "IP65/IP54", "0 to 40°C", 0);

// === 7. CDD Series ===
const cdd = insertProduct.run("CDD Series", "Leyard", "Standard", "Indoor Fixed", "Limited Docs",
  "Compact indoor LED display for fixed installations.",
  JSON.stringify(["Corporate", "Retail"])
).lastInsertRowid;

for (const [name, pitch] of [["CDD P1.2","P1.2"],["CDD P1.5","P1.5"],["CDD P1.9","P1.9"],["CDD P2.5","P2.5"],["CDD P2.6","P2.6"],["CDD P2.9","P2.9"],["CDD P3.9","P3.9"]]) {
  insertVariant.run(cdd, name, pitch, null, "500 x 500 x 45mm", null, null, "600-800 nits", "4000:1", null, null, null, null, null, "IP30", null, 0);
}

// === 8. Isky Pro ===
const isky = insertProduct.run("Isky Pro", "Leyard", "Vteam", "Transparent LED", "Active",
  "Transparent LED curtain for large-scale architectural and stage installations. Pro-N (standard net) and Pro-T (PC tube protected) sub-lines.",
  JSON.stringify(["Architecture", "Events & Staging", "Entertainment"])
).lastInsertRowid;

for (const [name, pitch, ip] of [
  ["Pro-N P3.9","P3.9","IP30"],["Pro-N P3.96","P3.96","IP30"],["Pro-N P7.8","P7.8","IP30"],["Pro-N P10.4","P10.4","IP30"],["Pro-N P12.5","P12.5","IP30"],["Pro-N P15.6","P15.6","IP30"],["Pro-N P20.8","P20.8","IP30"],
  ["Pro-T P10.4","P10.4","IP43"],["Pro-T P15.6","P15.6","IP43"],["Pro-T P20.8","P20.8","IP43"],
]) {
  insertVariant.run(isky, name, pitch, null, "1000 x 1000 x 38mm", null, null, "3000-5500 nits", null, "1920-3840 Hz", "140/140", "10-13 kg/m²", null, null, ip as string, null, 0);
}

// === 9. TH Series ===
const th = insertProduct.run("TH Series", "Leyard", "Vteam", "Transparent LED", "Active",
  "Hologram transparent LED screen producing floating image effects. Ultra-thin 1.8mm panels.",
  JSON.stringify(["Retail", "Architecture", "Museums & Exhibitions"])
).lastInsertRowid;

for (const [name, pitch] of [["TH3","P3"],["TH3-B","P3"],["TH6.2","P6.2"],["TH8","P8"],["TH10","P10"]]) {
  insertVariant.run(th, name, pitch, null, "250 x 1000 x 1.8mm", null, null, "1000-5000 nits", null, "7680 Hz", null, "4.8-5.2 kg/m²", null, null, "IP40", null, 0);
}

// === 10. Tfree-Pro-S ===
const tfree = insertProduct.run("Tfree-Pro-S", "Leyard", "Vteam", "Transparent LED", "Active",
  "Transparent LED for retail windows, glass facades, and architectural glazing. Front-emitting (F) and side-emitting (S) sub-lines.",
  JSON.stringify(["Retail", "Architecture"])
).lastInsertRowid;

for (const [name, pitch] of [["Tfree-F P3.9","P3.9"],["Tfree-F P7.8","P7.8"],["Tfree-S P3.9","P3.9"],["Tfree-S P7.8","P7.8"],["Tfree-S P10.4","P10.4"],["Tfree-S P15.6","P15.6"],["Tfree-F P10.4","P10.4"]]) {
  insertVariant.run(tfree, name, pitch, null, "1000 x 500 x 37mm", null, null, "800-5000 nits", null, "3840 Hz", null, null, null, null, "IP30", null, 0);
}

// === 11. MOK Series ===
const mok = insertProduct.run("MOK Series", "Leyard", "Standard", "Outdoor", "Active",
  "MicroLED cloud-based outdoor kiosk display for smart city and retail applications.",
  JSON.stringify(["Outdoor Advertising", "Retail", "Corporate"])
).lastInsertRowid;

for (const [name, pitch] of [["MOK P1.2","P1.2"],["MOK P1.5","P1.5"],["MOK P1.8","P1.8"]]) {
  insertVariant.run(mok, name, pitch, null, "967 x 1627 x 90mm", null, null, "3000-3500 nits", "10000:1", null, null, null, null, null, "IP65", "-20 to 50°C", 1);
}

// === 12. sCube ===
const scube = insertProduct.run("sCube", "Leyard", "Standard", "Indoor Fixed", "Limited Docs",
  "Compact modular indoor/outdoor LED with high brightness.",
  JSON.stringify(["Events & Staging", "Retail", "Architecture"])
).lastInsertRowid;

insertVariant.run(scube, "sCube P2.6", "P2.6", null, "500 x 250 x 72mm", null, null, "4000+ nits", null, null, null, null, null, null, "IP65", null, 0);
insertVariant.run(scube, "sCube P3.9 GOB", "P3.9", 2000, "500 x 250 x 72mm", null, null, "5000+ nits", null, null, null, null, null, null, "IP65", null, 1);

// === 13. EcoDot4 ===
const eco = insertProduct.run("EcoDot4", "Leyard", "Standard", "Outdoor", "Limited Docs",
  "Large-format outdoor LED for advertising and signage.",
  JSON.stringify(["Outdoor Advertising"])
).lastInsertRowid;

insertVariant.run(eco, "EcoDot4 P35", "P35", 522, null, null, null, null, null, null, null, null, null, null, null, null, 0);

// === 14. VTF ===
const vtf = insertProduct.run("VTF", "Leyard", "Vteam", "Transparent LED", "Active",
  "Transparent LED display film for creative and architectural applications.",
  JSON.stringify(["Architecture", "Retail"])
).lastInsertRowid;

// === 15. VX Pro - VX2000 ===
const vx = insertProduct.run("VX Pro - VX2000", "NovaStar", "Standard", "Controller", "Active",
  "All-in-one LED display controller with integrated video processing. Simplifies cabling for mid-to-large-scale installations.",
  JSON.stringify(["Corporate", "Events & Staging", "Broadcast"])
).lastInsertRowid;

console.log("✅ Seeded 15 product families with all variants");
db.close();

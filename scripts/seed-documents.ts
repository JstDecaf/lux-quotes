import Database from "better-sqlite3";

const db = new Database("data/lux-quotes.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`DROP TABLE IF EXISTS product_documents`);
db.exec(`
  CREATE TABLE product_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'link',
    url TEXT NOT NULL,
    file_type TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insert = db.prepare(`
  INSERT INTO product_documents (product_id, name, type, url, file_type, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Get product IDs by name
const getProduct = db.prepare(`SELECT id FROM products WHERE name = ?`);
const pid = (name: string) => (getProduct.get(name) as any)?.id;

// === MG-2 Series ===
const mg2 = pid("MG-2 Series");
if (mg2) {
  insert.run(mg2, "MG-2 Product Page", "link", "https://www.leyardhk.com/product/mg-2-series/", "web", "Official Leyard product page");
  insert.run(mg2, "MG-2 Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/MG-2 Series/", "pdf", "Product brochure on NAS");
}

// === CDI Series ===
const cdi = pid("CDI Series");
if (cdi) {
  insert.run(cdi, "CDI Product Page", "link", "https://www.leyardhk.com/product/cdi-series/", "web", "Official Leyard product page");
  insert.run(cdi, "CDI Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/CDI Series/", "pdf", "Product brochure and manuals on NAS — well documented");
  insert.run(cdi, "CDI Spec Sheet (NAS)", "spec_sheet", "file:///Volumes/BUSINESS/LUX/Products/CDI Series/", "pdf", "Detailed specification sheets");
}

// === VHD-VHC Series ===
const vhd = pid("VHD-VHC Series");
if (vhd) {
  insert.run(vhd, "VHD Product Page", "link", "https://www.leyardhk.com/product/vhd-vhc-series/", "web", "Official Leyard product page");
  insert.run(vhd, "VHD-VHC Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/VHD-VHC Series/", "pdf", "Product brochure on NAS");
}

// === VFO Series ===
const vfo = pid("VFO Series");
if (vfo) {
  insert.run(vfo, "VFO Product Page", "link", "https://www.leyardhk.com/product/vfo-series/", "web", "Official Leyard product page");
  insert.run(vfo, "VFO Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/VFO Series/", "pdf", "Product brochure on NAS");
}

// === LN Series ===
const ln = pid("LN Series");
if (ln) {
  insert.run(ln, "LN Product Page", "link", "https://www.leyardhk.com/product/ln-series/", "web", "Official Leyard product page");
}

// === VMF Interactive Floor ===
const vmf = pid("VMF Interactive Floor");
if (vmf) {
  insert.run(vmf, "VMF Product Page", "link", "https://www.leyard-vteam.com/product/vmf-interactive-floor/", "web", "Official Vteam product page");
  insert.run(vmf, "VMF Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/VMF Interactive Floor/", "pdf", "Product brochure on NAS");
}

// === CDD Series ===
const cdd = pid("CDD Series");
if (cdd) {
  insert.run(cdd, "CDD Product Page", "link", "https://www.leyardhk.com/product/cdd-series/", "web", "Official Leyard product page");
}

// === Isky Pro ===
const isky = pid("Isky Pro");
if (isky) {
  insert.run(isky, "Isky Pro Product Page", "link", "https://www.leyard-vteam.com/product/isky-pro/", "web", "Official Vteam product page");
  insert.run(isky, "Isky Pro Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/Isky Pro/", "pdf", "Product brochure on NAS");
}

// === TH Series ===
const th = pid("TH Series");
if (th) {
  insert.run(th, "TH Series Product Page", "link", "https://www.leyard-vteam.com/product/th-series/", "web", "Official Vteam product page");
  insert.run(th, "TH Series Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/TH Series/", "pdf", "Product brochure on NAS");
}

// === Tfree-Pro-S ===
const tfree = pid("Tfree-Pro-S");
if (tfree) {
  insert.run(tfree, "Tfree Product Page", "link", "https://www.leyard-vteam.com/product/tfree-pro-s/", "web", "Official Vteam product page");
  insert.run(tfree, "Tfree Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/Tfree-Pro-S/", "pdf", "Product brochure on NAS");
}

// === MOK Series ===
const mok = pid("MOK Series");
if (mok) {
  insert.run(mok, "MOK Product Page", "link", "https://www.leyardhk.com/product/mok-series/", "web", "Official Leyard product page");
  insert.run(mok, "MOK Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/MOK Series/", "pdf", "Product brochure on NAS");
}

// === sCube ===
const scube = pid("sCube");
if (scube) {
  insert.run(scube, "sCube Product Page", "link", "https://www.leyardhk.com/product/scube/", "web", "Official Leyard product page");
}

// === EcoDot4 ===
const eco = pid("EcoDot4");
if (eco) {
  insert.run(eco, "EcoDot4 Product Page", "link", "https://www.leyardhk.com/product/ecodot4/", "web", "Official Leyard product page");
}

// === VTF ===
const vtf = pid("VTF");
if (vtf) {
  insert.run(vtf, "VTF Product Page", "link", "https://www.leyard-vteam.com/product/vtf/", "web", "Official Vteam product page");
  insert.run(vtf, "VTF Brochure (NAS)", "brochure", "file:///Volumes/BUSINESS/LUX/Products/VTF/", "pdf", "Spec PDF on NAS (image-based)");
}

// === VX Pro ===
const vx = pid("VX Pro - VX2000");
if (vx) {
  insert.run(vx, "NovaStar Product Page", "link", "https://www.novastar.tech/products/controller/vx-pro/", "web", "Official NovaStar product page");
}

console.log("✅ Seeded product documents and links");
db.close();

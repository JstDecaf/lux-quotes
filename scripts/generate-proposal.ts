#!/usr/bin/env npx tsx
/**
 * Generate a branded Client Proposal (PPTX) for a LUX quote.
 * Usage: npx tsx scripts/generate-proposal.ts <quote_id> [db_path] [output_path]
 */

import Database from "better-sqlite3";
import PptxGenJS from "pptxgenjs";
import path from "path";
import fs from "fs";

// Brand constants
const NAVY = "0D1B2A";
const RED = "DB412B";
const BODY_TEXT = "2D3748";
const SUBTLE = "4A5568";
const LIGHT_GRAY = "F7FAFC";
const WHITE = "FFFFFF";

// Read logo as base64
const logoPath = path.join(process.cwd(), "public", "lux-logo.svg");
let logoBase64: string | null = null;
if (fs.existsSync(logoPath)) {
  const svgContent = fs.readFileSync(logoPath);
  logoBase64 = `data:image/svg+xml;base64,${svgContent.toString("base64")}`;
}

// Calculation logic (mirrors calculations.ts exactly)
interface CalcSettings {
  fxRate: number;
  defaultMargin: number;
  defaultResellerMargin: number;
  gstRate: number;
  depositPct: number;
  secondTranchePct: number;
}

interface ItemRow {
  id: number;
  item_name: string;
  description: string | null;
  unit: string;
  qty: number;
  usd_unit_price: number | null;
  margin_override: number | null;
  reseller_margin_override: number | null;
  is_local: number;
  aud_local_cost: number | null;
  is_free: number;
  product_variant_id: number | null;
  sort_order: number;
}

function calcItem(item: ItemRow, s: CalcSettings) {
  if (item.is_free) {
    return {
      usdSub: 0, audCost: 0, luxExGst: 0, luxGst: 0, luxIncGst: 0, profit: 0,
      resExGst: 0, resGst: 0, resIncGst: 0, resProfit: 0,
    };
  }
  const margin = item.margin_override ?? s.defaultMargin;
  const resellerMargin = item.reseller_margin_override ?? s.defaultResellerMargin;
  const isLocal = !!item.is_local;
  const usdSub = isLocal ? 0 : item.qty * (item.usd_unit_price || 0);
  const audCost = isLocal ? (item.aud_local_cost || 0) : (s.fxRate > 0 ? usdSub / s.fxRate : 0);

  const luxExGst = margin < 1 ? audCost / (1 - margin) : audCost;
  const luxGst = luxExGst * s.gstRate;
  const luxIncGst = luxExGst + luxGst;
  const profit = luxExGst - audCost;

  const resExGst = resellerMargin < 1 ? luxExGst / (1 - resellerMargin) : luxExGst;
  const resGst = resExGst * s.gstRate;
  const resIncGst = resExGst + resGst;
  const resProfit = resExGst - luxExGst;

  return { usdSub, audCost, luxExGst, luxGst, luxIncGst, profit, resExGst, resGst, resIncGst, resProfit };
}

function fmtCur(v: number): string {
  return "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Add shared footer to every slide (except slide 1)
function addFooter(slide: PptxGenJS.Slide) {
  slide.addShape("rect", {
    x: 0, y: 7.0, w: 13.33, h: 0.5,
    fill: { color: NAVY },
  });
  slide.addText("LUX LED Solutions | Confidential", {
    x: 0.3, y: 7.05, w: 12.73, h: 0.4,
    fontSize: 8, fontFace: "Inter", color: WHITE,
    valign: "middle",
  });
}

// Add small logo to top-left corner
function addLogo(slide: PptxGenJS.Slide) {
  if (logoBase64) {
    slide.addImage({
      data: logoBase64,
      x: 0.3, y: 0.2, w: 1.6, h: 0.5,
    });
  } else {
    slide.addText("LUX LED Solutions", {
      x: 0.3, y: 0.2, w: 2.0, h: 0.5,
      fontSize: 11, fontFace: "Archivo", bold: true, color: RED,
    });
  }
}

async function main() {
  const quoteId = parseInt(process.argv[2]);
  const dbPath = process.argv[3] || path.join(process.cwd(), "data", "lux-quotes.db");
  let outputPath = process.argv[4] || null;

  if (isNaN(quoteId)) {
    console.error("Usage: npx tsx generate-proposal.ts <quote_id> [db_path] [output_path]");
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  // Fetch quote
  const quote = db.prepare(`
    SELECT q.*, p.name as project_name, c.name as client_name, c.contact_name, c.contact_email
    FROM quotes q
    LEFT JOIN projects p ON q.project_id = p.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE q.id = ?
  `).get(quoteId) as Record<string, unknown> | undefined;

  if (!quote) {
    console.error(`Quote ${quoteId} not found`);
    process.exit(1);
  }

  // Fetch line items
  const items = db.prepare(`
    SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY sort_order
  `).all(quoteId) as ItemRow[];

  // Fetch product variant specs for the first item with a variant
  const mainVariantItem = items.find(i => i.product_variant_id);
  let variant: Record<string, unknown> | null = null;
  let product: Record<string, unknown> | null = null;
  if (mainVariantItem) {
    variant = db.prepare(`SELECT * FROM product_variants WHERE id = ?`).get(mainVariantItem.product_variant_id) as Record<string, unknown> | null;
    if (variant) {
      product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(variant.product_id as number) as Record<string, unknown> | null;
    }
  }

  const settings: CalcSettings = {
    fxRate: quote.fx_rate as number,
    defaultMargin: quote.default_margin as number,
    defaultResellerMargin: quote.default_reseller_margin as number,
    gstRate: quote.gst_rate as number,
    depositPct: quote.deposit_pct as number,
    secondTranchePct: quote.second_tranche_pct as number,
  };

  // Calculate all items
  const calculated = items.map(item => calcItem(item, settings));

  // Totals
  const totResExGst = calculated.reduce((s, c) => s + c.resExGst, 0);
  const totResGst = calculated.reduce((s, c) => s + c.resGst, 0);
  const totResIncGst = calculated.reduce((s, c) => s + c.resIncGst, 0);

  // Create presentation
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.author = "LUX LED Solutions";
  pptx.subject = `Proposal for ${quote.client_name || "Client"}`;
  pptx.title = `LED Display Proposal - ${quote.client_name || quote.name}`;

  // ============================================================
  // SLIDE 1: Title
  // ============================================================
  const slide1 = pptx.addSlide();
  slide1.background = { fill: NAVY };

  // Logo
  if (logoBase64) {
    slide1.addImage({
      data: logoBase64,
      x: 0.5, y: 0.5, w: 2.5, h: 0.8,
    });
  } else {
    slide1.addText("LUX LED Solutions", {
      x: 0.5, y: 0.5, w: 3, h: 0.8,
      fontSize: 18, fontFace: "Archivo", bold: true, color: RED,
    });
  }

  slide1.addText("LED Display Proposal", {
    x: 0.5, y: 2.0, w: 10, h: 1.0,
    fontSize: 36, fontFace: "Archivo", bold: true, color: WHITE,
  });

  slide1.addText("Prepared for", {
    x: 0.5, y: 3.1, w: 5, h: 0.5,
    fontSize: 16, fontFace: "Inter", color: SUBTLE,
  });

  slide1.addText((quote.client_name as string) || "Client", {
    x: 0.5, y: 3.6, w: 10, h: 0.8,
    fontSize: 32, fontFace: "Archivo", bold: true, color: RED,
  });

  const productLine = product ? (product.name as string) : (quote.name as string);
  const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  slide1.addText(`${productLine} | ${dateStr}`, {
    x: 0.5, y: 4.5, w: 10, h: 0.4,
    fontSize: 11, fontFace: "Inter", color: SUBTLE,
  });

  slide1.addText("in partnership with Leyard", {
    x: 0.5, y: 6.5, w: 4, h: 0.4,
    fontSize: 10, fontFace: "Inter", color: SUBTLE, italic: true,
  });

  // ============================================================
  // SLIDE 2: About LUX
  // ============================================================
  const slide2 = pptx.addSlide();
  slide2.background = { fill: WHITE };
  addLogo(slide2);

  slide2.addText("About LUX LED Solutions", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  const aboutText = [
    "LUX LED Solutions is a premium LED display integrator, proudly partnered with Leyard — one of the world's largest and most respected LED manufacturers. We deliver cutting-edge visual solutions designed for houses of worship, corporate environments, broadcast studios, and live events.",
    "Our partnership with Leyard gives us direct access to the latest in LED technology, ensuring our clients receive the highest quality products at competitive pricing. From initial consultation and design through to installation, commissioning, and ongoing support, we provide a complete end-to-end service.",
    "Based in Australia, our team of experienced AV professionals is committed to delivering outstanding results with exceptional after-sales support. Every LUX project is backed by comprehensive warranties and dedicated technical assistance, giving you peace of mind long after installation.",
  ];

  let yPos = 1.8;
  for (const para of aboutText) {
    slide2.addText(para, {
      x: 0.5, y: yPos, w: 12.0, h: 1.2,
      fontSize: 11, fontFace: "Inter", color: BODY_TEXT,
      lineSpacingMultiple: 1.4,
      valign: "top",
    });
    yPos += 1.4;
  }

  addFooter(slide2);

  // ============================================================
  // SLIDE 3: Why Choose LUX
  // ============================================================
  const slide3 = pptx.addSlide();
  slide3.background = { fill: WHITE };
  addLogo(slide3);

  slide3.addText("Why Choose LUX LED Solutions", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  const features = [
    {
      title: "Premium Hardware",
      desc: "Leyard LED panels with industry-leading reliability, colour accuracy, and brightness. Built with high-quality components and rigorous quality control for demanding environments.",
    },
    {
      title: "Australian Support",
      desc: "Local sales, engineering, and after-sales support based in Australia. We speak your language, understand your requirements, and respond quickly when you need us.",
    },
    {
      title: "Complete Solution",
      desc: "From screen design and structural engineering to video processing, control systems, installation, and training — we handle every aspect of your LED project.",
    },
    {
      title: "Proven Track Record",
      desc: "Trusted by churches, corporate clients, and event companies across Australia. Our portfolio includes permanent installations and touring solutions delivered on time and on budget.",
    },
  ];

  const gridPositions = [
    { x: 0.5, y: 1.9 },
    { x: 6.7, y: 1.9 },
    { x: 0.5, y: 4.2 },
    { x: 6.7, y: 4.2 },
  ];

  for (let i = 0; i < features.length; i++) {
    const pos = gridPositions[i];
    const feat = features[i];

    slide3.addShape("rect", {
      x: pos.x, y: pos.y, w: 5.8, h: 2.0,
      fill: { color: LIGHT_GRAY },
      rectRadius: 0.1,
    });

    // Red accent line
    slide3.addShape("rect", {
      x: pos.x, y: pos.y, w: 0.06, h: 2.0,
      fill: { color: RED },
    });

    slide3.addText(feat.title, {
      x: pos.x + 0.3, y: pos.y + 0.2, w: 5.2, h: 0.4,
      fontSize: 14, fontFace: "Archivo", bold: true, color: NAVY,
    });

    slide3.addText(feat.desc, {
      x: pos.x + 0.3, y: pos.y + 0.7, w: 5.2, h: 1.1,
      fontSize: 10.5, fontFace: "Inter", color: BODY_TEXT,
      lineSpacingMultiple: 1.3,
      valign: "top",
    });
  }

  addFooter(slide3);

  // ============================================================
  // SLIDE 4: Project Overview
  // ============================================================
  const slide4 = pptx.addSlide();
  slide4.background = { fill: WHITE };
  addLogo(slide4);

  slide4.addText("Project Overview", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  // Calculate stats
  const numScreens = items.filter(i => {
    const name = (i.item_name || "").toLowerCase();
    return name.includes("screen") || name.includes("led") || name.includes("panel") || name.includes("display") || name.includes("wall");
  }).length || 1;

  // Total SQM (sum qty where unit is SQM)
  const totalSqm = items
    .filter(i => i.unit === "SQM" && !i.is_free)
    .reduce((sum, i) => sum + i.qty, 0);

  const screenSize = (quote.screen_size as string) || "Custom";
  const panelConfig = (quote.panel_config as string) || "Custom";
  const totalResolution = (quote.total_resolution as string) || "HD+";

  // Min viewing distance based on pixel pitch
  let minViewing = "2m";
  if (variant && variant.pixel_pitch) {
    const pitch = parseFloat(variant.pixel_pitch as string);
    if (!isNaN(pitch)) {
      minViewing = `${(pitch * 1.5).toFixed(1)}m`;
    }
  }

  const stats = [
    { value: String(numScreens), label: "Screen(s)" },
    { value: totalSqm > 0 ? `${totalSqm.toFixed(1)}` : "N/A", label: "Total SQM" },
    { value: totalResolution, label: "Resolution" },
    { value: minViewing, label: "Min Viewing Distance" },
  ];

  const statPositions = [
    { x: 0.5, y: 1.9 },
    { x: 3.5, y: 1.9 },
    { x: 6.5, y: 1.9 },
    { x: 9.5, y: 1.9 },
  ];

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const pos = statPositions[i];

    slide4.addText(stat.value, {
      x: pos.x, y: pos.y, w: 2.5, h: 0.7,
      fontSize: 28, fontFace: "Archivo", bold: true, color: RED,
    });
    slide4.addText(stat.label, {
      x: pos.x, y: pos.y + 0.7, w: 2.5, h: 0.4,
      fontSize: 11, fontFace: "Inter", color: SUBTLE,
    });
  }

  // Screen details
  slide4.addText([
    { text: "Screen Size: ", options: { fontSize: 11, fontFace: "Inter", color: SUBTLE } },
    { text: screenSize, options: { fontSize: 11, fontFace: "Inter", bold: true, color: BODY_TEXT } },
    { text: "    Cabinet Arrangement: ", options: { fontSize: 11, fontFace: "Inter", color: SUBTLE } },
    { text: panelConfig, options: { fontSize: 11, fontFace: "Inter", bold: true, color: BODY_TEXT } },
  ], {
    x: 0.5, y: 3.3, w: 12.0, h: 0.5,
  });

  // Use case text
  const projectDesc = (quote.notes as string) || `This project involves the supply, installation, and commissioning of a premium LED display solution for ${quote.client_name || "the client"}. The system is designed to deliver exceptional visual quality for the intended application.`;
  slide4.addText(projectDesc, {
    x: 0.5, y: 4.0, w: 12.0, h: 2.5,
    fontSize: 11, fontFace: "Inter", color: BODY_TEXT,
    lineSpacingMultiple: 1.4,
    valign: "top",
  });

  addFooter(slide4);

  // ============================================================
  // SLIDE 5: Quotation
  // ============================================================
  const slide5 = pptx.addSlide();
  slide5.background = { fill: WHITE };
  addLogo(slide5);

  slide5.addText("Quotation", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  // Build table data - reseller prices (end client view)
  const tableHeader = [
    { text: "Qty", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "center" as const, valign: "middle" as const } },
    { text: "Unit", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "center" as const, valign: "middle" as const } },
    { text: "Product", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "left" as const, valign: "middle" as const } },
    { text: "Description", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "left" as const, valign: "middle" as const } },
    { text: "Ex GST", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "right" as const, valign: "middle" as const } },
    { text: "Inc GST", options: { fontSize: 9, fontFace: "Inter", bold: true, color: WHITE, fill: { color: NAVY }, align: "right" as const, valign: "middle" as const } },
  ];

  const tableRows: PptxGenJS.TableRow[] = [tableHeader];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const calc = calculated[i];
    const altFill = i % 2 === 0 ? { fill: { color: "F8FAFC" } } : {};
    const baseOpts = { fontSize: 9, fontFace: "Inter", color: BODY_TEXT, valign: "middle" as const, ...altFill };

    tableRows.push([
      { text: String(item.qty), options: { ...baseOpts, align: "center" as const } },
      { text: item.unit, options: { ...baseOpts, align: "center" as const } },
      { text: item.item_name, options: { ...baseOpts, align: "left" as const, bold: true } },
      { text: item.description || "", options: { ...baseOpts, align: "left" as const } },
      { text: fmtCur(calc.resExGst), options: { ...baseOpts, align: "right" as const } },
      { text: fmtCur(calc.resIncGst), options: { ...baseOpts, align: "right" as const } },
    ]);
  }

  // Totals row
  tableRows.push([
    { text: "", options: { fontSize: 9, fontFace: "Inter", bold: true, color: NAVY, fill: { color: "E2E8F0" } } },
    { text: "", options: { fontSize: 9, fontFace: "Inter", bold: true, color: NAVY, fill: { color: "E2E8F0" } } },
    { text: "", options: { fontSize: 9, fontFace: "Inter", bold: true, color: NAVY, fill: { color: "E2E8F0" } } },
    { text: "TOTALS", options: { fontSize: 10, fontFace: "Archivo", bold: true, color: NAVY, align: "right" as const, fill: { color: "E2E8F0" } } },
    { text: fmtCur(totResExGst), options: { fontSize: 10, fontFace: "Inter", bold: true, color: NAVY, align: "right" as const, fill: { color: "E2E8F0" } } },
    { text: fmtCur(totResIncGst), options: { fontSize: 10, fontFace: "Archivo", bold: true, color: NAVY, align: "right" as const, fill: { color: "E2E8F0" } } },
  ]);

  slide5.addTable(tableRows, {
    x: 0.3, y: 1.7, w: 12.7,
    colW: [0.8, 0.8, 3.0, 4.0, 2.0, 2.1],
    border: { type: "solid", pt: 0.5, color: "E2E8F0" },
    rowH: 0.35,
    autoPage: false,
  });

  // Payment note
  const tableEndY = 1.7 + (tableRows.length * 0.35) + 0.2;
  slide5.addText("50% deposit required | Quote expires in 30 days | All prices in AUD", {
    x: 0.5, y: Math.min(tableEndY, 6.2), w: 12.0, h: 0.4,
    fontSize: 10, fontFace: "Inter", color: RED, italic: true,
  });

  addFooter(slide5);

  // ============================================================
  // SLIDE 6: Technical Specifications
  // ============================================================
  const slide6 = pptx.addSlide();
  slide6.background = { fill: WHITE };
  addLogo(slide6);

  slide6.addText("Technical Specifications", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  // Specs table
  const specs: [string, string][] = variant
    ? [
        ["Pixel Pitch", (variant.pixel_pitch as string) || "N/A"],
        ["LED Type", (variant.pixel_config as string) || "SMD"],
        ["Cabinet Size", (variant.cabinet_size as string) || "N/A"],
        ["Cabinet Resolution", (variant.cabinet_resolution as string) || "N/A"],
        ["Brightness", (variant.brightness as string) || "N/A"],
        ["Viewing Angle", (variant.viewing_angle as string) || "160/160"],
        ["Refresh Rate", (variant.refresh_rate as string) || "3840Hz"],
        ["Contrast Ratio", (variant.contrast_ratio as string) || "5000:1"],
        ["IP Rating", (variant.ip_rating as string) || "IP30"],
        ["Power (Avg)", (variant.power_avg as string) || "N/A"],
        ["Power (Max)", (variant.power_max as string) || "N/A"],
        ["Operating Temp", (variant.operating_temp as string) || "-20~50C"],
        ["Weight", (variant.weight as string) || "N/A"],
        ["GOB Protected", variant.gob ? "Yes" : "No"],
      ]
    : [
        ["Pixel Pitch", "See line items"],
        ["Details", "Contact LUX for full specifications"],
      ];

  const specRows: PptxGenJS.TableRow[] = specs.map(([label, value], i) => {
    const bgFill = i % 2 === 0 ? { fill: { color: LIGHT_GRAY } } : {};
    return [
      { text: label, options: { fontSize: 10, fontFace: "Inter", bold: true, color: NAVY, ...bgFill, valign: "middle" as const } },
      { text: value, options: { fontSize: 10, fontFace: "Inter", color: BODY_TEXT, ...bgFill, valign: "middle" as const } },
    ];
  });

  slide6.addTable(specRows, {
    x: 0.5, y: 1.8, w: 6.0,
    colW: [2.5, 3.5],
    border: { type: "solid", pt: 0.5, color: "E2E8F0" },
    rowH: 0.35,
  });

  // Product image placeholder on the right
  slide6.addShape("rect", {
    x: 7.5, y: 1.8, w: 5.0, h: 4.5,
    fill: { color: LIGHT_GRAY },
    rectRadius: 0.1,
    line: { color: "E2E8F0", width: 1 },
  });

  const productName = product ? (product.name as string) : "LED Display";
  slide6.addText(productName + "\n\n[Product Image]", {
    x: 7.5, y: 1.8, w: 5.0, h: 4.5,
    fontSize: 14, fontFace: "Inter", color: SUBTLE,
    align: "center", valign: "middle",
  });

  addFooter(slide6);

  // ============================================================
  // SLIDE 7: Previous Installations
  // ============================================================
  const slide7 = pptx.addSlide();
  slide7.background = { fill: WHITE };
  addLogo(slide7);

  slide7.addText("Previous Installations", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  // Installation 1 - C3 Church
  slide7.addShape("rect", {
    x: 0.5, y: 1.9, w: 5.8, h: 3.8,
    fill: { color: LIGHT_GRAY },
    rectRadius: 0.1,
    line: { color: "E2E8F0", width: 1 },
  });
  slide7.addText("[Installation Photo]", {
    x: 0.5, y: 1.9, w: 5.8, h: 3.2,
    fontSize: 14, fontFace: "Inter", color: SUBTLE,
    align: "center", valign: "middle",
  });
  slide7.addText("C3 Church — LED Video Wall", {
    x: 0.5, y: 5.1, w: 5.8, h: 0.5,
    fontSize: 12, fontFace: "Archivo", bold: true, color: NAVY,
    align: "center",
  });

  // Installation 2 - NBCS
  slide7.addShape("rect", {
    x: 7.0, y: 1.9, w: 5.8, h: 3.8,
    fill: { color: LIGHT_GRAY },
    rectRadius: 0.1,
    line: { color: "E2E8F0", width: 1 },
  });
  slide7.addText("[Installation Photo]", {
    x: 7.0, y: 1.9, w: 5.8, h: 3.2,
    fontSize: 14, fontFace: "Inter", color: SUBTLE,
    align: "center", valign: "middle",
  });
  slide7.addText("NBCS — Multi-Purpose Centre LED Display", {
    x: 7.0, y: 5.1, w: 5.8, h: 0.5,
    fontSize: 12, fontFace: "Archivo", bold: true, color: NAVY,
    align: "center",
  });

  addFooter(slide7);

  // ============================================================
  // SLIDE 8: Installation & Support
  // ============================================================
  const slide8 = pptx.addSlide();
  slide8.background = { fill: WHITE };
  addLogo(slide8);

  slide8.addText("Installation & Support", {
    x: 0.5, y: 1.0, w: 10, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  const supportFeatures = [
    {
      title: "Professional Installation",
      desc: "Our experienced installation team ensures your LED display is mounted, connected, and calibrated to perfection. We coordinate with your venue and AV teams for a seamless install.",
    },
    {
      title: "Training & Handover",
      desc: "Comprehensive on-site training for your technical team covering system operation, content management, basic troubleshooting, and maintenance procedures.",
    },
    {
      title: "2-Year Warranty",
      desc: "Every LUX installation includes a comprehensive 2-year warranty covering hardware defects, LED modules, power supplies, and receiving cards. Extended warranties available.",
    },
    {
      title: "Ongoing Support",
      desc: "Dedicated Australian-based technical support with remote diagnostics capability. Spare parts kept in stock locally for rapid response when you need it most.",
    },
  ];

  for (let i = 0; i < supportFeatures.length; i++) {
    const pos = gridPositions[i];
    const feat = supportFeatures[i];

    slide8.addShape("rect", {
      x: pos.x, y: pos.y, w: 5.8, h: 2.0,
      fill: { color: LIGHT_GRAY },
      rectRadius: 0.1,
    });

    slide8.addShape("rect", {
      x: pos.x, y: pos.y, w: 0.06, h: 2.0,
      fill: { color: RED },
    });

    slide8.addText(feat.title, {
      x: pos.x + 0.3, y: pos.y + 0.2, w: 5.2, h: 0.4,
      fontSize: 14, fontFace: "Archivo", bold: true, color: NAVY,
    });

    slide8.addText(feat.desc, {
      x: pos.x + 0.3, y: pos.y + 0.7, w: 5.2, h: 1.1,
      fontSize: 10.5, fontFace: "Inter", color: BODY_TEXT,
      lineSpacingMultiple: 1.3,
      valign: "top",
    });
  }

  addFooter(slide8);

  // ============================================================
  // SLIDE 9: What's Included + Next Steps
  // ============================================================
  const slide9 = pptx.addSlide();
  slide9.background = { fill: WHITE };
  addLogo(slide9);

  slide9.addText("What's Included", {
    x: 0.5, y: 1.0, w: 6, h: 0.6,
    fontSize: 28, fontFace: "Archivo", bold: true, color: NAVY,
  });

  // Generate bullet list from line items
  const bulletItems = items.map(item => {
    const desc = item.description ? ` — ${item.description}` : "";
    return `${item.qty} x ${item.item_name}${desc}`;
  });

  // Add standard inclusions
  bulletItems.push("Professional Installation & Commissioning");
  bulletItems.push("System Training & Handover");
  bulletItems.push("2-Year Comprehensive Warranty");
  bulletItems.push("Australian-based Technical Support");

  const bulletText = bulletItems.map(b => ({
    text: b,
    options: { fontSize: 10, fontFace: "Inter", color: BODY_TEXT, bullet: { code: "2022" }, paraSpaceBefore: 4 } as PptxGenJS.TextPropsOptions,
  }));

  slide9.addText(bulletText, {
    x: 0.5, y: 1.7, w: 6.5, h: 5.0,
    valign: "top",
    lineSpacingMultiple: 1.3,
  });

  // Next Steps box
  slide9.addShape("rect", {
    x: 7.5, y: 1.7, w: 5.3, h: 4.5,
    fill: { color: LIGHT_GRAY },
    rectRadius: 0.15,
  });

  slide9.addShape("rect", {
    x: 7.5, y: 1.7, w: 5.3, h: 0.06,
    fill: { color: RED },
  });

  slide9.addText("Next Steps", {
    x: 7.8, y: 1.9, w: 4.7, h: 0.5,
    fontSize: 20, fontFace: "Archivo", bold: true, color: NAVY,
  });

  slide9.addText([
    { text: "Ready to move forward? Contact us to:\n\n", options: { fontSize: 11, fontFace: "Inter", color: BODY_TEXT } },
    { text: "1. ", options: { fontSize: 11, fontFace: "Inter", bold: true, color: RED } },
    { text: "Confirm your order\n", options: { fontSize: 11, fontFace: "Inter", color: BODY_TEXT } },
    { text: "2. ", options: { fontSize: 11, fontFace: "Inter", bold: true, color: RED } },
    { text: "Schedule site survey\n", options: { fontSize: 11, fontFace: "Inter", color: BODY_TEXT } },
    { text: "3. ", options: { fontSize: 11, fontFace: "Inter", bold: true, color: RED } },
    { text: "Arrange deposit payment\n\n", options: { fontSize: 11, fontFace: "Inter", color: BODY_TEXT } },
    { text: "Simon Baldock\n", options: { fontSize: 12, fontFace: "Archivo", bold: true, color: NAVY } },
    { text: "LUX LED Solutions\n", options: { fontSize: 11, fontFace: "Inter", color: BODY_TEXT } },
    { text: "simon@sbaldock.com", options: { fontSize: 11, fontFace: "Inter", color: RED } },
  ], {
    x: 7.8, y: 2.5, w: 4.7, h: 3.5,
    valign: "top",
    lineSpacingMultiple: 1.3,
  });

  addFooter(slide9);

  // ============================================================
  // Write file
  // ============================================================
  if (!outputPath) {
    const quoteNum = quote.quote_number as string;
    outputPath = path.join(process.cwd(), "data", `LUX-Proposal-${quoteNum}.pptx`);
  }

  await pptx.writeFile({ fileName: outputPath });
  console.log(outputPath);

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

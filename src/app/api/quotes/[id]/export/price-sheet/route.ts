/* eslint-disable @typescript-eslint/no-require-imports */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateLineItem, calculateQuoteTotals, calculateInstallationItem, calculateInstallationTotals } from "@/lib/calculations";

// Brand colours
const NAVY = "0D1B2A";
const RED = "DB412B";
const WHITE = "FFFFFFFF";
const LIGHT_GRAY = "FFF5F5F5";
const MID_GRAY = "FFCCCCCC";
const DARK_GRAY = "FF444444";

function aud(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  if (isNaN(quoteId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const quote = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db
    .select({ name: schema.projects.name, clientId: schema.projects.clientId })
    .from(schema.projects).where(eq(schema.projects.id, quote.projectId)).get();

  const client = project
    ? await db.select({ name: schema.clients.name }).from(schema.clients)
        .where(eq(schema.clients.id, project.clientId)).get()
    : null;

  const items = await db
    .select().from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder).all();

  const installItems = await db
    .select().from(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.quoteId, quoteId))
    .orderBy(schema.quoteInstallationItems.sortOrder).all();

  const settings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };

  const installSettings = {
    defaultHourlyRate: quote.installationHourlyRate,
    defaultInstallationMargin: quote.installationMargin,
    gstRate: quote.gstRate,
  };

  const totals = calculateQuoteTotals(items as any[], settings);
  const installTotals = calculateInstallationTotals(
    installItems.map((i: any) => ({ type: i.type, hours: i.hours ?? 0, hourlyRate: i.hourlyRate, fixedCost: i.fixedCost ?? 0, marginOverride: i.marginOverride, isFree: i.isFree })),
    installSettings
  );

  const qb = quote.installationQuotedBy; // "lux" | "reseller" | "both"
  const hasInstall = installItems.length > 0;
  const luxIncludesInstall = hasInstall && (qb === "lux" || qb === "both");
  const resIncludesInstall = hasInstall && (qb === "reseller" || qb === "both");

  // ── Build workbook with ExcelJS ─────────────────────────────────────────────
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "LUX LED Screen Solutions";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reseller Price Sheet", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Columns: Item, Description, Unit, Qty | LUX ex GST, LUX inc GST | Res ex GST, Res inc GST, Res Markup $
  ws.columns = [
    { key: "A", width: 38 },  // Item
    { key: "B", width: 28 },  // Description
    { key: "C", width: 8  },  // Unit
    { key: "D", width: 8  },  // Qty
    { key: "E", width: 20 },  // LUX Ex GST
    { key: "F", width: 20 },  // LUX Inc GST
    { key: "G", width: 20 },  // Reseller Ex GST
    { key: "H", width: 20 },  // Reseller Inc GST
    { key: "I", width: 18 },  // Reseller Markup $
  ];

  // Helper: style a cell
  const style = (
    cell: any,
    opts: {
      bg?: string; fg?: string; bold?: boolean; size?: number;
      align?: "left" | "center" | "right";
      border?: boolean; borderColor?: string;
      numFmt?: string; italic?: boolean; wrap?: boolean;
    }
  ) => {
    if (opts.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg.length === 6 ? "FF" + opts.bg : opts.bg } };
    if (opts.fg) cell.font = { ...cell.font, color: { argb: opts.fg.length === 6 ? "FF" + opts.fg : opts.fg }, bold: opts.bold ?? false, size: opts.size ?? 10, italic: opts.italic ?? false };
    else if (opts.bold !== undefined || opts.size !== undefined || opts.italic !== undefined)
      cell.font = { ...cell.font, bold: opts.bold ?? false, size: opts.size ?? 10, italic: opts.italic ?? false };
    if (opts.align) cell.alignment = { horizontal: opts.align, wrapText: opts.wrap ?? false, vertical: "middle" };
    else if (opts.wrap) cell.alignment = { wrapText: true, vertical: "middle" };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border) {
      const bc = { style: "thin" as const, color: { argb: opts.borderColor ? "FF" + opts.borderColor : MID_GRAY } };
      cell.border = { top: bc, left: bc, bottom: bc, right: bc };
    }
  };

  const merge = (from: string, to: string) => ws.mergeCells(`${from}:${to}`);

  // ── Row 1: Big banner ────────────────────────────────────────────────────────
  ws.addRow(["LUX LED Screen Solutions — Reseller Price Sheet"]);
  merge("A1", "I1");
  const r1 = ws.getRow(1);
  r1.height = 36;
  style(ws.getCell("A1"), { bg: NAVY, fg: WHITE, bold: true, size: 16, align: "left" });
  ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // ── Row 2: blank spacer ──────────────────────────────────────────────────────
  ws.addRow([]);
  ws.getRow(2).height = 6;

  // ── Rows 3–5: Quote metadata ─────────────────────────────────────────────────
  const meta = [
    ["Client", client?.name ?? "—", "", "", "Quote #", quote.quoteNumber],
    ["Project", project?.name ?? "—", "", "", "Date", new Date().toLocaleDateString("en-AU")],
    ["Quote", quote.name, "", "", "Valid Until", quote.validUntil ?? "—"],
  ];
  meta.forEach((rowData, i) => {
    const row = ws.addRow(rowData);
    row.height = 18;
    // Label cells
    [1, 5].forEach((col) => {
      const c = row.getCell(col);
      style(c, { fg: "888888", bold: true, size: 9, align: "left" });
    });
    // Value cells
    [2, 6].forEach((col) => {
      const c = row.getCell(col);
      style(c, { bold: true, size: 10, align: "left", fg: NAVY });
    });
    if (i === 0) {
      merge(`B${2 + i + 1}`, `D${2 + i + 1}`);
      merge(`F${2 + i + 1}`, `I${2 + i + 1}`);
    }
  });

  // ── Row 6: spacer ────────────────────────────────────────────────────────────
  ws.addRow([]);
  ws.getRow(6).height = 6;

  // ── Section headers ──────────────────────────────────────────────────────────
  const secRow = ws.addRow(["", "", "", "", "◀ LUX SELL PRICE", "", "RESELLER SELL PRICE ▶"]);
  secRow.height = 16;
  merge("A7", "F7");
  merge("G7", "I7");
  style(ws.getCell("A7"), { bg: NAVY, fg: "AAAAAA", bold: false, size: 9, align: "right" });
  style(ws.getCell("G7"), { bg: RED, fg: WHITE, bold: true, size: 9, align: "center" });
  ws.getCell("A7").alignment = { horizontal: "right", vertical: "middle" };

  // ── Column headers ────────────────────────────────────────────────────────────
  const hdrRow = ws.addRow([
    "Item", "Description", "Unit", "Qty",
    "ex GST", "inc GST",
    "ex GST", "inc GST", "Markup $",
  ]);
  hdrRow.height = 22;
  hdrRow.eachCell((cell: any) => {
    style(cell, { bg: NAVY, fg: WHITE, bold: true, size: 9, align: "center", border: true, borderColor: "1a2d42" });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // ── Data rows ────────────────────────────────────────────────────────────────
  let dataRowIndex = 9;
  let isEven = false;

  for (const item of items as any[]) {
    const calc = calculateLineItem(item, settings);
    const bg = isEven ? LIGHT_GRAY : WHITE;
    const resellerBg = isEven ? "FFFFF0F0" : "FFFFFFFF";
    isEven = !isEven;

    const row = ws.addRow([
      item.itemName,
      item.description ?? "",
      item.unit,
      item.qty,
      item.isFree ? "INCLUDED" : calc.audSellExGst,
      item.isFree ? "" : calc.audSellIncGst,
      item.isFree ? "" : calc.resellerSellExGst,
      item.isFree ? "" : calc.resellerSellIncGst,
      item.isFree ? "" : calc.resellerProfit,
    ]);

    row.height = 18;
    row.eachCell((cell: any, col: number) => {
      style(cell, { bg, border: true, borderColor: "DDDDDD" });
      cell.font = { size: 9, color: { argb: "FF" + NAVY } };
      if (col >= 5 && typeof cell.value === "number") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"#,##0.00';
      }
      if (col === 1) cell.alignment = { horizontal: "left", wrapText: true, vertical: "middle" };
      if (col === 2) { cell.alignment = { horizontal: "left", wrapText: true, vertical: "middle", indent: 1 }; cell.font = { size: 8, color: { argb: "FF888888" }, italic: true }; }
      if (col === 3) cell.alignment = { horizontal: "center", vertical: "middle" };
      if (col === 4) cell.alignment = { horizontal: "right", vertical: "middle" };
    });

    // Reseller columns: subtle warm tint + red left border
    [7, 8, 9].forEach((col) => {
      const c = row.getCell(col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: resellerBg } };
      c.font = { size: 9, color: { argb: "FF" + NAVY } };
    });
    const sepCell = row.getCell(7);
    sepCell.border = {
      ...sepCell.border,
      left: { style: "medium", color: { argb: "FF" + RED } },
    };

    dataRowIndex++;
  }

  // ── Products subtotal row ─────────────────────────────────────────────────────
  const totRow = ws.addRow([
    "PRODUCTS SUBTOTAL", "", "", "",
    totals.totalAudSellExGst,
    totals.totalAudSellIncGst,
    totals.totalResellerSellExGst,
    totals.totalResellerSellIncGst,
    totals.totalResellerProfit,
  ]);
  totRow.height = 22;
  totRow.eachCell((cell: any, col: number) => {
    style(cell, { bg: NAVY, fg: WHITE, bold: true, size: 10, border: true, borderColor: NAVY });
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    if (col >= 5 && typeof cell.value === "number") {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.numFmt = '"$"#,##0.00';
    }
  });
  merge(`A${dataRowIndex}`, `D${dataRowIndex}`);
  dataRowIndex++;

  // ── Installation & Services section (only if items exist and reseller quotes it) ──
  //
  // Pricing logic depends on who quotes installation:
  //   "reseller" only: LUX is NOT involved. Base cost = hours × rate.
  //                    Res sell = base cost × (1 + reseller markup).
  //                    LUX installation margin is irrelevant.
  //   "both":          LUX charges reseller: LUX sell = base cost × (1 + install markup).
  //                    Res sell = LUX sell × (1 + reseller markup).
  //
  // Column layout:
  //   A: Item | B: Hours | C: Type | D: Rate
  //   E: Subtotal (base cost) — or LUX ex GST when "both"
  //   F: LUX inc GST (only when "both") — or empty
  //   G: Res ex GST | H: Res inc GST | I: Res Markup $

  if (resIncludesInstall) {
    // Spacer
    ws.addRow([]);
    dataRowIndex++;

    // Section header
    ws.addRow(["Installation & Services"]);
    const instHdrRowNum = dataRowIndex;
    ws.getRow(instHdrRowNum).height = 20;
    merge(`A${instHdrRowNum}`, `I${instHdrRowNum}`);
    style(ws.getCell(`A${instHdrRowNum}`), { bg: "7B4F00", fg: WHITE, bold: true, size: 11 });
    dataRowIndex++;

    const resellerMarkup = quote.defaultResellerMargin;

    // Column sub-headers
    const instSubHdr = ws.addRow([
      "Item", "Hours", "Type", "Rate / Cost",
      luxIncludesInstall ? "LUX ex GST" : "Subtotal",
      luxIncludesInstall ? "LUX inc GST" : "",
      "Res ex GST", "Res inc GST", "Res Markup $",
    ]);
    instSubHdr.height = 18;
    instSubHdr.eachCell((cell: any, col: number) => {
      if ([1].includes(col)) {
        style(cell, { bg: "A0651A", fg: WHITE, bold: true, size: 9, align: "left", border: true, borderColor: "8B5A14" });
      }
      if ([2, 3, 4, 5].includes(col)) {
        style(cell, { bg: "A0651A", fg: WHITE, bold: true, size: 9, align: "right", border: true, borderColor: "8B5A14" });
      }
      if (col === 6 && luxIncludesInstall) {
        style(cell, { bg: "A0651A", fg: WHITE, bold: true, size: 9, align: "right", border: true, borderColor: "8B5A14" });
      }
      if ([7, 8, 9].includes(col)) {
        style(cell, { bg: RED, fg: WHITE, bold: true, size: 9, align: "right", border: true, borderColor: RED });
      }
    });
    dataRowIndex++;

    // Accumulators for totals
    let totalBaseCost = 0;
    let totalLuxExGst = 0;
    let totalLuxIncGst = 0;
    let totalResExGst = 0;
    let totalResIncGst = 0;
    let totalResProfit = 0;

    let instIsEven = false;
    for (const item of installItems as any[]) {
      const calc = calculateInstallationItem(
        { type: item.type, hours: item.hours ?? 0, hourlyRate: item.hourlyRate, fixedCost: item.fixedCost ?? 0, marginOverride: item.marginOverride, isFree: item.isFree },
        installSettings
      );
      const bg = instIsEven ? "FFFFF8F0" : WHITE;
      instIsEven = !instIsEven;

      const typeLabel = item.type === "hourly" ? "Hourly" : "Fixed";
      const hours = item.type === "hourly" ? (item.hours ?? 0) : "";
      const rate = item.type === "hourly"
        ? (item.hourlyRate ?? installSettings.defaultHourlyRate)
        : (item.fixedCost ?? 0);
      const baseCost = calc.cost; // hours × rate or fixed cost

      // Reseller pricing depends on whether LUX is also involved
      let resExGst: number;
      let resMarkupBase: number; // what the markup is calculated against
      if (luxIncludesInstall) {
        // "both": reseller marks up LUX's sell price
        resExGst = calc.sellExGst * (1 + resellerMarkup);
        resMarkupBase = calc.sellExGst;
      } else {
        // "reseller" only: reseller marks up the base cost directly
        resExGst = baseCost * (1 + resellerMarkup);
        resMarkupBase = baseCost;
      }
      const resIncGst = resExGst * (1 + quote.gstRate);
      const resProfit = resExGst - resMarkupBase;

      if (!item.isFree) {
        totalBaseCost += baseCost;
        totalLuxExGst += calc.sellExGst;
        totalLuxIncGst += calc.sellIncGst;
        totalResExGst += resExGst;
        totalResIncGst += resIncGst;
        totalResProfit += resProfit;
      }

      const instRow = ws.addRow([
        item.itemName, hours, typeLabel,
        item.isFree ? "INCLUDED" : rate,
        item.isFree ? "" : (luxIncludesInstall ? calc.sellExGst : baseCost),
        item.isFree ? "" : (luxIncludesInstall ? calc.sellIncGst : ""),
        item.isFree ? "" : resExGst,
        item.isFree ? "" : resIncGst,
        item.isFree ? "" : resProfit,
      ]);
      instRow.height = 18;
      instRow.eachCell((cell: any, col: number) => {
        style(cell, { bg, border: true, borderColor: "DDDDDD" });
        cell.font = { size: 9, color: { argb: "FF" + NAVY } };
        if (col === 1) cell.alignment = { horizontal: "left", vertical: "middle" };
        if (col === 2) cell.alignment = { horizontal: "right", vertical: "middle" };
        if (col === 3) cell.alignment = { horizontal: "center", vertical: "middle" };
        if (col >= 4 && typeof cell.value === "number") {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = '"$"#,##0.00';
        }
      });
      // Reseller columns: warm tint + red left border
      const resellerBg = instIsEven ? "FFFFF0F0" : "FFFFFFFF";
      [7, 8, 9].forEach((col) => {
        const c = instRow.getCell(col);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: resellerBg } };
        c.font = { size: 9, color: { argb: "FF" + NAVY } };
      });
      const sepCell = instRow.getCell(7);
      sepCell.border = { ...sepCell.border, left: { style: "medium", color: { argb: "FF" + RED } } };
      dataRowIndex++;
    }

    // Installation subtotal row
    const instTotRow = ws.addRow([
      "INSTALLATION SUBTOTAL", "", "", "",
      luxIncludesInstall ? totalLuxExGst : totalBaseCost,
      luxIncludesInstall ? totalLuxIncGst : "",
      totalResExGst,
      totalResIncGst,
      totalResProfit,
    ]);
    instTotRow.height = 22;
    instTotRow.eachCell((cell: any, col: number) => {
      style(cell, { bg: "7B4F00", fg: WHITE, bold: true, size: 10, border: true, borderColor: "7B4F00" });
      cell.font = { bold: true, size: 10, color: { argb: WHITE } };
      if (col >= 5 && typeof cell.value === "number") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"#,##0.00';
      }
    });
    merge(`A${dataRowIndex}`, `D${dataRowIndex}`);
    dataRowIndex++;

    // Grand total row
    const grandLuxExGst = totals.totalAudSellExGst + (luxIncludesInstall ? totalLuxExGst : 0);
    const grandLuxIncGst = totals.totalAudSellIncGst + (luxIncludesInstall ? totalLuxIncGst : 0);
    const grandResExGst = totals.totalResellerSellExGst + totalResExGst;
    const grandResIncGst = totals.totalResellerSellIncGst + totalResIncGst;
    const grandResProfit = totals.totalResellerProfit + totalResProfit;

    const grandRow = ws.addRow([
      "GRAND TOTAL", "", "", "",
      grandLuxExGst,
      grandLuxIncGst,
      grandResExGst,
      grandResIncGst,
      grandResProfit,
    ]);
    grandRow.height = 24;
    grandRow.eachCell((cell: any, col: number) => {
      style(cell, { bg: RED, fg: WHITE, bold: true, size: 11, border: true, borderColor: RED });
      cell.font = { bold: true, size: 11, color: { argb: WHITE } };
      if (col >= 5 && typeof cell.value === "number") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"#,##0.00';
      }
    });
    merge(`A${dataRowIndex}`, `D${dataRowIndex}`);
    dataRowIndex++;
  }

  // ── Spacer ────────────────────────────────────────────────────────────────────
  ws.addRow([]);
  dataRowIndex++;

  // ── Payment schedule ──────────────────────────────────────────────────────────
  const pmtStart = dataRowIndex + 1;
  const pmtHdr = ws.addRow(["Payment Schedule"]);
  pmtHdr.height = 20;
  merge(`A${pmtStart}`, `D${pmtStart}`);
  style(ws.getCell(`A${pmtStart}`), { bg: RED, fg: WHITE, bold: true, size: 11 });

  // Payment schedule based on LUX sell price (what the reseller pays LUX)
  // Only include installation when LUX charges for it (lux or both), not reseller-only
  const luxIncGst = totals.totalAudSellIncGst + (luxIncludesInstall ? installTotals.totalSellIncGst : 0);
  const pmtRows = [
    ["Deposit", `${(quote.depositPct * 100).toFixed(0)}%`, `$${aud(luxIncGst * quote.depositPct)}`],
    ["Progress Payment", `${(quote.secondTranchePct * 100).toFixed(0)}%`, `$${aud(luxIncGst * quote.secondTranchePct)}`],
    ["Balance on Delivery", `${((1 - quote.depositPct - quote.secondTranchePct) * 100).toFixed(0)}%`, `$${aud(luxIncGst * (1 - quote.depositPct - quote.secondTranchePct))}`],
    ["TOTAL (inc GST)", "", `$${aud(luxIncGst)}`],
  ];

  pmtRows.forEach((pmtData, i) => {
    const r = ws.addRow(pmtData);
    r.height = 18;
    const isTotal = i === pmtRows.length - 1;
    const bg = isTotal ? NAVY : i % 2 === 0 ? LIGHT_GRAY : WHITE;
    const fg = isTotal ? WHITE : NAVY;
    [1, 2, 3].forEach((col) => {
      const c = r.getCell(col);
      style(c, { bg, border: true, borderColor: "DDDDDD" });
      c.font = { bold: isTotal, size: 10, color: { argb: "FF" + fg } };
      if (col === 3) c.alignment = { horizontal: "right", vertical: "middle" };
    });
  });

  // ── Footer ────────────────────────────────────────────────────────────────────
  ws.addRow([]);
  const footerRow = ws.addRow([
    `Generated by LUX LED Screen Solutions · ${new Date().toLocaleDateString("en-AU")} · Confidential — for reseller use only`,
  ]);
  footerRow.height = 14;
  merge(`A${pmtStart + pmtRows.length + 2}`, `I${pmtStart + pmtRows.length + 2}`);
  const fc = footerRow.getCell(1);
  fc.font = { size: 8, italic: true, color: { argb: DARK_GRAY } };

  // ── Freeze panes & return ────────────────────────────────────────────────────
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 8 }];

  const buf = await wb.xlsx.writeBuffer();

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="LUX-PriceSheet-${quote.quoteNumber}.xlsx"`,
    },
  });
}

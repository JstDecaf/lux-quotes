/* eslint-disable @typescript-eslint/no-require-imports */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateLineItem, calculateQuoteTotals } from "@/lib/calculations";

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
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
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

  const settings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };

  const totals = calculateQuoteTotals(items as any[], settings);

  // ── Build workbook with ExcelJS ─────────────────────────────────────────────
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "LUX LED Screen Solutions";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reseller Price Sheet", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // ── Column widths ────────────────────────────────────────────────────────────
  ws.columns = [
    { key: "A", width: 36 },  // Item
    { key: "B", width: 26 },  // Description
    { key: "C", width: 7  },  // Unit
    { key: "D", width: 7  },  // Qty
    { key: "E", width: 14 },  // USD Unit
    { key: "F", width: 14 },  // USD Total
    { key: "G", width: 15 },  // AUD Cost
    { key: "H", width: 18 },  // LUX Ex GST
    { key: "I", width: 18 },  // LUX Inc GST
    { key: "J", width: 15 },  // LUX Margin $
    { key: "K", width: 20 },  // Reseller Ex GST
    { key: "L", width: 20 },  // Reseller Inc GST
    { key: "M", width: 16 },  // Reseller Margin $
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
  merge("A1", "M1");
  const r1 = ws.getRow(1);
  r1.height = 36;
  style(ws.getCell("A1"), { bg: NAVY, fg: WHITE, bold: true, size: 16, align: "left" });
  ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // ── Row 2: blank spacer ──────────────────────────────────────────────────────
  ws.addRow([]);
  ws.getRow(2).height = 6;

  // ── Rows 3–5: Quote metadata ─────────────────────────────────────────────────
  const meta = [
    ["Client", client?.name ?? "—", "", "", "Quote #", quote.quoteNumber, "", "", "FX Rate", `1 USD = ${(1 / quote.fxRate).toFixed(4)} AUD`],
    ["Project", project?.name ?? "—", "", "", "Date", new Date().toLocaleDateString("en-AU"), "", "", "LUX Margin", pct(quote.defaultMargin)],
    ["Quote", quote.name, "", "", "Valid Until", quote.validUntil ?? "—", "", "", "Reseller Margin", pct(quote.defaultResellerMargin)],
  ];
  meta.forEach((rowData, i) => {
    const row = ws.addRow(rowData);
    row.height = 18;
    // Label cells
    [1, 5, 9].forEach((col) => {
      const c = row.getCell(col);
      style(c, { fg: "888888", bold: true, size: 9, align: "left" });
    });
    // Value cells
    [2, 6, 10].forEach((col) => {
      const c = row.getCell(col);
      style(c, { bold: true, size: 10, align: "left", fg: NAVY });
    });
    if (i === 0) {
      // Merge label+value spans
      merge(`B${2 + i + 1}`, `D${2 + i + 1}`);
      merge(`F${2 + i + 1}`, `H${2 + i + 1}`);
      merge(`J${2 + i + 1}`, `M${2 + i + 1}`);
    }
  });

  // ── Row 6: spacer ────────────────────────────────────────────────────────────
  ws.addRow([]);
  ws.getRow(6).height = 6;

  // ── Section headers ──────────────────────────────────────────────────────────
  // LUX section label (cols A-J) and Reseller section label (cols K-M)
  const secRow = ws.addRow(["", "", "", "", "", "", "◀ LUX PRICING", "", "", "", "RESELLER PRICING ▶"]);
  secRow.height = 16;
  merge("A7", "J7");
  merge("K7", "M7");
  style(ws.getCell("A7"), { bg: NAVY, fg: "AAAAAA", bold: false, size: 9, align: "right" });
  style(ws.getCell("K7"), { bg: RED, fg: WHITE, bold: true, size: 9, align: "center" });
  ws.getCell("A7").alignment = { horizontal: "right", vertical: "middle" };

  // ── Column headers ────────────────────────────────────────────────────────────
  const hdrRow = ws.addRow([
    "Item", "Description", "Unit", "Qty",
    "USD Unit", "USD Total",
    "AUD Cost", "Sell ex GST", "Sell inc GST", "LUX Margin $",
    "Sell ex GST", "Sell inc GST", "Margin $",
  ]);
  hdrRow.height = 22;
  hdrRow.eachCell((cell: any) => {
    style(cell, { bg: NAVY, fg: WHITE, bold: true, size: 9, align: "center", border: true, borderColor: "1a2d42" });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // ── Data rows ────────────────────────────────────────────────────────────────
  let dataRowIndex = 9; // rows so far: 1 banner, 1 blank, 3 meta, 1 blank, 1 sec, 1 hdr
  let isEven = false;

  for (const item of items as any[]) {
    const calc = calculateLineItem(item, settings);
    const bg = isEven ? LIGHT_GRAY : WHITE;
    // Reseller tint: slightly warm white on even rows, plain white on odd
    const resellerBg = isEven ? "FFFFF0F0" : "FFFFFFFF";
    isEven = !isEven;

    let usdUnit: string | number = "";
    let usdTotal: string | number = "";
    if (item.isFree) { usdUnit = "INCLUDED"; usdTotal = "—"; }
    else if (item.isLocal) { usdUnit = "LOCAL"; usdTotal = "—"; }
    else { usdUnit = item.usdUnitPrice ?? 0; usdTotal = calc.usdSubtotal; }

    const row = ws.addRow([
      item.itemName,
      item.description ?? "",
      item.unit,
      item.qty,
      usdUnit,
      usdTotal,
      item.isFree ? "" : calc.audCost,
      item.isFree ? "" : calc.audSellExGst,
      item.isFree ? "" : calc.audSellIncGst,
      item.isFree ? "" : calc.grossProfit,
      item.isFree ? "" : calc.resellerSellExGst,
      item.isFree ? "" : calc.resellerSellIncGst,
      item.isFree ? "" : calc.resellerProfit,
    ]);

    row.height = 18;
    row.eachCell((cell: any, col: number) => {
      style(cell, { bg, border: true, borderColor: "DDDDDD" });
      cell.font = { size: 9, color: { argb: "FF" + NAVY } };

      // Right-align numbers
      if (col >= 4) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (col >= 7 && typeof cell.value === "number")
          cell.numFmt = '"$"#,##0.00';
        if ((col === 5 || col === 6) && typeof cell.value === "number")
          cell.numFmt = '"US$"#,##0.00';
      }
      // Item name: wrap, left
      if (col === 1) cell.alignment = { horizontal: "left", wrapText: true, vertical: "middle" };
      if (col === 2) cell.alignment = { horizontal: "left", wrapText: true, vertical: "middle", indent: 1 };
      if (col === 2) cell.font = { size: 8, color: { argb: "FF888888" }, italic: true };
      if (col === 3) cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Reseller columns: subtle warm tint + red left border on col 11
    [11, 12, 13].forEach((col) => {
      const c = row.getCell(col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: resellerBg } };
      c.font = { size: 9, color: { argb: "FF" + NAVY } };
    });
    // Red left border to visually separate reseller section
    const sepCell = row.getCell(11);
    sepCell.border = {
      ...sepCell.border,
      left: { style: "medium", color: { argb: "FF" + RED } },
    };

    dataRowIndex++;
  }

  // ── Totals row ────────────────────────────────────────────────────────────────
  const totRow = ws.addRow([
    "TOTAL", "", "", "",
    "", totals.totalUsd,
    totals.totalAudCost,
    totals.totalAudSellExGst,
    totals.totalAudSellIncGst,
    totals.totalGrossProfit,
    totals.totalResellerSellExGst,
    totals.totalResellerSellIncGst,
    totals.totalResellerProfit,
  ]);
  totRow.height = 22;
  totRow.eachCell((cell: any, col: number) => {
    style(cell, { bg: NAVY, fg: WHITE, bold: true, size: 10, border: true, borderColor: NAVY });
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    if (col >= 4) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      if (col >= 7 && typeof cell.value === "number") cell.numFmt = '"$"#,##0.00';
      if ((col === 5 || col === 6) && typeof cell.value === "number") cell.numFmt = '"US$"#,##0.00';
    }
  });
  merge(`A${dataRowIndex}`, `D${dataRowIndex}`);

  // ── Spacer ────────────────────────────────────────────────────────────────────
  ws.addRow([]);
  dataRowIndex++;

  // ── Payment schedule ──────────────────────────────────────────────────────────
  const pmtStart = dataRowIndex + 1;
  const pmtHdr = ws.addRow(["Payment Schedule"]);
  pmtHdr.height = 20;
  merge(`A${pmtStart}`, `D${pmtStart}`);
  style(ws.getCell(`A${pmtStart}`), { bg: RED, fg: WHITE, bold: true, size: 11 });

  const pmtRows = [
    ["Deposit", pct(quote.depositPct), `$${aud(totals.depositAmount)}`],
    ["Progress Payment", pct(quote.secondTranchePct), `$${aud(totals.secondTrancheAmount)}`],
    ["Balance on Delivery", pct(1 - quote.depositPct - quote.secondTranchePct), `$${aud(totals.balanceAmount)}`],
    ["TOTAL (inc GST)", "", `$${aud(totals.totalAudSellIncGst)}`],
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
  merge(`A${pmtStart + pmtRows.length + 2}`, `M${pmtStart + pmtRows.length + 2}`);
  const fc = footerRow.getCell(1);
  fc.font = { size: 8, italic: true, color: { argb: DARK_GRAY } };

  // ── Freeze panes & return ────────────────────────────────────────────────────
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 8 }]; // freeze header rows

  const buf = await wb.xlsx.writeBuffer();

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="LUX-PriceSheet-${quote.quoteNumber}.xlsx"`,
    },
  });
}

/* eslint-disable @typescript-eslint/no-require-imports */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateLineItem, calculateQuoteTotals } from "@/lib/calculations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  if (isNaN(quoteId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const quote = await db
    .select()
    .from(schema.quotes)
    .where(eq(schema.quotes.id, quoteId))
    .get();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db
    .select({ name: schema.projects.name, clientId: schema.projects.clientId })
    .from(schema.projects)
    .where(eq(schema.projects.id, quote.projectId))
    .get();

  const client = project
    ? await db
        .select({ name: schema.clients.name })
        .from(schema.clients)
        .where(eq(schema.clients.id, project.clientId))
        .get()
    : null;

  const items = await db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  const settings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };

  const totals = calculateQuoteTotals(items as any[], settings);

  // ── Build XLSX with SheetJS ─────────────────────────────────────────────────
  const XLSX = require("xlsx");

  const wb = XLSX.utils.book_new();

  const aud = (n: number) =>
    `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // ── Header rows ─────────────────────────────────────────────────────────────
  const headerRows = [
    ["LUX LED Screen Solutions — Reseller Price Sheet"],
    [],
    ["Client:", client?.name ?? "—", "", "Quote #:", quote.quoteNumber],
    ["Project:", project?.name ?? "—", "", "Date:", new Date().toLocaleDateString("en-AU")],
    ["Quote:", quote.name, "", "Valid Until:", quote.validUntil ?? "—"],
    [],
    ["FX Rate (USD→AUD):", `1 USD = ${(1 / quote.fxRate).toFixed(4)} AUD`],
    ["LUX Margin:", pct(quote.defaultMargin), "", "Reseller Margin:", pct(quote.defaultResellerMargin)],
    ["GST Rate:", pct(quote.gstRate)],
    [],
  ];

  // ── Column headers ───────────────────────────────────────────────────────────
  const colHeaders = [
    "Item",
    "Description",
    "Unit",
    "Qty",
    "USD Unit",
    "USD Total",
    "AUD Cost",
    "LUX Sell (ex GST)",
    "LUX Sell (inc GST)",
    "LUX Margin $",
    "Reseller Sell (ex GST)",
    "Reseller Sell (inc GST)",
    "Reseller Margin $",
  ];

  const dataRows = items.map((item: any) => {
    const calc = calculateLineItem(item, settings);
    if (item.isFree) {
      return [item.itemName, item.description ?? "", item.unit, item.qty, "FREE", "FREE", "", "", "", "", "", "", ""];
    }
    return [
      item.itemName,
      item.description ?? "",
      item.unit,
      item.qty,
      item.isLocal ? "LOCAL" : item.usdUnitPrice,
      item.isLocal ? "" : calc.usdSubtotal,
      calc.audCost,
      calc.audSellExGst,
      calc.audSellIncGst,
      calc.grossProfit,
      calc.resellerSellExGst,
      calc.resellerSellIncGst,
      calc.resellerProfit,
    ];
  });

  // ── Totals row ───────────────────────────────────────────────────────────────
  const totalsRow = [
    "TOTAL", "", "", "",
    "", totals.totalUsd,
    totals.totalAudCost,
    totals.totalAudSellExGst,
    totals.totalAudSellIncGst,
    totals.totalGrossProfit,
    totals.totalResellerSellExGst,
    totals.totalResellerSellIncGst,
    totals.totalResellerProfit,
  ];

  // ── Payment schedule ─────────────────────────────────────────────────────────
  const paymentRows = [
    [],
    ["Payment Schedule (based on Reseller inc GST)"],
    ["Deposit:", pct(quote.depositPct), aud(totals.depositAmount)],
    ["2nd Tranche:", pct(quote.secondTranchePct), aud(totals.secondTrancheAmount)],
    ["Balance:", pct(1 - quote.depositPct - quote.secondTranchePct), aud(totals.balanceAmount)],
    ["Total:", "", aud(totals.totalResellerSellIncGst)],
  ];

  const allRows = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    totalsRow,
    ...paymentRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws["!cols"] = [
    { wch: 38 }, { wch: 28 }, { wch: 6 }, { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Reseller Price Sheet");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  const uint8 = new Uint8Array(buf);

  return new Response(uint8.buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="LUX-PriceSheet-${quote.quoteNumber}.xlsx"`,
    },
  });
}

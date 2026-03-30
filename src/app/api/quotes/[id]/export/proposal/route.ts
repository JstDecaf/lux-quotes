/* eslint-disable @typescript-eslint/no-require-imports */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateQuoteTotals } from "@/lib/calculations";

const NAVY = "0D1B2A";
const RED = "DB412B";
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F5F5F5";
const MID_GRAY = "CCCCCC";

function aud(n: number) {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function audCents(n: number) {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
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
    .from(schema.projects)
    .where(eq(schema.projects.id, quote.projectId))
    .get();

  const client = project
    ? await db.select({ name: schema.clients.name, contactName: schema.clients.contactName })
        .from(schema.clients).where(eq(schema.clients.id, project.clientId)).get()
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

  // ── Build PPTX ──────────────────────────────────────────────────────────────
  const PptxGenJS = require("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
  pptx.author = "LUX LED Screen Solutions";
  pptx.company = "LUX LED Screen Solutions";
  pptx.subject = `Proposal – ${quote.name}`;
  pptx.title = `LUX Proposal – ${quote.quoteNumber}`;

  const W = 13.33;

  // ── Helper: add branded header bar ─────────────────────────────────────────
  const addHeader = (slide: any, title: string, subtitle?: string) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.2, fill: { color: NAVY } });
    slide.addText("LUX", {
      x: 0.3, y: 0.15, w: 0.7, h: 0.5,
      fontSize: 22, bold: true, color: RED, fontFace: "Arial",
    });
    slide.addText(" LED Screen Solutions", {
      x: 0.95, y: 0.15, w: 3, h: 0.5,
      fontSize: 14, bold: false, color: WHITE, fontFace: "Arial",
    });
    slide.addText(title, {
      x: 0.3, y: 0.65, w: W - 0.6, h: 0.45,
      fontSize: subtitle ? 16 : 18, bold: true, color: WHITE, fontFace: "Arial",
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.3, y: 1.05, w: W - 0.6, h: 0.25,
        fontSize: 11, color: "AAAAAA", fontFace: "Arial",
      });
    }
  };

  // ── Slide 1: Cover ──────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 7.5, fill: { color: NAVY } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 5.8, w: W, h: 1.7, fill: { color: RED } });

    slide.addText("LUX", {
      x: 0.5, y: 1.0, w: 2, h: 1.0,
      fontSize: 60, bold: true, color: RED, fontFace: "Arial",
    });
    slide.addText("LED Screen Solutions", {
      x: 0.5, y: 1.9, w: 8, h: 0.6,
      fontSize: 22, color: WHITE, fontFace: "Arial",
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.65, w: 2.5, h: 0.04, fill: { color: RED } });

    slide.addText("CLIENT PROPOSAL", {
      x: 0.5, y: 2.9, w: 8, h: 0.5,
      fontSize: 16, color: MID_GRAY, fontFace: "Arial", charSpacing: 3,
    });
    slide.addText(quote.name, {
      x: 0.5, y: 3.5, w: 12, h: 0.8,
      fontSize: 28, bold: true, color: WHITE, fontFace: "Arial",
    });
    slide.addText(`${client?.name ?? ""}  |  ${project?.name ?? ""}`, {
      x: 0.5, y: 4.3, w: 10, h: 0.4,
      fontSize: 14, color: "AAAAAA", fontFace: "Arial",
    });

    slide.addText(`Quote: ${quote.quoteNumber}   |   ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`, {
      x: 0.5, y: 6.0, w: 12, h: 0.35,
      fontSize: 12, color: WHITE, fontFace: "Arial",
    });
    if (quote.validUntil) {
      slide.addText(`Valid until: ${quote.validUntil}`, {
        x: 0.5, y: 6.4, w: 8, h: 0.3,
        fontSize: 11, color: WHITE, fontFace: "Arial",
      });
    }
  }

  // ── Slide 2: Project Overview ────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Project Overview", `${client?.name ?? ""} — ${project?.name ?? ""}`);

    const fields = [
      ["Quote Number", quote.quoteNumber],
      ["Project", project?.name ?? "—"],
      ["Client", client?.name ?? "—"],
      ["Contact", client?.contactName ?? "—"],
      ["Screen Size", quote.screenSize ?? "—"],
      ["Panel Configuration", quote.panelConfig ?? "—"],
      ["Total Resolution", quote.totalResolution ?? "—"],
      ["Supplier Quote Ref", quote.supplierQuoteRef ?? "—"],
      ["Supplier Quote Date", quote.supplierQuoteDate ?? "—"],
    ];

    fields.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? 0.3 : 6.8;
      const y = 1.5 + Math.floor(i / 2) * 0.72;
      slide.addText(label, { x, y, w: 2.8, h: 0.3, fontSize: 9, color: "888888", fontFace: "Arial" });
      slide.addText(value, { x, y: y + 0.28, w: 6, h: 0.35, fontSize: 13, bold: true, color: NAVY, fontFace: "Arial" });
    });

    if (quote.notes) {
      slide.addText("Notes", { x: 0.3, y: 6.3, w: 3, h: 0.25, fontSize: 9, color: "888888", fontFace: "Arial" });
      slide.addText(quote.notes, { x: 0.3, y: 6.55, w: W - 0.6, h: 0.7, fontSize: 10, color: NAVY, fontFace: "Arial", wrap: true });
    }
  }

  // ── Slide 3: Line Items ──────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Equipment & Inclusions");

    const tableData: any[][] = [];
    tableData.push([
      { text: "Item", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 9 } },
      { text: "Unit", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 9, align: "center" } },
      { text: "Qty", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 9, align: "center" } },
      { text: "Unit Price (USD)", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 9, align: "right" } },
      { text: "Total (USD)", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 9, align: "right" } },
    ]);

    let totalUsd = 0;
    for (const item of items as any[]) {
      const subtotal = item.isFree ? 0 : (item.qty * (item.usdUnitPrice ?? 0));
      totalUsd += subtotal;
      const isEven = tableData.length % 2 === 0;
      const bg = isEven ? LIGHT_GRAY : WHITE;
      tableData.push([
        { text: item.itemName + (item.description ? `\n${item.description}` : ""), options: { fontSize: 9, color: NAVY, fill: { color: bg } } },
        { text: item.unit, options: { fontSize: 9, color: NAVY, align: "center", fill: { color: bg } } },
        { text: String(item.qty), options: { fontSize: 9, color: NAVY, align: "center", fill: { color: bg } } },
        { text: item.isFree ? "INCLUDED" : item.isLocal ? "LOCAL" : `US$${(item.usdUnitPrice ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`, options: { fontSize: 9, color: NAVY, align: "right", fill: { color: bg } } },
        { text: item.isFree ? "—" : item.isLocal ? "—" : `US$${subtotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`, options: { fontSize: 9, color: NAVY, align: "right", fill: { color: bg } } },
      ]);
    }

    // Totals row
    tableData.push([
      { text: "TOTAL (EXW Shenzhen)", options: { bold: true, fontSize: 9, color: WHITE, fill: { color: NAVY } } },
      { text: "", options: { fill: { color: NAVY } } },
      { text: "", options: { fill: { color: NAVY } } },
      { text: "", options: { fill: { color: NAVY } } },
      { text: `US$${totalUsd.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`, options: { bold: true, fontSize: 9, color: WHITE, align: "right", fill: { color: NAVY } } },
    ]);

    slide.addTable(tableData, {
      x: 0.3, y: 1.35, w: W - 0.6, h: 5.8,
      colW: [5.5, 0.8, 0.7, 2.2, 2.2],
      border: { pt: 0.5, color: MID_GRAY },
      autoPage: true,
      autoPageRepeatHeader: true,
      autoPageHeaderRows: 1,
    });
  }

  // ── Slide 4: Pricing Summary ─────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Pricing Summary");

    const boxW = 3.8;
    const boxH = 1.6;
    const gap = 0.3;
    const startX = (W - (3 * boxW + 2 * gap)) / 2;
    const startY = 1.6;

    const boxes = [
      { label: "Equipment Cost (AUD)", value: audCents(totals.totalAudSellExGst), sub: "ex GST", color: NAVY },
      { label: "GST (10%)", value: audCents(totals.totalGst), sub: "", color: "334455" },
      { label: "Total inc GST", value: aud(totals.totalAudSellIncGst), sub: "inc GST", color: RED },
    ];

    boxes.forEach((box, i) => {
      const x = startX + i * (boxW + gap);
      slide.addShape(pptx.ShapeType.rect, { x, y: startY, w: boxW, h: boxH, fill: { color: box.color }, line: { color: box.color } });
      slide.addText(box.label, { x, y: startY + 0.15, w: boxW, h: 0.35, fontSize: 10, color: WHITE, align: "center", fontFace: "Arial" });
      slide.addText(box.value, { x, y: startY + 0.55, w: boxW, h: 0.65, fontSize: 22, bold: true, color: WHITE, align: "center", fontFace: "Arial" });
      if (box.sub) slide.addText(box.sub, { x, y: startY + 1.2, w: boxW, h: 0.25, fontSize: 9, color: "AAAAAA", align: "center", fontFace: "Arial" });
    });

    // Payment schedule
    slide.addText("Payment Schedule", {
      x: 0.3, y: 3.6, w: W - 0.6, h: 0.35,
      fontSize: 13, bold: true, color: NAVY, fontFace: "Arial",
    });

    const scheduleRows = [
      ["Deposit", pct(quote.depositPct), audCents(totals.depositAmount)],
      ["Progress Payment", pct(quote.secondTranchePct), audCents(totals.secondTrancheAmount)],
      [`Balance on delivery`, pct(1 - quote.depositPct - quote.secondTranchePct), audCents(totals.balanceAmount)],
      ["TOTAL", "", audCents(totals.totalAudSellIncGst)],
    ];

    const tableData = [
      [
        { text: "Milestone", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 10 } },
        { text: "%", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 10, align: "center" } },
        { text: "Amount (inc GST)", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 10, align: "right" } },
      ],
      ...scheduleRows.map(([label, p, amount], i) => {
        const isTotal = i === scheduleRows.length - 1;
        const bg = isTotal ? NAVY : i % 2 === 0 ? LIGHT_GRAY : WHITE;
        const fg = isTotal ? WHITE : NAVY;
        return [
          { text: label, options: { fontSize: 10, color: fg, fill: { color: bg }, bold: isTotal } },
          { text: p, options: { fontSize: 10, color: fg, align: "center", fill: { color: bg }, bold: isTotal } },
          { text: amount, options: { fontSize: 10, color: fg, align: "right", fill: { color: bg }, bold: isTotal } },
        ];
      }),
    ];

    slide.addTable(tableData, {
      x: 0.3, y: 4.0, w: 7, h: 2.8,
      colW: [3.5, 1.5, 2],
      border: { pt: 0.5, color: MID_GRAY },
    });

    slide.addText("All prices in AUD. Freight, installation and commissioning quoted separately unless stated.", {
      x: 7.5, y: 4.2, w: 5.5, h: 1, fontSize: 9, color: "888888", fontFace: "Arial", wrap: true,
    });
  }

  // ── Slide 5: Terms & Next Steps ──────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addHeader(slide, "Terms & Next Steps");

    const terms = [
      "Prices valid until " + (quote.validUntil ?? "30 days from quote date"),
      "Equipment is EXW Shenzhen — freight, insurance and customs quoted separately",
      "Lead time is approximately 4–6 weeks from deposit receipt",
      "All prices are in Australian Dollars (AUD) inclusive of GST where stated",
      "A signed purchase order and deposit payment confirms acceptance of this proposal",
    ];

    slide.addText("Terms & Conditions", {
      x: 0.4, y: 1.4, w: 6, h: 0.35, fontSize: 13, bold: true, color: NAVY, fontFace: "Arial",
    });
    terms.forEach((term, i) => {
      slide.addText(`• ${term}`, {
        x: 0.4, y: 1.85 + i * 0.5, w: 8.5, h: 0.45,
        fontSize: 10, color: NAVY, fontFace: "Arial", wrap: true,
      });
    });

    slide.addText("Next Steps", {
      x: 0.4, y: 4.6, w: 6, h: 0.35, fontSize: 13, bold: true, color: NAVY, fontFace: "Arial",
    });
    const steps = [
      "Review this proposal and confirm product selection",
      "Sign and return the purchase order",
      "Pay the deposit to confirm your order",
      "LUX coordinates production and logistics",
    ];
    steps.forEach((step, i) => {
      slide.addShape(pptx.ShapeType.ellipse, { x: 0.4, y: 5.1 + i * 0.48, w: 0.25, h: 0.25, fill: { color: RED } });
      slide.addText(String(i + 1), { x: 0.4, y: 5.1 + i * 0.48, w: 0.25, h: 0.25, fontSize: 9, bold: true, color: WHITE, align: "center", fontFace: "Arial" });
      slide.addText(step, { x: 0.75, y: 5.1 + i * 0.48, w: 8, h: 0.3, fontSize: 10, color: NAVY, fontFace: "Arial" });
    });

    // Contact block
    slide.addShape(pptx.ShapeType.rect, { x: 9.0, y: 1.4, w: 4.0, h: 5.5, fill: { color: NAVY } });
    slide.addText("Contact Us", { x: 9.2, y: 1.7, w: 3.6, h: 0.4, fontSize: 13, bold: true, color: WHITE, fontFace: "Arial" });
    slide.addShape(pptx.ShapeType.rect, { x: 9.2, y: 2.15, w: 1.2, h: 0.04, fill: { color: RED } });
    slide.addText("Simon Baldock", { x: 9.2, y: 2.4, w: 3.6, h: 0.35, fontSize: 12, bold: true, color: WHITE, fontFace: "Arial" });
    slide.addText("Director", { x: 9.2, y: 2.75, w: 3.6, h: 0.3, fontSize: 10, color: MID_GRAY, fontFace: "Arial" });
    slide.addText("LUX LED Screen Solutions", { x: 9.2, y: 3.1, w: 3.6, h: 0.3, fontSize: 10, color: MID_GRAY, fontFace: "Arial" });
    slide.addText("simon@luxled.com.au", { x: 9.2, y: 3.6, w: 3.6, h: 0.3, fontSize: 10, color: RED, fontFace: "Arial" });
    slide.addText("www.luxled.com.au", { x: 9.2, y: 3.95, w: 3.6, h: 0.3, fontSize: 10, color: MID_GRAY, fontFace: "Arial" });
  }

  // ── Write buffer ─────────────────────────────────────────────────────────────
  const buf = await pptx.write({ outputType: "nodebuffer" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="LUX-Proposal-${quote.quoteNumber}.pptx"`,
    },
  });
}

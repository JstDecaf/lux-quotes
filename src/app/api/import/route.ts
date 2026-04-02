import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function generateQuoteNumberAsync(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LUX-${year}-`;

  const result = await db
    .select({ maxNum: sql<string>`MAX(quote_number)` })
    .from(schema.quotes)
    .where(sql`quote_number LIKE ${prefix + "%"}`)
    .get();

  let next = 1;
  if (result?.maxNum) {
    const parts = result.maxNum.split("-");
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) next = last + 1;
  }
  return `${prefix}${next.toString().padStart(4, "0")}`;
}

interface LineItemInput {
  itemName: string;
  description: string;
  unit: string;
  qty: number;
  usdUnitPrice: number;
  isFree: boolean;
  sortOrder: number;
}

interface QuoteInput {
  name: string;
  supplierQuoteRef: string;
  supplierQuoteDate: string;
  screenSize: string;
  panelConfig: string;
  totalResolution: string;
  screenWidthMm?: number | null;
  screenHeightMm?: number | null;
  pixelPitchMm?: number | null;
  cabinetWidthMm?: number | null;
  cabinetHeightMm?: number | null;
  panelCountW?: number | null;
  panelCountH?: number | null;
  resolutionW?: number | null;
  resolutionH?: number | null;
  brightnessNits?: number | null;
  cabinetWeightKg?: number | null;
  lineItems: LineItemInput[];
}

interface ImportBody {
  clientId?: number | null;
  clientName?: string;
  projectId?: number | null;
  projectName?: string;
  quoteAction: "new" | "update";
  existingQuoteId?: number;
  fxRate: number;
  defaultMargin: number;
  defaultResellerMargin: number;
  validUntil?: string;
  quotes: QuoteInput[];
}

export async function POST(request: NextRequest) {
  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    return await handleImport(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[import] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

async function handleImport(body: ImportBody) {

  const {
    clientId: rawClientId,
    clientName,
    projectId: rawProjectId,
    projectName,
    quoteAction,
    existingQuoteId,
    fxRate,
    defaultMargin,
    defaultResellerMargin,
    validUntil,
    quotes,
  } = body;

  // 1. Resolve or create client
  let clientId = rawClientId ?? null;
  if (!clientId) {
    if (!clientName) {
      return Response.json({ error: "clientName is required when clientId is null" }, { status: 400 });
    }
    const [newClient] = await db.insert(schema.clients).values({ name: clientName }).returning();
    clientId = newClient.id;
  }

  // 2. Resolve or create project
  let projectId = rawProjectId ?? null;
  if (!projectId) {
    if (!projectName) {
      return Response.json({ error: "projectName is required when projectId is null" }, { status: 400 });
    }
    const [newProject] = await db.insert(schema.projects).values({
      clientId: clientId!,
      name: projectName,
    }).returning();
    projectId = newProject.id;
  }

  const quoteIds: number[] = [];

  for (const quoteInput of quotes) {
    let quoteId: number;

    if (quoteAction === "update" && existingQuoteId && quotes.length === 1) {
      // Delete existing line items and update the quote
      await db.delete(schema.quoteLineItems)
        .where(eq(schema.quoteLineItems.quoteId, existingQuoteId))
        .run();

      await db.update(schema.quotes)
        .set({
          name: quoteInput.name,
          supplierQuoteRef: quoteInput.supplierQuoteRef || null,
          supplierQuoteDate: quoteInput.supplierQuoteDate || null,
          screenSize: quoteInput.screenSize || null,
          panelConfig: quoteInput.panelConfig || null,
          totalResolution: quoteInput.totalResolution || null,
          screenWidthMm: quoteInput.screenWidthMm ?? null,
          screenHeightMm: quoteInput.screenHeightMm ?? null,
          pixelPitchMm: quoteInput.pixelPitchMm ?? null,
          cabinetWidthMm: quoteInput.cabinetWidthMm ?? null,
          cabinetHeightMm: quoteInput.cabinetHeightMm ?? null,
          panelCountW: quoteInput.panelCountW ?? null,
          panelCountH: quoteInput.panelCountH ?? null,
          resolutionW: quoteInput.resolutionW ?? null,
          resolutionH: quoteInput.resolutionH ?? null,
          brightnessNits: quoteInput.brightnessNits ?? null,
          cabinetWeightKg: quoteInput.cabinetWeightKg ?? null,
          fxRate,
          defaultMargin,
          defaultResellerMargin,
          validUntil: validUntil || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.quotes.id, existingQuoteId))
        .run();

      quoteId = existingQuoteId;
    } else {
      // Insert new quote
      const quoteNumber = await generateQuoteNumberAsync();

      const [newQuote] = await db.insert(schema.quotes).values({
        projectId: projectId!,
        quoteNumber,
        name: quoteInput.name,
        fxRate,
        defaultMargin,
        defaultResellerMargin,
        gstRate: 0.1,
        supplierQuoteRef: quoteInput.supplierQuoteRef || null,
        supplierQuoteDate: quoteInput.supplierQuoteDate || null,
        screenSize: quoteInput.screenSize || null,
        panelConfig: quoteInput.panelConfig || null,
        totalResolution: quoteInput.totalResolution || null,
        screenWidthMm: quoteInput.screenWidthMm ?? null,
        screenHeightMm: quoteInput.screenHeightMm ?? null,
        pixelPitchMm: quoteInput.pixelPitchMm ?? null,
        cabinetWidthMm: quoteInput.cabinetWidthMm ?? null,
        cabinetHeightMm: quoteInput.cabinetHeightMm ?? null,
        panelCountW: quoteInput.panelCountW ?? null,
        panelCountH: quoteInput.panelCountH ?? null,
        resolutionW: quoteInput.resolutionW ?? null,
        resolutionH: quoteInput.resolutionH ?? null,
        brightnessNits: quoteInput.brightnessNits ?? null,
        cabinetWeightKg: quoteInput.cabinetWeightKg ?? null,
        validUntil: validUntil || null,
      }).returning();

      quoteId = newQuote.id;
    }

    // Insert line items
    for (const item of quoteInput.lineItems) {
      await db.insert(schema.quoteLineItems).values({
        quoteId,
        itemName: item.itemName,
        description: item.description || null,
        unit: item.unit || "PCS",
        qty: item.qty,
        usdUnitPrice: item.usdUnitPrice,
        isFree: item.isFree,
        sortOrder: item.sortOrder,
      }).run();
    }

    // Recalc totals
    await recalcQuoteTotals(quoteId);

    quoteIds.push(quoteId);
  }

  return Response.json({ success: true, quoteIds, projectId, clientId });
}

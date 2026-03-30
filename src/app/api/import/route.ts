import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function generateQuoteNumberAsync(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LUX-${year}-`;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.quotes)
    .where(sql`quote_number LIKE ${prefix + "%"}`)
    .get();

  const num = (((result?.count ?? 0) as number) + 1).toString().padStart(4, "0");
  return `${prefix}${num}`;
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
  const body: ImportBody = await request.json();

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

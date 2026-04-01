import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  const quote = await db
    .select({
      id: schema.quotes.id,
      projectId: schema.quotes.projectId,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      gstRate: schema.quotes.gstRate,
      depositPct: schema.quotes.depositPct,
      secondTranchePct: schema.quotes.secondTranchePct,
      installationHourlyRate: schema.quotes.installationHourlyRate,
      installationMargin: schema.quotes.installationMargin,
      installationQuotedBy: schema.quotes.installationQuotedBy,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      supplierQuoteDate: schema.quotes.supplierQuoteDate,
      supplierQuoteRef: schema.quotes.supplierQuoteRef,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudCost: schema.quotes.cachedTotalAudCost,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      notes: schema.quotes.notes,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.quotes.id, quoteId))
    .get();

  if (!quote) {
    return Response.json({ error: "Quote not found" }, { status: 404 });
  }

  const lineItems = await db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  return Response.json({ ...quote, lineItems });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  const body = await request.json();

  // Remove fields that shouldn't be directly set
  const { lineItems: _li, id: _id, clientName: _cn, projectName: _pn, clientId: _ci, ...updates } = body;

  const [result] = await db.update(schema.quotes)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.quotes.id, quoteId))
    .returning();

  if (!result) {
    return Response.json({ error: "Quote not found" }, { status: 404 });
  }

  // Recalculate cached totals
  await recalcQuoteTotals(quoteId);

  const updated = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();
  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  await db.delete(schema.quotes).where(eq(schema.quotes.id, quoteId)).run();
  return Response.json({ ok: true });
}

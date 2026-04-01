import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  const items = await db
    .select()
    .from(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.quoteId, quoteId))
    .orderBy(schema.quoteInstallationItems.sortOrder)
    .all();

  return Response.json(items);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  const body = await request.json();

  const [result] = await db.insert(schema.quoteInstallationItems).values({
    quoteId,
    itemName: body.itemName ?? "New Item",
    type: body.type ?? "hourly",
    hours: body.hours ?? 0,
    hourlyRate: body.hourlyRate ?? null,
    fixedCost: body.fixedCost ?? 0,
    marginOverride: body.marginOverride ?? null,
    isFree: body.isFree ?? false,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  await recalcQuoteTotals(quoteId);

  return Response.json(result, { status: 201 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  const body: Array<Record<string, unknown>> = await request.json();

  if (!Array.isArray(body)) {
    return Response.json({ error: "Expected array" }, { status: 400 });
  }

  for (const item of body) {
    const itemId = item.id as number;
    if (!itemId) continue;
    const { id: _id, quoteId: _qid, createdAt: _ca, ...updates } = item;
    await db.update(schema.quoteInstallationItems)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.quoteInstallationItems.id, itemId))
      .run();
  }

  await recalcQuoteTotals(quoteId);

  const items = await db
    .select()
    .from(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.quoteId, quoteId))
    .orderBy(schema.quoteInstallationItems.sortOrder)
    .all();

  return Response.json(items);
}

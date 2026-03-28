import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const quoteId = parseInt(id);
  const lineItemId = parseInt(itemId);
  const body = await request.json();

  const { id: _id, quoteId: _qid, createdAt: _ca, ...updates } = body;

  const result = db.update(schema.quoteLineItems)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.quoteLineItems.id, lineItemId))
    .returning()
    .get();

  if (!result) {
    return Response.json({ error: "Line item not found" }, { status: 404 });
  }

  recalcQuoteTotals(quoteId);

  return Response.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const quoteId = parseInt(id);
  const lineItemId = parseInt(itemId);

  db.delete(schema.quoteLineItems).where(eq(schema.quoteLineItems.id, lineItemId)).run();
  recalcQuoteTotals(quoteId);

  return Response.json({ ok: true });
}

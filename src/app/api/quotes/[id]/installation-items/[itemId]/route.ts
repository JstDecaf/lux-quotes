import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const quoteId = parseInt(id);

  await db
    .delete(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.id, parseInt(itemId)))
    .run();

  await recalcQuoteTotals(quoteId);
  return Response.json({ ok: true });
}

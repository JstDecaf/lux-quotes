import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recalcQuoteTotals } from "@/lib/recalc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  const items = await db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  // Enrich with product/variant data
  const enriched = await Promise.all(items.map(async (item: typeof items[number]) => {
    if (!item.productVariantId) return { ...item, productName: null, variantName: null, pixelPitch: null, variantWeight: null };
    const variant = await db.select({
      name: schema.productVariants.name,
      pixelPitch: schema.productVariants.pixelPitch,
      weight: schema.productVariants.weight,
      productName: schema.products.name,
    })
      .from(schema.productVariants)
      .leftJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
      .where(eq(schema.productVariants.id, item.productVariantId))
      .get();
    return {
      ...item,
      productName: variant?.productName ?? null,
      variantName: variant?.name ?? null,
      pixelPitch: variant?.pixelPitch ?? null,
      variantWeight: variant?.weight ?? null,
    };
  }));
  return Response.json(enriched);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);
  const body = await request.json();

  const [result] = await db.insert(schema.quoteLineItems).values({
    quoteId,
    itemName: body.itemName ?? "New Item",
    description: body.description ?? null,
    unit: body.unit ?? "PCS",
    qty: body.qty ?? 1,
    usdUnitPrice: body.usdUnitPrice ?? 0,
    marginOverride: body.marginOverride ?? null,
    isLocal: body.isLocal ?? false,
    audLocalCost: body.audLocalCost ?? 0,
    isFree: body.isFree ?? false,
    sortOrder: body.sortOrder ?? 0,
    productId: body.productId ?? null,
    productVariantId: body.productVariantId ?? null,
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
    return Response.json({ error: "Expected array of items" }, { status: 400 });
  }

  for (const item of body) {
    const itemId = item.id as number;
    if (!itemId) continue;

    const { id: _id, quoteId: _qid, createdAt: _ca, ...updates } = item;
    await db.update(schema.quoteLineItems)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.quoteLineItems.id, itemId))
      .run();
  }

  await recalcQuoteTotals(quoteId);

  const items = await db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  return Response.json(items);
}

import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return Response.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const product = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .get();

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, productId))
    .orderBy(asc(schema.productVariants.pixelPitch))
    .all();

  const documents = await db
    .select()
    .from(schema.productDocuments)
    .where(eq(schema.productDocuments.productId, productId))
    .all();

  return Response.json({
    ...product,
    applications: product.applications ? JSON.parse(product.applications) : [],
    variants,
    documents,
  });
}

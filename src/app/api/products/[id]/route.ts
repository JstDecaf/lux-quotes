import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productVariants, productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.select().from(products).where(eq(products.id, Number(id))).get();
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variants = await db.select().from(productVariants)
    .where(eq(productVariants.productId, Number(id)))
    .orderBy(asc(productVariants.pixelPitch)).all();

  const documents = await db.select().from(productDocuments)
    .where(eq(productDocuments.productId, Number(id)))
    .orderBy(asc(productDocuments.type)).all();

  return NextResponse.json({
    ...product,
    applications: product.applications ? JSON.parse(product.applications) : [],
    variants,
    documents,
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await db.update(products).set({
    name: body.name,
    brand: body.brand,
    subBrand: body.subBrand,
    category: body.category,
    status: body.status,
    description: body.description,
    imageUrl: body.imageUrl ?? null,
    applications: body.applications ? JSON.stringify(body.applications) : null,
    updatedAt: new Date().toISOString(),
  }).where(eq(products.id, Number(id))).run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(products).where(eq(products.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}

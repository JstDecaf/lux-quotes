import { db } from "@/lib/db";
import { products, productVariants, productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductDetailEditor } from "@/components/product-detail-editor";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = db.select().from(products).where(eq(products.id, Number(id))).get();
  if (!product) notFound();

  const variantsList = db.select().from(productVariants)
    .where(eq(productVariants.productId, Number(id)))
    .orderBy(asc(productVariants.pixelPitch)).all();

  const documentsList = db.select().from(productDocuments)
    .where(eq(productDocuments.productId, Number(id)))
    .orderBy(asc(productDocuments.type)).all();

  const apps: string[] = product.applications ? JSON.parse(product.applications) : [];

  return (
    <ProductDetailEditor
      initialProduct={{
        ...product,
        applications: apps,
        variants: variantsList,
        documents: documentsList,
      }}
    />
  );
}

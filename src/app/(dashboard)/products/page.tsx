export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { products, productVariants, productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import ProductCatalog from "@/components/product-catalog";
import { NewProductButton } from "@/components/new-product-button";

export default async function ProductsPage() {
  const rows = await db.select().from(products).orderBy(asc(products.name)).all();

  const withVariants = await Promise.all(rows.map(async (p: any) => {
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, p.id))
      .orderBy(asc(productVariants.pixelPitch))
      .all();
    const documents = await db
      .select()
      .from(productDocuments)
      .where(eq(productDocuments.productId, p.id))
      .orderBy(asc(productDocuments.type))
      .all();
    return {
      ...p,
      applications: p.applications ? JSON.parse(p.applications) : [],
      variants,
      documents,
    };
  }));

  const totalVariants = withVariants.reduce((sum, p) => sum + p.variants.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-archivo text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} product families · {totalVariants} variants
          </p>
        </div>
        <NewProductButton />
      </div>
      <ProductCatalog initialProducts={withVariants} />
    </div>
  );
}

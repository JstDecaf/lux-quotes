import { db } from "@/lib/db";
import { products, productVariants, productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import ProductCatalog from "@/components/product-catalog";
import { NewProductButton } from "@/components/new-product-button";

export default function ProductsPage() {
  const rows = db.select().from(products).orderBy(asc(products.name)).all();

  const withVariants = rows.map((p: any) => {
    const variants = db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, p.id))
      .orderBy(asc(productVariants.pixelPitch))
      .all();
    const documents = db
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
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-archivo text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} product families · {rows.reduce((sum: number, p: any) => {
              const v = db.select().from(productVariants).where(eq(productVariants.productId, p.id)).all();
              return sum + v.length;
            }, 0)} variants
          </p>
        </div>
        <NewProductButton />
      </div>
      <ProductCatalog initialProducts={withVariants} />
    </div>
  );
}

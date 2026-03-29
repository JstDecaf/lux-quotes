import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productVariants } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const rows = db
    .select()
    .from(products)
    .orderBy(asc(products.name))
    .all();

  const withVariants = rows.map((p) => {
    const variants = db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, p.id))
      .orderBy(asc(productVariants.pixelPitch))
      .all();
    return { ...p, variants, applications: p.applications ? JSON.parse(p.applications) : [] };
  });

  return NextResponse.json(withVariants);
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = db.insert(products).values({
    name: body.name,
    brand: body.brand || "Leyard",
    subBrand: body.subBrand || "Standard",
    category: body.category,
    status: body.status || "Active",
    description: body.description,
    applications: body.applications ? JSON.stringify(body.applications) : null,
  }).run();

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

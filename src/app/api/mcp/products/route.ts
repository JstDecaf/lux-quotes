import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("search");

  let rows = await db
    .select()
    .from(schema.products)
    .orderBy(asc(schema.products.name))
    .all();

  if (category) {
    rows = rows.filter((p: typeof rows[number]) => p.category === category);
  }
  if (search) {
    const lc = search.toLowerCase();
    rows = rows.filter(
      (p: typeof rows[number]) =>
        p.name.toLowerCase().includes(lc) ||
        p.brand?.toLowerCase().includes(lc) ||
        p.category?.toLowerCase().includes(lc)
    );
  }

  const withVariants = await Promise.all(
    rows.map(async (p: typeof rows[number]) => {
      const variants = await db
        .select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.productId, p.id))
        .orderBy(asc(schema.productVariants.pixelPitch))
        .all();
      return {
        ...p,
        applications: p.applications ? JSON.parse(p.applications) : [],
        variants,
      };
    })
  );

  return Response.json({
    count: withVariants.length,
    products: withVariants,
  });
}

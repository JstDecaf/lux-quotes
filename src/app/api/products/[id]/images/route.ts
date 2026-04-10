import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const images = await db.select().from(productImages)
    .where(eq(productImages.productId, Number(id)))
    .orderBy(asc(productImages.sortOrder))
    .all();
  return NextResponse.json(images);
}

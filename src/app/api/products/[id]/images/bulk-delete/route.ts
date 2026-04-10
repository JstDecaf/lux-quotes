import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages } from "@/../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { del } from "@vercel/blob";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const body = await req.json();
  const imageIds: number[] = body.imageIds;

  if (!imageIds?.length) {
    return NextResponse.json({ error: "No image IDs provided" }, { status: 400 });
  }

  // Get all images to find their blob URLs
  const images = await db.select().from(productImages)
    .where(inArray(productImages.id, imageIds)).all();

  // Delete blobs
  const blobUrls = images
    .filter((img: typeof images[number]) => img.url.includes(".vercel-storage.com"))
    .map((img: typeof images[number]) => img.url);

  if (blobUrls.length > 0) {
    try {
      await del(blobUrls);
    } catch {
      // Continue even if blob deletion fails
    }
  }

  // Delete DB records
  await db.delete(productImages).where(inArray(productImages.id, imageIds)).run();

  return NextResponse.json({ deleted: imageIds.length });
}

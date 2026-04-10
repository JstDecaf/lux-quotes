import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages, products } from "@/../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { get } from "@vercel/blob";
import { zipSync } from "fflate";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  const body = await req.json();
  const imageIds: number[] = body.imageIds;

  if (!imageIds?.length) {
    return NextResponse.json({ error: "No image IDs provided" }, { status: 400 });
  }

  const images = await db.select().from(productImages)
    .where(inArray(productImages.id, imageIds)).all();

  if (!images.length) {
    return NextResponse.json({ error: "No images found" }, { status: 404 });
  }

  // Get product name for the zip filename
  const product = await db.select({ name: products.name }).from(products)
    .where(eq(products.id, productId)).get();
  const productName = product?.name?.replace(/[^a-zA-Z0-9-_ ]/g, "") || "images";

  // Fetch all image files and build zip
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

  for (const img of images) {
    try {
      let data: Uint8Array;

      if (img.url.includes(".vercel-storage.com")) {
        const blob = await get(img.url, { access: "private" });
        if (!blob || blob.statusCode !== 200) continue;
        const arrayBuf = await new Response(blob.stream).arrayBuffer();
        data = new Uint8Array(arrayBuf);
      } else {
        continue; // Skip external URLs
      }

      // Generate unique filename
      let filename = `${img.name}.${img.fileType || "png"}`;
      if (usedNames.has(filename)) {
        filename = `${img.name}-${img.id}.${img.fileType || "png"}`;
      }
      usedNames.add(filename);

      files[filename] = data;
    } catch {
      // Skip images that can't be fetched
    }
  }

  if (Object.keys(files).length === 0) {
    return NextResponse.json({ error: "Could not fetch any images" }, { status: 500 });
  }

  const zipped = zipSync(files);

  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${productName}-images.zip"`,
    },
  });
}

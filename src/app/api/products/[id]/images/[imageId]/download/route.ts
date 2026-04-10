import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { imageId } = await params;

  const image = await db.select().from(productImages)
    .where(eq(productImages.id, Number(imageId))).get();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (!image.url.includes(".vercel-storage.com")) {
    return NextResponse.redirect(image.url);
  }

  const blob = await get(image.url, { access: "private" });

  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "Image not found in storage" }, { status: 404 });
  }

  const ext = image.fileType || "png";
  const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  return new Response(blob.stream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

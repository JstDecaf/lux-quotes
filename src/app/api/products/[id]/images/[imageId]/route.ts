import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { imageId } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.tag !== undefined) updates.tag = body.tag; // null clears the tag

  await db.update(productImages).set(updates)
    .where(eq(productImages.id, Number(imageId))).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { imageId } = await params;

  const image = await db.select().from(productImages)
    .where(eq(productImages.id, Number(imageId))).get();

  if (image?.url && image.url.includes(".vercel-storage.com")) {
    try {
      await del(image.url);
    } catch {
      // Blob may already be deleted
    }
  }

  await db.delete(productImages).where(eq(productImages.id, Number(imageId))).run();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { docId } = await params;
  const body = await req.json();
  await db.update(productDocuments).set({
    name: body.name,
    type: body.type,
    url: body.url,
    fileType: body.fileType || null,
    notes: body.notes || null,
    updatedAt: new Date().toISOString(),
  }).where(eq(productDocuments.id, Number(docId))).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { docId } = await params;

  // Get the document to check if it has a blob URL
  const doc = await db.select().from(productDocuments)
    .where(eq(productDocuments.id, Number(docId))).get();

  if (doc?.url && doc.url.includes(".vercel-storage.com")) {
    try {
      await del(doc.url);
    } catch {
      // Blob may already be deleted or URL may not be a blob — continue
    }
  }

  await db.delete(productDocuments).where(eq(productDocuments.id, Number(docId))).run();
  return NextResponse.json({ ok: true });
}

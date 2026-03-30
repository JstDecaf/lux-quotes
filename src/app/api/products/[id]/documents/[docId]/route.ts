import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { docId } = await params;
  const body = await req.json();
  db.update(productDocuments).set({
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
  db.delete(productDocuments).where(eq(productDocuments.id, Number(docId))).run();
  return NextResponse.json({ ok: true });
}

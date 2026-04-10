import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { docId } = await params;

  const doc = await db.select().from(productDocuments)
    .where(eq(productDocuments.id, Number(docId))).get();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // If it's a blob URL, generate a signed download URL
  if (doc.url.includes(".vercel-storage.com")) {
    const downloadUrl = await getDownloadUrl(doc.url);
    return NextResponse.redirect(downloadUrl);
  }

  // Otherwise redirect to the external URL directly
  return NextResponse.redirect(doc.url);
}

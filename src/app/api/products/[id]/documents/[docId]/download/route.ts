import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";

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

  // If it's not a blob URL, redirect to the external URL directly
  if (!doc.url.includes(".vercel-storage.com")) {
    return NextResponse.redirect(doc.url);
  }

  // Fetch the blob and stream it to the client
  const blob = await get(doc.url, { access: "private" });

  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
  }

  const filename = doc.name + (doc.fileType ? `.${doc.fileType}` : "");

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

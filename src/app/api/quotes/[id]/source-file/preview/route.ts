import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = Number(id);

  const quote = await db.select({
    sourceFilePreviewUrl: schema.quotes.sourceFilePreviewUrl,
  }).from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();

  if (!quote?.sourceFilePreviewUrl) {
    return NextResponse.json({ error: "No preview available" }, { status: 404 });
  }

  const blob = await get(quote.sourceFilePreviewUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "Preview not found in storage" }, { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

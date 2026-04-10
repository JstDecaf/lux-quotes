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
    sourceFileUrl: schema.quotes.sourceFileUrl,
    quoteNumber: schema.quotes.quoteNumber,
  }).from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();

  if (!quote?.sourceFileUrl) {
    return NextResponse.json({ error: "No source file" }, { status: 404 });
  }

  const blob = await get(quote.sourceFileUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}-source.xlsx"`,
    },
  });
}

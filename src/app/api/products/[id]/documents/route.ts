import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = db.select().from(productDocuments)
    .where(eq(productDocuments.productId, Number(id)))
    .orderBy(asc(productDocuments.type)).all();
  return NextResponse.json(docs);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = db.insert(productDocuments).values({
    productId: Number(id),
    name: body.name,
    type: body.type || "link",
    url: body.url,
    fileType: body.fileType || null,
    notes: body.notes || null,
  }).run();
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

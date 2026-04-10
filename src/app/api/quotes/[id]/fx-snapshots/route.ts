import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  const snapshots = await db.select().from(schema.quoteFxSnapshots)
    .where(eq(schema.quoteFxSnapshots.quoteId, quoteId))
    .orderBy(asc(schema.quoteFxSnapshots.date))
    .all();

  return NextResponse.json(snapshots);
}

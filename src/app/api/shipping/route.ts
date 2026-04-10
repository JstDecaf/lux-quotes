import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(schema.shippingCosts)
    .orderBy(desc(schema.shippingCosts.date)).all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  const weightKg = body.weightKg ?? null;
  const volumeCbm = body.volumeCbm ?? null;
  const totalCostAud = body.totalCostAud;

  if (!totalCostAud || !body.date) {
    return NextResponse.json({ error: "date and totalCostAud are required" }, { status: 400 });
  }

  const costPerKg = weightKg && weightKg > 0 ? totalCostAud / weightKg : null;
  const costPerCbm = volumeCbm && volumeCbm > 0 ? totalCostAud / volumeCbm : null;

  const [result] = await db.insert(schema.shippingCosts).values({
    date: body.date,
    mode: body.mode || "sea_fcl",
    origin: body.origin || "China",
    destination: body.destination || "Australia",
    weightKg,
    volumeCbm,
    totalCostAud,
    costPerKg,
    costPerCbm,
    transitDays: body.transitDays ?? null,
    forwarder: body.forwarder ?? null,
    quoteId: body.quoteId ?? null,
    notes: body.notes ?? null,
  }).returning();

  return NextResponse.json(result, { status: 201 });
}

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const weightKg = body.weightKg ?? null;
  const volumeCbm = body.volumeCbm ?? null;
  const totalCostAud = body.totalCostAud;

  const costPerKg = weightKg && weightKg > 0 && totalCostAud ? totalCostAud / weightKg : null;
  const costPerCbm = volumeCbm && volumeCbm > 0 && totalCostAud ? totalCostAud / volumeCbm : null;

  await db.update(schema.shippingCosts).set({
    date: body.date,
    mode: body.mode,
    origin: body.origin,
    destination: body.destination,
    weightKg,
    volumeCbm,
    totalCostAud,
    costPerKg,
    costPerCbm,
    transitDays: body.transitDays ?? null,
    forwarder: body.forwarder ?? null,
    quoteId: body.quoteId ?? null,
    notes: body.notes ?? null,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.shippingCosts.id, Number(id))).run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(schema.shippingCosts).where(eq(schema.shippingCosts.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productVariants } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { variantId } = await params;
  const variant = db.select().from(productVariants).where(eq(productVariants.id, Number(variantId))).get();
  if (!variant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(variant);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { variantId } = await params;
  const body = await req.json();

  db.update(productVariants).set({
    name: body.name,
    pixelPitch: body.pixelPitch,
    pricePerSqmUsd: body.pricePerSqmUsd,
    cabinetSize: body.cabinetSize,
    cabinetResolution: body.cabinetResolution,
    pixelConfig: body.pixelConfig,
    brightness: body.brightness,
    contrastRatio: body.contrastRatio,
    refreshRate: body.refreshRate,
    viewingAngle: body.viewingAngle,
    weight: body.weight,
    powerAvg: body.powerAvg,
    powerMax: body.powerMax,
    ipRating: body.ipRating,
    operatingTemp: body.operatingTemp,
    gob: body.gob || false,
    updatedAt: new Date().toISOString(),
  }).where(eq(productVariants.id, Number(variantId))).run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { variantId } = await params;
  db.delete(productVariants).where(eq(productVariants.id, Number(variantId))).run();
  return NextResponse.json({ ok: true });
}

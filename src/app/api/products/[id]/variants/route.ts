import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productVariants } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variants = await db.select().from(productVariants)
    .where(eq(productVariants.productId, Number(id)))
    .orderBy(asc(productVariants.pixelPitch)).all();
  return NextResponse.json(variants);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const [result] = await db.insert(productVariants).values({
    productId: Number(id),
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
  }).returning();
  return NextResponse.json({ id: result.id }, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.update(productVariants).set({
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
  }).where(eq(productVariants.id, body.id)).run();
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productVariants } from "@/../drizzle/schema";
import { inArray } from "drizzle-orm";

/** Parse a weight string like "8.5 kg", "8.5 kg/cabinet", "8500g" → kg as number */
export function parseWeightKg(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = raw.toLowerCase().replace(/,/g, "");
  // grams → kg
  const gMatch = s.match(/([\d.]+)\s*g(?:ram)?(?:\s|$|\/)/);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;
  // kg (default)
  const kgMatch = s.match(/([\d.]+)\s*k?g/);
  if (kgMatch) return parseFloat(kgMatch[1]);
  // bare number
  const numMatch = s.match(/[\d.]+/);
  if (numMatch) return parseFloat(numMatch[0]);
  return 0;
}

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({});

  const idList = ids
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  if (!idList.length) return NextResponse.json({});

  const rows = await db
    .select({ id: productVariants.id, weight: productVariants.weight, name: productVariants.name })
    .from(productVariants)
    .where(inArray(productVariants.id, idList))
    .all();

  // Return map: variantId → { weightKg, rawWeight, name }
  const result: Record<number, { weightKg: number; rawWeight: string; name: string }> = {};
  for (const row of rows) {
    result[row.id] = {
      weightKg: parseWeightKg(row.weight),
      rawWeight: row.weight ?? "",
      name: row.name,
    };
  }

  return NextResponse.json(result);
}

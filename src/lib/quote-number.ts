import { db, schema } from "./db";
import { sql } from "drizzle-orm";

export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `LUX-${year}-`;

  const result = db
    .select({ maxNum: sql<string>`MAX(quote_number)` })
    .from(schema.quotes)
    .where(sql`quote_number LIKE ${prefix + "%"}`)
    .get();

  let next = 1;
  if (result?.maxNum) {
    const parts = result.maxNum.split("-");
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) next = last + 1;
  }
  return `${prefix}${next.toString().padStart(4, "0")}`;
}

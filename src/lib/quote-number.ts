import { db, schema } from "./db";
import { sql } from "drizzle-orm";

export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `LUX-${year}-`;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.quotes)
    .where(sql`quote_number LIKE ${prefix + "%"}`)
    .get();

  const num = ((result?.count ?? 0) + 1).toString().padStart(4, "0");
  return `${prefix}${num}`;
}

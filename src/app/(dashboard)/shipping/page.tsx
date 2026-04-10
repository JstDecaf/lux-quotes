import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { ShippingList } from "@/components/shipping-list";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const entries = await db.select().from(schema.shippingCosts)
    .orderBy(desc(schema.shippingCosts.date)).all();

  return <ShippingList initialEntries={entries} />;
}

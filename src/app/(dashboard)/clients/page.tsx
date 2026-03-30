import { db, schema } from "@/lib/db";
import { asc } from "drizzle-orm";
import { ClientsList } from "@/components/clients-list";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await db.select().from(schema.clients).orderBy(asc(schema.clients.name)).all();
  return <ClientsList clients={clients} />;
}

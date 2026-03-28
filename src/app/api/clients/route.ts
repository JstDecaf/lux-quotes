import { db, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export async function GET() {
  const clients = db.select().from(schema.clients).orderBy(asc(schema.clients.name)).all();
  return Response.json(clients);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, contactName, contactEmail, contactPhone, address, notes } = body;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const result = db.insert(schema.clients).values({
    name,
    contactName: contactName ?? null,
    contactEmail: contactEmail ?? null,
    contactPhone: contactPhone ?? null,
    address: address ?? null,
    notes: notes ?? null,
  }).returning().get();

  return Response.json(result, { status: 201 });
}

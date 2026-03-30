import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = parseInt(id);

  const client = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).get();
  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  const projects = await db.select().from(schema.projects).where(eq(schema.projects.clientId, clientId)).all();

  return Response.json({ ...client, projects });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = parseInt(id);
  const body = await request.json();

  const [result] = await db.update(schema.clients)
    .set({
      ...body,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.clients.id, clientId))
    .returning();

  if (!result) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = parseInt(id);

  await db.delete(schema.clients).where(eq(schema.clients.id, clientId)).run();
  return Response.json({ ok: true });
}

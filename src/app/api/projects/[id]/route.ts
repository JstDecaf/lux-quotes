import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);

  const project = db
    .select({
      id: schema.projects.id,
      clientId: schema.projects.clientId,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
      clientName: schema.clients.name,
    })
    .from(schema.projects)
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const quotes = db.select().from(schema.quotes).where(eq(schema.quotes.projectId, projectId)).all();

  return Response.json({ ...project, quotes });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await request.json();

  const result = db.update(schema.projects)
    .set({
      ...body,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.projects.id, projectId))
    .returning()
    .get();

  if (!result) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);

  db.delete(schema.projects).where(eq(schema.projects.id, projectId)).run();
  return Response.json({ ok: true });
}

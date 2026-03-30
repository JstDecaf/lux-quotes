import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  const query = db
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
    .orderBy(asc(schema.projects.name));

  if (clientId) {
    const projects = await query.where(eq(schema.projects.clientId, parseInt(clientId))).all();
    return Response.json(projects);
  }

  const projects = await query.all();
  return Response.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { clientId, name, description, status } = body;

  if (!clientId || !name) {
    return Response.json({ error: "clientId and name are required" }, { status: 400 });
  }

  const [result] = await db.insert(schema.projects).values({
    clientId,
    name,
    description: description ?? null,
    status: status ?? "active",
  }).returning();

  return Response.json(result, { status: 201 });
}

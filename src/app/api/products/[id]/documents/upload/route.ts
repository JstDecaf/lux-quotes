import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { productDocuments } from "@/../drizzle/schema";

const FILE_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
  "video/mp4": "mp4",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = (formData.get("type") as string) || "brochure";
  const docName = (formData.get("name") as string) || file?.name || "Untitled";
  const notes = (formData.get("notes") as string) || null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 50MB." }, { status: 400 });
  }

  const fileType = FILE_TYPE_MAP[file.type] || file.name.split(".").pop() || "bin";
  const blobPath = `products/${productId}/${Date.now()}-${file.name}`;

  const blob = await put(blobPath, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const [result] = await db.insert(productDocuments).values({
    productId,
    name: docName,
    type: docType,
    url: blob.url,
    fileType,
    notes,
  }).returning();

  return NextResponse.json({
    id: result.id,
    url: blob.url,
    fileType,
  }, { status: 201 });
}

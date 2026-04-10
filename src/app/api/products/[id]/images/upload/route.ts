import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { productImages } from "@/../drizzle/schema";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const imageName = (formData.get("name") as string) || file?.name?.replace(/\.[^/.]+$/, "") || "Untitled";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, and WEBP images are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image too large. Maximum 10MB." }, { status: 400 });
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const blobPath = `products/${productId}/images/${Date.now()}-${file.name}`;

  let blob;
  try {
    blob = await put(blobPath, file, {
      access: "private",
      addRandomSuffix: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }

  const [result] = await db.insert(productImages).values({
    productId,
    name: imageName,
    url: blob.url,
    source: "upload",
    fileType: ext,
    fileSize: file.size,
    sortOrder: 0,
  }).returning();

  return NextResponse.json(result, { status: 201 });
}

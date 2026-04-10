import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments, productImages } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { get, put } from "@vercel/blob";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const productId = Number(id);
  const documentId = Number(docId);

  // 1. Look up the document
  const doc = await db.select().from(productDocuments)
    .where(eq(productDocuments.id, documentId)).get();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.fileType !== "pdf") {
    return NextResponse.json({ error: "Document is not a PDF" }, { status: 400 });
  }

  if (!doc.url.includes(".vercel-storage.com")) {
    return NextResponse.json({ error: "Document is not stored in blob storage" }, { status: 400 });
  }

  // 2. Fetch the PDF from blob storage
  let pdfBuffer: ArrayBuffer;
  try {
    const blob = await get(doc.url, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "Could not fetch PDF from storage" }, { status: 500 });
    }
    pdfBuffer = await new Response(blob.stream).arrayBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch PDF: ${msg}` }, { status: 500 });
  }

  // 3. Extract images using mupdf
  let extractedImages: Array<{ data: Uint8Array; pageNum: number; width: number; height: number }> = [];
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pageCount = document.countPages();

    // Render each page at 150 DPI (good balance of quality and size)
    const dpi = 150;
    const scale = dpi / 72; // PDF points are 72 per inch

    for (let i = 0; i < pageCount && i < 30; i++) {
      const page = document.loadPage(i);
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(scale, scale),
        mupdf.ColorSpace.DeviceRGB,
        false
      );
      const png = pixmap.asPNG();
      extractedImages.push({
        data: png,
        pageNum: i + 1,
        width: pixmap.getWidth(),
        height: pixmap.getHeight(),
      });
      pixmap.destroy();
      page.destroy();
    }
    document.destroy();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `PDF extraction failed: ${msg}` }, { status: 500 });
  }

  if (extractedImages.length === 0) {
    return NextResponse.json({ images: [] });
  }

  // 4. Upload each extracted image to blob storage and save to DB
  const savedImages = [];
  const timestamp = Date.now();
  const docName = doc.name.replace(/\.[^/.]+$/, "");

  for (const img of extractedImages) {
    const filename = `${docName}-page-${img.pageNum}.png`;
    const blobPath = `products/${productId}/images/${timestamp}-${filename}`;

    try {
      const blob = await put(blobPath, Buffer.from(img.data), {
        access: "private",
        addRandomSuffix: false,
        contentType: "image/png",
      });

      const [record] = await db.insert(productImages).values({
        productId,
        name: `${docName} — Page ${img.pageNum}`,
        url: blob.url,
        source: "pdf-extract",
        originalDocumentId: documentId,
        fileType: "png",
        fileSize: img.data.length,
        width: img.width,
        height: img.height,
        sortOrder: img.pageNum,
      }).returning();

      savedImages.push(record);
    } catch (err) {
      console.error(`Failed to save extracted image page ${img.pageNum}:`, err);
      // Continue with remaining images
    }
  }

  return NextResponse.json({
    images: savedImages,
    totalPages: extractedImages.length,
    savedCount: savedImages.length,
  });
}

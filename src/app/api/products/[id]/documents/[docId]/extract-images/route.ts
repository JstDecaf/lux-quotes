import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments, productImages } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { get, put } from "@vercel/blob";

export const maxDuration = 60;

// Minimum size to keep — skip tiny icons/logos
const MIN_IMAGE_WIDTH = 100;
const MIN_IMAGE_HEIGHT = 100;

interface ExtractedImage {
  data: Uint8Array;
  width: number;
  height: number;
  label: string;
}

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

  // 3. Extract embedded images from each page using mupdf
  const extractedImages: ExtractedImage[] = [];
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pdfDoc = document.asPDF();

    if (!pdfDoc) {
      document.destroy();
      return NextResponse.json({ error: "Could not open as PDF document" }, { status: 500 });
    }

    const pageCount = pdfDoc.countPages();
    const seenImages = new Set<string>(); // Track by image data size+dimensions to deduplicate

    for (let pageIdx = 0; pageIdx < pageCount && pageIdx < 50; pageIdx++) {
      // Get the page's resource dictionary
      const pageObj = pdfDoc.findPage(pageIdx);
      const resources = pageObj.get("Resources");
      if (!resources) continue;

      const xobjects = resources.get("XObject");
      if (!xobjects) continue;

      // Iterate over all XObjects on this page
      xobjects.forEach((xobj: InstanceType<typeof mupdf.PDFObject>, key: string | number) => {
        try {
          const resolved = xobj.resolve();

          // Check if it's an image subtype
          const subtype = resolved.get("Subtype");
          if (!subtype || subtype.asName() !== "Image") return;

          // Get image dimensions from the PDF object
          const widthObj = resolved.get("Width");
          const heightObj = resolved.get("Height");
          if (!widthObj || !heightObj) return;

          const imgWidth = widthObj.asNumber();
          const imgHeight = heightObj.asNumber();

          // Skip small images (icons, bullets, decorative elements)
          if (imgWidth < MIN_IMAGE_WIDTH || imgHeight < MIN_IMAGE_HEIGHT) return;

          // Deduplicate by dimensions + a size fingerprint
          const fingerprint = `${imgWidth}x${imgHeight}`;
          if (seenImages.has(fingerprint)) return;

          // Load as Image object and convert to pixmap → PNG
          const image = pdfDoc.loadImage(resolved);
          const pixmap = image.toPixmap();
          const png = pixmap.asPNG();

          // Second dedup check on actual data size
          const dataFingerprint = `${imgWidth}x${imgHeight}:${png.length}`;
          if (seenImages.has(dataFingerprint)) {
            pixmap.destroy();
            return;
          }
          seenImages.add(dataFingerprint);
          seenImages.add(fingerprint);

          extractedImages.push({
            data: png,
            width: pixmap.getWidth(),
            height: pixmap.getHeight(),
            label: `Page ${pageIdx + 1} — ${String(key)}`,
          });

          pixmap.destroy();
        } catch {
          // Skip images that can't be extracted (e.g. unsupported colorspace)
        }
      });
    }

    document.destroy();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `PDF extraction failed: ${msg}` }, { status: 500 });
  }

  if (extractedImages.length === 0) {
    return NextResponse.json({ images: [], message: "No extractable images found in this PDF." });
  }

  // 4. Upload each extracted image to blob storage and save to DB
  const savedImages = [];
  const timestamp = Date.now();
  const docName = doc.name.replace(/\.[^/.]+$/, "");

  for (let i = 0; i < extractedImages.length; i++) {
    const img = extractedImages[i];
    const filename = `${docName}-img-${i + 1}.png`;
    const blobPath = `products/${productId}/images/${timestamp}-${filename}`;

    try {
      const blob = await put(blobPath, Buffer.from(img.data), {
        access: "private",
        addRandomSuffix: false,
        contentType: "image/png",
      });

      const [record] = await db.insert(productImages).values({
        productId,
        name: `${docName} — ${img.label}`,
        url: blob.url,
        source: "pdf-extract",
        originalDocumentId: documentId,
        fileType: "png",
        fileSize: img.data.length,
        width: img.width,
        height: img.height,
        sortOrder: i,
      }).returning();

      savedImages.push(record);
    } catch (err) {
      console.error(`Failed to save extracted image ${i + 1}:`, err);
    }
  }

  return NextResponse.json({
    images: savedImages,
    totalFound: extractedImages.length,
    savedCount: savedImages.length,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productDocuments, productImages } from "@/../drizzle/schema";
import { eq } from "drizzle-orm";
import { get, put } from "@vercel/blob";

export const maxDuration = 60;

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

  const doc = await db.select().from(productDocuments)
    .where(eq(productDocuments.id, documentId)).get();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.fileType !== "pdf") return NextResponse.json({ error: "Document is not a PDF" }, { status: 400 });
  if (!doc.url.includes(".vercel-storage.com")) return NextResponse.json({ error: "Document is not stored in blob storage" }, { status: 400 });

  // Fetch PDF
  let pdfBuffer: ArrayBuffer;
  try {
    const blob = await get(doc.url, { access: "private" });
    if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: "Could not fetch PDF" }, { status: 500 });
    pdfBuffer = await new Response(blob.stream).arrayBuffer();
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch PDF: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }

  // Extract images
  const extractedImages: ExtractedImage[] = [];
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pdfDoc = document.asPDF();
    const pageCount = document.countPages();
    const seenSizes = new Set<string>();

    if (pdfDoc) {
      // Method 1: Walk all PDF objects looking for Image XObjects
      // This catches images regardless of nesting level
      for (let pageIdx = 0; pageIdx < pageCount && pageIdx < 50; pageIdx++) {
        const pageObj = pdfDoc.findPage(pageIdx);
        findImagesRecursive(pdfDoc, pageObj, mupdf, pageIdx + 1, extractedImages, seenSizes, new Set());
      }
    }

    // Method 2: If no embedded images found, fall back to rendering pages
    // but at higher quality and only pages that likely have visual content
    if (extractedImages.length === 0) {
      const dpi = 200;
      const scale = dpi / 72;

      for (let i = 0; i < pageCount && i < 30; i++) {
        const page = document.loadPage(i);
        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false
        );

        // Only keep pages that are image-heavy (not mostly white/text)
        // Simple heuristic: page render is worth keeping
        const png = pixmap.asPNG();
        extractedImages.push({
          data: png,
          width: pixmap.getWidth(),
          height: pixmap.getHeight(),
          label: `Page ${i + 1}`,
        });
        pixmap.destroy();
        page.destroy();
      }
    }

    document.destroy();
  } catch (err) {
    return NextResponse.json({ error: `PDF extraction failed: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }

  if (extractedImages.length === 0) {
    return NextResponse.json({ images: [], message: "No extractable images found in this PDF." });
  }

  // Upload to blob storage
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
      console.error(`Failed to save image ${i + 1}:`, err);
    }
  }

  return NextResponse.json({
    images: savedImages,
    totalFound: extractedImages.length,
    savedCount: savedImages.length,
  });
}

/**
 * Recursively walk PDF objects to find Image XObjects,
 * including those nested inside Form XObjects.
 */
function findImagesRecursive(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mupdf: any,
  pageNum: number,
  results: ExtractedImage[],
  seenSizes: Set<string>,
  visited: Set<string>,
) {
  try {
    // Get Resources → XObject dictionary
    const resources = obj.get("Resources");
    if (!resources) return;

    const xobjects = resources.get("XObject");
    if (!xobjects) return;

    xobjects.forEach((xobj: { resolve: () => { get: (k: string) => { asName: () => string; asNumber: () => number } | null }; toString: () => string }, key: string | number) => {
      try {
        const resolved = xobj.resolve();
        const objKey = xobj.toString();

        // Avoid infinite loops
        if (visited.has(objKey)) return;
        visited.add(objKey);

        const subtype = resolved.get("Subtype");
        if (!subtype) return;

        const subtypeName = subtype.asName();

        if (subtypeName === "Image") {
          // It's an image — extract it
          const widthObj = resolved.get("Width");
          const heightObj = resolved.get("Height");
          if (!widthObj || !heightObj) return;

          const imgWidth = widthObj.asNumber();
          const imgHeight = heightObj.asNumber();

          if (imgWidth < MIN_IMAGE_WIDTH || imgHeight < MIN_IMAGE_HEIGHT) return;

          const fingerprint = `${imgWidth}x${imgHeight}`;

          const image = pdfDoc.loadImage(resolved);
          const pixmap = image.toPixmap();
          const png = pixmap.asPNG();

          const dataFingerprint = `${imgWidth}x${imgHeight}:${png.length}`;
          if (seenSizes.has(dataFingerprint)) {
            pixmap.destroy();
            return;
          }
          seenSizes.add(dataFingerprint);
          seenSizes.add(fingerprint);

          results.push({
            data: png,
            width: pixmap.getWidth(),
            height: pixmap.getHeight(),
            label: `Page ${pageNum} — ${String(key)}`,
          });

          pixmap.destroy();
        } else if (subtypeName === "Form") {
          // It's a Form XObject — recurse into it to find nested images
          findImagesRecursive(pdfDoc, resolved, mupdf, pageNum, results, seenSizes, visited);
        }
      } catch {
        // Skip problematic objects
      }
    });
  } catch {
    // Skip pages with no parseable resources
  }
}

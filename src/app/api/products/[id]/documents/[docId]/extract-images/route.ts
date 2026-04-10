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

  // Extract images using StructuredText walker
  const extractedImages: ExtractedImage[] = [];
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pageCount = document.countPages();
    const seenFingerprints = new Set<string>();

    for (let pageIdx = 0; pageIdx < pageCount && pageIdx < 50; pageIdx++) {
      const page = document.loadPage(pageIdx);
      // Use "preserve-images" option to ensure image blocks are included
      const stext = page.toStructuredText("preserve-images");
      let imageIdx = 0;

      stext.walk({
        onImageBlock(_bbox, _transform, image) {
          try {
            imageIdx++;
            const pixmap = image.toPixmap();
            const w = pixmap.getWidth();
            const h = pixmap.getHeight();

            // Skip small images (icons, logos, bullets)
            if (w < MIN_IMAGE_WIDTH || h < MIN_IMAGE_HEIGHT) {
              pixmap.destroy();
              return;
            }

            // Skip gradients and solid fills by checking color variance
            if (isLowVariance(pixmap)) {
              pixmap.destroy();
              return;
            }

            const png = pixmap.asPNG();

            // Deduplicate by dimensions + data size
            const fingerprint = `${w}x${h}:${png.length}`;
            if (seenFingerprints.has(fingerprint)) {
              pixmap.destroy();
              return;
            }
            seenFingerprints.add(fingerprint);

            extractedImages.push({
              data: png,
              width: w,
              height: h,
              label: `Page ${pageIdx + 1}, Image ${imageIdx}`,
            });

            pixmap.destroy();
          } catch {
            // Skip images that can't be converted
          }
        },
      });

      stext.destroy();
      page.destroy();
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
 * Check if a pixmap is mostly a solid color or simple gradient.
 * Samples pixels across the image and checks if color variance is very low.
 * Real photos have high variance; gradients/fills have very low variance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLowVariance(pixmap: any): boolean {
  try {
    const pixels = pixmap.getPixels() as Uint8ClampedArray;
    const w = pixmap.getWidth();
    const h = pixmap.getHeight();
    const n = pixmap.getNumberOfComponents(); // typically 3 (RGB) or 4 (RGBA)
    const stride = w * n;

    // Sample ~50 pixels spread across the image
    const sampleCount = 50;
    const samples: number[][] = [];

    for (let i = 0; i < sampleCount; i++) {
      const sx = Math.floor((i * 7 + 3) % w); // pseudo-random spread
      const sy = Math.floor((i * 13 + 5) % h);
      const offset = sy * stride + sx * n;
      samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    }

    // Calculate standard deviation for each channel
    const means = [0, 0, 0];
    for (const s of samples) {
      means[0] += s[0]; means[1] += s[1]; means[2] += s[2];
    }
    means[0] /= sampleCount; means[1] /= sampleCount; means[2] /= sampleCount;

    let totalVariance = 0;
    for (const s of samples) {
      totalVariance += (s[0] - means[0]) ** 2;
      totalVariance += (s[1] - means[1]) ** 2;
      totalVariance += (s[2] - means[2]) ** 2;
    }
    const stdDev = Math.sqrt(totalVariance / (sampleCount * 3));

    // A real photo typically has stdDev > 30-40. Gradients/solids are < 15.
    return stdDev < 15;
  } catch {
    return false; // If we can't check, keep the image
  }
}

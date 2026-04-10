import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import * as XLSX from "xlsx";

export const maxDuration = 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = Number(id);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const timestamp = Date.now();

  // 1. Upload the original XLS to blob storage
  let xlsUrl: string;
  try {
    const blob = await put(
      `quotes/${quoteId}/source-${timestamp}.xlsx`,
      file,
      { access: "private", addRandomSuffix: false }
    );
    xlsUrl = blob.url;
  } catch (err) {
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }

  // 2. Generate HTML preview of the spreadsheet
  let previewUrl: string | null = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; background: #fff; }
      .sheet-name { font-size: 14px; font-weight: 700; color: #0D1B2A; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #DB412B; }
      .sheet-name:first-child { margin-top: 0; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 24px; font-size: 11px; }
      th, td { border: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; white-space: nowrap; }
      th { background: #f3f4f6; font-weight: 600; color: #374151; }
      td { color: #4b5563; }
      tr:hover td { background: #f9fafb; }
    </style></head><body>`;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const sheetHtml = XLSX.utils.sheet_to_html(ws, { header: "" });
      html += `<div class="sheet-name">${sheetName}</div>`;
      html += sheetHtml;
    }

    html += `</body></html>`;

    const previewBlob = await put(
      `quotes/${quoteId}/preview-${timestamp}.html`,
      Buffer.from(html),
      { access: "private", addRandomSuffix: false, contentType: "text/html" }
    );
    previewUrl = previewBlob.url;
  } catch (err) {
    console.error("Preview generation failed:", err);
    // Not critical — continue without preview
  }

  // 3. Update the quote record
  await db.update(schema.quotes).set({
    sourceFileUrl: xlsUrl,
    sourceFilePreviewUrl: previewUrl,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.quotes.id, quoteId)).run();

  return NextResponse.json({ sourceFileUrl: xlsUrl, sourceFilePreviewUrl: previewUrl });
}

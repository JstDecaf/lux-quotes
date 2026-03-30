import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = parseInt(id);

  if (isNaN(quoteId)) {
    return Response.json({ error: "Invalid quote ID" }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), "scripts", "generate-price-sheet.py");
  const dbPath = path.join(process.cwd(), "data", "lux-quotes.db");
  const outputPath = path.join(
    process.cwd(),
    "data",
    `price-sheet-${quoteId}-${Date.now()}.xlsx`
  );

  try {
    const { stdout, stderr } = await execFileAsync("python3", [
      scriptPath,
      String(quoteId),
      dbPath,
      outputPath,
    ]);

    if (stderr) {
      console.error("Price sheet stderr:", stderr);
    }

    const filePath = stdout.trim();
    const fileBuffer = await readFile(filePath);

    // Clean up temp file
    try {
      await unlink(filePath);
    } catch {
      // ignore cleanup errors
    }

    return new Response(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="LUX-PriceSheet-${quoteId}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Price sheet generation failed:", msg);
    return Response.json(
      { error: "Failed to generate price sheet", details: msg },
      { status: 500 }
    );
  }
}

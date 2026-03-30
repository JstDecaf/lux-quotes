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

  const scriptPath = path.join(process.cwd(), "scripts", "generate-proposal.ts");
  const dbPath = path.join(process.cwd(), "data", "lux-quotes.db");
  const outputPath = path.join(
    process.cwd(),
    "data",
    `proposal-${quoteId}-${Date.now()}.pptx`
  );

  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["tsx", scriptPath, String(quoteId), dbPath, outputPath],
      {
        cwd: process.cwd(),
        timeout: 30000,
      }
    );

    if (stderr) {
      console.error("Proposal stderr:", stderr);
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
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="LUX-Proposal-${quoteId}.pptx"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Proposal generation failed:", msg);
    return Response.json(
      { error: "Failed to generate proposal", details: msg },
      { status: 500 }
    );
  }
}

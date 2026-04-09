import type { NextRequest } from "next/server";

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.MCP_API_KEY;

  if (!expectedKey) return false;
  if (!apiKey) return false;

  return apiKey === expectedKey;
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "Unauthorized. Provide a valid x-api-key header." },
    { status: 401 }
  );
}

import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, asc } from "drizzle-orm";
import {
  calculateLineItem,
  calculateQuoteTotals,
  calculateInstallationItem,
  calculateInstallationTotals,
  computeScreenSqm,
  computeAspectRatio,
  computeTotalPanels,
  computeTotalWeightKg,
  type QuoteSettings,
  type InstallationSettings,
} from "@/lib/calculations";

// ── MCP Protocol Types ──────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

function jsonrpc(id: string | number | undefined, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id: string | number | undefined, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_quotes",
    description:
      "List all quotes in the LUX Quotes system. Returns quote number, name, client, project, status, and financial totals (AUD). Filter by status (draft/active/sent/accepted/declined), client name, or free-text search across quote name, number, client, and project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by quote status: draft, active, sent, accepted, declined" },
        client: { type: "string", description: "Filter by client name (partial match)" },
        search: { type: "string", description: "Search across quote name, number, client name, and project name" },
      },
    },
  },
  {
    name: "get_quote",
    description:
      "Get full details of a specific quote by ID. Returns all quote settings, screen info, line items with calculated per-item pricing (USD cost, AUD cost, AUD sell ex/inc GST, gross profit, reseller pricing), installation items with calculated pricing, and combined totals. This is the same data shown in the LUX Quotes app UI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The quote ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_clients",
    description:
      "List all clients with their contact details, and counts of projects and quotes.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_client",
    description:
      "Get a specific client by ID, including all their projects and quotes with financial summaries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The client ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_projects",
    description:
      "List all projects with their client name and quote summaries. Optionally filter by client ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        clientId: { type: "number", description: "Filter by client ID" },
      },
    },
  },
  {
    name: "list_products",
    description:
      "List all Leyard LED products in the catalogue with their variants (pixel pitch, pricing, specs). Filter by category or search by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Filter by category" },
        search: { type: "string", description: "Search by product name or brand" },
      },
    },
  },
  {
    name: "get_product",
    description:
      "Get full details of a specific product by ID, including all variants with specs and pricing, and associated documents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The product ID" },
      },
      required: ["id"],
    },
  },
];

// ── Tool Handlers ───────────────────────────────────────────────────────────

async function handleListQuotes(args: Record<string, unknown>) {
  const status = args.status as string | undefined;
  const clientName = args.client as string | undefined;
  const search = args.search as string | undefined;

  let rows = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      gstRate: schema.quotes.gstRate,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudCost: schema.quotes.cachedTotalAudCost,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.createdAt))
    .all();

  type Row = typeof rows[number];
  if (status) rows = rows.filter((r: Row) => r.status === status);
  if (clientName) {
    const lc = clientName.toLowerCase();
    rows = rows.filter((r: Row) => r.clientName?.toLowerCase().includes(lc));
  }
  if (search) {
    const lc = search.toLowerCase();
    rows = rows.filter((r: Row) =>
      r.name.toLowerCase().includes(lc) ||
      r.quoteNumber.toLowerCase().includes(lc) ||
      r.clientName?.toLowerCase().includes(lc) ||
      r.projectName?.toLowerCase().includes(lc)
    );
  }

  return { count: rows.length, quotes: rows };
}

async function handleGetQuote(args: Record<string, unknown>) {
  const quoteId = args.id as number;

  const quote = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      defaultResellerMargin: schema.quotes.defaultResellerMargin,
      gstRate: schema.quotes.gstRate,
      depositPct: schema.quotes.depositPct,
      secondTranchePct: schema.quotes.secondTranchePct,
      installationHourlyRate: schema.quotes.installationHourlyRate,
      installationMargin: schema.quotes.installationMargin,
      installationQuotedBy: schema.quotes.installationQuotedBy,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      screenWidthMm: schema.quotes.screenWidthMm,
      screenHeightMm: schema.quotes.screenHeightMm,
      pixelPitchMm: schema.quotes.pixelPitchMm,
      cabinetWidthMm: schema.quotes.cabinetWidthMm,
      cabinetHeightMm: schema.quotes.cabinetHeightMm,
      panelCountW: schema.quotes.panelCountW,
      panelCountH: schema.quotes.panelCountH,
      resolutionW: schema.quotes.resolutionW,
      resolutionH: schema.quotes.resolutionH,
      brightnessNits: schema.quotes.brightnessNits,
      cabinetWeightKg: schema.quotes.cabinetWeightKg,
      supplierQuoteDate: schema.quotes.supplierQuoteDate,
      supplierQuoteRef: schema.quotes.supplierQuoteRef,
      notes: schema.quotes.notes,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      projectId: schema.projects.id,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.quotes.id, quoteId))
    .get();

  if (!quote) return { error: "Quote not found" };

  const rawLineItems = await db.select().from(schema.quoteLineItems).where(eq(schema.quoteLineItems.quoteId, quoteId)).orderBy(schema.quoteLineItems.sortOrder).all();
  const rawInstallItems = await db.select().from(schema.quoteInstallationItems).where(eq(schema.quoteInstallationItems.quoteId, quoteId)).orderBy(schema.quoteInstallationItems.sortOrder).all();

  const quoteSettings: QuoteSettings = {
    fxRate: quote.fxRate, defaultMargin: quote.defaultMargin, defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate, depositPct: quote.depositPct, secondTranchePct: quote.secondTranchePct,
  };
  const installSettings: InstallationSettings = {
    defaultHourlyRate: quote.installationHourlyRate, defaultInstallationMargin: quote.installationMargin, gstRate: quote.gstRate,
  };

  const lineItems = await Promise.all(rawLineItems.map(async (item: typeof rawLineItems[number]) => {
    let productName: string | null = null, variantName: string | null = null, pixelPitch: string | null = null;
    if (item.productVariantId) {
      const v = await db.select({ name: schema.productVariants.name, pixelPitch: schema.productVariants.pixelPitch, productName: schema.products.name })
        .from(schema.productVariants).leftJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
        .where(eq(schema.productVariants.id, item.productVariantId)).get();
      productName = v?.productName ?? null; variantName = v?.name ?? null; pixelPitch = v?.pixelPitch ?? null;
    }
    const calc = calculateLineItem({ qty: item.qty, usdUnitPrice: item.usdUnitPrice ?? 0, marginOverride: item.marginOverride, resellerMarginOverride: item.resellerMarginOverride, isLocal: item.isLocal, audLocalCost: item.audLocalCost ?? 0, isFree: item.isFree }, quoteSettings);
    return { id: item.id, sortOrder: item.sortOrder, itemName: item.itemName, description: item.description, unit: item.unit, qty: item.qty, usdUnitPrice: item.usdUnitPrice, marginOverride: item.marginOverride, isLocal: item.isLocal, audLocalCost: item.audLocalCost, isFree: item.isFree, productName, variantName, pixelPitch, calculated: calc };
  }));

  const installationItems = rawInstallItems.map((item: typeof rawInstallItems[number]) => {
    const calc = calculateInstallationItem({ type: item.type as "hourly" | "fixed", hours: item.hours ?? 0, hourlyRate: item.hourlyRate, fixedCost: item.fixedCost ?? 0, marginOverride: item.marginOverride, isFree: item.isFree }, installSettings);
    return { id: item.id, sortOrder: item.sortOrder, itemName: item.itemName, type: item.type, hours: item.hours, hourlyRate: item.hourlyRate ?? quote.installationHourlyRate, fixedCost: item.fixedCost, marginOverride: item.marginOverride, isFree: item.isFree, notes: item.notes, calculated: calc };
  });

  const productTotals = calculateQuoteTotals(rawLineItems.map((i: typeof rawLineItems[number]) => ({ qty: i.qty, usdUnitPrice: i.usdUnitPrice ?? 0, marginOverride: i.marginOverride, resellerMarginOverride: i.resellerMarginOverride, isLocal: i.isLocal, audLocalCost: i.audLocalCost ?? 0, isFree: i.isFree })), quoteSettings);
  const installTotals = calculateInstallationTotals(rawInstallItems.map((i: typeof rawInstallItems[number]) => ({ type: i.type as "hourly" | "fixed", hours: i.hours ?? 0, hourlyRate: i.hourlyRate, fixedCost: i.fixedCost ?? 0, marginOverride: i.marginOverride, isFree: i.isFree })), installSettings);

  return {
    ...quote,
    screenInfo: {
      screenSqm: computeScreenSqm(quote.screenWidthMm, quote.screenHeightMm),
      aspectRatio: computeAspectRatio(quote.resolutionW, quote.resolutionH),
      totalPanels: computeTotalPanels(quote.panelCountW, quote.panelCountH),
      totalWeightKg: computeTotalWeightKg(quote.panelCountW, quote.panelCountH, quote.cabinetWeightKg),
    },
    lineItems,
    installationItems,
    totals: {
      products: productTotals,
      installation: installTotals,
      combined: {
        totalAudCost: productTotals.totalAudCost + installTotals.totalCost,
        totalAudSellExGst: productTotals.totalAudSellExGst + installTotals.totalSellExGst,
        totalGst: productTotals.totalGst + installTotals.totalGst,
        totalAudSellIncGst: productTotals.totalAudSellIncGst + installTotals.totalSellIncGst,
        totalGrossProfit: productTotals.totalGrossProfit + installTotals.totalGrossProfit,
      },
    },
  };
}

async function handleListClients() {
  const clients = await db.select().from(schema.clients).orderBy(asc(schema.clients.name)).all();
  const enriched = await Promise.all(clients.map(async (client: typeof clients[number]) => {
    const projects = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.clientId, client.id)).all();
    let quoteCount = 0;
    for (const p of projects) {
      const q = await db.select({ id: schema.quotes.id }).from(schema.quotes).where(eq(schema.quotes.projectId, p.id)).all();
      quoteCount += q.length;
    }
    return { ...client, projectCount: projects.length, quoteCount };
  }));
  return { count: enriched.length, clients: enriched };
}

async function handleGetClient(args: Record<string, unknown>) {
  const clientId = args.id as number;
  const client = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).get();
  if (!client) return { error: "Client not found" };

  const projects = await db.select().from(schema.projects).where(eq(schema.projects.clientId, clientId)).all();
  const projectsWithQuotes = await Promise.all(projects.map(async (project: typeof projects[number]) => {
    const quotes = await db.select({
      id: schema.quotes.id, quoteNumber: schema.quotes.quoteNumber, name: schema.quotes.name, status: schema.quotes.status,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst, cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit, createdAt: schema.quotes.createdAt, updatedAt: schema.quotes.updatedAt,
    }).from(schema.quotes).where(eq(schema.quotes.projectId, project.id)).orderBy(desc(schema.quotes.createdAt)).all();
    return { ...project, quotes };
  }));
  return { ...client, projects: projectsWithQuotes };
}

async function handleListProjects(args: Record<string, unknown>) {
  const clientId = args.clientId as number | undefined;
  let rows = await db.select({
    id: schema.projects.id, clientId: schema.projects.clientId, name: schema.projects.name,
    description: schema.projects.description, status: schema.projects.status,
    clientName: schema.clients.name, createdAt: schema.projects.createdAt, updatedAt: schema.projects.updatedAt,
  }).from(schema.projects).leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id)).orderBy(asc(schema.projects.name)).all();

  if (clientId) rows = rows.filter((p: typeof rows[number]) => p.clientId === clientId);

  const enriched = await Promise.all(rows.map(async (project: typeof rows[number]) => {
    const quotes = await db.select({
      id: schema.quotes.id, quoteNumber: schema.quotes.quoteNumber, name: schema.quotes.name, status: schema.quotes.status,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
    }).from(schema.quotes).where(eq(schema.quotes.projectId, project.id)).orderBy(desc(schema.quotes.createdAt)).all();
    return { ...project, quoteCount: quotes.length, quotes };
  }));
  return { count: enriched.length, projects: enriched };
}

async function handleListProducts(args: Record<string, unknown>) {
  const category = args.category as string | undefined;
  const search = args.search as string | undefined;

  let rows = await db.select().from(schema.products).orderBy(asc(schema.products.name)).all();
  if (category) rows = rows.filter((p: typeof rows[number]) => p.category === category);
  if (search) {
    const lc = search.toLowerCase();
    rows = rows.filter((p: typeof rows[number]) => p.name.toLowerCase().includes(lc) || p.brand?.toLowerCase().includes(lc) || p.category?.toLowerCase().includes(lc));
  }

  const withVariants = await Promise.all(rows.map(async (p: typeof rows[number]) => {
    const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)).orderBy(asc(schema.productVariants.pixelPitch)).all();
    return { ...p, applications: p.applications ? JSON.parse(p.applications) : [], variants };
  }));
  return { count: withVariants.length, products: withVariants };
}

async function handleGetProduct(args: Record<string, unknown>) {
  const productId = args.id as number;
  const product = await db.select().from(schema.products).where(eq(schema.products.id, productId)).get();
  if (!product) return { error: "Product not found" };

  const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, productId)).orderBy(asc(schema.productVariants.pixelPitch)).all();
  const documents = await db.select().from(schema.productDocuments).where(eq(schema.productDocuments.productId, productId)).all();
  return { ...product, applications: product.applications ? JSON.parse(product.applications) : [], variants, documents };
}

// ── MCP Protocol Handler ────────────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  list_quotes: handleListQuotes,
  get_quote: handleGetQuote,
  list_clients: handleListClients,
  get_client: handleGetClient,
  list_projects: handleListProjects,
  list_products: handleListProducts,
  get_product: handleGetProduct,
};

export async function POST(request: NextRequest) {
  // Auth check
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.MCP_API_KEY;

  if (!expectedKey) {
    return jsonrpcError(undefined, -32000, "Server misconfigured: MCP_API_KEY not set");
  }

  // Accept key via x-api-key header OR Bearer token
  const providedKey = apiKey || authHeader?.replace("Bearer ", "");
  if (providedKey !== expectedKey) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return jsonrpcError(undefined, -32700, "Parse error");
  }

  const { method, id, params } = body;

  // MCP protocol methods
  switch (method) {
    case "initialize":
      return jsonrpc(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "lux-quotes",
          version: "1.0.0",
        },
      });

    case "notifications/initialized":
      return jsonrpc(id, {});

    case "tools/list":
      return jsonrpc(id, { tools: TOOLS });

    case "tools/call": {
      const toolName = (params as Record<string, unknown>)?.name as string;
      const toolArgs = ((params as Record<string, unknown>)?.arguments ?? {}) as Record<string, unknown>;

      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
      }

      try {
        const result = await handler(toolArgs);
        return jsonrpc(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        });
      } catch (err) {
        return jsonrpc(id, {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        });
      }
    }

    case "ping":
      return jsonrpc(id, {});

    default:
      return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
}

// Allow GET for MCP server discovery/health check
export async function GET() {
  return Response.json({
    name: "lux-quotes",
    version: "1.0.0",
    description: "LUX LED Solutions quote management API. Provides read-only access to quotes, clients, projects, and products.",
    tools: TOOLS.map((t) => t.name),
  });
}

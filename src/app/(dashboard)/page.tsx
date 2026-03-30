export const dynamic = "force-dynamic";

import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_STYLE: Record<string, string> = {
  draft:  "bg-gray-100 text-gray-600",
  sent:   "bg-blue-100 text-blue-700",
  won:    "bg-green-100 text-green-700",
  lost:   "bg-red-100 text-red-600",
};

export default async function Dashboard() {
  // All quotes with client + project names
  const allQuotes = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.updatedAt))
    .all();

  const clientCount = (await db.select({ id: schema.clients.id }).from(schema.clients).all()).length;

  // Aggregate by status
  type QuoteRow = typeof allQuotes[number];
  const byStatus = allQuotes.reduce((acc: Record<string, { count: number; value: number; profit: number }>, q: QuoteRow) => {
    const s = q.status ?? "draft";
    if (!acc[s]) acc[s] = { count: 0, value: 0, profit: 0 };
    acc[s].count++;
    acc[s].value += q.cachedTotalAudSellIncGst ?? 0;
    acc[s].profit += q.cachedTotalGrossProfit ?? 0;
    return acc;
  }, {} as Record<string, { count: number; value: number; profit: number }>);


  const pipeline = (byStatus.draft?.value ?? 0) + (byStatus.sent?.value ?? 0);
  const pipelineCount = (byStatus.draft?.count ?? 0) + (byStatus.sent?.count ?? 0);
  const wonValue = byStatus.won?.value ?? 0;
  const wonCount = byStatus.won?.count ?? 0;
  const sentValue = byStatus.sent?.value ?? 0;
  const sentCount = byStatus.sent?.count ?? 0;

  const recent = allQuotes.slice(0, 8);

  // Pipeline bar widths
  const statusEntries = Object.entries(byStatus) as [string, { count: number; value: number; profit: number }][];
  const totalValue = statusEntries.reduce((s, [, v]) => s + v.value, 0);
  const pct = (v: number) => totalValue > 0 ? `${((v / totalValue) * 100).toFixed(1)}%` : "0%";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-archivo text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/import" className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            ↑ Import XLS
          </Link>
          <Link href="/quotes" className="px-4 py-2 bg-[#DB412B] text-white rounded-lg text-sm font-medium hover:bg-[#c23823] transition-colors">
            + New Quote
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pipeline</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(pipeline)}</p>
          <p className="text-xs text-gray-400 mt-1">{pipelineCount} open {pipelineCount === 1 ? "quote" : "quotes"}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(sentValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{sentCount} awaiting response</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Won</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(wonValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{wonCount} {wonCount === 1 ? "quote" : "quotes"}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clients</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{clientCount}</p>
          <p className="text-xs text-gray-400 mt-1">{allQuotes.length} total quotes</p>
        </div>
      </div>

      {/* Pipeline breakdown bar */}
      {totalValue > 0 && (
        <div className="bg-white rounded-lg border p-5 mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Pipeline Breakdown</p>
          <div className="flex rounded-full overflow-hidden h-4 mb-3">
            {byStatus.won   && <div style={{ width: pct(byStatus.won.value)  }} className="bg-green-500" title={`Won: ${fmt(byStatus.won.value)}`} />}
            {byStatus.sent  && <div style={{ width: pct(byStatus.sent.value) }} className="bg-blue-400"  title={`Sent: ${fmt(byStatus.sent.value)}`} />}
            {byStatus.draft && <div style={{ width: pct(byStatus.draft.value)}} className="bg-gray-200"  title={`Draft: ${fmt(byStatus.draft.value)}`} />}
            {byStatus.lost  && <div style={{ width: pct(byStatus.lost.value) }} className="bg-red-300"   title={`Lost: ${fmt(byStatus.lost.value)}`} />}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {[
              { key: "won",   label: "Won",   color: "bg-green-500" },
              { key: "sent",  label: "Sent",  color: "bg-blue-400" },
              { key: "draft", label: "Draft", color: "bg-gray-300" },
              { key: "lost",  label: "Lost",  color: "bg-red-300" },
            ].filter(({ key }) => byStatus[key]).map(({ key, label, color }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                {label}: {fmt(byStatus[key].value)} ({byStatus[key].count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent quotes */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-archivo text-sm font-semibold text-gray-900">Recent Quotes</h2>
          <Link href="/quotes" className="text-xs text-[#DB412B] hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Quote</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Value inc-GST</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((q: QuoteRow) => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-medium text-[#DB412B] hover:underline">
                      {q.quoteNumber}
                    </Link>
                    <p className="text-xs text-gray-500 truncate max-w-[180px]">{q.name}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{q.clientName ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{q.projectName ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[q.status ?? "draft"] ?? "bg-gray-100 text-gray-600"}`}>
                      {q.status ?? "draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {q.cachedTotalAudSellIncGst ? fmt(q.cachedTotalAudSellIncGst) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">
                    {q.cachedTotalGrossProfit ? fmt(q.cachedTotalGrossProfit) : "—"}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                    No quotes yet. <Link href="/import" className="text-[#DB412B] hover:underline">Import an XLS</Link> to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { db, schema } from "@/lib/db";
import { eq, desc, gte, asc } from "drizzle-orm";
import Link from "next/link";
import { DashboardFxChart } from "@/components/dashboard-fx-chart";
import { DashboardFxSensitivity } from "@/components/dashboard-fx-sensitivity";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_STYLE: Record<string, string> = {
  draft:           "bg-gray-100 text-gray-600",
  active:          "bg-orange-100 text-orange-600",
  sent:            "bg-blue-100 text-blue-700",
  won:             "bg-green-100 text-green-700",
  lost:            "bg-red-100 text-red-600",
  expired:         "bg-yellow-100 text-yellow-700",
  converted_to_pi: "bg-purple-100 text-purple-700",
};

export default async function Dashboard() {
  // All quotes
  const allQuotes = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      validUntil: schema.quotes.validUntil,
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

  const pipeline = (byStatus.active?.value ?? 0) + (byStatus.sent?.value ?? 0);
  const pipelineCount = (byStatus.active?.count ?? 0) + (byStatus.sent?.count ?? 0);
  const wonValue = byStatus.won?.value ?? 0;
  const wonCount = byStatus.won?.count ?? 0;
  const sentValue = byStatus.sent?.value ?? 0;
  const sentCount = byStatus.sent?.count ?? 0;

  // Win rate
  const wonTotal = byStatus.won?.count ?? 0;
  const lostTotal = byStatus.lost?.count ?? 0;
  const winRate = wonTotal + lostTotal > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 100) : null;

  // FX P/L impact across active quotes
  const latestSnapshots = await db.select().from(schema.quoteFxSnapshots)
    .orderBy(desc(schema.quoteFxSnapshots.date)).all();
  // Get latest snapshot per quote
  const latestByQuote = new Map<number, number>();
  for (const snap of latestSnapshots) {
    if (!latestByQuote.has(snap.quoteId)) {
      latestByQuote.set(snap.quoteId, snap.plImpactAud);
    }
  }
  const activeQuoteIds = new Set(
    allQuotes.filter((q: QuoteRow) => q.status === "active" || q.status === "sent").map((q: QuoteRow) => q.id)
  );
  let totalFxPl = 0;
  for (const [qId, pl] of latestByQuote) {
    if (activeQuoteIds.has(qId)) totalFxPl += pl;
  }

  // Expiring soon (within 7 days)
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const expiringSoon = allQuotes.filter(
    (q: QuoteRow) => q.validUntil && q.validUntil <= sevenDaysOut && q.validUntil >= today && (q.status === "active" || q.status === "sent")
  );
  const alreadyExpired = allQuotes.filter(
    (q: QuoteRow) => q.validUntil && q.validUntil < today && (q.status === "active" || q.status === "sent")
  );

  // FX rate history (6 months)
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000).toISOString().split("T")[0];
  const fxHistory = await db.select().from(schema.fxRateHistory)
    .where(gte(schema.fxRateHistory.date, sixMonthsAgo))
    .orderBy(asc(schema.fxRateHistory.date)).all();

  const currentRate = fxHistory.length > 0 ? fxHistory[fxHistory.length - 1].rateAudUsd : 0;

  // Average quoted rate across active/sent quotes
  const activeSentQuotes = allQuotes.filter((q: QuoteRow) => q.status === "active" || q.status === "sent");
  const avgQuotedRate = activeSentQuotes.length > 0
    ? activeSentQuotes.reduce((s: number, q: QuoteRow) => s + q.fxRate, 0) / activeSentQuotes.length
    : null;

  // Total USD pipeline exposure
  const totalPipelineUsd = activeSentQuotes.reduce((s: number, q: QuoteRow) => s + (q.cachedTotalUsd ?? 0), 0);

  // Shipping summary
  const latestShipping = await db.select().from(schema.shippingCosts)
    .orderBy(desc(schema.shippingCosts.date)).all();
  const latestSea = latestShipping.find((s: typeof latestShipping[number]) => s.mode.startsWith("sea") && s.costPerCbm);
  const latestAir = latestShipping.find((s: typeof latestShipping[number]) => s.mode === "air" && s.costPerCbm);

  const recent = allQuotes.slice(0, 8);
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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Win Rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{winRate !== null ? `${winRate}%` : "—"}</p>
          <p className="text-xs text-gray-400 mt-1">{wonTotal}W / {lostTotal}L</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">FX P/L Impact</p>
          <p className={`text-2xl font-bold mt-1 ${totalFxPl >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totalFxPl !== 0 ? (totalFxPl >= 0 ? "+" : "") + fmt(totalFxPl) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">across active quotes</p>
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
            {byStatus.won    && <div style={{ width: pct(byStatus.won.value)    }} className="bg-green-500"  title={`Won: ${fmt(byStatus.won.value)}`} />}
            {byStatus.sent   && <div style={{ width: pct(byStatus.sent.value)   }} className="bg-blue-400"   title={`Sent: ${fmt(byStatus.sent.value)}`} />}
            {byStatus.active && <div style={{ width: pct(byStatus.active.value) }} className="bg-orange-400" title={`Active: ${fmt(byStatus.active.value)}`} />}
            {byStatus.draft  && <div style={{ width: pct(byStatus.draft.value)  }} className="bg-gray-200"   title={`Draft: ${fmt(byStatus.draft.value)}`} />}
            {byStatus.lost   && <div style={{ width: pct(byStatus.lost.value)   }} className="bg-red-300"    title={`Lost: ${fmt(byStatus.lost.value)}`} />}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {[
              { key: "won",    label: "Won",    color: "bg-green-500" },
              { key: "sent",   label: "Sent",   color: "bg-blue-400" },
              { key: "active", label: "Active", color: "bg-orange-400" },
              { key: "draft",  label: "Draft",  color: "bg-gray-300" },
              { key: "lost",   label: "Lost",   color: "bg-red-300" },
            ].filter(({ key }) => byStatus[key]).map(({ key, label, color }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                {label}: {fmt(byStatus[key].value)} ({byStatus[key].count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* FX Chart + Sensitivity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <DashboardFxChart
            initialData={fxHistory.map((r: typeof fxHistory[number]) => ({ date: r.date, rateAudUsd: r.rateAudUsd }))}
            avgQuotedRate={avgQuotedRate}
          />
        </div>
        <DashboardFxSensitivity
          totalPipelineUsd={totalPipelineUsd}
          currentRate={currentRate}
          avgQuotedRate={avgQuotedRate ?? currentRate}
        />
      </div>

      {/* Shipping + Expiring side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Shipping Summary */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Shipping Costs</h3>
            <Link href="/shipping" className="text-xs text-[#DB412B] hover:underline">View all →</Link>
          </div>
          {latestSea || latestAir ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Latest Sea $/CBM</p>
                <p className="text-xl font-bold text-blue-600 mt-1">
                  {latestSea ? `$${latestSea.costPerCbm!.toFixed(0)}` : "—"}
                </p>
                {latestSea && <p className="text-[10px] text-gray-400">{latestSea.date} · {latestSea.forwarder ?? "—"}</p>}
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Latest Air $/CBM</p>
                <p className="text-xl font-bold text-orange-600 mt-1">
                  {latestAir ? `$${latestAir.costPerCbm!.toFixed(0)}` : "—"}
                </p>
                {latestAir && <p className="text-[10px] text-gray-400">{latestAir.date} · {latestAir.forwarder ?? "—"}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              No shipping data yet. <Link href="/shipping" className="text-blue-600 hover:underline">Add your first entry</Link>
            </p>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quote Alerts</h3>
          {alreadyExpired.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-red-600 mb-1">Expired ({alreadyExpired.length})</p>
              {alreadyExpired.slice(0, 3).map((q: QuoteRow) => (
                <Link key={q.id} href={`/quotes/${q.id}`} className="block text-xs text-gray-600 hover:text-[#DB412B] py-0.5">
                  {q.quoteNumber} — {q.clientName} <span className="text-red-500">({q.validUntil})</span>
                </Link>
              ))}
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1">Expiring within 7 days ({expiringSoon.length})</p>
              {expiringSoon.map((q: QuoteRow) => {
                const daysLeft = Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / 86400000);
                return (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="block text-xs text-gray-600 hover:text-[#DB412B] py-0.5">
                    {q.quoteNumber} — {q.clientName} <span className="text-amber-500">({daysLeft}d left)</span>
                  </Link>
                );
              })}
            </div>
          )}
          {expiringSoon.length === 0 && alreadyExpired.length === 0 && (
            <p className="text-xs text-gray-400">No quotes expiring soon.</p>
          )}
        </div>
      </div>

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

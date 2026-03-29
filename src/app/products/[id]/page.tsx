import { db } from "@/lib/db";
import { products, productVariants, productDocuments } from "@/../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = db.select().from(products).where(eq(products.id, Number(id))).get();
  if (!product) notFound();

  const variants = db.select().from(productVariants)
    .where(eq(productVariants.productId, Number(id)))
    .orderBy(asc(productVariants.pixelPitch)).all();

  const documents = db.select().from(productDocuments)
    .where(eq(productDocuments.productId, Number(id)))
    .orderBy(asc(productDocuments.type)).all();

  const apps: string[] = product.applications ? JSON.parse(product.applications) : [];

  const STATUS_COLORS: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    "Limited Docs": "bg-yellow-100 text-yellow-700",
    Discontinued: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <Link href="/products" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to catalog
      </Link>

      {/* Product Header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start gap-5">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-32 h-32 object-cover rounded-lg border bg-gray-100 flex-shrink-0"
            />
          ) : (
            <div className="w-32 h-32 rounded-lg border bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-4xl">
              &#9881;
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-archivo text-2xl font-bold text-gray-900">{product.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[product.status] || "bg-gray-100"}`}>
                {product.status}
              </span>
            </div>
            <p className="text-gray-600 mb-3">{product.description}</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span><strong>Brand:</strong> {product.brand}</span>
              <span><strong>Sub-brand:</strong> {product.subBrand}</span>
              <span><strong>Category:</strong> {product.category}</span>
            </div>
          </div>
        </div>

        {apps.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500 mr-2">Applications:</span>
            {apps.map((app) => (
              <span key={app} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded mr-1">{app}</span>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-bold text-gray-800">Variants ({variants.length})</h2>
        </div>

        {variants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Variant</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Pitch</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">USD/sqm</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">GOB</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Cabinet Size</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Resolution</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Pixel Config</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Brightness</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Contrast</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Refresh Rate</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Viewing Angle</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Weight</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Avg Power</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Max Power</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">IP Rating</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Temp Range</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b last:border-b-0 hover:bg-blue-50/30">
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{v.name}</td>
                    <td className="px-4 py-2 text-gray-700 font-mono">{v.pixelPitch || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-green-700">
                      {v.pricePerSqmUsd ? `$${v.pricePerSqmUsd.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {v.gob ? <span className="text-green-600 font-bold">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{v.cabinetSize || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.cabinetResolution || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.pixelConfig || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.brightness || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.contrastRatio || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.refreshRate || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.viewingAngle || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.weight || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.powerAvg || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.powerMax || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.ipRating || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{v.operatingTemp || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-400">No variants configured</div>
        )}
      </div>

      {/* Documents & Links */}
      <div className="bg-white rounded-lg border overflow-hidden mt-6">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-bold text-gray-800">Documents & Links ({documents.length})</h2>
        </div>

        {documents.length > 0 ? (
          <div className="divide-y">
            {documents.map((doc) => {
              const TYPE_ICONS: Record<string, string> = {
                brochure: "\uD83D\uDCCB",
                manual: "\uD83D\uDCD6",
                spec_sheet: "\uD83D\uDCCA",
                video: "\uD83C\uDFAC",
                link: "\uD83C\uDF10",
              };
              const TYPE_LABELS: Record<string, string> = {
                brochure: "Brochure",
                manual: "Manual",
                spec_sheet: "Spec Sheet",
                video: "Video",
                link: "Web Link",
              };
              const TYPE_COLORS: Record<string, string> = {
                brochure: "bg-orange-100 text-orange-700",
                manual: "bg-blue-100 text-blue-700",
                spec_sheet: "bg-green-100 text-green-700",
                video: "bg-purple-100 text-purple-700",
                link: "bg-gray-100 text-gray-600",
              };
              const isNAS = doc.url.startsWith("file:///Volumes/BUSINESS/");
              return (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{TYPE_ICONS[doc.type] || "\uD83D\uDCC4"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[doc.type] || "bg-gray-100"}`}>
                          {TYPE_LABELS[doc.type] || doc.type}
                        </span>
                        {isNAS && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">NAS</span>
                        )}
                      </div>
                      {doc.notes && <p className="text-xs text-gray-500 mt-0.5">{doc.notes}</p>}
                    </div>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {isNAS ? "Open Folder" : "Open"} →
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No documents or links added yet
          </div>
        )}
      </div>
    </div>
  );
}

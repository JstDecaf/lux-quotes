"use client";

import { useState } from "react";

interface Variant {
  id: number;
  name: string;
  pixelPitch: string | null;
  pricePerSqmUsd: number | null;
  cabinetSize: string | null;
  cabinetResolution: string | null;
  pixelConfig: string | null;
  brightness: string | null;
  contrastRatio: string | null;
  refreshRate: string | null;
  viewingAngle: string | null;
  weight: string | null;
  powerAvg: string | null;
  powerMax: string | null;
  ipRating: string | null;
  operatingTemp: string | null;
  gob: boolean;
}

interface Document {
  id: number;
  name: string;
  type: string;
  url: string;
  fileType: string | null;
  notes: string | null;
}

interface Product {
  id: number;
  name: string;
  brand: string | null;
  subBrand: string | null;
  category: string | null;
  status: string;
  description: string | null;
  applications: string[];
  variants: Variant[];
  documents: Document[];
  imageUrl: string | null;
}

const CATEGORIES = [
  "All",
  "Indoor Fixed",
  "Fine Pitch",
  "Outdoor",
  "Transparent LED",
  "Flexible LED",
  "Interactive",
  "Indoor Rental",
  "Controller",
];

const PRODUCT_STATUSES = ["Active", "Limited Docs", "Discontinued"];

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  "Limited Docs": "bg-yellow-100 text-yellow-700",
  Discontinued: "bg-red-100 text-red-700",
};

function ProductCardComponent({ product: initialProduct, isExpanded, onToggle }: {
  product: Product;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [product, setProduct] = useState(initialProduct);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fmt = (n: number | null) => (n != null ? `$${n.toLocaleString()}` : "\u2014");

  const saveProduct = async () => {
    setSaving(true);
    try {
      await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          brand: product.brand,
          subBrand: product.subBrand,
          category: product.category,
          status: product.status,
          description: product.description,
          applications: product.applications,
        }),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Product Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-gray-50 -mx-4 -my-3 px-4 py-3"
          onClick={onToggle}
        >
          <div className="text-lg">
            {isExpanded ? "\u25BE" : "\u25B8"}
          </div>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-14 h-14 object-cover rounded border bg-gray-100 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-14 h-14 rounded border bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-2xl">
              &#9881;
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editing ? (
                <input
                  className="border rounded px-2 py-1 text-sm font-bold"
                  value={product.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                />
              ) : (
                <h3 className="font-bold text-gray-900">{product.name}</h3>
              )}
              {!editing && (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[product.status] || "bg-gray-100 text-gray-600"}`}>
                    {product.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {product.category}
                  </span>
                  {product.subBrand === "Vteam" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">Vteam</span>
                  )}
                </>
              )}
            </div>
            {!editing && <p className="text-sm text-gray-500 mt-0.5 truncate">{product.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {editing ? (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={saveProduct}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-[#0D1B2A] text-white rounded disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setProduct(initialProduct); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-500 border rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border rounded hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          <div className="text-right">
            <span className="text-sm font-medium text-gray-500">
              {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
            </span>
            {product.variants.some((v) => v.pricePerSqmUsd) && (
              <p className="text-xs text-gray-400">
                {fmt(Math.min(...product.variants.filter((v) => v.pricePerSqmUsd).map((v) => v.pricePerSqmUsd!)))}
                {" \u2013 "}
                {fmt(Math.max(...product.variants.filter((v) => v.pricePerSqmUsd).map((v) => v.pricePerSqmUsd!)))}
                /sqm
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Inline Edit Fields */}
      {editing && (
        <div className="border-t px-4 py-3 bg-gray-50" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Brand</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={product.brand ?? ""}
                onChange={(e) => setProduct({ ...product, brand: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sub-Brand</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={product.subBrand ?? ""}
                onChange={(e) => setProduct({ ...product, subBrand: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={product.category ?? ""}
                onChange={(e) => setProduct({ ...product, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={product.status}
                onChange={(e) => setProduct({ ...product, status: e.target.value })}
              >
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              className="w-full border rounded px-2 py-1.5 text-sm min-h-[60px]"
              value={product.description ?? ""}
              onChange={(e) => setProduct({ ...product, description: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Expanded Detail */}
      {isExpanded && !editing && (
        <div className="border-t">
          {/* Applications */}
          {product.applications.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b">
              <span className="text-xs text-gray-500 mr-2">Applications:</span>
              {product.applications.map((app) => (
                <span key={app} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded mr-1">{app}</span>
              ))}
            </div>
          )}

          {/* Documents & Links */}
          {product.documents.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500">Resources:</span>
              {product.documents.map((doc) => {
                const isNAS = doc.url.startsWith("file:///");
                const icons: Record<string, string> = {
                  brochure: "\uD83D\uDCCB",
                  manual: "\uD83D\uDCD6",
                  spec_sheet: "\uD83D\uDCCA",
                  video: "\uD83C\uDFAC",
                  link: "\uD83C\uDF10",
                };
                return (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-white border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition"
                    title={doc.notes || undefined}
                  >
                    <span>{icons[doc.type] || "\uD83D\uDCC4"}</span>
                    <span>{doc.name}</span>
                    {isNAS && <span className="text-yellow-600 text-[10px]">(NAS)</span>}
                  </a>
                );
              })}
              <a
                href={`/products/${product.id}`}
                className="text-xs text-gray-400 hover:text-blue-600 ml-auto"
              >
                View all &rarr;
              </a>
            </div>
          )}

          {/* Variants Table */}
          {product.variants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Variant</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Pitch</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">USD/sqm</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">GOB</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Cabinet</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Resolution</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Brightness</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Contrast</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Refresh</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Viewing</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Weight</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Power (Avg/Max)</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">IP</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="border-b last:border-b-0 hover:bg-blue-50/30">
                      <td className="px-3 py-2 font-medium text-gray-900">{v.name}</td>
                      <td className="px-3 py-2 text-gray-700">{v.pixelPitch || "\u2014"}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-green-700">
                        {v.pricePerSqmUsd ? `$${v.pricePerSqmUsd.toLocaleString()}` : "\u2014"}
                      </td>
                      <td className="px-3 py-2">
                        {v.gob ? <span className="text-green-600 font-bold">&#10003;</span> : ""}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{v.cabinetSize || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.cabinetResolution || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.brightness || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.contrastRatio || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.refreshRate || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.viewingAngle || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.weight || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {v.powerAvg || v.powerMax ? `${v.powerAvg || "\u2014"} / ${v.powerMax || "\u2014"}` : "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{v.ipRating || "\u2014"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.operatingTemp || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              No variants configured yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductCatalog({ initialProducts }: { initialProducts: Product[] }) {
  const [products] = useState<Product[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.variants.some((v) => v.name.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((cat) => {
          const count = cat === "All" ? products.length : products.filter((p) => p.category === cat).length;
          if (count === 0 && cat !== "All") return null;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                selectedCategory === cat
                  ? "bg-[#0D1B2A] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products or variants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Product Cards */}
      <div className="space-y-3">
        {filtered.map((product) => (
          <ProductCardComponent
            key={product.id}
            product={product}
            isExpanded={expandedProduct === product.id}
            onToggle={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No products match your filters
        </div>
      )}
    </div>
  );
}

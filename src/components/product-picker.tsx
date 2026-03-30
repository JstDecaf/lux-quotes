"use client";

import { useState, useEffect, useRef } from "react";

interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  pixelPitch: string | null;
  pricePerSqmUsd: number | null;
  cabinetSize: string | null;
  weight: string | null;
}

interface Product {
  id: number;
  name: string;
  brand: string | null;
  subBrand: string | null;
  category: string | null;
  status: string;
  variants: ProductVariant[];
  applications: string[];
}

interface ProductSelection {
  productId: number;
  productName: string;
  variantId: number | null;
  variantName: string | null;
  pixelPitch: string | null;
  weight: string | null;
  pricePerSqmUsd: number | null;
}

interface ProductPickerProps {
  onSelect: (selection: ProductSelection) => void;
  onClose: () => void;
}

export function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/products?withVariants=true")
      .then((r) => r.json())
      .then((data: Product[]) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Focus search on mount
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      p.variants.some(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.pixelPitch ?? "").toLowerCase().includes(q)
      )
    );
  });

  const handleSelectProductOnly = (product: Product) => {
    onSelect({
      productId: product.id,
      productName: product.name,
      variantId: null,
      variantName: null,
      pixelPitch: null,
      weight: null,
      pricePerSqmUsd: null,
    });
  };

  const handleSelectVariant = (product: Product, variant: ProductVariant) => {
    onSelect({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      pixelPitch: variant.pixelPitch,
      weight: variant.weight,
      pricePerSqmUsd: variant.pricePerSqmUsd,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-[#0D1B2A] font-archivo">Select from Product Catalog</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search products by name, category, pixel pitch..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#DB412B] focus:ring-1 focus:ring-[#DB412B]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Product list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {loading && (
            <div className="text-center text-gray-400 py-12 text-sm">Loading products...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-gray-400 py-12 text-sm">No products found</div>
          )}
          {!loading && filtered.map((product) => {
            const isExpanded = expandedProductId === product.id;
            const pitches = [...new Set(product.variants.map((v) => v.pixelPitch).filter(Boolean))].join(", ");

            return (
              <div
                key={product.id}
                className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? "border-[#DB412B] shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
              >
                {/* Product card header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#0D1B2A] text-sm truncate">{product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {product.category && (
                        <span className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{product.category}</span>
                      )}
                      {pitches && (
                        <span className="text-xs text-gray-500">{pitches}mm pitch</span>
                      )}
                      {product.variants.length > 0 && (
                        <span className="text-xs text-gray-400">{product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded variant list */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                    {/* Link product only */}
                    <button
                      onClick={() => handleSelectProductOnly(product)}
                      className="w-full text-left text-xs text-gray-500 hover:text-[#DB412B] py-1 flex items-center gap-1.5 italic"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Link product only (no specific variant)
                    </button>

                    {product.variants.length === 0 && (
                      <div className="text-xs text-gray-400 italic">No variants configured</div>
                    )}

                    {/* Variant buttons */}
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => handleSelectVariant(product, variant)}
                        className="w-full text-left border border-white bg-white rounded-lg px-3 py-2 hover:border-[#DB412B] hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-[#0D1B2A] group-hover:text-[#DB412B] truncate">
                              {variant.name}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                              {variant.pixelPitch && (
                                <span>{variant.pixelPitch}mm pitch</span>
                              )}
                              {variant.cabinetSize && (
                                <span>{variant.cabinetSize}</span>
                              )}
                              {variant.weight && (
                                <span>{variant.weight} kg/sqm</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {variant.pricePerSqmUsd != null ? (
                              <span className="text-sm font-semibold text-[#0D1B2A]">
                                US${variant.pricePerSqmUsd.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/sqm
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">No price</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductImageGallery, type ProductImage } from "./product-image-gallery";

interface Variant {
  id: number;
  productId: number;
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
  imageUrl: string | null;
  variants: Variant[];
  documents: Document[];
  images: ProductImage[];
}

const CATEGORIES = [
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

const VARIANT_FIELDS: { key: keyof Variant; label: string; type: "text" | "number" | "boolean"; width: string }[] = [
  { key: "name", label: "Variant", type: "text", width: "min-w-[120px]" },
  { key: "pixelPitch", label: "Pitch", type: "text", width: "w-20" },
  { key: "pricePerSqmUsd", label: "USD/sqm", type: "number", width: "w-24" },
  { key: "gob", label: "GOB", type: "boolean", width: "w-16" },
  { key: "cabinetSize", label: "Cabinet", type: "text", width: "w-28" },
  { key: "cabinetResolution", label: "Resolution", type: "text", width: "w-28" },
  { key: "pixelConfig", label: "Pixel Config", type: "text", width: "w-24" },
  { key: "brightness", label: "Brightness", type: "text", width: "w-24" },
  { key: "contrastRatio", label: "Contrast", type: "text", width: "w-24" },
  { key: "refreshRate", label: "Refresh", type: "text", width: "w-24" },
  { key: "viewingAngle", label: "Viewing", type: "text", width: "w-24" },
  { key: "weight", label: "Weight", type: "text", width: "w-20" },
  { key: "powerAvg", label: "Avg Power", type: "text", width: "w-24" },
  { key: "powerMax", label: "Max Power", type: "text", width: "w-24" },
  { key: "ipRating", label: "IP", type: "text", width: "w-20" },
  { key: "operatingTemp", label: "Temp", type: "text", width: "w-24" },
];

const DOC_TYPES = ["brochure", "manual", "spec_sheet", "video", "link"] as const;
const FILE_TYPES = ["pdf", "xlsx", "mp4", "jpg", "png", "webp", "web"] as const;

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

function emptyDoc(productId: number): Document {
  return { id: 0, name: "", type: "link", url: "", fileType: "web", notes: "" };
}

export function ProductDetailEditor({ initialProduct }: { initialProduct: Product }) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [variants, setVariants] = useState<Variant[]>(initialProduct.variants);
  const [documents, setDocuments] = useState<Document[]>(initialProduct.documents);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<{ variantId: number; field: string } | null>(null);
  const [showDeleteVariant, setShowDeleteVariant] = useState<number | null>(null);
  const [showDeleteProduct, setShowDeleteProduct] = useState(false);
  const [newApp, setNewApp] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Document editing state
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editDocDraft, setEditDocDraft] = useState<Document | null>(null);
  const [addingDoc, setAddingDoc] = useState(false);
  const [newDocDraft, setNewDocDraft] = useState<Document>(emptyDoc(product.id));
  const [showDeleteDoc, setShowDeleteDoc] = useState<number | null>(null);

  // Image library state
  const [images, setImages] = useState<ProductImage[]>(initialProduct.images);
  const [extractingDocId, setExtractingDocId] = useState<number | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ---- Product CRUD ----
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
          imageUrl: product.imageUrl,
          applications: product.applications,
        }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    router.push("/products");
    router.refresh();
  };

  // ---- Variant CRUD ----
  const autoSaveVariant = useCallback(
    (variant: Variant) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/products/${product.id}/variants/${variant.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(variant),
          });
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [product.id]
  );

  const updateVariantField = (variantId: number, field: string, value: unknown) => {
    const updated = variants.map((v) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );
    setVariants(updated);
    const variant = updated.find((v) => v.id === variantId);
    if (variant) autoSaveVariant(variant);
  };

  const addVariant = async () => {
    const res = await fetch(`/api/products/${product.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Variant" }),
    });
    const data = await res.json();
    const newVariant: Variant = {
      id: Number(data.id),
      productId: product.id,
      name: "New Variant",
      pixelPitch: null,
      pricePerSqmUsd: null,
      cabinetSize: null,
      cabinetResolution: null,
      pixelConfig: null,
      brightness: null,
      contrastRatio: null,
      refreshRate: null,
      viewingAngle: null,
      weight: null,
      powerAvg: null,
      powerMax: null,
      ipRating: null,
      operatingTemp: null,
      gob: false,
    };
    setVariants([...variants, newVariant]);
    setEditingCell({ variantId: Number(data.id), field: "name" });
  };

  const deleteVariant = async (variantId: number) => {
    await fetch(`/api/products/${product.id}/variants/${variantId}`, { method: "DELETE" });
    setVariants(variants.filter((v) => v.id !== variantId));
    setShowDeleteVariant(null);
  };

  // ---- Application tags ----
  const addApplication = () => {
    if (newApp.trim() && !product.applications.includes(newApp.trim())) {
      setProduct({ ...product, applications: [...product.applications, newApp.trim()] });
      setNewApp("");
    }
  };

  const removeApplication = (app: string) => {
    setProduct({ ...product, applications: product.applications.filter((a) => a !== app) });
  };

  // ---- Document CRUD ----
  const startEditDoc = (doc: Document) => {
    setEditingDocId(doc.id);
    setEditDocDraft({ ...doc });
  };

  const cancelEditDoc = () => {
    setEditingDocId(null);
    setEditDocDraft(null);
  };

  const saveEditDoc = async () => {
    if (!editDocDraft) return;
    setSaving(true);
    try {
      await fetch(`/api/products/${product.id}/documents/${editDocDraft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDocDraft),
      });
      setDocuments(documents.map((d) => (d.id === editDocDraft.id ? { ...editDocDraft } : d)));
      setEditingDocId(null);
      setEditDocDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (docId: number) => {
    await fetch(`/api/products/${product.id}/documents/${docId}`, { method: "DELETE" });
    setDocuments(documents.filter((d) => d.id !== docId));
    setShowDeleteDoc(null);
  };

  const saveNewDoc = async () => {
    if (!newDocDraft.name || !newDocDraft.url) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDocDraft),
      });
      const data = await res.json();
      setDocuments([...documents, { ...newDocDraft, id: Number(data.id) }]);
      setAddingDoc(false);
      setNewDocDraft(emptyDoc(product.id));
    } finally {
      setSaving(false);
    }
  };

  // ---- File upload ----
  const uploadFile = async (file: File, docType?: string) => {
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("type", docType || guessDocType(file));

      const res = await fetch(`/api/products/${product.id}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
          // response wasn't JSON
        }
        setUploadError(msg);
        return;
      }

      const data = await res.json();
      setDocuments([...documents, {
        id: Number(data.id),
        name: file.name.replace(/\.[^/.]+$/, ""),
        type: docType || guessDocType(file),
        url: data.url,
        fileType: data.fileType,
        notes: null,
      }]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      uploadFile(files[i]);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      uploadFile(files[i]);
    }
  };

  function guessDocType(file: File): string {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type === "application/pdf" || ext === "pdf") return "brochure";
    if (file.type.startsWith("video/") || ext === "mp4") return "video";
    if (ext === "xlsx" || ext === "xls") return "spec_sheet";
    if (file.type.startsWith("image/")) return "brochure";
    return "link";
  }

  // ---- PDF image extraction ----
  const extractImagesFromPdf = async (docId: number) => {
    setExtractingDocId(docId);
    try {
      const res = await fetch(`/api/products/${product.id}/documents/${docId}/extract-images`, {
        method: "POST",
      });
      if (!res.ok) {
        let msg = "Extraction failed";
        try { const err = await res.json(); msg = err.error || msg; } catch {}
        alert(msg);
        return;
      }
      const data = await res.json();
      if (data.images?.length) {
        setImages((prev) => [...prev, ...data.images]);
      } else {
        alert("No images found in this PDF.");
      }
    } catch {
      alert("Extraction failed. Please try again.");
    } finally {
      setExtractingDocId(null);
    }
  };

  // ---- Render helpers ----
  const renderDocRow = (doc: Document, isNew: boolean, draft: Document, setDraft: (d: Document) => void, onSave: () => void, onCancel: () => void) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 py-3 bg-green-50/40">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 flex-1 w-full">
        <input
          className="border rounded px-2 py-1.5 text-sm bg-white"
          placeholder="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <select
          className="border rounded px-2 py-1.5 text-sm bg-white"
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>
        <input
          className="border rounded px-2 py-1.5 text-sm bg-white sm:col-span-2"
          placeholder="URL"
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
        <select
          className="border rounded px-2 py-1.5 text-sm bg-white"
          value={draft.fileType ?? "web"}
          onChange={(e) => setDraft({ ...draft, fileType: e.target.value })}
        >
          {FILE_TYPES.map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <input
        className="border rounded px-2 py-1.5 text-sm bg-white w-full sm:w-40"
        placeholder="Notes"
        value={draft.notes ?? ""}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onSave}
          disabled={!draft.name || !draft.url}
          className="px-3 py-1.5 text-xs bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42] disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <a href="/products" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">&larr; Back to catalog</a>

      {/* Product Header */}
      <div className="bg-white rounded-lg border p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border bg-gray-100 flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg border bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-4xl">
              &#9881;
            </div>
          )}
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                {editing ? (
                  <input
                    className="border rounded px-3 py-1.5 text-xl sm:text-2xl font-archivo font-bold text-[#0D1B2A] w-full sm:w-auto"
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  />
                ) : (
                  <h1 className="font-archivo text-xl sm:text-2xl font-bold text-gray-900">{product.name}</h1>
                )}
                {!editing && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[product.status] || "bg-gray-100"}`}>
                    {product.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saving && <span className="text-xs text-gray-400">Saving...</span>}
                {editing ? (
                  <>
                    <button
                      onClick={saveProduct}
                      disabled={saving}
                      className="px-4 py-1.5 bg-[#0D1B2A] text-white rounded text-sm hover:bg-[#1a2d42] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setProduct(initialProduct); setEditing(false); }}
                      className="px-4 py-1.5 text-gray-500 text-sm border rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {showDeleteProduct ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="text-red-600">Delete product?</span>
                        <button onClick={deleteProduct} className="text-red-600 font-bold hover:text-red-800">Yes</button>
                        <button onClick={() => setShowDeleteProduct(false)} className="text-gray-400 hover:text-gray-600">No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowDeleteProduct(true)}
                        className="px-3 py-1.5 text-sm text-[#DB412B] border border-[#DB412B]/30 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                  value={product.description ?? ""}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  placeholder="Product description..."
                />
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
                      <option value="">Select...</option>
                      {CATEGORIES.map((c) => (
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

                {/* Image URL */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Image URL</label>
                  <div className="flex gap-2 items-start">
                    <input
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                      value={product.imageUrl ?? ""}
                      onChange={(e) => setProduct({ ...product, imageUrl: e.target.value || null })}
                      placeholder="https://..."
                    />
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt="preview"
                        className="w-10 h-10 object-cover rounded border flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>

                {/* Applications editor */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Applications</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {product.applications.map((app) => (
                      <span key={app} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded flex items-center gap-1">
                        {app}
                        <button onClick={() => removeApplication(app)} className="text-blue-400 hover:text-red-500">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="border rounded px-2 py-1 text-sm flex-1"
                      value={newApp}
                      onChange={(e) => setNewApp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addApplication()}
                      placeholder="Add application..."
                    />
                    <button onClick={addApplication} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-3">{product.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span><strong>Brand:</strong> {product.brand}</span>
                  <span><strong>Sub-brand:</strong> {product.subBrand}</span>
                  <span><strong>Category:</strong> {product.category}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!editing && product.applications.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500 mr-2">Applications:</span>
            {product.applications.map((app) => (
              <span key={app} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded mr-1">{app}</span>
            ))}
          </div>
        )}
      </div>

      {/* Variants - Editable Table */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Variants ({variants.length})</h2>
          <button
            onClick={addVariant}
            className="px-3 py-1.5 text-xs bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42]"
          >
            + Add Variant
          </button>
        </div>

        {variants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {VARIANT_FIELDS.map((f) => (
                    <th key={f.key} className={`px-3 py-2 text-left font-medium text-gray-600 text-xs ${f.width}`}>
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b last:border-b-0 hover:bg-blue-50/30">
                    {VARIANT_FIELDS.map((f) => {
                      const isEditing = editingCell?.variantId === v.id && editingCell?.field === f.key;
                      const value = v[f.key];

                      if (f.type === "boolean") {
                        return (
                          <td key={f.key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!value}
                              onChange={(e) => updateVariantField(v.id, f.key, e.target.checked)}
                              className="cursor-pointer"
                            />
                          </td>
                        );
                      }

                      if (isEditing) {
                        return (
                          <td key={f.key} className="px-1 py-1">
                            <input
                              type={f.type}
                              step={f.type === "number" ? "0.01" : undefined}
                              className="w-full border rounded px-2 py-1 text-sm bg-green-50 focus:border-blue-400 focus:outline-none"
                              autoFocus
                              value={(value as string | number | null) ?? ""}
                              onChange={(e) => {
                                const val = f.type === "number"
                                  ? (e.target.value === "" ? null : parseFloat(e.target.value))
                                  : (e.target.value || null);
                                updateVariantField(v.id, f.key, val);
                              }}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={f.key}
                          className={`px-3 py-2 cursor-pointer hover:bg-green-50 rounded ${
                            f.key === "name" ? "font-medium text-gray-900" :
                            f.key === "pricePerSqmUsd" ? "text-right font-mono font-bold text-green-700" :
                            "text-gray-600"
                          }`}
                          onClick={() => setEditingCell({ variantId: v.id, field: f.key })}
                        >
                          {f.key === "pricePerSqmUsd" && value != null
                            ? `$${(value as number).toLocaleString()}`
                            : (value ?? "\u2014")}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      {showDeleteVariant === v.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteVariant(v.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setShowDeleteVariant(null)}
                            className="text-xs text-gray-400"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteVariant(v.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete variant"
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-400">
            No variants configured.{" "}
            <button onClick={addVariant} className="text-blue-600 hover:underline">Add one</button>
          </div>
        )}
      </div>

      {/* Documents & Links */}
      <div
        className={`bg-white rounded-lg border overflow-hidden ${dragOver ? "ring-2 ring-blue-400 bg-blue-50/30" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Documents & Links ({documents.length})</h2>
          <div className="flex items-center gap-2">
            {uploading && <span className="text-xs text-blue-600 animate-pulse">Uploading...</span>}
            {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.mp4,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              ↑ Upload File
            </button>
            {!addingDoc && (
              <button
                onClick={() => setAddingDoc(true)}
                className="px-3 py-1.5 text-xs bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42]"
              >
                + Add Link
              </button>
            )}
          </div>
        </div>

        {documents.length > 0 || addingDoc ? (
          <div className="divide-y">
            {documents.map((doc) => {
              if (editingDocId === doc.id && editDocDraft) {
                return (
                  <div key={doc.id}>
                    {renderDocRow(doc, false, editDocDraft, (d) => setEditDocDraft(d), saveEditDoc, cancelEditDoc)}
                  </div>
                );
              }

              const isNAS = doc.url.startsWith("file:///Volumes/BUSINESS/");
              const isBlob = doc.url.includes(".vercel-storage.com");
              return (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg flex-shrink-0">{TYPE_ICONS[doc.type] || "\uD83D\uDCC4"}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[doc.type] || "bg-gray-100"}`}>
                          {TYPE_LABELS[doc.type] || doc.type}
                        </span>
                        {doc.fileType && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">
                            {doc.fileType}
                          </span>
                        )}
                        {isBlob && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Stored</span>
                        )}
                        {isNAS && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">NAS</span>
                        )}
                      </div>
                      {doc.notes && <p className="text-xs text-gray-500 mt-0.5">{doc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <a
                      href={isBlob ? `/api/products/${product.id}/documents/${doc.id}/download` : doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {isBlob ? "Download" : "Open"} &rarr;
                    </a>
                    {isBlob && doc.fileType === "pdf" && (
                      <button
                        onClick={() => extractImagesFromPdf(doc.id)}
                        disabled={extractingDocId === doc.id}
                        className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {extractingDocId === doc.id ? "Extracting..." : "Extract Images"}
                      </button>
                    )}
                    <button
                      onClick={() => startEditDoc(doc)}
                      className="text-xs text-gray-400 hover:text-gray-600 border rounded px-2 py-1 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {showDeleteDoc === doc.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => deleteDoc(doc.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                        <button onClick={() => setShowDeleteDoc(null)} className="text-gray-400">No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowDeleteDoc(doc.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete document"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add new document row */}
            {addingDoc && renderDocRow(
              emptyDoc(product.id),
              true,
              newDocDraft,
              (d) => setNewDocDraft(d),
              saveNewDoc,
              () => { setAddingDoc(false); setNewDocDraft(emptyDoc(product.id)); }
            )}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No documents or links added yet.{" "}
            <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">Upload a file</button>
            {" "}or{" "}
            <button onClick={() => setAddingDoc(true)} className="text-blue-600 hover:underline">add a link</button>
            <p className="text-xs text-gray-300 mt-2">You can also drag and drop files here</p>
          </div>
        )}
      </div>

      {/* Image Library */}
      <div className="mt-6">
        <ProductImageGallery
          productId={product.id}
          initialImages={images}
          onImagesChanged={setImages}
        />
      </div>
    </div>
  );
}

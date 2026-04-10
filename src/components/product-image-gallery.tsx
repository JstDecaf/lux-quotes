"use client";

import { useState, useRef, useEffect } from "react";

export interface ProductImage {
  id: number;
  productId: number;
  name: string;
  url: string;
  source: string;
  originalDocumentId: number | null;
  sortOrder: number;
  fileType: string;
  tag: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
}

interface Props {
  productId: number;
  initialImages: ProductImage[];
  onImagesChanged?: (images: ProductImage[]) => void;
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  upload: { label: "Uploaded", className: "bg-blue-100 text-blue-700" },
  "pdf-extract": { label: "From PDF", className: "bg-emerald-100 text-emerald-700" },
};

const TAG_OPTIONS = [
  { value: null, label: "No tag", className: "" },
  { value: "preferred", label: "Preferred", className: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "hero", label: "Hero", className: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "detail", label: "Detail", className: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  { value: "install", label: "Install", className: "bg-orange-100 text-orange-700 border-orange-300" },
] as const;

const TAG_STYLES: Record<string, string> = {
  preferred: "bg-amber-100 text-amber-700",
  hero: "bg-purple-100 text-purple-700",
  detail: "bg-cyan-100 text-cyan-700",
  install: "bg-orange-100 text-orange-700",
};

const TAG_LABELS: Record<string, string> = {
  preferred: "★ Preferred",
  hero: "Hero",
  detail: "Detail",
  install: "Install",
};

export function ProductImageGallery({ productId, initialImages, onImagesChanged }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showDeleteId, setShowDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Tag picker state
  const [tagPickerId, setTagPickerId] = useState<number | null>(null);

  // Lightbox state
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const lightboxImage = lightboxId !== null ? images.find((img) => img.id === lightboxId) : null;

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxId === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxId(null);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const idx = images.findIndex((img) => img.id === lightboxId);
        setLightboxId(images[idx > 0 ? idx - 1 : images.length - 1].id);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const idx = images.findIndex((img) => img.id === lightboxId);
        setLightboxId(images[idx < images.length - 1 ? idx + 1 : 0].id);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxId, images]);

  const updateImages = (updated: ProductImage[]) => {
    setImages(updated);
    onImagesChanged?.(updated);
  };

  // ---- Upload ----
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch(`/api/products/${productId}/images/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try { const err = await res.json(); msg = err.error || msg; } catch {}
        setUploadError(msg);
        return;
      }

      const newImage = await res.json();
      updateImages([...images, newImage]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) uploadFile(files[i]);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) uploadFile(files[i]);
  };

  // ---- Single actions ----
  const deleteImage = async (imageId: number) => {
    await fetch(`/api/products/${productId}/images/${imageId}`, { method: "DELETE" });
    updateImages(images.filter((img) => img.id !== imageId));
    setShowDeleteId(null);
  };

  const startEdit = (img: ProductImage) => {
    setEditingId(img.id);
    setEditName(img.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch(`/api/products/${productId}/images/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    updateImages(images.map((img) => img.id === editingId ? { ...img, name: editName } : img));
    setEditingId(null);
  };

  // ---- Tags ----
  const setTag = async (imageId: number, tag: string | null) => {
    await fetch(`/api/products/${productId}/images/${imageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    updateImages(images.map((img) => img.id === imageId ? { ...img, tag } : img));
    setTagPickerId(null);
  };

  // ---- Multi-select ----
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((img) => img.id)));
  const selectNone = () => { setSelected(new Set()); setConfirmBulkDelete(false); };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmBulkDelete(false);
  };

  // ---- Bulk actions ----
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await fetch(`/api/products/${productId}/images/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: Array.from(selected) }),
      });
      updateImages(images.filter((img) => !selected.has(img.id)));
      exitSelectMode();
    } catch {
      alert("Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkDownload = async () => {
    if (selected.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch(`/api/products/${productId}/images/bulk-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: Array.from(selected) }),
      });

      if (!res.ok) {
        alert("Download failed.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] || "images.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed.");
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${dragOver ? "ring-2 ring-blue-400 bg-blue-50/30" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Image Library ({images.length})</h2>
        <div className="flex items-center gap-2">
          {uploading && <span className="text-xs text-blue-600 animate-pulse">Uploading...</span>}
          {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileSelect}
          />
          {images.length > 0 && !selectMode && (
            <button
              onClick={() => setSelectMode(true)}
              className="px-3 py-1.5 text-xs text-gray-500 border rounded hover:bg-gray-50"
            >
              Select
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            ↑ Upload Image
          </button>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectMode && (
        <div className="px-4 py-2.5 border-b bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-blue-800">
              {selected.size} selected
            </span>
            <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
              Select all
            </button>
            <button onClick={selectNone} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
              Select none
            </button>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <button
                  onClick={bulkDownload}
                  disabled={bulkDownloading}
                  className="px-3 py-1.5 text-xs bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42] disabled:opacity-50"
                >
                  {bulkDownloading ? "Zipping..." : `↓ Download (${selected.size})`}
                </button>
                {confirmBulkDelete ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="text-red-600 font-medium">Delete {selected.size}?</span>
                    <button
                      onClick={bulkDelete}
                      disabled={bulkDeleting}
                      className="text-red-600 font-bold hover:text-red-800"
                    >
                      {bulkDeleting ? "..." : "Yes"}
                    </button>
                    <button onClick={() => setConfirmBulkDelete(false)} className="text-gray-400 hover:text-gray-600">
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Delete ({selected.size})
                  </button>
                )}
              </>
            )}
            <button
              onClick={exitSelectMode}
              className="px-3 py-1.5 text-xs text-gray-500 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {images.map((img) => {
            const badge = SOURCE_BADGES[img.source] || SOURCE_BADGES.upload;
            const isSelected = selected.has(img.id);
            const tagStyle = img.tag ? TAG_STYLES[img.tag] : null;

            return (
              <div
                key={img.id}
                className={`border rounded-lg overflow-hidden bg-gray-50 group relative ${
                  isSelected ? "ring-2 ring-blue-500 border-blue-400" : ""
                }`}
              >
                {/* Select checkbox overlay */}
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(img.id)}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white/80 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {isSelected && <span className="text-xs font-bold">✓</span>}
                  </button>
                )}

                {/* Tag badge overlay */}
                {img.tag && (
                  <div className={`absolute top-2 right-2 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded ${tagStyle}`}>
                    {TAG_LABELS[img.tag]}
                  </div>
                )}

                {/* Thumbnail */}
                <div
                  onClick={() => selectMode ? toggleSelect(img.id) : setLightboxId(img.id)}
                  className="cursor-pointer"
                >
                  <img
                    src={`/api/products/${productId}/images/${img.id}/download`}
                    alt={img.name}
                    className="w-full h-36 object-cover bg-gray-200"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="p-2.5">
                  {editingId === img.id ? (
                    <div className="flex gap-1 mb-1.5">
                      <input
                        className="flex-1 border rounded px-1.5 py-0.5 text-xs"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                      />
                      <button onClick={saveEdit} className="text-xs text-blue-600 hover:text-blue-800">✓</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <p
                      className="text-xs font-medium text-gray-800 truncate mb-1.5 cursor-pointer hover:text-blue-600"
                      onClick={() => startEdit(img)}
                      title="Click to rename"
                    >
                      {img.name}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Tag button */}
                      <div className="relative">
                        <button
                          onClick={() => setTagPickerId(tagPickerId === img.id ? null : img.id)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            img.tag
                              ? TAG_STYLES[img.tag] + " border-current"
                              : "text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300"
                          }`}
                          title="Set tag"
                        >
                          {img.tag ? TAG_LABELS[img.tag] : "Tag"}
                        </button>

                        {/* Tag picker dropdown */}
                        {tagPickerId === img.id && (
                          <div className="absolute bottom-full right-0 mb-1 bg-white border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                            {TAG_OPTIONS.map((opt) => (
                              <button
                                key={opt.value ?? "none"}
                                onClick={() => setTag(img.id, opt.value)}
                                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                                  img.tag === opt.value ? "font-bold" : ""
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      {!selectMode && (
                        showDeleteId === img.id ? (
                          <span className="flex items-center gap-1 text-[10px]">
                            <button onClick={() => deleteImage(img.id)} className="text-red-600 font-medium">Yes</button>
                            <button onClick={() => setShowDeleteId(null)} className="text-gray-400">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowDeleteId(img.id)}
                            className="text-gray-300 hover:text-red-500 text-sm transition-colors"
                            title="Delete"
                          >
                            ×
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          No images yet.{" "}
          <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">Upload images</button>
          {" "}or extract them from uploaded PDFs.
          <p className="text-xs text-gray-300 mt-2">You can also drag and drop images here</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxId(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxId(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10"
          >
            ✕
          </button>

          {/* Nav: previous */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = images.findIndex((img) => img.id === lightboxId);
                  const prev = idx > 0 ? images[idx - 1] : images[images.length - 1];
                  setLightboxId(prev.id);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-3xl z-10 px-2"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = images.findIndex((img) => img.id === lightboxId);
                  const next = idx < images.length - 1 ? images[idx + 1] : images[0];
                  setLightboxId(next.id);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-3xl z-10 px-2"
              >
                ›
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={`/api/products/${productId}/images/${lightboxImage.id}/download`}
            alt={lightboxImage.name}
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-sm font-medium">{lightboxImage.name}</p>
            {lightboxImage.width && lightboxImage.height && (
              <p className="text-white/40 text-xs mt-1">{lightboxImage.width} × {lightboxImage.height}px</p>
            )}
            <a
              href={`/api/products/${productId}/images/${lightboxImage.id}/download`}
              download
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 inline-block"
            >
              ↓ Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export type { Props as ProductImageGalleryProps };

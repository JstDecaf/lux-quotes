"use client";

import { useState, useRef } from "react";

export interface ProductImage {
  id: number;
  productId: number;
  name: string;
  url: string;
  source: string;
  originalDocumentId: number | null;
  sortOrder: number;
  fileType: string;
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

export function ProductImageGallery({ productId, initialImages, onImagesChanged }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showDeleteId, setShowDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateImages = (updated: ProductImage[]) => {
    setImages(updated);
    onImagesChanged?.(updated);
  };

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

  // Called externally when images are extracted from a PDF
  const addExtractedImages = (newImages: ProductImage[]) => {
    updateImages([...images, ...newImages]);
  };

  // Expose addExtractedImages via a ref pattern isn't ideal in React,
  // so we export this component and let the parent manage state instead.
  // The parent will update initialImages or call onImagesChanged.

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${dragOver ? "ring-2 ring-blue-400 bg-blue-50/30" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            ↑ Upload Image
          </button>
        </div>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {images.map((img) => {
            const badge = SOURCE_BADGES[img.source] || SOURCE_BADGES.upload;
            return (
              <div key={img.id} className="border rounded-lg overflow-hidden bg-gray-50 group">
                {/* Thumbnail */}
                <a
                  href={`/api/products/${productId}/images/${img.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={`/api/products/${productId}/images/${img.id}/download`}
                    alt={img.name}
                    className="w-full h-36 object-cover bg-gray-200"
                    loading="lazy"
                  />
                </a>

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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>
                      {badge.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {showDeleteId === img.id ? (
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
    </div>
  );
}

// Re-export the addExtractedImages capability
export type { Props as ProductImageGalleryProps };

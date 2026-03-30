"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewProductButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createProduct = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Product" }),
      });
      const data = await res.json();
      router.push(`/products/${data.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <button
      onClick={createProduct}
      disabled={creating}
      className="px-4 py-2 text-sm bg-[#0D1B2A] text-white rounded-lg hover:bg-[#1a2d42] disabled:opacity-50 font-medium"
    >
      {creating ? "Creating..." : "+ New Product"}
    </button>
  );
}

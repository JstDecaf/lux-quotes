"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ClientsList({ clients: initialClients }: { clients: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const createClient = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        contactName: newContact.trim() || null,
        contactEmail: newEmail.trim() || null,
        contactPhone: newPhone.trim() || null,
      }),
    });
    const client = await res.json();
    setClients([...clients, client].sort((a, b) => a.name.localeCompare(b.name)));
    setShowForm(false);
    setNewName("");
    setNewContact("");
    setNewEmail("");
    setNewPhone("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-archivo text-2xl font-bold text-gray-900">Clients</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-medium"
        >
          + Add Client
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h2 className="font-medium text-sm mb-3">Add New Client</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Company Name *</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. ACME Corp"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@acme.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+61 400 000 000"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createClient}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-[#0D1B2A] text-white rounded text-sm hover:bg-[#1a2d42] disabled:opacity-50"
            >
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No clients yet. Add your first client to get started.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.contactName ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.contactEmail ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.contactPhone ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

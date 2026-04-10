"use client";

import { useTheme } from "@/lib/theme";

export function PreferencesPanel() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Appearance</h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">Choose how LUX Quotes looks for you.</p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme("light")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              theme === "light"
                ? "border-lux-red shadow-sm"
                : "border-[var(--card-border)] hover:border-[var(--text-faint)]"
            }`}
          >
            {/* Light mode preview */}
            <div className="rounded-lg overflow-hidden mb-3 border border-gray-200">
              <div className="bg-[#0D1B2A] h-3 flex items-center px-1.5 gap-0.5">
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span className="w-1 h-1 rounded-full bg-white/30" />
              </div>
              <div className="bg-[#F9F7F4] p-2 flex gap-1.5">
                <div className="w-6 bg-[#0D1B2A] rounded-sm" />
                <div className="flex-1 space-y-1">
                  <div className="flex gap-1">
                    <div className="flex-1 h-4 bg-white rounded-sm border border-gray-100" />
                    <div className="flex-1 h-4 bg-white rounded-sm border border-gray-100" />
                    <div className="flex-1 h-4 bg-white rounded-sm border border-gray-100" />
                  </div>
                  <div className="h-6 bg-white rounded-sm border border-gray-100" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Light</p>
            <p className="text-[10px] text-[var(--text-muted)]">Warm, clean interface</p>
            {theme === "light" && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-lux-red flex items-center justify-center">
                <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              theme === "dark"
                ? "border-lux-red shadow-sm"
                : "border-[var(--card-border)] hover:border-[var(--text-faint)]"
            }`}
          >
            {/* Dark mode preview */}
            <div className="rounded-lg overflow-hidden mb-3 border border-gray-700">
              <div className="bg-[#0A1018] h-3 flex items-center px-1.5 gap-0.5">
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="w-1 h-1 rounded-full bg-white/20" />
              </div>
              <div className="bg-[#0F1419] p-2 flex gap-1.5">
                <div className="w-6 bg-[#0A1018] rounded-sm" />
                <div className="flex-1 space-y-1">
                  <div className="flex gap-1">
                    <div className="flex-1 h-4 bg-[#1A2332] rounded-sm" />
                    <div className="flex-1 h-4 bg-[#1A2332] rounded-sm" />
                    <div className="flex-1 h-4 bg-[#1A2332] rounded-sm" />
                  </div>
                  <div className="h-6 bg-[#1A2332] rounded-sm" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Dark</p>
            <p className="text-[10px] text-[var(--text-muted)]">Easy on the eyes</p>
            {theme === "dark" && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-lux-red flex items-center justify-center">
                <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* More preferences can be added here */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">More Settings</h2>
        <p className="text-xs text-[var(--text-muted)]">Additional preferences coming soon — default FX rates, notification settings, and more.</p>
      </div>
    </div>
  );
}

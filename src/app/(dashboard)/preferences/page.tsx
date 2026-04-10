import { PreferencesPanel } from "@/components/preferences-panel";

export const dynamic = "force-dynamic";

export default function PreferencesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-archivo text-2xl font-bold text-[var(--text-primary)] mb-2">Preferences</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Customise your LUX Quotes experience.</p>
      <PreferencesPanel />
    </div>
  );
}

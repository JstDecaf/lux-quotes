import { ImportWizard } from "@/components/import-wizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <h1 className="font-archivo text-2xl font-bold text-gray-900 mb-6">Import Leyard Quote</h1>
      <ImportWizard />
    </div>
  );
}

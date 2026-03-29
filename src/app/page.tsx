export default function Dashboard() {
  return (
    <div>
      <h1 className="font-archivo text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-sm text-gray-500">Open Quotes</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">&mdash;</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-sm text-gray-500">Pipeline Value</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">&mdash;</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-sm text-gray-500">Won This Month</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">&mdash;</p>
        </div>
      </div>
      <p className="text-gray-500">Recent quotes will appear here.</p>
    </div>
  );
}

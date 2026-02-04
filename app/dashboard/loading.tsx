export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-white border-r">
        <div className="p-6">
          <div className="h-8 bg-gray-200 rounded-md animate-pulse" />
        </div>
        <div className="px-3 space-y-2">
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b flex items-center px-6">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </header>
        <main className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-24 bg-white rounded-lg border animate-pulse" />
            <div className="h-24 bg-white rounded-lg border animate-pulse" />
            <div className="h-24 bg-white rounded-lg border animate-pulse" />
            <div className="h-24 bg-white rounded-lg border animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-white rounded-lg border animate-pulse" />
            <div className="h-64 bg-white rounded-lg border animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}

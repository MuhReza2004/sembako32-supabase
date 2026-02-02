"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ErrorBoundary } from "./ErrorBoundary";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar - Selalu render, tidak terpengaruh error di children */}
      <ErrorBoundary
        fallback={
          <aside className="w-64 bg-white border-r">
            <div className="p-4 font-bold text-lg">Gudang App</div>
            <nav className="space-y-1 px-2">
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Error loading sidebar
              </div>
            </nav>
          </aside>
        }
      >
        <Sidebar />
      </ErrorBoundary>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <ErrorBoundary
          fallback={
            <header className="h-14 bg-white border-b flex items-center justify-between px-6">
              <h1 className="font-semibold">Dashboard</h1>
            </header>
          }
        >
          <Topbar />
        </ErrorBoundary>

        <main className="flex-1 p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

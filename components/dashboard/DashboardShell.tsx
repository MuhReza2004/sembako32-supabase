"use client"

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ErrorBoundary } from "./ErrorBoundary";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="min-h-screen flex">
        {/* Sidebar - desktop */}
        <div className="hidden lg:flex lg:w-64">
          <ErrorBoundary
            fallback={
              <aside className="w-full bg-white border-r">
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
        </div>

        {/* Sidebar - mobile drawer */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Tutup menu"
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
              <ErrorBoundary
                fallback={
                  <aside className="w-full h-full bg-white border-r">
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
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <ErrorBoundary
            fallback={
              <header className="h-14 bg-white border-b flex items-center justify-between px-4 md:px-6">
                <h1 className="font-semibold">Dashboard</h1>
              </header>
            }
          >
            <Topbar
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              isSidebarOpen={isSidebarOpen}
            />
          </ErrorBoundary>

          <main className="flex-1 min-w-0 p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

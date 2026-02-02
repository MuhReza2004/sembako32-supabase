import DashboardShell from "@/components/dashboard/DashboardShell";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <DashboardShell>{children}</DashboardShell>
    </ErrorBoundary>
  );
}

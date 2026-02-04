import DashboardShell from "@/components/dashboard/DashboardShell";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import ConfirmProvider from "@/components/ui/ConfirmProvider";
import StatusProvider from "@/components/ui/StatusProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <StatusProvider>
          <DashboardShell>{children}</DashboardShell>
        </StatusProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

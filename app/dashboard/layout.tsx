import DashboardShell from "@/components/dashboard/DashboardShell";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import ConfirmProvider from "@/components/ui/ConfirmProvider";
import StatusProvider from "@/components/ui/StatusProvider";
import LoginSuccessListener from "@/components/auth/LoginSuccessListener";
import { Suspense } from "react";
import SessionExpiryWatcher from "@/components/auth/SessionExpiryWatcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <StatusProvider>
          <Suspense fallback={null}>
            <LoginSuccessListener />
          </Suspense>
          <SessionExpiryWatcher />
          <DashboardShell>{children}</DashboardShell>
        </StatusProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

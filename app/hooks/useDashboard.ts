import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/app/services/dashboard.service";

export const useDashboardData = (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}) => {
  return useQuery({
    queryKey: ["dashboard", dateRange],
    queryFn: () => getDashboardData(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

import { useInfiniteQuery } from "@tanstack/react-query";
import { getAllPembelian } from "@/app/services/pembelian.service";

// For future pagination implementation
export const usePembelianInfinite = () => {
  return useInfiniteQuery({
    queryKey: ["pembelian-infinite"],
    queryFn: ({ pageParam = null }) => {
      // This would be implemented with proper pagination API
      return getAllPembelian();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      // Return next page param based on your pagination logic
      return null;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

import { useCallback, useEffect, useState } from "react";

type Fetcher<T> = (options?: { force?: boolean }) => Promise<T[]>;

type Options = {
  enabled?: boolean;
  forceOnEnable?: boolean;
};

export const useCachedList = <T,>(
  fetcher: Fetcher<T>,
  options: Options = {},
) => {
  const { enabled = true, forceOnEnable = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(
    async (force?: boolean) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher({ force });
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    },
    [enabled, fetcher],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh(forceOnEnable);
  }, [enabled, forceOnEnable, refresh]);

  return { data, loading, error, refresh };
};

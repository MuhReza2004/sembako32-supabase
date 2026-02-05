import { useCallback, useEffect, useRef } from "react";

type Options = {
  delayMs?: number;
};

export const useBatchedRefresh = (
  refresh: () => void | Promise<unknown>,
  options?: Options,
) => {
  const delayMs = options?.delayMs ?? 400;
  const refreshRef = useRef(refresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const schedule = useCallback(() => {
    if (timerRef.current) {
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void refreshRef.current();
    }, delayMs);
  }, [delayMs]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
};

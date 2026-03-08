"use client";

import { useEffect, useState } from "react";

export function useAsyncResource<T>(loader: () => Promise<T>, deps: unknown[] = [], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let alive = true;
    setIsLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (alive) {
          setData(result);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
      })
      .finally(() => {
        if (alive) {
          setIsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [enabled, revision, ...deps]);

  return {
    data,
    error,
    isLoading,
    setData,
    reload: () => setRevision((value) => value + 1),
  };
}

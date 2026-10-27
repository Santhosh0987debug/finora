import { useCallback, useEffect, useState } from "react";
import { fetchCategories } from "../api/categories";
import { ApiError } from "../api/client";
import type { Category } from "../types/api";

type CategoryStatus = "loading" | "ready" | "error";

export function useExpenseCategories(
  token: string,
  onSessionExpired: () => void,
) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<CategoryStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchCategories(token, controller.signal)
      .then((nextCategories) => {
        if (!active) {
          return;
        }
        setCategories(
          nextCategories.filter((category) => category.type === "EXPENSE"),
        );
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 401) {
          onSessionExpired();
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load expense categories.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, requestVersion, onSessionExpired]);

  return { categories, status, error, retry };
}

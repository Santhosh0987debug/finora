import { useCallback, useEffect, useState } from "react";
import { fetchAccounts } from "../api/accounts";
import { ApiError } from "../api/client";
import { fetchCategories } from "../api/categories";
import type { Account, Category } from "../types/api";

type OptionsStatus = "loading" | "ready" | "error";

export function useTransactionOptions(
  token: string,
  onSessionExpired: () => void,
) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<OptionsStatus>("loading");
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

    Promise.all([
      fetchAccounts(token, controller.signal),
      fetchCategories(token, controller.signal),
    ])
      .then(([nextAccounts, nextCategories]) => {
        if (!active) {
          return;
        }
        setAccounts(nextAccounts);
        setCategories(nextCategories);
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
            : "Could not load accounts and categories.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, requestVersion, onSessionExpired]);

  return { accounts, categories, status, error, retry };
}

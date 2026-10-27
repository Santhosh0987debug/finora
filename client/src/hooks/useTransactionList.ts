import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import {
  fetchTransactions,
  type TransactionQuery,
} from "../api/transactions";
import type { TransactionListResponse } from "../types/api";

type TransactionListStatus = "loading" | "ready" | "error";

interface TransactionListState {
  key: string;
  data: TransactionListResponse | null;
  status: TransactionListStatus;
  error: string | null;
}

export function useTransactionList(
  token: string,
  query: TransactionQuery,
  onSessionExpired: () => void,
) {
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TransactionListState>({
    key: "",
    data: null,
    status: "loading",
    error: null,
  });

  const queryKey = useMemo(
    () =>
      JSON.stringify([
        token,
        requestVersion,
        query.page ?? null,
        query.limit ?? null,
        query.accountId ?? null,
        query.categoryId ?? null,
        query.type ?? null,
        query.from ?? null,
        query.to ?? null,
      ]),
    [token, requestVersion, query],
  );

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchTransactions(token, query, controller.signal)
      .then((response) => {
        if (!active) {
          return;
        }
        setState({
          key: queryKey,
          data: response,
          status: "ready",
          error: null,
        });
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 401) {
          onSessionExpired();
          return;
        }
        setState({
          key: queryKey,
          data: null,
          status: "error",
          error:
            caught instanceof Error
              ? caught.message
              : "Could not load your transactions.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, query, queryKey, onSessionExpired]);

  const current =
    state.key === queryKey
      ? state
      : { data: null, status: "loading" as const, error: null };

  return {
    data: current.data,
    status: current.status,
    error: current.error,
    refresh,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBudgets } from "../api/budgets";
import { ApiError } from "../api/client";
import type { BudgetListResponse, BudgetPeriod } from "../types/api";

type BudgetListStatus = "loading" | "ready" | "error";

interface BudgetListState {
  key: string;
  data: BudgetListResponse | null;
  status: BudgetListStatus;
  error: string | null;
}

export function useBudgets(
  token: string,
  period: BudgetPeriod,
  onSessionExpired: () => void,
) {
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<BudgetListState>({
    key: "",
    data: null,
    status: "loading",
    error: null,
  });
  const { month, year } = period;

  const requestKey = useMemo(
    () => JSON.stringify([token, requestVersion, month, year]),
    [token, requestVersion, month, year],
  );

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchBudgets(token, { month, year }, controller.signal)
      .then((response) => {
        if (!active) {
          return;
        }
        setState({
          key: requestKey,
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
          key: requestKey,
          data: null,
          status: "error",
          error:
            caught instanceof Error
              ? caught.message
              : "Could not load your budgets.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, month, year, requestKey, onSessionExpired]);

  const current =
    state.key === requestKey
      ? state
      : { data: null, status: "loading" as const, error: null };

  return {
    data: current.data,
    status: current.status,
    error: current.error,
    refresh,
  };
}

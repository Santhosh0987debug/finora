import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../api/dashboard";
import { ApiError } from "../api/client";
import type { DashboardSummary } from "../types/api";

type DashboardStatus = "loading" | "ready" | "error";

export function useDashboardSummary(
  token: string,
  onSessionExpired: () => void,
) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => {
    setData(null);
    setError(null);
    setStatus("loading");
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchDashboardSummary(token, controller.signal)
      .then((summary) => {
        if (!active) {
          return;
        }
        setData(summary);
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
        setData(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load your dashboard.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, requestVersion, onSessionExpired]);

  return { data, status, error, retry };
}

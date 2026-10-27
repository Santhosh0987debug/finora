import { useCallback, useEffect, useState } from "react";
import { fetchBills } from "../api/bills";
import { ApiError } from "../api/client";
import type { BillRecord } from "../types/api";

type BillListStatus = "loading" | "ready" | "error";

export function useBills(token: string, onSessionExpired: () => void) {
  const [bills, setBills] = useState<BillRecord[] | null>(null);
  const [status, setStatus] = useState<BillListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setBills(null);
    setError(null);
    setStatus("loading");
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchBills(token, controller.signal)
      .then((nextBills) => {
        if (!active) {
          return;
        }
        setBills(nextBills);
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
        setBills(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load your recurring bills.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, requestVersion, onSessionExpired]);

  return { bills, status, error, refresh };
}

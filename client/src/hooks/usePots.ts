import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { fetchPots } from "../api/pots";
import type { PotRecord } from "../types/api";

type PotListStatus = "loading" | "ready" | "error";

export function usePots(token: string, onSessionExpired: () => void) {
  const [pots, setPots] = useState<PotRecord[] | null>(null);
  const [status, setStatus] = useState<PotListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setPots(null);
    setError(null);
    setStatus("loading");
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchPots(token, controller.signal)
      .then((nextPots) => {
        if (!active) {
          return;
        }
        setPots(nextPots);
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
        setPots(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load your savings pots.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, requestVersion, onSessionExpired]);

  return { pots, status, error, refresh };
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentUser,
  loginRequest,
  registerRequest,
} from "../api/auth";
import { ApiError } from "../api/client";
import type { AuthSession, AuthUser } from "../types/api";

const TOKEN_STORAGE_KEY = "finora.auth.token";

type AuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "error";

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    return;
  }
}

function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    token ? "checking" : "unauthenticated",
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const skipNextCheck = useRef(false);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setSessionError(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (skipNextCheck.current) {
      skipNextCheck.current = false;
      return;
    }

    let active = true;
    const controller = new AbortController();

    getCurrentUser(token, controller.signal)
      .then((nextUser) => {
        if (!active) {
          return;
        }
        setUser(nextUser);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          logout();
          return;
        }
        setSessionError(
          error instanceof Error
            ? error.message
            : "Could not verify your session.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, retryCount, logout]);

  const applySession = useCallback((session: AuthSession) => {
    skipNextCheck.current = true;
    storeToken(session.token);
    setToken(session.token);
    setUser(session.user);
    setSessionError(null);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await loginRequest(email, password);
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await registerRequest(name, email, password);
      applySession(session);
    },
    [applySession],
  );

  const retrySession = useCallback(() => {
    setSessionError(null);
    setStatus("checking");
    setRetryCount((count) => count + 1);
  }, []);

  return {
    token,
    user,
    status,
    sessionError,
    login,
    register,
    logout,
    retrySession,
  };
}

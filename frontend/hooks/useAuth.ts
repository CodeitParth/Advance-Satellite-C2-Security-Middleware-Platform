"use client";
// useAuth — JWT storage, operator state, login/logout, proactive token refresh. T-023
import { useState, useEffect, useCallback, useRef } from "react";
import { api, getStoredToken, setStoredToken, clearStoredToken } from "../lib/api";
import type { OperatorOut, LoginRequest, TokenPayload } from "../lib/types";

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as TokenPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: TokenPayload): boolean {
  return payload.exp > 0 && payload.exp < Date.now() / 1000;
}

// Refresh 5 min before expiry so polling/WS never hit an expired token
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

export function useAuth() {
  const [operator, setOperator] = useState<OperatorOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(
    (token: string) => {
      clearRefreshTimer();
      const payload = decodeTokenPayload(token);
      if (!payload?.exp) return;
      const delay = payload.exp * 1000 - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
      if (delay <= 0) return; // too close to expiry; api.ts 401 redirect handles it
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const { access_token } = await api.refresh();
          setStoredToken(access_token);
          scheduleTokenRefresh(access_token);
        } catch {
          // Refresh endpoint returned 401 (token already expired) — api.ts redirect fires
        }
      }, delay);
    },
    [clearRefreshTimer],
  );

  // Restore session from stored token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      const payload = decodeTokenPayload(token);
      if (payload && !isTokenExpired(payload)) {
        setOperator({
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          full_name: payload.username, // will be overwritten on next login
          created_at: "",
        });
        scheduleTokenRefresh(token);
      } else {
        clearStoredToken();
      }
    }
    setIsLoading(false);
  }, [scheduleTokenRefresh]);

  // Clear timer on unmount
  useEffect(() => () => clearRefreshTimer(), [clearRefreshTimer]);

  const login = useCallback(
    async (creds: LoginRequest): Promise<OperatorOut> => {
      const resp = await api.login(creds);
      setStoredToken(resp.access_token);
      setOperator(resp.operator);
      scheduleTokenRefresh(resp.access_token);
      return resp.operator;
    },
    [scheduleTokenRefresh],
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    clearStoredToken();
    setOperator(null);
  }, [clearRefreshTimer]);

  return { operator, isLoading, login, logout };
}

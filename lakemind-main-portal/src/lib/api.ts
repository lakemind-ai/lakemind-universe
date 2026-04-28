import { toast } from "react-toastify";
import { trackPromise } from "react-promise-tracker";
import {
  getSessionToken,
  getRefreshToken,
  setSessionToken,
  setRefreshToken,
  setTokenExpiry,
  setUser,
  isTokenExpiringSoon,
  logout,
} from "@/lib/session";

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).env?.API_SERVICE_URL) {
    return (window as any).env.API_SERVICE_URL;
  }
  return "";
};

const buildQueryString = (params: Record<string, unknown>): string => {
  if (!params || Object.keys(params).length === 0) return "";
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
};

let refreshPromise: Promise<void> | null = null;

const refreshTokenIfNeeded = async (): Promise<void> => {
  if (!isTokenExpiringSoon()) return;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return;

  // Coalesce concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base}/api/auth/refresh-auth-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) throw new Error("Refresh failed");
      const result = await response.json();
      const data = result?.data;
      if (data?.access_token) {
        setSessionToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        if (data.expires_in) setTokenExpiry(data.expires_in);
        if (data.username) {
          setUser({ email: data.username, username: data.username });
        }
      }
    } catch {
      // Refresh failed — will require re-login on next 401
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const getHeaders = (
  contentType = "application/json",
  includeAuth = true
): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (contentType) headers["Content-Type"] = contentType;
  if (includeAuth) {
    const token = getSessionToken();
    if (token) {
      headers["X-LakeMind-Token"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    logout();
    throw new Error("Unauthorized");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.ok) return data;
  const msg = data?.message || data?.detail || `Error ${response.status}`;
  toast.error(msg);
  throw new Error(msg);
};

const authFetch = async (
  url: string,
  options: RequestInit
): Promise<Response> => {
  await refreshTokenIfNeeded();
  return fetch(url, { ...options, headers: getHeaders() });
};

const _api = {
  get: async (path: string, params?: Record<string, unknown>) => {
    const base = getApiBaseUrl();
    const url = `${base}${path}${params ? buildQueryString(params) : ""}`;
    const response = await authFetch(url, { method: "GET" });
    return handleResponse(response);
  },
  post: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await authFetch(`${base}${path}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  put: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await authFetch(`${base}${path}`, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  patch: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await authFetch(`${base}${path}`, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  delete: async (path: string) => {
    const base = getApiBaseUrl();
    const response = await authFetch(`${base}${path}`, { method: "DELETE" });
    return handleResponse(response);
  },
};

// showLoader: true (default) = global loader, false = silent (inline loader)
export const api = {
  get: async (path: string, params?: Record<string, unknown>, showLoader = true) => {
    const promise = _api.get(path, params);
    return showLoader ? trackPromise(promise) : promise;
  },
  post: async (path: string, body?: unknown, showLoader = true) => {
    const promise = _api.post(path, body);
    return showLoader ? trackPromise(promise) : promise;
  },
  put: async (path: string, body?: unknown, showLoader = true) => {
    const promise = _api.put(path, body);
    return showLoader ? trackPromise(promise) : promise;
  },
  patch: async (path: string, body?: unknown, showLoader = true) => {
    const promise = _api.patch(path, body);
    return showLoader ? trackPromise(promise) : promise;
  },
  delete: async (path: string, showLoader = true) => {
    const promise = _api.delete(path);
    return showLoader ? trackPromise(promise) : promise;
  },
};

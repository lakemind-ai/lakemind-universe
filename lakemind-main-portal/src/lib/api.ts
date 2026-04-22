import { toast } from "react-toastify";

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

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lakemind_token");
};

const getHeaders = (contentType = "application/json", includeAuth = true): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (contentType) headers["Content-Type"] = contentType;
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers["X-LakeMind-Token"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("lakemind_token");
      localStorage.removeItem("lakemind_user");
      window.location.href = "/login";
    }
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

export const api = {
  get: async (path: string, params?: Record<string, unknown>) => {
    const base = getApiBaseUrl();
    const url = `${base}${path}${params ? buildQueryString(params) : ""}`;
    const response = await fetch(url, { method: "GET", headers: getHeaders() });
    return handleResponse(response);
  },
  post: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  put: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await fetch(`${base}${path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  patch: async (path: string, body?: unknown) => {
    const base = getApiBaseUrl();
    const response = await fetch(`${base}${path}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },
  delete: async (path: string) => {
    const base = getApiBaseUrl();
    const response = await fetch(`${base}${path}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

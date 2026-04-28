const TOKEN_KEY = "lakemind_token";
const REFRESH_TOKEN_KEY = "lakemind_refresh_token";
const TOKEN_EXPIRY_KEY = "lakemind_token_expires_at";
const USER_KEY = "lakemind_user";
const INTENDED_VISIT_KEY = "lakemind_intended_visit";

export const getSessionToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setSessionToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

export const getTokenExpiry = (): Date | null => {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return val ? new Date(val) : null;
};

export const setTokenExpiry = (expiresIn: number): void => {
  if (typeof window === "undefined") return;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toISOString());
};

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setUser = (user: Record<string, string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getIntendedVisit = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(INTENDED_VISIT_KEY);
};

export const setIntendedVisit = (path: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTENDED_VISIT_KEY, path);
};

export const clearIntendedVisit = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(INTENDED_VISIT_KEY);
};

export const isTokenExpiringSoon = (): boolean => {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  // Expiring within 5 minutes
  return expiry.getTime() - Date.now() < 5 * 60 * 1000;
};

export const logout = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(INTENDED_VISIT_KEY);
  window.location.href = "/logout";
};

export const isAuthenticated = (): boolean => {
  return !!getSessionToken();
};

export const getSessionToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lakemind_token");
};

export const setSessionToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("lakemind_token", token);
};

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("lakemind_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setUser = (user: Record<string, string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("lakemind_user", JSON.stringify(user));
};

export const logout = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lakemind_token");
  localStorage.removeItem("lakemind_user");
  window.location.href = "/login";
};

export const isAuthenticated = (): boolean => {
  return !!getSessionToken();
};

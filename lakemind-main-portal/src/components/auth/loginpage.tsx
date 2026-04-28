import React, { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { api } from "@/lib/api";
import { isAuthenticated, setIntendedVisit } from "@/lib/session";
import { useHistory, useLocation } from "react-router-dom";

export function LoginPage() {
  const history = useHistory();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const authProvider =
    typeof window !== "undefined"
      ? (window as any).env?.AUTH_PROVIDER || "databricks"
      : "databricks";

  const ssoLabel =
    authProvider === "azuread" ? "Sign in with Azure AD" : "Sign in with Databricks";

  useEffect(() => {
    if (isAuthenticated()) {
      history.replace("/");
      return;
    }
    // Auto-redirect to OIDC provider
    handleLogin();
  }, [history]);

  const handleLogin = async () => {
    setLoading(true);
    // Store where the user wanted to go
    const from = (location as any).state?.from?.pathname;
    if (from && from !== "/login") {
      setIntendedVisit(from);
    }
    try {
      const res = await api.get("/api/auth/get-oidc-url");
      const url = res?.data?.auth_url;
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl shadow-black/30 p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <img src="/logo.svg" alt="LakeMind" className="w-16 h-16" />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#1A2332]">
            Welcome to LakeMind
          </h1>
          <p className="text-sm text-[#718096] mt-1">
            AI-powered semantic layer for Databricks
          </p>
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#1E3A5F] hover:bg-[#162D4A] text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />{" "}
              Redirecting...
            </>
          ) : (
            ssoLabel
          )}
        </button>
        <p className="text-xs text-[#718096] text-center">
          LakeMind is deployed as a Databricks App.
          <br />
          Authentication is handled via{" "}
          {authProvider === "azuread" ? "Azure AD" : "Databricks"} SSO.
        </p>
      </div>
    </div>
  );
}

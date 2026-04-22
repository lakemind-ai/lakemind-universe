import React, { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/session";
import { useHistory } from "react-router-dom";

export function LoginPage() {
  const history = useHistory();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) history.replace("/");
  }, [history]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/auth/get-oidc-url");
      const url = res?.data?.url;
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-[#11151C] rounded-2xl border border-[#232B38] shadow-2xl shadow-black/30 p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#5B7FE8] flex items-center justify-center">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#E6EAF0]">Welcome to LakeMind</h1>
          <p className="text-sm text-[#6B7589] mt-1">AI-powered semantic layer for Databricks</p>
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#5B7FE8] hover:bg-[#4A6ED4] text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Redirecting...
            </>
          ) : (
            "Sign in with Databricks"
          )}
        </button>
        <p className="text-xs text-[#6B7589] text-center">
          LakeMind is deployed as a Databricks App.
          <br />
          Authentication is handled via Databricks OIDC.
        </p>
      </div>
    </div>
  );
}

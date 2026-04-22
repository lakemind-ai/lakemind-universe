import React, { useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { setSessionToken, setUser } from "@/lib/session";
import { api } from "@/lib/api";

export function AuthCallback() {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) {
      history.replace("/login");
      return;
    }

    api
      .post("/api/auth/generate-auth-token", { code })
      .then((res) => {
        const token = res?.data?.access_token;
        if (!token) throw new Error("No token");
        setSessionToken(token);
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setUser({ email: payload.email || payload.sub || "", username: payload.sub || "" });
        } catch {}
        history.replace("/");
      })
      .catch(() => history.replace("/login"));
  }, [location, history]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0B0E14]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B7FE8]" />
    </div>
  );
}

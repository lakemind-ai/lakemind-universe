import { Loader } from "@/components/reusable/loader";
import { api } from "@/lib/api";
import {
  clearIntendedVisit,
  getIntendedVisit,
  setRefreshToken,
  setSessionToken,
  setTokenExpiry,
  setUser,
} from "@/lib/session";
import { useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";

export function AuthCallback() {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      history.replace("/login");
      return;
    }

    api
      .post("/api/auth/generate-auth-token", { code, state })
      .then((res) => {
        const data = res?.data;
        const token = data?.access_token;
        if (!token) throw new Error("No token");

        setSessionToken(token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        if (data.expires_in) setTokenExpiry(data.expires_in);

        // Extract user info from JWT
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setUser({
            email: payload.email || payload.upn || payload.sub || "",
            username: data.username || payload.sub || "",
            name: payload.name || "",
          });
        } catch {
          if (data.username) {
            setUser({ email: data.username, username: data.username });
          }
        }

        // Redirect to intended page or home
        const intended = getIntendedVisit();
        clearIntendedVisit();
        history.replace(intended || "/");
      })
      .catch(() => history.replace("/login"));
  }, [location, history]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#F5F7FA]">
      <Loader
        size="medium"
        message="Almost there..."
        textClassName="mt-3 text-sm text-[#718096]"
      />
    </div>
  );
}

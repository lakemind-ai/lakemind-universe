import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { isAuthenticated } from "@/lib/session";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const history = useHistory();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      history.replace("/login");
    } else {
      setChecked(true);
    }
  }, [history]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0E14]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B7FE8]" />
      </div>
    );
  }

  return <>{children}</>;
}

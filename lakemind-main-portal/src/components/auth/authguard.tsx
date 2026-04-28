import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { isAuthenticated } from "@/lib/session";
import { Loader } from "@/components/reusable/loader";

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
      <div className="flex items-center justify-center h-screen bg-[#F5F7FA]">
        <Loader size="medium" message="" />
      </div>
    );
  }

  return <>{children}</>;
}

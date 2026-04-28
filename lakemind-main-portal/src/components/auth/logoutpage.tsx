import React from "react";
import { Brain } from "lucide-react";
import { useHistory } from "react-router-dom";

export function LogoutPage() {
  const history = useHistory();

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl shadow-black/30 p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <img src="/logo.svg" alt="LakeMind" className="w-16 h-16" />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#1A2332]">
            Successfully Logged Out
          </h1>
          <p className="text-sm text-[#718096] mt-1">
            Your session has been ended securely.
          </p>
        </div>
        <button
          onClick={() => history.push("/login")}
          className="w-full bg-[#1E3A5F] hover:bg-[#162D4A] text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          Login Again
        </button>
      </div>
    </div>
  );
}

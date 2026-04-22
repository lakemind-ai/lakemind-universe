import React, { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Header } from "./header";
import { modules } from "@/lib/navigation";
import { AuthGuard } from "@/components/auth/authguard";

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

interface VersionInfo {
  version: string;
  product: string;
  build: string;
  releaseDate: string;
}

export function AppLayout({ children, requireAuth = true }: AppLayoutProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/version.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setVersionInfo(d))
      .catch(() => {});
  }, []);

  const content = (
    <div className="flex flex-col h-screen bg-[#0B0E14] overflow-hidden">
      {/* Subtle background grid */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #5B7FE8 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <Header navigation={modules.filter((m) => m.showInNav)} />

      <main className="relative flex-1 w-full flex flex-col overflow-auto">
        <div className="container mx-auto px-6 py-6 max-w-full flex-1 flex flex-col">
          {children}
        </div>
      </main>

      <footer className="relative shrink-0 py-3 text-center text-xs text-[#6B7589] border-t border-[#232B38] bg-[#0B0E14]/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <Brain className="w-3 h-3 text-[#5B7FE8]" />
          <span>Powered by</span>
          <span className="font-semibold text-[#5B7FE8]">LakeMind</span>
          <span>&middot;</span>
          <span>Built on Databricks</span>
          {versionInfo && (
            <>
              <span>&middot;</span>
              <span>v{versionInfo.version}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );

  return requireAuth ? <AuthGuard>{content}</AuthGuard> : content;
}

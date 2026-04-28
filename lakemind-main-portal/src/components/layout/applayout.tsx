import { AuthGuard } from "@/components/auth/authguard";
import { ResourceProvider } from "@/lib/resource-context";
import { AiChatFab } from "@/components/reusable/ai-chat-fab";
import React, { useState } from "react";
import { Sidebar } from "./sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AppLayout({ children, requireAuth = true }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Public layout (login, logout, callback) — no sidebar
  if (!requireAuth) {
    return (
      <div className="flex flex-col h-screen bg-white overflow-hidden">
        <main className="relative flex-1 w-full flex flex-col overflow-auto">
          <div className="container mx-auto max-w-full flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Private layout — blue sidebar + light content
  const content = (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="relative flex-1 w-full flex flex-col overflow-auto">
          <div className="max-w-full flex-1 flex flex-col">{children}</div>
        </main>
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <ResourceProvider>
        {content}
        <AiChatFab />
      </ResourceProvider>
    </AuthGuard>
  );
}

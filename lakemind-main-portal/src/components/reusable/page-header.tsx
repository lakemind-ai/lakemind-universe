import React from "react";

// Height must match sidebar logo row (both use h-[60px])
const HEADER_HEIGHT = "h-[60px]";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={`${HEADER_HEIGHT} px-5 border-b border-[#E2E8F0] bg-white shrink-0 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#3B6B96]">
          {icon}
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1A2332]">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[#718096]">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

import React from "react";

type PredefinedSize = "small" | "medium" | "large";

interface LoaderProps {
  size?: PredefinedSize | string;
  message?: string;
  textClassName?: string;
  logoClassName?: string;
  vertical?: boolean;
}

const sizeMap: Record<PredefinedSize, { container: string; orbit: number }> = {
  small: { container: "w-8 h-8", orbit: 32 },
  medium: { container: "w-16 h-16", orbit: 64 },
  large: { container: "w-20 h-20", orbit: 80 },
};

export const Loader: React.FC<LoaderProps> = ({
  size = "medium",
  message = "Loading",
  textClassName = "",
  logoClassName = "",
  vertical = true,
}) => {
  const sizeConfig = sizeMap[size as PredefinedSize] || sizeMap.medium;

  return (
    <div className={`flex items-center gap-3 ${vertical ? "flex-col" : ""}`}>
      <div className={`relative ${sizeConfig.container} flex items-center justify-center`}>
        {/* Orbiting dots */}
        <div
          className="absolute inset-[-6px] animate-spin"
          style={{ animationDuration: "3s", animationTimingFunction: "linear" }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1E3A5F]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1E3A5F]/40" />
        </div>
        <div
          className="absolute inset-[-6px] animate-spin"
          style={{ animationDuration: "3s", animationTimingFunction: "linear", animationDelay: "1s", animationDirection: "reverse" }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#1E3A5F]/60" />
        </div>

        {/* Subtle static ring */}
        <div className="absolute inset-[-2px] rounded-full border border-[#1E3A5F]/15" />

        {/* Logo */}
        <img
          src="/logo.svg"
          alt="LakeMind"
          className={`w-3/5 h-3/5 object-contain z-10 ${logoClassName}`}
        />
      </div>
      {message && <span className={`${textClassName}`}>{message}</span>}
    </div>
  );
};

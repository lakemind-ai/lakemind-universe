import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brain, Search, Upload, LogOut, User, ChevronDown } from "lucide-react";
import { logout, getUser } from "@/lib/session";
import CatalogService from "@/services/catalogservice";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Search,
  Upload,
};

interface Module {
  iconName: string;
  name: string;
  href: string;
  color?: string;
}

interface HeaderProps {
  navigation?: Module[];
}

export function Header({ navigation }: HeaderProps) {
  const location = useLocation();
  const user = getUser();
  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    CatalogService.getCatalogs()
      .then((data) => {
        setCatalogs(data);
        if (data.length > 0 && !selectedCatalog) {
          setSelectedCatalog(data[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
  };

  const initials = user
    ? (user.email || user.username || "U")
        .split("@")[0]
        .split(".")
        .map((p: string) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  return (
    <header className="shrink-0 h-14 bg-white border-b border-[#E2E8F0] flex items-center px-4 gap-6 z-10">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[#1A2332] text-sm tracking-tight">LakeMind</span>
      </Link>

      {/* Nav tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {navigation?.map((mod) => {
          const Icon = iconMap[mod.iconName] || Search;
          const isActive = location.pathname.startsWith(mod.href);
          return (
            <Link
              key={mod.href}
              to={mod.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1E3A5F]/15 text-[#3B6B96]"
                  : "text-[#4A5568] hover:bg-[#1A1F2B] hover:text-[#1A2332]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {mod.name}
            </Link>
          );
        })}
      </nav>

      {/* Catalog selector */}
      {catalogs.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setCatalogOpen(!catalogOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-[#4A5568] hover:bg-[#1A1F2B] hover:text-[#1A2332] transition-colors border border-[#E2E8F0]"
          >
            <span className="text-[#718096] text-xs">Catalog:</span>
            <span className="text-[#1A2332]">{selectedCatalog}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {catalogOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E2E8F0] rounded-lg shadow-xl z-50 py-1">
              {catalogs.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCatalog(cat);
                    setCatalogOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    cat === selectedCatalog
                      ? "bg-[#1E3A5F]/10 text-[#3B6B96]"
                      : "text-[#4A5568] hover:bg-[#1A1F2B] hover:text-[#1A2332]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User chip */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#1E3A5F]/20 text-[#3B6B96] flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <span className="hidden sm:block text-sm text-[#4A5568]">
              {user.email || user.username}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-[#718096] hover:text-[#1A2332] transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

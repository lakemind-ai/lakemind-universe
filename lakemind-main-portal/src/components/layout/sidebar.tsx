import { modules, sections } from "@/lib/navigation";
import { useResources } from "@/lib/resource-context";
import { getUser, logout } from "@/lib/session";
import {
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  Cpu,
  ExternalLink,
  Globe,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  DatabaseZap,
  ScrollText,
  Telescope,
  Warehouse,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";


const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DatabaseZap,
  Boxes,
  Globe,
  BookOpen,
  ScrollText,
  Telescope,
};

const stateColor = (state: string) => {
  const s = state?.toUpperCase() || "";
  if (s === "RUNNING" || s === "READY") return "bg-emerald-500";
  if (s.includes("START") || s.includes("PEND")) return "bg-amber-500";
  return "bg-slate-500";
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = getUser();
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const {
    warehouses,
    selectedWarehouse,
    setSelectedWarehouse,
    endpoints,
    selectedEndpoint,
    setSelectedEndpoint,
  } = useResources();

  const initials = user
    ? (user.email || user.username || "U")
        .split("@")[0]
        .split(".")
        .map((p: string) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  const navItems = modules.filter((m) => m.showInNav);

  const resourcesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        resourcesRef.current &&
        !resourcesRef.current.contains(e.target as Node)
      ) {
        setWarehouseOpen(false);
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <aside
      className={`flex flex-col h-screen bg-gradient-to-b from-[#1E3A5F] to-[#162D4A] border-r border-[#2A4D6E] transition-all duration-300 shrink-0 ${
        collapsed ? "w-[60px]" : "w-[260px]"
      }`}
    >
      {/* Logo — height matches PageHeader h-[60px] */}
      <div className="h-[60px] flex items-center px-3 border-b border-[#2A4D6E] shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0 flex-1"
          title={collapsed ? "LakeMind" : undefined}
        >
          <img
            src="/logo.svg"
            alt="LakeMind"
            className="w-[32px] h-[32px] shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-base leading-none tracking-tight whitespace-nowrap">
                LakeMind
              </span>
              <span className="text-xs text-[#718096] leading-none whitespace-nowrap mt-1">
                Databricks Native AI Glossary
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {sections.map((section, sectionIdx) => {
          const items = navItems.filter((m) => m.section === section.key);
          if (items.length === 0) return null;
          return (
            <div key={section.key} className="mb-3">
              {!collapsed && (
                <div className="px-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && sectionIdx > 0 && (
                <div className="border-t border-[#2A4D6E] mx-2 mb-2" />
              )}
              <div className={collapsed ? "space-y-2" : "space-y-0.5"}>
                {items.map((mod) => {
                  const Icon = iconMap[mod.iconName] || Boxes;
                  const isActive = location.pathname.startsWith(mod.href);
                  return (
                    <Link
                      key={mod.href}
                      to={mod.href}
                      title={collapsed ? mod.name : undefined}
                      className={`flex items-center gap-2.5 rounded-md transition-colors ${
                        collapsed
                          ? "justify-center w-9 h-9 mx-auto"
                          : "px-2.5 py-2"
                      } ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "text-[#C5DCF0] hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="text-sm font-medium truncate">
                          {mod.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Resources */}
      <div
        ref={resourcesRef}
        className="border-t border-[#2A4D6E] px-2 py-2 space-y-1.5"
      >
        {!collapsed && (
          <div className="px-2 mb-1">
            <span className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
              Resources
            </span>
          </div>
        )}

        {/* Warehouse selector */}
        <div className="relative">
          <button
            onClick={() => {
              setWarehouseOpen(!warehouseOpen);
              setModelOpen(false);
            }}
            title={
              collapsed
                ? `Warehouse: ${selectedWarehouse?.name || "None"}`
                : undefined
            }
            className={`flex items-center gap-2 rounded-md text-[#C5DCF0] hover:bg-white/10 hover:text-white transition-colors w-full ${
              collapsed ? "justify-center w-9 h-9 mx-auto" : "px-2.5 py-1.5"
            }`}
          >
            <Warehouse className="w-4 h-4 shrink-0 text-[#4A9E7B]" />
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm truncate">
                    {selectedWarehouse?.name || "No warehouse"}
                  </div>
                </div>
                {selectedWarehouse && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${stateColor(selectedWarehouse.state)}`}
                  />
                )}
                <ChevronDown className="w-3 h-3 shrink-0" />
              </>
            )}
          </button>
          {warehouseOpen && (
            <div
              className={`absolute z-50 bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-56 overflow-y-auto ${
                collapsed
                  ? "left-full ml-2 top-0 w-64"
                  : "left-0 bottom-full mb-1 w-full"
              }`}
            >
              <div className="px-3 pt-3 pb-1.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                SQL Warehouse
              </div>
              {warehouses.length === 0 ? (
                <div className="text-xs text-[#718096] px-3 py-3">No warehouses found</div>
              ) : (
                <div className="px-1.5 pb-1.5">
                  {warehouses.map((w) => {
                    const isSelected = selectedWarehouse?.id === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => { setSelectedWarehouse(w); setWarehouseOpen(false); }}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isSelected ? "bg-[#1E3A5F]/8 border border-[#1E3A5F]/20" : "hover:bg-[#F5F7FA] border border-transparent"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${stateColor(w.state)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#1A2332] truncate">{w.name}</div>
                          <div className="text-xs text-[#A0AEC0]">{w.cluster_size} · {w.state}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#3B6B96] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model serving endpoint selector */}
        <div className="relative">
          <button
            onClick={() => {
              setModelOpen(!modelOpen);
              setWarehouseOpen(false);
            }}
            title={
              collapsed
                ? `Model: ${selectedEndpoint?.name || "None"}`
                : undefined
            }
            className={`flex items-center gap-2 rounded-md text-[#C5DCF0] hover:bg-white/10 hover:text-white transition-colors w-full ${
              collapsed ? "justify-center w-9 h-9 mx-auto" : "px-2.5 py-1.5"
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0 text-[#C69A4C]" />
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm truncate">
                    {selectedEndpoint?.name || "No endpoint"}
                  </div>
                </div>
                {selectedEndpoint && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${stateColor(selectedEndpoint.state)}`}
                  />
                )}
                <ChevronDown className="w-3 h-3 shrink-0" />
              </>
            )}
          </button>
          {modelOpen && (
            <div
              className={`absolute z-50 bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-56 overflow-y-auto ${
                collapsed
                  ? "left-full ml-2 top-0 w-72"
                  : "left-0 bottom-full mb-1 w-full"
              }`}
            >
              <div className="px-3 pt-3 pb-1.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                Model Serving Endpoint
              </div>
              {endpoints.length === 0 ? (
                <div className="text-xs text-[#718096] px-3 py-3">No endpoints found</div>
              ) : (
                <div className="px-1.5 pb-1.5">
                  {endpoints.map((ep) => {
                    const isSelected = selectedEndpoint?.name === ep.name;
                    return (
                      <button
                        key={ep.name}
                        onClick={() => { setSelectedEndpoint(ep); setModelOpen(false); }}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isSelected ? "bg-[#1E3A5F]/8 border border-[#1E3A5F]/20" : "hover:bg-[#F5F7FA] border border-transparent"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${stateColor(ep.state)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#1A2332] truncate">{ep.name}</div>
                          <div className="text-xs text-[#A0AEC0]">{ep.state || "Unknown"}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#3B6B96] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Databricks + version */}
      <div className="border-t border-[#2A4D6E] px-2 py-2 shrink-0">
        <a
          href={
            typeof window !== "undefined"
              ? (window as any).env?.DATABRICKS_HOST || "#"
              : "#"
          }
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "Databricks Workspace" : undefined}
          className={`flex items-center gap-2 rounded-md transition-colors ${
            collapsed
              ? "justify-center p-2 mx-auto hover:bg-white/10"
              : "px-2.5 py-2 bg-white/10 border border-[#2A4D6E] hover:border-white/20"
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#E45B3A"
            className="shrink-0"
          >
            <path d="M12 0L1.5 6v3l10.5 6 10.5-6V6L12 0zm0 2.18L20.13 7 12 11.82 3.87 7 12 2.18zM1.5 10.5l10.5 6 10.5-6v3l-10.5 6-10.5-6v-3zm0 4.5l10.5 6 10.5-6v3l-10.5 6-10.5-6v-3z" />
          </svg>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white font-medium leading-tight">
                  Databricks Workspace
                </div>
                <div className="text-xs text-[#7BA3C9] leading-tight">
                  v1.0.0
                </div>
              </div>
              <ExternalLink className="w-3 h-3 text-[#7BA3C9] shrink-0" />
            </>
          )}
        </a>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-[#2A4D6E] px-2 py-1.5 shrink-0">
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : undefined}
          className={`flex items-center gap-2 rounded-md text-[#7BA3C9] hover:bg-white/10 hover:text-[#C5DCF0] transition-colors w-full ${
            collapsed ? "justify-center w-9 h-9 mx-auto" : "px-2.5 py-1.5"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User profile */}
      <div className="border-t border-[#2A4D6E] px-2 py-1.5 shrink-0">
        <div
          title={
            collapsed ? user?.email || user?.username || "User" : undefined
          }
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#C5DCF0] truncate">
                {user?.email || user?.username || "User"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout — always last */}
      <div className="border-t border-[#2A4D6E] px-2 py-1.5 shrink-0">
        <button
          onClick={logout}
          title={collapsed ? "Logout" : undefined}
          className={`flex items-center gap-2 rounded-md text-[#8FB8D9] hover:bg-white/10 hover:text-white transition-colors w-full ${
            collapsed ? "justify-center w-9 h-9 mx-auto" : "px-2.5 py-1.5"
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

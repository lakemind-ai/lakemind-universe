import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Search,
  Database,
  Table2,
  Columns3,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import ScanService, { CatalogScan, DetectedEntity } from "@/services/scanservice";
import CatalogService from "@/services/catalogservice";
import { cn } from "@/lib/utils";

const statusConfig = {
  draft: { label: "Draft", color: "text-[#6B7589]", bg: "bg-[#6B7589]/10", icon: Clock },
  needs_review: { label: "Needs review", color: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10", icon: AlertCircle },
  approved: { label: "Approved", color: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10", icon: CheckCircle2 },
};

type FilterType = "all" | "needs_review" | "approved";

export function ScanPage() {
  const history = useHistory();
  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [scan, setScan] = useState<CatalogScan | null>(null);
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<DetectedEntity | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    CatalogService.getCatalogs()
      .then((data) => {
        setCatalogs(data);
        if (data.length > 0) setSelectedCatalog(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCatalog) return;
    setLoading(true);
    ScanService.getScans()
      .then((scans) => {
        const latest = scans.find((s) => s.catalog === selectedCatalog);
        if (latest) {
          setScan(latest);
          setEntities(latest.entities || []);
          if (latest.entities?.length > 0) setSelectedEntity(latest.entities[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCatalog]);

  const handleScan = async () => {
    if (!selectedCatalog) return;
    setScanning(true);
    try {
      const result = await ScanService.scanCatalog(selectedCatalog);
      setScan(result);
      setEntities(result.entities || []);
      if (result.entities?.length > 0) setSelectedEntity(result.entities[0]);
    } catch {}
    setScanning(false);
  };

  const filteredEntities = entities.filter((e) => {
    if (filter === "all") return true;
    return e.status === filter;
  });

  const groupedBySchema = filteredEntities.reduce<Record<string, DetectedEntity[]>>((acc, entity) => {
    const schema = entity.schema || "default";
    if (!acc[schema]) acc[schema] = [];
    acc[schema].push(entity);
    return acc;
  }, {});

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs_review", label: "Needs review" },
    { key: "approved", label: "Approved" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5B7FE8]" />
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left sidebar */}
      <div className="w-80 shrink-0 border-r border-[#232B38] flex flex-col bg-[#0B0E14] overflow-hidden">
        {/* Catalog selector */}
        <div className="p-4 border-b border-[#232B38]">
          <label className="text-xs text-[#6B7589] font-medium uppercase tracking-wider mb-2 block">Catalog</label>
          <div className="flex gap-2">
            <select
              value={selectedCatalog}
              onChange={(e) => setSelectedCatalog(e.target.value)}
              className="flex-1 bg-[#11151C] border border-[#232B38] text-[#E6EAF0] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-[#5B7FE8]"
            >
              {catalogs.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-3 py-1.5 bg-[#5B7FE8] hover:bg-[#4A6ED4] text-white text-sm rounded-md transition-colors disabled:opacity-60 flex items-center gap-1"
            >
              {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Scan summary */}
        {scan && (
          <div className="px-4 py-3 border-b border-[#232B38]">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Database, label: "Schemas", value: scan.schema_count },
                { icon: Table2, label: "Tables", value: scan.table_count },
                { icon: Sparkles, label: "Entities", value: scan.entity_count },
                { icon: Columns3, label: "Columns", value: scan.column_count },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2 text-xs">
                  <stat.icon className="w-3.5 h-3.5 text-[#6B7589]" />
                  <span className="text-[#6B7589]">{stat.label}</span>
                  <span className="text-[#E6EAF0] font-medium ml-auto">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="px-4 py-3 border-b border-[#232B38] flex gap-1.5">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-[#5B7FE8]/15 text-[#5B7FE8]"
                  : "text-[#6B7589] hover:bg-[#1A1F2B] hover:text-[#A9B1BE]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Entity tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {Object.entries(groupedBySchema).map(([schema, schemaEntities]) => (
            <div key={schema} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#6B7589]">
                {schema}
              </div>
              {schemaEntities.map((entity) => {
                const isSelected = selectedEntity?.id === entity.id;
                const status = statusConfig[entity.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors",
                      isSelected ? "bg-[#5B7FE8]/10 border border-[#5B7FE8]/30" : "hover:bg-[#11151C] border border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#E6EAF0] truncate">{entity.name}</span>
                      <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", status.bg, status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#6B7589]">
                      <span>{entity.table_count} tables</span>
                      <span>{entity.column_count} cols</span>
                      <span>{entity.metric_count} metrics</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {filteredEntities.length === 0 && (
            <div className="text-center py-8 text-sm text-[#6B7589]">
              {scan ? "No entities match the current filter" : "Run a scan to detect entities"}
            </div>
          )}
        </div>
      </div>

      {/* Right main area */}
      <div className="flex-1 overflow-y-auto bg-[#0B0E14] p-6">
        {selectedEntity ? (
          <EntityDetail entity={selectedEntity} onNavigate={(id) => history.push(`/entity/${id}`)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#6B7589]">
            <Search className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select an entity to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface EntityDetailProps {
  entity: DetectedEntity;
  onNavigate: (id: string) => void;
}

function EntityDetail({ entity, onNavigate }: EntityDetailProps) {
  const status = statusConfig[entity.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const confidencePercent = Math.round((entity.confidence || 0) * 100);

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#6B7589] mb-4">
        <span>Scan</span>
        <ChevronRight className="w-3 h-3" />
        <span>{entity.schema}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#E6EAF0]">{entity.name}</span>
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-[#E6EAF0]">{entity.name}</h1>
        <span className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-md", status.bg, status.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </span>
        <button
          onClick={() => onNavigate(entity.id)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#5B7FE8] hover:bg-[#4A6ED4] text-white text-sm rounded-md transition-colors"
        >
          Edit entity
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { icon: Table2, label: "Tables", value: entity.table_count, color: "#5B7FE8" },
          { icon: Columns3, label: "Columns", value: entity.column_count, color: "#5B7FE8" },
          { icon: BarChart3, label: "Metrics", value: entity.metric_count, color: "#5B7FE8" },
          { icon: Sparkles, label: "Confidence", value: `${confidencePercent}%`, color: confidencePercent >= 80 ? "#4A9E7B" : confidencePercent >= 50 ? "#C69A4C" : "#D46A6A" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#11151C] border border-[#232B38] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-[#6B7589]">{stat.label}</span>
            </div>
            <span className="text-lg font-semibold text-[#E6EAF0]">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Entity card with AI description */}
      <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#5B7FE8]/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#5B7FE8]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[#E6EAF0] mb-1">AI-Generated Description</h3>
            <p className="text-sm text-[#A9B1BE] leading-relaxed">
              {entity.description || "LakeMind will generate a description after scanning the entity tables and columns."}
            </p>
          </div>
        </div>
        {/* Confidence bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#6B7589]">Detection confidence</span>
            <span className="text-[#E6EAF0] font-medium">{confidencePercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#1A1F2B] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidencePercent}%`,
                backgroundColor: confidencePercent >= 80 ? "#4A9E7B" : confidencePercent >= 50 ? "#C69A4C" : "#D46A6A",
              }}
            />
          </div>
        </div>
      </div>

      {/* Tables list */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#E6EAF0] mb-3 flex items-center gap-2">
          <Table2 className="w-4 h-4 text-[#5B7FE8]" />
          Detected Tables
        </h3>
        <div className="space-y-2">
          {(entity.tables || []).map((table) => {
            const tableStatus = statusConfig[table.status] || statusConfig.draft;
            const TableStatusIcon = tableStatus.icon;
            return (
              <div key={table.id} className="bg-[#11151C] border border-[#232B38] rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-[#6B7589]" />
                  <div>
                    <span className="text-sm font-medium text-[#E6EAF0]">{table.name}</span>
                    <span className="text-xs text-[#6B7589] ml-2">{table.full_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6B7589]">{table.column_count} columns</span>
                  <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", tableStatus.bg, tableStatus.color)}>
                    <TableStatusIcon className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
          {(!entity.tables || entity.tables.length === 0) && (
            <div className="text-center py-4 text-sm text-[#6B7589] bg-[#11151C] border border-[#232B38] rounded-lg">
              No tables detected yet
            </div>
          )}
        </div>
      </div>

      {/* Proposed metrics section */}
      <div>
        <h3 className="text-sm font-semibold text-[#E6EAF0] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#5B7FE8]" />
          Proposed Metrics
        </h3>
        <div className="space-y-3">
          {/* Placeholder metric blocks since we get them from entity detail */}
          <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#5B7FE8]" />
                <span className="text-sm font-medium text-[#E6EAF0]">total_revenue</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5B7FE8]/10 text-[#5B7FE8]">measure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7589]">92% confidence</span>
                <button className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] hover:bg-[#4A9E7B]/20 transition-colors">
                  Approve
                </button>
              </div>
            </div>
            <p className="text-xs text-[#A9B1BE] mb-2">Sum of all transaction amounts for the entity</p>
            <div className="bg-[#0B0E14] rounded px-3 py-2 text-xs font-mono text-[#A9B1BE]">
              SUM(transactions.amount)
            </div>
          </div>

          <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#5B7FE8]" />
                <span className="text-sm font-medium text-[#E6EAF0]">avg_order_value</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C69A4C]/10 text-[#C69A4C]">calculated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7589]">78% confidence</span>
                <button className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] hover:bg-[#4A9E7B]/20 transition-colors">
                  Approve
                </button>
              </div>
            </div>
            <p className="text-xs text-[#A9B1BE] mb-2">Average transaction amount per order</p>
            <div className="bg-[#0B0E14] rounded px-3 py-2 text-xs font-mono text-[#A9B1BE]">
              AVG(transactions.amount)
            </div>
          </div>

          <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#5B7FE8]" />
                <span className="text-sm font-medium text-[#E6EAF0]">customer_count</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5B7FE8]/10 text-[#5B7FE8]">measure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7589]">85% confidence</span>
                <button className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] hover:bg-[#4A9E7B]/20 transition-colors">
                  Approve
                </button>
              </div>
            </div>
            <p className="text-xs text-[#A9B1BE] mb-2">Count of distinct customers</p>
            <div className="bg-[#0B0E14] rounded px-3 py-2 text-xs font-mono text-[#A9B1BE]">
              COUNT(DISTINCT customers.customer_id)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

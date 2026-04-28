import { Loader } from "@/components/reusable/loader";
import EntityService, {
  EntityColumn,
  EntityDefinition,
  EntityDetail,
  EntityDimension,
  EntityMetric,
  EntityTable,
} from "@/services/entityservice";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  FileText,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Table2,
  Tags,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AiChatDrawer } from "./ai-chat-drawer";
import { useUrlState } from "@/lib/use-url-state";
import { PageHeader } from "@/components/reusable/page-header";
import { Dialog } from "@/components/reusable/dialog";

const statusConfig: Record<string, { icon: any; color: string }> = {
  approved: { icon: CheckCircle2, color: "text-[#4A9E7B]" },
  proposed: { icon: Clock, color: "text-[#C69A4C]" },
  pending: { icon: Clock, color: "text-[#C69A4C]" },
  rejected: { icon: XCircle, color: "text-[#D46A6A]" },
};

export function EntityHub() {
  const { getParam, getParamNumber, setParam, setParams } = useUrlState();
  const [entities, setEntities] = useState<EntityDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(getParam("search") || "");

  // Selected state
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(
    null,
  );
  const [selectedTable, setSelectedTable] = useState<EntityTable | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<EntityColumn | null>(
    null,
  );

  // Expanded nodes
  const [expandedEntities, setExpandedEntities] = useState<Set<number>>(
    new Set(),
  );
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

  // Detail data
  const [metrics, setMetrics] = useState<EntityMetric[]>([]);
  const [dimensions, setDimensions] = useState<EntityDimension[]>([]);
  const [definitions, setDefinitions] = useState<EntityDefinition[]>([]);

  // URL-driven tab
  const urlTab = getParam("tab") as "overview" | "metrics" | "dimensions" | "definitions" | "tables" | null;
  const detailTab = urlTab || "overview";
  const setDetailTab = (tab: string) => setParam("tab", tab === "overview" ? null : tab);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogKind, setDialogKind] = useState<"metric" | "dimension">(
    "metric",
  );
  const [dialogForm, setDialogForm] = useState({
    id: 0,
    name: "",
    description: "",
    formula: "",
    source_column: "",
    source_table: "",
    status: "proposed",
  });

  // AI Chat drawer — URL-driven
  const chatOpen = getParam("chat") === "1";
  const setChatOpen = (open: boolean) => setParam("chat", open ? "1" : null);

  // Editing entity description
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    setLoading(true);
    try {
      const data = await EntityService.getEntities();
      // Filter to only approved/pending entities (not rejected)
      const active = data.filter((e) => e.status !== "rejected");
      setEntities(active);
      // Restore from URL or select first
      const urlEntityId = getParamNumber("entity");
      const restore = urlEntityId ? active.find((e) => e.id === urlEntityId) : null;
      if (restore) {
        selectEntity(restore);
      } else if (active.length > 0 && !selectedEntity) {
        selectEntity(active[0]);
      }
    } catch {
      toast.error("Failed to load entities");
    } finally {
      setLoading(false);
    }
  };

  const selectEntity = async (entity: EntityDetail) => {
    setSelectedEntity(entity);
    setParam("entity", entity.id);
    setSelectedTable(null);
    setSelectedColumn(null);
    setDetailTab("overview");

    // Load full entity with tables, metrics, dimensions
    try {
      const full = await EntityService.getEntity(entity.id);
      setSelectedEntity(full);

      const [m, d, defs] = await Promise.all([
        EntityService.getMetrics(entity.id),
        EntityService.getDimensions(entity.id),
        EntityService.getDefinitions(entity.id),
      ]);
      setMetrics(m);
      setDimensions(d);
      setDefinitions(defs);

      // Auto-expand
      setExpandedEntities(
        (prev) => new Set(Array.from(prev).concat(entity.id)),
      );
    } catch {
      // Entity detail load failed — use what we have
    }
  };

  const selectTable = (table: EntityTable) => {
    setSelectedTable(table);
    setSelectedColumn(null);
    setDetailTab("tables");
    setExpandedTables((prev) => new Set(Array.from(prev).concat(table.id)));
  };

  const selectColumn = (column: EntityColumn) => {
    setSelectedColumn(column);
  };

  const toggleEntity = (id: number) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTable = (id: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEntities = searchQuery
    ? entities.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : entities;

  const refreshEntityData = async () => {
    if (!selectedEntity) return;
    const [m, d] = await Promise.all([
      EntityService.getMetrics(selectedEntity.id),
      EntityService.getDimensions(selectedEntity.id),
    ]);
    setMetrics(m);
    setDimensions(d);
  };

  const openAddDialog = (kind: "metric" | "dimension") => {
    setDialogMode("add");
    setDialogKind(kind);
    setDialogForm({
      id: 0,
      name: "",
      description: "",
      formula: "",
      source_column: "",
      source_table: "",
      status: "proposed",
    });
    setDialogOpen(true);
  };

  const openEditMetric = (m: EntityMetric) => {
    setDialogMode("edit");
    setDialogKind("metric");
    setDialogForm({
      id: m.id,
      name: m.name,
      description: m.description || "",
      formula: m.formula || "",
      source_column: "",
      source_table: m.backing_table || "",
      status: m.status,
    });
    setDialogOpen(true);
  };

  const openEditDimension = (d: EntityDimension) => {
    setDialogMode("edit");
    setDialogKind("dimension");
    setDialogForm({
      id: d.id,
      name: d.name,
      description: d.description || "",
      formula: "",
      source_column: d.source_column || "",
      source_table: d.source_table || "",
      status: d.status,
    });
    setDialogOpen(true);
  };

  const handleDialogSave = async () => {
    if (!selectedEntity || !dialogForm.name.trim()) return;
    try {
      if (dialogKind === "metric") {
        if (dialogMode === "add") {
          await EntityService.createMetric(selectedEntity.id, {
            name: dialogForm.name,
            description: dialogForm.description,
            formula: dialogForm.formula,
            backing_table: dialogForm.source_table,
          });
          toast.success("Metric added");
        } else {
          await EntityService.updateMetric(dialogForm.id, {
            name: dialogForm.name,
            description: dialogForm.description,
            formula: dialogForm.formula,
            status: dialogForm.status,
          });
          toast.success("Metric updated");
        }
        setMetrics(await EntityService.getMetrics(selectedEntity.id));
      } else {
        if (dialogMode === "add") {
          await EntityService.createDimension(selectedEntity.id, {
            name: dialogForm.name,
            description: dialogForm.description,
            source_column: dialogForm.source_column,
            source_table: dialogForm.source_table,
          });
          toast.success("Dimension added");
        } else {
          await EntityService.updateDimension(dialogForm.id, {
            name: dialogForm.name,
            description: dialogForm.description,
            source_column: dialogForm.source_column,
            source_table: dialogForm.source_table,
            status: dialogForm.status,
          });
          toast.success("Dimension updated");
        }
        setDimensions(await EntityService.getDimensions(selectedEntity.id));
      }
      setDialogOpen(false);
    } catch {
      toast.error(`Failed to ${dialogMode} ${dialogKind}`);
    }
  };

  const handleSaveDescription = async () => {
    if (!selectedEntity) return;
    try {
      const updated = await EntityService.updateEntity(selectedEntity.id, {
        description: descriptionDraft,
      });
      setSelectedEntity({
        ...selectedEntity,
        description: updated.description,
      });
      setEditingDescription(false);
      toast.success("Description updated");
    } catch {
      toast.error("Failed to update description");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader
          size="medium"
          message="Loading entities..."
          textClassName="mt-3 text-sm text-[#718096]"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Boxes className="w-7 h-7" />}
        title="Entity Hub"
        subtitle="Browse and manage entities, tables, columns — define metrics, dimensions, and glossary."
      />

      {/* Split content */}
      <div className="flex flex-1 min-h-0 overflow-hidden border border-[#E2E8F0] rounded-lg bg-white">
        {/* Left: Entity Tree */}
        <div className="w-[280px] border-r border-[#E2E8F0] flex flex-col shrink-0 bg-white overflow-hidden">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0AEC0]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full bg-white border border-[#E2E8F0] rounded-md pl-8 pr-3 py-1.5 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredEntities.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#A0AEC0]">
                No entities found. Run a MindScan first.
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredEntities.map((entity) => {
                  const isExpanded = expandedEntities.has(entity.id);
                  const isSelected =
                    selectedEntity?.id === entity.id && !selectedTable;
                  const StatusIcon = statusConfig[entity.status]?.icon || Clock;
                  const statusColor =
                    statusConfig[entity.status]?.color || "text-[#718096]";

                  return (
                    <div key={entity.id}>
                      {/* Entity node */}
                      <div
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#1E3A5F]/15 text-[#3B6B96]"
                            : "text-[#4A5568] hover:bg-white"
                        }`}
                        onClick={() => selectEntity(entity)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEntity(entity.id);
                          }}
                          className="w-4 shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-sm font-medium truncate flex-1">
                          {entity.name}
                        </span>
                        <StatusIcon
                          className={`w-3 h-3 shrink-0 ${statusColor}`}
                        />
                      </div>

                      {/* Tables */}
                      {isExpanded &&
                        selectedEntity?.tables &&
                        selectedEntity.id === entity.id && (
                          <div className="ml-5">
                            {selectedEntity.tables.map((table) => {
                              const isTableExpanded = expandedTables.has(
                                table.id,
                              );
                              const isTableSelected =
                                selectedTable?.id === table.id;

                              return (
                                <div key={table.id}>
                                  <div
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                                      isTableSelected
                                        ? "bg-[#1E3A5F]/10 text-[#3B6B96]"
                                        : "text-[#718096] hover:bg-white hover:text-[#4A5568]"
                                    }`}
                                    onClick={() => selectTable(table)}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTable(table.id);
                                      }}
                                      className="w-4 shrink-0"
                                    >
                                      {table.columns &&
                                      table.columns.length > 0 ? (
                                        isTableExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )
                                      ) : (
                                        <span className="w-3" />
                                      )}
                                    </button>
                                    <Table2 className="w-3 h-3 shrink-0" />
                                    <span className="text-xs truncate flex-1">
                                      {table.table_name}
                                    </span>
                                    <span className="text-xs text-[#A0AEC0]">
                                      {table.column_count}
                                    </span>
                                  </div>

                                  {/* Columns */}
                                  {isTableExpanded && table.columns && (
                                    <div className="ml-5">
                                      {table.columns.map((col) => (
                                        <div
                                          key={col.id}
                                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                                            selectedColumn?.id === col.id
                                              ? "bg-[#1E3A5F]/10 text-[#3B6B96]"
                                              : "text-[#A0AEC0] hover:bg-white hover:text-[#718096]"
                                          }`}
                                          onClick={() => selectColumn(col)}
                                        >
                                          <Columns3 className="w-2.5 h-2.5 shrink-0" />
                                          <span className="text-xs truncate flex-1">
                                            {col.column_name}
                                          </span>
                                          <span className="text-xs text-[#A0AEC0]">
                                            {col.data_type}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selectedEntity ? (
            <div className="p-6">
              {/* Entity header */}
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-xl font-bold text-[#1A2332]">
                  {selectedEntity.name}
                </h1>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChatOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> AI Chat
                  </button>
                  <button
                    onClick={() => openAddDialog("metric")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F0F2F5] text-[#4A5568] text-sm font-medium border border-[#E2E8F0] hover:bg-[#232B38] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Metric
                  </button>
                  <button
                    onClick={() => openAddDialog("dimension")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F0F2F5] text-[#4A5568] text-sm font-medium border border-[#E2E8F0] hover:bg-[#232B38] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Dimension
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#718096] mb-4">
                {selectedEntity.tables?.length || 0} tables · {metrics.length}{" "}
                metrics · {dimensions.length} dimensions
              </p>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-[#E2E8F0] mb-4">
                {(["overview", "metrics", "dimensions", "definitions", "tables"] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                        detailTab === tab
                          ? "text-[#3B6B96] border-[#1E3A5F]"
                          : "text-[#718096] border-transparent hover:text-[#4A5568]"
                      }`}
                    >
                      {tab}
                      {tab === "metrics" && metrics.length > 0 && (
                        <span className="ml-1 text-xs text-[#A0AEC0]">
                          ({metrics.length})
                        </span>
                      )}
                      {tab === "dimensions" && dimensions.length > 0 && (
                        <span className="ml-1 text-xs text-[#A0AEC0]">
                          ({dimensions.length})
                        </span>
                      )}
                      {tab === "definitions" && definitions.length > 0 && (
                        <span className="ml-1 text-xs text-[#A0AEC0]">
                          ({definitions.length})
                        </span>
                      )}
                      {tab === "tables" && selectedEntity.tables && (
                        <span className="ml-1 text-xs text-[#A0AEC0]">
                          ({selectedEntity.tables.length})
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>

              {/* Overview tab */}
              {detailTab === "overview" && (
                <div className="space-y-4">
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-[#1A2332]">
                        Entity Definition
                      </h3>
                      {!editingDescription && (
                        <button
                          onClick={() => {
                            setDescriptionDraft(
                              selectedEntity.description || "",
                            );
                            setEditingDescription(true);
                          }}
                          className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingDescription ? (
                      <div>
                        <textarea
                          value={descriptionDraft}
                          onChange={(e) => setDescriptionDraft(e.target.value)}
                          className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md p-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSaveDescription}
                            className="px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDescription(false)}
                            className="px-3 py-1.5 rounded-md text-[#718096] text-sm hover:bg-[#F0F2F5]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#4A5568] leading-relaxed">
                        {selectedEntity.description ||
                          "No description defined."}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 text-xs text-[#A0AEC0]">
                      <span>Type: {selectedEntity.entity_type}</span>
                      <span>·</span>
                      <span>
                        Confidence:{" "}
                        {Math.round(
                          (selectedEntity.confidence_score || 0) * 100,
                        )}
                        %
                      </span>
                      <span>·</span>
                      <span>Status: {selectedEntity.status}</span>
                      {selectedEntity.source_hint && (
                        <>
                          <span>·</span>
                          <span>{selectedEntity.source_hint}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-[#3B6B96]" />
                        <span className="text-xs text-[#718096]">Metrics</span>
                      </div>
                      <span className="text-lg font-bold text-[#1A2332]">
                        {metrics.length}
                      </span>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Tags className="w-4 h-4 text-[#8B5CF6]" />
                        <span className="text-xs text-[#718096]">
                          Dimensions
                        </span>
                      </div>
                      <span className="text-lg font-bold text-[#1A2332]">
                        {dimensions.length}
                      </span>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Table2 className="w-4 h-4 text-[#4A9E7B]" />
                        <span className="text-xs text-[#718096]">Tables</span>
                      </div>
                      <span className="text-lg font-bold text-[#1A2332]">
                        {selectedEntity.tables?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Metrics tab */}
              {detailTab === "metrics" && (
                <div className="space-y-2">
                  {metrics.length === 0 ? (
                    <div className="text-center py-8 text-[#A0AEC0] text-sm">
                      No metrics defined. Click "AI Suggest" to generate.
                    </div>
                  ) : (
                    metrics.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white border border-[#E2E8F0] rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-[#3B6B96]" />
                            <span className="text-sm font-semibold text-[#1A2332]">
                              {m.name}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full ${
                                m.status === "approved"
                                  ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                                  : "bg-[#C69A4C]/10 text-[#C69A4C]"
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#A0AEC0]">
                              {Math.round((m.confidence_score || 0) * 100)}%
                            </span>
                            <button
                              onClick={() => openEditMetric(m)}
                              className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {m.description && (
                          <p className="text-sm text-[#718096] mb-1">
                            {m.description}
                          </p>
                        )}
                        {m.formula && (
                          <code className="text-xs text-[#4A5568] font-mono bg-[#F5F7FA] px-2 py-1 rounded block">
                            {m.formula}
                          </code>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Dimensions tab */}
              {detailTab === "dimensions" && (
                <div className="space-y-2">
                  {dimensions.length === 0 ? (
                    <div className="text-center py-8 text-[#A0AEC0] text-sm">
                      No dimensions defined. Click "AI Suggest" to generate.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0]">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                            Dimension
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                            Column
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                            Table
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
                            Status
                          </th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensions.map((d) => (
                          <tr
                            key={d.id}
                            className="border-b border-[#E2E8F0] hover:bg-white transition-colors"
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Tags className="w-3 h-3 text-[#8B5CF6]" />
                                <span className="text-[#1A2332] font-medium">
                                  {d.name}
                                </span>
                              </div>
                              {d.description && (
                                <p className="text-xs text-[#718096] mt-0.5 ml-5">
                                  {d.description}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-[#4A5568]">
                              {d.source_column}
                            </td>
                            <td className="px-3 py-2 text-xs text-[#718096]">
                              {d.source_table?.split(".").pop()}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  d.status === "approved"
                                    ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                                    : "bg-[#C69A4C]/10 text-[#C69A4C]"
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => openEditDimension(d)}
                                className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Definitions tab */}
              {detailTab === "definitions" && (
                <div className="space-y-2">
                  {definitions.length === 0 ? (
                    <div className="text-center py-8 text-sm text-[#718096]">
                      No definitions yet. Definitions are proposed during MindScan.
                    </div>
                  ) : (
                    <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                      {definitions.map((def, i) => (
                        <div
                          key={def.id}
                          className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? "border-t border-[#E2E8F0]" : ""}`}
                        >
                          <FileText className="w-4 h-4 text-[#C69A4C] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#1A2332]">{def.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                def.status === "proposed" ? "bg-[#C69A4C]/10 text-[#C69A4C]"
                                  : def.status === "accepted" ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                                  : "bg-[#D46A6A]/10 text-[#D46A6A]"
                              }`}>{def.status}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[#C69A4C]/10 text-[#C69A4C]">{def.kind}</span>
                            </div>
                            {def.description && (
                              <p className="text-xs text-[#718096] mt-1 leading-relaxed">{def.description}</p>
                            )}
                            {def.formula && (
                              <div className="flex items-start gap-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 mt-1.5">
                                <span className="text-[10px] font-semibold text-[#3B6B96] uppercase tracking-wider shrink-0 mt-px">SQL</span>
                                <code className="text-xs text-[#4A5568] font-mono break-all">{def.formula}</code>
                              </div>
                            )}
                            {def.source_column && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-semibold text-[#8B5CF6] uppercase tracking-wider">Column</span>
                                <code className="text-xs text-[#4A5568] font-mono bg-[#F5F7FA] border border-[#E2E8F0] rounded px-2 py-0.5">
                                  {def.source_table?.split(".").pop()}.{def.source_column}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tables tab */}
              {detailTab === "tables" && (
                <div className="space-y-3">
                  {selectedEntity.tables?.map((table) => (
                    <div
                      key={table.id}
                      className="bg-white border border-[#E2E8F0] rounded-lg"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Table2 className="w-4 h-4 text-[#4A9E7B]" />
                          <span className="text-sm font-semibold text-[#1A2332]">
                            {table.catalog}.{table.schema_name}.
                            {table.table_name}
                          </span>
                        </div>
                        <span className="text-xs text-[#A0AEC0]">
                          {table.column_count} columns
                        </span>
                      </div>
                      {table.columns && table.columns.length > 0 && (
                        <div className="border-t border-[#E2E8F0]">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E2E8F0]">
                                <th className="text-left px-4 py-1.5 text-xs font-semibold text-[#A0AEC0] uppercase">
                                  Column
                                </th>
                                <th className="text-left px-4 py-1.5 text-xs font-semibold text-[#A0AEC0] uppercase">
                                  Type
                                </th>
                                <th className="text-left px-4 py-1.5 text-xs font-semibold text-[#A0AEC0] uppercase">
                                  Description
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.columns.map((col) => (
                                <tr
                                  key={col.id}
                                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F5F7FA] transition-colors"
                                >
                                  <td className="px-4 py-1.5 font-mono text-[#1A2332]">
                                    {col.column_name}
                                  </td>
                                  <td className="px-4 py-1.5 text-[#718096]">
                                    {col.data_type}
                                  </td>
                                  <td className="px-4 py-1.5 text-[#718096]">
                                    {col.business_description || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Boxes className="w-10 h-10 text-[#232B38] mb-3" />
              <p className="text-sm text-[#718096]">
                Select an entity from the tree to view details.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* end split content */}

      {/* AI Chat Drawer */}
      {selectedEntity && (
        <AiChatDrawer
          entity={selectedEntity}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onItemAdded={refreshEntityData}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} className="w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-base font-semibold text-[#1A2332]">
                {dialogMode === "add" ? "Add" : "Edit"}{" "}
                {dialogKind === "metric" ? "Metric" : "Dimension"}
              </h3>
              <button
                onClick={() => setDialogOpen(false)}
                className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                  Name
                </label>
                <input
                  value={dialogForm.name}
                  onChange={(e) =>
                    setDialogForm({ ...dialogForm, name: e.target.value })
                  }
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
                  placeholder={
                    dialogKind === "metric"
                      ? "e.g. Total Revenue"
                      : "e.g. Region"
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                  Description
                </label>
                <textarea
                  value={dialogForm.description}
                  onChange={(e) =>
                    setDialogForm({
                      ...dialogForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none resize-none"
                  rows={2}
                  placeholder="Business description..."
                />
              </div>

              {dialogKind === "metric" && (
                <div>
                  <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                    Formula
                  </label>
                  <input
                    value={dialogForm.formula}
                    onChange={(e) =>
                      setDialogForm({ ...dialogForm, formula: e.target.value })
                    }
                    className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                    placeholder="e.g. SUM(amount)"
                  />
                </div>
              )}

              {dialogKind === "dimension" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                      Source Column
                    </label>
                    <input
                      value={dialogForm.source_column}
                      onChange={(e) =>
                        setDialogForm({
                          ...dialogForm,
                          source_column: e.target.value,
                        })
                      }
                      className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                      placeholder="e.g. region_code"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                      Source Table
                    </label>
                    <input
                      value={dialogForm.source_table}
                      onChange={(e) =>
                        setDialogForm({
                          ...dialogForm,
                          source_table: e.target.value,
                        })
                      }
                      className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                      placeholder="e.g. catalog.schema.table"
                    />
                  </div>
                </>
              )}

              {dialogMode === "edit" && (
                <div>
                  <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <select
                    value={dialogForm.status}
                    onChange={(e) =>
                      setDialogForm({ ...dialogForm, status: e.target.value })
                    }
                    className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
                  >
                    <option value="proposed">Proposed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-md text-sm text-[#718096] hover:bg-[#F0F2F5] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDialogSave}
                disabled={!dialogForm.name.trim()}
                className="px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors disabled:opacity-50"
              >
                {dialogMode === "add" ? "Add" : "Save"}
              </button>
            </div>
      </Dialog>
    </div>
  );
}

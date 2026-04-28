import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  CheckCircle2,
  BarChart3,
  Tags,
  FileText,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import RealmService, { RealmSummary } from "@/services/realmservice";
import LexiconService, { LexiconEntry, LexiconStats } from "@/services/lexiconservice";
import { PageHeader } from "@/components/reusable/page-header";
import { Loader } from "@/components/reusable/loader";
import { Dialog } from "@/components/reusable/dialog";
import { AiChatDrawer } from "@/components/entity/ai-chat-drawer";
import { EntityDetail } from "@/services/entityservice";
import { useUrlState } from "@/lib/use-url-state";
import { toast } from "react-toastify";

const kindConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  metric: { label: "Metric", icon: BarChart3, color: "text-[#3B6B96]", bg: "bg-[#1E3A5F]/10" },
  dimension: { label: "Dimension", icon: Tags, color: "text-[#8B5CF6]", bg: "bg-[#8B5CF6]/10" },
  definition: { label: "Definition", icon: FileText, color: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: "Proposed", color: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10" },
  approved: { label: "Approved", color: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10" },
  rejected: { label: "Rejected", color: "text-[#D46A6A]", bg: "bg-[#D46A6A]/10" },
};

export function LexiconPage() {
  const { getParam, getParamNumber, setParam, setParams } = useUrlState();
  const [realms, setRealms] = useState<RealmSummary[]>([]);
  const [entries, setEntries] = useState<LexiconEntry[]>([]);
  const [stats, setStats] = useState<LexiconStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // URL-driven state
  const selectedRealmId = getParamNumber("realm");
  const searchQuery = getParam("search") || "";
  const filterKind = getParam("kind") || "";
  const filterStatus = getParam("status") || "";

  const setSelectedRealmId = (id: number | null) => setParam("realm", id);
  const setSearchQuery = (q: string) => setParam("search", q || null);
  const setFilterKind = (k: string) => setParam("kind", k || null);
  const setFilterStatus = (s: string) => setParam("status", s || null);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEntity, setChatEntity] = useState<EntityDetail | null>(null);

  // Edit dialog
  const [editEntry, setEditEntry] = useState<LexiconEntry | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", formula: "", source_column: "", source_table: "", status: "" });

  useEffect(() => {
    RealmService.listRealms()
      .then((data) => {
        setRealms(data);
        if (data.length > 0 && !selectedRealmId) {
          setSelectedRealmId(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRealmId) return;
    loadEntries();
    loadStats();
  }, [selectedRealmId]);

  const loadEntries = async () => {
    if (!selectedRealmId) return;
    setLoadingEntries(true);
    try {
      const data = await LexiconService.getEntries(selectedRealmId, {
        kind: filterKind || undefined,
        status: filterStatus || undefined,
        search: searchQuery || undefined,
      });
      setEntries(data);
    } catch {} finally {
      setLoadingEntries(false);
    }
  };

  const loadStats = async () => {
    if (!selectedRealmId) return;
    try {
      setStats(await LexiconService.getStats(selectedRealmId));
    } catch {}
  };

  useEffect(() => {
    if (!selectedRealmId) return;
    const timeout = setTimeout(loadEntries, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterKind, filterStatus]);

  const toggleSelect = (entry: LexiconEntry) => {
    const key = `${entry.source_type}:${entry.id}`;
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev));
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllProposed = () => {
    const proposed = entries.filter((e) => e.status === "proposed");
    const keys = proposed.map((e) => `${e.source_type}:${e.id}`);
    setSelectedIds(new Set(keys));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkApprove = async () => {
    if (!selectedRealmId || selectedIds.size === 0) return;
    const items = Array.from(selectedIds).map((key) => {
      const [source_type, id] = key.split(":");
      return { source_type, id: Number(id) };
    });
    try {
      const result = await LexiconService.bulkApprove(selectedRealmId, items);
      toast.success(`${result.approved_count} entries approved`);
      clearSelection();
      loadEntries();
      loadStats();
    } catch {
      toast.error("Bulk approve failed");
    }
  };

  const openEdit = (entry: LexiconEntry) => {
    setEditEntry(entry);
    setEditForm({
      name: entry.name,
      description: entry.description,
      formula: entry.formula,
      source_column: entry.source_column,
      source_table: entry.source_table,
      status: entry.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    try {
      await LexiconService.updateEntry(editEntry, editForm);
      toast.success(`${editEntry.kind} updated`);
      setEditEntry(null);
      loadEntries();
      loadStats();
    } catch {
      toast.error("Failed to update");
    }
  };

  const selectedRealm = realms.find((r) => r.id === selectedRealmId);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader icon={<BookOpen className="w-7 h-7" />} title="Lexicon" subtitle="Per-realm glossary — search, filter, and approve definitions, metrics, and dimensions." />
        <div className="flex items-center justify-center flex-1">
          <Loader size="medium" message="Loading..." textClassName="mt-3 text-sm text-[#718096]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<BookOpen className="w-7 h-7" />}
        title="Lexicon"
        subtitle="Per-realm glossary — search, filter, and approve definitions, metrics, and dimensions."
      />

      <div className="flex flex-col gap-4 p-6 flex-1 overflow-auto">
        {/* Realm selector + stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Realm</label>
            <select
              value={selectedRealmId || ""}
              onChange={(e) => setSelectedRealmId(Number(e.target.value))}
              className="bg-white border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none min-w-[200px]"
            >
              {realms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {stats && (
            <div className="flex items-center gap-4 text-xs text-[#718096]">
              <span>{stats.total} total</span>
              <span className="text-[#3B6B96]">{stats.metrics} metrics</span>
              <span className="text-[#8B5CF6]">{stats.dimensions} dimensions</span>
              <span>{stats.definitions} definitions</span>
              <span>·</span>
              <span className="text-[#C69A4C]">{stats.proposed} proposed</span>
              <span className="text-[#4A9E7B]">{stats.approved} approved</span>
            </div>
          )}
        </div>

        {/* Filters + bulk actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search glossary terms..."
              className="w-full bg-white border border-[#E2E8F0] rounded-md pl-9 pr-3 py-1.5 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none"
            />
          </div>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
          >
            <option value="">All Kinds</option>
            <option value="metric">Metrics</option>
            <option value="dimension">Dimensions</option>
            <option value="definition">Definitions</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
          >
            <option value="">All Statuses</option>
            <option value="proposed">Proposed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <div className="flex-1" />

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#718096]">{selectedIds.size} selected</span>
              <button onClick={handleBulkApprove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#4A9E7B] text-white text-xs font-medium hover:bg-[#3D8668] transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Selected
              </button>
              <button onClick={clearSelection} className="text-xs text-[#718096] hover:text-[#4A5568]">Clear</button>
            </div>
          )}
          {selectedIds.size === 0 && entries.some((e) => e.status === "proposed") && (
            <button onClick={selectAllProposed} className="text-xs text-[#3B6B96] hover:text-[#2D5A7E] font-medium">
              Select all proposed
            </button>
          )}
        </div>

        {/* Entries table */}
        {loadingEntries ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="medium" message="Loading glossary..." textClassName="mt-3 text-sm text-[#718096]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-10 h-10 text-[#E2E8F0] mb-3" />
            <p className="text-sm text-[#718096]">
              {selectedRealmId ? "No glossary entries found for this realm. Run a MindScan and assign entities first." : "Select a realm to view its glossary."}
            </p>
          </div>
        ) : (
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === entries.filter((e) => e.status === "proposed").length}
                      onChange={() => selectedIds.size > 0 ? clearSelection() : selectAllProposed()}
                      className="rounded border-[#CBD5E0]"
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Term</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Kind</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Entity</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Formula / Column</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const kc = kindConfig[entry.kind] || kindConfig.definition;
                  const sc = statusConfig[entry.status] || statusConfig.proposed;
                  const KindIcon = kc.icon;
                  const key = `${entry.source_type}:${entry.id}`;
                  const isSelected = selectedIds.has(key);

                  return (
                    <tr key={key} className={`border-b border-[#E2E8F0] hover:bg-[#F5F7FA] transition-colors ${isSelected ? "bg-[#1E3A5F]/[0.03]" : ""}`}>
                      <td className="px-4 py-2.5">
                        {entry.status === "proposed" && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(entry)}
                            className="rounded border-[#CBD5E0]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#1A2332]">{entry.name}</div>
                        {entry.description && (
                          <div className="text-xs text-[#718096] mt-0.5 line-clamp-1">{entry.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${kc.bg} ${kc.color}`}>
                          <KindIcon className="w-3 h-3" /> {kc.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[#4A5568]">{entry.entity_name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[#718096]">
                        {entry.kind === "metric" ? entry.formula : entry.source_column ? `${entry.source_table?.split(".").pop()}.${entry.source_column}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {(entry.source_type === "metric" || entry.source_type === "dimension") && (
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onClose={() => setEditEntry(null)} className="w-full max-w-md">
        {editEntry && (<>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-semibold text-[#1A2332]">
                  Edit {editEntry.kind === "metric" ? "Metric" : "Dimension"}
                </h3>
                <p className="text-xs text-[#718096]">{editEntry.entity_name}</p>
              </div>
              <button onClick={() => setEditEntry(null)} className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none resize-none"
                  rows={2}
                />
              </div>
              {editEntry.kind === "metric" && (
                <div>
                  <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Formula</label>
                  <input
                    value={editForm.formula}
                    onChange={(e) => setEditForm({ ...editForm, formula: e.target.value })}
                    className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                  />
                </div>
              )}
              {editEntry.kind === "dimension" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Source Column</label>
                    <input
                      value={editForm.source_column}
                      onChange={(e) => setEditForm({ ...editForm, source_column: e.target.value })}
                      className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Source Table</label>
                    <input
                      value={editForm.source_table}
                      onChange={(e) => setEditForm({ ...editForm, source_table: e.target.value })}
                      className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] font-mono focus:border-[#1E3A5F] outline-none"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
                >
                  <option value="proposed">Proposed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setChatEntity({
                    id: editEntry.entity_id,
                    name: editEntry.entity_name,
                  } as EntityDetail);
                  setChatOpen(true);
                  setEditEntry(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-[#3B6B96] hover:bg-[#1E3A5F]/8 transition-colors font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" /> Refine with AI
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditEntry(null)} className="px-4 py-2 rounded-md text-sm text-[#718096] hover:bg-[#F0F2F5] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editForm.name.trim()}
                  className="px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
        </>)}
      </Dialog>

      {/* AI Chat Drawer */}
      {chatEntity && (
        <AiChatDrawer
          entity={chatEntity}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onItemAdded={() => { loadEntries(); loadStats(); }}
        />
      )}
    </div>
  );
}

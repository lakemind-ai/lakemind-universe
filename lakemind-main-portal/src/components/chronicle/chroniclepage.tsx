import { Dialog } from "@/components/reusable/dialog";
import { Loader } from "@/components/reusable/loader";
import { PageHeader } from "@/components/reusable/page-header";
import { useUrlState } from "@/lib/use-url-state";
import ChronicleService, {
  ChronicleVersion,
  ChronicleVersionDetail,
} from "@/services/chronicleservice";
import RealmService, { RealmSummary } from "@/services/realmservice";
import {
  Boxes,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Telescope,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useResources } from "@/lib/resource-context";

export function ChroniclePage() {
  const { getParamNumber, setParam } = useUrlState();
  const { selectedWarehouse } = useResources();
  const [realms, setRealms] = useState<RealmSummary[]>([]);
  const [versions, setVersions] = useState<ChronicleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // URL state
  const selectedRealmId = getParamNumber("realm");
  const setSelectedRealmId = (id: number | null) => setParam("realm", id);

  // Version detail dialog
  const [detailVersion, setDetailVersion] =
    useState<ChronicleVersionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"changes" | "snapshot" | "instructions">("changes");
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  const [snapshotSearch, setSnapshotSearch] = useState("");
  const [manualExpand, setManualExpand] = useState<Set<string>>(new Set());

  const toggleReviewed = useCallback((key: string) => {
    setReviewedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleEntityReviewed = useCallback(
    (entityName: string, itemKeys: string[]) => {
      setReviewedItems((prev) => {
        const next = new Set(prev);
        const allChecked = itemKeys.every((k) => next.has(k));
        if (allChecked) {
          // Unchecking — clear manual expand so it won't stay forced open
          itemKeys.forEach((k) => next.delete(k));
          next.delete(`entity:${entityName}`);
          setManualExpand((p) => {
            const n = new Set(p);
            n.delete(entityName);
            return n;
          });
        } else {
          itemKeys.forEach((k) => next.add(k));
          next.add(`entity:${entityName}`);
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    RealmService.listRealms()
      .then((data) => {
        setRealms(data);
        if (data.length > 0 && !selectedRealmId) setSelectedRealmId(data[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRealmId) loadVersions();
  }, [selectedRealmId]);

  const loadVersions = async () => {
    if (!selectedRealmId) return;
    setLoadingVersions(true);
    try {
      setVersions(await ChronicleService.listVersions(selectedRealmId));
    } catch {
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedRealmId) return;
    try {
      await ChronicleService.createVersion(selectedRealmId);
      toast.success("Version created");
      loadVersions();
    } catch {
      toast.error("Failed to create version");
    }
  };

  const openVersionDetail = async (v: ChronicleVersion) => {
    setLoadingDetail(true);
    setDetailVersion(null);
    setReviewedItems(new Set());
    setSnapshotSearch("");
    setManualExpand(new Set());
    try {
      const detail = await ChronicleService.getVersion(v.id);
      setDetailVersion(detail);
    } catch {
      toast.error("Failed to load version details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePublish = async () => {
    if (!detailVersion) return;
    try {
      const result = await ChronicleService.publishVersion(detailVersion.id);
      toast.success(`Version v${result.version_number} published!`);
      setDetailVersion({
        ...detailVersion,
        status: "published",
        published_at: new Date().toISOString(),
      });
      loadVersions();
    } catch {
      toast.error("Failed to publish version");
    }
  };

  const copyInstructions = () => {
    if (!detailVersion?.genie_instructions) return;
    navigator.clipboard.writeText(detailVersion.genie_instructions);
    toast.success("Genie instructions copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          icon={<ScrollText className="w-7 h-7" />}
          title="Chronicle"
          subtitle="Per-realm version history — diff, approve, and publish glossary to Genie."
        />
        <div className="flex items-center justify-center flex-1">
          <Loader
            size="medium"
            message="Loading..."
            textClassName="mt-3 text-sm text-[#718096]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<ScrollText className="w-7 h-7" />}
        title="Chronicle"
        subtitle="Per-realm version history — snapshot, diff, and publish glossary."
      />

      <div className="flex flex-col gap-5 p-6 flex-1 overflow-auto">
        {/* Realm selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
              Realm
            </label>
            <select
              value={selectedRealmId || ""}
              onChange={(e) => setSelectedRealmId(Number(e.target.value))}
              className="bg-white border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none min-w-[200px]"
            >
              {realms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreateVersion}
            disabled={!selectedRealmId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Create Version
          </button>
        </div>

        {/* Versions list */}
        {loadingVersions ? (
          <div className="flex items-center justify-center py-12">
            <Loader
              size="medium"
              message="Loading versions..."
              textClassName="mt-3 text-sm text-[#718096]"
            />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center mb-4">
              <ScrollText className="w-8 h-8 text-[#3B6B96]" />
            </div>
            <h3 className="text-base font-semibold text-[#1A2332] mb-1">
              No versions yet
            </h3>
            <p className="text-sm text-[#718096] max-w-md">
              Approve your glossary in Lexicon first, then create a version to
              snapshot and publish.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => {
              const isPublished = v.status === "published";

              return (
                <div
                  key={v.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors hover:border-[#CBD5E0] ${
                    isPublished ? "border-[#4A9E7B]/30" : "border-[#E2E8F0]"
                  }`}
                  onClick={() => openVersionDetail(v)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isPublished ? "bg-[#4A9E7B]/10" : "bg-[#C69A4C]/10"
                        }`}
                      >
                        {isPublished ? (
                          <CheckCircle2 className="w-4 h-4 text-[#4A9E7B]" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#C69A4C]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A2332]">
                            v{v.version_number}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isPublished
                                ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                                : "bg-[#C69A4C]/10 text-[#C69A4C]"
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#A0AEC0] mt-0.5">
                          {v.entities_added > 0 && (
                            <span className="text-[#4A9E7B]">
                              +{v.entities_added} added
                            </span>
                          )}
                          {v.entities_modified > 0 && (
                            <span className="text-[#C69A4C]">
                              ~{v.entities_modified} modified
                            </span>
                          )}
                          {v.entities_removed > 0 && (
                            <span className="text-[#D46A6A]">
                              -{v.entities_removed} removed
                            </span>
                          )}
                          <span>
                            {v.created_at
                              ? new Date(v.created_at).toLocaleString()
                              : ""}
                          </span>
                          {v.published_at && (
                            <span>
                              Published:{" "}
                              {new Date(v.published_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPublished && (() => {
                        const realm = realms.find((r) => r.id === selectedRealmId);
                        const hasLens = !!realm?.genie_workspace_id;
                        const isDeployed = realm?.genie_deployed_version === v.version_number;

                        if (!hasLens) {
                          return (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!selectedWarehouse) {
                                  toast.error("Select a warehouse from the sidebar first");
                                  return;
                                }
                                try {
                                  const result = await ChronicleService.createGenie(v.id, selectedWarehouse.id);
                                  toast.success("Lens activated!");
                                  window.open(result.url, "_blank");
                                  const updated = await RealmService.listRealms();
                                  setRealms(updated);
                                } catch {
                                  toast.error("Failed to activate Lens");
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#162D4A] transition-colors"
                            >
                              <Telescope className="w-3.5 h-3.5" /> Activate Lens
                            </button>
                          );
                        }

                        return (
                          <>
                            {isDeployed && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#1E3A5F]/10 text-[#1E3A5F]">
                                v{v.version_number} deployed
                              </span>
                            )}
                            {!isDeployed && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await ChronicleService.updateGenie(v.id);
                                    toast.success(`Lens updated to v${v.version_number}!`);
                                    const updated = await RealmService.listRealms();
                                    setRealms(updated);
                                  } catch {
                                    toast.error("Failed to update Lens");
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#162D4A] transition-colors"
                              >
                                <Upload className="w-3.5 h-3.5" /> Update Lens
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/datalens?realm=${selectedRealmId}`, "_blank");
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#1E3A5F] text-[#1E3A5F] text-xs font-medium hover:bg-[#1E3A5F]/5 transition-colors"
                            >
                              <Telescope className="w-3.5 h-3.5" /> Open Lens
                            </button>
                          </>
                        );
                      })()}
                      <ChevronRight className="w-4 h-4 text-[#A0AEC0]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Version Detail Dialog */}
      <Dialog
        open={!!detailVersion || loadingDetail}
        onClose={() => {
          setDetailVersion(null);
          setActiveTab("changes");
        }}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        {loadingDetail ? (
          <div className="p-12 flex items-center justify-center">
            <Loader
              size="medium"
              message="Loading version..."
              textClassName="mt-3 text-sm text-[#718096]"
            />
          </div>
        ) : (
          detailVersion && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1A2332]">
                      Version v{detailVersion.version_number}
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        detailVersion.status === "published"
                          ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                          : "bg-[#C69A4C]/10 text-[#C69A4C]"
                      }`}
                    >
                      {detailVersion.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#718096] mt-0.5">
                    {detailVersion.realm_name} ·{" "}
                    {detailVersion.snapshot?.length || 0} glossary entries ·{" "}
                    {detailVersion.diff?.length || 0} changes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {detailVersion.status === "draft" && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await ChronicleService.refreshVersion(detailVersion.id);
                            const detail = await ChronicleService.getVersion(detailVersion.id);
                            setDetailVersion(detail);
                            setReviewedItems(new Set());
                            setManualExpand(new Set());
                            loadVersions();
                            toast.success("Snapshot refreshed");
                          } catch {
                            toast.error("Failed to refresh version");
                          }
                        }}
                        title="Refresh snapshot from current glossary"
                        className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#3B6B96] hover:bg-[#F0F2F5] transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this draft version?")) return;
                          try {
                            await ChronicleService.deleteVersion(detailVersion.id);
                            toast.success("Version deleted");
                            setDetailVersion(null);
                            loadVersions();
                          } catch {
                            toast.error("Failed to delete version");
                          }
                        }}
                        title="Delete draft version"
                        className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#D46A6A] hover:bg-[#F0F2F5] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handlePublish}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#162D4A] transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Publish
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setDetailVersion(null);
                      setActiveTab("changes");
                    }}
                    className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs — pill style, sticky */}
              <div className="flex gap-1 px-6 py-2 shrink-0 bg-white sticky top-0 mt-1 z-10">
                <div className="flex gap-1 bg-[#F0F2F5] rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab("changes")}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "changes"
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "text-[#718096] hover:text-[#4A5568]"
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Changes ({detailVersion.diff?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("snapshot")}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "snapshot"
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "text-[#718096] hover:text-[#4A5568]"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Full Snapshot ({detailVersion.snapshot?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("instructions")}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "instructions"
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "text-[#718096] hover:text-[#4A5568]"
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Genie Instructions
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 pt-1 pb-4">
                {activeTab === "changes" ? (
                  /* Changes / diff view */
                  <div className="space-y-4">
                    {(() => {
                      const diff = detailVersion.diff || [];
                      if (diff.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle2 className="w-8 h-8 text-[#4A9E7B] mb-3" />
                            <p className="text-sm text-[#718096]">
                              No changes from the previous published version.
                            </p>
                          </div>
                        );
                      }

                      const added = diff.filter((d: any) => d.change_type === "added");
                      const modified = diff.filter((d: any) => d.change_type === "modified");
                      const removed = diff.filter((d: any) => d.change_type === "removed");

                      const parseVal = (val?: string) => {
                        if (!val) return null;
                        try { return JSON.parse(val); } catch { return null; }
                      };

                      return (
                        <>
                          {/* Summary counts */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="border border-[#4A9E7B]/30 rounded-lg p-3 text-center bg-[#4A9E7B]/5">
                              <div className="text-lg font-bold text-[#4A9E7B]">{added.length}</div>
                              <div className="text-xs text-[#718096]">Added</div>
                            </div>
                            <div className="border border-[#C69A4C]/30 rounded-lg p-3 text-center bg-[#C69A4C]/5">
                              <div className="text-lg font-bold text-[#C69A4C]">{modified.length}</div>
                              <div className="text-xs text-[#718096]">Modified</div>
                            </div>
                            <div className="border border-[#D46A6A]/30 rounded-lg p-3 text-center bg-[#D46A6A]/5">
                              <div className="text-lg font-bold text-[#D46A6A]">{removed.length}</div>
                              <div className="text-xs text-[#718096]">Removed</div>
                            </div>
                          </div>

                          {/* Added items */}
                          {added.length > 0 && (
                            <div className="border border-[#4A9E7B]/30 rounded-lg overflow-hidden">
                              <div className="px-4 py-2.5 bg-[#4A9E7B]/10 text-sm font-semibold text-[#4A9E7B]">
                                + Added ({added.length})
                              </div>
                              <div className="divide-y divide-[#E2E8F0]">
                                {added.map((d: any, i: number) => {
                                  const val = parseVal(d.new_value);
                                  return (
                                    <div key={i} className="px-4 py-3 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.kind === "metric" ? "bg-[#3B6B96]" : d.kind === "dimension" ? "bg-[#8B5CF6]" : "bg-[#C69A4C]"}`} />
                                        <span className="text-sm font-medium text-[#1A2332]">{d.name}</span>
                                        <span className="text-[10px] text-[#A0AEC0] uppercase">{d.kind}</span>
                                        <span className="text-xs text-[#A0AEC0]">{d.entity}</span>
                                      </div>
                                      {val?.description && <p className="text-xs text-[#718096] ml-3.5">{val.description}</p>}
                                      {val?.formula && (
                                        <div className="ml-3.5 flex items-start gap-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-1.5">
                                          <span className="text-[10px] font-semibold text-[#3B6B96] uppercase tracking-wider shrink-0 mt-px">SQL</span>
                                          <code className="text-xs text-[#4A5568] font-mono break-all">{val.formula}</code>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Modified items */}
                          {modified.length > 0 && (
                            <div className="border border-[#C69A4C]/30 rounded-lg overflow-hidden">
                              <div className="px-4 py-2.5 bg-[#C69A4C]/10 text-sm font-semibold text-[#C69A4C]">
                                ~ Modified ({modified.length})
                              </div>
                              <div className="divide-y divide-[#E2E8F0]">
                                {modified.map((d: any, i: number) => {
                                  const oldVal = parseVal(d.old_value);
                                  const newVal = parseVal(d.new_value);
                                  return (
                                    <div key={i} className="px-4 py-3 space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.kind === "metric" ? "bg-[#3B6B96]" : d.kind === "dimension" ? "bg-[#8B5CF6]" : "bg-[#C69A4C]"}`} />
                                        <span className="text-sm font-medium text-[#1A2332]">{d.name}</span>
                                        <span className="text-[10px] text-[#A0AEC0] uppercase">{d.kind}</span>
                                        <span className="text-xs text-[#A0AEC0]">{d.entity}</span>
                                      </div>
                                      {oldVal?.description !== newVal?.description && (
                                        <div className="ml-3.5 space-y-0.5">
                                          <div className="text-[10px] font-semibold text-[#A0AEC0] uppercase tracking-wider">Description</div>
                                          <div className="text-xs text-[#D46A6A] line-through">{oldVal?.description}</div>
                                          <div className="text-xs text-[#4A9E7B]">{newVal?.description}</div>
                                        </div>
                                      )}
                                      {oldVal?.formula !== newVal?.formula && (
                                        <div className="ml-3.5 space-y-0.5">
                                          <div className="text-[10px] font-semibold text-[#A0AEC0] uppercase tracking-wider">Formula</div>
                                          <div className="flex items-start gap-2 bg-[#FDF2F2] border border-[#D46A6A]/20 rounded-md px-3 py-1.5">
                                            <span className="text-[10px] font-semibold text-[#D46A6A] uppercase tracking-wider shrink-0 mt-px">OLD</span>
                                            <code className="text-xs text-[#4A5568] font-mono break-all line-through">{oldVal?.formula}</code>
                                          </div>
                                          <div className="flex items-start gap-2 bg-[#F0FAF5] border border-[#4A9E7B]/20 rounded-md px-3 py-1.5">
                                            <span className="text-[10px] font-semibold text-[#4A9E7B] uppercase tracking-wider shrink-0 mt-px">NEW</span>
                                            <code className="text-xs text-[#4A5568] font-mono break-all">{newVal?.formula}</code>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Removed items */}
                          {removed.length > 0 && (
                            <div className="border border-[#D46A6A]/30 rounded-lg overflow-hidden">
                              <div className="px-4 py-2.5 bg-[#D46A6A]/10 text-sm font-semibold text-[#D46A6A]">
                                - Removed ({removed.length})
                              </div>
                              <div className="divide-y divide-[#E2E8F0]">
                                {removed.map((d: any, i: number) => {
                                  const val = parseVal(d.old_value);
                                  return (
                                    <div key={i} className="px-4 py-3 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.kind === "metric" ? "bg-[#3B6B96]" : d.kind === "dimension" ? "bg-[#8B5CF6]" : "bg-[#C69A4C]"}`} />
                                        <span className="text-sm font-medium text-[#1A2332] line-through">{d.name}</span>
                                        <span className="text-[10px] text-[#A0AEC0] uppercase">{d.kind}</span>
                                        <span className="text-xs text-[#A0AEC0]">{d.entity}</span>
                                      </div>
                                      {val?.description && <p className="text-xs text-[#718096] ml-3.5 line-through">{val.description}</p>}
                                      {val?.formula && (
                                        <div className="ml-3.5 flex items-start gap-2 bg-[#FDF2F2] border border-[#D46A6A]/20 rounded-md px-3 py-1.5">
                                          <span className="text-[10px] font-semibold text-[#D46A6A] uppercase tracking-wider shrink-0 mt-px">SQL</span>
                                          <code className="text-xs text-[#4A5568] font-mono break-all line-through">{val.formula}</code>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : activeTab === "snapshot" ? (
                  /* Grouped snapshot view */
                  <div className="space-y-3">
                    {/* Summary stats */}
                    {(() => {
                      const snapshot = detailVersion.snapshot || [];
                      return (
                        <div className="grid grid-cols-4 gap-3">
                          <div className="border border-[#E2E8F0] rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-[#1A2332]">
                              {snapshot.length}
                            </div>
                            <div className="text-xs text-[#718096]">Total</div>
                          </div>
                          <div className="border border-[#E2E8F0] rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-[#3B6B96]">
                              {
                                snapshot.filter((s: any) => s.kind === "metric")
                                  .length
                              }
                            </div>
                            <div className="text-xs text-[#718096]">
                              Metrics
                            </div>
                          </div>
                          <div className="border border-[#E2E8F0] rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-[#8B5CF6]">
                              {
                                snapshot.filter(
                                  (s: any) => s.kind === "dimension",
                                ).length
                              }
                            </div>
                            <div className="text-xs text-[#718096]">
                              Dimensions
                            </div>
                          </div>
                          <div className="border border-[#E2E8F0] rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-[#C69A4C]">
                              {
                                snapshot.filter(
                                  (s: any) => s.kind === "definition",
                                ).length
                              }
                            </div>
                            <div className="text-xs text-[#718096]">
                              Definitions
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Review progress bar */}
                    {(() => {
                      const total = detailVersion.snapshot?.length || 0;
                      const reviewed =
                        detailVersion.snapshot?.filter((s: any) =>
                          reviewedItems.has(`${s.kind}:${s.entity}:${s.name}`),
                        ).length || 0;
                      if (total === 0) return null;
                      const pct = Math.round((reviewed / total) * 100);
                      return (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4A9E7B] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#718096] shrink-0">
                            {reviewed}/{total} reviewed
                          </span>
                        </div>
                      );
                    })()}

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#A0AEC0] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search metrics, dimensions, entities..."
                        value={snapshotSearch}
                        onChange={(e) => setSnapshotSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#1A2332] placeholder-[#A0AEC0] focus:border-[#1E3A5F] outline-none"
                      />
                    </div>

                    {/* Grouped by entity */}
                    {(() => {
                      const snapshot = detailVersion.snapshot || [];
                      const diff = detailVersion.diff || [];
                      const diffMap = new Map(
                        diff.map((d: any) => [
                          `${d.kind}:${d.entity}:${d.name}`,
                          d.change_type,
                        ]),
                      );
                      const q = snapshotSearch.toLowerCase().trim();
                      const filtered = q
                        ? snapshot.filter(
                            (s: any) =>
                              s.name?.toLowerCase().includes(q) ||
                              s.entity?.toLowerCase().includes(q) ||
                              s.description?.toLowerCase().includes(q) ||
                              s.formula?.toLowerCase().includes(q) ||
                              s.kind?.toLowerCase().includes(q),
                          )
                        : snapshot;
                      const entities = Array.from(
                        new Set(filtered.map((s: any) => s.entity)),
                      );

                      return entities.map((entityName) => {
                        const items = filtered.filter(
                          (s: any) => s.entity === entityName,
                        );
                        const metrics = items.filter(
                          (s: any) => s.kind === "metric",
                        );
                        const dimensions = items.filter(
                          (s: any) => s.kind === "dimension",
                        );
                        const definitions = items.filter(
                          (s: any) => s.kind === "definition",
                        );
                        const allItems = [
                          ...metrics,
                          ...dimensions,
                          ...definitions,
                        ];
                        const itemKeys = allItems.map(
                          (it: any) => `${it.kind}:${entityName}:${it.name}`,
                        );
                        const allEntityChecked =
                          itemKeys.length > 0 &&
                          itemKeys.every((k) => reviewedItems.has(k));
                        const someEntityChecked = itemKeys.some((k) =>
                          reviewedItems.has(k),
                        );

                        // Auto-collapse when all reviewed, unless manually expanded
                        const isCollapsed = allEntityChecked && !manualExpand.has(entityName);

                        const toggleCollapse = () => {
                          setManualExpand((prev) => {
                            const next = new Set(prev);
                            if (next.has(entityName)) next.delete(entityName);
                            else next.add(entityName);
                            return next;
                          });
                        };

                        return (
                          <div
                            key={entityName}
                            className={`border rounded-lg overflow-hidden ${allEntityChecked ? "border-[#4A9E7B]/30" : "border-[#E2E8F0]"}`}
                          >
                            <div
                              className={`px-4 py-2.5 flex items-center justify-between cursor-pointer select-none ${allEntityChecked ? "bg-[#F0FAF5]" : "bg-[#F5F7FA]"}`}
                              onClick={toggleCollapse}
                            >
                              <div className="flex items-center gap-2.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEntityReviewed(entityName, itemKeys);
                                  }}
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    allEntityChecked
                                      ? "bg-[#4A9E7B] border-[#4A9E7B]"
                                      : someEntityChecked
                                        ? "bg-[#4A9E7B]/30 border-[#4A9E7B]"
                                        : "border-[#CBD5E0] hover:border-[#A0AEC0]"
                                  }`}
                                >
                                  {allEntityChecked && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                  {someEntityChecked && !allEntityChecked && (
                                    <div className="w-1.5 h-0.5 bg-white rounded-full" />
                                  )}
                                </button>
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5 text-[#A0AEC0]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#A0AEC0]" />
                                )}
                                <Boxes className="w-3.5 h-3.5 text-[#3B6B96]" />
                                <span className={`text-sm font-semibold ${allEntityChecked ? "text-[#718096]" : "text-[#1A2332]"}`}>
                                  {entityName}
                                </span>
                                {allEntityChecked && (
                                  <span className="text-[10px] text-[#4A9E7B] font-medium">Reviewed</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#A0AEC0]">
                                {metrics.length > 0 && (
                                  <span className="text-[#3B6B96]">
                                    {metrics.length} metrics
                                  </span>
                                )}
                                {dimensions.length > 0 && (
                                  <span className="text-[#8B5CF6]">
                                    {dimensions.length} dimensions
                                  </span>
                                )}
                                {definitions.length > 0 && (
                                  <span className="text-[#C69A4C]">{definitions.length} definitions</span>
                                )}
                              </div>
                            </div>

                            {!isCollapsed && <div className="divide-y divide-[#E2E8F0]">
                              {allItems.map((item: any, i: number) => {
                                const itemKey = `${item.kind}:${entityName}:${item.name}`;
                                const changeType = diffMap.get(itemKey);
                                const isReviewed = reviewedItems.has(itemKey);
                                const formula = item.formula;
                                const sourceRef = item.source_column
                                  ? `${item.source_table?.split(".").pop() || ""}.${item.source_column}`
                                  : null;

                                return (
                                  <div
                                    key={i}
                                    className={`px-4 py-3 flex items-start gap-3 transition-colors ${isReviewed ? "bg-[#FAFDF9]" : ""}`}
                                  >
                                    {/* Checkbox */}
                                    <button
                                      onClick={() => toggleReviewed(itemKey)}
                                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                        isReviewed
                                          ? "bg-[#4A9E7B] border-[#4A9E7B]"
                                          : "border-[#CBD5E0] hover:border-[#A0AEC0]"
                                      }`}
                                    >
                                      {isReviewed && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                    </button>

                                    {/* Kind dot */}
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${
                                        item.kind === "metric"
                                          ? "bg-[#3B6B96]"
                                          : item.kind === "dimension"
                                            ? "bg-[#8B5CF6]"
                                            : "bg-[#C69A4C]"
                                      }`}
                                    />

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      {/* Title row */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-sm font-medium ${isReviewed ? "text-[#718096] line-through" : "text-[#1A2332]"}`}
                                        >
                                          {item.name}
                                        </span>
                                        {changeType && (
                                          <span
                                            className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium ${
                                              changeType === "added"
                                                ? "bg-[#4A9E7B]/10 text-[#4A9E7B]"
                                                : changeType === "modified"
                                                  ? "bg-[#C69A4C]/10 text-[#C69A4C]"
                                                  : "bg-[#D46A6A]/10 text-[#D46A6A]"
                                            }`}
                                          >
                                            {changeType}
                                          </span>
                                        )}
                                      </div>
                                      {/* Description */}
                                      {item.description && (
                                        <p className="text-xs text-[#718096] leading-relaxed">
                                          {item.description}
                                        </p>
                                      )}
                                      {/* Formula — highlighted block */}
                                      {formula && (
                                        <div className="flex items-start gap-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2">
                                          <span className="text-[10px] font-semibold text-[#3B6B96] uppercase tracking-wider shrink-0 mt-px">
                                            SQL
                                          </span>
                                          <code className="text-xs text-[#4A5568] font-mono break-all">
                                            {formula}
                                          </code>
                                        </div>
                                      )}
                                      {/* Source column ref — highlighted inline */}
                                      {sourceRef && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-semibold text-[#8B5CF6] uppercase tracking-wider">
                                            Column
                                          </span>
                                          <code className="text-xs text-[#4A5568] font-mono bg-[#F5F7FA] border border-[#E2E8F0] rounded px-2 py-0.5">
                                            {sourceRef}
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  /* Genie instructions view */
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-[#718096]">
                        These instructions are generated from your approved
                        glossary. Copy them to configure a Genie workspace, or
                        use "Publish" to create one automatically.
                      </p>
                      <button
                        onClick={copyInstructions}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#3B6B96] hover:bg-[#1E3A5F]/8 transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                    <pre className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg p-4 text-xs text-[#4A5568] font-mono whitespace-pre-wrap overflow-auto max-h-[50vh]">
                      {detailVersion.genie_instructions ||
                        "No instructions generated."}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )
        )}
      </Dialog>
    </div>
  );
}

import { Loader } from "@/components/reusable/loader";
import { useResources } from "@/lib/resource-context";
import CatalogService from "@/services/catalogservice";
import ScanService, { CatalogScan, ScanProposal } from "@/services/scanservice";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  RefreshCw,
  X,
  XCircle,
  Cpu,
  DatabaseZap,
  Table2,
  Boxes,
  FileText,
  Layers,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ProposalCard } from "./ProposalCard";
import { PageHeader } from "@/components/reusable/page-header";
import { Dialog } from "@/components/reusable/dialog";
import { useUrlState } from "@/lib/use-url-state";

export function ScanPage() {
  const { getParam, getParamNumber, setParam, setParams } = useUrlState();
  const {
    selectedWarehouse,
    selectedEndpoint,
    loading: resourcesLoading,
  } = useResources();

  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [schemaDropdownOpen, setSchemaDropdownOpen] = useState(false);
  const schemaDropdownRef = useRef<HTMLDivElement>(null);

  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<CatalogScan[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Proposal dialog
  // URL-driven proposal dialog
  const urlScanId = getParamNumber("scan");
  const [proposalDialogOpen, setProposalDialogOpenState] = useState(!!urlScanId);
  const [proposalScan, setProposalScan] = useState<CatalogScan | null>(null);
  const setProposalDialogOpen = (open: boolean) => {
    setProposalDialogOpenState(open);
    if (!open) setParam("scan", null);
  };
  const [proposals, setProposals] = useState<ScanProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [expandedProposals, setExpandedProposals] = useState<Set<number>>(new Set());

  useEffect(() => {
    CatalogService.getCatalogs()
      .then((data) => {
        setCatalogs(data);
        if (data.length > 0) setSelectedCatalog(data[0]);
      })
      .catch(() => {});
    loadScanHistory();
  }, []);

  // Restore proposal dialog from URL
  useEffect(() => {
    if (urlScanId && scanHistory.length > 0 && !proposalScan) {
      const scan = scanHistory.find((s) => s.id === urlScanId);
      if (scan) openProposals(scan);
    }
  }, [urlScanId, scanHistory]);

  const loadScanHistory = () => {
    setLoadingHistory(true);
    ScanService.getScans()
      .then((data) => {
        // Sort: scanning first, then complete (actionable), then rest
        const sorted = [...data].sort((a, b) => {
          const priority = (s: CatalogScan) => {
            if (s.status === "scanning") return 0;
            if (s.status === "complete") return 1;
            if (s.status === "failed") return 3;
            return 2;
          };
          return priority(a) - priority(b);
        });
        setScanHistory(sorted);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (!selectedCatalog) return;
    setSchemas([]);
    setSelectedSchemas([]);
    CatalogService.getSchemas(selectedCatalog).then(setSchemas).catch(() => {});
  }, [selectedCatalog]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (schemaDropdownRef.current && !schemaDropdownRef.current.contains(e.target as Node)) {
        setSchemaDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Poll for any scanning items
  useEffect(() => {
    const scanningItems = scanHistory.filter((s) => s.status === "scanning");
    if (scanningItems.length === 0) return;

    const interval = setInterval(async () => {
      let changed = false;
      for (const scan of scanningItems) {
        try {
          const status = await ScanService.getMindScanStatus(scan.id);
          if (status.status !== "scanning") {
            changed = true;
            if (status.status === "complete") {
              toast.success(`Scan complete: ${status.entity_count || 0} entities found`);
            } else if (status.status === "failed") {
              toast.error(`Scan failed: ${status.status_message}`);
            }
          }
        } catch {}
      }
      if (changed) loadScanHistory();
    }, 3000);

    return () => clearInterval(interval);
  }, [scanHistory]);

  const toggleSchema = (schema: string) => {
    setSelectedSchemas((prev) =>
      prev.includes(schema) ? prev.filter((s) => s !== schema) : [...prev, schema]
    );
  };

  const selectAllSchemas = () => {
    setSelectedSchemas(selectedSchemas.length === schemas.length ? [] : [...schemas]);
  };

  const handleScan = async () => {
    if (!selectedCatalog || selectedSchemas.length === 0) {
      toast.warning("Select a catalog and at least one schema");
      return;
    }
    if (!selectedWarehouse) {
      toast.warning("Select a SQL Warehouse from Resources");
      return;
    }
    if (!selectedEndpoint) {
      toast.warning("Select an AI Model from Resources");
      return;
    }

    setScanning(true);
    try {
      await ScanService.startMindScan(
        selectedCatalog,
        selectedSchemas,
        selectedWarehouse.id,
        selectedEndpoint.name
      );
      toast.info("Scan started — tracking progress...");
      loadScanHistory();
    } catch (err: any) {
      toast.error(err?.message || "Scan failed to start");
    } finally {
      setScanning(false);
    }
  };

  const openProposals = async (scan: CatalogScan) => {
    setProposalScan(scan);
    setParam("scan", scan.id);
    setProposalDialogOpenState(true);
    setLoadingProposals(true);
    setExpandedProposals(new Set());
    try {
      const data = await ScanService.getMindScanProposals(scan.id);
      setProposals(data);
    } catch {
      toast.error("Failed to load proposals");
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleAccept = useCallback(async (proposalId: number) => {
    if (!proposalScan) return;
    try {
      const updated = await ScanService.acceptProposal(proposalScan.id, proposalId);
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
      toast.success("Entity accepted");
    } catch {
      toast.error("Failed to accept proposal");
    }
  }, [proposalScan]);

  const handleReject = useCallback(async (proposalId: number) => {
    if (!proposalScan) return;
    try {
      const updated = await ScanService.rejectProposal(proposalScan.id, proposalId);
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
      toast.info("Entity rejected");
    } catch {
      toast.error("Failed to reject proposal");
    }
  }, [proposalScan]);

  const toggleExpand = (proposalId: number) => {
    setExpandedProposals((prev) => {
      const next = new Set(Array.from(prev));
      next.has(proposalId) ? next.delete(proposalId) : next.add(proposalId);
      return next;
    });
  };

  const scanStatusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    scanning: { label: "Scanning", color: "text-[#3B6B96]", bg: "bg-[#1E3A5F]/10", icon: RefreshCw },
    complete: { label: "Complete", color: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10", icon: CheckCircle2 },
    failed: { label: "Failed", color: "text-[#D46A6A]", bg: "bg-[#D46A6A]/10", icon: XCircle },
    pending: { label: "Pending", color: "text-[#718096]", bg: "bg-[#718096]/10", icon: Clock },
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<DatabaseZap className="w-7 h-7" />}
        title="MindScan"
        subtitle="Scan Unity Catalog schemas and let AI classify entities, tables, and glossary terms."
      />
      <div className="flex flex-col gap-5 p-6 flex-1 overflow-auto">

        {/* Scan Configuration */}
        <div className="border border-[#E2E8F0] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#1A2332]">New Scan</h2>
              <p className="text-xs text-[#718096] mt-0.5">Select a catalog and schemas to analyze.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#718096]">
              {selectedWarehouse && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F0F2F5]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{selectedWarehouse.name}</span>
                </div>
              )}
              {selectedEndpoint && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F0F2F5]">
                  <Cpu className="w-3 h-3 text-[#C69A4C]" />
                  <span>{selectedEndpoint.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Catalog</label>
              <select
                value={selectedCatalog}
                onChange={(e) => setSelectedCatalog(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none min-w-[200px]"
              >
                {catalogs.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 relative" ref={schemaDropdownRef}>
              <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Schemas</label>
              <button
                onClick={() => setSchemaDropdownOpen(!schemaDropdownOpen)}
                disabled={schemas.length === 0}
                className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none min-w-[240px] disabled:opacity-50"
              >
                <span className="truncate">
                  {selectedSchemas.length === 0 ? "Select schemas..."
                    : selectedSchemas.length === schemas.length ? "All schemas"
                    : `${selectedSchemas.length} selected`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#718096] shrink-0 ml-2" />
              </button>
              {schemaDropdownOpen && schemas.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E2E8F0] rounded-lg shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  <button onClick={selectAllSchemas} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-[#F5F7FA] transition-colors border-b border-[#E2E8F0]">
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                      selectedSchemas.length === schemas.length ? "bg-[#1E3A5F] border-[#1E3A5F]"
                        : selectedSchemas.length > 0 ? "border-[#1E3A5F] bg-[#1E3A5F]/30" : "border-[#CBD5E0]"
                    }`}>
                      {selectedSchemas.length > 0 && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm text-[#4A5568] font-medium">Select All</span>
                  </button>
                  {schemas.map((s) => (
                    <button key={s} onClick={() => toggleSchema(s)} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-[#F5F7FA] transition-colors">
                      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                        selectedSchemas.includes(s) ? "bg-[#1E3A5F] border-[#1E3A5F]" : "border-[#CBD5E0]"
                      }`}>
                        {selectedSchemas.includes(s) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-sm text-[#1A2332]">{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleScan}
              disabled={scanning || !selectedCatalog || selectedSchemas.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors disabled:opacity-50"
            >
              {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Starting...</> : <><DatabaseZap className="w-4 h-4" /> Scan Now</>}
            </button>
          </div>
        </div>

        {/* No resources warning */}
        {(!selectedWarehouse || !selectedEndpoint) && !resourcesLoading && (
          <div className="flex items-center gap-3 bg-[#C69A4C]/10 border border-[#C69A4C]/25 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-[#C69A4C] shrink-0" />
            <span className="text-sm text-[#C69A4C]">Select a SQL Warehouse and AI Model from the sidebar Resources section before scanning.</span>
          </div>
        )}

        {/* Scan History */}
        <div>
          <h2 className="text-sm font-semibold text-[#1A2332] mb-3">
            Scan History
            {scanHistory.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-[#A0AEC0]">({scanHistory.length})</span>
            )}
          </h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <Loader size="medium" message="Loading scans..." textClassName="mt-3 text-sm text-[#718096]" />
            </div>
          ) : scanHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center mb-4">
                <DatabaseZap className="w-8 h-8 text-[#3B6B96]" />
              </div>
              <h3 className="text-base font-semibold text-[#1A2332] mb-1">Ready to discover entities</h3>
              <p className="text-sm text-[#718096] max-w-md">
                Select a catalog and schema above, then click <strong>Scan Now</strong> to let AI analyze your tables and propose business entities.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {scanHistory.map((scan) => {
                const cfg = scanStatusConfig[scan.status] || scanStatusConfig.pending;
                const StatusIcon = cfg.icon;
                const isActionable = scan.status === "complete";
                const isScanning = scan.status === "scanning";

                return (
                  <div
                    key={scan.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      isActionable ? "border-[#1E3A5F]/30 bg-[#1E3A5F]/[0.02]" : "border-[#E2E8F0]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <StatusIcon className={`w-4 h-4 ${cfg.color} ${isScanning ? "animate-spin" : ""}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-[#1A2332]">{scan.catalog_name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-xs text-[#718096] mb-2">
                            {scan.schema_name || "All schemas"}
                          </p>
                          {scan.status_message && (isScanning || scan.status === "failed") && (
                            <p className="text-xs text-[#3B6B96] italic">{scan.status_message}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-[#A0AEC0]">
                            {scan.table_count != null && (
                              <div className="flex items-center gap-1">
                                <Table2 className="w-3 h-3" />
                                <span>{scan.table_count} tables</span>
                              </div>
                            )}
                            {scan.entity_count != null && (
                              <div className="flex items-center gap-1">
                                <Boxes className="w-3 h-3" />
                                <span>{scan.entity_count} entities</span>
                              </div>
                            )}
                            {scan.proposal_count != null && (
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <span>{scan.proposal_count} proposals</span>
                              </div>
                            )}
                            <span>
                              {scan.created_at ? new Date(scan.created_at).toLocaleString() : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActionable && (
                          <button
                            onClick={() => openProposals(scan)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5" /> Review Proposals
                          </button>
                        )}
                        {isScanning && (
                          <span className="text-xs text-[#3B6B96] font-medium">In progress...</span>
                        )}
                        {scan.status === "failed" && (
                          <button
                            onClick={async () => {
                              try {
                                await ScanService.retryMindScan(scan.id);
                                toast.info("Retrying scan...");
                                loadScanHistory();
                              } catch {
                                toast.error("Failed to retry scan");
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#1E3A5F] text-[#1E3A5F] text-xs font-medium hover:bg-[#1E3A5F]/5 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Proposals Dialog */}
      <Dialog open={proposalDialogOpen} onClose={() => setProposalDialogOpen(false)} className="w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#1A2332]">
                  AI Proposals — {proposalScan?.catalog_name}
                </h2>
                <p className="text-xs text-[#718096]">
                  {proposalScan?.schema_name} · {proposals.length} entities proposed
                </p>
              </div>
              <div className="flex items-center gap-3">
                {proposals.length > 0 && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-[#4A9E7B]">{proposals.filter((p) => p.status === "accepted").length} accepted</span>
                    <span className="text-[#718096]">·</span>
                    <span className="text-[#D46A6A]">{proposals.filter((p) => p.status === "rejected").length} rejected</span>
                    <span className="text-[#718096]">·</span>
                    <span>{proposals.filter((p) => p.status === "proposed").length} pending</span>
                  </div>
                )}
                <button onClick={() => setProposalDialogOpen(false)} className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Dialog body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingProposals ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size="medium" message="Loading proposals..." textClassName="mt-3 text-sm text-[#718096]" />
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-12 text-sm text-[#718096]">No proposals found for this scan.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {proposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      expanded={expandedProposals.has(p.id)}
                      onToggleExpand={() => toggleExpand(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Dialog footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] shrink-0">
              <span className="text-xs text-[#A0AEC0]">
                Accepted entities will appear in Entity Hub.
              </span>
              <button
                onClick={() => setProposalDialogOpen(false)}
                className="px-4 py-2 rounded-md text-sm text-[#718096] hover:bg-[#F0F2F5] transition-colors"
              >
                Close
              </button>
            </div>
      </Dialog>
    </div>
  );
}

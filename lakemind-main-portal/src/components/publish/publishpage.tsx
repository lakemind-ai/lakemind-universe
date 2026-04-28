import React, { useEffect, useState } from "react";
import {
  Upload,
  CheckCircle2,
  Clock,
  Archive,
  ChevronRight,
  Plus,
  Minus,
  Edit3,
  GitBranch,
  Shield,
  Zap,
  FileText,
  ArrowUpRight,
  User,
  Calendar,
} from "lucide-react";
import GlossaryService, { GlossaryVersion, VersionChange, AuditEntry } from "@/services/glossaryservice";
import { cn } from "@/lib/utils";

const versionStatusConfig = {
  draft: { label: "Draft", color: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10", icon: Edit3 },
  staged: { label: "Staged", color: "text-[#3B6B96]", bg: "bg-[#1E3A5F]/10", icon: GitBranch },
  published: { label: "Published", color: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10", icon: CheckCircle2 },
  archived: { label: "Archived", color: "text-[#718096]", bg: "bg-[#6B7589]/10", icon: Archive },
};

const changeTypeConfig = {
  added: { label: "Added", color: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10", icon: Plus },
  modified: { label: "Modified", color: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10", icon: Edit3 },
  removed: { label: "Removed", color: "text-[#D46A6A]", bg: "bg-[#D46A6A]/10", icon: Minus },
};

export function PublishPage() {
  const [versions, setVersions] = useState<GlossaryVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<GlossaryVersion | null>(null);
  const [diff, setDiff] = useState<VersionChange[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [staging, setStaging] = useState(false);

  useEffect(() => {
    setLoading(true);
    GlossaryService.getVersions()
      .then((data) => {
        setVersions(data);
        if (data.length > 0) setSelectedVersion(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedVersion) return;
    Promise.all([
      GlossaryService.getDiff(selectedVersion.id),
      GlossaryService.getAudit(selectedVersion.id),
    ])
      .then(([diffData, auditData]) => {
        setDiff(diffData);
        setAudit(auditData);
      })
      .catch(() => {});
  }, [selectedVersion]);

  const handlePublish = async () => {
    if (!selectedVersion) return;
    setPublishing(true);
    try {
      const updated = await GlossaryService.publish(selectedVersion.id);
      setSelectedVersion(updated);
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch {}
    setPublishing(false);
  };

  const handleStage = async () => {
    if (!selectedVersion) return;
    setStaging(true);
    try {
      const updated = await GlossaryService.stage(selectedVersion.id);
      setSelectedVersion(updated);
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch {}
    setStaging(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1E3A5F]" />
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left sidebar: version list */}
      <div className="w-72 shrink-0 border-r border-[#E2E8F0] flex flex-col bg-[#F5F7FA] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <h2 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#3B6B96]" />
            Versions
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {versions.map((version) => {
            const isSelected = selectedVersion?.id === version.id;
            const status = versionStatusConfig[version.status] || versionStatusConfig.draft;
            const StatusIcon = status.icon;
            return (
              <button
                key={version.id}
                onClick={() => setSelectedVersion(version)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors",
                  isSelected ? "bg-[#1E3A5F]/10 border border-[#1E3A5F]/30" : "hover:bg-white border border-transparent"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1A2332]">
                    {version.label || `v${version.version_number}`}
                  </span>
                  <span className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded", status.bg, status.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <div className="text-xs text-[#718096]">
                  {version.change_count} change{version.change_count !== 1 ? "s" : ""}
                  {version.changes_summary && ` -- ${version.changes_summary}`}
                </div>
                <div className="text-xs text-[#718096] mt-0.5">
                  {version.created_at ? new Date(version.created_at).toLocaleDateString() : ""}
                </div>
              </button>
            );
          })}
          {versions.length === 0 && (
            <div className="text-center py-8 text-sm text-[#718096]">
              No versions yet
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto bg-[#F5F7FA] p-6">
        {selectedVersion ? (
          <div className="max-w-4xl">
            {/* Publish hero */}
            {selectedVersion.status === "draft" && (
              <div className="bg-gradient-to-r from-[#1E3A5F]/10 to-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A2332] mb-1">
                      Ready to publish {selectedVersion.label || `Draft v${selectedVersion.version_number}`}?
                    </h2>
                    <p className="text-sm text-[#4A5568]">
                      {selectedVersion.change_count} change{selectedVersion.change_count !== 1 ? "s" : ""} from the previous version
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStage}
                      disabled={staging}
                      className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#4A5568] hover:bg-white hover:text-[#1A2332] transition-colors disabled:opacity-60"
                    >
                      {staging ? "Staging..." : "Stage"}
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-4 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#162D4A] text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      {publishing ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedVersion.status === "staged" && (
              <div className="bg-gradient-to-r from-[#1E3A5F]/10 to-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A2332] mb-1">
                      {selectedVersion.label || `v${selectedVersion.version_number}`} is staged
                    </h2>
                    <p className="text-sm text-[#4A5568]">Review changes and publish when ready</p>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-4 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#162D4A] text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>
            )}

            {selectedVersion.status === "published" && (
              <div className="bg-[#4A9E7B]/10 border border-[#4A9E7B]/20 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#4A9E7B]" />
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A2332]">
                      {selectedVersion.label || `v${selectedVersion.version_number}`} is live
                    </h2>
                    <p className="text-sm text-[#4A5568]">
                      Published {selectedVersion.published_at ? new Date(selectedVersion.published_at).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Impact section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#1A2332] mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#C69A4C]" />
                Impact
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-[#3B6B96]" />
                    <span className="text-sm font-medium text-[#1A2332]">Genie Workspace Upgrades</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#4A5568]">Sales Analytics</span>
                      <span className="text-[#4A9E7B] flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> Auto-upgrade
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#4A5568]">Executive Dashboard</span>
                      <span className="text-[#C69A4C] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Review needed
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#3B6B96]" />
                    <span className="text-sm font-medium text-[#1A2332]">Summary</span>
                  </div>
                  <div className="space-y-1 text-xs text-[#4A5568]">
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-3 h-3 text-[#4A9E7B]" />
                      <span>{diff.filter((d) => d.change_type === "added").length} added</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Edit3 className="w-3 h-3 text-[#C69A4C]" />
                      <span>{diff.filter((d) => d.change_type === "modified").length} modified</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Minus className="w-3 h-3 text-[#D46A6A]" />
                      <span>{diff.filter((d) => d.change_type === "removed").length} removed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff view */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#1A2332] mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#3B6B96]" />
                Changes from previous version
              </h3>
              <div className="space-y-2">
                {diff.map((change) => {
                  const changeConfig = changeTypeConfig[change.change_type] || changeTypeConfig.modified;
                  const ChangeIcon = changeConfig.icon;
                  return (
                    <div key={change.id} className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded", changeConfig.bg, changeConfig.color)}>
                            <ChangeIcon className="w-3 h-3" />
                            {changeConfig.label}
                          </span>
                          <span className="text-sm font-medium text-[#1A2332]">{change.entity_name}</span>
                          <span className="text-xs text-[#718096]">{change.field}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#4A5568]">{change.description}</p>
                      {change.old_value && change.new_value && (
                        <div className="mt-2 bg-[#F5F7FA] rounded px-3 py-2 text-xs font-mono space-y-1">
                          <div className="flex items-center gap-1.5 text-[#D46A6A]">
                            <Minus className="w-3 h-3" />
                            <span className="opacity-60">{change.old_value}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#4A9E7B]">
                            <Plus className="w-3 h-3" />
                            <span>{change.new_value}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {diff.length === 0 && (
                  <div className="text-center py-6 text-sm text-[#718096] bg-white border border-[#E2E8F0] rounded-lg">
                    No changes in this version
                  </div>
                )}
              </div>
            </div>

            {/* Audit trail */}
            <div>
              <h3 className="text-sm font-semibold text-[#1A2332] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#718096]" />
                Audit Trail
              </h3>
              <div className="space-y-0">
                {audit.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 pb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#232B38] mt-1.5" />
                      {i < audit.length - 1 && <div className="w-px flex-1 bg-[#232B38] mt-1" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#1A2332] font-medium">{entry.action}</span>
                        <span className="text-[#718096]">by {entry.actor}</span>
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">{entry.details}</p>
                      <p className="text-xs text-[#718096] mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {audit.length === 0 && (
                  <div className="text-center py-6 text-sm text-[#718096] bg-white border border-[#E2E8F0] rounded-lg">
                    No audit entries yet
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#718096]">
            <GitBranch className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select a version to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

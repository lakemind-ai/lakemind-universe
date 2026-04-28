import React from "react";
import { CheckCircle2, XCircle, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { ScanProposal, GlossaryEntryProposal } from "@/services/scanservice";

interface ProposalCardProps {
  proposal: ScanProposal;
  onAccept: (proposalId: number) => void;
  onReject: (proposalId: number) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const confidenceColor = (score: number) => {
  if (score >= 0.8) return { text: "text-[#4A9E7B]", bg: "bg-[#4A9E7B]/10", border: "border-[#4A9E7B]" };
  if (score >= 0.6) return { text: "text-[#C69A4C]", bg: "bg-[#C69A4C]/10", border: "border-[#C69A4C]" };
  return { text: "text-[#D46A6A]", bg: "bg-[#D46A6A]/10", border: "border-[#D46A6A]" };
};

const kindBadge = (kind: string) => {
  switch (kind) {
    case "metric":
      return "bg-[rgba(91,127,232,0.12)] text-[#3B6B96]";
    case "dimension":
      return "bg-[rgba(139,92,246,0.1)] text-[#8B5CF6]";
    default:
      return "bg-[#F0F2F5] text-[#4A5568]";
  }
};

export function ProposalCard({
  proposal,
  onAccept,
  onReject,
  expanded = false,
  onToggleExpand,
}: ProposalCardProps) {
  const conf = confidenceColor(proposal.confidence_score || 0);
  const isReviewed = proposal.status !== "proposed";

  const metrics = proposal.glossary_entries.filter((e) => e.kind === "metric");
  const dimensions = proposal.glossary_entries.filter((e) => e.kind === "dimension");
  const definitions = proposal.glossary_entries.filter((e) => e.kind === "definition");

  return (
    <div
      className={`bg-white rounded-lg border transition-colors ${
        isReviewed
          ? proposal.status === "accepted"
            ? "border-[#4A9E7B]/30"
            : "border-[#D46A6A]/30 opacity-60"
          : "border-[#E2E8F0] hover:border-[#CBD5E0]"
      }`}
      style={{ borderLeftWidth: "3px", borderLeftColor: isReviewed
        ? proposal.status === "accepted" ? "#4A9E7B" : "#D46A6A"
        : conf.border.replace("border-", "").replace("[", "").replace("]", "")
      }}
    >
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-[#1A2332]">
              {proposal.proposed_name}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conf.bg} ${conf.text}`}>
              {Math.round((proposal.confidence_score || 0) * 100)}% confidence
            </span>
            <span className="text-sm text-[#718096]">
              {proposal.table_names.length} tables · {proposal.glossary_entries.length} glossary proposals
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isReviewed && (
              <>
                <button
                  onClick={() => onAccept(proposal.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                </button>
                <button
                  onClick={() => onReject(proposal.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F0F2F5] text-[#4A5568] text-sm font-medium border border-[#E2E8F0] hover:bg-[#232B38] transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
            {isReviewed && (
              <span className={`text-sm font-medium ${
                proposal.status === "accepted" ? "text-[#4A9E7B]" : "text-[#D46A6A]"
              }`}>
                {proposal.status === "accepted" ? "✓ Accepted" : "✕ Rejected"}
              </span>
            )}
          </div>
        </div>

        {proposal.proposed_description && (
          <p className="text-sm text-[#718096] italic mb-2">
            "{proposal.proposed_description}"
          </p>
        )}

        {/* Table list */}
        <div className="text-sm text-[#718096] mb-2">
          Tables: {proposal.table_names.join(", ")}
        </div>

        {/* Glossary summary badges */}
        <div className="flex gap-2 flex-wrap">
          {metrics.map((m) => (
            <span key={m.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kindBadge("metric")}`}>
              Metric: {m.name}
            </span>
          ))}
          {dimensions.map((d) => (
            <span key={d.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kindBadge("dimension")}`}>
              Dim: {d.name}
            </span>
          ))}
          {definitions.length > 0 && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kindBadge("definition")}`}>
              +{definitions.length} definitions
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {onToggleExpand && proposal.glossary_entries.length > 0 && (
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium text-[#3B6B96] bg-[#1E3A5F]/8 hover:bg-[#1E3A5F]/15 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Hide" : "View"} glossary details ({proposal.glossary_entries.length})
          </button>
        )}
      </div>

      {/* Expanded glossary detail */}
      {expanded && (
        <div className="border-t border-[#E2E8F0] px-4 py-3">
          {metrics.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider mb-2">
                Metrics (entity-level)
              </h4>
              {metrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0] last:border-0">
                  <div>
                    <span className="text-sm font-medium text-[#1A2332]">{m.name}</span>
                    {m.formula && (
                      <span className="ml-2 text-xs text-[#718096] font-mono">{m.formula}</span>
                    )}
                  </div>
                  <span className={`text-xs ${conf.text}`}>
                    {Math.round((m.confidence_score || 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {dimensions.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider mb-2">
                Dimensions (column-level)
              </h4>
              {dimensions.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0] last:border-0">
                  <div>
                    <span className="text-sm font-medium text-[#1A2332]">{d.name}</span>
                    <span className="ml-2 text-xs text-[#718096]">
                      {d.source_table ? `${d.source_table}.` : ""}{d.source_column}
                    </span>
                  </div>
                  <span className={`text-xs ${conf.text}`}>
                    {Math.round((d.confidence_score || 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {definitions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider mb-2">
                Definitions (table/column)
              </h4>
              {definitions.map((d) => (
                <div key={d.id} className="py-1.5 border-b border-[#E2E8F0] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1A2332]">{d.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[#718096]">{d.scope}</span>
                  </div>
                  {d.description && (
                    <p className="text-xs text-[#718096] mt-0.5">{d.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

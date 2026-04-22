import React, { useEffect, useState, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Edit3,
  Sparkles,
  Send,
  Table2,
  Columns3,
  Zap,
  X,
  Plus,
  Minus,
  MessageSquare,
} from "lucide-react";
import EntityService, { Entity, GlossaryMetric, GlossaryDimension } from "@/services/entityservice";
import { cn } from "@/lib/utils";

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [metrics, setMetrics] = useState<GlossaryMetric[]>([]);
  const [dimensions, setDimensions] = useState<GlossaryDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; proposal?: any }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      EntityService.getEntity(id),
      EntityService.getMetrics(id),
      EntityService.getDimensions(id),
    ])
      .then(([entityData, metricsData, dimsData]) => {
        setEntity(entityData);
        setMetrics(metricsData);
        setDimensions(dimsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleApproveMetric = async (metricId: string) => {
    try {
      const updated = await EntityService.approveMetric(metricId);
      setMetrics((prev) => prev.map((m) => (m.id === metricId ? { ...m, status: "approved" } : m)));
    } catch {}
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !metrics[0]) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const result = await EntityService.aiRefine(metrics[0].id, userMsg);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.explanation,
          proposal: result.suggestion,
        },
      ]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "I could not process that request. Please try again." }]);
    }
    setChatLoading(false);
  };

  const suggestionChips = [
    "Add a rolling 30-day average",
    "Break down by region",
    "Exclude test accounts",
    "Normalize to USD",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5B7FE8]" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6B7589]">
        <p>Entity not found</p>
        <button onClick={() => history.push("/scan")} className="mt-2 text-[#5B7FE8] text-sm hover:underline">
          Back to Scan
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left panel: Entity detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[#6B7589] mb-4">
          <button onClick={() => history.push("/scan")} className="hover:text-[#A9B1BE] transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Scan
          </button>
          <ChevronRight className="w-3 h-3" />
          <span>{entity.schema}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#E6EAF0]">{entity.name}</span>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#5B7FE8]/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#5B7FE8]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#E6EAF0]">{entity.display_name || entity.name}</h1>
            <p className="text-xs text-[#6B7589]">{entity.catalog}.{entity.schema}</p>
          </div>
          <span className="ml-2 text-xs px-2 py-1 rounded-md bg-[#C69A4C]/10 text-[#C69A4C]">Draft</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: Table2, label: "Tables", value: entity.table_count },
            { icon: Columns3, label: "Columns", value: entity.column_count },
            { icon: BarChart3, label: "Metrics", value: entity.metric_count },
            { icon: Sparkles, label: "Confidence", value: `${Math.round((entity.confidence || 0) * 100)}%` },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#11151C] border border-[#232B38] rounded-lg p-3 flex items-center gap-2">
              <stat.icon className="w-4 h-4 text-[#5B7FE8]" />
              <div>
                <div className="text-xs text-[#6B7589]">{stat.label}</div>
                <div className="text-sm font-semibold text-[#E6EAF0]">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[#E6EAF0] mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#5B7FE8]" />
            Metrics
            <span className="text-xs font-normal text-[#6B7589]">({metrics.length})</span>
          </h3>
          <div className="space-y-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} onApprove={handleApproveMetric} />
            ))}
            {metrics.length === 0 && (
              <div className="text-center py-6 text-sm text-[#6B7589] bg-[#11151C] border border-[#232B38] rounded-lg">
                No metrics defined yet. Use the AI panel to propose metrics.
              </div>
            )}
          </div>
        </div>

        {/* Impact section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[#E6EAF0] mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C69A4C]" />
            Impact
          </h3>
          <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5B7FE8]" />
                  <span className="text-sm text-[#E6EAF0]">Sales Analytics Genie Workspace</span>
                </div>
                <span className="text-xs text-[#6B7589]">3 metrics referenced</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4A9E7B]" />
                  <span className="text-sm text-[#E6EAF0]">Executive Dashboard Genie</span>
                </div>
                <span className="text-xs text-[#6B7589]">1 metric referenced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: AI chat */}
      <div className="w-96 shrink-0 border-l border-[#232B38] flex flex-col bg-[#11151C]">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-[#232B38] flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#5B7FE8]/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#5B7FE8]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#E6EAF0]">Refine with LakeMind AI</h3>
            <p className="text-[10px] text-[#6B7589]">Scoped to {entity.name}</p>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-[#232B38] mx-auto mb-3" />
              <p className="text-sm text-[#6B7589]">Ask LakeMind AI to refine metrics, add dimensions, or update formulas.</p>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-[#5B7FE8] text-white"
                    : "bg-[#1A1F2B] text-[#A9B1BE]"
                )}
              >
                <p>{msg.content}</p>
                {msg.proposal && (
                  <div className="mt-2 bg-[#0B0E14] rounded-md p-3 border border-[#232B38]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#E6EAF0]">{msg.proposal.name}</span>
                      <span className="text-[10px] text-[#5B7FE8]">{msg.proposal.type}</span>
                    </div>
                    <div className="bg-[#11151C] rounded px-2 py-1 text-xs font-mono text-[#A9B1BE] mb-2">
                      {msg.proposal.formula}
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] hover:bg-[#4A9E7B]/20 transition-colors">
                        Apply
                      </button>
                      <button className="text-xs px-2 py-1 rounded bg-[#D46A6A]/10 text-[#D46A6A] hover:bg-[#D46A6A]/20 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-[#1A1F2B] rounded-lg px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5B7FE8] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5B7FE8] animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5B7FE8] animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion chips */}
        <div className="px-4 py-2 border-t border-[#232B38] flex flex-wrap gap-1.5">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => setChatInput(chip)}
              className="text-[10px] px-2 py-1 rounded-full border border-[#232B38] text-[#6B7589] hover:border-[#5B7FE8] hover:text-[#5B7FE8] transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat input */}
        <div className="px-4 py-3 border-t border-[#232B38]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Refine a metric or ask a question..."
              className="flex-1 bg-[#0B0E14] border border-[#232B38] text-[#E6EAF0] text-sm rounded-md px-3 py-2 placeholder-[#6B7589] focus:outline-none focus:border-[#5B7FE8]"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="w-8 h-8 rounded-md bg-[#5B7FE8] hover:bg-[#4A6ED4] text-white flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  metric: GlossaryMetric;
  onApprove: (id: string) => void;
}

function MetricCard({ metric, onApprove }: MetricCardProps) {
  const isApproved = metric.status === "approved";
  const hasDiff = metric.version_diff?.previous_formula;

  return (
    <div className="bg-[#11151C] border border-[#232B38] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", isApproved ? "bg-[#4A9E7B]" : "bg-[#5B7FE8]")} />
          <span className="text-sm font-medium text-[#E6EAF0]">{metric.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5B7FE8]/10 text-[#5B7FE8]">{metric.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7589]">{Math.round((metric.confidence || 0) * 100)}%</span>
          {!isApproved && (
            <button
              onClick={() => onApprove(metric.id)}
              className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] hover:bg-[#4A9E7B]/20 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
          )}
          {isApproved && (
            <span className="text-xs px-2 py-1 rounded bg-[#4A9E7B]/10 text-[#4A9E7B] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-[#A9B1BE] mb-2">{metric.description}</p>

      {/* Formula with optional diff */}
      {hasDiff && (
        <div className="bg-[#0B0E14] rounded px-3 py-2 text-xs font-mono mb-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[#D46A6A]">
            <Minus className="w-3 h-3" />
            <span className="line-through opacity-60">{metric.version_diff?.previous_formula}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#4A9E7B]">
            <Plus className="w-3 h-3" />
            <span>{metric.formula}</span>
          </div>
        </div>
      )}
      {!hasDiff && (
        <div className="bg-[#0B0E14] rounded px-3 py-2 text-xs font-mono text-[#A9B1BE]">
          {metric.formula}
        </div>
      )}

      {metric.backing_table && (
        <div className="mt-2 text-[10px] text-[#6B7589]">
          Backing: {metric.backing_table}.{metric.backing_column}
        </div>
      )}
    </div>
  );
}

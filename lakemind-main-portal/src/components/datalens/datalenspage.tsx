import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Telescope,
  Send,
  Code,
  MessageSquare,
  Sparkles,
  Plus,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Check,
  Table2,
  Brain,
  Trash2,
} from "lucide-react";
import RealmService, { RealmSummary } from "@/services/realmservice";
import DatalensService, {
  DatalensMessage,
  DatalensAttachment,
  DatalensThought,
} from "@/services/datalensservice";
import { PageHeader } from "@/components/reusable/page-header";
import { Loader } from "@/components/reusable/loader";
import { toast } from "react-toastify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  attachments?: DatalensAttachment[];
  sql?: string;
  thoughts?: DatalensThought[];
  suggestedQuestions?: string[];
  messageId?: string;
  statementId?: string;
}

interface Conversation {
  id: string; // conversationId from Genie, or a local uuid for new ones
  spaceId: string;
  realmId: number;
  realmName: string;
  title: string; // first user question
  messages: ChatEntry[];
  createdAt: number;
  updatedAt: number;
}

interface StoredConversations {
  conversations: Conversation[];
  pinnedIds: string[];
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "lakemind_datalens_conversations";

function loadStorage(): StoredConversations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { conversations: [], pinnedIds: [] };
}

function saveStorage(data: StoredConversations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

function groupConversationsByDate(
  convos: Conversation[],
  pinnedIds: Set<string>
): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;

  const pinned: Conversation[] = [];
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];

  for (const c of convos) {
    if (pinnedIds.has(c.id)) {
      pinned.push(c);
      continue;
    }
    const t = c.updatedAt;
    if (t >= todayStart) today.push(c);
    else if (t >= yesterdayStart) yesterday.push(c);
    else if (t >= weekStart) week.push(c);
    else older.push(c);
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (pinned.length) groups.push({ label: "Pinned", items: pinned });
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (week.length) groups.push({ label: "Previous 7 days", items: week });
  if (older.length) groups.push({ label: "Older", items: older });
  return groups;
}

// ---------------------------------------------------------------------------
// Simple markdown renderer (no external deps)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): JSX.Element {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const cls =
        level === 1
          ? "text-base font-bold text-[#1A2332] mb-1"
          : level === 2
            ? "text-sm font-semibold text-[#1A2332] mb-1"
            : "text-sm font-medium text-[#1A2332] mb-0.5";
      elements.push(
        <div key={i} className={cls}>
          {renderInline(headerMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s/.test(line)) {
      const listItems: JSX.Element[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*]\s+/, "");
        listItems.push(
          <li key={i} className="text-sm text-[#4A5568] leading-relaxed">
            {renderInline(content)}
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`list-${i}`} className="list-disc pl-5 space-y-0.5 my-1">
          {listItems}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: JSX.Element[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, "");
        listItems.push(
          <li key={i} className="text-sm text-[#4A5568] leading-relaxed">
            {renderInline(content)}
          </li>
        );
        i++;
      }
      elements.push(
        <ol key={`olist-${i}`} className="list-decimal pl-5 space-y-0.5 my-1">
          {listItems}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-[#4A5568] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): (string | JSX.Element)[] {
  // Handle **bold**, *italic*, `code`
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={keyCounter++} className="font-semibold text-[#1A2332]">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={keyCounter++} className="italic">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={keyCounter++}
          className="bg-[#F0F4F8] text-[#1E3A5F] px-1 py-0.5 rounded text-xs font-mono"
        >
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : [text];
}

// ---------------------------------------------------------------------------
// Data table parser — parses markdown-style pipe tables from text content
// ---------------------------------------------------------------------------

interface ParsedTable {
  columns: string[];
  rows: string[][];
}

function parseTableFromText(text: string): ParsedTable | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Find lines that look like pipe-delimited table rows
  const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (tableLines.length < 2) return null;

  const parseLine = (l: string) =>
    l
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

  const columns = parseLine(tableLines[0]);
  // Skip separator row (dashes)
  const dataStart = tableLines[1].replace(/[|\s-]/g, "") === "" ? 2 : 1;
  const rows = tableLines.slice(dataStart).map(parseLine);

  if (columns.length === 0 || rows.length === 0) return null;
  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Very simple SQL keyword highlighting
  const highlighted = useMemo(() => {
    const keywords =
      /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|AS|IN|NOT|NULL|IS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|DISTINCT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|COUNT|SUM|AVG|MIN|MAX|COALESCE|CAST)\b/gi;
    const parts: JSX.Element[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = keywords.exec(sql)) !== null) {
      if (m.index > lastIdx) {
        parts.push(<span key={k++}>{sql.slice(lastIdx, m.index)}</span>);
      }
      parts.push(
        <span key={k++} className="text-[#1E3A5F] font-semibold">
          {m[0].toUpperCase()}
        </span>
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < sql.length) {
      parts.push(<span key={k++}>{sql.slice(lastIdx)}</span>);
    }
    return parts;
  }, [sql]);

  return (
    <div className="mt-2 border border-[#E2E8F0] rounded-lg overflow-hidden">
      <div className="bg-[#F5F7FA] px-3 py-1.5 flex items-center justify-between border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-[#3B6B96]" />
          <span className="text-xs font-medium text-[#718096]">Generated SQL</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-[#718096] hover:text-[#1E3A5F] transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-xs font-mono text-[#4A5568] overflow-x-auto bg-white whitespace-pre-wrap">
        {highlighted}
      </pre>
    </div>
  );
}

function ThoughtsBlock({ thoughts }: { thoughts: DatalensThought[] }) {
  const [open, setOpen] = useState(false);

  if (!thoughts.length) return null;

  return (
    <div className="mt-2 border border-[#E2E8F0] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-white px-3 py-2 flex items-center gap-2 text-left hover:bg-[#FAFBFC] transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-[#3B6B96]" />
        <span className="text-xs font-medium text-[#718096]">
          Thinking complete ({thoughts.length} step{thoughts.length !== 1 ? "s" : ""})
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#A0AEC0] ml-auto" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#A0AEC0] ml-auto" />
        )}
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-[#E2E8F0] space-y-2 bg-white">
          {thoughts.map((t, idx) => (
            <div key={idx} className="text-xs text-[#4A5568] leading-relaxed">
              {t.thought_type && (
                <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-[#3B6B96] bg-[#F0F4F8] rounded px-1.5 py-0.5 mr-2 mb-0.5">
                  {t.thought_type}
                </span>
              )}
              <span>{t.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataTable({ table }: { table: ParsedTable }) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? table.rows : table.rows.slice(0, 10);
  const hasMore = table.rows.length > 10;

  return (
    <div className="mt-2 border border-[#E2E8F0] rounded-lg overflow-hidden">
      <div className="bg-white px-3 py-1.5 flex items-center gap-2 border-b border-[#E2E8F0]">
        <Table2 className="w-3.5 h-3.5 text-[#3B6B96]" />
        <span className="text-xs font-medium text-[#718096]">
          Query results ({table.rows.length} row{table.rows.length !== 1 ? "s" : ""})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#FAFBFC]">
              {table.columns.map((col, ci) => (
                <th
                  key={ci}
                  className="text-left px-3 py-2 font-semibold text-[#1A2332] border-b border-[#E2E8F0] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-[#4A5568] border-b border-[#F0F0F0] whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-1.5 text-xs text-[#3B6B96] hover:text-[#1E3A5F] transition-colors bg-white border-t border-[#E2E8F0]"
        >
          {showAll ? "Show less" : `Show all ${table.rows.length} rows`}
        </button>
      )}
    </div>
  );
}

function QueryResultBlock({ statementId }: { statementId: string }) {
  const [data, setData] = useState<{ columns: { name: string; type: string }[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"table" | "chart">("chart");

  useEffect(() => {
    DatalensService.getStatementResult(statementId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statementId]);

  if (loading) {
    return (
      <div className="mt-2 border border-[#E2E8F0] rounded-lg p-4 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-[#3B6B96] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#718096]">Loading results...</span>
      </div>
    );
  }

  if (!data || !data.columns?.length || !data.rows?.length) return null;

  const visibleRows = showAll ? data.rows : data.rows.slice(0, 10);
  const hasMore = data.rows.length > 10;

  // Simple bar chart: use first column as label, second numeric column as value
  const numColIdx = data.columns.findIndex((c, i) => i > 0 && ["DECIMAL", "DOUBLE", "FLOAT", "INT", "LONG", "BIGINT"].some((t) => (c.type || "").toUpperCase().includes(t)));
  const labelColIdx = 0;
  const canChart = numColIdx > 0 && data.rows.length <= 30;

  let chartData: { label: string; value: number; pct: number }[] = [];
  if (canChart) {
    const raw = data.rows.map((r) => ({
      label: r[labelColIdx] || "",
      value: parseFloat(r[numColIdx]) || 0,
    }));
    const maxVal = Math.max(...raw.map((d) => d.value), 1);
    chartData = raw.map((d) => ({ ...d, pct: (d.value / maxVal) * 100 }));
  }

  const formatNumber = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="mt-2 border border-[#E2E8F0] rounded-lg overflow-hidden">
      <div className="bg-white px-3 py-1.5 flex items-center justify-between border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Table2 className="w-3.5 h-3.5 text-[#3B6B96]" />
          <span className="text-xs font-medium text-[#718096]">
            {data.rows.length} row{data.rows.length !== 1 ? "s" : ""}
          </span>
        </div>
        {canChart && (
          <div className="flex gap-0.5 bg-[#F0F2F5] rounded p-0.5">
            <button
              onClick={() => setView("chart")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${view === "chart" ? "bg-white text-[#1A2332] shadow-sm" : "text-[#718096]"}`}
            >
              Chart
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${view === "table" ? "bg-white text-[#1A2332] shadow-sm" : "text-[#718096]"}`}
            >
              Table
            </button>
          </div>
        )}
      </div>

      {/* Chart view */}
      {view === "chart" && canChart && (
        <div className="px-4 py-3 space-y-1.5 bg-white">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-[#4A5568] w-32 text-right truncate shrink-0">{d.label}</span>
              <div className="flex-1 h-6 bg-[#F0F4F8] rounded overflow-hidden">
                <div
                  className="h-full bg-[#3B6B96] rounded transition-all duration-500"
                  style={{ width: `${d.pct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#1A2332] w-20 shrink-0">{formatNumber(String(d.value))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {(view === "table" || !canChart) && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#FAFBFC]">
                  {data.columns.map((col, ci) => (
                    <th key={ci} className="text-left px-3 py-2 font-semibold text-[#1A2332] border-b border-[#E2E8F0] whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-[#4A5568] border-b border-[#F0F0F0] whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full px-3 py-1.5 text-xs text-[#3B6B96] hover:text-[#1E3A5F] transition-colors bg-white border-t border-[#E2E8F0]"
            >
              {showAll ? "Show less" : `Show all ${data.rows.length} rows`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SuggestedQuestions({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (q: string) => void;
}) {
  if (!questions.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {questions.map((q, k) => (
        <button
          key={k}
          onClick={() => onSelect(q)}
          className="px-2.5 py-1 text-xs rounded-full border border-[#E2E8F0] text-[#4A5568] hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors bg-white"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function AssistantMessage({
  msg,
  onSelectQuestion,
}: {
  msg: ChatEntry;
  onSelectQuestion: (q: string) => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-[#3B6B96]" />
      </div>
      <div className="max-w-[85%] min-w-0">
        {/* Main text content */}
        <div className="rounded-lg px-4 py-2.5 bg-white border border-[#E2E8F0]">
          {renderMarkdown(msg.content)}
        </div>

        {/* Query result — chart + table from statement API */}
        {msg.statementId && <QueryResultBlock statementId={msg.statementId} />}

        {/* Thoughts */}
        {msg.thoughts && msg.thoughts.length > 0 && <ThoughtsBlock thoughts={msg.thoughts} />}

        {/* SQL */}
        {msg.sql && <SqlBlock sql={msg.sql} />}

        {/* Suggested questions */}
        {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
          <SuggestedQuestions questions={msg.suggestedQuestions} onSelect={onSelectQuestion} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ConversationSidebar({
  conversations,
  pinnedIds,
  activeId,
  collapsed,
  onSelect,
  onNewConversation,
  onTogglePin,
  onDelete,
  onToggleCollapse,
}: {
  conversations: Conversation[];
  pinnedIds: Set<string>;
  activeId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: () => void;
}) {
  const groups = useMemo(
    () => groupConversationsByDate(conversations, pinnedIds),
    [conversations, pinnedIds]
  );

  if (collapsed) {
    return (
      <div className="w-10 border-r border-[#E2E8F0] bg-white flex flex-col items-center py-3 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-[#F5F7FA] text-[#718096] hover:text-[#1E3A5F] transition-colors mb-3"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-1.5 rounded-md hover:bg-[#F5F7FA] text-[#718096] hover:text-[#1E3A5F] transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-[#E2E8F0] bg-white flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#E2E8F0] flex items-center gap-2 shrink-0">
        <button
          onClick={onNewConversation}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#162D4A] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New conversation
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-[#F5F7FA] text-[#718096] hover:text-[#1E3A5F] transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-1">
        {groups.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-[#A0AEC0]">No conversations yet</p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-semibold text-[#A0AEC0] uppercase tracking-wider">
                {group.label}
              </span>
            </div>
            {group.items.map((conv) => {
              const isActive = conv.id === activeId;
              const isPinned = pinnedIds.has(conv.id);
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-1 mx-1.5 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#1E3A5F]/10 text-[#1E3A5F]"
                      : "hover:bg-[#F5F7FA] text-[#4A5568]"
                  }`}
                >
                  <button
                    onClick={() => onSelect(conv.id)}
                    className="flex-1 text-left px-2 py-1.5 min-w-0"
                  >
                    <p className="text-xs font-medium truncate">{conv.title}</p>
                    <p className="text-[10px] text-[#A0AEC0] truncate">{conv.realmName}</p>
                  </button>
                  <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(conv.id);
                      }}
                      className="p-1 rounded hover:bg-[#E2E8F0] transition-colors"
                      title={isPinned ? "Unpin" : "Pin"}
                    >
                      {isPinned ? (
                        <PinOff className="w-3 h-3 text-[#3B6B96]" />
                      ) : (
                        <Pin className="w-3 h-3 text-[#A0AEC0]" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="p-1 rounded hover:bg-[#E2E8F0] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-[#A0AEC0] hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function DatalensPage() {
  const [realms, setRealms] = useState<RealmSummary[]>([]);
  const [selectedRealmId, setSelectedRealmId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [storedData, setStoredData] = useState<StoredConversations>(loadStorage);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const pinnedIds = useMemo(() => new Set(storedData.pinnedIds), [storedData.pinnedIds]);

  const selectedRealm = realms.find((r) => r.id === selectedRealmId);
  const spaceId = selectedRealm?.genie_workspace_id;

  // Persist storage changes
  const persistStorage = useCallback((updater: (prev: StoredConversations) => StoredConversations) => {
    setStoredData((prev) => {
      const next = updater(prev);
      saveStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    RealmService.listRealms()
      .then((data) => {
        setRealms(data);
        const withLens = data.find((r) => r.genie_workspace_id);
        if (withLens) setSelectedRealmId(withLens.id);
        else if (data.length > 0) setSelectedRealmId(data[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    if (!conversationId || messages.length === 0 || !selectedRealm || !spaceId) return;

    persistStorage((prev) => {
      const existing = prev.conversations.findIndex((c) => c.id === conversationId);
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg?.content || "New conversation";

      const conv: Conversation = {
        id: conversationId,
        spaceId: spaceId,
        realmId: selectedRealm.id,
        realmName: selectedRealm.name,
        title: title.length > 80 ? title.slice(0, 80) + "..." : title,
        messages,
        createdAt: existing >= 0 ? prev.conversations[existing].createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      const newConvos = [...prev.conversations];
      if (existing >= 0) {
        newConvos[existing] = conv;
      } else {
        newConvos.unshift(conv);
      }
      return { ...prev, conversations: newConvos };
    });
    setActiveConversationId(conversationId);
  }, [messages, conversationId, selectedRealm, spaceId, persistStorage]);

  const handleRealmChange = (id: number) => {
    setSelectedRealmId(id);
    setMessages([]);
    setConversationId(null);
    setActiveConversationId(null);
    setInput("");
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setActiveConversationId(null);
    setInput("");
    inputRef.current?.focus();
  };

  const handleSelectConversation = (id: string) => {
    const conv = storedData.conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConversationId(id);
    setConversationId(id);
    setMessages(conv.messages);
    // Switch realm if needed
    if (conv.realmId !== selectedRealmId) {
      setSelectedRealmId(conv.realmId);
    }
  };

  const handleTogglePin = (id: string) => {
    persistStorage((prev) => {
      const isPinned = prev.pinnedIds.includes(id);
      return {
        ...prev,
        pinnedIds: isPinned
          ? prev.pinnedIds.filter((pid) => pid !== id)
          : [...prev.pinnedIds, id],
      };
    });
  };

  const handleDeleteConversation = (id: string) => {
    persistStorage((prev) => ({
      ...prev,
      conversations: prev.conversations.filter((c) => c.id !== id),
      pinnedIds: prev.pinnedIds.filter((pid) => pid !== id),
    }));
    if (activeConversationId === id) {
      handleNewConversation();
    }
  };

  const handleSelectQuestion = useCallback(
    (q: string) => {
      setInput(q);
      // Use a ref-based approach to fire send after state update
      setTimeout(() => {
        const fakeEvent = { key: "Enter", shiftKey: false, preventDefault: () => {} } as any;
        // Directly call send logic
        doSend(q);
      }, 0);
    },
    [spaceId, conversationId, sending]
  );

  const doSend = async (questionOverride?: string) => {
    const question = (questionOverride || input).trim();
    if (!question || !spaceId || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setSending(true);

    try {
      let result: DatalensMessage;
      if (conversationId) {
        result = await DatalensService.followUp(spaceId, conversationId, question);
      } else {
        result = await DatalensService.ask(spaceId, question);
      }

      setConversationId(result.conversation_id);

      // Extract all data from attachments
      let responseText = result.content || "";
      let sql = "";
      let thoughts: DatalensThought[] = [];
      let suggestedQuestions: string[] = [];
      let messageId = result.message_id;

      let statementId = "";

      const queryAtt = result.attachments?.find((a) => a.type === "query");
      if (queryAtt) {
        sql = queryAtt.sql || "";
        statementId = queryAtt.statement_id || "";
        if (queryAtt.description) responseText = queryAtt.description;
        if (queryAtt.title && !responseText) responseText = queryAtt.title;
        if (queryAtt.thoughts) thoughts = queryAtt.thoughts;
      }

      const textAtt = result.attachments?.find((a) => a.type === "text");
      if (textAtt?.content) {
        responseText = textAtt.content;
      }

      const suggestedAtt = result.attachments?.find((a) => a.type === "suggested_questions");
      if (suggestedAtt?.questions) {
        suggestedQuestions = suggestedAtt.questions;
      }

      if (!responseText && sql) {
        responseText = "Here are the query results:";
      } else if (!responseText) {
        responseText = "I processed your question.";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: responseText,
          attachments: result.attachments,
          sql,
          thoughts,
          suggestedQuestions,
          messageId,
          statementId: statementId || undefined,
        },
      ]);
    } catch {
      toast.error("Failed to get response");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = async () => {
    await doSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          icon={<Telescope className="w-7 h-7" />}
          title="DataLens"
          subtitle="Explore your data with natural language powered by your glossary."
        />
        <div className="flex items-center justify-center flex-1">
          <Loader size="medium" message="Loading..." textClassName="mt-3 text-sm text-[#718096]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Telescope className="w-7 h-7" />}
        title="DataLens"
        subtitle="Explore your data with natural language powered by your glossary."
        actions={
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">
              Realm
            </label>
            <select
              value={selectedRealmId || ""}
              onChange={(e) => handleRealmChange(Number(e.target.value))}
              className="bg-white border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none min-w-[200px]"
            >
              {realms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.genie_workspace_id ? "" : "(no Lens)"}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Conversation sidebar */}
        {spaceId && (
          <ConversationSidebar
            conversations={storedData.conversations}
            pinnedIds={pinnedIds}
            activeId={activeConversationId}
            collapsed={sidebarCollapsed}
            onSelect={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteConversation}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* No Lens state */}
          {!spaceId ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-6 bg-white">
              <div className="w-16 h-16 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center mb-4">
                <Telescope className="w-8 h-8 text-[#3B6B96]" />
              </div>
              <h3 className="text-base font-semibold text-[#1A2332] mb-1">No Lens activated</h3>
              <p className="text-sm text-[#718096] max-w-md">
                Publish a glossary version in Chronicle and activate a Lens to start exploring your
                data.
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-14 h-14 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center mb-4">
                      <Sparkles className="w-7 h-7 text-[#3B6B96]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#1A2332] mb-1">
                      Ask anything about {selectedRealm?.name}
                    </h3>
                    <p className="text-sm text-[#718096] max-w-md mb-6">
                      Powered by your LakeMind glossary with {selectedRealm?.entity_count || 0}{" "}
                      entities.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                      {[
                        "What is total revenue by region?",
                        "Show top 10 customers by account balance",
                        "How many orders per market segment?",
                        "Average discount by supplier nation",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSelectQuestion(q)}
                          className="px-3 py-1.5 text-xs rounded-full border border-[#E2E8F0] text-[#4A5568] hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors bg-white"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg, i) =>
                      msg.role === "user" ? (
                        <div key={i} className="flex gap-3 justify-end">
                          <div className="max-w-[85%]">
                            <div className="rounded-lg px-4 py-2.5 text-sm leading-relaxed bg-[#1E3A5F] text-white whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#3B6B96]" />
                          </div>
                        </div>
                      ) : (
                        <AssistantMessage
                          key={i}
                          msg={msg}
                          onSelectQuestion={handleSelectQuestion}
                        />
                      )
                    )}

                    {/* Sending indicator */}
                    {sending && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-[#3B6B96]" />
                        </div>
                        <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3">
                          <div className="flex gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full bg-[#3B6B96] animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-2 h-2 rounded-full bg-[#3B6B96] animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-2 h-2 rounded-full bg-[#3B6B96] animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-[#E2E8F0] px-6 py-3 bg-white shrink-0">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your data..."
                    disabled={sending}
                    className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#162D4A] transition-colors disabled:opacity-30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

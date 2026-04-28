import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Sparkles,
  BarChart3,
  Tags,
  Plus,
  Bot,
  User,
  MessageSquare,
  ChevronLeft,
  Boxes,
  Search,
} from "lucide-react";
import EntityService, { EntityDetail } from "@/services/entityservice";
import { useResources } from "@/lib/resource-context";
import { toast } from "react-toastify";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
}

interface Proposal {
  type: "metric" | "dimension";
  name: string;
  description: string;
  formula?: string;
  source_column?: string;
  source_table?: string;
  confidence: number;
  accepted?: boolean;
}

interface SessionSummary {
  id: number;
  title: string;
  message_count: number;
  updated_at: string;
  entity_id?: number;
  entity_name?: string;
}

interface AiChatDrawerProps {
  entity?: EntityDetail | null;  // optional — if null, shows entity selector
  open: boolean;
  onClose: () => void;
  onItemAdded?: () => void;
}

export function AiChatDrawer({
  entity: entityProp,
  open,
  onClose,
  onItemAdded,
}: AiChatDrawerProps) {
  const { selectedWarehouse, selectedEndpoint } = useResources();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [view, setView] = useState<"chat" | "sessions" | "entities">("chat");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Entity selection (for global mode)
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(entityProp || null);
  const [allEntities, setAllEntities] = useState<EntityDetail[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Sync entity prop
  useEffect(() => {
    if (entityProp) setSelectedEntity(entityProp);
  }, [entityProp]);

  useEffect(() => {
    if (open) {
      if (!selectedEntity && !entityProp) {
        // Global mode — show entity selector or all sessions
        setView("sessions");
        loadAllSessions();
      } else if (messages.length === 0) {
        addWelcomeMessage();
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const entity = selectedEntity;

  const addWelcomeMessage = () => {
    if (!entity) return;
    setMessages([
      {
        role: "assistant",
        content: `Hi! I'm LakeMind AI. I can help you define metrics and dimensions for **${entity.name}**.\n\nTry: "I need a revenue metric" or "What dimensions are useful here?"`,
      },
    ]);
  };

  const loadSessions = async () => {
    if (!entity) return;
    setLoadingSessions(true);
    try {
      const data = await EntityService.getChatSessions(entity.id);
      setSessions(data.map((s: any) => ({ ...s, entity_name: entity.name })));
    } catch {}
    setLoadingSessions(false);
  };

  const loadAllSessions = async () => {
    setLoadingSessions(true);
    try {
      // Load entities first, then sessions for each
      const entities = await EntityService.getEntities();
      setAllEntities(entities);
      const allSess: SessionSummary[] = [];
      for (const e of entities) {
        try {
          const sess = await EntityService.getChatSessions(e.id);
          allSess.push(...sess.map((s: any) => ({ ...s, entity_id: e.id, entity_name: e.name })));
        } catch {}
      }
      allSess.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
      setSessions(allSess);
    } catch {}
    setLoadingSessions(false);
  };

  const loadEntities = async () => {
    setLoadingEntities(true);
    try {
      const data = await EntityService.getEntities();
      setAllEntities(data);
    } catch {}
    setLoadingEntities(false);
  };

  const selectEntity = (e: EntityDetail) => {
    setSelectedEntity(e);
    setSessionId(null);
    setMessages([]);
    addWelcomeMessageForEntity(e);
    setView("chat");
  };

  const addWelcomeMessageForEntity = (e: EntityDetail) => {
    setMessages([
      {
        role: "assistant",
        content: `Hi! I'm LakeMind AI. I can help you define metrics and dimensions for **${e.name}**.\n\nTry: "I need a revenue metric" or "What dimensions are useful here?"`,
      },
    ]);
  };

  const loadSession = async (sid: number, entityId?: number) => {
    const eid = entityId || entity?.id;
    if (!eid) return;
    try {
      const data = await EntityService.getChatSession(eid, sid);
      setSessionId(data.id);
      setMessages(
        data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          proposals: m.proposals || [],
        }))
      );
      // Make sure entity is set
      if (!entity || entity.id !== eid) {
        const e = allEntities.find((x) => x.id === eid);
        if (e) setSelectedEntity(e);
      }
      setView("chat");
    } catch {
      toast.error("Failed to load session");
    }
  };

  const startNewSession = () => {
    if (!entity) {
      setView("entities");
      loadEntities();
      return;
    }
    setSessionId(null);
    setMessages([]);
    addWelcomeMessage();
    setView("chat");
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !entity) return;
    if (!selectedWarehouse || !selectedEndpoint) {
      toast.warning("Select a warehouse and model endpoint from Resources");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setSending(true);

    try {
      const result = await EntityService.aiChat(
        entity.id,
        userMessage,
        selectedWarehouse.id,
        selectedEndpoint.name,
        sessionId || undefined
      );

      if (result.session_id && !sessionId) {
        setSessionId(result.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
          proposals: result.proposals,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptProposal = async (
    proposal: Proposal,
    messageIdx: number,
    proposalIdx: number
  ) => {
    if (!entity) return;
    try {
      if (proposal.type === "metric") {
        await EntityService.createMetric(entity.id, {
          name: proposal.name,
          description: proposal.description,
          formula: proposal.formula || "",
          backing_table: proposal.source_table || "",
        });
      } else {
        await EntityService.createDimension(entity.id, {
          name: proposal.name,
          description: proposal.description,
          source_column: proposal.source_column || "",
          source_table: proposal.source_table || "",
        });
      }

      setMessages((prev) =>
        prev.map((msg, i) => {
          if (i !== messageIdx || !msg.proposals) return msg;
          return {
            ...msg,
            proposals: msg.proposals.map((p, j) =>
              j === proposalIdx ? { ...p, accepted: true } : p
            ),
          };
        })
      );

      toast.success(`${proposal.type === "metric" ? "Metric" : "Dimension"} "${proposal.name}" added`);
      onItemAdded?.();
    } catch {
      toast.error("Failed to add item");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  const filteredEntities = entitySearch
    ? allEntities.filter((e) => e.name.toLowerCase().includes(entitySearch.toLowerCase()))
    : allEntities;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-[#E2E8F0] shadow-2xl z-[100] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] shrink-0">
        <div className="flex items-center gap-2">
          {(view === "sessions" || view === "entities") && entity ? (
            <button onClick={() => setView("chat")} className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <Sparkles className="w-4 h-4 text-[#3B6B96]" />
          )}
          <span className="text-sm font-semibold text-[#1A2332]">
            {view === "sessions" ? "Chat History" : view === "entities" ? "Select Entity" : "LakeMind AI"}
          </span>
          {entity && view === "chat" && (
            <span className="text-xs text-[#A0AEC0]">· {entity.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {view === "chat" && (
            <>
              <button
                onClick={() => { loadAllSessions(); setView("sessions"); }}
                title="All conversations"
                className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={startNewSession}
                title="New chat"
                className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entity selector view */}
      {view === "entities" && (
        <div className="flex-1 overflow-y-auto p-3">
          <input
            value={entitySearch}
            onChange={(e) => setEntitySearch(e.target.value)}
            placeholder="Search entities..."
            className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none mb-2"
          />
          {loadingEntities ? (
            <div className="text-center py-8 text-xs text-[#A0AEC0]">Loading...</div>
          ) : (
            <div className="space-y-1">
              {filteredEntities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => selectEntity(e)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                    selectedEntity?.id === e.id
                      ? "bg-[#1E3A5F]/10 border border-[#1E3A5F]/20"
                      : "hover:bg-[#F5F7FA] border border-transparent"
                  }`}
                >
                  <Boxes className="w-4 h-4 text-[#3B6B96] shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-[#1A2332]">{e.name}</div>
                    <div className="text-xs text-[#A0AEC0]">{e.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sessions list view */}
      {view === "sessions" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => { setView("entities"); loadEntities(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-[#E2E8F0] text-[#3B6B96] text-sm font-medium hover:bg-[#1E3A5F]/5 transition-colors mb-2"
          >
            <Plus className="w-3.5 h-3.5" /> New conversation
          </button>
          {loadingSessions ? (
            <div className="text-center py-8 text-xs text-[#A0AEC0]">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#A0AEC0]">No conversations yet.</div>
          ) : (
            sessions.map((s) => (
              <button
                key={`${s.entity_id || s.id}-${s.id}`}
                onClick={() => loadSession(s.id, s.entity_id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  sessionId === s.id
                    ? "bg-[#1E3A5F]/10 border border-[#1E3A5F]/25"
                    : "hover:bg-[#F5F7FA] border border-transparent"
                }`}
              >
                <div className="text-sm text-[#1A2332] truncate">{s.title || "Untitled"}</div>
                <div className="flex items-center gap-2 text-xs text-[#A0AEC0] mt-0.5">
                  {s.entity_name && (
                    <span className="text-[#3B6B96] font-medium">{s.entity_name}</span>
                  )}
                  <span>{s.message_count} messages</span>
                  <span>{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : ""}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Chat view */}
      {view === "chat" && (
        <>
          {/* Entity chip */}
          {entity && !entityProp && (
            <div className="px-4 py-2 border-b border-[#E2E8F0] flex items-center gap-2">
              <Boxes className="w-3.5 h-3.5 text-[#3B6B96]" />
              <span className="text-xs font-medium text-[#1A2332]">{entity.name}</span>
              <button
                onClick={() => { setView("entities"); loadEntities(); }}
                className="text-xs text-[#3B6B96] hover:text-[#2D5A7E] ml-auto"
              >
                Change
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.map((msg, msgIdx) => (
              <div key={msgIdx} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-[#1E3A5F]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-[#3B6B96]" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-first" : ""}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-[#1E3A5F] text-white" : "bg-[#F0F2F5] text-[#4A5568]"
                  }`}>
                    {msg.content}
                  </div>

                  {msg.proposals && msg.proposals.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.proposals.map((proposal, pIdx) => (
                        <div key={pIdx} className={`rounded-lg border p-3 ${
                          proposal.accepted ? "border-[#4A9E7B]/30 bg-[#4A9E7B]/5" : "border-[#E2E8F0] bg-[#F5F7FA]"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            {proposal.type === "metric" ? (
                              <BarChart3 className="w-3.5 h-3.5 text-[#3B6B96]" />
                            ) : (
                              <Tags className="w-3.5 h-3.5 text-[#8B5CF6]" />
                            )}
                            <span className="text-xs font-semibold text-[#1A2332]">{proposal.name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#718096]">{proposal.type}</span>
                          </div>
                          <p className="text-xs text-[#718096] mb-1">{proposal.description}</p>
                          {proposal.formula && (
                            <code className="text-xs text-[#4A5568] font-mono bg-white px-1.5 py-0.5 rounded block mb-2">{proposal.formula}</code>
                          )}
                          {proposal.source_column && (
                            <div className="text-xs text-[#A0AEC0] mb-2">
                              Column: <span className="font-mono text-[#718096]">{proposal.source_table}.{proposal.source_column}</span>
                            </div>
                          )}
                          {proposal.accepted ? (
                            <span className="text-xs text-[#4A9E7B] font-medium">✓ Added to Entity</span>
                          ) : (
                            <button
                              onClick={() => handleAcceptProposal(proposal, msgIdx, pIdx)}
                              className="flex items-center gap-1 text-xs font-medium text-[#3B6B96] hover:text-[#7B96EC] transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add to Entity
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-[#1E3A5F]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-[#3B6B96]" />
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F]/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[#3B6B96]" />
                </div>
                <div className="bg-[#F0F2F5] rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A5F] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A5F] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A5F] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {!entity && view === "chat" && (
              <div className="text-center py-8 text-sm text-[#718096]">
                Select an entity to start chatting.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#E2E8F0] shrink-0">
            {(!selectedWarehouse || !selectedEndpoint) && (
              <div className="text-xs text-[#C69A4C] mb-2">Select a warehouse and model endpoint from Resources.</div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={entity ? "Describe a metric or dimension..." : "Select an entity first..."}
                disabled={sending || !selectedWarehouse || !selectedEndpoint || !entity}
                className="flex-1 bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !entity}
                className="px-3 py-2 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#162D4A] transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

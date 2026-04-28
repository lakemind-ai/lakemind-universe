import { api } from "@/lib/api";

export interface LexiconEntry {
  id: number;
  source_type: "metric" | "dimension" | "glossary_entry";
  kind: "metric" | "dimension" | "definition";
  scope: "entity" | "table" | "column";
  entity_id: number;
  entity_name: string;
  name: string;
  description: string;
  formula: string;
  source_column: string;
  source_table: string;
  confidence_score: number;
  status: "proposed" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface LexiconStats {
  total: number;
  metrics: number;
  dimensions: number;
  definitions: number;
  proposed: number;
  approved: number;
  rejected: number;
}

const LexiconService = {
  getEntries: async (
    realmId: number,
    filters?: { kind?: string; status?: string; search?: string }
  ): Promise<LexiconEntry[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.kind) params.kind = filters.kind;
    if (filters?.status) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    const res = await api.get(`/api/lexicon/realms/${realmId}/entries`, params, false);
    return res.data || [];
  },

  getStats: async (realmId: number): Promise<LexiconStats> => {
    const res = await api.get(`/api/lexicon/realms/${realmId}/stats`, undefined, false);
    return res.data;
  },

  bulkApprove: async (
    realmId: number,
    entries: { source_type: string; id: number }[]
  ): Promise<{ approved_count: number }> => {
    const res = await api.post(`/api/lexicon/realms/${realmId}/bulk-approve`, { entries });
    return res.data;
  },
  updateEntry: async (
    entry: LexiconEntry,
    data: { name?: string; description?: string; formula?: string; source_column?: string; source_table?: string; status?: string }
  ): Promise<void> => {
    if (entry.source_type === "metric") {
      await api.patch(`/api/entity/metrics/${entry.id}`, data);
    } else if (entry.source_type === "dimension") {
      await api.patch(`/api/entity/dimensions/${entry.id}`, data);
    }
  },
};

export default LexiconService;

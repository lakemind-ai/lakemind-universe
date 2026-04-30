import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface GlossaryEntryProposal {
  id: number;
  kind: "definition" | "metric" | "dimension";
  scope: "entity" | "table" | "column";
  target_name: string;
  name: string;
  description: string;
  formula?: string;
  source_column?: string;
  source_table?: string;
  confidence_score: number;
  status: "proposed" | "accepted" | "rejected";
}

export interface ScanProposal {
  id: number;
  scan_id: number;
  entity_id: number | null;
  proposed_name: string;
  proposed_description: string;
  table_names: string[];
  confidence_score: number;
  status: "proposed" | "accepted" | "rejected" | "edited";
  glossary_entries: GlossaryEntryProposal[];
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface CatalogScan {
  id: number;
  catalog_name: string;
  schema_name: string;
  scan_type: string;
  warehouse_id: string;
  model_endpoint: string;
  status: "pending" | "scanning" | "complete" | "failed";
  status_message: string;
  table_count: number;
  column_count: number;
  entity_count: number;
  proposal_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface DetectedEntity {
  id: number;
  name: string;
  description: string;
  confidence_score: number;
  status: string;
  tables?: DetectedTable[];
}

export interface DetectedTable {
  id: number;
  table_name: string;
  schema_name: string;
  catalog: string;
  column_count: number;
  columns?: DetectedColumn[];
}

export interface DetectedColumn {
  id: number;
  column_name: string;
  data_type: string;
  business_description?: string;
  status: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

const ScanService = {
  // MindScan
  startMindScan: async (
    catalog: string,
    schemaNames: string[],
    warehouseId: string,
    modelEndpoint: string
  ): Promise<CatalogScan> => {
    const res = await api.post("/api/scan/mindscan/start", {
      catalog,
      schema_names: schemaNames,
      warehouse_id: warehouseId,
      model_endpoint: modelEndpoint,
    });
    return res.data;
  },

  getMindScanStatus: async (scanId: number): Promise<CatalogScan> => {
    const res = await api.get(`/api/scan/mindscan/${scanId}/status`, undefined, false);
    return res.data;
  },

  retryMindScan: async (scanId: number): Promise<CatalogScan> => {
    const res = await api.post(`/api/scan/mindscan/${scanId}/retry`);
    return res.data;
  },

  getMindScanProposals: async (scanId: number): Promise<ScanProposal[]> => {
    const res = await api.get(`/api/scan/mindscan/${scanId}/proposals`, undefined, false);
    return res.data || [];
  },

  acceptProposal: async (
    scanId: number,
    proposalId: number,
    edits?: { name?: string; description?: string }
  ): Promise<ScanProposal> => {
    const res = await api.post(
      `/api/scan/mindscan/${scanId}/proposals/${proposalId}/accept`,
      edits ? { edits } : {}
    );
    return res.data;
  },

  rejectProposal: async (
    scanId: number,
    proposalId: number,
    notes?: string
  ): Promise<ScanProposal> => {
    const res = await api.post(
      `/api/scan/mindscan/${scanId}/proposals/${proposalId}/reject`,
      notes ? { notes } : {}
    );
    return res.data;
  },

  // Legacy scan endpoints
  getScans: async (): Promise<CatalogScan[]> => {
    const res = await api.get("/api/scan/scans", undefined, false);
    return res.data || [];
  },

  getScan: async (id: number): Promise<CatalogScan> => {
    const res = await api.get(`/api/scan/scans/${id}`);
    return res.data;
  },

  getScanEntities: async (scanId: number): Promise<DetectedEntity[]> => {
    const res = await api.get(`/api/scan/scans/${scanId}/entities`);
    return res.data || [];
  },
};

export default ScanService;

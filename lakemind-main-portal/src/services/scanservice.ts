import { api } from "@/lib/api";

export interface DetectedColumn {
  id: string;
  name: string;
  data_type: string;
  description: string;
  is_metric_candidate: boolean;
  is_dimension_candidate: boolean;
  confidence: number;
  status: "pending" | "approved" | "rejected";
}

export interface DetectedTable {
  id: string;
  name: string;
  full_name: string;
  schema: string;
  catalog: string;
  columns: DetectedColumn[];
  column_count: number;
  description: string;
  status: "pending" | "approved" | "rejected";
}

export interface DetectedEntity {
  id: string;
  name: string;
  description: string;
  schema: string;
  tables: DetectedTable[];
  table_count: number;
  column_count: number;
  metric_count: number;
  confidence: number;
  status: "draft" | "needs_review" | "approved";
  created_at: string;
  updated_at: string;
}

export interface CatalogScan {
  id: string;
  catalog: string;
  status: "running" | "completed" | "failed";
  schema_count: number;
  table_count: number;
  entity_count: number;
  column_count: number;
  started_at: string;
  completed_at: string | null;
  entities: DetectedEntity[];
}

const ScanService = {
  scanCatalog: async (catalog: string): Promise<CatalogScan> => {
    const res = await api.post("/api/scan/catalogs", { catalog });
    return res.data;
  },

  getScans: async (): Promise<CatalogScan[]> => {
    const res = await api.get("/api/scan");
    return res.data || [];
  },

  getScan: async (id: string): Promise<CatalogScan> => {
    const res = await api.get(`/api/scan/${id}`);
    return res.data;
  },

  rescan: async (id: string): Promise<CatalogScan> => {
    const res = await api.post(`/api/scan/${id}/rescan`);
    return res.data;
  },

  getEntities: async (scanId: string): Promise<DetectedEntity[]> => {
    const res = await api.get(`/api/scan/${scanId}/entities`);
    return res.data || [];
  },
};

export default ScanService;

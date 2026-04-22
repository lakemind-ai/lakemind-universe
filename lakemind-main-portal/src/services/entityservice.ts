import { api } from "@/lib/api";

export interface GlossaryMetric {
  id: string;
  entity_id: string;
  name: string;
  display_name: string;
  type: "measure" | "calculated" | "derived";
  description: string;
  formula: string;
  backing_column: string;
  backing_table: string;
  confidence: number;
  status: "draft" | "approved" | "rejected";
  version_diff?: {
    previous_formula?: string;
    change_type?: "added" | "modified" | "removed";
  };
  created_at: string;
  updated_at: string;
}

export interface GlossaryDimension {
  id: string;
  entity_id: string;
  name: string;
  display_name: string;
  description: string;
  data_type: string;
  backing_column: string;
  backing_table: string;
  hierarchy_level?: string;
  created_at: string;
  updated_at: string;
}

export interface GenieInstruction {
  id: string;
  entity_id: string;
  instruction_type: "context" | "constraint" | "example";
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface Entity {
  id: string;
  name: string;
  display_name: string;
  description: string;
  schema: string;
  catalog: string;
  table_count: number;
  column_count: number;
  metric_count: number;
  dimension_count: number;
  confidence: number;
  status: "draft" | "needs_review" | "approved";
  created_at: string;
  updated_at: string;
}

const EntityService = {
  getEntities: async (): Promise<Entity[]> => {
    const res = await api.get("/api/entities");
    return res.data || [];
  },

  getEntity: async (id: string): Promise<Entity> => {
    const res = await api.get(`/api/entities/${id}`);
    return res.data;
  },

  updateEntity: async (id: string, data: Partial<Entity>): Promise<Entity> => {
    const res = await api.patch(`/api/entities/${id}`, data);
    return res.data;
  },

  approveEntity: async (id: string): Promise<Entity> => {
    const res = await api.post(`/api/entities/${id}/approve`);
    return res.data;
  },

  getMetrics: async (entityId: string): Promise<GlossaryMetric[]> => {
    const res = await api.get(`/api/entities/${entityId}/metrics`);
    return res.data || [];
  },

  createMetric: async (entityId: string, data: Partial<GlossaryMetric>): Promise<GlossaryMetric> => {
    const res = await api.post(`/api/entities/${entityId}/metrics`, data);
    return res.data;
  },

  updateMetric: async (id: string, data: Partial<GlossaryMetric>): Promise<GlossaryMetric> => {
    const res = await api.patch(`/api/metrics/${id}`, data);
    return res.data;
  },

  approveMetric: async (id: string): Promise<GlossaryMetric> => {
    const res = await api.post(`/api/metrics/${id}/approve`);
    return res.data;
  },

  getDimensions: async (entityId: string): Promise<GlossaryDimension[]> => {
    const res = await api.get(`/api/entities/${entityId}/dimensions`);
    return res.data || [];
  },

  createDimension: async (entityId: string, data: Partial<GlossaryDimension>): Promise<GlossaryDimension> => {
    const res = await api.post(`/api/entities/${entityId}/dimensions`, data);
    return res.data;
  },

  updateDimension: async (id: string, data: Partial<GlossaryDimension>): Promise<GlossaryDimension> => {
    const res = await api.patch(`/api/dimensions/${id}`, data);
    return res.data;
  },

  aiPropose: async (entityId: string): Promise<{ metrics: GlossaryMetric[]; dimensions: GlossaryDimension[] }> => {
    const res = await api.post(`/api/entities/${entityId}/ai/propose`);
    return res.data;
  },

  aiRefine: async (metricId: string, prompt: string): Promise<{ suggestion: GlossaryMetric; explanation: string }> => {
    const res = await api.post(`/api/metrics/${metricId}/ai/refine`, { prompt });
    return res.data;
  },
};

export default EntityService;

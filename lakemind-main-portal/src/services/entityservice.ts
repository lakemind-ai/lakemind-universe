import { api } from "@/lib/api";

export interface EntityDetail {
  id: number;
  scan_id: number;
  name: string;
  description: string;
  entity_type: string;
  source_hint: string;
  confidence_score: number;
  status: string;
  pii_flag: boolean;
  created_at: string;
  updated_at: string;
  tables?: EntityTable[];
  metrics?: EntityMetric[];
  dimensions?: EntityDimension[];
}

export interface EntityTable {
  id: number;
  entity_id: number;
  catalog: string;
  schema_name: string;
  table_name: string;
  description: string;
  column_count: number;
  row_count: number;
  status: string;
  columns?: EntityColumn[];
}

export interface EntityColumn {
  id: number;
  table_id: number;
  column_name: string;
  data_type: string;
  business_name: string;
  business_description: string;
  confidence_score: number;
  status: string;
}

export interface EntityMetric {
  id: number;
  entity_id: number;
  name: string;
  metric_type: string;
  description: string;
  formula: string;
  backing_table: string;
  confidence_score: number;
  status: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

export interface EntityDimension {
  id: number;
  entity_id: number;
  name: string;
  description: string;
  source_column: string;
  source_table: string;
  cardinality: string;
  confidence_score: number;
  status: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

export interface EntityDefinition {
  id: number;
  entity_id: number;
  kind: string;
  scope: string;
  name: string;
  description: string;
  formula: string;
  source_column: string;
  source_table: string;
  confidence_score: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const EntityService = {
  getEntities: async (): Promise<EntityDetail[]> => {
    const res = await api.get("/api/entity/entities", undefined, false);
    return res.data || [];
  },

  getEntity: async (id: number): Promise<EntityDetail> => {
    const res = await api.get(`/api/entity/entities/${id}`, undefined, false);
    return res.data;
  },

  updateEntity: async (
    id: number,
    data: { name?: string; description?: string; status?: string }
  ): Promise<EntityDetail> => {
    const res = await api.patch(`/api/entity/entities/${id}`, data);
    return res.data;
  },

  approveEntity: async (id: number): Promise<EntityDetail> => {
    const res = await api.post(`/api/entity/entities/${id}/approve`);
    return res.data;
  },

  getMetrics: async (entityId: number): Promise<EntityMetric[]> => {
    const res = await api.get(
      `/api/entity/entities/${entityId}/metrics`,
      undefined,
      false
    );
    return res.data || [];
  },

  createMetric: async (
    entityId: number,
    data: {
      name: string;
      description?: string;
      formula?: string;
      backing_table?: string;
    }
  ): Promise<EntityMetric> => {
    const res = await api.post(
      `/api/entity/entities/${entityId}/metrics`,
      data
    );
    return res.data;
  },

  updateMetric: async (
    id: number,
    data: {
      name?: string;
      description?: string;
      formula?: string;
      status?: string;
    }
  ): Promise<EntityMetric> => {
    const res = await api.patch(`/api/entity/metrics/${id}`, data);
    return res.data;
  },

  approveMetric: async (id: number): Promise<EntityMetric> => {
    const res = await api.post(`/api/entity/metrics/${id}/approve`);
    return res.data;
  },

  getDimensions: async (entityId: number): Promise<EntityDimension[]> => {
    const res = await api.get(
      `/api/entity/entities/${entityId}/dimensions`,
      undefined,
      false
    );
    return res.data || [];
  },

  createDimension: async (
    entityId: number,
    data: {
      name: string;
      description?: string;
      source_column?: string;
      source_table?: string;
    }
  ): Promise<EntityDimension> => {
    const res = await api.post(
      `/api/entity/entities/${entityId}/dimensions`,
      data
    );
    return res.data;
  },

  updateDimension: async (
    id: number,
    data: {
      name?: string;
      description?: string;
      source_column?: string;
      source_table?: string;
      status?: string;
    }
  ): Promise<EntityDimension> => {
    const res = await api.patch(`/api/entity/dimensions/${id}`, data);
    return res.data;
  },

  getDefinitions: async (entityId: number): Promise<EntityDefinition[]> => {
    const res = await api.get(
      `/api/entity/entities/${entityId}/definitions`,
      undefined,
      false
    );
    return res.data || [];
  },

  aiPropose: async (
    entityId: number
  ): Promise<{ new_metrics: string[]; new_dimensions: string[]; total_proposed: number }> => {
    const res = await api.post(
      `/api/entity/entities/${entityId}/ai-propose`
    );
    return res.data;
  },

  aiChat: async (
    entityId: number,
    message: string,
    warehouseId: string,
    modelEndpoint: string,
    sessionId?: number
  ): Promise<{
    session_id: number;
    response: string;
    proposals: {
      type: "metric" | "dimension";
      name: string;
      description: string;
      formula?: string;
      source_column?: string;
      source_table?: string;
      confidence: number;
    }[];
  }> => {
    const res = await api.post(
      `/api/entity/entities/${entityId}/ai-chat`,
      {
        message,
        warehouse_id: warehouseId,
        model_endpoint: modelEndpoint,
        session_id: sessionId || null,
      },
      false
    );
    return res.data;
  },

  getChatSessions: async (
    entityId: number
  ): Promise<{ id: number; title: string; message_count: number; updated_at: string }[]> => {
    const res = await api.get(
      `/api/entity/entities/${entityId}/chat-sessions`,
      undefined,
      false
    );
    return res.data || [];
  },

  getChatSession: async (
    entityId: number,
    sessionId: number
  ): Promise<{
    id: number;
    messages: { role: string; content: string; proposals: any[] }[];
  }> => {
    const res = await api.get(
      `/api/entity/entities/${entityId}/chat-sessions/${sessionId}`,
      undefined,
      false
    );
    return res.data;
  },

  aiRefineMetric: async (
    metricId: number,
    message: string
  ): Promise<EntityMetric> => {
    const res = await api.post(`/api/entity/metrics/${metricId}/ai-refine`, {
      message,
    });
    return res.data;
  },
};

export default EntityService;

import { api } from "@/lib/api";

export interface RealmSummary {
  id: number;
  name: string;
  description: string;
  status: string;
  genie_workspace_id: string | null;
  genie_workspace_name: string;
  latest_version: number | null;
  entity_count: number;
  entity_ids: number[];
  table_count: number;
  metric_count: number;
  dimension_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RealmDetail extends RealmSummary {
  entities: {
    id: number;
    name: string;
    description: string;
    status: string;
    confidence_score: number;
    table_count: number;
    metric_count: number;
    dimension_count: number;
  }[];
}

export interface AvailableEntity {
  id: number;
  name: string;
  description: string;
  status: string;
  confidence_score: number;
  table_count: number;
  metric_count: number;
  dimension_count: number;
  realm_ids: number[];
}

const RealmService = {
  listRealms: async (): Promise<RealmSummary[]> => {
    const res = await api.get("/api/realm/realms", undefined, false);
    return res.data || [];
  },

  getRealm: async (id: number): Promise<RealmDetail> => {
    const res = await api.get(`/api/realm/realms/${id}`, undefined, false);
    return res.data;
  },

  createRealm: async (
    name: string,
    description: string,
    entityIds: number[]
  ): Promise<RealmSummary> => {
    const res = await api.post("/api/realm/realms", {
      name,
      description,
      entity_ids: entityIds,
    });
    return res.data;
  },

  updateRealm: async (
    id: number,
    data: { name?: string; description?: string }
  ): Promise<RealmSummary> => {
    const res = await api.patch(`/api/realm/realms/${id}`, data);
    return res.data;
  },

  assignEntities: async (
    realmId: number,
    entityIds: number[]
  ): Promise<RealmSummary> => {
    const res = await api.post(`/api/realm/realms/${realmId}/entities`, {
      entity_ids: entityIds,
    });
    return res.data;
  },

  deleteRealm: async (id: number): Promise<void> => {
    await api.delete(`/api/realm/realms/${id}`);
  },

  getAvailableEntities: async (): Promise<AvailableEntity[]> => {
    const res = await api.get("/api/realm/available-entities", undefined, false);
    return res.data || [];
  },
};

export default RealmService;

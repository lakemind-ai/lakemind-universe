import { api } from "@/lib/api";

export interface ChronicleVersion {
  id: number;
  version_number: number;
  status: string;
  description: string;
  changes_summary: string;
  entities_added: number;
  entities_modified: number;
  entities_removed: number;
  created_by: string;
  published_by: string;
  published_at: string;
  created_at: string;
}

export interface ChronicleVersionDetail extends ChronicleVersion {
  realm_id: number;
  realm_name: string;
  snapshot: any[];
  diff: { change_type: string; kind: string; entity: string; name: string; old_value?: string; new_value?: string }[];
  genie_instructions: string;
  changes: any[];
  audit_trail: any[];
  table_identifiers?: string[];
}

const ChronicleService = {
  listVersions: async (realmId: number): Promise<ChronicleVersion[]> => {
    const res = await api.get(`/api/chronicle/realms/${realmId}/versions`, undefined, false);
    return res.data || [];
  },

  createVersion: async (realmId: number): Promise<ChronicleVersion> => {
    const res = await api.post(`/api/chronicle/realms/${realmId}/versions`);
    return res.data;
  },

  getVersion: async (versionId: number): Promise<ChronicleVersionDetail> => {
    const res = await api.get(`/api/chronicle/versions/${versionId}`, undefined, false);
    return res.data;
  },

  refreshVersion: async (versionId: number): Promise<ChronicleVersionDetail> => {
    const res = await api.post(`/api/chronicle/versions/${versionId}/refresh`);
    return res.data;
  },

  publishVersion: async (versionId: number): Promise<ChronicleVersionDetail> => {
    const res = await api.post(`/api/chronicle/versions/${versionId}/publish`);
    return res.data;
  },

  deleteVersion: async (versionId: number): Promise<void> => {
    await api.delete(`/api/chronicle/versions/${versionId}`);
  },

  createGenie: async (versionId: number, warehouseId: string): Promise<{ space_id: string; display_name: string; url: string }> => {
    const res = await api.post(`/api/chronicle/versions/${versionId}/create-genie`, { warehouse_id: warehouseId });
    return res.data;
  },

  updateGenie: async (versionId: number): Promise<{ space_id: string; display_name: string; url: string }> => {
    const res = await api.post(`/api/chronicle/versions/${versionId}/update-genie`);
    return res.data;
  },
};

export default ChronicleService;

import { api } from "@/lib/api";

export interface VersionChange {
  id: string;
  entity_name: string;
  change_type: "added" | "modified" | "removed";
  field: string;
  old_value?: string;
  new_value?: string;
  description: string;
}

export interface AuditEntry {
  id: string;
  version_id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

export interface GlossaryVersion {
  id: string;
  version_number: number;
  label: string;
  status: "draft" | "staged" | "published" | "archived";
  change_count: number;
  changes_summary: string;
  created_by: string;
  created_at: string;
  published_at: string | null;
  changes: VersionChange[];
  audit: AuditEntry[];
}

const GlossaryService = {
  getVersions: async (): Promise<GlossaryVersion[]> => {
    const res = await api.get("/api/glossary/versions");
    return res.data || [];
  },

  createVersion: async (): Promise<GlossaryVersion> => {
    const res = await api.post("/api/glossary/versions");
    return res.data;
  },

  getVersion: async (id: string): Promise<GlossaryVersion> => {
    const res = await api.get(`/api/glossary/versions/${id}`);
    return res.data;
  },

  getDiff: async (id: string): Promise<VersionChange[]> => {
    const res = await api.get(`/api/glossary/versions/${id}/diff`);
    return res.data || [];
  },

  publish: async (id: string): Promise<GlossaryVersion> => {
    const res = await api.post(`/api/glossary/versions/${id}/publish`);
    return res.data;
  },

  stage: async (id: string): Promise<GlossaryVersion> => {
    const res = await api.post(`/api/glossary/versions/${id}/stage`);
    return res.data;
  },

  getAudit: async (id: string): Promise<AuditEntry[]> => {
    const res = await api.get(`/api/glossary/versions/${id}/audit`);
    return res.data || [];
  },
};

export default GlossaryService;

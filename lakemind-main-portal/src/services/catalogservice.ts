import { api } from "@/lib/api";

const CatalogService = {
  getCatalogs: async (): Promise<string[]> => {
    const res = await api.get("/api/catalog/catalogs");
    return res.data || [];
  },
  getSchemas: async (catalog: string): Promise<string[]> => {
    const res = await api.get(`/api/catalog/catalogs/${catalog}/schemas`);
    return res.data || [];
  },
  getTables: async (
    catalog: string,
    schema: string
  ): Promise<{ name: string; full_name: string; table_type: string }[]> => {
    const res = await api.get(`/api/catalog/catalogs/${catalog}/schemas/${schema}/tables`);
    return res.data || [];
  },
};

export default CatalogService;

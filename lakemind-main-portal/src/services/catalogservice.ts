import { api } from "@/lib/api";

const CatalogService = {
  getCatalogs: async (): Promise<string[]> => {
    const res = await api.get("/api/catalog/catalogs", undefined, false);
    return res.data || [];
  },
  getSchemas: async (catalog: string): Promise<string[]> => {
    const res = await api.get(`/api/catalog/catalogs/${catalog}/schemas`, undefined, false);
    return res.data || [];
  },
  getTables: async (
    catalog: string,
    schema: string
  ): Promise<{ name: string; full_name: string; table_type: string }[]> => {
    const res = await api.get(`/api/catalog/catalogs/${catalog}/schemas/${schema}/tables`, undefined, false);
    return res.data || [];
  },
};

export default CatalogService;

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface WarehouseItem {
  id: string;
  name: string;
  state: string;
  cluster_size: string;
  enable_serverless_compute: boolean;
}

export interface ServingEndpoint {
  name: string;
  state: string;
  creator: string;
}

interface ResourceContextValue {
  warehouses: WarehouseItem[];
  selectedWarehouse: WarehouseItem | null;
  setSelectedWarehouse: (w: WarehouseItem) => void;
  endpoints: ServingEndpoint[];
  selectedEndpoint: ServingEndpoint | null;
  setSelectedEndpoint: (e: ServingEndpoint) => void;
  loading: boolean;
}

const WAREHOUSE_STORAGE_KEY = "lakemind_selected_warehouse";
const ENDPOINT_STORAGE_KEY = "lakemind_selected_endpoint";

const loadFromStorage = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToStorage = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const ResourceContext = createContext<ResourceContextValue>({
  warehouses: [],
  selectedWarehouse: null,
  setSelectedWarehouse: () => {},
  endpoints: [],
  selectedEndpoint: null,
  setSelectedEndpoint: () => {},
  loading: true,
});

export function ResourceProvider({ children }: { children: React.ReactNode }) {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouse, _setSelectedWarehouse] =
    useState<WarehouseItem | null>(null);
  const [endpoints, setEndpoints] = useState<ServingEndpoint[]>([]);
  const [selectedEndpoint, _setSelectedEndpoint] =
    useState<ServingEndpoint | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedWarehouse = (w: WarehouseItem) => {
    _setSelectedWarehouse(w);
    saveToStorage(WAREHOUSE_STORAGE_KEY, w);
  };

  const setSelectedEndpoint = (e: ServingEndpoint) => {
    _setSelectedEndpoint(e);
    saveToStorage(ENDPOINT_STORAGE_KEY, e);
  };

  useEffect(() => {
    let mounted = true;

    const savedWarehouse = loadFromStorage<WarehouseItem>(WAREHOUSE_STORAGE_KEY);
    const savedEndpoint = loadFromStorage<ServingEndpoint>(ENDPOINT_STORAGE_KEY);

    Promise.allSettled([
      api.get("/api/compute/list-warehouses", undefined, false),
      api.get("/api/compute/list-serving-endpoints", undefined, false),
    ]).then(([whRes, epRes]) => {
      if (!mounted) return;

      if (whRes.status === "fulfilled") {
        const data = whRes.value?.data || [];
        setWarehouses(data);

        // Restore saved selection if it still exists in the list
        const restored = savedWarehouse
          ? data.find((w: WarehouseItem) => w.id === savedWarehouse.id)
          : null;
        _setSelectedWarehouse(restored || (data.length > 0 ? data[0] : null));
      }

      if (epRes.status === "fulfilled") {
        const data = epRes.value?.data || [];
        setEndpoints(data);

        // Restore saved selection if it still exists in the list
        const restored = savedEndpoint
          ? data.find((e: ServingEndpoint) => e.name === savedEndpoint.name)
          : null;
        _setSelectedEndpoint(restored || (data.length > 0 ? data[0] : null));
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ResourceContext.Provider
      value={{
        warehouses,
        selectedWarehouse,
        setSelectedWarehouse,
        endpoints,
        selectedEndpoint,
        setSelectedEndpoint,
        loading,
      }}
    >
      {children}
    </ResourceContext.Provider>
  );
}

export function useResources() {
  return useContext(ResourceContext);
}

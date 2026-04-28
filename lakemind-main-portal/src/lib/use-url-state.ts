import { useHistory, useLocation } from "react-router-dom";
import { useCallback } from "react";

/**
 * Hook to sync state with URL query params.
 * Read: getParam("key") → string | null
 * Write: setParam("key", "value") or setParams({key: "value", key2: "value2"})
 * Remove: setParam("key", null)
 */
export function useUrlState() {
  const history = useHistory();
  const location = useLocation();

  const getParam = useCallback(
    (key: string): string | null => {
      const params = new URLSearchParams(location.search);
      return params.get(key);
    },
    [location.search]
  );

  const getParamNumber = useCallback(
    (key: string): number | null => {
      const val = getParam(key);
      if (val === null) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    [getParam]
  );

  const getParamList = useCallback(
    (key: string): string[] => {
      const val = getParam(key);
      if (!val) return [];
      return val.split(",").filter(Boolean);
    },
    [getParam]
  );

  const setParam = useCallback(
    (key: string, value: string | number | null) => {
      const params = new URLSearchParams(location.search);
      if (value === null || value === "" || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
      const search = params.toString();
      history.replace({
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      });
    },
    [history, location.pathname, location.search]
  );

  const setParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }
      const search = params.toString();
      history.replace({
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      });
    },
    [history, location.pathname, location.search]
  );

  return { getParam, getParamNumber, getParamList, setParam, setParams };
}

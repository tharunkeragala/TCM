import { useCallback, useEffect, useState } from "react";
import API from "../services/api";

export interface PermissionSet {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

type PermissionMap = Record<string, PermissionSet>;

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

// Module-level cache: the permission matrix is small, rarely changes within
// a session, and every component that gates a button would otherwise
// trigger its own fetch. One request per session (or until logout) is enough.
let cache: PermissionMap | null = null;
let inflight: Promise<PermissionMap> | null = null;

async function fetchPermissions(): Promise<PermissionMap> {
  if (cache) return cache;
  if (!inflight) {
    inflight = API.get("/api/permissions/mine", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        cache = res.data?.data ?? {};
        return cache as PermissionMap;
      })
      .catch(() => {
        cache = {};
        return cache as PermissionMap;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Call this on logout so the next login doesn't reuse a stale role's permissions.
export function clearPermissionsCache() {
  cache = null;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionMap | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) {
      setPermissions(cache);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchPermissions().then((p) => {
      if (!cancelled) {
        setPermissions(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // can('/projects', 'can_edit')
  const can = useCallback(
    (menuPath: string, action: keyof PermissionSet): boolean =>
      permissions?.[menuPath]?.[action] === true,
    [permissions],
  );

  return { permissions, loading, can };
}

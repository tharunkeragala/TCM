import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../../services/api";
import useSessionTimeout from "../auth/useSessionTimeout";

interface UserPermission {
  menu_name: string;
  path: string;
}

// Routes that must always be reachable once a user is authenticated,
// regardless of their menu permissions. Prevents redirect loops.
const ALWAYS_ALLOWED_PATHS = new Set(["/unauthorized"]);

function normalize(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

function clearAuthStorage() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

export default function ProtectedRoute() {
  useSessionTimeout();
  const location = useLocation();

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [authInvalid, setAuthInvalid] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setAuthInvalid(false);

    const fetchPermissions = async () => {
      try {
        const res = await API.get("/api/roles/my-permissions");
        const data: UserPermission[] = res.data?.data ?? res.data;

        if (!isMounted) return;

        if (Array.isArray(data)) {
          const normalizedPaths = data
            .map((p) => p?.path)
            .filter(Boolean)
            .map(normalize);

          setAllowedPaths(new Set(normalizedPaths));
        } else {
          setAllowedPaths(new Set());
        }
      } catch (err: any) {
        if (!isMounted) return;

        // Invalid/expired token -> force back to sign-in, not "unauthorized"
        if (err?.response?.status === 401) {
          clearAuthStorage();
          setAuthInvalid(true);
        } else {
          console.error("Permission load failed", err);
          setAllowedPaths(new Set()); // deny all on unexpected error
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPermissions();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Not logged in, or token turned out to be invalid
  if (!token || authInvalid) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  // Still loading permissions
  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  const currentPath = normalize(location.pathname);

  // Always let authenticated users reach these regardless of permissions
  if (ALWAYS_ALLOWED_PATHS.has(currentPath)) {
    return <Outlet />;
  }

  const hasAccess = Array.from(allowedPaths).some((allowedPath) => {
    return (
      currentPath === allowedPath ||
      currentPath.startsWith(allowedPath + "/")
    );
  });

  if (!hasAccess) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{
          noAccessAtAll: allowedPaths.size === 0,
          attemptedPath: currentPath,
        }}
      />
    );
  }

  return <Outlet />;
}

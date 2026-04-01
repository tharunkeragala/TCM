import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import API from "../../services/api";

interface UserPermission {
  menu_name: string;
  path: string;
}

export default function ProtectedRoute() {
  const location = useLocation();

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await API.get("/api/roles/my-permissions");
        const data: UserPermission[] = res.data?.data ?? res.data;

        if (Array.isArray(data)) {
          const normalizedPaths = data
            .map((p) => p?.path)
            .filter(Boolean)
            .map((path) => normalize(path));

          setAllowedPaths(new Set(normalizedPaths));
        } else {
          setAllowedPaths(new Set()); // deny all if invalid
        }
      } catch (err) {
        console.error("Permission load failed", err);
        setAllowedPaths(new Set()); // deny all on error
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [token]);

  // 🔐 Not logged in
  if (!token) {
    return <Navigate to="/signin" replace />;
  }

  // ⏳ Still loading permissions
  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  // 🚫 No access
  if (!allowedPaths.has(normalize(location.pathname))) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Allowed
  return <Outlet />;
}
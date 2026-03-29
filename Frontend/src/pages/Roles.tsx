import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import API from "../services/api";
import Alert from "../components/ui/alert/Alert";

interface Role {
  id: number;
  role_name: string;
}

interface ApiResponse {
  success: boolean;
  data: Role[];
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError("");

      // ✅ Get token from storage
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const res = await API.get<ApiResponse>("/api/roles", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRoles(res.data.data);

    } catch (err: any) {
      console.error("Error fetching roles:", err);

      // ✅ Show specific messages based on status
      if (err.response?.status === 403) {
        setError("Access denied. You do not have permission to view roles.");
      } else if (err.response?.status === 401) {
        setError("Unauthorized. Please login again.");
      } else {
        setError("Failed to load roles.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageMeta title="Roles" description="Roles page" />
      <PageBreadcrumb pageTitle="Roles" />

      <div className="mt-4">

        {/* ✅ Show Alert if error */}
        {error && (
          <div className="mb-4">
            <Alert
              variant="error"
              title="Error"
              message={error}
            />
            
          </div>
        )}

        {/* ✅ Loading */}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400">
            Loading roles...
          </div>
        )}

        {/* ✅ Table */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">Role ID</th>
                  <th className="px-5 py-3">Role Name</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <tr
                      key={role.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {role.id}
                      </td>

                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {role.role_name}
                      </td>

                      
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center py-5 text-gray-500">
                      No roles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
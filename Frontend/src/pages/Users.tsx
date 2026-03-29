import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import API from "../services/api";
import Alert from "../components/ui/alert/Alert"; // ✅ add this

// ✅ Define User type
interface User {
  id: number;
  username: string;
  role_name: string;
  department_name: string;
  source: string;
  is_active: boolean;
}

// ✅ API response type (fixing your response shape)
interface ApiResponse {
  success: boolean;
  data: User[];
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);   // ✅ added
  const [error, setError] = useState<string>("");          // ✅ added

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

      if (!token) {
        setError("User not authenticated");
        return;
      }

      const res = await API.get<ApiResponse>("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(res.data.data);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);

      if (err.response?.status === 403) {
        setError(
          "Access denied. You do not have permission to view users."
        );
      } else if (err.response?.status === 401) {
        setError("Unauthorized. Please login again.");
      } else {
        setError("Failed to load users.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageMeta title="User Management" description="User management page" />
      <PageBreadcrumb pageTitle="User Management" />

      <div className="mt-4">

        {/* ✅ Alert */}
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
            Loading users...
          </div>
        )}

        {/* ✅ Table */}
        {!loading && !error && (
        //   <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
      
        // <h3 className="mb-6 font-semibold text-gray-800 text-xl dark:text-white/90">
        //   User Management
        // </h3>
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {users.length > 0 ? (
                  users.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {item.username}
                      </td>

                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {item.role_name}
                      </td>

                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {item.department_name}
                      </td>

                      <td className="px-5 py-3">
                        <span className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {item.source}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            item.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-gray-500">
                      No users found
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
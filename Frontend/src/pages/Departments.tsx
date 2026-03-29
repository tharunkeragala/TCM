import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import API from "../services/api";
import Alert from "../components/ui/alert/Alert"; // make sure this path is correct

// ✅ Department type
interface Department {
  id: number;
  department_name: string;
  is_active: boolean;
}

// ✅ API response type
interface ApiResponse {
  success: boolean;
  data: Department[];
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError("");

      // ✅ Get token from storage
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        setError("User not authenticated");
        return;
      }

      const res = await API.get<ApiResponse>("/api/departments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setDepartments(res.data.data);

    } catch (err: any) {
      console.error("Error fetching departments:", err);

      // ✅ Show specific messages based on status
      if (err.response?.status === 403) {
        setError("Access denied. You do not have permission to view departments.");
      } else if (err.response?.status === 401) {
        setError("Unauthorized. Please login again.");
      } else {
        setError("Failed to load departments.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageMeta title="Departments" description="Departments page" />
      <PageBreadcrumb pageTitle="Departments" />

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
            Loading departments...
          </div>
        )}

        {/* ✅ Table */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">Department ID</th>
                  <th className="px-5 py-3">Department Name</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {departments.length > 0 ? (
                  departments.map((dept) => (
                    <tr
                      key={dept.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {dept.id}
                      </td>

                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {dept.department_name}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            dept.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {dept.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-gray-500">
                      No departments found
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
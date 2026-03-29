import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";

interface Department {
  id: number;
  department_name: string;
  is_active: boolean;
}

export default function Departments() {
  const {
    data: departments,
    loading,
    error,
  } = useFetchWithAuth<Department[]>("/api/departments");

  return (
    <div>
      <PageMeta title="Departments" description="Departments page" />
      <PageBreadcrumb pageTitle="Departments" />

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
                {departments && departments.length > 0 ? (
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
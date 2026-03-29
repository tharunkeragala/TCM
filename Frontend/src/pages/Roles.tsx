import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";

interface Role {
  id: number;
  role_name: string;
}

export default function Roles() {
  const { data: roles, loading, error } =
    useFetchWithAuth<Role[]>("/api/roles");

  return (
    <div>
      <PageMeta title="Roles" description="Roles page" />
      <PageBreadcrumb pageTitle="Roles" />

      <div className="mt-4">

        {/* ✅ Alert */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
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
                {roles && roles.length > 0 ? (
                  roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{role.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{role.role_name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center py-5">
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
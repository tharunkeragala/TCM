import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import API from "../services/api";

// ✅ Define User type
interface User {
  id: number;
  username: string;
  role_name: string;
  department_name: string;
  source: string;
  is_active: boolean;
}

export default function Users() {
  // ✅ Add type to state
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
  const fetchUsers = async () => {
    try {
      const res = await API.get<User[]>("/api/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  fetchUsers();
}, []);

  return (
    <div>
      <PageMeta
        title="User Management"
        description="User management page"
      />
      <PageBreadcrumb pageTitle="Users" />

      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <h3 className="mb-6 font-semibold text-gray-800 text-xl dark:text-white/90">
          User Management
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left">Username</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="p-3">{u.username}</td>
                  <td className="p-3">{u.role_name}</td>
                  <td className="p-3">{u.department_name}</td>
                  <td className="p-3">{u.source}</td>
                  <td className="p-3">
                    {u.is_active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
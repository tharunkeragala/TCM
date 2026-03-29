import { useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Alert from "../components/ui/alert/Alert";
import useFetchWithAuth from "../hooks/useFetchWithAuth";
import API from "../services/api";

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

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ department_name: "", is_active: true });
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleCreate = async () => {
  if (!formData.department_name.trim()) {
    setFormAlert({ type: "error", message: "Department name is required." });
    return;
  }

  setSubmitting(true);
  setFormAlert(null);

  try {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    const res = await API.post(
      "/api/departments/create",
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.data.success) {
      setFormAlert({ type: "success", message: "Department created successfully!" });
      setTimeout(() => {
        setShowModal(false);
        setFormData({ department_name: "", is_active: true });
        setFormAlert(null);
        window.location.reload();
      }, 1200);
    }

  } catch (err: any) {
    console.error("Full error:", err.response);
    const message =
      err.response?.data?.message || "Failed to create department.";
    setFormAlert({ type: "error", message });
  } finally {
    setSubmitting(false);
  }
};

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({ department_name: "", is_active: true });
    setFormAlert(null);
  };

  return (
    <div>
      <PageMeta title="Departments" description="Departments page" />
      <PageBreadcrumb pageTitle="Departments" />

      <div className="mt-4">

        {/* ✅ Top bar with Create button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150"
          >
            + Create Department
          </button>
        </div>

        {/* ✅ Fetch error alert */}
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {/* ✅ Loading */}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400">Loading departments...</div>
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
                    <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{dept.id}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{dept.department_name}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          dept.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}>
                          {dept.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-gray-500">No departments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ✅ Create Department Modal */}
      {showModal && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Department</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Form Alert */}
            {formAlert && (
              <div className="mb-4">
                <Alert
                  variant={formAlert.type}
                  title={formAlert.type === "success" ? "Success" : "Error"}
                  message={formAlert.message}
                />
              </div>
            )}

            {/* Department Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.department_name}
                onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                placeholder="e.g. Engineering"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Is Active Toggle */}
            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
              <button
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  formData.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  formData.is_active ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formData.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
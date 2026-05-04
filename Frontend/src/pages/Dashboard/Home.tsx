import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import TaskDashboardStats from "../../components/taskstats/TaskDashboardStats";

export default function Blank() {
  return (
    <div>
      <PageMeta title="TCM - Dashboard" description="Test Case Manager" />
      <PageBreadcrumb pageTitle="Dashboard" />

      <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm 
                dark:border-gray-800 dark:bg-gray-900 
                xl:p-8">
  <TaskDashboardStats />
</div>
    </div>
  );
}

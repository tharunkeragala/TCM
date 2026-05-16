import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  // Mirror the exact sidebar widths declared in AppSidebar
  const sidebarOpen = isExpanded || isHovered;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 lg:flex">
      {/* Sidebar + mobile backdrop */}
      <AppSidebar />
      <Backdrop />

      {/* Main area shifts right exactly as wide as the sidebar */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          transition-[margin] duration-300 ease-in-out
          ${sidebarOpen ? "lg:ml-[256px]" : "lg:ml-[64px]"}
          ${isMobileOpen ? "overflow-hidden" : ""}
        `}
      >
        <AppHeader />

        {/* Page content — full width, consistent padding */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => (
  <SidebarProvider>
    <LayoutContent />
  </SidebarProvider>
);

export default AppLayout;
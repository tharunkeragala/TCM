import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import PlexusBackground from "../components/background/PlexusBackground";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const sidebarOpen = isExpanded || isHovered;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0b1a] relative">
      <PlexusBackground />

      <div className="relative z-10 flex min-h-screen">
        <AppSidebar />
        <Backdrop />

        <div
          className={`
            flex-1 flex flex-col min-w-0
            transition-[margin] duration-300 ease-in-out

            lg:ml-[64px]
            ${sidebarOpen ? "xl:ml-[256px]" : "xl:ml-[64px]"}

            ${isMobileOpen ? "overflow-hidden" : ""}
          `}
        >
          <AppHeader />

          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
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
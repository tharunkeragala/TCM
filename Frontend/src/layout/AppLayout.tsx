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
    <div className="min-h-screen bg-white dark:bg-[#0d0b1a] lg:flex relative">

      <PlexusBackground />

      <div className="relative z-10 flex flex-1 min-h-screen lg:flex">
        <AppSidebar />
        <Backdrop />

        <div className={`
          flex-1 flex flex-col min-w-0
          transition-[margin] duration-300 ease-in-out
          ${sidebarOpen ? "lg:ml-[256px]" : "lg:ml-[64px]"}
          ${isMobileOpen ? "overflow-hidden" : ""}
        `}>
          <AppHeader />
          <main className="flex-1 p-4 md:p-6">
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
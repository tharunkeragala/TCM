import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";

const SIDEBAR_EXPANDED_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 64;
const LG_BREAKPOINT = 1024;

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= LG_BREAKPOINT : false,
  );

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar, isExpanded, isHovered } =
    useSidebar();

  const inputRef = useRef<HTMLInputElement>(null);

  // Header left offset tracks the currently visible sidebar width
  const sidebarWidth =
    isExpanded || isHovered ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  const handleToggle = () => {
    if (window.innerWidth >= LG_BREAKPOINT) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= LG_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Blur when a modal is open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsBlurred(document.body.classList.contains("modal-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Ctrl/Cmd + K → focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const headerStyle = isDesktop
    ? {
        left: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`,
        height: `${HEADER_HEIGHT}px`,
        transition: "left 300ms ease-in-out, width 300ms ease-in-out",
      }
    : {
        left: 0,
        width: "100%",
        height: `${HEADER_HEIGHT}px`,
      };

  return (
    <>
      <header
        style={headerStyle}
        className={`fixed top-0 right-0 z-50 bg-[#03045e] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${
          isBlurred ? "blur-sm pointer-events-none select-none" : ""
        }`}
      >
        <div className="flex items-center justify-between h-full px-4 lg:px-5">
          {/* ── LEFT ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            {/* Sidebar toggle */}
            <button
              onClick={handleToggle}
              aria-label="Toggle Sidebar"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 dark:text-gray-400
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
            >
              {isMobileOpen ? (
                /* Close icon */
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.22 7.28a1 1 0 0 1 1.42-1.42L12 10.59l4.36-4.73a1 1 0 1 1 1.46 1.37L13.06 12l4.76 4.72a1 1 0 1 1-1.42 1.42L12 13.41l-4.36 4.73a1 1 0 1 1-1.46-1.37L10.94 12 6.22 7.28Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M0 1a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1Zm0 12a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1ZM1 6a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H1Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>

            {/* Logo (mobile only — desktop logo lives in the sidebar) */}
            <Link to="/" className="lg:hidden">
              <img
                className="dark:hidden h-7"
                src="/images/logo/logo.svg"
                alt="Logo"
              />
              <img
                className="hidden dark:block h-7"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
              />
            </Link>

            {/* Search (desktop) */}
            <div className="hidden lg:block ml-1">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3 9a6 6 0 1 1 12 0A6 6 0 0 1 3 9Zm6-8a8 8 0 1 0 4.906 14.32l3.387 3.387a1 1 0 0 0 1.414-1.414l-3.387-3.387A8 8 0 0 0 9 1Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search…"
                  className="h-9 w-64 xl:w-80 rounded-lg border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 pl-9 pr-12
                             text-sm text-gray-900 dark:text-white placeholder:text-gray-400
                             focus:border-brand-500 dark:focus:border-brand-500 focus:outline-none
                             transition-colors duration-150"
                />
                <kbd className="absolute inset-y-0 right-3 flex items-center gap-0.5 text-[11px]
                                text-gray-400 dark:text-gray-500 pointer-events-none">
                  <span className="font-sans">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>

          {/* ── RIGHT ────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <ThemeToggleButton />
            <NotificationDropdown />
            <UserDropdown />

            {/* Mobile overflow menu toggle */}
            <button
              onClick={() => setApplicationMenuOpen(!isApplicationMenuOpen)}
              aria-label="Application menu"
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg
                         text-gray-500 dark:text-gray-400
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="19" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Push page content below the fixed header */}
      <div style={{ height: HEADER_HEIGHT }} />
    </>
  );
};

export default AppHeader;
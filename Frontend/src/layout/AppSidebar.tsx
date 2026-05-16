import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import API from "../services/api";

import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
};

interface UserPermission {
  menu_name: string;
  path: string;
}

// ─── Menu Definitions ─────────────────────────────────────────────────────────

const navItems: NavItem[] = [
  { icon: <GridIcon />, name: "Dashboard", path: "/home" },
  {
    name: "Test Repository",
    icon: <ListIcon />,
    subItems: [
      { name: "Projects", path: "/projects" },
      { name: "Test Suites", path: "/test-suites" },
      { name: "Test Cases", path: "/test-cases" },
    ],
  },
  { icon: <ListIcon />, name: "Tasks", path: "/tasks" },
  { icon: <CalenderIcon />, name: "Calendar", path: "/calendar" },
  { icon: <UserCircleIcon />, name: "User Profile", path: "/profile" },
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [{ name: "Form Elements", path: "/form-elements" }],
  },
  {
    name: "Reports",
    icon: <ListIcon />,
    subItems: [
      { name: "User Reports", path: "/reports/users" },
      { name: "Task Reports", path: "/reports/tasks" },
    ],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/basic-tables" }],
  },
  {
    name: "System Configuration",
    icon: <ListIcon />,
    subItems: [
      { name: "User Management", path: "/users" },
      { name: "Roles", path: "/roles" },
      { name: "Departments", path: "/departments" },
      { name: "Teams", path: "/teams" },
    ],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "Blank Page", path: "/blank" },
      { name: "404 Error", path: "/error-404" },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart" },
      { name: "Bar Chart", path: "/bar-chart" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts" },
      { name: "Avatar", path: "/avatars" },
      { name: "Badge", path: "/badge" },
      { name: "Buttons", path: "/buttons" },
      { name: "Images", path: "/images" },
      { name: "Videos", path: "/videos" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin" },
      { name: "Sign Up", path: "/signup" },
    ],
  },
];

// ─── Permission Filter ────────────────────────────────────────────────────────

function filterMenuByPermissions(
  items: NavItem[],
  allowedPaths: Set<string>,
): NavItem[] {
  return items
    .map((item) => {
      if (item.path) {
        return allowedPaths.has(item.path) ? item : null;
      }
      if (item.subItems) {
        const filteredSubs = item.subItems.filter((s) =>
          allowedPaths.has(s.path),
        );
        return filteredSubs.length === 0
          ? null
          : { ...item, subItems: filteredSubs };
      }
      return null;
    })
    .filter(Boolean) as NavItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // True when sidebar is visually wide
  const isOpen = isExpanded || isHovered || isMobileOpen;

  // ─── Permissions ──────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await API.get("/api/roles/my-permissions");
        const data: UserPermission[] = res.data?.data ?? res.data;
        if (Array.isArray(data)) {
          setAllowedPaths(new Set(data.map((p) => p.path)));
        } else {
          setAllowedPaths(null);
        }
      } catch {
        setAllowedPaths(null);
      } finally {
        setPermissionsLoaded(true);
      }
    };
    fetchPermissions();
  }, []);

  const filteredNavItems =
    allowedPaths === null
      ? navItems
      : filterMenuByPermissions(navItems, allowedPaths);

  const filteredOthersItems =
    allowedPaths === null
      ? othersItems
      : filterMenuByPermissions(othersItems, allowedPaths);

  // ─── Active helpers ───────────────────────────────────────────────────────

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  const isParentActive = useCallback(
    (nav: NavItem) =>
      nav.subItems?.some((s) => location.pathname.startsWith(s.path)) ?? false,
    [location.pathname],
  );

  // ─── Auto-open submenu on navigation ─────────────────────────────────────

  useEffect(() => {
    let matched = false;
    for (const [menuType, items] of [
      ["main", filteredNavItems],
      ["others", filteredOthersItems],
    ] as const) {
      (items as NavItem[]).forEach((nav, index) => {
        nav.subItems?.forEach((sub) => {
          if (location.pathname.startsWith(sub.path)) {
            setOpenSubmenu({ type: menuType, index });
            matched = true;
          }
        });
      });
    }
    if (!matched) setOpenSubmenu(null);
  }, [location.pathname, permissionsLoaded]);

  // ─── Measure submenu height for smooth animation ──────────────────────────

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) {
        setSubMenuHeight((prev) => ({ ...prev, [key]: el.scrollHeight }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prev) =>
      prev?.type === menuType && prev.index === index
        ? null
        : { type: menuType, index },
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-0.5">
      {items.map((nav, index) => {
        const isSubmenuOpen =
          openSubmenu?.type === menuType && openSubmenu?.index === index;
        const parentActive = isParentActive(nav);

        return (
          <li key={nav.name}>
            {/* ── Parent with children ── */}
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150 cursor-pointer
                  ${
                    parentActive || isSubmenuOpen
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                  }
                `}
              >
                {/* Icon */}
                <span
                  className={`flex-shrink-0 w-5 h-5 ${
                    parentActive || isSubmenuOpen
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {nav.icon}
                </span>

                {/* Label */}
                {isOpen && (
                  <span className="flex-1 text-left leading-snug">
                    {nav.name}
                  </span>
                )}

                {/* Chevron */}
                {isOpen && (
                  <ChevronDownIcon
                    className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${
                      isSubmenuOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>
            ) : (
              /* ── Leaf link ── */
              nav.path && (
                <Link
                  to={nav.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${
                      isActive(nav.path)
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                    }
                  `}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 ${
                      isActive(nav.path)
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {nav.icon}
                  </span>
                  {isOpen && <span className="flex-1 leading-snug">{nav.name}</span>}
                </Link>
              )
            )}

            {/* ── Submenu ── */}
            {nav.subItems && isOpen && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`${menuType}-${index}`] = el;
                }}
                className="overflow-hidden transition-[height] duration-300 ease-in-out"
                style={{
                  height: isSubmenuOpen
                    ? `${subMenuHeight[`${menuType}-${index}`] ?? 0}px`
                    : "0px",
                }}
              >
                <ul className="mt-1 ml-8 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        to={subItem.path}
                        className={`
                          flex items-center justify-between px-3 py-2 rounded-md text-sm
                          transition-colors duration-150
                          ${
                            isActive(subItem.path)
                              ? "text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-500/10"
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }
                        `}
                      >
                        <span>{subItem.name}</span>

                        {/* Badges */}
                        <span className="flex items-center gap-1 ml-2">
                          {subItem.new && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                              new
                            </span>
                          )}
                          {subItem.pro && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                              pro
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  // ── Skeleton while permissions load ──────────────────────────────────────

  if (!permissionsLoaded) {
    return (
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-[width] duration-300 ease-in-out
          ${isExpanded || isMobileOpen ? "w-[256px]" : isHovered ? "w-[256px]" : "w-[64px]"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        `}
      >
        <div className="p-4 flex justify-center border-b border-gray-200 dark:border-gray-800">
          <div className="w-28 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        </div>
        <div className="p-3 flex flex-col gap-2 mt-2">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-50 flex flex-col
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-[width] duration-300 ease-in-out
        ${isExpanded || isMobileOpen ? "w-[256px]" : isHovered ? "w-[256px]" : "w-[64px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 flex items-center h-16 px-4
          border-b border-gray-200 dark:border-gray-800
          ${!isOpen ? "lg:justify-center" : "justify-start"}
        `}
      >
        <Link to="/" className="block">
          {isOpen ? (
            <>
              <img
                className="dark:hidden h-8"
                src="/images/logo/logo.svg"
                alt="Logo"
              />
              <img
                className="hidden dark:block h-8"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              className="w-8 h-8"
            />
          )}
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
        {filteredNavItems.length > 0 ? (
          renderMenuItems(filteredNavItems, "main")
        ) : (
          <p className="text-xs text-gray-400 px-3 py-2">No menu access</p>
        )}
      </nav>
    </aside>
  );
};

export default AppSidebar;
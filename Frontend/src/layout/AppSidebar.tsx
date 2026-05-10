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

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

// ─── Full Static Menu Definition ─────────────────────────────────────────────
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/home",
  },
  {
    name: "Test Repository",
    icon: <ListIcon />,
    subItems: [
      { name: "Projects", path: "/projects", pro: false },
      { name: "Test Suites", path: "/test-suites", pro: false },
      { name: "Test Cases", path: "/test-cases", pro: false },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Tasks",
    path: "/tasks",
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  },
  
  {
    name: "Reports",
    icon: <ListIcon />,
    subItems: [
      { name: "User Reports", path: "/reports/users", pro: false },
      { name: "Task Reports", path: "/reports/tasks", pro: false },
    ],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  },
  {
    name: "System Configuration",
    icon: <ListIcon />,
    subItems: [
      { name: "User Management", path: "/users", pro: false },
      { name: "Roles", path: "/roles", pro: false },
      { name: "Departments", path: "/departments", pro: false },
      { name: "Teams", path: "/teams", pro: false },
    ],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "Blank Page", path: "/blank", pro: false },
      { name: "404 Error", path: "/error-404", pro: false },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart", pro: false },
      { name: "Bar Chart", path: "/bar-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts", pro: false },
      { name: "Avatar", path: "/avatars", pro: false },
      { name: "Badge", path: "/badge", pro: false },
      { name: "Buttons", path: "/buttons", pro: false },
      { name: "Images", path: "/images", pro: false },
      { name: "Videos", path: "/videos", pro: false },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
    ],
  },
];

// ─── Permission Type ──────────────────────────────────────────────────────────
interface UserPermission {
  menu_name: string;
  path: string;
}

// ─── Filter menus based on allowed paths ─────────────────────────────────────
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
        const filteredSubs = item.subItems.filter((sub) =>
          allowedPaths.has(sub.path),
        );
        if (filteredSubs.length === 0) return null;
        return { ...item, subItems: filteredSubs };
      }
      return null;
    })
    .filter(Boolean) as NavItem[];
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  // ─── Permissions State ──────────────────────────────────────────────────
  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);

  // ─── Submenu State ──────────────────────────────────────────────────────
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Derived: sidebar is visually open
  const isOpen = isExpanded || isHovered || isMobileOpen;

  // ─── Load Permissions on Mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await API.get("/api/roles/my-permissions");
        const data: UserPermission[] = res.data?.data ?? res.data;
        if (Array.isArray(data)) {
          const paths = new Set(data.map((p) => p.path));
          setAllowedPaths(paths);
        } else {
          setAllowedPaths(null);
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
        setAllowedPaths(null);
      } finally {
        setPermissionsLoaded(true);
      }
    };
    fetchPermissions();
  }, []);

  // ─── Compute filtered menus ─────────────────────────────────────────────
  const filteredNavItems =
    allowedPaths === null
      ? navItems
      : filterMenuByPermissions(navItems, allowedPaths);

  const filteredOthersItems =
    allowedPaths === null
      ? othersItems
      : filterMenuByPermissions(othersItems, allowedPaths);

  // ─── Active Helpers ─────────────────────────────────────────────────────
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  const isParentActive = useCallback(
    (nav: NavItem) => {
      if (!nav.subItems) return false;
      return nav.subItems.some((subItem) =>
        location.pathname.startsWith(subItem.path),
      );
    },
    [location.pathname],
  );

  // ─── Auto open submenu based on current path ────────────────────────────
  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items =
        menuType === "main" ? filteredNavItems : filteredOthersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (location.pathname.startsWith(subItem.path)) {
              setOpenSubmenu({ type: menuType as "main" | "others", index });
              submenuMatched = true;
            }
          });
        }
      });
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, permissionsLoaded]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  // ─── Render Menu Items ──────────────────────────────────────────────────
  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`flex items-center w-full gap-3 px-3 py-2 rounded-lg text-[15px] font-medium transition-all duration-200 group ${
                isParentActive(nav) ||
                (openSubmenu?.type === menuType && openSubmenu?.index === index)
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer justify-start`}
            >
              <span
                className={`menu-item-icon-size ${
                  isParentActive(nav) ||
                  (openSubmenu?.type === menuType &&
                    openSubmenu?.index === index)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>

              {isOpen && (
                <span className="text-[15px] font-medium text-left ">
                  {nav.name}
                </span>
              )}

              {isOpen && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] font-medium transition-all duration-200 group justify-start ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>

                {isOpen && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}

          {nav.subItems && isOpen && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 ml-6 space-y-1">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`flex items-center px-3 py-2 rounded-md text-[14px] font-medium transition-colors ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
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
      ))}
    </ul>
  );

  // ─── Skeleton Loader while permissions load ─────────────────────────────
  if (!permissionsLoaded) {
    return (
      <aside
        className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-[width] duration-300 ease-in-out z-50 border-r border-gray-200
          ${isExpanded || isMobileOpen ? "w-[256px] px-4" : isHovered ? "w-[256px] px-4" : "w-[64px] px-2"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        <div className="py-8 flex justify-center">
          <div className="w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex flex-col gap-3 mt-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-[width] duration-300 ease-in-out z-50 border-r border-gray-200
        ${
          isExpanded || isMobileOpen
            ? "w-[256px] px-4"
            : isHovered
              ? "w-[256px] px-4"
              : "w-[64px] px-2"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo — centred when rail, left-aligned when expanded */}
      <div
        className={`py-5 flex ${!isOpen ? "lg:justify-center" : "justify-start"}`}
      >
        <Link to="/">
          {isOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              {/* <h2 className="mb-4 text-xs uppercase flex leading-[20px] text-gray-400">
                {isOpen ? "Menu" : <HorizontaLDots className="size-6" />}
              </h2> */}
              {filteredNavItems.length > 0 ? (
                renderMenuItems(filteredNavItems, "main")
              ) : (
                <p className="text-xs text-gray-400 px-2">No menu access</p>
              )}
            </div>

            {/* <div>
              <h2 className="mb-4 text-xs uppercase flex leading-[20px] text-gray-400">
                {isOpen ? "Others" : <HorizontaLDots />}
              </h2>
              {filteredOthersItems.length > 0 ? (
                renderMenuItems(filteredOthersItems, "others")
              ) : (
                <p className="text-xs text-gray-400 px-2">No access</p>
              )}
            </div> */}
          </div>
        </nav>

        {/* {isOpen ? <SidebarWidget /> : null} */}
      </div>
    </aside>
  );
};

export default AppSidebar;

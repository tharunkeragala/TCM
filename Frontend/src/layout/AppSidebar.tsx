import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import API from "../services/api";

import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

// ─── Full Static Menu Definition ─────────────────────────────────────────────
// "path" here must match exactly what's stored in your menus.path column
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/home",
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
    name: "System Configuration",
    icon: <ListIcon />,
    subItems: [
      { name: "User Management", path: "/users", pro: false },
      { name: "Roles", path: "/roles", pro: false },
      { name: "Departments", path: "/departments", pro: false },
    ],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
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
  allowedPaths: Set<string>
): NavItem[] {
  return items
    .map((item) => {
      // Top-level direct link
      if (item.path) {
        return allowedPaths.has(item.path) ? item : null;
      }

      // Parent with subItems — filter subItems
      if (item.subItems) {
        const filteredSubs = item.subItems.filter((sub) =>
          allowedPaths.has(sub.path)
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
  const [allowedPaths, setAllowedPaths]     = useState<Set<string> | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);

  // ─── Submenu State ──────────────────────────────────────────────────────
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
          // If response is unexpected, show all menus
          setAllowedPaths(null);
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
        // On error, fall back to showing all menus
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
      ? navItems // no restriction — show all
      : filterMenuByPermissions(navItems, allowedPaths);

  const filteredOthersItems =
    allowedPaths === null
      ? othersItems
      : filterMenuByPermissions(othersItems, allowedPaths);

  // ─── Active Helpers ─────────────────────────────────────────────────────
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const isParentActive = useCallback(
    (nav: NavItem) => {
      if (!nav.subItems) return false;
      return nav.subItems.some((subItem) =>
        location.pathname.startsWith(subItem.path)
      );
    },
    [location.pathname]
  );

  // ─── Auto open submenu based on current path ────────────────────────────
  useEffect(() => {
    let submenuMatched = false;

    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? filteredNavItems : filteredOthersItems;

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
              className={`menu-item group ${
                isParentActive(nav) ||
                (openSubmenu?.type === menuType && openSubmenu?.index === index)
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size ${
                  isParentActive(nav) ||
                  (openSubmenu?.type === menuType && openSubmenu?.index === index)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>

              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}

              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
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
                className={`menu-item group ${
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

                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}

          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
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
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
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
        className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
          ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        <div className="py-8 flex justify-center">
          <div className="w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex flex-col gap-4 px-2 mt-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
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
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2> */}
              {filteredNavItems.length > 0 ? (
                renderMenuItems(filteredNavItems, "main")
              ) : (
                <p className="text-xs text-gray-400 px-2">No menu access</p>
              )}
            </div>

            {/* <div>
              <h2 className="mb-4 text-xs uppercase flex leading-[20px] text-gray-400">
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {filteredOthersItems.length > 0 ? (
                renderMenuItems(filteredOthersItems, "others")
              ) : (
                <p className="text-xs text-gray-400 px-2">No access</p>
              )}
            </div> */}

          </div>
        </nav>

        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
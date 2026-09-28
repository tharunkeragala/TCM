import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import { FaChevronDown } from "react-icons/fa";

import API from "../services/api";

import { useSidebar } from "../context/SidebarContext";

import { getMenuIcon } from "../config/menuIcons";

import type { MenuItem, UserPermission } from "../types/menu";

/* ============================================================
   HELPERS
   ============================================================ */

const normalizePermissionPath = (path?: string | null) => {
  if (!path) {
    return null;
  }

  return path.trim();
};

/* ============================================================
   FILTER MENU TREE BY PERMISSION
   ============================================================ */

const filterMenuTreeByPermissions = (
  menus: MenuItem[],
  allowedPaths: Set<string> | null,
): MenuItem[] => {
  if (allowedPaths === null) {
    return menus;
  }

  return menus
    .map((menu) => {
      const children = filterMenuTreeByPermissions(
        menu.children || [],
        allowedPaths,
      );

      const path = normalizePermissionPath(menu.path);

      const ownAllowed =
        !path ||
        menu.menu_type === "group" ||
        menu.menu_type === "heading" ||
        allowedPaths.has(path);

      /*
       * Parent/group stays visible if
       * at least one permitted child exists.
       */
      if (children.length > 0) {
        return {
          ...menu,
          children,
        };
      }

      /*
       * Normal menu / external link.
       */
      if (ownAllowed && path) {
        return {
          ...menu,
          children: [],
        };
      }

      /*
       * Empty heading or group.
       */
      if (
        ownAllowed &&
        !path &&
        (menu.menu_type === "heading" || menu.menu_type === "group")
      ) {
        return {
          ...menu,
          children: [],
        };
      }

      return null;
    })
    .filter(Boolean) as MenuItem[];
};

/* ============================================================
   FIND MENU
   ============================================================ */

const findMenuById = (menus: MenuItem[], id: number): MenuItem | null => {
  for (const menu of menus) {
    if (menu.id === id) {
      return menu;
    }

    const found = findMenuById(menu.children || [], id);

    if (found) {
      return found;
    }
  }

  return null;
};

/* ============================================================
   FIND PARENT
   ============================================================ */

const findParentMenu = (
  menus: MenuItem[],
  childId: number,
): MenuItem | null => {
  for (const menu of menus) {
    const children = menu.children || [];

    if (children.some((child) => child.id === childId)) {
      return menu;
    }

    const found = findParentMenu(children, childId);

    if (found) {
      return found;
    }
  }

  return null;
};

/* ============================================================
   GET DESCENDANT IDS
   ============================================================ */

const getDescendantIds = (menu: MenuItem): number[] => {
  const ids: number[] = [];

  const walk = (item: MenuItem) => {
    (item.children || []).forEach((child) => {
      ids.push(child.id);

      walk(child);
    });
  };

  walk(menu);

  return ids;
};

/* ============================================================
   GET SIBLING IDS
   ============================================================ */

const getSiblingIds = (menus: MenuItem[], id: number): number[] => {
  const parent = findParentMenu(menus, id);

  /*
   * Root menu.
   */
  if (!parent) {
    return menus.map((item) => item.id);
  }

  /*
   * Nested menu.
   */
  return (parent.children || []).map((item) => item.id);
};

/* ============================================================
   APP SIDEBAR
   ============================================================ */

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();

  const location = useLocation();

  const [menus, setMenus] = useState<MenuItem[]>([]);

  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);

  const [loading, setLoading] = useState(true);

  /*
   * A Set is still useful because
   * nested active parent chains may
   * contain several open IDs.
   *
   * Accordion logic controls siblings.
   */
  const [openMenus, setOpenMenus] = useState<Set<number>>(new Set());

  const isOpen = isExpanded || isHovered || isMobileOpen;

  /* ==========================================================
     LOAD NAVIGATION
     ========================================================== */

  const loadNavigation = useCallback(async () => {
    setLoading(true);

    try {
      const [menuResponse, permissionResponse] = await Promise.all([
        API.get("/api/menus/navigation"),

        API.get("/api/roles/my-permissions"),
      ]);

      /* -----------------------------------------------
           MENU DATA
           ----------------------------------------------- */

      const menuData = menuResponse.data?.data ?? [];

      setMenus(Array.isArray(menuData) ? menuData : []);

      /* -----------------------------------------------
           PERMISSION DATA
           ----------------------------------------------- */

      const permissionData: UserPermission[] =
        permissionResponse.data?.data ?? permissionResponse.data ?? [];

      if (Array.isArray(permissionData)) {
        const paths = permissionData
          .filter(
            (permission) =>
              Boolean(permission.path) && permission.can_view !== false,
          )
          .map((permission) => permission.path);

        setAllowedPaths(new Set(paths));
      } else {
        setAllowedPaths(null);
      }
    } catch (error) {
      console.error("Failed to load sidebar:", error);

      setMenus([]);

      setAllowedPaths(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNavigation();
  }, [loadNavigation]);

  /* ==========================================================
     FILTERED MENUS
     ========================================================== */

  const filteredMenus = useMemo(
    () => filterMenuTreeByPermissions(menus, allowedPaths),
    [menus, allowedPaths],
  );

  /* ==========================================================
     ACTIVE PATH
     ========================================================== */

  const isActive = useCallback(
    (path?: string | null) => {
      if (!path) {
        return false;
      }

      return (
        location.pathname === path || location.pathname.startsWith(`${path}/`)
      );
    },
    [location.pathname],
  );

  /* ==========================================================
     CHECK ACTIVE CHILD
     ========================================================== */

  const containsActiveChild = useCallback(
    (menu: MenuItem): boolean => {
      if (isActive(menu.path)) {
        return true;
      }

      return (menu.children || []).some(containsActiveChild);
    },
    [isActive],
  );

  /* ==========================================================
     AUTO OPEN ACTIVE PARENT CHAIN
     ========================================================== */

  useEffect(() => {
    const activeChain = new Set<number>();

    const walk = (items: MenuItem[], parents: number[] = []) => {
      items.forEach((item) => {
        const itemIsActive = containsActiveChild(item);

        if (itemIsActive) {
          parents.forEach((parentId) => {
            activeChain.add(parentId);
          });

          if ((item.children || []).length > 0) {
            activeChain.add(item.id);
          }
        }

        walk(item.children || [], [...parents, item.id]);
      });
    };

    walk(filteredMenus);

    /*
     * Important:
     * when route changes, only keep
     * the active hierarchy expanded.
     *
     * This prevents previously opened
     * unrelated menus from remaining open.
     */
    if (activeChain.size > 0) {
      setOpenMenus(activeChain);
    }
  }, [filteredMenus, location.pathname, containsActiveChild]);

  /* ==========================================================
     ACCORDION TOGGLE
     ========================================================== */

  const toggleMenu = (id: number) => {
    setOpenMenus((previous) => {
      const next = new Set(previous);

      const selectedMenu = findMenuById(filteredMenus, id);

      if (!selectedMenu) {
        return next;
      }

      /* --------------------------------------------------
           MENU ALREADY OPEN
           -------------------------------------------------- */

      if (next.has(id)) {
        /*
         * Close current menu.
         */
        next.delete(id);

        /*
         * Also close all descendants.
         */
        getDescendantIds(selectedMenu).forEach((descendantId) => {
          next.delete(descendantId);
        });

        return next;
      }

      /* --------------------------------------------------
           FIND SIBLINGS
           -------------------------------------------------- */

      const siblingIds = getSiblingIds(filteredMenus, id);

      /*
       * Close every sibling.
       */
      siblingIds.forEach((siblingId) => {
        if (siblingId === id) {
          return;
        }

        next.delete(siblingId);

        const siblingMenu = findMenuById(filteredMenus, siblingId);

        if (siblingMenu) {
          /*
           * Collapse all nested menus
           * inside that sibling as well.
           */
          getDescendantIds(siblingMenu).forEach((descendantId) => {
            next.delete(descendantId);
          });
        }
      });

      /*
       * Finally open selected menu.
       */
      next.add(id);

      return next;
    });
  };

  /* ==========================================================
     STANDARD MENU ICON
     ========================================================== */

  const renderMenuIcon = (menu: MenuItem, active = false) => {
    const Icon = getMenuIcon(menu.icon);

    return (
      <span
        className={`
          flex
          h-5
          w-5
          min-h-5
          min-w-5
          flex-shrink-0
          items-center
          justify-center

          ${active ? "text-white" : "text-slate-400"}
        `}
      >
        <Icon
          className="
            block
            h-[15px]
            w-[15px]
            flex-shrink-0
          "
        />
      </span>
    );
  };

  /* ==========================================================
     ITEM PADDING
     ========================================================== */

  const getItemPadding = (level: number) => {
    if (level === 0) {
      return "px-3";
    }

    if (level === 1) {
      return "pl-3 pr-2";
    }

    if (level === 2) {
      return "pl-4 pr-2";
    }

    return "pl-5 pr-2";
  };

  /* ==========================================================
     RENDER MENU ITEM
     ========================================================== */

  const renderMenuItem = (menu: MenuItem, level = 0): React.ReactNode => {
    const children = menu.children || [];

    const hasChildren = children.length > 0;

    const expanded = openMenus.has(menu.id);

    const active = isActive(menu.path);

    const childActive = containsActiveChild(menu);

    const itemActive = active || childActive;

    const itemPadding = getItemPadding(level);

    /* --------------------------------------------------------
       HEADING
       -------------------------------------------------------- */

    if (menu.menu_type === "heading") {
      if (!isOpen) {
        return null;
      }

      return (
        <li
          key={menu.id}
          className="
            px-3
            pt-4
            pb-1.5
          "
        >
          <span
            className="
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.08em]
              text-slate-500
            "
          >
            {menu.menu_name}
          </span>
        </li>
      );
    }

    /* --------------------------------------------------------
       PARENT / GROUP
       -------------------------------------------------------- */

    if (hasChildren) {
      return (
        <li key={menu.id} className="w-full">
          <button
            type="button"
            onClick={() => toggleMenu(menu.id)}
            title={!isOpen ? menu.menu_name : undefined}
            className={`
              flex
              h-10
              w-full
              items-center
              gap-2.5
              ${itemPadding}

              rounded-lg

              text-sm
              font-medium

              transition-colors
              duration-150

              ${
                itemActive
                  ? `
                    bg-white/10
                    text-white
                  `
                  : `
                    text-slate-300
                    hover:bg-white/10
                    hover:text-white
                  `
              }

              ${!isOpen ? "justify-center px-0" : ""}
            `}
          >
            {renderMenuIcon(menu, itemActive)}

            {isOpen && (
              <>
                <span
                  className="
                    min-w-0
                    flex-1
                    truncate
                    text-left
                    leading-none
                  "
                >
                  {menu.menu_name}
                </span>

                <FaChevronDown
                  className={`
                    h-3
                    w-3
                    flex-shrink-0

                    text-slate-500

                    transition-transform
                    duration-200

                    ${expanded ? "rotate-180" : ""}
                  `}
                />
              </>
            )}
          </button>

          {/* -----------------------------------------------
              CHILDREN
              ----------------------------------------------- */}

          {isOpen && (
            <div
              className={`
                overflow-hidden

                transition-all
                duration-200

                ${
                  expanded
                    ? `
                      max-h-[1400px]
                      opacity-100
                    `
                    : `
                      max-h-0
                      opacity-0
                    `
                }
              `}
            >
              <ul
                className={`
                  mt-1
                  space-y-0.5

                  ${
                    level === 0
                      ? `
                        ml-[18px]
                        border-l
                        border-white/10
                        pl-2
                      `
                      : `
                        ml-3
                        border-l
                        border-white/10
                        pl-2
                      `
                  }
                `}
              >
                {children.map((child) => renderMenuItem(child, level + 1))}
              </ul>
            </div>
          )}
        </li>
      );
    }

    /* --------------------------------------------------------
       GROUP WITHOUT CHILDREN
       -------------------------------------------------------- */

    if (!menu.path) {
      return null;
    }

    /* --------------------------------------------------------
       EXTERNAL LINK
       -------------------------------------------------------- */

    if (menu.menu_type === "external") {
      return (
        <li key={menu.id} className="w-full">
          <a
            href={menu.path}
            target={menu.open_in_new_tab ? "_blank" : undefined}
            rel={menu.open_in_new_tab ? "noreferrer" : undefined}
            title={!isOpen ? menu.menu_name : undefined}
            className={`
              flex
              h-10
              w-full
              items-center
              gap-2.5
              ${itemPadding}

              rounded-lg

              text-sm
              font-medium

              text-slate-300

              transition-colors
              duration-150

              hover:bg-white/10
              hover:text-white

              ${!isOpen ? "justify-center px-0" : ""}
            `}
          >
            {renderMenuIcon(menu, false)}

            {isOpen && (
              <span
                className="
                  min-w-0
                  flex-1
                  truncate
                  leading-none
                "
              >
                {menu.menu_name}
              </span>
            )}
          </a>
        </li>
      );
    }

    /* --------------------------------------------------------
       NORMAL LINK
       -------------------------------------------------------- */

    return (
      <li key={menu.id} className="w-full">
        <Link
          to={menu.path}
          title={!isOpen ? menu.menu_name : undefined}
          className={`
            flex
            h-10
            w-full
            items-center
            gap-2.5
            ${itemPadding}

            rounded-lg

            text-sm
            font-medium

            transition-colors
            duration-150

            ${
              active
                ? `
                  bg-white/10
                  text-white
                `
                : `
                  text-slate-300
                  hover:bg-white/10
                  hover:text-white
                `
            }

            ${!isOpen ? "justify-center px-0" : ""}
          `}
        >
          {renderMenuIcon(menu, active)}

          {isOpen && (
            <span
              className="
                min-w-0
                flex-1
                truncate
                leading-none
              "
            >
              {menu.menu_name}
            </span>
          )}
        </Link>
      </li>
    );
  };

  /* ==========================================================
     UI
     ========================================================== */

  return (
    <aside
      className={`
        fixed
        top-0
        left-0

        z-50

        flex
        h-screen
        flex-col

        border-r
        border-[#0a0e7a]

        bg-[#00013D]

        transition-[width,transform]
        duration-300
        ease-in-out

        dark:border-gray-800
        dark:bg-gray-900

        ${
          isExpanded || isMobileOpen
            ? "w-[256px]"
            : isHovered
              ? "w-[256px]"
              : "w-[64px]"
        }

        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}

        lg:translate-x-0
      `}
      onMouseEnter={() => {
        if (!isExpanded) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {/* ======================================================
          LOGO
          ====================================================== */}

      <div
        className={`
          flex
          h-16
          flex-shrink-0
          items-center

          border-b
          border-[#0a0e7a]

          dark:border-gray-800

          ${isOpen ? "justify-start px-4" : "justify-center px-0"}
        `}
      >
        <Link
          to="/"
          className="
            flex
            items-center
            justify-center
          "
        >
          {isOpen ? (
            <img
              className="
                h-8
                w-auto
                max-w-[180px]
                object-contain
              "
              src="/images/logo/logo-dark.svg"
              alt="Logo"
            />
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              className="
                h-8
                w-8
                object-contain
              "
            />
          )}
        </Link>
      </div>

      {/* ======================================================
          NAVIGATION
          ====================================================== */}

      <nav
        className={`
          flex-1
          overflow-y-auto
          no-scrollbar

          py-4

          ${isOpen ? "px-3" : "px-2"}
        `}
      >
        {loading ? (
          /* ==================================================
             LOADING
             ================================================== */

          <div className="space-y-2">
            {[...Array(7)].map((_, index) => (
              <div
                key={index}
                className="
                    h-10
                    rounded-lg

                    bg-[#0a0e7a]

                    animate-pulse

                    dark:bg-gray-800
                  "
              />
            ))}
          </div>
        ) : filteredMenus.length ? (
          /* ==================================================
             MENU
             ================================================== */

          <ul
            className="
              flex
              flex-col
              gap-0.5
            "
          >
            {filteredMenus.map((menu) => renderMenuItem(menu))}
          </ul>
        ) : (
          /* ==================================================
             EMPTY
             ================================================== */

          isOpen && (
            <div
              className="
                px-3
                py-6
                text-center
              "
            >
              <p
                className="
                  text-xs
                  text-slate-400
                "
              >
                No menu access
              </p>
            </div>
          )
        )}
      </nav>
    </aside>
  );
};

export default AppSidebar;

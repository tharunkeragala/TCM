import { useEffect, useMemo, useState } from "react";

import {
  FaArrowDown,
  FaArrowUp,
  FaChevronDown,
  FaChevronRight,
  FaEdit,
  FaEye,
  FaEyeSlash,
  FaPlus,
  FaSearch,
  FaSitemap,
  FaTrash,
} from "react-icons/fa";

import API from "../../services/api";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Alert from "../../components/ui/alert/Alert";

import { availableMenuIcons, getMenuIcon } from "../../config/menuIcons";

import type { MenuItem, MenuType } from "../../types/menu";

/* ============================================================
   TYPES
   ============================================================ */

type ViewMode = "tree" | "table";

interface MenuForm {
  menu_name: string;
  menu_key: string;
  parent_id: string;
  path: string;
  icon: string;
  menu_type: MenuType;
  supported_permissions: string[];
  display_order: number;
  is_active: boolean;
  is_visible: boolean;
  description: string;
  open_in_new_tab: boolean;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const PERMISSIONS = ["view", "create", "edit", "delete"];

const INPUT_CLASS = `
  w-full
  rounded-lg
  border
  border-gray-300
  bg-white
  px-3
  py-2
  text-sm
  text-gray-900
  placeholder:text-gray-400
  transition-colors
  focus:border-blue-500
  focus:outline-none
  focus:ring-2
  focus:ring-blue-500/20

  disabled:cursor-not-allowed
  disabled:bg-gray-100
  disabled:text-gray-500

  dark:border-gray-600
  dark:bg-gray-800
  dark:text-gray-100
  dark:placeholder:text-gray-500
  dark:focus:border-blue-500

  dark:disabled:bg-gray-800/50
  dark:disabled:text-gray-500
`;

const LABEL_CLASS = `
  mb-1
  block
  text-sm
  font-medium
  text-gray-700
  dark:text-gray-300
`;

const SECONDARY_BUTTON_CLASS = `
  rounded-lg
  bg-gray-100
  px-4
  py-2
  text-sm
  font-medium
  text-gray-700
  transition-colors
  hover:bg-gray-200

  dark:bg-gray-700
  dark:text-gray-200
  dark:hover:bg-gray-600
`;

const CHECKBOX_CARD_CLASS = `
  flex
  items-center
  gap-2
  rounded-lg
  border
  border-gray-200
  bg-white
  p-3
  text-sm
  text-gray-700
  transition-colors

  hover:bg-gray-50

  dark:border-gray-700
  dark:bg-gray-800
  dark:text-gray-300
  dark:hover:bg-gray-700/70
`;

const CHECKBOX_CLASS = `
  h-4
  w-4
  rounded
  border-gray-300
  text-blue-600
  focus:ring-blue-500

  dark:border-gray-600
  dark:bg-gray-700
`;

/* ============================================================
   FORM
   ============================================================ */

const emptyForm = (): MenuForm => ({
  menu_name: "",
  menu_key: "",
  parent_id: "",
  path: "",
  icon: "FaList",
  menu_type: "menu",
  supported_permissions: ["view"],
  display_order: 10,
  is_active: true,
  is_visible: true,
  description: "",
  open_in_new_tab: false,
});

/* ============================================================
   HELPERS
   ============================================================ */

const normalizeMenuKey = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const flattenMenus = (
  menus: MenuItem[],
  level = 0,
): Array<MenuItem & { level: number }> => {
  const output: Array<MenuItem & { level: number }> = [];

  menus.forEach((menu) => {
    output.push({
      ...menu,
      level,
    });

    output.push(...flattenMenus(menu.children || [], level + 1));
  });

  return output;
};

/* ============================================================
   COMPONENT
   ============================================================ */

export default function MenuManagement() {
  /* ==========================================================
     STATE
     ========================================================== */

  const [menus, setMenus] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("tree");

  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [showModal, setShowModal] = useState(false);

  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  const [form, setForm] = useState<MenuForm>(emptyForm());

  const [saving, setSaving] = useState(false);

  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  const [deleting, setDeleting] = useState(false);

  /* ==========================================================
     LOAD MENUS
     ========================================================== */

  const loadMenus = async () => {
    setLoading(true);

    try {
      const response = await API.get("/api/menus/tree");

      const data = response.data?.data || [];

      const safeMenus: MenuItem[] = Array.isArray(data) ? data : [];

      setMenus(safeMenus);

      const allIds = flattenMenus(safeMenus)
        .filter((item) => (item.children?.length || 0) > 0)
        .map((item) => item.id);

      setExpanded(new Set(allIds));
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to load menus.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  /* ==========================================================
     ESC CLOSE
     ========================================================== */

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }

      if (showModal) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [showModal, deleteTarget]);

  /* ==========================================================
     FLATTEN / SEARCH
     ========================================================== */

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);

  const filteredFlatMenus = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return flatMenus;
    }

    return flatMenus.filter(
      (menu) =>
        menu.menu_name.toLowerCase().includes(query) ||
        menu.menu_key.toLowerCase().includes(query) ||
        (menu.path || "").toLowerCase().includes(query) ||
        (menu.description || "").toLowerCase().includes(query),
    );
  }, [flatMenus, search]);

  /* ==========================================================
     CREATE
     ========================================================== */

  const openCreate = (parentId?: number) => {
    setEditingMenu(null);

    setForm({
      ...emptyForm(),

      parent_id: parentId ? String(parentId) : "",
    });

    setAlert(null);
    setShowModal(true);
  };

  /* ==========================================================
     EDIT
     ========================================================== */

  const openEdit = (menu: MenuItem) => {
    setEditingMenu(menu);

    setForm({
      menu_name: menu.menu_name || "",

      menu_key: menu.menu_key || "",

      parent_id: menu.parent_id ? String(menu.parent_id) : "",

      path: menu.path || "",

      icon: menu.icon || "FaList",

      menu_type: menu.menu_type || "menu",

      supported_permissions: (menu.supported_permissions || "view")
        .split(",")
        .map((permission) => permission.trim())
        .filter(Boolean),

      display_order: menu.display_order || 0,

      is_active: menu.is_active,

      is_visible: menu.is_visible,

      description: menu.description || "",

      open_in_new_tab: menu.open_in_new_tab,
    });

    setAlert(null);
    setShowModal(true);
  };

  /* ==========================================================
     CLOSE MODAL
     ========================================================== */

  const closeModal = () => {
    setShowModal(false);
    setEditingMenu(null);
    setForm(emptyForm());
    setSaving(false);
  };

  /* ==========================================================
     PERMISSION TOGGLE
     ========================================================== */

  const togglePermission = (permission: string) => {
    setForm((previous) => {
      const exists = previous.supported_permissions.includes(permission);

      return {
        ...previous,

        supported_permissions: exists
          ? previous.supported_permissions.filter((item) => item !== permission)
          : [...previous.supported_permissions, permission],
      };
    });
  };

  /* ==========================================================
     MENU NAME
     ========================================================== */

  const handleMenuNameChange = (value: string) => {
    setForm((previous) => ({
      ...previous,

      menu_name: value,

      menu_key: editingMenu ? previous.menu_key : normalizeMenuKey(value),
    }));
  };

  /* ==========================================================
     SAVE
     ========================================================== */

  const saveMenu = async () => {
    if (!form.menu_name.trim()) {
      setAlert({
        type: "error",
        message: "Menu name is required.",
      });

      return;
    }

    if (!form.menu_key.trim()) {
      setAlert({
        type: "error",
        message: "Menu key is required.",
      });

      return;
    }

    if (form.menu_type === "menu" && !form.path.trim()) {
      setAlert({
        type: "error",
        message: "Path is required for menu items.",
      });

      return;
    }

    if (form.menu_type === "external" && !form.path.trim()) {
      setAlert({
        type: "error",
        message: "URL is required for external menu items.",
      });

      return;
    }

    if (!form.supported_permissions.length) {
      setAlert({
        type: "error",
        message: "Select at least one supported permission.",
      });

      return;
    }

    setSaving(true);
    setAlert(null);

    try {
      const payload = {
        ...form,

        parent_id: form.parent_id ? Number(form.parent_id) : null,

        display_order: Number(form.display_order) || 0,

        supported_permissions: form.supported_permissions,

        path:
          form.menu_type === "group" || form.menu_type === "heading"
            ? ""
            : form.path,
      };

      const wasEditing = Boolean(editingMenu);

      if (editingMenu) {
        await API.put(`/api/menus/${editingMenu.id}`, payload);
      } else {
        await API.post("/api/menus/create", payload);
      }

      closeModal();

      await loadMenus();

      setAlert({
        type: "success",
        message: wasEditing
          ? "Menu updated successfully."
          : "Menu created successfully.",
      });
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to save menu.",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     ACTIVE / DISABLED
     ========================================================== */

  const toggleActive = async (menu: MenuItem) => {
    try {
      await API.put(`/api/menus/${menu.id}/toggle-active`);

      await loadMenus();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to update menu status.",
      });
    }
  };

  /* ==========================================================
     DELETE
     ========================================================== */

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await API.delete(`/api/menus/${deleteTarget.id}`);

      setDeleteTarget(null);

      await loadMenus();

      setAlert({
        type: "success",
        message: "Menu deleted successfully.",
      });
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete menu.",
      });
    } finally {
      setDeleting(false);
    }
  };

  /* ==========================================================
     MOVE / REORDER
     ========================================================== */

  const moveMenu = async (menu: MenuItem, direction: "up" | "down") => {
    const siblings = flatMenus
      .filter((item) => item.parent_id === menu.parent_id)
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          a.menu_name.localeCompare(b.menu_name),
      );

    const index = siblings.findIndex((item) => item.id === menu.id);

    if (index < 0) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }

    const reordered = [...siblings];

    const [moved] = reordered.splice(index, 1);

    reordered.splice(targetIndex, 0, moved);

    const items = reordered.map((item, itemIndex) => ({
      id: item.id,

      parent_id: item.parent_id,

      display_order: (itemIndex + 1) * 10,
    }));

    try {
      await API.put("/api/menus/reorder", {
        items,
      });

      await loadMenus();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to reorder menus.",
      });
    }
  };

  /* ==========================================================
     EXPAND / COLLAPSE
     ========================================================== */

  const toggleExpanded = (id: number) => {
    setExpanded((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  /* ==========================================================
     TREE NODE
     ========================================================== */

  const renderTreeNode = (menu: MenuItem, level = 0): React.ReactNode => {
    const Icon = getMenuIcon(menu.icon);

    const children = menu.children || [];

    const opened = expanded.has(menu.id);

    return (
      <div key={menu.id}>
        <div
          className="
            group
            flex
            min-h-[58px]
            items-center
            gap-3
            border-b
            border-gray-100
            px-3
            transition-colors
            hover:bg-gray-50

            dark:border-gray-800
            dark:hover:bg-gray-800/60
          "
          style={{
            paddingLeft: 12 + level * 28,
          }}
        >
          {/* Expand */}
          <button
            type="button"
            onClick={() => toggleExpanded(menu.id)}
            disabled={!children.length}
            className="
              flex
              h-7
              w-7
              flex-shrink-0
              items-center
              justify-center
              rounded-md
              text-gray-400
              transition-colors

              hover:bg-gray-100
              hover:text-gray-700

              disabled:cursor-default
              disabled:hover:bg-transparent

              dark:text-gray-500
              dark:hover:bg-gray-700
              dark:hover:text-gray-200
            "
          >
            {children.length ? (
              opened ? (
                <FaChevronDown className="h-3 w-3" />
              ) : (
                <FaChevronRight className="h-3 w-3" />
              )
            ) : null}
          </button>

          {/* Icon */}
          <div
            className="
              flex
              h-8
              w-8
              flex-shrink-0
              items-center
              justify-center
              rounded-lg
              bg-gray-100
              text-gray-600

              dark:bg-gray-800
              dark:text-gray-300
            "
          >
            <Icon className="h-4 w-4" />
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {menu.menu_name}
              </span>

              <span
                className="
                  rounded-md
                  bg-gray-100
                  px-1.5
                  py-0.5
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-wide
                  text-gray-500

                  dark:bg-gray-800
                  dark:text-gray-400
                "
              >
                {menu.menu_type}
              </span>

              {!menu.is_visible && (
                <span
                  className="
                    rounded-md
                    bg-amber-50
                    px-1.5
                    py-0.5
                    text-[10px]
                    font-medium
                    text-amber-700

                    dark:bg-amber-900/20
                    dark:text-amber-300
                  "
                >
                  Hidden
                </span>
              )}

              {!menu.is_active && (
                <span
                  className="
                    rounded-md
                    bg-red-50
                    px-1.5
                    py-0.5
                    text-[10px]
                    font-medium
                    text-red-600

                    dark:bg-red-900/20
                    dark:text-red-300
                  "
                >
                  Disabled
                </span>
              )}
            </div>

            <div
              className="
                mt-0.5
                flex
                flex-wrap
                gap-x-3
                gap-y-1
                text-xs
                text-gray-500

                dark:text-gray-400
              "
            >
              <span className="font-mono">{menu.menu_key}</span>

              {menu.path && <span className="truncate">{menu.path}</span>}

              <span>Order: {menu.display_order}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              title="Move up"
              onClick={() => moveMenu(menu, "up")}
              className="
                rounded-md
                p-2
                text-gray-400
                transition-colors

                hover:bg-gray-100
                hover:text-gray-700

                dark:text-gray-500
                dark:hover:bg-gray-700
                dark:hover:text-gray-200
              "
            >
              <FaArrowUp className="h-3 w-3" />
            </button>

            <button
              type="button"
              title="Move down"
              onClick={() => moveMenu(menu, "down")}
              className="
                rounded-md
                p-2
                text-gray-400
                transition-colors

                hover:bg-gray-100
                hover:text-gray-700

                dark:text-gray-500
                dark:hover:bg-gray-700
                dark:hover:text-gray-200
              "
            >
              <FaArrowDown className="h-3 w-3" />
            </button>

            <button
              type="button"
              title="Add child menu"
              onClick={() => openCreate(menu.id)}
              className="
                rounded-md
                p-2
                text-blue-500
                transition-colors

                hover:bg-blue-50
                hover:text-blue-700

                dark:text-blue-400
                dark:hover:bg-blue-900/30
                dark:hover:text-blue-300
              "
            >
              <FaPlus className="h-3 w-3" />
            </button>

            <button
              type="button"
              title={menu.is_active ? "Disable menu" : "Enable menu"}
              onClick={() => toggleActive(menu)}
              className="
                rounded-md
                p-2
                text-gray-500
                transition-colors

                hover:bg-gray-100
                hover:text-gray-700

                dark:text-gray-400
                dark:hover:bg-gray-700
                dark:hover:text-gray-200
              "
            >
              {menu.is_active ? (
                <FaEye className="h-3 w-3" />
              ) : (
                <FaEyeSlash className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              title="Edit menu"
              onClick={() => openEdit(menu)}
              className="
                rounded-md
                p-2
                text-blue-500
                transition-colors

                hover:bg-blue-50
                hover:text-blue-700

                dark:text-blue-400
                dark:hover:bg-blue-900/30
                dark:hover:text-blue-300
              "
            >
              <FaEdit className="h-3 w-3" />
            </button>

            <button
              type="button"
              title="Delete menu"
              onClick={() => setDeleteTarget(menu)}
              className="
                rounded-md
                p-2
                text-red-500
                transition-colors

                hover:bg-red-50
                hover:text-red-700

                dark:text-red-400
                dark:hover:bg-red-900/30
                dark:hover:text-red-300
              "
            >
              <FaTrash className="h-3 w-3" />
            </button>
          </div>
        </div>

        {opened && children.map((child) => renderTreeNode(child, level + 1))}
      </div>
    );
  };

  /* ==========================================================
     PAGE
     ========================================================== */

  return (
    <div>
      <PageMeta
        title="Menu Management"
        description="Manage application menus"
      />

      <PageBreadcrumb pageTitle="Menu Management" />

      <div className="mt-4">
        {/* Alert */}
        {alert && (
          <div className="mb-4">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        {/* ====================================================
            HEADER
            ==================================================== */}

        <div
          className="
            mb-4
            rounded-2xl
            border
            border-gray-200
            bg-white
            p-4
            shadow-sm

            dark:border-gray-700
            dark:bg-gray-900
          "
        >
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                Application Navigation
              </h2>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Configure menu hierarchy, routing, visibility, permissions and
                ordering.
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`
                  rounded-lg
                  px-3
                  py-2
                  text-sm
                  font-medium
                  transition-colors

                  ${
                    viewMode === "tree"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : `
                        bg-gray-100
                        text-gray-600
                        hover:bg-gray-200
                        hover:text-gray-900

                        dark:bg-gray-800
                        dark:text-gray-300
                        dark:hover:bg-gray-700
                        dark:hover:text-white
                      `
                  }
                `}
              >
                Tree
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`
                  rounded-lg
                  px-3
                  py-2
                  text-sm
                  font-medium
                  transition-colors

                  ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : `
                        bg-gray-100
                        text-gray-600
                        hover:bg-gray-200
                        hover:text-gray-900

                        dark:bg-gray-800
                        dark:text-gray-300
                        dark:hover:bg-gray-700
                        dark:hover:text-white
                      `
                  }
                `}
              >
                Table
              </button>

              <button
                type="button"
                onClick={() => openCreate()}
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-blue-600
                  px-3
                  py-2
                  text-sm
                  font-medium
                  text-white
                  transition-colors
                  hover:bg-blue-700
                "
              >
                <FaPlus className="h-3.5 w-3.5" />
                Add Menu
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4 max-w-md">
            <FaSearch
              className="
                absolute
                left-3
                top-1/2
                h-3.5
                w-3.5
                -translate-y-1/2
                text-gray-400

                dark:text-gray-500
              "
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menus..."
              className="
                w-full
                rounded-lg
                border
                border-gray-300
                bg-white
                py-2
                pl-9
                pr-3
                text-sm
                text-gray-900
                placeholder:text-gray-400
                transition-colors

                focus:border-blue-500
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500/20

                dark:border-gray-600
                dark:bg-gray-800
                dark:text-gray-100
                dark:placeholder:text-gray-500
              "
            />
          </div>
        </div>

        {/* ====================================================
            CONTENT
            ==================================================== */}

        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            border-gray-200
            bg-white
            shadow-sm

            dark:border-gray-700
            dark:bg-gray-900
          "
        >
          {/* Loading */}
          {loading ? (
            <div className="p-8 text-sm text-gray-500 dark:text-gray-400">
              Loading menus...
            </div>
          ) : viewMode === "tree" && !search ? (
            /* =================================================
               TREE VIEW
               ================================================= */

            <div>
              {menus.length ? (
                menus.map((menu) => renderTreeNode(menu))
              ) : (
                <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No menu items found.
                </div>
              )}
            </div>
          ) : (
            /* =================================================
               TABLE VIEW
               ================================================= */

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead
                  className="
                    border-b
                    border-gray-200
                    bg-gray-50

                    dark:border-gray-700
                    dark:bg-gray-800/80
                  "
                >
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Menu
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Key
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Path
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Type
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Order
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredFlatMenus.length ? (
                    filteredFlatMenus.map((menu) => {
                      const Icon = getMenuIcon(menu.icon);

                      return (
                        <tr
                          key={menu.id}
                          className="
                              transition-colors
                              hover:bg-gray-50

                              dark:hover:bg-gray-800/60
                            "
                        >
                          {/* Menu */}
                          <td className="px-4 py-3">
                            <div
                              className="flex items-center gap-2"
                              style={{
                                paddingLeft: menu.level * 18,
                              }}
                            >
                              <div
                                className="
                                    flex
                                    h-7
                                    w-7
                                    flex-shrink-0
                                    items-center
                                    justify-center
                                    rounded-md
                                    bg-gray-100
                                    text-gray-500

                                    dark:bg-gray-800
                                    dark:text-gray-400
                                  "
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>

                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {menu.menu_name}
                                </div>

                                {!menu.is_visible && (
                                  <span className="mt-1 inline-block text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    Hidden from sidebar
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Key */}
                          <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                            {menu.menu_key}
                          </td>

                          {/* Path */}
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {menu.path || "—"}
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span
                              className="
                                  rounded-md
                                  bg-gray-100
                                  px-2
                                  py-1
                                  text-xs
                                  font-medium
                                  capitalize
                                  text-gray-600

                                  dark:bg-gray-800
                                  dark:text-gray-300
                                "
                            >
                              {menu.menu_type}
                            </span>
                          </td>

                          {/* Order */}
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {menu.display_order}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`
                                  inline-flex
                                  items-center
                                  rounded-full
                                  px-2
                                  py-1
                                  text-xs
                                  font-medium

                                  ${
                                    menu.is_active
                                      ? `
                                        bg-green-50
                                        text-green-700

                                        dark:bg-green-900/20
                                        dark:text-green-300
                                      `
                                      : `
                                        bg-red-50
                                        text-red-700

                                        dark:bg-red-900/20
                                        dark:text-red-300
                                      `
                                  }
                                `}
                            >
                              {menu.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title={menu.is_active ? "Disable" : "Enable"}
                                onClick={() => toggleActive(menu)}
                                className="
                                    rounded-md
                                    p-2
                                    text-gray-500
                                    transition-colors

                                    hover:bg-gray-100
                                    hover:text-gray-700

                                    dark:text-gray-400
                                    dark:hover:bg-gray-700
                                    dark:hover:text-gray-200
                                  "
                              >
                                {menu.is_active ? (
                                  <FaEye className="h-3.5 w-3.5" />
                                ) : (
                                  <FaEyeSlash className="h-3.5 w-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                title="Edit"
                                onClick={() => openEdit(menu)}
                                className="
                                    rounded-md
                                    p-2
                                    text-blue-500
                                    transition-colors

                                    hover:bg-blue-50
                                    hover:text-blue-700

                                    dark:text-blue-400
                                    dark:hover:bg-blue-900/30
                                    dark:hover:text-blue-300
                                  "
                              >
                                <FaEdit className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Delete"
                                onClick={() => setDeleteTarget(menu)}
                                className="
                                    rounded-md
                                    p-2
                                    text-red-500
                                    transition-colors

                                    hover:bg-red-50
                                    hover:text-red-700

                                    dark:text-red-400
                                    dark:hover:bg-red-900/30
                                    dark:hover:text-red-300
                                  "
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        No menus match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          CREATE / EDIT MODAL
          ====================================================== */}

      {showModal && (
        <div
          className="
            fixed
            inset-0
            z-[999999]
            flex
            items-center
            justify-center
            bg-black/50
            px-4
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="
              mx-auto
              max-h-[90vh]
              w-full
              max-w-3xl
              overflow-y-auto
              rounded-2xl
              border
              border-gray-200
              bg-white
              p-6
              text-gray-900
              shadow-2xl

              dark:border-gray-700
              dark:bg-gray-900
              dark:text-gray-100
            "
          >
            {/* Modal Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {editingMenu ? "Edit Menu" : "Add Menu"}
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Configure application navigation, placement and permissions.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                title="Close"
                className="
                  flex
                  h-8
                  w-8
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  text-xl
                  text-gray-400
                  transition-colors

                  hover:bg-gray-100
                  hover:text-gray-700

                  dark:text-gray-500
                  dark:hover:bg-gray-800
                  dark:hover:text-gray-200
                "
              >
                ×
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Menu Name */}
                <div>
                  <label className={LABEL_CLASS}>
                    Menu Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    value={form.menu_name}
                    onChange={(event) =>
                      handleMenuNameChange(event.target.value)
                    }
                    placeholder="e.g. Test Management"
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Menu Key */}
                <div>
                  <label className={LABEL_CLASS}>
                    Menu Key <span className="text-red-500">*</span>
                  </label>

                  <input
                    value={form.menu_key}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        menu_key: normalizeMenuKey(event.target.value),
                      })
                    }
                    placeholder="TEST_MANAGEMENT"
                    className={`${INPUT_CLASS} font-mono`}
                  />

                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Stable internal identifier. Example: TEST_CASES.
                  </p>
                </div>

                {/* Type */}
                <div>
                  <label className={LABEL_CLASS}>Type</label>

                  <select
                    value={form.menu_type}
                    onChange={(event) => {
                      const menuType = event.target.value as MenuType;

                      setForm((previous) => ({
                        ...previous,

                        menu_type: menuType,

                        path:
                          menuType === "group" || menuType === "heading"
                            ? ""
                            : previous.path,
                      }));
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="menu">Menu</option>

                    <option value="group">Group</option>

                    <option value="heading">Heading</option>

                    <option value="external">External Link</option>
                  </select>
                </div>

                {/* Parent */}
                <div>
                  <label className={LABEL_CLASS}>Parent Menu</label>

                  <select
                    value={form.parent_id}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        parent_id: event.target.value,
                      })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Root Level</option>

                    {flatMenus
                      .filter((item) => item.id !== editingMenu?.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {"— ".repeat(item.level)}
                          {item.menu_name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Route */}
                <div>
                  <label className={LABEL_CLASS}>
                    {form.menu_type === "external"
                      ? "External URL"
                      : "Route / Path"}

                    {(form.menu_type === "menu" ||
                      form.menu_type === "external") && (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>

                  <input
                    value={form.path}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        path: event.target.value,
                      })
                    }
                    disabled={
                      form.menu_type === "group" || form.menu_type === "heading"
                    }
                    placeholder={
                      form.menu_type === "external"
                        ? "https://example.com"
                        : "/example"
                    }
                    className={INPUT_CLASS}
                  />

                  {(form.menu_type === "group" ||
                    form.menu_type === "heading") && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      Groups and headings do not require a route.
                    </p>
                  )}
                </div>

                {/* Icon */}
                <div>
                  <label className={LABEL_CLASS}>Icon</label>

                  <div className="flex gap-2">
                    <div
                      className="
                        flex
                        h-[38px]
                        w-[42px]
                        flex-shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-gray-300
                        bg-gray-50
                        text-gray-600

                        dark:border-gray-600
                        dark:bg-gray-800
                        dark:text-gray-300
                      "
                    >
                      {(() => {
                        const Icon = getMenuIcon(form.icon);

                        return <Icon className="h-4 w-4" />;
                      })()}
                    </div>

                    <select
                      value={form.icon}
                      onChange={(event) =>
                        setForm({
                          ...form,

                          icon: event.target.value,
                        })
                      }
                      className={INPUT_CLASS}
                    >
                      {availableMenuIcons.map((iconName) => (
                        <option key={iconName} value={iconName}>
                          {iconName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Order */}
                <div>
                  <label className={LABEL_CLASS}>Display Order</label>

                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={form.display_order}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        display_order: Number(event.target.value),
                      })
                    }
                    className={INPUT_CLASS}
                  />

                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Lower values appear first.
                  </p>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Supported Permissions
                </label>

                <div className="flex flex-wrap gap-2">
                  {PERMISSIONS.map((permission) => {
                    const checked =
                      form.supported_permissions.includes(permission);

                    return (
                      <label
                        key={permission}
                        className={`
                            inline-flex
                            cursor-pointer
                            items-center
                            gap-2
                            rounded-lg
                            border
                            px-3
                            py-2
                            text-sm
                            transition-colors

                            ${
                              checked
                                ? `
                                  border-blue-200
                                  bg-blue-50
                                  text-blue-700

                                  dark:border-blue-800
                                  dark:bg-blue-900/20
                                  dark:text-blue-300
                                `
                                : `
                                  border-gray-200
                                  bg-white
                                  text-gray-700
                                  hover:bg-gray-50

                                  dark:border-gray-700
                                  dark:bg-gray-800
                                  dark:text-gray-300
                                  dark:hover:bg-gray-700/70
                                `
                            }
                          `}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(permission)}
                          className={CHECKBOX_CLASS}
                        />

                        <span className="capitalize">{permission}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={LABEL_CLASS}>Description</label>

                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,

                      description: event.target.value,
                    })
                  }
                  placeholder="Optional description of this menu or feature"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              {/* Flags */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={CHECKBOX_CARD_CLASS}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        is_active: event.target.checked,
                      })
                    }
                    className={CHECKBOX_CLASS}
                  />

                  <div>
                    <div className="font-medium">Active</div>

                    <div className="text-[11px] text-gray-400 dark:text-gray-500">
                      Feature enabled
                    </div>
                  </div>
                </label>

                <label className={CHECKBOX_CARD_CLASS}>
                  <input
                    type="checkbox"
                    checked={form.is_visible}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        is_visible: event.target.checked,
                      })
                    }
                    className={CHECKBOX_CLASS}
                  />

                  <div>
                    <div className="font-medium">Show in Sidebar</div>

                    <div className="text-[11px] text-gray-400 dark:text-gray-500">
                      Navigation visible
                    </div>
                  </div>
                </label>

                <label
                  className={`${CHECKBOX_CARD_CLASS} ${
                    form.menu_type !== "external" ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.open_in_new_tab}
                    disabled={form.menu_type !== "external"}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        open_in_new_tab: event.target.checked,
                      })
                    }
                    className={CHECKBOX_CLASS}
                  />

                  <div>
                    <div className="font-medium">Open New Tab</div>

                    <div className="text-[11px] text-gray-400 dark:text-gray-500">
                      External links
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              className="
                mt-6
                flex
                justify-end
                gap-3
                border-t
                border-gray-100
                pt-5

                dark:border-gray-800
              "
            >
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveMenu}
                disabled={saving}
                className="
                  rounded-lg
                  bg-blue-600
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  transition-colors
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {saving
                  ? "Saving..."
                  : editingMenu
                    ? "Save Changes"
                    : "Create Menu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          DELETE MODAL
          ====================================================== */}

      {deleteTarget && (
        <div
          className="
            fixed
            inset-0
            z-[999999]
            flex
            items-center
            justify-center
            bg-black/50
            px-4
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="
              mx-auto
              w-full
              max-w-md
              rounded-2xl
              border
              border-gray-200
              bg-white
              p-6
              text-gray-900
              shadow-2xl

              dark:border-gray-700
              dark:bg-gray-900
              dark:text-gray-100
            "
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex
                    h-10
                    w-10
                    flex-shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-red-100
                    text-red-600

                    dark:bg-red-900/30
                    dark:text-red-400
                  "
                >
                  <FaSitemap className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    Delete Menu
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-lg
                  text-xl
                  text-gray-400
                  transition-colors

                  hover:bg-gray-100
                  hover:text-gray-700

                  dark:text-gray-500
                  dark:hover:bg-gray-800
                  dark:hover:text-gray-200
                "
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete{" "}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                "{deleteTarget.menu_name}"
              </strong>
              ?
            </p>

            {(deleteTarget.children?.length || 0) > 0 && (
              <div
                className="
                  mt-4
                  rounded-lg
                  border
                  border-amber-200
                  bg-amber-50
                  p-3
                  text-xs
                  text-amber-700

                  dark:border-amber-800/60
                  dark:bg-amber-900/20
                  dark:text-amber-300
                "
              >
                This menu contains child items. Move or delete the child items
                first. The backend will prevent deletion while children still
                exist.
              </div>
            )}

            <div
              className="
                mt-6
                flex
                justify-end
                gap-3
                border-t
                border-gray-100
                pt-5

                dark:border-gray-800
              "
            >
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="
                  rounded-lg
                  bg-red-600
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  transition-colors
                  hover:bg-red-700
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

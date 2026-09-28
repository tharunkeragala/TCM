const { poolPromise } = require("../config/db");
const sql = require("mssql");

const DB = "test_case_manager.dbo";

const VALID_MENU_TYPES = ["menu", "group", "heading", "external"];

const cleanString = (value) => {
  if (value === null || value === undefined) return null;

  const cleaned = String(value).trim();

  return cleaned || null;
};

const normalizeMenuKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePermissions = (value) => {
  let values = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string") {
    values = value.split(",");
  }

  const cleaned = values
    .map((item) =>
      String(item || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  return [...new Set(cleaned)].join(",");
};

const normalizePath = (path, menuType) => {
  const value = cleanString(path);

  if (!value) return null;

  if (menuType === "external") {
    return value;
  }

  if (!value.startsWith("/")) {
    return `/${value}`;
  }

  return value;
};

const mapMenu = (row) => ({
  id: Number(row.id),
  menu_name: row.menu_name,
  menu_key: row.menu_key,
  parent_id:
    row.parent_id === null || row.parent_id === undefined
      ? null
      : Number(row.parent_id),
  path: row.path,
  icon: row.icon,
  supported_permissions: row.supported_permissions || "view",
  display_order: Number(row.display_order || 0),
  menu_type: row.menu_type || "menu",
  is_active: Boolean(row.is_active),
  is_visible: Boolean(row.is_visible),
  description: row.description,
  open_in_new_tab: Boolean(row.open_in_new_tab),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const buildTree = (rows) => {
  const mapped = rows.map((row) => ({
    ...mapMenu(row),
    children: [],
  }));

  const byId = new Map();

  mapped.forEach((item) => {
    byId.set(item.id, item);
  });

  const roots = [];

  mapped.forEach((item) => {
    if (item.parent_id !== null && byId.has(item.parent_id)) {
      byId.get(item.parent_id).children.push(item);
    } else {
      roots.push(item);
    }
  });

  const sortChildren = (items) => {
    items.sort(
      (a, b) =>
        a.display_order - b.display_order ||
        a.menu_name.localeCompare(b.menu_name),
    );

    items.forEach((item) => {
      sortChildren(item.children);
    });

    return items;
  };

  return sortChildren(roots);
};

const wouldCreateCircularReference = async (transaction, menuId, parentId) => {
  if (!parentId) return false;

  if (Number(menuId) === Number(parentId)) {
    return true;
  }

  let currentParentId = Number(parentId);
  const visited = new Set();

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return true;
    }

    visited.add(currentParentId);

    if (currentParentId === Number(menuId)) {
      return true;
    }

    const result = await new sql.Request(transaction).input(
      "id",
      sql.Int,
      currentParentId,
    ).query(`
        SELECT parent_id
        FROM ${DB}.menus
        WHERE id = @id
      `);

    if (!result.recordset.length) {
      break;
    }

    currentParentId =
      result.recordset[0].parent_id === null
        ? null
        : Number(result.recordset[0].parent_id);
  }

  return false;
};

const validateMenu = (body) => {
  const menuName = String(body.menu_name || "").trim();

  if (!menuName) {
    return "Menu name is required.";
  }

  const menuKey = normalizeMenuKey(body.menu_key || menuName);

  if (!menuKey) {
    return "Menu key is required.";
  }

  const menuType = String(body.menu_type || "menu").toLowerCase();

  if (!VALID_MENU_TYPES.includes(menuType)) {
    return "Invalid menu type.";
  }

  if (menuType === "menu" && !cleanString(body.path)) {
    return "Route/path is required for menu items.";
  }

  if (menuType === "external" && !cleanString(body.path)) {
    return "URL is required for external menu items.";
  }

  return null;
};

/* ============================================================
   GET ADMIN MENU LIST
   ============================================================ */

exports.getMenus = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id,
        menu_name,
        menu_key,
        parent_id,
        path,
        icon,
        supported_permissions,
        display_order,
        menu_type,
        is_active,
        is_visible,
        description,
        open_in_new_tab,
        created_at,
        updated_at
      FROM ${DB}.menus
      ORDER BY
        ISNULL(parent_id, 0),
        display_order,
        menu_name
    `);

    res.json({
      success: true,
      data: result.recordset.map(mapMenu),
    });
  } catch (err) {
    console.error("GET MENUS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menus.",
      error: err.message,
    });
  }
};

/* ============================================================
   GET FULL TREE FOR MENU MANAGEMENT
   ============================================================ */

exports.getMenuTree = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id,
        menu_name,
        menu_key,
        parent_id,
        path,
        icon,
        supported_permissions,
        display_order,
        menu_type,
        is_active,
        is_visible,
        description,
        open_in_new_tab,
        created_at,
        updated_at
      FROM ${DB}.menus
      ORDER BY
        display_order,
        menu_name
    `);

    res.json({
      success: true,
      data: buildTree(result.recordset),
    });
  } catch (err) {
    console.error("GET MENU TREE ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu tree.",
      error: err.message,
    });
  }
};

/* ============================================================
   NAVIGATION TREE
   Only active + visible menus.
   Permission filtering stays in frontend using your
   existing /roles/my-permissions endpoint.
   ============================================================ */

exports.getNavigation = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        id,
        menu_name,
        menu_key,
        parent_id,
        path,
        icon,
        supported_permissions,
        display_order,
        menu_type,
        is_active,
        is_visible,
        description,
        open_in_new_tab,
        created_at,
        updated_at
      FROM ${DB}.menus
      WHERE is_active = 1
        AND is_visible = 1
      ORDER BY
        display_order,
        menu_name
    `);

    res.json({
      success: true,
      data: buildTree(result.recordset),
    });
  } catch (err) {
    console.error("GET NAVIGATION ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to load navigation.",
      error: err.message,
    });
  }
};

/* ============================================================
   GET SINGLE MENU
   ============================================================ */

exports.getMenuById = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu id.",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, id).query(`
        SELECT
          id,
          menu_name,
          menu_key,
          parent_id,
          path,
          icon,
          supported_permissions,
          display_order,
          menu_type,
          is_active,
          is_visible,
          description,
          open_in_new_tab,
          created_at,
          updated_at
        FROM ${DB}.menus
        WHERE id = @id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    res.json({
      success: true,
      data: mapMenu(result.recordset[0]),
    });
  } catch (err) {
    console.error("GET MENU ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu.",
      error: err.message,
    });
  }
};

/* ============================================================
   CREATE MENU
   ============================================================ */

exports.createMenu = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const error = validateMenu(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const menuName = String(req.body.menu_name).trim();
    const menuKey = normalizeMenuKey(req.body.menu_key || menuName);

    const menuType = String(req.body.menu_type || "menu").toLowerCase();

    const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;

    const path = normalizePath(req.body.path, menuType);

    const permissions =
      normalizePermissions(req.body.supported_permissions) || "view";

    const displayOrder = Number(req.body.display_order) || 0;

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const duplicateKey = await new sql.Request(transaction).input(
      "menu_key",
      sql.VarChar(100),
      menuKey,
    ).query(`
          SELECT id
          FROM ${DB}.menus
          WHERE menu_key = @menu_key
        `);

    if (duplicateKey.recordset.length) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Menu key already exists.",
      });
    }

    if (path) {
      const duplicatePath = await new sql.Request(transaction).input(
        "path",
        sql.NVarChar(255),
        path,
      ).query(`
            SELECT id
            FROM ${DB}.menus
            WHERE path = @path
          `);

      if (duplicatePath.recordset.length) {
        await transaction.rollback();

        return res.status(409).json({
          success: false,
          message: "Another menu already uses this path.",
        });
      }
    }

    if (parentId) {
      const parent = await new sql.Request(transaction).input(
        "parent_id",
        sql.Int,
        parentId,
      ).query(`
            SELECT id
            FROM ${DB}.menus
            WHERE id = @parent_id
          `);

      if (!parent.recordset.length) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: "Selected parent menu does not exist.",
        });
      }
    }

    const result = await new sql.Request(transaction)
      .input("menu_name", sql.NVarChar(100), menuName)
      .input("menu_key", sql.VarChar(100), menuKey)
      .input("parent_id", sql.Int, parentId)
      .input("path", sql.NVarChar(255), path)
      .input("icon", sql.NVarChar(100), cleanString(req.body.icon))
      .input("supported_permissions", sql.NVarChar(200), permissions)
      .input("display_order", sql.Int, displayOrder)
      .input("menu_type", sql.VarChar(30), menuType)
      .input("is_active", sql.Bit, req.body.is_active !== false)
      .input("is_visible", sql.Bit, req.body.is_visible !== false)
      .input(
        "description",
        sql.NVarChar(500),
        cleanString(req.body.description),
      )
      .input("open_in_new_tab", sql.Bit, Boolean(req.body.open_in_new_tab))
      .query(`
        INSERT INTO ${DB}.menus
        (
          menu_name,
          menu_key,
          parent_id,
          path,
          icon,
          supported_permissions,
          display_order,
          menu_type,
          is_active,
          is_visible,
          description,
          open_in_new_tab,
          created_at
        )
        OUTPUT INSERTED.*
        VALUES
        (
          @menu_name,
          @menu_key,
          @parent_id,
          @path,
          @icon,
          @supported_permissions,
          @display_order,
          @menu_type,
          @is_active,
          @is_visible,
          @description,
          @open_in_new_tab,
          SYSUTCDATETIME()
        )
      `);

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Menu created successfully.",
      data: mapMenu(result.recordset[0]),
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}

    console.error("CREATE MENU ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create menu.",
      error: err.message,
    });
  }
};

/* ============================================================
   UPDATE MENU
   ============================================================ */

exports.updateMenu = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu id.",
      });
    }

    const error = validateMenu(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const menuName = String(req.body.menu_name).trim();
    const menuKey = normalizeMenuKey(req.body.menu_key || menuName);

    const menuType = String(req.body.menu_type || "menu").toLowerCase();

    const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;

    const path = normalizePath(req.body.path, menuType);

    const permissions =
      normalizePermissions(req.body.supported_permissions) || "view";

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const existing = await new sql.Request(transaction).input("id", sql.Int, id)
      .query(`
          SELECT *
          FROM ${DB}.menus WITH (UPDLOCK, HOLDLOCK)
          WHERE id = @id
        `);

    if (!existing.recordset.length) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const duplicateKey = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("menu_key", sql.VarChar(100), menuKey).query(`
          SELECT id
          FROM ${DB}.menus
          WHERE menu_key = @menu_key
            AND id <> @id
        `);

    if (duplicateKey.recordset.length) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Menu key already exists.",
      });
    }

    if (path) {
      const duplicatePath = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("path", sql.NVarChar(255), path).query(`
            SELECT id
            FROM ${DB}.menus
            WHERE path = @path
              AND id <> @id
          `);

      if (duplicatePath.recordset.length) {
        await transaction.rollback();

        return res.status(409).json({
          success: false,
          message: "Another menu already uses this path.",
        });
      }
    }

    if (parentId) {
      const parent = await new sql.Request(transaction).input(
        "parent_id",
        sql.Int,
        parentId,
      ).query(`
            SELECT id
            FROM ${DB}.menus
            WHERE id = @parent_id
          `);

      if (!parent.recordset.length) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: "Selected parent menu does not exist.",
        });
      }

      const circular = await wouldCreateCircularReference(
        transaction,
        id,
        parentId,
      );

      if (circular) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message:
            "This parent selection would create a circular menu hierarchy.",
        });
      }
    }

    const updated = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("menu_name", sql.NVarChar(100), menuName)
      .input("menu_key", sql.VarChar(100), menuKey)
      .input("parent_id", sql.Int, parentId)
      .input("path", sql.NVarChar(255), path)
      .input("icon", sql.NVarChar(100), cleanString(req.body.icon))
      .input("supported_permissions", sql.NVarChar(200), permissions)
      .input("display_order", sql.Int, Number(req.body.display_order) || 0)
      .input("menu_type", sql.VarChar(30), menuType)
      .input("is_active", sql.Bit, req.body.is_active !== false)
      .input("is_visible", sql.Bit, req.body.is_visible !== false)
      .input(
        "description",
        sql.NVarChar(500),
        cleanString(req.body.description),
      )
      .input("open_in_new_tab", sql.Bit, Boolean(req.body.open_in_new_tab))
      .query(`
          UPDATE ${DB}.menus
          SET
            menu_name = @menu_name,
            menu_key = @menu_key,
            parent_id = @parent_id,
            path = @path,
            icon = @icon,
            supported_permissions = @supported_permissions,
            display_order = @display_order,
            menu_type = @menu_type,
            is_active = @is_active,
            is_visible = @is_visible,
            description = @description,
            open_in_new_tab = @open_in_new_tab,
            updated_at = SYSUTCDATETIME()
          OUTPUT INSERTED.*
          WHERE id = @id
        `);

    await transaction.commit();

    res.json({
      success: true,
      message: "Menu updated successfully.",
      data: mapMenu(updated.recordset[0]),
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}

    console.error("UPDATE MENU ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to update menu.",
      error: err.message,
    });
  }
};

/* ============================================================
   REORDER / REPARENT MENUS
   ============================================================ */

exports.reorderMenus = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "No menu ordering information provided.",
      });
    }

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    for (const item of items) {
      const id = Number(item.id);

      const parentId =
        item.parent_id === null ||
        item.parent_id === undefined ||
        item.parent_id === ""
          ? null
          : Number(item.parent_id);

      if (!id) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: "Invalid menu id in reorder request.",
        });
      }

      if (parentId) {
        const circular = await wouldCreateCircularReference(
          transaction,
          id,
          parentId,
        );

        if (circular) {
          await transaction.rollback();

          return res.status(400).json({
            success: false,
            message:
              "Reorder operation would create a circular menu hierarchy.",
          });
        }
      }

      await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("parent_id", sql.Int, parentId)
        .input("display_order", sql.Int, Number(item.display_order) || 0)
        .query(`
          UPDATE ${DB}.menus
          SET
            parent_id = @parent_id,
            display_order = @display_order,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id
        `);
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Menu order updated successfully.",
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}

    console.error("REORDER MENUS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to reorder menus.",
      error: err.message,
    });
  }
};

/* ============================================================
   ACTIVE / INACTIVE
   ============================================================ */

exports.toggleMenuActive = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, id).query(`
        UPDATE ${DB}.menus
        SET
          is_active =
            CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    res.json({
      success: true,
      message: "Menu status updated.",
      data: mapMenu(result.recordset[0]),
    });
  } catch (err) {
    console.error("TOGGLE MENU ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to update menu status.",
      error: err.message,
    });
  }
};

/* ============================================================
   DELETE
   ============================================================ */

exports.deleteMenu = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu id.",
      });
    }

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    /* ========================================================
       CHECK MENU EXISTS
       ======================================================== */

    const found = await new sql.Request(transaction).input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM ${DB}.menus WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @id
      `);

    if (!found.recordset.length) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const menu = found.recordset[0];

    /* ========================================================
       CHECK CHILD MENUS
       ======================================================== */

    const children = await new sql.Request(transaction).input("id", sql.Int, id)
      .query(`
        SELECT
          id,
          menu_name
        FROM ${DB}.menus
        WHERE parent_id = @id
      `);

    if (children.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message:
          "This menu contains child items. Move or delete the child items first.",
        children: children.recordset,
      });
    }

    /* ========================================================
       REMOVE ROLE PERMISSIONS FIRST

       role_permissions.menu_id references menus.id
       through FK_role_permissions_menu.
       ======================================================== */

    const rolePermissions = await new sql.Request(transaction).input(
      "menu_id",
      sql.Int,
      id,
    ).query(`
          SELECT COUNT(*) AS permission_count
          FROM ${DB}.role_permissions
          WHERE menu_id = @menu_id
        `);

    const permissionCount = Number(
      rolePermissions.recordset[0]?.permission_count || 0,
    );

    if (permissionCount > 0) {
      await new sql.Request(transaction).input("menu_id", sql.Int, id).query(`
          DELETE FROM ${DB}.role_permissions
          WHERE menu_id = @menu_id
        `);
    }

    /* ========================================================
       DELETE MENU
       ======================================================== */

    await new sql.Request(transaction).input("id", sql.Int, id).query(`
        DELETE FROM ${DB}.menus
        WHERE id = @id
      `);

    await transaction.commit();

    return res.json({
      success: true,
      message: "Menu deleted successfully.",
      deleted_menu: {
        id: menu.id,
        menu_name: menu.menu_name,
        menu_key: menu.menu_key,
      },
      removed_role_permissions: permissionCount,
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}

    console.error("DELETE MENU ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete menu.",
      error: err.message,
    });
  }
};

export type MenuType = "menu" | "group" | "heading" | "external";

export interface MenuItem {
  id: number;

  menu_name: string;

  menu_key: string;

  parent_id: number | null;

  path?: string | null;

  icon?: string | null;

  supported_permissions: string;

  display_order: number;

  menu_type: MenuType;

  is_active: boolean;

  is_visible: boolean;

  description?: string | null;

  open_in_new_tab: boolean;

  created_at?: string;

  updated_at?: string;

  children?: MenuItem[];
}

export interface UserPermission {
  menu_name?: string;
  path: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

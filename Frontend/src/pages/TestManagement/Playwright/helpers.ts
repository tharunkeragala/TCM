import API from "../../../services/api";
import.meta.env.VITE_API_BASE_URL

export const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

export const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

export function getWsUrl() {
  return import.meta.env.VITE_WS_URL || "ws://localhost:3000";
}

export function formatSelector(selector: unknown) {
  if (!selector) return "";
  if (typeof selector === "string") {
    const stripped = selector.trim();
    if (
      (stripped.startsWith("'") && stripped.endsWith("'")) ||
      (stripped.startsWith('"') && stripped.endsWith('"'))
    ) {
      return stripped.slice(1, -1);
    }
    return stripped;
  }

  if (typeof selector === "object") {
    const s = selector as Record<string, unknown>;
    if (s.id) return `#${s.id}`;
    if (s.xpath) return `xpath=${s.xpath}`;
    if (s.name) return `[name="${s.name}"]`;
    if (s.testid) return `[data-testid="${s.testid}"]`;
    if (s.css) return String(s.css);
    if (s.tag) return `<${s.tag}>`;
    return JSON.stringify(s);
  }

  return String(selector);
}

// export function screenshotUrl(path?: string | null) {
//   if (!path) return "";
//   if (path.startsWith("http")) return path;
//   const baseURL = API.defaults?.baseURL || window.location.origin;
//   const cleanBase = baseURL.replace(/\/$/, "");
//   const cleanPath = path.startsWith("/") ? path : `/${path}`;
//   return `${cleanBase}${cleanPath}`;
// }

// export function screenshotUrl(path?: string | null) {
//   if (!path) return "";
//   if (path.startsWith("http")) return path;

//   const baseURL = API.defaults?.baseURL || window.location.origin;
//   // Strip trailing slash and /api suffix — screenshots are at root level
//   const cleanBase = baseURL.replace(/\/$/, "").replace(/\/api$/, "");
//   const cleanPath = path.startsWith("/") ? path : `/${path}`;
//   return `${cleanBase}${cleanPath}`;
// }

export function screenshotUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const baseURL = API.defaults?.baseURL || window.location.origin;
  const cleanBase = baseURL.replace(/\/$/, "").replace(/\/api$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const result = `${cleanBase}${cleanPath}`;
  console.log("screenshotUrl input:", path, "→ output:", result);
  return result;
}


export const statusClass: Record<string, string> = {
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  passed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  aborted: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};


console.log("API BASE URL:", API.defaults.baseURL);
console.log("WINDOW ORIGIN:", window.location.origin);
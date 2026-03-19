import type { Href } from "expo-router";

const ADMIN_ROLES = new Set([
  "admin",
  "editor",
  "editor user",
  "editor role",
  "editor permission",
]);

export function isAdminRole(role: string | null | undefined): boolean {
  const normalizedRole = role?.trim().toLowerCase();
  if (!normalizedRole) {
    return false;
  }
  return ADMIN_ROLES.has(normalizedRole);
}

export function getAuthenticatedHomeRoute(role: string | null | undefined): Href {
  return isAdminRole(role) ? "/admin" : "/(tabs)/mapa";
}
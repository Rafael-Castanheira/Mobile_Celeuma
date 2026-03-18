import type { Href } from "expo-router";

export function isAdminRole(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === "admin";
}

export function getAuthenticatedHomeRoute(role: string | null | undefined): Href {
  return isAdminRole(role) ? "/admin" : "/(tabs)/mapa";
}
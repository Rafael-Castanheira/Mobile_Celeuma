const ADMIN_ROLES = new Set(["admin", "editor", "editor user", "editor role", "editor permission"]);

export function isAdminRole(role) {
	const normalizedRole = role?.trim().toLowerCase();
	if (!normalizedRole) {
		return false;
	}
	return ADMIN_ROLES.has(normalizedRole);
}

export function getAuthenticatedHomeRoute(role) {
	return "/admin";
}

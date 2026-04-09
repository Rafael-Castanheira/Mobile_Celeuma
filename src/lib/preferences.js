import AsyncStorage from "@react-native-async-storage/async-storage/lib/commonjs";

const FAVORITE_POINTS_KEY_PREFIX = "@galerias360:favorite-points:";
const FEATURED_ROUTE_KEY = "@galerias360:featured-route-id";

function getUserFavoritePointsKey(userId) {
	return `${FAVORITE_POINTS_KEY_PREFIX}${String(userId ?? "anonymous")}`;
}

function normalizeNumberArray(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return [...new Set(value.filter((item) => typeof item === "number" && Number.isFinite(item)))];
}

export async function getFavoritePointIds(userId) {
	try {
		const raw = await AsyncStorage.getItem(getUserFavoritePointsKey(userId));
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		return normalizeNumberArray(parsed);
	} catch {
		return [];
	}
}

export async function setFavoritePointIds(userId, pointIds) {
	const normalizedIds = normalizeNumberArray(pointIds);
	await AsyncStorage.setItem(getUserFavoritePointsKey(userId), JSON.stringify(normalizedIds));
	return normalizedIds;
}

export async function toggleFavoritePointId(userId, pointId) {
	const current = await getFavoritePointIds(userId);
	const next = current.includes(pointId)
		? current.filter((id) => id !== pointId)
		: [...current, pointId];
	return setFavoritePointIds(userId, next);
}

export async function getFeaturedRouteId() {
	try {
		const raw = await AsyncStorage.getItem(FEATURED_ROUTE_KEY);
		if (!raw) return null;

		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export async function setFeaturedRouteId(routeId) {
	if (typeof routeId !== "number" || !Number.isFinite(routeId)) {
		await AsyncStorage.removeItem(FEATURED_ROUTE_KEY);
		return null;
	}

	await AsyncStorage.setItem(FEATURED_ROUTE_KEY, String(routeId));
	return routeId;
}

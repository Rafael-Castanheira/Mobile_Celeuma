import { BASE_URL, authHeaders, fetchWithTimeout } from "./client";

export async function getMyFavorites(token) {
	const response = await fetchWithTimeout(`${BASE_URL}/favoritos`, {
		method: "GET",
		headers: {
			Accept: "application/json",
			...authHeaders(token),
		},
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar favoritos (${response.status}).`);
	}

	return response.json();
}

export async function addFavoritePoint(pointId, token) {
	const response = await fetchWithTimeout(`${BASE_URL}/favoritos/pontos/${pointId}`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			...authHeaders(token),
		},
	});

	if (!response.ok) {
		throw new Error(`Falha ao adicionar ponto aos favoritos (${response.status}).`);
	}

	return response.json();
}

export async function removeFavoritePoint(pointId, token) {
	const response = await fetchWithTimeout(`${BASE_URL}/favoritos/pontos/${pointId}`, {
		method: "DELETE",
		headers: {
			Accept: "application/json",
			...authHeaders(token),
		},
	});

	if (!response.ok) {
		throw new Error(`Falha ao remover ponto dos favoritos (${response.status}).`);
	}

	return response.json();
}

export async function addFavoriteTrajeto(trajetoId, token) {
	const response = await fetchWithTimeout(`${BASE_URL}/favoritos/trajetos/${trajetoId}`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			...authHeaders(token),
		},
	});

	if (!response.ok) {
		throw new Error(`Falha ao adicionar trajeto aos favoritos (${response.status}).`);
	}

	return response.json();
}

export async function removeFavoriteTrajeto(trajetoId, token) {
	const response = await fetchWithTimeout(`${BASE_URL}/favoritos/trajetos/${trajetoId}`, {
		method: "DELETE",
		headers: {
			Accept: "application/json",
			...authHeaders(token),
		},
	});

	if (!response.ok) {
		throw new Error(`Falha ao remover trajeto dos favoritos (${response.status}).`);
	}

	return response.json();
}

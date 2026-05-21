import { BASE_URL, authHeaders, fetchWithTimeout } from "./client";
import { asRecord, extractRoutePointIds, toNumber } from "./normalize";

const ROUTES_ENDPOINT = `${BASE_URL}/trajeto/list`;

function normalizeMapRoute(value) {
	const trajeto = asRecord(value);
	if (!trajeto) {
		return null;
	}

	const id = toNumber(trajeto.id_trajeto) ?? toNumber(trajeto.id);
	if (id === null) {
		return null;
	}

	const pointIds = extractRoutePointIds(trajeto.Pontos ?? trajeto.pontos ?? trajeto.points);
	if (pointIds.length < 2) {
		return null;
	}

	const upperRoute = asRecord(trajeto.Rota);
	const lowerRoute = asRecord(trajeto.rota);
	const routeName =
		(typeof upperRoute?.name === "string" && upperRoute.name.trim()) ||
		(typeof lowerRoute?.name === "string" && lowerRoute.name.trim()) ||
		(typeof trajeto.name === "string" && trajeto.name.trim()) ||
		(typeof trajeto.description === "string" && trajeto.description.trim()) ||
		`Trajeto #${id}`;

	const video = typeof trajeto.video === "string" && trajeto.video ? trajeto.video : undefined;

	return {
		id,
		name: routeName,
		pointIds,
		...(video ? { video } : {}),
	};
}

function extractTrajetos(payload) {
	if (Array.isArray(payload)) {
		return payload;
	}

	const record = asRecord(payload);
	if (!record) {
		return null;
	}

	if (Array.isArray(record.trajetos)) {
		return record.trajetos;
	}

	if (Array.isArray(record.data)) {
		return record.data;
	}

	return null;
}

export async function getMapRoutes(signal) {
	const response = await fetchWithTimeout(ROUTES_ENDPOINT, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar trajetos (${response.status}).`);
	}

	const payload = await response.json();
	const trajetos = extractTrajetos(payload);
	if (trajetos === null) {
		throw new Error("Resposta inválida da API de trajetos.");
	}

	return trajetos.map((trajeto) => normalizeMapRoute(trajeto)).filter((route) => route !== null);
}

export async function getHighlightedRoute(signal) {
	const response = await fetchWithTimeout(`${BASE_URL}/trajeto/highlighted`, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
		signal,
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`Falha ao carregar trajeto da semana (${response.status}).`);
	}

	const payload = await response.json();
	if (payload?.trajeto) {
		return normalizeMapRoute(payload.trajeto);
	}
	
	return null;
}

export async function createTrajeto(fields, token) {
	const res = await fetchWithTimeout(`${BASE_URL}/trajeto/create`, {
		method: "POST",
		headers: authHeaders(token),
		body: JSON.stringify(fields),
	});
	if (!res.ok) throw new Error(`Erro ao criar trajeto (${res.status}).`);
}

export async function updateTrajetoDescription(id, description, token) {
	const res = await fetchWithTimeout(`${BASE_URL}/trajeto/update-description/${id}`, {
		method: "PATCH",
		headers: authHeaders(token),
		body: JSON.stringify({ description }),
	});
	if (!res.ok) throw new Error(`Erro ao atualizar trajeto (${res.status}).`);
}

export async function deleteRota(id, token) {
	const res = await fetchWithTimeout(`${BASE_URL}/trajeto/rota/delete/${id}`, {
		method: "DELETE",
		headers: authHeaders(token),
	});
	if (!res.ok) throw new Error(`Erro ao eliminar rota (${res.status}).`);
}

export async function highlightRoute(id, highlighted = true, token) {
	const res = await fetchWithTimeout(`${BASE_URL}/trajeto/highlight/${id}`, {
		method: "PATCH",
		headers: authHeaders(token),
		body: JSON.stringify({ highlighted }),
	});
	if (!res.ok) throw new Error(`Erro ao destacar rota (${res.status}).`);
}

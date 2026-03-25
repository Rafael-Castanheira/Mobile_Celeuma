import { BASE_URL } from "./client";

const POINTS_ENDPOINT = `${BASE_URL}/ponto/list`;
const POINT_CATEGORIES_ENDPOINT = `${BASE_URL}/categoria/list`;

function toMapPoint(ponto) {
	return {
		id: ponto.id_ponto,
		title: ponto.name,
		detail: ponto.description ?? "Sem descrição",
		latitude: ponto.latitude,
		longitude: ponto.longitude,
		...(ponto.image ? { image: ponto.image } : {}),
	};
}

export async function getMapPoints(signal) {
	const response = await fetch(POINTS_ENDPOINT, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar pontos (${response.status}).`);
	}

	const payload = await response.json();
	if (!payload || !Array.isArray(payload.pontos)) {
		throw new Error("Resposta inválida da API de pontos.");
	}

	return payload.pontos
		.filter(
			(ponto) =>
				typeof ponto?.id_ponto === "number" &&
				typeof ponto?.name === "string" &&
				typeof ponto?.latitude === "number" &&
				typeof ponto?.longitude === "number"
		)
		.map(toMapPoint);
}

export async function getPointCategories(signal) {
	const response = await fetch(POINT_CATEGORIES_ENDPOINT, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar categorias (${response.status}).`);
	}

	const payload = await response.json();
	if (!payload || !Array.isArray(payload.categorias)) {
		throw new Error("Resposta inválida da API de categorias.");
	}

	return payload.categorias
		.filter((categoria) => typeof categoria?.id_categoria === "number" && typeof categoria?.name === "string")
		.map((categoria) => ({
			id_categoria: categoria.id_categoria,
			name: categoria.name,
		}));
}

export async function createPonto(fields, token) {
	const form = new FormData();
	form.append("name", fields.name);
	if (fields.description) form.append("description", fields.description);
	form.append("latitude", String(fields.latitude));
	form.append("longitude", String(fields.longitude));
	form.append("id_categorias", JSON.stringify(fields.idCategorias));
	form.append("imagePath", fields.imagePath ?? "");
	if (fields.imageFile) {
		form.append("image", {
			uri: fields.imageFile.uri,
			name: fields.imageFile.name ?? "ponto.jpg",
			type: fields.imageFile.type ?? "image/jpeg",
		});
	}
	if (fields.username) form.append("username", fields.username);

	const res = await fetch(`${BASE_URL}/ponto/create`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		body: form,
	});
	if (!res.ok) throw new Error(`Erro ao criar ponto (${res.status}).`);
}

export async function updatePonto(id, fields, token) {
	const form = new FormData();
	if (fields.name !== undefined) form.append("name", fields.name);
	if (fields.description !== undefined) form.append("description", fields.description);
	if (fields.latitude !== undefined) form.append("latitude", String(fields.latitude));
	if (fields.longitude !== undefined) form.append("longitude", String(fields.longitude));

	const res = await fetch(`${BASE_URL}/ponto/update/${id}`, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		body: form,
	});
	if (!res.ok) throw new Error(`Erro ao atualizar ponto (${res.status}).`);
}

export async function deletePonto(id, token) {
	const res = await fetch(`${BASE_URL}/ponto/delete/${id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
	});
	if (!res.ok) throw new Error(`Erro ao eliminar ponto (${res.status}).`);
}

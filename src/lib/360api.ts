export type MapPoint = {
	title: string;
	detail: string;
	latitude: number;
	longitude: number;
};

type ApiPonto = {
	name: string;
	description: string | null;
	latitude: number;
	longitude: number;
};

type ListPontosResponse = {
	pontos: ApiPonto[];
};

const POINTS_ENDPOINT = "http://192.168.0.120:3000/ponto/list";

function toMapPoint(ponto: ApiPonto): MapPoint {
	return {
		title: ponto.name,
		detail: ponto.description ?? "Sem descrição",
		latitude: ponto.latitude,
		longitude: ponto.longitude,
	};
}

export async function getMapPoints(signal?: AbortSignal): Promise<MapPoint[]> {
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

	const payload = (await response.json()) as ListPontosResponse;
	if (!payload || !Array.isArray(payload.pontos)) {
		throw new Error("Resposta inválida da API de pontos.");
	}

	return payload.pontos
		.filter(
			(ponto) =>
				typeof ponto?.name === "string" &&
				typeof ponto?.latitude === "number" &&
				typeof ponto?.longitude === "number"
		)
		.map(toMapPoint);
}

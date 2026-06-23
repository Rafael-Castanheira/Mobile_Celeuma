import { BASE_URL, fetchWithTimeout } from "./client";
import { asRecord } from "./normalize";

function resolveMediaUrl(pathOrUrl) {
	if (!pathOrUrl) return "";
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	if (pathOrUrl.startsWith("data:")) return pathOrUrl;
	const normalizedPath = pathOrUrl.replace(/^\/+/, "");
	const uploadPath = normalizedPath.startsWith("uploads/")
		? normalizedPath
		: `uploads/${normalizedPath}`;
	return `${BASE_URL.replace(/\/+$/, "")}/${uploadPath}`;
}

export async function getPointMobileData(pointId, params = {}, signal) {
	const query = new URLSearchParams();
	if (params.viewPath) query.append("viewPath", params.viewPath);
	if (params.includeAll) query.append("includeAll", "true");

	const endpoint = `${BASE_URL}/mobile/pontos/${pointId}/hotspots?${query.toString()}`;

	const response = await fetchWithTimeout(endpoint, {
		method: "GET",
		headers: { 
            Accept: "application/json",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        },
		signal,
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar dados do ponto (${response.status}).`);
	}

	const payload = await response.json();
	const data = asRecord(payload);

	if (!data || !data.ponto || !Array.isArray(data.hotspots)) {
		throw new Error("Resposta inválida da API de hotspots.");
	}

	// Normaliza URLs caso o backend não tenha devolvido as versões absolutas, 
	// embora no contrato o backend já faça grande parte deste trabalho.
	const normalizedHotspots = data.hotspots.map((h) => ({
		...h,
		navigation_file_url: h.navigation_file_url || (h.navigation_file_path ? resolveMediaUrl(h.navigation_file_path) : ""),
	}));

	return {
		ponto: {
			...data.ponto,
			image_url: data.ponto.image_url || (data.ponto.image_path ? resolveMediaUrl(data.ponto.image_path) : ""),
		},
		hotspots: normalizedHotspots,
		meta: data.meta || { total_hotspots: normalizedHotspots.length, visible_hotspots: normalizedHotspots.length },
	};
}

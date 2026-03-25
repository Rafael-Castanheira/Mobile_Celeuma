import { BASE_URL, authHeaders } from "./client";

export async function getEstatisticasResumo(token) {
	const res = await fetch(`${BASE_URL}/estatistica/resumo`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar estatísticas (${res.status}).`);
	return await res.json();
}

export async function registarVisualizacao(tipo, referencia_id) {
	const res = await fetch(`${BASE_URL}/estatistica/`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ tipo, referencia_id }),
	});
	if (!res.ok && res.status !== 201) throw new Error(`Erro ao registar visualização (${res.status}).`);
}

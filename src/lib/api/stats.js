import Constants from "expo-constants";
import { Platform } from "react-native";
import { BASE_URL, authHeaders, fetchWithTimeout } from "./client";

function getClientInfo() {
	const ownership = Constants?.appOwnership;
	const browser = ownership === "expo" ? "Expo Go" : "React Native";

	const os = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : Platform.OS;

	return {
		deviceType: "mobile",
		browser,
		os,
	};
}

export async function getEstatisticasResumo(token, signal) {
	const res = await fetchWithTimeout(`${BASE_URL}/estatistica/resumo`, {
		headers: authHeaders(token),
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar estatísticas (${res.status}).`);
	return await res.json();
}

export async function registarVisualizacao(tipo, referencia_id, signal) {
	const res = await fetchWithTimeout(`${BASE_URL}/estatistica/`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ tipo, referencia_id, clientInfo: getClientInfo() }),
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao registar visualização (${res.status}).`);
}

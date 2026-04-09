import { BASE_URL, authHeaders } from "./client";
import { asRecord, toNumber } from "./normalize";

function toThemeVariables(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	return Object.entries(value).reduce((acc, [key, entry]) => {
		if (typeof entry === "string") {
			acc[key] = entry;
		}
		return acc;
	}, {});
}

function normalizeThemePreset(value) {
	const record = asRecord(value);
	if (!record) {
		return null;
	}

	const id = toNumber(record.id_theme_preset) ?? toNumber(record.id);
	const name = typeof record.name === "string" ? record.name.trim() : "";
	if (id === null || !name) {
		return null;
	}

	const logoLightUrl = typeof record.logoLightUrl === "string" ? record.logoLightUrl : null;
	const logoDarkUrl = typeof record.logoDarkUrl === "string" ? record.logoDarkUrl : null;
	const description = typeof record.description === "string" ? record.description : null;

	return {
		id_theme_preset: id,
		name,
		description,
		lightVars: toThemeVariables(record.lightVars),
		darkVars: toThemeVariables(record.darkVars),
		logoLightUrl,
		logoDarkUrl,
	};
}

export async function getThemePresets(signal) {
	const res = await fetch(`${BASE_URL}/theme/list`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar temas (${res.status}).`);

	const payload = await res.json();
	if (!Array.isArray(payload?.data)) throw new Error("Resposta inválida da API de temas.");

	return payload.data.map((theme) => normalizeThemePreset(theme)).filter((theme) => theme !== null);
}

export async function getActiveThemePreset(signal) {
	const res = await fetch(`${BASE_URL}/theme/active`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar tema ativo (${res.status}).`);

	const payload = await res.json();
	if (payload?.data == null) return null;

	const theme = normalizeThemePreset(payload.data);
	if (theme === null) throw new Error("Resposta inválida da API de tema ativo.");
	return theme;
}

export async function setActiveThemePreset(presetId, token) {
	const res = await fetch(`${BASE_URL}/theme/set-active`, {
		method: "POST",
		headers: authHeaders(token),
		body: JSON.stringify({ presetId }),
	});
	if (!res.ok) {
		if (res.status === 401) throw new Error("Sessão inválida. Inicia sessão novamente.");
		if (res.status === 403) throw new Error("Sem permissão para definir o tema ativo.");
		throw new Error(`Erro ao definir tema ativo (${res.status}).`);
	}
}

export async function getLandingContent(signal) {
	const res = await fetch(`${BASE_URL}/theme/landing-content`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar conteúdo (${res.status}).`);

	const payload = await res.json();
	const record = asRecord(payload?.data);
	if (!record || typeof record.title !== "string" || typeof record.description !== "string") {
		throw new Error("Resposta inválida do conteúdo de apresentação.");
	}

	return {
		title: record.title,
		description: record.description,
	};
}

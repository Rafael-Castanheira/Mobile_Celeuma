export type MapPoint = {
	id: number;
	title: string;
	detail: string;
	latitude: number;
	longitude: number;
	image?: string;
};

export type MapRoute = {
	id: number;
	name: string;
	pointIds: number[];
	video?: string;
};

type ApiPonto = {
	id_ponto: number;
	name: string;
	description: string | null;
	latitude: number;
	longitude: number;
	image?: string | null;
};

type ApiTrajeto = {
	id_trajeto: number;
	description: string | null;
	video?: string | null;
	Rota?: {
		id_rota?: number;
		name?: string | null;
	};
	Pontos?: Array<{
		id_ponto: number;
		name?: string;
	}>;
};

type ListPontosResponse = {
	pontos: ApiPonto[];
};

type ListTrajetosResponse = {
	trajetos: ApiTrajeto[];
};

type UnknownRecord = Record<string, unknown>;

type ApiEnvelope<T> = {
	success?: boolean;
	data?: T;
};

export type AuthUser = {
	id: number;
	name: string;
	email: string;
	role: string;
};

export type ThemeVariables = Record<string, string>;

export type ThemePreset = {
	id_theme_preset: number;
	name: string;
	description?: string | null;
	lightVars: ThemeVariables | null;
	darkVars: ThemeVariables | null;
	logoLightUrl?: string | null;
	logoDarkUrl?: string | null;
};

export type LandingContent = {
	title: string;
	description: string;
};

const BASE_URL = "http://192.168.0.106:3000";
const POINTS_ENDPOINT = `${BASE_URL}/ponto/list`;
const ROUTES_ENDPOINT = `${BASE_URL}/trajeto/list`;
const LOGIN_ENDPOINT = `${BASE_URL}/auth/login`;
const ME_ENDPOINT = `${BASE_URL}/auth/me`;

function toMapPoint(ponto: ApiPonto): MapPoint {
	return {
		id: ponto.id_ponto,
		title: ponto.name,
		detail: ponto.description ?? "Sem descrição",
		latitude: ponto.latitude,
		longitude: ponto.longitude,
		...(ponto.image ? { image: ponto.image } : {}),
	};
}

function toMapRoute(trajeto: ApiTrajeto): MapRoute | null {
	const pointIds = Array.isArray(trajeto.Pontos)
		? trajeto.Pontos
				.map((ponto) => ponto?.id_ponto)
				.filter((id): id is number => typeof id === "number")
		: [];

	if (pointIds.length < 2) {
		return null;
	}

	return {
		id: trajeto.id_trajeto,
		name: trajeto.Rota?.name?.trim() || trajeto.description?.trim() || `Trajeto #${trajeto.id_trajeto}`,
		pointIds,
		...(trajeto.video ? { video: trajeto.video } : {}),
	};
}

function asRecord(value: unknown): UnknownRecord | null {
	return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function toNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractRoutePointIds(value: unknown): number[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (typeof item === "number") {
				return item;
			}

			const record = asRecord(item);
			if (!record) {
				return null;
			}

			return toNumber(record.id_ponto) ?? toNumber(record.id) ?? toNumber(record.idPoint);
		})
		.filter((id): id is number => typeof id === "number");
}

function normalizeMapRoute(value: unknown): MapRoute | null {
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

function extractTrajetos(payload: unknown): unknown[] | null {
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

function toThemeVariables(value: unknown): ThemeVariables | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	return Object.entries(value as Record<string, unknown>).reduce<ThemeVariables>((acc, [key, entry]) => {
		if (typeof entry === "string") {
			acc[key] = entry;
		}
		return acc;
	}, {});
}

function normalizeThemePreset(value: unknown): ThemePreset | null {
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
				typeof ponto?.id_ponto === "number" &&
				typeof ponto?.name === "string" &&
				typeof ponto?.latitude === "number" &&
				typeof ponto?.longitude === "number"
		)
		.map(toMapPoint);
}

export async function getMapRoutes(signal?: AbortSignal): Promise<MapRoute[]> {
	const response = await fetch(ROUTES_ENDPOINT, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(`Falha ao carregar trajetos (${response.status}).`);
	}

	const payload = (await response.json()) as ListTrajetosResponse | unknown;
	const trajetos = extractTrajetos(payload);
	if (trajetos === null) {
		throw new Error("Resposta inválida da API de trajetos.");
	}

	return trajetos
		.map((trajeto) => normalizeMapRoute(trajeto))
		.filter((route): route is MapRoute => route !== null);
}

// ─── Autenticação ────────────────────────────────────────────────────────────

type LoginResponse = { authToken?: string; message?: string };

type MeResponse = {
	isAuthorized?: boolean;
	user?: {
		user?: number;
		id_user?: number;
		name?: string;
		email?: string;
		role?: string;
	};
};

export async function loginUser(
	email: string,
	password: string
): Promise<{ token: string; user: AuthUser }> {
	const response = await fetch(LOGIN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		let message = "Erro no servidor. Tente novamente.";
		try {
			const data = (await response.json()) as LoginResponse;
			if (typeof data?.message === "string" && data.message) message = data.message;
		} catch {
			// ignora erros ao parsear corpo de erro
		}
		if (response.status === 403) message = "Conta bloqueada. Contacte o administrador.";
		throw new Error(message);
	}

	const data = (await response.json()) as LoginResponse;
	if (typeof data?.authToken !== "string") {
		throw new Error("Resposta inesperada do servidor.");
	}

	const user = await getMe(data.authToken);
	return { token: data.authToken, user };
}

export async function getMe(token: string): Promise<AuthUser> {
	const response = await fetch(ME_ENDPOINT, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error("Token inválido ou expirado.");
	}

	const data = (await response.json()) as MeResponse;
	const u = data?.user;

	if (!u || typeof u.name !== "string" || typeof u.email !== "string") {
		throw new Error("Resposta inválida do servidor.");
	}

	return {
		id: (u.user ?? u.id_user ?? 0) as number,
		name: u.name,
		email: u.email,
		role: u.role ?? "User",
	};
}

// ─── Utilizadores ────────────────────────────────────────────────────────────

export type ApiUser = {
	id_user: number;
	name: string;
	email: string;
	active: boolean;
	Role: { name: string };
};

function authHeaders(token: string) {
	return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function getUsers(token: string): Promise<ApiUser[]> {
	const res = await fetch(`${BASE_URL}/user/list`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar utilizadores (${res.status}).`);
	const data = (await res.json()) as { success?: boolean; data?: ApiUser[] };
	if (!Array.isArray(data?.data)) throw new Error("Resposta inválida da API de utilizadores.");
	return data.data;
}

export async function updateUserRole(id: number, role: string, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/user/update-role/${id}`, {
		method: "PATCH",
		headers: authHeaders(token),
		body: JSON.stringify({ role }),
	});
	if (!res.ok) throw new Error(`Erro ao atualizar role (${res.status}).`);
}

export async function blockUser(id: number, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/user/block/${id}`, { method: "PATCH", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao bloquear utilizador (${res.status}).`);
}

export async function unblockUser(id: number, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/user/unblock/${id}`, { method: "PATCH", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao desbloquear utilizador (${res.status}).`);
}

export async function deleteUser(id: number, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/user/delete/${id}`, { method: "DELETE", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao eliminar utilizador (${res.status}).`);
}

export async function getUserRoles(token: string): Promise<{ id_role: number; name: string }[]> {
	const res = await fetch(`${BASE_URL}/user/roles`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar roles (${res.status}).`);
	const data = (await res.json()) as { success?: boolean; data?: { id_role: number; name: string }[] };
	if (!Array.isArray(data?.data)) throw new Error("Resposta inválida da API de roles.");
	return data.data;
}

// ─── Pontos (Admin) ───────────────────────────────────────────────────────────

export async function createPonto(
	fields: { name: string; description?: string; latitude: number; longitude: number; username?: string },
	token: string
): Promise<void> {
	const form = new FormData();
	form.append("name", fields.name);
	if (fields.description) form.append("description", fields.description);
	form.append("latitude", String(fields.latitude));
	form.append("longitude", String(fields.longitude));
	if (fields.username) form.append("username", fields.username);

	const res = await fetch(`${BASE_URL}/ponto/create`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		body: form,
	});
	if (!res.ok) throw new Error(`Erro ao criar ponto (${res.status}).`);
}

export async function updatePonto(
	id: number,
	fields: { name?: string; description?: string; latitude?: number; longitude?: number },
	token: string
): Promise<void> {
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

export async function deletePonto(id: number, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/ponto/delete/${id}`, {
		method: "DELETE",
		headers: authHeaders(token),
	});
	if (!res.ok) throw new Error(`Erro ao eliminar ponto (${res.status}).`);
}

// ─── Trajetos (Admin) ─────────────────────────────────────────────────────────

export async function createTrajeto(
	fields: { pontos: number[]; description?: string },
	token: string
): Promise<void> {
	const res = await fetch(`${BASE_URL}/trajeto/create`, {
		method: "POST",
		headers: authHeaders(token),
		body: JSON.stringify(fields),
	});
	if (!res.ok) throw new Error(`Erro ao criar trajeto (${res.status}).`);
}

export async function updateTrajetoDescription(id: number, description: string, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/trajeto/update-description/${id}`, {
		method: "PATCH",
		headers: authHeaders(token),
		body: JSON.stringify({ description }),
	});
	if (!res.ok) throw new Error(`Erro ao atualizar trajeto (${res.status}).`);
}

export async function deleteRota(id: number, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/trajeto/rota/delete/${id}`, {
		method: "DELETE",
		headers: authHeaders(token),
	});
	if (!res.ok) throw new Error(`Erro ao eliminar rota (${res.status}).`);
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

export type EstatisticasResumo = {
	totalVisualizacoes: number;
	totalPontos: number;
	totalTrajetos: number;
	novosPontos: number;
	novosTrajetos: number;
	percentagemVisualizacoes: number;
	pontoMaisVisto: { nome: string; total: string } | null;
	rotaMaisVista: { nome: string; total: string } | null;
};

export async function getEstatisticasResumo(token: string): Promise<EstatisticasResumo> {
	const res = await fetch(`${BASE_URL}/estatistica/resumo`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar estatísticas (${res.status}).`);
	return (await res.json()) as EstatisticasResumo;
}

export async function registarVisualizacao(tipo: "ponto" | "rota", referencia_id: number): Promise<void> {
	const res = await fetch(`${BASE_URL}/estatistica/`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ tipo, referencia_id }),
	});
	if (!res.ok && res.status !== 201) throw new Error(`Erro ao registar visualização (${res.status}).`);
}

// ─── Temas ───────────────────────────────────────────────────────────────────

export async function getThemePresets(signal?: AbortSignal): Promise<ThemePreset[]> {
	const res = await fetch(`${BASE_URL}/theme/list`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar temas (${res.status}).`);

	const payload = (await res.json()) as ApiEnvelope<unknown[]>;
	if (!Array.isArray(payload?.data)) throw new Error("Resposta inválida da API de temas.");

	return payload.data
		.map((theme) => normalizeThemePreset(theme))
		.filter((theme): theme is ThemePreset => theme !== null);
}

export async function getActiveThemePreset(signal?: AbortSignal): Promise<ThemePreset | null> {
	const res = await fetch(`${BASE_URL}/theme/active`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar tema ativo (${res.status}).`);

	const payload = (await res.json()) as ApiEnvelope<unknown | null>;
	if (payload?.data == null) return null;

	const theme = normalizeThemePreset(payload.data);
	if (theme === null) throw new Error("Resposta inválida da API de tema ativo.");
	return theme;
}

export async function setActiveThemePreset(presetId: number | null, token: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/theme/set-active`, {
		method: "POST",
		headers: authHeaders(token),
		body: JSON.stringify({ presetId }),
	});
	if (!res.ok) throw new Error(`Erro ao definir tema ativo (${res.status}).`);
}

export async function getLandingContent(signal?: AbortSignal): Promise<LandingContent> {
	const res = await fetch(`${BASE_URL}/theme/landing-content`, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!res.ok) throw new Error(`Erro ao carregar conteúdo (${res.status}).`);

	const payload = (await res.json()) as ApiEnvelope<unknown>;
	const record = asRecord(payload?.data);
	if (!record || typeof record.title !== "string" || typeof record.description !== "string") {
		throw new Error("Resposta inválida do conteúdo de apresentação.");
	}

	return {
		title: record.title,
		description: record.description,
	};
}

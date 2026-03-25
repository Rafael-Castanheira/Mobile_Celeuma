import { BASE_URL, fetchWithTimeout } from "./client";

const LOGIN_ENDPOINT = `${BASE_URL}/auth/login`;
const REGISTER_ENDPOINT = `${BASE_URL}/auth/registo`;
const ME_ENDPOINT = `${BASE_URL}/auth/me`;

export async function loginUser(email, password) {
	const response = await fetchWithTimeout(LOGIN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		let message = "Erro no servidor. Tente novamente.";
		try {
			const data = await response.json();
			if (typeof data?.message === "string" && data.message) message = data.message;
		} catch {
			// ignora erros ao parsear corpo de erro
		}
		if (response.status === 403) message = "Conta bloqueada. Contacte o administrador.";
		throw new Error(message);
	}

	const data = await response.json();
	if (typeof data?.authToken !== "string") {
		throw new Error("Resposta inesperada do servidor.");
	}

	const user = await getMe(data.authToken);
	return { token: data.authToken, user };
}

export async function registerUser(name, email, password) {
	let response;
	try {
		response = await fetchWithTimeout(REGISTER_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({ name, email, password }),
		});
	} catch (error) {
		if (error instanceof Error && error.message.includes("expirou")) {
			throw error;
		}
		throw new Error("Erro no registo. Tente novamente.");
	}

	let payload = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const message =
			typeof payload?.message === "string" && payload.message
				? payload.message
				: "Não foi possível criar a conta. Tente novamente.";
		throw new Error(message);
	}

	return typeof payload?.message === "string" && payload.message
		? payload.message
		: "Conta criada com sucesso. Verifique o email para confirmar a conta.";
}

export async function getMe(token) {
	const response = await fetchWithTimeout(ME_ENDPOINT, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error("Token inválido ou expirado.");
	}

	const data = await response.json();
	const u = data?.user;

	if (!u || typeof u.name !== "string" || typeof u.email !== "string") {
		throw new Error("Resposta inválida do servidor.");
	}

	return {
		id: Number(u.user ?? u.id_user ?? 0),
		name: u.name,
		email: u.email,
		role: u.role ?? "User",
	};
}

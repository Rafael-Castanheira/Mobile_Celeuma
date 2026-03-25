export const BASE_URL = "http://100.68.232.113:3000";
export const REQUEST_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(input, init, timeoutMs = REQUEST_TIMEOUT_MS) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("A ligação ao servidor expirou. Verifique a conexão e tente novamente.");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

export function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"Content-Type": "application/json",
	};
}

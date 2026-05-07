import Constants from "expo-constants";

const DEFAULT_BASE_URL = "http://100.68.232.113:3000";

function normalizeBaseUrl(value) {
	const raw = String(value || "").trim();
	if (!raw) return "";
	return raw.replace(/\/+$/, "");
}

/**
 * Base URL do backend.
 *
 * Preferência (por ordem):
 * - `EXPO_PUBLIC_API_URL` (recomendado)
 * - `expo.extra.apiBaseUrl` (opcional)
 * - fallback para DEFAULT_BASE_URL
 */
export const BASE_URL = (() => {
	const envUrl = typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_URL : undefined;
	const extraUrl = Constants?.expoConfig?.extra?.apiBaseUrl;
	return normalizeBaseUrl(envUrl || extraUrl || DEFAULT_BASE_URL);
})();

// Aumentado para 45s para suportar ligações móveis lentas / payloads maiores.
export const REQUEST_TIMEOUT_MS = 45000;

export async function fetchWithTimeout(input, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
	let didTimeout = false;
	const controller = new AbortController();
	const upstreamSignal = init?.signal;
	let abortListener = null;

	if (upstreamSignal) {
		if (upstreamSignal.aborted) {
			controller.abort();
		} else if (typeof upstreamSignal.addEventListener === "function") {
			abortListener = () => controller.abort();
			upstreamSignal.addEventListener("abort", abortListener, { once: true });
		}
	}

	const timeoutId = setTimeout(() => {
		didTimeout = true;
		controller.abort();
	}, timeoutMs);

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} catch (error) {
		const isAbortError =
			!!error &&
			typeof error === "object" &&
			"name" in error &&
			error.name === "AbortError";

		if (isAbortError) {
			if (didTimeout) {
				throw new Error("A ligação ao servidor expirou. Verifique a conexão e tente novamente.");
			}
			// Abort externo (ex: navegação/unmount). Preservar AbortError para o caller poder ignorar.
			throw error;
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
		if (abortListener && typeof upstreamSignal?.removeEventListener === "function") {
			upstreamSignal.removeEventListener("abort", abortListener);
		}
	}
}

export function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"Content-Type": "application/json",
	};
}

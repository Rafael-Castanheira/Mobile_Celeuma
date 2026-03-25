import { BASE_URL, authHeaders } from "./client";

export async function getUsers(token) {
	const res = await fetch(`${BASE_URL}/user/list`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar utilizadores (${res.status}).`);
	const data = await res.json();
	if (!Array.isArray(data?.data)) throw new Error("Resposta inválida da API de utilizadores.");
	return data.data;
}

export async function updateUserRole(id, role, token) {
	const res = await fetch(`${BASE_URL}/user/update-role/${id}`, {
		method: "PATCH",
		headers: authHeaders(token),
		body: JSON.stringify({ role }),
	});
	if (!res.ok) throw new Error(`Erro ao atualizar role (${res.status}).`);
}

export async function blockUser(id, token) {
	const res = await fetch(`${BASE_URL}/user/block/${id}`, { method: "PATCH", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao bloquear utilizador (${res.status}).`);
}

export async function unblockUser(id, token) {
	const res = await fetch(`${BASE_URL}/user/unblock/${id}`, { method: "PATCH", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao desbloquear utilizador (${res.status}).`);
}

export async function deleteUser(id, token) {
	const res = await fetch(`${BASE_URL}/user/delete/${id}`, { method: "DELETE", headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao eliminar utilizador (${res.status}).`);
}

export async function getUserRoles(token) {
	const res = await fetch(`${BASE_URL}/user/roles`, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`Erro ao carregar roles (${res.status}).`);
	const data = await res.json();
	if (!Array.isArray(data?.data)) throw new Error("Resposta inválida da API de roles.");
	return data.data;
}

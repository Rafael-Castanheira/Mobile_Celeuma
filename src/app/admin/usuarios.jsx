import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import {
    blockUser,
    deleteUser,
    getUsers,
    unblockUser,
    updateUserRole,
} from "../../lib/360api";

const ROLES = ["Admin", "User"];

export default function UsuariosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token } = useAuth();
	const { colors } = useAppTheme();
	const { showDialog, showError, showConfirm } = useDialog();
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const load = useCallback(async () => {
		if (!token) {
			setUsers([]);
			setError("Sessão inválida. Por favor, inicie sessão novamente.");
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			setUsers(await getUsers(token));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		load();
	}, [load]);

	function confirmDelete(user) {
		showConfirm({
			title: "Eliminar utilizador",
			message: `Tens a certeza que queres eliminar "${user.name}"?`,
			confirmText: "Eliminar",
			confirmVariant: "destructive",
			onConfirm: async () => {
				if (!token) {
					showError("Sessão inválida. Por favor, inicie sessão novamente.");
					return;
				}
				try {
					await deleteUser(user.id_user, token);
					await load();
				} catch (e) {
					showError(e instanceof Error ? e.message : "Erro ao eliminar.");
				}
			},
		});
	}

	function promptRoleChange(user) {
		const otherRoles = ROLES.filter((r) => r !== user.Role.name);
		showDialog({
			title: "Alterar role",
			message: `Role atual: ${user.Role.name}`,
			buttons: [
				...otherRoles.map((role) => ({
					text: `Mudar para ${role}`,
					variant: "primary",
					onPress: async () => {
						if (!token) {
							showError("Sessão inválida. Por favor, inicie sessão novamente.");
							return;
						}
						try {
							await updateUserRole(user.id_user, role, token);
							await load();
						} catch (e) {
							showError(e instanceof Error ? e.message : "Erro ao atualizar.");
						}
					},
				})),
				{ text: "Cancelar", variant: "secondary" },
			],
		});
	}

	async function toggleBlock(user) {
		if (!token) {
			showError("Sessão inválida. Por favor, inicie sessão novamente.");
			return;
		}
		try {
			if (user.active) {
				await blockUser(user.id_user, token);
			} else {
				await unblockUser(user.id_user, token);
			}
			await load();
		} catch (e) {
			showError(e instanceof Error ? e.message : "Erro ao alterar estado.");
		}
	}

	function renderUser({ item }) {
		return (
			<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
				<View style={styles.cardInfo}>
					<View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
						<Text style={[styles.avatarText, { color: colors.primary }]}>{item.name.charAt(0).toUpperCase()}</Text>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={[styles.userName, { color: colors.foreground }]}>{item.name}</Text>
						<Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{item.email}</Text>
						<View style={styles.pillRow}>
							<View style={[styles.pill, { backgroundColor: item.active ? colors.accentSoft : colors.destructive }, item.active && { borderWidth: 1, borderColor: colors.border }]}>
								<Text style={styles.pillText}>{item.active ? "Ativo" : "Bloqueado"}</Text>
							</View>
							<View style={[styles.pill, { backgroundColor: colors.muted }]}>
								<Text style={[styles.pillText, { color: colors.secondaryForeground }]}>{item.Role.name}</Text>
							</View>
						</View>
					</View>
				</View>
				<View style={styles.actions}>
					<Pressable style={styles.actionBtn} onPress={() => promptRoleChange(item)}>
						<Feather name="shield" size={16} color={colors.iconMuted} />
					</Pressable>
					<Pressable style={styles.actionBtn} onPress={() => toggleBlock(item)}>
						<Feather name={item.active ? "lock" : "unlock"} size={16} color={colors.iconMuted} />
					</Pressable>
					<Pressable style={styles.actionBtn} onPress={() => confirmDelete(item)}>
						<Feather name="trash-2" size={16} color={colors.destructive} />
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
			{/* Header */}
			<View style={[styles.header, { borderBottomColor: colors.border }]}>
				<Pressable onPress={() => router.back()} style={styles.backBtn}>
					<Feather name="arrow-left" size={20} color={colors.foreground} />
				</Pressable>
				<Text style={[styles.title, { color: colors.foreground }]}>Utilizadores</Text>
				<Pressable onPress={load} style={styles.backBtn}>
					<Feather name="refresh-cw" size={18} color={colors.foreground} />
				</Pressable>
			</View>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && (
				<Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
			)}
			{!loading && !error && (
				<FlatList
					data={users}
					keyExtractor={(item) => String(item.id_user)}
					renderItem={renderUser}
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 32 }}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0d0000" },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255,255,255,0.06)",
	},
	backBtn: { padding: 6 },
	title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
	card: {
		backgroundColor: "#1a0a0a",
		borderRadius: 12,
		padding: 14,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
	},
	cardInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
	avatar: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: "#7f1d1d",
		alignItems: "center",
		justifyContent: "center",
	},
	avatarText: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
	userName: { color: "#f8fafc", fontWeight: "600", fontSize: 14 },
	userEmail: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
	pillRow: { flexDirection: "row", gap: 6, marginTop: 6 },
	pill: {
		backgroundColor: "rgba(255,255,255,0.08)",
		borderRadius: 20,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	pillActive: { backgroundColor: "rgba(34,197,94,0.15)" },
	pillBlocked: { backgroundColor: "rgba(239,68,68,0.15)" },
	pillText: { color: "#f8fafc", fontSize: 11 },
	actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
	actionBtn: { padding: 8 },
});

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import {
	type ApiUser,
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
	const [users, setUsers] = useState<ApiUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		if (!token) return;
		setLoading(true);
		setError(null);
		try {
			setUsers(await getUsers(token));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	function confirmDelete(user: ApiUser) {
		Alert.alert(
			"Eliminar utilizador",
			`Tens a certeza que queres eliminar "${user.name}"?`,
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Eliminar",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteUser(user.id_user, token!);
							await load();
						} catch (e) {
							Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao eliminar.");
						}
					},
				},
			]
		);
	}

	function promptRoleChange(user: ApiUser) {
		const otherRoles = ROLES.filter((r) => r !== user.Role.name);
		Alert.alert(
			"Alterar role",
			`Role atual: ${user.Role.name}`,
			[
				...otherRoles.map((role) => ({
					text: `Mudar para ${role}`,
					onPress: async () => {
						try {
							await updateUserRole(user.id_user, role, token!);
							await load();
						} catch (e) {
							Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao atualizar.");
						}
					},
				})),
				{ text: "Cancelar", style: "cancel" },
			]
		);
	}

	async function toggleBlock(user: ApiUser) {
		try {
			if (user.active) {
				await blockUser(user.id_user, token!);
			} else {
				await unblockUser(user.id_user, token!);
			}
			await load();
		} catch (e) {
			Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao alterar estado.");
		}
	}

	function renderUser({ item }: { item: ApiUser }) {
		return (
			<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSoft }]}> 
				<View style={styles.cardInfo}>
					<View style={[styles.avatar, { backgroundColor: colors.primaryStrong }]}> 
						<Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
						<Text style={[styles.userEmail, { color: colors.textMuted }]}>{item.email}</Text>
						<View style={styles.pillRow}>
							<View style={[styles.pill, item.active ? styles.pillActive : styles.pillBlocked]}>
								<Text style={styles.pillText}>{item.active ? "Ativo" : "Bloqueado"}</Text>
							</View>
							<View style={[styles.pill, { backgroundColor: colors.primarySoft }]}> 
								<Text style={styles.pillText}>{item.Role.name}</Text>
							</View>
						</View>
					</View>
				</View>
				<View style={styles.actions}>
					<Pressable style={styles.actionBtn} onPress={() => promptRoleChange(item)}>
						<Feather name="shield" size={16} color={colors.textMuted} />
					</Pressable>
					<Pressable style={styles.actionBtn} onPress={() => toggleBlock(item)}>
						<Feather name={item.active ? "lock" : "unlock"} size={16} color={colors.textMuted} />
					</Pressable>
					<Pressable style={styles.actionBtn} onPress={() => confirmDelete(item)}>
						<Feather name="trash-2" size={16} color={colors.danger} />
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { paddingTop: top, backgroundColor: colors.background }]}> 
			{/* Header */}
			<View style={[styles.header, { borderBottomColor: colors.borderSoft }]}> 
				<Pressable onPress={() => router.back()} style={styles.backBtn}>
					<Feather name="arrow-left" size={20} color={colors.text} />
				</Pressable>
				<Text style={[styles.title, { color: colors.text }]}>Utilizadores</Text>
				<Pressable onPress={load} style={styles.backBtn}>
					<Feather name="refresh-cw" size={18} color={colors.text} />
				</Pressable>
			</View>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && (
				<Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
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
	errorText: { color: "#ef4444", textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
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
	pillText: { color: "#cbd5e1", fontSize: 11 },
	actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
	actionBtn: { padding: 8 },
});

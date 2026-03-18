import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";

type QuickAction = {
	icon: React.ComponentProps<typeof Feather>["name"];
	label: string;
	description: string;
	route: string;
};

const QUICK_ACTIONS: QuickAction[] = [
	{
		icon: "map",
		label: "Mapa",
		description: "Abrir mapa e explorar galerias",
		route: "/mapa",
	},
	{
		icon: "users",
		label: "Utilizadores",
		description: "Gerir contas e roles",
		route: "/admin/usuarios",
	},
	{
		icon: "map-pin",
		label: "Pontos",
		description: "Adicionar e editar pontos",
		route: "/admin/pontos",
	},
	{
		icon: "navigation",
		label: "Trajetos",
		description: "Criar e gerir trajetos",
		route: "/admin/trajetos",
	},
	{
		icon: "bar-chart-2",
		label: "Estatísticas",
		description: "Ver métricas do sistema",
		route: "/admin/estatisticas",
	},
	{
		icon: "droplet",
		label: "Temas",
		description: "Selecionar o preset ativo",
		route: "/admin/temas",
	},
];

export default function AdminDashboard() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { user, clearAuth } = useAuth();
	const { colors } = useAppTheme();

	function handleLogout() {
		clearAuth();
		router.replace("/login");
	}

	return (
		<ScrollView
			contentContainerStyle={[
				styles.container,
				{ paddingTop: top + 16, paddingBottom: bottom + 32, backgroundColor: colors.background },
			]}
			showsVerticalScrollIndicator={false}
		>
			{/* Header */}
			<View style={styles.header}>
				<View>
					<Text style={[styles.muted, { color: colors.textMuted }]}>Painel de Administração</Text>
					<Text style={[styles.title, { color: colors.text }]}>
						Olá, {user?.name?.split(" ")[0] ?? "Admin"} 👋
					</Text>
					<View style={[styles.badge, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}> 
						<Feather name="shield" size={11} color={colors.primary} />
						<Text style={[styles.badgeText, { color: colors.primary }]}>Admin</Text>
					</View>
				</View>
				<Pressable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
					<Feather name="log-out" size={18} color={colors.textMuted} />
				</Pressable>
			</View>

			{/* Info user */}
			<View style={[styles.userCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
				<View style={[styles.avatar, { backgroundColor: colors.primaryStrong }]}> 
					<Text style={styles.avatarText}>
						{user?.name?.charAt(0).toUpperCase() ?? "A"}
					</Text>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={[styles.userName, { color: colors.text }]}>{user?.name ?? "—"}</Text>
					<Text style={[styles.userEmail, { color: colors.textMuted }]}>{user?.email ?? "—"}</Text>
				</View>
				<View style={[styles.rolePill, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}> 
					<Text style={[styles.rolePillText, { color: colors.primary }]}>{user?.role ?? "Admin"}</Text>
				</View>
			</View>

			{/* Ações rápidas */}
			<Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Gestão</Text>
			<View style={styles.actionsGrid}>
				{QUICK_ACTIONS.map((action) => (
					<Pressable
						key={action.label}
						style={({ pressed }) => [
							styles.actionCard,
							{ backgroundColor: colors.surfaceAlt, borderColor: colors.border, shadowColor: colors.shadow },
							pressed && [styles.actionCardPressed, { borderColor: colors.primaryStrong }],
						]}
						onPress={() => router.push(action.route as never)}
					>
						<View style={[styles.actionIconCircle, { backgroundColor: colors.primarySoft }]}> 
							<Feather name={action.icon} size={22} color={colors.primary} />
						</View>
						<Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
						<Text style={[styles.actionDesc, { color: colors.textMuted }]}>{action.description}</Text>
					</Pressable>
				))}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		backgroundColor: "#0d0000",
		paddingHorizontal: 24,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 24,
	},
	muted: {
		color: "rgba(248,250,252,0.5)",
		textTransform: "uppercase",
		fontSize: 11,
		letterSpacing: 2,
		marginBottom: 4,
	},
	title: {
		color: "#f8fafc",
		fontSize: 26,
		fontWeight: "800",
		marginBottom: 8,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: "rgba(220,38,38,0.15)",
		borderWidth: 1,
		borderColor: "rgba(220,38,38,0.35)",
		borderRadius: 20,
		paddingHorizontal: 10,
		paddingVertical: 4,
		alignSelf: "flex-start",
	},
	badgeText: {
		color: "#dc2626",
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.5,
	},
	logoutBtn: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: "#1e0000",
		borderWidth: 1,
		borderColor: "#3d0000",
		alignItems: "center",
		justifyContent: "center",
	},
	userCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		backgroundColor: "#1e0000",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#3d0000",
		padding: 16,
		marginBottom: 28,
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "#7a1313",
		alignItems: "center",
		justifyContent: "center",
	},
	avatarText: {
		color: "#f8fafc",
		fontSize: 20,
		fontWeight: "700",
	},
	userName: {
		color: "#f8fafc",
		fontSize: 15,
		fontWeight: "700",
		marginBottom: 2,
	},
	userEmail: {
		color: "rgba(248,250,252,0.5)",
		fontSize: 12,
	},
	rolePill: {
		backgroundColor: "rgba(220,38,38,0.15)",
		borderWidth: 1,
		borderColor: "rgba(220,38,38,0.35)",
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	rolePillText: {
		color: "#dc2626",
		fontSize: 11,
		fontWeight: "700",
	},
	sectionTitle: {
		color: "rgba(248,250,252,0.5)",
		textTransform: "uppercase",
		fontSize: 11,
		letterSpacing: 2,
		marginBottom: 14,
	},
	actionsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 14,
	},
	actionCard: {
		width: "47%",
		backgroundColor: "#1e0000",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#3d0000",
		padding: 18,
		elevation: 4,
		shadowColor: "#dc2626",
		shadowOpacity: 0.2,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
	},
	actionCardPressed: {
		opacity: 0.7,
		borderColor: "#7a1313",
	},
	actionIconCircle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "rgba(220,38,38,0.12)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 12,
	},
	actionLabel: {
		color: "#f8fafc",
		fontSize: 15,
		fontWeight: "700",
		marginBottom: 4,
	},
	actionDesc: {
		color: "rgba(248,250,252,0.45)",
		fontSize: 12,
		lineHeight: 17,
	},
});

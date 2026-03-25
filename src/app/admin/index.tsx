import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../../components/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import { isAdminRole } from "../../lib/auth";

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
		route: "/(tabs)/mapa",
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
	const { colors, activePreset } = useAppTheme();
	const canManageContent = isAdminRole(user?.role);
	const quickActions = canManageContent
		? QUICK_ACTIONS
		: QUICK_ACTIONS.filter((action) => !["Pontos", "Trajetos", "Estatísticas"].includes(action.label));

	function handleLogout() {
		clearAuth();
		router.replace("/login");
	}

	return (
		<ScrollView
			contentContainerStyle={[
				styles.container,
				{ backgroundColor: colors.background, paddingTop: top + 16, paddingBottom: bottom + 32 },
			]}
			showsVerticalScrollIndicator={false}
		>
			{/* Header */}
			<View style={styles.header}>
				<View>
					<BrandLogo size={54} iconSize={24} withFrame />
					<Text style={[styles.muted, { color: colors.mutedForeground }]}>Área de Administração</Text>
					<Text style={[styles.title, { color: colors.foreground }]}>
						Olá, {user?.name?.split(" ")[0] ?? "Admin"} 👋
					</Text>
					{activePreset?.description ? (
						<Text style={[styles.themeDescription, { color: colors.mutedForeground }]}>{activePreset.description}</Text>
					) : null}
					<View style={[styles.badge, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
						<Feather name="shield" size={11} color={colors.primary} />
						<Text style={[styles.badgeText, { color: colors.primary }]}>{canManageContent ? "Admin" : "Utilizador"}</Text>
					</View>
				</View>
				<Pressable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
					<Feather name="log-out" size={18} color={colors.iconMuted} />
				</Pressable>
			</View>

			{/* Info user */}
			<View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
				<View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
					<Text style={[styles.avatarText, { color: colors.primary }]}>
						{user?.name?.charAt(0).toUpperCase() ?? "A"}
					</Text>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={[styles.userName, { color: colors.foreground }]}>{user?.name ?? "—"}</Text>
					<Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email ?? "—"}</Text>
				</View>
				<View style={[styles.rolePill, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
					<Text style={[styles.rolePillText, { color: colors.primary }]}>{user?.role ?? "Admin"}</Text>
				</View>
			</View>

			{/* Ações rápidas */}
			<Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Gestão</Text>
			<View style={styles.actionsGrid}>
				{quickActions.map((action) => (
					<Pressable
						key={action.label}
						style={({ pressed }) => [
							styles.actionCard,
							{ backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
							pressed && [styles.actionCardPressed, { borderColor: colors.primary }],
						]}
						onPress={() => router.push(action.route as never)}
					>
						<View style={[styles.actionIconCircle, { backgroundColor: colors.accentSoft }]}>
							<Feather name={action.icon} size={22} color={colors.primary} />
						</View>
						<Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
						<Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>{action.description}</Text>
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
		marginTop: 12,
	},
	title: {
		color: "#f8fafc",
		fontSize: 26,
		fontWeight: "800",
		marginBottom: 8,
	},
	themeDescription: {
		fontSize: 12,
		lineHeight: 18,
		maxWidth: 250,
		marginBottom: 8,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		borderWidth: 1,
		borderRadius: 20,
		paddingHorizontal: 10,
		paddingVertical: 4,
		alignSelf: "flex-start",
	},
	badgeText: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.5,
	},
	logoutBtn: {
		width: 42,
		height: 42,
		borderRadius: 21,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	userCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		borderRadius: 18,
		borderWidth: 1,
		padding: 16,
		marginBottom: 28,
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarText: {
		fontSize: 20,
		fontWeight: "700",
	},
	userName: {
		fontSize: 15,
		fontWeight: "700",
		marginBottom: 2,
	},
	userEmail: {
		fontSize: 12,
	},
	rolePill: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	rolePillText: {
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
		borderRadius: 18,
		borderWidth: 1,
		padding: 18,
		elevation: 4,
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
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 12,
	},
	actionLabel: {
		fontSize: 15,
		fontWeight: "700",
		marginBottom: 4,
	},
	actionDesc: {
		fontSize: 12,
		lineHeight: 17,
	},
});

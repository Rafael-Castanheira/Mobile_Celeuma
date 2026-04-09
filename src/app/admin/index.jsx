import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../../components/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getMapRoutes } from "../../lib/360api";
import { isAdminRole } from "../../lib/auth";
import { getFeaturedRouteId } from "../../lib/preferences";

const ADMIN_QUICK_ACTIONS = [
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

const USER_QUICK_ACTIONS = [
	{
		icon: "map",
		label: "Mapa",
		description: "Abrir mapa e explorar galerias",
		route: "/(tabs)/mapa",
	},
	{
		icon: "star",
		label: "Favoritos",
		description: "Guardar e gerir pontos favoritos",
		route: "/admin/favoritos",
	},
	{
		icon: "navigation",
		label: "Rota em destaque",
		description: "Ver a rota selecionada pelo admin",
		route: "/admin/rota-destaque",
	},
];

export default function AdminDashboard() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { user, clearAuth } = useAuth();
	const { colors, mode, activePreset, setThemeModePreference } = useAppTheme();
	const canManageContent = isAdminRole(user?.role);
	const [featuredRouteName, setFeaturedRouteName] = useState(null);

	useFocusEffect(
		useCallback(() => {
			let alive = true;

			async function loadFeaturedRouteName() {
				if (canManageContent) return;

				try {
					const [featuredRouteId, routes] = await Promise.all([
						getFeaturedRouteId(),
						getMapRoutes(),
					]);

					if (!alive) return;

					const featuredRoute = routes.find((route) => route.id === featuredRouteId) ?? null;
					setFeaturedRouteName(featuredRoute?.name ?? null);
				} catch {
					if (alive) {
						setFeaturedRouteName(null);
					}
				}
			}

			void loadFeaturedRouteName();

			return () => {
				alive = false;
			};
		}, [canManageContent])
	);

	const quickActions = useMemo(() => {
		if (canManageContent) return ADMIN_QUICK_ACTIONS;

		return USER_QUICK_ACTIONS.map((action) => {
			if (action.route !== "/admin/rota-destaque") return action;

			return {
				...action,
				description: featuredRouteName
					? "Ver a rota selecionada pelo admin"
					: "Ainda sem rota selecionada pelo admin",
				featuredRouteName,
			};
		});
	}, [canManageContent, featuredRouteName]);

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
					{canManageContent ? (
						<Text style={[styles.muted, { color: colors.mutedForeground }]}>Área de Administração</Text>
					) : null}
					<Text style={[styles.title, { color: colors.foreground }, !canManageContent && styles.userTitleSpacing]}>
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
				<View style={styles.headerActionsRow}>
					<View style={[styles.modeSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
						<Pressable
							style={[
								styles.modeOption,
								mode === "light" && [styles.modeOptionActive, { backgroundColor: colors.accentSoft }],
							]}
							onPress={() => void setThemeModePreference("light")}
						>
							<Feather name="sun" size={15} color={mode === "light" ? colors.primary : colors.iconMuted} />
						</Pressable>
						<Pressable
							style={[
								styles.modeOption,
								mode === "dark" && [styles.modeOptionActive, { backgroundColor: colors.accentSoft }],
							]}
							onPress={() => void setThemeModePreference("dark")}
						>
							<Feather name="moon" size={15} color={mode === "dark" ? colors.primary : colors.iconMuted} />
						</Pressable>
					</View>
					<Pressable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
						<Feather name="log-out" size={18} color={colors.iconMuted} />
					</Pressable>
				</View>
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
				{quickActions.map((action) => {
					const isFeaturedRouteCard = !canManageContent && action.route === "/admin/rota-destaque";

					if (isFeaturedRouteCard) {
						return (
							<Pressable
								key={action.route}
								style={({ pressed }) => [
									styles.actionCard,
									styles.actionCardFeatured,
									{ backgroundColor: colors.card, borderColor: colors.primary, shadowColor: colors.shadow },
									pressed && [styles.actionCardPressed, { borderColor: colors.primary }],
								]}
								onPress={() => router.push(action.route)}
							>
								<Text style={[styles.featuredHeadline, { color: colors.foreground }]} numberOfLines={2}>
									{featuredRouteName ?? "Sem rota em destaque"}
								</Text>
								<View style={styles.featuredBottomRow}>
									<Text style={[styles.featuredSubtitle, { color: colors.mutedForeground }]}>Rota em destaque</Text>
									<View style={[styles.featuredMoreBtn, { backgroundColor: colors.primary }]}> 
										<Text style={[styles.featuredMoreText, { color: colors.primaryForeground }]}>Saber mais</Text>
										<Feather name="arrow-right" size={12} color={colors.primaryForeground} />
									</View>
								</View>
							</Pressable>
						);
					}

					return (
					<Pressable
						key={action.route}
						style={({ pressed }) => [
							styles.actionCard,
							{ backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
							pressed && [styles.actionCardPressed, { borderColor: colors.primary }],
						]}
						onPress={() => router.push(action.route)}
					>
						<View style={[styles.actionIconCircle, { backgroundColor: colors.accentSoft }]}>
							<Feather name={action.icon} size={22} color={colors.primary} />
						</View>
						<Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
						<Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>{action.description}</Text>
					</Pressable>
					);
				})}
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
	headerActionsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	modeSelector: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 999,
		padding: 4,
		gap: 4,
	},
	modeOption: {
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: "center",
		justifyContent: "center",
	},
	modeOptionActive: {
		opacity: 1,
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
	userTitleSpacing: {
		marginTop: 12,
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
	actionCardFeatured: {
		width: "100%",
		borderWidth: 2,
		paddingVertical: 20,
		shadowOpacity: 0.28,
		shadowRadius: 14,
		elevation: 8,
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
	featuredHeadline: {
		fontSize: 24,
		fontWeight: "800",
		lineHeight: 30,
		marginBottom: 10,
	},
	featuredBottomRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 10,
	},
	featuredSubtitle: {
		fontSize: 13,
		fontWeight: "600",
	},
	featuredMoreBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
	},
	featuredMoreText: {
		fontSize: 12,
		fontWeight: "700",
	},
});

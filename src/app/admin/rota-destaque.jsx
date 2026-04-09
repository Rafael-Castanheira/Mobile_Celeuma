import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getMapPoints, getMapRoutes } from "../../lib/360api";
import { getFeaturedRouteId } from "../../lib/preferences";

export default function RotaDestaqueScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { colors } = useAppTheme();
	const { showError } = useDialog();
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [featuredRoute, setFeaturedRoute] = useState(null);
	const [pointNames, setPointNames] = useState([]);

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		try {
			const [routes, points, featuredRouteId] = await Promise.all([
				getMapRoutes(),
				getMapPoints(),
				getFeaturedRouteId(),
			]);

			if (featuredRouteId === null) {
				setFeaturedRoute(null);
				setPointNames([]);
				return;
			}

			const route = routes.find((item) => item.id === featuredRouteId) ?? null;
			setFeaturedRoute(route);

			if (!route) {
				setPointNames([]);
				return;
			}

			const pointById = new Map(points.map((point) => [point.id, point.title]));
			setPointNames(route.pointIds.map((pointId) => pointById.get(pointId) ?? `Ponto #${pointId}`));
		} catch (error) {
			showError(error instanceof Error ? error.message : "Erro ao carregar rota em destaque.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [showError]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}> 
			<View style={[styles.header, { borderBottomColor: colors.border }]}> 
				<Pressable onPress={() => router.back()} style={styles.headerBtn}>
					<Feather name="arrow-left" size={20} color={colors.foreground} />
				</Pressable>
				<Text style={[styles.title, { color: colors.foreground }]}>Rota em Destaque</Text>
				<Pressable onPress={() => void load(true)} style={styles.headerBtn}>
					<Feather name="refresh-cw" size={18} color={colors.foreground} />
				</Pressable>
			</View>

			{loading ? (
				<ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
			) : (
				<ScrollView
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 28 }}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
				>
					{featuredRoute ? (
						<>
							<View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
								<View style={[styles.badge, { backgroundColor: colors.accentSoft }]}> 
									<Feather name="star" size={14} color={colors.primary} />
									<Text style={[styles.badgeText, { color: colors.primary }]}>Selecionada pelo admin</Text>
								</View>
								<Text style={[styles.routeName, { color: colors.foreground }]}>{featuredRoute.name}</Text>
								<Text style={[styles.routeMeta, { color: colors.mutedForeground }]}>{featuredRoute.pointIds.length} pontos na rota</Text>
							</View>

							<Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Ordem dos pontos</Text>
							{pointNames.map((name, index) => (
								<View
									key={`${name}-${index}`}
									style={[styles.pointRow, { backgroundColor: colors.card, borderColor: colors.border }]}
								>
									<View style={[styles.pointIndex, { backgroundColor: colors.accentSoft }]}>
										<Text style={[styles.pointIndexText, { color: colors.primary }]}>{index + 1}</Text>
									</View>
									<Text style={[styles.pointName, { color: colors.foreground }]}>{name}</Text>
								</View>
							))}

							<Pressable
								style={[styles.openMapBtn, { backgroundColor: colors.primary }]}
								onPress={() => router.push("/(tabs)/mapa")}
							>
								<Text style={[styles.openMapBtnText, { color: colors.primaryForeground }]}>Abrir no mapa</Text>
							</Pressable>
						</>
					) : (
						<View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
							<Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem rota em destaque</Text>
							<Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}> 
								Um administrador ainda nao selecionou uma rota em destaque.
							</Text>
						</View>
					)}
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	headerBtn: { padding: 6 },
	title: { fontSize: 18, fontWeight: "700" },
	featuredCard: {
		borderWidth: 1,
		borderRadius: 16,
		padding: 16,
		marginBottom: 18,
	},
	badge: {
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
		marginBottom: 10,
	},
	badgeText: {
		fontSize: 11,
		fontWeight: "700",
	},
	routeName: {
		fontSize: 18,
		fontWeight: "800",
		marginBottom: 4,
	},
	routeMeta: {
		fontSize: 12,
	},
	sectionTitle: {
		fontSize: 11,
		textTransform: "uppercase",
		letterSpacing: 1.6,
		marginBottom: 10,
	},
	pointRow: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	pointIndex: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	pointIndexText: {
		fontSize: 11,
		fontWeight: "700",
	},
	pointName: {
		fontSize: 14,
		fontWeight: "600",
		flex: 1,
	},
	openMapBtn: {
		marginTop: 14,
		height: 48,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	openMapBtnText: {
		fontSize: 14,
		fontWeight: "700",
	},
	emptyCard: {
		borderWidth: 1,
		borderRadius: 16,
		padding: 16,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "700",
		marginBottom: 6,
	},
	emptyDescription: {
		fontSize: 13,
		lineHeight: 20,
	},
});

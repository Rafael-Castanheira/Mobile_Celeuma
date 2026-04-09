import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getMapPoints } from "../../lib/360api";
import { getFavoritePointIds, toggleFavoritePointId } from "../../lib/preferences";

export default function FavoritosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { user } = useAuth();
	const { colors } = useAppTheme();
	const { showError } = useDialog();
	const [points, setPoints] = useState([]);
	const [favoriteIds, setFavoriteIds] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [savingPointId, setSavingPointId] = useState(null);
	const [viewMode, setViewMode] = useState("favorites");
	const [search, setSearch] = useState("");

	const userKey = user?.id ?? user?.email ?? "anonymous";

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		try {
			const [loadedPoints, loadedFavorites] = await Promise.all([
				getMapPoints(),
				getFavoritePointIds(userKey),
			]);

			setPoints(loadedPoints);
			setFavoriteIds(loadedFavorites);
		} catch (error) {
			showError(error instanceof Error ? error.message : "Erro ao carregar favoritos.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [showError, userKey]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	async function handleToggleFavorite(pointId) {
		setSavingPointId(pointId);
		try {
			const updated = await toggleFavoritePointId(userKey, pointId);
			setFavoriteIds(updated);
		} catch {
			showError("Não foi possível atualizar os favoritos.");
		} finally {
			setSavingPointId(null);
		}
	}

	const favoritePoints = useMemo(
		() => points.filter((point) => favoriteIds.includes(point.id)),
		[favoriteIds, points]
	);

	const allPointsSorted = useMemo(() => {
		const pointsCopy = [...points];
		pointsCopy.sort((a, b) => {
			const aFav = favoriteIds.includes(a.id) ? 0 : 1;
			const bFav = favoriteIds.includes(b.id) ? 0 : 1;
			if (aFav !== bFav) return aFav - bFav;
			return a.title.localeCompare(b.title);
		});
		return pointsCopy;
	}, [favoriteIds, points]);

	const normalizedSearch = search.trim().toLowerCase();
	const baseData = viewMode === "favorites" ? favoritePoints : allPointsSorted;
	const filteredData = baseData.filter((point) => {
		if (!normalizedSearch) return true;
		return (
			point.title.toLowerCase().includes(normalizedSearch)
			|| point.detail.toLowerCase().includes(normalizedSearch)
		);
	});

	function renderListEmptyState() {
		if (points.length === 0) {
			return <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum ponto disponível.</Text>;
		}

		if (viewMode === "favorites" && favoritePoints.length === 0) {
			return (
				<View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
					<Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ainda não tens favoritos</Text>
					<Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}> 
						Marca pontos com estrela para aparecerem aqui.
					</Text>
					<Pressable
						style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
						onPress={() => setViewMode("all")}
					>
						<Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>Ver todos os pontos</Text>
					</Pressable>
				</View>
			);
		}

		return <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sem resultados para a pesquisa.</Text>;
	}

	function renderPoint({ item }) {
		const isFavorite = favoriteIds.includes(item.id);
		const isSaving = savingPointId === item.id;

		return (
			<View style={[styles.pointCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
				<View style={{ flex: 1 }}>
					<Text style={[styles.pointName, { color: colors.foreground }]}>{item.title}</Text>
					<Text style={[styles.pointDetail, { color: colors.mutedForeground }]} numberOfLines={2}>
						{item.detail}
					</Text>
					<Text style={[styles.pointMeta, { color: colors.mutedForeground }]}>
						{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
					</Text>
				</View>
				<Pressable
					style={[styles.mapBtn, { backgroundColor: colors.accentSoft }]}
					onPress={() => router.push("/(tabs)/mapa")}
				>
					<Feather name="map-pin" size={16} color={colors.primary} />
				</Pressable>
				<Pressable
					style={[
						styles.favoriteBtn,
						{ backgroundColor: isFavorite ? colors.primary : colors.accentSoft },
					]}
					onPress={() => void handleToggleFavorite(item.id)}
					disabled={Boolean(isSaving)}
				>
					{isSaving ? (
						<ActivityIndicator size="small" color={isFavorite ? colors.primaryForeground : colors.primary} />
					) : (
						<Feather
							name="star"
							size={18}
							color={isFavorite ? colors.primaryForeground : colors.iconMuted}
						/>
					)}
				</Pressable>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}> 
			<View style={[styles.header, { borderBottomColor: colors.border }]}> 
				<Pressable onPress={() => router.back()} style={styles.headerBtn}>
					<Feather name="arrow-left" size={20} color={colors.foreground} />
				</Pressable>
				<Text style={[styles.title, { color: colors.foreground }]}>Pontos Favoritos</Text>
				<Pressable onPress={() => void load(true)} style={styles.headerBtn}>
					<Feather name="refresh-cw" size={18} color={colors.foreground} />
				</Pressable>
			</View>

			{loading ? (
				<ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
			) : (
				<FlatList
					data={filteredData}
					keyExtractor={(item) => String(item.id)}
					renderItem={renderPoint}
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 28 }}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
					ListHeaderComponent={
						<>
							<View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
								<Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total de favoritos</Text>
								<Text style={[styles.summaryValue, { color: colors.primary }]}>{favoritePoints.length}</Text>
								<Text style={[styles.summarySub, { color: colors.mutedForeground }]}>{points.length} pontos disponíveis</Text>
							</View>

							<View style={[styles.segmented, { backgroundColor: colors.card, borderColor: colors.border }]}>
								<Pressable
									style={[
										styles.segment,
										viewMode === "favorites" && [styles.segmentActive, { backgroundColor: colors.accentSoft }],
									]}
									onPress={() => setViewMode("favorites")}
								>
									<Text style={[styles.segmentText, { color: viewMode === "favorites" ? colors.primary : colors.mutedForeground }]}>Favoritos</Text>
								</Pressable>
								<Pressable
									style={[
										styles.segment,
										viewMode === "all" && [styles.segmentActive, { backgroundColor: colors.accentSoft }],
									]}
									onPress={() => setViewMode("all")}
								>
									<Text style={[styles.segmentText, { color: viewMode === "all" ? colors.primary : colors.mutedForeground }]}>Todos</Text>
								</Pressable>
							</View>

							<View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}> 
								<Feather name="search" size={16} color={colors.iconMuted} />
								<TextInput
									style={[styles.searchInput, { color: colors.foreground }]}
									placeholder="Pesquisar pontos"
									placeholderTextColor={colors.placeholder}
									value={search}
									onChangeText={setSearch}
								/>
							</View>
						</>
					}
					ListEmptyComponent={renderListEmptyState()}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => void load(true)}
							tintColor={colors.primary}
						/>
					}
				/>
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
	summaryCard: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
		marginBottom: 12,
	},
	summaryLabel: {
		fontSize: 12,
		marginBottom: 4,
	},
	summaryValue: {
		fontSize: 24,
		fontWeight: "800",
	},
	summarySub: {
		fontSize: 12,
		marginTop: 4,
	},
	segmented: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 4,
		marginBottom: 10,
		flexDirection: "row",
		gap: 6,
	},
	segment: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	segmentActive: {},
	segmentText: {
		fontSize: 12,
		fontWeight: "700",
	},
	searchWrap: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		height: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
	},
	emptyText: {
		textAlign: "center",
		marginTop: 40,
	},
	emptyCard: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
		marginTop: 16,
		alignItems: "flex-start",
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "700",
		marginBottom: 4,
	},
	emptyDescription: {
		fontSize: 13,
		lineHeight: 20,
		marginBottom: 12,
	},
	emptyActionBtn: {
		height: 40,
		borderRadius: 10,
		paddingHorizontal: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	emptyActionText: {
		fontSize: 12,
		fontWeight: "700",
	},
	pointCard: {
		borderWidth: 1,
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	pointName: {
		fontSize: 14,
		fontWeight: "700",
		marginBottom: 4,
	},
	pointDetail: {
		fontSize: 12,
		lineHeight: 18,
	},
	pointMeta: {
		fontSize: 11,
		marginTop: 6,
	},
	mapBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	favoriteBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
});

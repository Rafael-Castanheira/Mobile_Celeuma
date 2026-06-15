import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { getEstatisticasResumo } from "../../lib/360api";
import { AdminHeader } from "../../components/admin/AdminUI";

export default function EstatisticasScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token } = useAuth();
	const { colors } = useAppTheme();
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(null);

	const load = useCallback(
		async (isRefresh = false) => {
			if (isRefresh) {
				setRefreshing(true);
			} else {
				setLoading(true);
			}

			setError(null);

			if (!token) {
				setStats(null);
				setError("Sessão inválida. Por favor, inicie sessão novamente.");
				setLoading(false);
				setRefreshing(false);
				return;
			}

			try {
				setStats(await getEstatisticasResumo(token));
			} catch (e) {
				setError(e instanceof Error ? e.message : "Erro desconhecido.");
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[token]
	);

	useEffect(() => {
		load();
	}, [load]);

	const cards = stats
		? [
				{ label: "Total Visualizações", value: stats.totalVisualizacoes, icon: "eye" },
				{ label: "Total Pontos", value: stats.totalPontos, icon: "map-pin" },
				{ label: "Total Trajetos", value: stats.totalTrajetos, icon: "navigation" },
				{ label: "Novos Pontos", value: stats.novosPontos, icon: "plus-circle" },
				{ label: "Novos Trajetos", value: stats.novosTrajetos, icon: "git-branch" },
				{ label: "% Visualizações", value: `${stats.percentagemVisualizacoes}%`, icon: "trending-up" },
			]
		: [];

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
			<AdminHeader 
				title="Estatísticas" 
				rightIcon="refresh-cw" 
				onRightPress={() => load()} 
			/>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}

			{!loading && stats && (
				<ScrollView
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 32 }}
					refreshControl={
						<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
					}
				>
					{/* Grid */}
					<View style={styles.grid}>
						{cards.map((card) => (
							<View key={card.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
								<View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
									<Feather name={card.icon} size={18} color={colors.primary} />
								</View>
								<Text style={[styles.statValue, { color: colors.foreground }]}>{card.value}</Text>
								<Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{card.label}</Text>
							</View>
						))}
					</View>

					{/* Highlights */}
					{(stats.pontoMaisVisto || stats.rotaMaisVista) && (
						<>
							<Text style={[styles.sectionTitle, { color: colors.foreground }]}>Destaques</Text>
							{stats.pontoMaisVisto && (
								<View style={[styles.highlightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
									<View style={[styles.highlightIcon, { backgroundColor: colors.accentSoft }]}>
										<Feather name="map-pin" size={16} color={colors.primary} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={[styles.highlightSub, { color: colors.mutedForeground }]}>Ponto mais visto</Text>
										<Text style={[styles.highlightName, { color: colors.foreground }]}>{stats.pontoMaisVisto.nome}</Text>
									</View>
									<Text style={[styles.highlightCount, { color: colors.mutedForeground }]}>{stats.pontoMaisVisto.total} visualizações</Text>
								</View>
							)}
							{stats.rotaMaisVista && (
								<View style={[styles.highlightCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
									<View style={[styles.highlightIcon, { backgroundColor: colors.accentSoft }]}>
										<Feather name="navigation" size={16} color={colors.primary} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={[styles.highlightSub, { color: colors.mutedForeground }]}>Rota mais vista</Text>
										<Text style={[styles.highlightName, { color: colors.foreground }]}>{stats.rotaMaisVista.nome}</Text>
									</View>
									<Text style={[styles.highlightCount, { color: colors.mutedForeground }]}>{stats.rotaMaisVista.total} visualizações</Text>
								</View>
							)}
						</>
					)}
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0d0000" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
	statCard: {
		backgroundColor: "#1a0a0a",
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
		width: "48%",
		alignItems: "flex-start",
	},
	iconWrap: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "rgba(220,38,38,0.1)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 10,
	},
	statValue: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
	statLabel: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
	sectionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 12 },
	highlightCard: {
		backgroundColor: "#1a0a0a",
		borderRadius: 12,
		padding: 14,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	highlightIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "rgba(220,38,38,0.1)",
		alignItems: "center",
		justifyContent: "center",
	},
	highlightSub: { color: "#64748b", fontSize: 11 },
	highlightName: { color: "#f8fafc", fontWeight: "600", fontSize: 13, marginTop: 2 },
	highlightCount: { color: "#94a3b8", fontSize: 12 },
});

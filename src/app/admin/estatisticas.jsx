import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
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

	let pctDesktop = 0;
	let pctMobile = 0;

	if (stats) {
		const rawDispositivos = stats.dispositivos || { desktop: 0, mobile: 0, tablet: 0 };
		const dispositivos = {
			desktop: rawDispositivos.desktop || 0,
			mobile: (rawDispositivos.mobile || 0) + (rawDispositivos.tablet || 0),
		};
		const totalDispositivos = dispositivos.desktop + dispositivos.mobile;
		pctDesktop = totalDispositivos > 0 ? ((dispositivos.desktop / totalDispositivos) * 100).toFixed(0) : 0;
		pctMobile = totalDispositivos > 0 ? ((dispositivos.mobile / totalDispositivos) * 100).toFixed(0) : 0;
	}

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
					<View style={styles.grid}>
						{/* Total de Visualizações */}
						<View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
							<View style={styles.cardHeader}>
								<View style={styles.cardHeaderLeft}>
									<Feather name="eye" size={14} color={colors.mutedForeground} />
									<Text style={[styles.cardTitleText, { color: colors.mutedForeground }]}>Total de Visualizações</Text>
								</View>
								<View style={[styles.badge, { borderColor: colors.border }]}>
									<Feather name="trending-up" size={10} color={colors.foreground} />
									<Text style={[styles.badgeText, { color: colors.foreground }]}>+{stats.percentagemVisualizacoes}% este mês</Text>
								</View>
							</View>
							<Text style={[styles.statValue, { color: colors.foreground }]}>{stats.totalVisualizacoes}</Text>
						</View>

						{/* Ponto mais visto */}
						<View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
							<View style={styles.cardHeader}>
								<View style={styles.cardHeaderLeft}>
									<Feather name="map-pin" size={14} color={colors.mutedForeground} />
									<Text style={[styles.cardTitleText, { color: colors.mutedForeground }]}>Ponto mais visto</Text>
								</View>
								<View style={[styles.badge, { borderColor: colors.border }]}>
									<Feather name="trending-up" size={10} color={colors.foreground} />
									<Text style={[styles.badgeText, { color: colors.foreground }]}>{stats.pontoMaisVisto?.total || 0} visualizações</Text>
								</View>
							</View>
							<Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
								{stats.pontoMaisVisto?.nome || "—"}
							</Text>
						</View>

						{/* Trajeto mais visto */}
						<View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
							<View style={styles.cardHeader}>
								<View style={styles.cardHeaderLeft}>
									<Feather name="navigation" size={14} color={colors.mutedForeground} />
									<Text style={[styles.cardTitleText, { color: colors.mutedForeground }]}>Trajeto mais visto</Text>
								</View>
								<View style={[styles.badge, { borderColor: colors.border }]}>
									<Feather name="trending-up" size={10} color={colors.foreground} />
									<Text style={[styles.badgeText, { color: colors.foreground }]}>{stats.rotaMaisVista?.total || 0} visualizações</Text>
								</View>
							</View>
							<Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
								{stats.rotaMaisVista?.nome || "—"}
							</Text>
						</View>

						{/* Dispositivos */}
						<View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
							<View style={styles.cardHeader}>
								<View style={styles.cardHeaderLeft}>
									<Feather name="monitor" size={14} color={colors.mutedForeground} />
									<Text style={[styles.cardTitleText, { color: colors.mutedForeground }]}>Dispositivos</Text>
								</View>
								<View style={[styles.badge, { borderColor: colors.border }]}>
									<Feather name="trending-up" size={10} color={colors.foreground} />
									<Text style={[styles.badgeText, { color: colors.foreground }]}>+{stats.novosPontos + stats.novosTrajetos} conteúdo</Text>
								</View>
							</View>
							<View style={styles.devicesRow}>
								<View style={styles.deviceItem}>
									<Feather name="monitor" size={16} color="#ef4444" />
									<Text style={[styles.deviceText, { color: colors.foreground }]}>{pctDesktop}%</Text>
								</View>
								<View style={styles.deviceItem}>
									<Feather name="smartphone" size={16} color="#3b82f6" />
									<Text style={[styles.deviceText, { color: colors.foreground }]}>{pctMobile}%</Text>
								</View>
							</View>
						</View>
					</View>
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0d0000" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
	grid: { flexDirection: "column", gap: 16 },
	statCard: {
		backgroundColor: "#1a0a0a",
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
		flexWrap: "wrap",
		gap: 8,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	cardTitleText: {
		fontSize: 13,
		fontWeight: "500",
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		borderWidth: 1,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 8,
		backgroundColor: "transparent",
	},
	badgeText: {
		fontSize: 10,
		fontWeight: "600",
	},
	statValue: {
		fontSize: 24,
		fontWeight: "700",
	},
	devicesRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		marginTop: 4,
	},
	deviceItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	deviceText: {
		fontSize: 14,
		fontWeight: "600",
	},
});

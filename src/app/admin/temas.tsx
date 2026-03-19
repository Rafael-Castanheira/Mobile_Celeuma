import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import {
    type ThemePreset,
    getThemePresets,
    setActiveThemePreset,
} from "../../lib/360api";
import { isThemeColorValue, normalizeThemeColor } from "../../lib/theme";

const PREFERRED_THEME_KEYS = [
	"primary",
	"primaryColor",
	"secondary",
	"accent",
	"background",
	"surface",
	"text",
	"muted",
	"border",
];

function isColorLike(value: string): boolean {
	return isThemeColorValue(value);
}

function getPreviewColors(vars: ThemePreset["lightVars"] | ThemePreset["darkVars"]): string[] {
	if (!vars) return [];

	const entries = Object.entries(vars).filter(([, value]) => isColorLike(value));
	const preferred = PREFERRED_THEME_KEYS
		.map((key) => vars[key])
		.filter((value): value is string => typeof value === "string" && isColorLike(value));
	const fallback = entries.map(([, value]) => value);

	return [...new Set([...preferred, ...fallback])].map((value) => normalizeThemeColor(value)).slice(0, 4);
}

function countThemeVars(theme: ThemePreset): number {
	return Object.keys(theme.lightVars ?? {}).length + Object.keys(theme.darkVars ?? {}).length;
}

function ThemePreviewRow({ label, colors }: { label: string; colors: string[] }) {
	return (
		<View style={styles.previewRow}>
			<Text style={styles.previewLabel}>{label}</Text>
			<View style={styles.previewSwatches}>
				{colors.length > 0 ? (
					colors.map((color, index) => (
						<View
							key={`${label}-${color}-${index}`}
							style={[styles.swatch, { backgroundColor: color }]}
						/>
					))
				) : (
					<Text style={styles.previewEmpty}>Sem cores definidas</Text>
				)}
			</View>
		</View>
	);
}

export default function TemasScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token } = useAuth();
	const { colors, activePreset, refreshActiveTheme } = useAppTheme();
	const [themes, setThemes] = useState<ThemePreset[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submittingId, setSubmittingId] = useState<number | "default" | null>(null);

	async function load(isRefresh = false) {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError(null);
		try {
			const availableThemes = await getThemePresets();
			setThemes(availableThemes);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function handleActivate(theme: ThemePreset) {
		if (!token) {
			Alert.alert("Erro", "Sessão inválida. Inicia sessão novamente.");
			return;
		}

		setSubmittingId(theme.id_theme_preset);
		try {
			await setActiveThemePreset(theme.id_theme_preset, token);
			await refreshActiveTheme();
		} catch (err) {
			Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao definir tema ativo.");
		} finally {
			setSubmittingId(null);
		}
	}

	async function handleReset() {
		if (!token) {
			Alert.alert("Erro", "Sessão inválida. Inicia sessão novamente.");
			return;
		}

		setSubmittingId("default");
		try {
			await setActiveThemePreset(null, token);
			await refreshActiveTheme();
		} catch (err) {
			Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao repor o tema padrão.");
		} finally {
			setSubmittingId(null);
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}> 
			<View style={[styles.header, { borderBottomColor: colors.border }]}>
				<Pressable onPress={() => router.back()} style={styles.headerBtn}>
					<Feather name="arrow-left" size={20} color={colors.foreground} />
				</Pressable>
				<Text style={[styles.title, { color: colors.foreground }]}>Temas</Text>
				<Pressable onPress={() => load(true)} style={styles.headerBtn}>
					<Feather name="refresh-cw" size={18} color={colors.foreground} />
				</Pressable>
			</View>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}

			{!loading && !error && (
				<ScrollView
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 32 }}
					refreshControl={
						<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
					}
				>
					<View style={[styles.currentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
						<View style={[styles.currentIconWrap, { backgroundColor: colors.accentSoft }]}>
							<Feather name="droplet" size={18} color={colors.primary} />
						</View>
						<View style={{ flex: 1 }}>
							<Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>Tema ativo</Text>
							<Text style={[styles.currentValue, { color: colors.foreground }]}>{activePreset?.name ?? "Padrão do sistema"}</Text>
							<Text style={[styles.currentSubtext, { color: colors.mutedForeground }]}> 
								{activePreset
									? `${countThemeVars(activePreset)} variáveis configuradas`
									: "Sem preset ativo definido no backend"}
							</Text>
						</View>
						<Pressable
							style={[
								styles.resetBtn,
								{ backgroundColor: colors.accentSoft },
								submittingId === "default" && styles.resetBtnDisabled,
							]}
							onPress={handleReset}
							disabled={submittingId !== null}
						>
							{submittingId === "default" ? (
								<ActivityIndicator size="small" color={colors.primaryForeground} />
							) : (
								<Text style={[styles.resetBtnText, { color: colors.primary }]}>Usar padrão</Text>
							)}
						</Pressable>
					</View>

					<Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Presets disponíveis</Text>
					{themes.length === 0 ? (
						<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum tema disponível na API.</Text>
					) : (
						themes.map((theme) => {
							const isActive = activePreset?.id_theme_preset === theme.id_theme_preset;
							const isSubmitting = submittingId === theme.id_theme_preset;
							const lightColors = getPreviewColors(theme.lightVars);
							const darkColors = getPreviewColors(theme.darkVars);

							return (
								<View
									key={theme.id_theme_preset}
									style={[
										styles.themeCard,
										{ backgroundColor: colors.card, borderColor: colors.border },
										isActive && [styles.themeCardActive, { borderColor: colors.primary, shadowColor: colors.shadow }],
									]}
								>
									<View style={styles.themeHeader}>
										<View style={{ flex: 1 }}>
											<Text style={[styles.themeName, { color: colors.foreground }]}>{theme.name}</Text>
											<Text style={[styles.themeMeta, { color: colors.mutedForeground }]}>
												{countThemeVars(theme)} variáveis • preset #{theme.id_theme_preset}
											</Text>
											{theme.description ? (
												<Text style={[styles.themeDescription, { color: colors.mutedForeground }]}>{theme.description}</Text>
											) : null}
										</View>
										{isActive && (
											<View style={[styles.activePill, { backgroundColor: colors.accentSoft }]}>
												<Text style={[styles.activePillText, { color: colors.primary }]}>Ativo</Text>
											</View>
										)}
									</View>

									<ThemePreviewRow label="Claro" colors={lightColors} />
									<ThemePreviewRow label="Escuro" colors={darkColors} />

									<View style={styles.actionsRow}>
										<Pressable
											style={[
												styles.activateBtn,
												{ backgroundColor: isActive ? colors.muted : colors.primary },
												isSubmitting && styles.activateBtnDisabled,
											]}
											onPress={() => handleActivate(theme)}
											disabled={isActive || submittingId !== null}
										>
											{isSubmitting ? (
												<ActivityIndicator size="small" color={isActive ? colors.mutedForeground : colors.primaryForeground} />
											) : (
												<Text style={[styles.activateBtnText, { color: isActive ? colors.mutedForeground : colors.primaryForeground }]}>{isActive ? "Tema ativo" : "Ativar tema"}</Text>
											)}
										</Pressable>
									</View>
								</View>
							);
						})
					)}
				</ScrollView>
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
	headerBtn: { padding: 6 },
	title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
	currentCard: {
		backgroundColor: "#1a0a0a",
		borderRadius: 18,
		padding: 16,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 24,
	},
	currentIconWrap: {
		width: 40,
		height: 40,
		borderRadius: 12,
		backgroundColor: "rgba(220,38,38,0.12)",
		alignItems: "center",
		justifyContent: "center",
	},
	currentLabel: { fontSize: 12, marginBottom: 2 },
	currentValue: { fontSize: 17, fontWeight: "700" },
	currentSubtext: { fontSize: 12, marginTop: 4 },
	resetBtn: {
		backgroundColor: "rgba(220,38,38,0.16)",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		minWidth: 96,
		alignItems: "center",
	},
	resetBtnDisabled: { opacity: 0.6 },
	resetBtnText: { fontWeight: "700", fontSize: 12 },
	sectionTitle: {
		color: "rgba(248,250,252,0.5)",
		textTransform: "uppercase",
		fontSize: 11,
		letterSpacing: 2,
		marginBottom: 12,
	},
	emptyText: { textAlign: "center", marginTop: 24 },
	themeCard: {
		backgroundColor: "#1a0505",
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.07)",
		marginBottom: 12,
	},
	themeCardActive: {
		borderColor: "rgba(220,38,38,0.55)",
		shadowColor: "#dc2626",
		shadowOpacity: 0.18,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 3,
	},
	themeHeader: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
		marginBottom: 14,
	},
	themeName: { fontSize: 16, fontWeight: "700" },
	themeMeta: { fontSize: 12, marginTop: 4 },
	themeDescription: { fontSize: 12, lineHeight: 18, marginTop: 6 },
	activePill: {
		backgroundColor: "rgba(220,38,38,0.16)",
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	activePillText: { fontSize: 11, fontWeight: "700" },
	previewRow: { marginBottom: 12 },
	previewLabel: {
		color: "#64748b",
		fontSize: 11,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1.1,
		marginBottom: 8,
	},
	previewSwatches: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 18 },
	swatch: {
		width: 24,
		height: 24,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
	},
	previewEmpty: { fontSize: 12 },
	actionsRow: { marginTop: 4 },
	activateBtn: {
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: "center",
	},
	activateBtnDisabled: { opacity: 0.7 },
	activateBtnText: { fontWeight: "700", fontSize: 13 },
});
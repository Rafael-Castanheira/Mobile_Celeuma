import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import {
    createTrajeto,
    deleteRota,
    getMapPoints,
    getMapRoutes,
    updateTrajetoDescription,
} from "../../lib/360api";
import { isAdminRole } from "../../lib/auth";
import { getFeaturedRouteId as getStoredFeaturedRouteId, setFeaturedRouteId as setStoredFeaturedRouteId } from "../../lib/preferences";

export default function TrajetosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token, user } = useAuth();
	const { colors, refreshActiveTheme } = useAppTheme();
	const { showError, showInfo, showSuccess, showConfirm } = useDialog();
	const canCreateTrajeto = isAdminRole(user?.role);
	const [routes, setRoutes] = useState([]);
	const [points, setPoints] = useState([]);
	const [featuredRouteId, setFeaturedRouteId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Create modal
	const [createVisible, setCreateVisible] = useState(false);
	const [selectedPointIds, setSelectedPointIds] = useState([]);
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);

	// Edit description modal
	const [editRoute, setEditRoute] = useState(null);
	const [editDesc, setEditDesc] = useState("");
	const [editSaving, setEditSaving] = useState(false);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const [r, p, storedFeaturedRouteId] = await Promise.all([
				getMapRoutes(),
				getMapPoints(),
				getStoredFeaturedRouteId(),
			]);
			setRoutes(r);
			setPoints(p);
			setFeaturedRouteId(r.some((route) => route.id === storedFeaturedRouteId) ? storedFeaturedRouteId : null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	useFocusEffect(
		useCallback(() => {
			void refreshActiveTheme();
		}, [refreshActiveTheme])
	);

	function togglePoint(id) {
		setSelectedPointIds((prev) =>
			prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
		);
	}

	async function handleCreate() {
		if (!canCreateTrajeto) {
			showInfo("Apenas administradores podem criar trajetos.", "Sem permissão");
			return;
		}
		if (!token) {
			showError("Sessão inválida. Por favor, inicie sessão novamente.");
			return;
		}
		if (selectedPointIds.length < 2) {
			showError("Seleciona no mínimo 2 pontos.");
			return;
		}
		setSaving(true);
		try {
			await createTrajeto({ pontos: selectedPointIds, description }, token);
			setCreateVisible(false);
			setSelectedPointIds([]);
			setDescription("");
			await load();
		} catch (e) {
			showError(e instanceof Error ? e.message : "Erro ao criar trajeto.");
		} finally {
			setSaving(false);
		}
	}

	function openEdit(route) {
		if (!canCreateTrajeto) {
			showInfo("Apenas administradores podem editar trajetos.", "Sem permissão");
			return;
		}

		setEditRoute(route);
		setEditDesc(route.name);
		setEditSaving(false);
	}

	async function handleEditSave() {
		if (!editRoute) return;
		if (!token) {
			showError("Sessão inválida. Por favor, inicie sessão novamente.");
			return;
		}
		setEditSaving(true);
		try {
			await updateTrajetoDescription(editRoute.id, editDesc, token);
			setEditRoute(null);
			await load();
		} catch (e) {
			showError(e instanceof Error ? e.message : "Erro ao guardar.");
		} finally {
			setEditSaving(false);
		}
	}

	function confirmDelete(route) {
		if (!canCreateTrajeto) {
			showInfo("Apenas administradores podem eliminar trajetos.", "Sem permissão");
			return;
		}

		showConfirm({
			title: "Eliminar rota",
			message: `Tens a certeza que queres eliminar "${route.name}" e todos os seus trajetos?`,
			confirmText: "Eliminar",
			confirmVariant: "destructive",
			onConfirm: async () => {
				if (!token) {
					showError("Sessão inválida. Por favor, inicie sessão novamente.");
					return;
				}
				try {
					await deleteRota(route.id, token);
					await load();
				} catch (e) {
					showError(e instanceof Error ? e.message : "Erro ao eliminar.");
				}
			},
		});
	}

	async function handleSetFeatured(route) {
		if (!canCreateTrajeto) {
			showInfo("Apenas administradores podem definir a rota em destaque.", "Sem permissão");
			return;
		}

		try {
			await setStoredFeaturedRouteId(route.id);
			setFeaturedRouteId(route.id);
			showSuccess(`A rota \"${route.name}\" foi definida em destaque.`);
		} catch {
			showError("Não foi possível definir a rota em destaque.");
		}
	}

	function renderRoute({ item }) {
		const isFeatured = featuredRouteId === item.id;

		return (
			<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accentSoft }]}>
				<View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
				<View style={{ flex: 1 }}>
					<View style={styles.routeTitleRow}>
						<Text style={[styles.cardTitle, { color: colors.primary }]}>{item.name}</Text>
						{isFeatured ? (
							<View style={[styles.featuredPill, { backgroundColor: colors.accentSoft }]}>
								<Feather name="star" size={11} color={colors.primary} />
								<Text style={[styles.featuredPillText, { color: colors.primary }]}>Em destaque</Text>
							</View>
						) : null}
					</View>
					<Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.pointIds.length} pontos</Text>
				</View>
				<View style={styles.actions}>
					{canCreateTrajeto ? (
						<>
							<Pressable
								style={[
									styles.actionBtn,
									{ backgroundColor: isFeatured ? colors.primary : colors.accentSoft },
								]}
								onPress={() => void handleSetFeatured(item)}
							>
								<Feather name="star" size={16} color={isFeatured ? colors.primaryForeground : colors.primary} />
							</Pressable>
							<Pressable style={[styles.actionBtn, { backgroundColor: colors.accentSoft }]} onPress={() => openEdit(item)}>
								<Feather name="edit-2" size={16} color={colors.primary} />
							</Pressable>
							<Pressable style={[styles.actionBtn, { backgroundColor: colors.accentSoft }]} onPress={() => confirmDelete(item)}>
								<Feather name="trash-2" size={16} color={colors.primary} />
							</Pressable>
						</>
					) : null}
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
			<View style={[styles.header, { borderBottomColor: colors.border }]}>
				<Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
					<Feather name="arrow-left" size={20} color={colors.primary} />
				</Pressable>
				<Text style={[styles.title, { color: colors.primary }]}>Trajetos</Text>
				{canCreateTrajeto ? (
					<Pressable onPress={() => { setSelectedPointIds([]); setDescription(""); setCreateVisible(true); }} style={[styles.backBtn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
						<Feather name="plus" size={22} color={colors.primary} />
					</Pressable>
				) : (
					<View style={styles.backBtnPlaceholder} />
				)}
			</View>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
			{!loading && !error && (
				<FlatList
					data={routes}
					keyExtractor={(item) => String(item.id)}
					renderItem={renderRoute}
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 32 }}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
					ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum trajeto encontrado.</Text>}
				/>
			)}

			{/* Create modal */}
			<Modal visible={createVisible} animationType="slide" transparent>
				<View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
					<View style={[styles.modalBox, { backgroundColor: colors.card }]}>
						<Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo trajeto</Text>

						<Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
						<TextInput
							style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
							value={description}
							onChangeText={setDescription}
							placeholder="Descrição (opcional)"
							placeholderTextColor={colors.placeholder}
						/>

						<Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>Pontos (seleciona ≥ 2, em ordem)</Text>
						<FlatList
							data={points}
							keyExtractor={(p) => String(p.id)}
							style={styles.pointList}
							renderItem={({ item }) => {
								const selected = selectedPointIds.includes(item.id);
								const idx = selectedPointIds.indexOf(item.id);
								return (
									<Pressable
										style={[
											styles.pointRow,
											{ backgroundColor: colors.secondary },
											selected && [styles.pointRowSelected, { borderColor: colors.primary, backgroundColor: colors.accentSoft }],
										]}
										onPress={() => togglePoint(item.id)}
									>
										<View style={[styles.pointIndex, { backgroundColor: colors.muted }, selected && [styles.pointIndexSelected, { backgroundColor: colors.primary }]]}>
											<Text style={[styles.pointIndexText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{selected ? idx + 1 : ""}</Text>
										</View>
										<Text style={[styles.pointName, { color: colors.mutedForeground }, selected && { color: colors.foreground }]}>{item.title}</Text>
										{selected && <Feather name="check" size={14} color={colors.primary} />}
									</Pressable>
								);
							}}
						/>

						<View style={styles.modalActions}>
							<Pressable style={[styles.cancelBtn, { backgroundColor: colors.muted }]} onPress={() => setCreateVisible(false)}>
								<Text style={[styles.cancelText, { color: colors.secondaryForeground }]}>Cancelar</Text>
							</Pressable>
							<Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleCreate} disabled={saving}>
								{saving ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Criar</Text>}
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			{/* Edit description modal */}
			<Modal visible={editRoute !== null} animationType="fade" transparent>
				<View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
					<View style={[styles.modalBox, { backgroundColor: colors.card }]}> 
						<Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar descrição</Text>
						<Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
						<TextInput
							style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
							value={editDesc}
							onChangeText={setEditDesc}
							placeholder="Nova descrição"
							placeholderTextColor={colors.placeholder}
						/>
						<View style={styles.modalActions}>
							<Pressable style={[styles.cancelBtn, { backgroundColor: colors.muted }]} onPress={() => setEditRoute(null)}>
								<Text style={[styles.cancelText, { color: colors.secondaryForeground }]}>Cancelar</Text>
							</Pressable>
							<Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleEditSave} disabled={editSaving}>
								{editSaving ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Guardar</Text>}
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
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
	backBtn: { padding: 6, borderWidth: 1, borderRadius: 999 },
	backBtnPlaceholder: { width: 34, height: 34 },
	title: { fontSize: 18, fontWeight: "700" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
	emptyText: { textAlign: "center", marginTop: 40 },
	card: {
		borderRadius: 12,
		padding: 14,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
	},
	cardAccent: {
		width: 3,
		height: "100%",
		borderRadius: 999,
		marginRight: 12,
	},
	cardTitle: { fontWeight: "600", fontSize: 14 },
	routeTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	cardSub: { fontSize: 12, marginTop: 2 },
	actions: { flexDirection: "row", gap: 4 },
	actionBtn: { padding: 8, borderRadius: 10 },
	featuredPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 999,
	},
	featuredPillText: {
		fontSize: 10,
		fontWeight: "700",
	},
	modalOverlay: { flex: 1, justifyContent: "flex-end" },
	modalBox: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 24,
		paddingBottom: 40,
		maxHeight: "85%",
	},
	modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
	label: { fontSize: 12, marginBottom: 4 },
	input: {
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
		borderWidth: 1,
	},
	pointList: { maxHeight: 220, marginTop: 4 },
	pointRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 8,
		gap: 10,
		borderWidth: 1,
		borderColor: "transparent",
		marginBottom: 4,
	},
	pointRowSelected: {},
	pointIndex: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	pointIndexSelected: {},
	pointIndexText: { fontSize: 10, fontWeight: "700" },
	pointName: { flex: 1, fontSize: 13 },
	modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
	cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
	cancelText: { fontWeight: "600" },
	saveBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
	saveText: { fontWeight: "700" },
});

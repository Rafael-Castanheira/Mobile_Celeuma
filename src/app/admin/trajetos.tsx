import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import { useAppTheme } from "../../context/ThemeContext";
import {
    type MapPoint,
    type MapRoute,
    createTrajeto,
    deleteRota,
    getMapPoints,
    getMapRoutes,
    updateTrajetoDescription,
} from "../../lib/360api";

export default function TrajetosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token } = useAuth();
	const { colors } = useAppTheme();
	const [routes, setRoutes] = useState<MapRoute[]>([]);
	const [points, setPoints] = useState<MapPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Create modal
	const [createVisible, setCreateVisible] = useState(false);
	const [selectedPointIds, setSelectedPointIds] = useState<number[]>([]);
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);

	// Edit description modal
	const [editRoute, setEditRoute] = useState<MapRoute | null>(null);
	const [editDesc, setEditDesc] = useState("");
	const [editSaving, setEditSaving] = useState(false);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const [r, p] = await Promise.all([getMapRoutes(), getMapPoints()]);
			setRoutes(r);
			setPoints(p);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	function togglePoint(id: number) {
		setSelectedPointIds((prev) =>
			prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
		);
	}

	async function handleCreate() {
		if (selectedPointIds.length < 2) {
			Alert.alert("Erro", "Seleciona no mínimo 2 pontos.");
			return;
		}
		setSaving(true);
		try {
			await createTrajeto({ pontos: selectedPointIds, description }, token!);
			setCreateVisible(false);
			setSelectedPointIds([]);
			setDescription("");
			await load();
		} catch (e) {
			Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar trajeto.");
		} finally {
			setSaving(false);
		}
	}

	function openEdit(route: MapRoute) {
		setEditRoute(route);
		setEditDesc(route.name);
		setEditSaving(false);
	}

	async function handleEditSave() {
		if (!editRoute) return;
		setEditSaving(true);
		try {
			await updateTrajetoDescription(editRoute.id, editDesc, token!);
			setEditRoute(null);
			await load();
		} catch (e) {
			Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao guardar.");
		} finally {
			setEditSaving(false);
		}
	}

	function confirmDelete(route: MapRoute) {
		Alert.alert(
			"Eliminar rota",
			`Tens a certeza que queres eliminar "${route.name}" e todos os seus trajetos?`,
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Eliminar",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteRota(route.id, token!);
							await load();
						} catch (e) {
							Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao eliminar.");
						}
					},
				},
			]
		);
	}

	function renderRoute({ item }: { item: MapRoute }) {
		return (
			<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
				<View style={{ flex: 1 }}>
					<Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
					<Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.pointIds.length} pontos</Text>
				</View>
				<View style={styles.actions}>
					<Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
						<Feather name="edit-2" size={16} color={colors.iconMuted} />
					</Pressable>
					<Pressable style={styles.actionBtn} onPress={() => confirmDelete(item)}>
						<Feather name="trash-2" size={16} color={colors.destructive} />
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
			<View style={[styles.header, { borderBottomColor: colors.border }]}>
				<Pressable onPress={() => router.back()} style={styles.backBtn}>
					<Feather name="arrow-left" size={20} color={colors.foreground} />
				</Pressable>
				<Text style={[styles.title, { color: colors.foreground }]}>Trajetos</Text>
				<Pressable onPress={() => { setSelectedPointIds([]); setDescription(""); setCreateVisible(true); }} style={styles.backBtn}>
					<Feather name="plus" size={22} color={colors.foreground} />
				</Pressable>
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
	backBtn: { padding: 6 },
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
	cardTitle: { fontWeight: "600", fontSize: 14 },
	cardSub: { fontSize: 12, marginTop: 2 },
	actions: { flexDirection: "row", gap: 4 },
	actionBtn: { padding: 8 },
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

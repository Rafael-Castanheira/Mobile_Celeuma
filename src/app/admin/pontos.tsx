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
    createPonto,
    deletePonto,
    getMapPoints,
    updatePonto,
} from "../../lib/360api";

type PontoForm = {
	name: string;
	description: string;
	latitude: string;
	longitude: string;
};

const EMPTY_FORM: PontoForm = { name: "", description: "", latitude: "", longitude: "" };

export default function PontosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token, user } = useAuth();
	const { colors } = useAppTheme();
	const [points, setPoints] = useState<MapPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [modalVisible, setModalVisible] = useState(false);
	const [editing, setEditing] = useState<MapPoint | null>(null);
	const [form, setForm] = useState<PontoForm>(EMPTY_FORM);
	const [saving, setSaving] = useState(false);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			setPoints(await getMapPoints());
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erro desconhecido.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	function openCreate() {
		setEditing(null);
		setForm(EMPTY_FORM);
		setModalVisible(true);
	}

	function openEdit(point: MapPoint) {
		setEditing(point);
		setForm({
			name: point.title,
			description: point.detail === "Sem descrição" ? "" : point.detail,
			latitude: String(point.latitude),
			longitude: String(point.longitude),
		});
		setModalVisible(true);
	}

	async function handleSave() {
		const lat = parseFloat(form.latitude);
		const lon = parseFloat(form.longitude);
		if (!form.name.trim()) { Alert.alert("Erro", "Nome é obrigatório."); return; }
		if (isNaN(lat) || isNaN(lon)) { Alert.alert("Erro", "Latitude e longitude devem ser números."); return; }

		setSaving(true);
		try {
			if (editing) {
				await updatePonto(editing.id, { name: form.name, description: form.description, latitude: lat, longitude: lon }, token!);
			} else {
				await createPonto({ name: form.name, description: form.description, latitude: lat, longitude: lon, username: user?.name }, token!);
			}
			setModalVisible(false);
			await load();
		} catch (e) {
			Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao guardar.");
		} finally {
			setSaving(false);
		}
	}

	function confirmDelete(point: MapPoint) {
		Alert.alert(
			"Eliminar ponto",
			`Tens a certeza que queres eliminar "${point.title}"?`,
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Eliminar",
					style: "destructive",
					onPress: async () => {
						try {
							await deletePonto(point.id, token!);
							await load();
						} catch (e) {
							Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao eliminar.");
						}
					},
				},
			]
		);
	}

	function renderPoint({ item }: { item: MapPoint }) {
		return (
			<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
				<View style={{ flex: 1 }}>
					<Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
					<Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.detail}</Text>
					<Text style={[styles.cardCoords, { color: colors.iconMuted }]}>
						{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
					</Text>
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
				<Text style={[styles.title, { color: colors.foreground }]}>Pontos</Text>
				<Pressable onPress={openCreate} style={styles.backBtn}>
					<Feather name="plus" size={22} color={colors.foreground} />
				</Pressable>
			</View>

			{loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
			{!loading && error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
			{!loading && !error && (
				<FlatList
					data={points}
					keyExtractor={(item) => String(item.id)}
					renderItem={renderPoint}
					contentContainerStyle={{ padding: 16, paddingBottom: bottom + 32 }}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
				/>
			)}

			<Modal visible={modalVisible} animationType="slide" transparent>
				<View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
					<View style={[styles.modalBox, { backgroundColor: colors.card }]}> 
						<Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? "Editar ponto" : "Novo ponto"}</Text>

						<Text style={[styles.label, { color: colors.mutedForeground }]}>Nome *</Text>
						<TextInput
							style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
							value={form.name}
							onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
							placeholder="Nome do ponto"
							placeholderTextColor={colors.placeholder}
						/>

						<Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
						<TextInput
							style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, height: 72, textAlignVertical: "top" }]}
							value={form.description}
							onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
							placeholder="Descrição (opcional)"
							placeholderTextColor={colors.placeholder}
							multiline
						/>

						<View style={styles.row}>
							<View style={{ flex: 1 }}>
								<Text style={[styles.label, { color: colors.mutedForeground }]}>Latitude *</Text>
								<TextInput
									style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
									value={form.latitude}
									onChangeText={(v) => setForm((f) => ({ ...f, latitude: v }))}
									placeholder="0.00000"
									placeholderTextColor={colors.placeholder}
									keyboardType="numeric"
								/>
							</View>
							<View style={{ width: 12 }} />
							<View style={{ flex: 1 }}>
								<Text style={[styles.label, { color: colors.mutedForeground }]}>Longitude *</Text>
								<TextInput
									style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
									value={form.longitude}
									onChangeText={(v) => setForm((f) => ({ ...f, longitude: v }))}
									placeholder="0.00000"
									placeholderTextColor={colors.placeholder}
									keyboardType="numeric"
								/>
							</View>
						</View>

						<View style={styles.modalActions}>
							<Pressable style={[styles.cancelBtn, { backgroundColor: colors.muted }]} onPress={() => setModalVisible(false)}>
								<Text style={[styles.cancelText, { color: colors.secondaryForeground }]}>Cancelar</Text>
							</Pressable>
							<Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
								{saving ? (
									<ActivityIndicator color={colors.primaryForeground} size="small" />
								) : (
									<Text style={[styles.saveText, { color: colors.primaryForeground }]}>Guardar</Text>
								)}
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
	card: {
		borderRadius: 12,
		padding: 14,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
	},
	cardTitle: { fontWeight: "600", fontSize: 14 },
	cardSub: { fontSize: 12, marginTop: 2 },
	cardCoords: { fontSize: 11, marginTop: 4 },
	actions: { flexDirection: "row", gap: 4 },
	actionBtn: { padding: 8 },
	modalOverlay: {
		flex: 1,
		justifyContent: "flex-end",
	},
	modalBox: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 24,
		paddingBottom: 40,
	},
	modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 20 },
	label: { fontSize: 12, marginBottom: 4, marginTop: 12 },
	input: {
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
		borderWidth: 1,
	},
	row: { flexDirection: "row" },
	modalActions: { flexDirection: "row", gap: 12, marginTop: 24 },
	cancelBtn: {
		flex: 1,
		padding: 14,
		borderRadius: 10,
		alignItems: "center",
	},
	cancelText: { fontWeight: "600" },
	saveBtn: {
		flex: 1,
		padding: 14,
		borderRadius: 10,
		alignItems: "center",
	},
	saveText: { fontWeight: "700" },
});

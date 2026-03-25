import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
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
    createPonto,
    deletePonto,
    getMapPoints,
    getPointCategories,
    updatePonto,
} from "../../lib/360api";

const EMPTY_FORM = { name: "", description: "", latitude: "", longitude: "", categoryIds: [] };

export default function PontosScreen() {
	const router = useRouter();
	const { top, bottom } = useSafeAreaInsets();
	const { token, user } = useAuth();
	const { colors, refreshActiveTheme } = useAppTheme();
	const { showError, showInfo, showConfirm } = useDialog();
	const [points, setPoints] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [modalVisible, setModalVisible] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [saving, setSaving] = useState(false);
	const [categories, setCategories] = useState([]);
	const [createImage, setCreateImage] = useState(null);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const [pointsData, categoriesData] = await Promise.all([getMapPoints(), getPointCategories()]);
			setPoints(pointsData);
			setCategories(categoriesData);
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

	function openCreate() {
		setEditing(null);
		setForm(EMPTY_FORM);
		setCreateImage(null);
		setModalVisible(true);
	}

	function openEdit(point) {
		setEditing(point);
		setCreateImage(null);
		setForm({
			name: point.title,
			description: point.detail === "Sem descrição" ? "" : point.detail,
			latitude: String(point.latitude),
			longitude: String(point.longitude),
			categoryIds: [],
		});
		setModalVisible(true);
	}

	async function pickCreateImage() {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			showInfo("Ativa acesso às fotos para selecionar uma imagem.", "Permissão necessária");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: false,
			quality: 0.9,
		});

		if (result.canceled || !result.assets[0]) return;

		const asset = result.assets[0];
		const fileName = asset.fileName || asset.uri.split("/").pop() || `ponto-${Date.now()}.jpg`;
		setCreateImage({
			uri: asset.uri,
			name: fileName,
			type: asset.mimeType || "image/jpeg",
		});
	}

	async function handleSave() {
		if (!token) {
			showError("Sessão inválida. Por favor, inicie sessão novamente.");
			return;
		}
		const lat = parseFloat(form.latitude);
		const lon = parseFloat(form.longitude);
		if (!form.name.trim()) {
			showError("Nome é obrigatório.");
			return;
		}
		if (isNaN(lat) || isNaN(lon)) {
			showError("Latitude e longitude devem ser números.");
			return;
		}
		if (!editing && !form.description.trim()) {
			showError("Descrição é obrigatória na criação.");
			return;
		}
		if (!editing && form.categoryIds.length === 0) {
			showError("Seleciona pelo menos uma categoria.");
			return;
		}
		if (!editing && !createImage) {
			showError("Seleciona uma imagem para o ponto.");
			return;
		}

		setSaving(true);
		try {
			if (editing) {
				await updatePonto(editing.id, { name: form.name, description: form.description, latitude: lat, longitude: lon }, token);
			} else {
				await createPonto({
					name: form.name,
					description: form.description,
					latitude: lat,
					longitude: lon,
					idCategorias: form.categoryIds,
					imagePath: "",
					imageFile: createImage || undefined,
					username: user?.name,
				}, token);
			}
			setModalVisible(false);
			await load();
		} catch (e) {
			showError(e instanceof Error ? e.message : "Erro ao guardar.");
		} finally {
			setSaving(false);
		}
	}

	function confirmDelete(point) {
		showConfirm({
			title: "Eliminar ponto",
			message: `Tens a certeza que queres eliminar "${point.title}"?`,
			confirmText: "Eliminar",
			confirmVariant: "destructive",
			onConfirm: async () => {
				if (!token) {
					showError("Sessão inválida. Por favor, inicie sessão novamente.");
					return;
				}
				try {
					await deletePonto(point.id, token);
					await load();
				} catch (e) {
					showError(e instanceof Error ? e.message : "Erro ao eliminar.");
				}
			},
		});
	}

	function renderPoint({ item }) {
		return (
			<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accentSoft }]}>
				<View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
				<View style={{ flex: 1 }}>
					<Text style={[styles.cardTitle, { color: colors.primary }]}>{item.title}</Text>
					<Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.detail}</Text>
					<Text style={[styles.cardCoords, { color: colors.iconMuted }]}>
						{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
					</Text>
				</View>
				<View style={styles.actions}>
					<Pressable style={[styles.actionBtn, { backgroundColor: colors.accentSoft }]} onPress={() => openEdit(item)}>
						<Feather name="edit-2" size={16} color={colors.primary} />
					</Pressable>
					<Pressable style={[styles.actionBtn, { backgroundColor: colors.accentSoft }]} onPress={() => confirmDelete(item)}>
						<Feather name="trash-2" size={16} color={colors.primary} />
					</Pressable>
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
				<Text style={[styles.title, { color: colors.primary }]}>Pontos</Text>
				<Pressable onPress={openCreate} style={[styles.backBtn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
					<Feather name="plus" size={22} color={colors.primary} />
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

						{!editing && (
							<>
								<Text style={[styles.label, { color: colors.mutedForeground }]}>Categorias *</Text>
								<View style={styles.categoryWrap}>
									{categories.map((category) => {
										const isSelected = form.categoryIds.includes(category.id_categoria);
										return (
											<Pressable
												key={category.id_categoria}
												style={[
													styles.categoryChip,
													{
														backgroundColor: isSelected ? colors.primary : colors.secondary,
														borderColor: isSelected ? colors.primaryForeground : colors.border,
													},
												]}
												onPress={() => setForm((f) => ({
													...f,
													categoryIds: f.categoryIds.includes(category.id_categoria)
														? f.categoryIds.filter((id) => id !== category.id_categoria)
														: [...f.categoryIds, category.id_categoria],
												}))}
											>
												<Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: "600" }}>
													{category.name}
												</Text>
											</Pressable>
										);
									})}
								</View>

								<Text style={[styles.label, { color: colors.mutedForeground }]}>Imagem *</Text>
								<Pressable
									style={[styles.imagePickBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
									onPress={pickCreateImage}
								>
									<Feather name="image" size={16} color={colors.primary} />
									<Text style={[styles.imagePickBtnText, { color: colors.foreground }]}>
										{createImage ? "Alterar imagem" : "Selecionar imagem"}
									</Text>
								</Pressable>
								{createImage && (
									<Text style={[styles.imagePickHint, { color: colors.mutedForeground }]}>Selecionada: {createImage.name}</Text>
								)}
							</>
						)}

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
	backBtn: { padding: 6, borderWidth: 1, borderRadius: 999 },
	title: { fontSize: 18, fontWeight: "700" },
	errorText: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
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
	cardSub: { fontSize: 12, marginTop: 2 },
	cardCoords: { fontSize: 11, marginTop: 4 },
	actions: { flexDirection: "row", gap: 4 },
	actionBtn: { padding: 8, borderRadius: 10 },
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
	categoryWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 6,
	},
	categoryChip: {
		paddingHorizontal: 10,
		paddingVertical: 7,
		borderRadius: 999,
		borderWidth: 1,
	},
	imagePickBtn: {
		marginTop: 6,
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	imagePickBtnText: {
		fontSize: 13,
		fontWeight: "600",
	},
	imagePickHint: {
		fontSize: 12,
		marginTop: 6,
	},
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

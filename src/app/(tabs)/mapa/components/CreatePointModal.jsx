import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

export default function CreatePointModal({
  isOpen,
  onClose,
  colors,
  coords,
  newPointName,
  setNewPointName,
  newPointDescription,
  setNewPointDescription,
  pointCategories,
  isLoadingPointCategories,
  newPointCategoryIds,
  setNewPointCategoryIds,
  newPointImage,
  pickImageForNewPoint,
  isCreatingPoint,
  handleCreatePointAtCursor,
}) {
  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Criar ponto na mira</Text>
          <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
            Coordenadas: {coords.lat}, {coords.lng}
          </Text>

          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Nome *</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={newPointName}
            onChangeText={setNewPointName}
            placeholder="Nome do ponto"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Descricao</Text>
          <TextInput
            style={[styles.modalInput, styles.modalTextArea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={newPointDescription}
            onChangeText={setNewPointDescription}
            placeholder="Descricao (opcional)"
            placeholderTextColor={colors.placeholder}
            multiline
          />

          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Categorias *</Text>
          {isLoadingPointCategories ? (
            <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 8 }} />
          ) : pointCategories.length === 0 ? (
            <Text style={[styles.modalHint, { color: colors.destructive }]}>Nao foi possivel carregar categorias.</Text>
          ) : (
            <View style={styles.categoryChips}>
              {pointCategories.map((categoria) => {
                const isSelected = newPointCategoryIds.includes(categoria.id_categoria);
                return (
                  <TouchableOpacity
                    key={categoria.id_categoria}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.secondary,
                        borderColor: isSelected ? colors.primaryForeground : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setNewPointCategoryIds((prev) =>
                        prev.includes(categoria.id_categoria)
                          ? prev.filter((id) => id !== categoria.id_categoria)
                          : [...prev, categoria.id_categoria]
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.categoryChipText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>
                      {categoria.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Imagem *</Text>
          <TouchableOpacity
            style={[styles.imagePickBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={pickImageForNewPoint}
            activeOpacity={0.8}
            disabled={isCreatingPoint}
          >
            <Feather name="image" size={16} color={colors.primary} />
            <Text style={[styles.imagePickBtnText, { color: colors.foreground }]}>
              {newPointImage ? "Alterar imagem" : "Selecionar imagem"}
            </Text>
          </TouchableOpacity>
          {newPointImage && (
            <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>Selecionada: {newPointImage.name}</Text>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              onPress={onClose}
              activeOpacity={0.8}
              disabled={isCreatingPoint}
            >
              <Text style={[styles.modalBtnText, { color: colors.secondaryForeground }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreatePointAtCursor}
              activeOpacity={0.8}
              disabled={isCreatingPoint}
            >
              {isCreatingPoint ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Criar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

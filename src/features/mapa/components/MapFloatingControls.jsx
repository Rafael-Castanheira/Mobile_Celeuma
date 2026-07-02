import { Feather } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

export default function MapFloatingControls({
  colors,
  isDark,
  top,
  isLayersMenuOpen,
  setIsLayersMenuOpen,
  isRoutesMenuOpen,
  setIsRoutesMenuOpen,
  routeList,
  setIsRoutesScreenOpen,
  mapViewMode,
  setBaseLayer,
  showRoutes,
  toggleRoutes,
  onGoBack,
}) {
  // Em modo claro: outline e ícone usam a cor primary do tema activo
  const fabBorder    = isDark ? colors.border    : colors.primary;
  const fabIconColor = isDark ? colors.foreground : colors.primary;
  const fabActiveBg     = colors.primary;
  const fabActiveBorder = colors.primaryForeground;
  const fabActiveIcon   = colors.primaryForeground;

  return (
    <>
      {/* Botão Voltar (esquerda) */}
      {onGoBack && (
        <TouchableOpacity
          style={[
            styles.fabButton,
            styles.fabBackButton,
            { top: top + 8, backgroundColor: isDark ? colors.overlay : colors.card, borderColor: fabBorder },
          ]}
          onPress={onGoBack}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={18} color={fabIconColor} />
        </TouchableOpacity>
      )}

      <View style={[styles.fabRow, { top: top + 8 }]}>
        {/* Botão Visão do mapa (layers) */}
        <TouchableOpacity
          style={[
            styles.fabButton,
            { backgroundColor: isDark ? colors.overlay : colors.card, borderColor: fabBorder },
            isLayersMenuOpen && { backgroundColor: fabActiveBg, borderColor: fabActiveBorder },
          ]}
          onPress={() => {
            setIsLayersMenuOpen((prev) => !prev);
            setIsRoutesMenuOpen(false);
          }}
          activeOpacity={0.8}
        >
          <Feather
            name="layers"
            size={18}
            color={isLayersMenuOpen ? fabActiveIcon : fabIconColor}
          />
        </TouchableOpacity>

        {/* Botão Trajetos (sliders) */}
        <TouchableOpacity
          style={[
            styles.fabButton,
            { backgroundColor: isDark ? colors.overlay : colors.card, borderColor: fabBorder },
            isRoutesMenuOpen && { backgroundColor: fabActiveBg, borderColor: fabActiveBorder },
          ]}
          onPress={() => {
            setIsRoutesMenuOpen((prev) => !prev);
            setIsLayersMenuOpen(false);
          }}
          activeOpacity={0.8}
        >
          <Feather
            name="sliders"
            size={18}
            color={isRoutesMenuOpen ? fabActiveIcon : fabIconColor}
          />
        </TouchableOpacity>

        {routeList.length > 0 && (
          <TouchableOpacity
            style={[styles.routesCountFab, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]}
            onPress={() => {
              setIsLayersMenuOpen(false);
              setIsRoutesMenuOpen(false);
              setIsRoutesScreenOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Feather name="list" size={16} color={colors.primaryForeground} />
            <Text style={[styles.routesCountFabText, { color: colors.primaryForeground }]}>{routeList.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLayersMenuOpen && (
        <View style={[styles.floatingPanel, { top: top + 56, backgroundColor: isDark ? colors.overlay : colors.card, borderColor: colors.border }]}>
          <Text style={[styles.floatingPanelTitle, { color: colors.mutedForeground }]}>Visão do mapa</Text>

          <TouchableOpacity
            style={[styles.layerOption, { backgroundColor: colors.card }, mapViewMode === "satellite" && [styles.layerOptionActive, { backgroundColor: colors.primary }]]}
            onPress={() => setBaseLayer("satellite")}
            activeOpacity={0.8}
          >
            <Text style={[styles.layerOptionText, { color: mapViewMode === "satellite" ? colors.primaryForeground : colors.foreground }]}>Satélite</Text>
            {mapViewMode === "satellite" && <Feather name="check" size={16} color={colors.primaryForeground} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerOption, { backgroundColor: colors.card }, mapViewMode === "topographic" && [styles.layerOptionActive, { backgroundColor: colors.primary }]]}
            onPress={() => setBaseLayer("topographic")}
            activeOpacity={0.8}
          >
            <Text style={[styles.layerOptionText, { color: mapViewMode === "topographic" ? colors.primaryForeground : colors.foreground }]}>Topográfico</Text>
            {mapViewMode === "topographic" && <Feather name="check" size={16} color={colors.primaryForeground} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerOption, { backgroundColor: colors.card }, mapViewMode === "streets" && [styles.layerOptionActive, { backgroundColor: colors.primary }]]}
            onPress={() => setBaseLayer("streets")}
            activeOpacity={0.8}
          >
            <Text style={[styles.layerOptionText, { color: mapViewMode === "streets" ? colors.primaryForeground : colors.foreground }]}>Ruas</Text>
            {mapViewMode === "streets" && <Feather name="check" size={16} color={colors.primaryForeground} />}
          </TouchableOpacity>
        </View>
      )}

      {isRoutesMenuOpen && (
        <View style={[styles.floatingPanel, { top: top + 56, backgroundColor: isDark ? colors.overlay : colors.card, borderColor: colors.border }]}>
          <Text style={[styles.floatingPanelTitle, { color: colors.mutedForeground }]}>Trajetos</Text>

          <View style={[styles.switchRow, { backgroundColor: colors.card }]}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Mostrar trajetos</Text>
            <Switch
              value={showRoutes}
              onValueChange={toggleRoutes}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.primaryForeground}
              ios_backgroundColor={colors.muted}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>
        </View>
      )}
    </>
  );
}

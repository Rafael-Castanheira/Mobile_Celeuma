import { Feather } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

export default function MapFloatingControls({
  colors,
  top,
  isAdmin,
  openCreatePointModal,
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
}) {
  return (
    <>
      <View style={[styles.fabRow, { top: top + 8 }]}>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.fabButton, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]}
            onPress={openCreatePointModal}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.overlay, borderColor: colors.border }, isLayersMenuOpen && [styles.fabButtonActive, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]]}
          onPress={() => {
            setIsLayersMenuOpen((prev) => !prev);
            setIsRoutesMenuOpen(false);
          }}
          activeOpacity={0.8}
        >
          <Feather name="layers" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.overlay, borderColor: colors.border }, isRoutesMenuOpen && [styles.fabButtonActive, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]]}
          onPress={() => {
            setIsRoutesMenuOpen((prev) => !prev);
            setIsLayersMenuOpen(false);
          }}
          activeOpacity={0.8}
        >
          <Feather name="sliders" size={18} color={colors.foreground} />
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
        <View style={[styles.floatingPanel, { top: top + 56, backgroundColor: colors.overlay, borderColor: colors.border }]}> 
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
        <View style={[styles.floatingPanel, { top: top + 56, backgroundColor: colors.overlay, borderColor: colors.border }]}> 
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

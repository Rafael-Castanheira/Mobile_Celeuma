import { Feather } from "@expo/vector-icons";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

export default function MapBottomPanel({
  colors,
  tabBarHeight,
  bottomTab,
  setBottomTab,
  points,
  resolvedRoutes,
  isLoadingPoints,
  isLoadingRoutes,
  pointsError,
  routesError,
  selectedIndex,
  handlePointPress,
  selectedRouteId,
  setSelectedRouteId,
  ensureRouteRendered,
  setRouteList,
  routeMetricsById,
  formatDistance,
  formatDuration,
}) {
  return (
    <View style={{ flex: 1, position: "relative", paddingBottom: tabBarHeight }}>
      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.bottomTabs, { backgroundColor: colors.muted }]}>
          <TouchableOpacity
            style={[styles.bottomTab, bottomTab === "points" && [styles.bottomTabActive, { backgroundColor: colors.primary }]]}
            onPress={() => setBottomTab("points")}
            activeOpacity={0.7}
          >
            <Text style={[styles.bottomTabText, { color: colors.mutedForeground }, bottomTab === "points" && [styles.bottomTabTextActive, { color: colors.primaryForeground }]]}>Pontos</Text>
            {points.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: bottomTab === "points" ? colors.softOverlay : colors.accentSoft }]}>
                <Text style={[styles.tabBadgeText, { color: bottomTab === "points" ? colors.primaryForeground : colors.foreground }]}>{points.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomTab, bottomTab === "routes" && [styles.bottomTabActive, { backgroundColor: colors.primary }]]}
            onPress={() => setBottomTab("routes")}
            activeOpacity={0.7}
          >
            <Text style={[styles.bottomTabText, { color: colors.mutedForeground }, bottomTab === "routes" && [styles.bottomTabTextActive, { color: colors.primaryForeground }]]}>Trajetos</Text>
            {resolvedRoutes.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: bottomTab === "routes" ? colors.softOverlay : colors.accentSoft }]}>
                <Text style={[styles.tabBadgeText, { color: bottomTab === "routes" ? colors.primaryForeground : colors.foreground }]}>{resolvedRoutes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {(isLoadingPoints || isLoadingRoutes) && <Text style={[styles.listStatus, { color: colors.mutedForeground }]}>A carregar pontos e trajetos...</Text>}
        {pointsError && <Text style={[styles.listStatus, { color: colors.destructive }]}>{pointsError}</Text>}
        {routesError && !pointsError && <Text style={[styles.listStatus, { color: colors.destructive }]}>{routesError}</Text>}

        <ScrollView showsVerticalScrollIndicator={false}>
          {bottomTab === "points" && (
            <>
              {!isLoadingPoints && !pointsError && points.length === 0 && (
                <Text style={[styles.listStatus, { color: colors.mutedForeground }]}>Sem pontos disponíveis.</Text>
              )}
              {points.map((point, index) => (
                <TouchableOpacity
                  key={`${point.title}-${index}`}
                  style={[styles.listItem, { backgroundColor: colors.card }, selectedIndex === index && [styles.listItemSelected, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]]}
                  onPress={() => handlePointPress(index)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dot, { backgroundColor: colors.primary }, selectedIndex === index && [styles.dotSelected, { backgroundColor: colors.primaryForeground }]]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listTitle, { color: colors.foreground }]}>{point.title}</Text>
                    <Text style={[styles.listDetail, { color: selectedIndex === index ? colors.primaryForeground : colors.mutedForeground }]}>
                      {selectedIndex === index ? "Selecionar destino..." : point.detail}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {bottomTab === "routes" && (
            <>
              {!isLoadingRoutes && !routesError && resolvedRoutes.length === 0 && (
                <Text style={[styles.listStatus, { color: colors.mutedForeground }]}>Sem trajetos disponíveis.</Text>
              )}
              {resolvedRoutes.map((route) => {
                const isSelected = selectedRouteId === route.id;
                const metrics = routeMetricsById[route.id];
                return (
                  <TouchableOpacity
                    key={route.id}
                    style={[styles.listItem, { backgroundColor: colors.card }, isSelected && [styles.listItemSelected, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]]}
                    onPress={() => {
                      setSelectedRouteId(route.id);
                      void ensureRouteRendered(route);
                      setRouteList((prev) =>
                        prev.some((r) => r.id === route.id) ? prev : [...prev, route]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="navigation"
                      size={14}
                      color={isSelected ? colors.primaryForeground : colors.primary}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listTitle, { color: colors.foreground }]}>{route.name}</Text>
                      <Text style={[styles.listDetail, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}>
                        {metrics
                          ? `${formatDistance(metrics.distanceMeters)}  •  ${formatDuration(metrics.durationSeconds)}`
                          : "A calcular..."}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

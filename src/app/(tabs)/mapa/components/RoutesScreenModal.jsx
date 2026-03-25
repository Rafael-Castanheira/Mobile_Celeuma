import { Feather } from "@expo/vector-icons";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

export default function RoutesScreenModal({
  isOpen,
  onClose,
  top,
  colors,
  routeList,
  routeMetricsById,
  expandedRouteId,
  setExpandedRouteId,
  selectedRouteId,
  setSelectedRouteId,
  ensureRouteRendered,
  formatDistance,
  formatDuration,
  onRemoveRoute,
}) {
  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.routesScreen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.routesScreenHeader,
            { paddingTop: top + 16, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.routesScreenBackBtn, { backgroundColor: colors.card }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.routesScreenTitle, { color: colors.foreground }]}>
            Trajetos Selecionados
          </Text>
          {routeList.length > 0 && (
            <View style={[styles.routesScreenBadge, { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.routesScreenBadgeText,
                  { color: colors.primaryForeground },
                ]}
              >
                {routeList.length}
              </Text>
            </View>
          )}
        </View>

        {routeList.length === 0 ? (
          <View style={styles.routesScreenEmpty}>
            <Feather name="map" size={40} color={colors.iconMuted} />
            <Text style={[styles.routesScreenEmptyText, { color: colors.mutedForeground }]}>
              Seleciona um trajeto na lista para o mostrar no mapa.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.routesScreenList}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {routeList.map((route) => {
              const metrics = routeMetricsById[route.id];
              const isExpanded = expandedRouteId === route.id;
              return (
                <View
                  key={route.id}
                  style={[
                    styles.routeCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isExpanded && [styles.routeCardExpanded, { borderColor: colors.primary }],
                  ]}
                >
                  <TouchableOpacity
                    style={styles.routeCardHeader}
                    onPress={() => {
                      const next = isExpanded ? null : route.id;
                      setExpandedRouteId(next);
                      if (next !== null) {
                        setSelectedRouteId(route.id);
                        void ensureRouteRendered(route);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather
                      name="navigation"
                      size={16}
                      color={colors.primary}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.routeCardName, { color: colors.foreground }]}>
                        {route.name}
                      </Text>
                      <Text style={[styles.routeCardMeta, { color: colors.mutedForeground }]}>
                        {metrics
                          ? `${formatDistance(metrics.distanceMeters)}  •  ${formatDuration(
                              metrics.durationSeconds
                            )}`
                          : "A calcular..."}
                      </Text>
                    </View>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.iconMuted}
                    />
                    <TouchableOpacity
                      onPress={() => onRemoveRoute(route.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                      style={{ marginLeft: 4 }}
                    >
                      <Feather name="x" size={16} color={colors.iconMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View
                      style={[
                        styles.routeCardDirections,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.routeDirectionsLabel, { color: colors.mutedForeground }]}
                      >
                        Direções
                      </Text>
                      {!metrics ? (
                        <Text style={[styles.routeDirectionText, { color: colors.foreground }]}>
                          A carregar direções...
                        </Text>
                      ) : metrics.steps.length === 0 ? (
                        <Text style={[styles.routeDirectionText, { color: colors.foreground }]}>
                          Sem direções disponíveis.
                        </Text>
                      ) : (
                        metrics.steps.map((step, i) => (
                          <Text key={i} style={[styles.routeDirectionText, { color: colors.foreground }]}>
                            {i + 1}. {step}
                          </Text>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

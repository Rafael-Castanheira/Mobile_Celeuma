import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { createPonto, getMapPoints, getPointCategories } from "../../lib/360api";

import CreatePointModal from "./mapa/components/CreatePointModal";
import RoutesScreenModal from "./mapa/components/RoutesScreenModal";
import { buildMapHtml } from "./mapa/mapHtml";
import { fetchOSRMRoute } from "./mapa/osrm";
import { styles } from "./mapa/styles";
import { useMapData } from "./mapa/useMapData";
import {
    approximatePolylineDistanceMeters,
    formatDistance,
    formatDuration,
    toPortugueseDirection,
} from "./mapa/utils";

export default function MapaScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { top } = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { colors } = useAppTheme();
  const { showError, showInfo, showSuccess } = useDialog();
  const webViewRef = useRef(null);
  const [coords, setCoords] = useState({ lat: "--", lng: "--" });
  const [cursorCoords, setCursorCoords] = useState(null);
  const {
    points,
    setPoints,
    apiRoutes,
    pointsError,
    routesError,
    isLoadingPoints,
    isLoadingRoutes,
  } = useMapData();
  const [showRoutes, setShowRoutes] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [isRoutesMenuOpen, setIsRoutesMenuOpen] = useState(false);
  const [canGoBackInMap, setCanGoBackInMap] = useState(false);
  const [hasOpenedMapLink, setHasOpenedMapLink] = useState(false);
  const [mapViewMode, setMapViewMode] = useState("satellite");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [routeList, setRouteList] = useState([]);
  const [routeDrawnCount, setRouteDrawnCount] = useState(0);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeMetricsById, setRouteMetricsById] = useState({});
  const [isRoutesScreenOpen, setIsRoutesScreenOpen] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [longPressedIndex, setLongPressedIndex] = useState(null);
  const [bottomTab, setBottomTab] = useState("points");
  const [isCreatePointModalOpen, setIsCreatePointModalOpen] = useState(false);
  const [newPointName, setNewPointName] = useState("");
  const [newPointDescription, setNewPointDescription] = useState("");
  const [newPointCategoryIds, setNewPointCategoryIds] = useState([]);
  const [newPointImage, setNewPointImage] = useState(null);
  const [pointCategories, setPointCategories] = useState([]);
  const [isLoadingPointCategories, setIsLoadingPointCategories] = useState(false);
  const [isCreatingPoint, setIsCreatingPoint] = useState(false);
  const hasBootstrappedRoutes = useRef(false);
  const resolvedRoutesRef = useRef([]);
  const routeListRef = useRef([]);

  const resolvedRoutes = useMemo(() => {
    if (!points.length) return [];
    const pointById = new Map(points.map((p) => [p.id, p]));
    return apiRoutes
      .map((route) => {
        const coordinates = route.pointIds
          .map((id) => pointById.get(id))
          .filter(Boolean)
          .map((p) => [p.latitude, p.longitude]);
        if (coordinates.length < 2) return null;
        return { id: route.id, name: route.name, coordinates };
      })
      .filter(Boolean);
  }, [points, apiRoutes]);

  useEffect(() => {
    resolvedRoutesRef.current = resolvedRoutes;
  }, [resolvedRoutes]);

  useEffect(() => {
    routeListRef.current = routeList;
  }, [routeList]);

  const renderedRouteIdsRef = useRef(new Set());
  const renderingRouteIdsRef = useRef(new Set());

  const ensureRouteRendered = useCallback(async (route, signal) => {
    if (!isMapReady) return;
    if (renderedRouteIdsRef.current.has(route.id)) return;
    if (renderingRouteIdsRef.current.has(route.id)) return;

    renderingRouteIdsRef.current.add(route.id);
    try {
      const result = await fetchOSRMRoute(route.coordinates, signal);
      if (signal?.aborted) return;

      const latLngs = result?.latLngs ?? route.coordinates;
      webViewRef.current?.injectJavaScript(
        `window.addRoute(${route.id}, ${JSON.stringify(latLngs)}); true;`
      );
      renderedRouteIdsRef.current.add(route.id);

      setRouteMetricsById((prev) => {
        if (prev[route.id]) return prev;
        if (result) {
          return {
            ...prev,
            [route.id]: {
              distanceMeters: result.distanceMeters,
              durationSeconds: result.durationSeconds,
              steps: result.steps.map(toPortugueseDirection),
            },
          };
        }

        const fallbackDistance = approximatePolylineDistanceMeters(latLngs);
        return {
          ...prev,
          [route.id]: {
            distanceMeters: fallbackDistance,
            durationSeconds: Math.round(fallbackDistance / 1.3),
            steps: [],
          },
        };
      });
    } finally {
      renderingRouteIdsRef.current.delete(route.id);
    }
  }, [isMapReady]);

  function openRouteDetails(route) {
    setSelectedRouteId(route.id);
    setExpandedRouteId(route.id);
    setIsRoutesScreenOpen(true);
  }

  function handleRemoveRoute(routeId) {
    setRouteList((prev) => prev.filter((r) => r.id !== routeId));
    if (expandedRouteId === routeId) setExpandedRouteId(null);
    if (selectedRouteId === routeId) setSelectedRouteId(null);
    webViewRef.current?.injectJavaScript(`window.removeRoute(${routeId}); true;`);
    renderedRouteIdsRef.current.delete(routeId);
    renderingRouteIdsRef.current.delete(routeId);
  }

  async function createRouteBetweenPoints(fromIdx, toIdx) {
    const fromPoint = points[fromIdx];
    const toPoint = points[toIdx];

    // Only select an existing API route that directly connects the two points.
    // A route "connects" the points when they are adjacent in the route's pointIds.
    const existingApiRoute = apiRoutes.find((r) => {
      const a = r.pointIds.indexOf(fromPoint.id);
      const b = r.pointIds.indexOf(toPoint.id);
      return a !== -1 && b !== -1 && Math.abs(a - b) === 1;
    });

    if (!existingApiRoute) {
      showInfo(
        "Não existe trajeto entre estes pontos. Seleciona um trajeto existente na lista de trajetos.",
        "Sem trajeto"
      );
      return;
    }

    const resolved = resolvedRoutesRef.current.find((r) => r.id === existingApiRoute.id);
    if (!resolved) {
      showError("O trajeto existe mas não foi possível carregá-lo no mapa.", "Sem trajeto");
      return;
    }

    setRouteList((prev) => (prev.some((r) => r.id === resolved.id) ? prev : [...prev, resolved]));
    openRouteDetails(resolved);
  }

  function handlePointPress(index) {
    if (index < 0 || index >= points.length) return;
    const point = points[index];
    if (selectedIndex === null) {
      setSelectedIndex(index);
      webViewRef.current?.injectJavaScript(`window.focusPoint(${point.latitude}, ${point.longitude}); true;`);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      void createRouteBetweenPoints(selectedIndex, index);
      setSelectedIndex(null);
    }
  }

  function toggleRoutes(value) {
    setShowRoutes(value);
    webViewRef.current?.injectJavaScript(
      value ? `window.showRoutes(); true;` : `window.hideRoutes(); true;`
    );
  }

  function setBaseLayer(mode) {
    setMapViewMode(mode);
    webViewRef.current?.injectJavaScript(`window.setBaseLayer('${mode}'); true;`);
  }

  function openCreatePointModal() {
    if (!cursorCoords) {
      showInfo("Move o mapa para posicionar a mira e tenta novamente.", "Sem coordenadas");
      return;
    }

    setNewPointName("");
    setNewPointDescription("");
    setNewPointCategoryIds([]);
    setNewPointImage(null);
    setIsCreatePointModalOpen(true);
  }

  async function pickImageForNewPoint() {
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
    setNewPointImage({
      uri: asset.uri,
      name: fileName,
      type: asset.mimeType || "image/jpeg",
    });
  }

  useEffect(() => {
    if (!isCreatePointModalOpen) return;
    let cancelled = false;

    async function loadCategories() {
      setIsLoadingPointCategories(true);
      try {
        const categorias = await getPointCategories();
        if (!cancelled) {
          setPointCategories(categorias);
        }
      } catch {
        if (!cancelled) {
          setPointCategories([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPointCategories(false);
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [isCreatePointModalOpen]);

  async function handleCreatePointAtCursor() {
    if (!cursorCoords) {
      showError("Não foi possível obter a posição atual da mira.", "Sem coordenadas");
      return;
    }

    if (!token) {
      showInfo("Precisas de iniciar sessão para criar pontos.", "Sessão necessária");
      return;
    }

    if (!newPointName.trim()) {
      showError("Define um nome para o ponto.", "Nome obrigatório");
      return;
    }

    if (!newPointDescription.trim()) {
      showError("Define uma descrição para o ponto.", "Descrição obrigatória");
      return;
    }

    if (newPointCategoryIds.length === 0) {
      showError("Seleciona pelo menos uma categoria.", "Categoria obrigatória");
      return;
    }

    if (!newPointImage) {
      showError("Seleciona uma imagem para o ponto.", "Imagem obrigatória");
      return;
    }

    setIsCreatingPoint(true);
    try {
      await createPonto(
        {
          name: newPointName.trim(),
          description: newPointDescription.trim(),
          latitude: cursorCoords.lat,
          longitude: cursorCoords.lng,
          idCategorias: newPointCategoryIds,
          imagePath: "",
          imageFile: newPointImage,
          username: user?.name,
        },
        token
      );

      const freshPoints = await getMapPoints();
      setPoints(freshPoints);
      setIsCreatePointModalOpen(false);
      showSuccess("O novo ponto foi criado na posição da mira.", "Ponto criado");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível criar o ponto.");
    } finally {
      setIsCreatingPoint(false);
    }
  }

  useEffect(() => {
    setIsMapReady(false);
    hasBootstrappedRoutes.current = false;
    setRouteList([]);
    setRouteDrawnCount(0);
    setRouteMetricsById({});
    setIsRoutesScreenOpen(false);
    setExpandedRouteId(null);
    setSelectedRouteId(null);
    renderedRouteIdsRef.current = new Set();
    renderingRouteIdsRef.current = new Set();
  }, [resolvedRoutes]);

  useEffect(() => {
    if (!isMapReady || hasBootstrappedRoutes.current) return;
    hasBootstrappedRoutes.current = true;
    const controller = new AbortController();
    for (const route of resolvedRoutesRef.current) {
      (async () => {
        const result = await fetchOSRMRoute(route.coordinates, controller.signal);
        if (controller.signal.aborted) return;
        if (!result) return;
        setRouteMetricsById((prev) => ({
          ...prev,
          [route.id]: {
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            steps: result.steps.map(toPortugueseDirection),
          },
        }));
      })();
    }
    return () => { controller.abort(); };
  }, [isMapReady]);

  useEffect(() => {
    if (!isMapReady) return;

    if (selectedRouteId === null) {
      webViewRef.current?.injectJavaScript("window.clearSelectedRoute(); true;");
      return;
    }

    const route =
      resolvedRoutesRef.current.find((r) => r.id === selectedRouteId) ??
      routeListRef.current.find((r) => r.id === selectedRouteId);

    if (route) void ensureRouteRendered(route);

    webViewRef.current?.injectJavaScript(`window.selectRoute(${selectedRouteId}); true;`);
  }, [ensureRouteRendered, isMapReady, routeDrawnCount, selectedRouteId]);

  const mapHtml = useMemo(
    () => buildMapHtml(points, [], {
      background: colors.background,
      foreground: colors.foreground,
      card: colors.card,
      border: colors.border,
      primary: colors.primary,
      primaryForeground: colors.primaryForeground,
      mutedForeground: colors.mutedForeground,
      overlay: colors.overlay,
      softOverlay: colors.softOverlay,
      accentSoft: colors.accentSoft,
    }),
    [colors.accentSoft, colors.background, colors.border, colors.card, colors.foreground, colors.mutedForeground, colors.overlay, colors.primary, colors.primaryForeground, colors.softOverlay, points]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHtml }}
          originWhitelist={["*"]}
          javaScriptEnabled
          onLoadEnd={() => setIsMapReady(true)}
          onShouldStartLoadWithRequest={(request) => {
            const isMapDocument =
              request.url === "about:blank" || request.url.startsWith("data:text/html");
            if (!isMapDocument) {
              setHasOpenedMapLink(true);
            }
            return true;
          }}
          onNavigationStateChange={(navState) => {
            setCanGoBackInMap(navState.canGoBack);
            if (!navState.canGoBack) {
              setHasOpenedMapLink(false);
            }
          }}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.longPressIndex !== undefined) {
                setLongPressedIndex(data.longPressIndex);
              } else if (data.markerIndex !== undefined) {
                handlePointPress(data.markerIndex);
              } else if (data.routeInfo !== undefined) {
                const routeInfo = data.routeInfo;
                setRouteMetricsById((prev) => {
                  const existing = prev[routeInfo.id];
                  // If we already have "real" OSRM steps, keep those metrics.
                  if (existing && existing.steps.length > 0) return prev;

                  const incomingSteps =
                    Array.isArray(routeInfo.steps) && routeInfo.steps.length > 0
                      ? routeInfo.steps
                          .filter((step) => typeof step === "string")
                          .map((step) => toPortugueseDirection(step))
                      : [];

                  return {
                    ...prev,
                    [routeInfo.id]: {
                      distanceMeters: Number(routeInfo.distanceMeters) || existing?.distanceMeters || 0,
                      durationSeconds: Number(routeInfo.durationSeconds) || existing?.durationSeconds || 0,
                      steps: incomingSteps.length > 0 ? incomingSteps : (existing?.steps ?? []),
                    },
                  };
                });
              } else if (data.routeDeselected) {
                setSelectedRouteId(null);
              } else if (data.routeSelected !== undefined) {
                const routeId = Number(data.routeSelected);
                if (!Number.isFinite(routeId)) return;
                const selectedRoute =
                  resolvedRoutesRef.current.find((route) => route.id === routeId) ??
                  routeListRef.current.find((route) => route.id === routeId);
                if (!selectedRoute) return;
                setRouteList((prev) => (prev.some((route) => route.id === routeId) ? prev : [...prev, selectedRoute]));
                openRouteDetails(selectedRoute);
              } else if (data.routeRendered !== undefined) {
                setRouteDrawnCount((prev) => prev + 1);
              } else {
                setCoords({ lat: data.lat, lng: data.lng });
                if (
                  data.center &&
                  typeof data.center.lat === "number" &&
                  typeof data.center.lng === "number"
                ) {
                  setCursorCoords({ lat: data.center.lat, lng: data.center.lng });
                }
              }
            } catch {}
          }}
        />

        {canGoBackInMap && hasOpenedMapLink && (
          <TouchableOpacity
            style={[styles.mapBackButton, { top: top + 8 }]}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
        )}

        <View style={[styles.crosshairDot, { borderColor: colors.primary }]} pointerEvents="none" />

        <View style={[styles.fabRow, { top: top + 8 }]}>
          <TouchableOpacity
            style={[styles.fabButton, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]}
            onPress={openCreatePointModal}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>

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
      </View>

      <View style={{ flex: 1, position: 'relative', paddingBottom: tabBarHeight }}>
        <View style={[styles.listContainer, { backgroundColor: colors.background }]}> 
          <View style={[styles.bottomTabs, { backgroundColor: colors.muted }]}> 
            <TouchableOpacity
              style={[styles.bottomTab, bottomTab === 'points' && [styles.bottomTabActive, { backgroundColor: colors.primary }]]}
              onPress={() => setBottomTab('points')}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomTabText, { color: colors.mutedForeground }, bottomTab === 'points' && [styles.bottomTabTextActive, { color: colors.primaryForeground }]]}>Pontos</Text>
              {points.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: bottomTab === 'points' ? colors.softOverlay : colors.accentSoft }]}>
                  <Text style={[styles.tabBadgeText, { color: bottomTab === 'points' ? colors.primaryForeground : colors.foreground }]}>{points.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomTab, bottomTab === 'routes' && [styles.bottomTabActive, { backgroundColor: colors.primary }]]}
              onPress={() => setBottomTab('routes')}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomTabText, { color: colors.mutedForeground }, bottomTab === 'routes' && [styles.bottomTabTextActive, { color: colors.primaryForeground }]]}>Trajetos</Text>
              {resolvedRoutes.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: bottomTab === 'routes' ? colors.softOverlay : colors.accentSoft }]}>
                  <Text style={[styles.tabBadgeText, { color: bottomTab === 'routes' ? colors.primaryForeground : colors.foreground }]}>{resolvedRoutes.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {(isLoadingPoints || isLoadingRoutes) && <Text style={[styles.listStatus, { color: colors.mutedForeground }]}>A carregar pontos e trajetos...</Text>}
          {pointsError && <Text style={[styles.listStatus, { color: colors.destructive }]}>{pointsError}</Text>}
          {routesError && !pointsError && <Text style={[styles.listStatus, { color: colors.destructive }]}>{routesError}</Text>}
          <ScrollView showsVerticalScrollIndicator={false}>
            {bottomTab === 'points' && (
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
            {bottomTab === 'routes' && (
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
                            : 'A calcular...'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>

        <RoutesScreenModal
          isOpen={isRoutesScreenOpen}
          onClose={() => setIsRoutesScreenOpen(false)}
          top={top}
          colors={colors}
          routeList={routeList}
          routeMetricsById={routeMetricsById}
          expandedRouteId={expandedRouteId}
          setExpandedRouteId={setExpandedRouteId}
          selectedRouteId={selectedRouteId}
          setSelectedRouteId={setSelectedRouteId}
          ensureRouteRendered={ensureRouteRendered}
          formatDistance={formatDistance}
          formatDuration={formatDuration}
          onRemoveRoute={handleRemoveRoute}
        />

        {longPressedIndex !== null && points[longPressedIndex] && (
          <TouchableOpacity
            style={[styles.detailCardOverlay, { backgroundColor: colors.background }]}
            onPress={() => setLongPressedIndex(null)}
            activeOpacity={1}
          >
            <View style={styles.detailCardHandle} />
            <Text style={[styles.detailCardTitle, { color: colors.foreground }]}>{points[longPressedIndex].title}</Text>
            <Text style={[styles.detailCardDetail, { color: colors.mutedForeground }]}>{points[longPressedIndex].detail}</Text>
            <View style={styles.detailCardActions}>
              <TouchableOpacity
                style={[styles.detailCardBtn, styles.detailCardBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={(e) => { e.stopPropagation(); }}
                activeOpacity={0.75}
              >
                <Feather name="eye" size={16} color={colors.primaryForeground} />
                <Text style={[styles.detailCardBtnText, { color: colors.primaryForeground }]}>Visualizar 360º</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        <CreatePointModal
          isOpen={isCreatePointModalOpen}
          onClose={() => setIsCreatePointModalOpen(false)}
          colors={colors}
          coords={coords}
          newPointName={newPointName}
          setNewPointName={setNewPointName}
          newPointDescription={newPointDescription}
          setNewPointDescription={setNewPointDescription}
          pointCategories={pointCategories}
          isLoadingPointCategories={isLoadingPointCategories}
          newPointCategoryIds={newPointCategoryIds}
          setNewPointCategoryIds={setNewPointCategoryIds}
          newPointImage={newPointImage}
          pickImageForNewPoint={pickImageForNewPoint}
          isCreatingPoint={isCreatingPoint}
          handleCreatePointAtCursor={handleCreatePointAtCursor}
        />
      </View>
    </View>
  );
}

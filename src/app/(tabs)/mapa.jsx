import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { registarVisualizacao, getMyFavorites, addFavoritePoint, removeFavoritePoint } from "../../lib/360api";
import { isAdminRole } from "../../lib/auth";

import RoutesScreenModal from "../../features/mapa/components/RoutesScreenModal";
import { buildMapHtml } from "../../features/mapa/mapHtml";
import { fetchOSRMRoute } from "../../features/mapa/osrm";
import { styles } from "../../features/mapa/styles";
import { useMapData } from "../../features/mapa/useMapData";
import {
    approximatePolylineDistanceMeters,
    formatDistance,
    formatDuration,
    toPortugueseDirection,
} from "../../features/mapa/utils";

import { ViewerProvider } from "../../context/ViewerContext";
import PointViewerModal from "../../features/viewer/PointViewerModal";
import MapBottomPanel from "../../features/mapa/components/MapBottomPanel";
import MapFloatingControls from "../../features/mapa/components/MapFloatingControls";

export default function MapaScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { top } = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();
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
  const [bottomTab, setBottomTab] = useState("points");
  const [isPointViewerOpen, setIsPointViewerOpen] = useState(false);
  const [pointViewerData, setPointViewerData] = useState(null);
  const [favoritePoints, setFavoritePoints] = useState(new Set());
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const hasBootstrappedRoutes = useRef(false);
  const resolvedRoutesRef = useRef([]);
  const routeListRef = useRef([]);
  const hasShownMapErrorRef = useRef(false);
  const hasShownPointViewerErrorRef = useRef(false);
  const pointViewerRequestIdRef = useRef(0);

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
    if (user && token && !isAdminRole(user?.role)) {
      getMyFavorites(token)
        .then(favs => {
          const pointIds = new Set((favs.pontos || []).map(p => p.id));
          setFavoritePoints(pointIds);
        })
        .catch(() => {});
    }
  }, [user, token]);

  useEffect(() => {
    routeListRef.current = routeList;
  }, [routeList]);

  useEffect(() => {
    if (isMapReady && webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.setFavorites) { window.setFavorites(${JSON.stringify(Array.from(favoritePoints))}); }; true;`);
    }
  }, [favoritePoints, isMapReady]);

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
        const existing = prev[route.id];

        if (result) {
          const resultSteps = result.steps.map(toPortugueseDirection);
          if (resultSteps.length > 0 || !existing || existing.steps.length === 0) {
            return {
              ...prev,
              [route.id]: {
                distanceMeters: result.distanceMeters,
                durationSeconds: result.durationSeconds,
                steps: resultSteps,
              },
            };
          }
        }

        if (existing) return prev;

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

  async function openPointViewerByIndex(index) {
    if (index < 0 || index >= points.length) return;

    const point = points[index];

    setPointViewerData({
      pointId: point.id,
    });
    setIsPointViewerOpen(true);

    if (typeof point.id === "number") {
      registarVisualizacao("ponto", point.id).catch(() => {});
    }
  }

  function closePointViewer() {
    pointViewerRequestIdRef.current += 1;
    setIsPointViewerOpen(false);
    setPointViewerData(null);
    hasShownPointViewerErrorRef.current = false;
  }

  async function toggleFavorite(point) {
    if (!token || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    const isFav = favoritePoints.has(point.id);
    try {
      if (isFav) {
        await removeFavoritePoint(point.id, token);
        setFavoritePoints(prev => {
          const next = new Set(prev);
          next.delete(point.id);
          return next;
        });
      } else {
        await addFavoritePoint(point.id, token);
        setFavoritePoints(prev => {
          const next = new Set(prev);
          next.add(point.id);
          return next;
        });
      }
    } catch (e) {
      showError("Não foi possível atualizar os favoritos.");
    } finally {
      setIsTogglingFavorite(false);
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
        setRouteMetricsById((prev) => {
          const existing = prev[route.id];
          const resultSteps = result.steps.map(toPortugueseDirection);
          if (resultSteps.length > 0 || !existing || existing.steps.length === 0) {
            return {
              ...prev,
              [route.id]: {
                distanceMeters: result.distanceMeters,
                durationSeconds: result.durationSeconds,
                steps: resultSteps,
              },
            };
          }
          return prev;
        });
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
    }, !isAdminRole(user?.role)),
    [colors.accentSoft, colors.background, colors.border, colors.card, colors.foreground, colors.mutedForeground, colors.overlay, colors.primary, colors.primaryForeground, colors.softOverlay, points, user?.role]
  );

  const showMapInitError = useCallback((detail) => {
    if (hasShownMapErrorRef.current) return;
    hasShownMapErrorRef.current = true;
    const suffix = detail ? ` (${detail})` : "";
    showError(
      `Nao foi possivel carregar o mapa no emulador${suffix}. Verifica a internet do emulador e tenta novamente.`,
      "Erro no mapa"
    );
  }, [showError]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHtml }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          androidLayerType="hardware"
          onLoadEnd={() => setIsMapReady(true)}
          onError={({ nativeEvent }) => {
            showMapInitError(nativeEvent?.description);
          }}
          onHttpError={({ nativeEvent }) => {
            showMapInitError(`HTTP ${nativeEvent?.statusCode ?? "erro"}`);
          }}
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
              if (data.mapInitError !== undefined) {
                showMapInitError(data.mapInitError);
              } else if (data.markerIndex !== undefined) {
                void openPointViewerByIndex(Number(data.markerIndex));
              } else if (data.toggleFavoriteIndex !== undefined) {
                const pt = points[Number(data.toggleFavoriteIndex)];
                if (pt) void toggleFavorite(pt);
              } else if (data.routeInfo !== undefined) {
                const routeInfo = data.routeInfo;
                setRouteMetricsById((prev) => {
                  const existing = prev[routeInfo.id];
                  // If we already have "real" OSRM steps, keep those metrics.
                  if (existing && existing.steps.length > 0) {
                    return {
                      ...prev,
                      [routeInfo.id]: {
                        ...existing,
                        distanceMeters: Number(routeInfo.distanceMeters) || existing.distanceMeters,
                        durationSeconds: Number(routeInfo.durationSeconds) || existing.durationSeconds,
                      }
                    };
                  }

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
            onPress={() => webViewRef.current?.goBack()}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
        )}


        <MapFloatingControls
          colors={colors}
          isDark={isDark}
          top={top}
          isLayersMenuOpen={isLayersMenuOpen}
          setIsLayersMenuOpen={setIsLayersMenuOpen}
          isRoutesMenuOpen={isRoutesMenuOpen}
          setIsRoutesMenuOpen={setIsRoutesMenuOpen}
          routeList={routeList}
          setIsRoutesScreenOpen={setIsRoutesScreenOpen}
          mapViewMode={mapViewMode}
          setBaseLayer={setBaseLayer}
          showRoutes={showRoutes}
          toggleRoutes={toggleRoutes}
        />
      </View>

      <MapBottomPanel
        colors={colors}
        tabBarHeight={tabBarHeight}
        bottomTab={bottomTab}
        setBottomTab={setBottomTab}
        points={points}
        resolvedRoutes={resolvedRoutes}
        isLoadingPoints={isLoadingPoints}
        isLoadingRoutes={isLoadingRoutes}
        pointsError={pointsError}
        routesError={routesError}
        selectedIndex={selectedIndex}
        handlePointPress={handlePointPress}
        selectedRouteId={selectedRouteId}
        setSelectedRouteId={setSelectedRouteId}
        ensureRouteRendered={ensureRouteRendered}
        setRouteList={setRouteList}
        routeMetricsById={routeMetricsById}
        formatDistance={formatDistance}
        formatDuration={formatDuration}
      />

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

        {isPointViewerOpen && pointViewerData?.pointId && (
          <ViewerProvider pointId={pointViewerData.pointId} token={token}>
            <PointViewerModal 
              isVisible={isPointViewerOpen} 
              onClose={closePointViewer}
              top={top}
              colors={colors}
              showError={showError}
            />
          </ViewerProvider>
        )}


    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";
import { createPonto, getMapPoints, getPointCategories, registarVisualizacao } from "../../lib/360api";
import { BASE_URL } from "../../lib/api/client";

import CreatePointModal from "../../features/mapa/components/CreatePointModal";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPointViewerHtml(sourceUrl, pointTitle, pointDetail, colors) {
  const safeTitle = escapeHtml(pointTitle);
  const safeDetail = escapeHtml(pointDetail);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css" />
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #viewer { width: 100%; height: 100%; background: ${colors.background}; }
    body { font-family: sans-serif; overflow: hidden; }
    .point-meta {
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 10;
      max-width: calc(100% - 24px);
      background: ${colors.overlay};
      color: ${colors.foreground};
      border: 1px solid ${colors.border};
      border-radius: 12px;
      padding: 10px 12px;
      backdrop-filter: blur(4px);
    }
    .point-meta h1 {
      font-size: 15px;
      line-height: 20px;
      margin-bottom: 4px;
    }
    .point-meta p {
      font-size: 13px;
      line-height: 18px;
      color: ${colors.mutedForeground};
    }
    .viewer-error {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      color: ${colors.foreground};
      background: ${colors.background};
      font-size: 14px;
      line-height: 20px;
      z-index: 15;
    }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div class="point-meta">
    <h1>${safeTitle}</h1>
    <p>${safeDetail}</p>
  </div>
  <div id="viewer-error" class="viewer-error"></div>
  <script>
    (function() {
      function sendMessage(payload) {
        if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function showError(message) {
        var errorNode = document.getElementById('viewer-error');
        errorNode.style.display = 'flex';
        errorNode.innerText = message;
      }

      var panoramaUrl = ${JSON.stringify(sourceUrl)};
      if (!panoramaUrl || typeof panoramaUrl !== 'string') {
        showError('Este ponto nao tem imagem 360 disponivel.');
        sendMessage({ point360Error: 'missing-panorama-url' });
        return;
      }

      if (typeof window.pannellum === 'undefined') {
        showError('Nao foi possivel carregar o visualizador 360.');
        sendMessage({ point360Error: 'pannellum-lib-unavailable' });
        return;
      }

      try {
        window.pannellum.viewer('viewer', {
          type: 'equirectangular',
          panorama: panoramaUrl,
          autoLoad: true,
          showControls: true,
          compass: true,
          hfov: 110,
          minHfov: 50,
          maxHfov: 130
        });
      } catch (error) {
        showError('Nao foi possivel abrir esta imagem 360 neste dispositivo.');
        sendMessage({ point360Error: (error && error.message) ? error.message : 'viewer-init-failed' });
      }
    })();
  </script>
</body>
</html>`;
}

function resolvePanoramaSource(point) {
  const apiBaseUrl = BASE_URL.replace(/\/+$/, "");

  function normalizeSource(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }

    if (/^\/?uploads\//i.test(trimmed) || /^[^\s]+\.(jpg|jpeg|png|webp|gif|bmp|hdr|exr)(\?.*)?$/i.test(trimmed)) {
      return `${apiBaseUrl}/${trimmed.replace(/^\/+/, "")}`;
    }

    return `data:image/jpeg;base64,${trimmed}`;
  }

  return (
    normalizeSource(point?.environment)
    ?? normalizeSource(point?.imageUrl)
    ?? normalizeSource(point?.image)
  );
}

function isHttpSource(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader indisponivel"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao converter imagem"));
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Resultado invalido na conversao"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

async function toViewerSourceUrl(sourceUrl) {
  if (!isHttpSource(sourceUrl)) return sourceUrl;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Falha ao descarregar imagem (${response.status})`);
  }

  if (typeof response.blob !== "function") {
    throw new Error("Leitura de blob nao suportada no dispositivo");
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export default function MapaScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { top } = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { colors } = useAppTheme();
  const { showError, showInfo, showSuccess } = useDialog();
  const webViewRef = useRef(null);
  const pointViewerRef = useRef(null);
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
  const [isPointViewerOpen, setIsPointViewerOpen] = useState(false);
  const [isPointViewerLoading, setIsPointViewerLoading] = useState(false);
  const [pointViewerData, setPointViewerData] = useState(null);
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

  async function openPointViewerByIndex(index) {
    if (index < 0 || index >= points.length) return;

    const point = points[index];
    const sourceUrl = resolvePanoramaSource(point);

    if (!sourceUrl) {
      showInfo("Este ponto ainda não tem uma imagem 360 disponível.", "Sem visão 360");
      return;
    }

    hasShownPointViewerErrorRef.current = false;
    setLongPressedIndex(null);
    setIsPointViewerLoading(true);
    setIsPointViewerOpen(true);
    setPointViewerData(null);

    const requestId = pointViewerRequestIdRef.current + 1;
    pointViewerRequestIdRef.current = requestId;

    try {
      const resolvedViewerSource = await toViewerSourceUrl(sourceUrl);
      if (pointViewerRequestIdRef.current !== requestId) return;

      setPointViewerData({
        title: point.title,
        detail: point.detail,
        sourceUrl: resolvedViewerSource,
        pointId: point.id,
      });
    } catch {
      if (pointViewerRequestIdRef.current !== requestId) return;
      setPointViewerData({
        title: point.title,
        detail: point.detail,
        sourceUrl,
        pointId: point.id,
      });
    }

    if (typeof point.id === "number") {
      registarVisualizacao("ponto", point.id).catch(() => {});
    }
  }

  function closePointViewer() {
    pointViewerRequestIdRef.current += 1;
    setIsPointViewerOpen(false);
    setIsPointViewerLoading(false);
    setPointViewerData(null);
    hasShownPointViewerErrorRef.current = false;
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

  const pointViewerHtml = useMemo(() => {
    if (!pointViewerData?.sourceUrl) return "";
    return buildPointViewerHtml(
      pointViewerData.sourceUrl,
      pointViewerData.title,
      pointViewerData.detail,
      {
        background: colors.background,
        foreground: colors.foreground,
        border: colors.border,
        overlay: colors.overlay,
        mutedForeground: colors.mutedForeground,
      }
    );
  }, [colors.background, colors.border, colors.foreground, colors.mutedForeground, colors.overlay, pointViewerData]);

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
              } else if (data.longPressIndex !== undefined) {
                setLongPressedIndex(data.longPressIndex);
              } else if (data.markerIndex !== undefined) {
                void openPointViewerByIndex(Number(data.markerIndex));
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
            onPress={() => webViewRef.current?.goBack()}
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
                onPress={(e) => {
                  e.stopPropagation();
                  void openPointViewerByIndex(longPressedIndex);
                }}
                activeOpacity={0.75}
              >
                <Feather name="eye" size={16} color={colors.primaryForeground} />
                <Text style={[styles.detailCardBtnText, { color: colors.primaryForeground }]}>Visualizar 360º</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        <Modal
          visible={isPointViewerOpen}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={closePointViewer}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {pointViewerData && (
              <WebView
                ref={pointViewerRef}
                style={{ flex: 1, backgroundColor: colors.background }}
                source={{ html: pointViewerHtml }}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                onLoadEnd={() => setIsPointViewerLoading(false)}
                onError={() => {
                  setIsPointViewerLoading(false);
                  if (hasShownPointViewerErrorRef.current) return;
                  hasShownPointViewerErrorRef.current = true;
                  showError("Não foi possível carregar a visão 360 deste ponto.", "Erro no visualizador 360");
                }}
                onHttpError={() => {
                  setIsPointViewerLoading(false);
                  if (hasShownPointViewerErrorRef.current) return;
                  hasShownPointViewerErrorRef.current = true;
                  showError("Falha de rede ao abrir a visão 360.", "Erro no visualizador 360");
                }}
                onMessage={(event) => {
                  try {
                    const payload = JSON.parse(event.nativeEvent.data);
                    if (!payload?.point360Error) return;
                    if (hasShownPointViewerErrorRef.current) return;
                    hasShownPointViewerErrorRef.current = true;
                    showError("Não foi possível abrir esta imagem no visualizador 360.", "Erro no visualizador 360");
                  } catch {}
                }}
              />
            )}

            <TouchableOpacity
              style={[
                styles.mapBackButton,
                {
                  top: top + 8,
                  left: 12,
                  right: undefined,
                  backgroundColor: colors.overlay,
                  borderColor: colors.border,
                },
              ]}
              onPress={closePointViewer}
              activeOpacity={0.8}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>

            {isPointViewerLoading && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.22)",
                }}
              >
                <ActivityIndicator size="large" color={colors.primaryForeground} />
              </View>
            )}
          </View>
        </Modal>

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

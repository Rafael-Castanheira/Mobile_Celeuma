import { getMapPoints, type MapPoint } from "@/src/lib/360api";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const DEFAULT_MAP_CENTER = {
  latitude: -4.8668,
  longitude: -43.3536,
};

type RouteMetrics = {
  distanceMeters: number;
  durationSeconds: number;
  steps: string[];
};

function buildMapHtml(points: MapPoint[]) {
  const initialCenter = points[0] ?? DEFAULT_MAP_CENTER;
  const markers = points
    .map(
      (p, i) =>
        `L.marker([${p.latitude}, ${p.longitude}], { icon: purpleIcon })
          .addTo(map)
          .bindPopup("<b>${p.title}</b><br>${p.detail}")
          .on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ markerIndex: ${i} }));
          })
          .on('contextmenu', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ longPressIndex: ${i} }));
          });`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-routing-container { display: none; }
    .leaflet-bottom.leaflet-right .leaflet-control { margin-bottom: 10px; margin-right: 8px; }
    .leaflet-control-attribution {
      background: rgba(13, 0, 0, 0.82) !important;
      color: rgba(248, 250, 252, 0.75) !important;
      border: 1px solid rgba(220, 38, 38, 0.35);
      border-radius: 8px;
      padding: 3px 8px !important;
      backdrop-filter: blur(2px);
    }
    .leaflet-control-attribution a {
      color: #dc2626 !important;
      font-weight: 700;
    }
    .leaflet-control-attribution a:hover {
      color: #ef4444 !important;
    }
    .leaflet-control-zoom {
      border: 1px solid rgba(220, 38, 38, 0.35) !important;
      border-radius: 10px !important;
      overflow: hidden;
      box-shadow: none !important;
    }
    .leaflet-control-zoom a {
      background-color: rgba(13, 0, 0, 0.82) !important;
      color: #f8fafc !important;
      border: none !important;
      border-bottom: 1px solid rgba(220, 38, 38, 0.25) !important;
    }
    .leaflet-control-zoom a:last-child {
      border-bottom: none !important;
    }
    .leaflet-control-zoom a:hover {
      background-color: #7a1313 !important;
      color: #ffffff !important;
    }
    .leaflet-control-zoom a.leaflet-disabled {
      color: rgba(248, 250, 252, 0.35) !important;
      background-color: rgba(13, 0, 0, 0.6) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { maxZoom: 17, zoomControl: false }).setView([${initialCenter.latitude}, ${initialCenter.longitude}], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    var baseLayers = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 17,
        maxZoom: 17
      }),
      topographic: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 17,
        maxZoom: 17
      }),
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxNativeZoom: 17,
        maxZoom: 17
      })
    };
    var activeBaseLayer = null;
    window.setBaseLayer = function(mode) {
      if (!baseLayers[mode]) return;
      if (activeBaseLayer) {
        map.removeLayer(activeBaseLayer);
      }
      activeBaseLayer = baseLayers[mode];
      activeBaseLayer.addTo(map);
    };
    window.setBaseLayer('satellite');
    var purpleIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    ${markers}
    window.focusPoint = function(lat, lng) {
      map.setView([lat, lng], 16, { animate: true });
    };
    var routes = {};
    var routesVisible = true;
    var routeCounter = 0;
    window.addRoute = function(id, lat1, lng1, lat2, lng2) {
      var ctrl = L.Routing.control({
        waypoints: [L.latLng(lat1, lng1), L.latLng(lat2, lng2)],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        lineOptions: { styles: [{ color: '#dc2626', weight: 4, opacity: 0.85 }] },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
        createMarker: function() { return null; }
      }).addTo(map);
      ctrl.on('routesfound', function(e) {
        var route = e.routes && e.routes[0];
        if (!route) return;
        var summary = route.summary || {};
        var steps = (route.instructions || [])
          .map(function(inst) { return inst.text; })
          .filter(Boolean);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          routeInfo: {
            id: id,
            distanceMeters: summary.totalDistance || 0,
            durationSeconds: summary.totalTime || 0,
            steps: steps
          }
        }));
      });
      routes[id] = ctrl;
    };
    window.removeRoute = function(id) {
      if (routes[id]) { map.removeControl(routes[id]); delete routes[id]; }
    };
    window.clearRoutes = function() {
      Object.values(routes).forEach(function(r) { map.removeControl(r); });
      routes = {};
    };
    window.showRoutes = function() {
      routesVisible = true;
      Object.values(routes).forEach(function(r) { r.addTo(map); });
    };
    window.hideRoutes = function() {
      routesVisible = false;
      Object.values(routes).forEach(function(r) { map.removeControl(r); });
    };
    function sendCenter() {
      var c = map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat.toFixed(4), lng: c.lng.toFixed(4) }));
    }
    map.on('move', sendCenter);
    sendCenter();
  </script>
</body>
</html>`;
}

export default function MapaScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { top } = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [coords, setCoords] = useState({ lat: "--", lng: "--" });
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [isRoutesMenuOpen, setIsRoutesMenuOpen] = useState(false);
  const [canGoBackInMap, setCanGoBackInMap] = useState(false);
  const [hasOpenedMapLink, setHasOpenedMapLink] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<"satellite" | "topographic" | "streets">("satellite");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [routeList, setRouteList] = useState<{ id: number; from: string; to: string }[]>([]);
  const [routeMetricsById, setRouteMetricsById] = useState<Record<number, RouteMetrics>>({});
  const [selectedRouteCard, setSelectedRouteCard] = useState<{
    key: number | "single";
    title: string;
    distanceLabel: string;
    durationLabel: string;
    steps: string[];
  } | null>(null);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);
  const routeCounter = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPoints() {
      setIsLoadingPoints(true);
      setPointsError(null);

      try {
        const data = await getMapPoints(controller.signal);
        setPoints(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPointsError(error instanceof Error ? error.message : "Erro ao carregar pontos.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPoints(false);
        }
      }
    }

    loadPoints();

    return () => controller.abort();
  }, []);

  function formatDistance(distanceMeters: number) {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }

  function formatDuration(durationSeconds: number) {
    return `${Math.max(1, Math.round(durationSeconds / 60))} min`;
  }

  function toPortugueseDirection(step: string) {
    const normalized = step.trim();
    if (!normalized) return normalized;

    return normalized
      .replace(/\bHead\b/gi, "Siga")
      .replace(/\bContinue\b/gi, "Continue")
      .replace(/\bSlight right\b/gi, "Vire ligeiramente à direita")
      .replace(/\bSlight left\b/gi, "Vire ligeiramente à esquerda")
      .replace(/\bTurn right\b/gi, "Vire à direita")
      .replace(/\bTurn left\b/gi, "Vire à esquerda")
      .replace(/\bKeep right\b/gi, "Mantenha-se à direita")
      .replace(/\bKeep left\b/gi, "Mantenha-se à esquerda")
      .replace(/\bMake a U-turn\b/gi, "Faça retorno")
      .replace(/\bEnter the roundabout\b/gi, "Entre na rotatória")
      .replace(/\bAt the roundabout, take the ([0-9]+)(st|nd|rd|th) exit\b/gi, "Na rotatória, pegue a $1ª saída")
      .replace(/\bTake the ramp\b/gi, "Pegue a alça")
      .replace(/\bTake the ferry\b/gi, "Pegue a balsa")
      .replace(/\bDestination is on the right\b/gi, "O destino está à direita")
      .replace(/\bDestination is on the left\b/gi, "O destino está à esquerda")
      .replace(/\bArrive at your destination\b/gi, "Você chegou ao destino")
      .replace(/\bon\b/gi, "na")
      .replace(/\bonto\b/gi, "para")
      .replace(/\btowards\b/gi, "em direção a");
  }

  function openRouteDetails(route: { id: number; from: string; to: string }) {
    const metrics = routeMetricsById[route.id];
    if (!metrics) return;
    setSelectedRouteCard({
      key: route.id,
      title: `${route.from} → ${route.to}`,
      distanceLabel: formatDistance(metrics.distanceMeters),
      durationLabel: formatDuration(metrics.durationSeconds),
      steps: metrics.steps.length ? metrics.steps : ["Sem direções disponíveis."],
    });
  }

  function openSingleRouteDetails() {
    const segments = routeList
      .map((route) => ({ route, metrics: routeMetricsById[route.id] }))
      .filter((segment): segment is { route: { id: number; from: string; to: string }; metrics: RouteMetrics } =>
        Boolean(segment.metrics)
      );

    if (!segments.length) return;

    const totalDistance = segments.reduce((sum, segment) => sum + segment.metrics.distanceMeters, 0);
    const totalDuration = segments.reduce((sum, segment) => sum + segment.metrics.durationSeconds, 0);
    const steps = segments.flatMap((segment) => [
      `${segment.route.from} → ${segment.route.to}`,
      ...(segment.metrics.steps.length ? segment.metrics.steps : ["Sem direções disponíveis."]),
    ]);

    setSelectedRouteCard({
      key: "single",
      title: "Trajeto único",
      distanceLabel: formatDistance(totalDistance),
      durationLabel: formatDuration(totalDuration),
      steps,
    });
  }

  function handlePointPress(index: number) {
    if (index < 0 || index >= points.length) return;
    const point = points[index];
    if (selectedIndex === null) {
      // First selection
      setSelectedIndex(index);
      webViewRef.current?.injectJavaScript(
        `window.focusPoint(${point.latitude}, ${point.longitude}); true;`
      );
    } else if (selectedIndex === index) {
      // Deselect
      setSelectedIndex(null);
    } else {
      // Second selection — draw route, keep new point selected for chaining
      const from = points[selectedIndex];
      const alreadyExists = routeList.some(
        (r) =>
          (r.from === from.title && r.to === point.title) ||
          (r.from === point.title && r.to === from.title)
      );
      // Set new point as the selected origin for the next route
      setSelectedIndex(index);
      webViewRef.current?.injectJavaScript(
        `window.focusPoint(${point.latitude}, ${point.longitude}); true;`
      );
      if (alreadyExists) return;
      const id = ++routeCounter.current;
      webViewRef.current?.injectJavaScript(
        `window.addRoute(${id}, ${from.latitude}, ${from.longitude}, ${point.latitude}, ${point.longitude}); true;`
      );
      setRouteList((prev) => [...prev, { id, from: from.title, to: point.title }]);
      if (!showRoutes) {
        setShowRoutes(true);
      }
    }
  }

  function removeRoute(id: number) {
    webViewRef.current?.injectJavaScript(`window.removeRoute(${id}); true;`);
    setRouteList((prev) => prev.filter((r) => r.id !== id));
    setRouteMetricsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedRouteCard(null);
  }

  function toggleRoutes(value: boolean) {
    setShowRoutes(value);
    webViewRef.current?.injectJavaScript(
      value ? `window.showRoutes(); true;` : `window.hideRoutes(); true;`
    );
  }

  function setBaseLayer(mode: "satellite" | "topographic" | "streets") {
    setMapViewMode(mode);
    webViewRef.current?.injectJavaScript(`window.setBaseLayer('${mode}'); true;`);
  }

  const [singleRoute, setSingleRoute] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: buildMapHtml(points) }}
          originWhitelist={["*"]}
          javaScriptEnabled
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
                setRouteMetricsById((prev) => ({
                  ...prev,
                  [routeInfo.id]: {
                    distanceMeters: Number(routeInfo.distanceMeters) || 0,
                    durationSeconds: Number(routeInfo.durationSeconds) || 0,
                    steps: Array.isArray(routeInfo.steps)
                      ? routeInfo.steps
                          .filter((step: unknown) => typeof step === "string")
                          .map((step: string) => toPortugueseDirection(step))
                      : [],
                  },
                }));
              } else {
                setCoords({ lat: data.lat, lng: data.lng });
              }
            } catch {}
          }}
        />

        {canGoBackInMap && hasOpenedMapLink && (
          <TouchableOpacity
            style={[styles.mapBackButton, { top: top + 8 }]}
            onPress={() => webViewRef.current?.goBack()}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={18} color="#f8fafc" />
          </TouchableOpacity>
        )}

        <View style={styles.crosshairDot} pointerEvents="none" />

        <View style={[styles.fabRow, { top: top + 8 }]}>
          <TouchableOpacity
            style={[styles.fabButton, isLayersMenuOpen && styles.fabButtonActive]}
            onPress={() => {
              setIsLayersMenuOpen((prev) => !prev);
              setIsRoutesMenuOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Feather name="layers" size={18} color="#f8fafc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fabButton, isRoutesMenuOpen && styles.fabButtonActive]}
            onPress={() => {
              setIsRoutesMenuOpen((prev) => !prev);
              setIsLayersMenuOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={18} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        {isLayersMenuOpen && (
          <View style={[styles.floatingPanel, { top: top + 56 }]}>
            <Text style={styles.floatingPanelTitle}>Visão do mapa</Text>

            <TouchableOpacity
              style={[styles.layerOption, mapViewMode === "satellite" && styles.layerOptionActive]}
              onPress={() => setBaseLayer("satellite")}
              activeOpacity={0.8}
            >
              <Text style={styles.layerOptionText}>Satélite</Text>
              {mapViewMode === "satellite" && <Feather name="check" size={16} color="#f8fafc" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerOption, mapViewMode === "topographic" && styles.layerOptionActive]}
              onPress={() => setBaseLayer("topographic")}
              activeOpacity={0.8}
            >
              <Text style={styles.layerOptionText}>Topográfico</Text>
              {mapViewMode === "topographic" && <Feather name="check" size={16} color="#f8fafc" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerOption, mapViewMode === "streets" && styles.layerOptionActive]}
              onPress={() => setBaseLayer("streets")}
              activeOpacity={0.8}
            >
              <Text style={styles.layerOptionText}>Ruas</Text>
              {mapViewMode === "streets" && <Feather name="check" size={16} color="#f8fafc" />}
            </TouchableOpacity>
          </View>
        )}

        {isRoutesMenuOpen && (
          <View style={[styles.floatingPanel, { top: top + 56 }]}>
            <Text style={styles.floatingPanelTitle}>Trajetos</Text>

            <View style={styles.switchRow}>
              <Text style={styles.toggleLabel}>Mostrar trajetos</Text>
              <Switch
                value={showRoutes}
                onValueChange={toggleRoutes}
                trackColor={{ false: "rgba(255,255,255,0.15)", true: "#dc2626" }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(255,255,255,0.15)"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.toggleLabel}>Trajeto único</Text>
              <Switch
                value={singleRoute}
                onValueChange={setSingleRoute}
                trackColor={{ false: "rgba(255,255,255,0.15)", true: "#dc2626" }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(255,255,255,0.15)"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          </View>
        )}
      </View>

      <View style={{ flex: 1, position: 'relative', paddingBottom: tabBarHeight }}>
        <View style={styles.listContainer}>
          <Text style={styles.listHeader}>Pontos em destaque</Text>
          {isLoadingPoints && <Text style={styles.listStatus}>A carregar pontos...</Text>}
          {pointsError && <Text style={styles.listStatus}>{pointsError}</Text>}
          {!isLoadingPoints && !pointsError && points.length === 0 && (
            <Text style={styles.listStatus}>Sem pontos disponíveis.</Text>
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            {points.map((point, index) => (
              <TouchableOpacity
                key={`${point.title}-${index}`}
                style={[styles.listItem, selectedIndex === index && styles.listItemSelected]}
                onPress={() => handlePointPress(index)}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, selectedIndex === index && styles.dotSelected]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{point.title}</Text>
                  <Text style={styles.listDetail}>
                    {selectedIndex === index ? "Selecionar destino..." : point.detail}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {routeList.length > 0 && (
          <View style={styles.routesContainer}>
            <Text style={styles.listHeader}>Trajetos criados</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {singleRoute ? (
                <TouchableOpacity style={styles.routeItem} activeOpacity={0.75} onPress={openSingleRouteDetails}>
                  <Feather name="navigation" size={14} color="#dc2626" style={{ marginTop: 1 }} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {routeList.map(r => r.from).concat(routeList.length ? [routeList[routeList.length-1].to] : []).filter((v,i,a)=>a.indexOf(v)===i).join(" → ")}
                  </Text>
                  <TouchableOpacity onPress={(e) => {
                    e.stopPropagation();
                    setRouteList([]);
                    setRouteMetricsById({});
                    setSelectedRouteCard(null);
                    webViewRef.current?.injectJavaScript("window.clearRoutes(); true;");
                  }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ) : (
                routeList.map((route) => (
                  <TouchableOpacity key={route.id} style={styles.routeItem} activeOpacity={0.75} onPress={() => openRouteDetails(route)}>
                    <Feather name="navigation" size={14} color="#dc2626" style={{ marginTop: 1 }} />
                    <Text style={styles.routeText} numberOfLines={1}>
                      {route.from} → {route.to}
                    </Text>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeRoute(route.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {selectedRouteCard !== null && (
          <TouchableOpacity
            style={styles.routeDetailOverlay}
            onPress={() => setSelectedRouteCard(null)}
            activeOpacity={1}
          >
            <View style={styles.routeDetailCard}>
              <View style={styles.detailCardHandle} />
              <Text style={styles.routeDetailTitle}>{selectedRouteCard.title}</Text>
              <Text style={styles.routeDetailMeta}>Distância: {selectedRouteCard.distanceLabel}</Text>
              <Text style={styles.routeDetailMeta}>Duração: {selectedRouteCard.durationLabel}</Text>
              <Text style={styles.routeDirectionsHeader}>Direções</Text>
              <ScrollView style={styles.routeDirectionsList} showsVerticalScrollIndicator={false}>
                {selectedRouteCard.steps.map((step, index) => (
                  <Text key={`${selectedRouteCard.key}-${index}`} style={styles.routeDirectionText}>
                    {index + 1}. {step}
                  </Text>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        )}

        {longPressedIndex !== null && points[longPressedIndex] && (
          <TouchableOpacity
            style={styles.detailCardOverlay}
            onPress={() => setLongPressedIndex(null)}
            activeOpacity={1}
          >
            <View style={styles.detailCardHandle} />
            <Text style={styles.detailCardTitle}>{points[longPressedIndex].title}</Text>
            <Text style={styles.detailCardDetail}>{points[longPressedIndex].detail}</Text>
            <View style={styles.detailCardActions}>
              <TouchableOpacity
                style={[styles.detailCardBtn, styles.detailCardBtnSecondary]}
                onPress={(e) => { e.stopPropagation(); }}
                activeOpacity={0.75}
              >
                <Feather name="heart" size={16} color="#f8fafc" />
                <Text style={styles.detailCardBtnText}>Adicionar aos favoritos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailCardBtn, styles.detailCardBtnPrimary]}
                onPress={(e) => { e.stopPropagation(); }}
                activeOpacity={0.75}
              >
                <Feather name="eye" size={16} color="#f8fafc" />
                <Text style={styles.detailCardBtnText}>Visualizar 360º</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0d0000",
  },
  mapWrapper: {
    flex: 0,
    height: "65%",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  
  crosshairDot: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#dc2626",
    marginTop: -5,
    marginLeft: -5,
  },
  coordsBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: 25,           // Posicionado logo abaixo da mira
    marginLeft: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coordsText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  toggleLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  fabRow: {
    position: "absolute",
    right: 8,
    flexDirection: "row",
    gap: 8,
  },
  mapBackButton: {
    position: "absolute",
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  fabButtonActive: {
    backgroundColor: "#dc2626",
    borderColor: "rgba(255,255,255,0.3)",
  },
  floatingPanel: {
    position: "absolute",
    right: 8,
    minWidth: 180,
    backgroundColor: "rgba(0,0,0,0.86)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 10,
    gap: 8,
  },
  floatingPanelTitle: {
    color: "rgba(248,250,252,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  layerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  layerOptionActive: {
    backgroundColor: "#dc2626",
  },
  layerOptionText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#0d0000",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  listHeader: {
    color: "rgba(248,250,252,0.6)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  listStatus: {
    color: "rgba(248,250,252,0.65)",
    fontSize: 12,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7a1313",
    borderRadius: 10,
    padding: 7,
    marginBottom: 5,
    gap: 10,
  },
  listItemSelected: {
    backgroundColor: "#dc2626",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#dc2626",
  },
  dotSelected: {
    backgroundColor: "#ffffff",
  },
  listTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  listDetail: {
    color: "rgba(248,250,252,0.6)",
    fontSize: 11,
    marginTop: 1,
  },
  routesContainer: {
    backgroundColor: "#0d0000",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(220,38,38,0.2)",
    maxHeight: 100,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a0505",
    borderRadius: 10,
    padding: 7,
    marginBottom: 5,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
  },
  routeText: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  routeDetailOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.92)",
    zIndex: 19,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  routeDetailCard: {
    flex: 1,
  },
  routeDetailTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  routeDetailMeta: {
    color: "rgba(248,250,252,0.8)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  routeDirectionsHeader: {
    color: "rgba(248,250,252,0.6)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 8,
  },
  routeDirectionsList: {
    flex: 1,
  },
  routeDirectionText: {
    color: "#f8fafc",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  detailCardOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000000",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    zIndex: 20,
    alignItems: "flex-start",
  },
  detailCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 14,
  },
  detailCardTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  detailCardDetail: {
    color: "rgba(248,250,252,0.55)",
    fontSize: 14,
    marginBottom: 12,
  },
  detailCardActions: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  detailCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  detailCardBtnPrimary: {
    backgroundColor: "#dc2626",
  },
  detailCardBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  detailCardBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
});
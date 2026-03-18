import { getMapPoints, getMapRoutes, type MapPoint, type MapRoute } from "@/src/lib/360api";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
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

type GeneratedRoute = {
  id: number;
  name: string;
  coordinates: [number, number][];
};

async function fetchOSRMRoute(
  coordinates: [number, number][],
  signal?: AbortSignal
): Promise<{ latLngs: [number, number][]; distanceMeters: number; durationSeconds: number; steps: string[] } | null> {
  try {
    const coordStr = coordinates.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url, signal ? { signal } : undefined);
    if (!resp.ok) return null;
    const data = await resp.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    const latLngs: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    const steps: string[] = [];
    route.legs?.forEach((leg: { steps?: { maneuver?: { instruction?: string } }[] }) => {
      leg.steps?.forEach((step: { maneuver?: { instruction?: string } }) => {
        if (step?.maneuver?.instruction) steps.push(step.maneuver.instruction);
      });
    });
    return { latLngs, distanceMeters: route.distance ?? 0, durationSeconds: route.duration ?? 0, steps };
  } catch {
    return null;
  }
}

function buildMapHtml(points: MapPoint[], embeddedRoutes: GeneratedRoute[] = []) {
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
    var selectedRouteId = null;
    var ignoreNextMapClick = false;

    function styleRoute(routeId, isSelected) {
      var route = routes[routeId];
      if (!route || !route.polyline) return;
      route.polyline.setStyle(
        isSelected
          ? { color: '#f59e0b', weight: 6, opacity: 1 }
          : { color: '#dc2626', weight: 4, opacity: 0.85 }
      );
      if (isSelected) {
        route.polyline.bringToFront();
        if (route.hitPolyline) route.hitPolyline.bringToFront();
      }
    }

    function selectRoute(routeId) {
      if (selectedRouteId !== null && routes[selectedRouteId]) {
        styleRoute(selectedRouteId, false);
      }
      selectedRouteId = routeId;
      if (selectedRouteId !== null && routes[selectedRouteId]) {
        styleRoute(selectedRouteId, true);
      }
    }

    window.selectRoute = function(routeId) {
      selectRoute(routeId);
    };

    window.clearSelectedRoute = function() {
      selectRoute(null);
    };

    window.addRoute = function(id, coordsOrJson) {
      var coordinates;
      if (Array.isArray(coordsOrJson)) {
        coordinates = coordsOrJson;
      } else {
        try {
          coordinates = JSON.parse(coordsOrJson);
          if (typeof coordinates === 'string') {
            coordinates = JSON.parse(coordinates);
          }
        } catch (_) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ routeRenderFailed: id }));
          return;
        }
      }
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeRenderFailed: id }));
        return;
      }
      var latLngs = coordinates
        .map(function(pair) {
          if (!Array.isArray(pair) || pair.length < 2) return null;
          return [Number(pair[0]), Number(pair[1])];
        })
        .filter(function(pair) {
          return Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]);
        });

      if (latLngs.length < 2) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeRenderFailed: id }));
        return;
      }

      if (routes[id]) { window.removeRoute(id); }
      var polyline = L.polyline(latLngs, {
        color: '#dc2626',
        weight: 4,
        opacity: 0.85,
        interactive: true,
      });
      var hitPolyline = L.polyline(latLngs, { color: '#000000', weight: 20, opacity: 0, interactive: true });
      function onAddRouteClick() {
        ignoreNextMapClick = true;
        selectRoute(id);
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeSelected: id }));
      }
      polyline.on('click', onAddRouteClick);
      hitPolyline.on('click', onAddRouteClick);

      routes[id] = { polyline: polyline, hitPolyline: hitPolyline };

      if (selectedRouteId === id) {
        styleRoute(id, true);
      }

      if (routesVisible) {
        polyline.addTo(map);
        hitPolyline.addTo(map);
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ routeRendered: id }));

      var totalDistance = 0;
      for (var i = 1; i < latLngs.length; i += 1) {
        totalDistance += map.distance(latLngs[i - 1], latLngs[i]);
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        routeInfo: {
          id: id,
          distanceMeters: totalDistance,
          durationSeconds: Math.round(totalDistance / 1.3),
          steps: []
        }
      }));
    };
    window.removeRoute = function(id) {
      if (!routes[id]) return;
      if (routes[id].polyline && map.hasLayer(routes[id].polyline)) {
        map.removeLayer(routes[id].polyline);
      }
      if (routes[id].hitPolyline && map.hasLayer(routes[id].hitPolyline)) {
        map.removeLayer(routes[id].hitPolyline);
      }
      if (selectedRouteId === id) { selectedRouteId = null; }
      delete routes[id];
    };
    window.clearRoutes = function() {
      Object.values(routes).forEach(function(r) {
        if (r.polyline && map.hasLayer(r.polyline)) { map.removeLayer(r.polyline); }
        if (r.hitPolyline && map.hasLayer(r.hitPolyline)) { map.removeLayer(r.hitPolyline); }
      });
      routes = {};
      selectedRouteId = null;
    };
    window.showRoutes = function() {
      routesVisible = true;
      Object.values(routes).forEach(function(r) {
        if (r.polyline && !map.hasLayer(r.polyline)) { r.polyline.addTo(map); }
        if (r.hitPolyline && !map.hasLayer(r.hitPolyline)) { r.hitPolyline.addTo(map); }
      });
    };
    window.hideRoutes = function() {
      routesVisible = false;
      Object.values(routes).forEach(function(r) {
        if (r.polyline && map.hasLayer(r.polyline)) { map.removeLayer(r.polyline); }
        if (r.hitPolyline && map.hasLayer(r.hitPolyline)) { map.removeLayer(r.hitPolyline); }
      });
    };
    window.addRouteOSRM = function(id, waypoints) {
      var _id = id;
      var _waypoints = waypoints;
      var _osrmCoords = _waypoints.map(function(p) { return p[1] + ',' + p[0]; }).join(';');
      var _url = 'https://router.project-osrm.org/route/v1/driving/' + _osrmCoords + '?overview=full&geometries=geojson&steps=true';
      function drawPolyline(latLngs, distanceMeters, durationSeconds, steps) {
        if (routes[_id]) { window.removeRoute(_id); }
        var _polyline = L.polyline(latLngs, { color: '#f59e0b', weight: 4, opacity: 0.9, interactive: true });
        var _hitPolyline = L.polyline(latLngs, { color: '#000000', weight: 20, opacity: 0, interactive: true });
        function onRouteClick() {
          ignoreNextMapClick = true;
          selectRoute(_id);
          window.ReactNativeWebView.postMessage(JSON.stringify({ routeSelected: _id }));
        }
        _polyline.on('click', onRouteClick);
        _hitPolyline.on('click', onRouteClick);
        routes[_id] = { polyline: _polyline, hitPolyline: _hitPolyline };
        if (selectedRouteId === _id) {
          styleRoute(_id, true);
        }
        if (routesVisible) { _polyline.addTo(map); _hitPolyline.addTo(map); }
        selectRoute(_id);
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeRendered: _id }));
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeInfo: { id: _id, distanceMeters: distanceMeters, durationSeconds: durationSeconds, steps: steps } }));
      }
      fetch(_url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var route = data.routes && data.routes[0];
          if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) { throw new Error('no geometry'); }
          var latLngs = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
          var steps = [];
          if (Array.isArray(route.legs)) {
            route.legs.forEach(function(leg) {
              if (!Array.isArray(leg.steps)) return;
              leg.steps.forEach(function(step) {
                if (step && step.maneuver && step.maneuver.instruction) { steps.push(step.maneuver.instruction); }
              });
            });
          }
          drawPolyline(latLngs, route.distance || 0, route.duration || 0, steps);
        })
        .catch(function() {
          var dist = 0;
          for (var i = 1; i < _waypoints.length; i++) { dist += map.distance(_waypoints[i-1], _waypoints[i]); }
          drawPolyline(_waypoints, dist, Math.round(dist / 1.3), []);
        });
    };
    ${embeddedRoutes.map((route) => `
    (function() {
      var _id = ${route.id};
      var _waypoints = ${JSON.stringify(route.coordinates)};
      var _polyline = L.polyline(_waypoints, { color: '#dc2626', weight: 3, opacity: 0.35, dashArray: '6,8', interactive: true });
      var _hitPolyline = L.polyline(_waypoints, { color: '#000000', weight: 20, opacity: 0, interactive: true });
      function onRouteClick() {
        ignoreNextMapClick = true;
        selectRoute(_id);
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeSelected: _id }));
      }
      _polyline.on('click', onRouteClick);
      _hitPolyline.on('click', onRouteClick);
      routes[_id] = { polyline: _polyline, hitPolyline: _hitPolyline };
      if (selectedRouteId === _id) {
        styleRoute(_id, true);
      }
      if (routesVisible) { _polyline.addTo(map); _hitPolyline.addTo(map); }
    })();
    `).join('')}
    function sendCenter() {
      var c = map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat.toFixed(4), lng: c.lng.toFixed(4) }));
    }
    map.on('move', sendCenter);
    map.on('click', function() {
      if (ignoreNextMapClick) { ignoreNextMapClick = false; return; }
      if (selectedRouteId !== null) {
        selectRoute(null);
        window.ReactNativeWebView.postMessage(JSON.stringify({ routeDeselected: true }));
      }
    });
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
  const [apiRoutes, setApiRoutes] = useState<MapRoute[]>([]);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [isRoutesMenuOpen, setIsRoutesMenuOpen] = useState(false);
  const [canGoBackInMap, setCanGoBackInMap] = useState(false);
  const [hasOpenedMapLink, setHasOpenedMapLink] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<"satellite" | "topographic" | "streets">("satellite");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [routeList, setRouteList] = useState<GeneratedRoute[]>([]);
  const [routeDrawnCount, setRouteDrawnCount] = useState(0);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeMetricsById, setRouteMetricsById] = useState<Record<number, RouteMetrics>>({});
  const [isRoutesScreenOpen, setIsRoutesScreenOpen] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<number | null>(null);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);
  const [bottomTab, setBottomTab] = useState<'points' | 'routes'>('points');
  const hasBootstrappedRoutes = useRef(false);
  const resolvedRoutesRef = useRef<GeneratedRoute[]>([]);
  const routeListRef = useRef<GeneratedRoute[]>([]);

  const resolvedRoutes = useMemo((): GeneratedRoute[] => {
    if (!points.length) return [];
    const pointById = new Map(points.map((p) => [p.id, p]));
    return apiRoutes
      .map((route) => {
        const coordinates = route.pointIds
          .map((id) => pointById.get(id))
          .filter((p): p is MapPoint => Boolean(p))
          .map((p) => [p.latitude, p.longitude] as [number, number]);
        if (coordinates.length < 2) return null;
        return { id: route.id, name: route.name, coordinates };
      })
      .filter((r): r is GeneratedRoute => Boolean(r));
  }, [points, apiRoutes]);

  useEffect(() => {
    resolvedRoutesRef.current = resolvedRoutes;
  }, [resolvedRoutes]);

  useEffect(() => {
    routeListRef.current = routeList;
  }, [routeList]);

  const routeLoadStats = useMemo(() => ({
    total: apiRoutes.length,
    drawn: routeDrawnCount,
    discarded: apiRoutes.length - resolvedRoutes.length,
    failedToRender: resolvedRoutes.length - routeDrawnCount,
  }), [apiRoutes.length, resolvedRoutes.length, routeDrawnCount]);

  const POLL_INTERVAL_MS = 30_000;

  useEffect(() => {
    const controller = new AbortController();
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadMapData(isInitial: boolean) {
      if (isInitial) {
        setIsLoadingPoints(true);
        setIsLoadingRoutes(true);
        setPointsError(null);
        setRoutesError(null);
      }

      try {
        const [pointsData, routesData] = await Promise.all([
          getMapPoints(controller.signal),
          getMapRoutes(controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setPoints((prev) =>
          JSON.stringify(prev) !== JSON.stringify(pointsData) ? pointsData : prev
        );
        setApiRoutes((prev) =>
          JSON.stringify(prev) !== JSON.stringify(routesData) ? routesData : prev
        );

        if (isInitial) {
          setPointsError(null);
          setRoutesError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isInitial) {
          const message = error instanceof Error ? error.message : "Erro ao carregar dados do mapa.";
          setPointsError(message);
          setRoutesError(message);
        }
      } finally {
        if (!controller.signal.aborted && isInitial) {
          setIsLoadingPoints(false);
          setIsLoadingRoutes(false);
        }
      }

      if (!controller.signal.aborted) {
        pollTimer = setTimeout(() => loadMapData(false), POLL_INTERVAL_MS);
      }
    }

    loadMapData(true);

    return () => {
      controller.abort();
      if (pollTimer !== null) clearTimeout(pollTimer);
    };
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

  function openRouteDetails(route: GeneratedRoute) {
    setSelectedRouteId(route.id);
    webViewRef.current?.injectJavaScript(`window.selectRoute(${route.id}); true;`);
    setExpandedRouteId(route.id);
    setIsRoutesScreenOpen(true);
  }

  async function createRouteBetweenPoints(fromIdx: number, toIdx: number) {
    const fromPoint = points[fromIdx];
    const toPoint = points[toIdx];

    // Check if an API route already connects these two points
    const existingApiRoute = apiRoutes.find(
      (r) => r.pointIds.includes(fromPoint.id) && r.pointIds.includes(toPoint.id)
    );
    if (existingApiRoute) {
      const resolved = resolvedRoutesRef.current.find((r) => r.id === existingApiRoute.id);
      if (resolved) {
        setRouteList((prev) => (prev.some((r) => r.id === resolved.id) ? prev : [...prev, resolved]));
        openRouteDetails(resolved);
        return;
      }
    }

    // Create a synthetic route between the two points via OSRM (fetched from RN, no WebView CORS issues)
    const syntheticId = -(Math.abs(fromPoint.id) * 100000 + Math.abs(toPoint.id));
    const coords: [number, number][] = [
      [fromPoint.latitude, fromPoint.longitude],
      [toPoint.latitude, toPoint.longitude],
    ];
    const syntheticRoute: GeneratedRoute = {
      id: syntheticId,
      name: `${fromPoint.title} → ${toPoint.title}`,
      coordinates: coords,
    };
    setRouteList((prev) => (prev.some((r) => r.id === syntheticId) ? prev : [...prev, syntheticRoute]));
    openRouteDetails(syntheticRoute);

    const result = await fetchOSRMRoute(coords);
    const latLngs = result?.latLngs ?? coords;
    webViewRef.current?.injectJavaScript(
      `window.addRoute(${syntheticId}, ${JSON.stringify(latLngs)}); true;`
    );
    if (result) {
      setRouteMetricsById((prev) => ({
        ...prev,
        [syntheticId]: {
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          steps: result.steps.map(toPortugueseDirection),
        },
      }));
    }
  }

  function handlePointPress(index: number) {
    if (index < 0 || index >= points.length) return;
    const point = points[index];
    if (selectedIndex === null) {
      setSelectedIndex(index);
      webViewRef.current?.injectJavaScript(`window.focusPoint(${point.latitude}, ${point.longitude}); true;`);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      createRouteBetweenPoints(selectedIndex, index);
      setSelectedIndex(null);
    }
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

  useEffect(() => {
    setIsMapReady(false);
    hasBootstrappedRoutes.current = false;
    setRouteList([]);
    setRouteDrawnCount(0);
    setRouteMetricsById({});
    setIsRoutesScreenOpen(false);
    setExpandedRouteId(null);
    setSelectedRouteId(null);
  }, [resolvedRoutes]);

  useEffect(() => {
    if (!isMapReady || hasBootstrappedRoutes.current) return;
    hasBootstrappedRoutes.current = true;
    const controller = new AbortController();
    for (const route of resolvedRoutesRef.current) {
      (async () => {
        const result = await fetchOSRMRoute(route.coordinates, controller.signal);
        if (controller.signal.aborted) return;
        const latLngs = result?.latLngs ?? route.coordinates;
        webViewRef.current?.injectJavaScript(
          `window.addRoute(${route.id}, ${JSON.stringify(latLngs)}); true;`
        );
        if (result) {
          setRouteMetricsById((prev) => ({
            ...prev,
            [route.id]: {
              distanceMeters: result.distanceMeters,
              durationSeconds: result.durationSeconds,
              steps: result.steps.map(toPortugueseDirection),
            },
          }));
        }
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

    webViewRef.current?.injectJavaScript(`window.selectRoute(${selectedRouteId}); true;`);
  }, [isMapReady, routeDrawnCount, selectedRouteId]);

  const mapHtml = useMemo(
    () => buildMapHtml(points, resolvedRoutes),
    [points, resolvedRoutes]
  );

  return (
    <View style={styles.screen}>
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
                setRouteMetricsById((prev) => ({
                  ...prev,
                  [routeInfo.id]: {
                    distanceMeters: Number(routeInfo.distanceMeters) || 0,
                    durationSeconds: Number(routeInfo.durationSeconds) || 0,
                    // Preserve existing steps when the WebView reports empty steps
                    // (window.addRoute always sends steps:[] — RN-side OSRM sets real steps)
                    steps: Array.isArray(routeInfo.steps) && routeInfo.steps.length > 0
                      ? routeInfo.steps
                          .filter((step: unknown) => typeof step === "string")
                          .map((step: string) => toPortugueseDirection(step))
                      : (prev[routeInfo.id]?.steps ?? []),
                  },
                }));
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

          {routeList.length > 0 && (
            <TouchableOpacity
              style={styles.routesCountFab}
              onPress={() => {
                setIsLayersMenuOpen(false);
                setIsRoutesMenuOpen(false);
                setIsRoutesScreenOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Feather name="list" size={16} color="#f8fafc" />
              <Text style={styles.routesCountFabText}>{routeList.length}</Text>
            </TouchableOpacity>
          )}
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

          </View>
        )}
      </View>

      <View style={{ flex: 1, position: 'relative', paddingBottom: tabBarHeight }}>
        <View style={styles.listContainer}>
          <View style={styles.bottomTabs}>
            <TouchableOpacity
              style={[styles.bottomTab, bottomTab === 'points' && styles.bottomTabActive]}
              onPress={() => setBottomTab('points')}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomTabText, bottomTab === 'points' && styles.bottomTabTextActive]}>Pontos</Text>
              {points.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{points.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomTab, bottomTab === 'routes' && styles.bottomTabActive]}
              onPress={() => setBottomTab('routes')}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomTabText, bottomTab === 'routes' && styles.bottomTabTextActive]}>Trajetos</Text>
              {resolvedRoutes.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{resolvedRoutes.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {(isLoadingPoints || isLoadingRoutes) && <Text style={styles.listStatus}>A carregar pontos e trajetos...</Text>}
          {pointsError && <Text style={styles.listStatus}>{pointsError}</Text>}
          {routesError && !pointsError && <Text style={styles.listStatus}>{routesError}</Text>}
          <ScrollView showsVerticalScrollIndicator={false}>
            {bottomTab === 'points' && (
              <>
                {!isLoadingPoints && !pointsError && points.length === 0 && (
                  <Text style={styles.listStatus}>Sem pontos disponíveis.</Text>
                )}
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
              </>
            )}
            {bottomTab === 'routes' && (
              <>
                {!isLoadingRoutes && !routesError && resolvedRoutes.length === 0 && (
                  <Text style={styles.listStatus}>Sem trajetos disponíveis.</Text>
                )}
                {resolvedRoutes.map((route) => {
                  const isSelected = selectedRouteId === route.id;
                  const metrics = routeMetricsById[route.id];
                  return (
                    <TouchableOpacity
                      key={route.id}
                      style={[styles.listItem, isSelected && styles.listItemSelected]}
                      onPress={() => {
                        setSelectedRouteId(route.id);
                        webViewRef.current?.injectJavaScript(`window.selectRoute(${route.id}); true;`);
                        setRouteList((prev) =>
                          prev.some((r) => r.id === route.id) ? prev : [...prev, route]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name="navigation"
                        size={14}
                        color={isSelected ? "#ffffff" : "#dc2626"}
                        style={{ marginTop: 1 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{route.name}</Text>
                        <Text style={styles.listDetail}>
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

        <Modal
          visible={isRoutesScreenOpen}
          animationType="slide"
          onRequestClose={() => setIsRoutesScreenOpen(false)}
        >
          <View style={styles.routesScreen}>
            <View style={[styles.routesScreenHeader, { paddingTop: top + 16 }]}>
              <TouchableOpacity
                style={styles.routesScreenBackBtn}
                onPress={() => setIsRoutesScreenOpen(false)}
                activeOpacity={0.7}
              >
                <Feather name="arrow-left" size={20} color="#f8fafc" />
              </TouchableOpacity>
              <Text style={styles.routesScreenTitle}>Trajetos Selecionados</Text>
              {routeList.length > 0 && (
                <View style={styles.routesScreenBadge}>
                  <Text style={styles.routesScreenBadgeText}>{routeList.length}</Text>
                </View>
              )}
            </View>

            {routeList.length === 0 ? (
              <View style={styles.routesScreenEmpty}>
                <Feather name="map" size={40} color="rgba(248,250,252,0.2)" />
                <Text style={styles.routesScreenEmptyText}>
                  Clica numa rota no mapa para a selecionar.
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
                    <View key={route.id} style={[styles.routeCard, isExpanded && styles.routeCardExpanded]}>
                      <TouchableOpacity
                        style={styles.routeCardHeader}
                        onPress={() => {
                          const next = isExpanded ? null : route.id;
                          setExpandedRouteId(next);
                          if (next !== null) {
                            setSelectedRouteId(route.id);
                            webViewRef.current?.injectJavaScript(`window.selectRoute(${route.id}); true;`);
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <Feather name="navigation" size={16} color="#dc2626" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.routeCardName}>{route.name}</Text>
                          <Text style={styles.routeCardMeta}>
                            {metrics
                              ? `${formatDistance(metrics.distanceMeters)}  •  ${formatDuration(metrics.durationSeconds)}`
                              : "A calcular..."}
                          </Text>
                        </View>
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="rgba(248,250,252,0.5)"
                        />
                        <TouchableOpacity
                          onPress={() => {
                            setRouteList((prev) => prev.filter((r) => r.id !== route.id));
                            if (expandedRouteId === route.id) setExpandedRouteId(null);
                            if (selectedRouteId === route.id) setSelectedRouteId(null);
                            webViewRef.current?.injectJavaScript(`window.removeRoute(${route.id}); true;`);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                          style={{ marginLeft: 4 }}
                        >
                          <Feather name="x" size={16} color="rgba(248,250,252,0.4)" />
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.routeCardDirections}>
                          <Text style={styles.routeDirectionsLabel}>Direções</Text>
                          {!metrics ? (
                            <Text style={styles.routeDirectionText}>A carregar direções...</Text>
                          ) : metrics.steps.length === 0 ? (
                            <Text style={styles.routeDirectionText}>Sem direções disponíveis.</Text>
                          ) : (
                            metrics.steps.map((step, i) => (
                              <Text key={i} style={styles.routeDirectionText}>
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
  routesScreen: {
    flex: 1,
    backgroundColor: "#0d0000",
  },
  routesScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(220,38,38,0.2)",
    gap: 12,
  },
  routesScreenBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  routesScreenTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  routesScreenBadge: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routesScreenBadgeText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  routesScreenList: {
    flex: 1,
  },
  routesScreenEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  routesScreenEmptyText: {
    color: "rgba(248,250,252,0.4)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  routeCard: {
    backgroundColor: "#1a0505",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
    marginBottom: 10,
    overflow: "hidden",
  },
  routeCardExpanded: {
    borderColor: "#dc2626",
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  routeCardName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  routeCardMeta: {
    color: "rgba(248,250,252,0.55)",
    fontSize: 12,
  },
  routeCardDirections: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(220,38,38,0.15)",
    paddingTop: 10,
  },
  routeDirectionsLabel: {
    color: "rgba(248,250,252,0.5)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  routeDirectionText: {
    color: "#f8fafc",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  routesCountFab: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  routesCountFabText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
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
  bottomTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    gap: 4,
  },
  bottomTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  bottomTabActive: {
    backgroundColor: "#dc2626",
  },
  bottomTabText: {
    color: "rgba(248,250,252,0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomTabTextActive: {
    color: "#f8fafc",
  },
  tabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "700",
  },
});
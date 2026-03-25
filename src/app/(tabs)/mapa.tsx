import { createPonto, getMapPoints, getMapRoutes, getPointCategories, type MapPoint, type MapRoute, type PointCategory, type UploadImageFile } from "@/src/lib/360api";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../context/ThemeContext";

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
  async function requestOSRM(
    coords: [number, number][]
  ): Promise<{ latLngs: [number, number][]; distanceMeters: number; durationSeconds: number; steps: string[] } | null> {
    if (coords.length < 2) return null;
    const coordStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
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
    return {
      latLngs,
      distanceMeters: route.distance ?? 0,
      durationSeconds: route.duration ?? 0,
      steps,
    };
  }

  try {
    const directRoute = await requestOSRM(coordinates);
    if (directRoute && directRoute.latLngs.length >= 2) {
      const snapped = [...directRoute.latLngs];
      snapped[0] = coordinates[0];
      snapped[snapped.length - 1] = coordinates[coordinates.length - 1];
      return {
        ...directRoute,
        latLngs: snapped,
      };
    }

    if (coordinates.length < 3) {
      return null;
    }

    let merged: [number, number][] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    const allSteps: string[] = [];

    for (let index = 1; index < coordinates.length; index += 1) {
      if (signal?.aborted) return null;
      const segmentCoords: [number, number][] = [coordinates[index - 1], coordinates[index]];
      const segment = await requestOSRM(segmentCoords);

      if (!segment || segment.latLngs.length < 2) {
        merged = [];
        break;
      }

      const segmentLatLngs = [...segment.latLngs];
      segmentLatLngs[0] = segmentCoords[0];
      segmentLatLngs[segmentLatLngs.length - 1] = segmentCoords[1];

      if (merged.length === 0) {
        merged = segmentLatLngs;
      } else {
        merged = [...merged, ...segmentLatLngs.slice(1)];
      }

      totalDistance += segment.distanceMeters;
      totalDuration += segment.durationSeconds;
      allSteps.push(...segment.steps);
    }

    if (merged.length < 2) {
      return null;
    }

    merged[0] = coordinates[0];
    merged[merged.length - 1] = coordinates[coordinates.length - 1];

    return {
      latLngs: merged,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      steps: allSteps,
    };
  } catch {
    return null;
  }
}

function buildMapHtml(
  points: MapPoint[],
  embeddedRoutes: GeneratedRoute[] = [],
  theme: {
    background: string;
    foreground: string;
    card: string;
    border: string;
    primary: string;
    primaryForeground: string;
    mutedForeground: string;
    overlay: string;
    softOverlay: string;
    accentSoft: string;
  }
) {
  const initialCenter = points[0] ?? DEFAULT_MAP_CENTER;
  const markers = points
    .map(
      (p, i) =>
        `L.marker([${p.latitude}, ${p.longitude}], { icon: markerIcon })
          .addTo(map)
          .bindPopup("<div style='min-width:160px'><strong style='display:block;margin-bottom:4px'>${p.title}</strong><span>${p.detail}</span></div>")
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
      background: ${theme.overlay} !important;
      color: ${theme.mutedForeground} !important;
      border: 1px solid ${theme.border};
      border-radius: 8px;
      padding: 3px 8px !important;
      backdrop-filter: blur(2px);
    }
    .leaflet-control-attribution a {
      color: ${theme.primary} !important;
      font-weight: 700;
    }
    .leaflet-control-attribution a:hover {
      color: ${theme.primaryForeground} !important;
    }
    .leaflet-control-zoom {
      border: 1px solid ${theme.border} !important;
      border-radius: 10px !important;
      overflow: hidden;
      box-shadow: none !important;
    }
    .leaflet-control-zoom a {
      background-color: ${theme.overlay} !important;
      color: ${theme.foreground} !important;
      border: none !important;
      border-bottom: 1px solid ${theme.border} !important;
    }
    .leaflet-control-zoom a:last-child {
      border-bottom: none !important;
    }
    .leaflet-control-zoom a:hover {
      background-color: ${theme.primary} !important;
      color: ${theme.primaryForeground} !important;
    }
    .leaflet-control-zoom a.leaflet-disabled {
      color: ${theme.mutedForeground} !important;
      background-color: ${theme.softOverlay} !important;
    }
    .leaflet-popup-content-wrapper {
      background: ${theme.card};
      color: ${theme.foreground};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      box-shadow: none;
    }
    .leaflet-popup-tip {
      background: ${theme.card};
    }
    .point-pin-wrapper {
      background: transparent;
      border: none;
    }
    .point-pin {
      width: 26px;
      height: 26px;
      border-radius: 13px 13px 13px 0;
      transform: rotate(-45deg);
      background: ${theme.primary};
      border: 2px solid ${theme.foreground};
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      position: relative;
    }
    .point-pin-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: ${theme.card};
      position: absolute;
      top: 7px;
      left: 7px;
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
    var routeColor = '${theme.primary}';
    var routeColorSelected = '${theme.foreground}';
    var markerIcon = L.divIcon({
      className: 'point-pin-wrapper',
      html: "<div class='point-pin'><div class='point-pin-dot'></div></div>",
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -30]
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
          ? { color: routeColorSelected, weight: 6, opacity: 1 }
          : { color: routeColor, weight: 4, opacity: 0.95 }
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
        color: routeColor,
        weight: 4,
        opacity: 0.95,
        interactive: true,
        lineCap: 'round',
        lineJoin: 'round'
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
        var _polyline = L.polyline(latLngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.95,
          interactive: true,
          lineCap: 'round',
          lineJoin: 'round'
        });
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
      var _polyline = L.polyline(_waypoints, {
        color: routeColor,
        weight: 4,
        opacity: 0.9,
        interactive: true,
        lineCap: 'round',
        lineJoin: 'round'
      });
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
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          lat: c.lat.toFixed(4),
          lng: c.lng.toFixed(4),
          center: { lat: c.lat, lng: c.lng }
        })
      );
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
  const { token, user } = useAuth();
  const { colors } = useAppTheme();
  const { showError, showInfo, showSuccess } = useDialog();
  const webViewRef = useRef<WebView>(null);
  const [coords, setCoords] = useState({ lat: "--", lng: "--" });
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
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
  const [isCreatePointModalOpen, setIsCreatePointModalOpen] = useState(false);
  const [newPointName, setNewPointName] = useState("");
  const [newPointDescription, setNewPointDescription] = useState("");
  const [newPointCategoryIds, setNewPointCategoryIds] = useState<number[]>([]);
  const [newPointImage, setNewPointImage] = useState<UploadImageFile | null>(null);
  const [pointCategories, setPointCategories] = useState<PointCategory[]>([]);
  const [isLoadingPointCategories, setIsLoadingPointCategories] = useState(false);
  const [isCreatingPoint, setIsCreatingPoint] = useState(false);
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

  const approximatePolylineDistanceMeters = useCallback((latLngs: [number, number][]) => {
    if (latLngs.length < 2) return 0;
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    let distance = 0;
    for (let i = 1; i < latLngs.length; i += 1) {
      const [lat1, lon1] = latLngs[i - 1];
      const [lat2, lon2] = latLngs[i];
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance += R * c;
    }
    return distance;
  }, []);

  const toPortugueseDirection = useCallback((step: string) => {
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
  }, []);

  const renderedRouteIdsRef = useRef<Set<number>>(new Set());
  const renderingRouteIdsRef = useRef<Set<number>>(new Set());

  const ensureRouteRendered = useCallback(async (route: GeneratedRoute, signal?: AbortSignal) => {
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
  }, [approximatePolylineDistanceMeters, isMapReady, toPortugueseDirection]);

  function openRouteDetails(route: GeneratedRoute) {
    setSelectedRouteId(route.id);
    setExpandedRouteId(route.id);
    setIsRoutesScreenOpen(true);
  }

  async function createRouteBetweenPoints(fromIdx: number, toIdx: number) {
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

  function handlePointPress(index: number) {
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
  }, [isMapReady, toPortugueseDirection]);

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
                          .filter((step: unknown) => typeof step === "string")
                          .map((step: string) => toPortugueseDirection(step))
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

        <Modal
          visible={isRoutesScreenOpen}
          animationType="slide"
          onRequestClose={() => setIsRoutesScreenOpen(false)}
        >
          <View style={[styles.routesScreen, { backgroundColor: colors.background }]}> 
            <View style={[styles.routesScreenHeader, { paddingTop: top + 16, borderBottomColor: colors.border }]}> 
              <TouchableOpacity
                style={[styles.routesScreenBackBtn, { backgroundColor: colors.card }]}
                onPress={() => setIsRoutesScreenOpen(false)}
                activeOpacity={0.7}
              >
                <Feather name="arrow-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.routesScreenTitle, { color: colors.foreground }]}>Trajetos Selecionados</Text>
              {routeList.length > 0 && (
                <View style={[styles.routesScreenBadge, { backgroundColor: colors.primary }]}> 
                  <Text style={[styles.routesScreenBadgeText, { color: colors.primaryForeground }]}>{routeList.length}</Text>
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
                    <View key={route.id} style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }, isExpanded && [styles.routeCardExpanded, { borderColor: colors.primary }]]}>
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
                        <Feather name="navigation" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.routeCardName, { color: colors.foreground }]}>{route.name}</Text>
                          <Text style={[styles.routeCardMeta, { color: colors.mutedForeground }]}>
                            {metrics
                              ? `${formatDistance(metrics.distanceMeters)}  •  ${formatDuration(metrics.durationSeconds)}`
                              : "A calcular..."}
                          </Text>
                        </View>
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                            color={colors.iconMuted}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            setRouteList((prev) => prev.filter((r) => r.id !== route.id));
                            if (expandedRouteId === route.id) setExpandedRouteId(null);
                            if (selectedRouteId === route.id) setSelectedRouteId(null);
                            webViewRef.current?.injectJavaScript(`window.removeRoute(${route.id}); true;`);
                            renderedRouteIdsRef.current.delete(route.id);
                            renderingRouteIdsRef.current.delete(route.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                          style={{ marginLeft: 4 }}
                        >
                          <Feather name="x" size={16} color={colors.iconMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={[styles.routeCardDirections, { borderTopColor: colors.border }]}> 
                          <Text style={[styles.routeDirectionsLabel, { color: colors.mutedForeground }]}>Direções</Text>
                          {!metrics ? (
                            <Text style={[styles.routeDirectionText, { color: colors.foreground }]}>A carregar direções...</Text>
                          ) : metrics.steps.length === 0 ? (
                            <Text style={[styles.routeDirectionText, { color: colors.foreground }]}>Sem direções disponíveis.</Text>
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

        <Modal
          visible={isCreatePointModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsCreatePointModalOpen(false)}
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
                  onPress={() => setIsCreatePointModalOpen(false)}
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
    marginTop: 25,
    marginLeft: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalHint: {
    fontSize: 12,
    marginBottom: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalTextArea: {
    height: 84,
    textAlignVertical: "top",
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  imagePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imagePickBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
const DEFAULT_MAP_CENTER = {
  latitude: -4.8668,
  longitude: -43.3536,
};

export function buildMapHtml(points, embeddedRoutes = [], theme) {
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
    ${embeddedRoutes
      .map(
        (route) => `
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
    `
      )
      .join("")}
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

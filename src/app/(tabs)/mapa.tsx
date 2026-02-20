import { Feather } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

const points = [
  {
    title: "Centro histórico",
    detail: "3,1 km do centro",
    latitude: -4.8668,
    longitude: -43.3536,
  },
  {
    title: "Galeria Mirante",
    detail: "1,4 km, aberto",
    latitude: -4.872,
    longitude: -43.348,
  },
  {
    title: "Passarela do Sol",
    detail: "5,2 km, trilha leve",
    latitude: -4.86,
    longitude: -43.36,
  },
];

function buildMapHtml(points: { title: string; detail: string; latitude: number; longitude: number }[]) {
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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${points[0].latitude}, ${points[0].longitude}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
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
  const webViewRef = useRef<WebView>(null);
  const [coords, setCoords] = useState({ lat: "--", lng: "--" });
  const [showRoutes, setShowRoutes] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [routeList, setRouteList] = useState<{ id: number; from: string; to: string }[]>([]);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);
  const routeCounter = useRef(0);

  function handlePointPress(index: number) {
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
      // Second selection — draw route
      const from = points[selectedIndex];
      const alreadyExists = routeList.some(
        (r) =>
          (r.from === from.title && r.to === point.title) ||
          (r.from === point.title && r.to === from.title)
      );
      setSelectedIndex(null);
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
  }

  function toggleRoutes(value: boolean) {
    setShowRoutes(value);
    webViewRef.current?.injectJavaScript(
      value ? `window.showRoutes(); true;` : `window.hideRoutes(); true;`
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: buildMapHtml(points) }}
          originWhitelist={["*"]}
          javaScriptEnabled
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.longPressIndex !== undefined) {
                setLongPressedIndex(data.longPressIndex);
              } else if (data.markerIndex !== undefined) {
                handlePointPress(data.markerIndex);
              } else {
                setCoords({ lat: data.lat, lng: data.lng });
              }
            } catch {}
          }}
        />

        <View style={styles.crosshairDot} pointerEvents="none" />
        
        <View style={styles.toggleBadge}>
          <Text style={styles.toggleLabel}>Mostrar trajetos</Text>
          <Switch
            value={showRoutes}
            onValueChange={toggleRoutes}
            trackColor={{ false: "rgba(255,255,255,0.15)", true: "#dc2626" }}
            thumbColor="#ffffff"
            ios_backgroundColor="rgba(255,255,255,0.15)"
          />
        </View>
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        <View style={styles.listContainer}>
          <Text style={styles.listHeader}>Pontos em destaque</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {points.map((point, index) => (
              <TouchableOpacity
                key={point.title}
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
              {routeList.map((route) => (
                <View key={route.id} style={styles.routeItem}>
                  <Feather name="navigation" size={14} color="#dc2626" style={{ marginTop: 1 }} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {route.from} → {route.to}
                  </Text>
                  <TouchableOpacity onPress={() => removeRoute(route.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {longPressedIndex !== null && (
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
  // Linha Horizontal Fixa
  /*sshairH: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 35,           // Tamanho da linha
    height: 2,             // Espessura
    backgroundColor: "rgba(220,38,38,0.8)",
    marginLeft: -17,  // Metade do width (40 / 2)
    marginTop: -0.5,         // Metade da espessura
  },
  // Linha Vertical Fixa
  crosshairV: {
    position: "absolute",
    left: "50%",
    top: "50%",
    height: 35,         // Tamanho da linha
    width: 2,               // Espessura
    backgroundColor: "rgba(220,38,38,0.8)",
    marginTop: -17,       // Metade do height (40 / 2)
    marginLeft: -0.5,        // Metade da espessura
  },
  */
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
  toggleBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  toggleLabel: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
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
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7a1313",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    gap: 12,
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
    fontSize: 16,
    fontWeight: "700",
  },
  listDetail: {
    color: "rgba(248,250,252,0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  routesContainer: {
    backgroundColor: "#0d0000",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(220,38,38,0.2)",
    maxHeight: 120,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  routeText: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
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
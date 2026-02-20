import { Feather } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const favoritos = [
  { title: "Centro historico", detail: "Caxias, MA", tipo: "Tour 360" },
  { title: "Galeria Mirante", detail: "1,4 km, aberto", tipo: "Galeria" },
];

export default function FavoritosScreen() {
  if (favoritos.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="heart" size={48} color="#dc2626" />
        <Text style={styles.emptyTitle}>Sem favoritos</Text>
        <Text style={styles.emptySubtitle}>
          Adiciona galerias e tours aos favoritos para os ver aqui.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
        <Text style={styles.subtitle}>{favoritos.length} locais guardados</Text>
      </View>
      {favoritos.map((item) => (
        <TouchableOpacity key={item.title} style={styles.card} activeOpacity={0.75}>
          <View style={styles.cardLeft}>
            <Feather name="heart" size={18} color="#dc2626" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDetail}>{item.detail}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.tipo}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    backgroundColor: "#0d0000",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a0000",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#dc2626",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardLeft: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(220,38,38,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  cardDetail: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    backgroundColor: "rgba(220,38,38,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0000",
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

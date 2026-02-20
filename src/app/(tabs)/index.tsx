import { ScrollView, StyleSheet, Text, View } from "react-native";

const highlights = [
  { label: "Galerias ativas", value: "14" },
  { label: "Experiencias 360", value: "28" },
  { label: "Tours recomendados", value: "6" },
  { label: "Cidades conectadas", value: "3" },
];

export default function Index() {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.muted}>Home</Text>
        <Text style={styles.title}>Descubra galerias em 360 graus</Text>
        <Text style={styles.description}>
          Toque nos cards abaixo para explorar tours, salvar locais favoritos e abrir o mapa com
          trajetos cenicos.
        </Text>
      </View>
      <View style={styles.grid}>
        {highlights.map((item) => (
          <View key={item.label} style={styles.card}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardValue}>{item.value}</Text>
          </View>
        ))}
      </View>
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
  hero: {
    marginBottom: 24,
  },
  muted: {
    color: "rgba(248,250,252,0.7)",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 8,
  },
  description: {
    color: "rgba(248,250,252,0.75)",
    fontSize: 16,
    lineHeight: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#7a1313",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#dc2626",
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardLabel: {
    color: "rgba(248,250,252)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardValue: {
    color: "rgba(248,250,252)",
    fontSize: 24,
    fontWeight: "700",
  },
});

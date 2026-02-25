import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: "#0d0000",
    borderTopWidth: 0,
    height: 26 + bottom,
    paddingBottom: bottom,
    paddingTop: 0,
    shadowColor: "#dc2626",
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#dc2626",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarShowLabel: false,
        tabBarStyle,
        tabBarIconStyle: { marginTop: -20 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color, size }) => (
            <Feather name="map-pin" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: "Favoritos",
          tabBarIcon: ({ color, size }) => (
            <Feather name="heart" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

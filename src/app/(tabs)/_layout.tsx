import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const tabBarStyle = {
    backgroundColor: colors.background,
    borderTopWidth: 0,
    height: 26 + bottom,
    paddingBottom: bottom,
    paddingTop: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  };

  return (
    <Tabs
      initialRouteName="inicio"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.iconMuted,
        tabBarShowLabel: false,
        tabBarStyle,
        tabBarIconStyle: { marginTop: -20 },
      }}
    >
      <Tabs.Screen
        name="inicio"
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
    </Tabs>
  );
}

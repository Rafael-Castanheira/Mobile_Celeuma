import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

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

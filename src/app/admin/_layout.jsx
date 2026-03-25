import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import { isAdminRole } from "../../lib/auth";

export default function AdminLayout() {
	const { colors, mode, activePreset } = useAppTheme();
	const { user, isLoadingAuth } = useAuth();
	const pathname = usePathname();
	const stackThemeKey = `${mode}-${activePreset?.id_theme_preset ?? "default"}`;

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

	if (!isAdminRole(user.role) && pathname !== "/admin") {
		return <Redirect href="/admin" />;
	}

	return (
		<Stack
			key={stackThemeKey}
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
				animation: "fade",
			}}
		/>
	);
}

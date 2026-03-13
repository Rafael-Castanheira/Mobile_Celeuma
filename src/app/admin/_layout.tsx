import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../context/ThemeContext";
import { getAuthenticatedHomeRoute, isAdminRole } from "../../lib/auth";

export default function AdminLayout() {
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

	if (!isAdminRole(user.role)) {
		return <Redirect href={getAuthenticatedHomeRoute(user.role)} />;
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
				animation: "fade",
			}}
		/>
	);
}

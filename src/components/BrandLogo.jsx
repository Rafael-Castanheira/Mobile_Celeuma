import { Feather } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

export default function BrandLogo({ size = 88, iconSize = 40, withFrame = true }) {
	const { colors, logoUrl, isDark } = useAppTheme();

	return (
		<View
			style={[
				styles.container,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: withFrame 
						? (isDark ? "#F8F9FA" : colors.card) 
						: (isDark && logoUrl ? "rgba(255, 255, 255, 0.85)" : "transparent"),
					borderColor: withFrame ? colors.border : "transparent",
					shadowColor: isDark ? "rgba(255, 255, 255, 0.6)" : colors.shadow,
					shadowOpacity: isDark ? 0.15 : 0.28,
					shadowRadius: isDark ? 10 : 16,
					borderWidth: withFrame ? 1.5 : 0,
				},
			]}
		>
			{logoUrl ? (
				<Image
					source={{ uri: logoUrl }}
					style={{ width: size * 0.66, height: size * 0.66 }}
					resizeMode="contain"
				/>
			) : (
				<Feather name="aperture" size={iconSize} color={colors.primary} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
		justifyContent: "center",
		shadowOpacity: 0.28,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 6 },
		elevation: 8,
	},
});

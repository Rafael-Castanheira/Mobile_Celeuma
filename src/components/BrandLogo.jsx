import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "../context/ThemeContext";

const celeumaLight = require("../../assets/images/celeumaBlack.svg");
const celeumaDark = require("../../assets/images/celeuma.svg");

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
						? colors.card 
						: "transparent",
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
					contentFit="contain"
				/>
			) : (
				<Image 
					source={isDark ? celeumaDark : celeumaLight} 
					style={{ width: size * 0.66, height: size * 0.66 }}
					contentFit="contain"
				/>
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

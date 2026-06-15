import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "../context/ThemeContext";

const celeumaLight = require("../../assets/images/celeumaBlack.svg");
const celeumaDark = require("../../assets/images/celeuma.svg");

export default function BrandLogo({ size = 88, iconSize = 40, withFrame = true }) {
	const { colors, logoUrl, isDark } = useAppTheme();

	const finalImgSize = iconSize || size * 0.75;

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
					shadowColor: colors.shadow,
					borderWidth: withFrame ? 3 : 0,
				},
			]}
		>
			{logoUrl ? (
				<Image
					source={{ uri: logoUrl }}
					style={{ width: finalImgSize, height: finalImgSize }}
					contentFit="contain"
				/>
			) : (
				<Image 
					source={isDark ? celeumaDark : celeumaLight} 
					style={{ width: finalImgSize, height: finalImgSize }}
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
		shadowOpacity: 0.5,
		shadowRadius: 24,
		shadowOffset: { width: 0, height: 8 },
		elevation: 12,
	},
});

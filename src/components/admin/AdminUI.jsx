import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";

export function AdminHeader({ title, rightIcon, onRightPress, rightIconColor }) {
	const router = useRouter();
	const { colors } = useAppTheme();

	return (
		<View style={[styles.header, { borderBottomColor: colors.border }]}>
			<Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
				<Feather name="arrow-left" size={20} color={colors.primary} />
			</Pressable>
			
			<Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
			
			{rightIcon ? (
				<Pressable onPress={onRightPress} style={[styles.btn, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
					<Feather name={rightIcon} size={20} color={rightIconColor || colors.primary} />
				</Pressable>
			) : (
				<View style={{ width: 34 }} /> 
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
	},
	btn: {
		padding: 6,
		borderWidth: 1,
		borderRadius: 999,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
	},
});

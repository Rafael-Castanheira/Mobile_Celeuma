import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

function getTitleColor(variant, colors) {
	if (variant === "error") return colors.destructive;
	if (variant === "warning") return colors.warning;
	if (variant === "success") return colors.success;
	if (variant === "info") return colors.info;
	return colors.foreground;
}

function Button({ label, variant, onPress }) {
	const { colors } = useAppTheme();
	const bg =
		variant === "primary"
			? colors.primary
			: variant === "destructive"
				? colors.destructive
				: colors.accentSoft;
	const fg =
		variant === "primary"
			? colors.primaryForeground
			: variant === "destructive"
				? colors.destructiveForeground
				: colors.foreground;

	return (
		<Pressable
			style={({ pressed }) => [
				styles.button,
				{ backgroundColor: bg, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
			]}
			onPress={onPress}
		>
			<Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
		</Pressable>
	);
}

export default function AppDialog({
	visible,
	variant = "default",
	title,
	message,
	buttons,
	onClose,
}) {
	const { colors } = useAppTheme();
	const effectiveButtons = buttons && buttons.length > 0 ? buttons : [{ text: "OK", variant: "primary" }];

	async function handlePress(btn) {
		onClose();
		try {
			await btn.onPress?.();
		} catch {
			// Swallow errors here; call sites should handle errors explicitly.
		}
	}

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
				<View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
					<Text style={[styles.title, { color: getTitleColor(variant, colors) }]}>{title}</Text>
					{Boolean(message) && (
						<Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
					)}

					<View style={styles.buttonsRow}>
						{effectiveButtons.map((btn, idx) => (
							<Button
								key={`${btn.text}-${idx}`}
								label={btn.text}
								variant={btn.variant ?? "secondary"}
								onPress={() => void handlePress(btn)}
							/>
						))}
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 18,
	},
	card: {
		width: "100%",
		maxWidth: 420,
		borderWidth: 1,
		borderRadius: 16,
		padding: 16,
	},
	title: {
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	message: {
		marginTop: 10,
		fontSize: 14,
		lineHeight: 20,
	},
	buttonsRow: {
		marginTop: 14,
		flexDirection: "row",
		gap: 10,
		justifyContent: "flex-end",
		flexWrap: "wrap",
	},
	button: {
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 14,
		minWidth: 96,
		alignItems: "center",
	},
	buttonText: {
		fontSize: 14,
		fontWeight: "700",
	},
});

import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { getLandingContent, type LandingContent } from "../lib/360api";
import { getAuthenticatedHomeRoute } from "../lib/auth";

export default function Root() {
	const { user, isLoadingAuth } = useAuth();
	const { top, bottom } = useSafeAreaInsets();
	const router = useRouter();
	const { colors, activePreset } = useAppTheme();
	const [landing, setLanding] = useState<LandingContent | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		async function loadLanding() {
			try {
				setLanding(await getLandingContent(controller.signal));
			} catch {
				setLanding(null);
			}
		}

		loadLanding();
		return () => controller.abort();
	}, []);

	if (isLoadingAuth) {
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
				<ActivityIndicator size="small" color={colors.primary} />
			</View>
		);
	}

	if (user) {
		return <Redirect href={getAuthenticatedHomeRoute(user.role)} />;
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.background, paddingTop: top + 12, paddingBottom: bottom + 20 }]}>
			<View style={styles.header}>
				<BrandLogo size={76} iconSize={34} withFrame />
				<Pressable style={styles.loginLink} onPress={() => router.push("/login")}> 
					<Text style={[styles.loginLinkText, { color: colors.foreground }]}>Entrar</Text>
					<Feather name="arrow-right" size={14} color={colors.foreground} />
				</Pressable>
			</View>

			<View style={styles.hero}>
				<Text style={[styles.heroTitle, { color: colors.foreground }]}>
					{landing?.title ?? "Explora o mundo com Galerias 360"}
				</Text>
				<Text style={[styles.heroDescription, { color: colors.mutedForeground }]}>
					{landing?.description ?? activePreset?.description ?? "Descobre pontos turísticos e culturais com uma experiência imersiva em 360º."}
				</Text>
			</View>

			<View style={styles.actions}>
				<Pressable
					onPress={() => router.push("/login")}
					style={({ pressed }) => [
						styles.primaryBtn,
						{ backgroundColor: colors.primary, shadowColor: colors.shadow },
						pressed && { opacity: 0.86 },
					]}
				>
					<Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Entrar</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: 22,
		justifyContent: "space-between",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	loginLink: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 10,
	},
	loginLinkText: {
		fontSize: 14,
		fontWeight: "700",
	},
	hero: {
		paddingHorizontal: 4,
		gap: 20,
	},
	heroTitle: {
		fontSize: 42,
		lineHeight: 46,
		fontWeight: "700",
		textAlign: "center",
	},
	heroDescription: {
		fontSize: 17,
		lineHeight: 27,
		textAlign: "center",
	},
	actions: {
		paddingHorizontal: 4,
	},
	primaryBtn: {
		height: 52,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		shadowOpacity: 0.25,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 4,
	},
	primaryBtnText: {
		fontSize: 15,
		fontWeight: "700",
	},
});

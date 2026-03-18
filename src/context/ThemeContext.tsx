import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus, useColorScheme } from "react-native";
import { getActiveThemePreset, type ThemePreset, type ThemeVariables } from "../lib/360api";

export type AppThemeColors = {
	background: string;
	surface: string;
	surfaceAlt: string;
	card: string;
	input: string;
	border: string;
	borderSoft: string;
	primary: string;
	primaryStrong: string;
	primarySoft: string;
	text: string;
	textMuted: string;
	textSubtle: string;
	textOnPrimary: string;
	danger: string;
	dangerSoft: string;
	successSoft: string;
	shadow: string;
	tabInactive: string;
	overlay: string;
};

type ThemeContextValue = {
	activeTheme: ThemePreset | null;
	colors: AppThemeColors;
	isLoadingTheme: boolean;
	refreshTheme: () => Promise<void>;
	applyThemePreset: (theme: ThemePreset | null) => void;
};

const DEFAULT_COLORS: AppThemeColors = {
	background: "#0d0000",
	surface: "#1a0a0a",
	surfaceAlt: "#1e0000",
	card: "#1a0505",
	input: "rgba(255,255,255,0.06)",
	border: "#3d0000",
	borderSoft: "rgba(255,255,255,0.07)",
	primary: "#dc2626",
	primaryStrong: "#7a1313",
	primarySoft: "rgba(220,38,38,0.16)",
	text: "#f8fafc",
	textMuted: "#94a3b8",
	textSubtle: "#64748b",
	textOnPrimary: "#ffffff",
	danger: "#ef4444",
	dangerSoft: "rgba(239,68,68,0.15)",
	successSoft: "rgba(34,197,94,0.15)",
	shadow: "#dc2626",
	tabInactive: "rgba(255,255,255,0.4)",
	overlay: "rgba(0,0,0,0.7)",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function firstColor(vars: ThemeVariables | null | undefined, keys: string[]): string | null {
	if (!vars) return null;

	for (const key of keys) {
		const value = vars[key];
		if (typeof value === "string" && value.trim()) {
			return value;
		}
	}

	return null;
}

function getMergedThemeVars(theme: ThemePreset | null, colorScheme: "light" | "dark" | null | undefined) {
	if (!theme) return null;

	const preferred = colorScheme === "light" ? theme.lightVars : theme.darkVars;
	const fallback = colorScheme === "light" ? theme.darkVars : theme.lightVars;

	return {
		...(fallback ?? {}),
		...(preferred ?? {}),
	};
}

function buildThemeColors(theme: ThemePreset | null, colorScheme: "light" | "dark" | null | undefined): AppThemeColors {
	const vars = getMergedThemeVars(theme, colorScheme);
	if (!vars) return DEFAULT_COLORS;

	return {
		background: firstColor(vars, ["background", "bg", "appBackground", "screenBackground", "colorBackground"]) ?? DEFAULT_COLORS.background,
		surface: firstColor(vars, ["surface", "card", "panel", "surfaceColor", "cardBackground"]) ?? DEFAULT_COLORS.surface,
		surfaceAlt: firstColor(vars, ["surfaceAlt", "surfaceSecondary", "secondarySurface", "elevated", "layer", "headerBackground"]) ?? DEFAULT_COLORS.surfaceAlt,
		card: firstColor(vars, ["card", "panel", "tile", "cardBackground", "surfaceTertiary"]) ?? DEFAULT_COLORS.card,
		input: firstColor(vars, ["input", "inputBackground", "fieldBackground", "surfaceInput"]) ?? DEFAULT_COLORS.input,
		border: firstColor(vars, ["border", "outline", "stroke", "borderColor"]) ?? DEFAULT_COLORS.border,
		borderSoft: firstColor(vars, ["borderSoft", "outlineSoft", "divider", "dividerColor"]) ?? DEFAULT_COLORS.borderSoft,
		primary: firstColor(vars, ["primary", "primaryColor", "accent", "brand", "accentColor"]) ?? DEFAULT_COLORS.primary,
		primaryStrong: firstColor(vars, ["primaryStrong", "primaryDark", "brandDark", "accentStrong", "secondary"]) ?? DEFAULT_COLORS.primaryStrong,
		primarySoft: firstColor(vars, ["primarySoft", "primaryMuted", "accentSoft", "brandSoft"]) ?? DEFAULT_COLORS.primarySoft,
		text: firstColor(vars, ["text", "foreground", "textPrimary", "colorText"]) ?? DEFAULT_COLORS.text,
		textMuted: firstColor(vars, ["textMuted", "muted", "textSecondary", "mutedText"]) ?? DEFAULT_COLORS.textMuted,
		textSubtle: firstColor(vars, ["textSubtle", "subtle", "textTertiary", "hint"]) ?? DEFAULT_COLORS.textSubtle,
		textOnPrimary: firstColor(vars, ["textOnPrimary", "primaryForeground", "onPrimary", "buttonText"]) ?? DEFAULT_COLORS.textOnPrimary,
		danger: firstColor(vars, ["danger", "error", "destructive", "errorColor"]) ?? DEFAULT_COLORS.danger,
		dangerSoft: firstColor(vars, ["dangerSoft", "errorSoft", "destructiveSoft"]) ?? DEFAULT_COLORS.dangerSoft,
		successSoft: firstColor(vars, ["successSoft", "successMuted", "positiveSoft"]) ?? DEFAULT_COLORS.successSoft,
		shadow: firstColor(vars, ["shadow", "shadowColor", "primary", "accent"]) ?? DEFAULT_COLORS.shadow,
		tabInactive: firstColor(vars, ["tabInactive", "muted", "textMuted", "textSecondary"]) ?? DEFAULT_COLORS.tabInactive,
		overlay: firstColor(vars, ["overlay", "backdrop", "modalOverlay"]) ?? DEFAULT_COLORS.overlay,
	};
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme();
	const [activeTheme, setActiveTheme] = useState<ThemePreset | null>(null);
	const [isLoadingTheme, setIsLoadingTheme] = useState(true);

	async function refreshTheme() {
		try {
			setActiveTheme(await getActiveThemePreset());
		} finally {
			setIsLoadingTheme(false);
		}
	}

	useEffect(() => {
		refreshTheme();
	}, []);

	useEffect(() => {
		function handleAppStateChange(nextState: AppStateStatus) {
			if (nextState === "active") {
				refreshTheme();
			}
		}

		const subscription = AppState.addEventListener("change", handleAppStateChange);
		return () => subscription.remove();
	}, []);

	const value = useMemo<ThemeContextValue>(() => ({
		activeTheme,
		colors: buildThemeColors(activeTheme, colorScheme),
		isLoadingTheme,
		refreshTheme,
		applyThemePreset: setActiveTheme,
	}), [activeTheme, colorScheme, isLoadingTheme]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useAppTheme deve ser usado dentro de ThemeProvider");
	return context;
}
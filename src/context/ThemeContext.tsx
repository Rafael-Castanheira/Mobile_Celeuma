import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getActiveThemePreset, type ThemePreset } from "../lib/360api";
import { buildThemeColors, getThemeLogo, resolveThemeVars, type AppThemeColors, type ThemeVariableMap } from "../lib/theme";

type ThemeContextValue = {
	mode: "light" | "dark";
	isDark: boolean;
	colors: AppThemeColors;
	vars: ThemeVariableMap;
	activePreset: ThemePreset | null;
	logoUrl: string | null;
	isLoadingTheme: boolean;
	refreshActiveTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme();
	const mode: "light" | "dark" = colorScheme === "light" ? "light" : "dark";
	const [activePreset, setActivePreset] = useState<ThemePreset | null>(null);
	const [isLoadingTheme, setIsLoadingTheme] = useState(true);

	const refreshActiveTheme = useCallback(async () => {
		try {
			const preset = await getActiveThemePreset();
			setActivePreset(preset);
		} catch {
			setActivePreset(null);
		} finally {
			setIsLoadingTheme(false);
		}
	}, []);

	useEffect(() => {
		refreshActiveTheme();
	}, [refreshActiveTheme]);

	const value = useMemo<ThemeContextValue>(() => {
		const colors = buildThemeColors(mode, activePreset);
		return {
			mode,
			isDark: mode === "dark",
			colors,
			vars: resolveThemeVars(mode, activePreset),
			activePreset,
			logoUrl: getThemeLogo(activePreset, mode),
			isLoadingTheme,
			refreshActiveTheme,
		};
	}, [activePreset, isLoadingTheme, mode, refreshActiveTheme]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useAppTheme deve ser usado dentro de ThemeProvider");
	return ctx;
}
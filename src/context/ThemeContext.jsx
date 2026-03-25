import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getActiveThemePreset } from "../lib/360api";
import { buildThemeColors, getThemeLogo, resolveThemeVars } from "../lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
	const colorScheme = useColorScheme();
	const mode = colorScheme === "light" ? "light" : "dark";
	const [activePreset, setActivePreset] = useState(null);
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

	const value = useMemo(() => {
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

import AsyncStorage from "@react-native-async-storage/async-storage/lib/commonjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getActiveThemePreset } from "../lib/360api";
import { buildThemeColors, getThemeLogo, resolveThemeVars } from "../lib/theme";

const ThemeContext = createContext(null);
const THEME_MODE_STORAGE_KEY = "@galerias360:theme-mode";
const VALID_THEME_MODES = new Set(["system", "light", "dark"]);

export function ThemeProvider({ children }) {
	const colorScheme = useColorScheme();
	const [themeModePreference, setThemeModePreferenceState] = useState("system");
	const systemMode = colorScheme === "light" ? "light" : "dark";
	const mode = themeModePreference === "system" ? systemMode : themeModePreference;
	const [activePreset, setActivePreset] = useState(null);
	const [isLoadingTheme, setIsLoadingTheme] = useState(true);

	useEffect(() => {
		async function restoreThemeModePreference() {
			try {
				const savedPreference = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
				if (savedPreference && VALID_THEME_MODES.has(savedPreference)) {
					setThemeModePreferenceState(savedPreference);
				}
			} catch {
				// Ignore preference restore failures and keep the default mode.
			}
		}

		restoreThemeModePreference();
	}, []);

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

	const setThemeModePreference = useCallback(async (nextPreference) => {
		const normalizedPreference = VALID_THEME_MODES.has(nextPreference) ? nextPreference : "system";
		setThemeModePreferenceState(normalizedPreference);

		try {
			if (normalizedPreference === "system") {
				await AsyncStorage.removeItem(THEME_MODE_STORAGE_KEY);
				return;
			}
			await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, normalizedPreference);
		} catch {
			// Ignore persistence errors; the current session still reflects the selected mode.
		}
	}, []);

	const value = useMemo(() => {
		const colors = buildThemeColors(mode, activePreset);
		return {
			mode,
			themeModePreference,
			isDark: mode === "dark",
			colors,
			vars: resolveThemeVars(mode, activePreset),
			activePreset,
			logoUrl: getThemeLogo(activePreset, mode),
			isLoadingTheme,
			setThemeModePreference,
			refreshActiveTheme,
		};
	}, [activePreset, isLoadingTheme, mode, refreshActiveTheme, setThemeModePreference, themeModePreference]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useAppTheme deve ser usado dentro de ThemeProvider");
	return ctx;
}

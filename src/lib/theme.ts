import type { ThemePreset } from "./360api";

export type ThemeVariableMap = Record<string, string>;

export type AppThemeColors = {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	destructiveForeground: string;
	border: string;
	input: string;
	ring: string;
	chart1: string;
	chart2: string;
	chart3: string;
	chart4: string;
	chart5: string;
	overlay: string;
	softOverlay: string;
	shadow: string;
	success: string;
	warning: string;
	info: string;
	placeholder: string;
	buttonDisabled: string;
	iconMuted: string;
	accentSoft: string;
};

export const DEFAULT_LIGHT_VARS: ThemeVariableMap = {
	background: "0 0% 100%",
	foreground: "0 0% 3.9%",
	card: "0 0% 100%",
	"card-foreground": "0 0% 3.9%",
	popover: "0 0% 100%",
	"popover-foreground": "0 0% 3.9%",
	primary: "0 0% 9%",
	"primary-foreground": "0 0% 98%",
	secondary: "0 0% 96.1%",
	"secondary-foreground": "0 0% 9%",
	muted: "0 0% 96.1%",
	"muted-foreground": "0 0% 45.1%",
	accent: "0 0% 96.1%",
	"accent-foreground": "0 0% 9%",
	destructive: "0 84.2% 60.2%",
	"destructive-foreground": "0 0% 98%",
	border: "0 0% 89.8%",
	input: "0 0% 89.8%",
	ring: "0 0% 3.9%",
	"chart-1": "12 76% 61%",
	"chart-2": "173 58% 39%",
	"chart-3": "197 37% 24%",
	"chart-4": "43 74% 66%",
	"chart-5": "27 87% 67%",
};

export const DEFAULT_DARK_VARS: ThemeVariableMap = {
	background: "222 24% 8%",
	foreground: "0 0% 96%",
	card: "222 20% 12%",
	"card-foreground": "0 0% 96%",
	popover: "222 20% 12%",
	"popover-foreground": "0 0% 96%",
	primary: "4 86% 61%",
	"primary-foreground": "0 0% 100%",
	secondary: "222 16% 16%",
	"secondary-foreground": "0 0% 96%",
	muted: "222 16% 16%",
	"muted-foreground": "220 10% 72%",
	accent: "222 16% 18%",
	"accent-foreground": "0 0% 96%",
	destructive: "0 70% 40%",
	"destructive-foreground": "0 0% 100%",
	border: "220 12% 22%",
	input: "220 12% 22%",
	ring: "4 86% 61%",
	"chart-1": "220 70% 50%",
	"chart-2": "160 60% 45%",
	"chart-3": "30 80% 55%",
	"chart-4": "280 65% 60%",
	"chart-5": "340 75% 55%",
};

function normalizeAlpha(alpha: string): string {
	const trimmed = alpha.trim();
	if (trimmed.endsWith("%")) {
		const numeric = Number(trimmed.slice(0, -1));
		if (Number.isFinite(numeric)) return String(Math.max(0, Math.min(1, numeric / 100)));
	}
	const numeric = Number(trimmed);
	if (Number.isFinite(numeric)) return String(Math.max(0, Math.min(1, numeric)));
	return "1";
}

function parseHslToken(value: string): { h: string; s: string; l: string; a?: string } | null {
	const trimmed = value.trim();
	const tokenMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?%)\s+(\d+(?:\.\d+)?%)(?:\s*\/\s*(\d+(?:\.\d+)?%?))?$/);
	if (tokenMatch) {
		return {
			h: tokenMatch[1],
			s: tokenMatch[2],
			l: tokenMatch[3],
			a: tokenMatch[4],
		};
	}

	const cssMatch = trimmed.match(/^hsla?\((.+)\)$/i);
	if (!cssMatch) return null;

	const normalized = cssMatch[1]
		.replace(/\s*\/\s*/g, ",")
		.replace(/,/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	if (normalized.length < 3) return null;
	return {
		h: normalized[0],
		s: normalized[1],
		l: normalized[2],
		a: normalized[3],
	};
}

export function isThemeColorValue(value: string): boolean {
	const trimmed = value.trim();
	return (
		/^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(trimmed) ||
		parseHslToken(trimmed) !== null
	);
}

export function normalizeThemeColor(value: string): string {
	const trimmed = value.trim();
	if (/^(#|rgb\(|rgba\()/i.test(trimmed)) return trimmed;

	const hsl = parseHslToken(trimmed);
	if (!hsl) return trimmed;

	if (hsl.a !== undefined) {
		return `hsla(${hsl.h}, ${hsl.s}, ${hsl.l}, ${normalizeAlpha(hsl.a)})`;
	}

	return `hsl(${hsl.h}, ${hsl.s}, ${hsl.l})`;
}

export function withOpacity(value: string, opacity: number): string {
	const hsl = parseHslToken(value);
	if (hsl) {
		return `hsla(${hsl.h}, ${hsl.s}, ${hsl.l}, ${Math.max(0, Math.min(1, opacity))})`;
	}
	return value;
}

export function resolveThemeVars(mode: "light" | "dark", activePreset: ThemePreset | null): ThemeVariableMap {
	const fallback = mode === "dark" ? DEFAULT_DARK_VARS : DEFAULT_LIGHT_VARS;
	const overrides = mode === "dark" ? activePreset?.darkVars : activePreset?.lightVars;
	return {
		...fallback,
		...(overrides ?? {}),
	};
}

export function getThemeLogo(activePreset: ThemePreset | null, mode: "light" | "dark"): string | null {
	if (!activePreset) return null;
	if (mode === "dark") {
		return activePreset.logoDarkUrl ?? activePreset.logoLightUrl ?? null;
	}
	return activePreset.logoLightUrl ?? activePreset.logoDarkUrl ?? null;
}

export function buildThemeColors(mode: "light" | "dark", activePreset: ThemePreset | null): AppThemeColors {
	const vars = resolveThemeVars(mode, activePreset);
	const background = normalizeThemeColor(vars.background);
	const foreground = normalizeThemeColor(vars.foreground);
	const card = normalizeThemeColor(vars.card);
	const primary = normalizeThemeColor(vars.primary);
	const destructive = normalizeThemeColor(vars.destructive);

	return {
		background,
		foreground,
		card,
		cardForeground: normalizeThemeColor(vars["card-foreground"]),
		popover: normalizeThemeColor(vars.popover),
		popoverForeground: normalizeThemeColor(vars["popover-foreground"]),
		primary,
		primaryForeground: normalizeThemeColor(vars["primary-foreground"]),
		secondary: normalizeThemeColor(vars.secondary),
		secondaryForeground: normalizeThemeColor(vars["secondary-foreground"]),
		muted: normalizeThemeColor(vars.muted),
		mutedForeground: normalizeThemeColor(vars["muted-foreground"]),
		accent: normalizeThemeColor(vars.accent),
		accentForeground: normalizeThemeColor(vars["accent-foreground"]),
		destructive,
		destructiveForeground: normalizeThemeColor(vars["destructive-foreground"]),
		border: normalizeThemeColor(vars.border),
		input: normalizeThemeColor(vars.input),
		ring: normalizeThemeColor(vars.ring),
		chart1: normalizeThemeColor(vars["chart-1"]),
		chart2: normalizeThemeColor(vars["chart-2"]),
		chart3: normalizeThemeColor(vars["chart-3"]),
		chart4: normalizeThemeColor(vars["chart-4"]),
		chart5: normalizeThemeColor(vars["chart-5"]),
		overlay: mode === "dark" ? "rgba(2,6,23,0.56)" : "rgba(15,23,42,0.28)",
		softOverlay: mode === "dark" ? "rgba(2,6,23,0.34)" : "rgba(15,23,42,0.16)",
		shadow: withOpacity(vars.primary, mode === "dark" ? 0.45 : 1),
		success: normalizeThemeColor(vars["chart-2"]),
		warning: normalizeThemeColor(vars["chart-4"]),
		info: normalizeThemeColor(vars["chart-1"]),
		placeholder: withOpacity(vars["muted-foreground"], 0.75),
		buttonDisabled: withOpacity(vars.primary, mode === "dark" ? 0.45 : 0.55),
		iconMuted: withOpacity(vars.foreground, 0.55),
		accentSoft: withOpacity(vars.primary, mode === "dark" ? 0.18 : 0.12),
	};
}
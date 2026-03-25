export function asRecord(value) {
	return value && typeof value === "object" ? value : null;
}

export function toNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAlpha(alpha) {
	const trimmed = alpha.trim();
	if (trimmed.endsWith("%")) {
		const numeric = Number(trimmed.slice(0, -1));
		if (Number.isFinite(numeric)) return String(Math.max(0, Math.min(1, numeric / 100)));
	}
	const numeric = Number(trimmed);
	if (Number.isFinite(numeric)) return String(Math.max(0, Math.min(1, numeric)));
	return "1";
}

function parseHslToken(value) {
	const trimmed = value.trim();
	const tokenMatch = trimmed.match(
		/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?%)\s+(\d+(?:\.\d+)?%)(?:\s*\/\s*(\d+(?:\.\d+)?%?))?$/
	);
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

export function isThemeColorValue(value) {
	const trimmed = value.trim();
	return /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(trimmed) || parseHslToken(trimmed) !== null;
}

export function normalizeThemeColor(value) {
	const trimmed = value.trim();
	if (/^(#|rgb\(|rgba\()/i.test(trimmed)) return trimmed;

	const hsl = parseHslToken(trimmed);
	if (!hsl) return trimmed;

	if (hsl.a !== undefined) {
		return `hsla(${hsl.h}, ${hsl.s}, ${hsl.l}, ${normalizeAlpha(hsl.a)})`;
	}

	return `hsl(${hsl.h}, ${hsl.s}, ${hsl.l})`;
}

export function withOpacity(value, opacity) {
	const hsl = parseHslToken(value);
	if (hsl) {
		return `hsla(${hsl.h}, ${hsl.s}, ${hsl.l}, ${Math.max(0, Math.min(1, opacity))})`;
	}
	return value;
}

export function extractRoutePointIds(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (typeof item === "number") {
				return item;
			}

			const record = asRecord(item);
			if (!record) {
				return null;
			}

			return toNumber(record.id_ponto) ?? toNumber(record.id) ?? toNumber(record.idPoint);
		})
		.filter((id) => typeof id === "number");
}

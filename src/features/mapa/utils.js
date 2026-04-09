export function formatDistance(distanceMeters) {
	return `${(distanceMeters / 1000).toFixed(2)} km`;
}

export function formatDuration(durationSeconds) {
	return `${Math.max(1, Math.round(durationSeconds / 60))} min`;
}

export function approximatePolylineDistanceMeters(latLngs) {
	if (latLngs.length < 2) return 0;
	const R = 6371000;
	const toRad = (deg) => (deg * Math.PI) / 180;
	let distance = 0;
	for (let i = 1; i < latLngs.length; i += 1) {
		const [lat1, lon1] = latLngs[i - 1];
		const [lat2, lon2] = latLngs[i];
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		distance += R * c;
	}
	return distance;
}

export function toPortugueseDirection(step) {
	const normalized = step.trim();
	if (!normalized) return normalized;

	return normalized
		.replace(/\bHead\b/gi, "Siga")
		.replace(/\bContinue\b/gi, "Continue")
		.replace(/\bSlight right\b/gi, "Vire ligeiramente à direita")
		.replace(/\bSlight left\b/gi, "Vire ligeiramente à esquerda")
		.replace(/\bTurn right\b/gi, "Vire à direita")
		.replace(/\bTurn left\b/gi, "Vire à esquerda")
		.replace(/\bKeep right\b/gi, "Mantenha-se à direita")
		.replace(/\bKeep left\b/gi, "Mantenha-se à esquerda")
		.replace(/\bMake a U-turn\b/gi, "Faça retorno")
		.replace(/\bEnter the roundabout\b/gi, "Entre na rotatória")
		.replace(/\bAt the roundabout, take the ([0-9]+)(st|nd|rd|th) exit\b/gi, "Na rotatória, pegue a $1ª saída")
		.replace(/\bTake the ramp\b/gi, "Pegue a alça")
		.replace(/\bTake the ferry\b/gi, "Pegue a balsa")
		.replace(/\bDestination is on the right\b/gi, "O destino está à direita")
		.replace(/\bDestination is on the left\b/gi, "O destino está à esquerda")
		.replace(/\bArrive at your destination\b/gi, "Você chegou ao destino")
		.replace(/\bon\b/gi, "na")
		.replace(/\bonto\b/gi, "para")
		.replace(/\btowards\b/gi, "em direção a");
}

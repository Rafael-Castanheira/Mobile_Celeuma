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
	if (typeof step === 'object' && step?.maneuver) {
		const type = step.maneuver.type;
		const modifier = step.maneuver.modifier;
		const name = step.name ? ` na ${step.name}` : "";
		const nameTo = step.name ? ` para ${step.name}` : "";
		
		let instruction = "";
		switch (type) {
			case 'depart':
				instruction = `Siga${name}`;
				if (modifier) {
					if (modifier.includes('right')) instruction += ` à direita`;
					if (modifier.includes('left')) instruction += ` à esquerda`;
				}
				break;
			case 'turn':
				if (modifier === 'uturn') instruction = `Faça retorno${name}`;
				else if (modifier === 'sharp right') instruction = `Vire acentuadamente à direita${nameTo}`;
				else if (modifier === 'right') instruction = `Vire à direita${nameTo}`;
				else if (modifier === 'slight right') instruction = `Vire ligeiramente à direita${nameTo}`;
				else if (modifier === 'sharp left') instruction = `Vire acentuadamente à esquerda${nameTo}`;
				else if (modifier === 'left') instruction = `Vire à esquerda${nameTo}`;
				else if (modifier === 'slight left') instruction = `Vire ligeiramente à esquerda${nameTo}`;
				else if (modifier === 'straight') instruction = `Continue em frente${nameTo}`;
				else instruction = `Vire${nameTo}`;
				break;
			case 'continue':
				instruction = `Continue${nameTo}`;
				break;
			case 'new name':
				instruction = `O nome da rua muda${nameTo}`;
				break;
			case 'merge':
				instruction = `Junte-se${nameTo}`;
				break;
			case 'on ramp':
				instruction = `Pegue a alça de acesso${nameTo}`;
				break;
			case 'off ramp':
				instruction = `Pegue a saída${nameTo}`;
				break;
			case 'fork':
				if (modifier && modifier.includes('right')) instruction = `Mantenha-se à direita${nameTo}`;
				else if (modifier && modifier.includes('left')) instruction = `Mantenha-se à esquerda${nameTo}`;
				else instruction = `Na bifurcação, siga${nameTo}`;
				break;
			case 'end of road':
				if (modifier && modifier.includes('right')) instruction = `No final da rua, vire à direita${nameTo}`;
				else if (modifier && modifier.includes('left')) instruction = `No final da rua, vire à esquerda${nameTo}`;
				else instruction = `Fim da rua${name}`;
				break;
			case 'roundabout':
			case 'rotary':
				const exit = step.maneuver.exit;
				if (exit) {
					instruction = `Na rotatória, pegue a ${exit}ª saída${nameTo}`;
				} else {
					instruction = `Entre na rotatória${nameTo}`;
				}
				break;
			case 'arrive':
				instruction = `Chegou ao destino`;
				if (modifier && modifier.includes('right')) instruction += ` à direita`;
				if (modifier && modifier.includes('left')) instruction += ` à esquerda`;
				break;
			default:
				if (type) instruction = `Siga${name}`;
				else instruction = "";
		}
		if (instruction) return instruction.trim();
	}

	if (typeof step !== 'string') return "";

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

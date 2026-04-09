import { useEffect, useState } from "react";
import { useAbortController } from "../../hooks/useAbortController";
import { getMapPoints, getMapRoutes } from "../../lib/360api";

export function useMapData({ pollIntervalMs = 30_000 } = {}) {
	const [points, setPoints] = useState([]);
	const [apiRoutes, setApiRoutes] = useState([]);
	const [pointsError, setPointsError] = useState(null);
	const [routesError, setRoutesError] = useState(null);
	const [isLoadingPoints, setIsLoadingPoints] = useState(true);
	const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
	const controller = useAbortController();

	useEffect(() => {
		let pollTimer = null;

		async function loadMapData(isInitial) {
			if (isInitial) {
				setIsLoadingPoints(true);
				setIsLoadingRoutes(true);
				setPointsError(null);
				setRoutesError(null);
			}

			try {
				const [pointsData, routesData] = await Promise.all([
					getMapPoints(controller.signal),
					getMapRoutes(controller.signal),
				]);

				if (controller.signal.aborted) return;

				setPoints((prev) => (JSON.stringify(prev) !== JSON.stringify(pointsData) ? pointsData : prev));
				setApiRoutes((prev) => (JSON.stringify(prev) !== JSON.stringify(routesData) ? routesData : prev));

				if (isInitial) {
					setPointsError(null);
					setRoutesError(null);
				}
			} catch (error) {
				if (controller.signal.aborted) return;
				if (isInitial) {
					const message = error instanceof Error ? error.message : "Erro ao carregar dados do mapa.";
					setPointsError(message);
					setRoutesError(message);
				}
			} finally {
				if (!controller.signal.aborted && isInitial) {
					setIsLoadingPoints(false);
					setIsLoadingRoutes(false);
				}
			}

			if (!controller.signal.aborted) {
				pollTimer = setTimeout(() => loadMapData(false), pollIntervalMs);
			}
		}

		loadMapData(true);

		return () => {
			if (pollTimer !== null) clearTimeout(pollTimer);
		};
	}, [controller, pollIntervalMs]);

	return {
		points,
		setPoints,
		apiRoutes,
		pointsError,
		routesError,
		isLoadingPoints,
		isLoadingRoutes,
	};
}

import { useEffect, useMemo } from "react";

export function useAbortController() {
	const controller = useMemo(() => new AbortController(), []);

	useEffect(() => {
		return () => controller.abort();
	}, [controller]);

	return controller;
}

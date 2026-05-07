import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { fetchWithCache } from "../features/viewer/cache/hotspotCache";
import { selectVisibleHotspots } from "../features/viewer/selectVisibleHotspots";

const ViewerContext = createContext(null);

export function ViewerProvider({ pointId: initialPointId, token, children }) {
    const [currentPointId, setCurrentPointId] = useState(initialPointId);
    const [currentViewPath, setCurrentViewPath] = useState("");
    const [initialViewPath, setInitialViewPath] = useState("");
    
    const [allHotspots, setAllHotspots] = useState([]);
    const [pointMetadata, setPointMetadata] = useState(null);
    const [alignments, setAlignments] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // [{ pointId, viewPath }, ...]
    const [navigationHistory, setNavigationHistory] = useState([]);
    
    // Abort controller para requests canceladas
    const abortControllerRef = useRef(null);

    const loadPoint = useCallback(async (pointId, viewPath = "", pushToHistory = false) => {
        if (!pointId) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const { data } = await fetchWithCache(pointId, token, abortControllerRef.current.signal);
            
            if (pushToHistory && currentPointId) {
                setNavigationHistory(prev => [...prev, { pointId: currentPointId, viewPath: currentViewPath }]);
            }

            setCurrentPointId(pointId);
            setAllHotspots(data.hotspots || []);
            setPointMetadata(data.ponto);
            setAlignments(Array.isArray(data.alinhamentos) ? data.alinhamentos : []);
            setInitialViewPath(data.ponto?.initial_view_path || "");
            
            // Se não foi pedido viewPath, usa a initial
            setCurrentViewPath(viewPath || data.ponto?.initial_view_path || "");
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError("Não foi possível carregar o panorama 360. Verifique a sua ligação.");
                console.error("Erro no loadPoint:", err);
            }
        } finally {
            setLoading(false);
        }
    }, [currentPointId, currentViewPath, token]);

    // Initial load
    React.useEffect(() => {
        if (initialPointId) {
            // Limpar state
            setNavigationHistory([]);
            loadPoint(initialPointId);
        }
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [initialPointId, loadPoint]);

    const visibleHotspots = useMemo(() => {
        return selectVisibleHotspots(allHotspots, currentViewPath, initialViewPath);
    }, [allHotspots, currentViewPath, initialViewPath]);

    const currentAlignment = useMemo(() => {
        const normalizedCurrent = String(currentViewPath || "").trim();
        const normalizedInitial = String(initialViewPath || "").trim();
        const targetViewPath = normalizedCurrent || normalizedInitial;

        if (!targetViewPath || !Array.isArray(alignments) || alignments.length === 0) {
            return null;
        }

        const alignment = alignments.find((item) => String(item?.vista_path || "").trim() === targetViewPath);
        if (!alignment) return null;

        return {
            radius: Number.isFinite(Number(alignment.radius)) ? Number(alignment.radius) : 700,
            verticalOffset: Number.isFinite(Number(alignment.verticalOffset)) ? Number(alignment.verticalOffset) : 0,
            rotationX: Number.isFinite(Number(alignment.rotationX)) ? Number(alignment.rotationX) : 0,
            rotationY: Number.isFinite(Number(alignment.rotationY)) ? Number(alignment.rotationY) : -130,
            rotationZ: Number.isFinite(Number(alignment.rotationZ)) ? Number(alignment.rotationZ) : 0,
            mirrorX: Boolean(alignment.mirrorX),
            mirrorY: Boolean(alignment.mirrorY),
        };
    }, [alignments, currentViewPath, initialViewPath]);

    const navigateToPoint = useCallback((pointId) => {
        loadPoint(pointId, "", true);
    }, [loadPoint]);

    const navigateToFile = useCallback((fileUrl, filePath) => {
        setNavigationHistory(prev => [...prev, { pointId: currentPointId, viewPath: currentViewPath }]);
        setCurrentViewPath(filePath || fileUrl || "");
    }, [currentPointId, currentViewPath]);

    const navigateBack = useCallback(() => {
        if (navigationHistory.length === 0) return;
        
        const lastState = navigationHistory[navigationHistory.length - 1];
        setNavigationHistory(prev => prev.slice(0, -1));
        
        if (lastState.pointId !== currentPointId) {
            // Mudou de ponto, precisamos de recarregar esse ponto
            loadPoint(lastState.pointId, lastState.viewPath, false);
        } else {
            // Apenas mudou de vista no mesmo ponto
            setCurrentViewPath(lastState.viewPath);
        }
    }, [navigationHistory, currentPointId, loadPoint]);

    const value = {
        currentPointId,
        currentViewPath,
        initialViewPath,
        allHotspots,
        visibleHotspots,
        pointMetadata,
        alignments,
        currentAlignment,
        navigationHistory,
        loading,
        error,
        
        loadPoint,
        navigateToPoint,
        navigateToFile,
        navigateBack
    };

    return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
    const ctx = useContext(ViewerContext);
    if (!ctx) throw new Error("useViewer deve ser usado dentro do ViewerProvider");
    return ctx;
}

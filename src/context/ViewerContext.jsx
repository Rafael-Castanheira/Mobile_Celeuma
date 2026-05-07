import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { fetchWithCache } from "../features/viewer/cache/hotspotCache";
import { selectVisibleHotspots } from "../features/viewer/selectVisibleHotspots";

const ViewerContext = createContext(null);

export function ViewerProvider({ pointId: initialPointId, children }) {
    const [currentPointId, setCurrentPointId] = useState(initialPointId);
    const [currentViewPath, setCurrentViewPath] = useState("");
    const [initialViewPath, setInitialViewPath] = useState("");
    
    const [allHotspots, setAllHotspots] = useState([]);
    const [pointMetadata, setPointMetadata] = useState(null);
    
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
            const { data } = await fetchWithCache(pointId, abortControllerRef.current.signal);
            
            if (pushToHistory && currentPointId) {
                setNavigationHistory(prev => [...prev, { pointId: currentPointId, viewPath: currentViewPath }]);
            }

            setCurrentPointId(pointId);
            setAllHotspots(data.hotspots || []);
            setPointMetadata(data.ponto);
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
    }, [currentPointId, currentViewPath]);

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

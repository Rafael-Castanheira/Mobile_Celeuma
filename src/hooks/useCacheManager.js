import { useEffect, useState } from "react";
import {
    clearAllCache,
    getCacheStats,
    performCacheCleanup,
} from "../features/viewer/cache/cacheManager";

/**
 * Hook para gerenciar cache de visualizador 360º
 * Fornece utilitários para limpeza, estatísticas e monitoramento
 */
export function useCacheManager() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar estatísticas ao montar
  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (e) {
      console.error("Failed to get cache stats:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = async () => {
    setIsLoading(true);
    try {
      await performCacheCleanup();
      await refreshStats();
    } catch (e) {
      console.error("Failed to cleanup cache:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = async () => {
    setIsLoading(true);
    try {
      await clearAllCache();
      setStats(null);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stats,
    isLoading,
    refreshStats,
    cleanup,
    clearAll,
  };
}

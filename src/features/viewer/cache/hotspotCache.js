import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPointDetails, getPointMobileData } from "../../../lib/360api";
import { registerCacheItem, updateCacheAccessTime } from "./cacheManager";

const CACHE_PREFIX = "@g360:hotspots:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function getCacheKey(pointId) {
    return `${CACHE_PREFIX}${pointId}`;
}

async function loadPointData(pointId, token, signal) {
    const [mobileResult, detailsResult] = await Promise.allSettled([
        getPointMobileData(pointId, { includeAll: true }, signal),
        token ? getPointDetails(pointId, token, signal) : Promise.resolve(null),
    ]);

    if (mobileResult.status !== "fulfilled") {
        throw mobileResult.reason;
    }

    const mobileData = mobileResult.value;
    const detailsData = detailsResult.status === "fulfilled" ? detailsResult.value : null;

    return {
        ...mobileData,
        ponto: detailsData?.ponto ? { ...mobileData.ponto, ...detailsData.ponto } : mobileData.ponto,
        alinhamentos: detailsData?.alinhamentos || [],
    };
}

export async function fetchWithCache(pointId, token, signal, onRevalidated) {
    const key = getCacheKey(pointId);
    const now = Date.now();
    let cachedData = null;

    // 1. Tentar ler da cache
    try {
        const rawCache = await AsyncStorage.getItem(key);
        if (rawCache) {
            const parsed = JSON.parse(rawCache);
            if (parsed && parsed.timestamp && (now - parsed.timestamp < CACHE_TTL_MS)) {
                cachedData = parsed.data;
            } else {
                // Expired TTL, remove from cache
                await AsyncStorage.removeItem(key).catch(() => {});
            }
        }
    } catch (_err) {
        // Ignorar falhas de leitura
    }

    // 2. Tentar buscar da rede (stale-while-revalidate)
    // Se temos cache, retornamos imediatamente mas lançamos a revalidação em background (sem await)
    if (cachedData) {
        updateCacheAccessTime(pointId).catch(() => {}); // Atualizar tempo de acesso para LRU
        revalidateInBg(pointId, key, token, onRevalidated).catch(() => {});
        return { data: cachedData, stale: true };
    }

    // Se não temos cache, buscar da rede bloqueando
    try {
        const data = await loadPointData(pointId, token, signal);
        
        // Guardar na cache com gestão de espaço
        try {
            const cacheData = { timestamp: now, data };
            await AsyncStorage.setItem(key, JSON.stringify(cacheData));
            // Registrar no índice para gestão de espaço em disco
            await registerCacheItem(pointId, cacheData);
        } catch (e) {
            console.warn("Failed to save cache:", e);
        }

        return { data, stale: false };
    } catch (networkError) {
        // Se a rede falhar e tivermos cache expirada (ou ignorada pelo try acima), tentamos recuperar do AsyncStorage
        try {
            const rawCache = await AsyncStorage.getItem(key);
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                if (parsed?.data) return { data: parsed.data, stale: true, offline: true };
            }
        } catch (_e) {}

        throw networkError;
    }
}

async function revalidateInBg(pointId, key, token, onRevalidated) {
    try {
        const data = await loadPointData(pointId, token);
        const cacheData = { timestamp: Date.now(), data };
        await AsyncStorage.setItem(key, JSON.stringify(cacheData));
        // Registrar no índice de cache
        await registerCacheItem(pointId, cacheData).catch(() => {});
        
        if (typeof onRevalidated === 'function') {
            onRevalidated(data);
        }
    } catch (e) {
        console.warn("Background revalidation failed:", e);
    }
}

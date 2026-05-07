import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPointMobileData } from "../../../lib/360api";

const CACHE_PREFIX = "@g360:hotspots:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(pointId) {
    return `${CACHE_PREFIX}${pointId}`;
}

export async function fetchWithCache(pointId, signal) {
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
    } catch (err) {
        // Ignorar falhas de leitura
    }

    // 2. Tentar buscar da rede (stale-while-revalidate)
    // Se temos cache, retornamos imediatamente mas lançamos a revalidação em background (sem await)
    if (cachedData) {
        revalidateInBg(pointId, key).catch(() => {});
        return { data: cachedData, stale: true };
    }

    // Se não temos cache, buscar da rede bloqueando
    try {
        const data = await getPointMobileData(pointId, { includeAll: true }, signal);
        
        // Guardar na cache
        try {
            await AsyncStorage.setItem(key, JSON.stringify({ timestamp: now, data }));
        } catch (e) {}

        return { data, stale: false };
    } catch (networkError) {
        // Se a rede falhar e tivermos cache expirada (ou ignorada pelo try acima), tentamos recuperar do AsyncStorage
        try {
            const rawCache = await AsyncStorage.getItem(key);
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                if (parsed?.data) return { data: parsed.data, stale: true, offline: true };
            }
        } catch (e) {}

        throw networkError;
    }
}

async function revalidateInBg(pointId, key) {
    const data = await getPointMobileData(pointId, { includeAll: true });
    await AsyncStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
}

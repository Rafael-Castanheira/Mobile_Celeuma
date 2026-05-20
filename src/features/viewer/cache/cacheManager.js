import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@g360:hotspots:";
const CACHE_INDEX_KEY = "@g360:cache-index";
const MAX_CACHE_SIZE_MB = 50; // Limite máximo de cache em MB
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Calcula o tamanho de uma string em bytes
 */
function getStringSize(str) {
  return new Blob([str]).size;
}

/**
 * Obtém o índice de cache atual do AsyncStorage
 */
async function getCacheIndex() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
}

/**
 * Guarda o índice de cache no AsyncStorage
 */
async function saveCacheIndex(index) {
  try {
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn("Failed to save cache index:", e);
  }
}

/**
 * Registra um novo item no cache e atualiza índice
 * Retorna true se o item foi guardado com sucesso
 */
export async function registerCacheItem(pointId, data) {
  try {
    const index = await getCacheIndex();
    const now = Date.now();
    const dataSize = getStringSize(JSON.stringify(data));

    // Se o item já existe, remover do índice para recalcular
    delete index[pointId];

    // Calcular tamanho total atual
    let totalSize = Object.values(index).reduce((sum, item) => sum + item.size, 0);
    
    // Se adicionar este item excede o limite, fazer limpeza
    if (totalSize + dataSize > MAX_CACHE_SIZE_BYTES) {
      await cleanCacheIfNeeded(index, totalSize + dataSize);
      // Re-obter índice após limpeza
      const freshIndex = await getCacheIndex();
      index.clear?.();
      Object.assign(index, freshIndex);
    }

    // Registrar item no índice
    index[pointId] = {
      timestamp: now,
      size: dataSize,
      accessedAt: now,
    };

    await saveCacheIndex(index);
    return true;
  } catch (e) {
    console.warn("Failed to register cache item:", e);
    return false;
  }
}

/**
 * Atualiza timestamp de acesso para ordenação LRU
 */
export async function updateCacheAccessTime(pointId) {
  try {
    const index = await getCacheIndex();
    if (index[pointId]) {
      index[pointId].accessedAt = Date.now();
      await saveCacheIndex(index);
    }
  } catch (e) {
    console.warn("Failed to update cache access time:", e);
  }
}

/**
 * Limpeza de cache: remove items expirados e antigos se necessário
 */
async function cleanCacheIfNeeded(index, targetSize) {
  const now = Date.now();
  const itemsToDelete = [];

  // 1. Primeira passa: remover tudo expirado
  for (const [pointId, meta] of Object.entries(index)) {
    if (now - meta.timestamp > CACHE_TTL_MS) {
      itemsToDelete.push({ pointId, reason: "expired" });
    }
  }

  // 2. Se ainda acima do limite, remover por LRU
  let currentSize = Object.entries(index)
    .filter(([id]) => !itemsToDelete.find(d => d.pointId === id))
    .reduce((sum, [, meta]) => sum + meta.size, 0);

  if (currentSize > MAX_CACHE_SIZE_BYTES) {
    // Ordenar por acesso mais antigo
    const sortedByAccess = Object.entries(index)
      .filter(([id]) => !itemsToDelete.find(d => d.pointId === id))
      .sort((a, b) => (a[1].accessedAt || a[1].timestamp) - (b[1].accessedAt || b[1].timestamp));

    for (const [pointId, meta] of sortedByAccess) {
      itemsToDelete.push({ pointId, reason: "lru" });
      currentSize -= meta.size;
      if (currentSize <= MAX_CACHE_SIZE_BYTES * 0.8) break; // Manter em 80% do limite
    }
  }

  // 3. Executar remoções
  for (const { pointId } of itemsToDelete) {
    const key = `${CACHE_PREFIX}${pointId}`;
    await AsyncStorage.removeItem(key).catch(() => {});
    delete index[pointId];
  }

  await saveCacheIndex(index);
  console.log(`Cache cleanup: removed ${itemsToDelete.length} items (${itemsToDelete.map(d => d.reason).join(", ")})`);
}

/**
 * Realiza limpeza completa: remove todos os items expirados e verifica espaço
 */
async function performCacheCleanup() {
  try {
    const index = await getCacheIndex();
    const now = Date.now();
    const initialCount = Object.keys(index).length;
    const itemsToDelete = [];

    // Remover expirados
    for (const [pointId, meta] of Object.entries(index)) {
      if (now - meta.timestamp > CACHE_TTL_MS) {
        itemsToDelete.push(pointId);
        const key = `${CACHE_PREFIX}${pointId}`;
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }

    itemsToDelete.forEach(id => delete index[id]);
    await saveCacheIndex(index);

    const stats = {
      itemsRemoved: itemsToDelete.length,
      itemsRemaining: Object.keys(index).length,
      totalSizeBytes: Object.values(index).reduce((sum, item) => sum + item.size, 0),
    };

    console.log(`Cache cleanup complete: removed ${stats.itemsRemoved} of ${initialCount} items`);
    return stats;
  } catch (e) {
    console.error("Cache cleanup failed:", e);
    return { error: e.message };
  }
}

/**
 * Obtém estatísticas de cache
 */
async function getCacheStats() {
  try {
    const index = await getCacheIndex();
    const now = Date.now();
    const items = Object.entries(index).map(([pointId, meta]) => ({
      pointId,
      sizeKB: (meta.size / 1024).toFixed(2),
      ageHours: ((now - meta.timestamp) / (1000 * 60 * 60)).toFixed(1),
      isExpired: now - meta.timestamp > CACHE_TTL_MS,
    }));

    const totalSize = Object.values(index).reduce((sum, item) => sum + item.size, 0);

    return {
      itemCount: items.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: MAX_CACHE_SIZE_MB,
      usagePercent: ((totalSize / MAX_CACHE_SIZE_BYTES) * 100).toFixed(1),
      items,
    };
  } catch (e) {
    console.error("Failed to get cache stats:", e);
    return null;
  }
}

/**
 * Limpa completamente o cache (para debug/reset)
 */
async function clearAllCache() {
  try {
    const index = await getCacheIndex();
    for (const pointId of Object.keys(index)) {
      const key = `${CACHE_PREFIX}${pointId}`;
      await AsyncStorage.removeItem(key).catch(() => {});
    }
    await AsyncStorage.removeItem(CACHE_INDEX_KEY);
    console.log("All cache cleared");
  } catch (e) {
    console.error("Failed to clear cache:", e);
  }
}

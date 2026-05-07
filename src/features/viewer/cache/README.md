# Cache Manager - Visualizador 360º

Este módulo gerencia o cache de dados de panoramas 360º com otimização de espaço em disco e estratégia de limpeza automática.

## Características

✅ **TTL (Time-To-Live)**: Cache expira após 24 horas
✅ **Limite de Espaço**: Máximo de 50MB (configurável)
✅ **LRU (Least Recently Used)**: Remove items menos usados quando atinge limite
✅ **Acesso Offline**: Recupera cache expirada se não houver conexão
✅ **Índice de Metadados**: Rastreia tamanho, timestamps e frequência de acesso
✅ **Limpeza Automática**: Remove items expirados durante operações

## Arquivos

### `cacheManager.js`
Gerenciador central de cache com controle de espaço em disco.

**Funções:**
- `registerCacheItem(pointId, data)` - Registra item e verifica limite de espaço
- `updateCacheAccessTime(pointId)` - Atualiza timestamp de acesso para LRU
- `performCacheCleanup()` - Limpeza manual de items expirados
- `getCacheStats()` - Estatísticas de cache (tamanho, items, uso %)
- `clearAllCache()` - Limpa completamente o cache

### `hotspotCache.js`
Cache integrada com stale-while-revalidate strategy.

**Funções:**
- `fetchWithCache(pointId, token, signal)` - Busca com cache automática

### Hook `useCacheManager.js`
Hook React para usar o cache manager em componentes.

```javascript
import { useCacheManager } from "../hooks/useCacheManager";

export function MyComponent() {
  const { stats, isLoading, cleanup, clearAll } = useCacheManager();

  return (
    <View>
      <Text>Cache Size: {stats?.totalSizeMB}MB / {stats?.maxSizeMB}MB</Text>
      <Text>Items: {stats?.itemCount}</Text>
      <Text>Usage: {stats?.usagePercent}%</Text>
      
      <Button onPress={cleanup} title="Limpar Expirados" />
      <Button onPress={clearAll} title="Limpar Tudo" disabled={isLoading} />
    </View>
  );
}
```

## Como Funciona

### Fluxo de Leitura
```
1. Verificar AsyncStorage com chave: @g360:hotspots:{pointId}
2. Se cache válida (não expirada):
   - Atualizar tempo de acesso (LRU)
   - Retornar dados imediatamente
   - Revalidar em background
3. Se cache expirada ou não existe:
   - Buscar da rede
   - Guardar em AsyncStorage
   - Registrar no índice de cache
```

### Gestão de Espaço
```
MaxSize = 50MB

1. Ao registrar novo item:
   - Se totalSize + itemSize > 50MB:
     a. Remover todos items expirados
     b. Se ainda > 50MB: remover por LRU até 80% do limite
   
2. Limpeza manual (performCacheCleanup):
   - Remove todos items com TTL expirado
```

### Estratégia LRU (Least Recently Used)
Items são ordenados por `accessedAt` (última leitura) e removidos do mais antigo para o mais novo até atingir ~40MB.

## Configuração

Editar em `cacheManager.js`:
```javascript
const MAX_CACHE_SIZE_MB = 50;        // Limite total
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
```

## Logs

Cache Manager loga automaticamente operações:
```
Cache cleanup: removed 3 items (expired, lru, lru)
Cache cleanup complete: removed 5 of 12 items
```

## Troubleshooting

### Cache crescendo demais
→ Executar `performCacheCleanup()` regularmente
→ Diminuir `MAX_CACHE_SIZE_MB`

### Items não sendo removidos
→ TTL pode estar muito alto
→ Executar `clearAllCache()` para reset completo

### AsyncStorage errors
→ Verificar espaço disponível no dispositivo
→ Limpar outras apps
→ Usar `clearAllCache()` como último recurso

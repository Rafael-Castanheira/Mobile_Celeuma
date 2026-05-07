/**
 * Resolve o modo de navegação a partir do payload de hotspot devolvido pelo backend.
 * 
 * O backend mobileController.js já converte internamente hotspots do tipo "link" (antigos)
 * em tipo "navegacao" e define o `navigation_mode` apropriado.
 * 
 * @param {Object} hotspot O hotspot a analisar
 * @returns {'point' | 'file' | 'back' | null}
 */
export function resolveNavigationMode(hotspot) {
    if (!hotspot || hotspot.tipo !== 'navegacao') {
        return null;
    }
    
    // O backend já expõe o modo corretamente.
    if (['point', 'file', 'back'].includes(hotspot.navigation_mode)) {
        return hotspot.navigation_mode;
    }

    return null;
}

/**
 * Constrói o payload de navegação para despachar ao ViewerContext.
 * 
 * @param {Object} hotspot O hotspot a analisar
 * @returns {Object} Payload de navegação
 */
export function buildNavigationPayload(hotspot) {
    const mode = resolveNavigationMode(hotspot);
    
    if (mode === 'point') {
        return { mode, pointId: hotspot.id_ponto_destino };
    }
    
    if (mode === 'file') {
        // file_url tem a imagem completa, file_path o path relativo
        // Usaremos o URL quando tivermos que mostrar, mas podemos guardar ambos
        return { mode, fileUrl: hotspot.navigation_file_url, filePath: hotspot.navigation_file_path };
    }
    
    if (mode === 'back') {
        return { mode };
    }

    return { mode: null };
}

/**
 * Selector de visibilidade de hotspots puro e testável.
 * 
 * Regras:
 * - Se hotspot.view_path === currentViewPath -> visível
 * - Se hotspot.view_path é vazio/null -> visível apenas se currentViewPath === initialViewPath
 * - Caso contrário -> oculto
 * 
 * @param {Array} allHotspots Lista de todos os hotspots do ponto
 * @param {string|null} currentViewPath A vista atual onde o utilizador se encontra
 * @param {string|null} initialViewPath A vista inicial (root) do ponto
 * @returns {Array} Lista de hotspots visíveis
 */
export function selectVisibleHotspots(allHotspots, currentViewPath, initialViewPath) {
    if (!Array.isArray(allHotspots)) return [];

    const normalizedCurrent = String(currentViewPath || '').trim();
    const normalizedInitial = String(initialViewPath || '').trim();

    return allHotspots.filter(hotspot => {
        const hotspotView = String(hotspot.view_path || '').trim();

        if (!hotspotView) {
            // Hotspot global (sem vista definida). Visível apenas na vista inicial.
            return !normalizedCurrent || normalizedCurrent === normalizedInitial;
        }

        if (!normalizedCurrent) {
            // Se currentViewPath não está definido, estamos na raiz (vista inicial).
            // O hotspot só deve aparecer se a sua vista for igual à vista inicial.
            return hotspotView === normalizedInitial;
        }

        // Hotspot com vista definida. Tem de coincidir exatamente com a vista atual.
        return hotspotView === normalizedCurrent;
    });
}

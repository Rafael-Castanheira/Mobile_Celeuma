import { useEffect, useRef } from 'react';
import { useViewer } from '../../../context/ViewerContext';

/**
 * Bridge entre o estado do React Native (ViewerContext) e o WebView (A-Frame).
 * Reage a mudanças nos hotspots visíveis e injeta o JSON para o window do webview.
 */
export default function HotspotRenderer({ webViewRef, isWebViewReady }) {
    const { visibleHotspots } = useViewer();
    const lastInjectedStr = useRef('');

    // Quando o WebView fica pronto (ou re-fica pronto após navegação),
    // limpar a cache de dedup para forçar re-injeção dos hotspots.
    useEffect(() => {
        if (isWebViewReady) {
            lastInjectedStr.current = '';
        }
    }, [isWebViewReady]);

    useEffect(() => {
        if (!webViewRef.current || !isWebViewReady) return;

        // Converter para string JSON
        const jsonStr = JSON.stringify(visibleHotspots || []);
        
        // Evitar injeções desnecessárias se o payload não mudou
        if (jsonStr === lastInjectedStr.current) return;
        lastInjectedStr.current = jsonStr;

        const jsCode = `
            if (typeof window.updateHotspots === 'function') {
                window.updateHotspots(${jsonStr});
            }
            true;
        `;
        
        webViewRef.current.injectJavaScript(jsCode);

    }, [visibleHotspots, webViewRef, isWebViewReady]);

    // O renderer em si não tem UI no Native, apenas side-effects
    return null;
}

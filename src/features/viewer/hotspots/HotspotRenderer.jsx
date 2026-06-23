import { useEffect, useRef } from 'react';
import { useViewer } from '../../../context/ViewerContext';

/**
 * Bridge entre o estado do React Native (ViewerContext) e o WebView (A-Frame).
 * Reage a mudanças nos hotspots visíveis e injeta o JSON para o window do webview.
 */
export default function HotspotRenderer({ webViewRef, webViewReadyCount }) {
    const { visibleHotspots } = useViewer();
    const lastInjectedStr = useRef('');

    // Sempre que o WebView dispara 'ready' (webViewReadyCount aumenta), 
    // ou quando os visibleHotspots mudam, reavaliamos a injeção.
    useEffect(() => {
        if (!webViewRef.current || webViewReadyCount === 0) return;

        // Converter para string JSON
        const jsonStr = JSON.stringify(visibleHotspots || []);
        
        // Evitar injeções desnecessárias apenas se o conteúdo for igual
        // e se não for um "reload" da WebView (controlado pelo useEffect)
        if (jsonStr === lastInjectedStr.current) return;
        lastInjectedStr.current = jsonStr;

        const jsCode = `
            if (typeof window.updateHotspots === 'function') {
                window.updateHotspots(${jsonStr});
            }
            true;
        `;
        
        webViewRef.current.injectJavaScript(jsCode);

    }, [visibleHotspots, webViewRef, webViewReadyCount]);

    // Limpar cache local de injeção sempre que o WebView indica que fez reload
    useEffect(() => {
        if (webViewReadyCount > 0) {
            lastInjectedStr.current = '';
            
            // Força reinjeção imediata após reload
            const jsonStr = JSON.stringify(visibleHotspots || []);
            lastInjectedStr.current = jsonStr;
            const jsCode = `
                if (typeof window.updateHotspots === 'function') {
                    window.updateHotspots(${jsonStr});
                }
                true;
            `;
            webViewRef.current?.injectJavaScript(jsCode);
        }
    }, [webViewReadyCount]);

    return null;
}

import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useViewer } from '../../context/ViewerContext';
import { BASE_URL } from '../../lib/api/client';
import HotspotRenderer from '../viewer/hotspots/HotspotRenderer';
import { buildViewerHtml } from '../viewer/viewerHtml';

// Resolve relative paths to absolute URLs
function resolveMediaUrl(pathOrUrl) {
	if (!pathOrUrl) return "";
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	if (pathOrUrl.startsWith("data:")) return pathOrUrl;
    const normalizedPath = pathOrUrl.replace(/^\/+/, "");
    const uploadPath = normalizedPath.startsWith("uploads/")
        ? normalizedPath
        : `uploads/${normalizedPath}`;
    return `${BASE_URL.replace(/\/+$/, "")}/${uploadPath}`;
}

export default function PointViewerModal({ isVisible, onClose, top, colors, showError }) {
    const { 
        loading, 
        error, 
        currentViewPath, 
        initialViewPath,
        currentAlignment,
        pointMetadata,
        navigateBack,
        navigateToPoint,
        navigateToFile
    } = useViewer();

    const [isWebViewReady, setIsWebViewReady] = useState(false);
    const [hasShownError, setHasShownError] = useState(false);
    const webViewRef = React.useRef(null);

    // Quando o modal fecha ou muda de ponto, fazemos reset
    useEffect(() => {
        if (!isVisible) {
            setIsWebViewReady(false);
            setHasShownError(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (error && !hasShownError) {
            setHasShownError(true);
            showError(error, "Erro no Visualizador 360");
        }
    }, [error, hasShownError, showError]);

    // O URL da imagem da vista atual
    // - Vista inicial: preferir `image_url` devolvido pelo backend (absoluto)
    // - Outras vistas: resolver `currentViewPath` para URL absoluto
    const normalizedCurrentViewPath = String(currentViewPath || "").trim();
    const normalizedInitialViewPath = String(initialViewPath || "").trim();
    const isInitialView =
        !normalizedCurrentViewPath || normalizedCurrentViewPath === normalizedInitialViewPath;

    const sourceUrl = isInitialView
        ? (
              pointMetadata?.image_url ||
              pointMetadata?.imageUrl ||
              resolveMediaUrl(normalizedInitialViewPath) ||
              resolveMediaUrl(normalizedCurrentViewPath) ||
              ""
          )
        : resolveMediaUrl(normalizedCurrentViewPath) || "";
    
    // Gera o HTML do A-Frame
    const pointViewerHtml = React.useMemo(() => {
        if (!sourceUrl) return "";
        return buildViewerHtml(
            sourceUrl,
            pointMetadata?.name || "A carregar...",
            pointMetadata?.description || "",
            {
                background: colors.background,
                foreground: colors.foreground,
                border: colors.border,
                overlay: colors.overlay,
                mutedForeground: colors.mutedForeground,
                card: colors.card,
                primary: colors.primary
            },
            {
                baseUrl: BASE_URL,
                dome: currentAlignment || undefined,
            }
        );
    }, [sourceUrl, pointMetadata, colors, currentAlignment]);

    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {sourceUrl ? (
                    <WebView
                        ref={webViewRef}
                        style={{ flex: 1, backgroundColor: colors.background }}
                        source={{ html: pointViewerHtml }}
                        originWhitelist={["*"]}
                        javaScriptEnabled
                        domStorageEnabled
                        mixedContentMode="always"
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback={true}
                        onLoadEnd={() => {
                            // Carregou o html
                        }}
                        onError={() => {
                            if (hasShownError) return;
                            setHasShownError(true);
                            showError("Não foi possível carregar a visão 360 deste ponto.", "Erro no visualizador 360");
                        }}
                        onHttpError={() => {
                            if (hasShownError) return;
                            setHasShownError(true);
                            showError("Falha de rede ao abrir a visão 360.", "Erro no visualizador 360");
                        }}
                        onMessage={(event) => {
                            try {
                                const payload = JSON.parse(event.nativeEvent.data);

                                // Always log incoming payloads for debugging
                                try { console.log('WebView -> RN payload:', payload); } catch (_) {}

                                if (payload.status === 'ready') {
                                    setIsWebViewReady(true);
                                    return;
                                }

                                if (payload.action === 'navigatePoint') {
                                    navigateToPoint(payload.pointId);
                                } else if (payload.action === 'navigateFile') {
                                    navigateToFile(payload.fileUrl, payload.filePath);
                                } else if (payload.action === 'navigateBack') {
                                    navigateBack();
                                } else if (payload.action === 'openLink') {
                                    Linking.openURL(payload.url).catch(() => {
                                        showError("Não foi possível abrir o link.");
                                    });
                                } else if (payload.point360Error) {
                                    // Detailed error forwarded from the WebView
                                    try { console.error('Viewer 360 error payload:', payload.error || payload); } catch (_) {}
                                    if (hasShownError) return;
                                    setHasShownError(true);
                                    const msg = (payload.error && payload.error.message) || payload.message || 'Não foi possível abrir esta imagem no visualizador 360.';
                                    showError(msg, "Erro no visualizador 360");
                                }
                            } catch (e) {
                                try { console.error('Failed to parse WebView message', e); } catch (_) {}
                            }
                        }}
                    />
                ) : null}

                {/* Bridge para injetar hotspots */}
                <HotspotRenderer 
                    webViewRef={webViewRef} 
                    isWebViewReady={isWebViewReady} 
                />

                {/* Botão Voltar/Fechar */}
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        top: top + 8,
                        left: 12,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.overlay,
                        borderColor: colors.border,
                        borderWidth: 1,
                    }}
                    onPress={onClose}
                    activeOpacity={0.8}
                >
                    <Feather name="x" size={18} color={colors.foreground} />
                </TouchableOpacity>

                {loading && (
                    <View
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            inset: 0,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(0,0,0,0.22)",
                        }}
                    >
                        <ActivityIndicator size="large" color={colors.primaryForeground} />
                    </View>
                )}
            </View>
        </Modal>
    );
}

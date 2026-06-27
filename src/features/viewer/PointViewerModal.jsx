import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useViewer } from '../../context/ViewerContext';
import { BASE_URL } from '../../lib/api/client';


// Resolve relative paths to absolute URLs
function resolveMediaUrl(pathOrUrl) {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (pathOrUrl.startsWith('data:')) return pathOrUrl;
    const normalizedPath = pathOrUrl.replace(/^\/+/, '');
    const uploadPath = normalizedPath.startsWith('uploads/')
        ? normalizedPath
        : `uploads/${normalizedPath}`;
    return `${BASE_URL.replace(/\/+$/, '')}/${uploadPath}`;
}

const SHEET_HEIGHT = 400;

export default function PointViewerModal({ isVisible, onClose, top, colors, showError }) {
    const {
        loading,
        error,
        currentViewPath,
        initialViewPath,
        currentAlignment,
        pointMetadata,
        navigationHistory,
        navigateBack,
        navigateToPoint,
        navigateToFile,
    } = useViewer();

    const { bottom: safeBottom } = useSafeAreaInsets();

    const [webViewReadyCount, setWebViewReadyCount] = useState(0);
    const [hasShownError, setHasShownError] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    const webViewRef = useRef(null);
    const sheetAnim = useRef(new Animated.Value(0)).current;

    // Animate bottom sheet in/out
    useEffect(() => {
        Animated.spring(sheetAnim, {
            toValue: showInfo ? 1 : 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 160,
        }).start();
    }, [showInfo, sheetAnim]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isVisible) {
            setWebViewReadyCount(0);
            setHasShownError(false);
            setShowInfo(false);
        }
    }, [isVisible]);

    // Show errors from context
    useEffect(() => {
        if (error && !hasShownError) {
            setHasShownError(true);
            showError(error, 'Erro no Visualizador 360');
        }
    }, [error, hasShownError, showError]);

    // Use the Web App URL instead of generating HTML
    const webAppUrl = pointMetadata?.id_ponto || pointMetadata?.id
        ? `https://galerias360-frontend.onrender.com/view/p/${pointMetadata.id_ponto || pointMetadata.id}`
        : null;

    // Inject CSS to adapt the Web App UI for Mobile (Hide top-left, push top-right below notch, snap bottom panel)
    const hideWebUI = `
      (function() {
        var style = document.createElement('style');
        style.innerHTML = \`
          /* Esconder botão de voltar da Web */
          div.absolute.top-4.left-4 { display: none !important; }
          
          /* Painel de Hotspots (escondido por defeito, menor e por baixo do botão) */
          div[class*="z-20"][class*="w-[220px]"] { 
            position: absolute !important;
            top: 105px !important; 
            bottom: auto !important; 
            right: 12px !important; 
            width: 180px !important;
            transform-origin: top right !important;
            transform: scale(0.9) !important;
            opacity: 0 !important;
            pointer-events: none !important;
            transition: opacity 0.2s ease !important;
          }
          
          body.show-hotspots-tab div[class*="z-20"][class*="w-[220px]"] {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          
          /* Ancorar painel Customizável ao fundo do ecrã */
          div.fixed.bottom-4.left-1\\\\/2 { 
            bottom: 0 !important; 
            width: 100vw !important; 
            max-width: 100vw !important; 
            padding-bottom: 34px !important; 
            border-bottom-left-radius: 0 !important; 
            border-bottom-right-radius: 0 !important; 
          }
        \`;
        document.head.appendChild(style);

        /* ── Kill gyroscope / device orientation ── */
        function killGyro() {
          // 1) Block future deviceorientation events
          window.addEventListener('deviceorientation', function(e) {
            e.stopImmediatePropagation();
          }, true);
          window.addEventListener('devicemotion', function(e) {
            e.stopImmediatePropagation();
          }, true);
          window.addEventListener('deviceorientationabsolute', function(e) {
            e.stopImmediatePropagation();
          }, true);

          // 2) Stub THREE.DeviceOrientationControls
          var noopFn = function(){};
          var DummyDOC = function(){ this.enabled = false; };
          DummyDOC.prototype.connect = noopFn;
          DummyDOC.prototype.disconnect = noopFn;
          DummyDOC.prototype.update = noopFn;
          DummyDOC.prototype.dispose = noopFn;
          if (window.THREE) window.THREE.DeviceOrientationControls = DummyDOC;
          if (window.AFRAME && AFRAME.THREE) AFRAME.THREE.DeviceOrientationControls = DummyDOC;

          // 3) Disconnect any already-created magicWindowControls on the camera
          var scene = document.querySelector('a-scene');
          if (scene) {
            var cam = scene.querySelector('[look-controls]') || scene.querySelector('a-camera') || scene.camera && scene.camera.el;
            if (cam && cam.components && cam.components['look-controls']) {
              var lc = cam.components['look-controls'];
              if (lc.magicWindowControls) {
                lc.magicWindowControls.disconnect && lc.magicWindowControls.disconnect();
                lc.magicWindowControls.enabled = false;
                lc.magicWindowControls = null;
              }
            }
          }
        }

        // Run immediately and also after scene loads (in case A-Frame isn't ready yet)
        killGyro();
        if (document.querySelector('a-scene')) {
          var scEl = document.querySelector('a-scene');
          if (scEl.hasLoaded) { killGyro(); }
          else { scEl.addEventListener('loaded', killGyro); }
        }
        // Also retry after a short delay as fallback
        setTimeout(killGyro, 1000);
        setTimeout(killGyro, 3000);
      })();
      true;
    `;

    const hasHistory = navigationHistory.length > 0;
    const categories = Array.isArray(pointMetadata?.categorias) ? pointMetadata.categorias : [];
    const visualizacoes = pointMetadata?.visualizacoes || 0;

    // Animated values derived from sheetAnim
    const translateY = sheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SHEET_HEIGHT, 0],
        extrapolate: 'clamp',
    });
    const backdropOpacity = sheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.55],
        extrapolate: 'clamp',
    });

    const handleWebViewMessage = (event) => {
        try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload.status === 'ready') {
                setWebViewReadyCount(c => c + 1);
                return;
            }

            if (payload.action === 'openLink') {
                Linking.openURL(payload.url).catch(() => {
                    showError('Não foi possível abrir o link.');
                });
            }
        } catch (_e) {}
    };

    const handleBack = () => {
        if (showInfo) {
            setShowInfo(false);
        } else {
            onClose();
        }
    };

    if (!isVisible) return null;

    const btnStyle = (active = false) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: active ? colors.primary : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    });

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={handleBack}
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>

                {/* ── WebView ── */}
                {webAppUrl ? (
                    <WebView
                        ref={webViewRef}
                        style={{ flex: 1, backgroundColor: colors.background }}
                        source={{ uri: webAppUrl }}
                        injectedJavaScript={hideWebUI}
                        originWhitelist={['*']}
                        javaScriptEnabled
                        domStorageEnabled
                        mixedContentMode="always"
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback
                        bounces={false}
                        scrollEnabled={false}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentInsetAdjustmentBehavior="never"
                        automaticallyAdjustContentInsets={false}
                        onError={() => {
                            if (hasShownError) return;
                            setHasShownError(true);
                            showError(
                                'Não foi possível carregar a visão 360 deste ponto.',
                                'Erro no visualizador 360'
                            );
                        }}
                        onHttpError={() => {
                            if (hasShownError) return;
                            setHasShownError(true);
                            showError(
                                'Falha de rede ao abrir a visão 360.',
                                'Erro no visualizador 360'
                            );
                        }}
                        onMessage={handleWebViewMessage}
                    />
                ) : null}

                {/* ── TOP-LEFT CONTROLS (back / close / info) ── */}
                <View
                    style={{
                        position: 'absolute',
                        top: top + 8,
                        left: 12,
                        alignItems: 'center',
                        gap: 8,
                    }}
                >


                    <TouchableOpacity
                        style={btnStyle()}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Feather name="x" size={18} color={colors.foreground} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={btnStyle(showInfo)}
                        onPress={() => setShowInfo((p) => !p)}
                        activeOpacity={0.8}
                    >
                        <Feather
                            name="info"
                            size={18}
                            color={showInfo ? colors.primaryForeground : colors.foreground}
                        />
                    </TouchableOpacity>
                </View>

                {/* ── TOP-RIGHT CONTROLS (VR) ── */}
                <View
                    style={{
                        position: 'absolute',
                        top: top + 8,
                        right: 12,
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <TouchableOpacity
                        style={btnStyle()}
                        onPress={() => {
                            if (webViewRef.current) {
                                webViewRef.current.injectJavaScript(`
                                    document.body.classList.toggle('show-hotspots-tab');
                                    true;
                                `);
                            }
                        }}
                        activeOpacity={0.8}
                    >
                        <Feather name="list" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                {/* ── POINT NAME PILL ── */}
                {!!pointMetadata?.name && (
                    <View
                        style={{
                            position: 'absolute',
                            top: top + 8,
                            left: 64,
                            right: 12,
                        }}
                        pointerEvents="none"
                    >
                        <View
                            style={{
                                alignSelf: 'flex-start',
                                maxWidth: '100%',
                                backgroundColor: colors.overlay,
                                borderColor: colors.border,
                                borderWidth: 1,
                                borderRadius: 20,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                            }}
                        >
                            <Text
                                style={{
                                    color: colors.foreground,
                                    fontSize: 13,
                                    fontWeight: '600',
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {pointMetadata.name}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── LOADING OVERLAY ── */}
                {loading && (
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0,0,0,0.40)',
                        }}
                    >
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ color: colors.foreground, marginTop: 10, fontSize: 13 }}>
                            A carregar panorama...
                        </Text>
                    </View>
                )}

                {/* ── BACKDROP ── */}
                <Animated.View
                    pointerEvents={showInfo ? 'box-none' : 'none'}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: '#000',
                        opacity: backdropOpacity,
                    }}
                >
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setShowInfo(false)}
                    />
                </Animated.View>

                {/* ── BOTTOM SHEET ── */}
                <Animated.View
                    pointerEvents={showInfo ? 'auto' : 'none'}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        maxHeight: SHEET_HEIGHT,
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 22,
                        borderTopRightRadius: 22,
                        borderTopWidth: 1,
                        borderColor: colors.border,
                        transform: [{ translateY }],
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -6 },
                        shadowOpacity: 0.25,
                        shadowRadius: 16,
                        elevation: 24,
                    }}
                >
                    {/* Drag handle */}
                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                        <View
                            style={{
                                width: 38,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: colors.border,
                            }}
                        />
                    </View>

                    {/* Sheet header */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: 12,
                            borderBottomWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        {!!(pointMetadata?.image_url || pointMetadata?.imageUrl) && (
                            <Image 
                                source={{ uri: pointMetadata?.image_url || pointMetadata?.imageUrl }} 
                                style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12, backgroundColor: colors.overlay }}
                            />
                        )}
                        <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
                            <Text
                                style={{
                                    color: colors.foreground,
                                    fontSize: 17,
                                    fontWeight: '700',
                                    lineHeight: 22,
                                }}
                            >
                                {pointMetadata?.name || 'Ponto'}
                            </Text>

                            {categories.length > 0 && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        marginTop: 6,
                                        gap: 4,
                                    }}
                                >
                                    {categories.map((cat, i) => (
                                        <View
                                            key={cat.id ?? cat.name ?? i}
                                            style={{
                                                backgroundColor: colors.primary + '28',
                                                borderRadius: 12,
                                                paddingHorizontal: 9,
                                                paddingVertical: 3,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: colors.primary,
                                                    fontSize: 11,
                                                    fontWeight: '600',
                                                }}
                                            >
                                                {cat.name}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowInfo(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="x" size={18} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    </View>

                    {/* Sheet scrollable content */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            padding: 16,
                            paddingBottom: Math.max(safeBottom, 12),
                            gap: 14,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Description */}
                        {!!pointMetadata?.description && (
                            <View>
                                <Text
                                    style={{
                                        color: colors.mutedForeground,
                                        fontSize: 11,
                                        fontWeight: '600',
                                        letterSpacing: 0.6,
                                        textTransform: 'uppercase',
                                        marginBottom: 4,
                                    }}
                                >
                                    Descrição
                                </Text>
                                <Text
                                    style={{
                                        color: colors.foreground,
                                        fontSize: 14,
                                        lineHeight: 21,
                                    }}
                                >
                                    {pointMetadata.description}
                                </Text>
                            </View>
                        )}

                        {/* Coordinates */}
                        {!!(pointMetadata?.latitude && pointMetadata?.longitude) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="map-pin" size={14} color={colors.primary} />
                                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                                    {Number(pointMetadata.latitude).toFixed(6)},{' '}
                                    {Number(pointMetadata.longitude).toFixed(6)}
                                </Text>
                            </View>
                        )}

                        {/* Views count */}
                        {visualizacoes > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="eye" size={14} color={colors.primary} />
                                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                                    {visualizacoes} visualização{visualizacoes !== 1 ? 'ões' : ''}
                                </Text>
                            </View>
                        )}


                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

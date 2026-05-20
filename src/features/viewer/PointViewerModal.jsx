import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
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
import HotspotRenderer from '../viewer/hotspots/HotspotRenderer';
import { buildViewerHtml } from '../viewer/viewerHtml';

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

    const [isWebViewReady, setIsWebViewReady] = useState(false);
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
            setIsWebViewReady(false);
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

    // Resolve source URL for current view
    const normalizedCurrentViewPath = String(currentViewPath || '').trim();
    const normalizedInitialViewPath = String(initialViewPath || '').trim();
    const isInitialView =
        !normalizedCurrentViewPath || normalizedCurrentViewPath === normalizedInitialViewPath;

    const sourceUrl = isInitialView
        ? (pointMetadata?.image_url ||
           pointMetadata?.imageUrl ||
           resolveMediaUrl(normalizedInitialViewPath) ||
           resolveMediaUrl(normalizedCurrentViewPath) ||
           '')
        : resolveMediaUrl(normalizedCurrentViewPath) || '';

    // Build A-Frame HTML
    const pointViewerHtml = React.useMemo(() => {
        if (!sourceUrl) return '';
        return buildViewerHtml(
            sourceUrl,
            pointMetadata?.name || 'A carregar...',
            pointMetadata?.description || '',
            {
                background: colors.background,
                foreground: colors.foreground,
                border: colors.border,
                overlay: colors.overlay,
                mutedForeground: colors.mutedForeground,
                card: colors.card,
                primary: colors.primary,
            },
            {
                baseUrl: BASE_URL,
                dome: currentAlignment || undefined,
            }
        );
    }, [sourceUrl, pointMetadata, colors, currentAlignment]);

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
                    showError('Não foi possível abrir o link.');
                });
            } else if (payload.point360Error) {
                if (hasShownError) return;
                setHasShownError(true);
                const msg =
                    (payload.error && payload.error.message) ||
                    payload.message ||
                    'Não foi possível abrir esta imagem no visualizador 360.';
                showError(msg, 'Erro no visualizador 360');
            }
        } catch (_e) {}
    };

    if (!isVisible) return null;

    const btnStyle = (active = false) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.primary : colors.overlay,
        borderColor: active ? colors.primary : colors.border,
        borderWidth: 1,
    });

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={() => {
                if (showInfo) {
                    setShowInfo(false);
                } else if (hasHistory) {
                    navigateBack();
                } else {
                    onClose();
                }
            }}
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>

                {/* ── WebView ── */}
                {sourceUrl ? (
                    <WebView
                        ref={webViewRef}
                        style={{ flex: 1, backgroundColor: colors.background }}
                        source={{ html: pointViewerHtml }}
                        originWhitelist={['*']}
                        javaScriptEnabled
                        domStorageEnabled
                        mixedContentMode="always"
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback
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

                {/* ── Hotspot bridge ── */}
                <HotspotRenderer webViewRef={webViewRef} isWebViewReady={isWebViewReady} />

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
                    {hasHistory && (
                        <TouchableOpacity
                            style={btnStyle()}
                            onPress={navigateBack}
                            activeOpacity={0.8}
                        >
                            <Feather name="arrow-left" size={18} color={colors.foreground} />
                        </TouchableOpacity>
                    )}

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
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: 12,
                            borderBottomWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <View style={{ flex: 1, marginRight: 8 }}>
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
                            paddingBottom: safeBottom + 20,
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

                        {/* Back button inside sheet */}
                        {hasHistory && (
                            <TouchableOpacity
                                onPress={() => {
                                    setShowInfo(false);
                                    navigateBack();
                                }}
                                activeOpacity={0.8}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: colors.overlay,
                                    marginTop: 4,
                                }}
                            >
                                <Feather name="arrow-left" size={15} color={colors.foreground} />
                                <Text
                                    style={{
                                        color: colors.foreground,
                                        fontSize: 14,
                                        fontWeight: '500',
                                    }}
                                >
                                    Vista anterior
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

import { getViewerScripts } from "./html/viewerScripts";
import { getViewerStyles } from "./html/viewerStyles";

/**
 * Constrói o HTML com o A-Frame para o WebView.
 * Objetivo: replicar o comportamento do viewer web (AFrameViewer) no mobile.
 *
 * @param {string} sourceUrl URL absoluto da imagem/vídeo 360
 * @param {string} pointTitle (opcional) - mantido por compatibilidade
 * @param {string} pointDetail (opcional) - mantido por compatibilidade
 * @param {Object} colors Tema de cores
 * @param {Object} [options]
 * @param {string} [options.baseUrl] Base URL do backend para resolver caminhos relativos (ex: http://192.168.1.10:3000)
 * @param {Object} [options.dome] Configuração do dome (alinhamento)
 */
export function buildViewerHtml(sourceUrl, pointTitle, pointDetail, colors, options = {}) {
  const normalizedSourceUrl = normalizeMediaUrl(sourceUrl);

  const normalizedBaseUrl = normalizeMediaUrl(options?.baseUrl || "");
  let inferredOrigin = "";
  if (!normalizedBaseUrl && /^https?:\/\//i.test(normalizedSourceUrl)) {
    try {
      const url = new URL(normalizedSourceUrl);
      inferredOrigin = `${url.protocol}//${url.host}`;
    } catch {
      inferredOrigin = "";
    }
  }
  const uploadsBaseUrl = String(normalizedBaseUrl || inferredOrigin || "").replace(/\/+$/, "");

  const safeSourceAttr = escapeHtml(normalizedSourceUrl);
  const safeUploadsBaseUrl = escapeHtml(uploadsBaseUrl);

  const panoramaKind = inferPanoramaKind(normalizedSourceUrl);
  const panoramaVideoAsset = panoramaKind === "video"
    ? `<video id="panorama-video" src="${safeSourceAttr}" crossorigin="anonymous" playsinline webkit-playsinline muted loop></video>`
    : "";

  const dome = options?.dome && typeof options.dome === "object" ? options.dome : {};
  const domeRadius = Number.isFinite(Number(dome.radius)) ? Number(dome.radius) : 700;
  const domeVerticalOffset = Number.isFinite(Number(dome.verticalOffset)) ? Number(dome.verticalOffset) : 0;
  const domeRotationX = Number.isFinite(Number(dome.rotationX)) ? Number(dome.rotationX) : 0;
  const domeRotationY = Number.isFinite(Number(dome.rotationY)) ? Number(dome.rotationY) : -130;
  const domeRotationZ = Number.isFinite(Number(dome.rotationZ)) ? Number(dome.rotationZ) : 0;
  const domeMirrorX = Boolean(dome.mirrorX);
  const domeMirrorY = Boolean(dome.mirrorY);

  // Mantido (por compatibilidade) — atualmente o HTML não renderiza metadados do ponto, tal como no web.
  void pointTitle;
  void pointDetail;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

  <!-- A-Frame -->
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>

  <style>
${getViewerStyles(colors)}
  </style>
  <script>
${getViewerScripts(safeUploadsBaseUrl)}
  </script>
</head>
<body>
  
  <!-- A-Frame Scene -->
  <a-scene
    embedded
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false"
    renderer="antialias: true; colorManagement: true;"
    shadow="type: pcfsoft"
    loading-screen="enabled: false"
  >
    <!-- Assets -->
    <a-assets id="assets" timeout="30000">
      ${panoramaVideoAsset}
    </a-assets>

    <a-camera
      position="0 0 0"
      look-controls="magicWindowTrackingEnabled: false; pointerLockEnabled: false; touchEnabled: true"
      wasd-controls="enabled: false"
      raycaster="objects: .hotspot-interaction"
      cursor="rayOrigin: mouse"
      smooth-look="factor: 0.1; touchSensitivity: 0.10"
    ></a-camera>

    <!-- Panorama (usa a-sky nativo do A-Frame, tal como a versão web) -->
    ${panoramaKind === 'image'
      ? `<a-sky
          src="${safeSourceAttr}"
          radius="${domeRadius}"
          position="0 ${domeVerticalOffset} 0"
          rotation="${domeRotationX} ${domeRotationY} ${domeRotationZ}"
          scale="${domeMirrorX ? -1 : 1} ${domeMirrorY ? -1 : 1} 1"
        ></a-sky>`
      : `<a-videosphere
          src="#panorama-video"
          radius="${domeRadius}"
          position="0 ${domeVerticalOffset} 0"
          rotation="${domeRotationX} ${domeRotationY} ${domeRotationZ}"
          scale="${domeMirrorX ? -1 : 1} ${domeMirrorY ? -1 : 1} 1"
        ></a-videosphere>`
    }


    <!-- Overlays (imagem4p) -->
    <a-entity id="warp-overlays-container"></a-entity>

    <!-- Hotspots -->
    <a-entity id="hotspots-container"></a-entity>
  </a-scene>

  <div id="viewer-error" class="viewer-error"></div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inferPanoramaKind(sourceUrl) {
  const value = String(sourceUrl || '').split('?')[0].toLowerCase();

  if (/\.(mp4|webm|ogg)$/.test(value)) {
    return 'video';
  }

  return 'image';
}

function normalizeMediaUrl(rawValue) {
  const value = stripWrappingQuotes(String(rawValue ?? '').trim());
  if (!value) return '';
  if (/^(data|blob):/i.test(value)) return value;

  try {
    return encodeURI(decodeURI(value));
  } catch (_) {
    return encodeURI(value);
  }
}

function stripWrappingQuotes(value) {
  if (!value) return '';
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).trim();
  }
  return value;
}


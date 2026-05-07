/**
 * Constrói o HTML com o A-Frame para o WebView.
 * Inclui os custom components A-Frame para cada tipo de hotspot.
 * 
 * @param {string} sourceUrl URL absoluto da imagem 360 ou fallback
 * @param {string} pointTitle Título
 * @param {string} pointDetail Descrição
 * @param {Object} colors Tema de cores
 */
export function buildViewerHtml(sourceUrl, pointTitle, pointDetail, colors) {
  const normalizedSourceUrl = normalizeMediaUrl(sourceUrl);
  const safeTitle = escapeHtml(pointTitle);
  const safeDetail = escapeHtml(pointDetail);
  const safeSourceAttr = escapeHtml(normalizedSourceUrl);
  const safeSourceComponentAttr = escapeHtml(escapeAframeComponentValue(normalizedSourceUrl));
  const panoramaKind = inferPanoramaKind(normalizedSourceUrl);
  const panoramaVideoAsset = panoramaKind === 'video'
    ? `<video id="panorama-video" src="${safeSourceAttr}" crossorigin="anonymous" playsinline webkit-playsinline muted loop></video>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  
  <!-- A-Frame -->
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: ${colors.background}; overflow: hidden; font-family: sans-serif; }
    
    .point-meta {
      position: absolute; left: 12px; top: 12px; z-index: 10;
      max-width: calc(100% - 24px);
      background: ${colors.overlay}; color: ${colors.foreground};
      border: 1px solid ${colors.border}; border-radius: 12px;
      padding: 10px 12px; backdrop-filter: blur(4px);
      pointer-events: none;
    }
    .point-meta h1 { font-size: 15px; line-height: 20px; margin-bottom: 4px; }
    .point-meta p { font-size: 13px; line-height: 18px; color: ${colors.mutedForeground}; }
    
    /* UI Overlays para texto e media 2D não projetada */
    #ui-layer {
      position: absolute; inset: 0; z-index: 20; pointer-events: none;
      display: flex; align-items: center; justify-content: center;
    }
    .ui-panel {
      background: ${colors.card}; color: ${colors.foreground};
      border: 1px solid ${colors.border}; border-radius: 12px;
      padding: 20px; max-width: 80%; max-height: 80%;
      overflow-y: auto; pointer-events: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      position: relative; display: none;
    }
    .ui-close {
      position: absolute; top: 10px; right: 10px;
      background: ${colors.muted}; color: ${colors.foreground};
      border: none; border-radius: 50%; width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; cursor: pointer;
    }
    
    .viewer-error {
      position: absolute; inset: 0; display: none;
      align-items: center; justify-content: center; text-align: center;
      padding: 24px; color: ${colors.foreground}; background: ${colors.background};
      font-size: 14px; line-height: 20px; z-index: 30;
    }

    .a-enter-vr { display: none !important; }
  </style>

  <script>
    const HOTSPOT_META_PREFIX = 'hsmeta:';
    const IMAGE4P_PREFIX = 'img4p:';
    const INSPECT3D_PREFIX = 'insp3d:';

    // Utils
    function sendMessage(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function decodeBase64JsonPrefix(rawValue, prefix) {
      const value = String(rawValue || '');
      if (!value.startsWith(prefix)) return null;

      try {
        const encoded = value.slice(prefix.length);
        const json = decodeURIComponent(escape(atob(encoded)));
        return JSON.parse(json);
      } catch (error) {
        return null;
      }
    }

    function unwrapHotspotContent(rawValue) {
      const value = String(rawValue || '');
      const meta = decodeBase64JsonPrefix(value, HOTSPOT_META_PREFIX);
      if (!meta) return value;
      return String(meta.value || value);
    }

    function resolveImageContent(rawValue) {
      const unwrapped = unwrapHotspotContent(rawValue);
      const image4p = decodeBase64JsonPrefix(unwrapped, IMAGE4P_PREFIX);
      if (!image4p) return unwrapped;
      return String(image4p.src || '');
    }

    function resolveModelContent(rawValue) {
      const unwrapped = unwrapHotspotContent(rawValue);
      const inspect3d = decodeBase64JsonPrefix(unwrapped, INSPECT3D_PREFIX);
      if (!inspect3d) return unwrapped;
      return String(inspect3d.src || '');
    }

    function normalizeRuntimeMediaUrl(rawValue) {
      const value = String(rawValue || '').trim().replace(/^['\"]+|['\"]+$/g, '');
      if (!value) return '';
      if (/^(data|blob):/i.test(value)) return value;
      try {
        return encodeURI(decodeURI(value));
      } catch (_) {
        return encodeURI(value);
      }
    }

    function showError(message) {
      var errorNode = document.getElementById('viewer-error');
      errorNode.style.display = 'flex';
      errorNode.innerText = message;
    }

    function showUiPanel(htmlContent) {
      const panel = document.getElementById('ui-panel');
      const content = document.getElementById('ui-content');
      content.innerHTML = htmlContent;
      panel.style.display = 'block';
    }

    function closeUiPanel() {
      document.getElementById('ui-panel').style.display = 'none';
      document.getElementById('ui-content').innerHTML = '';
    }

    // ----- A-FRAME CUSTOM COMPONENTS -----

    AFRAME.registerComponent('hotspot-interactive', {
      schema: {
        id: {type: 'string'},
        tipo: {type: 'string'},
        conteudo: {type: 'string'},
        navMode: {type: 'string'},
        navPointId: {type: 'string'},
        navFileUrl: {type: 'string'},
        navFilePath: {type: 'string'}
      },
      init: function () {
        this.el.addEventListener('click', () => {
          const d = this.data;
          const content = unwrapHotspotContent(d.conteudo);
          
          if (d.tipo === 'texto') {
            showUiPanel('<p style="white-space: pre-wrap;">' + content + '</p>');
            return;
          }
          if (d.tipo === 'imagem' || d.tipo === 'imagem4p') {
            const imageSrc = normalizeRuntimeMediaUrl(resolveImageContent(content));
            showUiPanel('<img src="' + imageSrc + '" style="max-width: 100%; border-radius: 8px;" />');
            return;
          }
          if (d.tipo === 'video') {
            const videoSrc = normalizeRuntimeMediaUrl(content);
            showUiPanel('<video src="' + videoSrc + '" controls autoplay style="max-width: 100%; border-radius: 8px;"></video>');
            return;
          }
          if (d.tipo === 'link') {
            sendMessage({ action: 'openLink', url: content });
            return;
          }
          if (d.tipo === 'navegacao') {
            if (d.navMode === 'point') {
               sendMessage({ action: 'navigatePoint', pointId: parseInt(d.navPointId, 10) });
            } else if (d.navMode === 'file') {
               sendMessage({ action: 'navigateFile', fileUrl: d.navFileUrl, filePath: d.navFilePath });
            } else if (d.navMode === 'back') {
               sendMessage({ action: 'navigateBack' });
            }
            return;
          }
          
          // Audio / Modelo 3D inspect e outros têm comportamentos nativos na scene ou não têm overlay 2D
        });
      }
    });

    AFRAME.registerComponent('panorama-dome', {
      schema: {
        src: { type: 'string', default: '' },
        kind: { type: 'string', default: 'image' },
        radius: { type: 'number', default: 700 },
        rotationY: { type: 'number', default: -90 }
      },
      init: function () {
        const THREE = window.THREE;
        this.textureLoader = new THREE.TextureLoader();
        this.mesh = null;
        this.currentTexture = null;
        this.createMesh();
      },
      update: function () {
        const THREE = window.THREE;
        if (!this.mesh) return;

        const radius = Number.isFinite(Number(this.data.radius)) ? Number(this.data.radius) : 700;
        this.mesh.scale.set(radius, radius, radius);
        this.mesh.rotation.y = THREE.MathUtils.degToRad(Number(this.data.rotationY) || 0);

        this.loadTexture(this.data.kind, this.data.src)
          .then((texture) => {
            if (!texture) return;

            if (this.currentTexture && this.currentTexture !== texture) {
              this.currentTexture.dispose && this.currentTexture.dispose();
            }

            this.currentTexture = texture;

            if (this.mesh.material && this.mesh.material.map !== texture) {
              this.mesh.material.dispose && this.mesh.material.dispose();
              this.mesh.material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
                transparent: false,
                opacity: 1
              });
            } else {
              this.mesh.material.map = texture;
              this.mesh.material.needsUpdate = true;
            }

            this.el.emit('panorama-dome-loaded', { ok: true }, false);
          })
          .catch((error) => {
            const message = error && error.message ? error.message : 'Falha ao carregar o panorama 360.';
            const detail = {
              message: message,
              src: this.data && this.data.src ? this.data.src : '',
              kind: this.data && this.data.kind ? this.data.kind : '',
              stack: error && error.stack ? String(error.stack) : null
            };
            // Emit detailed error for external code to capture
            this.el.emit('panorama-dome-error', detail, false);
            // Also log to console for debugging inside WebView
            try { console.error('panorama-dome error:', detail); } catch(e) {}
          });
      },
      remove: function () {
        if (this.mesh && this.mesh.parent) {
          this.mesh.parent.remove(this.mesh);
        }
        if (this.mesh && this.mesh.geometry) {
          this.mesh.geometry.dispose && this.mesh.geometry.dispose();
        }
        if (this.mesh && this.mesh.material) {
          this.mesh.material.dispose && this.mesh.material.dispose();
        }
        if (this.currentTexture) {
          this.currentTexture.dispose && this.currentTexture.dispose();
        }
      },
      createMesh: function () {
        const THREE = window.THREE;
        const geometry = new THREE.SphereGeometry(1, 64, 40);
        const material = new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          color: 0xffffff
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.frustumCulled = false;
        this.el.object3D.add(this.mesh);
      },
      loadTexture: function (kind, src) {
        const safeKind = String(kind || 'image').toLowerCase();
        const safeSrc = normalizeRuntimeMediaUrl(src);

        if (!safeSrc) {
          return Promise.reject(new Error('Fonte do panorama não definida.'));
        }

        if (safeKind === 'video') {
          const video = document.getElementById('panorama-video');
          if (!video) {
            return Promise.reject(new Error('Elemento de vídeo do panorama não encontrado.'));
          }
          const THREE = window.THREE;
          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;
          return Promise.resolve(texture);
        }

        return new Promise((resolve, reject) => {
          this.textureLoader.load(
            safeSrc,
            (loaded) => {
              const THREE = window.THREE;
              loaded.colorSpace = THREE.SRGBColorSpace;
              loaded.needsUpdate = true;
              resolve(loaded);
            },
            undefined,
            () => reject(new Error('Não foi possível carregar a imagem do panorama: ' + safeSrc))
          );
        });
      }
    });

    // ----- HOTSPOT MANAGER -----

    window.currentHotspots = [];
    
    // Função exportada para o RN injetar e atualizar estado
    window.updateHotspots = function(hotspots) {
      window.currentHotspots = hotspots || [];
      const container = document.getElementById('hotspots-container');
      
      // Limpar todos
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // Adicionar novos
      window.currentHotspots.forEach(hs => {
        // Coordenadas Backend: tipicamente z é forward, y up, x right? 
        // A-Frame: x é right, y é up, z é backward (-z is forward).
        // Aqui mantemos direto se a conversão foi feita antes, ou apenas usamos as recebidas.
        // Assumimos que xyz que chegam do DB são compatíveis (ou ajustamos o sinal de z se necessário).
        // No Pannellum original pitch/yaw determinavam a posição. No aframe podemos usar look-at ou posições esféricas, 
        // mas se a api envia x,y,z (normalizados do mundo 3D), multiplicamos por um raio.
        
        // Assumindo x, y, z em range de -1 a 1 ou algo parecido, projetamos num raio de 10m
        const radius = 10;
        const norm = Math.sqrt(hs.x*hs.x + hs.y*hs.y + hs.z*hs.z) || 1;
        const px = (hs.x / norm) * radius;
        const py = (hs.y / norm) * radius;
        const pz = (hs.z / norm) * radius; // A-Frame Z is usually negative for "forward"
        
        const el = document.createElement('a-entity');
        el.setAttribute('position', px + ' ' + py + ' ' + pz);
        // Look at center (camera)
        el.setAttribute('look-at', '0 0 0');
        
        // Setup visuais baseado no tipo
        if (hs.tipo === 'modelo3d' || hs.tipo === 'modelo3d_inspect') {
            const modelSrc = resolveModelContent(hs.conteudo);
            if (!modelSrc) {
              return;
            }
            const modelEl = document.createElement('a-gltf-model');
            modelEl.setAttribute('src', normalizeRuntimeMediaUrl(modelSrc));
            modelEl.setAttribute('scale', hs.scale + ' ' + hs.scale + ' ' + hs.scale);
            // Apply rotations
            modelEl.setAttribute('rotation', hs.rot_pitch + ' ' + hs.rot_yaw + ' 0');
            el.appendChild(modelEl);
            
            // hitbox para click
            const hitbox = document.createElement('a-box');
            hitbox.setAttribute('opacity', '0');
            hitbox.setAttribute('scale', '2 2 2'); // scale box to catch clicks
            hitbox.setAttribute('hotspot-interactive', {
                id: hs.id_hotspot,
                tipo: hs.tipo,
              conteudo: modelSrc
            });
            el.appendChild(hitbox);
            
        } else if (hs.tipo === 'audio' || hs.tipo === 'audioespacial') {
            // Placeholder visual para audio
            const visual = document.createElement('a-sphere');
            visual.setAttribute('radius', '0.5');
            visual.setAttribute('color', '${colors.primary}');
            visual.setAttribute('opacity', '0.6');
            el.appendChild(visual);
            
            // Componente de som
            el.setAttribute('sound', {
              src: normalizeRuntimeMediaUrl(hs.conteudo),
                autoplay: false,
                loop: false,
                positional: hs.tipo === 'audioespacial'
            });
            
            // Click to play
            el.addEventListener('click', function() {
                el.components.sound.playSound();
            });

        } else {
            // Default visual: ícone ou circulo
            const isNav = hs.tipo === 'navegacao';
            const circle = document.createElement('a-circle');
            circle.setAttribute('radius', 0.4 * hs.scale);
            circle.setAttribute('color', isNav ? '${colors.primary}' : '#ffffff');
            circle.setAttribute('opacity', '0.8');
            
            if (isNav) {
                // Seta básica
                const arrow = document.createElement('a-triangle');
                arrow.setAttribute('color', '#ffffff');
                arrow.setAttribute('scale', '0.2 0.2 0.2');
                arrow.setAttribute('position', '0 0 0.05');
                el.appendChild(arrow);
            }
            
            el.appendChild(circle);
            
            // Interaction
            el.setAttribute('hotspot-interactive', {
                id: hs.id_hotspot,
                tipo: hs.tipo,
                conteudo: hs.conteudo,
                navMode: hs.navigation_mode || '',
                navPointId: hs.id_ponto_destino || '',
                navFileUrl: hs.navigation_file_url || '',
                navFilePath: hs.navigation_file_path || ''
            });
        }
        
        container.appendChild(el);
      });
    };

    // Handle panorama image load errors
    document.addEventListener('DOMContentLoaded', () => {
        const scene = document.querySelector('a-scene');
        const panoramaDome = document.getElementById('panorama-dome');
        let readySent = false;

        function notifyReady() {
          if (readySent) return;
          readySent = true;
          sendMessage({ status: 'ready' });
        }

        if (scene) {
          scene.addEventListener('loaded', notifyReady, { once: true });
        } else {
          notifyReady();
        }

        if (panoramaDome) {
          panoramaDome.addEventListener('panorama-dome-error', function(event) {
            const detail = event && event.detail ? event.detail : { message: 'Não foi possível carregar a imagem 360.' };
            const message = detail.message || 'Não foi possível carregar a imagem 360.';
            console.error('Falha no panorama-dome:', detail);
            showError(message);
            // Forward full error detail to React Native for precise logging
            sendMessage({ point360Error: true, error: detail });
          });
        }
    });
  </script>
</head>
<body>
  
  <!-- A-Frame Scene -->
  <a-scene 
    vr-mode-ui="enabled: false"
    loading-screen="enabled: false"
    device-orientation-permission-ui="enabled: false"
  >
    <!-- Assets -->
    <a-assets id="assets">
      ${panoramaVideoAsset}
    </a-assets>

    <!-- Panorama com componente reutilizado do web -->
    <a-entity
      id="panorama-dome"
      panorama-dome="src: ${safeSourceComponentAttr}; kind: ${panoramaKind}; radius: 700; rotationY: -90"
    ></a-entity>

    <!-- Hotspots Container -->
    <a-entity id="hotspots-container"></a-entity>

    <!-- Camera + Cursor -->
    <a-camera position="0 0 0" wasd-controls="enabled: false" look-controls="reverseMouseDrag: true">
      <a-entity 
        cursor="fuse: false; rayOrigin: mouse;"
        raycaster="objects: [hotspot-interactive], a-box, a-sphere, a-circle"
        position="0 0 -1"
        geometry="primitive: ring; radiusInner: 0.02; radiusOuter: 0.03"
        material="color: white; shader: flat; opacity: 0.5"
        animation__click="property: scale; startEvents: click; easing: easeInCubic; dur: 150; from: 0.1 0.1 0.1; to: 1 1 1"
        animation__fusing="property: scale; startEvents: fusing; easing: easeInCubic; dur: 1500; from: 1 1 1; to: 0.1 0.1 0.1"
        animation__mouseleave="property: scale; startEvents: mouseleave; easing: easeInCubic; dur: 500; to: 1 1 1">
      </a-entity>
    </a-camera>
  </a-scene>

  <!-- UI Metadata fixa -->
  <div class="point-meta">
    <h1>${safeTitle}</h1>
    <p>${safeDetail}</p>
  </div>

  <!-- UI Dinâmica (Textos, Imagens, Vídeos 2D sobrepostos) -->
  <div id="ui-layer">
    <div id="ui-panel" class="ui-panel">
        <button class="ui-close" onclick="closeUiPanel()">×</button>
        <div id="ui-content" style="margin-top: 15px;"></div>
    </div>
  </div>

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

function escapeAframeComponentValue(value) {
  return String(value ?? '').replace(/;/g, '%3B');
}

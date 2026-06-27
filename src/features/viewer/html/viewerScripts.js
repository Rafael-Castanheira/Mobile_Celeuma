export function getViewerScripts(safeUploadsBaseUrl) {
  return `
    const HOTSPOT_SCALE_MIN = 0.2;
    const HOTSPOT_META_PREFIX = 'hsmeta:';
    const IMAGE4P_PREFIX = 'img4p:';
    const INSPECT3D_PREFIX = 'insp3d:';

    function sendMessage(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function resolveUploadsUrl(pathOrUrl) {
      const value = String(pathOrUrl || '').trim().replace(/^['\\"]+|['\\"]+\$/g, '');
      if (!value) return '';
      if (/^(data|blob):/i.test(value)) return value;
      if (/^https?:\\/\\//i.test(value)) return value;

      const normalizedPath = value.replace(/^\\/+/, '');
      const uploadPath = normalizedPath.startsWith('uploads/') ? normalizedPath : 'uploads/' + normalizedPath;
      const base = String(UPLOADS_BASE_URL || '').replace(/\\/+\$/, '');
      if (!base) return '/' + uploadPath;
      return base + '/' + uploadPath;
    }

    function normalizeRuntimeMediaUrl(rawValue) {
      const value = String(rawValue || '').trim().replace(/^['\\"]+|['\\"]+\$/g, '');
      if (!value) return '';
      const absolute = resolveUploadsUrl(value);
      try {
        return encodeURI(decodeURI(absolute));
      } catch (_) {
        return encodeURI(absolute);
      }
    }

    window.onerror = function(message, source, lineno, colno, error) {
      sendMessage({ point360Error: true, message: 'JS Error: ' + message });
    };

    function showError(message) {
      const errorNode = document.getElementById('viewer-error');
      if (!errorNode) return;
      errorNode.style.display = 'flex';
      errorNode.innerText = String(message || 'Falha ao carregar o visualizador 360.');
    }

    function decodeBase64JsonPrefix(rawValue, prefix) {
      const value = String(rawValue || '');
      if (!value.startsWith(prefix)) return null;

      try {
        const encoded = value.slice(prefix.length);
        const json = decodeURIComponent(escape(atob(encoded)));
        return JSON.parse(json);
      } catch (_error) {
        return null;
      }
    }

    function decodeHotspotContent(storedValue) {
      const value = String(storedValue || '');
      const meta = decodeBase64JsonPrefix(value, HOTSPOT_META_PREFIX);
      if (!meta) {
        return { value, view: '', scale: 1, rotYaw: 0, rotPitch: 0, placement: '' };
      }

      const scale = Number.isFinite(Number(meta?.scale))
        ? Math.max(HOTSPOT_SCALE_MIN, Number(meta.scale))
        : 1;

      return {
        value: String(meta?.value || ''),
        view: String(meta?.view || ''),
        scale,
        rotYaw: Number.isFinite(Number(meta?.rotYaw)) ? Number(meta.rotYaw) : 0,
        rotPitch: Number.isFinite(Number(meta?.rotPitch)) ? Number(meta.rotPitch) : 0,
        placement: String(meta?.placement || ''),
      };
    }

    function unwrapHotspotValue(rawValue) {
      const decoded = decodeHotspotContent(rawValue);
      return decoded && decoded.value ? decoded.value : String(rawValue || '');
    }

    function decodeImage4pValue(rawValue) {
      const unwrapped = unwrapHotspotValue(rawValue);
      const parsed = decodeBase64JsonPrefix(unwrapped, IMAGE4P_PREFIX);
      if (!parsed) return null;

      const points = Array.isArray(parsed?.points) ? parsed.points : [];
      const occlusionMaskPoints = Array.isArray(parsed?.occlusionMaskPoints) ? parsed.occlusionMaskPoints : [];

      return {
        src: String(parsed?.src || ''),
        points: points
          .map((p) => ({ x: Number(p?.x), y: Number(p?.y), z: Number(p?.z) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
        opacity: Number.isFinite(Number(parsed?.opacity)) ? Number(parsed.opacity) : 1,
        brightness: Number.isFinite(Number(parsed?.brightness)) ? Number(parsed.brightness) : 1,
        inset: Number.isFinite(Number(parsed?.inset)) ? Number(parsed.inset) : 0.6,
        rotateDeg: Number.isFinite(Number(parsed?.rotateDeg)) ? Number(parsed.rotateDeg) : 0,
        flipX: Boolean(parsed?.flipX),
        flipY: Boolean(parsed?.flipY),
        depthMode: parsed?.depthMode === 'occlusion-mask' ? 'occlusion-mask' : 'none',
        occlusionMaskPoints: occlusionMaskPoints
          .map((p) => ({ x: Number(p?.x), y: Number(p?.y), z: Number(p?.z) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
        occlusionMaskInset: Number.isFinite(Number(parsed?.occlusionMaskInset)) ? Number(parsed.occlusionMaskInset) : 0,
      };
    }

    function decodeInspect3dValue(rawValue) {
      const unwrapped = unwrapHotspotValue(rawValue);
      const parsed = decodeBase64JsonPrefix(unwrapped, INSPECT3D_PREFIX);
      if (!parsed) return null;

      return {
        src: String(parsed?.src || ''),
        rotationSpeed: Number.isFinite(Number(parsed?.rotationSpeed)) ? Number(parsed.rotationSpeed) : 1,
        axis: ['x', 'y', 'z'].includes(parsed?.axis) ? parsed.axis : 'y',
        buttons: Array.isArray(parsed?.buttons) ? parsed.buttons : [],
      };
    }

    function registerWebLikeComponents() {
      const AFRAME = window.AFRAME;
      const THREE = window.THREE;
      if (!AFRAME || !THREE) return;

      if (!AFRAME.components['inspect-3d']) {
        AFRAME.registerComponent('inspect-3d', {
          schema: {
            axis: { type: 'string', default: 'y' },
            speed: { type: 'number', default: 1 },
            isInspecting: { type: 'boolean', default: false },
          },
          init: function () {
            this.baseRotation = new THREE.Euler().copy(this.el.object3D.rotation);
            this.basePosition = new THREE.Vector3().copy(this.el.object3D.position);

            this.dragRotation = new THREE.Euler(0, 0, 0);
            this.isDragging = false;
            this.previousMousePosition = { x: 0, y: 0 };
            this.idleRotationOffset = 0;

            this.onMouseDown = (e) => {
              if (!this.data.isInspecting) return;
              this.isDragging = true;
              this.previousMousePosition.x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
              this.previousMousePosition.y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            };
            this.onMouseUp = () => { this.isDragging = false; };
            this.onMouseMove = (e) => {
              if (!this.isDragging || !this.data.isInspecting) return;
              const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
              const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
              const deltaX = clientX - this.previousMousePosition.x;
              const deltaY = clientY - this.previousMousePosition.y;
              this.previousMousePosition = { x: clientX, y: clientY };
              this.dragRotation.y += deltaX * 0.01;
              this.dragRotation.x += deltaY * 0.01;
            };

            this.onMouseDownBound = this.onMouseDown.bind(this);
            this.onMouseUpBound = this.onMouseUp.bind(this);
            this.onMouseMoveBound = this.onMouseMove.bind(this);

            window.addEventListener('mousedown', this.onMouseDownBound);
            window.addEventListener('mouseup', this.onMouseUpBound);
            window.addEventListener('mousemove', this.onMouseMoveBound);
            window.addEventListener('touchstart', this.onMouseDownBound, { passive: true });
            window.addEventListener('touchend', this.onMouseUpBound);
            window.addEventListener('touchmove', this.onMouseMoveBound, { passive: true });
          },
          update: function (oldData) {
            if (this.data.isInspecting === oldData.isInspecting) return;

            const sceneEl = this.el.sceneEl;
            if (!sceneEl || !sceneEl.camera) return;
            const cameraEl = sceneEl.camera.el;

            if (this.data.isInspecting) {
              if (cameraEl.components['look-controls']) {
                cameraEl.setAttribute('look-controls', 'enabled', false);
              }
              const cameraWorldPos = new THREE.Vector3();
              const cameraWorldDir = new THREE.Vector3();
              sceneEl.camera.getWorldPosition(cameraWorldPos);
              sceneEl.camera.getWorldDirection(cameraWorldDir);

              this.targetPosition = new THREE.Vector3().copy(cameraWorldPos).add(cameraWorldDir.multiplyScalar(2));
              this.dragRotation.set(0, 0, 0);
            } else {
              if (cameraEl.components['look-controls']) {
                cameraEl.setAttribute('look-controls', 'enabled', true);
              }
              this.targetPosition = new THREE.Vector3().copy(this.basePosition);
              this.idleRotationOffset = 0;
            }
          },
          tick: function (_time, timeDelta) {
            if (!this.targetPosition) {
              this.targetPosition = new THREE.Vector3().copy(this.basePosition);
            }

            if (this.data.isInspecting) {
              this.el.object3D.position.lerp(this.targetPosition, 0.05);

              const targetEuler = new THREE.Euler(
                this.baseRotation.x + this.dragRotation.x,
                this.baseRotation.y + this.dragRotation.y,
                this.baseRotation.z + this.dragRotation.z
              );

              this.el.object3D.rotation.x += (targetEuler.x - this.el.object3D.rotation.x) * 0.1;
              this.el.object3D.rotation.y += (targetEuler.y - this.el.object3D.rotation.y) * 0.1;
              this.el.object3D.rotation.z += (targetEuler.z - this.el.object3D.rotation.z) * 0.1;
            } else {
              this.el.object3D.position.lerp(this.basePosition, 0.05);
              const rSpeed = (this.data.speed * (timeDelta / 1000)) || 0;
              this.idleRotationOffset += rSpeed;

              const targetEuler = new THREE.Euler().copy(this.baseRotation);
              if (this.data.axis === 'x') targetEuler.x += this.idleRotationOffset;
              else if (this.data.axis === 'z') targetEuler.z += this.idleRotationOffset;
              else targetEuler.y += this.idleRotationOffset;

              this.el.object3D.rotation.x += (targetEuler.x - this.el.object3D.rotation.x) * 0.1;
              this.el.object3D.rotation.y += (targetEuler.y - this.el.object3D.rotation.y) * 0.1;
              this.el.object3D.rotation.z += (targetEuler.z - this.el.object3D.rotation.z) * 0.1;
            }
          },
          remove: function () {
            window.removeEventListener('mousedown', this.onMouseDownBound);
            window.removeEventListener('mouseup', this.onMouseUpBound);
            window.removeEventListener('mousemove', this.onMouseMoveBound);
            window.removeEventListener('touchstart', this.onMouseDownBound);
            window.removeEventListener('touchend', this.onMouseUpBound);
            window.removeEventListener('touchmove', this.onMouseMoveBound);
          }
        });
      }

      // Copiado do web: projeta imagem recortada no dome via 4 pontos.
      if (!AFRAME.components['warp-image']) {
        AFRAME.registerComponent('warp-image', {
          schema: {
            src: { type: 'string', default: '' },
            points: { type: 'string', default: '' },
            opacity: { type: 'number', default: 1 },
            brightness: { type: 'number', default: 1 },
            inset: { type: 'number', default: 0.6 },
            rotateDeg: { type: 'number', default: 0 },
            flipX: { type: 'boolean', default: false },
            flipY: { type: 'boolean', default: false },
            depthMode: { type: 'string', default: 'none' },
            occlusionMaskPoints: { type: 'string', default: '' },
            occlusionMaskInset: { type: 'number', default: 0 },
            doubleSided: { type: 'boolean', default: true },
          },
          init: function () {
            this._mesh = null;
            this._occlusionMaskMesh = null;
            this._group = null;
            this._geometry = null;
            this._occlusionMaskGeometry = null;
            this._material = null;
            this._occlusionMaskMaterial = null;
            this._texture = null;
            this._textureLoader = new THREE.TextureLoader();
            this._textureLoader.crossOrigin = 'anonymous';
          },
          remove: function () {
            if (this._group || this._mesh) {
              this.el.removeObject3D('mesh');
            }
            if (this._geometry && this._geometry.dispose) this._geometry.dispose();
            if (this._occlusionMaskGeometry && this._occlusionMaskGeometry.dispose) this._occlusionMaskGeometry.dispose();
            if (this._material && this._material.dispose) this._material.dispose();
            if (this._occlusionMaskMaterial && this._occlusionMaskMaterial.dispose) this._occlusionMaskMaterial.dispose();
            if (this._texture && this._texture.dispose) this._texture.dispose();
            this._group = null;
            this._mesh = null;
            this._occlusionMaskMesh = null;
            this._geometry = null;
            this._occlusionMaskGeometry = null;
            this._material = null;
            this._occlusionMaskMaterial = null;
            this._texture = null;
          },
          update: function () {
            const src = String(this.data.src || '').trim();
            const encodedPoints = String(this.data.points || '');
            const encodedMaskPoints = String(this.data.occlusionMaskPoints || '');
            let points = [];
            let occlusionMaskPoints = [];

            if (encodedPoints) {
              try {
                const decoded = decodeURIComponent(encodedPoints);
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                  points = parsed
                    .map((p) => ({ x: Number(p && p.x), y: Number(p && p.y), z: Number(p && p.z) }))
                    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
                }
              } catch (_e) {
                points = [];
              }
            }

            if (encodedMaskPoints) {
              try {
                const decoded = decodeURIComponent(encodedMaskPoints);
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                  occlusionMaskPoints = parsed
                    .map((p) => ({ x: Number(p && p.x), y: Number(p && p.y), z: Number(p && p.z) }))
                    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
                }
              } catch (_e) {
                occlusionMaskPoints = [];
              }
            }

            const opacity = Math.max(0, Math.min(1, Number(this.data.opacity) || 1));
            const brightness = Math.max(0, Math.min(5, Number(this.data.brightness) || 1));
            const inset = Number.isFinite(Number(this.data.inset)) ? Number(this.data.inset) : 0.6;
            const rotateDeg = Number.isFinite(Number(this.data.rotateDeg)) ? Number(this.data.rotateDeg) : 0;
            const depthMode = this.data.depthMode === 'occlusion-mask' ? 'occlusion-mask' : 'none';
            const occlusionMaskInset = Number.isFinite(Number(this.data.occlusionMaskInset)) ? Number(this.data.occlusionMaskInset) : 0;
            const flipX = Boolean(this.data.flipX);
            const flipY = Boolean(this.data.flipY);
            const side = this.data.doubleSided ? THREE.DoubleSide : THREE.FrontSide;

            if (!src || points.length < 4) {
              if (this._group || this._mesh) {
                this.el.removeObject3D('mesh');
                this._group = null;
                this._mesh = null;
                this._occlusionMaskMesh = null;
              }
              if (this._geometry && this._geometry.dispose) this._geometry.dispose();
              if (this._occlusionMaskGeometry && this._occlusionMaskGeometry.dispose) this._occlusionMaskGeometry.dispose();
              if (this._material && this._material.dispose) this._material.dispose();
              if (this._occlusionMaskMaterial && this._occlusionMaskMaterial.dispose) this._occlusionMaskMaterial.dispose();
              if (this._texture && this._texture.dispose) this._texture.dispose();
              this._geometry = null;
              this._occlusionMaskGeometry = null;
              this._material = null;
              this._occlusionMaskMaterial = null;
              this._texture = null;
              return;
            }

            const buildPolygonGeometry = (polygonPoints, polygonInset, includeUv) => {
              let normalizedPoints = Array.isArray(polygonPoints) ? [...polygonPoints] : [];
              if (normalizedPoints.length < 3) return null;

              const center = new THREE.Vector3();
              normalizedPoints.forEach((p) => center.add(new THREE.Vector3(p.x, p.y, p.z)));
              center.multiplyScalar(1 / normalizedPoints.length);

              const normal = new THREE.Vector3(0, 0, 0);
              for (let i = 0; i < normalizedPoints.length; i += 1) {
                const current = normalizedPoints[i];
                const next = normalizedPoints[(i + 1) % normalizedPoints.length];
                normal.x += (current.y - next.y) * (current.z + next.z);
                normal.y += (current.z - next.z) * (current.x + next.x);
                normal.z += (current.x - next.x) * (current.y + next.y);
              }
              if (normal.lengthSq() < 1e-8) {
                const p0 = new THREE.Vector3(normalizedPoints[0].x, normalizedPoints[0].y, normalizedPoints[0].z);
                const p1 = new THREE.Vector3(normalizedPoints[1].x, normalizedPoints[1].y, normalizedPoints[1].z);
                const p2 = new THREE.Vector3(normalizedPoints[2].x, normalizedPoints[2].y, normalizedPoints[2].z);
                normal.copy(new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)));
              }
              if (normal.lengthSq() < 1e-8) return null;
              normal.normalize();

              const p0 = new THREE.Vector3(normalizedPoints[0].x, normalizedPoints[0].y, normalizedPoints[0].z);
              const p1 = new THREE.Vector3(normalizedPoints[1].x, normalizedPoints[1].y, normalizedPoints[1].z);
              const tangent = new THREE.Vector3().subVectors(p1, p0);
              tangent.addScaledVector(normal, -tangent.dot(normal));
              if (tangent.lengthSq() < 1e-8) {
                tangent.set(1, 0, 0);
                tangent.addScaledVector(normal, -tangent.dot(normal));
              }
              tangent.normalize();
              const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

              const verts2 = normalizedPoints.map((p) => {
                const v = new THREE.Vector3(p.x, p.y, p.z).sub(center);
                return new THREE.Vector2(v.dot(tangent), v.dot(bitangent));
              });

              let area = 0;
              for (let i = 0; i < verts2.length; i += 1) {
                const a = verts2[i];
                const b = verts2[(i + 1) % verts2.length];
                area += (a.x * b.y - b.x * a.y);
              }
              if (area < 0) {
                verts2.reverse();
                normalizedPoints = [...normalizedPoints].reverse();
              }

              const triangles = THREE.ShapeUtils.triangulateShape(verts2, []);
              if (!triangles || !triangles.length) return null;

              let minX = Infinity;
              let maxX = -Infinity;
              let minY = Infinity;
              let maxY = -Infinity;
              verts2.forEach((v) => {
                minX = Math.min(minX, v.x);
                maxX = Math.max(maxX, v.x);
                minY = Math.min(minY, v.y);
                maxY = Math.max(maxY, v.y);
              });
              const spanX = Math.max(1e-6, maxX - minX);
              const spanY = Math.max(1e-6, maxY - minY);

              const positions = new Float32Array(normalizedPoints.length * 3);
              const uvs = includeUv ? new Float32Array(normalizedPoints.length * 2) : null;

              const angle = (rotateDeg * Math.PI) / 180;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);

              for (let i = 0; i < normalizedPoints.length; i += 1) {
                const p = normalizedPoints[i];
                const idx3 = i * 3;
                positions[idx3] = p.x - normal.x * polygonInset;
                positions[idx3 + 1] = p.y - normal.y * polygonInset;
                positions[idx3 + 2] = p.z - normal.z * polygonInset;

                if (includeUv && uvs) {
                  const idx2 = i * 2;
                  let u = (verts2[i].x - minX) / spanX;
                  let v = 1 - (verts2[i].y - minY) / spanY;

                  if (flipX) u = 1 - u;
                  if (flipY) v = 1 - v;

                  if (Math.abs(rotateDeg) > 1e-6) {
                    const du = u - 0.5;
                    const dv = v - 0.5;
                    u = du * cos - dv * sin + 0.5;
                    v = du * sin + dv * cos + 0.5;
                  }

                  uvs[idx2] = u;
                  uvs[idx2 + 1] = v;
                }
              }

              const indices = new Uint16Array(triangles.length * 3);
              for (let i = 0; i < triangles.length; i += 1) {
                const tri = triangles[i];
                indices[i * 3] = tri[0];
                indices[i * 3 + 1] = tri[1];
                indices[i * 3 + 2] = tri[2];
              }

              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
              if (includeUv && uvs) {
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
              }
              geometry.setIndex(new THREE.BufferAttribute(indices, 1));
              geometry.computeVertexNormals();
              return geometry;
            };

            const geometry = buildPolygonGeometry(points, inset, true);
            if (!geometry) return;

            const applyMaterial = (texture) => {
              const mat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity,
                side,
                depthWrite: depthMode !== 'occlusion-mask',
              });
              if (brightness !== 1 && texture) {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
              }
              return mat;
            };

            const finalize = (texture) => {
              if (this._geometry && this._geometry.dispose) this._geometry.dispose();
              if (this._material && this._material.dispose) this._material.dispose();
              this._geometry = geometry;
              this._texture = texture;
              this._material = applyMaterial(texture);

              if (!this._mesh) {
                this._mesh = new THREE.Mesh(this._geometry, this._material);
              } else {
                this._mesh.geometry = this._geometry;
                this._mesh.material = this._material;
              }

              if (!this._group) {
                this._group = new THREE.Group();
                this._group.add(this._mesh);
                this.el.setObject3D('mesh', this._group);
              }

              if (depthMode === 'occlusion-mask' && occlusionMaskPoints.length >= 3) {
                const maskGeom = buildPolygonGeometry(occlusionMaskPoints, occlusionMaskInset, false);
                if (maskGeom) {
                  if (this._occlusionMaskGeometry && this._occlusionMaskGeometry.dispose) this._occlusionMaskGeometry.dispose();
                  if (this._occlusionMaskMaterial && this._occlusionMaskMaterial.dispose) this._occlusionMaskMaterial.dispose();
                  this._occlusionMaskGeometry = maskGeom;
                  this._occlusionMaskMaterial = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 0,
                    side,
                    depthWrite: true,
                    depthTest: true,
                  });
                  if (!this._occlusionMaskMesh) {
                    this._occlusionMaskMesh = new THREE.Mesh(this._occlusionMaskGeometry, this._occlusionMaskMaterial);
                    this._group.add(this._occlusionMaskMesh);
                  } else {
                    this._occlusionMaskMesh.geometry = this._occlusionMaskGeometry;
                    this._occlusionMaskMesh.material = this._occlusionMaskMaterial;
                  }
                  this._occlusionMaskMesh.renderOrder = -90;
                }
              } else if (this._occlusionMaskMesh) {
                this._group.remove(this._occlusionMaskMesh);
                this._occlusionMaskMesh = null;
                if (this._occlusionMaskGeometry && this._occlusionMaskGeometry.dispose) this._occlusionMaskGeometry.dispose();
                if (this._occlusionMaskMaterial && this._occlusionMaskMaterial.dispose) this._occlusionMaskMaterial.dispose();
                this._occlusionMaskGeometry = null;
                this._occlusionMaskMaterial = null;
              }
            };

            const resolvedSrc = normalizeRuntimeMediaUrl(src);
            if (this._texture && oldData && oldData.src === this.data.src) {
              finalize(this._texture);
              return;
            }

            // Carrega via fetch+blob para evitar problemas de CORS em WebView (tal como no panorama-dome)
            fetch(resolvedSrc)
              .then((response) => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.blob();
              })
              .then((blob) => {
                const blobUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                  const THREE = window.THREE;
                  const texture = new THREE.Texture(img);
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.needsUpdate = true;
                  URL.revokeObjectURL(blobUrl);
                  finalize(texture);
                };
                img.onerror = () => {
                  URL.revokeObjectURL(blobUrl);
                };
                img.src = blobUrl;
              })
              .catch((err) => {
                // silently ignore
              });
          },
        });
      }
    }

    // ----- SMOOTH-LOOK: damping for shaky hands -----
    if (!AFRAME.components['smooth-look']) {
      AFRAME.registerComponent('smooth-look', {
        schema: {
          factor: { type: 'number', default: 0.08 },
          touchSensitivity: { type: 'number', default: 0.4 },
        },
        init: function () {
          this._smoothYaw = 0;
          this._smoothPitch = 0;
          this._initialised = false;
          this._patchApplied = false;
        },
        tick: function () {
          var lc = this.el.components['look-controls'];
          if (!lc) return;

          // ---- one-time patch: scale down touch deltas ----
          if (!this._patchApplied && lc.onTouchMove) {
            this._patchApplied = true;
            var sens = Math.max(0.05, Math.min(1, this.data.touchSensitivity));
            var origOnTouchMove = lc.onTouchMove.bind(lc);

            // A-Frame look-controls stores accumulated rotation in
            // lc.pitchObject.rotation.x (pitch) and lc.yawObject.rotation.y (yaw).
            // We wrap onTouchMove to capture before/after and scale the delta.
            lc.onTouchMove = function (evt) {
              var prevPitch = lc.pitchObject ? lc.pitchObject.rotation.x : 0;
              var prevYaw   = lc.yawObject   ? lc.yawObject.rotation.y   : 0;
              origOnTouchMove(evt);
              if (lc.pitchObject && lc.yawObject) {
                var dPitch = lc.pitchObject.rotation.x - prevPitch;
                var dYaw   = lc.yawObject.rotation.y   - prevYaw;
                lc.pitchObject.rotation.x = prevPitch + dPitch * sens;
                lc.yawObject.rotation.y   = prevYaw   + dYaw   * sens;
              }
            };
          }

          // ---- exponential smoothing on the camera rotation ----
          if (!lc.pitchObject || !lc.yawObject) return;

          var targetPitch = lc.pitchObject.rotation.x;
          var targetYaw   = lc.yawObject.rotation.y;

          if (!this._initialised) {
            this._smoothPitch = targetPitch;
            this._smoothYaw   = targetYaw;
            this._initialised = true;
            return;
          }

          var f = Math.max(0.01, Math.min(1, this.data.factor));
          this._smoothPitch += (targetPitch - this._smoothPitch) * f;
          this._smoothYaw   += (targetYaw   - this._smoothYaw)   * f;

          // Write the smoothed values back so the camera renders them
          lc.pitchObject.rotation.x = this._smoothPitch;
          lc.yawObject.rotation.y   = this._smoothYaw;
        }
      });
    }

    // Panorama dome (mesh) com alinhamento semelhante ao web.
    if (!AFRAME.components['panorama-dome']) {
      AFRAME.registerComponent('panorama-dome', {
        schema: {
          src: { type: 'string', default: '' },
          kind: { type: 'string', default: 'image' },
          radius: { type: 'number', default: 700 },
          verticalOffset: { type: 'number', default: 0 },
          rotationX: { type: 'number', default: 0 },
          rotationY: { type: 'number', default: -130 },
          rotationZ: { type: 'number', default: 0 },
          mirrorX: { type: 'boolean', default: false },
          mirrorY: { type: 'boolean', default: false },
        },
      init: function () {
        const THREE = window.THREE;
        this.textureLoader = new THREE.TextureLoader();
        this.textureLoader.crossOrigin = 'anonymous';
        this.mesh = null;
        this.currentTexture = null;
        this.createMesh();
      },
      update: function () {
        const THREE = window.THREE;
        if (!this.mesh) return;

        const radius = Number.isFinite(Number(this.data.radius)) ? Number(this.data.radius) : 700;
        const verticalOffset = Number.isFinite(Number(this.data.verticalOffset)) ? Number(this.data.verticalOffset) : 0;
        const rotationX = Number.isFinite(Number(this.data.rotationX)) ? Number(this.data.rotationX) : 0;
        const rotationY = Number.isFinite(Number(this.data.rotationY)) ? Number(this.data.rotationY) : 0;
        const rotationZ = Number.isFinite(Number(this.data.rotationZ)) ? Number(this.data.rotationZ) : 0;
        const mirrorX = !!this.data.mirrorX;
        const mirrorY = !!this.data.mirrorY;

        const sx = mirrorX ? -1 : 1;
        const sy = mirrorY ? -1 : 1;
        this.mesh.scale.set(radius * sx, radius * sy, radius);
        this.mesh.position.set(0, verticalOffset, 0);
        this.mesh.rotation.set(
          THREE.MathUtils.degToRad(rotationX),
          THREE.MathUtils.degToRad(rotationY),
          THREE.MathUtils.degToRad(rotationZ)
        );

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
          return Promise.reject(new Error('Fonte do panorama n\\u00e3o definida.'));
        }

        if (safeKind === 'video') {
          const video = document.getElementById('panorama-video');
          if (!video) {
            return Promise.reject(new Error('Elemento de v\\u00eddeo do panorama n\\u00e3o encontrado.'));
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

        // Carrega via fetch+blob para evitar problemas de CORS em WebView
        var self = this;
        return fetch(safeSrc)
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ao carregar panorama: ' + safeSrc);
            return response.blob();
          })
          .then(function (blob) {
            var blobUrl = URL.createObjectURL(blob);
            return new Promise(function (resolve, reject) {
              var img = new Image();
              img.onload = function () {
                var THREE = window.THREE;

                // Auto-resize para n\\u00e3o crashar texturas maiores que o MAX_TEXTURE_SIZE
                var renderer = self.el && self.el.sceneEl && self.el.sceneEl.renderer;
                var maxTextureSize = (renderer && renderer.capabilities && renderer.capabilities.maxTextureSize) || 4096;
                var texSource = img;

                if (img.width > maxTextureSize || img.height > maxTextureSize) {
                  try {
                    var scale = maxTextureSize / Math.max(img.width, img.height);
                    var newWidth = Math.floor(img.width * scale);
                    var newHeight = Math.floor(img.height * scale);
                    var canvas = document.createElement('canvas');
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    texSource = canvas;
                  } catch (e) {
                    console.error('Falha ao redimensionar textura:', e);
                  }
                }

                var texture = new THREE.Texture(texSource);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                URL.revokeObjectURL(blobUrl);
                resolve(texture);
              };
              img.onerror = function () {
                URL.revokeObjectURL(blobUrl);
                reject(new Error('Falha ao decodificar imagem do panorama.'));
              };
              img.src = blobUrl;
            });
          });
      }
    });

    // ----- HOTSPOT MANAGER (web-like) -----

    window.currentHotspots = [];
    window.__inspectModeHotspotId = null;
    window.__inspectEntities = {};

    function clearChildren(node) {
      if (!node) return;
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function clampHotspotScale(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 1;
      return Math.max(HOTSPOT_SCALE_MIN, numeric);
    }

    function createNavIcon(hs) {
      const navColor = String(hs && hs.icon_color ? hs.icon_color : '#22c55e');
      const root = document.createElement('a-entity');

      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '8');
      ring.setAttribute('radius-outer', '12');
      ring.setAttribute('color', navColor);
      ring.setAttribute('position', '0 0 0');
      ring.setAttribute('opacity', '0.95');
      ring.setAttribute('material', 'side: double; alphaTest: 0.050');
      root.appendChild(ring);

      const circle = document.createElement('a-circle');
      circle.setAttribute('radius', '7');
      circle.setAttribute('color', '#0b1b10');
      circle.setAttribute('position', '0 0 0.02');
      circle.setAttribute('opacity', '0.9');
      circle.setAttribute('material', 'side: double; alphaTest: 0.050');
      root.appendChild(circle);

      const tri = document.createElement('a-triangle');
      if (hs && hs.navigation_mode === 'back') {
        tri.setAttribute('vertex-a', '2.5 4 0.05');
        tri.setAttribute('vertex-b', '2.5 -4 0.05');
        tri.setAttribute('vertex-c', '-4 0 0.05');
      } else {
        tri.setAttribute('vertex-a', '-2.5 4 0.05');
        tri.setAttribute('vertex-b', '-2.5 -4 0.05');
        tri.setAttribute('vertex-c', '4 0 0.05');
      }
      tri.setAttribute('color', navColor);
      tri.setAttribute('material', 'side: double; alphaTest: 0.050');
      root.appendChild(tri);

      const label = document.createElement('a-text');
      label.setAttribute('value', hs && hs.navigation_mode === 'back' ? 'Anterior' : 'Proxima vista');
      label.setAttribute('color', 'white');
      label.setAttribute('width', '90');
      label.setAttribute('align', 'center');
      label.setAttribute('position', '0 16 0');
      root.appendChild(label);

      return root;
    }

    function createRingWithLabel(color, labelText) {
      const root = document.createElement('a-entity');

      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '5');
      ring.setAttribute('radius-outer', '7');
      ring.setAttribute('color', color);
      ring.setAttribute('material', 'side: double; alphaTest: 0.050');
      root.appendChild(ring);

      const text = document.createElement('a-text');
      text.setAttribute('value', labelText);
      text.setAttribute('color', 'white');
      text.setAttribute('width', '80');
      text.setAttribute('align', 'center');
      text.setAttribute('position', '0 9 0');
      root.appendChild(text);

      return root;
    }

    function renderHotspotIcon(hs) {
      if (!hs || !hs.tipo) {
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('position', '0 0 0');
        sphere.setAttribute('radius', '16');
        sphere.setAttribute('color', 'red');
        return sphere;
      }

      if (hs.tipo === 'navegacao') {
        return createNavIcon(hs);
      }

      if (hs.tipo === 'texto') {
        const root = document.createElement('a-entity');
        const text = document.createElement('a-text');
        text.setAttribute('value', String(hs.conteudo || 'Texto'));
        text.setAttribute('color', 'white');
        text.setAttribute('width', '120');
        text.setAttribute('wrap-count', '22');
        text.setAttribute('anchor', 'center');
        text.setAttribute('align', 'center');
        text.setAttribute('baseline', 'center');
        text.setAttribute('side', 'double');
        text.setAttribute('position', '0 10 0');
        root.appendChild(text);
        return root;
      }

      if (hs.tipo === 'imagem') {
        const root = document.createElement('a-entity');
        if (hs.conteudo) {
          const img = document.createElement('a-image');
          img.setAttribute('src', normalizeRuntimeMediaUrl(hs.conteudo));
          img.setAttribute('width', '30');
          img.setAttribute('height', '30');
          img.setAttribute('position', '0 0 0');
          img.setAttribute('material', 'transparent: true; alphaTest: 0.050');
          img.setAttribute('shadow', 'cast: true; receive: true');
          root.appendChild(img);
          return root;
        }

        const fallbackRing = document.createElement('a-ring');
        fallbackRing.setAttribute('radius-inner', '5');
        fallbackRing.setAttribute('radius-outer', '7');
        fallbackRing.setAttribute('color', '#06b6d4');
        fallbackRing.setAttribute('material', 'side: double; alphaTest: 0.050');
        root.appendChild(fallbackRing);

        const fallbackText = document.createElement('a-text');
        fallbackText.setAttribute('value', 'Imagem?');
        fallbackText.setAttribute('color', 'white');
        fallbackText.setAttribute('width', '70');
        fallbackText.setAttribute('align', 'center');
        fallbackText.setAttribute('position', '0 9 0');
        root.appendChild(fallbackText);
        return root;
      }

      if (hs.tipo === 'imagem4p') {
        return createRingWithLabel('#0ea5e9', 'Imagem 4p');
      }

      if (hs.tipo === 'audio') {
        const root = createRingWithLabel('#a855f7', 'Audio');
        const sound = document.createElement('a-entity');
        sound.setAttribute(
          'sound',
          'src: url(' + normalizeRuntimeMediaUrl(hs.conteudo) + '); autoplay: true; loop: true; positional: false'
        );
        root.appendChild(sound);
        return root;
      }

      if (hs.tipo === 'audioespacial') {
        const root = createRingWithLabel('#7c3aed', 'Audio 3D');
        const sound = document.createElement('a-entity');
        sound.setAttribute(
          'sound',
          'src: url(' + normalizeRuntimeMediaUrl(hs.conteudo) + '); autoplay: true; loop: true; positional: true; refDistance: 50; rolloffFactor: 1;'
        );
        root.appendChild(sound);
        return root;
      }

      if (hs.tipo === 'video') {
        return createRingWithLabel('#f59e0b', hs.conteudo ? 'Video' : 'Video?');
      }

      if (hs.tipo === 'link') {
        const wrapper = document.createElement('a-entity');

        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('position', '0 0 0');
        sphere.setAttribute('radius', '16');
        sphere.setAttribute('color', '#ff2e63');
        wrapper.appendChild(sphere);

        const link = document.createElement('a-link');
        link.setAttribute('href', String(hs.conteudo || ''));
        link.setAttribute('title', String(hs.conteudo || ''));
        link.setAttribute('position', '0 0 0.5');
        link.setAttribute('scale', '16 16 1');
        wrapper.appendChild(link);
        return wrapper;
      }

      if (hs.tipo === 'modelo3d') {
        const modelSrc = normalizeRuntimeMediaUrl(hs.conteudo);
        if (!modelSrc) return null;
        const model = document.createElement('a-entity');
        model.setAttribute('gltf-model', modelSrc);
        model.setAttribute('position', '0 0 0');
        model.setAttribute('rotation', '0 0 0');
        model.setAttribute('scale', '1 1 1');
        model.setAttribute('shadow', 'cast: true; receive: true');
        return model;
      }

      if (hs.tipo === 'modelo3d_inspect') {
        const payload = decodeInspect3dValue(hs.conteudo);
        if (!payload || !payload.src) return null;

        const model = document.createElement('a-entity');
        model.setAttribute('gltf-model', normalizeRuntimeMediaUrl(payload.src));
        model.setAttribute('position', '0 0 0');
        model.setAttribute('rotation', '0 0 0');
        model.setAttribute('scale', '1 1 1');
        model.setAttribute('shadow', 'cast: true; receive: true');
        model.setAttribute('inspect-3d', 'axis: ' + payload.axis + '; speed: ' + payload.rotationSpeed + '; isInspecting: false');
        model.__inspect3dConfig = { axis: payload.axis, speed: payload.rotationSpeed };
        return model;
      }

      return null;
    }

    function syncInspectMode() {
      const activeId = window.__inspectModeHotspotId;
      const entities = window.__inspectEntities || {};
      Object.keys(entities).forEach((id) => {
        const entry = entities[id];
        const el = entry && entry.el ? entry.el : entry;
        if (!el) return;
        const config = (entry && entry.config) || el.__inspect3dConfig || { axis: 'y', speed: 1 };
        el.setAttribute('inspect-3d', 'axis: ' + (config.axis || 'y') + '; speed: ' + (config.speed || 1) + '; isInspecting: ' + (Number(id) === Number(activeId)));
      });
    }

    function ensureHotspotEvents(sceneEl) {
      if (!sceneEl || sceneEl.__hotspotClickBound) return;

      const handler = (e) => {
        const target = e && e.target;
        if (!target || !target.classList || !target.classList.contains('hotspot-interaction')) return;
        const id = Number(target.dataset && target.dataset.id);
        if (!Number.isFinite(id)) return;

        const list = Array.isArray(window.currentHotspots) ? window.currentHotspots : [];
        const hs = list.find((h) => Number(h && h.id_hotspot) === id || Number(h && h.id) === id);
        if (!hs) return;

        if (hs.tipo === 'modelo3d_inspect') {
          window.__inspectModeHotspotId = (Number(window.__inspectModeHotspotId) === Number(id)) ? null : id;
          syncInspectMode();
          return;
        }

        if (hs.tipo === 'navegacao') {
          if (hs.navigation_mode === 'back') {
            sendMessage({ action: 'navigateBack' });
            return;
          }
          if (hs.id_ponto_destino) {
            sendMessage({ action: 'navigatePoint', pointId: Number(hs.id_ponto_destino) });
            return;
          }
          if (hs.navigation_mode === 'file') {
            sendMessage({
              action: 'navigateFile',
              fileUrl: String(hs.navigation_file_url || ''),
              filePath: String(hs.navigation_file_path || ''),
            });
            return;
          }
          return;
        }

        if (hs.tipo === 'link' && hs.conteudo) {
          sendMessage({ action: 'openLink', url: String(hs.conteudo) });
        }
      };

      sceneEl.addEventListener('click', handler);
      sceneEl.__hotspotClickBound = true;
    }

    // Função exportada para o RN injetar e atualizar estado
    window.updateHotspots = function (hotspots) {
      registerWebLikeComponents();

      window.currentHotspots = Array.isArray(hotspots) ? hotspots : [];
      window.__inspectEntities = {};

      const hotspotsContainer = document.getElementById('hotspots-container');
      const overlaysContainer = document.getElementById('warp-overlays-container');
      clearChildren(hotspotsContainer);
      clearChildren(overlaysContainer);

      window.currentHotspots.forEach((hs) => {
        const id = Number(hs && (hs.id_hotspot || hs.id));

        // 1) imagem4p overlay (sempre, independentemente de hide_icon)
        if (hs && hs.tipo === 'imagem4p') {
          const payload = decodeImage4pValue(hs.conteudo);
          if (payload && payload.src && Array.isArray(payload.points) && payload.points.length >= 4) {
            const overlay = document.createElement('a-entity');
            overlay.setAttribute(
              'warp-image',
              'src: ' + normalizeRuntimeMediaUrl(payload.src) + '; points: ' + encodeURIComponent(JSON.stringify(payload.points || [])) + '; opacity: ' + (Number.isFinite(Number(payload.opacity)) ? payload.opacity : 1) + '; brightness: ' + (Number.isFinite(Number(payload.brightness)) ? payload.brightness : 1) + '; inset: ' + (Number.isFinite(Number(payload.inset)) ? payload.inset : 0.6) + '; rotateDeg: ' + (Number.isFinite(Number(payload.rotateDeg)) ? payload.rotateDeg : 0) + '; flipX: ' + (payload.flipX ? true : false) + '; flipY: ' + (payload.flipY ? true : false) + '; depthMode: ' + (payload.depthMode === 'occlusion-mask' ? 'occlusion-mask' : 'none') + '; occlusionMaskPoints: ' + encodeURIComponent(JSON.stringify(payload.occlusionMaskPoints || [])) + '; occlusionMaskInset: ' + (Number.isFinite(Number(payload.occlusionMaskInset)) ? payload.occlusionMaskInset : 0) + '; doubleSided: true'
            );
            overlaysContainer && overlaysContainer.appendChild(overlay);
          }
        }

        // 2) hotspot root
        const root = document.createElement('a-entity');
        root.setAttribute('class', 'hotspot-root');
        if (Number.isFinite(id)) {
          root.setAttribute('data-id', String(id));
        }
        root.setAttribute('position', (Number(hs && hs.x) || 0) + ' ' + (Number(hs && hs.y) || 0) + ' ' + (Number(hs && hs.z) || 0));
        root.setAttribute('rotation', (Number(hs && hs.rot_pitch) || 0) + ' ' + (Number(hs && hs.rot_yaw) || 0) + ' 0');
        const scale = clampHotspotScale(hs && hs.scale);
        root.setAttribute('scale', scale + ' ' + scale + ' ' + scale);
        root.setAttribute('shadow', 'cast: true; receive: true');

        const shouldHideIcon = Boolean(hs && hs.hide_icon);
        if (!shouldHideIcon) {
          const icon = renderHotspotIcon(hs);
          if (icon) {
            root.appendChild(icon);
            if (hs && hs.tipo === 'modelo3d_inspect' && Number.isFinite(id)) {
              window.__inspectEntities[id] = { el: icon, config: icon.__inspect3dConfig || { axis: 'y', speed: 1 } };
            }
          }
        } else if (hs && hs.tipo === 'modelo3d_inspect') {
          // Mesmo com ícone oculto, manter entidade para poder inspecionar/rodar caso seja ativada.
          const icon = renderHotspotIcon(hs);
          if (icon) {
            icon.setAttribute('visible', false);
            root.appendChild(icon);
            if (Number.isFinite(id)) {
              window.__inspectEntities[id] = { el: icon, config: icon.__inspect3dConfig || { axis: 'y', speed: 1 } };
            }
          }
        }

        // Interaction plane (sempre presente, tal como no web)
        const plane = document.createElement('a-plane');
        plane.setAttribute('class', 'clickable hotspot-interaction');
        if (Number.isFinite(id)) {
          plane.dataset.id = String(id);
        }
        plane.setAttribute('position', '0 0 0');
        plane.setAttribute('width', '25');
        plane.setAttribute('height', '25');
        plane.setAttribute('material', 'color: #fff; opacity: 0; side: double; alphaTest: 1.000');
        plane.setAttribute('transparent', 'true');
        plane.setAttribute('rotation', '0 0 0');
        plane.setAttribute('shadow', 'cast: false; receive: false');
        root.appendChild(plane);

        hotspotsContainer && hotspotsContainer.appendChild(root);
      });

      syncInspectMode();

      const scene = document.querySelector('a-scene');
      ensureHotspotEvents(scene);
    };

    // Handle panorama load errors + notify RN when ready.
    registerWebLikeComponents();

    document.addEventListener('DOMContentLoaded', () => {
      const scene = document.querySelector('a-scene');
      let readySent = false;

      function notifyReady() {
        if (readySent) return;
        readySent = true;
        sendMessage({ status: 'ready' });
      }

      if (scene) {
        if (scene.hasLoaded) {
          notifyReady();
        } else {
          scene.addEventListener('loaded', notifyReady, { once: true });
        }
      } else {
        notifyReady();
      }

      // Fallback: se a cena nunca emitir 'loaded' (raro), notificar ao fim de 5s
      setTimeout(function () {
        if (!readySent) {
          notifyReady();
        }
      }, 5000);


      ensureHotspotEvents(scene);
    });
`;
}

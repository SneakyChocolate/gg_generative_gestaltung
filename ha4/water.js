// Hinweis: Dieser Code wurde mit KI (Claude) generiert.
// Planare Spiegelung nur der Feuerwerkspartikel, Prinzip wie three.js Reflector (Spiegelkamera + Render Target):
// https://github.com/mrdoob/three.js/blob/r160/examples/jsm/objects/Reflector.js
// Fresnel nach Schlick: https://en.wikipedia.org/wiki/Schlick%27s_approximation

import * as THREE from 'three';

const RESOLUTION = 0.2  ;
const REFLECTIVITY = 1.0;
const MIN_FRESNEL = 0.15;
const WATER_COLOR = 0x01030c;
const RIPPLE_STRENGTH = 0.15;
const RIPPLE_NEAR = 30;
const RIPPLE_VERTICAL = 0.3;
const RIPPLE_SPEED = 1;
const STREAK_LENGTH = 0.1;
const STREAK_TAPS = 12;
const MAX_POINT_SIZE = 24;

const vertexShader = `
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragmentShader = `
uniform sampler2D reflection;
uniform mat4 mirrorViewProjection;
uniform vec3 waterColor;
uniform float time;
varying vec3 vWorld;

const float RIPPLE_STRENGTH = ${RIPPLE_STRENGTH.toFixed(3)};
const float RIPPLE_NEAR = ${RIPPLE_NEAR.toFixed(1)};
const float STREAK_LENGTH = ${STREAK_LENGTH.toFixed(3)};
const int STREAK_TAPS = ${STREAK_TAPS};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 ripple(vec2 p, float t) {
  return vec2(
    sin(p.x * 1.9 + p.y * 0.8 + t * 1.7) + 0.5 * sin(p.x * 4.7 - p.y * 2.3 - t * 2.9) + 0.35 * sin(p.x * 9.7 + p.y * 7.3 + t * 4.3),
    sin(p.y * 1.5 - p.x * 0.6 + t * 1.3) + 0.5 * sin(p.y * 3.9 + p.x * 3.4 + t * 2.3)
  );
}

void main() {
  vec4 clip = mirrorViewProjection * vec4(vWorld, 1.0);
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  uv += ripple(vWorld.xz, time) * vec2(1.0, ${RIPPLE_VERTICAL.toFixed(3)}) * RIPPLE_STRENGTH / max(clip.w, RIPPLE_NEAR);
  float jitter = hash(gl_FragCoord.xy + fract(time) * 61.0) - 0.5;

  vec3 reflected = vec3(0.0);
  float totalWeight = 0.0;
  for (int n = 0; n < STREAK_TAPS; n++) {
    float along = (float(n) + jitter) / float(STREAK_TAPS - 1) * 2.0 - 1.0;
    float weight = exp(-3.0 * along * along);
    reflected += texture2D(reflection, uv + vec2(0.0, along * STREAK_LENGTH)).rgb * weight;
    totalWeight += weight;
  }
  reflected /= totalWeight;

  float facing = abs(normalize(cameraPosition - vWorld).y);
  float fresnel = mix(${MIN_FRESNEL.toFixed(3)}, 1.0, pow(1.0 - facing, 5.0));
  gl_FragColor = vec4(waterColor + reflected * fresnel * ${REFLECTIVITY.toFixed(3)}, 1.0);
}`;

export function createWaterReflection(renderer, pools, fog) {
  const scene = new THREE.Scene();
  scene.fog = fog;
  for (const pool of pools) {
    const material = pool.points.material.clone();
    material.size *= RESOLUTION;
    material.opacity *= pool.reflectionGain ?? 1;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>\n  gl_PointSize = min(gl_PointSize, ${MAX_POINT_SIZE.toFixed(1)});`
      );
    };
    const points = new THREE.Points(pool.geometry, material);
    points.frustumCulled = false;
    scene.add(points);
  }

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const mirrorCamera = new THREE.PerspectiveCamera();
  mirrorCamera.matrixAutoUpdate = false;
  mirrorCamera.matrixWorldAutoUpdate = false;
  const mirror = new THREE.Matrix4();
  const size = new THREE.Vector2();
  const waterPosition = new THREE.Vector3();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      reflection: { value: target.texture },
      mirrorViewProjection: { value: new THREE.Matrix4() },
      waterColor: { value: new THREE.Color(WATER_COLOR) },
      time: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  function resize() {
    renderer.getDrawingBufferSize(size).multiplyScalar(RESOLUTION).floor();
    target.setSize(size.x, size.y);
  }
  resize();

  return {
    resize,

    setWater(mesh) {
      mesh.material = material;
      const y = mesh.getWorldPosition(waterPosition).y;
      mirror.set(
        1, 0, 0, 0,
        0, -1, 0, 2 * y,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
    },

    render(camera, time) {
      camera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      mirrorCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      mirrorCamera.matrixWorld.multiplyMatrices(mirror, camera.matrixWorld);
      mirrorCamera.matrixWorldInverse.copy(mirrorCamera.matrixWorld).invert();
      material.uniforms.mirrorViewProjection.value.multiplyMatrices(mirrorCamera.projectionMatrix, mirrorCamera.matrixWorldInverse);
      material.uniforms.time.value = time * RIPPLE_SPEED;

      renderer.setRenderTarget(target);
      renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(null);
    },
  };
}

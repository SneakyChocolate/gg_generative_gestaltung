// Screen-Space Lens Flare (Ghosts + Halo + chromatische Aberration) für p5.js
// Quelle: John Chapman (2013): "Pseudo Lens Flare",
// https://john-chapman-graphics.blogspot.com/2013/02/pseudo-lens-flare.html
// Idee: helle Bildbereiche per Threshold filtern, an der Bildmitte spiegeln und
// entlang der Linie Pixel -> Mitte mehrfach versetzt aufaddieren ("Ghosts").

const LENS_FLARE_MAX_GHOSTS = 8;

const LENS_FLARE_VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;
  gl_Position = p;
}`;

const LENS_FLARE_FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D uTex;
uniform int uGhosts;
uniform float uDispersal;
uniform float uHaloWidth;
uniform float uDistortion;
uniform float uThreshold;
uniform float uIntensity;
uniform float uFalloff;

vec3 brightSample(vec2 uv, vec2 dir) {
  vec3 c = vec3(
    texture2D(uTex, uv - dir * uDistortion).r,
    texture2D(uTex, uv).g,
    texture2D(uTex, uv + dir * uDistortion).b
  );
  return max(c - vec3(uThreshold), vec3(0.0));
}

void main() {
  vec2 uv = vec2(1.0 - vTexCoord.x, vTexCoord.y);
  vec2 toCenter = vec2(0.5) - uv;
  vec2 ghostVec = toCenter * uDispersal;
  vec2 dir = normalize(toCenter);
  vec3 result = vec3(0.0);

  for (int i = 0; i < ${LENS_FLARE_MAX_GHOSTS}; i++) {
    if (i >= uGhosts) break;
    vec2 offset = fract(uv + ghostVec * float(i));
    float w = pow(1.0 - length(vec2(0.5) - offset) / 0.70710678, uFalloff);
    vec3 tint = 0.5 + 0.5 * cos(6.2831853 * (float(i) / float(uGhosts) + vec3(0.0, 0.33, 0.67)));
    result += brightSample(offset, dir) * w * mix(vec3(1.0), tint, 0.6);
  }

  vec2 haloVec = normalize(ghostVec) * uHaloWidth;
  float hw = pow(1.0 - length(vec2(0.5) - fract(uv + haloVec)) / 0.70710678, uFalloff * 0.5);
  result += brightSample(uv + haloVec, dir) * hw;

  gl_FragColor = vec4(result * uIntensity, 1.0);
}`;

class LensFlare {
  constructor(opts = {}) {
    Object.assign(this, {
      resolution: 0.25,
      ghosts: 5,
      dispersal: 0.35,
      haloWidth: 0.45,
      distortion: 0.02,
      threshold: 0.6,
      intensity: 2.0,
      falloff: 2.0,
    }, opts);
    this.buffer = createGraphics(
      max(1, floor(width * this.resolution)),
      max(1, floor(height * this.resolution)),
      WEBGL
    );
    this.buffer.noStroke();
    this.shader = this.buffer.createShader(LENS_FLARE_VERT, LENS_FLARE_FRAG);
  }

  render(source) {
    const b = this.buffer;
    b.clear();
    b.shader(this.shader);
    this.shader.setUniform('uTex', source);
    this.shader.setUniform('uGhosts', min(this.ghosts, LENS_FLARE_MAX_GHOSTS));
    this.shader.setUniform('uDispersal', this.dispersal);
    this.shader.setUniform('uHaloWidth', this.haloWidth);
    this.shader.setUniform('uDistortion', this.distortion);
    this.shader.setUniform('uThreshold', this.threshold);
    this.shader.setUniform('uIntensity', this.intensity);
    this.shader.setUniform('uFalloff', this.falloff);
    b.rect(0, 0, b.width, b.height);
    return b;
  }

  draw(source) {
    this.render(source);
    blendMode(ADD);
    image(this.buffer, 0, 0, width, height);
    blendMode(BLEND);
  }
}

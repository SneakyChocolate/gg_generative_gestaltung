// Dual-Filtering Bloom (Kawase-Familie) für p5.js
// Quellen: Masaki Kawase (GDC 2003): "Frame Buffer Postprocessing Effects in DOUBLE-S.T.E.A.L";
// Marius Bjørge (ARM, SIGGRAPH 2015): "Bandwidth-Efficient Rendering" (Dual Filtering).
// Idee: Bild stufenweise halbieren (5-Tap-Downsample), danach stufenweise wieder
// verdoppeln (8-Tap-Upsample). Jede Stufe weitet den Blur, die Kosten sinken pro Stufe.

const BLOOM_VERT = `
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

const BLOOM_DOWN_FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D uTex;
uniform vec2 uHalfPixel;
uniform float uOffset;
uniform float uThreshold;

vec3 bright(vec2 uv) {
  return max(texture2D(uTex, uv).rgb - vec3(uThreshold), vec3(0.0));
}

void main() {
  vec2 uv = vTexCoord;
  vec2 o = uHalfPixel * uOffset;
  vec3 sum = bright(uv) * 4.0;
  sum += bright(uv - o);
  sum += bright(uv + o);
  sum += bright(uv + vec2(o.x, -o.y));
  sum += bright(uv - vec2(o.x, -o.y));
  gl_FragColor = vec4(sum / 8.0, 1.0);
}`;

const BLOOM_UP_FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D uTex;
uniform vec2 uHalfPixel;
uniform float uOffset;
uniform float uGain;
uniform float uFlipY;

void main() {
  vec2 uv = vec2(vTexCoord.x, mix(vTexCoord.y, 1.0 - vTexCoord.y, uFlipY));
  vec2 o = uHalfPixel * uOffset;
  vec3 sum = texture2D(uTex, uv + vec2(-o.x * 2.0, 0.0)).rgb;
  sum += texture2D(uTex, uv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture2D(uTex, uv + vec2(0.0, o.y * 2.0)).rgb;
  sum += texture2D(uTex, uv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture2D(uTex, uv + vec2(o.x * 2.0, 0.0)).rgb;
  sum += texture2D(uTex, uv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture2D(uTex, uv + vec2(0.0, -o.y * 2.0)).rgb;
  sum += texture2D(uTex, uv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(sum / 12.0 * uGain, 1.0);
}`;

class DualBloom {
  constructor(opts = {}) {
    Object.assign(this, {
      levels: 4,
      threshold: 0.3,
      intensity: 1.5,
      offset: 1.0,
    }, opts);
    this.input = createGraphics(max(1, floor(width / 2)), max(1, floor(height / 2)));
    this.input.pixelDensity(1);
    this.chain = [];
    for (let i = 0; i < this.levels; i++) {
      const g = createGraphics(
        max(1, floor(width / 2 ** (i + 1))),
        max(1, floor(height / 2 ** (i + 1))),
        WEBGL
      );
      g.noStroke();
      g.downShader = g.createShader(BLOOM_VERT, BLOOM_DOWN_FRAG);
      g.upShader = g.createShader(BLOOM_VERT, BLOOM_UP_FRAG);
      this.chain.push(g);
    }
  }

  pass(target, shader, source, uniforms) {
    target.clear();
    target.shader(shader);
    shader.setUniform('uTex', source);
    shader.setUniform('uOffset', this.offset);
    for (const key in uniforms) shader.setUniform(key, uniforms[key]);
    target.rect(0, 0, target.width, target.height);
  }

  render(sourceCanvas) {
    this.input.drawingContext.drawImage(sourceCanvas, 0, 0, this.input.width, this.input.height);
    this.chain.forEach((target, i) => {
      const source = i === 0 ? this.input : this.chain[i - 1];
      this.pass(target, target.downShader, source, {
        uHalfPixel: [0.5 / target.width, 0.5 / target.height],
        uThreshold: i === 0 ? this.threshold : 0,
      });
    });
    for (let i = this.levels - 2; i >= 0; i--) {
      this.pass(this.chain[i], this.chain[i].upShader, this.chain[i + 1], {
        uHalfPixel: [0.5 / this.chain[i + 1].width, 0.5 / this.chain[i + 1].height],
        uGain: i === 0 ? this.intensity : 1,
        uFlipY: i === 0 ? 1 : 0,
      });
    }
    return this.chain[0];
  }

  draw(sourceCanvas) {
    this.render(sourceCanvas);
    blendMode(ADD);
    image(this.chain[0], 0, 0, width, height);
    blendMode(BLEND);
  }
}

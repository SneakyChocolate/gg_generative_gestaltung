export const CONFIG = {
  // CONFIG: Wort der Kerze. Grossbuchstaben geben allen Dochten dieselbe
  // Hoehe; kleinere Buchstaben funktionieren ebenfalls (Docht sitzt dann
  // auf dem jeweiligen Hochpunkt).
  word: 'WEIHNACHTEN',

  // MODEL: 'text' = TextGeometry, 'external' = .gltf/.glb/.obj,
  // 'fallback' = Zylinder. Bei einem Ladefehler faellt alles auf den
  // Zylinder zurueck, damit die Szene immer laeuft.
  model: 'text',
  externalModelUrl: '',

  // PHYSICS: 'metaballs' = weiches Canvas-Metaballfeld fuer Pfuetzen,
  // 'discs' = einzelne abgeflachte Instanzen (schneller, haertere Kanten).
  physicsMode: 'metaballs',

  // TABLE: Kollisionsebene. Der Partner kann diesen Wert an seinen Tisch
  // anpassen; Tropfen, Splitter und Pfuetzen benutzen ausschliesslich ihn.
  tableY: 0,

  loopSeconds: 92,
  bloom: true,

  camera: {
    fov: 38,
    height: 3.0,
    offsetX: 0.55,
    targetY: 0.92,
    margin: 1.08,
  },

  text: {
    size: 0.92,
    depth: 0.52,
    spacing: 0.11,
    curveSegments: 4,
    bevelThickness: 0.03,
    bevelSize: 0.022,
    bevelSegments: 2,
    fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/gentilis_bold.typeface.json',
    fallbackFontUrl: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
  },

  wick: {
    height: 0.18,
    radius: 0.012,
    burnSpeed: 0.0018,
    igniteGap: 0.16,
    igniteDuration: 0.72,
    lightEvery: 2,
  },

  heat: {
    // Zwei Zonen: der Kern direkt an der Flamme und ein breiter Halo.
    // Der Halo sorgt dafuer, dass auch die Nachbarvertices weich werden,
    // bevor sie vom Docht direkt erreicht sind.
    radius: 0.82,
    haloRadius: 1.55,
    haloStrength: 0.48,
    heatRate: 2.35,
    coolRate: 0.68,
    // Waermeleitung entlang der Mesh-Kanten: Hitze kriecht in die
    // Umgebung, statt nur einen runden Fleck zu erzeugen.
    diffusion: 2.6,
    meltThreshold: 0.34,
    sagRate: 0.085,
    maxSag: 0.27,
    normalFlow: 0.19,
    // Fluid-Relaxation: heisse Vertices werden geglaettet und stossen
    // sich ab, wenn sich Kanten zu stark zusammendruecken.
    flow: 2.8,
    repulsion: 0.42,
    minSpacing: 0.024,
    neckStart: 0.52,
    neckAmount: 0.34,
  },

  melt: {
    dropInterval: 1.35,
    dropJitter: 0.95,
    dropPush: 0.32,
    gravity: 4.8,
    drag: 0.75,
    maxDrops: 90,
    radiusMin: 0.028,
    radiusMax: 0.056,
  },

  puddles: {
    max: 70,
    thicknessStart: 0.032,
    thicknessMin: 0.011,
    thicknessRate: 0.00018,
    volumeScale: 2.2,
    mergeFactor: 0.72,
    canvasWidth: 768,
    depth: 3.4,
    margin: 1.15,
    coolRate: 0.16,
  },

  shards: {
    max: 10,
    gravity: 6.5,
    drag: 0.35,
    restMeltDelay: 2.4,
    stressBase: 2.6,
    stressWidth: 2.1,
    cooldown: 13.0,
    // Ein kleiner Steg haelt den abknickenden Wachslappen, bis das
    // geschmolzene Gewicht darueber zu gross wird.
    bridgeHeat: 0.45,
    minChunkRatio: 0.035,
    // Der Deckel eines Zylinders macht allein schon ~25 % der Dreiecke aus.
    // Die Obergrenze muss also etwas groesser sein, damit auch das
    // Fallback-Modell sauber brechen kann.
    maxChunkRatio: 0.34,
  },

  wind: {
    strength: 0.55,
    flameSway: 0.055,
    dropPush: 0.42,
    smooth: 2.2,
  },

  smoke: { interval: 1.9, max: 10 },
};

export const COLORS = {
  background: 0x080604,
  fog: 0x0a0705,
  waxCold: [0.94, 0.87, 0.74],
  waxWarm: [1.0, 0.79, 0.48],
  waxHot: [0.95, 0.36, 0.12],
  puddleCool: [0.56, 0.47, 0.34],
  puddleWarm: [0.84, 0.54, 0.25],
  flameOuter: 0xff6418,
  flameMain: 0xffb24a,
  flameCore: 0xfff6d6,
  flameBlue: 0x4c9cff,
};

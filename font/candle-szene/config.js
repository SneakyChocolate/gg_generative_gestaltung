// CONFIG: Modellquelle "text" | "gltf" | "fallback"
export const MODEL_SOURCE = "text";
export const WORD = "ZEIT";
export const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";
export const SCENE_URL = "./scene.glb";
// CONFIG: Blender-Export, wird bei MODEL_SOURCE = "gltf" geladen, ein Mesh pro Buchstabe
export const GLTF_URL = "./models/zeit.glb";
export const LETTER_SIZE = 1;
export const LETTER_DEPTH = 0.33;
export const LETTER_GAP = 0.18;
export const BEVEL = 0.025;
export const TESSELLATE_EDGE = 0.05;
export const TESSELLATE_ITERATIONS = 10;
export const CELL_SIZE = 0.1;
export const SURFACE_CELL = 0.05;

export const GRAVITY = -3;
// TABLE: Oberkante des Tisches, der Partner-Tisch muss auf dieser Höhe liegen
export const TABLE_Y = 0;

export const BURN_SECONDS = 120;
export const FAST_FACTOR = 4;
export const MAX_FRAME_SECONDS = 0.05;
export const HEAT_RADIUS = 0.45;
export const CRATER = 2.5;
export const SAG = 0.05;
export const FLAME_HEAT_OFFSET = 0.12;
export const DEPOSIT_MELT_T = 0.5;
export const DEPOSIT_MELT_RATE = 1.5;
export const SPARE_VERTEX_FRACTION = 0.5;

export const SUPPORT_CHECK_SECONDS = 0.1;
export const HEAT_WEAKENING = 0.8;
export const CANTILEVER_STRENGTH = 20;
export const TIP_MAX_ANGLE = 0.25;
export const TIP_DISTANCE = 0.3;
export const SEAM_MARGIN = 0.06;
export const REST_GAP = 0.02;

export const DROP_INTERVAL = 10;
export const DROP_MIN_R = 0.045;
export const DROP_MAX_R = 0.075;
export const DROP_MIN_TEMPERATURE = 0.3;
export const DROP_MAX_TEMPERATURE = 0.85;
export const SLIDE_SPEED = 0.15;
export const COOL_SECONDS = 3;
export const MAX_DROPS_PER_LETTER = 3;
export const PUDDLE_SPREAD = 1.5;
export const PUDDLE_SINK = 0.8;
export const MC_RESOLUTION = 48;
export const MC_SUBTRACT = 12;
export const POOL_MARGIN = 0.15;

export const WAX_COLD = 0xf2e8d5;
export const WAX_WARM = 0xffd27a;
export const WAX_HOT = 0xff6a1f;
export const FLAME_LIGHT = 1.5;
export const BACKGROUND_COLOR = 0x07050a;
export const AMBIENT_SKY = 0x8a94b8;
export const AMBIENT_GROUND = 0x1a120c;
export const AMBIENT_INTENSITY = 0.5;
export const FILL_COLOR = 0xffd9a8;
export const FILL_INTENSITY = 0.6;
export const FILL_POSITION = [0, 1.3, 3.8];
// CAMERA: FOV und Abstand direkt hier anpassen
export const CAMERA_FOV = 30;
export const CAMERA_DISTANCE = 8.4;
export const CAMERA_POSITION = [0, 1.3, CAMERA_DISTANCE];
export const CAMERA_TARGET = [0, 0.45, 0];
// GLB-SZENE: zusätzliche Szene unabhängig von den Kerzen verschieben
export const SCENE_POSITION = [0, -2.7, 0];
export const SCENE_SCALE = 3.5;

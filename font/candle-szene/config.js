// CONFIG: Modellquelle "text" | "gltf" | "fallback"
export const MODEL_SOURCE = "text";
export const WORD = "ZEIT";
export const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";
// CONFIG: Blender-Export, wird bei MODEL_SOURCE = "gltf" geladen, ein Mesh pro Buchstabe
export const GLTF_URL = "./models/zeit.glb";
export const LETTER_SIZE = 1;
export const LETTER_DEPTH = 0.33;
export const LETTER_GAP = 0.18;
export const BEVEL = 0.025;
export const TESSELLATE_EDGE = 0.05;
export const TESSELLATE_ITERATIONS = 10;
export const CELL_SIZE = 0.1;

export const GRAVITY = -3;
// TABLE: Oberkante des Tisches, der Partner-Tisch muss auf dieser Höhe liegen
export const TABLE_Y = 0;

export const BURN_SECONDS = 120;
export const FAST_FACTOR = 4;
export const MAX_FRAME_SECONDS = 0.05;
export const HEAT_RADIUS = 0.45;
export const CRATER = 2.5;
export const SAG = 0.05;

export const BREAK_THICKNESS = 0.05;
export const WEIGHT_LEVERAGE = 0.3;
export const HEAT_WEAKENING = 0.8;

export const DROP_INTERVAL = 0.5;
export const DROP_MIN_R = 0.045;
export const DROP_MAX_R = 0.075;
export const DROP_MIN_TEMPERATURE = 0.3;
export const DROP_MAX_TEMPERATURE = 0.85;
export const SLIDE_SPEED = 0.15;
export const COOL_SECONDS = 10;
export const MAX_DROPS_PER_LETTER = 30;
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
export const CAMERA_FOV = 40;
export const CAMERA_POSITION = [0, 1.3, 3.8];
export const CAMERA_TARGET = [0, 0.45, 0];

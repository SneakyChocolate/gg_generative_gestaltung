const realwidth = window.innerWidth;
const realheight = window.innerHeight;
// used for drawing on the offscreen graphics which is then scaled to the real values (above)
const width = Math.floor(window.innerWidth / 6);
const height = Math.floor(window.innerHeight / 6);
// if seed < 0 then its random
const seed = -1;

var inc = 0.1;
var scl = 1;
var cols, rows;

var zoff = 0;

var particles = [];
var chunks;

var flowfield;
var flowstrength = 80;

var showDebug = false;
var showChunks = false;
var fps = 0;
var lastFpsUpdate = 0;

var world_noise;
var world_texture;
var cloud_texture;
var shadow_texture;
var light_texture;
var sky_texture;

const clouds_count = 140;
const cloud_edge_sharpness = 6; // higher = clouds get opaque faster above the threshold

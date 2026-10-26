/* Covenant Isle: terrain, buildings and props for the Bot Village.
   Everything is drawn in code on a 16-px grid, to the art bible in the style study:
   light from the top left, 5-6 step hue-shifted ramps, one shadow colour, detail on focal objects. */
'use strict';
window.VW = (function () {
const TILE = 16, MW = 128, MH = 96, WPX = MW * TILE, WPY = MH * TILE;

const PAL = {
  grass:      ['#1b3a33','#27553b','#3a7442','#57954a','#83b752','#c0d872'],
  alpine:     ['#162f33','#20463d','#2f5f45','#47794b','#6f9c57','#a6c47a'],
  sand:       ['#4f3b2c','#80633f','#b08c58','#d3b277','#ebcf96','#fbecc0'],
  dirt:       ['#35251f','#563c30','#7c5a43','#a07a57','#c39d73','#e2c294'],
  rock:       ['#1d1a28','#353048','#544c66','#7a7188','#a198ad','#cec5d4'],
  snow:       ['#4e5d80','#7f90b2','#aebcd6','#d6e1f0','#f4f8fd'],
  cobble:     ['#2a2433','#4a4152','#6d6270','#93877f','#b9ab95','#e0d3b4'],
  timber:     ['#24161f','#422629','#683d2e','#8f5a35','#b77f43','#dcab62'],
  plaster:    ['#5a4c5e','#887987','#b3a5a3','#d9ccb4','#f2e8cf'],
  printRoof:  ['#132530','#1d4146','#2a6352','#3f875c','#68ab64','#a3cf73'],
  crierRoof:  ['#341a29','#622b2d','#98402f','#c96334','#e89448','#f9c66b'],
  tailorRoof: ['#1f1430','#36204f','#52307a','#7146a3','#9a6ad0','#c9a8f5'],
  tavernRoof: ['#2a1418','#4f2224','#7a3330','#a44a3a','#c86d4e','#e9a072'],
  dojoRoof:   ['#2a1018','#561a22','#8a2630','#ba3a3c','#e0605a','#f7a08a'],
  hqRoof:     ['#141a33','#232f5c','#34468a','#4f66b8','#7a92d8','#b4c4f0'],
  water:      ['#0e1f45','#173a71','#2459a3','#3584c9','#62b4e3','#bfe9f3'],
  steel:      ['#1f2233','#363c55','#58607d','#8590ad','#bcc5dc','#eef2fb'],
  brass:      ['#4a2e14','#7c5219','#b3801f','#e0b23d','#ffe08a'],
  lamp:       ['#a8541c','#f08a2c','#ffc35a','#fff0b0'],
};
const SHADOW = '#120d26';

/* ---------- pixel helpers ---------- */
function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function R(c, x, y, w, h, col) { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function P(c, x, y, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
function ell(c, cx, cy, rx, ry, col) {
  rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry));
  if (ry === 0) { R(c, cx - rx, cy, rx * 2 + 1, 1, col); return; }
  for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); R(c, cx - hw, cy + dy, hw * 2 + 1, 1, col); }
}
function ring(c, cx, cy, rx, ry, col) {
  for (let dx = -rx; dx <= rx; dx++) { const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (rx * rx)))); P(c, cx + dx, cy + dy, col); P(c, cx + dx, cy - dy, col); }
  for (let dy = -ry; dy <= ry; dy++) { const dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); P(c, cx + dx, cy + dy, col); P(c, cx - dx, cy + dy, col); }
}
function fillPoly(c, pts, col) {
  c.fillStyle = col; const ys = pts.map(p => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
    const sy = y + .5, xs = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) * (bx - ax) / (by - ay)); }
    xs.sort((a, z) => a - z);
    for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]); if (xb > xa) c.fillRect(xa, y, xb - xa, 1); }
  }
}
function line(c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  for (;;) { P(c, x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function sprite(c, x, y, rows, pal, flip) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = flip ? r[r.length - 1 - i] : r[i]; const col = pal[ch]; if (col) P(c, x + i, y + j, col); } });
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x / 9, y / 9, s) * .6 + vnoise(x / 4.5, y / 4.5, s + 1) * .3 + vnoise(x / 2, y / 2, s + 2) * .1;

/* ---------- terrain ---------- */
const T = { SEA: 0, SHALLOW: 1, SAND: 2, GRASS: 3, PATH: 4, COBBLE: 5, STAIRS: 7, ROCK: 8, SNOW: 9, DOCK: 10, BRIDGE: 11, RAIL: 12, RIVER: 13 };
const N = MW * MH;
const ter = new Uint8Array(N), lv = new Int8Array(N), cliff = new Uint8Array(N), solid = new Uint8Array(N), reserve = new Uint8Array(N), deep = new Uint8Array(N), islet = new Uint8Array(N);
const id = (x, y) => y * MW + x, inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const isWater = t => t === T.SEA || t === T.SHALLOW || t === T.RIVER;
const MT = { cx: 64, cy: 16, rings: [[36, 21], [25, 14], [15, 8], [6, 3.5]] };
const LEVEL_NAME = ['', 'foothills', 'convert', 'define', 'summit'];

function levelAt(x, y) {
  let L = 0;
  for (let i = 0; i < 4; i++) {
    const [rx, ry] = MT.rings[i];
    const e = ((x + .5 - MT.cx) / rx) ** 2 + ((y + .5 - MT.cy) / ry) ** 2 + (vnoise(x / 3, y / 3, 20 + i) - .5) * .1;
    if (e < 1) L = i + 1; else break;
  }
  return L;
}
function islandAt(x, y) {
  const n = (s, k) => (fbm(x, y, s) - .5) * k;
  const isl = ((x - 108) / 8.5) ** 2 + ((y - 82) / 6.5) ** 2 + n(5, .3);
  if (isl < 1) return 2;
  if (isl < 2.1) return 0;
  const main = ((x - 62) / 52) ** 2 + ((y - 50) / 42) ** 2 + n(3, .5);
  const nw = ((x - 18) / 14) ** 2 + ((y - 18) / 11) ** 2 + n(6, .4);
  const ne = ((x - 108) / 12) ** 2 + ((y - 24) / 9.5) ** 2 + n(4, .4);
  const sw = ((x - 26) / 15) ** 2 + ((y - 70) / 11) ** 2 + n(7, .3);    // Crossroads Inn
  const se = ((x - 93) / 9) ** 2 + ((y - 77) / 7) ** 2 + n(8, .2);      // drawbridge approach
  return (main < 1 || nw < 1 || ne < 1 || sw < 1 || se < 1) ? 1 : 0;
}
function genTerrain() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), L = levelAt(x, y), isl = islandAt(x, y);
    lv[i] = L; islet[i] = isl === 2 ? 1 : 0;
    ter[i] = (L > 0 || isl > 0) ? T.GRASS : T.SEA;
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y);
    if (ter[i] === T.SEA) {
      let best = 99, close = false;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const X = x + dx, Y = y + dy; if (inb(X, Y) && ter[id(X, Y)] !== T.SEA && ter[id(X, Y)] !== T.SHALLOW) best = Math.min(best, Math.hypot(dx, dy)); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (inb(X, Y) && ter[id(X, Y)] !== T.SEA && ter[id(X, Y)] !== T.SHALLOW) close = true; }
      deep[i] = best > 2.4 + vnoise(x / 4, y / 4, 33) * 2.2 ? 1 : 0;
      if (close) ter[i] = T.SHALLOW;
    }
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y); if (ter[i] !== T.GRASS || lv[i] > 0) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (inb(X, Y) && isWater(ter[id(X, Y)])) ter[i] = T.SAND; }
  }
  for (let i = 0; i < N; i++) { if (lv[i] === 3) ter[i] = T.ROCK; if (lv[i] === 4) ter[i] = T.SNOW; }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), L = lv[i]; if (L === 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (inb(X, Y) && lv[id(X, Y)] < L) cliff[i] = 1; }
  }
  // south-facing cliffs are two tiles tall: the lower tile becomes the bottom of the rock face (cliff = 2)
  for (let y = 0; y < MH - 1; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), s = id(x, y + 1);
    if (cliff[i] === 1 && lv[s] < lv[i] && !isWater(ter[s]) && !cliff[s]) cliff[s] = 2;
  }
}
const STAIRS = {};
function carveStairs(x0, lower, name) {
  const got = [];
  for (const x of [x0, x0 + 1]) {
    let started = false;
    for (let y = MT.cy; y < MH; y++) {
      const i = id(x, y);
      if (cliff[i] === 1 && lv[i] === lower + 1) { cliff[i] = 0; ter[i] = T.STAIRS; got.push([x, y]); started = true; }
      else if (started) {
        // carry the stairs down through the bottom half of the face
        for (let yy = y; yy < MH && cliff[id(x, yy)] === 2; yy++) { cliff[id(x, yy)] = 0; ter[id(x, yy)] = T.STAIRS; got.push([x, yy]); }
        break;
      }
    }
  }
  STAIRS[name] = got;
}

/* ---------- roads ---------- */
const RAIL = [];
function mark(x, y, kind, w) {
  for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
    const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const i = id(X, Y);
    if (cliff[i] || ter[i] === T.STAIRS || ter[i] === T.DOCK) continue;
    if (kind === T.RAIL) { if (!isWater(ter[i]) && ter[i] !== T.RAIL) { ter[i] = T.RAIL; RAIL.push([X, Y]); } }
    else if (ter[i] === T.RIVER) ter[i] = T.BRIDGE;   // a river crossing: land on both banks
    else if (isWater(ter[i])) continue;          // roads stop at the sea
    else if (ter[i] !== T.BRIDGE && ter[i] !== T.COBBLE) ter[i] = kind;
    reserve[i] = Math.max(reserve[i], 1);
  }
}
function road(pts, kind = T.PATH, w = 2) {
  for (let k = 0; k + 1 < pts.length; k++) {
    let [x, y] = pts[k]; const [bx, by] = pts[k + 1];
    mark(x, y, kind, w);
    while (x !== bx) { x += Math.sign(bx - x); mark(x, y, kind, w); }
    while (y !== by) { y += Math.sign(by - y); mark(x, y, kind, w); }
  }
}
const SQUARE = { x: 64, y: 56, rx: 9, ry: 6 };
let HARBOR_END = null, BRIDGE_TILES = [];
function genRoads() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const e = ((x + .5 - SQUARE.x) / SQUARE.rx) ** 2 + ((y + .5 - SQUARE.y) / SQUARE.ry) ** 2;
    if (e < 1) { ter[id(x, y)] = T.COBBLE; reserve[id(x, y)] = 2; }
  }
  road([[63, 50], [63, 38]]);                                                              // to the foot of the mountain
  road([[64, 45], [70, 45]]);                                                              // dojo door
  road([[55, 56], [46, 56], [46, 46]]);                                                    // base camp
  road([[46, 50], [31, 50]]);                                                              // base camp to woods
  road([[72, 58], [109, 58]]);                                                             // press row and harbor
  road([[90, 58], [92, 58], [92, 40], [102, 40], [102, 27]]);                              // to the lighthouse
  road([[91, 54], [96, 54], [96, 37], [105, 37], [105, 28]], T.RAIL, 1);                   // Print to Crier rail
  road([[66, 62], [66, 72], [96, 72], [96, 80]]);                                          // to the drawbridge
  road([[46, 56], [40, 56], [40, 72], [30, 72]]);                                          // to the crossroads (forks off the base camp road)
  road([[30, 72], [6, 72]]);                                                               // to the west beach
  road([[30, 72], [30, 50], [23, 50], [23, 46]]);                                          // to the woods
  road([[22, 42], [22, 26], [18, 26], [18, 19]]);                                          // to the keep
  road([[23, 69], [23, 72]]);                                                              // inn door
  road([[30, 74], [30, 86]]);                                                              // to the beach
  road([[66, 74], [66, 84], [62, 84]]);                                                     // south: to the ruins, the dig and the cave
  road([[66, 73], [53, 73], [53, 76]]);                                                     // the ruins' north gate
  road([[67, 83], [81, 83], [81, 82]]);                                                     // the cave mouth
  // harbor dock: east from the road end into the sea
  let x = 98; while (x < MW && !isWater(ter[id(x, 58)])) x++;
  let n = 0; for (; x < MW - 1 && n < 7; x++, n++) for (const y of [58, 59]) { if (isWater(ter[id(x, y)])) { ter[id(x, y)] = T.DOCK; reserve[id(x, y)] = 1; } }
  HARBOR_END = [x - 1, 58];
  // drawbridge east from the road to the islet
  BRIDGE_TILES = []; x = 96;   // from the end of the road over to the islet
  while (x < MW && !islet[id(x, 80)]) { for (const y of [80, 81]) { const i = id(x, y); if (isWater(ter[i])) { ter[i] = T.BRIDGE; BRIDGE_TILES.push([x, y]); } else if (!islet[i]) ter[i] = T.PATH; reserve[i] = 1; } x++; }
  road([[x, 80], [x, 83], [108, 83]]);
}

/* ---------- river and waterfalls ---------- */
const FALLS = [];
function genRiver() {
  // a spring on the west side of Convert Camp, two waterfalls down the terraces, a lake by Base Camp,
  // then west through Whispering Woods to the sea
  const legs = [[[46, 15], [45, 20], [43, 25], [42, 30], [41, 34], [40, 36]], [[37, 38], [30, 39], [24, 38], [16, 39], [8, 38], [0, 38]]];
  const wet = (x, y) => {
    if (!inb(x, y)) return; const i = id(x, y);
    if (ter[i] === T.STAIRS) return;
    if (cliff[i]) { FALLS.push([x, y]); cliff[i] = 0; }
    if (!isWater(ter[i])) ter[i] = T.RIVER;
    reserve[i] = Math.max(reserve[i], 2);
  };
  legs.forEach(pts => { for (let k = 0; k + 1 < pts.length; k++) { const [ax, ay] = pts[k], [bx, by] = pts[k + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3; for (let j = 0; j <= n; j++) { const x = Math.round(ax + (bx - ax) * j / n), y = Math.round(ay + (by - ay) * j / n); wet(x, y); wet(x + 1, y); } } });
  for (let y = 33; y <= 41; y++) for (let x = 34; x <= 45; x++) if (((x - 39) / 4.2) ** 2 + ((y - 37) / 3.2) ** 2 < 1) wet(x, y);
}

/* ---------- switchback trails and campsites on the mountain ---------- */
const okLevel = (x, y, L) => inb(x, y) && lv[id(x, y)] === L && !cliff[id(x, y)] && !isWater(ter[id(x, y)]);
function nearOk(x, y, L) { for (let r = 0; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && okLevel(x + dx, y + dy, L)) return [x + dx, y + dy]; return null; }
function levelBfs(a, goal, L, avoid) {
  const prev = new Int32Array(N).fill(-1), st = id(a[0], a[1]), q = [st]; prev[st] = st;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % MW, y = (cur / MW) | 0;
    if (goal(x, y) && cur !== st) { const out = []; let k = cur; while (k !== st) { out.push([k % MW, (k / MW) | 0]); k = prev[k]; } return out.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!okLevel(nx, ny, L) || (avoid && avoid(nx, ny))) continue; const ni = id(nx, ny); if (prev[ni] !== -1) continue; prev[ni] = cur; q.push(ni); }
  }
  return null;
}
function layPath(path, wide) {
  path.forEach(([x, y]) => {
    for (const [dx, dy] of wide ? [[0, 0], [1, 0]] : [[0, 0]]) {
      const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const i = id(X, Y);
      if (cliff[i] || isWater(ter[i]) || ter[i] === T.STAIRS || lv[i] !== lv[id(x, y)]) continue;
      ter[i] = T.PATH; reserve[i] = Math.max(reserve[i], 1);
    }
  });
}
function genTrails() {
  const top = a => a.reduce((m, q) => q[1] < m[1] ? q : m), bot = a => a.reduce((m, q) => q[1] > m[1] ? q : m), S = STAIRS;
  // each terrace: in at the top of one stair, out at the foot of the next, by way of a swing across the slope
  const legs = [
    [1, [top(S.foot)[0], top(S.foot)[1] - 1], [[77, 33], [67, 30], [46, 31]], [bot(S.convert)[0], bot(S.convert)[1] + 1]],
    [2, [top(S.convert)[0], top(S.convert)[1] - 1], [[44, 22], [47, 11], [64, 4], [82, 11], [84, 22]], [bot(S.define)[0], bot(S.define)[1] + 1]],
    [3, [top(S.define)[0], top(S.define)[1] - 1], [[77, 15], [64, 9], [52, 14]], [bot(S.summit)[0], bot(S.summit)[1] + 1]],
    [4, [top(S.summit)[0], top(S.summit)[1] - 1], [], [63, 16]],
  ];
  legs.forEach(([L, a, mids, b]) => {
    const pts = [a, ...mids, b].map(q => okLevel(q[0], q[1], L) ? q : nearOk(q[0], q[1], L)).filter(Boolean);
    for (let k = 0; k + 1 < pts.length; k++) { const [gx, gy] = pts[k + 1], path = levelBfs(pts[k], (x, y) => x === gx && y === gy, L); if (path) layPath([pts[k], ...path], true); }
  });
}
const SLOT_ANGLES = { foothills: [150, 30, 180, 0, 122, 58], convert: [180, 0, 145, 35, 212, 328], define: [180, 0, 222, 318] };
function spurFrom(x, y, L) {
  const start = [x + 1, y + 2]; if (!okLevel(start[0], start[1], L)) return null;
  if (ter[id(start[0], start[1])] === T.PATH) return [start];
  const path = levelBfs(start, (px, py) => ter[id(px, py)] === T.PATH, L, (px, py) => reserve[id(px, py)] === 4 || (px >= x && px < x + 3 && py >= y && py < y + 2));
  return path ? [start, ...path] : null;
}

/* ---------- registries filled while drawing ---------- */
const objs = [];            // static drawables, sorted by base y
const inter = new Map();    // "x,y" -> interactable
const key = (x, y) => x + ',' + y;
const GLASS = [], LIGHTS = [], CHIMNEYS = [], CABLES = [];
const HOUSES = {}, BOTS = {}, PLACES = {}, STATIONS = {}, SLOTS = { foothills: [], convert: [], define: [] }, PEDESTALS = [], SHIP_SLOTS = [];
let LEVER = null, SUMMIT_GATE = [], SHRINE = null, LIGHTHOUSE = null, KEEP_AREA = null, CAMPFIRE = null;
function block(x, y, w = 1, h = 1, o) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (!inb(xx, yy)) continue; solid[id(xx, yy)] = 1; reserve[id(xx, yy)] = 3; if (o) inter.set(key(xx, yy), o); } }
function reserveAround(x, y, w, h, pad) { for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (inb(xx, yy)) reserve[id(xx, yy)] = Math.max(reserve[id(xx, yy)], 1); }
const walkable = (x, y) => inb(x, y) && !solid[id(x, y)] && !cliff[id(x, y)] && !isWater(ter[id(x, y)]);
function nearestWalkable(x, y) {
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (walkable(x + dx, y + dy)) return [x + dx, y + dy];
  }
  return [x, y];
}

/* ---------- ground drawing ---------- */
function rampOf(L) { return L === 2 ? PAL.alpine : PAL.grass; }
function tuft(c, x, y, g, kind) {
  if (kind === 0) { P(c, x + 1, y, g[4]); P(c, x, y + 1, g[3]); P(c, x + 1, y + 1, g[4]); P(c, x + 3, y + 1, g[4]); P(c, x + 2, y + 2, g[3]); P(c, x + 3, y + 2, g[3]); P(c, x + 1, y + 2, g[1]); P(c, x + 2, y + 3, g[1]); }
  else { P(c, x + 1, y, g[5]); P(c, x + 1, y + 1, g[4]); P(c, x, y + 2, g[4]); P(c, x + 2, y + 2, g[4]); P(c, x + 1, y + 2, g[3]); R(c, x, y + 3, 3, 1, g[1]); }
}
function stone(c, x, y, w, h, v, s = PAL.cobble) {
  const mid = v < .3 ? s[2] : v < .78 ? s[3] : s[4], hi = v < .3 ? s[3] : v < .78 ? s[4] : s[5], lo = v < .3 ? s[1] : s[2];
  R(c, x + 1, y, w - 2, h, mid); R(c, x, y + 1, w, h - 2, mid);
  R(c, x + 1, y, w - 2, 1, hi); R(c, x, y + 1, 1, h - 2, hi);
  R(c, x + 1, y + h - 1, w - 2, 1, lo); R(c, x + w - 1, y + 1, 1, h - 2, lo);
  if (v > .86) P(c, x + 3, y + 2, lo);
}
function clipTiles(c, pred, fn) {
  c.save(); c.beginPath();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (pred(id(x, y), x, y)) c.rect(x * TILE, y * TILE, TILE, TILE);
  c.clip(); fn(); c.restore();
}
function drawGround(c) {
  const wa = PAL.water;
  R(c, 0, 0, WPX, WPY, wa[2]);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), px = x * TILE, py = y * TILE, t = ter[i];
    if (t === T.SEA || t === T.DOCK || t === T.BRIDGE) {
      R(c, px, py, TILE, TILE, wa[2]);
    } else if (t === T.RIVER) {
      R(c, px, py, TILE, TILE, wa[3]);
      if (hash(x, y, 87) < .7) R(c, px + Math.floor(hash(x, y, 88) * 10), py + Math.floor(hash(x, y, 89) * 13), 5, 1, wa[4]);
      R(c, px + 3 + Math.floor(hash(x, y, 90) * 8), py + 7, 3, 1, wa[2]);
    } else if (t === T.SHALLOW) {
      R(c, px, py, TILE, TILE, wa[3]);
      if (hash(x, y, 84) < .5) R(c, px + Math.floor(hash(x, y, 85) * 12), py + Math.floor(hash(x, y, 86) * 14), 3, 1, wa[4]);
    } else if (t === T.SAND) {
      const s = PAL.sand; R(c, px, py, TILE, TILE, s[3]);
      for (let k = 0; k < 5; k++) P(c, px + Math.floor(hash(x, y, 90 + k) * 16), py + Math.floor(hash(y, x, 90 + k) * 16), k % 2 ? s[2] : s[4]);
    } else if (t === T.ROCK) {
      const r = PAL.rock; R(c, px, py, TILE, TILE, r[3]);
      for (let k = 0; k < 3; k++) { const sx = px + Math.floor(hash(x, y, 100 + k) * 12), sy = py + Math.floor(hash(x, y, 103 + k) * 12); R(c, sx, sy, 3, 1, r[2]); P(c, sx, sy - 1, r[4]); }
      if (hash(x, y, 107) < .35) { const g = PAL.alpine; const gx = px + Math.floor(hash(x, y, 108) * 10), gy = py + Math.floor(hash(x, y, 109) * 10); ell(c, gx + 3, gy + 2, 3, 1, g[2]); tuft(c, gx + 1, gy, g, 0); }
    } else if (t === T.SNOW) {
      const s = PAL.snow; R(c, px, py, TILE, TILE, s[3]);
      if (hash(x, y, 110) < .5) { const sx = px + Math.floor(hash(x, y, 111) * 10), sy = py + Math.floor(hash(x, y, 112) * 12); R(c, sx, sy, 5, 1, s[4]); R(c, sx + 1, sy + 1, 4, 1, s[2]); }
    } else {
      R(c, px, py, TILE, TILE, rampOf(lv[i])[2]);
    }
  }
  // deep water as overlapping rounded pools, so its edge isn't a staircase of tiles
  clipTiles(c, i => ter[i] === T.SEA || ter[i] === T.DOCK || ter[i] === T.BRIDGE, () => {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (deep[id(x, y)]) ell(c, x * TILE + 8, y * TILE + 8, 13, 11, wa[1]);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = id(x, y); if (!isWater(ter[i]) || hash(x, y, 81) >= .3) continue;
      const wx = x * TILE + Math.floor(hash(x, y, 82) * 10), wy = y * TILE + Math.floor(hash(x, y, 83) * 12);
      R(c, wx, wy, 4, 1, deep[i] ? wa[2] : wa[3]); P(c, wx + 1, wy - 1, wa[3]);
    }
  });
  // grass patches and tufts, clipped to grass so they never spill on roads or sand
  [[PAL.grass, i => (ter[i] === T.GRASS || ter[i] === T.RAIL) && lv[i] <= 1, 11], [PAL.alpine, i => ter[i] === T.GRASS && lv[i] === 2, 21]].forEach(([g, pred, s]) => {
    clipTiles(c, pred, () => {
      for (let k = 0; k < 900; k++) {
        const x = Math.floor(hash(k, 1, s) * WPX), y = Math.floor(hash(k, 2, s) * WPY);
        if (!pred(id(Math.floor(x / TILE), Math.floor(y / TILE)))) continue;
        const rx = 8 + Math.floor(hash(k, 3, s) * 18), ry = 3 + Math.floor(hash(k, 4, s) * 6);
        if (hash(k, 5, s) < .4) { ell(c, x, y, rx, ry, g[1]); ell(c, x - 1, y - 1, rx - 2, ry - 1, g[2]); } else ell(c, x, y, rx, ry, g[3]);
      }
      for (let y = 1; y < WPY; y += 5) for (let x = (y % 10 > 4 ? 3 : 0); x < WPX; x += 6) {
        const v = hash(x, y, 3 + s); if (v < .5) continue;
        if (!pred(id(Math.floor(x / TILE), Math.floor(y / TILE)))) continue;
        tuft(c, x + Math.floor(hash(x, y, 4) * 3), y + Math.floor(hash(x, y, 5) * 2), g, v > .9 ? 1 : 0);
      }
      for (let k = 0; k < 500; k++) {
        const x = Math.floor(hash(k, 7, s + 1) * WPX), y = Math.floor(hash(k, 8, s + 1) * WPY);
        if (!pred(id(Math.floor(x / TILE), Math.floor(y / TILE)))) continue;
        const v = hash(k, 9, s); P(c, x, y, v < .4 ? '#fff6e0' : v < .75 ? '#ffd34d' : '#ff8fa0'); P(c, x + 1, y + 1, g[1]);
      }
    });
  });
  // paths, cobbles, stairs, rail, docks, bridges
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), px = x * TILE, py = y * TILE, t = ter[i];
    if (t === T.PATH) {
      const d = lv[i] >= 3 ? PAL.cobble : PAL.dirt, b = lv[i] >= 3 ? 4 : 3;
      R(c, px, py, TILE, TILE, d[b]);
      for (let k = 0; k < 6; k++) { const sx = px + Math.floor(hash(x, y, 120 + k) * 15), sy = py + Math.floor(hash(x, y, 126 + k) * 15); P(c, sx, sy, k % 3 ? d[b - 1] : d[b + 1]); if (k % 3 === 0) P(c, sx + 1, sy, d[b - 1]); }
    } else if (t === T.COBBLE) {
      R(c, px, py, TILE, TILE, PAL.cobble[1]);
      for (let row = 0; row < 3; row++) { const off = (y * 3 + row) % 2 ? 5 : 0; for (let sx = px - off; sx < px + TILE; sx += 10) { const cx0 = Math.max(px, sx), w = Math.min(px + TILE, sx + 9) - cx0; if (w > 3) stone(c, cx0, py + row * 5 + 1, w, 4, hash(sx, py + row, 2)); } }
    } else if (t === T.STAIRS) {
      const r = PAL.rock; R(c, px, py, TILE, TILE, r[2]);
      for (let s = 0; s < 4; s++) { R(c, px + 1, py + s * 4, 14, 1, r[4]); R(c, px + 1, py + s * 4 + 1, 14, 2, r[3]); R(c, px + 1, py + s * 4 + 3, 14, 1, r[1]); }
      R(c, px, py, 1, TILE, r[1]); R(c, px + 15, py, 1, TILE, r[0]);
    } else if (t === T.RAIL) {
      const rn = (X, Y) => inb(X, Y) && ter[id(X, Y)] === T.RAIL, Nn = rn(x, y - 1), Sn = rn(x, y + 1), En = rn(x + 1, y), Wn = rn(x - 1, y);
      const tb = PAL.timber, st = PAL.steel, bl = PAL.cobble, horiz = (En || Wn) && !(Nn || Sn), vert = (Nn || Sn) && !(En || Wn);
      const gravel = (gx, gy, gw, gh) => { R(c, gx, gy, gw, gh, bl[2]); for (let k = 0; k < gw * gh / 6; k++) P(c, gx + Math.floor(hash(x * 9 + k, y, 180) * gw), gy + Math.floor(hash(y * 9 + k, x, 181) * gh), k % 3 ? bl[3] : bl[1]); };
      if (horiz || (!vert && !(Nn || Sn || En || Wn))) {
        gravel(px, py + 2, 16, 12);
        for (let k = 1; k < 16; k += 4) { R(c, px + k, py + 3, 2, 10, tb[2]); P(c, px + k, py + 3, tb[4]); R(c, px + k + 1, py + 4, 1, 8, tb[1]); P(c, px + k, py + 7, tb[1]); }
        [5, 10].forEach(o => { R(c, px, py + o, 16, 1, st[4]); R(c, px, py + o + 1, 16, 1, st[1]); P(c, px + (x % 2) * 8 + 3, py + o, st[5]); });
      } else if (vert) {
        gravel(px + 2, py, 12, 16);
        for (let k = 1; k < 16; k += 4) { R(c, px + 3, py + k, 10, 2, tb[2]); R(c, px + 3, py + k, 10, 1, tb[3]); P(c, px + 3, py + k, tb[4]); P(c, px + 8, py + k + 1, tb[1]); }
        [5, 10].forEach(o => { R(c, px + o, py, 1, 16, st[4]); R(c, px + o + 1, py, 1, 16, st[1]); });
      } else {
        // a curve: ballast, ties and two rails as quarter circles round the corner the two neighbours share
        const cx0 = En ? px + 16 : px, cy0 = Sn ? py + 16 : py;
        for (let yy = py; yy < py + 16; yy++) for (let xx = px; xx < px + 16; xx++) {
          const d = Math.hypot(xx + .5 - cx0, yy + .5 - cy0);
          if (d > 2 && d < 14) P(c, xx, yy, hash(xx, yy, 182) < .2 ? bl[3] : bl[2]);
        }
        for (let a = 0; a < 4; a++) { const g = (a + .5) / 4 * Math.PI / 2, ux = (En ? -1 : 1) * Math.cos(g), uy = (Sn ? -1 : 1) * Math.sin(g); line(c, cx0 + ux * 3, cy0 + uy * 3, cx0 + ux * 13, cy0 + uy * 13, tb[2]); }
        for (let yy = py; yy < py + 16; yy++) for (let xx = px; xx < px + 16; xx++) {
          const d = Math.hypot(xx + .5 - cx0, yy + .5 - cy0);
          if (Math.abs(d - 5.5) < .6 || Math.abs(d - 10.5) < .6) P(c, xx, yy, st[4]); else if (Math.abs(d - 6.4) < .4 || Math.abs(d - 11.4) < .4) P(c, xx, yy, st[1]);
        }
      }
    } else if (t === T.DOCK || t === T.BRIDGE) {
      const tb = PAL.timber, wet = (X, Y) => inb(X, Y) && isWater(ter[id(X, Y)]);
      const span = ter[id(x, y)] === T.BRIDGE || ter[id(x, y)] === T.DOCK;
      const ewRun = wet(x, y - 1) || wet(x, y + 1);          // water to the north or south: the deck runs east-west
      // deck boards laid across the direction of travel, each with a lit edge, a shaded edge and nail heads
      if (ewRun) for (let k = 0; k < 16; k += 4) { R(c, px + k, py + 2, 3, 12, tb[3]); R(c, px + k, py + 2, 1, 12, tb[4]); R(c, px + k + 3, py + 2, 1, 12, tb[1]); P(c, px + k + 1, py + 4, tb[1]); P(c, px + k + 1, py + 11, tb[1]); if (hash(x * 4 + k, y, 190) < .3) R(c, px + k + 1, py + 7, 1, 2, tb[2]); }
      else for (let k = 0; k < 16; k += 4) { R(c, px + 2, py + k, 12, 3, tb[3]); R(c, px + 2, py + k, 12, 1, tb[4]); R(c, px + 2, py + k + 3, 12, 1, tb[1]); P(c, px + 4, py + k + 1, tb[1]); P(c, px + 11, py + k + 1, tb[1]); }
      if (!ewRun) { R(c, px, py, 2, 16, tb[2]); R(c, px + 14, py, 2, 16, tb[1]); } else { R(c, px, py, 16, 2, tb[2]); R(c, px, py + 14, 16, 2, tb[1]); }
      if (t === T.BRIDGE) {
        // railings on the sides that face water: posts every 5px, a top rail, a shadow cast on the water below
        const rail = (side) => {
          if (side === 'n') { for (let k = 1; k < 16; k += 5) { R(c, px + k, py - 3, 2, 5, tb[1]); P(c, px + k, py - 3, tb[4]); } R(c, px, py - 3, 16, 1, tb[3]); R(c, px, py - 2, 16, 1, tb[1]); }
          if (side === 's') { for (let k = 1; k < 16; k += 5) { R(c, px + k, py + 10, 2, 5, tb[1]); P(c, px + k, py + 10, tb[4]); } R(c, px, py + 10, 16, 1, tb[4]); R(c, px, py + 11, 16, 1, tb[2]); c.save(); c.globalAlpha = .35; R(c, px + 2, py + 16, 16, 4, SHADOW); c.restore(); }
          if (side === 'w') { for (let k = 1; k < 16; k += 5) { R(c, px - 1, py + k, 3, 2, tb[1]); } R(c, px, py, 1, 16, tb[4]); }
          if (side === 'e') { for (let k = 1; k < 16; k += 5) { R(c, px + 14, py + k, 3, 2, tb[1]); } R(c, px + 15, py, 1, 16, tb[1]); c.save(); c.globalAlpha = .35; R(c, px + 16, py + 3, 4, 16, SHADOW); c.restore(); }
        };
        if (ewRun) { if (wet(x, y - 1)) rail('n'); if (wet(x, y + 1)) rail('s'); } else { if (wet(x - 1, y)) rail('w'); if (wet(x + 1, y)) rail('e'); }
      }
      if (wet(x, y + 1)) { R(c, px + 1, py + 16, 3, 4, tb[0]); R(c, px + 12, py + 16, 3, 4, tb[0]); P(c, px + 1, py + 20, PAL.water[5]); P(c, px + 14, py + 20, PAL.water[5]); }
      if (t === T.DOCK && hash(x, y, 191) < .25) { R(c, px + 6, py + 5, 4, 5, tb[1]); R(c, px + 6, py + 5, 4, 1, tb[4]); ell(c, px + 8, py + 11, 3, 1, '#c9b99c'); }
    }
  }
  // edges: foam on beaches, grass lips over paths
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), px = x * TILE, py = y * TILE, t = ter[i];
    if (t === T.SAND) {
      const s = PAL.sand;
      if (inb(x, y - 1) && isWater(ter[id(x, y - 1)])) { R(c, px, py, 16, 1, wa[5]); R(c, px, py + 1, 16, 1, s[5]); }
      if (inb(x, y + 1) && isWater(ter[id(x, y + 1)])) { R(c, px, py + 14, 16, 1, s[2]); R(c, px, py + 15, 16, 1, wa[5]); for (let k = 0; k < 16; k += 5) P(c, px + k + (y % 3), py + 16, wa[5]); }
      if (inb(x - 1, y) && isWater(ter[id(x - 1, y)])) { R(c, px, py, 1, 16, wa[5]); R(c, px + 1, py, 1, 16, s[5]); }
      if (inb(x + 1, y) && isWater(ter[id(x + 1, y)])) { R(c, px + 15, py, 1, 16, wa[5]); R(c, px + 14, py, 1, 16, s[2]); }
    }
    if (t === T.PATH || t === T.COBBLE || t === T.SAND) {
      const g = rampOf(lv[i]);
      const grassy = (X, Y) => inb(X, Y) && ter[id(X, Y)] === T.GRASS && !cliff[id(X, Y)];
      if (grassy(x, y - 1)) for (let k = 0; k < 16; k += 3) { P(c, px + k, py, g[2]); if (hash(x, y, k) < .5) P(c, px + k + 1, py + 1, g[1]); }
      if (grassy(x, y + 1)) for (let k = 1; k < 16; k += 3) { P(c, px + k, py + 15, g[3]); P(c, px + k + 1, py + 15, g[2]); }
      if (grassy(x - 1, y)) for (let k = 0; k < 16; k += 3) P(c, px, py + k, g[2]);
      if (grassy(x + 1, y)) for (let k = 1; k < 16; k += 3) P(c, px + 15, py + k, g[1]);
    }
  }
  // rounded coastlines: carve the outside corners of land, fill the inside corners of bays
  const landAt = (X, Y) => !inb(X, Y) ? false : !isWater(ter[id(X, Y)]) && ter[id(X, Y)] !== T.DOCK && ter[id(X, Y)] !== T.BRIDGE;
  const sandC = PAL.sand;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const here = landAt(x, y), px = x * TILE, py = y * TILE;
    if (!here && !isWater(ter[id(x, y)])) continue;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const a = landAt(x + dx, y), b = landAt(x, y + dy), d = landAt(x + dx, y + dy);
      const qx0 = dx > 0 ? px + 8 : px, qy0 = dy > 0 ? py + 8 : py;
      if (here && !a && !b && !d && !cliff[id(x, y)]) {
        // outside corner of land: water beyond a radius of 8 from the tile centre
        for (let yy = qy0; yy < qy0 + 8; yy++) for (let xx = qx0; xx < qx0 + 8; xx++) {
          const d2 = (xx + .5 - (px + 8)) ** 2 + (yy + .5 - (py + 8)) ** 2;
          if (d2 > 64) P(c, xx, yy, wa[3]); else if (d2 > 49) P(c, xx, yy, wa[5]); else if (d2 > 36 && ter[id(x, y)] === T.SAND) P(c, xx, yy, sandC[5]);
        }
      } else if (!here && a && b && d) {
        // inside corner of a bay: land within a radius of 7 from the shared corner
        const cx0 = dx > 0 ? px + 16 : px, cy0 = dy > 0 ? py + 16 : py;
        for (let yy = qy0; yy < qy0 + 8; yy++) for (let xx = qx0; xx < qx0 + 8; xx++) {
          const d2 = (xx + .5 - cx0) ** 2 + (yy + .5 - cy0) ** 2;
          if (d2 < 36) P(c, xx, yy, sandC[3]); else if (d2 < 49) P(c, xx, yy, wa[5]);
        }
      }
    }
  }
  // riverbanks: reeds and a wet edge where grass meets the river
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const i = id(x, y); if (ter[i] !== T.GRASS || cliff[i]) continue;
    const riv = (X, Y) => ter[id(X, Y)] === T.RIVER;
    if (!(riv(x - 1, y) || riv(x + 1, y) || riv(x, y - 1) || riv(x, y + 1))) continue;
    const g = rampOf(lv[i]), px = x * TILE, py = y * TILE;
    if (hash(x, y, 170) < .6) for (let k = 0; k < 4; k++) { const rx = px + 2 + Math.floor(hash(x, y, 171 + k) * 12), ry = py + 4 + Math.floor(hash(y, x, 171 + k) * 8); R(c, rx, ry, 1, 5, g[3]); P(c, rx, ry - 1, g[4]); if (k === 1) R(c, rx, ry - 2, 1, 2, PAL.timber[2]); }
  }
  // cliffs: rock faces on the south side, ledges elsewhere
  const r = PAL.rock;
  // strata keyed to the pixel column, so they run unbroken down both tiles of a face
  const strata = (px, x0, y0, y1, y) => {
    // rounded boulders stacked in columns, lit top-left, with crevices, cracks and the odd tuft of moss
    R(c, px, y0, 16, y1 - y0, r[1]);
    for (let k = 0; k < 16;) {
      const col = px + k, w = Math.min(3 + Math.floor(hash(col, 0, 151) * 5), 16 - k);
      for (let by = y0 - Math.floor(hash(col, 1, 155) * 7), n = 0; by < y1; n++) {
        const bh = 4 + Math.floor(hash(col, y * 7 + n, 156) * 6), top = Math.max(y0, by), bot = Math.min(y1, by + bh - 1);
        if (bot - top > 1 && w > 1) {
          const v = hash(col, y * 7 + n, 157), base = v < .3 ? r[2] : v < .85 ? r[3] : r[4];
          R(c, col, top, w - 1, bot - top, base);
          P(c, col, top, r[1]); P(c, col + w - 2, top, r[1]);
          R(c, col + 1, top, Math.max(1, w - 3), 1, v < .85 ? r[4] : r[5]);
          R(c, col, top + 1, 1, Math.max(0, bot - top - 2), v < .3 ? r[3] : r[4]);
          R(c, col + w - 2, top + 1, 1, bot - top - 1, r[2]);
          if (v > .6 && bot - top > 4 && w > 3) { P(c, col + 1 + Math.floor(v * (w - 3)), top + 2, r[1]); P(c, col + Math.floor(v * (w - 3)), top + 3, r[1]); }
          if (hash(col, n, 158) < .12) { P(c, col + 1, top, PAL.alpine[3]); P(c, col + 2, top, PAL.alpine[2]); P(c, col + 1, top + 1, PAL.alpine[2]); }
        }
        by += bh;
      }
      k += w;
    }
  };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y); if (!cliff[i]) continue;
    const L = lv[i], px = x * TILE, py = y * TILE, low = (X, Y) => inb(X, Y) && lv[id(X, Y)] < L;
    if (cliff[i] === 2) { strata(px, px, py, py + 13, y); R(c, px, py + 13, 16, 2, r[1]); R(c, px, py + 15, 16, 1, r[0]); for (let k = 2; k < 16; k += 5) P(c, px + k, py + 12, r[0]); continue; }
    const g = L >= 4 ? PAL.snow : L === 3 ? PAL.rock : rampOf(L);
    if (low(x, y + 1)) {
      const below = inb(x, y + 1) ? id(x, y + 1) : -1, tall = below >= 0 && cliff[below] === 2;
      strata(px, px, py + 3, py + 16, y);
      if (!tall) { R(c, px, py + 14, 16, 1, r[1]); R(c, px, py + 15, 16, 1, r[0]); }
      R(c, px, py, 16, 3, g[2]); R(c, px, py + 2, 16, 1, g[3]); R(c, px, py + 3, 16, 1, r[0]);
      for (let k = 0; k < 16; k += 2) { const len = Math.floor(hash(x * 16 + k, y, 141) * 3); R(c, px + k, py + 3, 1, len, k % 4 ? g[2] : g[1]); }
    }
    if (low(x, y - 1)) { R(c, px, py, 16, 2, r[2]); R(c, px, py + 2, 16, 1, r[4]); }
    if (low(x - 1, y)) { R(c, px, py, 4, 16, r[3]); R(c, px, py, 1, 16, r[4]); R(c, px + 3, py, 1, 16, r[1]); for (let yy = py + 2; yy < py + 16; yy += 5) P(c, px + 1, yy, r[2]); }
    if (low(x + 1, y)) { R(c, px + 12, py, 4, 16, r[2]); R(c, px + 15, py, 1, 16, r[0]); R(c, px + 12, py, 1, 16, r[3]); for (let yy = py + 3; yy < py + 16; yy += 5) P(c, px + 13, yy, r[1]); }
  }
}
function drawFallsAndScree(c) {
  const wa = PAL.water, r = PAL.rock, isF = (X, Y) => FALLS.some(f => f[0] === X && f[1] === Y);
  FALLS.forEach(([x, y]) => {
    const px = x * TILE, py = y * TILE;
    R(c, px, py, 16, 16, wa[4]);
    for (let k = 0; k < 16; k += 2) R(c, px + k, py, 1, 16, hash(x * 16 + k, 0, 91) < .5 ? wa[5] : wa[3]);
    if (!isF(x - 1, y)) { R(c, px, py, 2, 16, r[3]); P(c, px + 2, py + 5, wa[5]); }
    if (!isF(x + 1, y)) { R(c, px + 14, py, 2, 16, r[1]); }
    if (!isF(x, y + 1)) for (let k = 0; k < 7; k++) ell(c, px + 2 + Math.floor(hash(x, k, 92) * 12), py + 16 + Math.floor(hash(k, y, 93) * 4), 2, 1, k % 2 ? '#ffffff' : wa[5]);
  });
  // scree: loose rocks at the foot of the rock faces
  for (let y = 0; y < MH - 1; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), s = id(x, y + 1);
    const foot = cliff[i] === 2 || (cliff[i] === 1 && lv[s] < lv[i] && cliff[s] !== 2);
    if (!foot || cliff[s] || isWater(ter[s]) || ter[s] === T.STAIRS || ter[s] === T.PATH || hash(x, y, 160) > .55) continue;
    const sx = x * TILE + 3 + Math.floor(hash(x, y, 161) * 10), sy = (y + 1) * TILE + 4 + Math.floor(hash(x, y, 162) * 4);
    ell(c, sx, sy, 2, 1, r[1]); ell(c, sx - 1, sy - 1, 2, 1, r[3]); P(c, sx - 1, sy - 1, r[4]);
    if (hash(x, y, 163) < .5) { P(c, sx + 4, sy + 1, r[2]); P(c, sx + 3, sy, r[3]); }
  }
}
function drawShadows(c) {
  // shadows cast down-right by cliff faces onto the tile below
  c.fillStyle = SHADOW;
  for (let y = 0; y < MH - 1; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), s = id(x, y + 1); if (!cliff[i] || cliff[s] || isWater(ter[s])) continue;
    if (cliff[i] === 2 || lv[s] < lv[i]) c.fillRect(x * TILE + 3, (y + 1) * TILE, TILE, 6);
  }
}

/* ---------- buildings ---------- */
function beamV(c, x, y, w, h) { const t = PAL.timber; R(c, x, y, w, h, t[2]); R(c, x, y, 1, h, t[4]); R(c, x + w - 1, y, 1, h, t[1]); for (let yy = y + 3; yy < y + h; yy += 7) P(c, x + 1 + ((yy >> 2) & 1), yy, t[1]); }
function beamH(c, x, y, w, h) { const t = PAL.timber; R(c, x, y, w, h, t[2]); R(c, x, y, w, 1, t[4]); R(c, x, y + h - 1, w, 1, t[1]); }
function roof(c, hs) {
  // individual tiles: each one shaded from the ramp, lit on its top-left, rounded and darker where it
  // overlaps the row below, with a gap to its neighbour. Rows offset by half a tile.
  const r = hs.roof, x = hs.x - 5, w = hs.w + 10, y = hs.roofY, h = hs.roofH, TW = 7, TH = 5;
  R(c, x, y, w, h, r[0]);
  for (let row = 0, yy = y + 4; yy < y + h - 3; row++, yy += TH) {
    const prog = (yy - y) / h, off = row % 2 ? Math.floor(TW / 2) + 1 : 0;
    for (let xx = x - off; xx < x + w; xx += TW + 1) {
      const sx = Math.max(x + 1, xx), ex = Math.min(x + w - 1, xx + TW); if (ex - sx < 2) continue;
      const v = hash(xx, yy, hs.x), side = xx > x + w * .74 ? -1 : xx < x + w * .2 ? 1 : 0;
      let b = (prog < .35 ? 3 : 2) + side + (v < .18 ? -1 : v > .86 ? 1 : 0); b = Math.max(1, Math.min(4, b));
      const tw = ex - sx;
      R(c, sx, yy, tw, TH, r[b]);                                    // tile body
      R(c, sx, yy, tw - 1, 1, r[b + 1]);                             // lit top edge
      if (xx >= x) R(c, sx, yy + 1, 1, TH - 2, r[Math.min(5, b + 1)]); // lit left edge
      R(c, sx + 1, yy + TH - 1, Math.max(1, tw - 2), 1, r[b - 1]);    // rounded, shadowed bottom
      P(c, sx, yy + TH - 1, r[Math.max(0, b - 2)]); P(c, ex - 1, yy + TH - 1, r[Math.max(0, b - 2)]);
      R(c, ex - 1, yy + 1, 1, TH - 2, r[b - 1]);                     // shaded right edge
      if (v > .93) P(c, sx + 2, yy + 2, PAL.grass[2]);                // a little moss
      else if (v > .9) P(c, sx + 3, yy + 1, r[Math.max(0, b - 2)]);   // a chipped corner
    }
  }
  // ridge cap: half-round tiles along the top
  R(c, x, y, w, 4, r[1]);
  for (let xx = x + 1; xx < x + w - 1; xx += 5) { R(c, xx, y, 4, 3, r[3]); R(c, xx, y, 3, 1, r[4]); P(c, xx + 3, y + 2, r[1]); }
  R(c, x, y + 3, w, 1, r[0]);
  R(c, x, y, 1, h, r[0]); R(c, x + w - 1, y, 1, h, r[0]);
  R(c, x, y + h - 3, w, 2, PAL.timber[1]); R(c, x, y + h - 3, w, 1, PAL.timber[3]); R(c, x, y + h - 1, w, 1, r[0]);
}
function wall(c, hs) {
  const p = PAL.plaster, x = hs.x, y = hs.wallY, w = hs.w, h = hs.wallH;
  R(c, x, y, w, h, p[3]); R(c, x, y, 1, h, p[4]); R(c, x + w - 4, y, 4, h, p[2]); R(c, x + w - 1, y, 1, h, p[1]);
  for (let i = 0; i < Math.floor(w / 12); i++) { const px = x + 6 + Math.floor(hash(i, x, 21) * (w - 12)), py = y + 8 + Math.floor(hash(i, x, 22) * (h - 18)); R(c, px, py, 2, 1, p[2]); P(c, px + 1, py + 1, p[2]); P(c, px - 1, py, p[4]); }
  R(c, x, y + h - 7, w, 7, PAL.cobble[1]);
  for (let sx = x, i = 0; sx < x + w; sx += 9, i++) stone(c, sx, y + h - 7 + (i % 2), Math.min(9, x + w - sx), 6, hash(sx, y, 5));
  [0, w - 4, ...(hs.posts || [])].forEach(pv => beamV(c, x + pv, y, 4, h - 7));
  beamH(c, x, y + 4, w, 3); beamH(c, x, y + h - 10, w, 3);
  c.save(); c.globalAlpha = .4; R(c, x, y, w, 5, SHADOW); c.restore();
}
function windowAt(c, x, y, warm) {
  const t = PAL.timber, s = PAL.cobble, wa = PAL.water;
  R(c, x, y, 16, 14, t[1]); R(c, x + 1, y + 1, 14, 12, t[3]); R(c, x + 1, y + 1, 14, 1, t[4]);
  R(c, x + 2, y + 2, 12, 10, wa[2]); R(c, x + 2, y + 2, 12, 3, wa[3]);
  for (let i = 0; i < 4; i++) { P(c, x + 3 + i, y + 6 - i, wa[5]); P(c, x + 4 + i, y + 6 - i, wa[4]); }
  if (warm) { R(c, x + 2, y + 2, 3, 10, warm); R(c, x + 11, y + 2, 3, 10, warm); }
  R(c, x + 7, y + 2, 2, 10, t[2]); R(c, x + 2, y + 6, 12, 2, t[2]);
  R(c, x - 1, y + 14, 18, 2, s[4]); R(c, x - 1, y + 15, 18, 1, s[2]);
  GLASS.push({ x: x + 2, y: y + 2, w: 12, h: 10, mul: [x + 7, y + 6] });
  LIGHTS.push({ x: x + 8, y: y + 9, r: [7, 13, 20] });
}
function shutters(c, x, y, r) {
  [[x - 5, r[3], r[4]], [x + 17, r[2], r[3]]].forEach(([sx, mid, hi]) => {
    R(c, sx, y, 4, 14, r[1]); R(c, sx, y + 1, 3, 12, mid); R(c, sx, y + 1, 3, 1, hi);
    for (let yy = y + 3; yy < y + 13; yy += 3) R(c, sx, yy, 3, 1, r[1]);
  });
}
const FLOWERS = [['#8c2a4a', '#d8485f', '#ff8fa0'], ['#9a6a1a', '#ffd34d', '#fff1b0'], ['#4a2f7a', '#9a6ad8', '#c9a8f5'], ['#8f8794', '#f2e8cf', '#ffffff']];
function flowerBox(c, x, y) {
  const t = PAL.timber, g = PAL.grass;
  R(c, x - 1, y + 16, 18, 4, t[2]); R(c, x - 1, y + 16, 18, 1, t[4]); R(c, x - 1, y + 19, 18, 1, t[1]);
  for (let i = 0; i < 4; i++) { const fx = x + 1 + i * 4, [d, m, l] = FLOWERS[i % 3]; P(c, fx, y + 15, g[2]); P(c, fx + 2, y + 15, g[1]); R(c, fx, y + 13, 2, 2, m); P(c, fx, y + 13, l); P(c, fx + 1, y + 14, d); }
}
function awning(c, x, y, r) {
  const p = PAL.plaster;
  R(c, x - 2, y - 7, 20, 2, r[1]);
  for (let i = 0; i < 5; i++) { R(c, x - 2 + i * 4, y - 5, 4, 4, i % 2 ? p[4] : r[3]); P(c, x - 2 + i * 4, y - 5, i % 2 ? '#ffffff' : r[4]); }
  for (let i = 0; i < 20; i += 2) P(c, x - 2 + i, y - 1, r[2]);
  c.save(); c.globalAlpha = .35; R(c, x, y, 16, 3, SHADOW); c.restore();
}
function door(c, x, y) {
  const t = PAL.timber, s = PAL.cobble, iron = '#2b2733';
  R(c, x - 2, y - 2, 20, 26, s[2]); R(c, x - 2, y - 2, 20, 1, s[4]); R(c, x - 2, y - 2, 1, 26, s[4]); R(c, x + 17, y - 1, 1, 25, s[1]);
  R(c, x, y + 2, 16, 22, t[2]); R(c, x + 2, y, 12, 2, t[2]); R(c, x + 1, y + 1, 14, 1, t[2]);
  for (let i = 0; i < 4; i++) { const px = x + i * 4; R(c, px, y + 2, 1, 22, t[3]); R(c, px + 3, y + 2, 1, 22, t[1]); }
  [6, 17].forEach(dy => { R(c, x, y + dy, 16, 2, iron); R(c, x, y + dy, 16, 1, '#4a4556'); P(c, x + 2, y + dy, '#6b6578'); P(c, x + 13, y + dy, '#6b6578'); });
  R(c, x + 12, y + 11, 2, 3, PAL.brass[2]); P(c, x + 12, y + 11, PAL.brass[4]);
  R(c, x - 3, y + 24, 22, 3, s[4]); R(c, x - 3, y + 26, 22, 1, s[2]); R(c, x - 3, y + 24, 22, 1, s[5]);
}
const GLYPHS = {
  bell:     { rows: ['...b...', '..bBb..', '.bBBBb.', '.bBBBb.', 'bbbbbbb', '...k...'], pal: { b: PAL.brass[2], B: PAL.brass[4], k: PAL.brass[1] } },
  press:    { rows: ['wwwwww.', 'wkkwkwd', 'wwwwwwd', 'wkwkkwd', 'wwwwwwd', '.ddddd.'], pal: { w: PAL.plaster[4], k: '#3a3044', d: PAL.plaster[1] } },
  scissors: { rows: ['s....s.', '.s..s..', '..ss...', '..ss...', '.o..o..', 'o.o.o.o'], pal: { s: PAL.steel[4], o: PAL.tailorRoof[4] } },
  mug:      { rows: ['.www...', 'bbbbb..', 'bBBbbbb', 'bBBbb.b', 'bBBbbbb', 'bbbbb..'], pal: { w: '#ffffff', b: PAL.brass[2], B: PAL.brass[4] } },
};
function hangingSign(c, px, py, glyph) {
  const st = PAL.steel, t = PAL.timber;
  R(c, px, py, 12, 1, st[1]); R(c, px, py + 1, 2, 1, st[1]); P(c, px + 2, py + 2, st[1]); P(c, px + 11, py - 1, st[2]);
  P(c, px + 3, py + 1, st[2]); P(c, px + 3, py + 2, st[2]); P(c, px + 10, py + 1, st[2]); P(c, px + 10, py + 2, st[2]);
  const by = py + 3;
  R(c, px, by, 14, 10, t[1]); R(c, px + 1, by + 1, 12, 8, t[3]); R(c, px + 1, by + 1, 12, 1, t[4]); R(c, px + 1, by + 8, 12, 1, t[2]);
  if (glyph) sprite(c, px + 4, by + 2, glyph.rows, glyph.pal);
}
function dormer(c, cx, top, r) {
  const p = PAL.plaster, t = PAL.timber, wa = PAL.water;
  R(c, cx + 9, top + 12, 4, 11, r[0]);
  R(c, cx - 9, top + 10, 18, 12, p[3]); R(c, cx - 9, top + 10, 1, 12, p[4]); R(c, cx + 8, top + 10, 1, 12, p[1]);
  R(c, cx - 4, top + 12, 8, 8, t[1]); R(c, cx - 3, top + 13, 6, 6, wa[3]); P(c, cx - 2, top + 14, wa[5]);
  GLASS.push({ x: cx - 3, y: top + 13, w: 6, h: 6, mul: [cx, top + 15] });
  LIGHTS.push({ x: cx, y: top + 16, r: [5, 9, 14] });
  R(c, cx, top + 13, 1, 6, t[2]); R(c, cx - 3, top + 15, 6, 1, t[2]); R(c, cx - 10, top + 21, 20, 2, t[1]);
  fillPoly(c, [[cx, top], [cx - 13, top + 12], [cx, top + 12]], r[4]); fillPoly(c, [[cx, top], [cx + 13, top + 12], [cx, top + 12]], r[2]);
  R(c, cx - 13, top + 12, 27, 1, r[0]); P(c, cx, top, r[5]);
}
function chimney(c, x, y, r) {
  const br = ['#4c2329', '#7a3b33', '#a4523d', '#c9744f'];
  R(c, x + 10, y + 4, 4, 18, r[0]); R(c, x, y, 10, 20, br[1]);
  for (let row = 0; row < 7; row++) { const yy = y + 2 + row * 3, off = row % 2 ? 2 : 0; for (let xx = x - off; xx < x + 10; xx += 5) { const sx = Math.max(x, xx); R(c, sx, yy, Math.min(4, x + 10 - sx), 2, xx < x + 5 ? br[2] : br[1]); P(c, sx, yy, br[3]); } }
  R(c, x + 9, y, 1, 20, br[0]); R(c, x - 1, y - 2, 12, 3, PAL.cobble[3]); R(c, x - 1, y - 2, 12, 1, PAL.cobble[5]); R(c, x + 2, y - 2, 6, 1, '#1a1424');
  CHIMNEYS.push({ x: x + 4, y: y - 3 });
}
function ivy(c, x, yb, h) {
  const g = PAL.grass;
  R(c, x + 3, yb - h + 4, 1, h - 4, g[0]); R(c, x + 6, yb - h + 12, 1, h - 12, g[0]);
  for (let i = 0; i < 18; i++) { const yy = yb - Math.floor(hash(i, x, 41) * h), xx = x + Math.floor(hash(i, x, 42) * 10); ell(c, xx, yy, 2, 1, g[1]); P(c, xx - 1, yy - 1, g[3]); P(c, xx, yy - 1, g[4]); P(c, xx + 1, yy, g[2]); }
}
function barrel(c, x, y) { const t = PAL.timber; R(c, x + 1, y, 8, 11, t[3]); R(c, x, y + 1, 10, 9, t[3]); R(c, x + 1, y, 2, 11, t[4]); R(c, x + 7, y + 1, 2, 9, t[1]); R(c, x, y + 2, 10, 1, PAL.steel[1]); R(c, x, y + 8, 10, 1, PAL.steel[1]); ell(c, x + 5, y, 4, 1, t[2]); }
function crate(c, x, y) { const t = PAL.timber; R(c, x, y, 12, 10, t[3]); R(c, x, y, 12, 1, t[4]); R(c, x, y + 9, 12, 1, t[1]); R(c, x, y, 1, 10, t[4]); R(c, x + 11, y, 1, 10, t[1]); line(c, x + 1, y + 1, x + 10, y + 8, t[2]); }

function houseSpec(b) {
  const x = b.tx * TILE + 5, w = b.tw * TILE - 10, bottom = (b.ty + b.th) * TILE, roofY = b.ty * TILE + (b.roofTop || 6);
  const wallH = b.wallH || 44, wallY = bottom - wallH;
  // b.roof is a palette name; the computed ramp has to win over it
  return Object.assign({ x, w, roofY, roofH: wallY - roofY, wallY, wallH, bottom, door: Math.round(w / 2) - 8 }, b, { roof: PAL[b.roof] || PAL.dojoRoof });
}
function cottage(c, b) {
  const hs = houseSpec(b), r = hs.roof;
  roof(c, hs);
  if (b.dormer) dormer(c, hs.x + b.dormer, hs.roofY + 8, r);
  if (b.chimney) chimney(c, hs.x + hs.w - 24, hs.roofY - 10, r);
  wall(c, hs);
  hs.wins.forEach(wx => { const x = hs.x + wx, y = hs.wallY + 10; if (b.shutters) shutters(c, x, y, r); windowAt(c, x, y, b.curtains); if (b.flowers) flowerBox(c, x, y); if (b.awnings) awning(c, x, y, r); });
  if (b.ivy) ivy(c, hs.x, hs.bottom - 4, 34);
  if (b.glyph) hangingSign(c, hs.x + hs.posts[0] + 4, hs.wallY + 12, GLYPHS[b.glyph]);
  door(c, hs.x + hs.door, hs.bottom - 24);
  if (b.barrels) { barrel(c, hs.x + hs.door + 22, hs.bottom - 12); barrel(c, hs.x + hs.door + 33, hs.bottom - 11); crate(c, hs.x + hs.door - 30, hs.bottom - 10); }
  if (b.lamps) [hs.x + hs.door - 8, hs.x + hs.door + 22].forEach(lx => { R(c, lx, hs.bottom - 30, 4, 6, PAL.steel[0]); R(c, lx + 1, hs.bottom - 29, 2, 4, PAL.lamp[1]); LIGHTS.push({ x: lx + 2, y: hs.bottom - 22, r: [6, 12, 20], lamp: [lx + 1, hs.bottom - 29, 2, 4] }); });
  return hs;
}
function dojoHall(c, b) {
  const hs = houseSpec(Object.assign({ roof: 'dojoRoof', wallH: 40, roofTop: 14 }, b)), r = hs.roof, p = PAL.plaster, t = PAL.timber;
  // upper tier
  const ux = hs.x + 18, uw = hs.w - 36, uy = hs.roofY - 12;
  R(c, ux, uy + 8, uw, 8, p[3]); R(c, ux, uy + 8, uw, 1, t[1]);
  for (let k = ux + 4; k < ux + uw - 4; k += 8) R(c, k, uy + 10, 4, 5, p[4]);
  R(c, ux - 6, uy, uw + 12, 8, r[2]); R(c, ux - 6, uy, uw + 12, 1, r[4]); R(c, ux - 6, uy + 7, uw + 12, 1, r[0]);
  for (let k = ux - 4; k < ux + uw + 4; k += 5) R(c, k, uy + 2, 1, 5, r[1]);
  [[ux - 9, uy + 5], [ux + uw + 6, uy + 5]].forEach(([tx, ty]) => { R(c, tx, ty, 4, 2, r[3]); P(c, tx + (tx < ux ? 0 : 3), ty - 1, r[4]); });
  R(c, ux + uw / 2 - 1, uy - 4, 3, 4, PAL.brass[3]); P(c, ux + uw / 2, uy - 5, PAL.brass[4]);
  roof(c, hs);
  [[hs.x - 9, hs.wallY - 5], [hs.x + hs.w + 5, hs.wallY - 5]].forEach(([tx, ty]) => { R(c, tx, ty, 5, 2, r[3]); R(c, tx + (tx < hs.x ? -1 : 4), ty - 2, 2, 2, r[4]); });
  // walls: dark posts and paper screens
  R(c, hs.x, hs.wallY, hs.w, hs.wallH, p[4]); R(c, hs.x + hs.w - 4, hs.wallY, 4, hs.wallH, p[2]);
  for (let k = 0; k <= hs.w - 4; k += 20) { R(c, hs.x + k, hs.wallY, 4, hs.wallH, t[1]); R(c, hs.x + k, hs.wallY, 1, hs.wallH, t[3]); }
  for (let gy = hs.wallY + 8; gy < hs.bottom - 8; gy += 7) R(c, hs.x + 4, gy, hs.w - 8, 1, t[2]);
  R(c, hs.x, hs.bottom - 6, hs.w, 6, PAL.cobble[2]); R(c, hs.x, hs.bottom - 6, hs.w, 1, PAL.cobble[4]);
  c.save(); c.globalAlpha = .4; R(c, hs.x, hs.wallY, hs.w, 5, SHADOW); c.restore();
  hs.wins = [8, hs.w - 24]; hs.wins.forEach(wx => { GLASS.push({ x: hs.x + wx + 1, y: hs.wallY + 10, w: 14, h: 18, mul: [hs.x + wx + 7, hs.wallY + 18] }); LIGHTS.push({ x: hs.x + wx + 8, y: hs.wallY + 20, r: [7, 13, 20] }); });
  // sliding doors and noren curtain
  const dx = hs.x + hs.door - 2, dy = hs.bottom - 26;
  R(c, dx, dy, 20, 26, t[1]); R(c, dx + 1, dy + 1, 18, 25, p[4]);
  for (let gy = dy + 4; gy < dy + 26; gy += 5) R(c, dx + 1, gy, 18, 1, t[2]); R(c, dx + 9, dy + 1, 2, 25, t[2]);
  for (let k = 0; k < 4; k++) { R(c, dx - 2 + k * 6, dy - 3, 5, 9, r[3]); R(c, dx - 2 + k * 6, dy - 3, 5, 1, r[4]); R(c, dx + 2 + k * 6, dy - 2, 1, 8, r[1]); }
  R(c, dx - 3, dy + 26, 26, 3, PAL.cobble[4]);
  return hs;
}
function vaultHouse(c, b) {
  const x = b.tx * TILE + 3, w = b.tw * TILE - 6, top = b.ty * TILE + 10, bottom = (b.ty + b.th) * TILE, s = PAL.cobble, br = PAL.brass;
  R(c, x - 4, top, w + 8, 8, PAL.rock[2]); R(c, x - 4, top, w + 8, 2, PAL.rock[4]); R(c, x - 4, top + 7, w + 8, 1, PAL.rock[0]);
  for (let k = x - 2; k < x + w + 2; k += 10) R(c, k, top - 4, 6, 4, PAL.rock[3]);
  R(c, x, top + 8, w, bottom - top - 8, s[1]);
  for (let row = 0, yy = top + 8; yy < bottom - 2; row++, yy += 7) for (let xx = x - (row % 2 ? 6 : 0); xx < x + w; xx += 12) { const sx = Math.max(x, xx); stone(c, sx, yy, Math.min(12, x + w - sx), 7, hash(xx, yy, 9)); }
  R(c, x + w - 3, top + 8, 3, bottom - top - 8, s[0]);
  [x + 8, x + w - 14].forEach(cx0 => { R(c, cx0, top + 10, 6, bottom - top - 12, s[4]); R(c, cx0, top + 10, 1, bottom - top - 12, s[5]); R(c, cx0 + 5, top + 10, 1, bottom - top - 12, s[2]); });
  R(c, x, top + 8, w, 2, br[2]); R(c, x, top + 8, w, 1, br[4]);
  const cx = x + w / 2, cy = bottom - 16;
  ell(c, cx, cy, 13, 13, s[0]); ell(c, cx, cy, 11, 11, br[1]); ell(c, cx - 1, cy - 1, 10, 10, br[3]); ell(c, cx, cy, 8, 8, br[2]); ell(c, cx, cy, 3, 3, br[1]);
  for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2; line(c, cx, cy, cx + Math.cos(ang) * 7, cy + Math.sin(ang) * 7, br[4]); }
  P(c, cx - 4, cy - 5, br[4]);
  [x + 18, x + w - 24].forEach(sx => { R(c, sx, top + 16, 6, 14, s[0]); R(c, sx + 1, top + 17, 4, 12, '#1a1424'); GLASS.push({ x: sx + 1, y: top + 17, w: 4, h: 12, mul: [sx + 2, top + 22] }); LIGHTS.push({ x: sx + 3, y: top + 24, r: [5, 10, 16] }); });
  return { x, w, bottom, wallY: top + 8 };
}
function keep(c, b) {
  const x = b.tx * TILE, w = b.tw * TILE, top = b.ty * TILE, bottom = (b.ty + b.th) * TILE, s = PAL.cobble, r = PAL.hqRoof;
  // central tower behind
  const tx = x + w / 2 - 24; R(c, tx, top + 6, 48, 50, s[2]);
  for (let yy = top + 8; yy < top + 54; yy += 7) for (let xx = tx; xx < tx + 48; xx += 12) stone(c, xx + ((yy >> 3) % 2) * 6, yy, 12, 7, hash(xx, yy, 13));
  for (let k = tx; k < tx + 48; k += 8) R(c, k, top, 5, 6, s[3]);
  R(c, tx + 22, top - 14, 1, 14, PAL.steel[2]); fillPoly(c, [[tx + 23, top - 14], [tx + 34, top - 11], [tx + 23, top - 8]], r[3]);
  R(c, tx + 18, top + 18, 4, 8, '#1a1424'); R(c, tx + 26, top + 18, 4, 8, '#1a1424');
  GLASS.push({ x: tx + 18, y: top + 18, w: 4, h: 8, mul: [tx + 19, top + 20] }); GLASS.push({ x: tx + 26, y: top + 18, w: 4, h: 8, mul: [tx + 27, top + 20] });
  // curtain wall
  const wy = top + 52; R(c, x + 12, wy, w - 24, bottom - wy, s[1]);
  for (let row = 0, yy = wy; yy < bottom; row++, yy += 7) for (let xx = x + 12 - (row % 2 ? 6 : 0); xx < x + w - 12; xx += 12) { const sx = Math.max(x + 12, xx); stone(c, sx, yy, Math.min(12, x + w - 12 - sx), 7, hash(xx, yy, 14)); }
  for (let k = x + 12; k < x + w - 12; k += 10) R(c, k, wy - 5, 6, 5, s[3]);
  // side towers with conical roofs
  [x, x + w - 30].forEach(sx => {
    R(c, sx, top + 30, 30, bottom - top - 30, s[2]);
    for (let yy = top + 32; yy < bottom; yy += 7) for (let xx = sx; xx < sx + 30; xx += 10) stone(c, xx + ((yy >> 3) % 2) * 5, yy, 10, 7, hash(xx, yy, 15));
    R(c, sx + 28, top + 30, 2, bottom - top - 30, s[0]);
    fillPoly(c, [[sx + 15, top + 6], [sx - 3, top + 32], [sx + 15, top + 32]], r[4]); fillPoly(c, [[sx + 15, top + 6], [sx + 33, top + 32], [sx + 15, top + 32]], r[2]);
    R(c, sx - 3, top + 32, 36, 1, r[0]); R(c, sx + 12, top + 44, 6, 10, '#1a1424');
    GLASS.push({ x: sx + 12, y: top + 44, w: 6, h: 10, mul: [sx + 14, top + 48] }); LIGHTS.push({ x: sx + 15, y: top + 50, r: [6, 11, 18] });
  });
  // banners and gate
  [x + 40, x + w - 48].forEach(bx => { R(c, bx, wy + 4, 8, 22, r[3]); R(c, bx, wy + 4, 8, 2, r[5]); R(c, bx + 3, wy + 10, 2, 8, PAL.brass[3]); fillPoly(c, [[bx, wy + 26], [bx + 4, wy + 22], [bx + 8, wy + 26]], s[1]); });
  const gx = x + w / 2 - 12, gy = bottom - 34;
  R(c, gx - 3, gy - 3, 30, 37, s[3]); R(c, gx - 3, gy - 3, 30, 2, s[5]); R(c, gx, gy, 24, 34, '#14101e');
  for (let k = gx + 2; k < gx + 24; k += 5) R(c, k, gy + 2, 2, 30, PAL.steel[1]); for (let k = gy + 4; k < gy + 34; k += 6) R(c, gx, k, 24, 1, PAL.steel[2]);
  [gx - 10, gx + 30].forEach(tx2 => { R(c, tx2, gy + 4, 4, 8, PAL.timber[1]); LIGHTS.push({ x: tx2 + 2, y: gy + 4, r: [7, 14, 22], flicker: true, torch: [tx2, gy - 1] }); });
  KEEP_AREA = { x: b.tx - 8, y: b.ty - 6, w: b.tw + 16, h: b.th + 14 };
  return { x, w, bottom };
}
function lighthouse(c, tx, ty) {
  const x = tx * TILE, y = ty * TILE, s = PAL.cobble, r = PAL.crierRoof;
  ell(c, x + 16, y + 62, 18, 6, s[1]); ell(c, x + 16, y + 60, 18, 6, s[3]);
  for (let yy = y + 12; yy < y + 60; yy++) {
    const k = (yy - y - 12) / 48, half = Math.round(8 + k * 5), band = Math.floor((yy - y - 12) / 9) % 2;
    R(c, x + 16 - half, yy, half * 2, 1, band ? '#e9e4ee' : r[3]); P(c, x + 16 - half, yy, band ? '#ffffff' : r[4]); R(c, x + 16 + half - 3, yy, 3, 1, band ? '#b3a5b8' : r[1]);
  }
  R(c, x + 4, y + 10, 24, 3, PAL.steel[1]); R(c, x + 4, y + 10, 24, 1, PAL.steel[3]);
  R(c, x + 8, y + 1, 16, 9, PAL.steel[0]); R(c, x + 9, y + 2, 14, 7, PAL.lamp[0]);
  fillPoly(c, [[x + 16, y - 9], [x + 6, y + 1], [x + 26, y + 1]], r[2]); fillPoly(c, [[x + 16, y - 9], [x + 6, y + 1], [x + 16, y + 1]], r[4]); P(c, x + 16, y - 10, PAL.brass[4]);
  R(c, x + 13, y + 46, 6, 14, PAL.timber[2]); R(c, x + 13, y + 46, 6, 1, PAL.timber[4]);
  LIGHTHOUSE = { x: x + 16, y: y + 5, glass: [x + 9, y + 2, 14, 7] };
  LIGHTS.push({ x: x + 16, y: y + 8, r: [10, 22, 34] });
}

/* ---------- props ---------- */
function tree(c, px, py, pine, L) {
  const g = L > 0 ? PAL.alpine : PAL.grass, t = PAL.timber, cx = px + 8, cy = py - 4;
  if (pine) {
    R(c, cx - 2, py + 6, 4, 9, t[2]); R(c, cx - 2, py + 6, 1, 9, t[3]);
    for (let k = 0; k < 3; k++) { const ty = py - 14 + k * 7, hw = 5 + k * 2; fillPoly(c, [[cx, ty], [cx - hw, ty + 9], [cx + hw + 1, ty + 9]], g[1]); fillPoly(c, [[cx, ty], [cx - hw, ty + 9], [cx, ty + 9]], g[3]); P(c, cx, ty, g[4]); if (L >= 2 && k === 0) { P(c, cx - 1, ty + 2, PAL.snow[4]); P(c, cx, ty + 1, PAL.snow[4]); } }
    return;
  }
  R(c, cx - 3, py + 4, 6, 11, t[2]); R(c, cx - 3, py + 4, 1, 11, t[3]); R(c, cx + 2, py + 4, 1, 11, t[1]);
  const v = hash(px, py, 61), s = .75 + v * .35;
  const blobs = [[-7, 3, 8, 6], [7, 4, 8, 6], [0, -4, 11, 8], [-3, 5, 9, 5], [4, -1, 8, 6]];
  blobs.forEach(([dx, dy, rx, ry]) => ell(c, cx + dx * s, cy + dy * s + 2, rx * s, ry * s, g[0]));
  blobs.forEach(([dx, dy, rx, ry]) => ell(c, cx + dx * s, cy + dy * s, rx * s - 1, ry * s - 1, g[1]));
  blobs.forEach(([dx, dy, rx, ry]) => ell(c, cx + dx * s - 2, cy + dy * s - 2, rx * s - 3, ry * s - 2, g[2]));
  blobs.forEach(([dx, dy, rx, ry]) => ell(c, cx + dx * s - 3, cy + dy * s - 3, Math.max(1, rx * s - 7), Math.max(1, ry * s - 5), g[3]));
  for (let i = 0; i < 9; i++) { const lx = cx - 9 + Math.floor(hash(i, px, 62) * 14), ly = cy - 8 + Math.floor(hash(i, py, 62) * 8); P(c, lx, ly, g[4]); P(c, lx + 1, ly + 1, g[3]); }
  if (v > .82) { P(c, cx + 3, cy + 2, '#d8485f'); P(c, cx - 4, cy + 4, '#d8485f'); }
}
function lantern(c, x, y) {
  const st = PAL.steel;
  R(c, x - 1, y + 8, 3, 22, st[1]); R(c, x - 1, y + 8, 1, 22, st[3]); R(c, x - 3, y + 28, 7, 3, st[1]); R(c, x - 3, y + 28, 7, 1, st[2]);
  R(c, x - 4, y, 9, 2, st[0]); R(c, x - 3, y - 1, 7, 1, st[1]); P(c, x, y - 2, st[3]);
  R(c, x - 3, y + 2, 7, 6, st[0]); R(c, x - 2, y + 3, 5, 4, PAL.lamp[0]); R(c, x - 2, y + 3, 1, 4, PAL.lamp[1]); R(c, x - 3, y + 8, 7, 1, st[1]);
  LIGHTS.push({ x, y: y + 6, r: [10, 19, 29], flicker: true, lamp: [x - 2, y + 3, 5, 4] });
}
function paper(c, x, y, w, h, pin) {
  R(c, x, y, w, h, PAL.plaster[4]); R(c, x + w - 1, y + 1, 1, h - 1, PAL.plaster[2]); R(c, x + 1, y + h - 1, w - 1, 1, PAL.plaster[2]);
  for (let yy = y + 2; yy < y + h - 1; yy += 2) R(c, x + 1, yy, w - 3 - ((yy >> 1) % 2), 1, '#8b8193');
  P(c, x + (w >> 1), y, pin);
}
function townBoard(c, x, y) {
  const t = PAL.timber, r = PAL.crierRoof;
  R(c, x + 2, y + 10, 3, 14, t[1]); R(c, x + 21, y + 10, 3, 14, t[1]); R(c, x + 2, y + 10, 1, 14, t[3]); R(c, x + 21, y + 10, 1, 14, t[3]);
  R(c, x, y, 26, 16, t[1]); R(c, x + 1, y + 1, 24, 14, t[3]); R(c, x + 1, y + 1, 24, 1, t[4]); R(c, x + 2, y + 2, 22, 12, '#8a6440');
  paper(c, x + 3, y + 3, 7, 9, '#d8485f'); paper(c, x + 11, y + 4, 6, 6, '#3584c9'); paper(c, x + 18, y + 3, 5, 9, '#ffd34d');
  R(c, x - 2, y - 3, 30, 3, r[2]); R(c, x - 2, y - 3, 30, 1, r[4]); R(c, x - 1, y, 28, 1, r[0]);
}
function fountain(c, cx, cy) {
  const s = PAL.cobble, wa = PAL.water;
  ell(c, cx, cy + 6, 22, 9, s[1]);
  for (let dx = -20; dx <= 20; dx += 7) { const k = Math.sqrt(Math.max(0, 1 - (dx * dx) / 484)), top = cy + Math.round(9 * k), bot = cy + 6 + Math.round(9 * k); R(c, cx + dx, top + 1, 1, bot - top - 1, s[0]); }
  ell(c, cx, cy, 22, 9, s[4]); ell(c, cx + 1, cy + 1, 21, 8, s[3]); ell(c, cx - 1, cy - 1, 20, 7, s[4]);
  ell(c, cx, cy, 18, 6, s[1]); ell(c, cx, cy + 1, 17, 5, wa[2]); ell(c, cx + 2, cy + 2, 12, 3, wa[1]); ell(c, cx - 5, cy - 1, 7, 2, wa[3]);
  R(c, cx - 3, cy - 13, 6, 13, s[3]); R(c, cx - 3, cy - 13, 2, 13, s[4]); R(c, cx + 2, cy - 13, 1, 13, s[1]);
  ell(c, cx, cy - 13, 8, 3, s[2]); ell(c, cx, cy - 14, 8, 3, s[4]); ell(c, cx, cy - 14, 6, 2, wa[3]); P(c, cx - 3, cy - 15, wa[5]);
}
function signpost(c, x, y, label) {
  const t = PAL.timber;
  R(c, x + 7, y + 2, 2, 14, t[2]); R(c, x + 7, y + 2, 1, 14, t[4]);
  fillPoly(c, [[x + 1, y + 2], [x + 12, y + 2], [x + 15, y + 4], [x + 12, y + 7], [x + 1, y + 7]], t[3]); R(c, x + 1, y + 2, 11, 1, t[4]);
  fillPoly(c, [[x + 15, y + 8], [x + 4, y + 8], [x + 1, y + 10], [x + 4, y + 13], [x + 15, y + 13]], t[2]); R(c, x + 4, y + 8, 11, 1, t[3]);
  R(c, x + 3, y + 4, 7, 1, t[1]); R(c, x + 6, y + 10, 7, 1, t[1]);
  R(c, x + 6, y + 15, 4, 1, PAL.grass[1]);
}
function pedestal(c, x, y) {
  const s = PAL.cobble;
  R(c, x + 1, y + 5, 14, 10, s[2]); R(c, x + 1, y + 5, 14, 1, s[4]); R(c, x + 1, y + 5, 1, 10, s[4]); R(c, x + 14, y + 5, 1, 10, s[1]);
  R(c, x, y + 3, 16, 3, s[3]); R(c, x, y + 3, 16, 1, s[5]); R(c, x + 4, y + 9, 8, 3, PAL.brass[2]); R(c, x + 4, y + 9, 8, 1, PAL.brass[4]);
}
function tentDecor(c, x, y, ramp) {
  fillPoly(c, [[x + 16, y], [x, y + 22], [x + 16, y + 22]], ramp[4]); fillPoly(c, [[x + 16, y], [x + 32, y + 22], [x + 16, y + 22]], ramp[2]);
  fillPoly(c, [[x + 16, y + 8], [x + 11, y + 22], [x + 21, y + 22]], '#1a1424'); R(c, x + 15, y - 3, 1, 4, PAL.timber[2]); R(c, x, y + 22, 33, 1, ramp[0]);
}
function campfire(c, x, y) {
  const s = PAL.cobble, t = PAL.timber;
  for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; stone(c, x + 8 + Math.round(Math.cos(ang) * 7) - 2, y + 10 + Math.round(Math.sin(ang) * 4) - 2, 4, 3, .5); }
  R(c, x + 3, y + 9, 10, 2, t[2]); R(c, x + 5, y + 11, 8, 2, t[1]); R(c, x + 3, y + 9, 10, 1, t[3]);
  CAMPFIRE = { x: x + 8, y: y + 8 }; LIGHTS.push({ x: x + 8, y: y + 8, r: [10, 20, 30], flicker: true });
}
function station(c, x, y, kind) {
  const t = PAL.timber, st = PAL.steel, r = kind === 'zip' ? PAL.printRoof : PAL.crierRoof;
  R(c, x + 2, y + 4, 3, 28, t[2]); R(c, x + 2, y + 4, 1, 28, t[4]); R(c, x + 27, y + 4, 3, 28, t[1]);
  line(c, x + 4, y + 30, x + 27, y + 9, t[1]); line(c, x + 27, y + 30, x + 4, y + 9, t[2]);
  R(c, x - 1, y + 18, 34, 6, t[3]); R(c, x - 1, y + 18, 34, 1, t[4]); R(c, x - 1, y + 23, 34, 1, t[1]); for (let k = x + 3; k < x + 33; k += 5) R(c, k, y + 19, 1, 4, t[2]);
  R(c, x - 1, y + 14, 34, 1, t[2]); for (let k = x; k < x + 33; k += 6) R(c, k, y + 14, 1, 4, t[2]);
  ell(c, x + 16, y + 9, 7, 7, st[0]); ell(c, x + 16, y + 9, 6, 6, st[3]); ell(c, x + 16, y + 9, 4, 4, st[1]);
  for (let a = 0; a < 6; a++) { const g = a / 6 * Math.PI * 2; line(c, x + 16, y + 9, x + 16 + Math.cos(g) * 5, y + 9 + Math.sin(g) * 5, st[2]); }
  P(c, x + 16, y + 9, st[5]); P(c, x + 13, y + 4, st[5]); P(c, x + 12, y + 5, st[4]);
  fillPoly(c, [[x + 16, y - 9], [x - 3, y + 2], [x + 35, y + 2]], r[2]); fillPoly(c, [[x + 16, y - 9], [x - 3, y + 2], [x + 16, y + 2]], r[4]);
  for (let k = 3; k < 11; k += 3) { R(c, x + 16 - Math.round(k * 1.9), y - 9 + k, Math.round(k * 1.9), 1, r[5]); R(c, x + 17, y - 9 + k, Math.round(k * 1.9), 1, r[1]); }
  R(c, x - 3, y + 2, 39, 1, r[0]);
}
function pylon(c, x, y) {
  const t = PAL.timber, st = PAL.steel;
  R(c, x - 2, y, 2, 34, t[2]); R(c, x + 1, y, 2, 34, t[1]); for (let k = y + 4; k < y + 34; k += 6) line(c, x - 2, k, x + 2, k + 5, t[1]);
  R(c, x - 6, y - 1, 13, 2, st[1]); R(c, x - 6, y - 1, 13, 1, st[3]); P(c, x - 5, y - 2, st[4]); P(c, x + 5, y - 2, st[4]);
}
function torii(c, x, y, w, col) {
  const r = col || PAL.dojoRoof;
  R(c, x + 2, y + 6, 4, 26, r[3]); R(c, x + 2, y + 6, 1, 26, r[4]); R(c, x + w - 6, y + 6, 4, 26, r[2]);
  R(c, x - 2, y, w + 4, 4, '#1a1424'); R(c, x - 2, y, w + 4, 1, r[1]); R(c, x - 4, y - 1, 3, 2, '#1a1424'); R(c, x + w + 1, y - 1, 3, 2, '#1a1424');
  R(c, x, y + 6, w, 3, r[3]); R(c, x, y + 6, w, 1, r[4]);
}
function shrine(c, x, y) {
  const r = PAL.dojoRoof, p = PAL.plaster, s = PAL.snow;
  R(c, x - 2, y + 26, 52, 6, PAL.rock[3]); R(c, x - 2, y + 26, 52, 1, PAL.rock[4]);
  R(c, x + 4, y + 10, 40, 16, p[3]); R(c, x + 4, y + 10, 1, 16, p[4]); R(c, x + 42, y + 10, 2, 16, p[1]);
  R(c, x + 18, y + 14, 12, 12, '#1a1424'); R(c, x + 20, y + 18, 8, 4, PAL.brass[2]);
  fillPoly(c, [[x + 24, y - 4], [x - 4, y + 11], [x + 52, y + 11]], r[2]); fillPoly(c, [[x + 24, y - 4], [x - 4, y + 11], [x + 24, y + 11]], r[4]);
  R(c, x - 4, y + 10, 56, 2, r[0]); for (let k = 0; k < 48; k += 6) P(c, x + k, y + 6 + (k % 4), s[4]);
  SHRINE = { x: x + 24, y: y };
  [x - 10, x + 54].forEach(lx => { R(c, lx, y + 12, 6, 14, PAL.rock[2]); R(c, lx + 1, y + 14, 4, 4, PAL.lamp[0]); LIGHTS.push({ x: lx + 3, y: y + 16, r: [6, 12, 18], lamp: [lx + 1, y + 14, 4, 4] }); });
}
function well(c, cx, cy) {
  const s = PAL.cobble, t = PAL.timber, r = PAL.printRoof;
  ell(c, cx, cy + 4, 13, 6, s[1]); ell(c, cx, cy + 3, 13, 6, s[2]); ell(c, cx, cy, 13, 5, s[4]); ell(c, cx + 1, cy + 1, 12, 4, s[3]);
  ell(c, cx, cy, 9, 3, '#0d0a18'); ell(c, cx + 1, cy + 1, 6, 1, PAL.water[1]); P(c, cx - 2, cy + 1, PAL.water[3]);
  R(c, cx - 12, cy - 18, 2, 18, t[2]); R(c, cx - 12, cy - 18, 1, 18, t[4]); R(c, cx + 10, cy - 18, 2, 18, t[1]);
  R(c, cx - 12, cy - 14, 24, 2, t[2]); R(c, cx - 12, cy - 14, 24, 1, t[4]);
  fillPoly(c, [[cx, cy - 27], [cx - 16, cy - 17], [cx, cy - 17]], r[3]); fillPoly(c, [[cx, cy - 27], [cx + 16, cy - 17], [cx, cy - 17]], r[1]);
  R(c, cx - 16, cy - 17, 33, 1, r[0]); R(c, cx, cy - 12, 1, 7, '#c9b99c'); R(c, cx - 2, cy - 6, 5, 4, t[2]); R(c, cx - 2, cy - 6, 5, 1, PAL.steel[3]);
}
function depot(c, x, y, roofRamp, glyph) {
  const t = PAL.timber, st = PAL.steel;
  R(c, x, y + 8, 32, 8, t[3]); R(c, x, y + 8, 32, 1, t[4]); R(c, x, y + 15, 32, 1, t[1]);
  for (let k = x + 5; k < x + 32; k += 6) R(c, k, y + 9, 1, 6, t[2]);
  R(c, x + 2, y - 6, 2, 14, t[2]); R(c, x + 28, y - 6, 2, 14, t[1]);
  R(c, x - 1, y - 9, 34, 4, roofRamp[3]); R(c, x - 1, y - 9, 34, 1, roofRamp[4]); R(c, x - 1, y - 6, 34, 1, roofRamp[1]);
  for (let k = x + 1; k < x + 33; k += 4) P(c, k, y - 5, roofRamp[2]);
  R(c, x + 11, y - 3, 12, 9, t[1]); R(c, x + 12, y - 2, 10, 7, t[3]); sprite(c, x + 14, y - 1, glyph.rows, glyph.pal);
  R(c, x + 6, y + 10, 8, 2, t[2]); R(c, x + 6, y + 12, 1, 3, st[1]); R(c, x + 13, y + 12, 1, 3, st[1]);
}
function bufferStop(c, px, py, side) {
  const red = '#d8485f', w = '#f2e8cf', st = PAL.steel;
  if (side === 'west' || side === 'east') { const x = side === 'west' ? px + 1 : px + 12; R(c, x, py + 3, 3, 10, st[1]); for (let k = 0; k < 10; k += 4) R(c, x, py + 3 + k, 3, 2, red); P(c, x + 1, py + 2, w); }
  else { const y = side === 'north' ? py + 1 : py + 12; R(c, px + 3, y, 10, 3, st[1]); for (let k = 0; k < 10; k += 4) R(c, px + 3 + k, y, 2, 3, red); P(c, px + 2, y + 1, w); }
}
function lever(c, x, y) {
  const st = PAL.steel, t = PAL.timber;
  R(c, x + 3, y + 8, 10, 6, t[2]); R(c, x + 3, y + 8, 10, 1, t[4]); R(c, x + 7, y + 2, 2, 7, st[2]); R(c, x + 6, y, 4, 3, '#d8485f');
}
function bush(c, cx, cy, r, L) {
  const g = L > 0 ? PAL.alpine : PAL.grass;
  ell(c, cx, cy + 2, r, Math.round(r * .7), g[0]); ell(c, cx, cy, r - 1, Math.round(r * .65), g[1]);
  ell(c, cx - 2, cy - 2, r - 4, Math.round(r * .45), g[2]); ell(c, cx - 3, cy - 3, Math.max(1, r - 7), Math.max(1, Math.round(r * .25)), g[3]);
  P(c, cx - 2, cy - 4, g[4]); P(c, cx + 2, cy - 1, g[4]);
}
function rock(c, cx, cy, r) {
  const s = PAL.rock;
  ell(c, cx + 1, cy + 1, r, Math.round(r * .6), s[1]); ell(c, cx, cy, r, Math.round(r * .6), s[3]); ell(c, cx - 1, cy - 1, r - 2, Math.max(1, Math.round(r * .3)), s[4]);
}
function flowerBed(c, x, y, w, h) {
  const soil = ['#2a1a24', '#3d2731', '#55373b'], g = PAL.grass;
  R(c, x, y, w, h, soil[1]); R(c, x, y, w, 1, soil[0]);
  for (let i = 0; i < w / 3; i++) P(c, x + Math.floor(hash(i, x, 61) * w), y + 1 + Math.floor(hash(i, y, 61) * (h - 2)), soil[2]);
  for (let row = 0; row * 8 + 6 < h; row++) for (let col = 0; col * 9 + 6 < w; col++) {
    const px = x + 5 + col * 9 + (row % 2 ? 4 : 0), py = y + 6 + row * 8; if (px > x + w - 4) continue;
    const [d, m, l] = FLOWERS[(col + row * 2) % FLOWERS.length];
    P(c, px - 2, py + 2, g[2]); P(c, px + 2, py + 2, g[2]); R(c, px - 1, py + 2, 3, 2, g[1]); R(c, px - 1, py - 2, 3, 3, m); P(c, px, py - 2, l); P(c, px - 1, py, d); P(c, px + 1, py, d);
  }
}

/* ---------- places to explore in the south ---------- */
const RUINS = { x: 46, y: 75, w: 13, h: 10 };
const DIG = { x: 57, y: 86, w: 10, h: 4 };
const CAVE = { x: 78, y: 77, w: 7, h: 5 };
const CRYSTALS = [];
function layoutSouth() {
  // courtyard: cracked cobbles with grass pushing through
  for (let y = RUINS.y + 1; y < RUINS.y + RUINS.h - 1; y++) for (let x = RUINS.x + 1; x < RUINS.x + RUINS.w - 1; x++) {
    const i = id(x, y), worn = (x >= 52 && x <= 54) || (y >= 79 && y <= 80); if (!isWater(ter[i])) ter[i] = worn && hash(x, y, 200) < .7 ? T.COBBLE : T.GRASS; reserve[i] = Math.max(reserve[i], 2);   // a worn flagstone cross through the grass
  }
  reserveAround(RUINS.x, RUINS.y, RUINS.w, RUINS.h, 1);
  // the dig: a dirt pit
  for (let y = DIG.y; y < DIG.y + DIG.h; y++) for (let x = DIG.x; x < DIG.x + DIG.w; x++) { const i = id(x, y); if (!isWater(ter[i])) { ter[i] = T.PATH; reserve[i] = Math.max(reserve[i], 2); } }
  reserveAround(DIG.x, DIG.y, DIG.w, DIG.h, 1);
  reserveAround(CAVE.x, CAVE.y, CAVE.w, CAVE.h, 2);
}
function ruinWall(c, px, py, h, v) {
  // one tile of wall: a face of stone blocks rising h px above the tile's bottom, a jagged top, moss and ivy
  const s = PAL.cobble, g = PAL.grass, top = py + 16 - h;
  for (let k = 0; k < 16; k += 4) {
    const jag = Math.floor(hash(px + k, py, 201) * 6), t0 = top + jag;
    R(c, px + k, t0, 4, py + 16 - t0, s[2]);
    for (let yy = t0, row = 0; yy < py + 14; yy += 5, row++) stone(c, px + k - (row % 2 ? 2 : 0) + (row % 2 && k === 0 ? 2 : 0), yy, row % 2 && k === 0 ? 4 : 6, 5, hash(px + k, yy, 202));
    R(c, px + k, t0, 4, 2, s[4]); P(c, px + k, t0, s[5]);
    if (hash(px + k, py, 203) < .3) { P(c, px + k + 1, t0, g[3]); P(c, px + k + 2, t0, g[2]); P(c, px + k + 1, t0 + 1, g[2]); }
  }
  if (v < .35) for (let k = 0; k < 6; k++) { const ix = px + 2 + Math.floor(hash(px, k, 204) * 12), iy = top + 4 + Math.floor(hash(py, k, 204) * Math.max(1, h - 6)); P(c, ix, iy, g[2]); P(c, ix + 1, iy + 1, g[1]); P(c, ix, iy + 1, g[3]); }
  R(c, px, py + 14, 16, 2, s[1]);
}
function rubble(c, px, py) { for (let k = 0; k < 6; k++) { const rx = px + 2 + Math.floor(hash(px, k, 205) * 12), ry = py + 4 + Math.floor(hash(py, k, 205) * 10); stone(c, rx, ry, 4 + (k % 2), 3, hash(rx, ry, 206)); } }
function brokenTower(c, px, py, h) {
  // a round-ish tower two tiles wide, its top broken off, an empty window, ivy up one side
  const s = PAL.cobble, g = PAL.grass, base = py + 32, top = base - h;
  R(c, px + 2, top + 6, 28, base - top - 6, s[1]);
  for (let yy = top + 6, row = 0; yy < base - 2; yy += 6, row++) for (let xx = px + 2 - (row % 2 ? 4 : 0); xx < px + 30; xx += 8) { const sx = Math.max(px + 2, xx); stone(c, sx, yy, Math.min(8, px + 30 - sx), 6, hash(xx, yy, 207)); }
  R(c, px + 26, top + 6, 4, base - top - 6, s[0]); R(c, px + 2, top + 6, 2, base - top - 6, s[4]);
  for (let k = 0; k < 28; k += 3) { const j = Math.floor(hash(px + k, py, 208) * 9); R(c, px + 2 + k, top + j, 3, 8 - Math.min(7, j), s[3]); P(c, px + 2 + k, top + j, s[5]); }
  R(c, px + 12, top + 20, 7, 11, '#14101e'); R(c, px + 12, top + 20, 7, 2, s[1]);
  for (let k = 0; k < 14; k++) { const iy = top + 10 + Math.floor(hash(px, k, 209) * (h - 14)); P(c, px + 3 + (k % 3), iy, g[2]); P(c, px + 4 + (k % 3), iy + 1, g[3]); }
  R(c, px, base - 2, 32, 2, s[1]);
}
function chest(c, x, y) {
  const t = PAL.timber, b = PAL.brass;
  R(c, x, y + 4, 14, 8, t[2]); R(c, x, y + 4, 14, 1, t[3]); R(c, x - 1, y + 1, 16, 4, t[3]); R(c, x - 1, y + 1, 16, 1, t[4]);
  R(c, x + 3, y + 1, 2, 11, b[2]); R(c, x + 9, y + 1, 2, 11, b[2]); R(c, x + 6, y + 5, 3, 3, b[3]); P(c, x + 7, y + 6, b[1]); R(c, x, y + 11, 14, 1, t[0]);
}
function dinoSkeleton(c, x, y) {
  // a long-necked dinosaur laid out in the pit: skull, neck, ribs, legs and tail, with dig tools and string lines
  const bone = '#efe4c8', mid = '#d6c7a2', lo = '#9c8c6e', ink = '#5a4a3a', d = PAL.dirt;
  for (let k = 0; k < 9; k++) { R(c, x + 6 + k * 18, y + 4, 1, 56, d[2]); } for (let k = 0; k < 3; k++) R(c, x + 4, y + 10 + k * 18, 150, 1, '#c9b99c');
  const pts = [[16, 38], [24, 33], [32, 29], [41, 27], [50, 27], [58, 29], [66, 31]];   // neck, rising from the skull to the shoulders
  ell(c, x + 10, y + 40, 6, 4, ink); ell(c, x + 10, y + 39, 5, 3, bone); R(c, x + 6, y + 41, 6, 1, mid); P(c, x + 8, y + 38, ink); R(c, x + 4, y + 41, 3, 2, bone);
  pts.forEach(([px, py]) => { ell(c, x + px, y + py + 1, 3, 2, ink); ell(c, x + px, y + py, 2, 2, bone); P(c, x + px - 1, y + py - 1, '#ffffff'); });
  for (let k = 0; k < 9; k++) { const rx = x + 72 + k * 5; ell(c, rx, y + 33, 2, 2, ink); ell(c, rx, y + 32, 2, 1, bone);   // spine over the ribs
    for (const dir of [-1, 1]) { let px = rx, py = y + 33; for (let j = 0; j < 9; j++) { px += dir * .5; py += dir; P(c, px, py, j < 2 ? bone : mid); if (j === 8) P(c, px, py + dir, lo); } } }
  for (let k = 0; k < 14; k++) { const tx = x + 118 + k * 4, ty = y + 33 + Math.round(Math.sin(k / 4) * 3) + (k > 8 ? k - 8 : 0); ell(c, tx, ty + 1, 2, 1, ink); ell(c, tx, ty, Math.max(1, 2 - (k >> 3)), 1, bone); }
  [[78, 42], [86, 43], [106, 42], [114, 43]].forEach(([lx, ly]) => { R(c, x + lx, y + ly, 2, 12, bone); R(c, x + lx + 2, y + ly, 1, 12, lo); ell(c, x + lx + 1, y + ly + 13, 3, 1, bone); });
  R(c, x + 150, y + 50, 2, 9, PAL.timber[2]); fillPoly(c, [[x + 150, y + 42], [x + 158, y + 46], [x + 150, y + 48]], PAL.steel[3]);   // pickaxe
  R(c, x + 20, y + 52, 6, 4, PAL.timber[3]); R(c, x + 21, y + 51, 4, 1, PAL.steel[3]); R(c, x + 30, y + 53, 2, 5, PAL.timber[1]); R(c, x + 29, y + 51, 4, 2, '#c9b99c');   // bucket and brush
}
function caveMound(c, px, py, w, h) {
  // a rocky outcrop built from rounded boulders, moss on top, an arched mouth with stalactites and crystals
  const r = PAL.rock, g = PAL.alpine, W2 = w * TILE, H2 = h * TILE, cx = px + W2 / 2, mouthY = py + H2 - 22;
  for (let k = 0; k < 26; k++) {
    const bx = px + 6 + Math.floor(hash(px, k, 210) * (W2 - 12)), by = py + 10 + Math.floor(hash(py, k, 211) * (H2 - 18)), rr = 7 + Math.floor(hash(k, px, 212) * 8);
    ell(c, bx + 1, by + 2, rr, Math.round(rr * .75), r[1]); ell(c, bx, by, rr, Math.round(rr * .75), r[2]); ell(c, bx - 2, by - 2, rr - 3, Math.max(1, Math.round(rr * .5)), r[3]); P(c, bx - rr / 2, by - rr / 2, r[4]);
  }
  for (let k = 0; k < 10; k++) { const mx = px + 10 + Math.floor(hash(k, py, 213) * (W2 - 20)), my = py + 6 + Math.floor(hash(py, k, 214) * 14); ell(c, mx, my, 5, 2, g[2]); P(c, mx - 2, my - 1, g[4]); P(c, mx + 1, my - 1, g[3]); }
  ell(c, cx, mouthY + 6, 13, 12, '#0c0a14'); R(c, cx - 13, mouthY + 6, 27, 16, '#0c0a14'); ell(c, cx, mouthY + 4, 11, 8, '#141020');
  for (let k = -10; k <= 10; k += 3) { const len = 3 + Math.floor(hash(k, px, 215) * 5); R(c, cx + k, mouthY - 3, 2, len, r[3]); P(c, cx + k, mouthY - 3 + len, r[1]); }
  ell(c, cx, mouthY - 4, 15, 4, r[3]); ell(c, cx, mouthY - 5, 13, 2, r[4]);
  [[-8, 14], [6, 12], [-2, 16], [9, 17]].forEach(([dx, dy]) => { const x0 = cx + dx, y0 = mouthY + dy; fillPoly(c, [[x0, y0 - 6], [x0 - 2, y0], [x0 + 2, y0]], '#5fb3d9'); P(c, x0, y0 - 5, '#d8f3ff'); CRYSTALS.push([x0, y0 - 3]); });
}
function shipwreck(c, x, y, flip) {
  // a hull on its side in the shallows: planks, broken ribs, a snapped mast, a scrap of sail, foam where waves break on it
  const t = PAL.timber, wa = PAL.water, f = v => flip ? -v : v, X = v => x + f(v);
  ell(c, x, y + 4, 30, 9, wa[3]); ring(c, x, y + 4, 31, 10, wa[5]);
  for (let k = -22; k <= 22; k += 4) { const top = y - 6 + Math.round(Math.abs(k) / 5); R(c, x + k, top, 4, y + 6 - top, k % 8 === 0 ? t[2] : t[3]); P(c, x + k, top, t[4]); R(c, x + k + 3, top, 1, y + 6 - top, t[1]); }
  for (let k = -16; k <= 14; k += 6) { R(c, x + k, y - 12 + Math.round(Math.abs(k) / 4), 2, 8, t[1]); P(c, x + k, y - 12 + Math.round(Math.abs(k) / 4), t[3]); }
  line(c, X(4), y - 4, X(22), y - 26, t[1]); line(c, X(5), y - 4, X(23), y - 26, t[2]); line(c, X(14), y - 15, X(27), y - 13, t[1]);
  fillPoly(c, [[X(16), y - 20], [X(26), y - 13], [X(18), y - 10]], PAL.plaster[2]); P(c, X(18), y - 16, PAL.plaster[4]);
  for (let k = 0; k < 7; k++) P(c, x - 26 + Math.floor(hash(x, k, 216) * 52), y + 8 + (k % 3), '#ffffff');
  for (let k = 0; k < 5; k++) { const sx = x - 20 + Math.floor(hash(y, k, 217) * 40); P(c, sx, y + 6, PAL.grass[1]); P(c, sx, y + 7, PAL.grass[2]); }
}

/* ---------- placement ---------- */
const BUILDINGS = [
  { id: 'dojo',   tx: 67, ty: 39, tw: 7, th: 6, kind: 'dojo' },
  { id: 'tailor', tx: 43, ty: 40, tw: 7, th: 6, kind: 'cottage', roof: 'tailorRoof', glyph: 'scissors', wins: [6, 80], posts: [24, 64], chimney: true, shutters: true },
  { id: 'print',  tx: 82, ty: 52, tw: 9, th: 6, kind: 'cottage', roof: 'printRoof', glyph: 'press', wins: [8, 102], posts: [30, 84], shutters: true, flowers: true, dormer: 46, chimney: true, ivy: true },
  { id: 'crier',  tx: 100, ty: 21, tw: 7, th: 6, kind: 'cottage', roof: 'crierRoof', glyph: 'bell', wins: [6, 80], posts: [24, 64], awnings: true },
  { id: 'tavern', tx: 19, ty: 64, tw: 9, th: 6, kind: 'cottage', roof: 'tavernRoof', glyph: 'mug', wins: [8, 104], posts: [28, 86], chimney: true, barrels: true, flowers: true, lamps: true, curtains: '#a44a3a' },
  { id: 'vault',  tx: 105, ty: 78, tw: 7, th: 5, kind: 'vault' },
  { id: 'hq',     tx: 13, ty: 11, tw: 11, th: 8, kind: 'keep' },
];
const BOT_SPOTS = { dojo: [72, 45], tailor: [48, 46], print: [91, 57], crier: [99, 27], vault: [110, 83], tavern: [26, 70], well: [17, 45], hq: [21, 19] };
const PLACE_DEFS = [
  ['square', 'Town Square', 60, 60], ['basecamp', 'Base Camp', 49, 47], ['press', 'Press Row', 80, 60], ['lighthouse', 'Lighthouse Cliff', 99, 29],
  ['vault', 'Vault Island', 104, 85], ['crossroads', 'Crossroads Inn', 33, 70], ['woods', 'Whispering Woods', 25, 47], ['keep', 'The Keep', 20, 21],
  ['convert', 'Convert Camp', 50, 25], ['harbor', 'The Harbor', 107, 60],
];
const REGIONS = [
  ['The Summit', 64, 16, 7], ['Define Camp', 64, 20, 15], ['Convert Camp', 64, 25, 24], ['The Foothills', 64, 30, 36],
  ['Town Square', 64, 56, 12], ['Base Camp', 45, 45, 9], ['Dojo', 70, 43, 6], ['Press Row', 86, 57, 9], ['The Harbor', 110, 60, 8],
  ['The Old Castle', 52, 80, 8], ['The Dig', 62, 88, 6], ['The Cave', 81, 80, 5], ['Lighthouse Cliff', 106, 24, 12], ['Vault Island', 108, 82, 10], ['Crossroads Inn', 26, 70, 10], ['Whispering Woods', 22, 44, 14], ['The Keep', 18, 16, 12],
];

function validSlot(x, y, L) {
  for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 3; xx++) {
    if (!inb(xx, yy)) return false; const i = id(xx, yy);
    if (lv[i] !== L || cliff[i] || solid[i] || isWater(ter[i]) || ter[i] === T.PATH || ter[i] === T.STAIRS || reserve[i] >= 2) return false;
  }
  for (let yy = y - 1; yy < y + 3; yy++) for (let xx = x - 1; xx < x + 4; xx++) if (inb(xx, yy) && reserve[id(xx, yy)] === 4) return false;
  return true;
}
function claimSlot(x, y) { for (let yy = y - 1; yy < y + 3; yy++) for (let xx = x - 1; xx < x + 4; xx++) if (inb(xx, yy)) reserve[id(xx, yy)] = Math.max(reserve[id(xx, yy)], xx >= x && xx < x + 3 && yy >= y && yy < y + 2 ? 4 : 1); }
function findSlots() {
  Object.entries(SLOT_ANGLES).forEach(([camp, angles]) => {
    const L = LEVEL_NAME.indexOf(camp), [ox, oy] = MT.rings[L - 1], [ix, iy] = MT.rings[L], rx = (ox + ix) / 2, ry = (oy + iy) / 2;
    angles.forEach(deg => {
      const a = deg * Math.PI / 180, x0 = Math.round(MT.cx + Math.cos(a) * rx - 1.5), y0 = Math.round(MT.cy + Math.sin(a) * ry - 1);
      for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = x0 + dx, y = y0 + dy; if (!validSlot(x, y, L)) continue;
        const spur = spurFrom(x, y, L); if (!spur) continue;
        SLOTS[camp].push([x, y]); claimSlot(x, y); layPath(spur, false); return;
      }
    });
  });
}
function campsite(c, x, y) {
  const s = PAL.cobble, t = PAL.timber;
  for (let a = 0; a < 7; a++) { const g = a / 7 * Math.PI * 2; stone(c, x + Math.round(Math.cos(g) * 6) - 2, y + Math.round(Math.sin(g) * 3) - 1, 4, 3, hash(x, a, 3)); }
  R(c, x - 3, y - 1, 6, 2, '#3a2a2a'); R(c, x - 2, y - 1, 4, 1, t[1]);
}

function build() {
  genTerrain();
  carveStairs(63, 0, 'foot'); carveStairs(53, 1, 'convert'); carveStairs(70, 2, 'define'); carveStairs(63, 3, 'summit');
  genRiver();
  genRoads();
  genTrails();
  layoutSouth();
  // hold the stations and the shrine before the campsites are chosen
  [[47, 23, 2, 2], [59, 20, 2, 2], [62, 14, 3, 2], [51, 40, 2, 2], [59, 48, 2, 2], [50, 25, 1, 1]].forEach(([x, y, w, h]) => { for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (inb(xx, yy)) reserve[id(xx, yy)] = Math.max(reserve[id(xx, yy)], 2); });
  findSlots();
  const railOrder = []; { const railSet = new Set(RAIL.map(([x, y]) => key(x, y))), seen = new Set(); let cur = RAIL[0];
    while (cur) { railOrder.push(cur); seen.add(key(cur[0], cur[1])); cur = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cur[0] + dx, cur[1] + dy]).find(([x, y]) => railSet.has(key(x, y)) && !seen.has(key(x, y))); } }
  // reserve stairs and their approaches
  Object.values(STAIRS).flat().forEach(([x, y]) => reserveAround(x, y, 1, 1, 1));

  const canvas = document.createElement('canvas'); canvas.width = WPX; canvas.height = WPY;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  drawGround(c);
  drawFallsAndScree(c);

  const shadC = document.createElement('canvas'); shadC.width = WPX; shadC.height = WPY;
  const sh = shadC.getContext('2d'); sh.fillStyle = SHADOW; drawShadows(sh);

  // buildings
  BUILDINGS.forEach(b => {
    block(b.tx, b.ty, b.tw, b.th); reserveAround(b.tx, b.ty, b.tw, b.th, 2);
    // the rows under the roof stay open, so you can walk behind it
    const solidFrom = b.kind === 'keep' ? b.ty + 3 : b.kind === 'vault' ? b.ty + 1 : b.ty + b.th - 3;
    for (let yy = b.ty; yy < solidFrom; yy++) for (let xx = b.tx; xx < b.tx + b.tw; xx++) solid[id(xx, yy)] = 0;
    const doorX = b.tx + Math.floor(b.tw / 2), doorY = b.ty + b.th - 1;
    inter.set(key(doorX, doorY), { kind: 'door', house: b.id });
    HOUSES[b.id] = { id: b.id, door: [doorX, doorY], tile: [b.tx, b.ty, b.tw, b.th], roofTop: [(b.tx + b.tw / 2) * TILE, b.ty * TILE + 4] };
    fillPoly(sh, [[(b.tx + b.tw) * TILE, b.ty * TILE + 8], [(b.tx + b.tw) * TILE + 12, b.ty * TILE + 16], [(b.tx + b.tw) * TILE + 12, (b.ty + b.th) * TILE + 5], [b.tx * TILE + 8, (b.ty + b.th) * TILE + 5], [b.tx * TILE, (b.ty + b.th) * TILE]], SHADOW);
    const cut = b.kind === 'dojo' ? (b.ty + b.th) * TILE - 40 : b.kind === 'vault' ? b.ty * TILE + 18 : b.kind === 'keep' ? b.ty * TILE + 52 : houseSpec(b).wallY;
    objs.push({ y: (b.ty + b.th) * TILE, cut, draw: cc => b.kind === 'dojo' ? dojoHall(cc, b) : b.kind === 'vault' ? vaultHouse(cc, b) : b.kind === 'keep' ? keep(cc, b) : cottage(cc, b) });
  });
  // lighthouse
  block(110, 20, 2, 2); objs.push({ y: 22 * TILE, cut: 17 * TILE + 44, draw: cc => lighthouse(cc, 110, 17) }); ell(sh, 111 * TILE + 26, 21 * TILE + 8, 18, 6, SHADOW);
  inter.set(key(110, 21), { kind: 'lighthouse' }); inter.set(key(111, 21), { kind: 'lighthouse' });
  // square: fountain, board, pedestals, lanterns
  block(63, 55, 3, 3, { kind: 'fountain' }); objs.push({ y: 58 * TILE, draw: cc => fountain(cc, 64 * TILE + 8, 56 * TILE + 8) }); ell(sh, 64 * TILE + 13, 57 * TILE + 8, 22, 8, SHADOW);
  block(67, 53, 2, 1, { kind: 'board' }); objs.push({ y: 54 * TILE, draw: cc => townBoard(cc, 67 * TILE + 3, 52 * TILE + 8) });
  [[58, 52], [70, 52], [58, 60], [70, 60]].forEach(([x, y], n) => { block(x, y, 1, 1, { kind: 'pedestal', n }); PEDESTALS.push([x, y]); objs.push({ y: (y + 1) * TILE, draw: cc => pedestal(cc, x * TILE, y * TILE) }); });
  [[56, 55], [72, 55], [56, 59], [72, 59], [34, 74], [104, 57], [95, 77]].forEach(([x, y]) => { block(x, y); objs.push({ y: (y + 1) * TILE, draw: cc => lantern(cc, x * TILE + 8, y * TILE - 14) }); });
  [[60, 61, 6, 1], [66, 61, 6, 1]].forEach(([x, y]) => objs.push({ y: y * TILE, draw: cc => flowerBed(cc, x * TILE - 4, y * TILE + 4, 40, 10) }));
  // base camp
  block(39, 41, 2, 2); objs.push({ y: 43 * TILE, draw: cc => tentDecor(cc, 39 * TILE, 41 * TILE + 8, PAL.plaster.concat([PAL.plaster[4]])) });
  block(40, 45, 1, 1, { kind: 'campfire' }); objs.push({ y: 46 * TILE, draw: cc => campfire(cc, 40 * TILE, 45 * TILE) });
  // torii at the foot of the mountain; gate on the summit stairs
  block(62, 47); block(65, 47); objs.push({ y: 48 * TILE, cut: 46 * TILE + 8, draw: cc => torii(cc, 62 * TILE + 2, 46 * TILE - 2, 60) });
  SUMMIT_GATE = (STAIRS.summit || []).slice();
  if (SUMMIT_GATE.length) { const gy = Math.max(...SUMMIT_GATE.map(s => s[1])); objs.push({ y: (gy + 1) * TILE, cut: gy * TILE - 8, draw: cc => torii(cc, 62 * TILE + 6, gy * TILE - 18, 44, PAL.brass) }); }
  block(62, 14, 3, 2, { kind: 'shrine' }); objs.push({ y: 16 * TILE, cut: 13 * TILE + 9, draw: cc => shrine(cc, 62 * TILE, 13 * TILE - 2) });
  // stations: gondola (base camp <-> convert camp), zip line (define camp -> square)
  const stationAt = (name, x, y, kind, to) => { block(x, y, 2, 2, { kind: 'station', name }); STATIONS[name] = { x, y, kind, to }; objs.push({ y: (y + 2) * TILE, cut: y * TILE + 5, draw: cc => station(cc, x * TILE, y * TILE, kind) }); };
  stationAt('gondolaLow', 51, 40, 'gondola', 'gondolaHigh'); stationAt('gondolaHigh', 47, 23, 'gondola', 'gondolaLow');
  stationAt('zipTop', 59, 20, 'zip', 'zipLow'); stationAt('zipLow', 59, 48, 'zip', null);
  [[HARBOR_END[0] - 2, 57], [HARBOR_END[0] - 4, 60]].forEach(([x, y]) => { if (inb(x, y)) objs.push({ y: (y + 1) * TILE, draw: cc => crate(cc, x * TILE + 2, y * TILE + 4) }); });
  // rail depots at both ends of the Print Shop to Crier line, with buffer stops
  if (railOrder.length > 1) {
    const ends = [[railOrder[0], railOrder[1], 'press', PAL.printRoof, GLYPHS.press], [railOrder[railOrder.length - 1], railOrder[railOrder.length - 2], 'crier', PAL.crierRoof, GLYPHS.bell]];
    ends.forEach(([[ex, ey], [nx, ny], end, ramp, glyph]) => {
      const side = nx > ex ? 'west' : nx < ex ? 'east' : ny > ey ? 'north' : 'south';
      objs.push({ y: (ey + 1) * TILE - 1, draw: cc => bufferStop(cc, ex * TILE, ey * TILE, side) });
      const [dx, dy] = side === 'west' || side === 'east' ? [ex, ey + 1] : [ex + 1, ey];
      block(dx, dy, 2, 1, { kind: 'rail', end }); objs.push({ y: (dy + 1) * TILE, draw: cc => depot(cc, dx * TILE, dy * TILE, ramp, glyph) });
    });
  }
  // lever for the drawbridge
  block(94, 79, 1, 1, { kind: 'lever' }); LEVER = [94, 79]; objs.push({ y: 80 * TILE, draw: cc => lever(cc, 94 * TILE, 79 * TILE) });
  // the ruined castle: walls round the courtyard with breaches, a tall broken tower, rubble, a chest to find
  {
    const R0 = RUINS, gap = (x, y) => (y === R0.y && x >= 52 && x <= 54) || (x === R0.x && (y === 79 || y === 80)) || (y === R0.y + R0.h - 1 && (x === 54 || x === 55)) || (x === R0.x + R0.w - 1 && y === 81);
    const towers = [[R0.x, R0.y, 26], [R0.x + R0.w - 2, R0.y, 54], [R0.x, R0.y + R0.h - 2, 0], [R0.x + R0.w - 2, R0.y + R0.h - 2, 18]];
    const inTower = (x, y) => towers.some(([tx, ty]) => x >= tx && x < tx + 2 && y >= ty && y < ty + 2);
    for (let y = R0.y; y < R0.y + R0.h; y++) for (let x = R0.x; x < R0.x + R0.w; x++) {
      const edge = y === R0.y || y === R0.y + R0.h - 1 || x === R0.x || x === R0.x + R0.w - 1; if (!edge || inTower(x, y)) continue;
      if (gap(x, y)) { objs.push({ y: (y + 1) * TILE - 2, draw: cc => rubble(cc, x * TILE, y * TILE) }); continue; }
      const h = 10 + Math.floor(hash(x, y, 220) * 18), v = hash(x, y, 221);
      block(x, y); objs.push({ y: (y + 1) * TILE, cut: y * TILE + 4, draw: cc => ruinWall(cc, x * TILE, y * TILE, h, v) });
    }
    towers.forEach(([tx, ty, h]) => {
      block(tx, ty, 2, 2);
      if (h) objs.push({ y: (ty + 2) * TILE, cut: ty * TILE + 20, draw: cc => brokenTower(cc, tx * TILE, ty * TILE, h + 16) });
      else objs.push({ y: (ty + 2) * TILE, draw: cc => { rubble(cc, tx * TILE, ty * TILE); rubble(cc, tx * TILE + 16, ty * TILE + 8); rubble(cc, tx * TILE + 4, ty * TILE + 16); } });
    });
    for (let x = 50; x <= 54; x++) { block(x, 77); const h = 8 + Math.floor(hash(x, 77, 222) * 10); objs.push({ y: 78 * TILE, cut: 77 * TILE + 4, draw: cc => ruinWall(cc, x * TILE, 77 * TILE, h, .2) }); }
    block(55, 81); objs.push({ y: 82 * TILE, draw: cc => { const s2 = PAL.cobble; R(cc, 55 * TILE - 6, 81 * TILE + 6, 26, 7, s2[3]); R(cc, 55 * TILE - 6, 81 * TILE + 6, 26, 1, s2[5]); R(cc, 55 * TILE - 6, 81 * TILE + 12, 26, 1, s2[1]); for (let k = 0; k < 26; k += 6) R(cc, 55 * TILE - 6 + k, 81 * TILE + 7, 1, 5, s2[2]); } });
    block(52, 80, 1, 1, { kind: 'discover', what: 'chest' }); objs.push({ y: 81 * TILE, draw: cc => chest(cc, 52 * TILE + 1, 80 * TILE + 2) });
  }
  // the dinosaur dig: a roped-off pit with the skeleton laid out in it
  {
    for (let y = DIG.y + 1; y < DIG.y + DIG.h - 1; y++) for (let x = DIG.x + 1; x < DIG.x + DIG.w - 1; x++) block(x, y, 1, 1, { kind: 'discover', what: 'fossil' });
    objs.push({ y: (DIG.y + 1) * TILE, draw: cc => dinoSkeleton(cc, DIG.x * TILE + 2, DIG.y * TILE) });
    for (let x = DIG.x; x <= DIG.x + DIG.w; x += 2) [DIG.y, DIG.y + DIG.h - 1].forEach(y => objs.push({ y: (y + 1) * TILE - 1, draw: cc => { R(cc, x * TILE, y * TILE + 4, 2, 9, PAL.timber[2]); P(cc, x * TILE, y * TILE + 4, PAL.timber[4]); if (x + 2 <= DIG.x + DIG.w) R(cc, x * TILE + 2, y * TILE + 6, 30, 1, '#d8485f'); if ((x / 2) % 2) fillPoly(cc, [[x * TILE + 2, y * TILE + 1], [x * TILE + 8, y * TILE + 3], [x * TILE + 2, y * TILE + 5]], '#ffd34d'); } }));
  }
  // the cave in a rocky outcrop; its mouth is the way in
  {
    for (let y = CAVE.y; y < CAVE.y + CAVE.h; y++) for (let x = CAVE.x; x < CAVE.x + CAVE.w; x++) block(x, y);
    const mx = CAVE.x + Math.floor(CAVE.w / 2), my = CAVE.y + CAVE.h - 1; inter.set(key(mx, my), { kind: 'discover', what: 'crystal' });
    for (let y = CAVE.y; y < CAVE.y + 2; y++) for (let x = CAVE.x; x < CAVE.x + CAVE.w; x++) solid[id(x, y)] = 0;   // walk behind the top of the outcrop
    objs.push({ y: (CAVE.y + CAVE.h) * TILE, cut: (CAVE.y + 2) * TILE + 4, draw: cc => caveMound(cc, CAVE.x * TILE, CAVE.y * TILE, CAVE.w, CAVE.h) });
    LIGHTS.push({ x: mx * TILE + 8, y: my * TILE + 6, r: [8, 15, 24] });
  }
  // shipwrecks off the coast
  [[7, 60, false], [57, 94, true], [123, 40, true], [92, 93, false]].forEach(([wx, wy, flip]) => {
    let ok = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const X = wx + dx, Y = wy + dy; if (inb(X, Y) && !isWater(ter[id(X, Y)])) ok = false; }
    if (ok) objs.push({ y: (wy + 1) * TILE, draw: cc => shipwreck(cc, wx * TILE + 8, wy * TILE + 8, flip) });
  });
  // well in the woods
  block(19, 43, 2, 2, { kind: 'well' }); objs.push({ y: 45 * TILE, cut: 44 * TILE - 13, draw: cc => well(cc, 20 * TILE, 44 * TILE + 4) }); ell(sh, 20 * TILE + 6, 44 * TILE + 10, 14, 5, SHADOW);
  reserveAround(19, 43, 2, 2, 4);
  // signposts for fast travel
  PLACE_DEFS.forEach(([pid, name, x, y]) => {
    const [sx, sy] = walkable(x, y) ? [x, y] : nearestWalkable(x, y);
    block(sx, sy, 1, 1, { kind: 'sign', place: pid });
    let arrive = [sx, sy + 1]; if (!walkable(arrive[0], arrive[1])) arrive = nearestWalkable(sx, sy + 1);
    PLACES[pid] = { id: pid, name, sign: [sx, sy], arrive };
    objs.push({ y: (sy + 1) * TILE, draw: cc => signpost(cc, sx * TILE, sy * TILE) });
  });
  // bots stand by their doors
  Object.entries(BOT_SPOTS).forEach(([h, [x, y]]) => { const [bx, by] = walkable(x, y) ? [x, y] : nearestWalkable(x, y); block(bx, by, 1, 1, { kind: 'bot', house: h }); BOTS[h] = [bx, by]; });
  Object.values(SLOTS).flat().forEach(([x, y]) => objs.push({ y: (y + 2) * TILE - 4, draw: cc => campsite(cc, (x + 1) * TILE + 8, (y + 1) * TILE + 8) }));
  // ships moored in the harbor
  for (const [dx, dy] of [[-2, 4], [2, -5], [4, 4], [-4, -5], [6, -1]]) { const x = HARBOR_END[0] + dx, y = HARBOR_END[1] + dy; let ok = true; for (let yy = y - 2; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (!inb(xx, yy) || ter[id(xx, yy)] !== T.SEA) ok = false; if (ok) SHIP_SLOTS.push([x, y]); }

  // trees and scatter
  const TREES = [];
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const i = id(x, y); if (ter[i] !== T.GRASS || cliff[i] || solid[i] || reserve[i]) continue;
    const L = lv[i], woods = Math.hypot(x - 20, (y - 44) * 1.1) < 15, hill = Math.hypot(x - 18, y - 18) < 13;
    let p = .035; if (woods) p = .5; else if (hill) p = .14; else if (L === 1 || L === 2) p = .09; else if (L >= 3) p = 0;
    if (Math.hypot(x - SQUARE.x, y - SQUARE.y) < 14) p = .01;
    if (hash(x, y, 70) < p) { solid[i] = 1; reserve[i] = 3; TREES.push([x, y, L]); }
    else if (hash(x, y, 71) < .03) objs.push({ y: y * TILE + 12, draw: cc => bush(cc, x * TILE + 8, y * TILE + 8, 6 + Math.floor(hash(x, y, 72) * 4), L) });
    else if (hash(x, y, 73) < .012) objs.push({ y: y * TILE + 10, draw: cc => rock(cc, x * TILE + 8, y * TILE + 9, 4 + Math.floor(hash(x, y, 74) * 3)) });
  }
  TREES.forEach(([x, y, L]) => { ell(sh, x * TILE + 14, y * TILE + 14, 10, 4, SHADOW); objs.push({ y: (y + 1) * TILE, cut: y * TILE + 4, draw: cc => tree(cc, x * TILE, y * TILE, L > 0 || (Math.hypot(x - 18, y - 18) < 13 && hash(x, y, 75) < .5), L) }); });

  c.save(); c.globalAlpha = .38; c.drawImage(shadC, 0, 0); c.restore();
  shadC.width = shadC.height = 0;   // free its memory; phones are short of it
  objs.sort((a, z) => a.y - z.y).forEach(o => o.draw(c));
  // the upper layer: everything above head height (roofs, canopies, beams), drawn over the characters
  const upper = document.createElement('canvas'); upper.width = WPX; upper.height = WPY;
  const u = upper.getContext('2d'); u.imageSmoothingEnabled = false;
  objs.forEach(o => {
    if (o.cut == null) return;
    const g = GLASS.length, l = LIGHTS.length, ch = CHIMNEYS.length, keepArea = KEEP_AREA;   // redrawing must not register lights twice
    u.save(); u.beginPath(); u.rect(0, 0, WPX, Math.round(o.cut)); u.clip(); o.draw(u); u.restore();
    GLASS.length = g; LIGHTS.length = l; CHIMNEYS.length = ch; KEEP_AREA = keepArea;
  });
  // cables for the gondola and zip line, up on the upper layer; pylons stand on the ground
  const cable = (a, z, sag, kind) => {
    const A = [a.x * TILE + 16, a.y * TILE + 9], Z = [z.x * TILE + 16, z.y * TILE + 9];
    const at = f => [A[0] + (Z[0] - A[0]) * f, A[1] + (Z[1] - A[1]) * f + Math.sin(f * Math.PI) * sag];
    CABLES.push({ kind, at });
    if (kind === 'gondola') [1 / 3, 2 / 3].forEach(f => { const [x, y] = at(f); pylon(c, Math.round(x), Math.round(y)); pylon(u, Math.round(x), Math.round(y)); });
    for (const off of kind === 'gondola' ? [-2, 2] : [0]) { let [px, py] = at(0); for (let k = 1; k <= 60; k++) { const [x, y] = at(k / 60); line(u, px + off, py, x + off, y, PAL.steel[1]); px = x; py = y; } }
  };
  cable(STATIONS.gondolaLow, STATIONS.gondolaHigh, 10, 'gondola'); cable(STATIONS.zipTop, STATIONS.zipLow, 18, 'zip');

  // minimap: one pixel per tile
  const mini = document.createElement('canvas'); mini.width = MW; mini.height = MH; const m = mini.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = id(x, y), t = ter[i]; let col;
    if (t === T.SEA) col = deep[i] ? PAL.water[1] : PAL.water[2]; else if (t === T.SHALLOW) col = PAL.water[3]; else if (t === T.SAND) col = PAL.sand[3];
    else if (t === T.PATH || t === T.STAIRS) col = PAL.dirt[4]; else if (t === T.COBBLE) col = PAL.cobble[4]; else if (t === T.DOCK || t === T.BRIDGE) col = PAL.timber[3]; else if (t === T.RAIL) col = PAL.steel[2];
    else if (t === T.RIVER) col = PAL.water[3]; else if (t === T.ROCK) col = PAL.rock[3]; else if (t === T.SNOW) col = PAL.snow[4]; else col = rampOf(lv[i])[lv[i] > 0 ? 2 : 3];
    if (cliff[i]) col = PAL.rock[2]; if (solid[i] && t === T.GRASS) col = rampOf(lv[i])[1];
    m.fillStyle = col; m.fillRect(x, y, 1, 1);
  }
  BUILDINGS.forEach(b => { m.fillStyle = PAL[b.roof || (b.kind === 'dojo' ? 'dojoRoof' : b.kind === 'keep' ? 'hqRoof' : 'cobble')][3]; m.fillRect(b.tx, b.ty, b.tw, b.th); });


  return {
    TILE, MW, MH, WPX, WPY, PAL, SHADOW, T, canvas, upper, mini,
    ter, lv, cliff, solid, deep, id, inb, isWater, inter, key,
    GLASS, LIGHTS, CHIMNEYS, HOUSES, BOTS, PLACES, STATIONS, SLOTS, PEDESTALS, SHIP_SLOTS, REGIONS, STAIRS,
    BRIDGE_TILES, FALLS, CABLES, CRYSTALS, WELL: [20 * TILE, 44 * TILE + 4], LEVER, SUMMIT_GATE, SHRINE, LIGHTHOUSE, KEEP_AREA, CAMPFIRE, RAIL: railOrder, LEVEL_NAME,
    helpers: { hash, R, P, ell, ring, fillPoly, line, sprite, stone },
  };
}

return { build, PAL, TILE };
})();

/* Interiors: a room behind each house's door, drawn in code like the island.
   Each room keeps that house's waiting drafts as things you walk up to. */
'use strict';
window.VI = (() => {
const T = 16, RW = 22, RH = 13, DOOR = [11, 12], START = [11, 11];
const SLOTS = [[4, 7], [7, 7], [15, 7], [18, 7]];
let PAL, R, P, ell, ring, fillPoly, line, hash, stone;
const DARK = '#1a1220', INK = '#0b0814';

/* ---------- floors and walls ---------- */
function planks(c, r) {
  for (let y = 32, row = 0; y < 192; y += 6, row++) {
    let x = 16 - Math.floor(hash(row, 1, 500) * 30);
    while (x < 336) {
      const len = 34 + Math.floor(hash(x, row, 501) * 30), v = hash(x, row, 502), h = Math.min(5, 192 - y);
      const x0 = Math.max(16, x), x1 = Math.min(336, x + len);
      R(c, x0, y, x1 - x0, h, v < .14 ? r[2] : r[3]); R(c, x0, y, x1 - x0, 1, v > .9 ? r[5] : r[4]);
      if (y + 5 < 192) R(c, x0, y + 5, x1 - x0, 1, r[2]);
      if (x1 < 336) R(c, x1 - 1, y, 1, h, r[1]);
      for (let g = x0 + 6; g < x1 - 6; g += 9) if (hash(g, row, 503) < .25) R(c, g, y + 2, 4, 1, r[2]);
      if (x0 > 16) { P(c, x0 + 1, y + 2, r[1]); }
      x += len;
    }
  }
}
function tatami(c) {
  const base = '#b5ae66', hi = '#d2cb83', weave = '#a49e58', edge = '#2f3d27', edge2 = '#45583a';
  for (let ty = 2; ty < 12; ty++) {
    const off = ty % 2 ? 16 : 0;
    for (let x = 16 - off; x < 336; x += 32) {
      const x0 = Math.max(16, x), x1 = Math.min(336, x + 32), y = ty * T;
      R(c, x0, y, x1 - x0, 16, base); R(c, x0, y + 2, x1 - x0, 1, hi);
      for (let k = 4; k < 14; k += 2) R(c, x0, y + k, x1 - x0, 1, weave);
      R(c, x0, y, x1 - x0, 2, edge); R(c, x0, y + 14, x1 - x0, 2, edge); R(c, x0, y + 1, x1 - x0, 1, edge2);
      if (x1 < 336) R(c, x1 - 1, y, 1, 16, '#8e8a4c');
    }
  }
}
function flags(c, s) {
  R(c, 16, 32, 320, 160, s[1]);
  for (let ty = 2; ty < 12; ty++) for (let x = 16 - (ty % 2) * 8; x < 336; x += 16) {
    const x0 = Math.max(16, x), w = Math.min(336, x + 16) - x0 - 1;
    if (w > 2) stone(c, x0, ty * T, w, 15, .32 + hash(x, ty, 510) * .42, s);
  }
}
function cottageWall(c, trim, paper) {
  const p = PAL.plaster, tb = PAL.timber;
  R(c, 16, 0, 320, 32, p[3]);
  if (paper) for (let x = 16; x < 336; x += 8) R(c, x, 4, 3, 18, paper);
  for (let k = 0; k < 90; k++) P(c, 16 + Math.floor(hash(k, 0, 520) * 320), 5 + Math.floor(hash(k, 1, 520) * 16), p[2]);
  R(c, 16, 0, 320, 4, tb[2]); R(c, 16, 0, 320, 1, tb[3]); R(c, 16, 3, 320, 1, tb[1]);
  R(c, 16, 21, 320, 2, trim[3]); R(c, 16, 21, 320, 1, trim[4]);
  for (let x = 16; x < 336; x += 6) { R(c, x, 23, 6, 9, tb[3]); R(c, x, 23, 1, 9, tb[4]); R(c, x + 5, 23, 1, 9, tb[2]); }
  for (let x = 16; x < 336; x += 80) { R(c, x, 4, 4, 28, tb[2]); R(c, x, 4, 1, 28, tb[3]); R(c, x + 3, 4, 1, 28, tb[1]); }
  R(c, 16, 31, 320, 1, tb[1]);
}
function shojiWall(c) {
  const tb = PAL.timber;
  R(c, 16, 0, 320, 32, '#efe6cf'); R(c, 16, 0, 320, 4, tb[2]); R(c, 16, 3, 320, 1, tb[1]);
  for (let x = 16; x < 336; x += 16) R(c, x, 4, 1, 22, tb[2]);
  for (let y = 4; y < 26; y += 7) R(c, 16, y, 320, 1, tb[2]);
  for (let x = 16; x < 336; x += 64) { R(c, x, 4, 3, 28, tb[1]); R(c, x + 1, 4, 1, 28, tb[3]); }
  R(c, 16, 26, 320, 6, tb[2]); R(c, 16, 26, 320, 1, tb[3]); R(c, 16, 31, 320, 1, tb[1]);
}
function stoneWall(c) {
  const s = PAL.cobble; R(c, 16, 0, 320, 32, s[1]);
  for (let y = 0, row = 0; y < 32; y += 8, row++) for (let x = 16 - (row % 2) * 8; x < 336; x += 16) { const x0 = Math.max(16, x), w = Math.min(336, x + 16) - x0 - 1; if (w > 2) stone(c, x0, y, w, 7, hash(x, row, 530) * .7, s); }
  R(c, 16, 0, 320, 2, s[0]); R(c, 16, 31, 320, 1, s[0]);
}
function shell(c, wall) {
  // side walls and the front wall, seen from above, with the doorway in the middle
  R(c, 0, 0, 16, RH * T, DARK); R(c, 14, 0, 2, 192, '#2b2030'); R(c, 336, 0, 16, RH * T, DARK); R(c, 336, 0, 2, 192, '#2b2030');
  R(c, 0, 192, RW * T, 16, DARK); R(c, 16, 192, 320, 2, '#2b2030');
  const tb = PAL.timber, dx = DOOR[0] * T;
  R(c, dx, 192, 16, 16, tb[3]); for (let k = 194; k < 208; k += 4) R(c, dx, k, 16, 1, tb[2]); R(c, dx - 2, 192, 2, 16, tb[1]); R(c, dx + 16, 192, 2, 16, tb[1]);
  // shadow the wall throws on the floor, and dimmer corners
  c.save(); c.globalAlpha = .32; R(c, 16, 32, 320, 3, INK); c.globalAlpha = .16; R(c, 16, 35, 320, 3, INK); R(c, 16, 32, 3, 160, INK); R(c, 333, 32, 3, 160, INK); c.restore();
  // a mat inside the door
  const m = wall === 'stone' ? PAL.hqRoof : PAL.dojoRoof; R(c, dx - 6, 178, 28, 12, m[1]); R(c, dx - 5, 179, 26, 10, m[2]); for (let k = dx - 3; k < dx + 20; k += 4) R(c, k, 181, 2, 6, m[3]);
}
function windowFrame(room, c, x, y, w, h) {
  const tb = PAL.timber;
  R(c, x - 2, y - 2, w + 4, h + 4, tb[1]); R(c, x - 2, y - 2, w + 4, 1, tb[3]); R(c, x - 3, y + h + 1, w + 6, 2, tb[3]); R(c, x - 3, y + h + 1, w + 6, 1, tb[4]);
  room.windows.push({ x, y, w, h });
}
function sconce(room, c, x, y) {
  const b = PAL.brass; R(c, x - 1, y, 3, 6, b[1]); R(c, x - 2, y + 5, 5, 2, b[2]); R(c, x - 1, y - 3, 3, 3, PAL.plaster[4]);
  room.lights.push({ x, y: y - 4, r: 46, flame: true });
}

/* ---------- furniture ---------- */
function rug(c, x, y, w, h, q) { R(c, x, y, w, h, q[1]); R(c, x + 2, y + 2, w - 4, h - 4, q[2]); R(c, x + 5, y + 5, w - 10, h - 10, q[3]); R(c, x + 7, y + 7, w - 14, h - 14, q[2]); for (let k = x + 10; k < x + w - 10; k += 8) { P(c, k, y + 3, q[4]); P(c, k + 4, y + h - 4, q[4]); } for (let k = x; k < x + w; k += 3) { P(c, k, y - 1, q[3]); P(c, k + 1, y + h, q[3]); } }
function crate(c, x, y) { const tb = PAL.timber; R(c, x + 1, y + 2, 14, 13, tb[1]); R(c, x + 2, y + 3, 12, 11, tb[3]); R(c, x + 2, y + 3, 12, 1, tb[4]); line(c, x + 2, y + 4, x + 13, y + 13, tb[2]); R(c, x + 2, y + 8, 12, 1, tb[2]); }
function inkBarrel(c, x, y) { barrel(c, x, y); ell(c, x + 8, y + 2, 4, 1, '#1c1426'); }
function workbench(c, x, y, h) { const tb = PAL.timber; R(c, x, y, 26, h, tb[1]); R(c, x + 1, y + 1, 24, h - 3, tb[3]); R(c, x + 1, y + 1, 24, 1, tb[4]); for (let k = 6; k < h - 6; k += 12) { R(c, x + 4, y + k, 6, 5, PAL.plaster[4]); R(c, x + 14, y + k + 2, 3, 3, '#1c1426'); R(c, x + 19, y + k, 3, 6, PAL.steel[3]); } }
function lecternOld(c, x, y) { const tb = PAL.timber; R(c, x + 6, y + 6, 4, 9, tb[2]); R(c, x + 6, y + 6, 1, 9, tb[3]); R(c, x + 3, y + 14, 10, 2, tb[1]); fillPoly(c, [[x + 1, y + 7], [x + 15, y + 7], [x + 13, y + 1], [x + 3, y + 1]], tb[3]); line(c, x + 3, y + 1, x + 13, y + 1, tb[4]); R(c, x + 1, y + 7, 14, 1, tb[1]); }
function lectern(c, x, y) {
  const tb = PAL.timber;
  ell(c, x + 8, y + 15, 6, 1, INK); R(c, x + 3, y + 12, 10, 3, tb[0]); R(c, x + 4, y + 12, 8, 2, tb[2]);
  R(c, x + 6, y + 5, 4, 8, tb[0]); R(c, x + 7, y + 5, 2, 8, tb[3]);
  fillPoly(c, [[x, y + 7], [x + 16, y + 7], [x + 14, y - 1], [x + 2, y - 1]], tb[0]); fillPoly(c, [[x + 1, y + 6], [x + 15, y + 6], [x + 13, y], [x + 3, y]], tb[3]);
  R(c, x + 3, y, 10, 1, tb[4]); R(c, x + 1, y + 6, 14, 1, tb[2]);
}
function lowtable(c, x, y) { R(c, x + 1, y + 6, 14, 5, '#2a1418'); R(c, x + 1, y + 6, 14, 1, '#5a2a2c'); R(c, x + 2, y + 11, 2, 3, '#1a0c10'); R(c, x + 12, y + 11, 2, 3, '#1a0c10'); const z = PAL.dojoRoof; R(c, x + 3, y + 13, 10, 3, z[2]); R(c, x + 3, y + 13, 10, 1, z[3]); }
function plinth(c, x, y) { const s = PAL.cobble; R(c, x + 2, y + 7, 12, 9, s[2]); R(c, x + 2, y + 7, 12, 1, s[4]); R(c, x + 2, y + 15, 12, 1, s[1]); R(c, x + 3, y + 8, 1, 7, s[3]); }
function standBase(c, x, y) { const tb = PAL.timber, p = PAL.plaster; ell(c, x + 8, y + 15, 5, 1, INK); R(c, x + 7, y + 8, 2, 7, tb[1]); R(c, x + 3, y + 14, 10, 2, tb[2]); R(c, x + 3, y + 14, 10, 1, tb[3]); R(c, x + 4, y - 3, 8, 11, p[1]); R(c, x + 5, y - 3, 6, 11, p[3]); R(c, x + 5, y - 3, 2, 10, p[4]); R(c, x + 7, y - 6, 2, 3, tb[2]); }
function roundTable(c, x, y) { const tb = PAL.timber; ell(c, x + 8, y + 9, 7, 4, tb[1]); ell(c, x + 8, y + 8, 7, 4, tb[3]); ell(c, x + 7, y + 7, 5, 2, tb[4]); R(c, x + 7, y + 12, 2, 3, tb[1]); [[x - 3, y + 9], [x + 15, y + 9]].forEach(([sx, sy]) => { ell(c, sx + 2, sy + 2, 3, 2, tb[2]); ell(c, sx + 2, sy + 1, 3, 2, tb[3]); }); }
const SLOT_DRAW = { lectern, lowtable, box: plinth, mannequin: standBase, table: roundTable };

function press(c, x, y) {
  const s = PAL.steel, tb = PAL.timber;
  R(c, x + 2, y + 40, 60, 8, INK); R(c, x + 4, y + 10, 6, 36, s[1]); R(c, x + 50, y + 10, 6, 36, s[1]); R(c, x + 4, y + 10, 1, 36, s[3]); R(c, x + 50, y + 10, 1, 36, s[3]);
  R(c, x + 2, y + 4, 56, 8, s[2]); R(c, x + 2, y + 4, 56, 1, s[4]); R(c, x + 2, y + 11, 56, 1, s[0]); R(c, x + 24, y, 12, 5, s[3]);
  R(c, x + 8, y + 30, 44, 8, tb[2]); R(c, x + 8, y + 30, 44, 1, tb[4]); R(c, x + 12, y + 31, 36, 5, PAL.plaster[4]);
  ring(c, x + 60, y + 26, 9, 9, s[3]); ring(c, x + 60, y + 26, 8, 8, s[1]); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; line(c, x + 60 - Math.cos(a) * 8, y + 26 - Math.sin(a) * 8, x + 60 + Math.cos(a) * 8, y + 26 + Math.sin(a) * 8, s[2]); } R(c, x + 58, y + 24, 4, 4, PAL.brass[3]);
  R(c, x + 4, y + 44, 8, 4, s[0]); R(c, x + 48, y + 44, 8, 4, s[0]);
}
function typeCase(c, x, y) { const tb = PAL.timber; R(c, x, y + 2, 48, 14, tb[2]); R(c, x, y + 2, 48, 1, tb[4]); for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) { R(c, x + 2 + k * 8, y + 4 + r * 6, 7, 5, tb[3]); P(c, x + 5 + k * 8, y + 6 + r * 6, PAL.brass[3]); } }
function paperStacks(c, x, y) { const p = PAL.plaster; [[0, 4, 5], [12, 0, 9], [22, 6, 4]].forEach(([dx, dy, n]) => { for (let k = 0; k < n; k++) { R(c, x + dx, y + dy + 20 - k * 2, 11, 2, k % 2 ? p[4] : p[3]); } R(c, x + dx, y + dy + 20 - n * 2, 11, 1, '#ffffff'); }); }
function dryingLine(c, x0, x1, y) { for (let x = x0; x <= x1; x++) P(c, x, y + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 3), PAL.timber[1]); for (let x = x0 + 8; x < x1 - 6; x += 18) { const yy = y + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 3); R(c, x, yy + 1, 10, 12, PAL.plaster[4]); R(c, x + 9, yy + 1, 1, 12, PAL.plaster[2]); for (let k = 3; k < 11; k += 2) R(c, x + 2, yy + k, 6, 1, PAL.plaster[2]); R(c, x + 2, yy, 2, 2, PAL.timber[3]); R(c, x + 6, yy, 2, 2, PAL.timber[3]); } }
function scroll(c, x, y) { R(c, x - 1, y, 20, 2, PAL.timber[1]); R(c, x, y + 2, 18, 22, '#f5ecd6'); R(c, x, y + 2, 1, 22, '#d9ccb4'); R(c, x - 1, y + 24, 20, 2, PAL.timber[1]); [[6, 5, 7], [9, 8, 2], [5, 12, 8], [8, 15, 6], [10, 19, 3]].forEach(([dx, dy, w]) => R(c, x + dx - 1, y + dy, w, 2, '#1c1426')); R(c, x + 12, y + 20, 3, 3, '#d8485f'); }
function weaponRack(c, x, y) { const tb = PAL.timber; R(c, x, y + 4, 44, 3, tb[2]); R(c, x, y + 13, 44, 3, tb[2]); for (let k = 0; k < 5; k++) { R(c, x + 4 + k * 8, y, 2, 18, k % 2 ? tb[4] : tb[3]); P(c, x + 4 + k * 8, y, tb[5]); } R(c, x, y + 4, 2, 12, tb[1]); R(c, x + 42, y + 4, 2, 12, tb[1]); }
function dummy(c, x, y) { const tb = PAL.timber; ell(c, x + 8, y + 15, 6, 2, INK); R(c, x + 6, y + 2, 4, 14, tb[3]); R(c, x + 6, y + 2, 1, 14, tb[4]); R(c, x + 1, y + 6, 14, 2, tb[2]); R(c, x + 3, y + 10, 10, 2, tb[2]); ell(c, x + 8, y + 1, 3, 3, tb[3]); }
function depositWall(c) {
  const b = PAL.brass;
  for (let y = 5; y < 30; y += 8) for (let x = 20; x < 332; x += 12) { if (x > 140 && x < 204) continue; R(c, x, y, 11, 7, b[1]); R(c, x + 1, y + 1, 9, 5, b[2]); R(c, x + 1, y + 1, 9, 1, b[3]); P(c, x + 5, y + 3, INK); P(c, x + 5, y + 4, b[0]); }
}
function vaultDoor(c, cx, cy) { const s = PAL.steel; ell(c, cx, cy + 2, 22, 22, INK); ell(c, cx, cy, 21, 21, s[1]); ell(c, cx, cy, 19, 19, s[3]); ell(c, cx - 2, cy - 2, 15, 15, s[4]); ell(c, cx, cy, 14, 14, s[2]); for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; R(c, cx + Math.cos(ang) * 18 - 1, cy + Math.sin(ang) * 18 - 1, 3, 3, s[5]); } R(c, cx + 18, cy - 4, 6, 8, s[1]); }
function goldPile(c, x, y) { const b = PAL.brass; ell(c, x + 8, y + 12, 7, 3, b[1]); ell(c, x + 8, y + 10, 6, 3, b[2]); ell(c, x + 7, y + 8, 4, 2, b[3]); P(c, x + 6, y + 7, b[4]); P(c, x + 10, y + 10, b[4]); }
function ledgerDesk(c, x, y) { const tb = PAL.timber; R(c, x, y + 4, 44, 14, tb[2]); R(c, x, y + 4, 44, 2, tb[4]); R(c, x + 2, y + 18, 3, 8, tb[1]); R(c, x + 39, y + 18, 3, 8, tb[1]); R(c, x + 8, y + 5, 16, 10, PAL.plaster[4]); R(c, x + 16, y + 5, 1, 10, PAL.plaster[2]); for (let k = 7; k < 14; k += 2) { R(c, x + 10, y + k, 5, 1, PAL.plaster[2]); R(c, x + 18, y + k, 5, 1, PAL.plaster[2]); } R(c, x + 30, y + 8, 4, 4, INK); line(c, x + 32, y + 8, x + 36, y + 2, PAL.plaster[4]); }
function fabricRack(c, x, y) { const tb = PAL.timber; R(c, x, y, 28, 44, tb[1]); R(c, x + 1, y + 1, 26, 42, tb[2]); const cols = [PAL.tailorRoof, PAL.printRoof, PAL.dojoRoof, PAL.hqRoof, PAL.crierRoof, PAL.tavernRoof]; for (let r = 0; r < 3; r++) { R(c, x + 1, y + 13 + r * 14, 26, 2, tb[3]); for (let k = 0; k < 3; k++) { const q = cols[(r * 3 + k) % cols.length]; R(c, x + 3 + k * 8, y + 3 + r * 14, 7, 10, q[3]); R(c, x + 3 + k * 8, y + 3 + r * 14, 2, 10, q[4]); R(c, x + 9 + k * 8, y + 3 + r * 14, 1, 10, q[1]); } } }
function mirror(c, x, y) { const b = PAL.brass; R(c, x, y, 20, 26, b[2]); R(c, x + 2, y + 2, 16, 22, '#a9c8e0'); line(c, x + 4, y + 18, x + 12, y + 4, '#e8f4fb'); line(c, x + 7, y + 20, x + 15, y + 6, '#cfe6f3'); }
function cuttingTable(c, x, y) { const tb = PAL.timber; R(c, x, y + 4, 60, 14, tb[3]); R(c, x, y + 4, 60, 1, tb[4]); R(c, x + 2, y + 18, 3, 8, tb[1]); R(c, x + 55, y + 18, 3, 8, tb[1]); const q = PAL.tailorRoof; R(c, x + 6, y + 6, 30, 9, q[3]); R(c, x + 6, y + 6, 30, 1, q[4]); for (let k = 8; k < 34; k += 6) P(c, x + k, y + 10, q[5]); R(c, x + 40, y + 8, 14, 1, PAL.brass[3]); for (let k = 40; k < 54; k += 2) P(c, x + k, y + 9, INK); line(c, x + 44, y + 12, x + 50, y + 15, PAL.steel[4]); line(c, x + 44, y + 15, x + 50, y + 12, PAL.steel[4]); }
function bell(c, x, y) { const b = PAL.brass; R(c, x + 6, y, 2, 4, PAL.timber[1]); fillPoly(c, [[x + 2, y + 16], [x + 12, y + 16], [x + 10, y + 4], [x + 4, y + 4]], b[2]); R(c, x + 4, y + 4, 2, 11, b[3]); R(c, x + 1, y + 15, 12, 2, b[1]); }
function noticeBoard(c, x, y) { const tb = PAL.timber; R(c, x, y, 96, 24, tb[1]); R(c, x + 2, y + 2, 92, 20, '#a8784a'); for (let k = 0; k < 40; k++) P(c, x + 3 + Math.floor(hash(k, 2, 540) * 90), y + 3 + Math.floor(hash(k, 3, 540) * 18), '#8f6238'); }
function writingDesk(c, x, y) { const tb = PAL.timber; R(c, x, y + 4, 46, 12, tb[2]); R(c, x, y + 4, 46, 2, tb[4]); R(c, x + 2, y + 16, 3, 10, tb[1]); R(c, x + 41, y + 16, 3, 10, tb[1]); R(c, x + 6, y + 6, 12, 8, PAL.plaster[4]); R(c, x + 24, y + 7, 4, 4, INK); line(c, x + 26, y + 7, x + 31, y, '#f2e8cf'); R(c, x + 34, y + 5, 8, 8, PAL.plaster[3]); }
function counter(c, x, y, w) { const tb = PAL.timber; R(c, x, y + 2, w, 14, tb[2]); R(c, x, y + 2, w, 3, tb[4]); R(c, x, y + 4, w, 1, tb[3]); for (let k = x + 4; k < x + w; k += 12) R(c, k, y + 6, 1, 10, tb[1]); R(c, x, y + 15, w, 1, tb[1]); [[18, '#e0605a'], [52, '#ffb347'], [90, '#7be08f']].forEach(([dx, col]) => { if (dx < w - 6) { R(c, x + dx, y - 2, 4, 5, col); R(c, x + dx + 1, y - 4, 2, 2, PAL.plaster[4]); } }); }
function shelves(c, x, y, w) { const tb = PAL.timber, cols = ['#62b4e3', '#7be08f', '#d8485f', '#ffb347', '#c9a8f5', '#ffe08a']; [0, 8].forEach(dy => { R(c, x, y + dy + 7, w, 2, tb[2]); for (let k = 2; k < w - 3; k += 5) { const col = cols[Math.floor(hash(k, dy, 550) * cols.length)], h = 4 + Math.floor(hash(k, dy, 551) * 3); R(c, x + k, y + dy + 7 - h, 3, h, col); P(c, x + k + 1, y + dy + 6 - h, PAL.plaster[4]); } }); }
function stool(c, x, y) { const tb = PAL.timber; ell(c, x + 8, y + 10, 4, 2, tb[1]); ell(c, x + 8, y + 9, 4, 2, tb[3]); R(c, x + 7, y + 11, 2, 3, tb[1]); }
function barrel(c, x, y) { const tb = PAL.timber; R(c, x + 2, y + 2, 12, 13, tb[2]); R(c, x + 3, y + 1, 10, 15, tb[3]); R(c, x + 4, y + 1, 2, 15, tb[4]); R(c, x + 2, y + 5, 12, 1, PAL.steel[1]); R(c, x + 2, y + 11, 12, 1, PAL.steel[1]); ell(c, x + 8, y + 2, 5, 1, tb[4]); }
function fireplace(c, x, y) { const s = PAL.cobble; R(c, x, y, 64, 44, s[2]); for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) stone(c, x + (r % 2) * 8 + k * 16, y + r * 8, 15, 7, hash(k, r, 560), s); R(c, x + 14, y + 16, 36, 28, INK); R(c, x + 16, y + 18, 32, 26, '#2a1418'); R(c, x - 2, y + 12, 68, 4, PAL.timber[3]); R(c, x - 2, y + 12, 68, 1, PAL.timber[4]); R(c, x + 18, y + 38, 28, 4, PAL.timber[1]); }
function banner(c, x, y, ramp) { R(c, x - 1, y, 14, 2, PAL.timber[1]); R(c, x, y + 2, 12, 20, ramp[3]); R(c, x, y + 2, 2, 20, ramp[4]); R(c, x + 10, y + 2, 2, 20, ramp[2]); fillPoly(c, [[x, y + 22], [x + 12, y + 22], [x + 6, y + 27]], ramp[3]); R(c, x + 4, y + 9, 4, 4, PAL.brass[3]); }
function throne(c, x, y) { const q = PAL.hqRoof, b = PAL.brass; R(c, x + 2, y, 28, 30, b[1]); R(c, x + 4, y + 2, 24, 26, q[2]); R(c, x + 6, y + 4, 20, 14, q[3]); R(c, x, y + 20, 32, 12, b[2]); R(c, x, y + 20, 32, 1, b[3]); R(c, x + 4, y + 22, 24, 6, q[3]); P(c, x + 15, y - 2, b[4]); P(c, x + 16, y - 2, b[4]); }
function warTable(c, x, y, W) { const tb = PAL.timber; R(c, x, y + 2, 80, 28, tb[1]); R(c, x + 2, y + 2, 76, 26, tb[3]); c.save(); c.imageSmoothingEnabled = false; c.drawImage(W.mini, 6, 2, 116, 88, x + 4, y + 4, 72, 22); c.restore(); R(c, x + 4, y + 4, 72, 1, 'rgba(255,255,255,.25)'); R(c, x + 3, y + 30, 4, 4, tb[1]); R(c, x + 73, y + 30, 4, 4, tb[1]); }
function armour(c, x, y) { const s = PAL.steel; R(c, x + 7, y + 22, 2, 8, PAL.timber[1]); R(c, x + 4, y + 8, 8, 12, s[3]); R(c, x + 4, y + 8, 2, 12, s[4]); R(c, x + 2, y + 8, 12, 3, s[2]); R(c, x + 5, y + 1, 6, 7, s[3]); R(c, x + 6, y + 4, 4, 1, INK); }
function candleStand(room, c, x, y) { R(c, x + 6, y + 6, 3, 8, PAL.timber[1]); ell(c, x + 7, y + 14, 4, 1, PAL.timber[2]); R(c, x + 6, y + 3, 3, 4, PAL.plaster[4]); room.lights.push({ x: x + 7, y: y + 2, r: 40, flame: true }); }

/* ---------- the rooms ---------- */
const LAYOUT = {
  print(c, room, block) {
    cottageWall(c, PAL.printRoof); planks(c, PAL.timber); shell(c);
    windowFrame(room, c, 44, 7, 24, 13); windowFrame(room, c, 284, 7, 24, 13);
    dryingLine(c, 104, 232, 6);
    press(c, 34, 30); block(2, 2, 4, 3, { kind: 'note', label: 'The press', text: 'The press. It rolls on Sunday nights, once you approve the issue.' }); room.anims.push({ kind: 'press', x: 34, y: 30 });
    typeCase(c, 112, 30); block(7, 2, 3, 1, { kind: 'note', label: 'Type cases', text: 'Every letter of every issue was set from these drawers. 3,877 readers so far.' });
    paperStacks(c, 288, 24); block(18, 2, 2, 2, { kind: 'note', label: 'Back issues', text: 'Back issues of Covenant Lite. The Editor reads them to keep the voice right.' });
    rug(c, 48, 100, 256, 46, PAL.printRoof);
    inkBarrel(c, 32, 150); inkBarrel(c, 32, 166); inkBarrel(c, 48, 166); block(2, 9, 1, 2, { kind: 'note', label: 'Ink barrels', text: 'Ink barrels. One issue a week drinks about a barrel, the Editor reckons.' }); block(3, 10, 1, 1);
    crate(c, 304, 160); crate(c, 288, 166); block(18, 10, 2, 1);
    workbench(c, 306, 64, 52); block(19, 4, 2, 3, { kind: 'note', label: 'The workbench', text: 'Proofs, a magnifier and a pot of red ink for corrections.' });
    sconce(room, c, 96, 12); sconce(room, c, 256, 12);
    room.bot = [11, 4];
  },
  dojo(c, room, block) {
    shojiWall(c); tatami(c); shell(c);
    scroll(c, 167, 2); block(11, 1, 1, 1, { kind: 'note', label: 'The scroll', text: 'The scroll reads: "Prepare as if it is live."' });
    weaponRack(c, 34, 30); block(2, 2, 3, 1, { kind: 'note', label: 'Practice swords', text: 'Practice swords. Every mock interview is a spar, not a fight.' });
    dummy(c, 290, 32); block(18, 2, 1, 1, { kind: 'note', label: 'Training dummy', text: 'The training dummy has heard every "tell me about yourself" twice.' }); room.anims.push({ kind: 'dummy', x: 290, y: 32 });
    candleStand(room, c, 18, 166); candleStand(room, c, 318, 166); candleStand(room, c, 18, 34); candleStand(room, c, 318, 34);
    room.bot = [11, 4];
  },
  vault(c, room, block) {
    stoneWall(c); flags(c, PAL.cobble); shell(c, 'stone'); depositWall(c);
    vaultDoor(c, 176, 22); block(10, 2, 3, 1, { kind: 'note', label: 'The vault door', text: 'The vault door. Two backers, no conflicts: the Steward keeps it open.' }); room.anims.push({ kind: 'dial', x: 176, y: 22 });
    ledgerDesk(c, 40, 92); block(2, 6, 3, 2, { kind: 'note', label: 'The ledger', text: 'The ledger. Memos for the backers go out only after you approve them.' });
    goldPile(c, 300, 160); goldPile(c, 286, 166); goldPile(c, 34, 164); block(18, 10, 2, 1); block(2, 10, 1, 1); room.anims.push({ kind: 'glint', pts: [[306, 167], [292, 172], [40, 171]] });
    sconce(room, c, 112, 12); sconce(room, c, 240, 12);
    room.bot = [11, 4];
  },
  tailor(c, room, block) {
    cottageWall(c, PAL.tailorRoof, PAL.tailorRoof[4] + '55'); planks(c, PAL.timber); shell(c);
    windowFrame(room, c, 108, 7, 24, 13); windowFrame(room, c, 220, 7, 24, 13);
    fabricRack(c, 34, 30); block(2, 2, 2, 3, { kind: 'note', label: 'Bolts of cloth', text: 'Cloth for every firm. Each resume is cut to fit one seat.' });
    mirror(c, 290, 4); block(18, 1, 2, 1, { kind: 'note', label: 'The mirror', text: 'The mirror. Check the fit before the room does.' });
    cuttingTable(c, 196, 60); block(12, 4, 4, 1, { kind: 'note', label: 'Cutting table', text: 'The cutting table: scissors, chalk and a tape measure marked in bullet points.' });
    rug(c, 48, 100, 256, 46, PAL.tailorRoof);
    sconce(room, c, 176, 12);
    room.bot = [9, 4]; room.slotStyle = 'mannequin';
  },
  crier(c, room, block) {
    cottageWall(c, PAL.crierRoof); planks(c, PAL.timber); shell(c);
    windowFrame(room, c, 284, 7, 24, 13);
    bell(c, 36, 4); for (let y = 21; y < 46; y++) P(c, 42 + (y % 4 === 0 ? 1 : 0), y, '#c9b99c'); R(c, 41, 44, 3, 4, PAL.dojoRoof[3]); block(2, 2, 1, 1, { kind: 'bell' }); room.anims.push({ kind: 'bell', x: 36, y: 4 });
    noticeBoard(c, 128, 5); for (let x = 8; x <= 13; x++) block(x, 1, 1, 1, { kind: 'radar' }); room.board = { x: 128, y: 5 };
    writingDesk(c, 258, 44); block(16, 3, 3, 1, { kind: 'note', label: 'The writing desk', text: 'The Crier drafts posts here. Nothing goes out until you post it yourself.' });
    rug(c, 48, 100, 256, 46, PAL.crierRoof);
    crate(c, 32, 160); crate(c, 304, 160); block(2, 10); block(19, 10);
    sconce(room, c, 96, 12); sconce(room, c, 240, 12);
    room.bot = [11, 4];
  },
  tavern(c, room, block) {
    cottageWall(c, PAL.tavernRoof); planks(c, PAL.timber); shell(c);
    shelves(c, 34, 4, 112);
    counter(c, 32, 48, 128); for (let x = 2; x <= 9; x++) block(x, 3, 1, 1, { kind: 'roomBot' });
    [3, 5, 7, 9].forEach(x => { stool(c, x * T, 4 * T); block(x, 4); });
    fireplace(c, 240, 2); block(15, 2, 4, 1, { kind: 'note', label: 'The fireplace', text: 'The fire never goes out. Neither should a good relationship.' }); room.anims.push({ kind: 'fire', x: 256, y: 18 }); room.lights.push({ x: 272, y: 36, r: 80, flame: true, fire: true });
    rug(c, 80, 104, 200, 70, PAL.tavernRoof);
    barrel(c, 32, 144); barrel(c, 32, 160); barrel(c, 48, 160); block(2, 9, 1, 2); block(3, 10, 1, 1);
    sconce(room, c, 176, 12);
    room.bot = [6, 2]; room.slotStyle = 'table';
  },
  hq(c, room, block) {
    stoneWall(c); flags(c, PAL.cobble); const q = PAL.dojoRoof; R(c, 168, 32, 32, 160, q[1]); R(c, 170, 32, 28, 160, q[2]); for (let y = 36; y < 190; y += 10) R(c, 172, y, 24, 1, q[3]); R(c, 168, 32, 2, 160, PAL.brass[2]); R(c, 198, 32, 2, 160, PAL.brass[2]); shell(c, 'stone');
    [PAL.dojoRoof, PAL.tailorRoof, PAL.printRoof, PAL.crierRoof, PAL.tavernRoof, PAL.hqRoof].forEach((ramp, k) => banner(c, [40, 80, 120, 230, 270, 310][k], 3, ramp));
    throne(c, 160, 26); block(10, 2, 3, 1, { kind: 'note', label: 'The high seat', text: 'The high seat. It waits for the day you sign a defined seat.' });
    warTable(c, 224, 140, room.W); block(14, 9, 5, 2, { kind: 'board' });
    armour(c, 34, 30); armour(c, 306, 30); block(2, 2, 1, 1); block(19, 2, 1, 1);
    sconce(room, c, 100, 12); sconce(room, c, 252, 12);
    room.bot = [11, 4];
  },
};

function build(id, W) {
  if (!PAL) { PAL = W.PAL; ({ R, P, ell, ring, fillPoly, line, hash, stone } = W.helpers); }
  if (!LAYOUT[id]) return null;
  const cw = RW * T, ch = RH * T, canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false;
  const room = { id, W, w: RW, h: RH, cw, ch, canvas, solid: new Uint8Array(RW * RH), inter: new Map(), slots: [], lights: [], windows: [], anims: [], start: START, door: DOOR, bot: null, slotStyle: null };
  const block = (x, y, w = 1, h = 1, o) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { room.solid[yy * RW + xx] = 1; if (o) room.inter.set(xx + ',' + yy, o); } };
  for (let x = 0; x < RW; x++) { block(x, 0); block(x, 1); if (x !== DOOR[0]) block(x, RH - 1); }
  for (let y = 0; y < RH; y++) { block(0, y); block(RW - 1, y); }
  LAYOUT[id](c, room, block);
  room.slotStyle = room.slotStyle || ({ dojo: 'lowtable', vault: 'box' }[id] || 'lectern');
  SLOTS.forEach(([x, y], n) => { SLOT_DRAW[room.slotStyle](c, x * T, y * T); block(x, y, 1, 1, { kind: 'slot', n }); room.slots.push({ x, y }); });
  if (room.bot && !room.inter.has(room.bot.join(','))) block(room.bot[0], room.bot[1], 1, 1, { kind: 'roomBot' });
  return room;
}

/* ---------- moving parts, drawn every frame ---------- */
function drawSlot(ctx, room, n, filled, accent, t, ox, oy) {
  const s = room.slots[n], x = s.x * T + ox, y = s.y * T + oy, p = PAL.plaster;
  if (!filled) return;
  switch (room.slotStyle) {
    case 'lectern': R(ctx, x + 3, y + 1, 10, 6, p[4]); R(ctx, x + 3, y + 1, 10, 1, '#ffffff'); for (let k = 3; k < 7; k += 2) R(ctx, x + 5, y + k, 6, 1, p[2]); break;
    case 'lowtable': R(ctx, x + 4, y + 4, 8, 3, p[4]); R(ctx, x + 3, y + 4, 1, 3, PAL.timber[2]); R(ctx, x + 12, y + 4, 1, 3, PAL.timber[2]); R(ctx, x + 6, y + 5, 4, 1, '#1c1426'); break;
    case 'box': { const b = PAL.brass; R(ctx, x + 3, y + 2, 10, 6, b[2]); R(ctx, x + 3, y + 2, 10, 1, b[3]); R(ctx, x + 3, y - 2, 10, 4, b[1]); R(ctx, x + 5, y, 6, 3, p[4]); break; }
    case 'mannequin': { const j = accent; R(ctx, x + 4, y - 2, 8, 11, j); R(ctx, x + 4, y - 2, 2, 11, '#ffffff33'); R(ctx, x + 6, y - 6, 4, 4, PAL.plaster[3]); R(ctx, x + 7, y - 2, 2, 5, p[4]); R(ctx, x + 11, y + 3, 4, 5, p[4]); P(ctx, x + 12, y + 4, '#d8485f'); break; }
    case 'table': R(ctx, x + 3, y + 5, 6, 4, p[4]); P(ctx, x + 4, y + 6, '#d8485f'); R(ctx, x + 10, y + 3, 3, 4, PAL.brass[3]); R(ctx, x + 10, y + 3, 3, 1, '#fff6e0'); break;
  }
}
function drawAnims(ctx, room, t, ox, oy, extra) {
  room.anims.forEach(a => {
    const x = a.x + ox, y = a.y + oy;
    if (a.kind === 'press') { const k = Math.round((Math.sin(t / 18) + 1) * 3), s = PAL.steel; R(ctx, x + 10, y + 12 + k, 40, 5, s[2]); R(ctx, x + 10, y + 12 + k, 40, 1, s[4]); R(ctx, x + 28, y + 12, 4, k, s[3]); if (k > 4) R(ctx, x + 14, y + 36, 32, 2, '#1c1426'); }
    if (a.kind === 'dummy') { const w = Math.round(Math.sin(t / 25) * 1); if (w) { R(ctx, x + 1 + w, y + 6, 14, 2, PAL.timber[2]); } }
    if (a.kind === 'dial') { const ang = t / 90, s = PAL.steel; for (let k = 0; k < 3; k++) { const q = ang + k * Math.PI * 2 / 3; line(ctx, x, y, x + Math.cos(q) * 10, y + Math.sin(q) * 10, s[5]); } ell(ctx, x, y, 3, 3, PAL.brass[3]); P(ctx, x - 1, y - 1, PAL.brass[4]); }
    if (a.kind === 'glint') a.pts.forEach(([gx, gy], i) => { if (((t >> 3) + i * 5) % 17 === 0) { P(ctx, gx + ox, gy + oy - 1, '#ffffff'); P(ctx, gx + ox - 1, gy + oy, '#fff6e0'); P(ctx, gx + ox + 1, gy + oy, '#fff6e0'); P(ctx, gx + ox, gy + oy + 1, '#fff6e0'); } });
    if (a.kind === 'fire') { const L = PAL.lamp; for (let k = 0; k < 7; k++) { const h = 6 + Math.floor(hash(k, t >> 2, 570) * 10), fx = x + 2 + k * 4; R(ctx, fx, y + 22 - h, 3, h, k % 2 ? L[1] : L[0]); R(ctx, fx, y + 22 - Math.floor(h * .6), 3, Math.floor(h * .5), L[2]); if (h > 12) P(ctx, fx + 1, y + 22 - h, L[3]); } }
    if (a.kind === 'bell') { const sw = extra && extra.bellT != null && t - extra.bellT < 80 ? Math.round(Math.sin((t - extra.bellT) / 5) * 3 * (1 - (t - extra.bellT) / 80)) : 0; if (sw) { const b = PAL.brass; R(ctx, x + 1, y + 4, 14, 14, PAL.plaster[3]); fillPoly(ctx, [[x + 2 + sw, y + 16], [x + 12 + sw, y + 16], [x + 10, y + 4], [x + 4, y + 4]], b[2]); R(ctx, x + 1 + sw, y + 15, 12, 2, b[1]); R(ctx, x + 6 + sw * 2, y + 17, 2, 2, b[0]); [[-6, 6], [16, 6], [-4, 12], [18, 12]].forEach(([dx, dy]) => P(ctx, x + dx + (t >> 2) % 2, y + dy, '#fff6e0')); } }
  });
}
function drawBoard(ctx, room, n, ox, oy) {
  if (!room.board) return; const { x, y } = room.board, cols = ['#f2e8cf', '#ffe08a', '#c9e8f5', '#ffd0d8'];
  for (let k = 0; k < Math.min(n, 8); k++) { const nx = x + ox + 6 + (k % 4) * 22 + Math.floor(hash(k, 1, 580) * 4), ny = y + oy + 3 + Math.floor(k / 4) * 10; R(ctx, nx, ny, 14, 8, cols[k % 4]); R(ctx, nx + 2, ny + 3, 9, 1, '#8b8193'); R(ctx, nx + 2, ny + 5, 6, 1, '#8b8193'); P(ctx, nx + 6, ny, '#d8485f'); }
}
function drawWindows(ctx, room, ox, oy, env, t) {
  const a = env.amb, sky = [Math.round(140 * a[0]), Math.round(200 * a[1]), Math.round(240 * Math.min(1.1, a[2]))], col = `rgb(${sky[0]},${sky[1]},${sky[2]})`, wx = env.wx.kind;
  room.windows.forEach(w => {
    const x = w.x + ox, y = w.y + oy; R(ctx, x, y, w.w, w.h, col);
    R(ctx, x, y + w.h - 3, w.w, 3, env.lum < .5 ? '#1d2a2a' : '#3a7442');
    if (env.lum < .5) for (let k = 0; k < 4; k++) P(ctx, x + Math.floor(hash(k, w.x, 590) * w.w), y + Math.floor(hash(k, w.y, 591) * (w.h - 4)), '#fff6e0');
    if (wx === 'rain' || wx === 'storm') for (let k = 0; k < 6; k++) { const yy = (t * 2 + k * 9) % (w.h + 4); R(ctx, x + 2 + k * 4, y + yy - 3, 1, 3, '#bfe9f3'); }
    if (wx === 'snow') for (let k = 0; k < 5; k++) P(ctx, x + 2 + k * 5, y + ((t >> 1) + k * 7) % w.h, '#ffffff');
    if (wx === 'fog') { ctx.save(); ctx.globalAlpha = .45; R(ctx, x, y, w.w, w.h, '#dde3f0'); ctx.restore(); }
    const tb = PAL.timber; R(ctx, x + Math.floor(w.w / 2), y, 1, w.h, tb[1]); R(ctx, x, y + Math.floor(w.h / 2), w.w, 1, tb[1]);
  });
}
function drawLight(ctx, room, ox, oy, env, t) {
  // dim the room to the hour, then lamps, the fire and the daylight from windows and the door
  const dark = .1 + (1 - Math.min(1, env.lum)) * .42;
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, room.cw, room.ch); ctx.clip(); ctx.globalAlpha = dark; ctx.fillStyle = INK; ctx.fillRect(ox, oy, room.cw, room.ch);
  ctx.globalCompositeOperation = 'lighter';
  room.lights.forEach((L, i) => {
    const fl = L.flame ? (hash(i, t >> 3, 600) - .5) * 4 : 0, r = L.r + fl;
    [[1, .05], [.66, .06], [.38, .08]].forEach(([k, al]) => { ctx.globalAlpha = al * (L.fire ? 1.5 : 1); ell(ctx, L.x + ox, L.y + oy + 6, r * k, r * k * .7, '#f08a2c'); });
  });
  if (env.lum > .6) {
    ctx.globalAlpha = .06 * env.lum; room.windows.forEach(w => { const x = w.x + ox, y = w.y + oy + w.h; ctx.fillStyle = '#fff0c8'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w.w, y); ctx.lineTo(x + w.w + 26, y + 70); ctx.lineTo(x + 18, y + 70); ctx.closePath(); ctx.fill(); });
    ctx.globalAlpha = .09; ell(ctx, DOOR[0] * T + 8 + ox, 190 + oy, 18, 10, '#fff0c8');
  }
  ctx.restore();
  // dust drifting in the window light
  if (env.lum > .6) room.windows.forEach((w, wi) => { for (let k = 0; k < 5; k++) { const ph = (t / 3 + k * 40 + wi * 17) % 200, x = w.x + ox + 4 + ph * .14 + Math.sin(t / 40 + k) * 3, y = w.y + oy + w.h + ph * .33; P(ctx, Math.round(x), Math.round(y), '#fff6e0'); } });
}
function drawFlames(ctx, room, ox, oy, t) {
  room.lights.forEach((L, i) => { if (!L.flame || L.fire) return; const fl = (t >> 3) + i & 1; R(ctx, L.x + ox - 1, L.y + oy, 2, 3, PAL.lamp[1]); P(ctx, L.x + ox - fl, L.y + oy - 1, PAL.lamp[3]); });
}

return { build, drawSlot, drawAnims, drawBoard, drawWindows, drawLight, drawFlames, T, RW, RH, DOOR, START };
})();

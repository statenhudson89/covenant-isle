/* Bot Village: the game, the panels and the data. Reads Supabase as the signed-in owner;
   approvals, sets and wildcards go through the PIN-checked functions. */
'use strict';
function startVillage() {
const W = VW.build();
const { TILE, MW, MH, PAL, SHADOW } = W;
const { hash, R, P, ell, ring, fillPoly, line, sprite } = W.helpers;
let VWW = 480; const VWH = 270;
const cv = document.getElementById('game'); cv.width = VWW; cv.height = VWH;
const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('bv.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bv.' + k, JSON.stringify(v)); } catch { /* private window */ } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- houses ---------- */
const HOUSE_META = {
  hq:     { name: 'Allocation HQ', bot: 'Allocator', accent: '#7a92d8', place: 'keep' },
  tavern: { name: 'The Tavern', bot: 'Rolodex', accent: '#e9a072', place: 'crossroads' },
  dojo:   { name: 'Interview Dojo', bot: 'Sensei', accent: '#e0605a', place: 'basecamp' },
  tailor: { name: 'The Tailor', bot: 'Tailor', accent: '#c9a8f5', place: 'basecamp' },
  print:  { name: 'Print Shop', bot: 'Editor', accent: '#7be08f', place: 'press' },
  crier:  { name: 'Town Crier', bot: 'Crier', accent: '#ffb347', place: 'lighthouse' },
  vault:  { name: 'The Vault', bot: 'Steward', accent: '#ffe08a', place: 'vault' },
  well:   { name: 'Wildcard Well', bot: 'The Well', accent: '#62b4e3', place: 'woods' },
};
const ORDER = ['dojo', 'tailor', 'print', 'crier', 'tavern', 'vault', 'well', 'hq'];
const KIND = { email: 'Email', x_post: 'X post', x_thread: 'X thread', x_reply: 'X reply', dm: 'DM', memo: 'Memo', resume: 'Resume', issue: 'Issue', lesson: 'Lesson', other: 'Draft' };
// drafts Staten posts or sends himself; lessons and issue outlines never go out
const shippable = a => a.kind !== 'lesson' && (a.kind !== 'issue' || /^draft/i.test(a.title));
const SHIP_VERB = a => /^x_/.test(a.kind) ? ['Mark posted', 'Posted'] : a.kind === 'issue' ? ['Mark published', 'Published'] : ['Mark sent', 'Sent'];
const CAMP_LABEL = { foothills: 'Foothills', convert: 'Convert Camp', define: 'Define Camp', summit: 'The Summit' };
const TENT_RAMPS = [PAL.printRoof, PAL.crierRoof, PAL.tailorRoof, PAL.hqRoof, PAL.tavernRoof, PAL.dojoRoof];
const housePoint = id => W.HOUSES[id] ? W.HOUSES[id].roofTop : [20 * TILE, 41 * TILE];

/* ---------- data ---------- */
let D = { houses: {}, goals: [], sets: [], approvals: [], activity: [], radar: [], wild: [], readings: [] };
let DV = derive(D);
let mode = null, sb = null, userEmail = null, pin = null, refreshTimer = 0, loadedAt = 0;

function campOf(f) {
  const c = (f.camp || '').toLowerCase();
  if (['foothills', 'convert', 'define', 'summit'].includes(c)) return c;
  if (/sign/.test(f.status)) return 'summit';
  return f.status === 'active' ? 'convert' : 'foothills';
}
function derive(d) {
  const v = { pending: {}, unsent: {}, rules: {}, goals: {}, behind: {}, firms: [], lessons: {}, tents: [], tentAt: new Map(), statues: [], summitFirm: null };
  d.approvals.filter(a => a.status === 'pending').forEach(a => (v.pending[a.house_id] ||= []).push(a));
  d.approvals.filter(a => a.status === 'approved' && !a.shipped_at && shippable(a)).forEach(a => (v.unsent[a.house_id] ||= []).push(a));
  d.approvals.filter(a => a.status === 'approved' && a.kind === 'lesson').forEach(a => (v.rules[a.house_id] ||= []).push(a));
  d.goals.forEach(g => { (v.goals[g.house_id] ||= []).push(g); if (g.behind) v.behind[g.house_id] = true; });
  const firms = new Map();
  d.activity.filter(a => a.house_id === 'dojo').forEach(a => {
    let m = /^Status \(([^)]+)\):\s*([^;]+)(.*)$/.exec(a.text || '');
    if (m) {
      const name = m[1].trim();
      if (!firms.has(name)) {
        const f = { name, status: m[2].trim().toLowerCase(), at: a.at };
        m[3].split(';').forEach(part => { const k = part.indexOf('='); if (k > 0) f[part.slice(0, k).trim().toLowerCase()] = part.slice(k + 1).trim(); });
        firms.set(name, f);
      }
      return;
    }
    m = /^Lesson \(([^)]+)\):\s*(.*)$/.exec(a.text || '');
    if (m) (v.lessons[m[1].trim()] ||= []).push({ at: a.at, text: m[2] });
  });
  v.firms = [...firms.values()].map(f => { f.camp = campOf(f); f.seats = (f.seat || '').split(/\s+\/\s+/).map(s => s.trim()).filter(s => s && s !== 'unknown'); return f; });
  const used = { foothills: 0, convert: 0, define: 0 };
  v.firms.forEach(f => {
    if (f.camp === 'summit') { v.summitFirm = f; return; }
    const s = W.SLOTS[f.camp][used[f.camp]++]; if (!s) return;
    let hsum = 0; for (const ch of f.name) hsum = (hsum * 31 + ch.charCodeAt(0)) >>> 0;
    const t = { firm: f, x: s[0], y: s[1], ramp: TENT_RAMPS[hsum % TENT_RAMPS.length] };
    v.tents.push(t);
    for (let yy = t.y; yy < t.y + 2; yy++) for (let xx = t.x; xx < t.x + 3; xx++) v.tentAt.set(W.key(xx, yy), t);
  });
  const seat = d.goals.find(g => g.id === 'defined-seat');
  v.summitOpen = !!(v.summitFirm || (seat && +seat.target_value > 0 && +seat.current_value >= +seat.target_value));
  v.gondola = v.firms.some(f => ['convert', 'define', 'summit'].includes(f.camp));
  v.zip = v.firms.some(f => ['define', 'summit'].includes(f.camp));
  const now = Date.now();
  v.feedTailor = d.activity.some(a => a.house_id === 'dojo' && /^(Lesson|Status) \(/.test(a.text || '') && now - Date.parse(a.at) < 14 * 864e5);
  v.feedCrier = d.approvals.some(a => a.house_id === 'print' && a.kind === 'issue' && a.status === 'approved' && a.decided_at && now - Date.parse(a.decided_at) < 7 * 864e5);
  const xf = d.goals.find(g => g.id === 'x-followers'); v.beam = xf ? clamp(+xf.current_value / +xf.target_value, .12, 1) : .2;
  const subs = d.goals.find(g => g.id === 'substack-subs'); let ships = 1;
  if (subs) (subs.milestones || []).forEach(ms => { const n = +(String(ms).replace(/,/g, '').match(/\d+/) || [0])[0]; if (n && +subs.current_value >= n) ships++; });
  v.ships = Math.min(ships, W.SHIP_SLOTS.length);
  v.statues = d.goals.filter(g => +g.target_value > 0 && +g.current_value >= +g.target_value).slice(0, W.PEDESTALS.length);
  return v;
}
let prevPending = null, camPan = null;
function setData(d) {
  D = d; DV = derive(D);
  const ids = new Set(D.approvals.filter(a => a.status === 'pending').map(a => a.id));
  if (prevPending && mode === 'live') {
    const fresh = D.approvals.find(a => a.status === 'pending' && !prevPending.has(a.id));
    if (fresh && W.BOTS[fresh.house_id]) { const b = W.BOTS[fresh.house_id]; camPan = { x: b[0] * TILE + 8, y: b[1] * TILE, until: t + 200 }; toast(`New draft at ${HOUSE_META[fresh.house_id].name}: ${fresh.title}`, 3600); }
  }
  prevPending = ids; loadedAt = Date.now(); computeRunner(); checkEvents(); updateHud(); if (current) rerender();
}

async function loadLive() {
  const since = days => new Date(Date.now() - days * 864e5).toISOString();
  const q = t => sb.from(t);
  const res = await Promise.all([
    q('village_state').select('*').order('sort'),
    q('goals').select('*').order('sort'),
    q('goal_sets_this_week').select('*').order('sort'),
    q('approvals').select('*').or(`status.eq.pending,decided_at.gte.${since(30)},and(kind.eq.lesson,status.eq.approved)`).order('created_at', { ascending: false }).limit(300),
    q('activity_log').select('*').gte('at', since(14)).order('at', { ascending: false }).limit(600),
    q('radar_items').select('*').order('found_at', { ascending: false }).limit(40),
    q('wildcards').select('*').order('created_at', { ascending: false }).limit(40),
    q('goal_readings').select('*').gte('at', since(120)).order('at'),
  ]);
  const bad = res.find(r => r.error);
  if (bad) throw new Error(bad.error.message);
  const [st, goals, sets, approvals, activity, radar, wild, readings] = res.map(r => r.data || []);
  if (!st.length) throw new Error('Signed in, but this account isn\'t the village owner, so nothing is visible.');
  const houses = {}; st.forEach(h => { houses[h.id] = h; });
  setData({ houses, goals, sets, approvals, activity, radar, wild, readings });
}
async function refresh(quiet) {
  if (mode !== 'live') return;
  try { await loadLive(); if (!quiet) toast('Up to date'); }
  catch (e) { toast('Couldn\'t load the village: ' + e.message); }
}

/* ---------- PIN-checked actions ---------- */
function needPin(then) {
  if (mode === 'sample' || pin) { then(); return; }
  const input = el('input', { id: 'pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Village PIN', 'aria-label': 'Village PIN' });
  const go = () => { if (!input.value) return; pin = input.value; closeModal(); then(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  openModal([el('h2', {}, 'Village PIN'), el('p', { class: 'muted' }, 'Approvals and logged sets need your PIN. It stays in this tab until you close it.'), input,
    el('div', { class: 'actions' }, el('button', { class: 'btn ok', type: 'button', onclick: go }, 'Continue'), el('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'))]);
  setTimeout(() => input.focus(), 30);
}
async function rpc(fn, args) {
  const { error } = await sb.rpc(fn, Object.assign({ p_pin: pin }, args));
  if (error) { if (/wrong pin/i.test(error.message)) { pin = null; throw new Error('Wrong PIN. Try again.'); } throw new Error(error.message); }
}
function decide(a, decision, feedback) {
  needPin(async () => {
    try {
      if (mode === 'sample') { a.status = decision; a.decided_at = new Date().toISOString(); a.feedback = feedback || null; D.activity.unshift({ id: 'x' + Date.now(), house_id: a.house_id, at: a.decided_at, text: (decision === 'approved' ? 'You approved: ' : 'You sent back for edits: ') + a.title, source: 'you' }); setData(D); }
      else { await rpc('decide_approval', { p_id: a.id, p_decision: decision, p_feedback: feedback || null }); await loadLive(); }
      celebrate(a.house_id, decision === 'approved');
      toast(decision !== 'approved' ? 'Sent back with your note.' : a.kind === 'lesson' ? `Approved. ${HOUSE_META[a.house_id].name} follows it from its next run.` : shippable(a) && a.kind !== 'issue' && a.kind !== 'memo' && a.kind !== 'resume' ? `Approved. Nothing is sent: ${/^x_/.test(a.kind) ? 'post' : 'send'} it yourself, then tap ${SHIP_VERB(a)[0]}.` : 'Approved.', 4200);
    } catch (e) { toast(e.message); }
  });
}
function markShipped(a, url) {
  needPin(async () => {
    try {
      if (mode === 'sample') { a.shipped_at = new Date().toISOString(); a.shipped_url = url || null; D.activity.unshift({ id: 'x' + Date.now(), house_id: a.house_id, at: a.shipped_at, text: (/^x_/.test(a.kind) ? 'You posted: ' : a.kind === 'issue' ? 'You published: ' : 'You sent: ') + a.title, source: 'you' }); setData(D); }
      else { await rpc('mark_shipped', { p_id: a.id, p_url: url || null }); await loadLive(); }
      celebrate(a.house_id, true);
      toast(`${SHIP_VERB(a)[1]}. It counts toward this week's sets where it fits.`);
    } catch (e) { toast(e.message); }
  });
}
function recordReading(g, value) {
  const v = +String(value).replace(/,/g, '');
  if (!isFinite(v) || String(value).trim() === '') { toast('Enter a number.'); return; }
  needPin(async () => {
    try {
      if (mode === 'sample') { D.readings.push({ id: 'g' + Date.now(), goal_id: g.id, value: v, at: new Date().toISOString(), source: 'you' }); g.current_value = v; setData(D); }
      else { await rpc('record_reading', { p_goal_id: g.id, p_value: v }); await loadLive(); }
      toast(`Logged ${fmt(v)} ${g.unit}.`);
    } catch (e) { toast(e.message); }
  });
}
// the reading closest to a week ago, so the change over the last seven days can be shown
function weekChange(g) {
  const rs = D.readings.filter(r => r.goal_id === g.id).sort((a, z) => Date.parse(a.at) - Date.parse(z.at)); if (!rs.length) return null;
  const last = rs[rs.length - 1], weekAgo = Date.now() - 7 * 864e5, base = [...rs].reverse().find(r => Date.parse(r.at) <= weekAgo);
  return { last, delta: base ? +g.current_value - +base.value : null };
}
function logSet(s) {
  needPin(async () => {
    try {
      if (mode === 'sample') { s.done = (+s.done || 0) + 1; setData(D); }
      else { await rpc('log_set', { p_set_id: s.id, p_amount: 1 }); await loadLive(); }
      toast(`Logged: ${s.name}`);
    } catch (e) { toast(e.message); }
  });
}
function saveWild(w, status) {
  needPin(async () => {
    try {
      if (mode === 'sample') { w.status = status; setData(D); }
      else { await rpc('save_wildcard', { p_id: w.id, p_status: status }); await loadLive(); }
      toast(status === 'saved' ? `Saved ${w.person}. The Tavern will suggest adding them.` : 'Dismissed.');
    } catch (e) { toast(e.message); }
  });
}

/* ---------- walking ---------- */
const DV2 = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let bridgeUp = store.get('bridgeUp', false);
const bridgeSet = new Set(W.BRIDGE_TILES.map(([x, y]) => W.key(x, y)));
const gateSet = new Set(W.SUMMIT_GATE.map(([x, y]) => W.key(x, y)));
let room = null;
const rooms = {};
const roomOf = id => rooms[id] || (rooms[id] = (r => { if (r) snap(r.canvas); return r; })(VI.build(id, W)));
const walk = (x, y) => room ? x > 0 && y > 0 && x < room.w && y < room.h && !room.solid[y * room.w + x] : walkWorld(x, y);
function walkWorld(x, y) {
  if (!W.inb(x, y)) return false;
  const i = W.id(x, y), k = W.key(x, y);
  if (W.solid[i] || W.cliff[i] || W.isWater(W.ter[i])) return false;
  if (bridgeUp && bridgeSet.has(k)) return false;
  if (!DV.summitOpen && gateSet.has(k)) return false;
  if (DV.tentAt.has(k)) return false;
  return true;
}
function objAt(x, y) {
  if (room) return room.inter.get(x + ',' + y);
  const k = W.key(x, y);
  if (DV.tentAt.has(k)) return { kind: 'tent', tent: DV.tentAt.get(k) };
  if (!DV.summitOpen && gateSet.has(k)) return { kind: 'gate' };
  return W.inter.get(k);
}
function bfs(sx, sy, goal, limit = 20000, can = walk) {
  const prev = new Int32Array(MW * MH).fill(-1), start = sy * MW + sx, q = [start]; prev[start] = start;
  for (let h = 0; h < q.length && h < limit; h++) {
    const cur = q[h], x = cur % MW, y = (cur / MW) | 0;
    if (goal(x, y) && cur !== start) { const path = []; let c = cur; while (c !== start) { path.push([c % MW, (c / MW) | 0]); c = prev[c]; } return path.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!can(nx, ny)) continue;
      const ni = ny * MW + nx; if (prev[ni] !== -1) continue; prev[ni] = cur; q.push(ni);
    }
  }
  return null;
}

const visited = new Set(store.get('visited', ['square']));
const spawn = W.PLACES.square.arrive;
const player = { x: spawn[0], y: spawn[1], dir: 'up', moving: false, prog: 0, step: 0, path: [], then: null, speed: 1.4, idle: 9 };
function goTo(tx, ty, quiet) {
  const target = objAt(tx, ty);
  if (target) {
    const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => [tx + dx, ty + dy]);
    if (adj.some(([x, y]) => x === player.x && y === player.y)) { face(tx, ty); act(target); return; }
    const path = bfs(player.x, player.y, (x, y) => adj.some(([ax, ay]) => ax === x && ay === y));
    if (!path) { if (!quiet) toast('No way through from here.'); return; }
    player.path = path; player.then = () => { face(tx, ty); act(objAt(tx, ty)); };
  } else if (walk(tx, ty)) {
    const path = bfs(player.x, player.y, (x, y) => x === tx && y === ty);
    if (!path) { if (!quiet) toast('No way through from here.'); return; }
    player.path = path; player.then = null;
  }
}
function face(tx, ty) { const dx = tx - player.x, dy = ty - player.y; player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function goToHouse(id) {
  const spot = W.BOTS[id]; if (!spot) return;
  closePanel();
  if (room) { if (room.id === id && room.bot) goTo(room.bot[0], room.bot[1]); else leaveRoom(() => setTimeout(() => goToHouse(id), 450)); return; }
  const meta = HOUSE_META[id], place = W.PLACES[meta.place];
  const far = Math.abs(spot[0] - player.x) + Math.abs(spot[1] - player.y) > 40;
  if (far && place && visited.has(place.id)) { travel(place.arrive, () => goTo(spot[0], spot[1])); return; }
  goTo(spot[0], spot[1]);
}

let fade = 0, fadeDir = 0, fadeAct = null;
function travel([x, y], after) {
  if (fadeDir) return;
  closePanel(); player.path = []; player.then = null;
  fadeDir = 1; fadeAct = () => { if (room) { room = null; parts.length = 0; } arrivedByTravel = true; player.x = x; player.y = y; player.moving = false; player.dir = 'down'; markVisits(); if (after) setTimeout(after, 260); };
}
function markVisits() {
  let changed = false;
  Object.values(W.PLACES).forEach(p => { if (!visited.has(p.id) && Math.abs(p.sign[0] - player.x) <= 3 && Math.abs(p.sign[1] - player.y) <= 3) { visited.add(p.id); changed = true; toast(`New signpost: ${p.name}. You can travel here now.`); } });
  if (changed) store.set('visited', [...visited]);
}

const keys = [];
let lastBump = 0;
function tryKeyMove() {
  const d = keys[keys.length - 1]; if (!d || fadeDir || uiOpen()) return;
  player.dir = d;
  const nx = player.x + DV2[d][0], ny = player.y + DV2[d][1];
  if (walk(nx, ny)) { startMove(); return; }
  const o = objAt(nx, ny);
  if (o && performance.now() - lastBump > 500) { lastBump = performance.now(); act(o); }
}
function arrive() {
  if (room) { if (player.x === room.door[0] && player.y === room.door[1]) leaveRoom(); return; }
  markVisits();
  const o = W.inter.get(W.key(player.x, player.y));
  if (o && o.kind === 'station' && W.STATIONS[o.name] && W.STATIONS[o.name].kind === 'ferry') act(o);
}
function startMove() { player.speed = player.idle <= 1 ? Math.min(2.7, player.speed + .3) : 1.4; player.idle = 0; player.moving = true; player.prog = 0; }
function updatePlayer() {
  if (!player.moving) player.idle++;
  if (player.moving) {
    player.prog += player.speed;
    if (!room && player.speed > 2 && !reduce && t % 5 === 0) { const g = W.ter[W.id(player.x, player.y)]; if (g === W.T.PATH || g === W.T.SAND || g === W.T.STAIRS) puff(player.x * TILE + 8 - DV2[player.dir][0] * 6, player.y * TILE + 14, 'dust'); }
    if (player.prog >= TILE) {
      player.x += DV2[player.dir][0]; player.y += DV2[player.dir][1];
      player.moving = false; player.prog = 0; player.step ^= 1;
      if (!room && W.ter[W.id(player.x, player.y)] === W.T.SAND) parts.push({ x: player.x * TILE + 5 + player.step * 4, y: player.y * TILE + 13, vx: 0, vy: 0, g: 0, life: 0, max: 700, kind: 'foot' });
      arrive();
    } else return;
  }
  if (uiOpen() || fadeDir) return;
  if (keys.length) { player.path = []; player.then = null; tryKeyMove(); return; }
  if (player.path.length) {
    const [nx, ny] = player.path[0];
    if (!walk(nx, ny)) { player.path = []; player.then = null; return; }
    player.path.shift(); face(nx, ny); startMove();
    return;
  }
  if (player.then) { const f = player.then; player.then = null; f(); }
}

/* ---------- particles: dust, footprints, confetti, sparkles ---------- */
const parts = [];
function puff(x, y, kind) {
  if (kind === 'dust') for (let k = 0; k < 2; k++) parts.push({ x: x + (Math.random() - .5) * 4, y, vx: (Math.random() - .5) * .3, vy: -.15 - Math.random() * .15, g: 0, life: 0, max: 26, kind });
}
function burst(x, y, kind, n = 24) {
  const cols = ['#ffd34d', '#ff8fa0', '#7be08f', '#62b4e3', '#c9a8f5', '#ffffff'];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = kind === 'spark' ? .4 + Math.random() * 1.2 : 1 + Math.random() * 1.8;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'confetti' ? 1.6 : .4), g: kind === 'confetti' ? .07 : .01, life: 0, max: kind === 'spark' ? 50 + Math.random() * 30 : 70 + Math.random() * 30, kind, col: kind === 'spark' ? (k % 3 ? '#ffe08a' : '#ffffff') : cols[k % cols.length] });
  }
}
function stepParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i]; q.life++; q.x += q.vx; q.y += q.vy; q.vy += q.g; if (q.kind !== 'foot') { q.vx *= .97; }
    if (q.kind === 'fw') { q.vx *= .96; q.vy *= .96; }
    if (q.kind === 'rocket' && q.vy > -.5) {
      // the rocket bursts into a ring of stars
      for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, v = 1.7 + (k % 3) * .5; parts.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .025, life: 0, max: 70 + Math.random() * 30, kind: 'fw', col: k % 5 ? q.col : '#ffffff' }); }
      flash = Math.max(flash, .12); q.life = q.max + 1;
    }
    if (q.kind === 'rocket' && q.life % 2 === 0) parts.push({ x: q.x, y: q.y + 2, vx: 0, vy: .2, g: 0, life: 0, max: 14, kind: 'trail' });
    if (q.life > q.max) parts.splice(i, 1);
  }
}
function drawParts(glow) {
  parts.forEach(q => {
    const glows = q.kind === 'spark' || q.kind === 'confetti' || q.kind === 'fw' || q.kind === 'rocket' || q.kind === 'trail'; if (glows !== glow) return;
    const x = Math.round(q.x - camX), y = Math.round(q.y - camY); if (x < -4 || y < -4 || x > VWW + 4 || y > VWH + 4) return;
    const f = q.life / q.max;
    if (q.kind === 'dust') R(ctx, x, y, f < .5 ? 2 : 1, f < .5 ? 2 : 1, f < .5 ? PAL.dirt[4] : PAL.dirt[5]);
    else if (q.kind === 'foot') P(ctx, x, y, f < .6 ? PAL.sand[2] : PAL.sand[1 + (f > .85 ? 2 : 1)]);
    else if (q.kind === 'confetti') R(ctx, x, y, (q.life >> 3) % 2 ? 2 : 1, 2, q.col);
    else if (q.kind === 'ripple') ring(ctx, x, y, 1 + Math.round(f * 6), Math.round(f * 2) + 1, f < .5 ? PAL.water[5] : PAL.water[4]);
    else if (q.kind === 'drop') P(ctx, x, y, '#dff4ff');
    else if (q.kind === 'rocket') { R(ctx, x, y, 2, 2, '#fff6e0'); P(ctx, x, y + 2, q.col); }
    else if (q.kind === 'trail') { if (f < .6) P(ctx, x, y, f < .3 ? PAL.lamp[2] : PAL.lamp[0]); }
    else if (q.kind === 'fw') { if (f < .7 || (q.life >> 1) % 2) { R(ctx, x, y, f < .45 ? 2 : 1, f < .45 ? 2 : 1, f < .15 ? '#ffffff' : q.col); if (f < .45) P(ctx, Math.round(x - q.vx * 3), Math.round(y - q.vy * 3), q.col); } }
    else if (q.kind === 'spark') { if ((q.life >> 2) % 3) { P(ctx, x, y, q.col); if (f < .4) { P(ctx, x - 1, y, '#ffe08a'); P(ctx, x + 1, y, '#ffe08a'); P(ctx, x, y - 1, '#ffe08a'); P(ctx, x, y + 1, '#ffe08a'); } } }
  });
}
const botBounce = {};
function celebrate(house, approved) {
  const b = room && room.id === house && room.bot ? room.bot : W.BOTS[house]; if (!b) return;
  if (approved) { burst(b[0] * TILE + 8, b[1] * TILE - 8, 'confetti', 30); botBounce[house] = t; }
  else burst(b[0] * TILE + 8, b[1] * TILE - 4, 'spark', 10);
}
function showBanner(title, sub) {
  const el2 = $('#banner'); el2.replaceChildren(...[el('b', {}, title), sub && el('span', {}, sub)].filter(Boolean));
  el2.classList.remove('show'); void el2.offsetWidth; el2.classList.add('show');
}

/* ---------- rooms ---------- */
function enterRoom(id) {
  const r = roomOf(id); if (!r) { openHouse(id); return; }
  if (fadeDir) return;
  closePanel(); player.path = []; player.then = null; keys.length = 0;
  fadeDir = 1; fadeAct = () => {
    room = r; parts.length = 0; player.x = r.start[0]; player.y = r.start[1]; player.dir = 'up'; player.moving = false; camFX = null;
    const n = (DV.pending[id] || []).length; showBanner(HOUSE_META[id].name, n ? `${n} waiting for you` : 'Nothing waiting');
  };
}
function leaveRoom(then) {
  if (!room || fadeDir) return;
  const d = W.HOUSES[room.id].door;
  fadeDir = 1; fadeAct = () => { room = null; parts.length = 0; const [x, y] = nearestFree(d[0], d[1] + 1); player.x = x; player.y = y; player.dir = 'down'; player.moving = false; camFX = null; if (then) then(); };
}
const EMPTY = { lectern: 'An empty lectern. New drafts land here.', lowtable: 'An empty table. New drafts land here.', box: 'An empty deposit box. New memos land here.', mannequin: 'A bare mannequin. New resumes are fitted here.', table: 'An empty table. New drafts land here.' };
function openSlot(n) {
  const id = room.id, pend = DV.pending[id] || [], more = pend.length - room.slots.length;
  if (n === room.slots.length - 1 && more > 0) { openHouse(id); return; }
  const a = pend[n]; if (!a) { say(EMPTY[room.slotStyle]); return; }
  openPanel({ build: () => {
    const cur = D.approvals.find(x => x.id === a.id) || a;
    return { eyebrow: HOUSE_META[id].name.toUpperCase(), title: cur.title, sub: (KIND[cur.kind] || 'Draft') + (cur.status === 'pending' ? ' · waiting for you' : ''), body: [draftCard(cur, cur.status !== 'pending')] };
  } });
}

/* ---------- bots at work ---------- */
// each bot walks a short errand from its post and back; it heads home when you come near
const ROUTE = { dojo: { to: [-4, 0], work: 'kata' }, tailor: { to: 'campfire', work: 'look' }, print: { to: 'depot', work: 'papers' }, tavern: { to: 'crossroads', work: 'wave' }, vault: { to: [-4, 1], work: 'look' }, hq: { to: [4, 1], work: 'look' } };
const routes = {};
function computeRoutes() {
  Object.entries(ROUTE).forEach(([h, r]) => {
    const a = W.BOTS[h]; if (!a) return;
    let goal = Array.isArray(r.to) ? [a[0] + r.to[0], a[1] + r.to[1]] : null;
    if (r.to === 'campfire') goal = [42, 46];
    if (r.to === 'crossroads') goal = [W.PLACES.crossroads.sign[0] + 1, W.PLACES.crossroads.sign[1]];
    if (r.to === 'depot') for (const [k, o] of W.inter) if (o.kind === 'rail' && o.end === 'press') { const [x, y] = k.split(',').map(Number); goal = [x, y + 1]; break; }
    if (!goal) return;
    const g = nearestFree(goal[0], goal[1], walkWorld), st = nearestFree(a[0], a[1] + 1, walkWorld);
    const p = bfs(st[0], st[1], (x, y) => x === g[0] && y === g[1], 8000, walkWorld);
    if (p && p.length < 70) routes[h] = Object.assign(routes[h] || { i: 0, dir: 1, pause: 120 + Math.floor(hash(a[0], a[1], 9) * 600), flip: false }, { path: [a, st, ...p], work: r.work });
  });
}
function stepRoutes() {
  if (reduce) return;
  Object.entries(routes).forEach(([h, r]) => {
    const a = W.BOTS[h], near = !room && Math.hypot(player.x - a[0], player.y - a[1]) < 7;
    if (r.i > r.path.length - 1) r.i = r.path.length - 1;
    if (near && r.i > 0) { r.dir = -1; r.pause = 0; }
    if (r.pause > 0) { if (!(near && r.i <= 0)) r.pause--; return; }
    r.i += r.dir * (near ? .1 : .035);
    if (r.i >= r.path.length - 1) { r.i = r.path.length - 1; r.dir = -1; r.pause = 260 + Math.floor(Math.random() * 300); }
    if (r.i <= 0) { r.i = 0; r.dir = 1; r.pause = near ? 40 : 600 + Math.floor(Math.random() * 900); }
  });
}
function botPos(h) {
  const r = routes[h], a = W.BOTS[h];
  if (!r || reduce || r.i <= 0) return { x: a[0] * TILE, y: a[1] * TILE, flip: player.x < a[0], work: null, out: false };
  const i0 = Math.floor(r.i), i1 = Math.min(i0 + 1, r.path.length - 1), f = r.i - i0, A = r.path[i0], B = r.path[i1];
  const moving = r.pause === 0, far = r.i >= r.path.length - 1;
  if (moving && B[0] !== A[0]) r.flip = (B[0] - A[0]) * r.dir < 0;
  let flip = r.flip; if (far && r.work === 'look') flip = (t >> 7) % 2 === 1;
  return { x: (A[0] + (B[0] - A[0]) * f) * TILE, y: (A[1] + (B[1] - A[1]) * f) * TILE, flip, work: far ? r.work : null, out: r.dir > 0 && moving };
}
// the Crier rings a hand bell and calls out a headline; first thing after a fresh run, then now and then
let shout = null, lastShout = -9999, shoutN = 0;
function headline() {
  const rad = D.radar.filter(r => r.post_text), pend = DV.pending.crier || [];
  const lines = rad.slice(0, 5).map(r => `@${r.author_handle || '?'}: ${r.post_text}`).concat(pend.map(a => 'Draft ready: ' + a.title));
  if (!lines.length) return 'Hear ye! Nothing new on the wire.';
  const l = lines[shoutN++ % lines.length]; return 'Hear ye! ' + (l.length > 96 ? l.slice(0, 94) + '…' : l);
}
function stepCrier() {
  const a = W.BOTS.crier; if (!a || room || uiOpen()) return;
  const near = Math.hypot(player.x - a[0], player.y - a[1]) < 13, run = (D.houses.crier || {}).last_run_at, key = 'crierRun.' + mode;
  if (shout && t - shout.t0 > 300) shout = null;
  if (!near || shout) return;
  const fresh = run && store.get(key, null) !== run;
  if (fresh || t - lastShout > 2400) { if (fresh) store.set(key, run); shout = { t0: t, text: headline() }; lastShout = t; }
}

/* ---------- wildlife ---------- */
const critters = [];
function initCritters() {
  const pick = (n, test, seed) => { const out = []; for (let k = 0; out.length < n && k < 6000; k++) { const x = Math.floor(hash(k, seed, 700) * MW), y = Math.floor(hash(k, seed, 701) * MH); if (test(x, y) && !out.some(([ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) < 4)) out.push([x, y]); } return out; };
  const ter = (x, y) => W.inb(x, y) ? W.ter[W.id(x, y)] : -1, wet = (x, y) => W.inb(x, y) && W.isWater(ter(x, y));
  const grass = (x, y) => walkWorld(x, y) && ter(x, y) === W.T.GRASS, woods = (x, y) => Math.hypot(x - 20, (y - 44) * 1.1);
  const base = (kind, x, y, ok) => ({ kind, x: x * TILE + 8, y: y * TILE + 10, tx: 0, ty: 0, state: 'idle', timer: Math.floor(hash(x, y, 702) * 200), flip: hash(x, y, 703) < .5, step: 0, ok });
  pick(3, (x, y) => woods(x, y) < 13 && grass(x, y), 1).forEach(([x, y], k) => critters.push(Object.assign(base('deer', x, y, (X, Y) => grass(X, Y) && woods(X, Y) < 18), { stag: k === 0, home: [20, 44, 13] })));
  pick(6, (x, y) => ter(x, y) === W.T.SAND && walkWorld(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet(x + dx, y + dy)), 2).forEach(([x, y]) => critters.push(Object.assign(base('crab', x, y, (X, Y) => ter(X, Y) === W.T.SAND && walkWorld(X, Y)), { home: [x, y, 4] })));
  const inRuins = (x, y) => x > 46 && x < 58 && y > 75 && y < 84 && walkWorld(x, y);
  pick(1, inRuins, 3).forEach(([x, y]) => critters.push(Object.assign(base('fox', x, y, (X, Y) => inRuins(X, Y) || (walkWorld(X, Y) && Math.hypot(X - 52, Y - 80) < 10)), { home: [52, 80, 6] })));
  const lake = []; for (let y = 30; y < 45; y++) for (let x = 30; x < 48; x++) if (wet(x, y) && Math.hypot(x - 39, y - 37) < 7 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => wet(x + dx, y + dy))) lake.push([x, y]);
  if (lake.length) for (let k = 0; k < 2; k++) critters.push({ kind: 'fish', lake, timer: 200 + k * 350, jump: null });
  [[61, 60], [67, 60], [64, 62], [24, 55], [30, 50]].forEach(([x, y], k) => critters.push({ kind: 'fly', cx: x * TILE + 8, cy: y * TILE, a: k * 1.7, col: ['#ffd34d', '#ffffff', '#ff8fa0', '#c9a8f5', '#62b4e3'][k] }));
}
function stepCritters() {
  if (room || reduce) return;
  const px = player.x * TILE + 8, py = player.y * TILE + 10;
  critters.forEach(c => {
    if (c.kind === 'fly') { c.a += .02; return; }
    if (c.kind === 'fish') {
      if (c.jump) { c.jump.k += 1 / 42; if (c.jump.k >= 1) { ripple(c.jump.x1, c.jump.y1, true); c.jump = null; c.timer = 300 + Math.random() * 700; } }
      else if (--c.timer <= 0) { const [x, y] = c.lake[Math.floor(Math.random() * c.lake.length)], x0 = x * TILE + 8, y0 = y * TILE + 8; c.jump = { x0, y0, x1: x0 + (Math.random() < .5 ? -1 : 1) * (10 + Math.random() * 10), y1: y0 + (Math.random() - .5) * 6, k: 0 }; ripple(x0, y0, true); }
      return;
    }
    if (c.kind === 'fox') { c.hidden = envNow.lum >= .6; if (c.hidden) return; }
    const d = Math.hypot(c.x - px, c.y - py), scare = { deer: 64, crab: 36, fox: 70 }[c.kind];
    if (d < scare && c.state !== 'flee' && c.state !== 'hide') {
      if (c.kind === 'crab') { c.state = 'hide'; c.timer = 160; }
      else { c.state = 'flee'; c.timer = 110; const ang = Math.atan2(c.y - py, c.x - px) + (Math.random() - .5) * .6; c.tx = c.x + Math.cos(ang) * 110; c.ty = c.y + Math.sin(ang) * 110; c.graze = false; }
    }
    if (c.state === 'hide') { if (--c.timer <= 0 && d >= scare) { c.state = 'idle'; c.timer = 30; } return; }
    if (c.state === 'idle') {
      if (--c.timer > 0) return;
      for (let k = 0; k < 8; k++) {
        const [hx, hy, hr] = c.home, ang = Math.random() * Math.PI * 2, rr = Math.random() * hr;
        const tx = c.kind === 'crab' ? c.x + (Math.random() < .5 ? -1 : 1) * (12 + Math.random() * 30) : (hx + Math.cos(ang) * rr) * TILE + 8, ty = c.kind === 'crab' ? c.y + (Math.random() - .5) * 8 : (hy + Math.sin(ang) * rr) * TILE + 10;
        if (c.ok(Math.floor(tx / TILE), Math.floor(ty / TILE))) { c.tx = tx; c.ty = ty; c.state = 'walk'; c.graze = false; break; }
      }
      if (c.state === 'idle') c.timer = 60;
      return;
    }
    const sp = c.state === 'flee' ? (c.kind === 'deer' ? 1.8 : 1.5) : { deer: .3, crab: .45, fox: .5 }[c.kind];
    const dx = c.tx - c.x, dy = c.ty - c.y, L = Math.hypot(dx, dy);
    if (L < 2 || (c.state === 'flee' && --c.timer <= 0)) { c.state = 'idle'; c.timer = 60 + Math.random() * (c.kind === 'deer' ? 420 : 220); c.graze = c.kind === 'deer' && Math.random() < .7; return; }
    const nx = c.x + dx / L * sp, ny = c.y + dy / L * sp;
    if (c.ok(Math.floor(nx / TILE), Math.floor(ny / TILE))) { c.x = nx; c.y = ny; c.step += sp; if (c.kind !== 'crab' && Math.abs(dx) > .5) c.flip = dx < 0; }
    else { c.state = 'idle'; c.timer = 20; }
  });
}
function ripple(x, y, drops) {
  parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 36, kind: 'ripple' });
  if (drops) for (let k = 0; k < 4; k++) parts.push({ x, y, vx: (Math.random() - .5) * 1.2, vy: -1 - Math.random(), g: .12, life: 0, max: 16, kind: 'drop' });
}
function drawDeer(c, sx, sy) {
  // 18 x 14, facing right unless flipped
  const fl = c.flip, X = (dx, w) => fl ? sx + 18 - dx - w : sx + dx, r = (dx, dy, w, h, col) => R(ctx, X(dx, w), sy + dy, w, h, col);
  const B = ['#6e4128', '#a0663c', '#c48650', '#e2c294'], moving = c.state === 'walk' || c.state === 'flee', ph = moving ? Math.floor(c.step / 3) % 4 : 0, run = c.state === 'flee';
  ctx.save(); ctx.globalAlpha = .3; ell(ctx, sx + 9, sy + 14, 7, 1, SHADOW); ctx.restore();
  const legs = run ? [[2, -1], [-1, 2], [2, -1], [-1, 2]][ph] : [[0, 0], [1, -1], [0, 0], [-1, 1]][ph];
  [[4, legs[0]], [6, legs[1]], [12, legs[1]], [14, legs[0]]].forEach(([lx, o], k) => { r(lx + o, 10, 1, 4, k % 2 ? B[0] : B[1]); P(ctx, X(lx + o, 1), sy + 13, '#2a1a14'); });
  r(3, 5, 12, 6, B[1]); r(4, 5, 10, 1, B[2]); r(3, 10, 12, 1, B[3]); r(5, 9, 8, 1, B[3]); r(2, 5, 2, 2, '#f2e8cf');
  if (c.graze && !moving) { r(14, 6, 2, 4, B[1]); r(15, 9, 3, 3, B[1]); r(17, 11, 1, 1, '#2a1a14'); r(15, 8, 1, 1, B[0]); }
  else { r(13, 2, 3, 5, B[1]); r(14, 0, 4, 3, B[1]); r(17, 1, 1, 1, '#2a1a14'); r(15, 1, 1, 1, '#1c1426'); r(13, -1, 2, 2, B[0]);
    if (c.stag) { r(13, -4, 1, 3, B[3]); r(12, -5, 1, 1, B[3]); r(14, -5, 1, 1, B[3]); r(15, -3, 1, 2, B[3]); r(16, -4, 1, 1, B[3]); } }
}
function drawCrab(c, sx, sy) {
  const col = ['#7a2230', '#b8394a', '#e06070'];
  if (c.state === 'hide') { ell(ctx, sx + 4, sy + 3, 4, 1, PAL.sand[2]); P(ctx, sx + 2, sy + 1, '#ffffff'); P(ctx, sx + 6, sy + 1, '#ffffff'); return; }
  const ph = Math.floor(c.step / 2) % 2;
  R(ctx, sx + 1, sy + 1, 7, 3, col[1]); R(ctx, sx + 2, sy + 1, 5, 1, col[2]); R(ctx, sx + 1, sy + 3, 7, 1, col[0]);
  R(ctx, sx - 1, sy - 1 + ph, 2, 2, col[1]); R(ctx, sx + 8, sy - 1 + (1 - ph), 2, 2, col[1]);
  P(ctx, sx + 3, sy, '#ffffff'); P(ctx, sx + 5, sy, '#ffffff'); P(ctx, sx + 3, sy - 1, '#1c1426'); P(ctx, sx + 5, sy - 1, '#1c1426');
  for (let k = 0; k < 3; k++) { P(ctx, sx + 1 + k * 3, sy + 4 + ((ph + k) % 2), col[0]); }
}
function drawFox(c, sx, sy) {
  const fl = c.flip, X = (dx, w) => fl ? sx + 16 - dx - w : sx + dx, r = (dx, dy, w, h, col) => R(ctx, X(dx, w), sy + dy, w, h, col);
  const F = ['#a04a22', '#e07a3a', '#f0a060'], moving = c.state !== 'idle', ph = moving ? Math.floor(c.step / 3) % 2 : 0;
  ctx.save(); ctx.globalAlpha = .3; ell(ctx, sx + 8, sy + 10, 6, 1, SHADOW); ctx.restore();
  r(0, 3, 5, 3, F[1]); r(0, 4, 2, 2, '#f2e8cf'); r(4, 3, 9, 4, F[1]); r(5, 3, 7, 1, F[2]); r(5, 6, 7, 1, F[0]);
  r(5 + ph, 7, 1, 3, '#3a2018'); r(11 - ph, 7, 1, 3, '#3a2018'); r(7 - ph, 7, 1, 2, '#3a2018'); r(10 + ph, 7, 1, 2, '#3a2018');
  r(12, 1, 4, 4, F[1]); r(13, 4, 3, 1, '#f2e8cf'); r(16, 3, 1, 1, '#1c1426'); r(12, 0, 1, 1, F[0]); r(14, 0, 1, 1, F[0]);
}
function drawFish(c) {
  if (!c.jump) return; const j = c.jump, k = j.k, x = j.x0 + (j.x1 - j.x0) * k - camX, y = j.y0 + (j.y1 - j.y0) * k - Math.sin(k * Math.PI) * 12 - camY, dir = j.x1 > j.x0 ? 1 : -1, up = k < .5;
  R(ctx, x - 2, y, 4, 2, PAL.steel[4]); P(ctx, x + 2 * dir, y + (up ? -1 : 1), PAL.steel[5]); P(ctx, x - 3 * dir, y + (up ? 1 : -1), PAL.water[4]); P(ctx, x + dir, y, '#1c1426');
}
function drawFly(c, sx, sy) { const fl = (t >> 2) % 2; P(ctx, sx, sy, '#2a1a14'); P(ctx, sx - 1, sy - fl, c.col); P(ctx, sx + 1, sy - fl, c.col); if (!fl) { P(ctx, sx - 2, sy, c.col); P(ctx, sx + 2, sy, c.col); } }

/* ---------- events tied to your data ---------- */
let fireworks = 0, shipIn = null;
const raised = new Map();
function launchFireworks(frames) { fireworks = Math.max(fireworks, frames); }
function evKey(k) { return 'ev.' + mode + '.' + k; }
const CAMP_RANK = { foothills: 0, convert: 1, define: 2, summit: 3 };
function checkEvents() {
  if (!mode) return;
  const done = D.goals.filter(g => +g.target_value > 0 && +g.current_value >= +g.target_value).map(g => g.id), prevDone = store.get(evKey('done'), null);
  if (prevDone) { const fresh = done.filter(id => !prevDone.includes(id)); if (fresh.length) { const g = D.goals.find(x => x.id === fresh[0]); celebrateGoal(g); } }
  store.set(evKey('done'), done);
  const prevShips = store.get(evKey('ships'), null);
  if (prevShips != null && DV.ships > prevShips) shipSailsIn(DV.ships - 1);
  store.set(evKey('ships'), DV.ships);
  const prevCamps = store.get(evKey('camps'), null), camps = {};
  DV.firms.forEach(f => { camps[f.name] = CAMP_RANK[f.camp]; if (prevCamps && prevCamps[f.name] != null && CAMP_RANK[f.camp] > prevCamps[f.name]) raiseFlag(f.name); });
  store.set(evKey('camps'), camps);
}
function celebrateGoal(g) { launchFireworks(900); showBanner('Goal reached', g ? g.title : ''); camPan = { x: 64 * TILE + 8, y: 50 * TILE, until: t + 260 }; }
function shipSailsIn(n) {
  const slot = W.SHIP_SLOTS[n]; if (!slot) return;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]], dir = dirs.find(([dx, dy]) => { for (let k = 1; k <= 26; k++) { const x = slot[0] + dx * k, y = slot[1] + dy * k; if (W.inb(x, y) && !W.isWater(W.ter[W.id(x, y)])) return false; } return true; }) || [1, 0];
  shipIn = { n, t0: t, dir }; toast('A new ship sails into the harbor: another subscriber milestone passed.', 4200); camPan = { x: slot[0] * TILE, y: slot[1] * TILE, until: t + 420 };
}
function raiseFlag(name) {
  raised.set(name, t); const tn = DV.tents.find(x => x.firm.name === name);
  if (tn) { burst(tn.x * TILE + 24, tn.y * TILE - 10, 'confetti', 26); camPan = { x: tn.x * TILE + 24, y: tn.y * TILE, until: t + 220 }; }
  const f = DV.firms.find(x => x.name === name); toast(`${name} moved up to ${CAMP_LABEL[f ? f.camp : 'convert']}. A new flag goes up.`, 4200);
}
function stepFireworks() {
  if (fireworks <= 0) return; fireworks--;
  if (reduce || t % 20) return;
  const cols = ['#ffd34d', '#ff8fa0', '#7be08f', '#62b4e3', '#c9a8f5', '#ffffff', '#ffb347'];
  parts.push({ x: 64 * TILE + 8 + (Math.random() - .5) * 120, y: 57 * TILE, vx: (Math.random() - .5) * .5, vy: -3.4 - Math.random() * .9, g: .045, life: 0, max: 200, kind: 'rocket', col: cols[Math.floor(Math.random() * cols.length)] });
}

/* ---------- the wishing well ---------- */
let coin = null, splash = null;
function openWell() {
  const n = store.get('coins', 0);
  openPanel({ build: () => ({
    eyebrow: 'THE WISHING WELL', title: 'Toss a coin', sub: n ? `You've tossed ${n} coin${n === 1 ? '' : 's'}.` : 'Make a wish and see what surfaces.',
    body: [
      el('p', {}, 'The Well keeps the long shots: people unlikely to answer who would matter a lot if they did. Toss a coin and it gives you one.'),
      el('div', { class: 'actions' }, el('button', { class: 'btn ok', type: 'button', onclick: tossCoin }, 'Toss a coin'), el('button', { class: 'btn ghost', type: 'button', onclick: () => openHouse('well') }, 'See every long shot')),
    ],
  }) });
}
function tossCoin() {
  closePanel(); face(Math.floor(W.WELL[0] / TILE), Math.floor(W.WELL[1] / TILE));
  coin = { t0: t, x0: player.x * TILE + 8, y0: player.y * TILE - 10, x1: W.WELL[0], y1: W.WELL[1] - 2 };
}
function fortunes() {
  const out = [];
  DV.firms.filter(f => f.next && f.camp !== 'foothills').forEach(f => out.push(`${f.name}: ${f.next}.`));
  D.goals.filter(g => g.pace_note).forEach(g => out.push(g.pace_note));
  const days = Math.ceil((Date.parse('2027-03-31') - Date.now()) / 864e5); if (days > 0) out.push(`${days} days to March 31, 2027.`);
  out.push('Every summit starts as a camp.', 'The best introductions are earned in public first.');
  return out;
}
function showWish() {
  const n = store.get('coins', 0) + 1; store.set('coins', n);
  const fresh = D.wild.filter(w => w.status === 'new'), w = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : null;
  const f = fortunes(), line2 = f[Math.floor(Math.random() * f.length)];
  openPanel({ build: () => ({
    eyebrow: 'THE WISHING WELL', title: w ? 'A long shot surfaces' : 'The water settles', sub: `Coin #${n}`,
    body: [
      w ? el('div', { class: 'radar' },
        el('div', { class: 'draft-head' }, el('strong', {}, w.person), w.role && el('span', { class: 'muted small' }, w.role)),
        el('p', {}, w.why), el('p', { class: 'small' }, 'Route: ', w.route), w.draft && el('div', { class: 'draft-text' }, w.draft),
        w.status === 'new' ? el('div', { class: 'actions' }, el('button', { class: 'btn ok', type: 'button', onclick: () => saveWild(w, 'saved') }, 'Save'), el('button', { class: 'btn ghost', type: 'button', onclick: () => saveWild(w, 'dismissed') }, 'Dismiss')) : chip(w.status, w.status === 'saved' ? 'good' : 'dim'))
        : el('p', {}, 'No new long shots in the Well right now. It draws more on its next run.'),
      el('p', { class: 'muted' }, 'The Well also whispers: ', el('em', {}, line2)),
      el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'button', onclick: tossCoin }, 'Toss another coin')),
    ],
  }) });
}
const DISCOVERIES = {
  chest: ['An old chest', 'Inside the chest: a brass compass, engraved "True north: build the business."'],
  fossil: ['The Dig', 'A long-necked sauropod, about 26 metres nose to tail. The tag on its skull reads: "Patience. Some things take 150 million years."'],
  crystal: ['The Cave', 'The crystals hum in the dark. Scratched into the rock: "Every summit starts as a camp."'],
};
function discover(what) {
  const found = new Set(store.get('found', [])), first = !found.has(what);
  found.add(what); store.set('found', [...found]);
  say((first ? `Discovery ${found.size} of ${Object.keys(DISCOVERIES).length}! ` : '') + DISCOVERIES[what][1]);
  burst(player.x * TILE + 8, player.y * TILE - 6, 'spark', 26);
  if (first) showBanner(`Discovery ${found.size} of ${Object.keys(DISCOVERIES).length}`, DISCOVERIES[what][0]);
}

/* ---------- interactions ---------- */
function act(o) {
  if (!o) return;
  switch (o.kind) {
    case 'door': enterRoom(o.house); break;
    case 'bot': openHouse(o.house); break;
    case 'roomBot': openHouse(room.id); break;
    case 'slot': openSlot(o.n); break;
    case 'note': say(o.text); break;
    case 'radar': openHouse('crier'); break;
    case 'bell': bellT = t; say(headline()); break;
    case 'tent': openFirm(o.tent.firm.name); break;
    case 'sign': visited.add(o.place); store.set('visited', [...visited]); openTravel(o.place); break;
    case 'board': case 'fountain': openBoard(); break;
    case 'well': openWell(); break;
    case 'discover': discover(o.what); break;
    case 'pedestal': {
      const g = DV.statues[o.n];
      if (g) { say(`A statue for "${g.title}". Finished: ${fmt(g.current_value)} ${g.unit}.`); launchFireworks(420); }
      else say('An empty pedestal. A statue goes up here when you finish a goal.');
      break;
    }
    case 'gate': say(`The Summit opens when you sign a seat. ${DV.firms.filter(f => f.camp !== 'foothills').length} firms are on the mountain.`); break;
    case 'shrine': say(DV.summitFirm ? `You made it. ${DV.summitFirm.name}'s banner flies over the shrine.` : 'The shrine waits for the day you sign.'); break;
    case 'lever': bridgeUp = !bridgeUp; store.set('bridgeUp', bridgeUp); computeRunner(); toast(bridgeUp ? 'You raised the drawbridge. Pull again to lower it.' : 'The drawbridge is down.'); break;
    case 'lighthouse': say(`The beam reaches ${Math.round(DV.beam * 100)}% of the way to 5,000 followers.`); break;
    case 'campfire': say('Base camp. Suit up at the Tailor before the climb.'); break;
    case 'station': useStation(o.name); break;
    case 'rail': say(DV.feedCrier
      ? 'The rail cart is carrying an issue you approved from the Print Shop to the Crier, who cuts it into an X thread.'
      : o.end === 'press' ? 'Press Depot. When you approve an issue, the cart takes it up the line to the Crier to cut into an X thread.' : "The Crier's platform. Approved issues arrive here from the Print Shop and become X threads."); break;
  }
}
function useStation(name) {
  const s = W.STATIONS[name]; if (!s) return;
  const arriveAt = st => st.kind === 'ferry' ? (st === W.STATIONS.ferryHarbor ? [st.x - 1, st.y] : [st.x, st.y - 1]) : nearestFree(st.x, st.y + 2);
  if (s.kind === 'gondola') {
    if (!DV.gondola) { say('The gondola opens once a firm reaches Convert Camp.'); return; }
    travel(arriveAt(W.STATIONS[s.to])); toast(s.to === 'gondolaHigh' ? 'Up to Convert Camp' : 'Down to Base Camp');
  } else if (s.kind === 'zip') {
    if (name === 'zipLow') { say('The zip line lands here from Define Camp.'); return; }
    if (!DV.zip) { say('The zip line opens once a firm reaches Define Camp.'); return; }
    travel(arriveAt(W.STATIONS.zipLow)); toast('Down the zip line to the square');
  } else if (s.kind === 'ferry') {
    travel(arriveAt(W.STATIONS[s.to])); toast(s.to === 'ferryIslet' ? 'Ferry to Vault Island' : 'Ferry to the Harbor');
  }
}
function nearestFree(x, y, can = walk) { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (can(x + dx, y + dy)) return [x + dx, y + dy]; return [x, y]; }
function hintFor() {
  const d = DV2[player.dir], fx = player.x + d[0], fy = player.y + d[1];
  let o = objAt(fx, fy);
  if (!o) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { o = objAt(player.x + dx, player.y + dy); if (o) break; }
  if (!o) return '';
  const pend = h => (DV.pending[h] || []).length;
  switch (o.kind) {
    case 'door': { const m = HOUSE_META[o.house]; return `Go inside ${m.name}${pend(o.house) ? ` · ${pend(o.house)} waiting` : ''}`; }
    case 'bot': { const m = HOUSE_META[o.house], u = (DV.unsent[o.house] || []).length; return `${m.bot} · ${m.name}${pend(o.house) ? ` · ${pend(o.house)} waiting` : ''}${u ? ` · ${u} to send` : ''}`; }
    case 'roomBot': return `${HOUSE_META[room.id].bot} · talk`;
    case 'slot': { const p = DV.pending[room.id] || [], more = p.length - room.slots.length; if (o.n === room.slots.length - 1 && more > 0) return `${more + 1} drafts waiting · see them all`; const a = p[o.n]; return a ? `${KIND[a.kind] || 'Draft'} · ${a.title.length > 44 ? a.title.slice(0, 42) + '…' : a.title}` : 'Nothing here yet'; }
    case 'note': return o.label;
    case 'radar': return 'Notice board · reply radar';
    case 'bell': return 'The bell · ring it';
    case 'board': return 'Town Board';
    case 'tent': return `${o.tent.firm.name} · ${CAMP_LABEL[o.tent.firm.camp]}`;
    case 'sign': return `Signpost · ${W.PLACES[o.place].name}`;
    case 'well': return 'The Wishing Well · toss a coin';
    case 'discover': return DISCOVERIES[o.what][0] + (new Set(store.get('found', [])).has(o.what) ? '' : ' · something to find');
    case 'station': { const s = W.STATIONS[o.name]; return s.kind === 'gondola' ? 'Gondola' : s.kind === 'zip' ? 'Zip line' : 'Ferry'; }
    case 'lever': return 'Drawbridge lever';
    case 'rail': return o.end === 'press' ? 'Press Depot · rail to the Crier' : 'Crier platform · rail from the Print Shop';
    case 'gate': return 'The Summit gate';
    default: return '';
  }
}

/* ---------- runner, cart, smoke ---------- */
let runner = { path: null, i: 0, dir: 1, pause: 0 };
function computeRunner() {
  const a = W.BOTS.dojo, b = W.BOTS.tailor;
  if (!a || !b) return;
  const startTile = nearestFree(a[0], a[1] + 1, walkWorld), saved = [player.x, player.y];
  const p = bfs(startTile[0], startTile[1], (x, y) => Math.abs(x - b[0]) + Math.abs(y - b[1]) === 1, 20000, walkWorld);
  [player.x, player.y] = saved;
  runner.path = p ? [startTile, ...p] : null; runner.i = 0; runner.dir = 1;
  computeRoutes();
}
const cart = { i: 0, dir: 1, pause: 0 };
const smoke = [];
let t = 0;
function step() {
  t++;
  if (fadeDir === 1) { fade += .07; if (fade >= 1) { fade = 1; if (fadeAct) fadeAct(); fadeAct = null; fadeDir = -1; } }
  else if (fadeDir === -1) { fade -= .07; if (fade <= 0) { fade = 0; fadeDir = 0; } }
  updatePlayer();
  stepParts();
  stepRoutes(); stepCrier(); stepCritters(); stepFireworks();
  if (flash > .01) flash *= .82; else flash = 0;
  if (weatherNow().kind === 'storm' && !reduce && Math.random() < 1 / 520) flash = .85;
  if (coin && t - coin.t0 > 46) { splash = { t0: t, x: coin.x1, y: coin.y1 }; coin = null; }
  if (splash && t - splash.t0 > 34) { splash = null; showWish(); }
  if (runner.path && DV.feedTailor) {
    if (runner.pause > 0) runner.pause--;
    else { runner.i += runner.dir * .06; if (runner.i >= runner.path.length - 1) { runner.i = runner.path.length - 1; runner.dir = -1; runner.pause = 120; } if (runner.i <= 0) { runner.i = 0; runner.dir = 1; runner.pause = 160; } }
  }
  if (W.RAIL.length && DV.feedCrier) {
    if (cart.pause > 0) cart.pause--;
    else { cart.i += cart.dir * .05; if (cart.i >= W.RAIL.length - 1) { cart.i = W.RAIL.length - 1; cart.dir = -1; cart.pause = 150; } if (cart.i <= 0) { cart.i = 0; cart.dir = 1; cart.pause = 150; } }
  }
  const sunday = nyWeekday() === 'Sun';
  W.CHIMNEYS.forEach((c, n) => { if (t % (sunday && n === 1 ? 9 : 20) === n % 7) smoke.push({ x: c.x, y: c.y, a: 0 }); });
  for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.a++; s.x += .22; s.y -= .16; if (s.a > 160) smoke.splice(i, 1); }
}

/* ---------- sprites ---------- */
const PLAYER_PAL = { h: '#3a2530', H: '#6b4040', s: '#d9946b', S: '#f2c094', e: '#1c1426', j: '#34468a', J: '#4f66b8', k: '#232f5c', p: '#2a2438', P: '#3d3550', b: '#160f1c' };
const P_SIDE = ['....hhhh....', '...hhHHhh...', '..hhhhHHhh..', '..hhhssSSs..', '..hhsSSeSs..', '...hssSSs...', '....sss.....', '...kjjJJj...', '..kjjjJJjj..', '..kjjjjJjs..', '..kkjjjjjs..', '...kjjjjj...', '...pPPPpp...'];
const P_DOWN = ['....hhhh....', '...hhHHhh...', '..hhhhhhhh..', '..hsSSSSsh..', '..hSeSSeSh..', '...sSSSSs...', '....ssss....', '...jjJJjj...', '..kjjJJjjk..', '..sjjjjjjs..', '..skjjjjks..', '...kjjjjk...', '...pPPPPp...'];
const P_UP = ['....hhhh....', '...hhhhhh...', '..hhhHHhhh..', '..hhhhhhhh..', '..hhhhhhhh..', '...hhhhhh...', '....ssss....', '...jjjjjj...', '..kjjjjjjk..', '..sjjjjjjs..', '..skjjjjks..', '...kjjjjk...', '...pPPPPp...'];
const LEGS_SIDE = [['...pp.pp....', '...pp..pp...', '..bbb..bbb..'], ['....pppp....', '....pp.p....', '...bbbbbb...']];
const LEGS_FRONT = [['...pp..pp...', '...pp..pp...', '..bbb..bbb..'], ['...pp..pp...', '...pp...pp..', '..bbb...bbb.']];
const BOT = ['.......a......', '.......m......', '.....HHHHH....', '....HllllHd...', '...HlvvvvvHd..', '...HlvEvEvHd..', '...HlvvvvvHd..', '....HHHHHHd...', '......dd......', '....cCCCCcd...', '...cCCxxCCcd..', '...cCxAAxCcd..', '...cCCxxCCcd..', '....ccccccd...', '.....L..L.....', '....LL..LL....'];
const botPal = acc => ({ a: acc, m: PAL.steel[2], H: PAL.steel[3], l: PAL.steel[5], d: PAL.steel[1], v: '#121626', E: acc, c: PAL.steel[2], C: PAL.steel[3], x: PAL.steel[1], A: acc, L: PAL.steel[1] });
const SHIP = ['..........m.............', '.........mWw............', '........mWWww...........', '.......mWWWwww..........', '......mWWWWwwww.........', '.....mWWWWWwwwww........', '.........mf.............', '.hhhhhhhhhhhhhhhhhhhhh..', '..HhhhhhhhhhhhhhhhhhH...', '...dddddddddddddddddd...'];
const SHIP_PAL = { m: PAL.timber[1], W: PAL.plaster[4], w: PAL.plaster[2], f: '#7be08f', h: PAL.timber[3], H: PAL.timber[4], d: PAL.timber[1] };
const CART = ['..pppppppp..', '.pPPPPPPPPp.', '.pwwwwwwwwp.', '.pPPPPPPPPp.', '..k.k..k.k..'];
const CART_PAL = { p: PAL.timber[2], P: PAL.timber[3], w: PAL.plaster[4], k: PAL.steel[0] };
const FERRY = ['.......mm...........', '......mWWw..........', '.....mWWWww.........', '.hhhhhhhhhhhhhhhhh..', '..HhhhhhhhhhhhhhH...', '...ddddddddddddd....'];

/* You: 14 x 24, four-frame walk in each direction. Light from the top left. */
const HC = { hair: ['#2a1a22', '#4a2c2a', '#6b4040'], skin: ['#a8644a', '#d9946b', '#f2c094'], coat: ['#141a33', '#232f5c', '#34468a', '#4f66b8'], shirt: ['#b3a5a3', '#f2e8cf'], pants: ['#1c1828', '#2a2438', '#3d3550'], shoe: ['#120c16', '#2e2436'], eye: '#1c1426' };
function drawHero(sx, sy, dir, f, moving) {
  const swing = moving ? [0, 1, 0, -1][f] : 0, y0 = sy + (moving && f % 2 ? 1 : 0);
  sunShadow(sx + 7, sy + 23, 5, .35);
  if (dir === 'left' || dir === 'right') {
    const fl = dir === 'left', X = (dx, w) => fl ? sx + 14 - dx - w : sx + dx, r = (dx, dy, w, h, col) => R(ctx, X(dx, w), y0 + dy, w, h, col);
    const back = moving ? [0, -2, 0, 2][f] : 0;
    r(5 - back, 17, 3, 5, HC.pants[0]); r(5 - back, 21, 4, 2, HC.shoe[0]);
    r(6 + back, 17, 3, 5, HC.pants[1]); r(6 + back, 17, 1, 5, HC.pants[2]); r(6 + back, 21, 4, 2, HC.shoe[1]);
    r(4, 9, 7, 9, HC.coat[2]); r(4, 9, 1, 9, HC.coat[3]); r(10, 9, 1, 9, HC.coat[1]); r(4, 17, 7, 1, HC.coat[1]); r(9, 9, 1, 3, HC.shirt[1]);
    r(6 + swing, 10, 2, 6, HC.coat[1]); r(6 + swing, 10, 1, 6, HC.coat[2]); r(6 + swing, 16, 2, 1, HC.skin[1]);
    r(6, 8, 3, 1, HC.skin[0]);
    r(4, 1, 7, 7, HC.skin[1]); r(5, 2, 2, 1, HC.skin[2]); r(10, 2, 1, 5, HC.skin[0]); r(11, 5, 1, 1, HC.skin[1]);
    r(3, 0, 7, 3, HC.hair[1]); r(3, 1, 3, 5, HC.hair[1]); r(4, 0, 3, 1, HC.hair[2]); r(9, 1, 1, 2, HC.hair[0]);
    r(6, 4, 1, 2, HC.skin[0]); r(9, 4, 1, 1, HC.eye); r(9, 6, 1, 1, HC.skin[0]);
    return;
  }
  const up = dir === 'up', lLift = swing > 0 ? 1 : 0, rLift = swing < 0 ? 1 : 0;
  R(ctx, sx + 3, y0 + 17, 3, 5 - lLift, HC.pants[1]); R(ctx, sx + 3, y0 + 17, 1, 5 - lLift, HC.pants[2]); R(ctx, sx + 3, y0 + 21 - lLift, 3, 2, HC.shoe[1]); P(ctx, sx + 3, y0 + 21 - lLift, HC.shoe[0]);
  R(ctx, sx + 8, y0 + 17, 3, 5 - rLift, HC.pants[0]); R(ctx, sx + 8, y0 + 17, 1, 5 - rLift, HC.pants[1]); R(ctx, sx + 8, y0 + 21 - rLift, 3, 2, HC.shoe[1]);
  R(ctx, sx + 2, y0 + 9, 10, 9, HC.coat[2]); R(ctx, sx + 2, y0 + 9, 1, 9, HC.coat[3]); R(ctx, sx + 11, y0 + 9, 1, 9, HC.coat[1]); R(ctx, sx + 2, y0 + 17, 10, 1, HC.coat[1]);
  if (!up) { R(ctx, sx + 6, y0 + 9, 2, 3, HC.shirt[1]); P(ctx, sx + 6, y0 + 11, HC.shirt[0]); P(ctx, sx + 7, y0 + 13, HC.coat[0]); P(ctx, sx + 7, y0 + 15, HC.coat[0]); }
  else R(ctx, sx + 4, y0 + 9, 6, 1, HC.coat[3]);
  R(ctx, sx + 1, y0 + 10 - swing, 2, 6, HC.coat[3]); R(ctx, sx + 1, y0 + 16 - swing, 2, 1, HC.skin[1]);
  R(ctx, sx + 11, y0 + 10 + swing, 2, 6, HC.coat[1]); R(ctx, sx + 11, y0 + 16 + swing, 2, 1, HC.skin[0]);
  R(ctx, sx + 6, y0 + 8, 2, 1, HC.skin[0]);
  R(ctx, sx + 3, y0 + 1, 8, 7, HC.skin[1]); R(ctx, sx + 10, y0 + 2, 1, 5, HC.skin[0]); P(ctx, sx + 2, y0 + 4, HC.skin[0]); P(ctx, sx + 11, y0 + 4, HC.skin[0]);
  if (up) { R(ctx, sx + 3, y0, 8, 7, HC.hair[1]); R(ctx, sx + 4, y0, 4, 1, HC.hair[2]); R(ctx, sx + 9, y0 + 1, 2, 6, HC.hair[0]); R(ctx, sx + 4, y0 + 6, 6, 1, HC.hair[0]); }
  else {
    R(ctx, sx + 4, y0 + 2, 2, 1, HC.skin[2]);
    R(ctx, sx + 3, y0, 8, 3, HC.hair[1]); R(ctx, sx + 2, y0 + 1, 1, 4, HC.hair[1]); R(ctx, sx + 11, y0 + 1, 1, 4, HC.hair[0]); R(ctx, sx + 5, y0, 3, 1, HC.hair[2]);
    P(ctx, sx + 4, y0 + 3, HC.hair[1]); P(ctx, sx + 7, y0 + 3, HC.hair[1]); P(ctx, sx + 8, y0 + 3, HC.hair[0]);
    P(ctx, sx + 5, y0 + 4, HC.eye); P(ctx, sx + 8, y0 + 4, HC.eye); P(ctx, sx + 4, y0 + 5, '#e88a7a'); P(ctx, sx + 9, y0 + 5, '#d9746b'); P(ctx, sx + 6, y0 + 6, HC.skin[0]); P(ctx, sx + 7, y0 + 6, HC.skin[0]);
  }
}
/* Bots: 16 x 22, hovering on a thruster, visor eyes that blink and look where they face. */
function drawBotSprite(sx, sy, acc, seed, flip, carrying) {
  const st = PAL.steel, a = reduce ? 0 : t + seed, hov = reduce ? 0 : Math.round(Math.sin(a / 22) * 1.5), y0 = sy + hov;
  sunShadow(sx + 8, sy + 21, hov < 0 ? 4 : 5, .3);
  const fl = (a >> 2) % 3;
  R(ctx, sx + 6, y0 + 17, 4, 1, st[1]); R(ctx, sx + 7, y0 + 18, 2, 1 + fl % 2, acc); if (fl) P(ctx, sx + 6 + fl, y0 + 19 + fl % 2, PAL.lamp[3]);
  R(ctx, sx + 3, y0 + 10, 10, 7, st[3]); R(ctx, sx + 4, y0 + 9, 8, 1, st[3]); R(ctx, sx + 3, y0 + 10, 1, 6, st[4]); R(ctx, sx + 12, y0 + 10, 1, 7, st[1]); R(ctx, sx + 4, y0 + 16, 8, 1, st[1]);
  R(ctx, sx + 5, y0 + 11, 6, 4, st[2]);
  R(ctx, sx + 7, y0 + 12, 2, 2, (a >> 4) % 4 === 0 ? PAL.lamp[3] : acc);
  const wave = reduce ? 0 : Math.round(Math.sin(a / 14));
  R(ctx, sx + 1, y0 + 11 + wave, 2, 4, st[2]); P(ctx, sx + 1, y0 + 11 + wave, st[4]); R(ctx, sx + 13, y0 + 11 - wave, 2, 4, st[1]);
  R(ctx, sx + 3, y0 + 2, 10, 7, st[3]); R(ctx, sx + 4, y0 + 1, 8, 1, st[3]); R(ctx, sx + 5, y0, 6, 1, st[4]); R(ctx, sx + 3, y0 + 2, 1, 6, st[5]); R(ctx, sx + 12, y0 + 2, 1, 7, st[1]); R(ctx, sx + 4, y0 + 8, 8, 1, st[1]);
  R(ctx, sx + 4, y0 + 3, 8, 4, '#121626'); R(ctx, sx + 4, y0 + 3, 8, 1, '#232a40');
  const look = flip ? -1 : 1, blink = !reduce && (a % 240) < 8;
  if (blink) { R(ctx, sx + 5 + look, y0 + 5, 2, 1, acc); R(ctx, sx + 9 + look, y0 + 5, 2, 1, acc); }
  else { R(ctx, sx + 5 + look, y0 + 4, 2, 2, acc); R(ctx, sx + 9 + look, y0 + 4, 2, 2, acc); P(ctx, sx + 5 + look, y0 + 4, '#ffffff'); P(ctx, sx + 9 + look, y0 + 4, '#ffffff'); }
  R(ctx, sx + 8, y0 - 3, 1, 3, st[2]); P(ctx, sx + 8, y0 - 4, (a >> 5) % 2 ? acc : st[4]);
  if (carrying === 'papers') { const cx = sx + (flip ? -4 : 13), p2 = PAL.plaster; for (let k = 0; k < 4; k++) R(ctx, cx, y0 + 15 - k * 2, 7, 2, k % 2 ? p2[4] : p2[3]); R(ctx, cx, y0 + 8, 7, 1, '#ffffff'); R(ctx, cx + 1, y0 + 10, 5, 1, p2[2]); return; }
  if (carrying) { const cx = sx + (flip ? -3 : 13); R(ctx, cx, y0 + 11, 6, 5, PAL.timber[3]); R(ctx, cx, y0 + 11, 6, 1, PAL.timber[4]); R(ctx, cx + 1, y0 + 10, 4, 1, PAL.plaster[4]); }
}
function drawHandBell(sx, sy) {
  const k = t - (shout ? shout.t0 : 0); if (k > 120) return;
  const sw = Math.round(Math.sin(k / 4) * 2), x = sx + 14 + sw, y = sy + 6, b = PAL.brass;
  R(ctx, sx + 13, sy + 11, 2, 2, PAL.steel[2]); R(ctx, x, y, 2, 3, PAL.timber[2]); fillPoly(ctx, [[x - 2, y + 9], [x + 4, y + 9], [x + 3, y + 3], [x - 1, y + 3]], b[3]); R(ctx, x - 2, y + 8, 6, 1, b[1]);
  if ((k >> 3) % 2) { P(ctx, x + 6, y + 2, '#fff6e0'); P(ctx, x + 7, y + 1, '#fff6e0'); P(ctx, x - 4, y + 2, '#fff6e0'); P(ctx, x - 5, y + 1, '#fff6e0'); }
}
function drawPlayerAt(sx, sy) {
  const f = ((player.step << 1) | (player.prog >= 8 ? 1 : 0)) & 3;
  drawHero(sx, sy, player.dir, f, player.moving && !reduce);
}
// a 3 x 5 pixel font for tent signs; each glyph is five rows of three
const FONT3 = {
  0: '####.##.##.####',
  1: '.#.##..#..#.###',
  2: '##...#.#.#..###',
  3: '##...#.#...###.',
  4: '#.##.####..#..#',
  5: '####..##...###.',
  6: '.###..####.####',
  7: '###..#.#..#..#.',
  8: '####.#####.####',
  9: '####.####..###.',
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '.###..#..#...##',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '.###..#.##.#.##',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..',
  Q: '.#.#.##.####.##',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.########.#',
  X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
};
function text3(str, x, y, col) {
  [...str].forEach((ch, n) => { const g = FONT3[ch] || ''; const rows = g.length === 15 ? g : g.padEnd(15, '.'); for (let k = 0; k < 15; k++) if (rows[k] === '#') P(ctx, x + n * 4 + (k % 3), y + Math.floor(k / 3), col); });
}
function initialsOf(name) {
  const words = name.replace(/[^A-Za-z0-9 /]/g, ' ').split(/[\s/]+/).filter(w => w && !/^(the|of|and|capital|partners|group|llc|lp|fund|office|family)$/i.test(w));
  return (words.length ? words : name.split(/\s+/)).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function drawTent(tn, sx, sy) {
  const r = tn.ramp, f = tn.firm, closed = /closed/.test(f.status), ax = sx + 24, ay = sy + 1;
  ctx.save(); if (closed) ctx.globalAlpha = .65;
  ctx.save(); ctx.globalAlpha *= .35; ell(ctx, sx + 28, sy + 31, 25, 4, SHADOW); ctx.restore();
  R(ctx, sx + 3, sy + 28, 42, 3, PAL.sand[2]); R(ctx, sx + 3, sy + 28, 42, 1, PAL.sand[3]);
  [[sx + 7, sy + 15, sx - 4, sy + 30], [sx + 41, sy + 15, sx + 52, sy + 30]].forEach(([a, b, c, d]) => { line(ctx, a, b, c, d, '#c9b99c'); R(ctx, c - 1, d - 2, 2, 3, PAL.timber[1]); P(ctx, c - 1, d - 2, PAL.timber[4]); });
  fillPoly(ctx, [[ax, ay], [sx + 1, sy + 29], [ax, sy + 29]], r[4]);
  fillPoly(ctx, [[ax, ay], [sx + 47, sy + 29], [ax, sy + 29]], r[2]);
  for (let k = 1; k < 4; k++) { line(ctx, ax, ay + 2, sx + 1 + k * 6, sy + 28, r[3]); line(ctx, ax, ay + 2, sx + 47 - k * 6, sy + 28, r[1]); }
  line(ctx, ax - 1, ay + 1, sx + 2, sy + 28, r[5]); line(ctx, ax + 1, ay + 1, sx + 46, sy + 28, r[1]);
  R(ctx, sx + 1, sy + 27, 47, 2, r[1]); for (let k = sx + 3; k < sx + 47; k += 4) P(ctx, k, sy + 27, r[3]);
  fillPoly(ctx, [[ax, sy + 11], [sx + 17, sy + 29], [sx + 31, sy + 29]], '#1a1424');
  R(ctx, sx + 22, sy + 22, 4, 5, PAL.lamp[0]); R(ctx, sx + 23, sy + 23, 2, 3, PAL.lamp[1]); P(ctx, sx + 23, sy + 23, PAL.lamp[2]);
  fillPoly(ctx, [[ax, sy + 11], [sx + 31, sy + 29], [sx + 35, sy + 21]], r[3]); line(ctx, sx + 31, sy + 20, sx + 34, sy + 22, '#c9b99c');
  R(ctx, ax - 1, sy - 9, 2, 11, PAL.timber[2]); P(ctx, ax - 1, sy - 10, PAL.brass[4]);
  const seats = Math.max(1, Math.min(3, f.seats.length || 1)), cols = [PAL.brass[3], '#7be08f', '#62b4e3'];
  const rz = raised.get(f.name), up = rz == null ? 1 : Math.min(1, (t - rz) / 150);
  for (let k = 0; k < seats; k++) { const py = sy - 9 + k * 4 + Math.round((1 - up) * (16 - k * 4)), wave = reduce ? 0 : Math.round(Math.sin(t / 10 + k)); fillPoly(ctx, [[ax + 1, py], [ax + 10, py + 1 + wave], [ax + 1, py + 3]], cols[k]); P(ctx, ax + 1, py, '#ffffff'); }
  const ini = initialsOf(f.name), bw = ini.length * 4 + 3, bx = sx + 36, by = sy + 17;
  R(ctx, bx + Math.floor(bw / 2), by + 7, 1, 7, PAL.timber[1]);
  R(ctx, bx - 1, by - 1, bw + 2, 9, PAL.timber[1]); R(ctx, bx, by, bw, 7, PAL.plaster[4]); R(ctx, bx, by, bw, 1, '#ffffff');
  text3(ini, bx + 2, by + 1, r[1]);
  ctx.restore();
}
function drawShip(sx, sy, flag, flip, n) {
  // 44 x 38, anchored at the waterline; flip mirrors it
  const tb = PAL.timber, pl = PAL.plaster, wa = PAL.water, X = (dx, w = 1) => flip ? sx + 44 - dx - w : sx + dx, r = (dx, dy, w, h, col) => R(ctx, X(dx, w), sy + dy, w, h, col);
  const bil = reduce ? 0 : Math.round((Math.sin(t / 40 + n) + 1) / 2);
  r(6, 38, 32, 3, wa[1]); r(13, 41, 2, 6, wa[1]); r(28, 41, 2, 5, wa[1]);   // the hull and masts reflected, darker
  r(2, 37, 40, 1, wa[5]); r(6, 38, 32, 1, wa[4]); if (!reduce && (t >> 4) % 2) r(0, 36, 3, 1, wa[5]);
  for (let k = 0; k < 3; k++) { const o = ((t >> 2) + k * 5) % 15; r(-2 - o, 36 + k, 4, 1, wa[5 - (k % 2)]); }
  // hull
  r(3, 28, 38, 3, tb[3]); r(5, 31, 34, 3, tb[2]); r(8, 34, 28, 2, tb[1]); r(3, 28, 38, 1, tb[4]); r(1, 26, 6, 3, tb[3]); r(38, 25, 5, 4, tb[2]);
  for (let k = 9; k < 38; k += 6) r(k, 29, 2, 1, PAL.brass[2]);
  r(5, 32, 34, 1, '#d8485f');
  // masts and yards
  r(14, 4, 2, 25, tb[1]); r(29, 8, 2, 21, tb[1]); r(8, 6, 14, 1, tb[2]); r(23, 10, 13, 1, tb[2]); r(8, 16, 14, 1, tb[2]); r(23, 18, 13, 1, tb[2]);
  // sails: lit and shaded panels with a belly that fills and eases
  [[9, 7, 12, 9], [9, 17, 12, 9], [24, 11, 11, 7], [24, 19, 11, 8]].forEach(([dx, dy, w, h], k) => {
    r(dx, dy, w, h, pl[4]); r(dx + (k < 2 ? w - 3 : w - 3), dy, 3, h, pl[2]); r(dx, dy + h - 1, w, 1, pl[1]); r(dx + 2 + bil, dy + 2, 2, h - 4, '#ffffff'); r(dx + Math.floor(w / 2), dy + 1, 1, h - 2, pl[3]);
  });
  r(32, 3, 1, 6, tb[1]); const wave = reduce ? 0 : (t >> 3) % 2; r(33, 3 + wave, 6, 2, flag); r(33, 5, 4, 1, flag);
  line(ctx, X(15), sy + 4, X(40), sy + 25, tb[1]); line(ctx, X(15), sy + 4, X(3), sy + 26, tb[1]);
}
function drawCart(sx, sy, loaded) {
  const tb = PAL.timber, st = PAL.steel;
  R(ctx, sx + 1, sy + 3, 12, 5, tb[3]); R(ctx, sx, sy + 2, 14, 1, tb[4]); R(ctx, sx + 1, sy + 7, 12, 1, tb[1]);
  R(ctx, sx + 1, sy + 3, 1, 4, tb[4]); R(ctx, sx + 12, sy + 3, 1, 4, tb[1]); R(ctx, sx + 4, sy + 3, 1, 5, st[2]); R(ctx, sx + 9, sy + 3, 1, 5, st[2]);
  [sx + 3, sx + 10].forEach(wx => { ell(ctx, wx, sy + 9, 2, 1, st[0]); P(ctx, wx, sy + 9, st[3]); });
  if (loaded) { R(ctx, sx + 2, sy - 1, 10, 3, PAL.plaster[4]); R(ctx, sx + 2, sy - 1, 10, 1, '#ffffff'); R(ctx, sx + 6, sy - 1, 1, 3, '#d8485f'); R(ctx, sx + 3, sy, 2, 1, '#8b8193'); R(ctx, sx + 8, sy, 3, 1, '#8b8193'); }
}
function drawStatue(sx, sy) {
  const s = PAL.rock;
  R(ctx, sx + 5, sy - 14, 6, 10, s[3]); R(ctx, sx + 5, sy - 14, 2, 10, s[4]); R(ctx, sx + 10, sy - 14, 1, 10, s[1]);
  R(ctx, sx + 6, sy - 20, 4, 5, s[4]); P(ctx, sx + 6, sy - 20, s[5]); R(ctx, sx + 10, sy - 22, 2, 9, s[3]); P(ctx, sx + 10, sy - 23, PAL.brass[4]);
  R(ctx, sx + 5, sy - 4, 2, 2, s[2]); R(ctx, sx + 9, sy - 4, 2, 2, s[2]);
}

/* ---------- lighting ---------- */
const MODES = { dusk: { amb: [1, .8, .72], s: [0, .14, .24, .36] }, night: { amb: [.3, .34, .62], s: [0, .34, .58, .82] } };
const WARM = [1.18, .96, .72];
let lvlBuf = new Uint8Array(VWW * VWH);
function lightUp(lights, camX, camY) {
  const f = Math.floor(t / 14);
  lights.forEach((L, i) => {
    const k = L.flicker && !reduce ? (hash(i, f, 77) < .5 ? -1 : 1) : 0;
    const r3 = L.r[2] + k, lx = Math.round(L.x - camX), ly = Math.round(L.y - camY);
    if (lx < -r3 || ly < -r3 || lx > VWW + r3 || ly > VWH + r3) return;
    const r1 = (L.r[0] + k) ** 2, r2 = (L.r[1] + k) ** 2, r33 = r3 * r3;
    for (let y = Math.max(0, ly - r3); y < Math.min(VWH, ly + r3 + 1); y++) {
      const dy = (y - ly) * 1.25, dy2 = dy * dy;
      for (let x = Math.max(0, lx - r3); x < Math.min(VWW, lx + r3 + 1); x++) {
        const d2 = (x - lx) * (x - lx) + dy2, v = d2 <= r1 ? 3 : d2 <= r2 ? 2 : d2 <= r33 ? 1 : 0, ix = y * VWW + x;
        if (v > lvlBuf[ix]) lvlBuf[ix] = v;
      }
    }
  });
}
function applyLight(m, camX, camY, extra) {
  lvlBuf.fill(0);
  lightUp(W.LIGHTS, camX, camY); lightUp(extra, camX, camY);
  const img = ctx.getImageData(0, 0, VWW, VWH), d = img.data;
  for (let i = 0, p = 0; i < VWW * VWH; i++, p += 4) {
    const s = m.s[lvlBuf[i]];
    d[p] = Math.min(255, d[p] * (m.amb[0] + (WARM[0] - m.amb[0]) * s));
    d[p + 1] = Math.min(255, d[p + 1] * (m.amb[1] + (WARM[1] - m.amb[1]) * s));
    d[p + 2] = Math.min(255, d[p + 2] * (m.amb[2] + (WARM[2] - m.amb[2]) * s));
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- time ---------- */
let timeMode = store.get('time', 'auto');
function nyParts() { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).forEach(p => { o[p.type] = p.value; }); return o; }
let clock = { at: -999, h: 12, wd: 'Mon' };
function readClock() { if (t - clock.at > 120 || clock.at < 0) { const o = nyParts(); clock = { at: t, h: (+o.hour % 24) + (+o.minute) / 60, wd: o.weekday }; } return clock; }
function nyWeekday() { return readClock().wd; }
// the sky's colour through the day: night blue, a pink dawn, white noon, a golden hour, a violet dusk
const SKY = [[0, [.38, .41, .66]], [5, [.4, .43, .68]], [6.2, [.72, .56, .68]], [7.3, [.98, .88, .84]], [9, [1, 1, 1]], [16, [1, .98, .94]], [17.4, [1, .84, .7]], [18.6, [.8, .6, .66]], [19.6, [.44, .45, .7]], [24, [.38, .41, .66]]];
let weatherMode = store.get('weather', 'live'), liveWx = { kind: 'clear', wind: .25 }, flash = 0;
function weatherNow() { if (weatherMode === 'live') return liveWx; return { kind: weatherMode, wind: { storm: .95, rain: .5, snow: .35, fog: .15 }[weatherMode] || .25 }; }
async function fetchWeather() {
  // current New York weather from Open-Meteo (free, no key); offline keeps the last reading
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=weather_code,wind_speed_10m&timezone=America%2FNew_York');
    const j = await r.json(), c = j.current.weather_code, w = j.current.wind_speed_10m;
    const kind = c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c === 45 || c === 48 ? 'fog' : 'clear';
    liveWx = { kind, wind: clamp(w / 40, .1, 1) }; updateHud();
  } catch { /* no network: keep the last known weather */ }
}
function environment() {
  const h = timeMode === 'day' ? 12 : timeMode === 'dusk' ? 18.4 : timeMode === 'night' ? 22 : readClock().h;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i + 1 < SKY.length; i++) if (h >= SKY[i][0] && h < SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  const f = (h - a[0]) / ((b[0] - a[0]) || 1), wx = weatherNow(), dim = { rain: .84, storm: .68, fog: .9, snow: .94 }[wx.kind] || 1;
  let amb = a[1].map((v, k) => (v + (b[1][k] - v) * f) * dim * (wx.kind === 'snow' && k === 2 ? 1.05 : 1));
  if (flash > 0) amb = amb.map(v => Math.min(1.5, v + flash));
  const lum = (amb[0] + amb[1] + amb[2]) / 3, k = clamp((1 - lum) / .55, 0, 1);
  return { h, amb, s: [0, .34 * k, .58 * k, .82 * k], lum, lit: lum < .86, phase: lum < .5 ? 'night' : lum < .86 ? 'dusk' : 'day', wx, needLight: lum < .985 || flash > 0 };
}
function phaseNow() { return environment().phase; }
let envNow = environment();
// characters' shadows lengthen and swing with the sun
function sunShadow(cx, cy, rx, alpha) {
  const h = envNow.h; let off = 0, ext = 0;
  if (h > 6 && h < 18.6) { const e = Math.sin(Math.PI * (h - 6) / 12.6); ext = Math.round((1 - e) * 7); off = h < 12.3 ? -ext : ext; }
  ctx.save(); ctx.globalAlpha = alpha * (envNow.lum < .6 ? .5 : 1); ell(ctx, cx + Math.round(off / 2), cy, rx + Math.round(ext / 2), 1, SHADOW); ctx.restore();
}

/* ---------- ambient life ---------- */
const cloudShape = (() => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 90; const g = c.getContext('2d', { willReadFrequently: true });
  [[60, 50, 46, 22], [110, 40, 52, 26], [150, 55, 40, 20], [90, 62, 50, 18], [130, 30, 30, 14]].forEach(([x, y, rx, ry]) => ell(g, x, y, rx, ry, SHADOW));
  return c;
})();
const CLOUDS = [[0, 20 * 16, 1], [700, 52 * 16, .8], [1400, 36 * 16, 1.2], [300, 78 * 16, .9], [1100, 8 * 16, 1.1]];
const leaves = [];
function ambientBeforeActors(anim, tx0, ty0, ph) {
  // grass blades that sway in the wind, two per visible grass tile
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty)) continue; const i = W.id(tx, ty);
    if (W.ter[i] !== W.T.GRASS || W.solid[i] || W.cliff[i]) continue;
    const g = W.lv[i] === 2 ? PAL.alpine : PAL.grass;
    for (let k = 0; k < 2; k++) {
      if (hash(tx, ty, 300 + k) < .35) continue;
      const bx = tx * TILE + Math.floor(hash(tx, ty, 310 + k) * 14) - camX, by = ty * TILE + Math.floor(hash(tx, ty, 320 + k) * 12) + 2 - camY;
      const sway = reduce ? 0 : Math.round(Math.sin(anim / (38 - envNow.wx.wind * 18) + tx * .35 + ty * .22) * (1 + envNow.wx.wind * 2));
      P(ctx, bx, by + 2, g[2]); P(ctx, bx + (sway > 0 ? 1 : 0), by + 1, g[3]); P(ctx, bx + sway, by, g[4]);
    }
  }
  // surf running up and down the beaches
  const wa = PAL.water;
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty) || W.ter[W.id(tx, ty)] !== W.T.SAND) continue;
    const ph2 = reduce ? 0 : Math.round((Math.sin(anim / 50 + (tx + ty) * .6) + 1) * 1.5), px = tx * TILE - camX, py = ty * TILE - camY;
    const wet = (X, Y) => W.inb(X, Y) && W.isWater(W.ter[W.id(X, Y)]);
    for (let k = (anim >> 4) % 3; k < 16; k += 3) {
      if (wet(tx, ty + 1)) P(ctx, px + k, py + 16 + ph2, wa[5]);
      if (wet(tx, ty - 1)) P(ctx, px + k, py - 1 - ph2, wa[5]);
      if (wet(tx + 1, ty)) P(ctx, px + 16 + ph2, py + k, wa[5]);
      if (wet(tx - 1, ty)) P(ctx, px - 1 - ph2, py + k, wa[5]);
    }
  }
}
function ambientAfterActors(anim, ph) {
  // drifting cloud shadows (not at night)
  if (ph !== 'night') {
    ctx.save(); ctx.globalAlpha = ph === 'dusk' ? .07 : .11;
    CLOUDS.forEach(([x0, y, sc], n) => {
      const span = W.WPX + 600, x = ((x0 + (reduce ? 0 : anim * .12 * sc)) % span) - 300;
      if (x + 200 * sc < camX || x > camX + VWW || y + 90 * sc < camY || y > camY + VWH) return;
      ctx.drawImage(cloudShape, Math.round(x - camX), Math.round(y - camY), Math.round(200 * sc), Math.round(90 * sc));
    });
    ctx.restore();
  }
  // leaves blowing across the view
  if (!reduce && t % Math.max(5, Math.round(26 - envNow.wx.wind * 20)) === 0 && leaves.length < 24) leaves.push({ x: camX + Math.random() * VWW, y: camY - 4, a: 0, c: ['#83b752', '#e89448', '#c96334', '#c0d872'][Math.floor(Math.random() * 4)], s: Math.random() * 6 });
  for (let i = leaves.length - 1; i >= 0; i--) {
    const L = leaves[i]; L.a++; L.x += .35 + envNow.wx.wind * 1.4 + Math.sin(L.a / 18 + L.s) * .4; L.y += .28;
    if (L.a > 900 || L.y > camY + VWH + 6 || L.x > camX + VWW + 6) { leaves.splice(i, 1); continue; }
    const sx = Math.round(L.x - camX), sy = Math.round(L.y - camY), flip = (L.a >> 3) % 2;
    P(ctx, sx, sy, L.c); P(ctx, sx + (flip ? 1 : -1), sy + 1, L.c);
  }
  // gulls over the island
  for (let k = 0; k < 4; k++) {
    const span = W.WPX + 300, x = ((k * 640 + (reduce ? 0 : anim * (.45 + k * .07))) % span) - 150, y = (14 + k * 21) * TILE + Math.sin(anim / 70 + k) * 24;
    const sx = Math.round(x - camX), sy = Math.round(y - camY); if (sx < -10 || sy < -10 || sx > VWW + 10 || sy > VWH + 10) continue;
    const up = (anim >> 3) % 3 === 0, col = ph === 'night' ? '#8b8fa8' : '#f4f8fd';
    if (up) { P(ctx, sx - 2, sy - 1, col); P(ctx, sx - 1, sy, col); P(ctx, sx, sy, PAL.steel[2]); P(ctx, sx + 1, sy, col); P(ctx, sx + 2, sy - 1, col); }
    else { P(ctx, sx - 2, sy, col); P(ctx, sx - 1, sy, col); P(ctx, sx, sy, PAL.steel[2]); P(ctx, sx + 1, sy, col); P(ctx, sx + 2, sy, col); P(ctx, sx - 3, sy + 1, col); P(ctx, sx + 3, sy + 1, col); }
    ctx.save(); ctx.globalAlpha = .18; R(ctx, sx + 6, sy + 22, 5, 1, SHADOW); ctx.restore();
  }
}

/* ---------- weather and sky ---------- */
const puffShape = (() => {
  // a cloud seen from above: three stepped layers, densest in the middle
  const c = document.createElement('canvas'); c.width = 220; c.height = 110; const g = c.getContext('2d', { willReadFrequently: true });
  [[0, '#cfd6ea'], [1, '#e8ecf6'], [2, '#ffffff']].forEach(([k, col]) => [[70, 60, 58, 30], [130, 50, 64, 34], [170, 66, 44, 26], [100, 74, 60, 24]].forEach(([x, y, rx, ry]) => ell(g, x, y - k * 3, rx - k * 9, ry - k * 6, col)));
  return c;
})();
const fogShape = (() => { const c = document.createElement('canvas'); c.width = 300; c.height = 80; const g = c.getContext('2d', { willReadFrequently: true }); [[150, 40, 140, 30], [80, 45, 70, 22], [230, 38, 60, 20]].forEach(([x, y, rx, ry]) => ell(g, x, y, rx, ry, '#dde3f0')); return c; })();
function weatherBack(anim) {
  // puddles on paths while it rains, with rings from the drops
  const wx = envNow.wx; if (wx.kind !== 'rain' && wx.kind !== 'storm') return;
  const tx0 = Math.floor(camX / TILE), ty0 = Math.floor(camY / TILE), wa = PAL.water;
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty)) continue; const g = W.ter[W.id(tx, ty)]; if ((g !== W.T.PATH && g !== W.T.COBBLE) || hash(tx, ty, 400) > .2) continue;
    const px = tx * TILE - camX + 4 + Math.floor(hash(tx, ty, 401) * 6), py = ty * TILE - camY + 6 + Math.floor(hash(tx, ty, 402) * 6);
    ell(ctx, px, py, 4, 1, wa[2]); R(ctx, px - 2, py, 3, 1, wa[4]);
    const k = ((anim + Math.floor(hash(tx, ty, 403) * 40)) % 40) / 40; if (k < .5) ring(ctx, px, py, 1 + Math.round(k * 6), Math.round(k * 2), wa[5]);
  }
}
function weatherFront(anim) {
  const wx = envNow.wx, wind = wx.wind;
  // rain: slanted streaks that splash where they land
  if (wx.kind === 'rain' || wx.kind === 'storm') {
    const n = wx.kind === 'storm' ? 230 : 120, slant = 1 + wind * 3;
    for (let i = 0; i < n; i++) {
      const sp = 5 + hash(i, 1, 410) * 3, land = 20 + hash(i, 2, 410) * (VWH - 10), x0 = hash(i, 3, 410) * (VWW + 80) - 40, cyc = land + 30;
      const y = ((anim * sp + hash(i, 4, 410) * 400) % cyc) - 30, x = (x0 + (y + 30) * slant * .25 + camX * 0) % (VWW + 40);
      if (y < land - 3) { for (let k = 0; k < 4; k++) P(ctx, Math.round(x - k * slant * .25), Math.round(y - k), k < 2 ? '#bfe9f3' : '#7ea7c8'); }
      else { P(ctx, Math.round(x) - 1, Math.round(land) - 1, '#dff4ff'); P(ctx, Math.round(x) + 1, Math.round(land) - 1, '#dff4ff'); }
    }
  }
  // snow: in a snowstorm everywhere; always a little on the high mountain
  const highUp = camY < 26 * TILE, snowing = wx.kind === 'snow';
  if (snowing || highUp) {
    const n = snowing ? 240 : 60, top = snowing ? VWH : Math.min(VWH, 26 * TILE - camY);
    for (let i = 0; i < n; i++) {
      const y = ((anim * (.35 + hash(i, 5, 411) * .4) + hash(i, 6, 411) * 300) % (top + 10)) - 5, x = (hash(i, 7, 411) * VWW + Math.sin(anim / 40 + i) * 6 + anim * wind * .6) % VWW;
      if (i % 3 === 0) R(ctx, Math.round(x), Math.round(y), 2, 2, '#ffffff'); else P(ctx, Math.round(x), Math.round(y), i % 2 ? '#ffffff' : '#dfe6f4');
    }
  }
  // fog banks rolling in; a light mist over the low ground on early mornings
  const morning = envNow.h > 5 && envNow.h < 8.5 && weatherMode === 'live', fogA = wx.kind === 'fog' ? .24 : morning ? .1 : 0;
  if (fogA) { ctx.save(); ctx.globalAlpha = fogA * .7; ctx.fillStyle = '#dde3f0'; ctx.fillRect(0, 0, VWW, VWH); ctx.globalAlpha = fogA * 1.1; for (let k = 0; k < 10; k++) { const span = VWW + 300, x = (((k * 197 + anim * (.15 + (k % 4) * .05) - camX * .6) % span) + span) % span - 300, y = (((k * 61 - camY * .6) % (VWH + 80)) + VWH + 80) % (VWH + 80) - 40; ctx.drawImage(fogShape, Math.round(x), Math.round(y)); } ctx.restore(); }
  // a high cloud layer, moving faster than the ground below it (parallax)
  const cover = { clear: 3, fog: 2, rain: 5, storm: 6, snow: 5 }[wx.kind] || 3;
  ctx.save(); ctx.globalAlpha = (wx.kind === 'storm' ? .28 : .18) * Math.min(1, envNow.lum * 1.1);
  for (let k = 0; k < cover; k++) { const x = ((k * 410 + anim * (.2 + wind * .5)) - camX * 1.25) % (VWW + 440) - 220, y = ((k * 170 + 40) - camY * 1.25) % (VWH + 220) - 110; ctx.drawImage(puffShape, Math.round(x < -220 ? x + VWW + 440 : x), Math.round(y < -110 ? y + VWH + 220 : y)); }
  ctx.restore();
}
function vignette() {
  // stepped darkening at the edges: stronger at night and in storms
  const base = (envNow.phase === 'night' ? .2 : envNow.phase === 'dusk' ? .13 : .06) + (envNow.wx.kind === 'storm' ? .08 : 0);
  ctx.save(); ctx.fillStyle = '#06050b';
  for (let k = 0; k < 4; k++) { ctx.globalAlpha = base * (1 - k / 4); const i2 = k * 7; ctx.fillRect(i2, i2, VWW - i2 * 2, 7); ctx.fillRect(i2, VWH - i2 - 7, VWW - i2 * 2, 7); ctx.fillRect(i2, i2 + 7, 7, VWH - i2 * 2 - 14); ctx.fillRect(VWW - i2 - 7, i2 + 7, 7, VWH - i2 * 2 - 14); }
  ctx.restore();
}
function iris(f, cx, cy) {
  // a circle closing on you, drawn in rows so its edge stays on the pixel grid
  const r = (1 - f) * (Math.hypot(VWW, VWH) / 2 + 20); ctx.fillStyle = '#06050b';
  for (let y = 0; y < VWH; y++) { const dy = y + .5 - cy; if (Math.abs(dy) >= r) { ctx.fillRect(0, y, VWW, 1); continue; } const hw = Math.sqrt(r * r - dy * dy); ctx.fillRect(0, y, Math.max(0, Math.round(cx - hw)), 1); ctx.fillRect(Math.round(cx + hw), y, VWW, 1); }
}

/* ---------- render ---------- */
let camX = 0, camY = 0, camFX = null, camFY = null, leadX = 0, leadY = 0;
let bellT = null;
function renderRoom() {
  const r = room, ox = Math.round((VWW - r.cw) / 2), oy = Math.round((VWH - r.ch) / 2), anim = reduce ? 0 : t;
  camX = -ox; camY = -oy;
  ctx.fillStyle = '#06050b'; ctx.fillRect(0, 0, VWW, VWH);
  ctx.drawImage(r.canvas, ox, oy);
  VI.drawWindows(ctx, r, ox, oy, envNow, anim);
  if (r.id === 'crier') VI.drawBoard(ctx, r, D.radar.length, ox, oy);
  VI.drawAnims(ctx, r, anim, ox, oy, { bellT });
  const pend = DV.pending[r.id] || [], acc = HOUSE_META[r.id].accent;
  r.slots.forEach((sl, n) => VI.drawSlot(ctx, r, n, !!pend[n], acc, anim, ox, oy));
  const ppx = player.x * TILE + (player.moving ? DV2[player.dir][0] * player.prog : 0), ppy = player.y * TILE + (player.moving ? DV2[player.dir][1] * player.prog : 0);
  const actors = [{ y: ppy + 15, draw: () => drawPlayerAt(Math.round(ppx + ox) + 1, Math.round(ppy + oy) - 8) }];
  if (r.bot) { const [bx, by] = r.bot, bb = botBounce[r.id] != null && t - botBounce[r.id] < 30 ? Math.round(Math.sin((t - botBounce[r.id]) / 30 * Math.PI) * 9) : 0; actors.push({ y: by * TILE + 16, draw: () => drawBotSprite(bx * TILE + ox, by * TILE - 6 + oy - bb, acc, 7, player.x < bx) }); }
  actors.sort((a, z) => a.y - z.y).forEach(a => a.draw());
  drawParts(false);
  VI.drawLight(ctx, r, ox, oy, envNow, anim);
  VI.drawFlames(ctx, r, ox, oy, anim);
  // a marker bobs over every draft waiting for you
  const more = pend.length - r.slots.length;
  pend.slice(0, r.slots.length).forEach((a, n) => {
    const sl = r.slots[n], x = sl.x * TILE + ox + 8, y = sl.y * TILE + oy - 13 + (reduce ? 0 : Math.round(Math.sin(t / 12 + n)));
    R(ctx, x - 4, y, 9, 10, PAL.steel[0]); R(ctx, x - 3, y + 1, 7, 8, '#fffaf0'); R(ctx, x - 1, y + 2, 3, 4, '#d8485f'); R(ctx, x - 1, y + 7, 3, 1, '#d8485f');
  });
  if (more > 0) { const sl = r.slots[r.slots.length - 1], x = sl.x * TILE + ox + 14, y = sl.y * TILE + oy - 12; R(ctx, x - 1, y - 1, 15, 8, PAL.steel[0]); R(ctx, x, y + 2, 3, 1, '#fff6e0'); R(ctx, x + 1, y + 1, 1, 3, '#fff6e0'); text3(String(more + 1), x + 4, y + 1, '#fff6e0'); }
  drawParts(true);
  vignette();
  if (fade > 0) iris(fade, Math.round(ppx + ox) + 8, Math.round(ppy + oy) + 2);
}
function render() {
  envNow = environment();
  miniEl.style.visibility = room ? 'hidden' : '';
  if (room) { renderRoom(); $('#shout').hidden = true; return; }
  const ph = envNow.phase, lit = envNow.lit;
  const ppx = player.x * TILE + (player.moving ? DV2[player.dir][0] * player.prog : 0), ppy = player.y * TILE + (player.moving ? DV2[player.dir][1] * player.prog : 0);
  const lx = player.moving ? DV2[player.dir][0] * 26 : 0, ly = player.moving ? DV2[player.dir][1] * 18 : 0;
  leadX += (lx - leadX) * .05; leadY += (ly - leadY) * .05;
  let tx = ppx + 8 - VWW / 2 + leadX, ty = ppy + 8 - VWH / 2 + leadY;
  if (camPan && t < camPan.until && !uiOpen()) { tx = camPan.x - VWW / 2; ty = camPan.y - VWH / 2; } else if (camPan && t >= camPan.until) camPan = null;
  if (camFX === null || fade > .95 || Math.abs(tx - camFX) > 400 || Math.abs(ty - camFY) > 300) { camFX = tx; camFY = ty; }
  camFX += (tx - camFX) * (reduce ? 1 : .12); camFY += (ty - camFY) * (reduce ? 1 : .12);
  camX = clamp(Math.round(camFX), 0, W.WPX - VWW); camY = clamp(Math.round(camFY), 0, W.WPY - VWH);
  ctx.drawImage(W.canvas, camX, camY, VWW, VWH, 0, 0, VWW, VWH);
  const vis = (x, y, m = 48) => x > camX - m && y > camY - m && x < camX + VWW + m && y < camY + VWH + m;
  const anim = reduce ? 0 : t;

  // sea glints
  const tx0 = Math.floor(camX / TILE), ty0 = Math.floor(camY / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty) || W.ter[W.id(tx, ty)] !== W.T.SEA) continue;
    if (hash(tx, ty, Math.floor(anim / 30)) < .07) { const gx = tx * TILE - camX + Math.floor(hash(tx, ty, 5) * 10), gy = ty * TILE - camY + Math.floor(hash(ty, tx, 5) * 12); R(ctx, gx, gy, 3, 1, PAL.water[5]); P(ctx, gx + 1, gy - 1, PAL.water[4]); }
  }
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty) || W.ter[W.id(tx, ty)] !== W.T.RIVER) continue;
    for (let k = 0; k < 2; k++) { const off = ((anim >> 1) + Math.floor(hash(tx, ty, 7 + k) * 16)) % 16, gx = tx * TILE - camX + 15 - off, gy = ty * TILE - camY + 3 + Math.floor(hash(ty, tx, 7 + k) * 10); R(ctx, gx, gy, 3, 1, PAL.water[5]); }
  }
  W.FALLS.forEach(([fx, fy]) => {
    const sx = fx * TILE - camX, sy = fy * TILE - camY; if (sx < -16 || sy < -16 || sx > VWW || sy > VWH) return;
    for (let k = 1; k < 15; k += 3) { const yy = (Math.floor(hash(fx * 16 + k, 0, 94) * 16) + anim * 2) % 16; R(ctx, sx + k, sy + yy, 1, Math.min(4, 16 - yy), '#ffffff'); }
  });
  for (let ty = ty0; ty <= ty0 + Math.ceil(VWH / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VWW / TILE); tx++) {
    if (!W.inb(tx, ty) || W.ter[W.id(tx, ty)] !== W.T.SHALLOW) continue;
    for (let k = 0; k < 4; k++) { if (((anim >> 4) + k + Math.floor(hash(tx, ty, 420 + k) * 3)) % 3) continue; const cx = tx * TILE - camX + Math.floor(hash(tx, ty, 430 + k) * 13), cy = ty * TILE - camY + Math.floor(hash(ty, tx, 430 + k) * 14); R(ctx, cx, cy, 2, 1, PAL.water[4]); P(ctx, cx + 2, cy + 1, PAL.water[5]); }
  }
  ambientBeforeActors(anim, tx0, ty0, ph);
  weatherBack(anim);
  // the drawbridge, raised
  if (bridgeUp) W.BRIDGE_TILES.forEach(([x, y]) => { const sx = x * TILE - camX, sy = y * TILE - camY; R(ctx, sx, sy, TILE, TILE, PAL.water[2]); if ((x + y + (anim >> 5)) % 3 === 0) R(ctx, sx + 4, sy + 8, 5, 1, PAL.water[4]); });
  if (bridgeUp && W.BRIDGE_TILES.length) { const [bx, by] = W.BRIDGE_TILES[W.BRIDGE_TILES.length - 1], sx = (bx + 1) * TILE - camX, sy = by * TILE - camY - 30; R(ctx, sx, sy, 10, 46, PAL.timber[3]); R(ctx, sx, sy, 2, 46, PAL.timber[4]); for (let k = 0; k < 46; k += 5) R(ctx, sx, sy + k, 10, 1, PAL.timber[1]); }
  // summit gate rope, shrine banner
  if (!DV.summitOpen && W.SUMMIT_GATE.length) { const xs = W.SUMMIT_GATE.map(s => s[0]), gy = Math.max(...W.SUMMIT_GATE.map(s => s[1])); const sx = Math.min(...xs) * TILE - camX, sy = gy * TILE - camY + 2; for (let k = 0; k < 32; k++) P(ctx, sx + k, sy + Math.round(Math.sin(k / 31 * Math.PI) * 3), k % 4 < 2 ? '#f2e8cf' : '#d8485f'); R(ctx, sx + 13, sy + 4, 6, 6, '#f2e8cf'); R(ctx, sx + 15, sy + 5, 2, 4, '#d8485f'); }
  if (DV.summitFirm && W.SHRINE) { const sx = W.SHRINE.x - camX, sy = W.SHRINE.y - camY; R(ctx, sx, sy - 26, 1, 24, PAL.steel[3]); fillPoly(ctx, [[sx + 1, sy - 26], [sx + 14 + (anim % 40 < 20 ? 1 : 0), sy - 21], [sx + 1, sy - 16]], PAL.brass[3]); }
  // statues
  DV.statues.forEach((g, n) => { const [x, y] = W.PEDESTALS[n]; drawStatue(x * TILE - camX, y * TILE - camY + 6); });

  // y-sorted actors
  const actors = [];
  DV.tents.forEach(tn => { const px = tn.x * TILE, py = tn.y * TILE; if (vis(px, py)) actors.push({ y: py + 31, draw: () => drawTent(tn, px - camX, py - camY) }); });
  Object.entries(W.BOTS).forEach(([h, [x, y]]) => {
    const bp = botPos(h), px = Math.round(bp.x), py = Math.round(bp.y) - 6; if (!vis(px, py)) return;
    let bb = botBounce[h] != null && t - botBounce[h] < 30 ? Math.round(Math.sin((t - botBounce[h]) / 30 * Math.PI) * 9) : 0, flip = bp.flip;
    if (bp.work === 'kata') { bb += Math.abs(Math.round(Math.sin(t / 9) * 4)); flip = (t >> 5) % 2 === 1; }
    const carry = h === 'print' && (bp.out || bp.work === 'papers') ? 'papers' : null;
    actors.push({ y: py + 22, draw: () => { drawBotSprite(px - camX, py - camY - bb, HOUSE_META[h].accent, x * 37 + y * 11, flip, carry); if (h === 'crier' && shout) drawHandBell(px - camX, py - camY); } });
  });
  critters.forEach(c => {
    if (c.kind === 'fish' || c.hidden) return;
    if (c.kind === 'fly') { if (envNow.lum < .75 || envNow.wx.kind !== 'clear') return; const x = c.cx + Math.sin(c.a) * 22 + Math.sin(c.a * 2.3) * 6, y = c.cy + Math.cos(c.a * 1.3) * 10 - 6; if (vis(x, y)) actors.push({ y: y + 20, draw: () => drawFly(c, Math.round(x - camX), Math.round(y - camY)) }); return; }
    const x = Math.round(c.x), y = Math.round(c.y); if (!vis(x, y)) return;
    const draw = c.kind === 'deer' ? () => drawDeer(c, x - camX - 9, y - camY - 13) : c.kind === 'crab' ? () => drawCrab(c, x - camX - 4, y - camY - 3) : () => drawFox(c, x - camX - 8, y - camY - 9);
    actors.push({ y: y + 3, draw });
  });
  if (runner.path && DV.feedTailor) {
    const a = Math.floor(runner.i), b = Math.min(a + 1, runner.path.length - 1), f = runner.i - a;
    const px = (runner.path[a][0] + (runner.path[b][0] - runner.path[a][0]) * f) * TILE + 1, py = (runner.path[a][1] + (runner.path[b][1] - runner.path[a][1]) * f) * TILE - 2;
    if (vis(px, py)) actors.push({ y: py + 18, draw: () => drawBotSprite(Math.round(px - camX) - 1, Math.round(py - camY) - 4, HOUSE_META.dojo.accent, 99, runner.path[b][0] < runner.path[a][0] || (runner.dir < 0 && runner.path[b][0] === runner.path[a][0]), runner.dir > 0) });
  }
  if (W.RAIL.length) {
    const a = Math.floor(cart.i), b = Math.min(a + 1, W.RAIL.length - 1), f = cart.i - a;
    const px = (W.RAIL[a][0] + (W.RAIL[b][0] - W.RAIL[a][0]) * f) * TILE + 2, py = (W.RAIL[a][1] + (W.RAIL[b][1] - W.RAIL[a][1]) * f) * TILE + 5;
    if (vis(px, py)) actors.push({ y: py + 8, draw: () => drawCart(Math.round(px - camX) - 1, Math.round(py - camY), DV.feedCrier) });
  }
  W.SHIP_SLOTS.slice(0, DV.ships).forEach(([x, y], n) => { let px = x * TILE - 14, py = y * TILE - 22 + (reduce ? 0 : Math.round(Math.sin(t / 30 + n) * 1));
    if (shipIn && shipIn.n === n) { const k = Math.min(1, (t - shipIn.t0) / 720), e = Math.pow(1 - k, 3); px += Math.round(shipIn.dir[0] * 26 * TILE * e); py += Math.round(shipIn.dir[1] * 26 * TILE * e); if (k >= 1) shipIn = null; } if (vis(px, py, 60)) actors.push({ y: py + 38, draw: () => drawShip(px - camX, py - camY, ['#7be08f', '#ffb347', '#62b4e3', '#c9a8f5', '#e0605a'][n % 5], n % 2 === 1, n) }); });
  actors.push({ y: ppy + 15, draw: () => drawPlayerAt(Math.round(ppx - camX) + 1, Math.round(ppy - camY) - 8) });
  actors.sort((a, z) => a.y - z.y).forEach(a => a.draw());
  drawParts(false);
  // roofs, canopies and beams go over everyone, so you walk behind them
  ctx.drawImage(W.upper, camX, camY, VWW, VWH, 0, 0, VWW, VWH);
  W.CABLES.forEach(cb => {
    const draw = (f, fn) => { const [x, y] = cb.at(f), sx = Math.round(x - camX), sy = Math.round(y - camY); if (sx > -20 && sy > -20 && sx < VWW + 20 && sy < VWH + 30) fn(sx, sy); };
    if (cb.kind === 'gondola') {
      const base = DV.gondola && !reduce ? (t / 1500) % 1 : 0;
      [base, (base + .5) % 1].forEach((f0, n) => draw(DV.gondola ? f0 : (n ? .96 : .04), (sx, sy) => {
        const r = PAL.crierRoof; R(ctx, sx, sy, 1, 4, PAL.steel[1]); R(ctx, sx - 2, sy - 1, 5, 2, PAL.steel[2]);
        R(ctx, sx - 5, sy + 4, 11, 9, r[3]); R(ctx, sx - 5, sy + 4, 11, 1, r[4]); R(ctx, sx - 5, sy + 12, 11, 1, r[1]); R(ctx, sx + 5, sy + 5, 1, 7, r[2]);
        R(ctx, sx - 4, sy + 6, 9, 4, PAL.water[4]); R(ctx, sx - 4, sy + 6, 9, 1, PAL.water[5]); R(ctx, sx, sy + 6, 1, 4, r[2]);
      }));
    } else if (cb.kind === 'zip') {
      const cyc = (t % 720) / 720, f = DV.zip && !reduce ? Math.min(1, cyc / .55) : 0;
      if (DV.zip && f < 1) draw(f, (sx, sy) => { R(ctx, sx - 2, sy - 1, 5, 2, PAL.steel[2]); R(ctx, sx, sy + 1, 1, 3, PAL.steel[1]); R(ctx, sx - 2, sy + 4, 5, 6, HC.coat[2]); R(ctx, sx - 1, sy + 1, 3, 3, HC.skin[1]); R(ctx, sx - 1, sy, 3, 1, HC.hair[1]); R(ctx, sx - 2, sy + 10, 2, 3, HC.pants[1]); R(ctx, sx + 1, sy + 10, 2, 3, HC.pants[1]); });
      else draw(0, (sx, sy) => { R(ctx, sx - 2, sy - 1, 5, 2, PAL.steel[2]); R(ctx, sx, sy + 1, 1, 4, PAL.steel[1]); R(ctx, sx - 2, sy + 5, 5, 2, PAL.timber[3]); });
    }
  });
  ambientAfterActors(anim, ph);
  critters.forEach(c => { if (c.kind === 'fish') drawFish(c); });

  if (coin) { const k = Math.min(1, (t - coin.t0) / 46), x = coin.x0 + (coin.x1 - coin.x0) * k - camX, y = coin.y0 + (coin.y1 - coin.y0) * k - Math.sin(k * Math.PI) * 34 - camY, spin = (t >> 2) % 3;
    R(ctx, x - (spin === 1 ? 0 : 1), y - 1, spin === 1 ? 1 : 3, 3, PAL.brass[3]); P(ctx, x, y - 1, PAL.brass[4]); if (spin === 0) P(ctx, x - 1, y, PAL.brass[1]); }
  if (splash) { const k = (t - splash.t0) / 34; ring(ctx, Math.round(splash.x - camX), Math.round(splash.y - camY), 2 + Math.round(k * 7), 1 + Math.round(k * 2), k < .5 ? PAL.water[5] : PAL.water[4]); if (k < .4) { P(ctx, splash.x - camX - 2, splash.y - camY - 4 - k * 10, '#ffffff'); P(ctx, splash.x - camX + 3, splash.y - camY - 3 - k * 8, '#ffffff'); } }
  // chimney smoke
  smoke.forEach(s => { if (!vis(s.x, s.y)) return; const sz = s.a < 40 ? 2 : s.a < 100 ? 3 : 4; R(ctx, s.x - camX, s.y - camY, sz, sz, s.a < 50 ? PAL.plaster[4] : s.a < 110 ? PAL.plaster[3] : PAL.plaster[2]); });
  // rain over houses that are behind pace
  Object.keys(DV.behind).forEach(h => {
    const [hx, hy] = housePoint(h); if (!vis(hx, hy, 90)) return;
    const cx = hx - camX, cy = hy - camY - 34;
    [[-22, 2, 14, 6], [0, 0, 18, 8], [20, 3, 13, 6]].forEach(([dx, dy, rx, ry]) => { ell(ctx, cx + dx, cy + dy + 2, rx, ry, PAL.rock[1]); ell(ctx, cx + dx - 1, cy + dy, rx - 1, ry - 1, PAL.rock[2]); ell(ctx, cx + dx - 3, cy + dy - 2, Math.max(1, rx - 6), Math.max(1, ry - 4), PAL.rock[3]); });
    for (let k = 0; k < 22; k++) { const rx = cx - 30 + Math.floor(hash(k, h.length, 3) * 60), ry = cy + 8 + ((anim * 3 + k * 17) % 60); R(ctx, rx, ry, 1, 3, PAL.water[4]); }
  });
  // fog around the keep
  if (W.KEEP_AREA) {
    const K = W.KEEP_AREA, kx = K.x * TILE, ky = K.y * TILE, kw = K.w * TILE, kh = K.h * TILE;
    if (vis(kx, ky, kw)) {
      ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#c8d0e8';
      for (let b = 0; b < 9; b++) { const by = ky + b * kh / 9, off = reduce ? 0 : Math.round(Math.sin(t / 120 + b) * 14); ctx.fillRect(Math.round(kx + off + (b % 2) * 20 - camX), Math.round(by - camY), Math.round(kw - 40), Math.round(kh / 14)); }
      ctx.restore();
    }
  }

  weatherFront(anim);
  // light
  const extra = DV.tents.map(tn => ({ x: tn.x * TILE + 24, y: tn.y * TILE + 25, r: [6, 12, 18], flicker: true }));
  if (envNow.needLight) applyLight(envNow, camX, camY, extra);

  // emissive, after lighting
  if (lit) {
    W.GLASS.forEach(g => { if (!vis(g.x, g.y, 4)) return; const x = g.x - camX, y = g.y - camY; R(ctx, x, y, g.w, g.h, PAL.lamp[2]); R(ctx, x, y, g.w, Math.min(2, g.h), PAL.lamp[3]); R(ctx, x, y + g.h - 2, g.w, 2, PAL.lamp[1]); const [mx, my] = g.mul; R(ctx, mx - camX, y, g.w > 8 ? 2 : 1, g.h, PAL.timber[1]); R(ctx, x, my - camY, g.w, g.w > 8 ? 2 : 1, PAL.timber[1]); });
    W.LIGHTS.forEach(L => { if (L.lamp && vis(L.x, L.y, 4)) { const [lx, ly, lw, lh] = L.lamp; R(ctx, lx - camX, ly - camY, lw, lh, PAL.lamp[2]); R(ctx, lx - camX + 1, ly - camY + 1, Math.max(1, lw - 2), Math.max(1, lh - 2), PAL.lamp[3]); } if (L.torch && vis(L.x, L.y, 4)) { const [fx, fy] = L.torch, fl = (anim >> 3) % 2; R(ctx, fx - camX + 1, fy - camY + 1, 2, 4, PAL.lamp[1]); P(ctx, fx - camX + 1 + fl, fy - camY, PAL.lamp[3]); } });
    extra.forEach(L => { R(ctx, L.x - camX - 1, L.y - camY - 2, 2, 4, PAL.lamp[3]); });
    if (W.LIGHTHOUSE && vis(W.LIGHTHOUSE.x, W.LIGHTHOUSE.y, 320)) {
      const L = W.LIGHTHOUSE, [gx, gy, gw, gh] = L.glass; R(ctx, gx - camX, gy - camY, gw, gh, PAL.lamp[3]);
      const ang = -1.2 + (reduce ? .6 : (Math.sin(t / 220) + 1) * .9), len = 60 + 240 * DV.beam, ox = L.x - camX, oy = L.y - camY;
      ctx.save();
      [[.11, .1], [.05, .18]].forEach(([half, alpha]) => { ctx.globalAlpha = alpha; fillPoly(ctx, [[ox, oy], [ox + Math.cos(ang - half) * len, oy + Math.sin(ang - half) * len], [ox + Math.cos(ang + half) * len, oy + Math.sin(ang + half) * len]], PAL.lamp[3]); });
      ctx.restore();
    }
    W.CRYSTALS.forEach(([cx, cy], i) => { if (!vis(cx, cy)) return; const on = ((anim >> 3) + i) % 4 !== 0; R(ctx, cx - camX - 1, cy - camY - 2, 2, 4, on ? '#9be8ff' : '#5fb3d9'); P(ctx, cx - camX, cy - camY - 3, '#ffffff'); });
    if (W.CAMPFIRE && vis(W.CAMPFIRE.x, W.CAMPFIRE.y)) { const cx = W.CAMPFIRE.x - camX, cy = W.CAMPFIRE.y - camY, fl = (anim >> 2) % 3; R(ctx, cx - 2, cy - 1, 5, 3, PAL.lamp[1]); R(ctx, cx - 1, cy - 3 - fl, 3, 3, PAL.lamp[2]); P(ctx, cx, cy - 4 - fl, PAL.lamp[3]); }
    critters.forEach(c => { if (c.kind === 'fox' && !c.hidden && vis(c.x, c.y)) { const ex = Math.round(c.x - camX) + (c.flip ? -7 : 7), ey = Math.round(c.y - camY) - 6; P(ctx, ex, ey, '#ffe08a'); P(ctx, ex + (c.flip ? -1 : 1), ey, '#fff6e0'); } });
    if (ph === 'night') [[20, 40], [26, 48], [14, 46], [41, 43], [62, 58], [68, 22], [90, 30], [36, 30]].forEach(([fx, fy], i) => {
      if (((anim >> 3) + i) % 5 === 0) return;
      const x = Math.round(fx * TILE + Math.sin(anim / 50 + i * 1.7) * 18) - camX, y = Math.round(fy * TILE + Math.cos(anim / 43 + i) * 10) - camY;
      P(ctx, x, y, PAL.lamp[3]); if (((anim >> 2) + i) % 3 === 0) { P(ctx, x - 1, y, PAL.lamp[2]); P(ctx, x + 1, y, PAL.lamp[2]); }
    });
  }
  // needs-you: signal smoke above the roof and a bubble over the bot
  Object.keys(DV.pending).forEach(h => {
    const [hx, hy] = housePoint(h);
    if (vis(hx, hy, 120)) for (let k = 0; k < 9; k++) {
      const f = ((anim * .5 + k * 14) % 126) / 126, x = Math.round(hx + Math.sin(f * 6 + k) * 4) - camX, y = Math.round(hy - 6 - f * 90) - camY, sz = 3 + Math.round(f * 3);
      R(ctx, x, y, sz, sz, k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? '#ff8fa0' : '#d8485f');
    }
    if (!W.BOTS[h]) return; const bp = botPos(h), bx = Math.round(bp.x) + 8 - camX, by = Math.round(bp.y) - 28 - camY + (reduce ? 0 : Math.round(Math.sin(t / 12)));
    if (bx < -10 || by < -20 || bx > VWW + 10 || by > VWH) return;
    R(ctx, bx - 5, by, 11, 12, PAL.steel[0]); R(ctx, bx - 4, by + 1, 9, 10, '#fffaf0'); R(ctx, bx - 1, by + 2, 3, 5, '#d8485f'); R(ctx, bx - 1, by + 8, 3, 2, '#d8485f'); R(ctx, bx - 1, by + 12, 3, 2, PAL.steel[0]);
  });
  const sh = $('#shout');
  if (shout && W.BOTS.crier && !uiOpen()) { const a = W.BOTS.crier, x = a[0] * TILE + 8 - camX, y = a[1] * TILE - 20 - camY; if (x > 0 && x < VWW && y > 0 && y < VWH) { if (sh.textContent !== shout.text) sh.textContent = shout.text; sh.style.left = (x / VWW * 100) + '%'; sh.style.top = (y / VWH * 100) + '%'; sh.hidden = false; } else sh.hidden = true; } else sh.hidden = true;
  // a sealed letter over bots whose approved drafts haven't gone out yet
  Object.keys(DV.unsent).forEach(h => {
    if ((DV.pending[h] || []).length || !W.BOTS[h]) return;
    const bp = botPos(h), x = Math.round(bp.x) + 8 - camX, y = Math.round(bp.y) - 26 - camY + (reduce ? 0 : Math.round(Math.sin(t / 14)));
    if (x < -10 || y < -20 || x > VWW + 10 || y > VWH) return;
    R(ctx, x - 6, y, 13, 9, PAL.steel[0]); R(ctx, x - 5, y + 1, 11, 7, '#fff6e0'); line(ctx, x - 5, y + 1, x, y + 5, PAL.plaster[2]); line(ctx, x + 5, y + 1, x, y + 5, PAL.plaster[2]); R(ctx, x - 1, y + 4, 3, 3, '#d8485f');
  });
  drawParts(true);
  if (flash > .05) { ctx.save(); ctx.globalAlpha = Math.min(.6, flash * .55); ctx.fillStyle = '#f4f8fd'; ctx.fillRect(0, 0, VWW, VWH); ctx.restore(); }
  vignette();
  if (fade > 0) iris(fade, Math.round(ppx - camX) + 8, Math.round(ppy - camY) + 2);
}

/* ---------- HUD, arrow, minimap ---------- */
let placeName = '', arrivedByTravel = false;
function regionName() {
  if (room) return HOUSE_META[room.id].name;
  let best = null; W.REGIONS.forEach(([name, x, y, r]) => { const d = Math.hypot(player.x - x, (player.y - y) * 1.3); if (d <= r && (!best || r < best.r)) best = { name, r }; });
  return best ? best.name : 'Covenant Isle';
}
function updateHud() {
  const need = Object.keys(DV.pending).length, total = Object.values(DV.pending).reduce((n, a) => n + a.length, 0);
  const toSend = Object.values(DV.unsent).reduce((n, a) => n + a.length, 0);
  const short = document.body.classList.contains('full');
  const btn = $('#needBtn'); btn.textContent = (need ? (short ? `${total} waiting` : `${total} waiting · ${need} houses`) : 'All clear') + (toSend ? ` · ${toSend} to send` : ''); btn.classList.toggle('alert', need > 0 || toSend > 0);
  $('#acctBtn').textContent = mode === 'live' ? (userEmail || 'Signed in') : mode === 'sample' ? 'Sample village' : 'Sign in';
  $('#timeBtn').textContent = { auto: 'Time: live', day: 'Time: day', dusk: 'Time: dusk', night: 'Time: night' }[timeMode];
  $('#wxBtn').textContent = weatherMode === 'live' ? `Weather: live · ${liveWx.kind}` : `Weather: ${weatherMode}`;
}
function updateOverlay() {
  pad.classList.toggle('dim', uiOpen()); aBtn.classList.toggle('dim', uiOpen());
  const n = regionName();
  if (n !== placeName) {
    placeName = n; $('#place').textContent = n;
    const seen = new Set(store.get('regions', []));
    if (n !== 'Covenant Isle' && (!seen.has(n) || arrivedByTravel)) { if (!seen.has(n)) { seen.add(n); store.set('regions', [...seen]); } showBanner(n); }
    arrivedByTravel = false;
  }
  const h = hintFor(), hint = $('#hint');
  if (h) { hint.textContent = h; hint.hidden = false; } else hint.hidden = true;
  // arrow to the nearest house that needs you, when it's off screen
  const arrow = $('#arrow'); let best = null;
  if (room) { arrow.hidden = true; return; }
  (Object.keys(DV.pending).length ? Object.keys(DV.pending) : Object.keys(DV.unsent)).forEach(id => { const b = W.BOTS[id]; if (!b) return; const d = Math.hypot(b[0] - player.x, b[1] - player.y); if (!best || d < best.d) best = { id, d, b }; });
  if (best) {
    const tx = best.b[0] * TILE + 8 - camX, ty = best.b[1] * TILE - camY;
    if (tx < 0 || ty < 0 || tx > VWW || ty > VWH) {
      const cx = VWW / 2, cy = VWH / 2, ang = Math.atan2(ty - cy, tx - cx), s = Math.min((VWW / 2 - 14) / Math.abs(Math.cos(ang) || 1e-6), (VWH / 2 - 14) / Math.abs(Math.sin(ang) || 1e-6));
      arrow.style.left = ((cx + Math.cos(ang) * s) / VWW * 100) + '%'; arrow.style.top = ((cy + Math.sin(ang) * s) / VWH * 100) + '%';
      arrow.style.setProperty('--rot', ang + 'rad'); arrow.dataset.house = best.id; arrow.title = `${HOUSE_META[best.id].name}: ${(DV.pending[best.id] || []).length} waiting`; arrow.setAttribute('aria-label', arrow.title); arrow.hidden = false;
    } else arrow.hidden = true;
  } else arrow.hidden = true;
}
const miniEl = $('#mini'), mctx = miniEl.getContext('2d', { willReadFrequently: true }); miniEl.width = MW * 2; miniEl.height = MH * 2; mctx.imageSmoothingEnabled = false;
function drawMini() {
  if (miniEl.hidden || room) return;
  mctx.drawImage(W.mini, 0, 0, MW * 2, MH * 2);
  Object.values(W.PLACES).forEach(p => { mctx.fillStyle = visited.has(p.id) ? '#ffe08a' : '#8b8193'; mctx.fillRect(p.sign[0] * 2 - 1, p.sign[1] * 2 - 1, 3, 3); });
  DV.tents.forEach(tn => { mctx.fillStyle = tn.ramp[4]; mctx.fillRect(tn.x * 2, tn.y * 2, 6, 4); });
  Object.entries(W.BOTS).forEach(([h, [x, y]]) => { const p = (DV.pending[h] || []).length; mctx.fillStyle = p ? ((t >> 4) % 2 ? '#ff8fa0' : '#d8485f') : HOUSE_META[h].accent; mctx.fillRect(x * 2 - 2, y * 2 - 2, 5, 5); });
  mctx.fillStyle = '#ffffff'; mctx.fillRect(player.x * 2 - 2, player.y * 2 - 2, 5, 5); mctx.fillStyle = '#121626'; mctx.fillRect(player.x * 2 - 1, player.y * 2 - 1, 3, 3);
  mctx.strokeStyle = 'rgba(255,255,255,.6)'; mctx.lineWidth = 1; mctx.strokeRect(camX / TILE * 2 + .5, camY / TILE * 2 + .5, VWW / TILE * 2, VWH / TILE * 2);
}

/* ---------- panels ---------- */
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat(9).filter(k => k != null && k !== false).map(k => typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k));
  return e;
}
const panel = $('#panel');
let current = null;
function openPanel(view) { current = view; rerender(); panel.hidden = false; panel.scrollTop = 0; $('#pClose').focus({ preventScroll: true }); }
function rerender() {
  if (!current) return;
  const v = current.build();
  $('#pEyebrow').textContent = v.eyebrow || ''; $('#pTitle').textContent = v.title; $('#pSub').textContent = v.sub || '';
  $('#pBody').replaceChildren(...v.body);
}
function closePanel() { panel.hidden = true; current = null; }
const uiOpen = () => !panel.hidden || !$('#modal').hidden;
function openModal(kids) { $('#modalCard').replaceChildren(...kids); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }

const fmt = n => (+n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
function ago(iso) {
  if (!iso) return ''; const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; if (s < 86400 * 14) return Math.round(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const statusOf = id => (DV.pending[id] || []).length ? 'needs' : (D.houses[id] && D.houses[id].status) || 'idle';
const chip = (txt, cls) => el('span', { class: 'chip ' + (cls || '') }, txt);
const STATUS_CHIP = { needs: ['Needs you', 'warn'], working: ['Working', 'good'], idle: ['Idle', ''], error: ['Error', 'bad'] };
function section(title, kids) { return el('section', { class: 'sec' }, el('h3', {}, title), kids); }
function linkish(target) { return /^https?:\/\//.test(target || '') ? el('a', { href: target, target: '_blank', rel: 'noopener' }, target.replace(/^https?:\/\//, '').slice(0, 60)) : target; }
async function copy(text) { try { await navigator.clipboard.writeText(text || ''); toast('Copied'); } catch { toast('Couldn\'t copy here. Select the text instead.'); } }

function draftCard(a, decided) {
  const text = a.draft || '', long = text.length > 700;
  const body = el('div', { class: 'draft-text' + (long ? ' clip' : '') }, text);
  const fb = el('textarea', { id: 'fb-' + a.id, rows: 3, placeholder: 'What should change?', 'aria-label': 'Feedback for ' + a.title });
  const fbWrap = el('div', { class: 'fb', hidden: true }, fb, el('button', { class: 'btn warn', type: 'button', onclick: () => decide(a, 'sent_back', fb.value.trim()) }, 'Send back'));
  return el('article', { class: 'draft' },
    el('div', { class: 'draft-head' }, el('span', { class: 'kind' }, KIND[a.kind] || a.kind), el('span', { class: 'muted' }, ago(a.created_at))),
    el('h4', {}, a.title),
    a.meta && el('p', { class: 'muted small' }, a.meta),
    a.target && el('p', { class: 'muted small' }, 'For: ', linkish(a.target)),
    body,
    long && el('button', { class: 'link', type: 'button', onclick: e => { body.classList.toggle('clip'); e.target.textContent = body.classList.contains('clip') ? 'Show all' : 'Show less'; } }, 'Show all'),
    decided ? el('p', { class: 'muted small' }, (a.status === 'approved' ? (a.kind === 'lesson' ? 'In force since ' : 'Approved ') : 'Sent back ') + ago(a.decided_at), a.feedback ? ` · “${a.feedback}”` : '') : null,
    decided && a.status === 'approved' && shippable(a) ? shipRow(a) : null,
    decided ? null
      : el('div', { class: 'actions' },
        el('button', { class: 'btn ok', type: 'button', onclick: () => decide(a, 'approved') }, 'Approve'),
        el('button', { class: 'btn', type: 'button', onclick: () => { fbWrap.hidden = !fbWrap.hidden; if (!fbWrap.hidden) fb.focus(); } }, 'Send back…'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => copy(text) }, 'Copy text')),
    !decided && fbWrap);
}
function shipRow(a) {
  const [verb, done] = SHIP_VERB(a);
  if (a.shipped_at) return el('p', { class: 'shipped small' }, `${done} ${ago(a.shipped_at)}`, a.shipped_url ? [' · ', linkish(a.shipped_url)] : null);
  const url = /^x_/.test(a.kind) ? el('input', { type: 'url', class: 'ship-url', placeholder: 'Link to the post (optional)', 'aria-label': 'Link to the live post' }) : null;
  return el('div', { class: 'ship' }, el('span', { class: 'chip warn' }, 'Not ' + done.toLowerCase() + ' yet'), url,
    el('button', { class: 'btn ok tiny', type: 'button', onclick: () => markShipped(a, url && url.value.trim()) }, verb),
    el('button', { class: 'btn ghost tiny', type: 'button', onclick: () => copy(a.draft) }, 'Copy text'));
}
function goalCard(g) {
  const start = +g.start_value || 0, cur = +g.current_value || 0, tgt = +g.target_value || 1, pct = clamp((cur - start) / Math.max(1e-9, tgt - start), 0, 1);
  const sets = D.sets.filter(s => s.goal_id === g.id);
  return el('div', { class: 'goal' },
    el('div', { class: 'goal-head' }, el('strong', {}, g.title), g.behind && chip('Behind', 'warn')),
    el('div', { class: 'bar', role: 'img', 'aria-label': `${fmt(cur)} of ${fmt(tgt)} ${g.unit}` }, el('span', { style: `width:${(pct * 100).toFixed(1)}%` })),
    el('p', { class: 'muted small' }, `${fmt(cur)} / ${fmt(tgt)} ${g.unit} · ${g.deadline_label || ''}`, (wc => wc ? ` · ${wc.delta != null ? (wc.delta >= 0 ? '+' : '') + fmt(wc.delta) + ' this week · ' : ''}last reading ${ago(wc.last.at)}` : '')(weekChange(g))),
    g.pace_note && el('p', { class: 'small' }, g.pace_note),
    (g.phases || []).length > 0 && el('div', { class: 'chips' }, (g.phases || []).map(p => el('span', { class: 'ph' + (p.now ? ' now' : ''), title: p.focus || '' }, p.name))),
    sets.length > 0 && el('ul', { class: 'sets' }, sets.map(s => el('li', {},
      el('span', {}, s.name), el('span', { class: 'n' }, `${s.done}/${s.weekly_target}`),
      el('button', { class: 'btn tiny', type: 'button', 'aria-label': `Log one: ${s.name}`, onclick: () => logSet(s) }, '+1'),
      el('div', { class: 'bar thin' }, el('span', { style: `width:${clamp(s.done / Math.max(1, s.weekly_target), 0, 1) * 100}%` }))))));
}
function houseView(id) {
  return { build: () => {
    const m = HOUSE_META[id], h = D.houses[id] || {}, pend = DV.pending[id] || [], st = STATUS_CHIP[statusOf(id)] || STATUS_CHIP.idle;
    const decided = D.approvals.filter(a => a.house_id === id && a.status !== 'pending' && a.kind !== 'lesson' && !(a.status === 'approved' && !a.shipped_at && shippable(a))).slice(0, 4);
    const body = [
      el('div', { class: 'meta-row' }, chip(st[0], st[1]), el('span', { class: 'muted small' }, `${h.brain_provider === 'xai' ? 'Grok' : 'Claude'} · ${h.brain_model || ''}`), h.last_run_at && el('span', { class: 'muted small' }, 'Last run ' + ago(h.last_run_at))),
      h.current_task && el('p', { class: 'task' }, h.current_task),
      section(`Waiting for you (${pend.length})`, pend.length ? pend.map(a => draftCard(a)) : [el('p', { class: 'muted' }, 'Nothing waiting.')]),
    ];
    const unsent = DV.unsent[id] || [];
    if (unsent.length) body.push(section(`Approved, not ${unsent.every(a => /^x_/.test(a.kind)) ? 'posted' : 'sent'} yet (${unsent.length})`, unsent.map(a => draftCard(a, true))));
    const rules = DV.rules[id] || [];
    if (rules.length) body.push(section(`Lessons it follows (${rules.length})`, el('ul', { class: 'log' }, rules.map(a => el('li', {}, el('span', { class: 't' }, ago(a.decided_at)), el('span', {}, a.draft))))));
    if (id === 'crier') body.push(section('Reply radar', D.radar.length ? D.radar.slice(0, 10).map(r => el('div', { class: 'radar' },
      el('div', { class: 'draft-head' }, chip(r.fit, r.fit === 'high' ? 'good' : r.fit === 'medium' ? '' : 'dim'), el('span', { class: 'muted small' }, `@${r.author_handle || '?'} · ${fmt(r.author_followers)} followers · ${r.source}`)),
      el('p', {}, r.post_text), el('p', { class: 'muted small' }, r.why), r.post_url && el('p', { class: 'small' }, linkish(r.post_url)))) : [el('p', { class: 'muted' }, 'Nothing on the radar yet.')]));
    if (id === 'well') body.push(section('Long shots', D.wild.length ? D.wild.slice(0, 10).map(w => el('div', { class: 'radar' },
      el('div', { class: 'draft-head' }, el('strong', {}, w.person), w.status !== 'new' && chip(w.status, w.status === 'saved' ? 'good' : 'dim')),
      w.role && el('p', { class: 'muted small' }, w.role), el('p', {}, w.why), el('p', { class: 'small' }, 'Route: ', w.route), w.draft && el('div', { class: 'draft-text' }, w.draft),
      w.status === 'new' && el('div', { class: 'actions' }, el('button', { class: 'btn ok', type: 'button', onclick: () => saveWild(w, 'saved') }, 'Save'), el('button', { class: 'btn ghost', type: 'button', onclick: () => saveWild(w, 'dismissed') }, 'Dismiss')))) : [el('p', { class: 'muted' }, 'No long shots yet. Toss a coin on Friday.')]));
    if (id === 'dojo') body.push(section('Firms on the mountain', DV.firms.length ? el('ul', { class: 'firms' }, DV.firms.map(f => el('li', {},
      el('div', {}, el('strong', {}, f.name), el('span', { class: 'muted small' }, ` · ${f.status}`), f.seat && el('p', { class: 'muted small' }, f.seat)),
      el('button', { class: 'btn tiny', type: 'button', onclick: () => openFirm(f.name) }, CAMP_LABEL[f.camp])))) : [el('p', { class: 'muted' }, 'No status lines from the Dojo yet. They appear after its next run.')]));
    if (id === 'tailor') body.push(el('p', { class: 'muted small' }, DV.feedTailor ? 'Notes are coming down the mountain from the Dojo.' : 'No new notes from the Dojo in the last 14 days.'));
    if (id === 'crier') body.push(el('p', { class: 'muted small' }, DV.feedCrier ? 'The rail cart is bringing an approved issue from the Print Shop.' : 'No approved issue from the Print Shop this week.'));
    const goals = DV.goals[id] || []; if (goals.length) body.push(section('Training plan', goals.map(goalCard)));
    if (decided.length) body.push(section('Your recent decisions', decided.map(a => draftCard(a, true))));
    const acts = D.activity.filter(a => a.house_id === id).slice(0, 14);
    body.push(section('Recent work', acts.length ? el('ul', { class: 'log' }, acts.map(a => el('li', {}, el('span', { class: 't' }, ago(a.at)), el('span', {}, a.text)))) : [el('p', { class: 'muted' }, 'No activity in the last two weeks.')]));
    return { eyebrow: (h.bot || m.bot).toUpperCase(), title: h.name || m.name, sub: h.role || '', body };
  } };
}
function openHouse(id) { openPanel(houseView(id)); }
function firmTokens(name) { return name.split('/').map(s => s.trim().split(/\s+/)[0].toLowerCase()).filter(w => w.length > 2); }
function openFirm(name) {
  openPanel({ build: () => {
    const f = DV.firms.find(x => x.name === name);
    if (!f) return { title: name, body: [el('p', { class: 'muted' }, 'This firm no longer has a status line.')] };
    const toks = firmTokens(f.name);
    const drafts = D.approvals.filter(a => (a.house_id === 'dojo' || a.house_id === 'tailor') && toks.some(tk => a.title.toLowerCase().includes(tk)));
    const pend = drafts.filter(a => a.status === 'pending'), done = drafts.filter(a => a.status !== 'pending').slice(0, 4);
    const lessons = DV.lessons[f.name] || [];
    return {
      eyebrow: CAMP_LABEL[f.camp].toUpperCase(), title: f.name, sub: `Status: ${f.status} · updated ${ago(f.at)}`,
      body: [
        f.seats.length > 0 && section(f.seats.length > 1 ? `Seats in play (${f.seats.length})` : 'Seat', el('ul', { class: 'pennants' }, f.seats.map(s => el('li', {}, s)))),
        el('dl', { class: 'facts' }, f.who && [el('dt', {}, 'People'), el('dd', {}, f.who)], f.next && [el('dt', {}, 'Next touch'), el('dd', {}, f.next)]),
        f.camp !== 'summit' && el('p', { class: 'muted small' }, f.camp === 'foothills' ? 'In the foothills: a relationship to keep warm.' : f.camp === 'convert' ? 'At Convert Camp: turning interest into a role conversation.' : 'At Define Camp: mandate, reporting line and economics being written down.'),
        section(`Waiting for you (${pend.length})`, pend.length ? pend.map(a => draftCard(a)) : [el('p', { class: 'muted' }, 'No memos or resumes waiting for this firm.')]),
        lessons.length > 0 && section('Lessons so far', el('ul', { class: 'log' }, lessons.map(l => el('li', {}, el('span', { class: 't' }, ago(l.at)), el('span', {}, l.text))))),
        done.length > 0 && section('Earlier', done.map(a => draftCard(a, true))),
      ],
    };
  } });
}
function openBoard() {
  openPanel({ build: () => ({
    eyebrow: 'TOWN BOARD', title: 'The village', sub: mode === 'sample' ? 'Sample data' : (loadedAt ? 'Updated ' + ago(new Date(loadedAt).toISOString()) : ''),
    body: [
      el('ul', { class: 'houses' }, ORDER.map(id => {
        const m = HOUSE_META[id], h = D.houses[id] || {}, st = STATUS_CHIP[statusOf(id)] || STATUS_CHIP.idle, n = (DV.pending[id] || []).length;
        return el('li', {}, el('span', { class: 'sw', style: `background:${m.accent}` }),
          el('div', { class: 'grow' }, el('strong', {}, h.name || m.name), el('span', { class: 'muted small' }, ` · ${h.bot || m.bot}`), h.current_task && el('p', { class: 'muted small' }, h.current_task)),
          el('div', { class: 'side' }, chip(n ? `${n} waiting` : st[0], n ? 'warn' : st[1]), el('div', { class: 'row' }, el('button', { class: 'btn tiny', type: 'button', onclick: () => openHouse(id) }, 'Open'), el('button', { class: 'btn tiny ghost', type: 'button', onclick: () => goToHouse(id) }, 'Go'))));
      })),
      (() => { const all = Object.values(DV.unsent).flat().sort((a, z) => Date.parse(a.decided_at) - Date.parse(z.decided_at)); return all.length ? section(`Approved, not sent yet (${all.length})`, all.map(a => el('div', { class: 'unsent' }, el('p', { class: 'muted small' }, `${HOUSE_META[a.house_id].name} · approved ${ago(a.decided_at)}`), draftCard(a, true)))) : null; })(),
      section('This week\'s numbers', [el('p', { class: 'muted small' }, 'Real counts keep the pace honest. The Crier reads your X followers when it can; the rest come from you.'),
        el('ul', { class: 'numbers' }, D.goals.map(g => {
          const wc = weekChange(g), due = !wc || Date.now() - Date.parse(wc.last.at) > 7 * 864e5, inp = el('input', { type: 'text', inputmode: 'decimal', class: 'num', placeholder: fmt(g.current_value), 'aria-label': `New reading: ${g.title}` });
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') recordReading(g, inp.value); });
          return el('li', {}, el('div', { class: 'grow' }, el('strong', {}, g.title), el('p', { class: 'muted small' }, `${fmt(g.current_value)} ${g.unit}${wc ? ' · last reading ' + ago(wc.last.at) : ' · no readings yet'}`)),
            due && chip('Due', 'warn'), inp, el('button', { class: 'btn tiny', type: 'button', onclick: () => recordReading(g, inp.value) }, 'Save'));
        }))]),
      section('Goals', D.goals.map(goalCard)),
      el('p', { class: 'muted small' }, `Discoveries found: ${new Set(store.get('found', [])).size} of ${Object.keys(DISCOVERIES).length}. Explore the south of the island.`),
      el('div', { class: 'actions' }, mode === 'live' && el('button', { class: 'btn', type: 'button', onclick: () => refresh() }, 'Refresh now')),
    ],
  }) });
}
function openTravel(here) {
  openPanel({ build: () => ({
    eyebrow: 'FAST TRAVEL', title: here ? W.PLACES[here].name : 'Travel', sub: 'Signposts you\'ve reached. Walk to a new one to add it.',
    body: [
      el('ul', { class: 'places' }, Object.values(W.PLACES).map(p => el('li', {},
        el('span', {}, p.name),
        p.id === here ? el('span', { class: 'muted small' }, 'You are here')
          : visited.has(p.id) ? el('button', { class: 'btn tiny', type: 'button', onclick: () => travel(p.arrive) }, 'Go') : el('span', { class: 'muted small' }, 'Walk here first')))),
      section('Shortcuts', el('ul', { class: 'log' },
        el('li', {}, el('span', { class: 't' }, DV.gondola ? 'Open' : 'Locked'), el('span', {}, 'Gondola: Base Camp ⇄ Convert Camp. Opens when a firm reaches Convert Camp.')),
        el('li', {}, el('span', { class: 't' }, DV.zip ? 'Open' : 'Locked'), el('span', {}, 'Zip line: Define Camp → Town Square. Opens when a firm reaches Define Camp.')))),
    ],
  }) });
}
function say(text) { toast(text, 3200); }
let toastTimer = 0;
function toast(msg, ms = 2200) { const tEl = $('#toast'); tEl.textContent = msg; tEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { tEl.hidden = true; }, ms); }

/* ---------- sign-in ---------- */
function signInView(err) {
  const cfg = window.VILLAGE_CONFIG || {};
  const ready = cfg.supabaseUrl && cfg.anonKey && window.supabase;
  const email = el('input', { id: 'si-email', type: 'email', autocomplete: 'username', placeholder: 'Email', 'aria-label': 'Email', value: store.get('email', '') });
  const pass = el('input', { id: 'si-pass', type: 'password', autocomplete: 'current-password', placeholder: 'Password', 'aria-label': 'Password' });
  const msg = el('p', { class: 'err', role: 'alert' }, err || '');
  const go = async () => {
    msg.textContent = 'Signing in…';
    const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    if (error) { msg.textContent = error.message; return; }
    store.set('email', email.value.trim()); pass.value = '';
    await startLive(data.session);
  };
  [email, pass].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
  openModal([
    el('p', { class: 'eyebrow' }, 'COVENANT ISLE'), el('h2', {}, 'Sign in to your village'),
    ready ? el('div', { class: 'stack' }, email, pass, msg, el('button', { class: 'btn ok', type: 'button', onclick: go }, 'Sign in'))
      : el('p', { class: 'muted' }, 'This page has no Supabase settings yet. Run node scripts/make-village-config.mjs in the bot-village folder, then reload.'),
    el('p', { class: 'muted small' }, 'Only the village owner can see anything. Your PIN is asked for separately, when you approve something.'),
    el('button', { class: 'btn ghost', type: 'button', onclick: startSample }, 'Explore the sample village'),
  ]);
  setTimeout(() => (ready ? (email.value ? pass : email) : null)?.focus(), 30);
}
async function startLive(session) {
  mode = 'live'; userEmail = session && session.user ? session.user.email : null; closeModal(); updateHud();
  try { await loadLive(); } catch (e) { mode = null; signInView(e.message); return; }
  clearInterval(refreshTimer); refreshTimer = setInterval(() => { if (!document.hidden) refresh(true); }, 60000);
}
function startSample() { mode = 'sample'; closeModal(); setData(window.SAMPLE_DATA()); toast('Sample village. Nothing here is real.'); }
function accountMenu() {
  openModal([
    el('h2', {}, mode === 'live' ? (userEmail || 'Signed in') : 'Sample village'),
    mode === 'live' && el('p', { class: 'muted small' }, 'Updated ' + ago(new Date(loadedAt).toISOString())),
    el('div', { class: 'stack' },
      mode === 'live' && el('button', { class: 'btn', type: 'button', onclick: () => { closeModal(); refresh(); } }, 'Refresh now'),
      mode === 'live' && el('button', { class: 'btn ghost', type: 'button', onclick: async () => { await sb.auth.signOut(); pin = null; mode = null; clearInterval(refreshTimer); setData({ houses: {}, goals: [], sets: [], approvals: [], activity: [], radar: [], wild: [], readings: [] }); signInView(); } }, 'Sign out'),
      mode !== 'live' && el('button', { class: 'btn ok', type: 'button', onclick: () => signInView() }, 'Sign in to your village'),
      el('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Close')),
  ]);
}

/* ---------- phones can wipe images that were drawn once (after the tab sleeps, or when memory runs low) ---------- */
// keep a PNG of each one, and paint it back if its pixels come back empty
const snaps = new Map();
function snap(c) { try { c.toBlob(b => { if (b) snaps.set(c, b); }); } catch { /* no copy kept */ } }
const wiped = (c, x, y) => { try { return c.getContext('2d').getImageData(x, y, 1, 1).data[3] === 0; } catch { return false; } };
async function repaint(c) { const b = snaps.get(c); if (!b) return; const img = await createImageBitmap(b), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0); if (img.close) img.close(); }
let healing = false;
async function heal() {
  if (healing) return; healing = true;
  try {
    const jobs = [];
    if (wiped(W.canvas, 1, 1)) jobs.push(W.canvas, W.upper);
    if (wiped(W.mini, 0, 0)) jobs.push(W.mini);
    [[cloudShape, 110, 40], [puffShape, 130, 50], [fogShape, 150, 40]].forEach(([c, x, y]) => { if (wiped(c, x, y)) jobs.push(c); });
    Object.values(rooms).forEach(r => { if (r && wiped(r.canvas, 1, 1)) jobs.push(r.canvas); });
    await Promise.all(jobs.map(c => repaint(c).catch(() => {})));
  } finally { healing = false; }
}

/* ---------- phones: the game fills the screen and the view widens to match it ---------- */
const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 600;
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
function fitView() {
  const full = isPhone(); document.body.classList.toggle('full', full);
  const w = full && innerWidth > innerHeight ? clamp(Math.round(VWH * innerWidth / innerHeight / 2) * 2, 360, 640) : 480;
  if (w !== VWW) { VWW = w; cv.width = VWW; ctx.imageSmoothingEnabled = false; lvlBuf = new Uint8Array(VWW * VWH); camFX = null; }
  $('.screen').style.aspectRatio = full ? '' : `${VWW} / ${VWH}`;
  updateHud();
}

/* ---------- settings menu ---------- */
const setEl = $('#settings'), setBtn = $('#setBtn');
function toggleSettings(open = setEl.hidden) { setEl.hidden = !open; setBtn.setAttribute('aria-expanded', String(open)); }
const fsRoot = document.documentElement, canFull = !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen);
async function toggleFull() {
  toggleSettings(false);
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { await (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }
  } catch { toast('Full screen isn\'t available in this browser.'); }
}

/* ---------- touch screens: a see-through d-pad and an A button ---------- */
const touchUI = matchMedia('(pointer: coarse)').matches;
const pad = $('#pad'), aBtn = $('#aBtn');
let padDir = null, padActive = false;
function interact() {
  if (uiOpen() || fadeDir) return;
  const v = DV2[player.dir]; let o = objAt(player.x + v[0], player.y + v[1]);
  if (!o) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { o = objAt(player.x + dx, player.y + dy); if (o) { face(player.x + dx, player.y + dy); break; } }
  if (o) act(o); else if (touchUI) toast('Nothing here to use. Walk up to a bot, a door or a sign.');
}
// the thumb can slide between directions without lifting
function setPadDir(d) {
  if (d === padDir) return;
  if (padDir) { const i = keys.indexOf(padDir); if (i >= 0) keys.splice(i, 1); }
  padDir = d; if (d && !keys.includes(d)) keys.push(d);
  pad.querySelectorAll('[data-dir]').forEach(el2 => el2.classList.toggle('on', el2.dataset.dir === d));
}
function padAt(e) {
  const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  if (Math.hypot(dx, dy) < r.width * .12) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
function showPad() {
  const on = touchUI && store.get('pad', true);
  pad.hidden = aBtn.hidden = !on;
  $('#padBtn').hidden = !touchUI; $('#padBtn').textContent = `D-pad: ${on ? 'on' : 'off'}`;
}

/* ---------- input ---------- */
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
function dismissTop() {
  const tEl = $('#toast');
  if (!setEl.hidden) { toggleSettings(false); return true; }
  if (!$('#modal').hidden) { if (mode) closeModal(); return true; }
  if (!panel.hidden) { closePanel(); return true; }
  if (!tEl.hidden) { tEl.hidden = true; clearTimeout(toastTimer); return true; }
  return false;
}
addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); if (typing(e) && e.target.value) { e.target.blur(); return; } dismissTop(); return; }
  if (typing(e)) return;
  if (uiOpen()) return;
  const d = KEYMAP[e.code];
  if (d) { e.preventDefault(); if (!keys.includes(d)) keys.push(d); return; }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); interact(); }
  if (e.code === 'KeyM') toggleMini();
  if (e.code === 'KeyT') openTravel(null);
  if (e.code === 'KeyB') openBoard();
});
addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) { const i = keys.indexOf(d); if (i >= 0) keys.splice(i, 1); } });
addEventListener('blur', () => { keys.length = 0; });
cv.addEventListener('pointerdown', e => {
  if (uiOpen() || fadeDir) return;
  const r = cv.getBoundingClientRect(), sc = Math.min(r.width / VWW, r.height / VWH), ox = (r.width - VWW * sc) / 2, oy = (r.height - VWH * sc) / 2;
  const x = Math.floor(((e.clientX - r.left - ox) / sc + camX) / TILE), y = Math.floor(((e.clientY - r.top - oy) / sc + camY) / TILE);
  goTo(x, y);
});
miniEl.addEventListener('pointerdown', e => { if (room) return; const r = miniEl.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * MW), y = Math.floor((e.clientY - r.top) / r.height * MH); const [fx, fy] = walk(x, y) || objAt(x, y) ? [x, y] : nearestFree(x, y); goTo(fx, fy); });
function toggleMini() { miniEl.hidden = !miniEl.hidden; $('#mapBtn').setAttribute('aria-pressed', String(!miniEl.hidden)); store.set('mini', !miniEl.hidden); }
$('#mapBtn').addEventListener('click', toggleMini);
pad.addEventListener('pointerdown', e => { e.preventDefault(); padActive = true; try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } setPadDir(padAt(e)); });
pad.addEventListener('pointermove', e => { if (padActive) setPadDir(padAt(e)); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => pad.addEventListener(n, () => { padActive = false; setPadDir(null); }));
aBtn.addEventListener('pointerdown', e => { e.preventDefault(); aBtn.classList.add('on'); interact(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(n => aBtn.addEventListener(n, () => aBtn.classList.remove('on')));
$('#padBtn').addEventListener('click', () => { store.set('pad', !store.get('pad', true)); showPad(); });
// a long press on the game shouldn't select text or pop up the "save image" menu
$('.screen').addEventListener('contextmenu', e => e.preventDefault());
showPad();
setBtn.addEventListener('click', e => { e.stopPropagation(); toggleSettings(); });
document.addEventListener('pointerdown', e => { if (!setEl.hidden && !setEl.contains(e.target) && !setBtn.contains(e.target)) toggleSettings(false); });
$('#fullBtn').hidden = !canFull;
$('#fullBtn').addEventListener('click', toggleFull);
$('#homeNote').hidden = canFull || standalone() || !/iPhone|iPod/.test(navigator.userAgent);
$('#travelBtn').addEventListener('click', () => openTravel(null));
$('#needBtn').addEventListener('click', openBoard);
$('#acctBtn').addEventListener('click', () => { toggleSettings(false); accountMenu(); });
$('#timeBtn').addEventListener('click', () => { const order = ['auto', 'day', 'dusk', 'night']; timeMode = order[(order.indexOf(timeMode) + 1) % order.length]; store.set('time', timeMode); updateHud(); });
$('#pClose').addEventListener('click', closePanel);
$('#wxBtn').addEventListener('click', () => { const order = ['live', 'clear', 'rain', 'storm', 'fog', 'snow']; weatherMode = order[(order.indexOf(weatherMode) + 1) % order.length]; store.set('weather', weatherMode); updateHud(); });
fetchWeather(); setInterval(fetchWeather, 20 * 60 * 1000);
$('#toast').addEventListener('click', () => { $('#toast').hidden = true; });
$('#arrow').addEventListener('click', e => goToHouse(e.currentTarget.dataset.house));
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal' && mode) closeModal(); });

/* ---------- start ---------- */
miniEl.hidden = !store.get('mini', true); $('#mapBtn').setAttribute('aria-pressed', String(!miniEl.hidden));
initCritters(); computeRunner(); fitView();
$('#loading').hidden = true;
addEventListener('resize', fitView); addEventListener('orientationchange', () => setTimeout(fitView, 250));
[W.canvas, W.upper, W.mini, cloudShape, puffShape, fogShape].forEach((c, i) => { setTimeout(() => snap(c), 4000 + i * 1200); c.addEventListener('contextrestored', heal); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) heal(); });
addEventListener('pageshow', heal); addEventListener('focus', heal); setInterval(() => { if (!document.hidden) heal(); }, 5000);
if (isPhone() && !standalone() && !canFull && !store.get('homeTip', false)) { store.set('homeTip', true); setTimeout(() => toast('Tip: Share → Add to Home Screen opens the village full screen.', 5000), 2500); }
let acc = 0, prev = performance.now(), frameN = 0;
function loop(now) {
  acc += Math.min(100, now - prev); prev = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render(); if (frameN++ % 6 === 0) { updateOverlay(); drawMini(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

(async () => {
  const cfg = window.VILLAGE_CONFIG || {};
  if (new URLSearchParams(location.search).has('sample')) {
    // test hook for the sample village only: step the simulation without relying on animation frames
    window.__village = { W, player, goTo, travel, act, objAt, get DV() { return DV; }, run(n = 60) { for (let i = 0; i < n; i++) step(); render(); updateOverlay(); drawMini(); return { x: player.x, y: player.y, place: regionName() }; }, time(m) { timeMode = m; updateHud(); }, weather(m) { weatherMode = m; updateHud(); }, get env() { return envNow; }, heal, wipe() { [W.canvas, W.upper, W.mini].forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height)); }, fit: fitView, enter: enterRoom, leave: leaveRoom, get room() { return room; }, critters, routes, botPos, get shout() { return shout; }, event(k) { if (k === 'goal') celebrateGoal(D.goals[0]); if (k === 'ship') shipSailsIn(Math.max(0, DV.ships - 1)); if (k === 'camp' && DV.tents[0]) raiseFlag(DV.tents[0].firm.name); } };
    startSample(); return;
  }
  if (cfg.supabaseUrl && cfg.anonKey && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    if (data && data.session) { await startLive(data.session); return; }
  }
  signInView();
})();
}
// let the loading screen paint before the island is built
setTimeout(startVillage, 50);

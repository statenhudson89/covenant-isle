/* Covenant Isle app: Today, Drafts, Jobs, Writing and More over the same Supabase data as the village.
   Reads as the signed-in owner; every change goes through a PIN-checked database function.
   ?sample runs it on made-up data with no sign-in. */
import { html, render, useState, useEffect, useMemo, useRef } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';

const cfg = window.VILLAGE_CONFIG || {};
const SAMPLE = new URLSearchParams(location.search).has('sample');
const HOUSE = {
  hq: ['Allocation HQ', 'Allocator'], tavern: ['The Tavern', 'Rolodex'], dojo: ['Interview Dojo', 'Sensei'], tailor: ['The Tailor', 'Tailor'],
  print: ['Print Shop', 'Editor'], crier: ['Town Crier', 'Crier'], vault: ['The Vault', 'Steward'], well: ['Wildcard Well', 'The Well'],
};
const ORDER = ['dojo', 'tailor', 'print', 'crier', 'tavern', 'vault', 'well', 'hq'];
const KIND = { email: 'Email', x_post: 'X post', x_thread: 'X thread', x_reply: 'X reply', dm: 'DM', memo: 'Memo', resume: 'Resume', issue: 'Issue', lesson: 'Lesson', other: 'Draft' };
const CAMP = { summit: 'The Summit', define: 'Define Camp', convert: 'Convert Camp', foothills: 'Foothills' };
const shippable = a => a.kind !== 'lesson' && (a.kind !== 'issue' || /^draft/i.test(a.title));
const verb = a => /^x_/.test(a.kind) ? ['Mark posted', 'Posted'] : a.kind === 'issue' ? ['Mark published', 'Published'] : ['Mark sent', 'Sent'];
const hname = id => (HOUSE[id] || [id])[0];

/* ---------- small helpers ---------- */
const fmt = n => (+n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
function ago(iso) {
  if (!iso) return ''; const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; if (s < 86400 * 14) return Math.round(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a small Markdown renderer for memos, issues and record documents (escapes first, so drafts can't inject HTML)
function md(src) {
  const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(src || '').split('\n')) {
    const line = raw.trimEnd(); let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line))) {
      if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
      const kind = m[1] ? 'ol' : 'ul'; if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[2])}</li>`); continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if (list) { out.push(`</${list}>`); list = null; }
    para.push(line);
  }
  flush(); return out.join('');
}
// word-level differences between two versions of a bullet
function wordDiff(a, b) {
  const A = String(a || '').split(/(\s+)/), B = String(b || '').split(/(\s+)/), n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  const push = (op, t) => { const last = out[out.length - 1]; if (last && last.op === op) last.t += t; else out.push({ op, t }); };
  while (i < n && j < m) { if (A[i] === B[j]) { push('=', A[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) push('-', A[i++]); else push('+', B[j++]); }
  while (i < n) push('-', A[i++]); while (j < m) push('+', B[j++]);
  return out;
}

/* ---------- the store ---------- */
const store = { d: null, v: null, mode: null, user: null, listeners: new Set(), ui: { toast: null, sheet: null } };
function emit() { store.listeners.forEach(f => f()); }
// subscribe, then catch up on anything that changed before the subscription existed
function useStore() { const [, force] = useState(0); useEffect(() => { const f = () => force(x => x + 1); store.listeners.add(f); f(); return () => store.listeners.delete(f); }, []); return store; }
let toastTimer = 0;
function toast(msg, ms = 3200) { store.ui.toast = msg; emit(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { store.ui.toast = null; emit(); }, ms); }
function openSheet(node) { store.ui.sheet = node; emit(); }
function closeSheet() { store.ui.sheet = null; emit(); }

function campOf(f) {
  const c = (f.camp || '').toLowerCase();
  if (['foothills', 'convert', 'define', 'summit'].includes(c)) return c;
  if (/sign/.test(f.status)) return 'summit';
  return f.status === 'active' ? 'convert' : 'foothills';
}
function derive(d) {
  const v = { pending: {}, unsent: {}, rules: {}, firms: [], lessons: {}, base: null, byFirm: {}, approvalFor: {} };
  d.approvals.forEach(a => {
    if (a.status === 'pending') (v.pending[a.house_id] ||= []).push(a);
    if (a.status === 'approved' && !a.shipped_at && shippable(a)) (v.unsent[a.house_id] ||= []).push(a);
    if (a.status === 'approved' && a.kind === 'lesson') (v.rules[a.house_id] ||= []).push(a);
    if (a.resume_id) v.approvalFor[a.resume_id] = a;
  });
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
  v.firms = [...firms.values()].map(f => ({ ...f, camp: campOf(f), seats: (f.seat || '').split(/\s+\/\s+/).map(s => s.trim()).filter(s => s && s !== 'unknown') }));
  (d.resumes || []).forEach(r => { if (r.status === 'base') v.base = r; else if (r.firm) (v.byFirm[r.firm] ||= []).push(r); });
  Object.values(v.byFirm).forEach(list => list.sort((a, z) => z.version - a.version));
  v.waiting = Object.values(v.pending).reduce((n, a) => n + a.length, 0);
  v.toSend = Object.values(v.unsent).reduce((n, a) => n + a.length, 0);
  return v;
}
function setData(d) { store.d = d; store.v = derive(d); emit(); }
const tokens = name => name.split('/').map(s => s.trim().split(/\s+/)[0].toLowerCase()).filter(w => w.length > 2);

async function loadLive() {
  const since = days => new Date(Date.now() - days * 864e5).toISOString();
  const q = t => sb.from(t);
  const res = await Promise.all([
    q('village_state').select('*').order('sort'), q('goals').select('*').order('sort'), q('goal_sets_this_week').select('*').order('sort'),
    q('approvals').select('*').or(`status.eq.pending,decided_at.gte.${since(45)},and(kind.eq.lesson,status.eq.approved),and(kind.eq.resume,status.eq.approved)`).order('created_at', { ascending: false }).limit(400),
    q('activity_log').select('*').gte('at', since(30)).order('at', { ascending: false }).limit(800),
    q('radar_items').select('*').order('found_at', { ascending: false }).limit(40), q('wildcards').select('*').order('created_at', { ascending: false }).limit(40),
    q('goal_readings').select('*').gte('at', since(120)).order('at'), q('resumes').select('*').not('status', 'in', '(discarded,retired)').order('created_at', { ascending: false }).limit(200),
    q('record_docs').select('*').order('house_id'), q('runs').select('house_id,started_at,ok,input_tokens,output_tokens,brain_provider').gte('started_at', since(14)).limit(500),
  ]);
  const bad = res.find(r => r.error); if (bad) throw new Error(bad.error.message);
  const [st, goals, sets, approvals, activity, radar, wild, readings, resumes, record, runs] = res.map(r => r.data || []);
  if (!st.length) throw new Error('Signed in, but this account isn\'t the village owner, so nothing is visible.');
  const houses = {}; st.forEach(h => { houses[h.id] = h; });
  setData({ houses, goals, sets, approvals, activity, radar, wild, readings, resumes, record, runs });
}
async function reload(quiet) {
  if (store.mode !== 'live') { setData(store.d); return; }
  try { await loadLive(); if (!quiet) toast('Up to date'); } catch (e) { toast('Couldn\'t load: ' + e.message); }
}

/* ---------- PIN-checked actions ---------- */
let pin = null;
function needPin() {
  if (store.mode === 'sample' || pin) return Promise.resolve();
  return new Promise((resolve, reject) => openSheet(html`<${PinSheet} onDone=${p => { pin = p; closeSheet(); resolve(); }} onCancel=${() => { closeSheet(); reject(new Error('cancelled')); }} />`));
}
async function rpc(fn, args) {
  const { error } = await sb.rpc(fn, Object.assign({ p_pin: pin }, args));
  if (error) { if (/wrong pin/i.test(error.message)) { pin = null; throw new Error('Wrong PIN. Try again.'); } throw new Error(error.message); }
}
async function act(run, sampleChange, done) {
  try {
    await needPin();
    if (store.mode === 'sample') { sampleChange(); setData(store.d); } else { await run(); await loadLive(); }
    if (done) toast(done);
  } catch (e) { if (e.message !== 'cancelled') toast(e.message); }
}
const now = () => new Date().toISOString();
const logYou = (house_id, text) => store.d.activity.unshift({ id: 'x' + Date.now(), house_id, at: now(), text, source: 'you' });
function decide(a, decision, feedback) {
  return act(() => rpc('decide_approval', { p_id: a.id, p_decision: decision, p_feedback: feedback || null }),
    () => { a.status = decision; a.decided_at = now(); a.feedback = feedback || null; if (a.resume_id) { const r = store.d.resumes.find(x => x.id === a.resume_id); if (r) r.status = decision; } logYou(a.house_id, (decision === 'approved' ? 'You approved: ' : 'You sent back for edits: ') + a.title); },
    decision !== 'approved' ? 'Sent back with your note.' : a.kind === 'lesson' ? `Approved. ${hname(a.house_id)} follows it from its next run.` : shippable(a) && /^(x_|email|dm)/.test(a.kind) ? `Approved. Nothing is sent: ${/^x_/.test(a.kind) ? 'post' : 'send'} it yourself, then mark it.` : 'Approved.');
}
function markShipped(a, url) {
  return act(() => rpc('mark_shipped', { p_id: a.id, p_url: url || null }),
    () => { a.shipped_at = now(); a.shipped_url = url || null; logYou(a.house_id, (/^x_/.test(a.kind) ? 'You posted: ' : a.kind === 'issue' ? 'You published: ' : 'You sent: ') + a.title); },
    `${verb(a)[1]}. It counts toward this week's sets where it fits.`);
}
function recordReading(g, value) {
  const v = +String(value).replace(/,/g, ''); if (!isFinite(v) || String(value).trim() === '') { toast('Enter a number.'); return; }
  return act(() => rpc('record_reading', { p_goal_id: g.id, p_value: v }), () => { store.d.readings.push({ id: 'g' + Date.now(), goal_id: g.id, value: v, at: now(), source: 'you' }); g.current_value = v; }, `Logged ${fmt(v)} ${g.unit}.`);
}
function logSet(s) { return act(() => rpc('log_set', { p_set_id: s.id, p_amount: 1 }), () => { s.done = (+s.done || 0) + 1; }, `Logged: ${s.name}`); }
function saveWild(w, status) { return act(() => rpc('save_wildcard', { p_id: w.id, p_status: status }), () => { w.status = status; }, status === 'saved' ? `Saved ${w.person}.` : 'Dismissed.'); }
function commentResume(r, entry, text) {
  if (!text.trim()) { toast('Write a comment first.'); return; }
  return act(() => rpc('comment_resume', { p_id: r.id, p_entry: entry || null, p_text: text.trim() }), () => { r.comments = [...(r.comments || []), { entry, text: text.trim(), at: now() }]; }, 'Comment saved.');
}
function saveRecord(doc, body) {
  return act(() => rpc('save_record', { p_house: doc.house_id, p_name: doc.name, p_body: body }), () => { doc.body = body; doc.updated_at = now(); doc.updated_by = 'you'; }, 'Saved. The house reads it on its next run.');
}
async function copyText(t) { try { await navigator.clipboard.writeText(t || ''); toast('Copied'); } catch { toast('Couldn\'t copy here. Select the text instead.'); } }

/* ---------- Word export: fills the formatting-only template made by import_resume.py ---------- */
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Couldn\'t load the Word exporter.')); document.head.appendChild(s); }); }
async function resumeDocx(content) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const [tpl, f] = await Promise.all([fetch('app/resume-template.docx').then(r => r.arrayBuffer()), fetch('app/resume-format.json').then(r => r.json())]);
  const zip = await window.JSZip.loadAsync(tpl);
  const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const run = (rpr, t) => `<w:r>${rpr}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const p = (ppr, runs) => `<w:p>${ppr}${runs}</w:p>`;
  const joined = (parts, rpr, sepRpr) => parts.map(t => run(rpr, t)).join(run(sepRpr, f.sep));
  let body = p(f.ppr.title, run(f.rpr.title, content.name)) + p(f.ppr.contact, joined(content.contact, f.rpr.contact, f.rpr.contact));
  content.sections.forEach(s => {
    body += p(f.ppr.h1, run(f.rpr.h1, s.title));
    s.items.forEach(i => {
      if (i.parts.length) body += p(f.ppr.h2, joined(i.parts, f.rpr.h2, f.rpr.h2sep));
      i.entries.forEach(e => {
        const runs = e.lead ? run(f.rpr.bold, e.lead) + run(f.rpr.body, ' ' + e.text) : run(e.bold ? f.rpr.bold : f.rpr.body, e.text);
        body += p(e.level ? f.ppr.b1 : f.ppr.b0, runs);
      });
    });
  });
  const doc = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', doc.replace('<!--BODY-->', body));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function resumeFileName(r) { return `${(r.content.name || 'Resume').split(',')[0]} Resume${r.firm ? ' - ' + r.firm : ''}`; }
async function downloadWord(r) {
  try {
    const blob = await resumeDocx(r.content), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = resumeFileName(r) + '.docx'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { toast(e.message || 'Couldn\'t make the Word file.'); }
}
function printPdf(r) { const t = document.title; document.title = resumeFileName(r); window.print(); setTimeout(() => { document.title = t; }, 500); }

/* ---------- routing ---------- */
function useRoute() {
  const [h, setH] = useState(location.hash.slice(1) || 'today');
  useEffect(() => { const f = () => { setH(location.hash.slice(1) || 'today'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const [path, query] = h.split('?'); return { parts: path.split('/').map(decodeURIComponent), q: new URLSearchParams(query || '') };
}
const go = h => { location.hash = h; };

/* ---------- icons (outline) ---------- */
const I = {
  today: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  drafts: 'M4 4h16v12H15l-3 3-3-3H4z M8 8h8 M8 11h5',
  jobs: 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16',
  writing: 'M4 20h4L19 9l-4-4L4 16z M13 7l4 4',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3 3-5 6-5s6 2 6 5 M16 11a3 3 0 1 0 0-6 M18 15c2 .5 3 2.3 3 5',
  chev: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6',
};
const Icon = ({ d, cls }) => html`<svg class=${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d} /></svg>`;
const Chev = () => html`<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d=${I.chev} /></svg>`;

/* ---------- shared pieces ---------- */
function Top({ title, back, right }) {
  return html`<header class="top">${back && html`<button class="back" onClick=${() => (history.length > 1 ? history.back() : go(back))} aria-label="Back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d=${I.back} /></svg></button>`}<h1>${title}</h1>${right}</header>`;
}
const Row = ({ href, title, sub, right, onClick }) => html`<a class="row" href=${href} onClick=${onClick}><div class="grow"><div class="t">${title}</div>${sub && html`<div class="s">${sub}</div>`}</div>${right}${href && html`<${Chev} />`}</a>`;
const statusChip = a => a.status === 'pending' ? html`<span class="chip warn">Waiting</span>` : a.status === 'sent_back' ? html`<span class="chip">Sent back</span>`
  : a.shipped_at ? html`<span class="chip good">${verb(a)[1]}</span>` : a.status === 'approved' && shippable(a) ? html`<span class="chip accent">To ${/^x_/.test(a.kind) ? 'post' : a.kind === 'issue' ? 'publish' : 'send'}</span>` : html`<span class="chip good">Approved</span>`;

function GoalCard({ g, edit }) {
  const start = +g.start_value || 0, cur = +g.current_value || 0, tgt = +g.target_value || 1, pct = Math.max(0, Math.min(1, (cur - start) / Math.max(1e-9, tgt - start)));
  const sets = store.d.sets.filter(s => s.goal_id === g.id), rs = store.d.readings.filter(r => r.goal_id === g.id), last = rs[rs.length - 1];
  const [val, setVal] = useState('');
  return html`<div class="card">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><b>${g.title}</b>${g.behind ? html`<span class="chip bad">Behind</span>` : null}</div>
    <div class="bar"><span style=${`width:${(pct * 100).toFixed(1)}%`}></span></div>
    <div class="small muted">${fmt(cur)} / ${fmt(tgt)} ${g.unit} · ${g.deadline_label || ''}${last ? ` · last reading ${ago(last.at)}` : ''}</div>
    ${g.pace_note && html`<div class="small" style="margin-top:4px">${g.pace_note}</div>`}
    ${edit && html`
      ${sets.length > 0 && html`<div style="margin-top:10px">${sets.map(s => html`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px" key=${s.id}><span style="flex:1">${s.name}</span><span class="muted">${s.done}/${s.weekly_target}</span><button class="btn small" onClick=${() => logSet(s)} aria-label=${'Log one: ' + s.name}>+1</button></div>`)}</div>`}
      <div style="display:flex;gap:8px;margin-top:10px"><input inputmode="decimal" placeholder=${'New reading, e.g. ' + fmt(cur)} value=${val} onInput=${e => setVal(e.target.value)} aria-label=${'New reading for ' + g.title} /><button class="btn" onClick=${async () => { await recordReading(g, val); setVal(''); }}>Save</button></div>`}
  </div>`;
}

/* ---------- Today ---------- */
function Today() {
  const { d, v } = store;
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const pending = Object.values(v.pending).flat().sort((a, z) => Date.parse(z.created_at) - Date.parse(a.created_at));
  const unsent = Object.values(v.unsent).flat();
  const active = v.firms.filter(f => f.status === 'active');
  // weekly readings matter for count goals (followers, subscribers), not for "sign a seat"
  const due = d.goals.filter(g => +g.target_value - +g.start_value >= 50).filter(g => { const rs = d.readings.filter(r => r.goal_id === g.id); return !rs.length || Date.now() - Date.parse(rs[rs.length - 1].at) > 7 * 864e5; });
  return html`<${Top} title=${hello} />
    <div class="tiles">
      <a class=${'tile' + (v.waiting ? ' alert' : '')} href="#drafts"><div class="n">${v.waiting}</div><div class="l">Waiting for you</div></a>
      <a class="tile" href="#drafts?f=send"><div class="n">${v.toSend}</div><div class="l">To post or send</div></a>
      <a class="tile" href="#jobs"><div class="n">${active.length}</div><div class="l">Active firms</div></a>
      <a class="tile" href="#goals"><div class="n">${due.length}</div><div class="l">Numbers due</div></a>
    </div>
    ${(pending.length > 0 || unsent.length > 0) && html`<div class="h2">Needs you</div><div class="list">
      ${unsent.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${`${hname(a.house_id)} · approved ${ago(a.decided_at)} · not ${verb(a)[1].toLowerCase()} yet`} right=${html`<span class="chip accent">${KIND[a.kind]}</span>`} />`)}
      ${pending.slice(0, 6).map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${`${hname(a.house_id)} · ${ago(a.created_at)}`} right=${html`<span class="chip warn">${KIND[a.kind]}</span>`} />`)}
      ${pending.length > 6 && html`<${Row} href="#drafts" title=${`All ${pending.length} drafts`} />`}
    </div>`}
    ${active.some(f => f.next) && html`<div class="h2">Next steps</div><div class="list">
      ${active.filter(f => f.next).map(f => html`<${Row} key=${f.name} href=${'#firm/' + encodeURIComponent(f.name)} title=${f.next} sub=${`${f.name} · ${CAMP[f.camp]}`} />`)}</div>`}
    ${due.length > 0 && html`<div class="h2">Numbers due this week</div>${due.map(g => html`<${GoalCard} key=${g.id} g=${g} edit=${true} />`)}`}
    <div class="h2">Goals</div>
    <div class="list">${d.goals.map(g => { const s = +g.start_value || 0, pct = Math.max(0, Math.min(1, ((+g.current_value || 0) - s) / Math.max(1e-9, (+g.target_value || 1) - s)));
      return html`<a class="row" href="#goals" key=${g.id}><div class="grow"><div style="display:flex;justify-content:space-between;gap:8px"><span class="t" style="font-weight:500">${g.title}</span>${g.behind ? html`<span class="chip bad">Behind</span>` : html`<span class="small muted">${fmt(g.current_value)} / ${fmt(g.target_value)}</span>`}</div><div class="bar"><span style=${`width:${(pct * 100).toFixed(1)}%`}></span></div></div></a>`; })}</div>`;
}

/* ---------- Drafts ---------- */
function Drafts({ q }) {
  const { d, v } = store, f = q.get('f') || 'all';
  const houses = ORDER.filter(h => (v.pending[h] || []).length);
  let list = f === 'send' ? Object.values(v.unsent).flat() : f === 'done' ? d.approvals.filter(a => a.status !== 'pending').slice(0, 60)
    : d.approvals.filter(a => a.status === 'pending' && (f === 'all' || a.house_id === f));
  list = [...list].sort((a, z) => Date.parse(z.decided_at || z.created_at) - Date.parse(a.decided_at || a.created_at));
  const chip = (key, label) => html`<button class=${'chip' + (f === key ? ' accent' : '')} onClick=${() => go('drafts' + (key === 'all' ? '' : '?f=' + key))}>${label}</button>`;
  return html`<${Top} title="Drafts" />
    <div class="chips">${chip('all', `Waiting ${v.waiting}`)}${houses.map(h => chip(h, `${hname(h)} ${(v.pending[h] || []).length}`))}${chip('send', `To send ${v.toSend}`)}${chip('done', 'Decided')}</div>
    ${list.length ? html`<div class="list">${list.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${`${KIND[a.kind] || a.kind} · ${hname(a.house_id)} · ${ago(a.decided_at || a.created_at)}`} right=${statusChip(a)} />`)}</div>`
      : html`<div class="empty">${f === 'send' ? 'Nothing approved is waiting to go out.' : 'Nothing waiting. The houses will add drafts on their next runs.'}</div>`}`;
}

function PostPreview({ a }) {
  const posts = a.kind === 'x_thread' ? String(a.draft).split(/\n\s*\n|\n(?=\d+\s*[/.)]\s)/).map(s => s.trim()).filter(Boolean) : [String(a.draft).trim()];
  const radar = store.d.radar.find(r => r.approval_id === a.id);
  return html`${a.kind === 'x_reply' && html`<div class="quoted">${radar ? html`<b>@${radar.author_handle}</b> · ${fmt(radar.author_followers)} followers<br />${radar.post_text}` : html`Replying to ${a.target ? html`<a href=${a.target} target="_blank" rel="noopener">this post</a>` : 'a post'}`}</div>`}
    ${posts.map((t, i) => html`<div class="post" key=${i}><div class="who"><div class="av">CL</div><div><div class="nm">Covenant Lite</div><div class="hd">@Covenantlite__</div></div></div>
      <div class="tx">${t}</div><div class=${'ct' + (t.length > 280 ? ' over' : '')}>${t.length} / 280</div></div>`)}`;
}
function MailPreview({ a }) {
  const m = /^\s*Subject:\s*(.+)\n+([\s\S]*)$/i.exec(a.draft || ''), subject = m ? m[1] : a.title, body = m ? m[2] : a.draft;
  return html`<div class="mail"><div class="hdr"><b>To</b><span>${a.target || '—'}</span><b>Subject</b><span>${subject}</span></div><div class="bd">${body}</div></div>`;
}
function DraftView({ id }) {
  const a = store.d.approvals.find(x => x.id === id);
  const [note, setNote] = useState(''), [back, setBack] = useState(false), [url, setUrl] = useState('');
  if (!a) return html`<${Top} title="Draft" back="drafts" /><div class="empty">This draft isn't in the last few weeks of the village.</div>`;
  const resume = a.resume_id && store.d.resumes.find(r => r.id === a.resume_id);
  if (resume) return html`<${ResumeView} id=${resume.id} />`;
  return html`<${Top} title=${KIND[a.kind] || 'Draft'} back="drafts" />
    <div class="small muted" style="margin:-4px 2px 10px">${hname(a.house_id)} · ${ago(a.created_at)} ${statusChip(a)}</div>
    <h2 style="font-size:19px;margin:0 2px 8px;line-height:1.3">${a.title}</h2>
    ${a.meta && html`<p class="small muted" style="margin:0 2px 10px">${a.meta}</p>`}
    ${/^x_/.test(a.kind) ? html`<${PostPreview} a=${a} />` : /^(email|dm)$/.test(a.kind) ? html`<${MailPreview} a=${a} />`
      : html`<article class="doc" dangerouslySetInnerHTML=${{ __html: md(a.draft) }}></article>`}
    ${a.status !== 'pending' && html`<p class="small muted">${a.status === 'approved' ? (a.kind === 'lesson' ? 'In force since ' : 'Approved ') : 'Sent back '}${ago(a.decided_at)}${a.feedback ? ` · “${a.feedback}”` : ''}</p>`}
    <div class="dock">
      ${a.status === 'pending' && html`
        ${back && html`<div class="field"><textarea placeholder="What should change?" value=${note} onInput=${e => setNote(e.target.value)} aria-label="Note for the house"></textarea></div>`}
        <div class="actions" style="margin:0">
          ${back ? html`<button class="btn primary" onClick=${() => decide(a, 'sent_back', note.trim())}>Send back</button><button class="btn" onClick=${() => setBack(false)}>Cancel</button>`
            : html`<button class="btn primary" onClick=${() => decide(a, 'approved')}>Approve</button><button class="btn" onClick=${() => setBack(true)}>Send back…</button>`}
          <button class="btn" onClick=${() => copyText(a.draft)}>Copy</button>
        </div>`}
      ${a.status === 'approved' && shippable(a) && !a.shipped_at && html`
        ${/^x_/.test(a.kind) && html`<div class="field" style="margin-top:0"><input type="url" placeholder="Link to the post (optional)" value=${url} onInput=${e => setUrl(e.target.value)} aria-label="Link to the live post" /></div>`}
        <div class="actions" style="margin:0"><button class="btn primary" onClick=${() => markShipped(a, url.trim())}>${verb(a)[0]}</button><button class="btn" onClick=${() => copyText(a.draft)}>Copy text</button>
          ${a.target && /^https?:/.test(a.target) && html`<a class="btn" href=${a.target} target="_blank" rel="noopener">Open</a>`}</div>`}
      ${a.shipped_at && html`<p class="small" style="color:var(--good);margin:0">${verb(a)[1]} ${ago(a.shipped_at)}${a.shipped_url ? html` · <a href=${a.shipped_url} target="_blank" rel="noopener">view</a>` : null}</p>`}
    </div>`;
}

/* ---------- resumes ---------- */
function compare(version, base) {
  const baseEntries = {}, baseItems = {};
  (base ? base.content.sections : []).forEach(s => s.items.forEach(i => { baseItems[i.id] = i; i.entries.forEach((e, k) => { baseEntries[e.id] = { ...e, item: i.id, k }; }); }));
  const why = {}; (version.changes || []).forEach(c => { why[c.entry] = c; });
  return { baseEntries, baseItems, why };
}
function Entry({ e, mark, onPick, selected, comments }) {
  const cls = ['ent', e.level ? 'l1' : '', e.bold ? 'b' : '', mark.kind === 'added' ? 'add' : '', mark.kind === 'reworded' ? 'chg' : '', mark.kind === 'cut' ? 'cut' : '', comments ? 'has-note' : '', selected ? 'sel' : ''].filter(Boolean).join(' ');
  const text = mark.kind === 'reworded' && mark.was != null ? wordDiff(mark.was, e.text).map((s, i) => s.op === '=' ? s.t : s.op === '+' ? html`<ins key=${i}>${s.t}</ins>` : html`<del key=${i}>${s.t}</del>`) : e.text;
  const tag = mark.kind && mark.kind !== 'same' ? html`<span class="tag">${{ added: 'Added', reworded: 'Reworded', cut: 'Cut', moved: 'Moved' }[mark.kind]}</span>` : null;
  return html`<div class=${cls} onClick=${() => onPick(e.id)} role="button" tabindex="0" onKeyDown=${ev => { if (ev.key === 'Enter') onPick(e.id); }}>${e.lead && html`<span class="lead">${e.lead} </span>`}${text}${tag}</div>`;
}
function Paper({ r, base, marks, picked, onPick }) {
  const { baseEntries, baseItems, why } = compare(r, base), isBase = r.status === 'base';
  const comments = {}; (r.comments || []).forEach(c => { if (c.entry) comments[c.entry] = (comments[c.entry] || 0) + 1; });
  const markOf = e => {
    if (isBase) return { kind: 'same' };
    const b = baseEntries[e.id];
    if (!b) return { kind: 'added' };
    if (b.text !== e.text || (b.lead || '') !== (e.lead || '')) return { kind: 'reworded', was: (b.lead ? b.lead + ' ' : '') !== (e.lead ? e.lead + ' ' : '') ? null : b.text };
    if ((why[e.id] || {}).kind === 'moved') return { kind: 'moved' };
    return { kind: 'same' };
  };
  const c = r.content;
  return html`<div class=${'paper' + (marks ? ' marks' : '')}>
    <div class="nm">${c.name}</div><div class="ct">${c.contact.join('  |  ')}</div>
    ${c.sections.map(s => html`<div key=${s.id}><div class="sec">${s.title}</div>
      ${s.items.map(i => { const kept = new Set(i.entries.map(e => e.id)), cut = !isBase && baseItems[i.id] ? baseItems[i.id].entries.filter(e => !kept.has(e.id)) : [];
        return html`<div key=${i.id}>${i.parts.length > 0 && html`<div class="role">${i.parts.map((p, k) => html`${k > 0 && html`<span class="sp">|</span>`}${p}`)}</div>`}
          ${i.entries.map(e => html`<${Entry} key=${e.id} e=${e} mark=${markOf(e)} onPick=${onPick} selected=${picked === e.id} comments=${comments[e.id]} />`)}
          ${marks && cut.map(e => html`<${Entry} key=${'cut' + e.id} e=${e} mark=${{ kind: 'cut' }} onPick=${onPick} selected=${picked === e.id} comments=${comments[e.id]} />`)}</div>`; })}</div>`)}
  </div>`;
}
function EntrySheet({ r, base, id }) {
  const { baseEntries, why } = compare(r, base), [text, setText] = useState('');
  const e = r.content.sections.flatMap(s => s.items.flatMap(i => i.entries)).find(x => x.id === id) || baseEntries[id];
  const b = baseEntries[id], change = why[id], notes = (r.comments || []).filter(c => c.entry === id);
  const editable = r.status === 'pending';
  return html`<div class="sheet-bg" onClick=${ev => { if (ev.target === ev.currentTarget) closeSheet(); }}><div class="sheet" role="dialog" aria-label="Bullet">
    <h2>${change ? { moved: 'Moved', reworded: 'Reworded', added: 'Added', cut: 'Cut' }[change.kind] || 'Changed' : !b ? 'Added' : 'Bullet'}</h2>
    <p style="margin:6px 0 10px">${e && (e.lead ? e.lead + ' ' : '') + e.text}</p>
    ${change && html`<p class="small"><b>Why:</b> ${change.why}</p>`}
    ${b && e && b.text !== e.text && html`<p class="small muted"><b>Was:</b> ${b.text}</p>`}
    ${notes.length > 0 && html`<div class="h2" style="margin-top:14px">Your comments</div><ul class="log">${notes.map((c, k) => html`<li key=${k}><span class="t">${ago(c.at)}</span><span>${c.text}</span></li>`)}</ul>`}
    ${editable && html`<div class="field"><textarea placeholder="What should change in this bullet?" value=${text} onInput=${ev => setText(ev.target.value)} aria-label="Comment on this bullet"></textarea></div>`}
    <div class="actions">${editable && html`<button class="btn primary" onClick=${async () => { await commentResume(r, id, text); closeSheet(); }}>Add comment</button>`}<button class="btn" onClick=${closeSheet}>Close</button></div>
  </div></div>`;
}
function ResumeView({ id }) {
  const { d, v } = store, r = d.resumes.find(x => x.id === id);
  const [marks, setMarks] = useState(true), [note, setNote] = useState(''), [back, setBack] = useState(false);
  if (!r) return html`<${Top} title="Resume" back="jobs" /><div class="empty">This resume version isn't here.</div>`;
  const base = d.resumes.find(x => x.id === r.based_on) || v.base, appr = v.approvalFor[r.id], isBase = r.status === 'base';
  const n = (r.changes || []).length, general = (r.comments || []).filter(c => !c.entry);
  const pick = entry => openSheet(html`<${EntrySheet} r=${r} base=${base} id=${entry} />`);
  const sendBack = () => {
    const notes = (r.comments || []).map(c => (c.entry ? `On ${c.entry}: ` : '') + c.text);
    decide(appr, 'sent_back', [note.trim(), ...notes].filter(Boolean).join('\n'));
  };
  return html`<${Top} title=${isBase ? 'Your base resume' : `${r.firm} v${r.version}`} back="jobs" />
    ${!isBase && html`<div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">${appr ? statusChip(appr) : html`<span class="chip">${r.status}</span>`}<span class="small muted">${r.seat ? 'Seat: ' + r.seat : ''}</span></div>
      ${r.summary && html`<p style="margin:4px 0">${r.summary}</p>`}
      <div class="small muted">${n} change${n === 1 ? '' : 's'} from your base resume · tap any bullet for why, or to comment</div>
      <label class="toggle" style="margin-top:8px"><input type="checkbox" checked=${marks} onChange=${e => setMarks(e.target.checked)} /> Show changes</label>
    </div>`}
    <div class="actions" style="margin:0 0 12px"><button class="btn small" onClick=${() => downloadWord(r)}>Download Word</button><button class="btn small" onClick=${() => printPdf(r)}>Save as PDF</button>
      ${!isBase && appr && appr.status === 'pending' && html`<button class="btn small" onClick=${() => openSheet(html`<${CommentSheet} r=${r} />`)}>Comment</button>`}</div>
    <${Paper} r=${r} base=${base} marks=${marks && !isBase} onPick=${pick} />
    ${general.length > 0 && html`<div class="h2">Comments</div><div class="card"><ul class="log">${general.map((c, k) => html`<li key=${k}><span class="t">${ago(c.at)}</span><span>${c.text}</span></li>`)}</ul></div>`}
    ${appr && appr.status === 'pending' && html`<div class="dock">
      ${back && html`<div class="field" style="margin-top:0"><textarea placeholder="Anything else to change? Your bullet comments go with it." value=${note} onInput=${e => setNote(e.target.value)} aria-label="Note for the Tailor"></textarea></div>`}
      <div class="actions" style="margin:0">${back ? html`<button class="btn primary" onClick=${sendBack}>Send back</button><button class="btn" onClick=${() => setBack(false)}>Cancel</button>`
        : html`<button class="btn primary" onClick=${() => decide(appr, 'approved')}>Approve</button><button class="btn" onClick=${() => setBack(true)}>Send back…</button>`}</div>
    </div>`}`;
}
function CommentSheet({ r }) {
  const [text, setText] = useState('');
  return html`<div class="sheet-bg" onClick=${ev => { if (ev.target === ev.currentTarget) closeSheet(); }}><div class="sheet" role="dialog" aria-label="Comment">
    <h2>Comment on this version</h2><div class="field"><textarea placeholder="What should change overall?" value=${text} onInput=${e => setText(e.target.value)} aria-label="Comment"></textarea></div>
    <div class="actions"><button class="btn primary" onClick=${async () => { await commentResume(r, null, text); closeSheet(); }}>Add comment</button><button class="btn" onClick=${closeSheet}>Cancel</button></div></div></div>`;
}

/* ---------- Jobs ---------- */
function Jobs() {
  const { v } = store, groups = ['summit', 'define', 'convert', 'foothills'];
  const card = f => { const rs = v.byFirm[f.name] || [], waiting = rs.find(r => r.status === 'pending');
    return html`<a class="row" href=${'#firm/' + encodeURIComponent(f.name)} key=${f.name}><div class="grow">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span class="t">${f.name}</span><span class=${'chip ' + (f.status === 'active' ? 'good' : f.status === 'closed' ? '' : 'accent')}>${f.status}</span></div>
      <div class="s">${f.seats.length > 1 ? `${f.seats.length} seats in play` : f.seats[0] || 'Seat not set'}</div>
      ${f.next && html`<div class="small" style="margin-top:3px">Next: ${f.next}</div>`}
      ${(rs.length > 0) && html`<div style="margin-top:6px;display:flex;gap:6px"><span class=${'chip' + (waiting ? ' warn' : '')}>Resume v${rs[0].version}${waiting ? ' waiting' : ''}</span></div>`}
    </div><${Chev} /></a>`; };
  return html`<${Top} title="Job search" />
    ${v.base && html`<div class="list"><${Row} href=${'#resume/' + v.base.id} title="Your base resume" sub="Every firm version builds on this" /></div>`}
    ${groups.map(g => { const fs = v.firms.filter(f => f.camp === g && !/closed/.test(f.status)); return fs.length ? html`<div class="h2" key=${g}>${CAMP[g]} · ${fs.length}</div><div class="list">${fs.map(card)}</div>` : null; })}
    ${(() => { const closed = v.firms.filter(f => /closed/.test(f.status)); return closed.length ? html`<div class="h2">Closed · ${closed.length}</div><div class="list">${closed.map(card)}</div>` : null; })()}
    ${!v.firms.length && html`<div class="empty">No status lines from the Dojo yet. They appear after its next run.</div>`}`;
}
function Firm({ name }) {
  const { d, v } = store, f = v.firms.find(x => x.name === name);
  if (!f) return html`<${Top} title=${name} back="jobs" /><div class="empty">This firm no longer has a status line.</div>`;
  const toks = tokens(f.name), drafts = d.approvals.filter(a => (a.house_id === 'dojo' || a.house_id === 'tailor') && a.kind !== 'resume' && toks.some(t => a.title.toLowerCase().includes(t)));
  const versions = v.byFirm[f.name] || [], lessons = v.lessons[f.name] || [];
  return html`<${Top} title=${f.name} back="jobs" />
    <div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip accent">${CAMP[f.camp]}</span><span class="chip">${f.status}</span><span class="small muted">updated ${ago(f.at)}</span></div>
      <dl class="facts">${f.seats.length > 0 && html`<dt>${f.seats.length > 1 ? 'Seats' : 'Seat'}</dt><dd>${f.seats.join(' · ')}</dd>`}${f.who && html`<dt>People</dt><dd>${f.who}</dd>`}${f.next && html`<dt>Next</dt><dd>${f.next}</dd>`}</dl></div>
    <div class="h2">Resume versions</div>
    ${versions.length ? html`<div class="list">${versions.map(r => html`<${Row} key=${r.id} href=${'#resume/' + r.id} title=${`v${r.version}${r.seat ? ' · ' + r.seat : ''}`} sub=${ago(r.created_at)} right=${v.approvalFor[r.id] ? statusChip(v.approvalFor[r.id]) : html`<span class="chip">${r.status}</span>`} />`)}</div>`
      : html`<div class="card small muted">No versions yet. The Tailor writes one on its next run while ${f.name} is active.</div>`}
    ${drafts.length > 0 && html`<div class="h2">Prep and notes</div><div class="list">${drafts.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${`${KIND[a.kind]} · ${ago(a.created_at)}`} right=${statusChip(a)} />`)}</div>`}
    ${lessons.length > 0 && html`<div class="h2">Lessons</div><div class="card"><ul class="log">${lessons.map((l, k) => html`<li key=${k}><span class="t">${ago(l.at)}</span><span>${l.text}</span></li>`)}</ul></div>`}`;
}

/* ---------- Writing ---------- */
function Writing() {
  const { d } = store, g = id => d.goals.find(x => x.id === id);
  const issues = d.approvals.filter(a => a.house_id === 'print').sort((a, z) => Date.parse(z.created_at) - Date.parse(a.created_at)).slice(0, 12);
  const posts = d.approvals.filter(a => a.house_id === 'crier' && /^x_/.test(a.kind) && a.status === 'approved').slice(0, 12);
  return html`<${Top} title="Writing" />
    <div class="h2">Covenant Lite on Substack</div>
    ${g('substack-subs') && html`<${GoalCard} g=${g('substack-subs')} />`}
    ${issues.length ? html`<div class="list">${issues.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${`${KIND[a.kind]} · ${ago(a.created_at)}`} right=${statusChip(a)} />`)}</div>` : html`<div class="card small muted">No outlines or drafts yet this month.</div>`}
    <div class="h2">@Covenantlite__ on X</div>
    ${['x-followers', 'x-tier1'].map(id => g(id) && html`<${GoalCard} key=${id} g=${g(id)} />`)}
    <div class="h2">Reply radar</div>
    ${d.radar.length ? html`<div class="list">${d.radar.slice(0, 15).map(r => html`<a class="row" key=${r.id} href=${r.approval_id ? '#draft/' + r.approval_id : r.post_url || '#writing'} target=${r.approval_id ? null : '_blank'} rel="noopener">
      <div class="grow"><div style="display:flex;gap:8px;align-items:center"><span class=${'chip ' + (r.fit === 'high' ? 'good' : r.fit === 'medium' ? 'accent' : '')}>${r.fit}</span><span class="small muted">@${r.author_handle || '?'} · ${fmt(r.author_followers)} followers · ${ago(r.found_at)}</span></div>
      <div class="t" style="font-weight:450;margin-top:4px">${r.post_text}</div><div class="s">${r.why}</div></div><${Chev} /></a>`)}</div>` : html`<div class="card small muted">Nothing on the radar yet.</div>`}
    ${posts.length > 0 && html`<div class="h2">Approved posts</div><div class="list">${posts.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${ago(a.decided_at)} right=${statusChip(a)} />`)}</div>`}`;
}

/* ---------- More: people, goals, houses, record ---------- */
function More() {
  const { mode, user } = store;
  return html`<${Top} title="More" />
    <div class="list"><${Row} href="#people" title="People" sub="Networking targets and long shots" /><${Row} href="#goals" title="Goals" sub="Readings, weekly sets and pace" />
      <${Row} href="#houses" title="Houses" sub="What each house is doing, and what runs cost" /><${Row} href="#record" title="Your record" sub="What the houses work from" /></div>
    <div class="list"><a class="row" href=${'village.html' + (SAMPLE ? '?sample' : '')}><div class="grow"><div class="t">Open the village</div><div class="s">The same data, as an island</div></div><${Chev} /></a></div>
    <div class="list">${mode === 'live' ? html`<${Row} title=${user || 'Signed in'} sub="Refresh or sign out" onClick=${e => { e.preventDefault(); openSheet(html`<${AccountSheet} />`); }} />` : html`<${Row} title="Sample data" sub="Sign in to see your own village" onClick=${e => { e.preventDefault(); location.href = location.pathname; }} />`}</div>`;
}
function People() {
  const { d, v } = store, tav = d.approvals.filter(a => a.house_id === 'tavern').slice(0, 10), contacts = d.record.find(r => r.house_id === 'tavern' && /contact/i.test(r.name));
  return html`<${Top} title="People" back="more" />
    <div class="h2">Networking</div>
    ${d.goals.filter(g => g.house_id === 'tavern').map(g => html`<${GoalCard} key=${g.id} g=${g} />`)}
    ${contacts && html`<div class="list"><${Row} href=${'#doc/' + contacts.id} title="Your networking list" sub=${'Updated ' + ago(contacts.updated_at)} /></div>`}
    ${tav.length > 0 && html`<div class="list">${tav.map(a => html`<${Row} key=${a.id} href=${'#draft/' + a.id} title=${a.title} sub=${ago(a.created_at)} right=${statusChip(a)} />`)}</div>`}
    <div class="h2">Long shots from the Well</div>
    ${d.wild.length ? d.wild.slice(0, 12).map(w => html`<div class="card" key=${w.id}><div style="display:flex;justify-content:space-between;gap:8px"><b>${w.person}</b>${w.status !== 'new' && html`<span class=${'chip ' + (w.status === 'saved' ? 'good' : '')}>${w.status}</span>`}</div>
      ${w.role && html`<div class="small muted">${w.role}</div>`}<p style="margin:6px 0">${w.why}</p><p class="small muted" style="margin:0">Route: ${w.route}</p>
      ${w.status === 'new' && html`<div class="actions"><button class="btn primary small" onClick=${() => saveWild(w, 'saved')}>Save</button><button class="btn small" onClick=${() => saveWild(w, 'dismissed')}>Dismiss</button><button class="btn small" onClick=${() => copyText(w.draft)}>Copy draft</button></div>`}</div>`)
      : html`<div class="card small muted">No long shots yet.</div>`}
    ${(v.rules.tavern || []).length > 0 && html`<div class="h2">Lessons the Tavern follows</div><div class="card"><ul class="log">${v.rules.tavern.map(a => html`<li key=${a.id}><span class="t">${ago(a.decided_at)}</span><span>${a.draft}</span></li>`)}</ul></div>`}`;
}
function Goals() { return html`<${Top} title="Goals" back="more" />${store.d.goals.map(g => html`<${GoalCard} key=${g.id} g=${g} edit=${true} />`)}`; }
function Houses() {
  const { d, v } = store, week = Date.now() - 7 * 864e5;
  return html`<${Top} title="Houses" back="more" /><div class="list">${ORDER.filter(h => d.houses[h]).map(id => {
    const h = d.houses[id], runs = (d.runs || []).filter(r => r.house_id === id && Date.parse(r.started_at) > week);
    const cost = runs.reduce((n, r) => n + (r.brain_provider === 'xai' ? 0 : ((+r.input_tokens || 0) * 4 + (+r.output_tokens || 0) * 20) / 1e6), 0);
    return html`<div class="row" style="cursor:default" key=${id}><div class="grow"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span class="t">${h.name}</span>
      ${(v.pending[id] || []).length ? html`<span class="chip warn">${v.pending[id].length} waiting</span>` : html`<span class="chip">${h.status === 'needs' ? 'Needs you' : h.status}</span>`}</div>
      <div class="s">${h.current_task || ''}</div><div class="s">${h.schedule || ''}${h.last_run_at ? ' · last run ' + ago(h.last_run_at) : ''}${runs.length ? ` · ${runs.length} runs this week, about $${cost.toFixed(2)}` : ''}</div></div></div>`; })}</div>
    <p class="small muted" style="margin:0 4px">Costs are Claude's (Opus 5.5 at $4 / $20 per million tokens). Grok searches are billed by xAI separately.</p>`;
}
function Record() {
  const { d } = store, by = {}; d.record.forEach(r => { (by[r.house_id] ||= []).push(r); });
  return html`<${Top} title="Your record" back="more" /><p class="small muted" style="margin:0 4px 10px">The material each house works from. Edits here reach the house on its next run.</p>
    ${ORDER.filter(h => by[h]).map(h => html`<div class="h2" key=${h}>${hname(h)}</div><div class="list">${by[h].map(r => html`<${Row} key=${r.id} href=${'#doc/' + r.id} title=${r.name} sub=${`Updated ${ago(r.updated_at)}${r.updated_by === 'you' ? ' by you' : ''}`} />`)}</div>`)}
    ${!d.record.length && html`<div class="empty">Nothing in your record yet.</div>`}`;
}
function Doc({ id }) {
  const doc = store.d.record.find(r => String(r.id) === String(id)), [edit, setEdit] = useState(false), [body, setBody] = useState('');
  if (!doc) return html`<${Top} title="Document" back="record" /><div class="empty">This document isn't in your record.</div>`;
  return html`<${Top} title=${doc.name} back="record" right=${!edit && html`<button class="btn small" onClick=${() => { setBody(doc.body); setEdit(true); }}>Edit</button>`} />
    <div class="small muted" style="margin:-4px 2px 10px">${hname(doc.house_id)} · updated ${ago(doc.updated_at)}</div>
    ${edit ? html`<textarea style="min-height:60dvh;font-family:ui-monospace,Menlo,monospace;font-size:14px" value=${body} onInput=${e => setBody(e.target.value)} aria-label=${'Edit ' + doc.name}></textarea>
      <div class="actions"><button class="btn primary" onClick=${async () => { await saveRecord(doc, body); setEdit(false); }}>Save</button><button class="btn" onClick=${() => setEdit(false)}>Cancel</button></div>`
      : html`<article class="doc" dangerouslySetInnerHTML=${{ __html: md(doc.body) }}></article>`}`;
}

/* ---------- sheets: PIN, account ---------- */
function PinSheet({ onDone, onCancel }) {
  const [p, setP] = useState(''), ref = useRef();
  useEffect(() => { setTimeout(() => ref.current && ref.current.focus(), 50); }, []);
  return html`<div class="sheet-bg"><form class="sheet" role="dialog" aria-label="Village PIN" onSubmit=${e => { e.preventDefault(); if (p) onDone(p); }}>
    <h2>Village PIN</h2><p class="small muted" style="margin:0 0 6px">Changes need your PIN. It stays in this tab until you close it.</p>
    <input ref=${ref} type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" value=${p} onInput=${e => setP(e.target.value)} aria-label="Village PIN" />
    <div class="actions"><button class="btn primary" type="submit">Continue</button><button class="btn" type="button" onClick=${onCancel}>Cancel</button></div></form></div>`;
}
function AccountSheet() {
  return html`<div class="sheet-bg" onClick=${ev => { if (ev.target === ev.currentTarget) closeSheet(); }}><div class="sheet" role="dialog" aria-label="Account">
    <h2>${store.user || 'Signed in'}</h2><div class="actions"><button class="btn" onClick=${() => { closeSheet(); reload(); }}>Refresh now</button>
    <button class="btn danger" onClick=${async () => { await sb.auth.signOut(); pin = null; closeSheet(); store.mode = null; store.d = null; emit(); }}>Sign out</button><button class="btn" onClick=${closeSheet}>Close</button></div></div></div>`;
}
function SignIn() {
  const [email, setEmail] = useState(localStorage.getItem('bv.email') ? JSON.parse(localStorage.getItem('bv.email')) : ''), [pass, setPass] = useState(''), [msg, setMsg] = useState('');
  const ready = cfg.supabaseUrl && cfg.anonKey && window.supabase;
  const go2 = async e => {
    e.preventDefault(); setMsg('Signing in…');
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) { setMsg(error.message); return; }
    try { localStorage.setItem('bv.email', JSON.stringify(email.trim())); } catch { /* private mode */ }
    setPass(''); await start(data.session);
  };
  return html`<div style="max-width:420px;margin:12vh auto 0;padding:0 18px"><h1 style="font-size:26px;margin:0 0 4px">Covenant Isle</h1><p class="muted" style="margin:0 0 18px">Sign in to your village.</p>
    ${ready ? html`<form onSubmit=${go2}><div class="field"><input type="email" autocomplete="username" placeholder="Email" value=${email} onInput=${e => setEmail(e.target.value)} aria-label="Email" /></div>
      <div class="field"><input type="password" autocomplete="current-password" placeholder="Password" value=${pass} onInput=${e => setPass(e.target.value)} aria-label="Password" /></div>
      <p class="err" role="alert">${msg}</p><button class="btn primary" type="submit" style="width:100%;justify-content:center;padding:11px">Sign in</button></form>`
      : html`<p class="muted">This page has no Supabase settings yet.</p>`}
    <p class="small muted" style="margin-top:18px">Only the village owner can see anything. <a href="?sample">Explore the sample instead</a>.</p></div>`;
}

/* ---------- the shell ---------- */
const TABS = [['today', 'Today', I.today], ['drafts', 'Drafts', I.drafts], ['jobs', 'Jobs', I.jobs], ['writing', 'Writing', I.writing], ['more', 'More', I.more]];
const TAB_OF = { draft: 'drafts', firm: 'jobs', resume: 'jobs', people: 'more', goals: 'more', houses: 'more', record: 'more', doc: 'more' };
function App() {
  const s = useStore(), { parts, q } = useRoute();
  if (!s.mode) return s.booting ? html`<div class="empty" style="margin-top:30vh">Loading…</div>` : html`<${SignIn} />`;
  if (!s.d) return html`<div class="empty" style="margin-top:30vh">Loading your village…</div>`;
  const [p0, p1] = parts, tab = TAB_OF[p0] || p0;
  const view = p0 === 'drafts' ? html`<${Drafts} q=${q} />` : p0 === 'draft' ? html`<${DraftView} id=${p1} />` : p0 === 'jobs' ? html`<${Jobs} />` : p0 === 'firm' ? html`<${Firm} name=${p1} />`
    : p0 === 'resume' ? html`<${ResumeView} id=${p1} />` : p0 === 'writing' ? html`<${Writing} />` : p0 === 'more' ? html`<${More} />` : p0 === 'people' ? html`<${People} />`
    : p0 === 'goals' ? html`<${Goals} />` : p0 === 'houses' ? html`<${Houses} />` : p0 === 'record' ? html`<${Record} />` : p0 === 'doc' ? html`<${Doc} id=${p1} />` : html`<${Today} />`;
  const tabLink = ([id, label, d]) => html`<a class=${'tab' + (tab === id ? ' on' : '')} href=${'#' + id} key=${id} aria-current=${tab === id ? 'page' : null}><${Icon} d=${d} />${label}${id === 'drafts' && s.v.waiting > 0 && html`<span class="badge">${s.v.waiting}</span>`}</a>`;
  return html`<div class="shell">
    <nav class="side" aria-label="Sections"><div class="brand">Covenant Isle</div>${TABS.slice(0, 4).map(tabLink)}${tabLink(['people', 'People', I.people])}<div class="sep"></div>${tabLink(['more', 'More', I.more])}</nav>
    <main class="main">${view}</main>
    <nav class="tabbar" aria-label="Sections">${TABS.map(tabLink)}</nav>
    ${s.ui.toast && html`<div class="toast" role="status">${s.ui.toast}</div>`}
    ${s.ui.sheet}
  </div>`;
}

/* ---------- start ---------- */
let sb = null;
async function start(session) {
  store.mode = 'live'; store.user = session && session.user ? session.user.email : null; emit();
  try { await loadLive(); } catch (e) { store.mode = null; emit(); toast(e.message, 6000); return; }
  setInterval(() => { if (!document.hidden) reload(true); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reload(true); });
}
render(html`<${App} />`, document.getElementById('app'));
addEventListener('keydown', e => { if (e.key === 'Escape' && store.ui.sheet) closeSheet(); });
(async () => {
  if (SAMPLE) {
    store.mode = 'sample'; const d = window.SAMPLE_DATA(); d.readings ||= []; d.resumes ||= []; d.record ||= []; d.runs = []; setData(d);
    window.__app = { store, go, downloadWord, resumeDocx };
    return;
  }
  if (cfg.supabaseUrl && cfg.anonKey && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    store.booting = true; emit();
    const { data } = await sb.auth.getSession();
    store.booting = false;
    if (data && data.session) { await start(data.session); return; }
  }
  emit();
})();

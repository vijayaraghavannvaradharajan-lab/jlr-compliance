/* =============================================================
   OFFICE WORK TRACKER - staff app (Phase 1)
   ============================================================= */
(() => {
'use strict';

const cfg = window.TRACKER_CONFIG || {};
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = $('#app');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const STATUSES = ['Pending data','In progress','Ready to file','Filed','Not applicable'];
const WORK_TYPES = ['GST','TDS','ROC/MCA','Other'];          // Income Tax removed (old items still open & show under Other)
const typesWith = cur => (cur && !WORK_TYPES.includes(cur) ? [...WORK_TYPES, cur] : WORK_TYPES);
const MAIN_TYPES = ['GST', 'TDS', 'ROC/MCA'];
const inTab = (r, k) => !k || (k === 'Other' ? !MAIN_TYPES.includes(r.work_type) : r.work_type === k);
const WT_TABS = [['', 'All'], ['GST', 'GST'], ['TDS', 'TDS'], ['ROC/MCA', 'MCA'], ['Other', 'Other']];
const waNum = p => { const d = (p || '').replace(/[^0-9]/g, ''); return d.length === 10 ? '91' + d : d; };
const waShare = (text, phone) => `https://wa.me/${phone ? waNum(phone) : ''}?text=${encodeURIComponent(text)}`;
const GST_SCHEMES = ['Monthly','QRMP','Composition','Not registered'];
const PERIOD_RULES = {
  prev_month: 'Previous month', prev_quarter: 'Previous quarter', prev_half: 'Previous half-year',
  prev_fy: 'Previous financial year', current_fy: 'Current financial year', none: 'Type manually'
};

let sb, me = null, profiles = [], clients = [], settings = {}, templates = [], rules = [];
const isAdmin = () => !!me && me.role === 'admin';                                   // settings, team, keys
const isPartner = () => !!me && ['admin', 'partner'].includes(me.role);               // + reports, delete, checklists
const isManager = () => !!me && ['admin', 'partner', 'manager'].includes(me.role);    // + all work, clients, billing
const ROLE_LABEL = { admin: 'Admin', partner: 'Partner', manager: 'Manager', staff: 'Team member' };

/* ---------- small helpers ---------- */
const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDate = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d} ${MONTHS[+m - 1]} ${y}`; };
const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wtClass = w => 'wt-' + (w || 'Other').replace(/[^A-Za-z]+/g, '-');
const profName = id => { const p = profiles.find(x => x.id === id); return p ? (p.full_name || p.email) : ''; };
const clientById = id => clients.find(c => c.id === id);
const clientName = id => clientById(id)?.name || '(deleted client)';
const activeStaff = () => profiles.filter(p => p.active);
const statusBadge = s => `<span class="st st-${slug(s)}">${esc(s)}</span>`;
const WT_ICONS = {
  'GST': '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"></path><path d="M9 7h6M9 11h6M9 15h4"></path>',
  'TDS': '<circle cx="7" cy="7" r="2.5"></circle><circle cx="17" cy="17" r="2.5"></circle><path d="M19 5L5 19"></path>',
  'Income Tax': '<path d="M7 4h11M7 9h11M10 4c3 0 5 1.6 5 4.5S13 13 10 13H7l8 7"></path>',
  'ROC/MCA': '<path d="M3 21h18M5 21V8l7-5 7 5v13"></path><path d="M9 21v-5h6v5M9 11h.01M15 11h.01"></path>',
  'Other': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>'
};
const wtIcon = (w, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WT_ICONS[w] || WT_ICONS.Other}</svg>`;
const wtBadge = w => `<span class="badge wt ${wtClass(w)}">${wtIcon(w)}${esc(w)}</span>`;
// Sub-work types (pick-list; staff can still type anything else)
const WORK_ITEMS = {
  'GST': ['GSTR-1', 'GSTR-1 (Quarterly)', 'IFF', 'GSTR-3B', 'GSTR-3B (Quarterly)', 'PMT-06', 'CMP-08', 'GSTR-4', 'GSTR-5', 'GSTR-5A', 'GSTR-6',
    'GSTR-7', 'GSTR-8', 'GSTR-9', 'GSTR-9C', 'GSTR-9 / 9C', 'GSTR-10', 'GSTR-11', 'ITC-04', 'ITC-03', 'DRC-03 payment', 'LUT (RFD-11)',
    'GST refund (RFD-01)', 'GSTR-2B reconciliation', 'E-invoice / IRN', 'E-way bill', 'GST registration (REG-01)', 'GST amendment (REG-14)',
    'GST cancellation (REG-16)', 'GST notice / ASMT-10 reply', 'GST audit / assessment'],
  'TDS': ['TDS deposit', 'TDS deposit (March)', 'TCS deposit', '24Q (salary)', '26Q (other than salary)', '27Q (non-resident)', '27EQ (TCS)',
    '26QB (property)', '26QC (rent)', '26QD (contractor / professional)', '26QE (crypto)', 'Form 16 (salary certificate)', 'Form 16A (TDS certificate)',
    'Form 138 (old 24Q – salary)', 'Form 140 (old 26Q – other than salary)', 'Form 144 (old 27Q – non-resident)', 'Form 143 (old 27EQ – TCS)', 'Form 141 (old 26QB/QC/QD)',
    'Form 130 (old Form 16)', 'Form 131 (old Form 16A)', 'Form 133 (old Form 27D)',
    'Form 16B / 16C / 16D', 'Form 27D (TCS certificate)', 'TDS correction return', 'Form 15G / 15H', 'Form 13 (lower deduction)',
    'Form 15CA / 15CB', 'TAN registration (49B)', 'TDS demand / default reply'],
  'Income Tax': ['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4', 'ITR-5', 'ITR-6', 'ITR-7', 'ITR-U (updated return)', 'Advance tax',
    'Self-assessment tax', 'Tax audit (3CA / 3CB-3CD)', 'Form 3CEB (transfer pricing)', 'Form 10B / 10BB', 'Form 10-IEA (regime choice)',
    'Form 67 (foreign tax credit)', 'Form 26AS / AIS review', 'Rectification (u/s 154)', 'IT notice reply', 'Appeal (CIT-A)', 'PAN application / correction'],
  'ROC/MCA': ['AOC-4', 'AOC-4 CFS', 'AOC-4 XBRL', 'MGT-7', 'MGT-7A', 'ADT-1', 'DIR-3 KYC', 'DIR-12', 'DPT-3', 'MSME-1', 'INC-20A', 'INC-22',
    'MGT-14', 'PAS-3', 'SH-7', 'CHG-1', 'BEN-2', 'LLP Form 11', 'LLP Form 8', 'LLP Form 3', 'LLP Form 4', 'Company incorporation (SPICe+)',
    'LLP incorporation (FiLLiP)', 'Strike off (STK-2)', 'Board / AGM minutes', 'AGM', 'First board meeting', 'ADT-1 (first auditor)',
    'MBP-1 / DIR-8', 'Share certificates', 'Statutory registers', 'ADT-3', 'CHG-4', 'INC-24', 'Demat of shares'],
  'Other': ['Accounting / bookkeeping', 'Bank reconciliation', 'Payroll', 'PF return (ECR)', 'ESI return', 'Professional tax', 'Statutory audit',
    'Internal audit', 'Stock audit', 'Udyam registration', 'Shop & establishment licence', 'Trade licence', 'Project report / CMA', 'Net worth certificate', 'Other']
};
const DATA_SOURCES = ['Email', 'WhatsApp', 'Google Drive', 'In person', 'Tally / software', 'Other'];
function workItemDatalists() {
  if (document.getElementById('dl-GST')) return;
  const box = document.createElement('div');
  box.hidden = true;
  box.innerHTML = Object.keys(WORK_ITEMS).map(k => `<datalist id="dl-${slug(k)}">${WORK_ITEMS[k].map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>`).join('');
  document.body.appendChild(box);
}
const dlFor = w => 'dl-' + slug(w || 'Other');
function linkTypeToList(el) {
  const t = el.querySelector('[name="work_type"]'), r = el.querySelector('[name="return_name"]');
  if (!t || !r) return;
  const sync = () => r.setAttribute('list', dlFor(t.value));
  sync(); t.addEventListener('change', sync);
}
const clientEmails = c => ((c && c.email) || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => /@/.test(x));
function gmailSearchUrl(c) {
  const em = clientEmails(c);
  if (!em.length) return '';
  return 'https://mail.google.com/mail/u/0/#search/' + encodeURIComponent(`from:(${em.join(' OR ')}) newer_than:60d`);
}
function requestMailUrl(c, t) {
  const em = clientEmails(c);
  if (!em.length) return '';
  const firm = settings.firm_name || cfg.FIRM_NAME || 'our office';
  const subject = `Data required: ${t.return_name} – ${t.period}`;
  const body = `Dear ${c.contact_person || 'Sir/Madam'},\n\nPlease share the data/documents for ${t.return_name} for ${t.period}` +
    (t.due_date ? ` (due on ${fmtDate(t.due_date)})` : '') + ` at the earliest, so that we can file it on time.\n\nRegards,\n${firm}`;
  return `mailto:${em.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
const isOpen = s => s !== 'Filed' && s !== 'Not applicable';
const lastDay = (y, m) => new Date(y, m, 0).getDate();           // m = 1..12
const dueDateFor = (day, y, m) => iso(new Date(y, m - 1, Math.min(day, lastDay(y, m))));
const fy = start => `FY ${start}-${String(start + 1).slice(2)}`;
const statusUrl = token => new URL('status.html?c=' + token, location.href).href;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const boardUrl = token => new URL('status.html?b=' + token, location.href).href;

function periodFor(rule, y, m) {                                   // y, m = due year/month (m 1..12)
  switch (rule) {
    case 'prev_month': { const d = new Date(y, m - 2, 1); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
    case 'prev_quarter': {
      let qm = m - 1, qy = y;
      if (qm < 1) { qm = 12; qy--; }
      while (qm % 3 !== 0) { qm--; if (qm < 1) { qm = 12; qy--; } }
      const q = { 6: 1, 9: 2, 12: 3, 3: 4 }[qm];
      return `Q${q} ${fy(qm === 3 ? qy - 1 : qy)}`;
    }
    case 'prev_half':
      if (m >= 4 && m <= 9) return `H2 (Oct–Mar) ${fy(y - 1)}`;
      return `H1 (Apr–Sep) ${fy(m >= 10 ? y : y - 1)}`;
    case 'prev_fy': return fy(m >= 4 ? y - 1 : y - 2);
    case 'current_fy': return fy(m >= 4 ? y : y - 1);
    default: return '';
  }
}

function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}
async function must(promise) {
  const r = await promise;
  if (r.error) throw r.error;
  return r;
}
function friendly(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/row-level security/i.test(m)) return 'You do not have permission to do that.';
  if (/client_code/i.test(m) && /column|schema cache/i.test(m)) return 'Client code is not set up yet — run update-session8.sql in Supabase first.';
  if (/clients_code_uq|client_code/i.test(m) && /duplicate|unique/i.test(m)) return 'This client code is already used by another client.';
  if (/duplicate key/i.test(m)) return 'This entry already exists.';
  return m;
}
function copy(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast('Link copied'))
    .catch(() => window.prompt('Copy this link:', text));
}
function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toCSV(rows) {
  return rows.map(r => r.map(v => {
    const s = (v ?? '').toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const opts = (list, sel, labelFn = x => x, valFn = x => x) =>
  list.map(x => `<option value="${esc(valFn(x))}" ${valFn(x) === sel ? 'selected' : ''}>${esc(labelFn(x))}</option>`).join('');
const staffOpts = (sel, { blank = 'Unassigned' } = {}) =>
  `<option value="">${esc(blank)}</option>` + opts(activeStaff(), sel, p => p.full_name || p.email, p => p.id);

function modal(title, body, { onSave, saveText = 'Save', wide = false, extra = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot">${extra}<span class="spacer"></span>
      <button class="btn ghost" data-x>${onSave ? 'Cancel' : 'Close'}</button>
      ${onSave ? `<button class="btn primary" data-save>${esc(saveText)}</button>` : ''}</div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  $$('[data-x]', wrap).forEach(b => b.onclick = close);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  if (onSave) {
    const btn = $('[data-save]', wrap);
    btn.onclick = async () => {
      btn.disabled = true;
      try { if ((await onSave(wrap)) !== false) close(); }
      catch (e) { toast(friendly(e), true); }
      finally { btn.disabled = false; }
    };
  }
  return { el: wrap, close };
}
const fv = (el, name) => { const f = el.querySelector(`[name="${name}"]`); return f ? f.value.trim() : ''; };

/* ---------- start up ---------- */
async function start() {
  if (!window.supabase && cfg.SUPABASE_URL && !/PASTE/.test(cfg.SUPABASE_URL)) {
    root.innerHTML = `<div class="auth-wrap"><div class="card auth"><div class="brand">${esc(cfg.FIRM_NAME || 'Office Work Tracker')}</div>
      <h2>Could not load the app</h2><p class="muted">A file the app needs didn't load. Press <b>Ctrl+Shift+R</b> to reload.
      If it still fails, an ad-blocker, antivirus or office firewall may be blocking it — try another browser, or ask IT to allow <b>${esc(location.host)}</b> and <b>${esc(new URL(cfg.SUPABASE_URL).host)}</b>.</p></div></div>`;
    return;
  }
  if (!window.supabase || !cfg.SUPABASE_URL || /PASTE/.test(cfg.SUPABASE_URL) || /PASTE/.test(cfg.SUPABASE_ANON_KEY || '')) {
    root.innerHTML = `<div class="auth-wrap"><div class="card auth"><div class="brand">${esc(cfg.FIRM_NAME || 'Office Work Tracker')}</div>
      <h2>Almost ready</h2><p class="muted">Open <b>config.js</b> and paste your Supabase Project URL and anon/publishable key, then upload the folder again.</p></div></div>`;
    return;
  }
  const recovering = /type=recovery/.test(location.hash);
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') showSetPassword();
    if (event === 'SIGNED_OUT' && me) { IDLE.stop(); me = null; showLogin('You were signed out.'); }   // signed out in another tab
  });
  const { data: { session } } = await sb.auth.getSession();
  if (recovering && session) return showSetPassword();
  session ? boot() : showLogin();
}

// ---------- sign-in screen: themed panel with animation + theme picker ----------
function authShell(formHtml) {
  const T = window.TrackerTheme, cur = T ? T.get() : { skin: 'original', anim: 'full' };
  const chips = [['GSTR-1', 'Filed', 'ok'], ['GSTR-3B', 'Due 20th', 'due'], ['TDS 26Q', 'In progress', 'wip'], ['AOC-4', 'Data received', 'ok'], ['MGT-7', 'Due 29th', 'due'], ['GSTR-2B', 'Reconciled', 'ok']];
  return `<div class="login">
    <section class="lg-art" aria-hidden="true">
      <div class="lg-fx"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="lg-art-in">
        <div class="lg-brand">${esc(cfg.FIRM_NAME || 'Office Work Tracker')}</div>
        <h1 class="lg-head">Every GST, TDS &amp; MCA deadline <span>on track.</span></h1>
        <p class="lg-sub">Returns, reconciliations, notices and client follow-ups — one place for the whole team.</p>
        <div class="lg-board">
          <svg class="lg-ring" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" pathLength="100"/><circle cx="21" cy="21" r="15.9" pathLength="100" stroke-dasharray="78 100"/></svg>
          <div class="lg-ring-t"><b>78%</b><small>filed this month</small></div>
          <div class="lg-chips">${chips.map(([n, s, k], i) => `<span class="lg-chip ${k}" style="--i:${i}"><b>${n}</b>${s}</span>`).join('')}</div>
        </div>
      </div>
    </section>
    <section class="lg-side">
      ${formHtml}
      <div class="lg-theme">
        <span class="muted small">Theme</span>
        <div class="lg-dots">${(T ? T.SKINS : []).map(([k, l, c]) => `<button type="button" class="lg-dot ${cur.skin === k ? 'on' : ''}" data-lsk="${k}" title="${l}" aria-label="${l} theme" aria-pressed="${cur.skin === k}" style="--c:${c}"></button>`).join('')}</div>
        <button type="button" class="lg-anim link small" data-lanim title="Animation: Full / Subtle / Off">${{ full: '✦ Animation on', subtle: '✧ Subtle', off: '○ Animation off' }[cur.anim] || '✦ Animation on'}</button>
      </div>
    </section></div>`;
}
function wireAuthShell() {
  const T = window.TrackerTheme; if (!T) return;
  $$('[data-lsk]').forEach(b => b.onclick = () => { T.setSkin(b.dataset.lsk);
    $$('[data-lsk]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  const ab = $('[data-lanim]');
  if (ab) ab.onclick = () => { const order = ['full', 'subtle', 'off'], n = order[(order.indexOf(T.get().anim) + 1) % 3]; T.setAnim(n);
    ab.textContent = { full: '✦ Animation on', subtle: '✧ Subtle', off: '○ Animation off' }[n]; };
  $$('[data-eye]').forEach(b => b.onclick = () => { const i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
}
const pwField = (label, name, extra) => `<label>${label}<span class="pw-wrap"><input name="${name}" type="password" ${extra}><button type="button" class="pw-eye" data-eye aria-label="Show password">Show</button></span></label>`;

/* ---------- v25: sign out after 5 minutes without activity ---------- */
const IDLE = {
  LIMIT: 5 * 60 * 1000, WARN: 60 * 1000, KEY: 'jlr-last-active', timer: null, last: 0, bar: null,
  stamp(force) { const t = Date.now(); if (!force && t - this.last < 5000) return; this.last = t; try { localStorage.setItem(this.KEY, String(t)); } catch (e) {} },
  lastSeen() { let v = 0; try { v = +localStorage.getItem(this.KEY) || 0; } catch (e) {} return Math.max(v, this.last); },
  expired() { const l = this.lastSeen(); return l > 0 && Date.now() - l >= this.LIMIT; },
  onAct: null,
  start() {
    this.stop(); this.stamp(true);
    this.onAct = () => { this.stamp(); if (this.bar) this.hideBar(); };
    ['mousedown', 'mousemove', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(ev => addEventListener(ev, this.onAct, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', this.vis = () => { if (!document.hidden) this.tick(); });
    this.timer = setInterval(() => this.tick(), 5000);
  },
  stop() {
    clearInterval(this.timer); this.timer = null; this.hideBar();
    if (this.onAct) ['mousedown', 'mousemove', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(ev => removeEventListener(ev, this.onAct, { capture: true }));
    if (this.vis) document.removeEventListener('visibilitychange', this.vis);
    this.onAct = this.vis = null;
  },
  tick() {
    if (!me) return this.stop();
    const left = this.LIMIT - (Date.now() - this.lastSeen());
    if (left <= 0) return this.signOut();
    if (left <= this.WARN) this.showBar(Math.ceil(left / 1000)); else this.hideBar();
  },
  showBar(sec) {
    if (!this.bar) {
      this.bar = document.createElement('div'); this.bar.className = 'idle-bar'; this.bar.setAttribute('role', 'alertdialog');
      this.bar.innerHTML = '<span>No activity for a while — you will be signed out in <b></b> seconds.</span><button class="btn primary sm" type="button">Stay signed in</button>';
      this.bar.querySelector('button').onclick = () => { this.stamp(true); this.hideBar(); };
      document.body.appendChild(this.bar);
    }
    this.bar.querySelector('b').textContent = sec;
  },
  hideBar() { if (this.bar) { this.bar.remove(); this.bar = null; } },
  async signOut() {
    this.stop(); me = null;
    try { await AUDIT.event('idle_sign_out'); } catch (e) {}
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
    history.replaceState(null, '', location.pathname);
    showLogin('You were signed out after 5 minutes without activity. Please sign in again.');
  }
};

function showLogin(msg) {
  IDLE.stop(); ['#helpFab', '#helpPane', '.modal-back', '.modal-wrap'].forEach(q => $$(q).forEach(x => x.remove()));
  root.innerHTML = authShell(`<form class="card auth" id="loginForm">
    <div class="auth-k">Welcome back</div>
    <h2>Sign in</h2>${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    <label>Email<input name="email" type="email" required autocomplete="username" placeholder="you@firm.in"></label>
    ${pwField('Password', 'password', 'required autocomplete="current-password"')}
    <button class="btn primary full" type="submit">Sign in</button>
    <button class="link small" type="button" id="forgot">Forgot password?</button></form>`);
  wireAuthShell();
  const f = $('#loginForm');
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) { toast(error.message, true); b.disabled = false; b.textContent = 'Sign in'; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
    else { f.classList.add('done'); IDLE.stamp(true); boot(); }
  };
  $('#forgot').onclick = async () => {
    const email = f.email.value.trim();
    if (!email) return toast('Type your email first, then click "Forgot password?"', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    error ? toast(error.message, true) : toast('A reset link has been sent to your email');
  };
}

function showSetPassword() {
  root.innerHTML = authShell(`<form class="card auth" id="pwForm">
    <div class="auth-k">Account</div><h2>Set a new password</h2>
    ${pwField('New password', 'p1', 'minlength="8" required autocomplete="new-password"')}
    ${pwField('Repeat password', 'p2', 'minlength="8" required autocomplete="new-password"')}
    <button class="btn primary full">Save password</button></form>`);
  wireAuthShell();
  $('#pwForm').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value !== f.p2.value) return toast('Passwords do not match', true);
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    if (error) return toast(error.message, true);
    toast('Password updated');
    history.replaceState(null, '', location.pathname + '#/dashboard');
    boot();
  };
}

async function boot() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return showLogin();
    if (IDLE.expired()) { try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {} return showLogin('You were signed out after 5 minutes without activity. Please sign in again.'); }
    const [{ data: prof }, refs] = await Promise.all([            // profile and lists in one round trip
      sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      loadRefs().then(() => null, e => e)
    ]);
    if (!prof) { await sb.auth.signOut(); return showLogin('Your login has no profile. Ask the admin to check the setup (schema.sql).'); }
    if (!prof.active) { await sb.auth.signOut(); return showLogin('Your account has been deactivated. Please contact the admin.'); }
    if (refs) throw refs;
    me = prof;
    IDLE.start();
    AUDIT.event('sign_in');
    renderShell();
    workItemDatalists();
    if (!/^#\//.test(location.hash)) history.replaceState(null, '', location.pathname + '#/dashboard');
    window.onhashchange = route;
    route();
  } catch (e) {
    root.innerHTML = `<div class="auth-wrap"><div class="card auth"><h2>Could not connect</h2><p class="error">${esc(friendly(e))}</p>
      <p class="muted small">Check the values in config.js and that schema.sql was run in Supabase.</p></div></div>`;
  }
}

async function loadRefs() {
  const [p, c, s, t, r] = await Promise.all([          // all in one round trip
    must(sb.from('profiles').select('*').order('full_name')),
    must(sb.from('clients').select('*').order('name')),
    must(sb.from('settings').select('*').eq('id', 1).maybeSingle()),
    sb.from('checklist_templates').select('*').order('id'),     // empty if update-checklists.sql has not been run yet
    sb.from('linked_rules').select('*').order('id')
  ]);
  profiles = p.data || []; clients = c.data || []; settings = s.data || {};
  templates = t.error ? [] : t.data || []; rules = r.error ? [] : r.data || [];
}

const canLayoutB = () => !!me && (me.role === 'admin' || me.role === 'staff');      // Performance layout: Admin and Team members only
function applyLayout() {
  const T = window.TrackerTheme; if (T && T.allowLayout) T.allowLayout(canLayoutB());
  if (T && T.allowLook) T.allowLook(canLayoutB());              // Professional only for Partners / Managers; Admin & Team can choose
  if (typeof GAME !== 'undefined') GAME.bar();
}
const NI = {   // menu icons (stroke SVG paths)
  dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"></path>',
  calendar: '<path d="M3 5h18v16H3zM16 2v5M8 2v5M3 10h18"></path>',
  work: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>',
  gst: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"></path><path d="M9 7h6M9 11h6"></path>',
  tds: '<circle cx="7" cy="7" r="2.5"></circle><circle cx="17" cy="17" r="2.5"></circle><path d="M19 5L5 19"></path>',
  gstw: '<path d="M4 4h16v16H4z"></path><path d="M8 9h8M8 13h8M8 17h5"></path>',
  acks: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5M9 14l2 2 4-4"></path>',
  docs: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
  profit: '<path d="M3 17l6-6 4 4 8-8"></path><path d="M14 7h7v7"></path>',
  activity: '<path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6"></path>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"></path>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"></path>',
  bank: '<path d="M3 10h18M12 3l9 5H3z"></path><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"></path>',
  tdsw: '<path d="M4 3h16v18H4zM8 7h8M8 11h3M13 11h3M8 15h3M13 15h3"></path>',
  mca: '<path d="M3 21h18M5 21V8l7-5 7 5v13"></path><path d="M9 21v-5h6v5"></path>',
  companies: '<path d="M4 21V4h10v17M14 9h6v12M4 21h18M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1"></path>',
  notices: '<path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path>',
  clients: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6 6 0 0 0-4-5.6"></path>',
  onboarding: '<path d="M9 11l3 3 8-8M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10"></path>',
  renewals: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"></path>',
  inbox: '<path d="M3 5h18v14H3zM3 7l9 6 9-6"></path>',
  clientreport: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h5"></path>',
  taxpay: '<path d="M2 6h20v13H2zM2 10h20M6 15h4"></path>',
  billing: '<path d="M7 4h10M7 9h10M10 4c3 0 5 1.6 5 4.5S13 13 10 13H7l8 7"></path>',
  workload: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path>',
  reports: '<path d="M3 3v18h18"></path><path d="M7 15l4-4 3 3 5-6"></path>',
  updates: '<path d="M4 4h16v12H5.2L4 17.2z"></path><path d="M8 8h8M8 12h5"></path>',
  checklists: '<path d="M9 6h11M9 12h11M9 18h11M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"></path>',
  calc: '<path d="M5 2h14v20H5zM8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8"></path>',
  team: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>'
};
const navIcon = k => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NI[k] || NI.work}</svg>`;
function navGroups() {
  const G = [
    ['Overview', [['dashboard', 'Dashboard'], ['calendar', 'Due-date calendar'], ['work', isManager() ? 'All work' : 'My work'], ['notices', 'All notices', 'notices']]],
    ['GST', [['work-gst', isManager() ? 'GST work' : 'My GST work', 'gstw'], ['gst', 'GST review', 'gst'], ['notices-gst', 'GST notices', 'notices']]],
    ['TDS', [['work-tds', isManager() ? 'TDS / TCS work' : 'My TDS work', 'tds'], ['tds', 'TDS working', 'tdsw'], ['notices-tds', 'TDS notices', 'notices']]],
    ['MCA', [['work-mca', isManager() ? 'MCA / ROC work' : 'My MCA work', 'mca'], ['mca', 'Companies & LLPs', 'companies'], ['notices-mca', 'MCA notices', 'notices']]],
    ['Tools', [['bank', 'Bank statements', 'bank'], ['acks', 'Filing acknowledgements'], ['calc', 'Late fee calculator'], ['checklists', 'Checklists'], ['updates', 'Law updates']]],
    ['Clients', [isManager() && ['clients', 'Clients'], ['docs', 'Documents for the month'], ['onboarding', 'Onboarding'], ['renewals', 'Renewals (DSC, LUT…)'], ['inbox', 'Client mail'], ['clientreport', 'Monthly client reports']]],
    ['Payments & billing', [['taxpay', 'Tax payment intimation'], isManager() && ['billing', 'Billing & fees']]],
    (isManager() || isPartner()) && ['Office', [['health', 'Client health'], isManager() && ['workload', 'Team workload'], isPartner() && ['profit', 'Fees & profitability'], isPartner() && ['reports', 'Reports'], isPartner() && ['activity', 'Activity log']]],
    isAdmin() && ['Admin', [['team', 'Team & logins'], ['settings', 'Settings']]]
  ].filter(Boolean);
  return G.map(([g, items]) => `<div class="side-g"><span class="side-gl">${esc(g)}</span>${items.filter(Boolean).map(([k, l, ic]) => {
    const href = k.startsWith('work-') ? '#/work' : k.startsWith('notices-') ? '#/notices' : '#/' + k;
    return `<a href="${href}" data-k="${k}">${navIcon(ic || k)}<span>${esc(l)}</span>${k === 'inbox' ? '<b class="side-badge" id="sideMail" hidden>0</b>' : ''}</a>`; }).join('')}</div>`).join('');
}
function renderShell() {
  applyLayout();
  const firm = settings.firm_name || cfg.FIRM_NAME || 'Office Work Tracker';
  root.innerHTML = `<div class="shell">
    <aside class="side" id="side" aria-label="Main menu">
      <a class="side-brand" href="#/dashboard"><span class="side-mark" aria-hidden="true">${esc((firm.trim()[0] || 'J').toUpperCase())}</span><span class="side-name"><b>${esc(firm)}</b><small>${esc(settings.firm_tagline || 'Chartered Accountants')}</small></span></a>
      <nav id="nav">${navGroups()}</nav>
    </aside>
    <div class="side-back" id="sideBack" hidden></div>
    <div class="col">
      <header class="top">
        <button class="icon-btn side-tog" id="sideTog" aria-label="Open menu" aria-controls="side" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"></path></svg></button>
        <div class="srch" role="search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
          <input id="gSearch" type="search" placeholder="Search client, GSTIN, PAN or return…" aria-label="Search client, GSTIN, PAN or return" autocomplete="off"><div class="srch-res" id="gRes" hidden></div></div>
        ${isManager() ? '<button class="btn primary top-new" id="topNew">+ New work</button><button class="btn top-cl" id="topClient">+ Client</button>' : ''}
        <div id="gameBar" class="game-bar" hidden></div>
        <a href="#/inbox" id="mailBadge" class="mail-badge" hidden title="New mail from clients">📥 <b>0</b></a>
        <div class="user"><button class="btn ghost sm user-btn" id="userBtn"><span class="u-av" aria-hidden="true">${esc(((me.full_name || me.email || '?').trim()[0] || '?').toUpperCase())}</span><span class="u-nm">${esc(me.full_name || me.email)}<small>${esc(ROLE_LABEL[me.role] || me.role)}</small></span> ▾</button>
          <div class="menu" id="userMenu" hidden>
            <div class="menu-info">${esc(me.email)}<br><span class="badge">${esc(ROLE_LABEL[me.role] || me.role)}</span></div>
            <button data-act="theme">Theme &amp; layout</button><button data-act="install">Install app on this device</button><button data-act="pw">Change password</button><button data-act="out">Sign out</button></div></div>
      </header>
      <main id="view"></main>
    </div></div>`;
  mountHelp();
  const menu = $('#userMenu');
  $('#userBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; const r = $('#gRes'); if (r) r.hidden = true; });
  menu.onclick = async e => {
    const act = e.target.dataset.act;
    if (act === 'out') { IDLE.stop(); me = null; await AUDIT.event('sign_out'); await sb.auth.signOut(); location.hash = ''; showLogin(); }
    if (act === 'pw') changePassword();
    if (act === 'theme') pickTheme();
    if (act === 'install') installApp();
  };
  // phone: menu slides in
  const side = $('#side'), back = $('#sideBack'), tog = $('#sideTog');
  const openSide = on => { side.classList.toggle('open', on); back.hidden = !on; tog.setAttribute('aria-expanded', on); };
  tog.onclick = () => openSide(!side.classList.contains('open'));
  back.onclick = () => openSide(false);
  $('#nav').addEventListener('click', e => {
    const a = e.target.closest('a[data-k]'); if (!a) return;
    const k = a.dataset.k;
    const WT = { 'work-gst': 'GST', 'work-tds': 'TDS', 'work-mca': 'ROC/MCA' }, ND = { 'notices-gst': 'GST', 'notices-tds': 'TDS', 'notices-mca': 'ROC/MCA', notices: '' };
    if (WT[k]) wf = { ...WF_DEFAULT, type: WT[k], status: 'open' };
    else if (k === 'work') wf = { ...WF_DEFAULT };
    if (k in ND) nf = { ...nf, dept: ND[k] };
    if ((WT[k] || k === 'work') && location.hash === '#/work') route();
    if (k in ND && location.hash === '#/notices') route();
    openSide(false);
  });
  if ($('#topNew')) $('#topNew').onclick = () => editTask(null, () => route());
  if ($('#topClient')) $('#topClient').onclick = () => editClient(null);
  bindSearch();
}
function bindSearch() {
  const inp = $('#gSearch'), res = $('#gRes'); if (!inp) return;
  let hits = [];
  const draw = () => {
    const q = lc(inp.value); if (!q) { res.hidden = true; return; }
    const qq = q.replace(/\s+/g, '');
    hits = clients.filter(c => [c.client_code, c.name, c.gstin, c.pan, c.tan, c.cin].some(x => lc(x).replace(/\s+/g, '').includes(qq))).slice(0, 6);
    res.innerHTML = hits.map((c, i) => `<button type="button" data-h="${i}"><b>${c.client_code ? `<span class="ccode">${esc(c.client_code)}</span> ` : ''}${esc(c.name)}</b><span>${esc([c.gstin, c.pan].filter(Boolean).join(' · ') || (c.services || []).join(', '))}</span></button>`).join('')
      + `<button type="button" data-h="q" class="srch-all">Search all work for “${esc(inp.value.trim())}”</button>`;
    res.hidden = false;
  };
  const go = h => {
    if (h === 'q') wf = { ...WF_DEFAULT, status: 'all', q: inp.value.trim() };
    else { const c = hits[+h]; if (!c) return; wf = { ...WF_DEFAULT, status: 'all', client: c.id }; }
    res.hidden = true; inp.value = ''; inp.blur();
    if (location.hash === '#/work') route(); else location.hash = '#/work';
  };
  inp.oninput = draw;
  inp.onclick = e => e.stopPropagation();
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(hits.length ? '0' : 'q'); } if (e.key === 'Escape') { res.hidden = true; inp.blur(); } };
  res.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-h]'); if (b) go(b.dataset.h); };
}

/* ---------- count-up numbers (respects the Animation setting) ---------- */
function countUp(root) {
  const lvl = document.documentElement.getAttribute('data-anim');
  if (lvl === 'off') return;
  const dur = lvl === 'subtle' ? 450 : 1100;
  $$('.mini b, .stat .n, .dept-count', root).forEach(el => {
    const txt = el.textContent, nums = txt.match(/\d+/g);
    if (!nums || txt.includes('₹')) return;
    const t0 = performance.now();
    const step = t => {
      const x = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - x, 3);
      let i = 0; el.textContent = txt.replace(/\d+/g, d => String(Math.round(+nums[i++] * e)));
      if (x < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  });
}

/* ---------- install as app (PWA) ---------- */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
async function installApp() {
  if (matchMedia('(display-mode: standalone)').matches) return toast('Already installed — you are using the app');
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; if (r.outcome === 'accepted') toast('Installed — find “JLR Tracker” on your home screen'); return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  modal('Install the tracker as an app', ios
    ? '<ol class="small" style="line-height:1.8"><li>Open this site in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with arrow).</li><li>Tap <b>Add to Home Screen</b> → <b>Add</b>.</li></ol>'
    : '<ol class="small" style="line-height:1.8"><li>Open this site in <b>Chrome</b> (phone or computer).</li><li>Tap the <b>⋮</b> menu (top right).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><p class="muted small">On a computer, you can also click the install icon at the right end of the address bar.</p>');
}

function changePassword() {
  modal('Change password', `<div class="form-grid">
      <label class="full">New password<input name="p1" type="password" minlength="8" autocomplete="new-password"></label>
      <label class="full">Repeat password<input name="p2" type="password" minlength="8" autocomplete="new-password"></label></div>`,
    { onSave: async el => {
      const p1 = $('[name=p1]', el).value, p2 = $('[name=p2]', el).value;
      if (p1.length < 8) { toast('Use at least 8 characters', true); return false; }
      if (p1 !== p2) { toast('Passwords do not match', true); return false; }
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      toast('Password changed');
    } });
}

const ACCENTS = [['blue', '#2667d1', 'Blue'], ['green', '#13795b', 'Green'], ['purple', '#5b3cc4', 'Purple'],
  ['maroon', '#9b1c3a', 'Maroon'], ['teal', '#0e7490', 'Teal'], ['orange', '#b45309', 'Orange']];
const SKIN_PREVIEW = { original: ['#eef4fd', '#2667d1', '#ffffff'], crimson: ['#111215', '#7d1a1a', '#e9c25a'], midnight: ['#0a0c11', '#1a2030', '#f2c94c'],
  velocity: ['#f3f5fb', '#16307f', '#ff4d63'], emerald: ['#0c1512', '#123a2e', '#2fd59c'] };
function pickTheme() {
  const T = window.TrackerTheme;
  if (!T) return toast('Theme is not available', true);
  const start = T.get();
  const okB = canLayoutB();
  const looks = [['pro', 'Professional', 'Clean and modern · light blue', 'lk-pro'], ['game', 'Game', 'Points, levels and streaks · purple', 'lk-game'], ['classic', 'Classic', 'The older layouts and colour themes below', 'lk-classic']];
  const body = `<div class="small muted" style="font-weight:600;margin-bottom:8px">Theme style</div>
    ${okB ? `<div class="layouts looks">${looks.map(([k, l, d, c]) => `<button type="button" class="lay ${start.look === k ? 'on' : ''}" data-lk="${k}" aria-pressed="${start.look === k}">
        <span class="lay-pv ${c}" aria-hidden="true"><i></i><i></i><i></i></span><b>${l}</b><span class="small muted">${d}</span></button>`).join('')}</div>`
      : '<p class="note small">Partners and Managers use the <b>Professional</b> theme.</p>'}
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Animation</div>
    <div class="seg" data-anim-seg>${[['full', 'Full'], ['subtle', 'Subtle'], ['off', 'Off']].map(([k, l]) =>
      `<button type="button" data-an="${k}" class="${start.anim === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div data-classic>
    <div class="small muted" style="font-weight:600;margin:18px 0 8px">Layout</div>
    <div class="layouts">
      <button type="button" class="lay ${start.layout !== 'b' || !okB ? 'on' : ''}" data-ly="a" aria-pressed="${start.layout !== 'b' || !okB}">
        <span class="lay-pv lay-a" aria-hidden="true"><i></i><i></i><i></i></span><b>Office</b><span class="small muted">Clean and calm · gentle animation · uses your theme below</span></button>
      <button type="button" class="lay ${start.layout === 'b' && okB ? 'on' : ''}" data-ly="b" aria-pressed="${start.layout === 'b' && okB}" ${okB ? '' : 'disabled'}>
        <span class="lay-pv lay-b" aria-hidden="true"><i></i><i></i><i></i></span><b>Performance</b><span class="small muted">${okB ? 'Dark, sharp corners, lots of animation · takes the colour of your theme' : 'For Admin and Team members only'}</span></button>
    </div>
    <div class="small muted" style="font-weight:600;margin:18px 0 8px">Theme</div>
    <div class="skins">${T.SKINS.map(([k, name]) => { const [bg, hero, acc] = SKIN_PREVIEW[k];
      return `<button type="button" class="skin ${start.skin === k ? 'on' : ''}" data-s="${k}" aria-pressed="${start.skin === k}">
        <span class="pv" style="background:${bg}"><i style="height:38px;background:${hero}"></i><i style="height:22px;background:${acc}"></i><i style="height:30px;background:${hero};opacity:.6"></i></span><b>${esc(name)}</b></button>`; }).join('')}</div>
    <div data-orig>
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Light / dark (Original theme)</div>
    <div class="seg" data-mode>${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Same as device']].map(([k, l]) =>
      `<button type="button" data-m="${k}" class="${start.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Accent colour (Original theme)</div>
    <div class="swatches">${ACCENTS.map(([k, c, l]) =>
      `<button type="button" class="swatch ${start.accent === k ? 'on' : ''}" data-a="${k}" title="${l}" aria-label="${l}" style="background:${c}"></button>`).join('')}</div></div></div>
    <p class="muted small" style="margin-top:16px">Saved on this device only — each person can pick their own. Changes show instantly.</p>`;
  const m = modal('Theme', body, { onSave: () => { toast('Theme saved'); route(); }, saveText: 'Done', wide: true,
    extra: '<button class="btn ghost" data-reset>Reset</button>' });
  const el = m.el;
  const sync = () => {
    const cur = T.get();
    $$('[data-s]', el).forEach(b => { b.classList.toggle('on', b.dataset.s === cur.skin); b.setAttribute('aria-pressed', b.dataset.s === cur.skin); });
    $$('[data-an]', el).forEach(b => b.classList.toggle('on', b.dataset.an === cur.anim));
    $$('[data-ly]', el).forEach(b => { const on = (cur.layout === 'b' && okB ? 'b' : 'a') === b.dataset.ly; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === cur.mode));
    $$('[data-a]', el).forEach(b => b.classList.toggle('on', b.dataset.a === cur.accent));
    $('[data-orig]', el).style.opacity = cur.skin === 'original' ? '1' : '.4';
    $('[data-orig]', el).style.pointerEvents = cur.skin === 'original' ? '' : 'none';
    $$('[data-lk]', el).forEach(b => { const on = b.dataset.lk === cur.look; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const cls = $('[data-classic]', el); cls.hidden = cur.look !== 'classic';
  };
  sync();
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lk && T.setLook) { T.setLook(b.dataset.lk); applyLayout(); sync(); }
    if (b.dataset.ly && !b.disabled) { T.setLayout(b.dataset.ly); applyLayout(); sync(); }
    if (b.dataset.s) { T.setSkin(b.dataset.s); sync(); }
    if (b.dataset.an) { T.setAnim(b.dataset.an); sync(); }
    if (b.dataset.m) { T.set(b.dataset.m, null); sync(); }
    if (b.dataset.a) { T.set(null, b.dataset.a); sync(); }
    if (b.hasAttribute('data-reset')) { T.reset(); sync(); }
  });
  // Cancel / close restores the previous choice
  $$('[data-x]', el).forEach(x => x.addEventListener('click', () => { T.setSkin(start.skin); T.setAnim(start.anim); T.set(start.mode, start.accent); if (T.setLayout) T.setLayout(start.layout); if (T.setLook && okB) T.setLook(start.look); applyLayout(); }));
}

const VIEWS = {};
async function route() {
  if (!me) return;
  GAME.bar();
  const key = location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  const adminOnly = ['clients', 'team', 'settings', 'billing', 'reports'];
  const need = { team: isAdmin, settings: isAdmin, reports: isPartner, clients: isManager, billing: isManager, workload: isManager, health: () => isManager() || isPartner(), activity: isPartner, profit: () => isPartner() && P4() }[key];
  if (!VIEWS[key] || (need && !need())) { location.hash = '#/dashboard'; return; }
  const navKey = key === 'work' ? ({ GST: 'work-gst', TDS: 'work-tds', 'ROC/MCA': 'work-mca' }[wf.type] || 'work') : key === 'notices' ? ({ GST: 'notices-gst', TDS: 'notices-tds', 'ROC/MCA': 'notices-mca' }[nf.dept] || 'notices') : key;
  $$('#nav a').forEach(a => { const on = a.dataset.k === navKey; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const v = $('#view');
  v.innerHTML = '<div class="loading">Loading…</div>';
  try { await VIEWS[key](v); }
  catch (e) { v.innerHTML = `<div class="card"><p class="error">Something went wrong: ${esc(friendly(e))}</p></div>`; }
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');      // page change animation (Theme → Animation)
  refreshMailBadge().catch(() => {});
}

/* ---------- shared task table ---------- */
function dataCell(r, can) {
  if (r.data_received_on && !r.fu_count) return `<div class="muted small" style="margin-top:4px">Data ✓ ${fmtDate(r.data_received_on).slice(0, 6)}${r.data_source ? ' · ' + esc(r.data_source) : ''}</div>`;
  if (r.data_received_on) return `<div class="muted small" style="margin-top:4px">Data ✓ ${fmtDate(r.data_received_on).slice(0, 6)}${r.data_source ? ' · ' + esc(r.data_source) : ''}</div>${fuLine(r)}`;
  if (r.status !== 'Pending data') return fuLine(r);
  const c = clientById(r.client_id);
  const g = gmailSearchUrl(c);
  const wl = can && c && c.phone ? `<a class="small" href="${esc(waShare(docsRequestMsg(c, r), c.phone))}" target="_blank" rel="noopener" title="Ask client on WhatsApp">WhatsApp</a>` : '';
  return `${fuLine(r)}<div class="row-acts">${can ? `<button class="link small" data-got="${r.id}">Got data</button>` : ''}${can && 'fu_count' in r ? `<button class="link small" data-fu="${r.id}">Follow-up</button>` : ''}${g ? `<a class="small" href="${esc(g)}" target="_blank" rel="noopener">Check mail</a>` : ''}${wl}</div>`;
}
function taskTable(rows, { showArn = true, showAssigned = true } = {}) {
  if (!rows.length) return '<div class="table-wrap"><div class="empty">Nothing here 🎉</div></div>';
  const t = today();
  const body = rows.map(r => {
    const can = isManager() || r.assigned_to === me.id;
    const late = r.due_date && r.due_date < t && isOpen(r.status);
    const statusCell = can
      ? `<select class="st st-${slug(r.status)}" data-status="${r.id}" aria-label="Status">${opts(STATUSES, r.status)}</select>`
      : statusBadge(r.status);
    const assignedCell = isManager()
      ? `<select data-assign="${r.id}" aria-label="Assigned to">${staffOpts(r.assigned_to || '')}</select>`
      : esc(profName(r.assigned_to) || '—');
    return `<tr class="${late ? 'overdue' : ''}">
      <td class="wrap"><b>${esc(clientName(r.client_id))}</b></td>
      <td>${wtBadge(r.work_type)}</td>
      <td>${esc(r.return_name)}<div class="muted small">${esc(r.period)}</div>${progChip(r)}</td>
      <td class="${late ? 'late' : ''}">${fmtDate(r.due_date)}</td>
      <td>${statusCell}${dataCell(r, can)}</td>
      ${showAssigned ? `<td>${assignedCell}</td>` : ''}
      ${showArn ? `<td class="small">${esc(r.arn || '')}${r.filed_on ? `<div class="muted">${fmtDate(r.filed_on)}</div>` : ''}</td>` : ''}
      <td class="row-btns"><button class="btn sm" data-edit="${r.id}">${can ? 'Edit' : 'View'}</button>${hasChecklist(r) ? `<button class="btn sm" data-chk="${r.id}" title="Checklist">☑ Checklist</button>` : ''}${can ? `<button class="btn sm ghost" data-lgk="${r.client_id}" title="Portal logins for this client" aria-label="Portal logins">🔑</button>` : ''}${can && r.work_type === 'GST' && /GSTR-(1|3B)\b/.test(r.return_name) && periodToMonth(r.period) ? `<button class="btn sm ghost" data-grv="${r.id}" title="GST review for this month" aria-label="GST review">📊</button>` : ''}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Type</th><th>Return / Period</th><th>Due</th><th>Status</th>
    ${showAssigned ? '<th>Assigned</th>' : ''}${showArn ? '<th>ARN / Filed</th>' : ''}<th></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function bindTaskTable(el, rows, refresh) {
  el.addEventListener('change', async e => {
    const sid = e.target.dataset.status, aid = e.target.dataset.assign;
    if (!sid && !aid) return;
    const id = sid || aid;
    const patch = sid ? { status: e.target.value } : { assigned_to: e.target.value || null };
    if (sid && e.target.value === 'Filed') {
      const arn = window.prompt('Filed! Enter the ARN / acknowledgement number (optional):', '');
      if (arn) patch.arn = arn.trim();
    }
    e.target.disabled = true;
    try {
      await must(sb.from('tasks').update(patch).eq('id', id));
      toast('Saved');
      const row = rows.find(r => r.id === id); if (row) Object.assign(row, patch);
      if (sid) e.target.className = `st st-${slug(e.target.value)}`;
      if (sid && e.target.value === 'Filed') refresh();
    } catch (err) { toast(friendly(err), true); refresh(); }
    finally { e.target.disabled = false; }
  });
  el.addEventListener('click', e => {
    const id = e.target.dataset.edit;
    if (id) editTask(rows.find(r => r.id === id), refresh);
    const gid = e.target.dataset.got;
    if (gid) gotData(rows.find(r => r.id === gid), refresh);
    const fid = e.target.dataset.fu;
    if (fid) logFollowup({ kind: 'task', task: rows.find(r => r.id === fid) }, refresh);
    const gv = e.target.closest('[data-grv]')?.dataset.grv;
    if (gv) { const t = rows.find(r => r.id === gv); grClient = t.client_id; grMonth = periodToMonth(t.period); location.hash = '#/gst'; }
    const lk = e.target.closest('[data-lgk]')?.dataset.lgk;
    if (lk) openLogins(clientById(lk));
    const cid = e.target.closest('[data-chk]')?.dataset.chk;
    if (cid) openChecklist(rows.find(r => r.id === cid), refresh);
  });
}

function gotData(task, refresh) {
  if (!task) return;
  modal('Client data received', `<p class="muted small" style="margin-top:0"><b>${esc(clientName(task.client_id))}</b> · ${esc(task.return_name)} · ${esc(task.period)}</p>
    <div class="form-grid">
      <label>Received on<input type="date" name="d_on" value="${today()}"></label>
      <label>Received by<select name="d_src">${opts(DATA_SOURCES, 'Email')}</select></label>
      <label class="full">Note (optional)<input name="d_note" placeholder="e.g. Sales register + purchase bills"></label>
    </div><p class="muted small">Status will move from “Pending data” to “In progress”.</p>`, {
    saveText: 'Save',
    onSave: async el => {
      const note = fv(el, 'd_note');
      const rec = { data_received_on: fv(el, 'd_on') || today(), data_source: fv(el, 'd_src'), status: 'In progress' };
      if (note) rec.remarks = ((task.remarks || '') + ' [Data: ' + note + ']').trim();
      await must(sb.from('tasks').update(rec).eq('id', task.id));
      toast('Marked as data received'); refresh();
    }
  });
}

function editTask(task, refresh) {
  const isNew = !task;
  task = task || { status: 'Pending data', work_type: 'GST' };
  const admin = isManager();
  const can = admin || task.assigned_to === me.id;
  const dis = admin ? '' : 'disabled';
  const ro = can ? '' : 'disabled';
  const body = `<div class="form-grid">
    <label class="full">Client<select name="client_id" ${dis}>${isNew ? '<option value="">Select client…</option>' : ''}${opts(clients.filter(c => c.active || c.id === task.client_id), task.client_id, cLabel, c => c.id)}</select></label>
    <label>Work type<select name="work_type" ${dis}>${opts(typesWith(task.work_type), task.work_type)}</select></label>
    <label>Return / task<input autocomplete="off" name="return_name" list="${dlFor(task.work_type)}" value="${esc(task.return_name || '')}" placeholder="Pick or type, e.g. GSTR-3B" ${dis}></label>
    <label>Period<input name="period" value="${esc(task.period || '')}" placeholder="e.g. Oct 2026" ${dis}></label>
    <label>Due date<input name="due_date" type="date" value="${esc(task.due_date || '')}" ${dis}></label>
    <label>Assigned to<select name="assigned_to" ${dis}>${staffOpts(task.assigned_to || '')}</select></label>
    <label>Status<select name="status" ${ro}>${opts(STATUSES, task.status)}</select></label>
    <label>ARN / Ack. no.<input name="arn" value="${esc(task.arn || '')}" ${ro}></label>
    ${admin && P4() ? `<label>Fee (₹)<input name="fee" type="number" min="0" value="${esc(task.fee ?? '')}" placeholder="${isNew ? 'from Fee list' : ''}"></label>` : ''}
    <label>Filed on<input name="filed_on" type="date" value="${esc(task.filed_on || '')}" ${ro}></label>
    <label>Client data received on<input name="data_received_on" type="date" value="${esc(task.data_received_on || '')}" ${ro}></label>
    <label>Received by<select name="data_source" ${ro}><option value="">—</option>${opts(DATA_SOURCES, task.data_source || '')}</select></label>
    ${!isNew && clientEmails(clientById(task.client_id)).length ? `<div class="full toolbar" style="margin:0">
      <a class="btn sm" href="${esc(gmailSearchUrl(clientById(task.client_id)))}" target="_blank" rel="noopener">Check client mail in Gmail</a>
      <a class="btn sm" href="${esc(requestMailUrl(clientById(task.client_id), task))}">Email client for data</a></div>` : ''}
    <label class="full">Remarks<textarea name="remarks" ${ro}>${esc(task.remarks || '')}</textarea></label>
    ${!isNew ? `<div class="full ack-row" data-ackrow>${can ? '<button type="button" class="btn sm" data-ackread>📄 Read acknowledgement PDF</button> <span class="muted small">fills ARN and date and marks it Filed</span>' : ''}</div>` : ''}
    ${!isNew ? `<p class="muted small full">Last updated ${new Date(task.updated_at).toLocaleString('en-IN')}${task.updated_by ? ' by ' + esc(profName(task.updated_by)) : ''}</p>` : ''}
  </div>`;
  const extra = (isPartner() && !isNew ? '<button class="btn danger" data-del>Delete</button><button class="btn ghost" type="button" data-hist>History</button>' : '') +
    (!isNew ? '<button class="btn" data-chkl>☑ Checklist</button>' : '') + (!isNew && can && 'fu_count' in task ? `<button class="btn" data-fulog>Follow-up${task.fu_count ? ' (' + task.fu_count + ')' : ''}</button>` : '');
  const m = modal(isNew ? 'Add work' : 'Work details', body, {
    extra,
    onSave: can ? async el => {
      const rec = { status: fv(el, 'status'), arn: fv(el, 'arn') || null, filed_on: fv(el, 'filed_on') || null, remarks: fv(el, 'remarks') || null,
        data_received_on: fv(el, 'data_received_on') || null, data_source: fv(el, 'data_source') || null };
      if (admin) Object.assign(rec, {
        client_id: fv(el, 'client_id'), work_type: fv(el, 'work_type'), return_name: fv(el, 'return_name'),
        period: fv(el, 'period'), due_date: fv(el, 'due_date') || null, assigned_to: fv(el, 'assigned_to') || null
      });
      if (admin && P4() && fv(el, 'fee') !== '') rec.fee = num(fv(el, 'fee'));
      else if (admin && P4() && !isNew) rec.fee = null;
      if (admin && (!rec.client_id || !rec.return_name || !rec.period)) { toast('Client, return and period are required', true); return false; }
      if (isNew) await must(sb.from('tasks').insert(rec));
      else await must(sb.from('tasks').update(rec).eq('id', task.id));
      toast('Saved'); refresh();
    } : null
  });
  linkTypeToList(m.el);
  const chk = $('[data-chkl]', m.el);
  if (chk) chk.onclick = () => { m.close(); openChecklist(task, refresh); };
  const ful = $('[data-fulog]', m.el);
  if (ful) ful.onclick = () => { m.close(); logFollowup({ kind: 'task', task }, refresh); };
  const akb = $('[data-ackread]', m.el);
  if (akb) akb.onclick = () => ackForTask(task, () => { m.close(); refresh(); });
  if (!isNew) safe(sb.from('filing_acks').select('*').eq('task_id', task.id).order('created_at', { ascending: false }).limit(3)).then(r => {
    const row = $('[data-ackrow]', m.el); if (!row || r.error || !r.data.length) return;
    row.insertAdjacentHTML('beforeend', `<div class="small" style="margin-top:6px">Saved acknowledgement: ${r.data.map(a => `${a.file_path ? `<button type="button" class="link" data-akopen="${a.id}">${esc(a.file_name || 'PDF')}</button>` : esc(a.arn || '')} <span class="muted">${a.filed_on ? fmtDate(a.filed_on) : ''}</span>`).join(' · ')}</div>`);
    row.onclick = e => { const id = e.target.dataset.akopen; if (id) ACK.open(r.data.find(a => a.id === id)); };
  });
  if ($('[data-hist]', m.el)) $('[data-hist]', m.el).onclick = () => showHistory('tasks', task.id, `${clientName(task.client_id)} · ${task.return_name} ${task.period || ''}`);
  const del = $('[data-del]', m.el);
  if (del) del.onclick = async () => {
    if (!confirm('Delete this work item permanently?')) return;
    try { await must(sb.from('tasks').delete().eq('id', task.id)); toast('Deleted'); m.close(); refresh(); }
    catch (e) { toast(friendly(e), true); }
  };
}

/* ---------- CHECKLISTS ---------- */
const lc = s => (s || '').trim().toLowerCase();
const templateFor = name => templates.find(t => (t.matches || []).some(m => lc(m) === lc(name)));
const rulesFor = name => rules.filter(r => (r.matches || []).some(m => lc(m) === lc(name)));
const hasChecklist = r => templates.length > 0 || r.checks_total > 0;
function progChip(r) {
  if (!r.checks_total) return '';
  const pct = Math.round(100 * r.checks_done / r.checks_total);
  return `<div class="prog-chip ${pct === 100 ? 'full' : ''}" title="Checklist ${r.checks_done} of ${r.checks_total} done">
    <span class="prog"><i style="width:${pct}%"></i></span>${r.checks_done}/${r.checks_total}</div>`;
}

// Create follow-up work items for linked rules (admin only)
async function createFollowups({ client_id, list, evDate, period, assigned_to, parent }) {
  const seen = new Set();
  const recs = list.filter(r => !seen.has(r.task_return) && seen.add(r.task_return)).map(r => ({
    client_id, work_type: r.work_type, return_name: r.task_return, period,
    due_date: r.due_days != null && evDate ? iso(addDays(new Date(evDate + 'T00:00:00'), r.due_days)) : null,
    assigned_to: assigned_to || null, status: 'In progress', parent_task: parent || null,
    remarks: `Follow-up: ${r.action}${r.form ? ' (' + r.form + ')' : ''}. Rule: ${r.due_rule || '-'}${r.law ? ' · ' + r.law : ''}`
  }));
  if (!recs.length) return 0;
  await must(sb.from('tasks').upsert(recs, { onConflict: 'client_id,return_name,period', ignoreDuplicates: true }));
  return recs.length;
}

async function openChecklist(task, refresh = () => {}) {
  if (!task) return;
  const can = isManager() || task.assigned_to === me.id;
  const m = modal('Checklist & documents', `<p class="muted small" style="margin-top:0"><b>${esc(clientName(task.client_id))}</b> · ${esc(task.return_name)} · ${esc(task.period)} · Due ${fmtDate(task.due_date)}</p>
    <div data-docs></div><div data-files></div><div data-ckmain><div class="loading">Loading…</div></div>`, { wide: true });
  const body = $('[data-ckmain]', m.el);
  docsSection(task, can, $('[data-docs]', m.el), () => { changed = true; }).catch(() => {});
  renderClientFiles($('[data-files]', m.el), task).catch(() => {});
  let items = [], existing = [], changed = false;
  $$('[data-x]', m.el).forEach(b => b.addEventListener('click', () => { if (changed) refresh(); }));
  const linked = rulesFor(task.return_name);

  const load = async () => {
    items = (await must(sb.from('task_checks').select('*').eq('task_id', task.id).order('seq'))).data || [];
    items.sort((x, y) => x.seq - y.seq);
    if (linked.length) {
      existing = (await must(sb.from('tasks').select('return_name,status,due_date').eq('client_id', task.client_id)
        .eq('period', task.period).in('return_name', linked.map(r => r.task_return)))).data || [];
    }
    draw();
  };
  const start = async tpl => {
    const recs = (tpl.steps || []).map((st, i) => ({ task_id: task.id, seq: i + 1, check_name: st.name, who: st.who || null }));
    await must(sb.from('task_checks').upsert(recs, { onConflict: 'task_id,seq', ignoreDuplicates: true }));
    changed = true; await load();
  };
  const save = async (id, patch) => {
    const { data } = await must(sb.from('task_checks').update(patch).eq('id', id).select().single());
    const i = items.findIndex(x => x.id === id); if (i >= 0) items[i] = data;
    changed = true;
  };

  const linkedBlock = () => {
    if (!linked.length) return '';
    const ev = task.filed_on || today();
    const have = n => existing.find(x => lc(x.return_name) === lc(n));
    const rowsH = linked.map(r => {
      const ex = have(r.task_return);
      return `<tr><td>${isManager() && !ex ? `<input type="checkbox" data-rule="${r.id}" checked aria-label="Select">` : ''}</td>
        <td class="wrap"><b>${esc(r.action)}</b><div class="muted small">${esc(r.trigger_event)}</div></td>
        <td><span class="badge">${esc(r.form || '')}</span></td>
        <td class="wrap small">${esc(r.due_rule || '')}</td>
        <td class="small" data-due="${r.id}"></td>
        <td>${ex ? `<span class="st st-${slug(ex.status)}">Created · ${esc(ex.status)}</span>` : '<span class="muted small">Not created</span>'}</td></tr>`;
    }).join('');
    return `<div class="ck-linked">
      <h4>Don't miss — linked follow-up filings</h4>
      <p class="muted small">These are usually needed after <b>${esc(task.return_name)}</b>. ${isManager() ? 'Tick the ones that apply and create them as work items.' : 'Ask the admin to create them as work items.'}</p>
      ${isManager() ? `<div class="toolbar" style="margin:0 0 8px"><label class="small">Event date (e.g. date of incorporation)
        <input type="date" id="evDate" value="${esc(ev)}"></label></div>` : ''}
      <div class="table-wrap"><table><thead><tr><th></th><th>Follow-up</th><th>Form</th><th>Due rule</th><th>Due date</th><th>Status</th></tr></thead>
      <tbody>${rowsH}</tbody></table></div>
      ${isManager() ? '<div style="margin-top:10px"><button class="btn primary" id="mkFollow">Create selected as work items</button></div>' : ''}</div>`;
  };
  const showDue = () => {
    const ev = $('#evDate', body)?.value || task.filed_on || today();
    linked.forEach(r => {
      const td = $(`[data-due="${r.id}"]`, body); if (!td) return;
      td.textContent = r.due_days != null ? fmtDate(iso(addDays(new Date(ev + 'T00:00:00'), r.due_days))) : 'Set manually';
    });
  };
  const bindLinked = () => {
    showDue();
    const evI = $('#evDate', body); if (evI) evI.onchange = showDue;
    const mk = $('#mkFollow', body);
    if (mk) mk.onclick = async () => {
      const ids = $$('[data-rule]', body).filter(x => x.checked).map(x => +x.dataset.rule);
      if (!ids.length) return toast('Tick at least one follow-up', true);
      mk.disabled = true;
      try {
        const n = await createFollowups({ client_id: task.client_id, list: linked.filter(r => ids.includes(r.id)),
          evDate: $('#evDate', body).value, period: task.period, assigned_to: task.assigned_to, parent: task.id });
        toast(`${n} follow-up work item${n === 1 ? '' : 's'} created`); changed = true; await load();
      } catch (e) { toast(friendly(e), true); mk.disabled = false; }
    };
  };

  const draw = () => {
    const head = '<h4 class="ck-title">Work checklist</h4>';
    if (!items.length) {
      const tpl = templateFor(task.return_name);
      body.innerHTML = head + (can && templates.length ? `<div class="ck-start">
          <p style="margin-top:0">${tpl ? `Standard checklist found: <b>${esc(tpl.name)}</b> (${(tpl.steps || []).length} steps).` : 'No standard checklist is linked to this return. Pick one:'}</p>
          <div class="toolbar" style="margin:0"><select id="tplPick">${opts(templates, tpl ? tpl.id : templates[0].id, t => `${t.work_type} · ${t.name}`, t => t.id)}</select>
          <button class="btn primary" id="tplGo">Start checklist</button></div></div>`
        : '<div class="empty">Checklist not started yet.</div>') + linkedBlock();
      const go = $('#tplGo', body);
      if (go) go.onclick = async () => {
        go.disabled = true;
        try { await start(templates.find(t => t.id === +$('#tplPick', body).value)); }
        catch (e) { toast(friendly(e), true); go.disabled = false; }
      };
      bindLinked();
      return;
    }
    const act = items.filter(i => i.status !== 'N/A');
    const done = act.filter(i => i.status === 'Done').length;
    const pct = act.length ? Math.round(100 * done / act.length) : 0;
    const dis = can ? '' : 'disabled';
    const rowsH = items.map((i, k) => `<tr class="ck-row ck-${slug(i.status)}">
        <td class="c">${i.seq}</td>
        ${can ? `<td class="ck-move"><button class="icon-btn sm" data-up="${i.id}" ${k === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="icon-btn sm" data-down="${i.id}" ${k === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></td>` : ''}
        <td class="wrap"><label class="ck-l"><input type="checkbox" data-ck="${i.id}" ${i.status === 'Done' ? 'checked' : ''} ${i.status === 'N/A' ? 'disabled' : dis}><span>${esc(i.check_name)}</span></label></td>
        <td class="small muted">${esc(i.who || '')}</td>
        <td class="small">${i.status === 'Done' ? `${fmtDate(i.completed_on)}<div class="muted">${esc(profName(i.completed_by) || '')}</div>` : (i.status === 'N/A' ? '<span class="muted">N/A</span>' : '')}</td>
        <td><input class="ck-rem" data-rem="${i.id}" value="${esc(i.remarks || '')}" placeholder="Remark" ${dis}></td>
        <td class="nowrap">${can ? `<button class="link small" data-na="${i.id}">${i.status === 'N/A' ? 'Undo N/A' : 'N/A'}</button>` : ''}${isManager() ? ` <button class="link small danger-t" data-del="${i.id}" aria-label="Remove step">✕</button>` : ''}</td></tr>`).join('');
    body.innerHTML = head + `<div class="ck-bar"><span class="prog big"><i style="width:${pct}%"></i></span><b>${pct}%</b><span class="muted small">${done} of ${act.length} steps done</span></div>
      <div class="table-wrap"><table class="ck-table"><thead><tr><th>Seq</th>${can ? '<th class="ck-move">Move</th>' : ''}<th>Check name</th><th>Who</th><th>Completed</th><th>Remarks</th><th></th></tr></thead>
      <tbody>${rowsH}</tbody></table></div>
      ${can ? `<div class="toolbar" style="margin-top:10px"><input id="newStep" placeholder="Add a step for this work…" style="flex:1;min-width:220px"><button class="btn" id="addStep">+ Add step</button></div>` : ''}`
      + linkedBlock();
    bindLinked();
  };

  body.addEventListener('change', async e => {
    const t = e.target;
    try {
      if (t.dataset.ck) { await save(t.dataset.ck, { status: t.checked ? 'Done' : 'Pending' }); draw(); }
      if (t.dataset.rem) { await save(t.dataset.rem, { remarks: t.value.trim() || null }); toast('Remark saved'); }
    } catch (err) { toast(friendly(err), true); load(); }
  });
  body.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.na) {
        const it = items.find(x => x.id === b.dataset.na);
        await save(it.id, { status: it.status === 'N/A' ? 'Pending' : 'N/A' }); draw();
      }
      if (b.dataset.del) {
        if (!confirm('Remove this step from this work item?')) return;
        await must(sb.from('task_checks').delete().eq('id', b.dataset.del)); changed = true; await load();
      }
      if (b.dataset.up || b.dataset.down) {
        const k = items.findIndex(x => x.id === (b.dataset.up || b.dataset.down));
        const j = b.dataset.up ? k - 1 : k + 1;
        const a = items[k], c = items[j]; if (!a || !c) return;
        const [aId, aSeq, cId, cSeq] = [a.id, a.seq, c.id, c.seq];
        await must(sb.from('task_checks').update({ seq: -1 }).eq('id', aId));
        await must(sb.from('task_checks').update({ seq: aSeq }).eq('id', cId));
        await must(sb.from('task_checks').update({ seq: cSeq }).eq('id', aId));
        changed = true; await load();
      }
      if (b.id === 'addStep') {
        const name = $('#newStep', body).value.trim(); if (!name) return;
        const seq = Math.max(0, ...items.map(x => x.seq)) + 1;
        await must(sb.from('task_checks').insert({ task_id: task.id, seq, check_name: name, who: 'Staff' }));
        changed = true; await load();
      }
    } catch (err) { toast(friendly(err), true); load(); }
  });
  try { await load(); } catch (e) { body.innerHTML = `<p class="error">${esc(friendly(e))}</p>`; }
}

let ckTab = 'lists', ckTrig = '';
VIEWS.checklists = async v => {
  const admin = isManager();
  const groups = WORK_TYPES.map(w => [w, templates.filter(t => t.work_type === w)]).filter(([, l]) => l.length);
  const triggers = [...new Set(rules.map(r => r.trigger_event))];
  v.innerHTML = `<div class="page-head"><h2>Checklists</h2><span class="spacer"></span>
      ${admin ? '<button class="btn" id="evBtn">+ Follow-ups for an event</button>' : ''}${isPartner() ? '<button class="btn primary" id="newTpl">+ New checklist</button>' : ''}</div>
    <div class="seg" style="margin-bottom:16px"><button data-tab="lists" class="${ckTab === 'lists' ? 'on' : ''}">Work checklists (${templates.length})</button>
      <button data-tab="linked" class="${ckTab === 'linked' ? 'on' : ''}">Linked follow-up filings (${rules.length})</button></div>
    ${!templates.length && !rules.length ? '<div class="card"><p class="note">Checklists are not set up yet. Run <b>update-checklists.sql</b> in Supabase → SQL Editor, then reload this page.</p></div>' : ''}
    <div id="ckBody"></div>`;
  const box = $('#ckBody');
  if (ckTab === 'lists') {
    box.innerHTML = `<p class="muted small">Open any work item and press <b>☑ Checklist</b> to tick steps. The right checklist is picked from the return name.</p>` +
      groups.map(([w, list]) => `<h3 class="ck-group">${wtBadge(w)}</h3><div class="ck-cards">${list.map(t => `
        <details class="card ck-card"><summary><b>${esc(t.name)}</b><span class="muted small">${(t.steps || []).length} steps</span></summary>
          <div class="muted small" style="margin:6px 0">Used for: ${(t.matches || []).map(x => `<span class="badge">${esc(x)}</span>`).join(' ') || '—'}</div>
          ${(t.docs || []).length ? `<div class="muted small" style="margin:6px 0">Documents from client: ${t.docs.map(x => esc(x)).join(' · ')}</div>` : ''}
          <ol class="ck-steps">${(t.steps || []).map(s => `<li>${esc(s.name)}${s.who && s.who !== 'Staff' ? ` <span class="badge">${esc(s.who)}</span>` : ''}</li>`).join('')}</ol>
          ${isPartner() ? `<button class="btn sm" data-edit-tpl="${t.id}">Edit checklist</button>` : ''}</details>`).join('')}</div>`).join('');
  } else {
    const list = ckTrig ? rules.filter(r => r.trigger_event === ckTrig) : rules;
    box.innerHTML = `<div class="toolbar"><select id="trigF"><option value="">All events</option>${opts(triggers, ckTrig)}</select>
        <span class="muted small">When the event happens, these filings are often missed. Due dates follow the law — check for extensions.</span></div>
      <div class="table-wrap"><table><thead><tr><th>When this happens</th><th>Do not miss</th><th>Form</th><th>Due date rule</th><th>Applies to</th><th>Law</th></tr></thead><tbody>
      ${list.map(r => `<tr><td class="wrap"><b>${esc(r.trigger_event)}</b></td><td class="wrap">${esc(r.action)}</td><td><span class="badge">${esc(r.form || '')}</span></td>
        <td class="wrap small">${esc(r.due_rule || '')}</td><td class="wrap small">${esc(r.applies_to || '')}</td><td class="small muted">${esc(r.law || '')}</td></tr>`).join('')}
      </tbody></table></div>`;
    $('#trigF').onchange = e => { ckTrig = e.target.value; route(); };
  }
  $$('[data-tab]', v).forEach(b => b.onclick = () => { ckTab = b.dataset.tab; route(); });
  v.addEventListener('click', e => {
    const id = e.target.dataset.editTpl;
    if (id) editTemplate(templates.find(t => t.id === +id));
  });
  if (admin) {
    if ($('#newTpl')) $('#newTpl').onclick = () => editTemplate(null);
    $('#evBtn').onclick = () => followupsForEvent();
  }
};

async function reloadChecklistRefs() {
  const [t, r] = await Promise.all([sb.from('checklist_templates').select('*').order('id'), sb.from('linked_rules').select('*').order('id')]);
  if (!t.error) templates = t.data || [];
  if (!r.error) rules = r.data || [];
}

function editTemplate(t) {
  const isNew = !t;
  t = t || { work_type: 'GST', name: '', matches: [], steps: [] };
  const allRet = [].concat(...Object.values(WORK_ITEMS));
  const body = `<div class="form-grid">
      <label>Work type<select name="wt">${opts(WORK_TYPES, t.work_type)}</select></label>
      <label>Checklist name<input name="nm" value="${esc(t.name)}" placeholder="e.g. GSTR-1 (monthly)"></label>
      <label class="full">Use for these returns (comma separated, same names as in work items)
        <input autocomplete="off" name="mt" value="${esc((t.matches || []).join(', '))}" list="dl-allret" placeholder="e.g. GSTR-1, IFF"></label>
      <datalist id="dl-allret">${allRet.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
      <label class="full">Steps — one per line. Add “| Reviewer” or “| Partner/Admin” at the end if not done by staff.
        <textarea name="st" rows="14">${esc((t.steps || []).map(s => s.name + (s.who && s.who !== 'Staff' ? ' | ' + s.who : '')).join('\n'))}</textarea></label>
      ${P4() ? `<label class="full">Documents needed from the client — one per line (shown on the client's status link)
        <textarea name="dc" rows="5">${esc((t.docs || []).join('\n'))}</textarea></label>` : ''}
      <p class="muted small full">Changes apply to checklists started from now on. Work items already started keep their own steps.</p></div>`;
  const m = modal(isNew ? 'New checklist' : 'Edit checklist', body, {
    wide: true,
    extra: isNew ? '' : '<button class="btn danger" data-deltpl>Delete</button>',
    onSave: async el => {
      const steps = fv(el, 'st').split('\n').map(x => x.trim()).filter(Boolean).map(x => {
        const [name, who] = x.split('|').map(y => y.trim()); return { name, who: who || 'Staff' };
      });
      const rec = { id: t.id || Math.max(0, ...templates.map(x => x.id)) + 1, work_type: fv(el, 'wt'), name: fv(el, 'nm'),
        matches: fv(el, 'mt').split(',').map(x => x.trim()).filter(Boolean), steps, updated_at: new Date().toISOString() };
      if (P4()) rec.docs = fv(el, 'dc').split('\n').map(x => x.trim()).filter(Boolean);
      if (!rec.name || !steps.length) { toast('Name and at least one step are needed', true); return false; }
      await must(sb.from('checklist_templates').upsert(rec));
      await reloadChecklistRefs(); toast('Checklist saved'); route();
    }
  });
  const d = $('[data-deltpl]', m.el);
  if (d) d.onclick = async () => {
    if (!confirm('Delete this checklist? Work items already started keep their steps.')) return;
    try { await must(sb.from('checklist_templates').delete().eq('id', t.id)); await reloadChecklistRefs(); m.close(); toast('Deleted'); route(); }
    catch (e) { toast(friendly(e), true); }
  };
}

function followupsForEvent() {
  const triggers = [...new Set(rules.map(r => r.trigger_event))];
  if (!triggers.length) return toast('Run update-checklists.sql first', true);
  const now = new Date();
  const body = `<div class="form-grid">
      <label class="full">Client<select name="cl"><option value="">Select client…</option>${opts(clients.filter(c => c.active), '', cLabel, c => c.id)}</select></label>
      <label class="full">What happened?<select name="tr">${opts(triggers, triggers[0])}</select></label>
      <label>Event date<input type="date" name="ev" value="${today()}"></label>
      <label>Period label<input name="pd" value="${MONTHS[now.getMonth()]} ${now.getFullYear()}"></label>
      <label class="full">Assign to<select name="as">${staffOpts('')}</select></label>
      <div class="full" id="evList"></div></div>`;
  const m = modal('Follow-ups for an event', body, {
    wide: true, saveText: 'Create work items',
    onSave: async el => {
      const cl = fv(el, 'cl'); if (!cl) { toast('Select a client', true); return false; }
      const ids = $$('[data-rule]', el).filter(x => x.checked).map(x => +x.dataset.rule);
      if (!ids.length) { toast('Tick at least one follow-up', true); return false; }
      const n = await createFollowups({ client_id: cl, list: rules.filter(r => ids.includes(r.id)), evDate: fv(el, 'ev'),
        period: fv(el, 'pd') || today(), assigned_to: fv(el, 'as') });
      toast(`${n} work item${n === 1 ? '' : 's'} created (duplicates skipped)`);
      if (location.hash.includes('work')) route();
    }
  });
  const draw = () => {
    const tr = fv(m.el, 'tr'), ev = fv(m.el, 'ev') || today();
    $('#evList', m.el).innerHTML = `<div class="table-wrap"><table><thead><tr><th></th><th>Do not miss</th><th>Form</th><th>Due rule</th><th>Due date</th></tr></thead><tbody>
      ${rules.filter(r => r.trigger_event === tr).map(r => `<tr><td><input type="checkbox" data-rule="${r.id}" checked aria-label="Select"></td>
        <td class="wrap">${esc(r.action)}</td><td><span class="badge">${esc(r.form || '')}</span></td><td class="wrap small">${esc(r.due_rule || '')}</td>
        <td class="small">${r.due_days != null ? fmtDate(iso(addDays(new Date(ev + 'T00:00:00'), r.due_days))) : 'Set later'}</td></tr>`).join('')}</tbody></table></div>`;
  };
  $('[name=tr]', m.el).onchange = draw; $('[name=ev]', m.el).onchange = draw;
  draw();
}

/* ---------- bulk create ---------- */
function clientMatches(c, preset) {
  if (!preset.work_type) return false;
  if (!(c.services || []).includes(preset.work_type)) return false;
  if (preset.work_type === 'GST' && preset.applies_to && GST_SCHEMES.includes(preset.applies_to)) return c.gst_scheme === preset.applies_to;
  return true;
}
function bulkCreate(preset = {}, refresh = () => {}) {
  const act = clients.filter(c => c.active);
  const body = `<div class="form-grid">
    <label>Work type<select name="work_type">${opts(WORK_TYPES, preset.work_type || 'GST')}</select></label>
    <label>Return / task<input autocomplete="off" name="return_name" list="${dlFor(preset.work_type || 'GST')}" value="${esc(preset.return_name || '')}" placeholder="Pick or type, e.g. GSTR-3B"></label>
    <label>Period<input name="period" value="${esc(preset.period || '')}" placeholder="e.g. Oct 2026"></label>
    <label>Due date<input name="due_date" type="date" value="${esc(preset.due_date || '')}"></label>
    <label class="full">Assign to<select name="assign"><option value="default">Each client's default staff</option>${staffOpts('', { blank: 'Leave unassigned' }).replace('value=""', 'value="none"')}</select></label>
    <div class="full">
      <div class="toolbar" style="margin:0"><b>Clients</b><span class="muted small" data-sel></span><span class="spacer"></span>
        <input type="search" placeholder="Filter clients" data-filter style="max-width:200px">
        <button type="button" class="btn sm" data-all>Select shown</button><button type="button" class="btn sm" data-none>Clear</button></div>
      <div class="client-list">${act.length ? act.map(c => `<label class="check" data-name="${esc(c.name.toLowerCase())}">
          <input type="checkbox" value="${c.id}" ${clientMatches(c, preset) ? 'checked' : ''}> ${esc(c.name)}
          <span class="muted small">${esc(c.gst_scheme || '')}${(c.services || []).length ? ' · ' + esc(c.services.join(', ')) : ''}</span></label>`).join('')
        : '<div class="empty">Add clients first (Clients page).</div>'}</div>
      <p class="muted small">Clients are pre-ticked when their services match this work type${preset.applies_to ? ' and GST scheme' : ''}. Existing entries for the same return & period are skipped.</p>
    </div></div>`;
  const m = modal('Create work for many clients', body, {
    wide: true, saveText: 'Create',
    onSave: async el => {
      const ids = $$('.client-list input:checked', el).map(i => i.value);
      const rn = fv(el, 'return_name'), period = fv(el, 'period'), assign = fv(el, 'assign');
      if (!rn || !period) { toast('Return and period are required', true); return false; }
      if (!ids.length) { toast('Tick at least one client', true); return false; }
      const rows = ids.map(id => ({
        client_id: id, work_type: fv(el, 'work_type'), return_name: rn, period,
        due_date: fv(el, 'due_date') || null,
        assigned_to: assign === 'default' ? (clientById(id)?.default_staff || null) : assign === 'none' ? null : assign
      }));
      const { data } = await must(sb.from('tasks').upsert(rows, { onConflict: 'client_id,return_name,period', ignoreDuplicates: true }).select('id'));
      const made = (data || []).length;
      toast(`${made} created${rows.length - made ? `, ${rows.length - made} already existed` : ''}`);
      refresh();
    }
  });
  const el = m.el;
  linkTypeToList(el);
  const upd = () => { $('[data-sel]', el).textContent = `${$$('.client-list input:checked', el).length} selected`; };
  upd();
  el.addEventListener('change', upd);
  $('[data-filter]', el).oninput = e => {
    const q = e.target.value.toLowerCase();
    $$('.client-list label', el).forEach(l => l.classList.toggle('hidden', !l.dataset.name.includes(q)));
  };
  $('[data-all]', el).onclick = () => { $$('.client-list label:not(.hidden) input', el).forEach(i => i.checked = true); upd(); };
  $('[data-none]', el).onclick = () => { $$('.client-list input', el).forEach(i => i.checked = false); upd(); };
}

/* ---------- share status links ---------- */
const firmName = () => settings.firm_name || cfg.FIRM_NAME || 'our office';
const clientMsg = c => `Dear ${c.contact_person || c.name},\nYou can see the live status of your GST / TDS / MCA work with ${firmName()} here:\n${statusUrl(c.status_token)}\n(No login needed. Please keep this link private.)`;
const boardMsg = () => `${firmName()} - live work status (GST / TDS / MCA / Other):\n${boardUrl(settings.board_token)}`;
function shareCard() {
  const on = settings.board_enabled && settings.board_token;
  return `<section class="card share-card" style="margin-top:16px">
    <div class="share-head"><div><h3 style="margin:0">Share work status</h3>
      <p class="muted small" style="margin:4px 0 0">Common link: anyone with it can see all work (no login, read-only). For a single client, use <a href="#/clients">Clients → WhatsApp</a>.</p></div>
      <span class="badge ${on ? 'ok' : ''}">${on ? 'Link is ON' : 'Link is OFF'}</span></div>
    ${on ? `<div class="linkbox"><input readonly value="${esc(boardUrl(settings.board_token))}" aria-label="Common status link">
      <button class="btn sm" data-sh="copy">Copy</button>
      <a class="btn sm primary" href="${esc(waShare(boardMsg()))}" target="_blank" rel="noopener">Send on WhatsApp</a>
      <a class="btn sm" href="mailto:?subject=${encodeURIComponent(firmName() + ' - work status')}&body=${encodeURIComponent(boardMsg())}">Email</a>
      <a class="btn sm ghost" href="${esc(boardUrl(settings.board_token))}" target="_blank" rel="noopener">Open</a></div>`
      : isAdmin() ? `<button class="btn primary" data-sh="on">Switch on the common link</button>` : '<p class="muted small">Ask the admin to switch on the common link (Settings).</p>'}
  </section>`;
}
function bindShareCard(v) {
  const c = $('[data-sh="copy"]', v); if (c) c.onclick = () => copy(boardUrl(settings.board_token));
  const o = $('[data-sh="on"]', v);
  if (o) o.onclick = async () => {
    try {
      const patch = { board_enabled: true }; if (!settings.board_token) patch.board_token = newId();
      await must(sb.from('settings').update(patch).eq('id', 1)); Object.assign(settings, patch); toast('Common link switched on'); route();
    } catch (e) { toast(friendly(e), true); }
  };
}

/* ---------- DASHBOARD (Option E: bento) ---------- */
const PORTALS = [
  ['GST', 'GST portal', 'https://services.gst.gov.in/services/login'],
  ['TDS', 'TRACES', 'https://www.tdscpc.gov.in/app/login.xhtml'],
  ['ROC/MCA', 'MCA V3', 'https://www.mca.gov.in/content/mca/global/en/home.html']
];
const WT_TONE = { 'GST': ['#E3EEFC', '#1D5FC2'], 'TDS': ['#EFE8FB', '#5B3CC4'], 'Income Tax': ['#E2F4EF', '#0F6B5C'], 'ROC/MCA': ['#FDF0E1', '#9A4A00'], 'Other': ['#EEF1F5', '#526174'] };
const dashFull = async v => {      // the full dashboard (Admin → System tab)
  const now = new Date(), t = today(), in7 = iso(addDays(now, 7));
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const mStart = iso(new Date(y, m - 1, 1)), mEnd = iso(new Date(y, m, 0));
  let notRows = [], invRows = null, luNew = 0, payFu = [], rnR, obR, tiR, mcR;
  const [open, month, dd] = await Promise.all([
    must(sb.from('tasks').select('*').not('status', 'in', '("Filed","Not applicable")').order('due_date', { ascending: true, nullsFirst: false }).limit(3000)),
    must(sb.from('tasks').select('id,client_id,work_type,return_name,status,due_date,filed_on,remarks').gte('due_date', mStart).lte('due_date', mEnd).limit(5000)),
    must(sb.from('due_dates').select('*').order('sort')),
    safe(sb.from('notices').select('id,status,reply_due,hearing_date').neq('status', 'Closed').limit(3000)),
    safe(sb.from('law_updates').select('id').eq('status', 'published').gte('published_at', iso(addDays(now, -14))).limit(100)),
    isManager() && P4() ? safe(sb.from('invoices').select('client_id,total,paid').limit(5000)) : Promise.resolve({ data: null }),
    isManager() ? safe(sb.from('followups').select('client_id,on_date,next_on,created_at').eq('kind', 'payment').order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000)) : Promise.resolve({ data: [] }),
    safe(sb.from('renewals').select('id,expires_on,status,reminders').not('expires_on', 'is', null).lte('expires_on', iso(addDays(now, 30))).limit(3000)),
    safe(sb.from('onboarding').select('client_id').eq('status', 'In progress').limit(1000)),
    safe(sb.from('tax_intimations').select('id').in('kind', ['GST', 'TDS']).eq('period', monthLabel(prevMonth())).not('sent_on', 'is', null).limit(5000)),
    safe(sb.from('mca_companies').select('client_id,entity_type,incorporated_on,first_fy_end,agms').limit(3000))
  ]).then(r => { [rnR, obR, tiR, mcR] = r.slice(7); notRows = r[3].error ? [] : r[3].data || []; luNew = r[4].error ? 0 : (r[4].data || []).length; invRows = r[5].error ? null : r[5].data; payFu = r[6].error ? [] : r[6].data || []; return r; });
  const rows = open.data || [];
  const rnRows = rnR.error ? null : (rnR.data || []).filter(rnLive), rnSt = (rnRows || []).map(x => rnStage(x, t));
  const rnExp = rnSt.filter(s => s.days < 0).length, rnDue = rnSt.filter(s => s.days >= 0).length, rnRem = rnSt.filter(s => s.due).length;
  const obN = obR.error ? null : (obR.data || []).length, tiSent = tiR.error ? null : (tiR.data || []).length;
  const mrows = (month.data || []).filter(r => r.status !== 'Not applicable');
  const overdue = rows.filter(r => r.due_date && r.due_date < t);
  const soon = rows.filter(r => r.due_date && r.due_date >= t && r.due_date <= in7);
  const waiting = rows.filter(r => r.status === 'Pending data');
  const fuDue = waiting.filter(r => r.fu_next && r.fu_next <= t);
  const filedMonth = mrows.filter(r => r.status === 'Filed').length;
  const pct = mrows.length ? Math.round(100 * filedMonth / mrows.length) : 0;
  const hour = now.getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = esc((me.full_name || '').split(' ')[0] || 'there');
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // department cards
  const dept = ['GST', 'TDS', 'ROC/MCA', 'Other'].map(w => {
    const list = mrows.filter(r => inTab(r, w));
    const done = list.filter(r => r.status === 'Filed').length;
    const byRet = {};
    list.forEach(r => { const k = r.return_name; byRet[k] = byRet[k] || [0, 0]; byRet[k][1]++; if (r.status === 'Filed') byRet[k][0]++; });
    const lines = Object.entries(byRet).sort((a, b) => b[1][1] - a[1][1]).slice(0, 2).map(([k, [d, n]]) => `<span>${esc(k)} · ${d} / ${n}</span>`);
    if (w === 'GST') {
      const auto = list.filter(r => r.status === 'Filed' && /\[Auto:/.test(r.remarks || '')).length;
      if (auto) lines.push(`<span style="color:var(--green);font-weight:700">${auto} auto-filed from portal</span>`);
    }
    const [bg, fg] = WT_TONE[w];
    const p = list.length ? Math.round(100 * done / list.length) : 0;
    return `<a class="bento-card dept" href="#/work" data-dept="${esc(w)}">
      <div class="dept-head"><span class="dept-ico" style="background:${bg};color:${fg}">${wtIcon(w, 20)}</span><b>${esc(w === 'ROC/MCA' ? 'MCA' : w)}</b><span class="dept-count">${done} / ${list.length}</span></div>
      <div class="bar"><i style="width:${p}%;background:${fg}"></i></div>
      <div class="dept-lines">${lines.join('') || '<span class="muted">No work due this month</span>'}</div></a>`;
  }).join('');

  // timeline from the due-date calendar
  const days = lastDay(y, m);
  const groups = {};
  (dd.data || []).filter(d => (d.months || []).includes(m) && d.work_type !== 'Income Tax').forEach(d => {
    const day = Math.min(d.due_day, days);
    (groups[day] = groups[day] || []).push(d);
  });
  const tl = Object.keys(groups).map(Number).sort((a, b) => a - b).map((day, i) => {
    const g = groups[day], col = WT_TONE[g[0].work_type] ? WT_TONE[g[0].work_type][1] : '#526174';
    const nm = g[0].return_name.replace(/\s*\(.*\)\s*/, ''); const label = esc(nm.length > 14 ? nm.slice(0, 13) + '…' : nm) + (g.length > 1 ? ` +${g.length - 1}` : '');
    const left = Math.max(3, Math.min(97, (day - 0.5) / days * 100));
    const below = i % 2 === 1;
    return `<div class="tl-pt ${below ? 'below' : ''} ${day < now.getDate() ? 'past' : ''}" style="left:${left}%" title="${esc(g.map(x => x.return_name).join(', '))}">
      <span class="tl-lab" style="color:${col}">${label}</span><i class="tl-stem"></i><i class="tl-dot" style="background:${col}"></i><span class="tl-day">${day}</span></div>`;
  }).join('');

  // alert chips
  const chips = [];
  if (overdue[0]) chips.push(`<span class="chip red">${esc(overdue[0].return_name)} · ${esc(clientName(overdue[0].client_id))} · overdue${overdue.length > 1 ? ` (+${overdue.length - 1} more)` : ''}</span>`);
  const waitingClients = new Set(waiting.map(r => r.client_id)).size;
  const nLate = notRows.filter(n => isOpenNotice(n.status) && n.status !== 'Hearing' && n.reply_due && n.reply_due < t).length;
  const nSoon = notRows.filter(n => isOpenNotice(n.status) && n.reply_due >= t && n.reply_due <= in7).length;
  if (nLate) chips.push(`<a class="chip red" href="#/notices">${nLate} notice repl${nLate > 1 ? 'ies' : 'y'} overdue</a>`);
  if (nSoon) chips.push(`<a class="chip amber" href="#/notices">${nSoon} notice repl${nSoon > 1 ? 'ies' : 'y'} due in 7 days</a>`);
  if (invRows) { const bal = invRows.reduce((a, i) => a + num(i.total) - num(i.paid), 0); if (bal > 0.009) chips.push(`<a class="chip blue" href="#/billing" data-billdue>${inr(bal)} payments pending</a>`); }
  if (luNew) chips.push(`<a class="chip blue" href="#/updates">${luNew} new law update${luNew > 1 ? 's' : ''}</a>`);
  if (fuDue.length) chips.push(`<a class="chip amber" href="#/work" data-jump="fudue">${fuDue.length} client follow-up${fuDue.length > 1 ? 's' : ''} due today</a>`);
  if (invRows && payFu.length) {
    const bal = {}; invRows.forEach(i => { bal[i.client_id] = (bal[i.client_id] || 0) + num(i.total) - num(i.paid); });
    const seen = new Set(), dueP = payFu.filter(f => !seen.has(f.client_id) && seen.add(f.client_id)).filter(f => f.next_on && f.next_on <= t && (bal[f.client_id] || 0) > 0.009).length;
    if (dueP) chips.push(`<a class="chip amber" href="#/billing" data-billdue>${dueP} payment follow-up${dueP > 1 ? 's' : ''} due</a>`);
  }
  if (mcR && !mcR.error) {                                  // v20: AGM overdue for last year's accounts
    const F0 = MCA.fyStartOf(t) - 1, late = (mcR.data || []).filter(co => { const a = MCA.agmDue(co, F0); return a && !MCA.agmOf(co, F0).agm_on && a.due < t && (MCA.firstFy(co) == null || MCA.firstFy(co) <= F0) && (clientById(co.client_id) || {}).active; }).length;
    if (late) chips.push(`<a class="chip red" href="#/mca" data-mcagm>${late} AGM${late > 1 ? 's' : ''} overdue (${MCA.FY(F0)})</a>`);
  }
  if (rnExp) chips.push(`<a class="chip red" href="#/renewals" data-rnw="expired">${rnExp} renewal${rnExp > 1 ? 's' : ''} expired</a>`);
  if (rnRem) chips.push(`<a class="chip amber" href="#/renewals" data-rnw="remind">${rnRem} renewal reminder${rnRem > 1 ? 's' : ''} to send</a>`);
  if (waitingClients) chips.push(`<span class="chip amber">${waitingClients} client${waitingClients > 1 ? 's haven’t' : ' hasn’t'} sent data</span>`);
  if (isManager()) {
    const cnt = {}; rows.forEach(r => { if (r.assigned_to) cnt[r.assigned_to] = (cnt[r.assigned_to] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top) chips.push(`<span class="chip blue">${esc(profName(top[0]))} has ${top[1]} open items</span>`);
    const un = rows.filter(r => !r.assigned_to).length;
    if (un) chips.push(`<span class="chip blue">${un} unassigned</span>`);
  }

  v.innerHTML = `<div class="bento">
    <section class="bento-hero">
      <div class="fx" aria-hidden="true"><span style="width:160px;height:160px;right:200px;top:-60px"></span><span style="width:90px;height:90px;right:110px;bottom:-30px;animation-delay:-2s"></span></div>
      <div class="hero-text">
        <span class="hero-date">${esc(dateLabel)}</span>
        <h1>${hello}, ${first}. ${mrows.length} item${mrows.length === 1 ? '' : 's'} this month, ${filedMonth} already filed.</h1>
        <div class="hero-acts">
          ${isManager() ? `<a class="hero-btn" href="#/calendar">+ Create this month's work</a>${isAdmin() ? '<button class="hero-btn ghost" data-wa-send>Send WhatsApp reminders</button>' : ''}`
            : `<a class="hero-btn" href="#/work">Open my work</a>`}
        </div>
      </div>
      <svg class="hero-ring" width="150" height="150" viewBox="0 0 42 42" role="img" aria-label="${pct} percent of this month's work filed">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="4.5"></circle>
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="25"></circle>
        <text x="21" y="21.5" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">${pct}%</text>
        <text x="21" y="27" text-anchor="middle" font-size="3" fill="#fff">filed</text>
      </svg>
      <div class="meter" aria-hidden="true"><div class="meter-n"><b>${pct}%</b><span>filed this month</span></div><div class="meter-s">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(pct / 10) ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</div></div>
    </section>
    <section class="bento-card bento-stats">
      <a class="mini red" href="#/work" data-jump="overdue"><span>Overdue</span><b>${overdue.length}</b></a>
      <a class="mini amber" href="#/work" data-jump="soon"><span>Due in 7 days</span><b>${soon.length}</b></a>
      <a class="mini blue" href="#/work" data-jump="waiting"><span>Waiting for data</span><b>${waiting.length}</b></a>
      <div class="mini green"><span>Filed this month</span><b>${filedMonth}</b></div>
    </section>
    ${dept}
    <section class="bento-card bento-timeline">
      <div class="bento-head"><h2>${MONTHS_FULL[m - 1]} timeline</h2><span class="muted small">Today is the ${now.getDate()}${['th', 'st', 'nd', 'rd'][(now.getDate() % 10 > 3 || [11, 12, 13].includes(now.getDate())) ? 0 : now.getDate() % 10]}</span></div>
      <div class="tl"><div class="tl-line"></div><div class="tl-done" style="width:${Math.round(100 * (now.getDate() - 0.5) / days)}%"></div>${tl || '<p class="muted small">No due dates this month.</p>'}</div>
      <div class="chips" id="dashChips">${chips.join('') || '<span class="chip green">All clear — nothing overdue</span>'}</div>
    </section>
    <section class="bento-card bento-portals">
      <h2>Quick portals</h2>
      <div class="portals">${PORTALS.map(([w, name, url]) => `<a href="${url}" target="_blank" rel="noopener"><span style="color:${WT_TONE[w][1]}">${wtIcon(w, 20)}</span><b>${esc(name)}</b></a>`).join('')}</div>
    </section>
  </div>
  ${rnRows || obN != null ? `<section class="card desk"><a class="desk-tile" href="#/renewals" data-rnw="30"><span>Renewals</span><b>${rnDue + rnExp}</b><small>${rnExp ? `${rnExp} expired · ` : ''}due in 30 days${rnRem ? ` · ${rnRem} reminder${rnRem > 1 ? 's' : ''} to send` : ''}</small></a>
    <a class="desk-tile" href="#/taxpay" data-tpgo><span>Tax payment intimation</span><b>${tiSent ?? 0}</b><small>GST / TDS messages sent for ${monthLabel(prevMonth())}</small></a>
    <a class="desk-tile" href="#/onboarding"><span>Client onboarding</span><b>${obN ?? 0}</b><small>new client${obN === 1 ? '' : 's'} in progress</small></a></section>` : ''}
  ${isManager() ? shareCard() : ''}
  ${fuDue.length ? '<div class="card" style="margin-top:16px"><h3>Client follow-ups due today</h3><div data-t="fu"></div></div>' : ''}
  <div class="card" style="margin-top:16px"><h3>Overdue</h3><div data-t="late"></div></div>
  <div class="card"><h3>Due in the next 7 days</h3><div data-t="soon"></div></div>`;
  const refresh = () => route();
  const lateEl = $('[data-t=late]', v), soonEl = $('[data-t=soon]', v);
  lateEl.innerHTML = taskTable(overdue.slice(0, 50), { showArn: false, showAssigned: isManager() });
  soonEl.innerHTML = taskTable(soon.slice(0, 50), { showArn: false, showAssigned: isManager() });
  bindTaskTable(lateEl, overdue, refresh);
  bindTaskTable(soonEl, soon, refresh);
  const fuEl = $('[data-t=fu]', v);
  if (fuEl) { fuEl.innerHTML = taskTable(fuDue.slice(0, 50), { showArn: false, showAssigned: isManager() }); bindTaskTable(fuEl, fuDue, refresh); }
  $$('[data-jump]', v).forEach(a => a.onclick = () => {
    wf = { ...WF_DEFAULT, status: ['waiting', 'fudue'].includes(a.dataset.jump) ? 'Pending data' : 'open', quick: a.dataset.jump };
  });
  $$('[data-dept]', v).forEach(a => a.onclick = () => { wf = { ...WF_DEFAULT, type: a.dataset.dept, month: t.slice(0, 7), status: 'all' }; });
  countUp(v);
  bindShareCard(v);
  $$('[data-billdue]', v).forEach(x => x.onclick = () => { billTab = 'due'; });
  $$('[data-rnw]', v).forEach(x => x.onclick = () => { rnf = { ...rnf, win: x.dataset.rnw }; });
  $$('[data-tpgo]', v).forEach(x => x.onclick = () => { tpTab = 'GST'; tpMonth = prevMonth(); });
  const wa = $('[data-wa-send]', v);
  if (wa) wa.onclick = async () => {
    if (!confirm("Send today's pending-work reminders to staff on WhatsApp now?")) return;
    wa.disabled = true;
    try { const { data } = await must(sb.rpc('wa_admin_run', { p_kind: 'daily' })); toast(data ? `${data} reminder(s) sent` : 'Nothing sent — check Settings → WhatsApp reminders', !data); }
    catch (e) { toast(friendly(e), true); } finally { wa.disabled = false; }
  };
  if (isManager() || isPartner()) HEALTH.load().then(all => {          // v24: clients needing attention
    const box = $('#dashChips', v), red = all.filter(x => x.level === 'red').length;
    if (!box || !document.body.contains(box) || !red) return;
    box.insertAdjacentHTML('beforeend', `<a class="chip red" href="#/health" data-hred>${red} client${red > 1 ? 's' : ''} need${red > 1 ? '' : 's'} attention</a>`);
    $('[data-hred]', box).onclick = () => { hf = { ...hf, level: 'red' }; };
  }).catch(() => {});
};

/* ---------- WORK LIST ---------- */
const WF_DEFAULT = { month: '', status: 'open', type: '', ret: '', staff: '', client: '', q: '', quick: '' };
let wf = { ...WF_DEFAULT };
VIEWS.work = async v => {
  v.innerHTML = `<div class="page-head"><h2>${(wf.type ? ({ 'ROC/MCA': 'MCA / ROC' }[wf.type] || wf.type) + ' work' : 'All work').replace(/^/, isManager() ? '' : 'My ').replace(/^My All/, 'My')}</h2><span class="spacer"></span>
      ${isManager() ? '<button class="btn" id="bulkBtn">+ Create for many clients</button><button class="btn primary" id="addBtn">+ Add work</button>' : ''}</div>
    <div class="wtabs" role="tablist">${WT_TABS.map(([k, l]) => `<button role="tab" data-wt="${esc(k)}" class="${wf.type === k ? 'on' : ''}">${k ? wtIcon(k, 16) : ''}<span>${l}</span><b data-n="${esc(k)}">…</b></button>`).join('')}</div>
    <div class="toolbar">
      <input type="month" id="fMonth" value="${esc(wf.month)}" title="Due month">
      <select id="fStatus"><option value="open">Open (not filed)</option><option value="all">All statuses</option>${opts(STATUSES, wf.status)}</select>
      <select id="fRet"><option value="">All returns</option>${opts(wf.type ? WORK_ITEMS[wf.type] || [] : [].concat(...WORK_TYPES.map(w => WORK_ITEMS[w] || [])), wf.ret)}</select>
      ${isManager() ? `<select id="fStaff"><option value="">All staff</option><option value="none" ${wf.staff === 'none' ? 'selected' : ''}>Unassigned</option>${opts(activeStaff(), wf.staff, p => p.full_name || p.email, p => p.id)}</select>` : ''}
      <select id="fClient"><option value="">All clients</option>${opts(clients, wf.client, cLabel, c => c.id)}</select>
      <input type="search" id="fSearch" placeholder="Search client / return / ARN" value="${esc(wf.q)}">
      <button class="btn sm" id="clearF">Clear</button>
      <button class="btn sm" id="csvBtn">Export CSV</button>
    </div>
    ${wf.quick ? `<p class="note small">Showing: <b>${{ overdue: 'Overdue', soon: 'Due in next 7 days', waiting: 'Waiting for client data', fudue: 'Client follow-ups due' }[wf.quick] || ''}</b> · <button class="link" id="dropQuick">show all</button></p>` : ''}
    <div id="workList"><div class="loading">Loading…</div></div>`;
  $('#fStatus').value = wf.status;
  let rows = [];
  const load = async () => {
    let q = sb.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at').limit(3000);
    if (wf.month) {
      const [y, m] = wf.month.split('-').map(Number);
      q = q.gte('due_date', iso(new Date(y, m - 1, 1))).lte('due_date', iso(new Date(y, m, 0)));
    }
    if (wf.status === 'open') q = q.not('status', 'in', '("Filed","Not applicable")');
    else if (wf.status !== 'all') q = q.eq('status', wf.status);
    if (wf.ret) q = q.eq('return_name', wf.ret);
    if (wf.staff === 'none') q = q.is('assigned_to', null); else if (wf.staff) q = q.eq('assigned_to', wf.staff);
    if (wf.client) q = q.eq('client_id', wf.client);
    const t = today(), in7 = iso(addDays(new Date(), 7));
    if (wf.quick === 'overdue') q = q.lt('due_date', t);
    if (wf.quick === 'soon') q = q.gte('due_date', t).lte('due_date', in7);
    if (wf.quick === 'fudue') q = q.eq('status', 'Pending data').lte('fu_next', t);
    rows = (await must(q)).data || [];
    render();
  };
  const filtered = () => {
    const s = wf.q.toLowerCase();
    const base = rows.filter(r => inTab(r, wf.type));
    return !s ? base : base.filter(r => [clientName(r.client_id), r.return_name, r.period, r.arn, r.remarks].join(' ').toLowerCase().includes(s));
  };
  const list = $('#workList');
  const render = () => {
    const f = filtered();
    WT_TABS.forEach(([k]) => { const n = $(`[data-n="${k}"]`); if (n) n.textContent = rows.filter(r => inTab(r, k)).length; });
    list.innerHTML = `<div class="count">${f.length} item${f.length === 1 ? '' : 's'}${rows.length >= 3000 ? ' (first 3000 — narrow the filters)' : ''}</div>` + taskTable(f);
  };
  bindTaskTable(list, { find: fn => rows.find(fn) }, load);
  const set = (k, val) => { wf[k] = val; load(); };
  $('#fMonth').onchange = e => set('month', e.target.value);
  $('#fStatus').onchange = e => set('status', e.target.value);
  $$('[data-wt]', v).forEach(b => b.onclick = () => { wf.type = b.dataset.wt; wf.ret = ''; route(); });
  $('#fRet').onchange = e => set('ret', e.target.value);
  if ($('#fStaff')) $('#fStaff').onchange = e => set('staff', e.target.value);
  $('#fClient').onchange = e => set('client', e.target.value);
  $('#fSearch').oninput = e => { wf.q = e.target.value; render(); };
  $('#clearF').onclick = () => { wf = { ...WF_DEFAULT }; route(); };
  if ($('#dropQuick')) $('#dropQuick').onclick = () => { wf.quick = ''; route(); };
  $('#csvBtn').onclick = () => {
    const f = filtered();
    download(`work-${today()}.csv`, toCSV([['Client', 'GSTIN', 'Work type', 'Return', 'Period', 'Due date', 'Status', 'Assigned to', 'Data received', 'Data via', 'Filed on', 'ARN', 'Remarks', 'Checklist done', 'Checklist steps'],
      ...f.map(r => [clientName(r.client_id), clientById(r.client_id)?.gstin, r.work_type, r.return_name, r.period, r.due_date, r.status, profName(r.assigned_to), r.data_received_on, r.data_source, r.filed_on, r.arn, r.remarks, r.checks_done || 0, r.checks_total || 0])]));
  };
  if (isManager()) {
    $('#addBtn').onclick = () => editTask(null, load);
    $('#bulkBtn').onclick = () => bulkCreate({}, load);
  }
  await load();
};

/* ---------- DUE DATE CALENDAR ---------- */
let calMonth = today().slice(0, 7);
VIEWS.calendar = async v => {
  const [y, m] = calMonth.split('-').map(Number);
  const start = iso(new Date(y, m - 1, 1)), end = iso(new Date(y, m, 0));
  const [dd, tk] = await Promise.all([
    must(sb.from('due_dates').select('*').order('sort').order('due_day')),
    must(sb.from('tasks').select('return_name,period,status').gte('due_date', start).lte('due_date', end).limit(10000))
  ]);
  const dues = dd.data || [];
  const counts = {};
  (tk.data || []).forEach(t => {
    const k = t.return_name + '|' + t.period;
    counts[k] = counts[k] || { total: 0, done: 0 };
    if (t.status !== 'Not applicable') { counts[k].total++; if (t.status === 'Filed') counts[k].done++; }
  });
  const items = dues.filter(d => (d.months || []).includes(m))
    .map(d => ({ ...d, date: dueDateFor(d.due_day, y, m), period: periodFor(d.period_rule, y, m) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort);
  const t = today();
  const shift = n => { const d = new Date(y, m - 1 + n, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; route(); };

  v.innerHTML = `<div class="page-head"><h2>Due dates</h2>
      <button class="btn sm" id="prevM" aria-label="Previous month">‹</button>
      <b>${MONTHS_FULL[m - 1]} ${y}</b>
      <button class="btn sm" id="nextM" aria-label="Next month">›</button>
      <button class="btn sm" id="thisM">This month</button>
      <span class="spacer"></span>
      <a class="btn" href="#/calc">Late fee calculator</a><a class="btn" href="#/taxpay">Tax payment intimation</a><a class="btn" href="#/renewals">Renewals</a>
      ${isManager() ? '<button class="btn" id="addDue">+ Add due date</button>' : ''}</div>
    <p class="note warn small">These are the standard statutory dates. When the government extends a date or changes a form, ${isManager() ? 'click <b>Edit</b> on that row to update it.' : 'ask the admin to update it.'}</p>
    <div class="card" style="padding:0">${items.length ? items.map((d, i) => {
      const c = counts[d.return_name + '|' + d.period];
      const dt = new Date(d.date + 'T00:00:00');
      return `<div class="cal-row">
        <div class="datebox ${d.date < t ? 'past' : ''}"><div class="d">${dt.getDate()}</div><div class="w">${DAYS[dt.getDay()]}</div></div>
        <div class="cal-info"><div class="t">${esc(d.return_name)} ${wtBadge(d.work_type)} ${d.applies_to ? `<span class="badge">${esc(d.applies_to)}</span>` : ''}</div>
          <div class="muted small">${esc(d.description || '')}${d.period ? ' · Period: ' + esc(d.period) : ''}</div>
          ${c && c.total ? `<div class="small">${c.done}/${c.total} filed</div><div class="progress"><i style="width:${Math.round(100 * c.done / c.total)}%"></i></div>`
            : `<div class="muted small">No work created yet</div>`}</div>
        ${isManager() ? `<div class="cal-actions"><button class="btn sm primary" data-create="${i}">Create work</button><button class="btn sm" data-editdue="${d.id}">Edit</button></div>` : ''}
      </div>`;
    }).join('') : '<div class="empty">No due dates in this month.</div>'}</div>`;
  $('#prevM').onclick = () => shift(-1);
  $('#nextM').onclick = () => shift(1);
  $('#thisM').onclick = () => { calMonth = today().slice(0, 7); route(); };
  if (!isManager()) return;
  $('#addDue').onclick = () => editDue(null);
  v.addEventListener('click', e => {
    const ci = e.target.dataset.create, ei = e.target.dataset.editdue;
    if (ci !== undefined) { const d = items[+ci]; bulkCreate({ work_type: d.work_type, return_name: d.return_name, period: d.period, due_date: d.date, applies_to: d.applies_to }, () => route()); }
    if (ei) editDue(dues.find(x => String(x.id) === ei));
  });
};

function editDue(d) {
  const isNew = !d;
  d = d || { work_type: 'GST', due_day: 20, months: [], period_rule: 'prev_month' };
  const body = `<div class="form-grid">
    <label>Work type<select name="work_type">${opts(WORK_TYPES, d.work_type)}</select></label>
    <label>Return / task<input autocomplete="off" name="return_name" list="${dlFor(d.work_type)}" value="${esc(d.return_name || '')}"></label>
    <label class="full">Description<input name="description" value="${esc(d.description || '')}"></label>
    <label>Applies to (optional)<input name="applies_to" value="${esc(d.applies_to || '')}" placeholder="Monthly / QRMP / Composition"></label>
    <label>Due day of month<input name="due_day" type="number" min="1" max="31" value="${esc(d.due_day)}"></label>
    <label class="full">Period shown<select name="period_rule">${opts(Object.keys(PERIOD_RULES), d.period_rule, k => PERIOD_RULES[k])}</select></label>
    <div class="full"><div class="small muted" style="margin-bottom:6px;font-weight:500">Months in which this date falls</div>
      <div class="months">${MONTHS.map((n, i) => `<label class="check"><input type="checkbox" value="${i + 1}" ${(d.months || []).includes(i + 1) ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
    <p class="muted small full">"Applies to" = Monthly, QRMP or Composition pre-ticks GST clients with that scheme when you create work.</p></div>`;
  const m = modal(isNew ? 'Add due date' : 'Edit due date', body, {
    extra: isNew || !isPartner() ? '' : '<button class="btn danger" data-del>Delete</button>',
    onSave: async el => {
      const rec = {
        work_type: fv(el, 'work_type'), return_name: fv(el, 'return_name'), description: fv(el, 'description') || null,
        applies_to: fv(el, 'applies_to') || null, due_day: parseInt(fv(el, 'due_day'), 10), period_rule: fv(el, 'period_rule'),
        months: $$('.months input:checked', el).map(i => +i.value)
      };
      if (!rec.return_name || !(rec.due_day >= 1 && rec.due_day <= 31) || !rec.months.length) { toast('Return, a day (1–31) and at least one month are required', true); return false; }
      if (isNew) await must(sb.from('due_dates').insert({ ...rec, sort: 100 }));
      else await must(sb.from('due_dates').update(rec).eq('id', d.id));
      toast('Saved'); route();
    }
  });
  linkTypeToList(m.el);
  const del = $('[data-del]', m.el);
  if (del) del.onclick = async () => {
    if (!confirm('Delete this due date from the calendar? (Existing work items are not affected.)')) return;
    try { await must(sb.from('due_dates').delete().eq('id', d.id)); m.close(); toast('Deleted'); route(); } catch (e) { toast(friendly(e), true); }
  };
}

/* ---------- CLIENTS (admin) ---------- */
let clientQ = '', showInactive = false;
VIEWS.clients = async v => {
  await loadRefs();
  const obR = await safe(sb.from('onboarding').select('client_id,status,items').limit(5000));
  const obMap = Object.fromEntries((obR.error ? [] : obR.data || []).map(o => [o.client_id, o]));
  v.innerHTML = `<div class="page-head"><h2>Clients</h2><span class="muted">${clients.filter(c => c.active).length} active</span><span class="spacer"></span>
      ${isAdmin() ? '<button class="btn ghost" id="lgLog">Login access log</button>' : ''}<button class="btn" id="tplBtn">CSV template</button><button class="btn" id="impBtn">Import CSV</button>
      <button class="btn primary" id="addC">+ Add client</button><input type="file" id="impFile" accept=".csv,text/csv" hidden></div>
    <div id="cMiss"></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="Search code / name / GSTIN / PAN" value="${esc(clientQ)}">
      <label class="check"><input type="checkbox" id="inact" ${showInactive ? 'checked' : ''}> Show inactive</label></div>
    <div id="cList"></div>`;
  const render = () => {
    const s = clientQ.toLowerCase();
    const list = clients.filter(c => (showInactive || c.active) && (!s || [c.client_code, c.name, c.gstin, c.pan, c.tan, c.cin].join(' ').toLowerCase().includes(s)))
      .sort((a, b) => (a.client_code ? 0 : 1) - (b.client_code ? 0 : 1) || String(a.client_code || a.name).localeCompare(String(b.client_code || b.name), 'en', { numeric: true }));
    const miss = clients.filter(c => c.active && clientProblems({ ...c, client_code: (c.client_code || '').toUpperCase() }, c.id).length);
    $('#cMiss').innerHTML = miss.length ? `<p class="note warn small">${miss.length} active client${miss.length > 1 ? 's are' : ' is'} missing required details (client code, PAN, GSTIN, phone or email): ${miss.slice(0, 8).map(c => `<button class="link" data-ed="${c.id}">${esc(c.name)}</button>`).join(', ')}${miss.length > 8 ? ' …' : ''}. Open each one and fill them in.</p>` : '';
    $('#cMiss').onclick = e => { if (e.target.dataset.ed) editClient(clientById(e.target.dataset.ed)); };
    $('#cList').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Client</th><th>GSTIN</th><th>PAN / TAN</th><th>GST scheme</th><th>Services</th><th>Default staff</th><th>Status link</th><th></th></tr></thead><tbody>
      ${list.map(c => `<tr>
        <td>${c.client_code ? `<span class="ccode">${esc(c.client_code)}</span>` : '<span class="late small">—</span>'}</td>
        <td class="wrap"><b>${esc(c.name)}</b>${c.active ? '' : ' <span class="badge">inactive</span>'}<div class="muted small">${esc([c.contact_person, c.phone].filter(Boolean).join(' · '))}</div></td>
        <td class="small">${esc(c.gstin || '—')}</td><td class="small">${esc(c.pan || '—')}<div class="muted">${esc(c.tan || '')}</div></td>
        <td>${esc(c.gst_scheme)}</td><td class="wrap">${(c.services || []).map(wtBadge).join(' ')}</td>
        <td>${esc(profName(c.default_staff) || '—')}</td>
        <td class="row-btns"><button class="btn sm" data-copy="${c.id}">Copy link</button><a class="btn sm" href="${esc(waShare(clientMsg(c), c.phone))}" target="_blank" rel="noopener" title="Send on WhatsApp">WhatsApp</a><a class="btn sm ghost" href="${esc(statusUrl(c.status_token))}" target="_blank" rel="noopener">Open</a></td>
        <td class="row-btns"><button class="btn sm" data-lgc="${c.id}" title="GST / TDS / MCA portal logins">🔑 Logins</button><button class="btn sm" data-obc="${c.id}" title="KYC, engagement letter, fees, recurring work">${obMap[c.id] ? (obMap[c.id].status === 'Completed' ? '✓ Onboarded' : `Onboarding ${obProgress(obMap[c.id]).done}/${obProgress(obMap[c.id]).total}`) : 'Onboard'}</button><button class="btn sm" data-ed="${c.id}">Edit</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="table-wrap"><div class="empty">${clients.length ? 'No match.' : 'No clients yet. Add one, or import your list from a CSV file.'}</div></div>`;
  };
  render();
  $('#cq').oninput = e => { clientQ = e.target.value; render(); };
  $('#inact').onchange = e => { showInactive = e.target.checked; render(); };
  $('#addC').onclick = () => editClient(null);
  $('#cList').onclick = e => {
    if (e.target.dataset.copy) copy(statusUrl(clientById(e.target.dataset.copy).status_token));
    if (e.target.dataset.ed) editClient(clientById(e.target.dataset.ed));
    if (e.target.dataset.lgc) openLogins(clientById(e.target.dataset.lgc));
    if (e.target.dataset.obc) openOnboarding(clientById(e.target.dataset.obc));
  };
  if ($('#lgLog')) $('#lgLog').onclick = () => loginLog(null);
  $('#tplBtn').onclick = () => download('clients-template.csv', toCSV([
    ['client_code', 'name', 'gstin', 'pan', 'tan', 'cin', 'contact_person', 'phone', 'email', 'gst_scheme', 'services', 'default_staff_email'],
    ['JLR001', 'ABC Traders', '33AAAAA0000A1Z5', 'AAAAA0000A', 'CHEA00000A', '', 'Mr. Kumar', '9876543210', 'abc@example.com', 'Monthly', 'GST;TDS;Income Tax', me.email]]));
  $('#impBtn').onclick = () => $('#impFile').click();
  $('#impFile').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) return toast('The file has no data rows', true);
      const head = rows[0].map(h => h.trim().toLowerCase());
      const col = n => head.indexOf(n);
      if (col('name') < 0) return toast('The first row must contain a "name" column (use the CSV template)', true);
      const get = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
      const recs = rows.slice(1).filter(r => get(r, 'name')).map(r => {
        const scheme = GST_SCHEMES.find(s => s.toLowerCase() === get(r, 'gst_scheme').toLowerCase()) || (get(r, 'gstin') ? 'Monthly' : 'Not registered');
        const services = get(r, 'services').split(/[;|]/).map(s => s.trim()).map(s => WORK_TYPES.find(w => w.toLowerCase() === s.toLowerCase())).filter(Boolean);
        const staff = profiles.find(p => (p.email || '').toLowerCase() === get(r, 'default_staff_email').toLowerCase());
        return { client_code: get(r, 'client_code').toUpperCase() || null, name: get(r, 'name'), gstin: get(r, 'gstin').toUpperCase() || null, pan: get(r, 'pan').toUpperCase() || null, tan: get(r, 'tan').toUpperCase() || null,
          cin: get(r, 'cin').toUpperCase() || null, contact_person: get(r, 'contact_person') || null, phone: cleanPhone(get(r, 'phone')), email: cleanEmail(get(r, 'email')),
          gst_scheme: scheme, services, default_staff: staff ? staff.id : null };
      });
      const seenCodes = new Set(), bad = [];
      recs.forEach((r, i) => {
        const pr = clientProblems(r);
        if (r.client_code && seenCodes.has(r.client_code)) pr.push(`Client code ${r.client_code} appears twice in the file`);
        if (r.client_code) seenCodes.add(r.client_code);
        if (pr.length) bad.push(`Row ${i + 2} (${r.name}): ${pr.join('; ')}`);
      });
      if (bad.length) {
        modal('Fix the file first', `<p class="small" style="margin-top:0">Nothing was imported. ${bad.length} row${bad.length > 1 ? 's need' : ' needs'} fixing — client code, name, PAN, GSTIN, phone and email are required:</p>
          <ul class="small">${bad.slice(0, 40).map(b => `<li>${esc(b)}</li>`).join('')}</ul>${bad.length > 40 ? `<p class="small">…and ${bad.length - 40} more</p>` : ''}`);
        return;
      }
      if (!confirm(`Import ${recs.length} client(s)?`)) return;
      await must(sb.from('clients').insert(recs));
      toast(`${recs.length} clients imported`); route();
    } catch (err) { toast(friendly(err), true); }
  };
};

/* v25: client details check — code, name, PAN, GSTIN, phone and email are required */
const REQ = '<b class="req" title="Required">*</b>';
function clientProblems(rec, selfId = null) {
  const p = [];
  if (!rec.client_code) p.push('Client code is required');
  else if (!/^[A-Z0-9][A-Z0-9/_.-]{0,19}$/.test(rec.client_code)) p.push('Client code: letters, numbers and / - _ . only (up to 20)');
  else { const dup = clients.find(c => c.id !== selfId && (c.client_code || '').toUpperCase() === rec.client_code); if (dup) p.push(`Client code ${rec.client_code} is already used by ${dup.name}`); }
  if (!rec.name) p.push('Client name is required');
  if (!rec.pan) p.push('PAN is required');
  else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(rec.pan)) p.push('PAN format looks wrong (e.g. ABCDE1234F)');
  if (rec.gst_scheme !== 'Not registered' || rec.gstin) {
    if (!rec.gstin) p.push('GSTIN is required (choose GST scheme “Not registered” if the client has no GST)');
    else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(rec.gstin)) p.push('GSTIN format looks wrong (e.g. 33ABCDE1234F1Z5)');
    else if (rec.pan && rec.gstin.slice(2, 12) !== rec.pan) p.push('GSTIN does not match the PAN (characters 3–12 of the GSTIN are the PAN)');
  }
  if (!rec.phone) p.push('Phone is required');
  else if (!/^[6-9][0-9]{9}$/.test(rec.phone)) p.push('Phone should be a 10-digit mobile number');
  if (!rec.email) p.push('Email is required');
  else { const bad = rec.email.split(',').map(x => x.trim()).filter(x => !/^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/i.test(x)); if (bad.length) p.push('Email looks wrong: ' + bad.join(', ')); }
  return p;
}
const cLabel = c => (c.client_code ? c.client_code + ' · ' : '') + c.name;
const cleanPhone = v => { let d = String(v || '').replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d.startsWith('0')) d = d.slice(1); return d || null; };
const cleanEmail = v => String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean).join(', ') || null;

function editClient(c) {
  const isNew = !c;
  c = c || { gst_scheme: 'Monthly', services: ['GST'], active: true };
  const body = `<div class="form-grid">
    <p class="full muted small" style="margin:0">Fields marked ${REQ} are required.</p>
    <label>Client code ${REQ}<input name="client_code" value="${esc(c.client_code || '')}" maxlength="20" style="text-transform:uppercase" placeholder="e.g. JLR001" autocomplete="off" required></label>
    <label>Client / business name ${REQ}<input name="name" value="${esc(c.name || '')}" required></label>
    <label>PAN ${REQ}<input name="pan" value="${esc(c.pan || '')}" maxlength="10" style="text-transform:uppercase" required></label>
    <label>GSTIN ${REQ}<input name="gstin" value="${esc(c.gstin || '')}" maxlength="15" style="text-transform:uppercase"></label>
    <label>Phone / WhatsApp ${REQ}<input name="phone" value="${esc(c.phone || '')}" placeholder="10-digit mobile" inputmode="tel" required></label>
    <label>Email ${REQ}<input name="email" value="${esc(c.email || '')}" placeholder="accounts@client.com, owner@client.com" inputmode="email" required></label>
    <label>GST scheme<select name="gst_scheme">${opts(GST_SCHEMES, c.gst_scheme)}</select></label>
    <label>TAN<input name="tan" value="${esc(c.tan || '')}" maxlength="10" style="text-transform:uppercase"></label>
    <label>CIN / LLPIN<input name="cin" value="${esc(c.cin || '')}" style="text-transform:uppercase"></label>
    <label>Default staff<select name="default_staff">${staffOpts(c.default_staff || '', { blank: 'None' })}</select></label>
    <label>Contact person<input name="contact_person" value="${esc(c.contact_person || '')}"></label>
    ${P4() ? `<label class="full">Address (for invoices)<textarea name="address" rows="2">${esc(c.address || '')}</textarea></label>` : ''}
    <p class="full muted small" style="margin:0">Several emails? Separate them with commas — reminders go to the first one.</p>
    <div class="full"><div class="small muted" style="margin-bottom:6px;font-weight:500">Services you handle for this client</div>
      <div class="toolbar" style="margin:0" data-svc>${[...WORK_TYPES, ...(c.services || []).filter(x => !WORK_TYPES.includes(x))].map(w => `<label class="check"><input type="checkbox" value="${esc(w)}" ${(c.services || []).includes(w) ? 'checked' : ''}> ${wtIcon(w, 16)} ${esc(w)}</label>`).join('')}</div>
      ${'tds_pay_work' in c || isNew && clients.some(x => 'tds_pay_work' in x) ? `<div class="toolbar" style="margin:6px 0 0"><span class="small muted">TDS data emails on the 1st:</span>
        <label class="check"><input type="checkbox" name="tds_pay_work" ${c.tds_pay_work ? 'checked' : ''}> TDS payment workings (monthly)</label>
        <label class="check"><input type="checkbox" name="tds_return" ${c.tds_return ? 'checked' : ''}> TDS return filing (quarterly)</label></div>` : ''}</div>
    <label class="full">Notes<textarea name="notes">${esc(c.notes || '')}</textarea></label>
    <label class="check full"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> Active client</label>
    ${'chase_off' in c ? `<label class="check full"><input type="checkbox" name="chase_off" ${c.chase_off ? 'checked' : ''}> Don't send automatic “please send your documents” reminders to this client</label>` : ''}
    ${!isNew && c.gstin && isAdmin() ? `<div class="full"><button type="button" class="btn sm" data-gstnow>Check GST filing now</button>
      <span class="muted small">Looks up this GSTIN's filed returns and marks matching open GST work as Filed.</span></div>` : ''}
    ${!isNew ? '<div class="full"><button type="button" class="btn sm" data-govlg>🔑 GST / TDS / MCA portal logins</button> <span class="muted small">Encrypted · every view is logged</span></div>' : ''}
    ${!isNew && isManager() ? '<div class="full portal-box" data-portal></div>' : ''}
    ${!isNew ? `<div class="full"><div class="small muted" style="font-weight:500">Client status link (share with this client only)</div>
      <div class="linkbox"><input readonly value="${esc(statusUrl(c.status_token))}"><button type="button" class="btn sm" data-cp>Copy</button><a class="btn sm" href="${esc(waShare(clientMsg(c), c.phone))}" target="_blank" rel="noopener">WhatsApp</a><button type="button" class="btn sm" data-regen>New link</button></div></div>` : ''}
  </div>`;
  const m = modal(isNew ? 'Add client' : 'Edit client', body, {
    wide: true,
    extra: isNew || !isPartner() ? '' : '<button class="btn danger" data-del>Delete</button><button class="btn ghost" type="button" data-hist>History</button>',
    onSave: async el => {
      const up = n => fv(el, n).toUpperCase() || null;
      const rec = {
        client_code: up('client_code'), name: fv(el, 'name'), gstin: up('gstin'), pan: up('pan'), tan: up('tan'), cin: up('cin'),
        gst_scheme: fv(el, 'gst_scheme'), default_staff: fv(el, 'default_staff') || null,
        contact_person: fv(el, 'contact_person') || null, phone: cleanPhone(fv(el, 'phone')), email: cleanEmail(fv(el, 'email')),
        ...(P4() ? { address: fv(el, 'address') || null } : {}),
        notes: fv(el, 'notes') || null, active: $('[name=active]', el).checked, ...($('[name=chase_off]', el) ? { chase_off: $('[name=chase_off]', el).checked } : {}),
        services: $$('[data-svc] input:checked', el).map(i => i.value),
        ...($('[name=tds_pay_work]', el) ? { tds_pay_work: $('[name=tds_pay_work]', el).checked, tds_return: $('[name=tds_return]', el).checked } : {})
      };
      const probs = clientProblems(rec, isNew ? null : c.id);
      $$('.bad', el).forEach(x => x.classList.remove('bad'));
      if (probs.length) {
        const field = { 'Client code': 'client_code', 'Client name': 'name', PAN: 'pan', GSTIN: 'gstin', Phone: 'phone', Email: 'email' };
        probs.forEach(t => { const k = Object.keys(field).find(f => t.startsWith(f)); if (k) $(`[name=${field[k]}]`, el)?.classList.add('bad'); });
        $('.bad', el)?.focus();
        toast(probs.length > 1 ? `Please fix ${probs.length} things: ${probs.join(' · ')}` : probs[0], true); return false;
      }
      if (isNew) {
        const { data: nc } = await must(sb.from('clients').insert(rec).select().single());
        toast('Saved');
        if (nc && isManager() && confirm(`Start onboarding for ${nc.name}?\n(KYC documents, engagement letter, fee agreement and recurring work)`)) {
          clients.push(nc);
          try { await startOnboarding(nc); openOnboarding(nc); } catch (e) { toast(friendly(e), true); }
        }
        route(); return;
      }
      else await must(sb.from('clients').update(rec).eq('id', c.id));
      toast('Saved'); route();
    }
  });
  const el = m.el;
  if ($('[data-hist]', el)) $('[data-hist]', el).onclick = () => showHistory('client', c.id, (c.client_code ? c.client_code + ' · ' : '') + c.name);
  $('[name=gstin]', el).addEventListener('input', e => { const g = e.target.value.toUpperCase(), pan = $('[name=pan]', el); if (g.length >= 12 && !pan.value.trim()) pan.value = g.slice(2, 12); });
  if ($('[data-cp]', el)) $('[data-cp]', el).onclick = () => copy(statusUrl(c.status_token));
  if ($('[data-gstnow]', el)) $('[data-gstnow]', el).onclick = async e => {
    const b = e.target; b.disabled = true;
    try {
      const { data } = await must(sb.rpc('gst_admin_run', { p_client: c.id }));
      toast(data || 'Check sent');
      if (/sent/.test(data || '')) setTimeout(async () => { const r = await sb.rpc('gst_admin_process'); toast(r.error ? friendly(r.error) : (r.data || 'Done')); }, 6000);
    } catch (err) { toast(friendly(err), true); }
    finally { b.disabled = false; }
  };
  if ($('[data-portal]', el)) renderPortalLogins($('[data-portal]', el), c);
  if ($('[data-govlg]', el)) $('[data-govlg]', el).onclick = () => openLogins(c);
  if ($('[data-regen]', el)) $('[data-regen]', el).onclick = async () => {
    if (!confirm('Create a new link? The old link will stop working.')) return;
    try {
      const token = newId();
      await must(sb.from('clients').update({ status_token: token }).eq('id', c.id));
      c.status_token = token; $('.linkbox input', el).value = statusUrl(token); toast('New link created');
    } catch (e) { toast(friendly(e), true); }
  };
  if ($('[data-del]', el)) $('[data-del]', el).onclick = async () => {
    if (!confirm(`Delete "${c.name}" and ALL its work history? Tip: untick "Active client" instead to keep history.`)) return;
    try { await must(sb.from('clients').delete().eq('id', c.id)); m.close(); toast('Deleted'); route(); } catch (e) { toast(friendly(e), true); }
  };
}

/* ---------- TEAM (admin) ---------- */
VIEWS.team = async v => {
  await loadRefs();
  v.innerHTML = `<div class="page-head"><h2>Team</h2><span class="muted">${profiles.filter(p => p.active).length} active</span></div>
    <div class="note small"><b>To add a team member:</b> open your Supabase project → <b>Authentication</b> → <b>Users</b> → <b>Add user</b> → <b>Create new user</b>.
      Enter their email and a starting password and tick <b>Auto Confirm User</b>. They will appear here; then click <b>Edit</b> to set their name and WhatsApp number.
      They can change their password after signing in.</div><br>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>WhatsApp</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
      ${profiles.map(p => `<tr><td><b>${esc(p.full_name || '—')}</b>${p.id === me.id ? ' <span class="muted small">(you)</span>' : ''}</td><td>${esc(p.email)}</td>
        <td>${esc(p.phone || '—')}</td><td><span class="badge role-${esc(p.role)}">${esc(ROLE_LABEL[p.role] || p.role)}</span></td><td>${p.active ? 'Active' : '<span class="muted">Inactive</span>'}</td>
        <td><button class="btn sm" data-ed="${p.id}">Edit</button></td></tr>`).join('')}
    </tbody></table></div>`;
  v.onclick = e => {
    const id = e.target.dataset.ed; if (!id) return;
    const p = profiles.find(x => x.id === id);
    const self = p.id === me.id;
    modal('Edit team member', `<div class="form-grid">
        <label class="full">Full name<input name="full_name" value="${esc(p.full_name || '')}"></label>
        <label>WhatsApp number<input name="phone" value="${esc(p.phone || '')}" placeholder="919876543210"></label>
        <label>Role<select name="role" ${self ? 'disabled' : ''}>${opts(['staff', 'manager', 'partner', 'admin'], p.role, r => ({ staff: 'Team member — own work only', manager: 'Manager — all work, clients, billing', partner: 'Partner — everything except Settings & Team', admin: 'Admin — everything' })[r])}</select></label>
        <label class="check full"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} ${self ? 'disabled' : ''}> Active (can sign in)</label>
        <p class="muted small full">WhatsApp number with country code, no + or spaces (used for reminders in Phase 2).</p></div>`,
      { onSave: async el => {
        const rec = { full_name: fv(el, 'full_name') || null, phone: fv(el, 'phone').replace(/[^0-9]/g, '') || null };
        if (!self) { rec.role = fv(el, 'role'); rec.active = $('[name=active]', el).checked; }
        await must(sb.from('profiles').update(rec).eq('id', p.id));
        toast('Saved'); if (self) Object.assign(me, rec); route();
      } });
  };
};

/* ---------- SETTINGS (admin) ---------- */
VIEWS.settings = async v => {
  await loadRefs();
  v.innerHTML = `<div class="page-head"><h2>Settings</h2></div>
    <div class="card"><h3>Office name</h3><div class="toolbar"><input id="firm" value="${esc(settings.firm_name || '')}" style="flex:1;max-width:420px"><button class="btn primary" id="saveFirm">Save</button></div>
      <p class="muted small">Shown in the app header and on the status pages.</p></div>
    <div class="card"><h3>Common status board</h3>
      <p class="muted">One link anyone can open to see the status of all clients' work due in the last 45 / next 45 days (client name, return, period, due date, status — no ARN, remarks or contact details).</p>
      <label class="check"><input type="checkbox" id="boardOn" ${settings.board_enabled ? 'checked' : ''}> Board link is switched on</label><br>
      <div class="linkbox"><input readonly value="${esc(boardUrl(settings.board_token))}"><button class="btn sm" id="cpBoard">Copy</button>
        <a class="btn sm ghost" href="${esc(boardUrl(settings.board_token))}" target="_blank" rel="noopener">Open</a><button class="btn sm" id="regenBoard">New link</button></div>
      <p class="note warn small" style="margin-top:12px">Anyone with this link can see all your client names. For clients, prefer each client's own private link (Clients page → Copy link).</p></div>`;
  const save = async patch => { await must(sb.from('settings').update(patch).eq('id', 1)); Object.assign(settings, patch); toast('Saved'); };
  $('#saveFirm').onclick = async () => { try { await save({ firm_name: $('#firm').value.trim() || 'Our Office' }); $('.brand').textContent = settings.firm_name; } catch (e) { toast(friendly(e), true); } };
  $('#boardOn').onchange = async e => { try { await save({ board_enabled: e.target.checked }); } catch (err) { toast(friendly(err), true); } };
  $('#cpBoard').onclick = () => copy(boardUrl(settings.board_token));
  $('#regenBoard').onclick = async () => {
    if (!confirm('Create a new board link? The old link will stop working.')) return;
    try { await save({ board_token: newId() }); route(); } catch (e) { toast(friendly(e), true); }
  };
  v.insertAdjacentHTML('beforeend', invoiceSettingsCard());
  bindInvoiceSettings(v);
  if (P4()) { const zb = document.createElement('div'); v.appendChild(zb); renderZohoSettings(zb); }
  const wa = document.createElement('div');
  v.appendChild(wa);
  renderWhatsApp(wa);
  const gst = document.createElement('div');
  v.appendChild(gst);
  renderGst(gst);
  const ml = document.createElement('div');
  v.appendChild(ml);
  renderMailSettings(ml);
  const nw = document.createElement('div');
  v.appendChild(nw);
  renderNoticeWatchSettings(nw);
  const aw = document.createElement('div');
  v.appendChild(aw);
  renderAutoWorkSettings(aw);
  const ch = document.createElement('div');
  v.appendChild(ch);
  renderChaseSettings(ch);
  const dr = document.createElement('div');
  v.appendChild(dr);
  renderDataRequestSettings(dr);
  const dm = document.createElement('div');
  v.appendChild(dm);
  renderDemoSettings(dm);
  const ai = document.createElement('div');
  v.appendChild(ai);
  renderAiSettings(ai);
};

/* ---------- Settings: automatic GST work ---------- */
async function renderAutoWorkSettings(box) {
  const r = await safe(sb.rpc('auto_work_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Automatic GST work</h3><p class="note small">Run <b>update-session6.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {};
  box.innerHTML = `<div class="card"><h3>Automatic GST work</h3>
    <p class="muted">Every morning the tracker creates the month's GST returns for each active GST client — GSTR-1 and GSTR-3B for monthly filers, IFF / quarterly returns for QRMP, CMP-08 / GSTR-4 for composition — from the due dates list, and gives each one to the client's own staff member. Work you delete is not created again.</p>
    <div class="mail-stat"><span class="pill ${s.gst_enabled ? 'g' : 'a'}">${s.gst_enabled ? '● On' : 'Off'}</span>
      <span class="small">Last run: <b>${s.last_run_at ? new Date(s.last_run_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</b>${s.last_note ? ' · ' + esc(s.last_note) : ''}</span></div>
    <p class="muted small">Clients need: GST ticked in services, a GST scheme (Monthly / QRMP / Composition) and a default staff member.</p>
    <div class="toolbar" style="margin-top:12px"><label class="check"><input type="checkbox" id="awOn" ${s.gst_enabled ? 'checked' : ''} ${isPartner() ? '' : 'disabled'}> Create GST work automatically</label><span class="spacer"></span>
      <button class="btn" id="awRun">Create this month's work now</button></div></div>`;
  $('#awOn', box).onchange = async e => { try { await must(sb.rpc('auto_work_save', { p_gst: e.target.checked })); toast('Saved'); renderAutoWorkSettings(box); } catch (err) { toast(friendly(err), true); } };
  $('#awRun', box).onclick = async e => {
    e.target.disabled = true;
    try { const { data } = await must(sb.rpc('auto_work_run')); toast(data ? `${data} new GST work item${data > 1 ? 's' : ''} created` : 'Nothing new — this month\'s GST work is already there'); renderAutoWorkSettings(box); }
    catch (err) { toast(friendly(err), true); e.target.disabled = false; }
  };
}

/* ---------- Settings: notice watch (admin) ---------- */
async function renderNoticeWatchSettings(box) {
  const r = await safe(sb.rpc('notice_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Notice watch</h3><p class="note small">Run <b>update-session6.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {}, when = t => t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<div class="card"><h3>Notice watch (GST · TDS · MCA)</h3>
    <p class="muted">The office mailbox script reads emails from the GST, Income-tax, TRACES and MCA portals — and client emails forwarding a notice — and adds them to Notices with the client, type, reference, period and reply date. Managers and Partners get an email for each new notice and a summary every morning (8 AM) and night (8 PM).</p>
    <div class="mail-stat"><span class="pill ${s.enabled && s.connected ? 'g' : 'a'}">${s.enabled && s.connected ? '● Running' : s.connected ? 'Switched off' : 'Not set up'}</span>
      <span class="small">Last check: <b>${when(s.last_check_at)}</b>${s.last_found != null ? ` · found <b>${s.last_found}</b>` : ''} · Needs a client: <b>${s.unmatched || 0}</b></span></div>
    ${s.last_error ? `<p class="note warn small">Last problem: ${esc(s.last_error)}</p>` : ''}
    <div class="form-grid" style="margin-top:12px">
      <label>Check the mailbox every (minutes)<input type="number" id="nwEvery" min="5" max="240" value="${esc(s.every_minutes || 15)}"></label>
      <label>WhatsApp template name<input id="nwTpl" value="${esc(s.wa_template || 'notice_alert')}"></label></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="nwOn" ${s.enabled ? 'checked' : ''}> Switched on</label>
    <label class="check"><input type="checkbox" id="nwMail" ${s.alert_email ? 'checked' : ''}> Email alert to Managers &amp; Partners</label>
    <label class="check"><input type="checkbox" id="nwWa" ${s.alert_wa ? 'checked' : ''}> WhatsApp alert to Managers &amp; Partners (needs the approved template below and their phone numbers in Team)</label>
    <details class="small" style="margin-top:8px"><summary>WhatsApp template to submit in Meta (Utility, English)</summary>
      <p>Name <b>notice_alert</b>, body:</p><pre class="code">New {{1}} notice for {{2}}: {{3}}. Reply due: {{4}}. Open {{5}}</pre></details>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" id="nwSave">Save</button><span class="spacer"></span>
      <button class="btn" id="nwKey">${s.connected ? 'Make a new key' : 'Make the notice key'}</button><button class="btn" id="nwScript">Mailbox script &amp; steps</button></div>
    ${s.connected ? `<p class="muted small">Key made ${when(s.key_set_at)}. Making a new key stops the old one — paste the new key in the mailbox script as NOTICE_KEY.</p>` : ''}</div>`;
  if (!isAdmin()) $$('input,button', box).forEach(x => x.disabled = true);
  $('#nwSave', box).onclick = async () => {
    try { await must(sb.rpc('notice_admin_save', { p: { enabled: $('#nwOn', box).checked, alert_email: $('#nwMail', box).checked, alert_wa: $('#nwWa', box).checked, wa_template: $('#nwTpl', box).value.trim(), every_minutes: Math.round(num($('#nwEvery', box).value)) || 15 } })); toast('Saved'); renderNoticeWatchSettings(box); }
    catch (e) { toast(friendly(e), true); }
  };
  $('#nwKey', box).onclick = async () => {
    if (s.connected && !confirm('Make a new key? The notice watch stops until you paste the new key into the mailbox script.')) return;
    const bytes = crypto.getRandomValues(new Uint8Array(24)), key = 'jlrn_' + [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(x => x.toString(16).padStart(2, '0')).join('');
    try { await must(sb.rpc('notice_admin_set_key', { p_hash: hash })); } catch (e) { return toast(friendly(e), true); }
    const m = modal('Notice key', `<p class="small" style="margin-top:0">Paste this in the mailbox script: Project Settings → Script properties → <b>NOTICE_KEY</b>. <b>It is shown only once.</b></p>
      <div class="linkbox"><input readonly value="${esc(key)}"><button class="btn sm" id="nwCp">Copy</button></div>`);
    $('#nwCp', m.el).onclick = () => copySecret(key, 'Key copied');
    $$('[data-x]', m.el).forEach(x => x.addEventListener('click', () => renderNoticeWatchSettings(box)));
  };
  $('#nwScript', box).onclick = async () => {
    let code = '';
    try { const rr = await fetch('mail-intake-apps-script.gs', { cache: 'no-store' }); code = rr.ok ? await rr.text() : ''; } catch (e) {}
    const m = modal('Notice watch — mailbox script', `<ol class="small steps">
        <li>Sign in to the office Gmail and open the <b>JLR mail intake</b> project on <a href="https://script.google.com/home" target="_blank" rel="noopener">script.google.com</a> (the same one used for client mail).</li>
        <li>Replace all the code with the script below and click <b>Save</b>.</li>
        <li>Project Settings → Script properties → <b>Add</b>: name <b>NOTICE_KEY</b>, value = the key from “Make the notice key”. Keep INTAKE_KEY as it is.</li>
        <li>Choose <b>setup</b> at the top and click <b>Run</b>. Allow the new “send email” permission.</li>
        <li>Press <b>Check now</b> on the Notices page — the last check time updates within a minute.</li></ol>
      ${code ? `<textarea readonly rows="14" class="code">${esc(code)}</textarea>` : '<p class="note warn small">Script file not found on the site — upload mail-intake-apps-script.gs with the other files.</p>'}`,
      { wide: true, extra: code ? '<button class="btn" id="nwCpS">Copy script</button>' : '' });
    if (code) $('#nwCpS', m.el).onclick = () => copySecret(code, 'Script copied');
  };
}

/* ---------- GST auto-status via Sandbox (admin, Settings page) ---------- */
async function renderGst(box) {
  box.innerHTML = '<div class="card"><h3>GST auto-status</h3><div class="loading">Loading…</div></div>';
  const { data: st, error } = await sb.rpc('gst_admin_status');
  if (error || !st) {
    box.innerHTML = `<div class="card"><h3>GST auto-status</h3><p class="muted">Not set up yet — run <b>phase3-gst.sql</b> in Supabase first.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="card"><h3>GST auto-status</h3>
    <p class="muted small">Checks each GST client's filed returns on the GST portal (through Sandbox) once a day between the days below, 8 AM–9 PM.
      Any open GSTR-1 / IFF / GSTR-3B / CMP-08 / GSTR-4 / GSTR-9 work that is filed on the portal is marked <b>Filed</b> with the ARN and date. Clients need a valid GSTIN.</p>
    <div class="form-grid">
      <label class="check full"><input type="checkbox" name="g_enabled" ${st.enabled ? 'checked' : ''}> <b>Automatic daily checks switched on</b></label>
      <label>Check from day<input type="number" min="1" max="31" name="g_start" value="${esc(st.start_day)}"></label>
      <label>to day<input type="number" min="1" max="31" name="g_end" value="${esc(st.end_day)}"></label>
    </div>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" data-g="save">Save</button></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <div class="small muted" style="font-weight:500;margin-bottom:6px">Sandbox API key &amp; secret — ${st.keys_saved ? '<span style="color:var(--green)">✓ saved (hidden)</span>' : '<span style="color:var(--amber)">not saved yet</span>'}
      ${st.keys_saved ? (st.logged_in ? ' · <span style="color:var(--green)">connected</span>' : ' · not connected yet') : ''}</div>
    <div class="form-grid">
      <label>API key<input type="password" name="g_key" autocomplete="off" placeholder="key_live_…"></label>
      <label>API secret<input type="password" name="g_secret" autocomplete="off" placeholder="secret_live_…"></label>
    </div>
    <div class="toolbar" style="margin-top:8px"><button class="btn" data-g="keys">Save keys</button></div>
    <p class="muted small">From console.sandbox.co.in → Settings → API Keys. Stored encrypted in Supabase Vault; never shown again.</p>
    ${st.last_error ? `<p class="error small">${esc(st.last_error)}</p>` : ''}
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <div class="toolbar"><button class="btn" data-g="run">Check all GST clients now</button>
      <span class="spacer"></span><button class="btn sm ghost" data-g="refresh">Refresh log</button></div>
    <p class="muted small">Each check uses one Sandbox API call per client.</p>
    <div data-glog></div></div>`;
  const val = n => $(`[name="${n}"]`, box);
  const loadLog = async () => {
    const { data, error: e } = await sb.rpc('gst_admin_log', { p_limit: 30 });
    const el = $('[data-glog]', box);
    if (e) { el.innerHTML = `<p class="error small">${esc(friendly(e))}</p>`; return; }
    const rows = data || [];
    el.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Client</th><th>Year</th><th>Result</th></tr></thead><tbody>
      ${rows.map(r => {
        const ok = r.status_code >= 200 && r.status_code < 300;
        const res = !r.processed_at ? '<span class="muted">checking…</span>'
          : ok ? `<span style="color:var(--green)">✓</span> ${esc(r.result || '')}` : `<span class="error">✗ ${esc(String(r.status_code || ''))}</span> <span class="small">${esc(r.result || '')}</span>`;
        return `<tr><td>${new Date(r.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td>${esc(r.client || '')}<div class="muted small">${esc(r.gstin || '')}</div></td><td>${esc(r.fy || '')}</td><td class="wrap">${res}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="table-wrap"><div class="empty">No checks yet.</div></div>';
  };
  box.onclick = async e => {
    const act = e.target.dataset.g; if (!act) return;
    const btn = e.target; btn.disabled = true;
    try {
      if (act === 'save') {
        await must(sb.rpc('gst_admin_save', { p_enabled: val('g_enabled').checked, p_start: +val('g_start').value || 10, p_end: +val('g_end').value || 25 }));
        toast('GST auto-status settings saved');
      }
      if (act === 'keys') {
        const k = val('g_key').value.trim(), sc = val('g_secret').value.trim();
        if (!k || !sc) { toast('Paste both the API key and the API secret', true); return; }
        await must(sb.rpc('gst_admin_set_keys', { p_key: k, p_secret: sc }));
        val('g_key').value = ''; val('g_secret').value = '';
        toast('Keys saved securely — connecting…');
        await sb.rpc('gst_admin_run', { p_client: null });
        setTimeout(() => renderGst(box), 4000);
        return;
      }
      if (act === 'run') {
        if (!confirm('Check every GST client now? This uses one Sandbox API call per client.')) return;
        const { data } = await must(sb.rpc('gst_admin_run', { p_client: null }));
        toast(data || 'Done');
        setTimeout(async () => { await sb.rpc('gst_admin_process'); loadLog(); }, 6000);
      }
      if (act === 'refresh') await sb.rpc('gst_admin_process');
      setTimeout(loadLog, 4000);
      await loadLog();
    } catch (err) { toast(friendly(err), true); }
    finally { btn.disabled = false; }
  };
  loadLog();
}

/* ---------- WhatsApp reminders (admin, Settings page) ---------- */
async function renderWhatsApp(box) {
  box.innerHTML = '<div class="card"><h3>WhatsApp reminders</h3><div class="loading">Loading…</div></div>';
  const [ws, st] = await Promise.all([sb.from('wa_settings').select('*').eq('id', 1).maybeSingle(), sb.rpc('wa_admin_status')]);
  if (ws.error) {
    box.innerHTML = `<div class="card"><h3>WhatsApp reminders</h3><p class="muted">Not set up yet — run <b>phase2-whatsapp.sql</b> in Supabase first.</p></div>`;
    return;
  }
  const w = ws.data || {}, status = st.data || {};
  const jobs = (status.jobs || []).map(j => j.name).join(', ') || 'none';
  const meHasPhone = !!(profiles.find(p => p.id === me.id) || {}).phone;
  box.innerHTML = `<div class="card"><h3>WhatsApp reminders</h3>
    <p class="muted small">Daily at 9:30 AM (Mon–Sat): each staff member gets their overdue / due-in-3-days / waiting list.
      1st of every month at 9:30 AM: everyone gets that month's due dates. Only people with a WhatsApp number in <a href="#/team">Team</a> get messages.</p>
    <div class="form-grid">
      <label class="check full"><input type="checkbox" name="enabled" ${w.enabled ? 'checked' : ''}> <b>Automatic reminders switched on</b></label>
      <label>Phone number ID (from Meta)<input name="phone_number_id" value="${esc(w.phone_number_id || '')}" placeholder="e.g. 123456789012345"></label>
      <label>Tracker link in messages<input name="app_url" value="${esc(w.app_url || '')}"></label>
      <label>Daily template name<input name="daily_template" value="${esc(w.daily_template || '')}"></label>
      <label>Monthly template name<input name="monthly_template" value="${esc(w.monthly_template || '')}"></label>
      <label>Template language code<input name="template_lang" value="${esc(w.template_lang || 'en')}"></label>
      <label>Meta API version<input name="api_version" value="${esc(w.api_version || 'v23.0')}"></label>
    </div>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" data-wa="save">Save settings</button></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <div class="small muted" style="font-weight:500;margin-bottom:6px">Access token — ${status.token_saved ? '<span style="color:var(--green)">✓ saved (hidden)</span>' : '<span style="color:var(--amber)">not saved yet</span>'}</div>
    <div class="linkbox"><input type="password" name="token" autocomplete="off" placeholder="Paste the permanent access token from Meta"><button class="btn sm" data-wa="token">Save token</button></div>
    <p class="muted small">Stored encrypted in Supabase Vault. It can be replaced but never viewed again.</p>
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <div class="toolbar">
      <button class="btn" data-wa="test" ${meHasPhone ? '' : 'disabled title="Add your WhatsApp number in Team first"'}>Send test to me</button>
      <button class="btn" data-wa="daily">Send today's reminders now</button>
      <button class="btn" data-wa="monthly">Send this month's due dates now</button>
      <span class="spacer"></span><button class="btn sm ghost" data-wa="refresh">Refresh log</button></div>
    <p class="muted small">Schedules active: ${esc(jobs)}</p>
    ${'client_enabled' in w ? `<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <h4 style="margin:0 0 6px">Client reminders — “please send your documents”</h4>
    <p class="muted small">Every day at 10 AM (Mon–Sat), clients with work in <b>Pending data</b> get one message when the due date is the chosen number of days away. Needs the client's mobile number in Clients, and an approved Meta template:
      <br><code>Dear {{1}}, we are waiting for your documents for: {{2}}. Earliest due date: {{3}}. Please share them soon so we can file on time. Check your status here: {{4}} - ${esc(firmName())}</code></p>
    <div class="form-grid">
      <label class="check full"><input type="checkbox" name="client_enabled" ${w.client_enabled ? 'checked' : ''}> <b>Automatic client reminders switched on</b></label>
      <label>Client template name<input name="client_template" value="${esc(w.client_template || 'client_data_reminder')}"></label>
      <label>Days before due date (comma separated)<input name="client_days" value="${esc((w.client_days || [5, 2]).join(', '))}"></label></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" data-wa="save">Save settings</button><button class="btn" data-wa="client">Send client reminders now</button></div>` : ''}
    <div data-walog></div></div>`;
  const val = n => $(`[name="${n}"]`, box);
  const loadLog = async () => {
    const { data, error } = await sb.rpc('wa_admin_log', { p_limit: 30 });
    const el = $('[data-walog]', box);
    if (error) { el.innerHTML = `<p class="error small">${esc(friendly(error))}</p>`; return; }
    const rows = data || [];
    el.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Type</th><th>To</th><th>Result</th></tr></thead><tbody>
      ${rows.map(r => {
        const ok = r.status_code >= 200 && r.status_code < 300;
        let msg = '';
        if (r.error) { try { msg = JSON.parse(r.error).error.message; } catch (e) { msg = r.error; } }
        const res = r.status_code == null ? '<span class="muted">sending…</span>' : ok ? '<span style="color:var(--green)">✓ sent</span>' : `<span class="error">✗ ${esc(String(r.status_code))}</span> <span class="small">${esc(msg)}</span>`;
        return `<tr><td>${new Date(r.sent_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(r.kind)}</td>
          <td>${esc(r.full_name || (r.kind === 'client' ? (r.summary || '').replace(/^[0-9a-f-]{36} /, '').split(':')[0] : ''))}<div class="muted small">${esc(r.phone || '')}</div></td><td class="wrap">${res}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="table-wrap"><div class="empty">No messages sent yet.</div></div>';
  };
  box.onclick = async e => {
    const act = e.target.dataset.wa; if (!act) return;
    const btn = e.target; btn.disabled = true;
    try {
      if (act === 'save') {
        const rec = { enabled: val('enabled').checked };
        ['phone_number_id', 'app_url', 'daily_template', 'monthly_template', 'template_lang', 'api_version'].forEach(n => rec[n] = val(n).value.trim());
        if (val('client_enabled')) {
          rec.client_enabled = val('client_enabled').checked;
          rec.client_template = val('client_template').value.trim() || 'client_data_reminder';
          rec.client_days = val('client_days').value.split(/[,\s]+/).map(x => parseInt(x, 10)).filter(x => x >= 0 && x <= 60);
          if (!rec.client_days.length) rec.client_days = [5, 2];
        }
        if (!rec.phone_number_id) rec.phone_number_id = null;
        if (rec.enabled && (!rec.phone_number_id || !status.token_saved)) toast('Saved, but reminders need the phone number ID and access token to work', true);
        await must(sb.from('wa_settings').update(rec).eq('id', 1));
        toast('WhatsApp settings saved');
      }
      if (act === 'token') {
        const t = val('token').value.trim();
        if (!t) { toast('Paste the token first', true); return; }
        await must(sb.rpc('wa_admin_set_token', { p_token: t }));
        val('token').value = ''; toast('Token saved securely'); renderWhatsApp(box); return;
      }
      if (act === 'test') {
        const { data } = await must(sb.rpc('wa_admin_test'));
        toast(data ? 'Test message sent — check WhatsApp in a few seconds' : 'Not sent: save the phone number ID and token first', !data);
      }
      if (act === 'daily' || act === 'monthly' || act === 'client') {
        if (!confirm({ daily: "Send today's pending-work reminders to staff now?", monthly: "Send this month's due-date list to everyone now?", client: 'Send document reminders now to clients whose work is waiting for data?' }[act])) return;
        const { data } = await must(sb.rpc('wa_admin_run', { p_kind: act }));
        toast(data ? `${data} message(s) sent` : 'Nothing sent (no one with pending work / a WhatsApp number, or setup incomplete)', !data);
      }
      setTimeout(loadLog, 2500);
      await loadLog();
    } catch (err) { toast(friendly(err), true); }
    finally { btn.disabled = false; }
  };
  loadLog();
}

/* =====================================================================
   PHASE 4 — Billing · Client documents · Notices · Reports · Client WhatsApp
   ===================================================================== */
const P4 = () => 'invoice_prefix' in settings;
const safe = q => Promise.resolve(q).catch(e => ({ error: e }));           // update-phase4.sql has been run
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = v => { const x = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(x) ? x : 0; };
function amountWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  let r = Math.floor(n), p = Math.round((n - r) * 100), out = [];
  const parts = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']];
  for (const [d, w] of parts) { if (r >= d) { out.push(three(Math.floor(r / d)) + ' ' + w); r %= d; } }
  if (r) out.push(three(r));
  return 'Rupees ' + (out.join(' ') || 'Zero') + (p ? ' and ' + two(p) + ' Paise' : '') + ' Only';
}
const isOpenNotice = s => s === 'Open' || s === 'Reply drafted' || s === 'Hearing';

/* ---------- WhatsApp text helpers (manual send, works without Meta templates) ---------- */
const docsRequestMsg = (c, t, missing) => `Dear ${c.contact_person || c.name},\nFor ${t.return_name} - ${t.period}${t.due_date ? ' (due ' + fmtDate(t.due_date) + ')' : ''}, we are waiting for:\n${(missing && missing.length ? missing : ['your documents / data']).map(x => '- ' + x).join('\n')}\nPlease share at the earliest so we can file on time.\nStatus: ${statusUrl(c.status_token)}\n- ${firmName()}`;

/* =====================================================================
   1. BILLING
   ===================================================================== */
let billTab = 'toinv', billClient = '';
VIEWS.billing = async v => {
  if (!P4()) { v.innerHTML = '<div class="card"><h3>Billing</h3><p class="note">Not set up yet — run <b>update-phase4.sql</b> in Supabase, then reload.</p></div>'; return; }
  await loadZohoCfg();
  const [tk, inv, fr] = await Promise.all([
    must(sb.from('tasks').select('id,client_id,work_type,return_name,period,due_date,filed_on,fee,status').eq('status', 'Filed').is('invoice_id', null).order('filed_on').limit(3000)),
    must(sb.from('invoices').select('*').order('inv_date', { ascending: false }).order('inv_no', { ascending: false }).limit(3000)),
    must(sb.from('fee_rates').select('*').order('return_name'))
  ]);
  const toInv = tk.data || [], invoices = inv.data || [], fees = fr.data || [];
  const due = invoices.filter(i => num(i.total) - num(i.paid) > 0.009);
  const outstanding = due.reduce((s, i) => s + num(i.total) - num(i.paid), 0);
  const tabs = [['toinv', `To invoice (${toInv.length})`], ['inv', `Invoices (${invoices.length})`], ['due', `Pending payments · ${inr(outstanding)}`], ['fees', 'Fee list']];
  v.innerHTML = `<div class="page-head"><h2>Billing</h2><span class="spacer"></span>
      ${!settings.firm_address ? '<a class="btn sm" href="#/settings">Add invoice details in Settings</a>' : ''}
      ${zohoOn() ? `<span class="muted small" title="${esc(zohoCfg.last_result || '')}">Zoho · last sync ${zohoCfg.last_sync ? new Date(zohoCfg.last_sync).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—'}</span><button class="btn sm" id="zSync">Sync with Zoho</button>` : ''}</div>
    <div class="seg" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button data-bt="${k}" class="${billTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="billBody"></div>`;
  $$('[data-bt]', v).forEach(b => b.onclick = () => { billTab = b.dataset.bt; route(); });
  if ($('#zSync', v)) $('#zSync', v).onclick = async e => {
    e.target.disabled = true;
    try { const r = await zohoCall('sync'); toast(r.summary || 'Synced'); route(); } catch (err) { toast(friendly(err), true); e.target.disabled = false; }
  };
  const box = $('#billBody', v);
  renderClaims(box, invoices);
  if (billTab === 'toinv') renderToInvoice(box, toInv, fees);
  if (billTab === 'inv') renderInvoices(box, invoices);
  if (billTab === 'due') renderDue(box, due);
  if (billTab === 'fees') renderFees(box, fees);
};

const gstBillDay = () => Math.min(28, Math.max(1, +settings.gst_bill_day || 25));
const gstBillDate = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), gstBillDay())); };
function renderToInvoice(box, rows, fees = []) {
  const rateFor = r => { const f = fees.find(x => x.client_id === r.client_id && lc(x.return_name) === lc(r.return_name)) || fees.find(x => !x.client_id && lc(x.return_name) === lc(r.return_name)); return f ? f.amount : ''; };
  if (!rows.length) { box.innerHTML = '<div class="table-wrap"><div class="empty">All filed work is invoiced 🎉</div></div>'; return; }
  const by = {}; rows.forEach(r => (by[r.client_id] = by[r.client_id] || []).push(r));
  const ids = Object.keys(by).sort((a, b) => clientName(a).localeCompare(clientName(b)));
  const gstRows = rows.filter(r => r.work_type === 'GST'), gstBy = {}; gstRows.forEach(r => (gstBy[r.client_id] = gstBy[r.client_id] || []).push(r));
  const gstSum = gstRows.reduce((a, r) => a + num(r.fee ?? rateFor(r)), 0), bd = gstBillDate(), isDay = today() === bd;
  box.innerHTML = (gstRows.length ? `<div class="card gst-run ${isDay ? 'today' : ''}"><div class="toolbar" style="margin:0;align-items:center">
      <div><h3 style="margin:0">GST billing run${isDay ? ' — today is billing day' : ''}</h3>
        <span class="muted small">${Object.keys(gstBy).length} client${Object.keys(gstBy).length > 1 ? 's' : ''} · ${gstRows.length} filed GST return${gstRows.length > 1 ? 's' : ''} not billed · ${inr(gstSum)} before GST. One invoice per client, dated the GST billing day (the ${gstBillDay()}${['th', 'st', 'nd', 'rd'][(gstBillDay() % 10 > 3 || [11, 12, 13].includes(gstBillDay())) ? 0 : gstBillDay() % 10]} of the month).</span></div><span class="spacer"></span>
      <label class="small">Invoice date <input type="date" id="grDate" value="${bd}"></label>
      ${isAdmin() ? `<label class="small" title="Day of the month for GST bills">Billing day <input type="number" id="grDay" min="1" max="28" value="${gstBillDay()}" style="width:64px"></label>` : ''}
      <button class="btn primary" id="grGo">Create ${Object.keys(gstBy).length} GST invoice${Object.keys(gstBy).length > 1 ? 's' : ''}</button></div></div>` : '') +
    `<p class="muted small">Filed work that is not billed yet. Fees come from the Fee list — change any amount here before creating the invoice.</p>` +
    ids.map(cid => `<div class="card bill-client" data-cid="${cid}">
      <div class="bill-head"><h3 style="margin:0">${esc(clientName(cid))}</h3><span class="muted small">${by[cid].length} item${by[cid].length > 1 ? 's' : ''}</span></div>
      <div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-all checked aria-label="Select all"></th><th>Work</th><th>Filed on</th><th style="width:140px">Fee (₹)</th></tr></thead><tbody>
      ${by[cid].map(r => `<tr><td><input type="checkbox" data-t="${r.id}" checked aria-label="Select"></td><td>${wtBadge(r.work_type)} ${esc(r.return_name)} <span class="muted small">${esc(r.period)}</span></td>
        <td class="small">${fmtDate(r.filed_on)}</td><td><input type="number" min="0" step="1" class="fee-in" data-fee="${r.id}" value="${r.fee ?? rateFor(r)}" placeholder="0"></td></tr>`).join('')}
      <tr><td></td><td><input data-xdesc placeholder="Extra line (optional), e.g. Consultation" style="width:100%"></td><td></td><td><input type="number" min="0" class="fee-in" data-xamt placeholder="0"></td></tr>
      </tbody></table></div>
      <div class="bill-foot"><span>Selected: <b data-sum>₹0</b> <span class="muted small" data-gstamt></span></span><span class="spacer"></span>
        <label class="small">GST <select data-gst>${[...new Set([18, 5, 0, num(settings.gst_rate)])].sort((a, b) => b - a).map(r => `<option value="${r}" ${r === num(settings.gst_rate) ? 'selected' : ''}>${r}%</option>`).join('')}</select></label>
        <label class="small">Invoice date <input type="date" data-date value="${by[cid].every(r => r.work_type === 'GST') ? gstBillDate() : today()}"></label>
        <button class="btn primary" data-mk>Create invoice</button></div></div>`).join('');
  const recalc = card => {
    let s = 0;
    $$('[data-t]', card).forEach(c => { if (c.checked) s += num($(`[data-fee="${c.dataset.t}"]`, card).value); });
    s += num($('[data-xamt]', card).value);
    const r = num($('[data-gst]', card).value), g = Math.round(s * r) / 100;
    $('[data-sum]', card).textContent = inr(s);
    $('[data-gstamt]', card).textContent = r ? `+ GST ${r}% ${inr(g)} = ${inr(s + g)}` : '(no GST)';
  };
  if ($('#grDay', box)) $('#grDay', box).onchange = async e => {
    const d = Math.min(28, Math.max(1, Math.round(num(e.target.value)) || 25));
    try { await must(sb.from('settings').update({ gst_bill_day: d }).eq('id', 1)); settings.gst_bill_day = d; toast(`GST billing day set to the ${d}`); route(); }
    catch (err) { toast(/gst_bill_day/.test(err.message || '') ? 'Run update-session11.sql in Supabase first' : friendly(err), true); }
  };
  if ($('#grGo', box)) $('#grGo', box).onclick = async e => {
    const date = $('#grDate', box).value || gstBillDate(), cids = Object.keys(gstBy);
    if (!confirm(`Create ${cids.length} GST invoice${cids.length > 1 ? 's' : ''} dated ${fmtDate(date)}?\nFees come from each work item or the Fee list. Each invoice gets its own number${zohoOn() && zohoCfg.auto_push ? ' and is sent to Zoho' : ''}.`)) return;
    e.target.disabled = true; let ok = 0, zoho = 0; const bad = [];
    for (const cid of cids) {
      try {
        for (const r of gstBy[cid]) { const f = num(r.fee ?? rateFor(r)); if (r.fee == null || num(r.fee) !== f) await must(sb.from('tasks').update({ fee: f }).eq('id', r.id)); }
        const { data: iid } = await must(sb.rpc('create_invoice', { p_client: cid, p_tasks: gstBy[cid].map(r => r.id), p_extra: [], p_date: date, p_notes: null, p_gst_rate: num(settings.gst_rate) }));
        ok++;
        if (zohoOn() && zohoCfg.auto_push) { try { await zohoCall('push_invoice', { invoice_id: iid }); zoho++; } catch (zerr) { bad.push(`${clientName(cid)}: saved, not sent to Zoho (${friendly(zerr)})`); } }
      } catch (err) { bad.push(`${clientName(cid)}: ${friendly(err)}`); }
    }
    toast(`${ok} GST invoice${ok === 1 ? '' : 's'} created${zoho ? `, ${zoho} sent to Zoho` : ''}${bad.length ? ` · ${bad.length} problem${bad.length > 1 ? 's' : ''}` : ''}`, !!bad.length);
    if (bad.length) modal('Some invoices need attention', `<ul class="small">${bad.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`);
    await loadRefs(); billTab = ok ? 'inv' : billTab; route();
  };
  $$('.bill-client', box).forEach(card => {
    recalc(card);
    card.addEventListener('input', () => recalc(card));
    card.addEventListener('change', e => {
      if (e.target.hasAttribute('data-all')) $$('[data-t]', card).forEach(c => c.checked = e.target.checked);
      recalc(card);
    });
    $('[data-mk]', card).onclick = async e => {
      const btn = e.target, cid = card.dataset.cid;
      const sel = $$('[data-t]', card).filter(c => c.checked).map(c => c.dataset.t);
      const xd = $('[data-xdesc]', card).value.trim(), xa = num($('[data-xamt]', card).value);
      if (!sel.length && !xd) return toast('Select at least one item', true);
      btn.disabled = true;
      try {
        for (const id of sel) {
          const r = by[cid].find(x => x.id === id), f = num($(`[data-fee="${id}"]`, card).value);
          if (num(r.fee) !== f || r.fee == null) await must(sb.from('tasks').update({ fee: f }).eq('id', id));
        }
        const { data: iid } = await must(sb.rpc('create_invoice', { p_client: cid, p_tasks: sel, p_extra: xd ? [{ desc: xd, amount: xa }] : [], p_date: $('[data-date]', card).value || today(), p_notes: null, p_gst_rate: num($('[data-gst]', card).value) }));
        if (zohoOn() && zohoCfg.auto_push) {
          try { const z = await zohoCall('push_invoice', { invoice_id: iid }); toast(`Created in Zoho as ${z.number}`); }
          catch (zerr) { toast('Saved in tracker, but not sent to Zoho: ' + friendly(zerr), true); }
        }
        const { data: invRow } = await must(sb.from('invoices').select('*').eq('id', iid).single());
        await loadRefs();
        toast(`Invoice ${invRow.inv_no} created`);
        printInvoice(invRow);
        route();
      } catch (err) { toast(friendly(err), true); btn.disabled = false; }
    };
  });
}

/* v29: payments reported by clients in the portal */
async function renderClaims(box, invoices) {
  const r = await safe(sb.from('payment_claims').select('*').eq('status', 'New').order('created_at'));
  if (r.error || !r.data.length || !document.body.contains(box)) return;
  const host = document.createElement('div'); box.before(host);
  host.innerHTML = `<div class="card claim-card"><h3 style="margin-top:0">Payments reported by clients (${r.data.length})</h3>
    <p class="muted small" style="margin-top:-6px">Clients said they paid from the portal. Check the bank, then confirm (it is recorded as a payment) or reject.</p>
    <div class="table-wrap"><table><thead><tr><th>Client</th><th>Invoice</th><th class="r">Amount</th><th>Paid on</th><th>Mode · reference</th><th></th></tr></thead><tbody>
    ${r.data.map(c => { const inv = invoices.find(i => i.id === c.invoice_id); return `<tr><td>${esc(cLabel(clientById(c.client_id) || { name: '—' }))}</td><td>${inv ? esc(inv.inv_no) : '<span class="muted">not chosen</span>'}</td>
      <td class="r"><b>${inr(c.amount)}</b></td><td>${fmtDate(c.paid_on)}</td><td class="small">${esc(c.mode)} · ${esc(c.ref || '')}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</td>
      <td class="row-btns"><button class="btn sm primary" data-clok="${c.id}">Confirm</button><button class="btn sm ghost" data-clno="${c.id}">Reject</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
  host.onclick = async e => {
    const ok = e.target.dataset.clok, no = e.target.dataset.clno, c = r.data.find(x => x.id === (ok || no)); if (!c) return;
    if (no) {
      const why = prompt('Reason (the client sees this), e.g. "Not received in the bank yet"'); if (why === null) return;
      try { await must(sb.from('payment_claims').update({ status: 'Rejected', reply: why || null, handled_by: me.id, handled_at: new Date().toISOString() }).eq('id', c.id)); toast('Rejected'); route(); } catch (err) { toast(friendly(err), true); }
      return;
    }
    const open = invoices.filter(i => i.client_id === c.client_id && num(i.total) - num(i.paid) > 0.009);
    const done = async pay => { await must(sb.from('payment_claims').update({ status: 'Confirmed', payment_id: pay ? pay.id : null, handled_by: me.id, handled_at: new Date().toISOString() }).eq('id', c.id)); };
    const inv = invoices.find(i => i.id === c.invoice_id) || (open.length === 1 ? open[0] : null);
    if (inv) return addPayment(inv, c, done);
    if (!open.length) return toast('This client has no unpaid invoice — record it manually', true);
    const m = modal('Which invoice?', `<label class="full">Invoice<select name="i">${opts(open, '', i => `${i.inv_no} · ${fmtDate(i.inv_date)} · balance ${inr(num(i.total) - num(i.paid))}`, i => i.id)}</select></label>`,
      { saveText: 'Next', onSave: async el => { const pick = open.find(i => i.id === fv(el, 'i')); setTimeout(() => addPayment(pick, c, done), 0); } });
  };
}

function invStatus(i) {
  if (i.zoho_status === 'void') return '<span class="st st-not-applicable">Void</span>';
  const bal = num(i.total) - num(i.paid);
  return bal <= 0.009 ? '<span class="st st-filed">Paid</span>' : num(i.paid) > 0 ? '<span class="st st-ready-to-file">Part paid</span>' : '<span class="st st-pending-data">Unpaid</span>';
}
function renderInvoices(box, invoices) {
  const list = billClient ? invoices.filter(i => i.client_id === billClient) : invoices;
  box.innerHTML = `<div class="toolbar"><select id="bc"><option value="">All clients</option>${opts(clients, billClient, cLabel, c => c.id)}</select>
      <span class="spacer"></span><button class="btn sm" id="invCsv">Export CSV</button></div>
    <div class="table-wrap">${list.length ? `<table><thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th>${zohoCfg ? '<th>Zoho</th>' : ''}<th></th></tr></thead><tbody>
    ${list.map(i => `<tr><td><b>${esc(i.inv_no)}</b></td><td>${fmtDate(i.inv_date)}</td><td class="wrap">${esc(clientName(i.client_id))}</td>
      <td class="r">${inr(i.total)}</td><td class="r">${inr(i.paid)}</td><td class="r"><b>${inr(num(i.total) - num(i.paid))}</b></td><td>${invStatus(i)}</td>${zohoCfg ? `<td class="small">${zohoCell(i)}</td>` : ''}
      <td class="row-btns"><button class="btn sm" data-pr="${i.id}">Print</button>${num(i.total) - num(i.paid) > 0.009 ? `<button class="btn sm" data-pay="${i.id}">+ Payment</button>` : ''}<button class="btn sm ghost" data-pl="${i.id}">Payments</button>${num(i.paid) === 0 && !i.zoho_invoice_id ? `<button class="link small danger-t" data-dl="${i.id}">Delete</button>` : ''}</td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">No invoices yet.</div>'}</div>`;
  $('#bc').onchange = e => { billClient = e.target.value; renderInvoices(box, invoices); };
  $('#invCsv').onclick = () => download(`invoices-${today()}.csv`, toCSV([['Invoice', 'Date', 'Client', 'GSTIN', 'Subtotal', 'GST', 'Total', 'Paid', 'Balance'],
    ...list.map(i => [i.inv_no, i.inv_date, clientName(i.client_id), clientById(i.client_id)?.gstin, i.subtotal, i.gst_amount, i.total, i.paid, (num(i.total) - num(i.paid)).toFixed(2)])]));
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const inv = id => invoices.find(i => i.id === id);
    if (b.dataset.pr) printInvoice(inv(b.dataset.pr));
    if (b.dataset.zpush) {
      b.disabled = true;
      try { const z = await zohoCall('push_invoice', { invoice_id: b.dataset.zpush }); toast(`Created in Zoho as ${z.number}`); route(); }
      catch (err) { toast(friendly(err), true); b.disabled = false; }
    }
    if (b.dataset.pay) addPayment(inv(b.dataset.pay));
    if (b.dataset.pl) showPayments(inv(b.dataset.pl));
    if (b.dataset.dl) {
      const i = inv(b.dataset.dl);
      if (!confirm(`Delete invoice ${i.inv_no}? Its work items go back to "To invoice". The number will not be reused.`)) return;
      try { await must(sb.from('invoices').delete().eq('id', i.id)); toast('Invoice deleted'); route(); } catch (err) { toast(friendly(err), true); }
    }
  };
}
function addPayment(i, pre = null, after = null) {
  const bal = (num(i.total) - num(i.paid)).toFixed(2);
  modal(`Payment for ${i.inv_no}`, `<p class="muted small" style="margin-top:0">${esc(clientName(i.client_id))} · Total ${inr(i.total)} · Balance <b>${inr(bal)}</b></p>
    ${pre ? '<p class="note small">Reported by the client in the portal — check it reached the bank before saving.</p>' : ''}
    <div class="form-grid"><label>Received on<input type="date" name="d" value="${esc(pre ? pre.paid_on : today())}"></label>
      <label>Amount (₹)<input type="number" name="a" min="1" step="0.01" value="${pre ? esc(pre.amount) : bal}"></label>
      <label>Mode<select name="m">${opts(['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other'], pre && ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other'].includes(pre.mode) ? pre.mode : 'Bank transfer')}</select></label>
      <label>Reference (UTR / cheque no.)<input name="r" value="${esc(pre ? pre.ref || '' : '')}"></label></div>`, {
    saveText: 'Save payment',
    onSave: async el => {
      const amount = num(fv(el, 'a')); if (!(amount > 0)) { toast('Enter the amount', true); return false; }
      const { data: pay } = await must(sb.from('payments').insert({ invoice_id: i.id, paid_on: fv(el, 'd') || today(), amount, mode: fv(el, 'm'), ref: fv(el, 'r') || null }).select().single());
      toast('Payment saved');
      if (after) await after(pay);
      if (i.zoho_invoice_id && zohoOn() && pay) {
        try { await zohoCall('push_payment', { payment_id: pay.id }); toast('Payment recorded in Zoho too'); }
        catch (zerr) { toast('Saved here, but not in Zoho: ' + friendly(zerr), true); }
      }
      route();
    }
  });
}
async function showPayments(i) {
  const { data } = await must(sb.from('payments').select('*').eq('invoice_id', i.id).order('paid_on'));
  const m = modal(`Payments · ${i.inv_no}`, (data || []).length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th class="r">Amount</th><th>Mode</th><th>Reference</th><th></th></tr></thead><tbody>
    ${data.map(p => `<tr><td>${fmtDate(p.paid_on)}</td><td class="r">${inr(p.amount)}</td><td>${esc(p.mode || '')}</td><td>${esc(p.ref || '')}</td><td><button class="link small danger-t" data-dp="${p.id}">Remove</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No payments recorded.</div>');
  m.el.addEventListener('click', async e => {
    const id = e.target.dataset.dp; if (!id || !confirm('Remove this payment entry?')) return;
    try { await must(sb.from('payments').delete().eq('id', id)); m.close(); toast('Removed'); route(); } catch (err) { toast(friendly(err), true); }
  });
}
let dueFilter = 'all';
async function renderDue(box, due) {
  const by = {};
  due.forEach(i => { const b = by[i.client_id] = by[i.client_id] || { inv: [], total: 0, paid: 0, oldest: i.inv_date }; b.inv.push(i); b.total += num(i.total); b.paid += num(i.paid); if (i.inv_date < b.oldest) b.oldest = i.inv_date; });
  const fr = await safe(sb.from('followups').select('client_id,on_date,mode,note,promised_on,next_on,created_at').eq('kind', 'payment').order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000));
  const fuOn = !fr.error, last = {}, cnt = {};
  (fr.data || []).forEach(f => { cnt[f.client_id] = (cnt[f.client_id] || 0) + 1; if (!last[f.client_id]) last[f.client_id] = f; });
  const t = today();
  const age = cid => daysFrom(by[cid].oldest);
  const bucket = d => d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3;
  const B = [['0–30 days', 'blue'], ['31–60 days', 'amber'], ['61–90 days', 'amber'], ['Over 90 days', 'red']].map(x => [...x, 0]);
  Object.keys(by).forEach(cid => { B[bucket(age(cid))][2] += by[cid].total - by[cid].paid; });
  const isDue = cid => last[cid] && last[cid].next_on && last[cid].next_on <= t;
  let ids = Object.keys(by).sort((a, b) => (by[b].total - by[b].paid) - (by[a].total - by[a].paid));
  if (dueFilter === 'fu') ids = ids.filter(isDue);
  if (dueFilter === 'none') ids = ids.filter(cid => !last[cid]);
  if (dueFilter === '90') ids = ids.filter(cid => age(cid) > 90);
  const nDue = Object.keys(by).filter(isDue).length;
  box.innerHTML = !Object.keys(by).length ? '<div class="table-wrap"><div class="empty">No pending payments 🎉</div></div>' : `
    <section class="bento-stats stats4" style="margin-bottom:14px">${B.map(([l, c, amt]) => `<div class="mini ${c}"><span>${l}</span><b style="font-size:1.5rem">${inr(amt)}</b></div>`).join('')}</section>
    <div class="toolbar"><div class="seg">${[['all', 'All'], ['fu', `Follow-up due (${nDue})`], ['none', 'Never followed up'], ['90', 'Over 90 days']].map(([k, l]) => `<button data-df="${k}" class="${dueFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="table-wrap">${ids.length ? `<table><thead><tr><th>Client</th><th>Invoices</th><th class="r">Balance</th><th>Oldest</th>${fuOn ? '<th>Last follow-up</th>' : ''}<th></th></tr></thead><tbody>
    ${ids.map(cid => { const b = by[cid], c = clientById(cid) || {}, bal = b.total - b.paid, nos = b.inv.map(i => i.inv_no), l = last[cid], d = age(cid);
      const mail = payMailUrl(c, bal, nos);
      return `<tr class="${isDue(cid) ? 'fu-due-row' : ''}"><td class="wrap"><b>${esc(c.name || '')}</b>${c.phone ? `<div class="muted small">${esc(c.phone)}</div>` : ''}</td>
        <td class="small">${nos.map(esc).join('<br>')}<div class="muted">billed ${inr(b.total)} · received ${inr(b.paid)}</div></td>
        <td class="r"><b>${inr(bal)}</b></td>
        <td class="${d > 60 ? 'late' : ''}">${fmtDate(b.oldest)}<div class="muted small">${d} days</div></td>
        ${fuOn ? `<td class="small">${l ? `${FU_ICON[l.mode] || ''} ${fmtDate(l.on_date).slice(0, 6)} · ${esc(l.mode)}${cnt[cid] > 1 ? ` <span class="muted">(${cnt[cid]}×)</span>` : ''}
            ${l.note ? `<div class="muted">${esc(l.note)}</div>` : ''}${l.promised_on ? `<div>Promised: <b>${fmtDate(l.promised_on)}</b></div>` : ''}
            ${l.next_on ? `<div class="${l.next_on <= t ? 'late' : 'muted'}">Next: ${fmtDate(l.next_on)}</div>` : ''}` : '<span class="muted">None yet</span>'}</td>` : ''}
        <td class="row-btns"><a class="btn sm" href="${esc(waShare(payMsg(c, bal, nos), c.phone))}" target="_blank" rel="noopener">WhatsApp</a>
          ${mail ? `<a class="btn sm" href="${esc(mail)}">Email</a>` : ''}
          ${fuOn ? `<button class="btn sm primary" data-pfu="${cid}">Log follow-up</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="empty">Nothing in this view.</div>'}</div>
    ${fuOn ? '' : '<p class="note small">Run <b>update-followups.sql</b> in Supabase to log payment follow-ups here.</p>'}`;
  $$('[data-df]', box).forEach(b => b.onclick = () => { dueFilter = b.dataset.df; renderDue(box, due); });
  $$('[data-pfu]', box).forEach(b => b.onclick = () => {
    const cid = b.dataset.pfu, x = by[cid];
    logFollowup({ kind: 'payment', client_id: cid, bal: x.total - x.paid, invNos: x.inv.map(i => i.inv_no) }, () => renderDue(box, due));
  });
}
function renderFees(box, fees) {
  const allRet = [].concat(...WORK_TYPES.map(w => WORK_ITEMS[w] || []));
  box.innerHTML = `<p class="muted small">Standard fees apply to every client; a client fee overrides it. The fee is filled in automatically when work is created.</p>
    <div class="card"><div class="form-grid fee-add">
      <label>Client<select name="fc"><option value="">Standard (all clients)</option>${opts(clients.filter(c => c.active), '', cLabel, c => c.id)}</select></label>
      <label>Return / work<input autocomplete="off" name="fr" list="dl-feeret" placeholder="e.g. GSTR-3B"></label>
      <label>Fee (₹)<input name="fa" type="number" min="0" step="1"></label>
      <div style="align-self:end"><button class="btn primary" id="feeAdd">Add / update</button></div>
      <datalist id="dl-feeret">${allRet.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist></div></div>
    <div class="table-wrap">${fees.length ? `<table><thead><tr><th>Client</th><th>Return / work</th><th class="r">Fee</th><th></th></tr></thead><tbody>
      ${fees.sort((a, b) => (a.client_id ? 1 : 0) - (b.client_id ? 1 : 0) || clientName(a.client_id || '').localeCompare(clientName(b.client_id || '')) || a.return_name.localeCompare(b.return_name))
        .map(f => `<tr><td>${f.client_id ? esc(clientName(f.client_id)) : '<span class="badge">Standard</span>'}</td><td>${esc(f.return_name)}</td><td class="r">${inr(f.amount)}</td>
        <td><button class="link small danger-t" data-fd="${f.id}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No fees yet. Add your standard fee for each return above.</div>'}</div>`;
  $('#feeAdd').onclick = async () => {
    const rec = { client_id: fv(box, 'fc') || null, return_name: fv(box, 'fr'), amount: num(fv(box, 'fa')) };
    if (!rec.return_name) return toast('Enter the return / work name', true);
    try {
      const ex = fees.find(f => (f.client_id || null) === rec.client_id && lc(f.return_name) === lc(rec.return_name));
      if (ex) await must(sb.from('fee_rates').update({ amount: rec.amount }).eq('id', ex.id));
      else await must(sb.from('fee_rates').insert(rec));
      toast('Fee saved'); route();
    } catch (e) { toast(friendly(e), true); }
  };
  box.onclick = async e => {
    const id = e.target.dataset.fd; if (!id) return;
    try { await must(sb.from('fee_rates').delete().eq('id', id)); toast('Removed'); route(); } catch (err) { toast(friendly(err), true); }
  };
}

function printInvoice(i) {
  const c = clientById(i.client_id) || {};
  const fs = (settings.firm_gstin || '').slice(0, 2), cs = (c.gstin || '').slice(0, 2);
  const igst = fs && cs && fs !== cs;
  const rate = num(i.gst_rate), gst = num(i.gst_amount);
  const rows = (i.items || []).map((it, k) => `<tr><td>${k + 1}</td><td>${esc(it.desc)}</td><td>${esc(settings.sac_code || '')}</td><td class="r">${num(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`).join('');
  const tax = rate ? (igst ? `<tr><td colspan="3" class="r">IGST @ ${rate}%</td><td class="r">${gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
    : `<tr><td colspan="3" class="r">CGST @ ${rate / 2}%</td><td class="r">${(gst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
       <tr><td colspan="3" class="r">SGST @ ${rate / 2}%</td><td class="r">${(gst - gst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`) : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(i.inv_no)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:13px}
    h1{font-size:20px;margin:0}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #2667d1;padding-bottom:12px}
    .muted{color:#555}.ttl{font-size:18px;font-weight:700;color:#2667d1;text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:7px 9px;text-align:left;vertical-align:top}
    th{background:#eef3fb}.r{text-align:right}.tot td{font-weight:700;background:#f6f8fb}.box{display:flex;justify-content:space-between;gap:20px;margin-top:16px}
    .pre{white-space:pre-line}.foot{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end}
    @media print{body{margin:12mm}.noprint{display:none}}</style></head><body>
    <div class="noprint" style="text-align:right;margin-bottom:12px"><button onclick="print()">Print / Save as PDF</button></div>
    <div class="top"><div><h1>${esc(firmName())}</h1><div class="muted pre">${esc(settings.firm_address || '')}</div>
      <div class="muted">${[settings.firm_gstin ? 'GSTIN: ' + esc(settings.firm_gstin) : '', settings.firm_pan ? 'PAN: ' + esc(settings.firm_pan) : ''].filter(Boolean).join(' · ')}</div>
      <div class="muted">${[esc(settings.firm_phone || ''), esc(settings.firm_email || '')].filter(Boolean).join(' · ')}</div></div>
      <div><div class="ttl">${rate ? 'TAX INVOICE' : 'INVOICE'}</div><div class="r">No: <b>${esc(i.inv_no)}</b><br>Date: ${fmtDate(i.inv_date)}</div></div></div>
    <div class="box"><div><b>Bill to</b><br>${esc(c.name || '')}<div class="pre">${esc(c.address || '')}</div>${c.gstin ? 'GSTIN: ' + esc(c.gstin) : ''}${c.gstin && rate ? '<br>Place of supply: ' + esc(cs) : ''}</div></div>
    <table><thead><tr><th style="width:36px">#</th><th>Description</th><th style="width:80px">SAC</th><th class="r" style="width:120px">Amount (₹)</th></tr></thead><tbody>
      ${rows}<tr><td colspan="3" class="r">Taxable value</td><td class="r">${num(i.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>${tax}
      <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${num(i.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr></tbody></table>
    <p><b>Amount in words:</b> ${amountWords(num(i.total))}</p>
    ${i.notes ? `<p class="pre">${esc(i.notes)}</p>` : ''}
    ${settings.bank_details ? `<p><b>Bank details</b><br><span class="pre">${esc(settings.bank_details)}</span></p>` : ''}
    <div class="foot"><span class="muted">This is a computer generated invoice.</span><span>For ${esc(firmName())}<br><br><br>Authorised signatory</span></div>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups for this site to print invoices', true);
  w.document.open(); w.document.write(html); w.document.close();
}

function invoiceSettingsCard() {
  if (!P4()) return '';
  const f = (k, l, ph = '', type = 'text') => `<label>${l}<input name="${k}" type="${type}" value="${esc(settings[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  return `<div class="card" id="invSet"><h3>Invoice details</h3>
    <p class="muted small">Printed on invoices. Set GST rate to 0 if the firm is not registered under GST.</p>
    <div class="form-grid">
      <label class="full">Office address<textarea name="firm_address" rows="2">${esc(settings.firm_address || '')}</textarea></label>
      ${f('firm_gstin', 'Firm GSTIN', '33XXXXX0000X1Z5')}${f('firm_pan', 'Firm PAN')}${f('firm_phone', 'Phone')}${f('firm_email', 'Email')}
      ${f('invoice_prefix', 'Invoice prefix', 'JLR')}${f('next_invoice_no', 'Next invoice number', '1', 'number')}
      ${f('gst_rate', 'GST rate %', '18', 'number')}${f('sac_code', 'SAC code', 'e.g. 998221')}
      <label class="full">Bank details (for invoices & payment reminders)<textarea name="bank_details" rows="3" placeholder="Bank, A/c no., IFSC, UPI ID">${esc(settings.bank_details || '')}</textarea></label>
      ${'upi_id' in settings ? `<label>UPI ID (clients can pay from the portal)<input name="upi_id" value="${esc(settings.upi_id || '')}" placeholder="e.g. jlrco@okhdfcbank"></label>` : ''}
    </div><div class="toolbar" style="margin-top:12px"><button class="btn primary" id="saveInv">Save invoice details</button>
      <span class="muted small">Invoice numbers look like ${esc(settings.invoice_prefix || 'JLR')}/2026-27/${String(settings.next_invoice_no || 1).padStart(3, '0')}</span></div></div>`;
}
function bindInvoiceSettings(v) {
  const b = $('#saveInv', v); if (!b) return;
  b.onclick = async () => {
    const box = $('#invSet', v);
    const rec = {};
    ['firm_address', 'firm_gstin', 'firm_pan', 'firm_phone', 'firm_email', 'invoice_prefix', 'sac_code', 'bank_details'].forEach(k => rec[k] = fv(box, k) || null);
    rec.invoice_prefix = rec.invoice_prefix || 'JLR';
    if ($('[name=upi_id]', box)) { rec.upi_id = fv(box, 'upi_id').trim() || null; if (rec.upi_id && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(rec.upi_id)) return toast('UPI ID looks wrong (e.g. name@okhdfcbank)', true); }
    if (rec.firm_gstin) rec.firm_gstin = rec.firm_gstin.toUpperCase();
    rec.next_invoice_no = Math.max(1, parseInt(fv(box, 'next_invoice_no'), 10) || 1);
    rec.gst_rate = num(fv(box, 'gst_rate'));
    try { await must(sb.from('settings').update(rec).eq('id', 1)); Object.assign(settings, rec); toast('Invoice details saved'); route(); }
    catch (e) { toast(friendly(e), true); }
  };
}

/* =====================================================================
   2. NOTICES
   ===================================================================== */
const NOTICE_STATUSES = ['Open', 'Reply drafted', 'Replied', 'Hearing', 'Closed'];
const NOTICE_DEPTS = ['GST', 'TDS', 'ROC/MCA', 'Other'];
const NOTICE_TYPES = ['ASMT-10 (scrutiny)', 'DRC-01 (show cause)', 'DRC-01A (intimation)', 'DRC-07 (demand order)', 'REG-03 (registration query)', 'REG-17 (cancellation SCN)',
  'ADT-01 (GST audit)', 'Sec 73 SCN', 'Sec 74 SCN', 'GST appeal (APL-01)', 'TDS default (short payment / deduction)', 'Late filing fee 234E', 'Sec 201 order',
  'TRACES PAN error / correction', 'MCA adjudication notice', 'MCA non-filing notice', 'STK-1 (strike-off notice)', 'Other'];
let nf = { status: 'open', dept: '', q: '' };
VIEWS.notices = async v => {
  const r = await safe(sb.from('notices').select('*').order('reply_due', { ascending: true, nullsFirst: false }).limit(3000));
  if (r.error) { v.innerHTML = '<div class="card"><h3>Notices</h3><p class="note">Not set up yet — run <b>update-phase4.sql</b> in Supabase, then reload.</p></div>'; return; }
  const all = (r.data || []).filter(n => isManager() || n.assigned_to === me.id), t = today(), in7 = iso(addDays(new Date(), 7));
  v.innerHTML = `<div class="page-head"><h2>${nf.dept ? (nf.dept === 'ROC/MCA' ? 'MCA' : esc(nf.dept)) + ' notices' : isManager() ? 'All notices' : 'My notices'}</h2><span class="spacer"></span>
      <button class="btn" id="nCheck" title="Look in the office mailbox for new notice emails now">${navIcon('refresh')}<span>Check now</span></button>${isManager() ? '<button class="btn primary" id="addN">+ Add notice</button>' : ''}</div>
    <div id="nWatch"></div><div id="nMails"></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <div class="mini red"><span>Reply overdue</span><b>${all.filter(n => isOpenNotice(n.status) && n.status !== 'Hearing' && n.reply_due && n.reply_due < t).length}</b></div>
      <div class="mini amber"><span>Reply due in 7 days</span><b>${all.filter(n => isOpenNotice(n.status) && n.reply_due >= t && n.reply_due <= in7).length}</b></div>
      <div class="mini blue"><span>Hearings coming</span><b>${all.filter(n => n.status !== 'Closed' && n.hearing_date && n.hearing_date >= t).length}</b></div>
      <div class="mini green"><span>Closed</span><b>${all.filter(n => n.status === 'Closed').length}</b></div></div>
    <div class="toolbar"><select id="nS"><option value="open">Open (not closed)</option><option value="all">All</option>${opts(NOTICE_STATUSES, nf.status)}</select>
      <select id="nD"><option value="">All departments</option>${opts(NOTICE_DEPTS, nf.dept, d => d === 'ROC/MCA' ? 'MCA' : d)}</select>
      <input type="search" id="nQ" placeholder="Search client / notice / ref" value="${esc(nf.q)}"></div><div id="nList"></div>`;
  $('#nS').value = nf.status;
  const render = () => {
    const s = nf.q.toLowerCase();
    const list = all.filter(n => (nf.status === 'all' || (nf.status === 'open' ? n.status !== 'Closed' : n.status === nf.status)) && (!nf.dept || n.dept === nf.dept)
      && (!s || [clientName(n.client_id), n.notice_type, n.ref_no, n.period, n.remarks].join(' ').toLowerCase().includes(s)));
    $('#nList').innerHTML = list.length ? `<div class="count">${list.length} notice${list.length > 1 ? 's' : ''}</div><div class="table-wrap"><table><thead><tr><th>Client</th><th>Dept</th><th>Notice</th><th>Notice date</th><th>Reply due</th><th class="r">Amount</th><th>Assigned</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(n => { const late = isOpenNotice(n.status) && n.status !== 'Hearing' && n.reply_due && n.reply_due < t, soon = isOpenNotice(n.status) && n.reply_due >= t && n.reply_due <= in7;
        const can = isManager() || n.assigned_to === me.id;
        return `<tr class="${late ? 'overdue' : ''}"><td class="wrap"><b>${esc(clientName(n.client_id))}</b></td><td>${wtBadge(n.dept === 'ROC/MCA' ? 'ROC/MCA' : n.dept)}</td>
          <td class="wrap">${esc(n.notice_type)}${n.auto ? ' <span class="pill b small" title="Added automatically from an email">from email</span>' : ''}${n.draft_reply ? ' <span class="pill g small">draft ready</span>' : ''}<div class="muted small">${esc([n.ref_no, n.period].filter(Boolean).join(' · '))}</div></td>
          <td>${fmtDate(n.notice_date)}</td><td class="${late ? 'late' : soon ? 'soon' : ''}">${fmtDate(n.reply_due)}${n.hearing_date ? `<div class="muted small">Hearing ${fmtDate(n.hearing_date)}</div>` : ''}</td>
          <td class="r">${n.amount ? inr(n.amount) : '—'}</td><td>${esc(profName(n.assigned_to) || '—')}</td>
          <td>${can ? `<select class="st st-${slug(n.status)}" data-ns="${n.id}" aria-label="Status">${opts(NOTICE_STATUSES, n.status)}</select>` : `<span class="st st-${slug(n.status)}">${esc(n.status)}</span>`}${n.replied_on ? `<div class="muted small">Replied ${fmtDate(n.replied_on)}</div>` : ''}</td>
          <td><button class="btn sm" data-ne="${n.id}">${can ? 'Edit' : 'View'}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="table-wrap"><div class="empty">No notices here.</div></div>';
  };
  render();
  $('#nS').onchange = e => { nf.status = e.target.value; render(); };
  $('#nD').onchange = e => { nf.dept = e.target.value; render(); };
  $('#nQ').oninput = e => { nf.q = e.target.value; render(); };
  if ($('#addN')) $('#addN').onclick = () => editNotice(null);
  $('#nList').addEventListener('change', async e => {
    const id = e.target.dataset.ns; if (!id) return;
    try { await must(sb.from('notices').update({ status: e.target.value }).eq('id', id)); toast('Saved'); route(); } catch (err) { toast(friendly(err), true); route(); }
  });
  $('#nList').addEventListener('click', e => { const id = e.target.dataset.ne; if (id) editNotice(all.find(n => n.id === id)); });
  noticeWatchBar($('#nWatch'), $('#nCheck'));
  if (isManager()) noticeMailList($('#nMails'));
};

/* notice watch: status line + Check now */
async function noticeWatchBar(box, btn) {
  const r = await safe(sb.rpc('notice_status'));
  if (r.error || !r.data) { box.innerHTML = ''; btn.onclick = () => toast('Notice watch is not set up yet — run update-session6.sql', true); return; }
  const s = r.data, ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  box.innerHTML = s.connected && s.enabled
    ? `<p class="muted small nwatch">● Notice emails checked automatically every ${s.every_minutes} min, with a summary at 8 AM and 8 PM · last check <b>${ago(s.last_check_at)}</b>${s.last_error ? ` · <span class="late">problem: ${esc(s.last_error)}</span>` : ''}</p>`
    : `<p class="note small">Automatic notice check is not connected yet${isAdmin() ? ' — <a href="#/settings">Settings → Notice watch</a>' : ' — ask the Admin to set it up'}. You can still add notices by hand.</p>`;
  btn.onclick = async () => {
    if (!(s.connected && s.enabled)) return toast('Notice watch is not connected yet' + (isAdmin() ? ' — see Settings → Notice watch' : ''), true);
    btn.disabled = true; const lbl = $('span', btn); lbl.textContent = 'Checking…';
    try {
      const before = s.last_check_at;
      await must(sb.rpc('notice_request_check'));
      for (let i = 0; i < 18; i++) {                 // the mailbox script runs every minute; wait up to 3 minutes
        await new Promise(ok => setTimeout(ok, 10000));
        if (!document.body.contains(btn)) return;
        const q = await safe(sb.rpc('notice_status'));
        if (q.data && q.data.last_check_at && q.data.last_check_at !== before) {
          toast(q.data.last_error ? 'Check failed: ' + q.data.last_error : q.data.last_found ? `${q.data.last_found} new notice email${q.data.last_found > 1 ? 's' : ''} found` : 'Checked — no new notices', !!q.data.last_error);
          return route();
        }
      }
      toast('The mailbox script did not answer — is it running? (Settings → Notice watch)', true);
    } catch (e) { toast(friendly(e), true); }
    btn.disabled = false; lbl.textContent = 'Check now';
  };
}

/* notice emails the tracker could not match to a client */
async function noticeMailList(box) {
  const r = await safe(sb.from('notice_mails').select('*').eq('result', 'unmatched').order('created_at', { ascending: false }).limit(50));
  const list = r.data || [];
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="card nmail"><h3>From email — needs a client (${list.length})</h3>
    <p class="muted small">These look like notices, but no client has that GSTIN / PAN / TAN / CIN or email. Choose the client to add the notice, or ignore it.</p>
    <div class="table-wrap"><table><thead><tr><th>Received</th><th>Email</th><th>Read as</th><th></th></tr></thead><tbody>
    ${list.map(m => `<tr><td>${fmtDate((m.received_at || m.created_at).slice(0, 10))}</td>
      <td class="wrap"><b>${esc(m.subject || '(no subject)')}</b><div class="muted small">${esc(m.sender || '')}</div></td>
      <td class="wrap">${esc([m.dept === 'ROC/MCA' ? 'MCA' : m.dept, m.notice_type].filter(Boolean).join(' · '))}<div class="muted small">${esc([m.ref_no, m.period, m.reply_due ? 'reply by ' + fmtDate(m.reply_due) : ''].filter(Boolean).join(' · '))}</div></td>
      <td class="nowrap"><button class="btn sm primary" data-nmadd="${m.id}">Add as notice</button> <button class="btn sm ghost" data-nmign="${m.id}">Ignore</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  box.onclick = async e => {
    const a = e.target.dataset.nmadd, g = e.target.dataset.nmign;
    if (g) { try { await must(sb.from('notice_mails').update({ result: 'ignored', note: 'Ignored by ' + (me.full_name || me.email) }).eq('id', g)); noticeMailList(box); } catch (err) { toast(friendly(err), true); } }
    if (a) { const m = list.find(x => x.id === a);
      editNotice(null, { dept: NOTICE_DEPTS.includes(m.dept) ? m.dept : 'Other', notice_type: m.notice_type, ref_no: m.ref_no, period: m.period, reply_due: m.reply_due, amount: m.amount,
        notice_date: (m.received_at || m.created_at).slice(0, 10), status: 'Open', remarks: 'From the email "' + (m.subject || '') + '" (' + (m.sender || '') + ')', source: 'email', mail_id: m.mail_id, auto: true }, m.id); }
  };
}
function editNotice(n, prefill = null, mailRow = null) {
  const isNew = !n, admin = isManager();
  n = n || prefill || { dept: 'GST', status: 'Open', notice_date: today() };
  const can = admin || n.assigned_to === me.id, dis = admin ? '' : 'disabled', ro = can ? '' : 'disabled';
  const body = `<div class="form-grid">
    <label class="full">Client<select name="client_id" ${dis}>${isNew ? '<option value="">Select client…</option>' : ''}${opts(clients.filter(c => c.active || c.id === n.client_id), n.client_id, cLabel, c => c.id)}</select></label>
    <label>Department<select name="dept" ${dis}>${opts(NOTICE_DEPTS, n.dept, d => d === 'ROC/MCA' ? 'MCA' : d)}</select></label>
    <label>Notice type<input autocomplete="off" name="notice_type" list="dl-ntype" value="${esc(n.notice_type || '')}" placeholder="e.g. ASMT-10" ${dis}></label>
    <datalist id="dl-ntype">${NOTICE_TYPES.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
    <label>Reference / DIN no.<input name="ref_no" value="${esc(n.ref_no || '')}" ${ro}></label>
    <label>Period / FY<input name="period" value="${esc(n.period || '')}" placeholder="e.g. FY 2023-24" ${ro}></label>
    <label>Notice date<input type="date" name="notice_date" value="${esc(n.notice_date || '')}" ${ro}></label>
    <label>Reply due<input type="date" name="reply_due" value="${esc(n.reply_due || '')}" ${dis}></label>
    <label>Hearing date<input type="date" name="hearing_date" value="${esc(n.hearing_date || '')}" ${ro}></label>
    <label>Amount involved (₹)<input type="number" name="amount" value="${esc(n.amount ?? '')}" ${dis}></label>
    <label>Assigned to<select name="assigned_to" ${dis}>${staffOpts(n.assigned_to || '')}</select></label>
    <label>Status<select name="status" ${ro}>${opts(NOTICE_STATUSES, n.status)}</select></label>
    <label>Replied on<input type="date" name="replied_on" value="${esc(n.replied_on || '')}" ${ro}></label>
    <label>Reply acknowledgement no.<input name="ack_no" value="${esc(n.ack_no || '')}" ${ro}></label>
    <label class="full">Remarks / next action<textarea name="remarks" ${ro}>${esc(n.remarks || '')}</textarea></label>
    <div class="full nreply"><div class="toolbar"><b>Reply draft</b><span class="spacer"></span>${can ? '<button type="button" class="btn sm" id="nAi">✦ Draft reply with AI</button>' : ''}</div>
      <textarea name="draft_reply" rows="${n.draft_reply ? 12 : 3}" placeholder="${can ? 'Write the reply here, or press “Draft reply with AI”. Paste the notice text in Remarks first for a better draft.' : ''}" ${ro}>${esc(n.draft_reply || '')}</textarea>
      ${n.draft_at ? `<p class="muted small">Last drafted ${new Date(n.draft_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>` : ''}</div></div>`;
  const m = modal(isNew ? 'Add notice' : 'Notice details', body, {
    extra: isPartner() && !isNew ? '<button class="btn danger" data-ndel>Delete</button><button class="btn ghost" type="button" data-hist>History</button>' : '',
    onSave: can ? async el => {
      const rec = {};
      ['ref_no', 'period', 'notice_date', 'hearing_date', 'status', 'replied_on', 'ack_no', 'remarks', 'draft_reply'].forEach(k => rec[k] = fv(el, k) || null);
      if ((rec.draft_reply || null) !== (n.draft_reply || null)) rec.draft_at = rec.draft_reply ? new Date().toISOString() : null;
      if (isNew && prefill) Object.assign(rec, { source: prefill.source || null, mail_id: prefill.mail_id || null, auto: !!prefill.auto });
      if (admin) { ['client_id', 'dept', 'notice_type', 'reply_due', 'assigned_to'].forEach(k => rec[k] = fv(el, k) || null); rec.amount = fv(el, 'amount') === '' ? null : num(fv(el, 'amount')); }
      if (admin && (!rec.client_id || !rec.notice_type)) { toast('Client and notice type are required', true); return false; }
      if (isNew) { const { data } = await must(sb.from('notices').insert(rec).select('id').single());
        if (mailRow) await safe(sb.from('notice_mails').update({ result: 'added', client_id: rec.client_id, notice_id: data && data.id }).eq('id', mailRow)); }
      else await must(sb.from('notices').update(rec).eq('id', n.id));
      toast('Saved'); route();
    } : null
  });
  if ($('[data-hist]', m.el)) $('[data-hist]', m.el).onclick = () => showHistory('notices', n.id, `${clientName(n.client_id)} · ${n.notice_type || 'notice'}`);
  const ai = $('#nAi', m.el);
  if (ai) ai.onclick = () => aiNoticeDraft(m.el, n, ai);
  const d = $('[data-ndel]', m.el);
  if (d) d.onclick = async () => { if (!confirm('Delete this notice?')) return; try { await must(sb.from('notices').delete().eq('id', n.id)); m.close(); toast('Deleted'); route(); } catch (e) { toast(friendly(e), true); } };
}

/* =====================================================================
   3. MONTHLY REPORT
   ===================================================================== */
let repMonth = today().slice(0, 7);
async function loadXlsx() {
  if (window.XLSX) return window.XLSX;
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'xlsx.mini.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Could not load the Excel helper')); document.head.appendChild(s); });
  return window.XLSX;
}
VIEWS.reports = async v => {
  const [y, m] = repMonth.split('-').map(Number);
  const s = iso(new Date(y, m - 1, 1)), e = iso(new Date(y, m, 0));
  const [tk, nt, iv, py] = await Promise.all([
    must(sb.from('tasks').select('*').gte('due_date', s).lte('due_date', e).limit(10000)),
    safe(sb.from('notices').select('*').limit(5000)),
    safe(sb.from('invoices').select('id,total,inv_date').gte('inv_date', s).lte('inv_date', e).limit(5000)),
    safe(sb.from('payments').select('amount,paid_on').gte('paid_on', s).lte('paid_on', e).limit(5000))
  ]);
  const rows = (tk.data || []).filter(r => r.status !== 'Not applicable');
  const onTime = r => r.status === 'Filed' && r.filed_on && (!r.due_date || r.filed_on <= r.due_date);
  const late = r => r.status === 'Filed' && r.filed_on && r.due_date && r.filed_on > r.due_date;
  const stat = list => ({ total: list.length, filed: list.filter(r => r.status === 'Filed').length, ontime: list.filter(onTime).length, late: list.filter(late).length, pending: list.filter(r => r.status !== 'Filed').length });
  const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
  const types = [['GST', 'GST'], ['TDS', 'TDS'], ['ROC/MCA', 'MCA'], ['Other', 'Other']].map(([k, l]) => ({ l, ...stat(rows.filter(r => inTab(r, k))) }));
  const tot = stat(rows);
  const staff = [...new Set(rows.map(r => r.assigned_to || ''))].map(id => ({ l: id ? profName(id) : 'Unassigned', ...stat(rows.filter(r => (r.assigned_to || '') === id)) })).sort((a, b) => b.total - a.total);
  const cls = [...new Set(rows.map(r => r.client_id))].map(id => ({ l: clientName(id), ...stat(rows.filter(r => r.client_id === id)), pend: rows.filter(r => r.client_id === id && r.status !== 'Filed').map(r => r.return_name) })).sort((a, b) => b.pending - a.pending || a.l.localeCompare(b.l));
  const notices = nt.error ? null : nt.data || [];
  const nOpened = notices ? notices.filter(n => n.notice_date >= s && n.notice_date <= e).length : 0;
  const nClosed = notices ? notices.filter(n => n.status === 'Closed' && (n.updated_at || '').slice(0, 10) >= s && (n.updated_at || '').slice(0, 10) <= e).length : 0;
  const nOpen = notices ? notices.filter(n => n.status !== 'Closed').length : 0;
  const billed = iv.error ? null : (iv.data || []).reduce((a, i) => a + num(i.total), 0);
  const recd = py.error ? null : (py.data || []).reduce((a, p) => a + num(p.amount), 0);
  const tbl = (head, list, cols) => `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr></thead><tbody>
    ${list.map(x => `<tr>${cols(x).map((c, i) => `<td class="${i ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="muted">No work due this month</td></tr>`}</tbody></table></div>`;
  const statCols = x => [esc(x.l), x.total, x.filed, x.ontime, `<span class="${x.late ? 'late' : ''}">${x.late}</span>`, `<span class="${x.pending ? 'late' : ''}">${x.pending}</span>`, pc(x.ontime, x.filed)];
  const H = ['', 'Total', 'Filed', 'On time', 'Late', 'Pending', 'On-time %'];
  v.innerHTML = `<div class="page-head"><h2>Monthly report</h2><span class="spacer"></span>
      <input type="month" id="repM" value="${repMonth}"><button class="btn" id="repPrint">Print / PDF</button><button class="btn primary" id="repXl">Download Excel</button></div>
    <div class="report">
    <h3 class="print-only">${esc(firmName())} — Monthly report, ${MONTHS_FULL[m - 1]} ${y}</h3>
    <div class="bento-stats card stats4"><div class="mini blue"><span>Work due</span><b>${tot.total}</b></div><div class="mini green"><span>Filed on time</span><b>${tot.ontime}</b></div>
      <div class="mini amber"><span>Filed late</span><b>${tot.late}</b></div><div class="mini red"><span>Still pending</span><b>${tot.pending}</b></div></div>
    <div class="rep-extra muted small">${billed != null ? `Billed this month <b>${inr(billed)}</b> · Received <b>${inr(recd)}</b> · ` : ''}${notices ? `Notices received ${nOpened} · closed ${nClosed} · open now ${nOpen}` : ''}</div>
    <div class="card"><h3>By work type</h3>${tbl(['Type', ...H.slice(1)], types, statCols)}</div>
    <div class="card"><h3>Staff-wise</h3>${tbl(['Staff', ...H.slice(1)], staff, statCols)}</div>
    <div class="card"><h3>Client-wise</h3>${tbl(['Client', 'Total', 'Filed', 'On time', 'Late', 'Pending', 'Pending items'], cls, x => [esc(x.l), x.total, x.filed, x.ontime, x.late, x.pending, `<span class="small">${esc(x.pend.join(', '))}</span>`])}</div>
    </div><div id="bkBox" class="noprint"></div>`;
  $('#repM').onchange = ev => { repMonth = ev.target.value || today().slice(0, 7); route(); };
  $('#repPrint').onclick = () => window.print();
  renderBackups($('#bkBox', v));
  $('#repXl').onclick = async ev => {
    const b = ev.target; b.disabled = true;
    try {
      const X = await loadXlsx();
      const wb = X.utils.book_new();
      const sh = (name, aoa, w) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map(x => ({ wch: x })); X.utils.book_append_sheet(wb, ws, name); };
      const head = ['Total', 'Filed', 'On time', 'Late', 'Pending', 'On-time %'];
      const row = x => [x.l, x.total, x.filed, x.ontime, x.late, x.pending, x.filed ? Math.round(100 * x.ontime / x.filed) + '%' : ''];
      sh('Summary', [[`${firmName()} - Monthly report`, `${MONTHS_FULL[m - 1]} ${y}`], [], ['Work type', ...head], ...types.map(row), ['All', ...row(tot).slice(1)], [],
        ...(billed != null ? [['Billed this month', billed], ['Received this month', recd]] : []), ...(notices ? [['Notices received', nOpened], ['Notices closed', nClosed], ['Notices open now', nOpen]] : [])], [26, 14, 10, 10, 10, 10, 12]);
      sh('Staff', [['Staff', ...head], ...staff.map(row)], [24, 10, 10, 10, 10, 10, 12]);
      sh('Clients', [['Client', 'Total', 'Filed', 'On time', 'Late', 'Pending', 'Pending items'], ...cls.map(x => [x.l, x.total, x.filed, x.ontime, x.late, x.pending, x.pend.join(', ')])], [34, 8, 8, 8, 8, 8, 50]);
      sh('Detail', [['Client', 'GSTIN', 'Type', 'Return', 'Period', 'Due date', 'Status', 'Filed on', 'On time?', 'ARN', 'Assigned to', 'Data received', 'Remarks'],
        ...rows.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(r => [clientName(r.client_id), clientById(r.client_id)?.gstin || '', r.work_type === 'ROC/MCA' ? 'MCA' : r.work_type, r.return_name, r.period, r.due_date || '', r.status, r.filed_on || '',
          r.status === 'Filed' ? (onTime(r) ? 'Yes' : 'Late') : '', r.arn || '', profName(r.assigned_to) || '', r.data_received_on || '', r.remarks || ''])], [30, 17, 7, 24, 14, 11, 13, 11, 9, 18, 16, 12, 30]);
      X.writeFile(wb, `report-${repMonth}.xlsx`);
    } catch (err) { toast(friendly(err), true); }
    finally { b.disabled = false; }
  };
};

/* =====================================================================
   4. CLIENT DOCUMENTS (inside the Checklist window)
   ===================================================================== */
async function docsSection(task, can, host, onChange) {
  if (!P4()) { host.innerHTML = ''; return; }
  const c = clientById(task.client_id) || {};
  let docs = [];
  const load = async () => {
    const r = await safe(sb.from('task_docs').select('*').eq('task_id', task.id).order('seq').order('name'));
    if (r.error) { host.innerHTML = ''; return false; }
    docs = r.data || [];
    return true;
  };
  if (!(await load())) return;
  const tpl = templateFor(task.return_name);
  if (!docs.length && can && tpl && (tpl.docs || []).length) {
    await sb.from('task_docs').upsert(tpl.docs.map((n, i) => ({ task_id: task.id, seq: i + 1, name: n })), { onConflict: 'task_id,name', ignoreDuplicates: true });
    await load();
  }
  const draw = () => {
    const got = docs.filter(d => d.received).length, missing = docs.filter(d => !d.received).map(d => d.name);
    host.innerHTML = `<div class="docs-box"><div class="docs-head"><h4 style="margin:0">Documents from client</h4>
        <span class="muted small">${docs.length ? `${got} of ${docs.length} received${got === docs.length ? ' ✓' : ''}` : 'none listed'}</span><span class="spacer"></span>
        ${missing.length && c.phone ? `<a class="btn sm" href="${esc(waShare(docsRequestMsg(c, task, missing), c.phone))}" target="_blank" rel="noopener">Ask on WhatsApp</a>` : ''}
        ${missing.length && clientEmails(c).length ? `<a class="btn sm ghost" href="mailto:${esc(clientEmails(c).join(','))}?subject=${encodeURIComponent('Documents needed: ' + task.return_name + ' ' + task.period)}&body=${encodeURIComponent(docsRequestMsg(c, task, missing))}">Email</a>` : ''}</div>
      <div class="docs-list">${docs.map(d => `<label class="doc ${d.received ? 'got' : ''}"><input type="checkbox" data-doc="${d.id}" ${d.received ? 'checked' : ''} ${can ? '' : 'disabled'}><span>${esc(d.name)}</span>${d.received_on ? `<em>${fmtDate(d.received_on).slice(0, 6)}</em>` : ''}${can ? `<button type="button" class="link small" data-docx="${d.id}" aria-label="Remove">✕</button>` : ''}</label>`).join('')}</div>
      ${can ? `<div class="toolbar" style="margin:8px 0 0"><input data-docnew placeholder="Add a document…" style="flex:1;min-width:200px"><button class="btn sm" data-docadd>+ Add</button></div>` : ''}
      <p class="muted small" style="margin:6px 0 0">Clients see this list on their status link. When everything is ticked, the work moves to “In progress”.</p></div>`;
  };
  draw();
  host.onchange = async e => {
    const id = e.target.dataset.doc; if (!id) return;
    try {
      await must(sb.from('task_docs').update({ received: e.target.checked }).eq('id', id));
      await load(); draw(); onChange && onChange();
    } catch (err) { toast(friendly(err), true); }
  };
  host.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.docx) { await must(sb.from('task_docs').delete().eq('id', b.dataset.docx)); await load(); draw(); }
      if (b.hasAttribute('data-docadd')) {
        const n = $('[data-docnew]', host).value.trim(); if (!n) return;
        await must(sb.from('task_docs').insert({ task_id: task.id, seq: docs.length + 1, name: n })); await load(); draw();
      }
    } catch (err) { toast(friendly(err), true); }
  };
}

/* =====================================================================
   ZOHO INVOICE LINK (UI)
   ===================================================================== */
let zohoCfg = null;                                      // row of zoho_settings (admin) or null
async function loadZohoCfg() {
  if (!isManager()) return (zohoCfg = null);
  const r = await safe(sb.from('zoho_settings').select('enabled,auto_push,org_id,org_name,last_sync,last_result,last_error,sync_from').eq('id', 1).maybeSingle());
  zohoCfg = r.error ? null : r.data;
  return zohoCfg;
}
const zohoOn = () => !!(zohoCfg && zohoCfg.enabled && zohoCfg.org_id);
const zohoLink = i => zohoCfg && i.zoho_invoice_id ? `https://invoice.zoho.in/app/${encodeURIComponent(zohoCfg.org_id)}#/invoices/${encodeURIComponent(i.zoho_invoice_id)}` : '';
async function zohoCall(action, payload = {}) {
  const { data } = await sb.auth.getSession();
  const tok = data && data.session && data.session.access_token;
  let r;
  try {
    r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/zoho`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, apikey: cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, ...payload })
    });
  } catch (e) { throw new Error('Could not reach the Zoho link (server function not installed?)'); }
  let j = {};
  try { j = await r.json(); } catch (e) { /* empty */ }
  if (!r.ok || j.error) throw new Error(j.error || j.message || `Zoho link error (${r.status})`);
  return j;
}
function zohoCell(i) {
  if (!zohoCfg) return '';
  if (i.zoho_invoice_id) {
    const l = zohoLink(i);
    return `<a class="zbadge ${i.zoho_status === 'void' ? 'void' : ''}" href="${esc(l)}" target="_blank" rel="noopener" title="Open in Zoho Invoice">Zoho · ${esc(i.zoho_status || 'linked')}</a>`;
  }
  if (!zohoOn()) return '<span class="muted small">—</span>';
  return `${i.zoho_error ? `<span class="error small" title="${esc(i.zoho_error)}">✗ not sent</span><br>` : ''}<button class="link small" data-zpush="${i.id}">Send to Zoho</button>`;
}

async function renderZohoSettings(box) {
  await loadZohoCfg();
  if (!zohoCfg) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="card"><h3>Zoho Invoice</h3><div class="loading">Checking the link…</div></div>';
  let st;
  try { st = await zohoCall('status'); }
  catch (e) {
    box.innerHTML = `<div class="card"><h3>Zoho Invoice</h3><p class="note warn small">${esc(friendly(e))}. The server function “zoho” needs to be installed in Supabase first.</p></div>`;
    return;
  }
  const steps = `<ol class="small zsteps">
      <li>Open <a href="https://api-console.zoho.in" target="_blank" rel="noopener">api-console.zoho.in</a> and sign in with your Zoho Invoice account.</li>
      <li>Click <b>Add Client</b> → <b>Self Client</b> → <b>Create</b> → OK.</li>
      <li>On the <b>Client Secret</b> tab, copy the <b>Client ID</b> and <b>Client Secret</b> into the boxes below.</li>
      <li>On the <b>Generate Code</b> tab, type the scope <code>ZohoInvoice.fullaccess.all</code>, choose <b>10 minutes</b>, description <i>JLR tracker</i>, click <b>Create</b> (pick your organisation if asked) and copy the code.</li>
      <li>Paste the code below and click <b>Connect</b> within 10 minutes.</li></ol>`;
  const connected = st.connected && st.enabled;
  box.innerHTML = `<div class="card" id="zohoBox"><h3>Zoho Invoice ${connected ? '<span class="badge ok">Connected</span>' : ''}</h3>
    ${connected ? `
      <p class="small">Organisation: <b>${esc(st.org_name || st.org_id)}</b>. Tracker invoices are created in Zoho with Zoho's number & GST, payments go both ways, and invoices raised in Zoho appear in Billing. Sync runs every 30 minutes (8 AM–9 PM).</p>
      <div class="form-grid">
        <label class="check full"><input type="checkbox" name="z_auto" ${st.auto_push ? 'checked' : ''}> Send new tracker invoices to Zoho automatically</label>
        <label>Bring Zoho invoices dated from<input type="date" name="z_from" value="${esc(st.sync_from || '')}"></label></div>
      <div class="toolbar" style="margin-top:12px"><button class="btn primary" data-z="save">Save</button><button class="btn" data-z="sync">Sync now</button>
        <span class="spacer"></span><button class="btn ghost danger" data-z="disc">Disconnect</button></div>
      <p class="muted small">Last sync: ${st.last_sync ? new Date(st.last_sync).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'not yet'}${st.last_result ? ' — ' + esc(st.last_result) : ''}</p>
      ${st.last_error ? `<p class="error small">${esc(st.last_error)}</p>` : ''}`
    : `${(st.orgs || []).length > 1 ? `<p class="small"><b>Choose your Zoho organisation:</b></p><div class="toolbar"><select name="z_org">${opts(st.orgs, '', o => o.name, o => o.id)}</select><button class="btn primary" data-z="org">Use this organisation</button></div>` : ''}
      <p class="muted small">Link the tracker with your Zoho Invoice account (two-way). Do these steps yourself — the keys are stored encrypted and are never shown again.</p>${steps}
      <div class="form-grid">
        <label>Client ID<input name="z_cid" autocomplete="off" value="${esc(st.client_id || '')}"></label>
        <label>Client Secret<input name="z_sec" type="password" autocomplete="off"></label>
        <label class="full">Code (from Generate Code)<input name="z_code" autocomplete="off" placeholder="1000.xxxxxxxx.xxxxxxxx"></label></div>
      <div class="toolbar" style="margin-top:12px"><button class="btn primary" data-z="connect">Connect</button></div>`}
  </div>`;
  box.onclick = async e => {
    const act = e.target.dataset.z; if (!act) return;
    const b = e.target; b.disabled = true;
    try {
      if (act === 'connect') {
        const r = await zohoCall('connect', { client_id: fv(box, 'z_cid'), client_secret: fv(box, 'z_sec'), grant_code: fv(box, 'z_code') });
        toast((r.orgs || []).length > 1 ? 'Connected — now choose the organisation' : 'Zoho connected');
        if ((r.orgs || []).length === 1) { const s = await zohoCall('sync').catch(err => ({ summary: friendly(err) })); toast('First sync: ' + (s.summary || 'done')); }
      }
      if (act === 'org') { await zohoCall('set_org', { org_id: fv(box, 'z_org') }); toast('Organisation saved'); }
      if (act === 'save') {
        await must(sb.from('zoho_settings').update({ auto_push: $('[name=z_auto]', box).checked, sync_from: fv(box, 'z_from') || null }).eq('id', 1));
        toast('Saved');
      }
      if (act === 'sync') { const s = await zohoCall('sync'); toast(s.summary || 'Synced'); }
      if (act === 'disc') {
        if (!confirm('Disconnect Zoho? Invoices already linked stay as they are.')) return;
        await zohoCall('disconnect'); toast('Zoho disconnected');
      }
      renderZohoSettings(box);
    } catch (err) { toast(friendly(err), true); b.disabled = false; }
  };
}

/* =====================================================================
   BACKUPS (Reports page, partner & admin)
   ===================================================================== */
async function renderBackups(box) {
  if (!isPartner()) return;
  const r = await safe(sb.from('backups').select('id,taken_at,kind,rows,size_kb').order('taken_at', { ascending: false }).limit(40));
  if (r.error) { box.innerHTML = ''; return; }
  const list = r.data || [];
  box.innerHTML = `<div class="card"><div class="bill-head"><h3 style="margin:0">Backups</h3>
      <span class="row-btns"><button class="btn sm" data-bk="now">Back up now</button></span></div>
    <p class="muted small">A full copy of the tracker (clients, work, checklists, documents, notices, billing, renewals, tax intimations, onboarding, client reports, companies & directors, TDS working, team) is saved automatically every night at 11:30 PM and kept for 30 days. Download any copy as Excel.</p>
    ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Taken</th><th>Type</th><th class="r">Records</th><th class="r">Size</th><th></th></tr></thead><tbody>
      ${list.map(b => `<tr><td>${new Date(b.taken_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${b.kind === 'auto' ? 'Automatic' : 'Manual'}</td>
        <td class="r">${b.rows}</td><td class="r">${b.size_kb} KB</td><td><button class="btn sm" data-bkdl="${b.id}">Download Excel</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No backups yet.</div>'}</div>`;
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.bk === 'now') { await must(sb.rpc('take_backup', { p_kind: 'manual' })); toast('Backup saved'); return renderBackups(box); }
      if (b.dataset.bkdl) {
        const { data } = await must(sb.from('backups').select('taken_at,data').eq('id', +b.dataset.bkdl).single());
        await backupToExcel(data);
      }
    } catch (err) { toast(friendly(err), true); }
    finally { b.disabled = false; }
  };
}
async function backupToExcel(bk) {
  const X = await loadXlsx();
  const wb = X.utils.book_new(), D = bk.data || {};
  const cname = {}; (D.clients || []).forEach(c => cname[c.id] = c.name);
  const pname = {}; (D.team || []).forEach(p => pname[p.id] = p.full_name || p.email);
  const order = [['clients', 'Clients'], ['tasks', 'Work'], ['task_checks', 'Checklist ticks'], ['task_docs', 'Client documents'], ['notices', 'Notices'],
    ['invoices', 'Invoices'], ['payments', 'Payments'], ['fee_rates', 'Fee list'], ['due_dates', 'Due dates'], ['checklist_templates', 'Checklists'],
    ['linked_rules', 'Linked filings'], ['team', 'Team'], ['followups', 'Follow-ups'], ['renewals', 'Renewals'], ['tax_intimations', 'Tax intimations'], ['onboarding', 'Onboarding'],
    ['client_reports', 'Client reports'], ['mca_companies', 'Companies'], ['mca_directors', 'Directors'], ['tds_entries', 'TDS entries'], ['tds_challans', 'TDS challans'], ['tds_returns', 'TDS returns']];
  for (const [k, name] of order) {
    if (!(k in D) && !['clients', 'tasks', 'team'].includes(k)) continue;           // older backups do not have the newer tables
    const rows = (D[k] || []).map(r => {
      const o = {};
      if (r.client_id !== undefined) o.client_name = cname[r.client_id] || '';
      if (r.assigned_to !== undefined) o.assigned_name = pname[r.assigned_to] || '';
      for (const [f, v] of Object.entries(r)) o[f] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
      return o;
    });
    const ws = rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([['(empty)']]);
    X.utils.book_append_sheet(wb, ws, name);
  }
  X.writeFile(wb, `jlr-tracker-backup-${bk.taken_at.slice(0, 10)}.xlsx`);
}

/* =====================================================================
   LAW UPDATES
   ===================================================================== */
const LU_DEPTS = ['GST', 'TDS', 'Income Tax', 'ROC/MCA', 'Other'];
let luDept = '';
VIEWS.updates = async v => {
  const r = await safe(sb.from('law_updates').select('*').order('created_at', { ascending: false }).limit(500));
  if (r.error) { v.innerHTML = '<div class="card"><h3>Law updates</h3><p class="note">Not set up yet — run <b>update-law-updates.sql</b> in Supabase, then reload.</p></div>'; return; }
  const all = r.data || [];
  const pub = all.filter(u => u.status === 'published' && (!luDept || u.dept === luDept))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  const drafts = all.filter(u => u.status === 'draft');
  const card = (u, draft) => `<article class="card lu ${draft ? 'lu-draft' : ''}">
      <div class="lu-head">${wtBadge(u.dept === 'Income Tax' ? 'Income Tax' : u.dept)}<b>${esc(u.title)}</b><span class="spacer"></span>
        ${u.effective_on ? `<span class="muted small">Effective ${fmtDate(u.effective_on)}</span>` : ''}</div>
      ${u.summary ? `<p class="lu-sum">${esc(u.summary)}</p>` : ''}
      ${u.action_needed ? `<p class="lu-act"><b>Action:</b> ${esc(u.action_needed)}</p>` : ''}
      <div class="lu-foot">${u.source_url ? `<a class="small" href="${esc(u.source_url)}" target="_blank" rel="noopener">Official source ↗</a>` : '<span class="muted small">No source link</span>'}
        <span class="spacer"></span><span class="muted small">${u.published_at ? 'Published ' + fmtDate(u.published_at.slice(0, 10)) : 'Draft'}</span>
        ${isPartner() ? `<span class="row-btns">${draft ? `<button class="btn sm primary" data-lup="${u.id}">Publish</button>` : `<button class="btn sm" data-lunp="${u.id}">Unpublish</button>`}
          <button class="btn sm" data-lue="${u.id}">Edit</button><button class="link small danger-t" data-lud="${u.id}">Delete</button></span>` : ''}</div></article>`;
  v.innerHTML = `<div class="page-head"><h2>Law updates</h2><span class="spacer"></span>
      ${isPartner() ? '<button class="btn" id="luPaste">Paste from Claude</button><button class="btn" id="luShare">Share with team</button><button class="btn primary" id="luAdd">+ Add update</button>' : ''}</div>
    <p class="muted small">Changes in GST, TDS, Income Tax and MCA law, due-date extensions and new forms — with what our team needs to do.</p>
    <div class="toolbar"><select id="luD"><option value="">All departments</option>${opts(LU_DEPTS, luDept, d => d === 'ROC/MCA' ? 'MCA' : d)}</select></div>
    ${isPartner() && drafts.length ? `<h3 class="ck-group">Drafts to check (${drafts.length})</h3>${drafts.map(u => card(u, true)).join('')}<h3 class="ck-group">Published</h3>` : ''}
    ${pub.length ? pub.map(u => card(u, false)).join('') : '<div class="table-wrap"><div class="empty">No updates published yet.</div></div>'}`;
  $('#luD').onchange = e => { luDept = e.target.value; route(); };
  if (!isPartner()) return;
  $('#luAdd').onclick = () => editUpdate(null);
  $('#luPaste').onclick = () => pasteUpdates();
  $('#luShare').onclick = () => shareUpdates(all.filter(u => u.status === 'published'));
  v.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.lup || b.dataset.lunp || b.dataset.lue || b.dataset.lud; if (!id) return;
    const u = all.find(x => x.id === id);
    try {
      if (b.dataset.lue) return editUpdate(u);
      if (b.dataset.lud) { if (!confirm('Delete this update?')) return; await must(sb.from('law_updates').delete().eq('id', id)); toast('Deleted'); }
      if (b.dataset.lup) { await must(sb.from('law_updates').update({ status: 'published' }).eq('id', id)); toast('Published — the team can see it now'); }
      if (b.dataset.lunp) { await must(sb.from('law_updates').update({ status: 'draft' }).eq('id', id)); toast('Moved back to drafts'); }
      route();
    } catch (err) { toast(friendly(err), true); }
  });
};
function editUpdate(u) {
  const isNew = !u; u = u || { dept: 'GST', status: 'draft' };
  modal(isNew ? 'Add law update' : 'Edit law update', `<div class="form-grid">
      <label>Department<select name="dept">${opts(LU_DEPTS, u.dept, d => d === 'ROC/MCA' ? 'MCA' : d)}</select></label>
      <label>Effective from<input type="date" name="eff" value="${esc(u.effective_on || '')}"></label>
      <label class="full">Title<input name="title" value="${esc(u.title || '')}" placeholder="e.g. GSTR-3B due date extended for Oct 2026"></label>
      <label class="full">What changed<textarea name="sum" rows="3">${esc(u.summary || '')}</textarea></label>
      <label class="full">What our team must do<textarea name="act" rows="2">${esc(u.action_needed || '')}</textarea></label>
      <label class="full">Official source link<input name="url" value="${esc(u.source_url || '')}" placeholder="https://…"></label>
      <label class="check full"><input type="checkbox" name="pub" ${u.status === 'published' ? 'checked' : ''}> Publish now (team can see it)</label></div>`, {
    wide: true,
    onSave: async el => {
      const rec = { dept: fv(el, 'dept'), effective_on: fv(el, 'eff') || null, title: fv(el, 'title'), summary: fv(el, 'sum') || null,
        action_needed: fv(el, 'act') || null, source_url: fv(el, 'url') || null, status: $('[name=pub]', el).checked ? 'published' : 'draft' };
      if (!rec.title) { toast('Title is required', true); return false; }
      if (rec.source_url && !/^https?:\/\//i.test(rec.source_url)) { toast('Source link should start with https://', true); return false; }
      if (isNew) await must(sb.from('law_updates').insert(rec)); else await must(sb.from('law_updates').update(rec).eq('id', u.id));
      toast('Saved'); route();
    }
  });
}
// Paste format, one update per line:  Dept | Title | What changed | Action | YYYY-MM-DD | https://source
function parseUpdates(text) {
  const deptOf = d => { const x = (d || '').trim().toLowerCase(); return x.startsWith('gst') ? 'GST' : x.startsWith('tds') || x.startsWith('tcs') ? 'TDS' : x.startsWith('income') || x === 'it' ? 'Income Tax' : x.includes('mca') || x.includes('roc') || x.includes('compan') || x.includes('llp') ? 'ROC/MCA' : 'Other'; };
  return text.split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(l => (l.match(/\|/g) || []).length >= 2 && !/^dept\s*\|/i.test(l))
    .map(l => { const p = l.split('|').map(x => x.trim());
      const date = /^\d{4}-\d{2}-\d{2}$/.test(p[4] || '') ? p[4] : null;
      const url = (p.find(x => /^https?:\/\//i.test(x)) || null);
      return { dept: deptOf(p[0]), title: p[1], summary: p[2] || null, action_needed: p[3] && !/^https?:/i.test(p[3]) ? p[3] : null, effective_on: date, source_url: url, status: 'draft' }; })
    .filter(u => u.title);
}
function pasteUpdates() {
  const m = modal('Paste updates from Claude', `<p class="muted small" style="margin-top:0">Paste the list Claude prepares each month (one update per line:
      <code>Dept | Title | What changed | Action | YYYY-MM-DD | Source link</code>). They are saved as <b>drafts</b> for you to check and publish.</p>
    <textarea name="txt" rows="12" style="width:100%" placeholder="GST | GSTR-3B due date extended for October 2026 | ... | File by 25 Nov | 2026-11-20 | https://..."></textarea>
    <div class="muted small" data-cnt>0 updates found</div>`, {
    wide: true, saveText: 'Save as drafts',
    onSave: async el => {
      const list = parseUpdates($('[name=txt]', el).value);
      if (!list.length) { toast('No updates found — check the format', true); return false; }
      await must(sb.from('law_updates').insert(list));
      toast(`${list.length} draft update${list.length > 1 ? 's' : ''} saved`); route();
    }
  });
  $('[name=txt]', m.el).oninput = e => { $('[data-cnt]', m.el).textContent = `${parseUpdates(e.target.value).length} updates found`; };
}
function shareUpdates(pub) {
  const since = iso(addDays(new Date(), -31));
  const recent = pub.filter(u => (u.published_at || '').slice(0, 10) >= since);
  if (!recent.length) return toast('No updates published in the last month', true);
  const text = `${firmName()} - Law updates\n\n` + recent.map((u, i) => `${i + 1}. [${u.dept === 'ROC/MCA' ? 'MCA' : u.dept}] ${u.title}${u.effective_on ? ' (from ' + fmtDate(u.effective_on) + ')' : ''}${u.action_needed ? '\n   Action: ' + u.action_needed : ''}`).join('\n') +
    `\n\nDetails: ${new URL('index.html#/updates', location.href).href}`;
  const emails = profiles.filter(p => p.active && p.email).map(p => p.email).join(',');
  modal('Share updates with the team', `<p class="muted small" style="margin-top:0">${recent.length} update${recent.length > 1 ? 's' : ''} from the last month.</p>
    <textarea rows="10" style="width:100%" readonly>${esc(text)}</textarea>
    <div class="toolbar" style="margin-top:10px"><a class="btn primary" href="${esc(waShare(text))}" target="_blank" rel="noopener">Send on WhatsApp (pick group)</a>
      <a class="btn" href="mailto:${esc(emails)}?subject=${encodeURIComponent(firmName() + ' - Law updates')}&body=${encodeURIComponent(text)}">Email the team</a></div>`);
}

/* =====================================================================
   CLIENT PORTAL — staff side
   ===================================================================== */
const portalUrl = () => new URL('portal.html', location.href).href;
async function fnCall(fn, action, payload = {}) {
  const { data } = await sb.auth.getSession();
  const tok = data && data.session && data.session.access_token;
  let r;
  try {
    r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, apikey: cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, portal_url: portalUrl(), ...payload }) });
  } catch (e) { throw new Error('Could not reach the server function “' + fn + '”'); }
  let j = {}; try { j = await r.json(); } catch (e) { /* empty */ }
  if (!r.ok || j.error) throw new Error(j.error || j.message || `Error ${r.status}`);
  return j;
}
const portalMsg = (c, link) => `Dear ${c.contact_person || c.name},\nYou can now use the ${firmName()} client portal to see your GST / TDS / MCA work status, upload documents and download invoices.\n\n1) Set your password (link works once, for a limited time):\n${link}\n\n2) After that, sign in any time at:\n${portalUrl()}\n\n- ${firmName()}`;
function showPortalLink(c, email, link) {
  modal('Send the login link to the client', `<p class="small" style="margin-top:0">Login: <b>${esc(email)}</b>. Send this message to the client — the link lets them set a password. If it expires, use “New link”.</p>
    <textarea rows="9" style="width:100%" readonly>${esc(portalMsg(c, link))}</textarea>
    <div class="toolbar" style="margin-top:10px">${c.phone ? `<a class="btn primary" href="${esc(waShare(portalMsg(c, link), c.phone))}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ''}
      <a class="btn" href="mailto:${esc(email)}?subject=${encodeURIComponent(firmName() + ' - client portal login')}&body=${encodeURIComponent(portalMsg(c, link))}">Email</a>
      <button class="btn" data-cpy>Copy message</button></div>`).el.querySelector('[data-cpy]').onclick = () => copy(portalMsg(c, link));
}
async function renderPortalLogins(box, c) {
  if (!isManager() || !c || !c.id) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="small muted">Loading client portal logins…</div>';
  let logins = [];
  try { logins = (await fnCall('client-access', 'list', { client_id: c.id })).logins || []; }
  catch (e) { box.innerHTML = `<p class="muted small">Client portal: ${esc(friendly(e))}</p>`; return; }
  box.innerHTML = `<div class="small muted" style="font-weight:600;margin-bottom:6px">Client portal logins</div>
    ${logins.length ? `<div class="table-wrap"><table><tbody>${logins.map(l => `<tr><td><b>${esc(l.name || '')}</b><div class="muted small">${esc(l.email)}</div></td>
      <td class="small muted">${l.last_seen ? 'Last visit ' + new Date(l.last_seen).toLocaleDateString('en-IN') : 'Not logged in yet'}</td>
      <td class="row-btns"><button type="button" class="btn sm" data-pl-link="${l.user_id}">New link</button><button type="button" class="link small danger-t" data-pl-rm="${l.user_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted small" style="margin:0 0 6px">No logins yet.</p>'}
    <div class="toolbar" style="margin:6px 0 0"><input data-pl-email type="email" placeholder="client@email.com" value="${esc(logins.length ? '' : clientEmails(c)[0] || '')}" style="flex:1;min-width:180px">
      <input data-pl-name placeholder="Name (optional)" value="${esc(logins.length ? '' : c.contact_person || '')}" style="width:160px">
      <button type="button" class="btn sm primary" data-pl-add>Create login</button></div>`;
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    b.disabled = true;
    try {
      if (b.hasAttribute('data-pl-add')) {
        const r = await fnCall('client-access', 'create', { client_id: c.id, email: $('[data-pl-email]', box).value, name: $('[data-pl-name]', box).value });
        showPortalLink(c, r.email, r.link); renderPortalLogins(box, c);
      }
      if (b.dataset.plLink) { const r = await fnCall('client-access', 'link', { user_id: b.dataset.plLink }); showPortalLink(c, r.email, r.link); }
      if (b.dataset.plRm) {
        if (!confirm('Remove this client login? They will no longer be able to sign in.')) return;
        await fnCall('client-access', 'remove', { user_id: b.dataset.plRm }); toast('Login removed'); renderPortalLogins(box, c);
      }
    } catch (err) { toast(friendly(err), true); }
    finally { b.disabled = false; }
  };
}
async function renderClientFiles(box, task) {
  const r = await safe(sb.from('client_uploads').select('*').eq('task_id', task.id).order('uploaded_at', { ascending: false }));
  if (r.error || !(r.data || []).length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="docs-box"><div class="docs-head"><h4 style="margin:0">Files from the client</h4><span class="muted small">${r.data.length}</span></div>
    ${r.data.map(u => `<div class="file-row"><span>📄 ${esc(u.file_name)}${u.source === 'Email' ? ' <span class="badge">by email</span>' : ''}</span><span class="muted small">${new Date(u.uploaded_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${u.size_bytes ? ' · ' + Math.max(1, Math.round(u.size_bytes / 1024)) + ' KB' : ''}</span>
      <button type="button" class="btn sm" data-dlf="${esc(u.path)}">Download</button></div>`).join('')}</div>`;
  box.onclick = async e => {
    const p = e.target.dataset.dlf; if (!p) return;
    const { data, error } = await sb.storage.from('client-docs').createSignedUrl(p, 120, { download: true });
    if (error) return toast(friendly(error), true);
    window.open(data.signedUrl, '_blank', 'noopener');
  };
}


/* =====================================================================
   FOLLOW-UPS (client data + payments)
   ===================================================================== */
const FU_MODES = ['Phone call', 'Email', 'WhatsApp', 'Visit / meeting', 'Other'];
const FU_ICON = { 'Phone call': '📞', 'Email': '✉️', 'WhatsApp': '💬', 'Visit / meeting': '🤝', 'Other': '•' };
const daysFrom = (a, b = today()) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const fuLine = r => {
  if (!r.fu_count) return '';
  const due = r.fu_next && r.fu_next <= today() && r.status === 'Pending data';
  return `<div class="fu-line ${due ? 'due' : ''}">Followed up ${r.fu_count}× · last ${fmtDate(r.fu_last).slice(0, 6)}${r.fu_next ? ` · next <b>${fmtDate(r.fu_next).slice(0, 6)}</b>` : ''}</div>`;
};
const payMsg = (c, bal, invNos) => `Dear ${c.contact_person || c.name},\nA balance of ${inr(bal)} is pending against invoice${invNos.length > 1 ? 's' : ''} ${invNos.join(', ')}.\nKindly arrange the payment at the earliest.${settings.bank_details ? '\n\nBank details:\n' + settings.bank_details : ''}\n- ${firmName()}`;
const payMailUrl = (c, bal, invNos) => {
  const em = clientEmails(c); if (!em.length) return '';
  return `mailto:${em.join(',')}?subject=${encodeURIComponent(`Payment reminder: ${invNos.join(', ')}`)}&body=${encodeURIComponent(payMsg(c, bal, invNos))}`;
};

// kind 'task': { task } · kind 'payment': { client_id, bal, invNos }
async function logFollowup({ kind = 'task', task, client_id, bal = 0, invNos = [] }, refresh = () => {}) {
  const cid = kind === 'task' ? task.client_id : client_id;
  const c = clientById(cid) || {};
  let q = sb.from('followups').select('*').order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  q = kind === 'task' ? q.eq('task_id', task.id) : q.eq('kind', 'payment').eq('client_id', cid);
  const h = await safe(q);
  if (h.error) return toast('Follow-up log is not set up yet — run update-followups.sql in Supabase', true);
  const hist = h.data || [];
  const wa = c.phone ? waShare(kind === 'task' ? docsRequestMsg(c, task) : payMsg(c, bal, invNos), c.phone) : '';
  const mail = kind === 'task' ? requestMailUrl(c, task) : payMailUrl(c, bal, invNos);
  const head = kind === 'task'
    ? `<b>${esc(c.name || '')}</b> · ${esc(task.return_name)} · ${esc(task.period)}${task.due_date ? ' · due ' + fmtDate(task.due_date) : ''}`
    : `<b>${esc(c.name || '')}</b> · balance <b>${inr(bal)}</b> · ${esc(invNos.join(', '))}`;
  const body = `<p class="muted small" style="margin-top:0">${head}</p>
    <div class="toolbar" style="margin:0 0 12px">${c.phone ? `<a class="btn sm" href="tel:${esc(c.phone)}">📞 Call ${esc(c.phone)}</a>` : ''}
      ${wa ? `<a class="btn sm" href="${esc(wa)}" target="_blank" rel="noopener">💬 WhatsApp message</a>` : ''}
      ${mail ? `<a class="btn sm" href="${esc(mail)}">✉️ Email</a>` : ''}
      ${!c.phone && !mail ? '<span class="muted small">No phone or email saved for this client.</span>' : ''}</div>
    <div class="form-grid">
      <label>Date<input type="date" name="f_on" value="${today()}"></label>
      <label>How<select name="f_mode">${opts(FU_MODES, 'Phone call')}</select></label>
      <label class="full">What happened<input name="f_note" placeholder="${kind === 'task' ? 'e.g. Spoke to accountant, will send sales data' : 'e.g. Promised to pay by NEFT'}"></label>
      <label>${kind === 'task' ? 'Client promised data by' : 'Client promised payment by'}<input type="date" name="f_prom"></label>
      <label>Follow up again on<input type="date" name="f_next" value="${iso(addDays(new Date(), 3))}"></label>
    </div>
    <h4 style="margin:18px 0 8px">History ${hist.length ? `<span class="muted small">(${hist.length})</span>` : ''}</h4>
    ${hist.length ? `<div class="fu-hist">${hist.map(f => `<div class="fu-item"><span class="fu-ico" aria-hidden="true">${FU_ICON[f.mode] || '•'}</span>
        <div><b>${fmtDate(f.on_date)}</b> · ${esc(f.mode)}${f.created_by ? ` · <span class="muted">${esc(profName(f.created_by))}</span>` : ''}
        ${f.note ? `<div>${esc(f.note)}</div>` : ''}
        <div class="muted small">${f.promised_on ? 'Promised by ' + fmtDate(f.promised_on) : ''}${f.promised_on && f.next_on ? ' · ' : ''}${f.next_on ? 'Next follow-up ' + fmtDate(f.next_on) : ''}</div></div>
        ${isManager() || f.created_by === me.id ? `<button type="button" class="link small danger-t" data-fdel="${f.id}">Remove</button>` : ''}</div>`).join('')}</div>`
      : '<p class="muted small">No follow-ups yet.</p>'}`;
  const m = modal(kind === 'task' ? 'Follow-up · client data' : 'Follow-up · payment', body, {
    saveText: 'Save follow-up', wide: true,
    onSave: async el => {
      const rec = { kind, on_date: fv(el, 'f_on') || today(), mode: fv(el, 'f_mode'), note: fv(el, 'f_note') || null,
        promised_on: fv(el, 'f_prom') || null, next_on: fv(el, 'f_next') || null, client_id: cid };
      if (kind === 'task') rec.task_id = task.id;
      await must(sb.from('followups').insert(rec));
      toast('Follow-up saved'); refresh();
    }
  });
  m.el.addEventListener('click', async e => {
    const id = e.target.dataset.fdel; if (!id || !confirm('Remove this follow-up entry?')) return;
    try { await must(sb.from('followups').delete().eq('id', id)); toast('Removed'); m.close(); refresh(); } catch (err) { toast(friendly(err), true); }
  });
}

/* =====================================================================
   STAFF WORKLOAD (manager and above)
   ===================================================================== */
let wlMonth = today().slice(0, 7);
VIEWS.workload = async v => {
  const [y, m] = wlMonth.split('-').map(Number);
  const mStart = iso(new Date(y, m - 1, 1)), mEnd = iso(new Date(y, m, 0)), t = today();
  const [open, month, fu] = await Promise.all([
    must(sb.from('tasks').select('id,assigned_to,due_date,status').not('status', 'in', '("Filed","Not applicable")').limit(10000)),
    must(sb.from('tasks').select('id,assigned_to,due_date,status,filed_on').gte('due_date', mStart).lte('due_date', mEnd).neq('status', 'Not applicable').limit(10000)),
    safe(sb.from('followups').select('created_by,kind').gte('on_date', mStart).lte('on_date', mEnd).limit(10000))
  ]);
  const O = open.data || [], M = month.data || [], F = fu.error ? null : fu.data || [];
  const people = activeStaff().map(p => p.id).concat(['']);
  const stat = id => {
    const mine = r => (r.assigned_to || '') === id;
    const o = O.filter(mine), mm = M.filter(mine), filed = mm.filter(r => r.status === 'Filed');
    const onTime = filed.filter(r => r.filed_on && r.due_date && r.filed_on <= r.due_date).length;
    return { id, open: o.length, overdue: o.filter(r => r.due_date && r.due_date < t).length, waiting: o.filter(r => r.status === 'Pending data').length,
      week: o.filter(r => r.due_date && r.due_date >= t && r.due_date <= iso(addDays(new Date(), 7))).length,
      month: mm.length, filed: filed.length, onTime, pct: filed.length ? Math.round(100 * onTime / filed.length) : null,
      fu: F ? F.filter(f => (f.created_by || '') === id).length : null };
  };
  const rows = people.map(stat).filter(s => s.id || s.open || s.month);
  const max = Math.max(1, ...rows.map(s => s.open));
  const tot = rows.reduce((a, s) => ({ open: a.open + s.open, overdue: a.overdue + s.overdue, month: a.month + s.month, filed: a.filed + s.filed }), { open: 0, overdue: 0, month: 0, filed: 0 });
  v.innerHTML = `<div class="page-head"><h2>Staff workload</h2><span class="spacer"></span>
      <label class="small">Month <input type="month" id="wlM" value="${esc(wlMonth)}"></label></div>
    <section class="bento-stats stats4" style="margin-bottom:16px">
      <div class="mini blue"><span>Open work (all)</span><b>${tot.open}</b></div>
      <div class="mini red"><span>Overdue now</span><b>${tot.overdue}</b></div>
      <div class="mini amber"><span>Due in ${MONTHS[m - 1]}</span><b>${tot.month}</b></div>
      <div class="mini green"><span>Filed (${MONTHS[m - 1]})</span><b>${tot.filed}</b></div></section>
    <div class="table-wrap"><table class="wl"><thead><tr><th>Staff</th><th style="min-width:180px">Open work now</th><th class="r">Overdue</th><th class="r">Waiting data</th><th class="r">Due 7 days</th>
      <th class="r">${MONTHS[m - 1]}: due</th><th class="r">Filed</th><th class="r">On time</th>${F ? '<th class="r">Follow-ups</th>' : ''}<th></th></tr></thead><tbody>
    ${rows.map(s => `<tr><td><b>${s.id ? esc(profName(s.id)) : '<span class="muted">Unassigned</span>'}</b>${s.id ? `<div class="muted small">${esc(ROLE_LABEL[(profiles.find(p => p.id === s.id) || {}).role] || '')}</div>` : ''}</td>
      <td><div class="wl-bar"><i style="width:${Math.round(100 * s.open / max)}%"></i><i class="od" style="width:${Math.round(100 * s.overdue / max)}%"></i></div><span class="small"><b>${s.open}</b> open</span></td>
      <td class="r ${s.overdue ? 'late' : ''}">${s.overdue}</td><td class="r">${s.waiting}</td><td class="r">${s.week}</td>
      <td class="r">${s.month}</td><td class="r">${s.filed}</td>
      <td class="r">${s.pct == null ? '—' : `<span class="pill ${s.pct >= 90 ? 'g' : s.pct >= 70 ? 'a' : 'r'}">${s.pct}%</span>`}</td>
      ${F ? `<td class="r">${s.fu}</td>` : ''}
      <td class="row-btns"><a class="btn sm" href="#/work" data-wls="${s.id || 'none'}">Open list</a></td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted small">Open work and overdue are as of today. “On time” = filed on or before the due date, for work due in the selected month. Follow-ups = calls / mails / WhatsApp logged in that month.</p>`;
  $('#wlM').onchange = e => { wlMonth = e.target.value || today().slice(0, 7); route(); };
  $$('[data-wls]', v).forEach(a => a.onclick = () => { wf = { ...WF_DEFAULT, staff: a.dataset.wls }; });
  countUp(v);
};

/* =====================================================================
   LATE FEE & INTEREST CALCULATOR
   ===================================================================== */
const CR = 1e7;
// GST late fee (Sec 47 + relief notifications) and interest (Sec 50, 18% p.a.)
function gstLateFee({ ret, nil, turnover, due, filed }) {
  const days = Math.max(0, daysFrom(due, filed));
  let perDay, cap, note = '';
  if (ret === 'GSTR-9') {
    const t = num(turnover);
    perDay = t <= 5 * CR ? 50 : t <= 20 * CR ? 100 : 200;
    cap = t > 0 ? Math.round(t * (t <= 20 * CR ? 0.0004 : 0.005)) : Infinity;
    note = 'FY 2022-23 onwards: ₹50 / ₹100 / ₹200 a day by turnover, capped at 0.04% (0.5% above ₹20 Cr) of state turnover.';
  } else if (ret === 'GSTR-7') {
    perDay = nil ? 0 : 50; cap = nil ? 0 : 2000; note = 'Nil GSTR-7: no late fee.';
  } else if (ret === 'GSTR-4') {
    perDay = 50; cap = nil ? 500 : 2000;
  } else if (ret === 'CMP-08') {
    perDay = 0; cap = 0; note = 'CMP-08 has no late fee — only interest.';
  } else {                                     // GSTR-3B / GSTR-1 / IFF
    const t = num(turnover);
    perDay = nil ? 20 : 50;
    cap = nil ? 500 : t > 5 * CR ? 10000 : t > 1.5 * CR ? 5000 : 2000;
  }
  const fee = Math.min(days * perDay, cap);
  return { days, perDay, cap, fee, cgst: fee / 2, sgst: fee / 2, note };
}
const gstInterest = (tax, from, to, rate = 18) => { const d = Math.max(0, daysFrom(from, to)); return { days: d, amount: Math.round(num(tax) * rate / 100 * d / 365) }; };
// TDS: months = calendar months touched (part of a month counts as a full month)
const monthsSpan = (a, b) => { if (!a || !b || b <= a) return 0; const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1) + 1; };
const tdsDepositDue = deducted => { if (!deducted) return ''; const [y, m] = deducted.split('-').map(Number); return m === 3 ? `${y}-04-30` : iso(new Date(y, m, 7)); };
function tdsCalc({ amount, deductible, deducted, deposited, stmtDue, stmtFiled }) {
  const a = num(amount);
  const m1 = deducted && deductible && deducted > deductible ? monthsSpan(deductible, deducted) : 0;
  const depDue = tdsDepositDue(deducted || deductible);
  const m2 = deposited && depDue && deposited > depDue ? monthsSpan(deducted || deductible, deposited) : 0;
  const lateDays = stmtDue && stmtFiled ? Math.max(0, daysFrom(stmtDue, stmtFiled)) : 0;
  const fee = Math.min(lateDays * 200, a || Infinity);
  return { m1, i1: Math.round(a * 0.01 * m1), depDue, m2, i2: Math.round(a * 0.015 * m2), lateDays, fee: lateDays ? fee : 0 };
}
// MCA / ROC additional fee
const ROC_NORMAL = [[1e5, 200], [5e5, 300], [25e5, 400], [1e7, 500], [Infinity, 600]];
const LLP_NORMAL = [[1e5, 50], [5e5, 100], [1e6, 150], [25e5, 200], [1e7, 400], [Infinity, 600]];
const slabFee = (table, cap, upTo = false) => (table.find(([lim]) => upTo ? num(cap) <= lim : num(cap) < lim) || table[table.length - 1])[1];   // company: 'below' slabs · LLP: 'up to' slabs
const bandMult = (days, bands) => { for (const [lim, x] of bands) if (days <= lim) return x; return bands[bands.length - 1][1]; };
function rocCalc({ form, capital, due, filed, fy, llpSmall }) {
  const days = Math.max(0, daysFrom(due, filed));
  let normal = 0, add = 0, note = '';
  if (form === 'DIR-3 KYC') { add = days ? 5000 : 0; note = 'Flat ₹5,000 when filed late (or to reactivate a DIN).'; }
  else if (form === 'LLP Form 8' || form === 'LLP Form 11') {
    normal = slabFee(LLP_NORMAL, capital, true);
    const bands = llpSmall ? [[0, 0], [15, 1], [30, 2], [60, 4], [90, 6], [180, 10], [360, 15]] : [[0, 0], [15, 1], [30, 4], [60, 8], [90, 12], [180, 20], [360, 30]];
    const x = days ? bandMult(days, bands) : 0;
    add = normal * x + (days > 360 ? (days - 360) * (llpSmall ? 10 : 20) : 0);
    note = `${llpSmall ? 'Small LLP' : 'LLP'}: ${x}× normal fee${days > 360 ? ' + ₹' + (llpSmall ? 10 : 20) + ' a day beyond 360 days' : ''}.`;
  } else {
    normal = slabFee(ROC_NORMAL, capital);
    if (['AOC-4', 'MGT-7', 'MGT-7A'].includes(form)) {
      add = days * 100; note = '₹100 a day of delay (no upper limit).';
      const waiver = fy === '2025-26' && ((form === 'AOC-4' && filed <= '2026-12-31') || (form !== 'AOC-4' && filed <= '2027-01-31'));
      if (waiver && days) { add = 0; note = 'MCA General Circular 05/2026: FY 2025-26 ' + (form === 'AOC-4' ? 'AOC-4 filed by 31 Dec 2026' : 'MGT-7 / 7A filed by 31 Jan 2027') + ' — no additional fee.'; }
    } else {
      const bands = form === 'ADT-1' ? [[0, 0], [15, 1], [30, 2], [60, 4], [90, 6], [180, 10], [Infinity, 12]] : [[0, 0], [30, 2], [60, 4], [90, 6], [180, 10], [Infinity, 12]];
      const x = days ? bandMult(days, bands) : 0;
      add = normal * x; note = `${x}× normal fee for ${days} day${days === 1 ? '' : 's'} late.`;
    }
  }
  return { days, normal, add, total: normal + add, note };
}

let calcTab = 'gst';
VIEWS.calc = async v => {
  const fyNow = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return y; })();
  const fys = [0, 1, 2, 3].map(k => `${fyNow - k}-${String((fyNow - k + 1) % 100).padStart(2, '0')}`);
  const forms = {
    gst: `<div class="form-grid">
      <label>Return<select name="ret">${opts(['GSTR-3B', 'GSTR-1', 'IFF', 'GSTR-4', 'GSTR-7', 'GSTR-9', 'CMP-08'], 'GSTR-3B')}</select></label>
      <label class="check" style="align-self:end"><input type="checkbox" name="nil"> Nil return</label>
      <label>Aggregate turnover (₹)<input name="turn" type="number" min="0" placeholder="e.g. 20000000"><span class="muted small" data-turnw></span></label>
      <label>Due date<input type="date" name="due"></label>
      <label>Filed / filing on<input type="date" name="filed" value="${today()}"></label>
      <label>Tax paid in cash late (₹)<input name="tax" type="number" min="0" placeholder="for interest"></label>
      <label>Tax paid on<input type="date" name="paid" value="${today()}"></label></div>`,
    tds: `<div class="form-grid">
      <label>TDS / TCS amount (₹)<input name="amt" type="number" min="0"></label>
      <label>Date tax was deductible<input type="date" name="dble"><span class="muted small">payment / credit date</span></label>
      <label>Date actually deducted<input type="date" name="dted"></label>
      <label>Date deposited<input type="date" name="dep" value="${today()}"></label>
      <label>Statement (24Q / 26Q …) due date<input type="date" name="sdue"></label>
      <label>Statement filed on<input type="date" name="sfil"></label></div>`,
    roc: `<div class="form-grid">
      <label>Form<select name="form">${opts(['AOC-4', 'MGT-7', 'MGT-7A', 'ADT-1', 'DIR-12', 'MGT-14', 'PAS-3', 'DPT-3', 'INC-22', 'CHG-4', 'Other company form', 'LLP Form 8', 'LLP Form 11', 'DIR-3 KYC'], 'AOC-4')}</select></label>
      <label>Financial year<select name="fy">${opts(fys, fys[1])}</select></label>
      <label><span data-caplab>Nominal share capital (₹)</span><input name="cap" type="number" min="0" placeholder="e.g. 100000"></label>
      <label class="check" style="align-self:end" data-llp hidden><input type="checkbox" name="small" checked> Small LLP</label>
      <label>Due date<input type="date" name="due"></label>
      <label>Filed / filing on<input type="date" name="filed" value="${today()}"></label></div>`
  };
  v.innerHTML = `<div class="page-head"><h2>Late fee & interest calculator</h2></div>
    <div class="seg" style="margin-bottom:16px">${[['gst', 'GST'], ['tds', 'TDS / TCS'], ['roc', 'MCA / ROC']].map(([k, l]) => `<button data-ct="${k}" class="${calcTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="calc-grid"><div class="card" id="calcIn">${forms[calcTab]}</div>
      <div class="card calc-out" id="calcOut"></div></div>
    <p class="muted small">Indicative figures based on the rules in force (checked Nov 2026): GST Sec 47 relief notifications &amp; Sec 50 (18% p.a.); TDS ₹200/day statement fee capped at the tax, interest 1% / 1.5% a month (part month = full month);
      MCA additional-fee rules incl. General Circular 05/2026. The portal's own figure is final — check for any new waiver before advising a client.</p>`;
  $$('[data-ct]', v).forEach(b => b.onclick = () => { calcTab = b.dataset.ct; route(); });
  const box = $('#calcIn', v), out = $('#calcOut', v);
  const line = (l, val, strong) => `<div class="calc-line ${strong ? 'tot' : ''}"><span>${l}</span><b>${val}</b></div>`;
  const words = n => num(n) >= 1e7 ? ` (${(num(n) / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr)` : num(n) >= 1e5 ? ` (${(num(n) / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh)` : '';
  const calc = () => {
    const g = n => fv(box, n), ck = n => !!($(`[name="${n}"]`, box) || {}).checked;
    if (calcTab === 'gst') {
      $('[data-turnw]', box).textContent = num(g('turn')) ? '₹' + num(g('turn')).toLocaleString('en-IN') + words(g('turn')) : '';
      if (!g('due')) { out.innerHTML = '<p class="muted">Enter the due date to see the late fee.</p>'; return; }
      const r = gstLateFee({ ret: g('ret'), nil: ck('nil'), turnover: g('turn'), due: g('due'), filed: g('filed') || today() });
      const it = num(g('tax')) ? gstInterest(g('tax'), g('due'), g('paid') || today()) : null;
      out.innerHTML = `<h3 style="margin-top:0">${esc(g('ret'))}${ck('nil') ? ' (nil)' : ''}</h3>
        ${line('Days late', r.days)}${line('Late fee per day', r.perDay ? inr(r.perDay) + ' (CGST ' + inr(r.perDay / 2) + ' + SGST ' + inr(r.perDay / 2) + ')' : '—')}
        ${line('Maximum late fee', isFinite(r.cap) ? inr(r.cap) : 'enter turnover')}
        ${line('Late fee', inr(r.fee) + (r.fee ? ` <span class="muted small">= CGST ${inr(r.cgst)} + SGST ${inr(r.sgst)}</span>` : ''), true)}
        ${it ? line(`Interest 18% × ${it.days} days on ${inr(g('tax'))}`, inr(it.amount)) + line('Total to pay (fee + interest)', inr(r.fee + it.amount), true) : ''}
        ${r.note ? `<p class="muted small">${esc(r.note)}</p>` : ''}${!ck('nil') && ['GSTR-3B', 'GSTR-1', 'IFF'].includes(g('ret')) && !num(g('turn')) ? '<p class="muted small">No turnover entered — using the ₹2,000 cap (turnover up to ₹1.5 Cr).</p>' : ''}
        <p class="muted small">Late fee is paid in cash only (not from ITC). Interest = tax × 18% × days ÷ 365.</p>`;
    }
    if (calcTab === 'tds') {
      const r = tdsCalc({ amount: g('amt'), deductible: g('dble'), deducted: g('dted'), deposited: g('dep'), stmtDue: g('sdue'), stmtFiled: g('sfil') });
      if (!num(g('amt'))) { out.innerHTML = '<p class="muted">Enter the TDS amount and dates.</p>'; return; }
      out.innerHTML = `<h3 style="margin-top:0">TDS / TCS</h3>
        ${line('Late deduction — 1% × ' + r.m1 + ' month' + (r.m1 === 1 ? '' : 's'), inr(r.i1))}
        ${line(`Late deposit — 1.5% × ${r.m2} month${r.m2 === 1 ? '' : 's'}${r.depDue ? ' <span class="muted small">(due ' + fmtDate(r.depDue) + ')</span>' : ''}`, inr(r.i2))}
        ${line('Interest total', inr(r.i1 + r.i2), true)}
        ${line(`Late statement fee — ₹200 × ${r.lateDays} days`, inr(r.fee) + (r.lateDays * 200 > num(g('amt')) ? ' <span class="muted small">(capped at TDS)</span>' : ''))}
        ${line('Total (interest + fee)', inr(r.i1 + r.i2 + r.fee), true)}
        <p class="muted small">Deposit due: 7th of next month (30 April for March). Interest must be paid before filing the statement. A further penalty (₹10,000 – ₹1 lakh) can apply if the statement is over a year late.</p>`;
    }
    if (calcTab === 'roc') {
      const f = g('form'), llp = /^LLP/.test(f);
      $('[data-llp]', box).hidden = !llp;
      $('[data-caplab]', box).textContent = llp ? 'Total contribution (₹)' : 'Nominal share capital (₹)';
      if (!g('due')) { out.innerHTML = '<p class="muted">Enter the due date to see the fee.</p>'; return; }
      const r = rocCalc({ form: f, capital: g('cap'), due: g('due'), filed: g('filed') || today(), fy: g('fy'), llpSmall: ck('small') });
      out.innerHTML = `<h3 style="margin-top:0">${esc(f)}</h3>
        ${line('Days late', r.days)}${r.normal ? line('Normal filing fee', inr(r.normal)) : ''}
        ${line('Additional (late) fee', inr(r.add))}${line('Total MCA fee', inr(r.total), true)}
        <p class="muted small">${esc(r.note)}</p>
        ${['AOC-4', 'MGT-7', 'MGT-7A'].includes(f) ? '<p class="muted small">Separate penalties can apply for long delays (Sec 137 / 92: ₹10,000 + ₹100 a day, up to ₹2 lakh for the company).</p>' : ''}`;
    }
  };
  box.addEventListener('input', calc); box.addEventListener('change', calc); calc();
};


/* =====================================================================
   CLIENT PORTAL LOGINS (GST / TDS / MCA ...) - passwords live in Supabase Vault
   ===================================================================== */
const GOV_PORTALS = [
  ['GST', 'https://services.gst.gov.in/services/login'],
  ['E-way bill', 'https://ewaybillgst.gov.in/'],
  ['E-invoice (IRP)', 'https://einvoice1.gst.gov.in/'],
  ['TRACES (TDS)', 'https://www.tdscpc.gov.in/app/login.xhtml'],
  ['Income Tax e-filing', 'https://eportal.incometax.gov.in/iec/foservices/#/login'],
  ['MCA V3', 'https://www.mca.gov.in/content/mca/global/en/foportal/fologin.html'],
  ['EPFO (employer)', 'https://unifiedportal-emp.epfindia.gov.in/epfo/'],
  ['ESIC', 'https://portal.esic.gov.in/EmployerPortal/ESICInsurance1/HomePageEmployer.aspx'],
  ['Professional Tax', ''], ['Bank / net banking', ''], ['Other', '']
];
const portalUrlFor = (p, url) => url || (GOV_PORTALS.find(x => x[0] === p) || [])[1] || '';
const portalIcon = p => /GST|E-way|E-invoice/.test(p) ? wtIcon('GST', 16) : /TRACES/.test(p) ? wtIcon('TDS', 16) : /MCA/.test(p) ? wtIcon('ROC/MCA', 16) : wtIcon('Other', 16);
// 12 characters, always upper + lower + digit + symbol; no look-alike characters (O/0, l/1/I).
// Fits GST (8-15), TRACES, Income Tax (8-14) and MCA password rules.
function strongPassword(len = 12) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&*!'];
  const all = sets.join(''), r = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const out = sets.map(s => s[r(s.length)]);
  while (out.length < len) out.push(all[r(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = r(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}
function copySecret(text, msg = 'Copied') {
  const done = () => toast(msg + ' — paste it within a minute');
  if (navigator.clipboard) return navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  fallback();
  function fallback() { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy', true); } t.remove(); }
}

async function openLogins(c) {
  if (!c) return;
  const m = modal(`Portal logins · ${c.name}`, `<div data-lg><div class="loading">Loading…</div></div>`, { wide: true,
    extra: (isAdmin() ? '<button class="btn ghost" data-lglog>Access log</button>' : '') + '<button class="btn primary" data-lgadd>+ Add login</button>' });
  const box = $('[data-lg]', m.el);
  let rows = [];
  const load = async () => {
    const r = await safe(sb.from('client_logins').select('*').eq('client_id', c.id).order('portal'));
    if (r.error) { box.innerHTML = '<p class="note">Portal logins are not set up yet — run <b>update-portal-logins.sql</b> in Supabase.</p>'; return; }
    rows = r.data || [];
    const old = d => d && daysFrom(d) > 180;
    box.innerHTML = `<p class="muted small" style="margin-top:0">🔒 Passwords are encrypted and hidden. Every <b>Show</b> or <b>Copy</b> is recorded with your name and time.</p>` +
      (rows.length ? `<div class="lg-list">${rows.map(l => { const url = portalUrlFor(l.portal, l.url); return `<div class="lg-card" data-id="${l.id}">
        <div class="lg-top"><span class="lg-portal">${portalIcon(l.portal)} ${esc(l.portal)}</span>${url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open portal ↗</a>` : ''}</div>
        <div class="lg-row"><span class="muted small">Login ID</span><code>${esc(l.login_id)}</code><button type="button" class="btn sm ghost" data-cpid="${l.id}">Copy</button></div>
        <div class="lg-row"><span class="muted small">Password</span><code data-pw="${l.id}">${l.secret_id ? '••••••••••' : '<span class="muted">not saved</span>'}</code>
          ${l.secret_id ? `<button type="button" class="btn sm ghost" data-show="${l.id}">Show</button><button type="button" class="btn sm ghost" data-cppw="${l.id}">Copy</button>` : ''}</div>
        ${l.otp_contact ? `<div class="lg-row"><span class="muted small">OTP goes to</span><span>${esc(l.otp_contact)}</span></div>` : ''}
        ${l.notes ? `<div class="lg-row"><span class="muted small">Notes</span><span class="small">${esc(l.notes)}</span></div>` : ''}
        <div class="lg-foot"><span class="muted small ${old(l.pw_changed_on) ? 'late' : ''}">${l.pw_changed_on ? `Password set ${fmtDate(l.pw_changed_on)}${old(l.pw_changed_on) ? ' · over 6 months old' : ''}` : ''}${l.updated_by ? ` · by ${esc(profName(l.updated_by))}` : ''}</span><span class="spacer"></span>
          <button type="button" class="btn sm" data-lged="${l.id}">Edit / change password</button>${isManager() ? `<button type="button" class="link small danger-t" data-lgdel="${l.id}">Delete</button>` : ''}</div></div>`; }).join('')}</div>`
      : '<div class="empty">No logins saved for this client yet.</div>');
  };
  const reveal = async (id, action) => { const { data, error } = await sb.rpc('login_reveal', { p_id: id, p_action: action }); if (error) { toast(friendly(error), true); return null; } return data; };
  box.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.cpid) copySecret(rows.find(r => r.id === d.cpid).login_id, 'Login ID copied');
    if (d.show) {
      const el = $(`[data-pw="${d.show}"]`, box);
      if (b.textContent === 'Hide') { el.textContent = '••••••••••'; b.textContent = 'Show'; return; }
      b.disabled = true; const pw = await reveal(d.show, 'view'); b.disabled = false;
      if (pw == null) return;
      el.textContent = pw; b.textContent = 'Hide';
      setTimeout(() => { if (el.isConnected) { el.textContent = '••••••••••'; b.textContent = 'Show'; } }, 20000);
    }
    if (d.cppw) { b.disabled = true; const pw = await reveal(d.cppw, 'copy'); b.disabled = false; if (pw != null) copySecret(pw, 'Password copied'); }
    if (d.lged) editLogin(c, rows.find(r => r.id === d.lged), load);
    if (d.lgdel) {
      const l = rows.find(r => r.id === d.lgdel);
      if (!confirm(`Delete the ${l.portal} login "${l.login_id}"? The saved password is erased permanently.`)) return;
      try { await must(sb.rpc('login_delete', { p_id: l.id })); toast('Login deleted'); load(); } catch (err) { toast(friendly(err), true); }
    }
  });
  $('[data-lgadd]', m.el).onclick = () => editLogin(c, null, load);
  if ($('[data-lglog]', m.el)) $('[data-lglog]', m.el).onclick = () => loginLog(c);
  load();
}

function editLogin(c, l, done) {
  const isNew = !l; l = l || { portal: 'GST' };
  const pOpts = GOV_PORTALS.map(x => x[0]).concat(GOV_PORTALS.some(x => x[0] === l.portal) ? [] : [l.portal]);
  const m = modal(isNew ? `Add login · ${c.name}` : `Edit login · ${l.portal}`, `<div class="form-grid">
      <label>Portal<select name="lp">${opts(pOpts, l.portal)}</select></label>
      <label>Login ID / user name<input name="li" value="${esc(l.login_id || '')}" autocomplete="off" spellcheck="false" placeholder="${esc(c.gstin || c.tan || c.pan || '')}"></label>
      <label class="full">${isNew ? 'Password' : 'New password <span class="muted small">(leave empty to keep the current one)</span>'}
        <div class="pw-wrap"><input name="pw" type="password" autocomplete="new-password" spellcheck="false" maxlength="200">
          <button type="button" class="btn sm ghost" data-eye>Show</button><button type="button" class="btn sm" data-gen>Generate strong</button></div>
        <span class="muted small" data-pwhint></span></label>
      <label>OTP goes to (mobile / email)<input name="lo" value="${esc(l.otp_contact || '')}"></label>
      <label>Portal link <span class="muted small">(optional)</span><input name="lu" value="${esc(l.url || '')}" placeholder="${esc(portalUrlFor(l.portal) || 'https://')}"></label>
      <label class="full">Notes <span class="muted small">(no passwords here)</span><input name="ln" value="${esc(l.notes || '')}" placeholder="e.g. Primary authorised signatory: Mr. Kumar"></label>
    </div>`, {
    saveText: isNew ? 'Save login' : 'Save changes',
    onSave: async el => {
      const pw = $('[name=pw]', el).value;
      if (!fv(el, 'li')) { toast('Enter the login ID', true); return false; }
      if (isNew && !pw && !confirm('Save without a password?')) return false;
      await must(sb.rpc('login_save', { p_id: isNew ? null : l.id, p_client: c.id, p_portal: fv(el, 'lp'), p_login: fv(el, 'li'),
        p_password: pw || null, p_url: fv(el, 'lu') || null, p_otp: fv(el, 'lo') || null, p_notes: fv(el, 'ln') || null }));
      toast(isNew ? 'Login saved (password encrypted)' : pw ? 'Password changed' : 'Saved'); done();
    }
  });
  const el = m.el, pw = $('[name=pw]', el), hint = $('[data-pwhint]', el);
  const rate = () => { const v = pw.value; if (!v) { hint.textContent = ''; return; }
    const ok = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(rx => rx.test(v)).length;
    hint.textContent = v.length >= 8 && v.length <= 15 && ok === 4 ? '✓ Strong — meets GST / TRACES / MCA rules' : 'Portals need 8–15 characters with upper case, lower case, a number and a symbol';
    hint.className = 'small ' + (v.length >= 8 && v.length <= 15 && ok === 4 ? 'ok-t' : 'late'); };
  pw.oninput = rate;
  $('[name=lp]', el).onchange = e => { $('[name=lu]', el).placeholder = portalUrlFor(e.target.value) || 'https://'; };
  $('[data-eye]', el).onclick = e => { pw.type = pw.type === 'password' ? 'text' : 'password'; e.target.textContent = pw.type === 'password' ? 'Show' : 'Hide'; };
  $('[data-gen]', el).onclick = () => { pw.value = strongPassword(); pw.type = 'text'; $('[data-eye]', el).textContent = 'Hide'; rate();
    toast('Set this same password on the portal first, then save here'); };
}

async function loginLog(c) {
  let q = sb.from('login_access_log').select('*').order('at', { ascending: false }).limit(300);
  if (c) q = q.eq('client_id', c.id);
  const r = await safe(q);
  if (r.error) return toast(friendly(r.error), true);
  const rows = r.data || [];
  modal(c ? `Access log · ${c.name}` : 'Portal login access log', rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th>${c ? '' : '<th>Client</th>'}<th>Portal</th><th>Action</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td class="small">${new Date(x.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(profName(x.user_id) || '—')}</td>${c ? '' : `<td class="wrap">${esc(x.client_id ? clientName(x.client_id) : '—')}</td>`}
      <td>${esc(x.portal || '')}</td><td><span class="badge ${/copy|view/.test(x.action) ? '' : 'lg-act'}">${esc(x.action)}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No activity yet.</div>', { wide: true });
}


/* =====================================================================
   GST REVIEW ENGINE - file parsing + summary maths (pure functions)
   Row shape (short keys): { g: GSTIN, n: party, i: invoice no, d: date, t: taxable, ig, cg, sg, cs: taxes,
                             v: invoice value, cn: true for credit note (amounts already negative), rc: reverse charge,
                             na: ITC not available (2B), src: section }
   ===================================================================== */
const GR = (() => {
  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const amt = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v).trim(); const neg = /^\(.*\)$/.test(s);
    s = s.replace(/[₹,\s()]/g, '').replace(/^-+$/, '');
    const x = parseFloat(s); return isFinite(x) ? (neg ? -Math.abs(x) : x) : 0;
  };
  const normInv = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '');
  const digits = s => String(s ?? '').replace(/\D/g, '').replace(/^0+(?=.)/, '');
  const gstinOk = g => /^[0-9]{2}[A-Z0-9]{13}$/.test(g || '');
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const p2 = n => String(n).padStart(2, '0');
  function toDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; }
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${p2(m[2])}-${p2(m[1])}`; }
    m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{2,4})$/); if (m && MON[m[2].toLowerCase()]) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${p2(MON[m[2].toLowerCase()])}-${p2(m[1])}`; }
    return s;
  }
  // ---------- header detection for registers / portal Excel ----------
  const H = s => String(s ?? '').toLowerCase().replace(/₹|\(rs\.?\)|\(inr\)|\(₹\)/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const FIELDS = [   // [key, exact aliases, contains-words]
    ['ig', ['igst', 'integrated tax', 'igst amount', 'igst amt', 'integrated tax amount'], ['integrated tax', 'igst']],
    ['cg', ['cgst', 'central tax', 'cgst amount', 'cgst amt', 'central tax amount'], ['central tax', 'cgst']],
    ['sg', ['sgst', 'sgst/utgst', 'state/ut tax', 'state tax', 'utgst', 'sgst amount', 'sgst amt', 'state/ut tax amount'], ['state/ut tax', 'sgst', 'utgst', 'state tax']],
    ['cs', ['cess', 'cess amount', 'compensation cess'], ['cess']],
    ['t', ['taxable value', 'taxable amount', 'taxable', 'assessable value', 'taxable val'], ['taxable']],
    ['v', ['invoice value', 'total', 'total amount', 'gross total', 'bill amount', 'invoice amount', 'note value', 'note value '], ['invoice value', 'gross total', 'note value', 'invoice amount']],
    ['d', ['invoice date', 'date', 'voucher date', 'bill date', 'doc date', 'document date', 'note date', 'inv date'], ['invoice date', 'note date', 'voucher date', 'bill date']],
    ['i', ['invoice number', 'invoice no', 'invoice no ', 'inv no', 'voucher no', 'vch no', 'bill no', 'document no', 'doc no', 'note number', 'note no', 'invoice', 'voucher number', 'bill number', 'supplier invoice no'], ['invoice number', 'invoice no', 'note number', 'voucher no', 'bill no', 'document number']],
    ['g', ['gstin', 'gstin/uin', 'gstin uin', 'party gstin', 'customer gstin', 'supplier gstin', 'gstin of supplier', 'gst no', 'gstin no', 'gstin/uin of recipient', 'gstin of party'], ['gstin']],
    ['n', ['party name', 'customer name', 'supplier name', 'name', 'particulars', 'party', 'trade/legal name', 'legal name', 'trade name', 'ledger name', 'receiver name'], ['trade/legal name', 'party name', 'supplier name', 'customer name']],
    ['ty', ['type', 'document type', 'voucher type', 'invoice type', 'note type', 'doc type'], ['note type', 'voucher type', 'document type']],
    ['rc', ['reverse charge', 'supply attract reverse charge', 'rcm'], ['reverse charge']],
    ['na', ['itc availability', 'itc available'], ['itc availability']]
  ];
  function mapHeader(cells) {
    const h = cells.map(H), used = new Set(), map = {};
    for (const [k, ex, cont] of FIELDS) {
      let ix = h.findIndex((x, j) => !used.has(j) && ex.includes(x));
      if (ix < 0) ix = h.findIndex((x, j) => !used.has(j) && x && cont.some(w => x.includes(w)));
      if (ix >= 0) { map[k] = ix; used.add(ix); }
    }
    if (map.t == null) { const ix = h.findIndex((x, j) => !used.has(j) && x === 'value'); if (ix >= 0) { map.t = ix; used.add(ix); } }
    return map;
  }
  const score = m => (m.t != null) * 3 + (m.i != null) * 2 + ['ig', 'cg', 'sg', 'g', 'd'].filter(k => m[k] != null).length;
  // rows = array of arrays (first sheet). kind: 'sales' | 'purchases' | '2b'
  function parseTable(rows, { section = '' } = {}) {
    let best = null;
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const cells = (rows[r] || []).map((c, j) => { const above = r > 0 ? (rows[r - 1] || [])[j] : ''; return (c !== '' && c != null) ? c : above; });
      const m = mapHeader(cells), sc = score(m);
      if (!best || sc > best.sc) best = { r, m, sc };
    }
    if (!best || best.sc < 4) return { rows: [], error: 'Could not find the column headings (need at least Invoice no and Taxable value / tax columns).' };
    const m = best.m, out = [], get = (row, k) => m[k] == null ? '' : row[m[k]];
    for (let r = best.r + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const first = String(row.find(c => c !== '' && c != null) ?? '').toLowerCase();
      if (/^(grand )?total|^sub ?total/.test(first) || /^total/.test(String(get(row, 'n')).toLowerCase())) continue;
      let t = amt(get(row, 't')), ig = amt(get(row, 'ig')), cg = amt(get(row, 'cg')), sg = amt(get(row, 'sg')), cs = amt(get(row, 'cs')), v = amt(get(row, 'v'));
      if (!t && v && (ig || cg || sg)) t = v - ig - cg - sg - cs;
      if (!t && !ig && !cg && !sg && !cs) continue;
      const ty = String(get(row, 'ty')).toLowerCase(), cn = /credit|^c$|cr ?note|return/.test(ty) || /cdn/.test(section) && /^c/.test(ty);
      const sign = cn && t > 0 ? -1 : 1;
      out.push({ g: String(get(row, 'g') || '').trim().toUpperCase(), n: String(get(row, 'n') || '').trim(), i: String(get(row, 'i') ?? '').trim(), d: toDate(get(row, 'd')),
        t: r2(sign * t), ig: r2(sign * ig), cg: r2(sign * cg), sg: r2(sign * sg), cs: r2(sign * cs), v: r2(sign * Math.abs(v)),
        cn: cn || undefined, rc: /^y/i.test(String(get(row, 'rc'))) || undefined, na: /^n/i.test(String(get(row, 'na'))) || undefined, src: section || undefined });
    }
    return { rows: out, headerRow: best.r + 1, columns: Object.keys(m) };
  }
  // ---------- GSTR-2B JSON (portal download or API) ----------
  function parse2BJson(obj) {
    let root = obj; for (let k = 0; k < 3 && root && !root.docdata && root.data; k++) root = root.data;
    const dd = root && (root.docdata || root.docData);
    if (!dd) return { rows: [], error: 'This does not look like a GSTR-2B JSON file (no "docdata").' };
    const out = [], pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; return 0; };
    const taxes = o => { let t = amt(pick(o, 'txval')), ig = amt(pick(o, 'igst', 'iamt')), cg = amt(pick(o, 'cgst', 'camt')), sg = amt(pick(o, 'sgst', 'samt')), cs = amt(pick(o, 'cess', 'csamt'));
      const items = o.items || o.itms; if (!t && Array.isArray(items)) items.forEach(it => { const x = it.itm_det || it; t += amt(pick(x, 'txval')); ig += amt(pick(x, 'igst', 'iamt')); cg += amt(pick(x, 'cgst', 'camt')); sg += amt(pick(x, 'sgst', 'samt')); cs += amt(pick(x, 'cess', 'csamt')); });
      return { t, ig, cg, sg, cs }; };
    const add = (sup, doc, sec, num, neg) => { const x = taxes(doc), s = neg ? -1 : 1;
      out.push({ g: String(sup.ctin || '').toUpperCase(), n: sup.trdnm || '', i: String(num ?? ''), d: toDate(doc.dt || doc.ntdt || doc.boedt), t: r2(s * x.t), ig: r2(s * x.ig), cg: r2(s * x.cg), sg: r2(s * x.sg), cs: r2(s * x.cs),
        v: r2(s * amt(doc.val)), cn: neg || undefined, rc: /^y/i.test(doc.rev || '') || undefined, na: /^n/i.test(doc.itcavl || '') || undefined, src: sec }); };
    const arr = k => Array.isArray(dd[k]) ? dd[k] : Array.isArray(dd[k.toUpperCase()]) ? dd[k.toUpperCase()] : [];
    arr('b2b').forEach(s => (s.inv || []).forEach(v => add(s, v, 'B2B', v.inum)));
    arr('b2ba').forEach(s => (s.inv || []).forEach(v => add(s, v, 'B2BA', v.inum || v.oinum)));
    for (const k of ['cdnr', 'cdnra']) arr(k).forEach(s => (s.nt || []).forEach(v => add(s, v, k.toUpperCase(), v.ntnum || v.nt_num, /^c/i.test(v.typ || v.ntty || 'C'))));
    arr('isd').forEach(s => (s.doclist || s.inv || []).forEach(v => add(s, v, 'ISD', v.docnum || v.inum, /^c/i.test(v.doctyp || ''))));
    for (const k of ['impg', 'impgsez']) arr(k).forEach(v => add({ ctin: v.ctin || 'IMPORT', trdnm: v.trdnm || 'Import of goods' }, v, k.toUpperCase(), v.boenum));
    return { rows: out, period: root.rtnprd || '', gstin: root.gstin || '' };
  }
  // ---------- totals ----------
  const Z = () => ({ t: 0, ig: 0, cg: 0, sg: 0, cs: 0 });
  const sum = (rows, f = () => true) => rows.filter(f).reduce((a, x) => { a.t += x.t || 0; a.ig += x.ig || 0; a.cg += x.cg || 0; a.sg += x.sg || 0; a.cs += x.cs || 0; return a; }, Z());
  const fix = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r2(v)]));
  const tax = o => r2((o.ig || 0) + (o.cg || 0) + (o.sg || 0) + (o.cs || 0));
  // ITC set-off (Sec 49 / 49A / Rule 88A): IGST credit first (IGST, then CGST/SGST where short), then CGST->CGST/IGST, SGST->SGST/IGST
  function setoff(L0, C0) {
    const L = { ig: Math.max(0, L0.ig), cg: Math.max(0, L0.cg), sg: Math.max(0, L0.sg), cs: Math.max(0, L0.cs) };
    const C = { ig: Math.max(0, C0.ig), cg: Math.max(0, C0.cg), sg: Math.max(0, C0.sg), cs: Math.max(0, C0.cs) };
    const used = { ig: Z(), cg: Z(), sg: Z(), cs: Z() };        // used[creditHead][liabHead]
    const use = (from, to, cap = Infinity) => { const a = Math.min(C[from], L[to], cap); if (a > 0) { C[from] -= a; L[to] -= a; used[from][to] += a; } };
    use('ig', 'ig');
    const shortC = Math.max(0, L.cg - C.cg), shortS = Math.max(0, L.sg - C.sg);
    use('ig', 'cg', shortC); use('ig', 'sg', shortS); use('ig', 'cg'); use('ig', 'sg');
    use('cg', 'cg'); use('cg', 'ig'); use('sg', 'sg'); use('sg', 'ig'); use('cs', 'cs');
    return { cash: fix(L), balance: fix(C), used: Object.fromEntries(Object.entries(used).map(([k, v]) => [k, fix(v)])) };
  }
  // ---------- 2B vs books ----------
  // one line per document (registers and portal Excel often have one line per item / tax rate)
  function mergeDocs(rows) {
    const m = new Map(), out = [];
    rows.forEach(r => { const k = r.g + '|' + normInv(r.i) + '|' + (r.cn ? 'C' : 'I') + '|' + (r.src || '');
      if (!normInv(r.i)) { out.push({ ...r }); return; }
      const x = m.get(k); if (!x) { const c = { ...r }; m.set(k, c); out.push(c); return; }
      for (const f of ['t', 'ig', 'cg', 'sg', 'cs']) x[f] = r2((x[f] || 0) + (r[f] || 0));
      if (Math.abs(r.v || 0) > Math.abs(x.v || 0)) x.v = r.v; x.na = x.na && r.na || undefined; });
    return out;
  }
  function reconcile(books, b2, tol = 10) {
    books = mergeDocs(books); b2 = mergeDocs(b2);
    const key = r => r.g + '|' + normInv(r.i), dkey = r => r.g + '|' + digits(r.i);
    const idx = new Map(), didx = new Map();
    b2.forEach((r, j) => { if (r.src && /IMP/.test(r.src)) return; idx.set(key(r), j); if (digits(r.i)) didx.set(dkey(r), j); });
    const hit = new Set(), out = [];
    books.forEach(b => {
      let j = idx.get(key(b)), how = 'exact';
      if (j == null || hit.has(j)) { j = didx.get(dkey(b)); how = 'loose'; }
      if (j == null || hit.has(j)) { out.push({ st: 'books_only', b }); return; }
      hit.add(j); const x = b2[j], diff = r2(tax(b) - tax(x)), tdiff = r2((b.t || 0) - (x.t || 0));
      out.push({ st: Math.abs(diff) <= tol && Math.abs(tdiff) <= Math.max(tol, 1) ? (x.na ? 'not_avail' : 'matched') : 'mismatch', b, x, diff, tdiff, how });
    });
    b2.forEach((x, j) => { if (!hit.has(j) && !(x.src && /IMP|ISD/.test(x.src))) out.push({ st: '2b_only', x }); });
    const groups = {}; out.forEach(o => { const g = groups[o.st] = groups[o.st] || { n: 0, tax: 0 }; g.n++; g.tax = r2(g.tax + tax(o.b || o.x)); });
    return { items: out, groups };
  }
  // ---------- full summary ----------
  function summarise(m) {
    const SA = (m.sales && m.sales.rows) || [], S = SA.filter(r => !r.nil), P = (m.purchases && m.purchases.rows) || [], B = (m.gstr2b && m.gstr2b.rows) || [];
    const nilOut = fix(sum(SA, r => r.nil && r.nil !== 'Non-GST')), nonGst = fix(sum(SA, r => r.nil === 'Non-GST'));
    const out = fix(sum(S)), outB2B = fix(sum(S, r => gstinOk(r.g))), outB2C = fix(sum(S, r => !gstinOk(r.g)));
    const itc2b = fix(sum(B, r => !r.na && !r.rc)), blocked = fix(sum(B, r => r.na)), rcm2b = fix(sum(B, r => r.rc && !r.na));
    const itcBooks = fix(sum(P, r => !r.rc)), rcmBooks = fix(sum(P, r => r.rc));
    const has2b = B.length > 0, itcBase = has2b ? itc2b : itcBooks;
    const rcm = has2b ? rcm2b : rcmBooks;
    // RCM: tax is paid in cash, and the same amount becomes ITC
    const liab = { ig: out.ig + rcm.ig, cg: out.cg + rcm.cg, sg: out.sg + rcm.sg, cs: out.cs + rcm.cs };
    const credit = { ig: itcBase.ig + rcm.ig, cg: itcBase.cg + rcm.cg, sg: itcBase.sg + rcm.sg, cs: itcBase.cs + rcm.cs };
    const so = setoff({ ig: out.ig, cg: out.cg, sg: out.sg, cs: out.cs }, credit);
    const cash = fix({ ig: so.cash.ig + rcm.ig, cg: so.cash.cg + rcm.cg, sg: so.cash.sg + rcm.sg, cs: so.cash.cs + rcm.cs });
    const rec = has2b && P.length ? reconcile(P, B) : null;
    const g1 = m.gstr1 || null, g3 = m.gstr3b || null, checks = [];
    const cmp = (label, a, b) => { if (!a || !b) return; const d = r2(tax(a) - tax(b)), dt = r2((a.t || 0) - (b.t || 0)); checks.push({ label, a: fix({ t: a.t || 0, tax: tax(a) }), b: fix({ t: b.t || 0, tax: tax(b) }), dt, d, ok: Math.abs(d) <= 1 && Math.abs(dt) <= 1 }); };
    const t31 = g3 && g3.t31a ? g3.t31a : null;
    if (S.length) { cmp('Books (sales register) vs GSTR-1', out, g1); cmp('Books (sales register) vs GSTR-3B 3.1(a)', out, t31); }
    cmp('GSTR-1 vs GSTR-3B 3.1(a)', g1, t31);
    if (g3 && g3.itc_net && has2b) cmp('GSTR-2B ITC vs GSTR-3B ITC claimed', itc2b, { t: itc2b.t, ...g3.itc_net });
    return { out, outB2B, outB2C, nilOut, nonGst, itc2b, blocked, rcm, itcBooks, itcBase, has2b, liab: fix(liab), setoff: so, cash, cashTotal: tax(cash), rec, checks,
      counts: { sales: SA.length, purchases: P.length, b2b: B.length },
      trend: { sales: out.t, outTax: tax(out), itc: tax(itcBase), cash: g3 && g3.cash ? tax(g3.cash) : tax(cash), filedCash: g3 && g3.cash ? true : false } };
  }
  return { amt, normInv, toDate, mapHeader, parseTable, parse2BJson, mergeDocs, setoff, reconcile, summarise, tax, gstinOk, r2 };
})();

/* =====================================================================
   GSTR-2B RECONCILIATION  - decisions, carry-forward, supplier follow-up, IMS
   ===================================================================== */
const RECO = (() => {
  const { r2, tax, normInv, mergeDocs } = GR;
  const TOL = 10;                                                               // ₹10 per document = rounding
  const dig = s => String(s ?? '').replace(/\D/g, '').replace(/^0+(?=.)/, '');
  const keyOf = d => `${(d && d.g) || ''}|${normInv(d && d.i)}`;
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = p => p ? `${MN[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}` : '';
  const DEC = {
    mismatch: [['acc2b', 'Claim as per 2B'], ['accbooks', 'Supplier to amend — follow up'], ['reject', 'Wrong document — reject in IMS'], ['ignore', 'Known difference — claim as per 2B']],
    books_only: [['follow', 'Follow up supplier'], ['later', 'Supplier filing late — claim when in 2B'], ['noclaim', 'Do not claim (ineligible / reversed)']],
    '2b_only': [['addbooks', 'Missed in books — add & claim'], ['notours', 'Not our purchase — reject in IMS'], ['hold', 'Keep pending — check with client']]
  };
  const decLabel = (st, a) => ((DEC[st] || []).find(o => o[0] === a) || [])[1] || '';
  // last date to claim ITC (Sec 16(4)): 30 November after the end of the financial year
  const deadline = p => { const y = +p.slice(0, 4), m = +p.slice(5, 7); return `${m >= 4 ? y + 1 : y}-11-30`; };

  // suggested IMS action for a 2B document
  function ims(it, d) {
    const x = it.x, a = d && d.a; if (!x) return null;
    if (x.rc) return { a: 'NA', why: 'Reverse charge — not in IMS' };
    if (/IMP|ISD/.test(x.src || '')) return { a: 'NA', why: 'Import / ISD — not in IMS' };
    if (it.st === 'matched') return { a: 'Accept', why: 'Matches books' };
    if (it.st === 'not_avail') return { a: 'Accept', why: 'Matches books — ITC not available, do not claim' };
    if (it.st === 'carried') return { a: 'Accept', why: `Booked in ${monthName(it.from)}` };
    if (it.st === 'mismatch') return a === 'acc2b' || a === 'ignore' ? { a: 'Accept', why: 'Difference accepted' }
      : a === 'reject' ? { a: 'Reject', why: 'Wrong document' } : { a: 'Pending', why: a === 'accbooks' ? 'Waiting for supplier to amend' : 'Decide on the difference first' };
    if (it.st === '2b_only') return a === 'addbooks' ? { a: 'Accept', why: 'Missed in books' } : a === 'notours' ? { a: 'Reject', why: 'Not our purchase' }
      : { a: 'Pending', why: a === 'hold' ? 'Checking with client' : 'Not in books — decide' };
    return null;
  }

  // invoices in books but missing from 2B in earlier months: did they come in a later 2B?
  function carry(hist, cur) {
    // per month: the 2B documents that did not match that month's own books (only those can belong to an earlier month)
    const seq = [...(hist || []), cur].map(m => { const P = (m.purchases || {}).rows || [], B = ((m.gstr2b || {}).rows || []).filter(x => !/IMP|ISD/.test(x.src || ''));
      return { p: m.period, B: P.length ? GR.reconcile(P, B, TOL).items.filter(it => it.st === '2b_only').map(it => it.x) : mergeDocs(B) }; });
    const last = seq.length - 1, usedNow = new Map(), out = { now: [], missing: [], cleared: [] };
    (hist || []).forEach((m, hi) => {
      const P = (m.purchases || {}).rows || [], B = (m.gstr2b || {}).rows || []; if (!P.length || !B.length) return;
      const dec = (m.reco || {}).dec || {};
      GR.reconcile(P, B, TOL).items.filter(it => it.st === 'books_only' && !it.b.rc).forEach(it => {
        const k = keyOf(it.b), d = dec[k] || {}; if (d.a === 'noclaim') return;
        let found = null;
        for (let j = hi + 1; j <= last && !found; j++) {
          const xi = seq[j].B.findIndex((x, n) => x.g === it.b.g && !!x.cn === !!it.b.cn && (normInv(x.i) === normInv(it.b.i) || (dig(x.i) && dig(x.i) === dig(it.b.i))) && !(j === last && usedNow.has(n)));
          if (xi >= 0) found = { j, xi, x: seq[j].B[xi] };
        }
        const e = { b: it.b, from: m.period, k, note: d.note || '', a: d.a || '', deadline: deadline(m.period) };
        if (!found) out.missing.push(e);
        else if (found.j === last) { usedNow.set(found.xi, e); out.now.push({ ...e, x: found.x }); }
        else out.cleared.push({ ...e, x: found.x, in: seq[found.j].p });
      });
    });
    out.nowByKey = new Map([...usedNow].map(([n, e]) => [keyOf(seq[last].B[n]), e]));
    return out;
  }

  // apply carry-forward to this month's items and add keys
  function items(rec, cf) {
    return rec.items.map(it => {
      const k = keyOf(it.b || it.x);
      if (it.st === '2b_only' && cf && cf.nowByKey.has(k)) { const e = cf.nowByKey.get(k); return { ...it, st: 'carried', k, from: e.from, eb: e.b }; }
      return { ...it, k };
    });
  }
  function groups(list) { const G = {}; list.forEach(it => { const g = G[it.st] = G[it.st] || { n: 0, tax: 0 }; g.n++; g.tax = r2(g.tax + tax(it.b || it.x)); }); return G; }

  // ITC to claim this month after the decisions
  function claim(list, dec, b2rows) {
    const Z = () => ({ t: 0, ig: 0, cg: 0, sg: 0, cs: 0 }), add = (a, o) => { for (const f in a) a[f] = r2(a[f] + ((o && o[f]) || 0)); };
    const c = Z(), held = Z(), carried = Z(), other = Z(), undecided = [];
    list.forEach(it => {
      const a = (dec[it.k] || {}).a, x = it.x, b = it.b;
      if ((x && x.rc) || (b && b.rc)) return;                                  // reverse charge — cash, see draft 3B
      if (it.st === 'matched') add(c, x);
      else if (it.st === 'carried') { add(c, x); add(carried, x); }
      else if (it.st === 'mismatch') {
        if (!a) undecided.push(it);
        if (a === 'reject') add(held, x);
        else if (a === 'acc2b' || a === 'ignore') add(c, x);
        else add(c, Math.abs(tax(b)) <= Math.abs(tax(x)) ? b : x);             // until decided: the lower of books and 2B
      } else if (it.st === '2b_only') { if (!a) undecided.push(it); if (a === 'addbooks') add(c, x); else add(held, x); }
      else if (it.st === 'books_only') add(held, b);
    });
    (b2rows || []).forEach(x => { if (/IMP|ISD/.test(x.src || '') && !x.na && !x.rc) add(other, x); });
    add(c, other);
    return { claim: c, held, carried, other, undecided };
  }

  // suppliers to chase, with their documents
  function suppliers(list, dec, cf) {
    const m = new Map();
    const add = (b, why, extra = {}) => { const g = b.g || '—', s = m.get(g) || { g, n: '', docs: [], tax: 0 }; s.docs.push({ ...b, why, ...extra }); s.tax = r2(s.tax + tax(b)); if (!s.n && b.n) s.n = b.n; m.set(g, s); };
    list.forEach(it => { const a = (dec[it.k] || {}).a;
      if (it.st === 'books_only' && !it.b.rc && (!a || a === 'follow')) add(it.b, 'missing');
      if (it.st === 'mismatch' && a === 'accbooks') add(it.b, 'differs', { x2: it.x }); });
    ((cf && cf.missing) || []).forEach(e => { if (!e.a || e.a === 'follow' || e.a === 'later') add(e.b, 'missing', { from: e.from }); });
    return [...m.values()].sort((a, b) => b.tax - a.tax);
  }
  function message(s, client, period) {
    const inr = n => '₹' + Math.round(Math.abs(n || 0)).toLocaleString('en-IN');
    const dmy = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('-') : (d || '');
    const miss = s.docs.some(d => d.why === 'missing'), diff = s.docs.some(d => d.why === 'differs');
    const lines = s.docs.map((d, i) => `${i + 1}. ${d.cn ? 'Credit note' : 'Invoice'} ${d.i}${d.d ? ' dated ' + dmy(d.d) : ''} – taxable ${inr(d.t)}, GST ${inr(tax(d))}`
      + (d.why === 'differs' ? ` (your GSTR-1 shows GST ${inr(tax(d.x2))})` : d.from && d.from !== period ? ` (pending since ${monthName(d.from)})` : ''));
    const head = miss && diff ? `The following documents need your attention (checked against our GSTR-2B for ${monthName(period)}):`
      : miss ? `The following documents issued by you are not reflecting in our GSTR-2B up to ${monthName(period)}:`
      : `The following documents appear in your GSTR-1 with a different amount from the invoice:`;
    return `Dear ${s.n || 'Sir/Madam'},\n\nGreetings from ${client.name}${client.gstin ? ` (GSTIN ${client.gstin})` : ''}.\n\n${head}\n\n${lines.join('\n')}\n\nTotal GST: ${inr(s.tax)}\n\n`
      + `Kindly ${diff ? 'file / amend' : 'file'} ${s.docs.length > 1 ? 'them' : 'it'} in your GSTR-1 / IFF at the earliest so that we can take the input tax credit.\n\nThank you,\n${client.name}`;
  }
  return { TOL, DEC, decLabel, keyOf, ims, carry, items, groups, claim, suppliers, message, monthName, deadline };
})();

/* =====================================================================
   CLIENT MAIL INBOX  (#/inbox)  - attachments emailed by clients, picked up every minute
   ===================================================================== */
const MAIL_KIND = { sales: ['Sales register', 'g'], purchases: ['Purchase register', 'g'], gstr2b: ['GSTR-2B', 'g'], excel: ['Excel', 'b'], json: ['JSON', 'b'],
  pdf: ['PDF', 'a'], image: ['Photo', 'a'], tally: ['Tally', 'b'], zip: ['Zip', 'a'], file: ['File', 'a'] };
let inboxFilter = 'New', pendingGstImport = null;
async function mailNewCount() {
  const r = await safe(sb.from('mail_inbox').select('id', { count: 'exact', head: true }).eq('status', 'New'));
  return r.error ? 0 : r.count || 0;
}
async function refreshMailBadge() {
  const b = $('#mailBadge'); if (!b) return;
  const n = await mailNewCount(); b.hidden = !n; $('b', b).textContent = n;
  const sm = $('#sideMail'); if (sm) { sm.hidden = !n; sm.textContent = n; }
}
const monthLbl = p => p ? `${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}` : '';
async function openMailFile(path, asFile) {
  const { data, error } = await sb.storage.from('client-docs').createSignedUrl(path, 120, { download: !asFile });
  if (error) throw error;
  if (!asFile) { window.open(data.signedUrl, '_blank', 'noopener'); return null; }
  const r = await fetch(data.signedUrl); if (!r.ok) throw new Error('Could not download the file');
  return new File([await r.blob()], path.split('/').pop().replace(/^[^-]+-\d+-/, ''));
}

VIEWS.inbox = async v => {
  const r = await safe(sb.from('mail_inbox').select('*').order('received_at', { ascending: false }).limit(300));
  if (r.error) { v.innerHTML = '<div class="card"><p class="note">Client mail is not set up yet — run <b>update-mail-intake.sql</b> in Supabase.</p></div>'; return; }
  const all = r.data || [], tasksById = {};
  const ids = [...new Set(all.flatMap(m => m.task_ids || []))];
  if (ids.length) { const t = await safe(sb.from('tasks').select('id,return_name,period,status').in('id', ids)); (t.data || []).forEach(x => tasksById[x.id] = x); }
  const n = k => all.filter(m => k === 'All' || m.status === k).length;
  const draw = () => {
    const list = all.filter(m => inboxFilter === 'All' || m.status === inboxFilter);
    v.innerHTML = `<div class="page-head"><h2>Client mail</h2><span class="spacer"></span>
        <div class="seg">${['New', 'Done', 'Ignored', 'All'].map(k => `<button data-mf="${k}" class="${inboxFilter === k ? 'on' : ''}">${k} · ${n(k)}</button>`).join('')}</div></div>
      <p class="muted small" style="margin:-6px 0 14px">Attachments that clients email to the office mailbox appear here within about a minute. The month's “Pending data” work is marked as received automatically.</p>
      ${list.length ? list.map(m => { const c = clientById(m.client_id) || { name: 'Client' }, ts = (m.task_ids || []).map(id => tasksById[id]).filter(Boolean);
        return `<div class="card mail" data-mail="${m.id}">
          <div class="mail-h"><div><b>${esc(c.name)}</b> <span class="muted small">· ${esc(m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email)}</span>
            <div class="mail-sub">${esc(m.subject || '(no subject)')}</div></div><span class="spacer"></span>
            <div class="mail-meta"><span class="muted small">${new Date(m.received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span class="pill ${m.period_guess ? 'a' : 'b'} small" title="${m.period_guess ? 'Month not in the subject — taken as the month before the mail' : 'Month read from the subject / file name'}">${monthLbl(m.period)}${m.period_guess ? ' (assumed)' : ''}</span></div></div>
          ${m.snippet ? `<div class="mail-snip muted small">${esc(m.snippet.slice(0, 220))}${m.snippet.length > 220 ? '…' : ''}</div>` : ''}
          <div class="mail-files">${(m.files || []).map((f, i) => `<div class="mail-file"><span class="pill ${MAIL_KIND[f.kind] ? MAIL_KIND[f.kind][1] : 'a'} small">${(MAIL_KIND[f.kind] || ['File'])[0]}</span>
            <span class="mail-fn">${esc(f.name)}</span><span class="muted small">${Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
            <button class="btn sm" data-dl="${i}">Download</button>${['pdf', 'image'].includes(f.kind) && c.gstin ? `<button class="btn sm primary" data-rb="${i}" title="Read this bill into the purchase register">Read bill</button>` : ''}${['sales', 'purchases', 'gstr2b', 'excel', 'json'].includes(f.kind) && c.gstin ? `<button class="btn sm primary" data-imp="${i}">Import to GST review</button>` : ''}</div>`).join('')}</div>
          <div class="mail-foot">${ts.length ? `<span class="small">✓ Marked data received: ${ts.map(t => `<a href="#/work" class="tag-link">${esc(t.return_name)} · ${esc(t.period)}</a>`).join(', ')}</span>`
            : `<span class="small muted">No “Pending data” work found for ${monthLbl(m.period)} — mark it on the work item if needed.</span>`}
            <span class="spacer"></span>${m.status !== 'Done' ? '<button class="btn sm" data-st="Done">✓ Done</button>' : ''}${m.status === 'New' ? '<button class="btn sm ghost" data-st="Ignored">Ignore</button>' : ''}${m.status !== 'New' ? '<button class="btn sm ghost" data-st="New">Back to new</button>' : ''}</div>
          ${m.status !== 'New' && m.handled_by ? `<div class="muted tiny">${esc(m.status)} by ${esc(profName(m.handled_by) || '')} · ${new Date(m.handled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>` : ''}</div>`; }).join('')
        : `<div class="card"><div class="empty">${inboxFilter === 'New' ? 'No new client mail 🎉' : 'Nothing here.'}</div></div>`}`;
  };
  draw();
  v.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mf) { inboxFilter = b.dataset.mf; draw(); return; }
    const box = b.closest('[data-mail]'); if (!box) return;
    const m = all.find(x => x.id === box.dataset.mail);
    try {
      if (b.dataset.dl) await openMailFile(m.files[+b.dataset.dl].path, false);
      if (b.dataset.st) {
        const patch = { status: b.dataset.st, handled_by: b.dataset.st === 'New' ? null : me.id, handled_at: b.dataset.st === 'New' ? null : new Date().toISOString() };
        await must(sb.from('mail_inbox').update(patch).eq('id', m.id)); Object.assign(m, patch); draw(); refreshMailBadge();
      }
      if (b.dataset.rb) {
        const bf = (m.files || []).filter(x => ['pdf', 'image'].includes(x.kind));
        const all = bf.length > 1 && confirm(`This mail has ${bf.length} PDF / photo files.\n\nOK = read all ${bf.length} as bills\nCancel = only ${m.files[+b.dataset.rb].name}`);
        b.disabled = true; b.textContent = 'Opening…';
        const files = await Promise.all((all ? bf : [m.files[+b.dataset.rb]]).map(x => openMailFile(x.path, true)));
        pendingGstImport = { client: m.client_id, month: m.period.slice(0, 7), kind: 'bills', files, mailId: m.id };
        grClient = m.client_id; grMonth = m.period.slice(0, 7); grTab = 'recon';
        location.hash = '#/gst';
      }
      if (b.dataset.imp) {
        const f = m.files[+b.dataset.imp];
        let kind = ['sales', 'purchases', 'gstr2b'].includes(f.kind) ? f.kind : null;
        if (!kind) kind = await new Promise(res => { const md = modal('What is this file?', `<p class="small" style="margin-top:0">${esc(f.name)}</p><div class="seg">${[['sales', 'Sales register'], ['purchases', 'Purchase register'], ['gstr2b', 'GSTR-2B']].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join('')}</div>`);
          md.el.addEventListener('click', ev => { const k = ev.target.closest('[data-k]'); if (k) { md.close(); res(k.dataset.k); } }); $$('[data-x]', md.el).forEach(x => x.addEventListener('click', () => res(null))); });
        if (!kind) return;
        b.disabled = true; b.textContent = 'Opening…';
        const file = await openMailFile(f.path, true);
        pendingGstImport = { client: m.client_id, month: m.period.slice(0, 7), kind, file, mailId: m.id };
        grClient = m.client_id; grMonth = m.period.slice(0, 7); grTab = kind === 'sales' ? 'draft' : 'recon';
        location.hash = '#/gst';
      }
    } catch (err) { toast(friendly(err), true); b.disabled = false; }
  };
};

/* ---------- Settings: client mail (admin) ---------- */
async function renderMailSettings(box) {
  const r = await safe(sb.rpc('mail_admin_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Client mail → tracker</h3><p class="note small">Run <b>update-mail-intake.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {};
  const when = t => t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<div class="card"><h3>Client mail → tracker</h3>
    <p class="muted">Attachments that clients email to the office mailbox are saved with the client and their “Pending data” work for that month is marked as received — within about a minute. Mail from addresses that are not saved on a client is ignored.</p>
    <div class="mail-stat"><span class="pill ${s.enabled && s.key_set ? 'g' : 'a'}">${s.enabled && s.key_set ? '● Running' : s.key_set ? 'Switched off' : 'Not set up'}</span>
      <span class="small">Last mail: <b>${when(s.last_mail_at)}</b> · Today: <b>${s.today || 0}</b> · Waiting: <b>${s.new || 0}</b></span></div>
    ${s.last_error ? `<p class="note warn small">Last problem: ${esc(s.last_error)}</p>` : ''}
    <div class="form-grid" style="margin-top:12px">
      <label>Office mailbox (for display)<input id="mlBox" value="${esc(s.mailbox || '')}" placeholder="e.g. data@yourfirm.in"></label>
      <label>Only mail whose subject has (optional)<input id="mlFilter" value="${esc(s.subject_filter || '')}" placeholder="e.g. DATA, GST — leave empty for all"></label></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="mlOn" ${s.enabled ? 'checked' : ''}> Switched on</label>
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" id="mlSave">Save</button><span class="spacer"></span>
      <button class="btn" id="mlKey">${s.key_set ? 'Make a new key' : 'Make the mailbox key'}</button><button class="btn" id="mlScript">Mailbox script &amp; steps</button></div>
    ${s.key_set ? `<p class="muted small">Key made ${when(s.key_set_at)}. Making a new key stops the old one — paste the new key in the mailbox script.</p>` : ''}</div>`;
  $('#mlSave', box).onclick = async () => {
    try { await must(sb.rpc('mail_admin_save', { p_enabled: $('#mlOn', box).checked, p_filter: $('#mlFilter', box).value, p_mailbox: $('#mlBox', box).value })); toast('Saved'); renderMailSettings(box); }
    catch (e) { toast(friendly(e), true); }
  };
  $('#mlKey', box).onclick = async () => {
    if (s.key_set && !confirm('Make a new key? The mailbox script will stop sending until you paste the new key into it.')) return;
    const bytes = crypto.getRandomValues(new Uint8Array(24)), key = 'jlr_' + [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(x => x.toString(16).padStart(2, '0')).join('');
    try { await must(sb.rpc('mail_admin_set_key', { p_hash: hash })); }
    catch (e) { return toast(friendly(e), true); }
    const m = modal('Mailbox key', `<p class="small" style="margin-top:0">Copy this key and paste it in the mailbox script (Project Settings → Script properties → <b>INTAKE_KEY</b>). <b>It is shown only once</b> — the tracker keeps only a fingerprint of it.</p>
      <div class="linkbox"><input readonly value="${esc(key)}" id="mlK"><button class="btn sm" id="mlCp">Copy</button></div>`);
    $('#mlCp', m.el).onclick = () => copySecret(key, 'Key copied');
    $$('[data-x]', m.el).forEach(x => x.addEventListener('click', () => renderMailSettings(box)));
  };
  $('#mlScript', box).onclick = async () => {
    let code = '';
    try { const rr = await fetch('mail-intake-apps-script.gs', { cache: 'no-store' }); code = rr.ok ? await rr.text() : ''; } catch (e) {}
    const m = modal('Connect the office mailbox', `<ol class="small steps">
        <li>Sign in to the office Gmail, open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com → New project</a>.</li>
        <li>Delete what is there, paste the script below, and click <b>Save</b>. Name it “JLR mail intake”.</li>
        <li>Click the gear (<b>Project Settings</b>) → <b>Script properties</b> → <b>Add</b>: name <b>INTAKE_KEY</b>, value = the key from “Make the mailbox key”.</li>
        <li>Back in the editor choose <b>setup</b> at the top and click <b>Run</b>. Allow the Gmail permission (it says “unverified app” because it is your own script — click Advanced → Go to JLR mail intake).</li>
        <li>Send a test mail with an attachment from a client's saved email address. It appears in <a href="#/inbox">Client mail</a> within a minute.</li></ol>
      ${code ? `<textarea readonly rows="14" class="code" id="mlCode">${esc(code)}</textarea>` : '<p class="note warn small">Script file not found on the site — upload mail-intake-apps-script.gs with the other files.</p>'}`,
      { wide: true, extra: code ? '<button class="btn" id="mlCpS">Copy script</button>' : '' });
    if (code) $('#mlCpS', m.el).onclick = () => copySecret(code, 'Script copied');
  };
}

/* =====================================================================
   GST REVIEW PAGE  (#/gst)  - data in, summary out, verify
   ===================================================================== */
async function loadXlsxFull() {
  if (window.XLSX && window.XLSX.__full) return window.XLSX;
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'xlsx.full.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Could not load the Excel reader')); document.head.appendChild(s); });
  window.XLSX.__full = true; return window.XLSX;
}
async function readSheets(file) {
  const X = await loadXlsxFull();
  const wb = /\.csv$/i.test(file.name) ? X.read(await file.text(), { type: 'string', raw: false }) : X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false });
  return wb.SheetNames.map(n => ({ name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }));
}
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); };
const periodToMonth = p => { const m = String(p || '').match(/([A-Za-z]{3})[a-z]*[\s-]+(\d{4})/); if (!m) return ''; const i = MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase()); return i < 0 ? '' : `${m[2]}-${pad(i + 1)}`; };
const gTax = o => GR.tax(o || {});
const gst$ = n => inr(Math.round(n || 0));
let grClient = '', grMonth = prevMonth(), grTab = 'g1', grRecFilter = 'books_only', grRecView = 'inv', grImsF = 'all';

VIEWS.gst = async v => {
  const gClients = clients.filter(c => c.active && c.gstin && (isManager() || c.default_staff === me.id || c.id === grClient));
  if (!grClient || !gClients.some(c => c.id === grClient)) grClient = (gClients[0] || {}).id || '';
  v.innerHTML = `<div class="page-head"><h2>GST review</h2><span class="spacer"></span>
      <select id="grC" aria-label="Client">${gClients.length ? opts(gClients, grClient, c => `${c.name} · ${c.gstin}`, c => c.id) : '<option value="">No GST clients</option>'}</select>
      <input type="month" id="grM" value="${esc(grMonth)}" aria-label="Return month"></div>
    <div id="grBody"><div class="loading">Loading…</div></div>`;
  $('#grC', v).onchange = e => { grClient = e.target.value; route(); };
  $('#grM', v).onchange = e => { grMonth = e.target.value || prevMonth(); route(); };
  const body = $('#grBody', v);
  if (!grClient) { body.innerHTML = '<div class="card"><p class="muted">Add a GSTIN to a client (Clients → Edit) to start.</p></div>'; return; }
  const c = clientById(grClient), period = grMonth + '-01';
  const r = await safe(sb.from('gst_months').select('*').eq('client_id', grClient).eq('period', period).maybeSingle());
  if (r.error) { body.innerHTML = '<div class="card"><p class="note">GST review is not set up yet — run <b>update-gst-review.sql</b> in Supabase.</p></div>'; return; }
  let row = r.data || { client_id: grClient, period, status: 'Draft' }, recoHist = null;
  const save = async patch => {
    const next = { ...row, ...patch };
    const sm = GR.summarise(next);
    patch.summary = { ...sm.trend, sales_n: sm.counts.sales, b2b_n: sm.counts.b2b, cash_draft: sm.cashTotal, cash: sm.cash, cash_total: sm.trend.cash, at: new Date().toISOString() };
    const { data } = await must(sb.from('gst_months').upsert({ client_id: grClient, period, ...patch }, { onConflict: 'client_id,period' }).select().single());
    row = data || { ...next, ...patch }; render();
  };
  const by = () => ({ at: new Date().toISOString(), by: me.id });
  const srcLine = d => d ? `<span class="muted small">${d.source === 'api' ? 'From GST portal' : d.file ? esc(d.file) : 'Entered'} · ${new Date(d.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${d.by ? ' · ' + esc(profName(d.by)) : ''}</span>` : '<span class="muted small">Not added</span>';
  const card = (k, title, d, info, btns) => `<div class="gr-src ${d ? 'ok' : ''}"><div class="gr-src-h"><span class="gr-dot" aria-hidden="true"></span><b>${title}</b></div>
      <div class="small">${info}</div>${srcLine(d)}<div class="gr-src-b">${btns}${d ? `<button class="link small danger-t" data-clr="${k}">Remove</button>` : ''}</div></div>`;

  function render() {
    const sm = GR.summarise(row), mLabel = (() => { const [y, m] = grMonth.split('-'); return `${MONTHS_FULL[+m - 1]} ${y}`; })();
    const S = row.sales, P = row.purchases, B = row.gstr2b, G3 = row.gstr3b, G1 = row.gstr1;
    body.innerHTML = `
      <div class="gr-status card"><div><b>${esc(c.name)}</b> · ${esc(c.gstin)} · <b>${mLabel}</b></div><span class="spacer"></span>
        ${row.status === 'Verified' ? `<span class="st st-filed">✓ Verified by ${esc(profName(row.verified_by) || '')} · ${row.verified_at ? new Date(row.verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>` : '<span class="st st-pending-data">Draft — not verified</span>'}
        <a class="btn sm" href="#/clientreport" data-crgo>Client report</a><button class="btn sm" data-portal-api>Fetch from GST portal</button></div>
      <div class="gr-srcs">
        ${card('sales', 'Sales register', S, S ? `${S.rows.length} documents · taxable ${gst$(sm.out.t)} · tax ${gst$(gTax(sm.out))}` : 'Type in the GSTR-1 entry tab, or upload an Excel / CSV / Tally export',
          `<button class="btn sm" data-up="sales">Upload</button><button class="link small" data-tpl="sales">Template</button>`)}
        ${card('purchases', 'Purchase register (books)', P, P ? `${P.rows.length} documents · ITC in books ${gst$(gTax(sm.itcBooks))}` : 'Purchases as per books, for the 2B match',
          `<button class="btn sm" data-up="purchases">Upload</button><button class="btn sm" data-bills title="PDF or photo bills: read and add to the purchase register">Read bills</button><button class="link small" data-tpl="purchases">Template</button>`)}
        ${card('gstr2b', 'GSTR-2B', B, B ? `${B.rows.length} documents · ITC available ${gst$(gTax(sm.itc2b))}${gTax(sm.blocked) ? ` · not available ${gst$(gTax(sm.blocked))}` : ''}` : 'Portal JSON or Excel download, or fetch with OTP',
          `<button class="btn sm" data-up="gstr2b">Upload JSON / Excel</button>`)}
        ${card('gstr3b', 'GSTR-3B (filed)', G3, G3 ? `3.1(a) taxable ${gst$(G3.t31a && G3.t31a.t)} · ITC ${gst$(gTax(G3.itc_net))} · cash ${gst$(gTax(G3.cash))}` : 'Filed figures — fetch or type in',
          `<button class="btn sm" data-ent="gstr3b">${G3 ? 'Edit' : 'Enter'} figures</button>`)}
        ${card('gstr1', 'GSTR-1 (filed)', G1, G1 ? `Taxable ${gst$(G1.t)} · tax ${gst$(gTax(G1))}` : 'Filed totals — type in from the GSTR-1 summary',
          `<button class="btn sm" data-ent="gstr1">${G1 ? 'Edit' : 'Enter'} totals</button>`)}
      </div>
      <div class="seg gr-tabs">${[['g1', 'GSTR-1 entry'], ['draft', 'Draft GSTR-3B'], ['recon', `GSTR-2B reco${sm.rec ? ` · ${(sm.rec.groups.books_only || {}).n || 0} missing` : ''}`], ['checks', `GSTR-1 vs 3B${sm.checks.some(x => !x.ok) ? ' ⚠' : ''}`], ['trend', 'Trend']].map(([k, l]) => `<button data-gt="${k}" class="${grTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="card" id="grOut"></div>
      <div class="card gr-verify"><label class="full">Review notes<textarea id="grNotes" rows="2" placeholder="e.g. Reversed ITC on 2 invoices missing in 2B; client informed">${esc(row.notes || '')}</textarea></label>
        <div class="toolbar" style="margin:8px 0 0"><button class="btn sm" id="grSaveNotes">Save notes</button><span class="spacer"></span>
        ${isManager() ? (row.status === 'Verified' ? '<button class="btn" id="grUnver">Back to draft</button>' : '<button class="btn primary" id="grVer">✓ Mark as verified</button>') : '<span class="muted small">A manager or partner marks this as verified.</span>'}</div></div>`;
    renderOut(sm);
  }
  function renderOut(sm) {
    if (grTab === 'g1') { renderG1($('#grOut', body), { client: c, getRow: () => row, save }); return; }
    const o = $('#grOut', body), row4 = (l, x, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="r">${gst$(x.t)}</td><td class="r">${gst$(x.ig)}</td><td class="r">${gst$(x.cg)}</td><td class="r">${gst$(x.sg)}</td><td class="r">${gst$(x.cs)}</td></tr>`;
    const th = '<thead><tr><th></th><th class="r">Taxable</th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Cess</th></tr></thead>';
    if (grTab === 'draft') {
      if (!sm.counts.sales && !sm.counts.b2b && !sm.counts.purchases) { o.innerHTML = '<p class="muted">Add the sales register and GSTR-2B (or the purchase register) to see the draft GSTR-3B working.</p>'; return; }
      const so = sm.setoff, G3 = row.gstr3b;
      o.innerHTML = `<h3 style="margin-top:0">Draft GSTR-3B working</h3>
        ${!sm.has2b ? '<p class="note warn small">GSTR-2B not added — ITC below is taken from the purchase register (books). Claim only what appears in 2B.</p>' : ''}
        <div class="table-wrap"><table class="gr-t">${th}<tbody>
          ${row4('3.1(a) Outward taxable supplies (sales register)', sm.out)}
          ${sm.out.t ? row4('&nbsp;&nbsp;· to registered (B2B)', sm.outB2B, 'sub') + row4('&nbsp;&nbsp;· to unregistered (B2C)', sm.outB2C, 'sub') : ''}
          ${sm.nilOut.t ? row4('3.1(c) Nil rated / exempted supplies', sm.nilOut) : ''}${sm.nonGst.t ? row4('3.1(e) Non-GST outward supplies', sm.nonGst) : ''}
          ${gTax(sm.rcm) ? row4('3.1(d) Inward supplies on reverse charge', sm.rcm) : ''}
          ${row4(`4(A)(5) ITC available ${sm.has2b ? '(GSTR-2B)' : '(books)'}`, sm.itcBase)}
          ${gTax(sm.blocked) ? row4('ITC not available in 2B (do not claim)', sm.blocked, 'warn-row') : ''}
        </tbody></table></div>
        <h4 class="gr-payh">Set-off &amp; cash payable <a class="btn sm" href="#/taxpay" data-tpfrom>Send payment intimation →</a></h4>
        <div class="table-wrap"><table class="gr-t"><thead><tr><th></th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Cess</th><th class="r">Total</th></tr></thead><tbody>
          <tr><td>Output tax</td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r">${gst$(sm.out[k])}</td>`).join('')}<td class="r">${gst$(gTax(sm.out))}</td></tr>
          <tr><td>Paid from ITC</td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r">${gst$(so.used.ig[k] + so.used.cg[k] + so.used.sg[k] + so.used.cs[k])}</td>`).join('')}<td class="r">${gst$(['ig', 'cg', 'sg', 'cs'].reduce((a, k) => a + so.used.ig[k] + so.used.cg[k] + so.used.sg[k] + so.used.cs[k], 0))}</td></tr>
          ${gTax(sm.rcm) ? `<tr><td>Reverse charge (cash only)</td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r">${gst$(sm.rcm[k])}</td>`).join('')}<td class="r">${gst$(gTax(sm.rcm))}</td></tr>` : ''}
          <tr class="tot"><td><b>Cash payable</b></td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r"><b>${gst$(sm.cash[k])}</b></td>`).join('')}<td class="r"><b>${gst$(sm.cashTotal)}</b></td></tr>
          <tr class="sub"><td>ITC carried forward</td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r">${gst$(so.balance[k])}</td>`).join('')}<td class="r">${gst$(gTax(so.balance))}</td></tr>
          ${G3 && G3.cash ? `<tr class="${Math.abs(gTax(G3.cash) - sm.cashTotal) > 1 ? 'warn-row' : ''}"><td>Cash paid in filed GSTR-3B</td>${['ig', 'cg', 'sg', 'cs'].map(k => `<td class="r">${gst$(G3.cash[k])}</td>`).join('')}<td class="r">${gst$(gTax(G3.cash))}</td></tr>` : ''}
        </tbody></table></div>
        <p class="muted small">Set-off follows Sec 49/49A and Rule 88A: IGST credit is used first (IGST, then CGST/SGST), then CGST and SGST credit. Opening balances in the credit ledger are not included — add them on the portal.</p>`;
    }
    if (grTab === 'recon') { renderReco(o, sm); return; }
    if (grTab === 'checks') {
      o.innerHTML = sm.checks.length ? `<div class="table-wrap"><table><thead><tr><th>Check</th><th class="r">Taxable (A)</th><th class="r">Taxable (B)</th><th class="r">Tax (A)</th><th class="r">Tax (B)</th><th class="r">Tax difference</th><th></th></tr></thead><tbody>
        ${sm.checks.map(x => `<tr class="${x.ok ? '' : 'warn-row'}"><td>${esc(x.label)}</td><td class="r">${gst$(x.a.t)}</td><td class="r">${gst$(x.b.t)}</td><td class="r">${gst$(x.a.tax)}</td><td class="r">${gst$(x.b.tax)}</td><td class="r"><b>${gst$(x.d)}</b></td><td>${x.ok ? '<span class="pill g">OK</span>' : '<span class="pill r">Check</span>'}</td></tr>`).join('')}
        </tbody></table></div><p class="muted small">Differences of ₹1 or less are treated as rounding. A = first item in the check, B = second.</p>`
        : '<p class="muted">Add at least two of: sales register, GSTR-1 totals, GSTR-3B figures.</p>';
    }
    if (grTab === 'trend') renderTrend(o);
  }
  // ===== GSTR-2B reconciliation tab =====
  async function renderReco(o, sm) {
    if (!sm.rec) { o.innerHTML = '<p class="muted">Add both the purchase register and GSTR-2B to match invoices.</p>'; return; }
    if (!recoHist) {
      o.innerHTML = '<div class="loading">Checking earlier months…</div>';
      const from = new Date(period + 'T00:00:00'); from.setMonth(from.getMonth() - 18);
      const r = await safe(sb.from('gst_months').select('period,purchases,gstr2b,reco').eq('client_id', grClient).gte('period', iso(from)).lt('period', period).order('period'));
      recoHist = r.error ? [] : (r.data || []);
      if (grTab !== 'recon') return;
    }
    const dec = (row.reco && row.reco.dec) || {}, fu = (row.reco && row.reco.fu) || {};
    const cf = RECO.carry(recoHist, row), list = RECO.items(sm.rec, cf), G = RECO.groups(list);
    const cl = RECO.claim(list, dec, row.gstr2b.rows), sup = RECO.suppliers(list, dec, cf);
    const imsRows = list.map(it => ({ it, s: RECO.ims(it, dec[it.k]) })).filter(z => z.s && z.s.a !== 'NA');
    const imsN = a => imsRows.filter(z => z.s.a === a).length;
    const L = { matched: ['Matched', 'green'], mismatch: ['Amount differs', 'amber'], books_only: ['In books, not in 2B', 'red'], '2b_only': ['In 2B, not in books', 'blue'],
      not_avail: ['ITC not available', 'amber'], carried: ['Earlier month, now in 2B', 'green'], cf_missing: ['Earlier months, still missing', 'red'] };
    G.cf_missing = { n: cf.missing.length, tax: GR.r2(cf.missing.reduce((a, e) => a + gTax(e.b), 0)) };
    if (!L[grRecFilter]) grRecFilter = 'books_only';
    const dt = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? fmtDate(d) : esc(d || '');
    const pill = a => `<span class="ims ims-${a.toLowerCase()}">${a}</span>`;
    const decCell = it => { const opts2 = RECO.DEC[it.st]; if (!opts2) return ''; const d = dec[it.k] || {};
      return `<select data-dec="${esc(it.k)}" class="reco-dec ${d.a ? 'set' : ''}" aria-label="Decision"><option value="">— decide —</option>${opts2.map(([v, l]) => `<option value="${v}" ${d.a === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input data-note="${esc(it.k)}" class="reco-note" value="${esc(d.note || '')}" placeholder="Note" aria-label="Note">${d.by ? `<div class="muted tiny">${esc(profName(d.by) || '')} · ${new Date(d.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>` : ''}`; };
    const box = (l, v, cls = '') => `<div class="rc-b ${cls}"><small>${l}</small><b>${gst$(v)}</b></div>`;

    o.innerHTML = `
      <div class="rc-sum">${box('ITC available in GSTR-2B', gTax(sm.itc2b))}${box('ITC to claim (after decisions)', gTax(cl.claim), 'ok')}${box('Not claimable this month', gTax(cl.held), 'bad')}
        ${box('From earlier months, now in 2B', gTax(cl.carried), 'ok')}${box('Earlier months, still missing', G.cf_missing.tax, G.cf_missing.n ? 'bad' : '')}</div>
      ${cl.undecided.length ? `<p class="note warn small" style="margin:10px 0 0">${cl.undecided.length} document${cl.undecided.length > 1 ? 's need' : ' needs'} a decision (amount differs / not in books). Until then the lower of books and 2B is counted, and 2B-only documents are held back.</p>` : ''}
      <div class="toolbar" style="margin:14px 0 10px"><div class="seg">${[['inv', 'Invoices'], ['sup', `Supplier follow-up · ${sup.length}`], ['ims', `IMS actions · ${imsN('Pending')} pending`]].map(([k, l]) => `<button data-rv="${k}" class="${grRecView === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="spacer"></span><button class="btn sm" id="grXl">Download reco (Excel)</button></div>
      <div id="rcBody"></div>
      <p class="muted small">A difference of up to ₹${RECO.TOL} per document is treated as rounding and counted as matched.</p>`;
    const rb = $('#rcBody', o);

    if (grRecView === 'inv') {
      const rows = grRecFilter === 'cf_missing' ? [] : list.filter(x => x.st === grRecFilter);
      rb.innerHTML = `<div class="gr-groups">${Object.entries(L).map(([k, [l, col]]) => `<button class="mini ${col} ${grRecFilter === k ? 'sel' : ''}" data-rf="${k}"><span>${l}</span><b>${(G[k] || {}).n || 0}</b><small>${gst$((G[k] || {}).tax || 0)} tax</small></button>`).join('')}</div>
        <h4 style="margin:14px 0 8px">${L[grRecFilter][0]}</h4>
        <div class="table-wrap">${grRecFilter === 'cf_missing' ? (cf.missing.length ? `<table><thead><tr><th>Supplier</th><th>Invoice</th><th>Date</th><th class="r">Taxable</th><th class="r">Tax</th><th>Booked in</th><th>Last date to claim</th><th>Note</th></tr></thead><tbody>
          ${cf.missing.map(e => `<tr><td class="wrap"><b>${esc(e.b.n || '')}</b><div class="muted small">${esc(e.b.g)}</div></td><td>${esc(e.b.i)}</td><td class="small">${dt(e.b.d)}</td><td class="r">${gst$(e.b.t)}</td><td class="r">${gst$(gTax(e.b))}</td>
            <td>${RECO.monthName(e.from)}</td><td class="${e.deadline < iso(new Date(Date.now() + 60 * 864e5)) ? 'late' : ''}">${fmtDate(e.deadline)}</td><td class="small">${esc(e.note || RECO.decLabel('books_only', e.a))}</td></tr>`).join('')}</tbody></table>
          <p class="muted small">To stop tracking one, open that month and choose “Do not claim”.</p>` : '<div class="empty">Nothing pending from earlier months.</div>')
        : rows.length ? `<table class="reco-t"><thead><tr><th>Supplier</th><th>Invoice</th><th>Date</th><th class="r">Taxable</th><th class="r">Tax (books)</th><th class="r">Tax (2B)</th><th class="r">Difference</th><th>IMS</th>${RECO.DEC[grRecFilter] ? '<th>Decision</th>' : ''}</tr></thead><tbody>
          ${rows.slice(0, 500).map(x => { const d = x.b || x.x, s = RECO.ims(x, dec[x.k]); return `<tr><td class="wrap"><b>${esc(d.n || (x.x && x.x.n) || '')}</b><div class="muted small">${esc(d.g)}</div></td>
            <td>${esc(x.b ? x.b.i : x.x.i)}${x.how === 'loose' ? `<div class="muted small">2B: ${esc(x.x.i)}</div>` : ''}${x.st === 'carried' ? `<div class="muted small">Booked in ${RECO.monthName(x.from)}</div>` : ''}${d.cn ? ' <span class="badge">Credit note</span>' : ''}</td><td class="small">${dt(d.d)}</td>
            <td class="r">${gst$(d.t)}</td><td class="r">${x.b ? gst$(gTax(x.b)) : x.eb ? gst$(gTax(x.eb)) : '—'}</td><td class="r">${x.x ? gst$(gTax(x.x)) : '—'}</td><td class="r ${x.diff ? 'late' : ''}">${x.diff != null ? gst$(x.diff) : ''}</td>
            <td>${s ? (s.a === 'NA' ? '<span class="muted small">—</span>' : pill(s.a)) : ''}</td>${RECO.DEC[grRecFilter] ? `<td class="reco-dc">${decCell(x)}</td>` : ''}</tr>`; }).join('')}
          </tbody></table>${rows.length > 500 ? '<p class="muted small">Showing first 500 — download Excel for all.</p>' : ''}` : '<div class="empty">Nothing in this group.</div>'}</div>`;
      $$('[data-rf]', rb).forEach(b => b.onclick = () => { grRecFilter = b.dataset.rf; renderReco(o, sm); });
      $$('[data-dec]', rb).forEach(s => s.onchange = () => saveDec(s.dataset.dec, { a: s.value }));
      $$('[data-note]', rb).forEach(i => i.onchange = () => saveDec(i.dataset.note, { note: i.value.trim() }));
    }

    if (grRecView === 'sup') {
      rb.innerHTML = sup.length ? `<p class="muted small" style="margin-top:0">Suppliers whose documents are missing from 2B (this month and earlier months), or who must amend an amount. Open the message, check it, and send it from your own WhatsApp or email.</p>
        <div class="rc-sups">${sup.map((s, n) => { const f = fu[s.g]; return `<div class="rc-sup"><div class="rc-sup-h"><div><b>${esc(s.n || 'Supplier')}</b><div class="muted small">${esc(s.g)} · ${s.docs.length} document${s.docs.length > 1 ? 's' : ''} · GST ${gst$(s.tax)}</div></div><span class="spacer"></span>
          ${f ? `<span class="pill g small">Followed up ${new Date(f.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${f.n > 1 ? ` · ${f.n} times` : ''}</span>` : '<span class="pill a small">Not followed up</span>'}</div>
          <ul class="rc-docs">${s.docs.map(d => `<li>${esc(d.i)} · ${dt(d.d)} · GST ${gst$(gTax(d))}${d.why === 'differs' ? ' · <span class="late">amount differs</span>' : d.from && d.from !== period ? ` · <span class="muted">since ${RECO.monthName(d.from)}</span>` : ''}</li>`).join('')}</ul>
          <div class="toolbar" style="margin:8px 0 0"><button class="btn sm" data-sm="${n}">View message</button><a class="btn sm" target="_blank" rel="noopener" href="${waShare(RECO.message(s, c, period))}">WhatsApp</a>
          <a class="btn sm" href="mailto:?subject=${encodeURIComponent(`GST invoices not in GSTR-2B – ${c.name}`)}&body=${encodeURIComponent(RECO.message(s, c, period))}">Email</a>
          <span class="spacer"></span><button class="btn sm primary" data-fu="${esc(s.g)}">✓ Mark followed up</button></div></div>`; }).join('')}</div>`
        : '<div class="empty">No supplier follow-up needed — everything in books is in 2B.</div>';
      $$('[data-sm]', rb).forEach(b => b.onclick = () => { const s = sup[+b.dataset.sm], txt = RECO.message(s, c, period);
        const m = modal(`Message to ${s.n || s.g}`, `<textarea rows="16" style="width:100%" id="rcMsg">${esc(txt)}</textarea>`, { extra: '<button class="btn" id="rcCopy">Copy</button>', wide: true });
        $('#rcCopy', m.el).onclick = () => copySecret($('#rcMsg', m.el).value, 'Message copied'); });
      $$('[data-fu]', rb).forEach(b => b.onclick = async () => { const g = b.dataset.fu, prev = fu[g];
        await saveReco(r => { r.fu = { ...(r.fu || {}), [g]: { at: new Date().toISOString(), by: me.id, n: ((prev && prev.n) || 0) + 1 } }; }); toast('Follow-up noted'); });
    }

    if (grRecView === 'ims') {
      const shown = imsRows.filter(z => grImsF === 'all' || z.s.a === grImsF);
      rb.innerHTML = `<div class="toolbar" style="margin:0 0 10px"><div class="seg">${[['all', `All · ${imsRows.length}`], ['Accept', `Accept · ${imsN('Accept')}`], ['Pending', `Pending · ${imsN('Pending')}`], ['Reject', `Reject · ${imsN('Reject')}`]].map(([k, l]) => `<button data-imf="${k}" class="${grImsF === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="table-wrap">${shown.length ? `<table><thead><tr><th>Supplier</th><th>Document</th><th>Date</th><th class="r">Taxable</th><th class="r">Tax</th><th>Suggested action</th><th>Why</th></tr></thead><tbody>
          ${shown.map(({ it, s }) => `<tr><td class="wrap"><b>${esc(it.x.n || '')}</b><div class="muted small">${esc(it.x.g)}</div></td><td>${esc(it.x.i)}${it.x.cn ? ' <span class="badge">Credit note</span>' : ''}</td><td class="small">${dt(it.x.d)}</td>
            <td class="r">${gst$(it.x.t)}</td><td class="r">${gst$(gTax(it.x))}</td><td>${pill(s.a)}</td><td class="small">${esc(s.why)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing here.</div>'}</div>
        <p class="muted small">Take these actions on the GST portal (Returns → Invoice Management System) before filing GSTR-3B. Documents left with no action are treated as accepted. Decide “Amount differs” and “In 2B, not in books” rows in the Invoices view to turn Pending into Accept or Reject.</p>`;
      $$('[data-imf]', rb).forEach(b => b.onclick = () => { grImsF = b.dataset.imf; renderReco(o, sm); });
    }

    $$('[data-rv]', o).forEach(b => b.onclick = () => { grRecView = b.dataset.rv; renderReco(o, sm); });
    $('#grXl', o).onclick = () => recoExcel({ list, dec, cf, cl, sup, sm, fu }).catch(e => toast(friendly(e), true));

    async function saveReco(fn) {
      const reco = JSON.parse(JSON.stringify(row.reco || {})); fn(reco);
      const { error } = await safe(sb.from('gst_months').update({ reco }).eq('client_id', grClient).eq('period', period));
      if (error) { toast(/reco/.test(error.message || '') ? 'Run update-gstr2b-reco.sql in Supabase first' : friendly(error), true); return false; }
      row.reco = reco; renderReco(o, sm); return true;
    }
    function saveDec(k, patch) {
      return saveReco(r => { r.dec = r.dec || {}; const cur = { ...(r.dec[k] || {}), ...patch, by: me.id, at: new Date().toISOString() };
        if (!cur.a && !cur.note) delete r.dec[k]; else r.dec[k] = cur; });
    }
  }
  async function recoExcel({ list, dec, cf, cl, sup, sm, fu }) {
    const X = await loadXlsx(), wb = X.utils.book_new(), mLabel = RECO.monthName(period);
    const lab = { matched: 'Matched', mismatch: 'Amount differs', books_only: 'In books, not in 2B', '2b_only': 'In 2B, not in books', not_avail: 'ITC not available', carried: 'Earlier month, now in 2B' };
    const t4 = o => [o.ig, o.cg, o.sg, o.cs, gTax(o)];
    const sheet = (name, aoa, widths) => { const ws = X.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    const G = RECO.groups(list);
    sheet('Summary', [[`GSTR-2B reconciliation – ${c.name} (${c.gstin}) – ${mLabel}`], [`Prepared ${new Date().toLocaleDateString('en-IN')} by ${me.full_name || me.email}`], [],
      ['', 'IGST', 'CGST', 'SGST', 'Cess', 'Total'],
      ['ITC available in GSTR-2B', ...t4(sm.itc2b)], ['ITC to claim (after decisions)', ...t4(cl.claim)], ['  incl. earlier months now in 2B', ...t4(cl.carried)], ['  incl. imports / ISD', ...t4(cl.other)],
      ['Not claimable this month', ...t4(cl.held)], [],
      ['Group', 'Documents', 'Tax'], ...Object.keys(lab).map(k => [lab[k], (G[k] || {}).n || 0, (G[k] || {}).tax || 0]),
      ['Earlier months, still missing', cf.missing.length, GR.r2(cf.missing.reduce((a, e) => a + gTax(e.b), 0))], [],
      [`Tolerance: ₹${RECO.TOL} per document. Undecided differences are counted at the lower of books and 2B.`]], [40, 14, 14, 14, 12, 14]);
    const rec = [['Status', 'Supplier GSTIN', 'Supplier', 'Invoice (books)', 'Invoice (2B)', 'Date', 'Taxable (books)', 'Taxable (2B)', 'Tax (books)', 'Tax (2B)', 'Difference', 'IGST (2B)', 'CGST (2B)', 'SGST (2B)', 'Decision', 'Note', 'IMS action']];
    list.forEach(x => { const b = x.b || x.eb || {}, y = x.x || {}, d = dec[x.k] || {}, s = RECO.ims(x, d);
      rec.push([lab[x.st] + (x.st === 'carried' ? ` (${RECO.monthName(x.from)})` : ''), b.g || y.g, b.n || y.n, b.i || '', y.i || '', b.d || y.d, b.t ?? '', y.t ?? '', x.b || x.eb ? gTax(b) : '', x.x ? gTax(y) : '', x.diff ?? '', y.ig ?? '', y.cg ?? '', y.sg ?? '',
        RECO.decLabel(x.st, d.a), d.note || '', s ? (s.a === 'NA' ? 'Not in IMS' : s.a) : '']); });
    sheet('Reconciliation', rec, [22, 17, 28, 16, 16, 11, 13, 13, 11, 11, 10, 10, 10, 10, 30, 24, 10]);
    sheet('Earlier months', [['Status', 'Booked in', 'Supplier GSTIN', 'Supplier', 'Invoice', 'Date', 'Taxable', 'Tax', 'Now in 2B of', 'Last date to claim', 'Note'],
      ...cf.missing.map(e => ['Still missing', RECO.monthName(e.from), e.b.g, e.b.n, e.b.i, e.b.d, e.b.t, gTax(e.b), '', e.deadline.split('-').reverse().join('-'), e.note]),
      ...cf.now.map(e => ['Now in 2B – claim', RECO.monthName(e.from), e.b.g, e.b.n, e.b.i, e.b.d, e.b.t, gTax(e.x), mLabel, '', e.note]),
      ...cf.cleared.map(e => ['Came in a later 2B', RECO.monthName(e.from), e.b.g, e.b.n, e.b.i, e.b.d, e.b.t, gTax(e.x), RECO.monthName(e.in), '', e.note])], [20, 11, 17, 28, 16, 11, 13, 11, 13, 16, 24]);
    sheet('Supplier follow-up', [['Supplier GSTIN', 'Supplier', 'Document', 'Date', 'Taxable', 'GST', 'Issue', 'Since', 'Last follow-up'],
      ...sup.flatMap(s => s.docs.map(d => [s.g, s.n, d.i, d.d, d.t, gTax(d), d.why === 'differs' ? 'Amount differs' : 'Not in 2B', RECO.monthName(d.from || period),
        fu[s.g] ? new Date(fu[s.g].at).toLocaleDateString('en-IN') : '']))], [17, 28, 16, 11, 13, 11, 14, 10, 13]);
    sheet('IMS actions', [['Supplier GSTIN', 'Supplier', 'Document', 'Type', 'Date', 'Taxable', 'Tax', 'Suggested action', 'Why'],
      ...list.filter(x => x.x).map(x => ({ x, s: RECO.ims(x, dec[x.k]) })).filter(z => z.s && z.s.a !== 'NA')
        .map(({ x, s }) => [x.x.g, x.x.n, x.x.i, x.x.cn ? 'Credit note' : 'Invoice', x.x.d, x.x.t, gTax(x.x), s.a, s.why])], [17, 28, 16, 11, 11, 13, 11, 14, 36]);
    X.writeFile(wb, `GSTR-2B-reco-${slug(c.name)}-${grMonth}.xlsx`);
  }
  async function renderTrend(o) {
    o.innerHTML = '<div class="loading">Loading…</div>';
    const d = new Date(period + 'T00:00:00'); d.setMonth(d.getMonth() - 5);
    const { data } = await must(sb.from('gst_months').select('period,summary,status').eq('client_id', grClient).gte('period', iso(d)).lte('period', period).order('period'));
    const months = []; for (let k = 0; k < 6; k++) { const x = new Date(d); x.setMonth(d.getMonth() + k); months.push(iso(x)); }
    const get = p => { const x = ((data || []).find(r => r.period === p) || {}).summary || null; if (!x) return null;
      return { ...x, cash: typeof x.cash === 'number' ? x.cash : (x.cash_total ?? x.cash_draft ?? 0) }; };   // v17+ keeps per-head cash in summary.cash
    const cols = [['sales', 'Sales (taxable)'], ['outTax', 'Output tax'], ['itc', 'ITC'], ['cash', 'Cash paid / payable']];
    const max = k => Math.max(1, ...months.map(p => (get(p) || {})[k] || 0));
    o.innerHTML = `<h3 style="margin-top:0">Last 6 months</h3><div class="table-wrap"><table class="gr-t"><thead><tr><th>Month</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}<th>Status</th></tr></thead><tbody>
      ${months.map(p => { const s = get(p), st = ((data || []).find(r => r.period === p) || {}).status; return `<tr><td><b>${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}</b></td>${cols.map(([k]) => `<td>${s ? `<div class="gr-bar"><i style="width:${Math.round(100 * (s[k] || 0) / max(k))}%"></i></div><span class="small">${gst$(s[k])}</span>` : '<span class="muted small">—</span>'}</td>`).join('')}
        <td>${st ? (st === 'Verified' ? '<span class="pill g">Verified</span>' : '<span class="pill a">Draft</span>') : ''}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muted small">Big swings month to month are worth a question to the client before filing.</p>`;
  }

  // ----- data in -----
  const pickFile = accept => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0]); i.click(); });
  async function upload(kind, given) {
    const f = given || await pickFile(kind === 'gstr2b' ? '.json,.xlsx,.xls,.zip' : '.xlsx,.xls,.csv');
    if (!f) return false;
    if (/\.zip$/i.test(f.name)) return toast('Please unzip the portal download first and upload the .json file inside', true);
    if (kind === 'sales') { try { return await salesToG1(f); } catch (e) { toast('Could not read the file: ' + friendly(e), true); return false; } }
    try {
      let rows = [], meta = '';
      if (kind === 'gstr2b' && /\.json$/i.test(f.name)) {
        const p = GR.parse2BJson(JSON.parse(await f.text()));
        if (p.error) return toast(p.error, true);
        if (p.gstin && p.gstin !== c.gstin) return toast(`This 2B is for ${p.gstin}, not ${c.gstin}`, true);
        const want = grMonth.slice(5, 7) + grMonth.slice(0, 4);
        if (p.period && p.period !== want && !confirm(`This 2B is for period ${p.period.slice(0, 2)}/${p.period.slice(2)}, not ${grMonth.slice(5, 7)}/${grMonth.slice(0, 4)}. Use it anyway?`)) return;
        rows = p.rows;
      } else {
        const sheets = await readSheets(f);
        const use = kind === 'gstr2b' ? sheets.filter(s => /b2b|cdnr|b2ba|impg|isd/i.test(s.name)) : sheets.slice(0, 1);
        let err = '';
        for (const s of (use.length ? use : sheets.slice(0, 1))) {
          const p = GR.parseTable(s.rows, { section: kind === 'gstr2b' ? s.name.toUpperCase().replace(/[^A-Z0-9]/g, '') : '' });
          if (p.error) err = err || p.error;
          rows = rows.concat(p.rows || []); meta = p.columns ? p.columns.join(',') : meta;
        }
        if (!rows.length && err) return toast(err, true);
      }
      if (!rows.length) return toast('No invoice rows found in this file', true);
      const t = rows.reduce((a, x) => a + gTax(x), 0), tx = rows.reduce((a, x) => a + (x.t || 0), 0);
      const label = { sales: 'sales register', purchases: 'purchase register', gstr2b: 'GSTR-2B' }[kind];
      if (!confirm(`${f.name}\n\n${rows.length} documents found\nTaxable value: ${gst$(tx)}\nTotal tax: ${gst$(t)}\n\nSave as this month's ${label}?${row[kind] ? '\n(This replaces the current data.)' : ''}`)) return;
      await save({ [kind]: { rows, file: f.name, source: given ? 'email' : 'file', ...by() } });
      toast(`${label} saved — ${rows.length} documents`); return true;
    } catch (e) { toast('Could not read the file: ' + friendly(e), true); }
  }
  // sales file → GSTR-1 entry (check there, Save pushes it to the draft GSTR-3B)
  async function salesToG1(f) {
    const sheets = await readSheets(f), mLabel = (() => { const [y, m] = grMonth.split('-'); return `${MONTHS[+m - 1]} ${y}`; })();
    let res = SALESIN.read(sheets, { month: grMonth, drafts: false });
    if (res.skipped.draft && res.skipped.draft.n && confirm(`${res.skipped.draft.n} line(s) are DRAFT invoices (taxable ${gst$(res.skipped.draft.amt)}) — not yet issued.\n\nOK = include them\nCancel = leave them out`))
      res = SALESIN.read(sheets, { month: grMonth, drafts: true });
    if (!res.lines.length && res.skipped.month && res.skipped.month.n && confirm(`All ${res.skipped.month.n} lines are dated outside ${mLabel}. Load them anyway?`))
      res = SALESIN.read(sheets, { drafts: res.skipped.draft ? res.skipped.draft.n === 0 : true });
    if (!res.lines.length) { toast(res.error || 'No sales lines found in this file', true); return false; }
    const C = G1.calcSales(res.lines, String(c.gstin || '').slice(0, 2), c.gstin).filter(o => o.x);
    const ok = C.filter(o => o.x.ok), tab = {}; C.forEach(o => { tab[o.x.table] = (tab[o.x.table] || 0) + 1; });
    const taxable = ok.filter(o => !o.row.nil).reduce((s, o) => s + o.x.sign * o.x.amt, 0), nilAmt = ok.filter(o => o.row.nil).reduce((s, o) => s + o.x.sign * o.x.amt, 0);
    const tax = ok.reduce((s, o) => s + o.x.sign * (o.x.ig + o.x.cg + o.x.sg), 0), bad = C.length - ok.length;
    const left = [res.skipped.outScope && res.skipped.outScope.n ? `${res.skipped.outScope.n} out-of-scope line(s) e.g. reimbursements — ${gst$(res.skipped.outScope.amt)}` : '',
      res.skipped.draft && res.skipped.draft.n ? `${res.skipped.draft.n} draft line(s) — ${gst$(res.skipped.draft.amt)}` : '',
      res.skipped.void && res.skipped.void.n ? `${res.skipped.void.n} void line(s)` : '',
      res.skipped.month && res.skipped.month.n ? `${res.skipped.month.n} line(s) of other months — ${gst$(res.skipped.month.amt)}` : ''].filter(Boolean);
    const diff = Math.abs(tax - res.fileTax);
    if (!confirm(`${f.name} — ${res.source}\n\n${C.length} lines: ${Object.entries(tab).map(([k, v]) => `${k} ${v}`).join(' · ')}\nTaxable value: ${gst$(taxable)}${nilAmt ? `\nNil / exempt / non-GST: ${gst$(nilAmt)}` : ''}\nGST worked out: ${gst$(tax)} · GST in file: ${gst$(res.fileTax)}${diff > 1 ? '  ⚠ check' : '  ✓'}`
      + `${left.length ? `\n\nLeft out:\n• ${left.join('\n• ')}` : ''}${bad ? `\n\n${bad} row(s) need a correction — shown in red in GSTR-1 entry.` : ''}\n\nLoad into GSTR-1 entry? Check the rows there, then Save to update the draft GSTR-3B.`)) return false;
    const key = c.id + '|' + period, g = row.g1 || {};
    const cur = g1Drafts[key] || { sales: (g.sales || []).map(x => ({ ...x })), amend: (g.amend || []).map(x => ({ ...x })), adv: (g.adv || []).map(x => ({ ...x })), docs: (g.docs || []).map(x => ({ ...x })), dirty: false };
    if (cur.sales.some(r => Object.keys(r).length) && !confirm('Replace the sales rows already in GSTR-1 entry with these?')) return false;
    cur.sales = res.lines.map(x => ({ ...x })); cur.dirty = true; g1Drafts[key] = cur;
    grTab = 'g1'; g1Tab = 'sales'; render();
    toast(`${C.length} lines loaded into GSTR-1 entry — check, then Save`); return true;
  }
  function enterFigures(kind) {
    const cur = row[kind] || {}, f = (pre, o = {}) => ['t', 'ig', 'cg', 'sg', 'cs'].filter(k => pre !== 'x' || k !== 't').map(k => `<label>${{ t: 'Taxable value', ig: 'IGST', cg: 'CGST', sg: 'SGST', cs: 'Cess' }[k]}<input type="number" step="0.01" name="${pre}_${k}" value="${o[k] ?? ''}"></label>`).join('');
    const body = kind === 'gstr3b'
      ? `<h4 style="margin:0 0 6px">3.1(a) Outward taxable supplies</h4><div class="form-grid g5">${f('a', cur.t31a)}</div>
         <h4 style="margin:14px 0 6px">4(C) Net ITC available</h4><div class="form-grid g5">${f('x', cur.itc_net)}</div>
         <h4 style="margin:14px 0 6px">Tax paid in cash</h4><div class="form-grid g5">${f('y', cur.cash).replace(/name="y_/g, 'name="y_')}</div>`
      : `<p class="muted small" style="margin-top:0">From the GSTR-1 summary on the portal (total of B2B, B2C, exports, less credit notes).</p><div class="form-grid g5">${f('a', cur)}</div>`;
    modal(kind === 'gstr3b' ? 'GSTR-3B filed figures' : 'GSTR-1 filed totals', body, { wide: true, saveText: 'Save',
      onSave: async el => {
        const g = (pre, keys) => Object.fromEntries(keys.map(k => [k, num(fv(el, `${pre}_${k}`))]));
        const val = kind === 'gstr3b' ? { t31a: g('a', ['t', 'ig', 'cg', 'sg', 'cs']), itc_net: g('x', ['ig', 'cg', 'sg', 'cs']), cash: g('y', ['ig', 'cg', 'sg', 'cs']) } : g('a', ['t', 'ig', 'cg', 'sg', 'cs']);
        await save({ [kind]: { ...val, source: 'manual', ...by() } }); toast('Saved');
      } });
  }
  function template(kind) {
    loadXlsx().then(X => {
      const head = kind === 'sales' ? ['Invoice No', 'Invoice Date', 'Customer GSTIN', 'Customer Name', 'Place of Supply', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess', 'Document Type']
        : ['Invoice No', 'Invoice Date', 'Supplier GSTIN', 'Supplier Name', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess', 'Reverse Charge', 'Document Type'];
      const ex = kind === 'sales' ? ['INV-001', '05/10/2026', '33AAAAA0000A1Z5', 'ABC Traders', 'Tamil Nadu', 10000, 0, 900, 900, 0, 'Invoice']
        : ['PB-123', '03/10/2026', '33BBBBB1111B1Z5', 'Supplier Pvt Ltd', 5000, 0, 450, 450, 0, 'No', 'Invoice'];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([head, ex]), kind === 'sales' ? 'Sales' : 'Purchases');
      X.writeFile(wb, `${kind}-register-template.xlsx`);
    }).catch(e => toast(friendly(e), true));
  }
  body.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.gt) { grTab = d.gt; render(); }
    if (d.up) upload(d.up);
    if (d.bills != null) { const fs = await pickFiles('.pdf,image/*'); if (fs.length) readBillsDialog({ c, month: grMonth, files: fs, getRow: () => row, save }).catch(err => toast(friendly(err), true)); }
    if (d.ent) enterFigures(d.ent);
    if (d.tpl) template(d.tpl);
    if (d.clr) { if (!confirm('Remove this data for the month?')) return; await save({ [d.clr]: null }).catch(err => toast(friendly(err), true)); }
    if ('portalApi' in d) gstPortalFetch(c, grMonth, async patch => { await save(patch); });
    if (b.id === 'grSaveNotes') { await save({ notes: $('#grNotes', body).value.trim() || null }).catch(err => toast(friendly(err), true)); toast('Notes saved'); }
    if (b.id === 'grVer') { if (!GR.summarise(row).counts.sales && !row.gstr2b) return toast('Add the data first', true); await save({ status: 'Verified', notes: $('#grNotes', body).value.trim() || null }).catch(err => toast(friendly(err), true)); toast('Marked as verified'); }
    if (b.id === 'grUnver') { await save({ status: 'Draft' }).catch(err => toast(friendly(err), true)); }
  });
  render();
  // file sent from Client mail → "Import to GST review"
  if (pendingGstImport && pendingGstImport.client === grClient && pendingGstImport.month === grMonth) {
    const p = pendingGstImport; pendingGstImport = null;
    if (p.kind === 'bills') readBillsDialog({ c, month: grMonth, files: p.files, getRow: () => row, save, onAdded: () => safe(sb.from('mail_inbox').update({ status: 'Done', handled_by: me.id, handled_at: new Date().toISOString() }).eq('id', p.mailId)).then(() => refreshMailBadge().catch(() => {})) }).catch(err => toast(friendly(err), true));
    else if (await upload(p.kind, p.file)) {
      await safe(sb.from('mail_inbox').update({ status: 'Done', handled_by: me.id, handled_at: new Date().toISOString() }).eq('id', p.mailId));
      refreshMailBadge().catch(() => {});
    }
  }
};

// ----- GST portal fetch (OTP) through the "gst-data" server function -----
async function gstPortalFetch(c, month, onData) {
  const m = modal(`Fetch from GST portal · ${c.name}`, '<div data-gp><div class="loading">Checking…</div></div>', { wide: true });
  const box = $('[data-gp]', m.el), [yy, mm] = month.split('-').map(Number);
  let st;
  try { st = await fnCall('gst-data', 'status', { client_id: c.id }); }
  catch (e) { box.innerHTML = `<p class="note">The GST portal link is not ready yet: ${esc(friendly(e))}.</p><p class="muted small">You can still upload the GSTR-2B file downloaded from the portal.</p>`; return; }
  const draw = () => {
    if (!st.keys) { box.innerHTML = '<p class="note">Add your Sandbox API key and secret in <b>Settings → GST</b> first.</p>'; return; }
    box.innerHTML = `<div class="small" style="line-height:1.7"><b>GSTIN</b> ${esc(c.gstin)} · <b>GST username</b> ${st.username ? esc(st.username) : '<span class="late">not saved — add a GST login under 🔑 Logins</span>'}<br>
      ${st.active ? `<span class="ok-t">● Connected until ${new Date(st.expires_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>` : '<span class="muted">Not connected — an OTP is needed</span>'}</div>
      ${st.active ? `<div class="toolbar" style="margin-top:14px"><button class="btn primary" data-f2b>Fetch GSTR-2B (${MONTHS[mm - 1]} ${yy})</button><button class="btn" data-f3b>Fetch filed GSTR-3B</button></div>`
        : `<ol class="small" style="line-height:1.8;padding-left:18px"><li>The client must have <b>API access ON</b> on the GST portal (Profile → Manage API Access → Yes).</li><li>Click <b>Send OTP</b> — the OTP goes to the client's registered mobile / email.</li><li>Ask the client for the OTP and enter it below. The connection lasts about 6 hours.</li></ol>
          <div class="toolbar"><button class="btn" data-otp ${st.username ? '' : 'disabled'}>Send OTP</button><input data-otpv inputmode="numeric" maxlength="6" placeholder="6-digit OTP" style="width:130px"><button class="btn primary" data-ver>Verify</button></div>`}
      <div data-gmsg class="small" style="margin-top:10px"></div>`;
  };
  draw();
  const msg = t => { const x = $('[data-gmsg]', box); if (x) x.innerHTML = t; };
  box.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; b.disabled = true;
    try {
      if ('otp' in b.dataset) { await fnCall('gst-data', 'otp_send', { client_id: c.id }); msg('<span class="ok-t">OTP sent to the client\'s registered mobile / email.</span>'); }
      if ('ver' in b.dataset) { const otp = $('[data-otpv]', box).value.trim(); if (!/^\d{6}$/.test(otp)) { msg('<span class="late">Enter the 6-digit OTP</span>'); return; }
        st = { ...st, ...(await fnCall('gst-data', 'otp_verify', { client_id: c.id, otp })) }; draw(); toast('Connected to the GST portal'); }
      if ('f2b' in b.dataset) { msg('Fetching GSTR-2B…'); const r = await fnCall('gst-data', 'fetch_2b', { client_id: c.id, year: yy, month: mm });
        const p = GR.parse2BJson(r.data); if (p.error) { msg(`<span class="late">${esc(r.message || p.error)}</span>`); return; }
        await onData({ gstr2b: { rows: p.rows, source: 'api', at: new Date().toISOString(), by: me.id } }); msg(`<span class="ok-t">GSTR-2B saved — ${p.rows.length} documents.</span>`); }
      if ('f3b' in b.dataset) { msg('Fetching GSTR-3B…'); const r = await fnCall('gst-data', 'fetch_3b', { client_id: c.id, year: yy, month: mm });
        const g = gstr3bFromApi(r.data); if (!g) { msg(`<span class="late">${esc(r.message || 'GSTR-3B not available for this month (not filed yet?)')}</span>`); return; }
        await onData({ gstr3b: { ...g, source: 'api', at: new Date().toISOString(), by: me.id } }); msg('<span class="ok-t">Filed GSTR-3B figures saved.</span>'); }
    } catch (err) { msg(`<span class="late">${esc(friendly(err))}</span>`); }
    finally { b.disabled = false; }
  });
}
function gstr3bFromApi(j) {
  let d = j; for (let k = 0; k < 3 && d && !d.sup_details && d.data; k++) d = d.data;
  if (!d || !d.sup_details) return null;
  const n = x => GR.amt(x), o = d.sup_details.osup_det || {};
  const net = (d.itc_elg && d.itc_elg.itc_net) || {};
  const cash = { ig: 0, cg: 0, sg: 0, cs: 0 };
  ((d.tx_pmt && d.tx_pmt.pdcash) || []).forEach(p => { cash.ig += n(p.igst_paid_cash || p.ipd); cash.cg += n(p.cgst_paid_cash || p.cpd); cash.sg += n(p.sgst_paid_cash || p.spd); cash.cs += n(p.cess_paid_cash || p.cspd); });
  return { t31a: { t: n(o.txval), ig: n(o.iamt), cg: n(o.camt), sg: n(o.samt), cs: n(o.csamt) }, itc_net: { ig: n(net.iamt), cg: n(net.camt), sg: n(net.samt), cs: n(net.csamt) }, cash };
}

const G1L = {"states": [["35", "ANDAMAN AND NICOBAR"], ["37", "ANDHRA PRADESH"], ["12", "ARUNACHAL PRADESH"], ["18", "ASSAM"], ["10", "BIHAR"], ["04", "CHANDIGARH"], ["22", "CHHATTISGARH"], ["26", "DADRA AND NAGAR HAVELI"], ["25", "DAMAN AND DIU"], ["07", "DELHI"], ["30", "GOA"], ["24", "GUJARAT"], ["06", "HARYANA"], ["02", "HIMACHAL PRADESH"], ["01", "JAMMU AND KASHMIR"], ["20", "JHARKHAND"], ["29", "KARNATAKA"], ["32", "KERALA"], ["31", "LAKSHADWEEP"], ["38", "LADAKH"], ["23", "MADHYA PRADESH"], ["27", "MAHARASHTRA "], ["14", "MANIPUR"], ["17", "MEGHALAYA"], ["15", "MIZORAM"], ["13", "NAGALAND"], ["21", "ODISHA"], ["99", "OVERSEAS"], ["34", "PUDUCHERRY"], ["03", "PUNJAB"], ["08", "RAJASTHAN"], ["11", "SIKKIM"], ["33", "TAMIL NADU"], ["36", "TELANGANA"], ["16", "TRIPURA"], ["09", "UTTAR PRADESH"], ["05", "UTTARAKHAND"], ["19", "WEST BENGAL"], ["97", "OTHER TERRITORY"]], "uqc": ["BAG", "BAL", "BDL", "BKL", "BOU", "BOX", "BTL", "BUN", "CAN", "CBM", "CCM", "CMS", "CTN", "DOZ", "DRM", "GGK", "GMS", "GRS", "GYD", "KGS", "KLR", "KME", "LTR", "MLT", "MTR", "MTS", "NOS", "PAC", "PCS", "PRS", "QTL", "ROL", "SET", "SQF", "SQM", "SQY", "TBS", "TGM", "THD", "TON", "TUB", "UGS", "UNT", "YDS", "OTH"], "docs": ["Invoices for outward supply", "Invoices for inward supply from unregistered person", "Revised Invoice", "Debit Note", "Credit Note", "Receipt voucher", "Payment Voucher", "Refund voucher", "Delivery Challan for job work", "Delivery Challan for supply on approval", "Delivery Challan in case of liquid gas", "Delivery Challan in cases other than by way of supply (excluding at S no. 9 to 11)"]};
/* =====================================================================
   GSTR-1 SIMPLE ENTRY ENGINE  (same rules as JLR-GSTR1-Simple-Entry.xlsx)
   ===================================================================== */
const G1 = (() => {
  const RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
  const DOCTYPES = ['Invoice', 'Credit Note', 'Debit Note'];
  const EXPSEZ = ['Export - With GST', 'Export - Without GST', 'SEZ - With GST', 'SEZ - Without GST'];
  const NIL = ['Nil rated', 'Exempted', 'Non-GST'];
  const ADVT = ['Advance received (11A)', 'Advance adjusted (11B)'];
  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const n = v => { const x = parseFloat(String(v ?? '').replace(/[₹,\s]/g, '')); return isFinite(x) ? x : 0; };
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const up = v => String(v ?? '').trim().toUpperCase();
  const code = name => { const s = G1L.states.find(x => x[1].trim() === String(name || '').trim().toUpperCase()); return s ? s[0] : null; };
  const sname = c => { const s = G1L.states.find(x => x[0] === c); return s ? s[1].trim() : null; };
  const SALES = [ // key, label, kind, width
    ['d', 'Date', 'date', 118], ['no', 'Invoice / Note no', 'text', 120], ['ty', 'Document type', DOCTYPES, 108], ['name', 'Customer name', 'text', 180],
    ['gstin', 'Customer GSTIN', 'gstin', 150], ['state', 'State (unregistered, other state)', 'state', 150], ['hsn', 'HSN / SAC', 'text', 80],
    ['qty', 'Qty', 'num', 64], ['uqc', 'Unit', 'uqc', 72], ['tx', 'Taxable value', 'num', 104], ['rate', 'GST %', RATES, 64], ['cess', 'Cess', 'num', 72],
    ['nil', 'Nil / Exempt / Non-GST', NIL, 110], ['exp', 'Export / SEZ', EXPSEZ, 150], ['rc', 'Reverse charge', ['Yes'], 70], ['eco', 'E-com operator GSTIN', 'gstin', 150],
    ['ono', 'Original invoice no (notes)', 'text', 120], ['odt', 'Original date', 'date', 118]];
  const AMEND = [['ty', 'Document type', DOCTYPES, 108], ['ono', 'Original no', 'text', 110], ['odt', 'Original date', 'date', 118], ['omon', 'Original month (e.g. Aug-2026)', 'text', 110],
    ['no', 'Revised no', 'text', 110], ['d', 'Revised date', 'date', 118], ['name', 'Customer name', 'text', 170], ['gstin', 'Customer GSTIN', 'gstin', 150],
    ['state', 'State (unregistered)', 'state', 140], ['hsn', 'HSN / SAC', 'text', 80], ['tx', 'Taxable value (corrected)', 'num', 110], ['rate', 'GST %', RATES, 64],
    ['cess', 'Cess', 'num', 72], ['exp', 'Export / SEZ', EXPSEZ, 150]];
  const ADV = [['ty', 'Type', ADVT, 170], ['d', 'Date', 'date', 118], ['rv', 'Receipt voucher no', 'text', 120], ['name', 'Customer name', 'text', 170],
    ['gstin', 'Customer GSTIN', 'gstin', 150], ['state', 'State (if no GSTIN)', 'state', 140], ['amt', 'Amount (excl. GST)', 'num', 110], ['rate', 'GST %', RATES, 64], ['cess', 'Cess', 'num', 72]];
  const filled = (row, cols) => cols.some(([k]) => has(row[k]));
  // place of supply / tax for any row type
  function tax(row, own, amtKey = 'tx') {
    const amt = n(row[amtKey]);
    const sc = has(row.gstin) ? up(row.gstin).slice(0, 2) : /^Export/.test(row.exp || '') ? '99' : has(row.state) ? (code(row.state) || '??') : own;
    const inter = has(row.exp) || sc !== own;
    const nil = has(row.nil), without = /Without/.test(row.exp || '');
    const ig = !nil && inter && !without ? r2(amt * n(row.rate) / 100) : 0;
    const cg = !nil && !inter ? r2(amt * n(row.rate) / 200) : 0;
    return { sc, st: sname(sc) || 'CHECK', inter, ig, cg, sg: cg, cs: n(row.cess), amt };
  }
  // ---------------- Sales ----------------
  function calcSales(rows, own, ownGstin) {
    const out = rows.map(row => ({ row, x: filled(row, SALES) ? tax(row, own) : null }));
    const invVal = {};
    out.forEach(o => { if (!o.x) return; const v = o.x.amt + (o.row.rc === 'Yes' ? 0 : o.x.ig + o.x.cg + o.x.sg) + o.x.cs; o.x.val = r2(v); const k = up(o.row.no); invVal[k] = r2((invVal[k] || 0) + v); });
    out.forEach(o => {
      if (!o.x) return; const r = o.row, x = o.x, t = r.ty || 'Invoice';
      x.type = t;
      x.table = t !== 'Invoice' ? (has(r.gstin) ? 'CDNR' : 'CDNUR') : has(r.nil) ? 'NIL' : /^SEZ/.test(r.exp || '') ? 'SEZ' : /^Export/.test(r.exp || '') ? 'EXP'
        : has(r.gstin) ? 'B2B' : (x.inter && invVal[up(r.no)] > 100000 ? 'B2CL' : 'B2CS');
      const no = String(r.no ?? '');
      x.check = !has(r.d) ? 'Date missing' : !has(no) ? 'Invoice no missing' : no.length > 16 ? 'Invoice no over 16 characters' : / /.test(no.trim()) ? 'Remove spaces from invoice no'
        : !has(r.tx) ? 'Taxable value missing'
        : has(r.gstin) && up(r.gstin).length !== 15 ? 'Customer GSTIN must be 15 characters' : has(r.gstin) && up(r.gstin) === up(ownGstin) ? 'Customer GSTIN = client\'s own GSTIN'
        : x.st === 'CHECK' ? 'Unknown state / GSTIN state code' : !has(r.nil) && !has(r.rate) ? 'GST rate missing' : r.nil !== 'Non-GST' && String(r.hsn ?? '').trim().length < 4 ? 'HSN / SAC must be at least 4 digits'
        : has(r.qty) && !has(r.uqc) ? 'Unit (UQC) needed when quantity is given' : has(r.eco) && up(r.eco).length !== 15 ? 'E-commerce GSTIN must be 15 characters'
        : t !== 'Invoice' && !has(r.ono) ? 'Original invoice no needed for a note' : 'OK';
      x.ok = x.check === 'OK'; x.sign = t === 'Credit Note' ? -1 : 1;
    });
    return out;
  }
  function calcAmend(rows, own) {
    return rows.map(r => {
      if (!filled(r, AMEND)) return { row: r, x: null };
      const x = tax(r, own), t = r.ty || 'Invoice'; x.val = r2(x.amt + x.ig + x.cg + x.sg + x.cs);
      x.table = t !== 'Invoice' ? (has(r.gstin) ? 'CDNRA' : 'CDNURA') : /^SEZ/.test(r.exp || '') ? 'B2BA' : /^Export/.test(r.exp || '') ? 'EXPA' : has(r.gstin) ? 'B2BA' : (x.inter && x.val > 100000 ? 'B2CLA' : 'B2CSA');
      x.check = !has(r.ono) || !has(r.odt) ? 'Original no and date needed' : !has(r.no) || !has(r.d) ? 'Revised no and date needed'
        : String(r.no).length > 16 || / /.test(String(r.no).trim()) ? 'Revised no: max 16 characters, no spaces' : has(r.gstin) && up(r.gstin).length !== 15 ? 'GSTIN must be 15 characters'
        : x.st === 'CHECK' ? 'Unknown state' : !has(r.rate) ? 'GST rate missing' : !has(r.tx) ? 'Taxable value missing' : 'OK';
      x.ok = x.check === 'OK'; return { row: r, x };
    });
  }
  function calcAdv(rows, own) {
    return rows.map(r => {
      if (!filled(r, ADV)) return { row: r, x: null };
      const x = tax({ ...r, exp: '' }, own, 'amt');
      x.check = !has(r.ty) ? 'Choose 11A or 11B' : !has(r.d) ? 'Date missing' : !has(r.amt) ? 'Amount missing' : !has(r.rate) ? 'GST rate missing'
        : has(r.gstin) && up(r.gstin).length !== 15 ? 'GSTIN must be 15 characters' : x.st === 'CHECK' ? 'Unknown state' : 'OK';
      x.ok = x.check === 'OK'; return { row: r, x };
    });
  }
  // ---------------- Summary ----------------
  const Z = () => ({ n: 0, t: 0, ig: 0, cg: 0, sg: 0, cs: 0 });
  const add = (a, x, s = 1, amt = x.amt) => { a.n++; a.t = r2(a.t + s * amt); a.ig = r2(a.ig + s * x.ig); a.cg = r2(a.cg + s * x.cg); a.sg = r2(a.sg + s * x.sg); a.cs = r2(a.cs + s * x.cs); return a; };
  function summary(g1, client) {
    const own = String(client.gstin || '').slice(0, 2);
    const S = calcSales(g1.sales || [], own, client.gstin), A = calcAmend(g1.amend || [], own), V = calcAdv(g1.adv || [], own);
    const ok = S.filter(o => o.x && o.x.ok), errors = [...S, ...A, ...V].filter(o => o.x && !o.x.ok).length;
    const tables = {}, rateW = {}, b2cs = {}, t8 = {}, hsn = {};
    const T = k => tables[k] = tables[k] || Z();
    ok.forEach(({ row: r, x }) => {
      add(T(x.table), x);
      if (r.rc === 'Yes') add(T('RCM'), x);
      if (!has(r.nil)) add(rateW[n(r.rate)] = rateW[n(r.rate)] || Z(), x, x.sign);
      if (x.table === 'B2CS') { const k = x.st + '|' + n(r.rate); add(b2cs[k] = b2cs[k] || Z(), x); }
      if (x.table === 'NIL') { const k = (x.inter ? 'Inter' : 'Intra') + '|' + (has(r.gstin) ? 'Reg' : 'Unreg') + '|' + r.nil; t8[k] = r2((t8[k] || 0) + x.amt); }
      const tab = ['B2B', 'SEZ', 'CDNR'].includes(x.table) || (x.table === 'NIL' && has(r.gstin)) ? 'B2B' : 'B2C';
      const uqc = /^99/.test(String(r.hsn)) ? 'NA' : (r.uqc || 'NA'), rate = has(r.nil) ? 0 : n(r.rate), k = [tab, String(r.hsn).trim(), rate, uqc].join('|');
      const h = hsn[k] = hsn[k] || { ...Z(), q: 0 }; add(h, x, x.sign); h.q = r2(h.q + x.sign * n(r.qty));
    });
    A.filter(o => o.x && o.x.ok).forEach(({ x }) => add(T(x.table), x));
    V.filter(o => o.x && o.x.ok).forEach(({ row: r, x }) => add(T(/11B/.test(r.ty) ? 'AT_ADJ' : 'AT'), x));
    const payable = Z(); ok.forEach(({ row: r, x }) => { if (x.table === 'NIL') return; add(payable, r.rc === 'Yes' ? { ...x, ig: 0, cg: 0, sg: 0, cs: 0 } : x, x.sign); });
    // documents (Table 13): auto rows from entries
    const first = (list, key) => list.length ? list[0][key] : '', last = (list, key) => list.length ? list[list.length - 1][key] : '';
    const uniq = arr => arr.filter((o, i) => arr.findIndex(p => up(p.row.no) === up(o.row.no)) === i);
    const inv = uniq(ok.filter(o => o.x.type === 'Invoice')).map(o => o.row), cn = uniq(ok.filter(o => o.x.type === 'Credit Note')).map(o => o.row), dn = uniq(ok.filter(o => o.x.type === 'Debit Note')).map(o => o.row);
    const rv = V.filter(o => o.x && o.x.ok && /11A/.test(o.row.ty) && has(o.row.rv)).map(o => ({ no: o.row.rv }));
    const auto = { 'Invoices for outward supply': inv, 'Credit Note': cn, 'Debit Note': dn, 'Receipt voucher': rv };
    const docs = G1L.docs.map(nat => { const typed = (g1.docs || []).find(d => d.nat === nat) || {};
      const a = auto[nat]; const from = a ? first(a, 'no') : typed.from || '', to = a ? last(a, 'no') : typed.to || '', total = a ? a.length : n(typed.total), cancelled = n(typed.cancelled);
      return { nat, from, to, total, cancelled, net: total ? total - cancelled : 0, auto: !!a }; });
    return { S, A, V, tables, rateW, b2cs, t8, hsn, payable, docs, errors, okCount: ok.length };
  }
  // rows for the GST review engine (sales register shape)
  function toRegister(S) {
    return S.filter(o => o.x && o.x.ok).map(({ row: r, x }) => { const s = x.sign, rc = r.rc === 'Yes';
      return { g: up(r.gstin), n: r.name || '', i: String(r.no), d: r.d || '', t: r2(s * x.amt), ig: rc ? 0 : r2(s * x.ig), cg: rc ? 0 : r2(s * x.cg), sg: rc ? 0 : r2(s * x.sg), cs: r2(s * x.cs),
        v: r2(s * x.val), cn: s < 0 || undefined, nil: r.nil || undefined, src: 'G1' }; });
  }
  // read the filled Excel template (sheets Sales / Amendments / Advances / Documents, data from row 5)
  const xdate = v => { if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); } return GR.toDate(v); };
  function fromWorkbook(sheets) {
    const get = name => (sheets.find(s => s.name.trim().toLowerCase() === name.toLowerCase()) || {}).rows || null;
    const S = get('Sales'); if (!S) return { error: 'This is not the JLR GSTR-1 entry template (no "Sales" sheet).' };
    const take = (rows, cols, dates) => (rows || []).slice(4).map(r => { const o = {}; cols.forEach(([k], j) => { let v = r[j]; if (v === '' || v == null) return; if (dates.includes(k)) v = xdate(v); o[k] = typeof v === 'string' ? v.trim() : v; }); return o; })
      .filter(o => cols.some(([k]) => has(o[k])) && !(Object.keys(o).length === 1 && o.name && /sample rows/i.test(o.name)));
    const sales = take(S, SALES, ['d', 'odt']).filter(o => has(o.tx) || has(o.no));
    const amend = take(get('Amendments'), AMEND, ['odt', 'd']).filter(o => has(o.tx));
    const adv = take(get('Advances'), ADV, ['d']).filter(o => has(o.amt));
    const D = get('Documents'), docs = [];
    (D || []).slice(4).forEach(r => { if (G1L.docs.includes(String(r[0]).trim())) docs.push({ nat: String(r[0]).trim(), from: r[1] || '', to: r[2] || '', total: r[3] || '', cancelled: r[4] || 0 }); });
    const setup = get('Setup') || []; const g = String((setup[3] || [])[1] || '').trim().toUpperCase();
    return { sales, amend, adv, docs, gstin: g };
  }
  return { SALES, AMEND, ADV, RATES, calcSales, calcAmend, calcAdv, summary, toRegister, fromWorkbook, code, sname, has };
})();

/* =====================================================================
   SALES FILE → GSTR-1 ENTRY ROWS
   Zoho Invoice / Zoho Books "Invoice" export (one line per item) and any other sales register.
   ===================================================================== */
const SALESIN = (() => {
  const n = v => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
  const r2 = x => Math.round(x * 100) / 100;
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const xdate = v => { if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); } return GR.toDate(v); };
  const UQC_ALIAS = { NO: 'NOS', NOS: 'NOS', NUMBER: 'NOS', NUMBERS: 'NOS', UNIT: 'UNT', UNITS: 'UNT', PC: 'PCS', PCS: 'PCS', PIECE: 'PCS', PIECES: 'PCS', KG: 'KGS', KGS: 'KGS',
    G: 'GMS', GM: 'GMS', GMS: 'GMS', L: 'LTR', LTR: 'LTR', LITRE: 'LTR', LITER: 'LTR', ML: 'MLT', M: 'MTR', MTR: 'MTR', METER: 'MTR', METRE: 'MTR', BOX: 'BOX', SET: 'SET', DOZ: 'DOZ', DOZEN: 'DOZ', PAIR: 'PRS' };
  const uqcOf = u => { const k = String(u || '').trim().toUpperCase().replace(/\.$/, ''); const c = UQC_ALIAS[k] || k; return G1L.uqc.includes(c) && c !== 'OTH' ? c : ''; };
  const stateOf = code => (G1L.states.find(s => s[0] === String(code).padStart(2, '0')) || [])[1] || '';
  const RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
  const nearRate = p => RATES.reduce((b, r) => Math.abs(r - p) < Math.abs(b - p) ? r : b, RATES[0]);

  // ---- Zoho export ----
  const isZoho = rows => { const h = (rows[0] || []).map(x => String(x).trim()); return h.includes('GST Treatment') && h.includes('Item Total') && (h.includes('Invoice Number') || h.includes('Credit Note Number')); };
  function fromZoho(rows, opts = {}) {
    const h = rows[0].map(x => String(x).trim()), col = name => h.indexOf(name), get = (r, name) => { const i = col(name); return i < 0 ? '' : r[i]; };
    const isCN = h.includes('Credit Note Number');
    const out = [], skipped = { outScope: { n: 0, amt: 0 }, draft: { n: 0, amt: 0 }, void: { n: 0, amt: 0 }, month: { n: 0, amt: 0 } };
    let fileTax = 0;
    rows.slice(1).forEach(r => {
      if (!r.some(has)) return;
      const status = String(get(r, isCN ? 'Credit Note Status' : 'Invoice Status')).trim().toLowerCase();
      const cg = n(get(r, 'CGST')), sg = n(get(r, 'SGST')), ig = n(get(r, 'IGST')), cs = n(get(r, 'CESS')), lineTax = cg + sg + ig + cs;
      const incl = /^true$/i.test(String(get(r, 'Is Inclusive Tax')).trim());
      const tx = r2(n(get(r, 'Item Total')) - (incl ? lineTax : 0));
      const d = xdate(get(r, isCN ? 'Credit Note Date' : 'Invoice Date'));
      if (status === 'void') { skipped.void.n++; skipped.void.amt += tx; return; }
      if (status === 'draft' && !opts.drafts) { skipped.draft.n++; skipped.draft.amt += tx; return; }
      if (opts.month && d && d.slice(0, 7) !== opts.month) { skipped.month.n++; skipped.month.amt += tx; return; }
      const supply = String(get(r, 'Supply Type')).trim().toLowerCase();
      if (/out of scope/.test(supply)) { skipped.outScope.n++; skipped.outScope.amt += tx; return; }
      fileTax += lineTax;
      const treat = String(get(r, 'GST Treatment')).trim().toLowerCase();
      const gstin = String(get(r, 'GST Identification Number (GSTIN)') || '').trim().toUpperCase();
      const posCode = (String(get(r, 'Place of Supply(With State Code)')).match(/^(\d{1,2})/) || [])[1] || '';
      const hsn = String(get(r, 'HSN/SAC') || '').trim();
      const o = { d, no: String(get(r, isCN ? 'Credit Note Number' : 'Invoice Number')).trim(), ty: isCN ? 'Credit Note' : 'Invoice',
        name: String(get(r, 'Customer Name') || get(r, 'Company Name') || '').trim(), tx };
      if (gstin && /business_gst|business_sez|deemed/.test(treat)) o.gstin = gstin;
      else if (posCode && treat !== 'overseas') o.state = stateOf(posCode);
      if (hsn) o.hsn = hsn;
      const u = uqcOf(get(r, 'Usage unit')), q = n(get(r, 'Quantity'));
      if (u && q && !/^99/.test(hsn)) { o.qty = q; o.uqc = u; }
      if (/non-gst/.test(supply)) o.nil = 'Non-GST';
      else if (/exempt/.test(supply)) o.nil = 'Exempted';
      else if (/nil/.test(supply)) o.nil = 'Nil rated';
      else o.rate = nearRate(n(get(r, 'CGST Rate %')) + n(get(r, 'SGST Rate %')) || n(get(r, 'IGST Rate %')));
      if (cs) o.cess = cs;
      if (treat === 'overseas') o.exp = ig ? 'Export - With GST' : 'Export - Without GST';
      if (treat === 'business_sez') o.exp = ig ? 'SEZ - With GST' : 'SEZ - Without GST';
      if (isCN) { const oi = String(get(r, 'Associated Invoice Number') || get(r, 'Reference#') || '').trim(); if (oi) o.ono = oi; }
      out.push(o);
    });
    Object.values(skipped).forEach(s => s.amt = r2(s.amt));
    return { lines: out, skipped, fileTax: r2(fileTax), source: isCN ? 'Zoho credit notes' : 'Zoho invoices' };
  }

  // ---- any other sales register (columns guessed by the review engine) ----
  function fromRegister(rows, opts = {}) {
    const p = GR.parseTable(rows, {});
    if (!(p.rows || []).length) return { lines: [], error: p.error || 'No invoice rows found', skipped: {} };
    const skipped = { month: { n: 0, amt: 0 } }; let fileTax = 0;
    const lines = [];
    GR.mergeDocs(p.rows).forEach(x => {
      if (opts.month && x.d && x.d.slice(0, 7) !== opts.month) { skipped.month.n++; skipped.month.amt += Math.abs(x.t || 0); return; }
      const t = Math.abs(x.t || 0), tx = Math.abs((x.ig || 0) + (x.cg || 0) + (x.sg || 0));
      fileTax += tx;
      const o = { d: x.d || '', no: x.i, ty: x.cn ? 'Credit Note' : 'Invoice', name: x.n || '', tx: r2(t) };
      if (x.g) o.gstin = x.g;
      if (t && tx) o.rate = nearRate(tx / t * 100);
      lines.push(o);
    });
    skipped.month.amt = r2(skipped.month.amt);
    return { lines, skipped, fileTax: r2(fileTax), source: 'sales register' };
  }
  function read(sheets, opts) {
    const z = sheets.find(s => isZoho(s.rows || []));
    return z ? fromZoho(z.rows, opts) : fromRegister((sheets[0] || {}).rows || [], opts);
  }
  return { isZoho, fromZoho, fromRegister, read };
})();

/* =====================================================================
   GSTR-1 ENTRY (tab inside GST review)
   ===================================================================== */
const g1Drafts = {};             // unsaved work per client|month, survives tab switches
let g1Tab = 'sales';
addEventListener('beforeunload', e => { if (Object.values(g1Drafts).some(d => d.dirty)) { e.preventDefault(); e.returnValue = ''; } });
const G1_LABEL = { B2B: '4A  B2B — registered customers', B2CL: '5  B2CL — inter-state unregistered above ₹1 lakh', EXP: '6A  Exports', SEZ: '6B  SEZ supplies',
  B2CS: '7  B2CS — other unregistered', NIL: '8  Nil rated / exempted / non-GST', CDNR: '9B  Credit / debit notes — registered', CDNUR: '9B  Credit / debit notes — unregistered',
  RCM: '   of which reverse charge (tax paid by recipient)', B2BA: '9A  Amendments — B2BA (incl. SEZ)', B2CLA: '9A  Amendments — B2CLA', EXPA: '9A  Amendments — EXPA',
  B2CSA: '10  Amendments — B2CSA', CDNRA: '9C  Amendments — CDNRA', CDNURA: '9C  Amendments — CDNURA', AT: '11A  Advances received', AT_ADJ: '11B  Advances adjusted' };

function renderG1(o, { client: c, getRow, save }) {
  const row = getRow(), key = c.id + '|' + row.period;
  if (!g1Drafts[key]) { const g = row.g1 || {}; g1Drafts[key] = { sales: (g.sales || []).map(x => ({ ...x })), amend: (g.amend || []).map(x => ({ ...x })), adv: (g.adv || []).map(x => ({ ...x })), docs: (g.docs || []).map(x => ({ ...x })), dirty: false }; }
  const D = g1Drafts[key];
  const COLS = { sales: G1.SALES, amend: G1.AMEND, adv: G1.ADV };
  const own = String(c.gstin || '').slice(0, 2);
  const calc = () => ({ sales: G1.calcSales(D.sales, own, c.gstin), amend: G1.calcAmend(D.amend, own), adv: G1.calcAdv(D.adv, own) });
  const fmt = x => x == null ? '' : Number(x).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sm = () => G1.summary(D, c);
  o.innerHTML = `<div class="g1-bar"><div class="seg">${[['sales', 'Sales'], ['amend', 'Amendments'], ['adv', 'Advances'], ['docs', 'Documents'], ['sum', 'Summary']]
      .map(([k, l]) => `<button data-g1t="${k}" class="${g1Tab === k ? 'on' : ''}">${l}${k !== 'sum' && k !== 'docs' ? ` <small data-g1n="${k}"></small>` : ''}</button>`).join('')}</div>
      <span class="spacer"></span><span class="small" data-g1st></span>
      <button class="btn sm" data-g1dl>Blank template</button><button class="btn sm" data-g1up>Upload filled template</button><button class="btn sm" data-g1xl>Download Excel</button><button class="btn sm" data-g1json title="JSON for GST portal → GSTR-1 → Prepare offline → Upload">GSTR-1 JSON</button><button class="btn sm" data-g1wb title="Your GST Workings master template, filled for the whole financial year">GST workings (master)</button>
      <button class="btn sm primary" data-g1save>Save</button></div>
    <div data-g1body></div>`;
  const body = $('[data-g1body]', o), st = $('[data-g1st]', o);
  const status = () => {
    const s = sm();
    st.innerHTML = (D.dirty ? '<b class="late">● Unsaved changes</b> · ' : row.g1 ? '<span class="ok-t">✓ Saved</span> · ' : '') + `${s.okCount} OK row${s.okCount === 1 ? '' : 's'}${s.errors ? ` · <b class="late">${s.errors} with errors</b>` : ''}`;
    ['sales', 'amend', 'adv'].forEach(k => { const x = $(`[data-g1n="${k}"]`, o); if (x) x.textContent = D[k].filter(r => Object.keys(r).length).length || ''; });
  };
  const dirty = () => { D.dirty = true; status(); };

  // ----- grid -----
  function cellHtml(col, v, ri) {
    const [k, , kind, w] = col, a = `data-r="${ri}" data-k="${k}" style="width:${w}px"`, val = v == null ? '' : v;
    if (Array.isArray(kind)) return `<select ${a}><option value=""></option>${kind.map(x => `<option ${String(x) === String(val) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    if (kind === 'state') return `<select ${a}><option value=""></option>${G1L.states.map(s => s[1].trim()).map(x => `<option ${x === String(val).trim().toUpperCase() ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    if (kind === 'uqc') return `<select ${a}><option value=""></option>${G1L.uqc.map(x => `<option ${x === val ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    if (kind === 'date') return `<input type="date" ${a} value="${esc(val)}">`;
    return `<input ${a} value="${esc(val)}" ${kind === 'num' ? 'inputmode="decimal" class="r"' : ''} ${kind === 'gstin' ? 'maxlength="15" class="up"' : ''} spellcheck="false" autocomplete="off">`;
  }
  const AUTO = { sales: [['sc', 'State', 'st'], ['io', 'Intra/Inter'], ['ig', 'IGST'], ['cg', 'CGST'], ['sg', 'SGST'], ['val', 'Value'], ['table', 'Table']],
    amend: [['st', 'State'], ['ig', 'IGST'], ['cg', 'CGST'], ['sg', 'SGST'], ['val', 'Value'], ['table', 'Table']], adv: [['st', 'Place of supply'], ['ig', 'IGST'], ['cg', 'CGST'], ['sg', 'SGST']] };
  function autoCells(tab, x) {
    if (!x) return AUTO[tab].map(() => '<td class="g1-auto"></td>').join('') + '<td class="g1-auto"></td>';
    const v = { sc: x.st, st: x.st, io: x.inter ? 'Inter' : 'Intra', ig: fmt(x.ig), cg: fmt(x.cg), sg: fmt(x.sg), val: fmt(x.val), table: x.table || '' };
    return AUTO[tab].map(([k]) => `<td class="g1-auto ${['ig', 'cg', 'sg', 'val'].includes(k) ? 'r' : ''}">${esc(v[k])}</td>`).join('')
      + `<td class="g1-auto g1-chk ${x.ok ? 'ok' : 'bad'}">${esc(x.check)}</td>`;
  }
  function drawGrid(tab) {
    const cols = COLS[tab], rows = D[tab];
    const nShow = Math.max(rows.length + 5, 12);
    while (rows.length < nShow) rows.push({});
    const C = calc()[tab];
    body.innerHTML = `<p class="muted small">${tab === 'sales' ? 'One row per invoice — an invoice with two GST rates = two rows with the same invoice no. Leave GSTIN blank for unregistered customers.'
        : tab === 'amend' ? 'Corrections to invoices / notes reported in an EARLIER month. Enter the full corrected values (not the difference).'
        : 'Amount = advance EXCLUDING GST. 11A = received, invoice not yet issued · 11B = adjusted against an invoice this month.'}
      <b>Tip:</b> copy rows from Excel and paste into the first cell — they fill across.</p>
      <div class="table-wrap g1-wrap"><table class="g1-grid"><thead><tr><th>#</th>${cols.map(([, l, , w]) => `<th style="min-width:${w}px">${esc(l)}</th>`).join('')}
        ${AUTO[tab].map(([, l]) => `<th class="g1-auto">${esc(l)}</th>`).join('')}<th class="g1-auto">Check</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-row="${i}"><td class="muted small">${i + 1}</td>${cols.map(col => `<td>${cellHtml(col, r[col[0]], i)}</td>`).join('')}${autoCells(tab, C[i] && C[i].x)}
        <td><button class="link small danger-t" data-g1del="${i}" title="Remove row" aria-label="Remove row">×</button></td></tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:8px"><button class="btn sm" data-g1add>+ 20 rows</button><span class="muted small">Blank rows are ignored.</span></div>`;
  }
  let t;
  const refreshAuto = tab => {
    clearTimeout(t); t = setTimeout(() => {
      const C = calc()[tab];
      $$('tbody tr', body).forEach(tr => { const i = +tr.dataset.row; const cells = $$('.g1-auto', tr); const tmp = document.createElement('tr'); tmp.innerHTML = autoCells(tab, C[i] && C[i].x);
        $$('td', tmp).forEach((td, j) => { if (cells[j]) { cells[j].className = td.className; cells[j].textContent = td.textContent; } }); });
      status();
    }, 250);
  };
  const setVal = (tab, i, k, v) => {
    const col = COLS[tab].find(c => c[0] === k); if (!col) return;
    const kind = col[2]; let x = typeof v === 'string' ? v.trim() : v;
    if (kind === 'num') x = x === '' ? '' : (isFinite(GR.amt(x)) ? GR.amt(x) : x);
    if (kind === 'gstin') x = String(x).toUpperCase();
    if (kind === 'date' && x) x = /^\d+(\.\d+)?$/.test(String(x)) && +x > 20000 ? new Date(Math.round((+x - 25569) * 864e5)).toISOString().slice(0, 10) : GR.toDate(x);
    if (Array.isArray(kind) && x) { const m = kind.find(o => String(o).toLowerCase() === String(x).toLowerCase() || (typeof o === 'number' && +x === o)); x = m != null ? m : x; }
    if (kind === 'state' && x) x = String(x).toUpperCase().replace(/^\d+-/, '');
    if (kind === 'uqc' && x) x = String(x).toUpperCase().slice(0, 3);
    while (D[tab].length <= i) D[tab].push({});
    if (x === '' || x == null) delete D[tab][i][k]; else D[tab][i][k] = x;
  };
  body.addEventListener('input', e => { const el = e.target; if (!el.dataset.k) return; setVal(g1Tab, +el.dataset.r, el.dataset.k, el.value); dirty(); refreshAuto(g1Tab); });
  body.addEventListener('change', e => { const el = e.target; if (!el.dataset.k) return; setVal(g1Tab, +el.dataset.r, el.dataset.k, el.value); if (el.classList.contains('up')) el.value = el.value.toUpperCase(); dirty(); refreshAuto(g1Tab); });
  body.addEventListener('paste', e => {
    const el = e.target; if (!el.dataset || !el.dataset.k || !COLS[g1Tab]) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const cols = COLS[g1Tab], c0 = cols.findIndex(c => c[0] === el.dataset.k), r0 = +el.dataset.r;
    lines.forEach((cells, di) => cells.forEach((v, dj) => { const col = cols[c0 + dj]; if (col) setVal(g1Tab, r0 + di, col[0], v); }));
    dirty(); drawGrid(g1Tab); toast(`${lines.length} row${lines.length > 1 ? 's' : ''} pasted`);
  });

  // ----- documents -----
  function drawDocs() {
    const s = sm();
    body.innerHTML = `<p class="muted small">Table 13. Grey rows fill themselves from the entries (first and last number, count). Type the others. Enter cancelled numbers where needed.</p>
      <div class="table-wrap"><table class="g1-docs"><thead><tr><th>Nature of document</th><th>From</th><th>To</th><th class="r">Total</th><th class="r">Cancelled</th><th class="r">Net issued</th></tr></thead><tbody>
      ${s.docs.map((d, i) => `<tr class="${d.auto ? 'g1-autorow' : ''}"><td>${esc(d.nat)}</td>
        ${d.auto ? `<td>${esc(d.from)}</td><td>${esc(d.to)}</td><td class="r">${d.total}</td>` : ['from', 'to', 'total'].map(k => `<td><input data-dn="${i}" data-dk="${k}" value="${esc(d[k] || '')}" ${k === 'total' ? 'inputmode="numeric" class="r"' : ''}></td>`).join('')}
        <td><input data-dn="${i}" data-dk="cancelled" value="${esc(d.cancelled || '')}" inputmode="numeric" class="r" style="width:80px"></td><td class="r">${d.net || ''}</td></tr>`).join('')}</tbody></table></div>`;
    body.oninput = null;
  }
  body.addEventListener('input', e => {
    const el = e.target; if (el.dataset.dn == null) return;
    const nat = G1L.docs[+el.dataset.dn]; let d = D.docs.find(x => x.nat === nat); if (!d) { d = { nat }; D.docs.push(d); }
    d[el.dataset.dk] = el.dataset.dk === 'total' || el.dataset.dk === 'cancelled' ? GR.amt(el.value) : el.value.trim(); dirty();
  });

  // ----- summary -----
  function drawSummary() {
    const s = sm(), Z = { n: 0, t: 0, ig: 0, cg: 0, sg: 0, cs: 0 }, tx = x => (x.ig || 0) + (x.cg || 0) + (x.sg || 0) + (x.cs || 0);
    const line = (l, x, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="r">${x.n || 0}</td><td class="r">${fmt(x.t)}</td><td class="r">${fmt(x.ig)}</td><td class="r">${fmt(x.cg)}</td><td class="r">${fmt(x.sg)}</td><td class="r">${fmt(x.cs)}</td><td class="r"><b>${fmt(tx(x))}</b></td></tr>`;
    const th = f => `<thead><tr><th>${f}</th><th class="r">Rows</th><th class="r">Taxable / value</th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Cess</th><th class="r">Total tax</th></tr></thead>`;
    const errs = [];
    [['Sales', s.S], ['Amendments', s.A], ['Advances', s.V]].forEach(([nm, L]) => L.forEach((o, i) => { if (o.x && !o.x.ok) errs.push(`${nm} row ${i + 1}: ${o.x.check}`); }));
    const order = ['B2B', 'B2CL', 'EXP', 'SEZ', 'B2CS', 'NIL', 'CDNR', 'CDNUR', 'RCM', 'B2BA', 'B2CLA', 'EXPA', 'B2CSA', 'CDNRA', 'CDNURA', 'AT', 'AT_ADJ'];
    const t8 = (io, rg, k) => fmt(s.t8[`${io}|${rg}|${k}`] || 0);
    body.innerHTML = `${errs.length ? `<div class="note warn small"><b>${errs.length} row(s) have errors and are left out of the totals:</b><br>${errs.slice(0, 15).map(esc).join('<br>')}${errs.length > 15 ? '<br>…' : ''}</div>` : '<p class="ok-t small">✓ All rows passed the checks</p>'}
      <h4>1. Table-wise</h4><div class="table-wrap"><table class="gr-t">${th('GSTR-1 table')}<tbody>
        ${order.filter(k => s.tables[k] || ['B2B', 'B2CS', 'CDNR'].includes(k)).map(k => line(G1_LABEL[k], s.tables[k] || Z, k === 'RCM' ? 'sub' : '')).join('')}
        ${line('<b>Tax payable this month</b> (excl. reverse charge, net of notes)', s.payable, 'tot')}</tbody></table></div>
      <p class="muted small">On the portal, add 11A tax and deduct 11B tax for advances; amendments change only the difference.</p>
      <h4>2. Rate-wise (net of credit notes)</h4><div class="table-wrap"><table class="gr-t">${th('GST rate %')}<tbody>
        ${Object.keys(s.rateW).sort((a, b) => a - b).map(k => line(k + '%', s.rateW[k])).join('') || '<tr><td colspan="8" class="muted">—</td></tr>'}</tbody></table></div>
      <h4>3. B2CS — state-wise and rate-wise (Table 7)</h4><div class="table-wrap"><table class="gr-t">${th('Place of supply · rate')}<tbody>
        ${Object.entries(s.b2cs).map(([k, x]) => line(k.replace('|', ' · ') + '%', x)).join('') || '<tr><td colspan="8" class="muted">No B2CS supplies</td></tr>'}</tbody></table></div>
      <h4>4. Nil rated, exempted and non-GST (Table 8)</h4><div class="table-wrap"><table class="gr-t"><thead><tr><th></th><th class="r">Nil rated</th><th class="r">Exempted</th><th class="r">Non-GST</th></tr></thead><tbody>
        ${[['Inter-state to registered', 'Inter', 'Reg'], ['Intra-state to registered', 'Intra', 'Reg'], ['Inter-state to unregistered', 'Inter', 'Unreg'], ['Intra-state to unregistered', 'Intra', 'Unreg']]
          .map(([l, io, rg]) => `<tr><td>${l}</td>${['Nil rated', 'Exempted', 'Non-GST'].map(k => `<td class="r">${t8(io, rg, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <h4>5. HSN summary (Table 12)</h4><div class="table-wrap"><table class="gr-t"><thead><tr><th>B2B / B2C</th><th>HSN / SAC</th><th class="r">Rate</th><th>UQC</th><th class="r">Qty</th><th class="r">Taxable</th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Cess</th></tr></thead><tbody>
        ${Object.entries(s.hsn).sort().map(([k, x]) => { const [tb, h, r, u] = k.split('|'); return `<tr><td>${tb}</td><td>${esc(h)}</td><td class="r">${r}%</td><td>${esc(u)}</td><td class="r">${fmt(x.q)}</td><td class="r">${fmt(x.t)}</td><td class="r">${fmt(x.ig)}</td><td class="r">${fmt(x.cg)}</td><td class="r">${fmt(x.sg)}</td><td class="r">${fmt(x.cs)}</td></tr>`; }).join('') || '<tr><td colspan="10" class="muted">—</td></tr>'}</tbody></table></div>
      <h4>6. Documents issued (Table 13)</h4><div class="table-wrap"><table class="gr-t"><thead><tr><th>Nature of document</th><th>From</th><th>To</th><th class="r">Total</th><th class="r">Cancelled</th><th class="r">Net</th></tr></thead><tbody>
        ${s.docs.filter(d => d.total).map(d => `<tr><td>${esc(d.nat)}</td><td>${esc(d.from)}</td><td>${esc(d.to)}</td><td class="r">${d.total}</td><td class="r">${d.cancelled || 0}</td><td class="r">${d.net}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">—</td></tr>'}</tbody></table></div>`;
  }
  const draw = () => { if (COLS[g1Tab]) drawGrid(g1Tab); else if (g1Tab === 'docs') drawDocs(); else drawSummary(); status(); };

  // ----- toolbar -----
  o.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.g1t) { g1Tab = d.g1t; $$('[data-g1t]', o).forEach(x => x.classList.toggle('on', x === b)); draw(); }
    if (d.g1add) { for (let i = 0; i < 20; i++) D[g1Tab].push({}); drawGrid(g1Tab); }
    if (d.g1del != null) { D[g1Tab].splice(+d.g1del, 1); dirty(); drawGrid(g1Tab); }
    if ('g1dl' in d) { const a = document.createElement('a'); a.href = 'gstr1-entry-template.xlsx'; a.download = `GSTR1-entry-${slug(c.name)}-${row.period.slice(0, 7)}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); }
    if ('g1up' in d) {
      const f = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!f) return;
      try {
        const g = G1.fromWorkbook(await readSheets(f));
        if (g.error) return toast(g.error, true);
        if (g.gstin && g.gstin !== c.gstin && !confirm(`The template's Setup sheet has GSTIN ${g.gstin}, but this client is ${c.gstin}. Use it anyway?`)) return;
        if ((D.sales.some(r => Object.keys(r).length) || D.amend.some(r => Object.keys(r).length)) && !confirm('Replace the rows already entered here with the rows from this file?')) return;
        Object.assign(D, { sales: g.sales, amend: g.amend, adv: g.adv, docs: g.docs.length ? g.docs : D.docs }); dirty(); draw();
        toast(`${g.sales.length} sales, ${g.amend.length} amendment, ${g.adv.length} advance rows loaded — check and Save`);
      } catch (err) { toast('Could not read the file: ' + friendly(err), true); }
    }
    if ('g1wb' in d) {
      if (D.dirty && !confirm('You have unsaved changes. The workings use the SAVED data — continue without saving?')) return;
      b.disabled = true; try { await downloadGstWorkings(c, row.period); } catch (err) { toast(friendly(err), true); } finally { b.disabled = false; }
    }
    if ('g1xl' in d) {
      const X = await loadXlsx(), s = sm(), C = calc(), wbk = X.utils.book_new();
      const sheet = (tab, name) => { const cols = COLS[tab], au = AUTO[tab];
        const aoa = [[...cols.map(x => x[1]), ...au.map(x => x[1]), 'Check']];
        C[tab].forEach(({ row: r, x }) => { if (!x) return; const v = { sc: x.st, st: x.st, io: x.inter ? 'Inter' : 'Intra', ig: x.ig, cg: x.cg, sg: x.sg, val: x.val, table: x.table };
          aoa.push([...cols.map(col => r[col[0]] ?? ''), ...au.map(([k]) => v[k] ?? ''), x.check]); });
        X.utils.book_append_sheet(wbk, X.utils.aoa_to_sheet(aoa), name); };
      sheet('sales', 'Sales'); sheet('amend', 'Amendments'); sheet('adv', 'Advances');
      const sum = [['GSTR-1 table', 'Rows', 'Taxable / value', 'IGST', 'CGST', 'SGST', 'Cess']];
      Object.entries(s.tables).forEach(([k, x]) => sum.push([G1_LABEL[k] || k, x.n, x.t, x.ig, x.cg, x.sg, x.cs]));
      sum.push(['Tax payable this month', '', s.payable.t, s.payable.ig, s.payable.cg, s.payable.sg, s.payable.cs], [], ['HSN', 'B2B/B2C', 'Rate', 'UQC', 'Qty', 'Taxable', 'IGST', 'CGST', 'SGST', 'Cess']);
      Object.entries(s.hsn).forEach(([k, x]) => { const [tb, h, r, u] = k.split('|'); sum.push([h, tb, +r, u, x.q, x.t, x.ig, x.cg, x.sg, x.cs]); });
      sum.push([], ['Documents', 'From', 'To', 'Total', 'Cancelled', 'Net']); s.docs.filter(x => x.total).forEach(x => sum.push([x.nat, x.from, x.to, x.total, x.cancelled, x.net]));
      X.utils.book_append_sheet(wbk, X.utils.aoa_to_sheet(sum), 'Summary');
      X.writeFile(wbk, `GSTR1-${slug(c.name)}-${row.period.slice(0, 7)}.xlsx`);
    }
    if ('g1json' in d) {
      const R = g1json.build(D, c, row.period);
      const fname = `GSTR1_${c.gstin}_${R.json.fp}.json`;
      if (R.errors.length) { modal('GSTR-1 JSON – fix these first', `<p>${R.errors.length} row${R.errors.length > 1 ? 's have' : ' has'} errors. The portal would reject the file, so fix them in the grid (Check column) and try again.</p><p class="note warn small">${R.errors.slice(0, 25).map(esc).join('<br>')}${R.errors.length > 25 ? '<br>…' : ''}</p>`); return; }
      if (!R.count && !R.json.nil && !R.json.at) return toast('Nothing to export — add sales rows first', true);
      const J = R.json, n = k => (J[k] || []).reduce((s, x) => s + ((x.inv || x.nt || [x]).length), 0);
      modal('GSTR-1 JSON for the GST portal', `<p><b>${esc(c.name)}</b> · ${esc(c.gstin)} · return period <b>${esc(J.fp.slice(0, 2) + '/' + J.fp.slice(2))}</b></p>
        <div class="table-wrap"><table><thead><tr><th>Table</th><th class="r">Documents / rows</th></tr></thead><tbody>
        ${[['4A B2B (incl. SEZ 6B)', n('b2b')], ['5 B2CL', n('b2cl')], ['6A Exports', n('exp')], ['7 B2CS', (J.b2cs || []).length], ['9B Credit / debit notes (registered)', n('cdnr')], ['9B Credit / debit notes (unregistered)', (J.cdnur || []).length],
          ['8 Nil / exempt / non-GST', ((J.nil || {}).inv || []).length], ['11A / 11B Advances', (J.at || []).length + (J.txpd || []).length], ['12 HSN (B2B + B2C)', ((J.hsn || {}).hsn_b2b || []).length + ((J.hsn || {}).hsn_b2c || []).length], ['13 Documents issued', ((J.doc_issue || {}).doc_det || []).length]]
          .filter(x => x[1]).map(([l, v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join('')}</tbody></table></div>
        ${D.dirty ? '<p class="note warn small">You have unsaved changes — the file uses what is on screen now. Save as well.</p>' : ''}
        ${R.notes.length ? `<p class="note small">${R.notes.map(esc).join('<br>')}</p>` : ''}
        <p class="muted small">Upload: GST portal → Returns → GSTR-1 → <b>Prepare offline</b> → Upload → choose this file. Wait for "processed", then check the summary against the tracker before filing.</p>`, {
        saveText: 'Download JSON', onSave: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(J)], { type: 'application/json' })); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Saved ' + fname); } });   // no BOM: the portal rejects it
    }
    if ('g1save' in d) {
      const clean = list => list.filter(r => Object.keys(r).length);
      const g1 = { sales: clean(D.sales), amend: clean(D.amend), adv: clean(D.adv), docs: D.docs.filter(x => x.from || x.to || x.total || x.cancelled), at: new Date().toISOString(), by: me.id };
      const reg = G1.toRegister(G1.calcSales(g1.sales, own, c.gstin));
      const cur = getRow().sales;
      const patch = { g1 };
      if (!cur || cur.source === 'g1' || confirm('Also use these entries as the sales register for the draft GSTR-3B? (This replaces the uploaded sales register.)'))
        patch.sales = reg.length ? { rows: reg, file: 'GSTR-1 entry', source: 'g1', at: g1.at, by: me.id } : null;
      b.disabled = true;
      try { await save(patch); D.dirty = false; toast('GSTR-1 entry saved'); }
      catch (err) { toast(friendly(err), true); }
      finally { b.disabled = false; }
    }
  });
  draw();
}


/* =====================================================================
   GST WORKINGS – MASTER TEMPLATE filler (firm's own workbook, formats kept)
   data = { client:{name,gstin,trade}, fy:'2026-27', month:'October', months:[{period,g1,sales,purchases,gstr2b,gstr3b,status}],
            notices:[...], g1tasks:[{period,status,filed_on,arn}], preparedBy, verifiedBy }
   ===================================================================== */
const GW_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
async function fillGstWorkings(XP, templateBytes, data) {
  const wb = await XP.fromDataAsync(templateBytes);
  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const fyStart = +String(data.fy).slice(0, 4);
  const monthName = period => GW_MONTHS[(+period.slice(5, 7) + 8) % 12];
  const mIdx = period => (+period.slice(5, 7) + 8) % 12;                       // April = 0
  const toDate = s => { if (!s) return null; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const set = (sh, addr, v) => { if (v === undefined) return; sh.cell(addr).value(v === null ? undefined : v); };

  // ---------- Home ----------
  const home = wb.sheet('Home');
  set(home, 'B3', data.client.name || ''); set(home, 'B4', data.client.gstin || ''); set(home, 'B5', data.fy); set(home, 'B6', data.client.trade || '');

  // ---------- GSTR-1 (all months) ----------
  const g = wb.sheet('GSTR-1');
  let r = 3, sno = 0;
  const dateStyle = g.cell('D3')._styleId;                                     // template's own date format (no new styles)
  const turnover = Array(12).fill(null);
  const months = [...data.months].sort((a, b) => a.period.localeCompare(b.period));
  for (const m of months) {
    const mi = mIdx(m.period), mName = GW_MONTHS[mi];
    let lines = [];
    if (m.g1 && (m.g1.sales || []).length) {
      const own = String(data.client.gstin || '').slice(0, 2);
      lines = G1.calcSales(m.g1.sales, own, data.client.gstin).filter(o => o.x && o.x.ok).map(({ row: s, x }) => {
        const exp = s.exp || '', wp = /With GST/.test(exp) && !/Without/.test(exp);
        const st = /^SEZ/.test(exp) ? (wp ? 'SEZWP' : 'SEZWOP') : /^Export/.test(exp) ? (wp ? 'EXPWP' : 'EXPWOP')
          : ['B2CL'].includes(x.table) ? 'B2CL' : (has(s.gstin) ? 'B2B' : 'B2C');
        return { no: s.no, d: s.d, gstin: (s.gstin || '').toUpperCase(), name: s.name || '', hsn: s.hsn || '', qty: has(s.qty) ? +s.qty : null, uqc: s.uqc || '',
          pos: `${x.sc}-${x.st}`, tx: r2(x.amt), rate: has(s.nil) ? 0 : +s.rate || 0, ig: x.ig, cg: x.cg, sg: x.sg,
          te: s.nil === 'Nil rated' ? 'Nil' : s.nil === 'Exempted' ? 'Exempted' : s.nil === 'Non-GST' ? 'Non-GST' : 'Taxable',
          tms: /^99/.test(String(s.hsn)) ? 'Services' : '', rc: s.rc === 'Yes' ? 'Yes' : 'No', reg: has(s.gstin) ? 'Registered' : 'Unregistered',
          sales: x.type === 'Credit Note' ? 'Sales Return' : 'Sales', doc: x.type, st, signedTx: x.sign * x.amt };
      });
    } else if (m.sales && (m.sales.rows || []).length) {           // uploaded sales register (no GSTR-1 entry)
      lines = m.sales.rows.map(s => ({ no: s.i, d: s.d, gstin: s.g || '', name: s.n || '', hsn: '', qty: null, uqc: '', pos: '', tx: Math.abs(s.t), rate: null,
        ig: Math.abs(s.ig), cg: Math.abs(s.cg), sg: Math.abs(s.sg), te: 'Taxable', tms: '', rc: 'No', reg: s.g ? 'Registered' : 'Unregistered',
        sales: s.cn ? 'Sales Return' : 'Sales', doc: s.cn ? 'Credit Note' : 'Invoice', st: s.g ? 'B2B' : 'B2C', signedTx: s.t }));
    }
    if (!lines.length) continue;
    turnover[mi] = r2(lines.reduce((a, l) => a + l.signedTx, 0));
    for (const l of lines) {
      sno++;
      const vals = { A: mName, B: sno, C: l.no, E: l.gstin || undefined, F: l.name, G: l.hsn || undefined, H: l.qty ?? undefined, I: l.uqc || undefined, J: l.pos || undefined,
        K: l.tx, L: l.rate ?? undefined, M: l.ig, N: l.cg, O: l.sg, Q: l.te, S: l.tms || undefined, T: l.rc, U: l.reg, V: l.sales, W: l.doc, X: l.st, Y: 'NA' };
      for (const [c, v] of Object.entries(vals)) if (v !== undefined && v !== '') g.cell(`${c}${r}`).value(v);
      const dt = toDate(l.d); if (dt) { const dc = g.cell(`D${r}`); dc.value(dt); dc._styleId = dateStyle; }
      g.cell(`P${r}`).formula(`K${r}+SUM(M${r}:O${r})`);
      g.cell(`Z${r}`).formula(`IF(Q${r}="Exempted","Exempted",IF(Q${r}="Nil","Nil",IF(Q${r}="Non-GST","Non-GST",IF(OR(X${r}="SEZWP",X${r}="SEZWOP",X${r}="EXPWP",X${r}="EXPWOP",X${r}="DE"),"Zero Rated","Taxable"))))`);
      g.cell(`AA${r}`).formula(`IF(W${r}="Debit Note","Debit Note",IF(W${r}="Credit Note","Credit Note","Invoice"))`);
      r++; if (r > 2000) break;
    }
  }

  // ---------- Turnover summary ----------
  const ts = wb.sheet('Turnover summary');
  for (let i = 0; i < 12; i++) {
    ts.cell(`A${3 + i}`).value(new Date(fyStart + (i >= 9 ? 1 : 0), (i + 3) % 12, 1));
    ts.cell(`B${3 + i}`).value(turnover[i] == null ? undefined : turnover[i]);
  }

  // ---------- MonthlyInputs (2B / RCM / books) ----------
  const mi = wb.sheet('MonthlyInputs');
  const col = i => String.fromCharCode(67 + i);                                   // C..N
  const sum = (rows, f) => rows.filter(f).reduce((a, x) => ({ t: a.t + Math.abs(x.t || 0), ig: a.ig + Math.abs(x.ig || 0), cg: a.cg + Math.abs(x.cg || 0), sg: a.sg + Math.abs(x.sg || 0) }), { t: 0, ig: 0, cg: 0, sg: 0 });
  const put = (row, i, v) => mi.cell(`${col(i)}${row}`).value(r2(v));
  for (const m of months) {
    const i = mIdx(m.period), B = (m.gstr2b && m.gstr2b.rows) || [];
    if (B.length) {
      const isCdn = x => /CDN/.test(x.src || ''), isImp = x => /IMP/.test(x.src || '');
      const actual = sum(B, x => !isCdn(x) && !isImp(x) && !x.na && !x.rc), dn = sum(B, x => isCdn(x) && !x.cn && !x.na), cn = sum(B, x => isCdn(x) && x.cn && !x.na);
      const imp = sum(B, x => isImp(x)), inel = sum(B, x => x.na), rcm = sum(B, x => x.rc && !x.na);
      [[11, actual], [14, dn], [20, imp], [23, inel], [29, rcm], [32, cn]].forEach(([row, v]) => { put(row, i, v.ig); put(row + 1, i, v.cg); put(row + 2, i, v.sg); });
      put(5, i, rcm.t);                                                            // RCM u/s 9(3) – tax value
      [[43, actual], [47, imp], [58, cn], [62, dn]].forEach(([row, v]) => { put(row, i, v.t); put(row + 1, i, v.ig); put(row + 2, i, v.cg); put(row + 3, i, v.sg); });
    }
    const P = (m.purchases && m.purchases.rows) || [];
    if (P.length) { const w = P.filter(x => !x.rc).reduce((a, x) => ({ ig: a.ig + (x.ig || 0), cg: a.cg + (x.cg || 0), sg: a.sg + (x.sg || 0) }), { ig: 0, cg: 0, sg: 0 }); put(35, i, w.ig); put(36, i, w.cg); put(37, i, w.sg); }
  }

  // ---------- Reconciliation: GSTR-3B liability per month ----------
  const rc = wb.sheet('Reconciliation');
  set(rc, 'A12', `Tax Period: FY ${data.fy}`);
  for (const m of months) {
    const t = m.gstr3b && m.gstr3b.t31a; if (!t) continue;
    const row = 16 + mIdx(m.period);
    rc.cell(`G${row}`).value(r2(t.ig)); rc.cell(`H${row}`).value(r2(t.cg)); rc.cell(`I${row}`).value(r2(t.sg)); rc.cell(`J${row}`).value(r2(t.cs));
  }

  // ---------- Summary month + Checklist ----------
  set(wb.sheet('Summary(1&3B)'), 'B3', data.month);
  const ck = wb.sheet('Checklist'), selPeriod = months.find(m => monthName(m.period) === data.month);
  set(ck, 'C1', `Client Name: ${data.client.name || ''}`); set(ck, 'C2', `GSTIN: ${data.client.gstin || ''}`);
  set(ck, 'D1', `Month-Year: ${data.month} ${GW_MONTHS.indexOf(data.month) >= 9 ? fyStart + 1 : fyStart}`);
  set(ck, 'C38', selPeriod && (selPeriod.g1 || selPeriod.sales) ? 'Done' : 'Pending');
  const t1 = (data.g1tasks || []).find(t => monthName(t.period) === data.month);
  if (t1) { set(ck, 'C43', t1.status === 'Filed' ? 'Done' : 'Pending'); if (t1.filed_on) set(ck, 'D43', `Filed ${t1.filed_on.split('-').reverse().join('-')}${t1.arn ? ' · ARN ' + t1.arn : ''}`); }
  if (selPeriod && selPeriod.status === 'Verified') set(ck, 'C42', 'Done');
  if (data.preparedBy) set(ck, 'B46', `Prepared by ${data.preparedBy}`);
  if (data.verifiedBy) set(ck, 'E47', `Verified by ${data.verifiedBy}`);

  // ---------- Notices Summary ----------
  const ns = wb.sheet('Notices Summary');
  (data.notices || []).forEach((n, k) => {
    const row = 3 + k, d = n.notice_date ? toDate(n.notice_date) : null;
    set(ns, `A${row}`, d ? `${GW_MONTHS[(d.getMonth() + 9) % 12]} ${d.getFullYear()}` : '-');
    set(ns, `B${row}`, [n.dept, n.notice_type, n.ref_no && 'Ref ' + n.ref_no, n.period && 'Period ' + n.period, n.amount ? 'Amount ₹' + Number(n.amount).toLocaleString('en-IN') : '',
      n.reply_due && 'Reply due ' + n.reply_due.split('-').reverse().join('-')].filter(Boolean).join(' · '));
    set(ns, `C${row}`, n.status === 'Replied' || n.status === 'Closed' ? `Replied${n.replied_on ? ' on ' + n.replied_on.split('-').reverse().join('-') : ''}${n.ack_no ? ' · Ack ' + n.ack_no : ''}` : (n.remarks || 'Pending'));
    set(ns, `D${row}`, n.status === 'Hearing' ? `Hearing${n.hearing_date ? ' on ' + n.hearing_date.split('-').reverse().join('-') : ''}` : n.status);
  });

  // Excel recalculates every formula when the file is opened
  const calc = wb._node.children.find(c => c.name === 'calcPr');
  if (calc) calc.attributes.fullCalcOnLoad = '1'; else wb._node.children.push({ name: 'calcPr', attributes: { fullCalcOnLoad: '1' }, children: [] });
  return wb.outputAsync();
}

// ----- "GST workings (master)" download: the firm's own master workbook, filled for the whole financial year -----
async function loadXlsxPopulate() {
  if (window.XlsxPopulate) return window.XlsxPopulate;
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'xlsx-populate.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Could not load the workbook helper')); document.head.appendChild(s); });
  return window.XlsxPopulate;
}
async function downloadGstWorkings(c, period) {
  const y = +period.slice(0, 4), m = +period.slice(5, 7), fyStart = m >= 4 ? y : y - 1, fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
  toast('Preparing GST workings for FY ' + fy + '…');
  const [XP, tpl, gm, nt, tk] = await Promise.all([
    loadXlsxPopulate(),
    fetch('gst-workings-master.xlsx', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Master template not found on the site'); return r.arrayBuffer(); }),
    must(sb.from('gst_months').select('*').eq('client_id', c.id).gte('period', `${fyStart}-04-01`).lte('period', `${fyStart + 1}-03-01`).order('period')),
    safe(sb.from('notices').select('*').eq('client_id', c.id).order('notice_date')),
    safe(sb.from('tasks').select('return_name,period,status,filed_on,arn').eq('client_id', c.id).ilike('return_name', 'GSTR-1%').limit(500))
  ]);
  const months = (gm.data || []).map(r => ({ period: r.period, g1: r.g1, sales: r.sales, purchases: r.purchases, gstr2b: r.gstr2b, gstr3b: r.gstr3b, status: r.status }));
  if (!months.length) return toast('No GST data saved for this client in FY ' + fy, true);
  const g1tasks = (tk.data || []).map(t => ({ ...t, period: (periodToMonth(t.period) || '') + '-01' })).filter(t => t.period.length === 10 && t.period >= `${fyStart}-04-01` && t.period <= `${fyStart + 1}-03-01`);
  const sel = (gm.data || []).find(r => r.period === period);
  const out = await fillGstWorkings(XP, new Uint8Array(tpl), {
    client: { name: c.name, gstin: c.gstin, trade: c.trade_name || '' }, fy, month: GW_MONTHS[(m + 8) % 12], months,
    notices: nt.error ? [] : nt.data || [], g1tasks, preparedBy: me.full_name || me.email, verifiedBy: sel && sel.verified_by ? profName(sel.verified_by) : '' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `GST Workings - ${c.name} - FY ${fy}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`GST workings downloaded — ${months.length} month${months.length > 1 ? 's' : ''} of FY ${fy}`);
}

/* =====================================================================
   v17 · SESSION 1: RENEWALS · TAX PAYMENT INTIMATION · CLIENT ONBOARDING
   ===================================================================== */
const firstEmail = c => ((c && c.email) || '').split(/[,;\s]+/).filter(Boolean)[0] || '';
const mailUrl = (to, subject, body) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const notReady = (v, title, sql) => { v.innerHTML = `<div class="card"><h3>${esc(title)}</h3><p class="note">Not set up yet — run <b>${esc(sql)}</b> in Supabase → SQL Editor, then reload.</p></div>`; };
const myClients = () => clients.filter(c => c.active && (isManager() || c.default_staff === me.id));
// any date from Excel / CSV: serial number, yyyy-mm-dd, dd/mm/yyyy, dd-mm-yy, 31 Mar 2027
function anyDate(v) {
  if (v === '' || v == null) return null;
  const ok = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m) && y > 1990 && y < 2200) ? `${y}-${pad(m)}-${pad(d)}` : undefined;
  if (typeof v === 'number') { if (v < 20000 || v > 90000) return undefined; const d = new Date(Math.round((v - 25569) * 864e5)); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  if (v instanceof Date) return ok(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/); if (m) return ok(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3})[a-z]*[\s\-,]+(\d{2}|\d{4})$/);
  if (m) { const i = MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); return i < 0 ? undefined : ok(m[3].length === 2 ? 2000 + +m[3] : +m[3], i + 1, +m[1]); }
  return undefined;
}
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1 + n, 1); return iso(new Date(t.getFullYear(), t.getMonth(), Math.min(d, lastDay(t.getFullYear(), t.getMonth() + 1)))); };
const fyEndOf = s => { const [y, m] = s.split('-').map(Number); return `${m >= 4 ? y + 1 : y}-03-31`; };

/* ---------------- 1. RENEWALS & EXPIRY ---------------- */
const RN_KINDS = {
  'DSC': { months: 24, hint: 'Class 3 DSC — valid 1, 2 or 3 years (12 / 24 / 36 months). Enter the holder name (director / partner / proprietor).',
    ask: 'For the new DSC, please share the holder\'s PAN, Aadhaar, a photo, email ID and mobile number. Video / OTP verification is needed at the time of issue.' },
  'GST LUT': { months: 12, fy: true, hint: 'LUT (RFD-11) is valid for one financial year (to 31 March). File the next year\'s LUT before 1 April.',
    ask: 'We will file the Letter of Undertaking (LUT) for the next financial year so that exports / SEZ supplies continue without IGST. Please confirm.' },
  'Udyam': { months: 0, hint: 'Udyam registration has no expiry. Leave the expiry blank, or set a yearly review date to update turnover / investment.',
    ask: 'Please confirm whether there is any change in your business details, so that we can update the Udyam registration.' },
  'IEC': { months: 12, hint: 'IEC must be updated on DGFT every year between April and June, or it is de-activated. Use 30 June as the date.',
    ask: 'Your IEC has to be updated on the DGFT portal (yearly, April–June) to keep it active. Please confirm, or share any change in details.' },
  'FSSAI': { months: 12, hint: 'FSSAI licence / registration is issued for 1 to 5 years. Apply for renewal at least 30 days before expiry.',
    ask: 'Please share the documents for the FSSAI renewal (latest premises / product details and any changes), so that we can apply before it expires.' },
  'Trade licence': { months: 12, hint: 'Local body (Corporation / Municipality) trade licence — usually renewed every year.',
    ask: 'Please share last year\'s licence copy and the property tax receipt, so that we can renew the trade licence.' },
  'Professional tax': { months: 6, hint: 'Tamil Nadu professional tax is paid half-yearly (by 30 September and 31 March).',
    ask: 'Please share the employee list / salary details for the half-year, so that we can pay the professional tax on time.' }
};
const RN_STATUSES = ['Active', 'Renewal in progress', 'Not renewing', 'Closed'];
const rnLive = r => r.status === 'Active' || r.status === 'Renewal in progress';
function rnStage(r, t = today()) {
  if (!r.expires_on || !rnLive(r)) return { days: null, stage: null, due: false };
  const days = daysFrom(t, r.expires_on);
  const stage = days < 0 ? 0 : days <= 7 ? 7 : days <= 15 ? 15 : days <= 30 ? 30 : null;
  const sent = stage != null ? (r.reminders || {})[String(stage)] : null;
  return { days, stage, due: stage != null && !sent, sent };
}
const rnWhat = r => r.kind + (r.holder ? ` (${r.holder})` : '') + (r.ref_no ? ` – ${r.ref_no}` : '');
function rnMsg(r, c) {
  const d = r.expires_on ? daysFrom(today(), r.expires_on) : null;
  const when = d == null ? 'is due for review' : d < 0 ? `expired on ${fmtDate(r.expires_on)}` : `is due for renewal on ${fmtDate(r.expires_on)} (${d} day${d === 1 ? '' : 's'} left)`;
  return `Dear ${c.contact_person || c.name},\nYour ${rnWhat(r)} ${when}.\n${(RN_KINDS[r.kind] || {}).ask || 'Please confirm, and share the documents needed, so that we can renew it on time.'}\n- ${firmName()}`;
}
function rnKind(s) {
  const x = lc(s);
  if (!x) return '';
  if (/^dsc|digital sign/.test(x)) return 'DSC';
  if (/\blut\b|rfd-?11|undertaking/.test(x)) return 'GST LUT';
  if (/udyam|msme|udyog/.test(x)) return 'Udyam';
  if (/^iec|import.*export/.test(x)) return 'IEC';
  if (/fssai|food/.test(x)) return 'FSSAI';
  if (/trade/.test(x)) return 'Trade licence';
  if (/^pt$|profession/.test(x)) return 'Professional tax';
  return String(s).trim();
}
let rnf = { win: 'due', kind: '', staff: '', q: '' };
VIEWS.renewals = async v => {
  const r = await safe(sb.from('renewals').select('*').order('expires_on', { ascending: true, nullsFirst: false }).limit(5000));
  if (r.error) return notReady(v, 'Renewals', 'update-session1.sql');
  const all = r.data || [], t = today();
  const st = all.map(x => ({ x, s: rnStage(x, t) }));
  const nExp = st.filter(o => o.s.days != null && o.s.days < 0).length, n7 = st.filter(o => o.s.days != null && o.s.days >= 0 && o.s.days <= 7).length;
  const n30 = st.filter(o => o.s.days != null && o.s.days >= 0 && o.s.days <= 30).length, nRem = st.filter(o => o.s.due).length;
  v.innerHTML = `<div class="page-head"><h2>Renewals</h2><span class="muted">DSC · LUT · Udyam · IEC · FSSAI · licences · PT</span><span class="spacer"></span>
      <button class="btn" id="rnTpl">Excel template</button><button class="btn" id="rnImp">Import Excel</button><button class="btn" id="rnCsv">Export CSV</button>
      <button class="btn primary" id="rnAdd">+ Add renewal</button><input type="file" id="rnFile" accept=".xlsx,.xls,.csv" hidden></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <button class="mini red" data-w="expired"><span>Expired</span><b>${nExp}</b></button>
      <button class="mini amber" data-w="7"><span>Due in 7 days</span><b>${n7}</b></button>
      <button class="mini blue" data-w="30"><span>Due in 30 days</span><b>${n30}</b></button>
      <button class="mini green" data-w="remind"><span>Client reminders to send</span><b>${nRem}</b></button></div>
    <p class="muted small" style="margin:-4px 2px 12px">Reminders fall due 30, 15 and 7 days before expiry (and once after it expires). Sending one on WhatsApp or email ticks it off.</p>
    <div class="toolbar"><select id="rnW" aria-label="Show">
        <option value="due">Expired or due in 90 days</option><option value="remind">Reminder due now</option><option value="30">Due in 30 days</option><option value="7">Due in 7 days</option><option value="expired">Expired</option>
        <option value="live">All active</option><option value="all">All, including closed</option></select>
      <select id="rnK" aria-label="Type"><option value="">All types</option>${opts([...new Set([...Object.keys(RN_KINDS), ...all.map(x => x.kind)])], rnf.kind)}</select>
      ${isManager() ? `<select id="rnS" aria-label="Staff"><option value="">All staff</option>${opts(activeStaff(), rnf.staff, p => p.full_name || p.email, p => p.id)}</select>` : ''}
      <input type="search" id="rnQ" placeholder="Search client / holder / number" value="${esc(rnf.q)}"></div>
    <div id="rnList"></div>`;
  $('#rnW').value = rnf.win;
  const shown = () => {
    const q = lc(rnf.q);
    return st.filter(({ x, s }) => {
      const w = rnf.win, d = s.days;
      const okW = w === 'all' ? true : w === 'live' ? rnLive(x) : !rnLive(x) ? false
        : w === 'due' ? d != null && d <= 90 : w === 'remind' ? s.due : w === 'expired' ? d != null && d < 0 : d != null && d >= 0 && d <= +w;
      return okW && (!rnf.kind || x.kind === rnf.kind) && (!rnf.staff || x.assigned_to === rnf.staff)
        && (!q || lc([clientName(x.client_id), x.kind, x.holder, x.ref_no, x.remarks].join(' ')).includes(q));
    });
  };
  const render = () => {
    const list = shown();
    $('#rnList').innerHTML = list.length ? `<div class="count">${list.length} item${list.length > 1 ? 's' : ''}</div><div class="table-wrap"><table><thead><tr>
        <th>Client</th><th>Type</th><th>Holder / number</th><th>Expires</th><th>Reminders 30 · 15 · 7</th><th>Assigned</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(({ x, s }) => { const c = clientById(x.client_id) || {}, d = s.days;
        const cls = d == null ? '' : d < 0 ? 'late' : d <= 15 ? 'soon' : '';
        const dots = [30, 15, 7].map(k => { const on = (x.reminders || {})[k]; return `<span class="rn-dot ${on ? 'on' : s.stage === k ? 'due' : ''}" title="${on ? 'Sent ' + fmtDate(on) : s.stage === k ? 'Due now' : 'Not yet'}">${k}</span>`; }).join('')
          + ((x.reminders || {})['0'] ? `<span class="rn-dot on" title="Sent ${fmtDate(x.reminders['0'])}">!</span>` : '');
        return `<tr class="${d != null && d < 0 && rnLive(x) ? 'overdue' : ''}"><td class="wrap"><b>${esc(c.name || '(deleted client)')}</b><div class="muted small">${esc(c.phone || '')}</div></td>
          <td><span class="badge">${esc(x.kind)}</span></td><td class="wrap">${esc(x.holder || '')}<div class="muted small">${esc(x.ref_no || '')}</div></td>
          <td class="${cls}">${x.expires_on ? fmtDate(x.expires_on) : '<span class="muted">No expiry</span>'}${d != null && rnLive(x) ? `<div class="small">${d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} left`}</div>` : ''}</td>
          <td class="nowrap">${dots}</td><td>${esc(profName(x.assigned_to) || '—')}</td>
          <td><span class="st st-${slug(x.status === 'Active' ? 'In progress' : x.status === 'Renewal in progress' ? 'Ready to file' : 'Not applicable')}">${esc(x.status)}</span></td>
          <td class="row-btns">${rnLive(x) && x.expires_on ? `<a class="btn sm ${s.due ? 'primary' : ''}" data-rs="wa" data-id="${x.id}" href="#" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" data-rs="mail" data-id="${x.id}" href="#">Email</a>` : ''}
            ${rnLive(x) ? `<button class="btn sm" data-rr="${x.id}">Renewed</button>` : ''}<button class="btn sm ghost" data-re="${x.id}">Edit</button></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="table-wrap"><div class="empty">${all.length ? 'Nothing in this view. Try "All active".' : 'No renewals yet. Add one, or import your list from Excel (download the template first).'}</div></div>`;
  };
  render();
  $$('[data-w]', v).forEach(b => b.onclick = () => { rnf.win = b.dataset.w; $('#rnW').value = rnf.win; render(); });
  $('#rnW').onchange = e => { rnf.win = e.target.value; render(); };
  $('#rnK').onchange = e => { rnf.kind = e.target.value; render(); };
  if ($('#rnS')) $('#rnS').onchange = e => { rnf.staff = e.target.value; render(); };
  $('#rnQ').oninput = e => { rnf.q = e.target.value; render(); };
  $('#rnAdd').onclick = () => editRenewal(null);
  $('#rnTpl').onclick = () => renewalTemplate().catch(e => toast(friendly(e), true));
  $('#rnImp').onclick = () => $('#rnFile').click();
  $('#rnFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importRenewals(f, all).catch(err => toast(friendly(err), true)); };
  $('#rnCsv').onclick = () => download(`renewals-${t}.csv`, toCSV([['Client', 'GSTIN', 'Type', 'Holder', 'Ref no', 'Issued on', 'Expires on', 'Days left', 'Status', 'Assigned', 'Reminders sent', 'Remarks'],
    ...shown().map(({ x, s }) => [clientName(x.client_id), (clientById(x.client_id) || {}).gstin || '', x.kind, x.holder || '', x.ref_no || '', x.issued_on || '', x.expires_on || '', s.days ?? '', x.status,
      profName(x.assigned_to), Object.entries(x.reminders || {}).map(([k, d]) => `${k === '0' ? 'expired' : k + 'd'}: ${d}`).join('; '), x.remarks || ''])]));
  $('#rnList').addEventListener('click', e => {
    const a = e.target.closest('[data-rs]'), rr = e.target.dataset.rr, re = e.target.dataset.re;
    if (a) {
      const x = all.find(y => y.id === a.dataset.id), c = clientById(x.client_id) || {};
      const msg = rnMsg(x, c);
      if (a.dataset.rs === 'wa') a.href = waShare(msg, c.phone);
      else { const to = firstEmail(c); if (!to) { e.preventDefault(); toast('No email saved for this client (Clients → Edit)', true); return; } a.href = mailUrl(c.email, `${x.kind} renewal – ${c.name}`, msg); }
      if (a.dataset.rs === 'wa' && !c.phone) toast('No phone saved for this client — pick the contact in WhatsApp');
      rnMarkSent(x, a.dataset.rs === 'wa' ? 'WhatsApp' : 'Email').then(render);
    }
    if (rr) renewedDone(all.find(y => y.id === rr));
    if (re) editRenewal(all.find(y => y.id === re));
  });
};
async function rnMarkSent(x) {
  const s = rnStage(x); if (s.stage == null) return;
  const rem = { ...(x.reminders || {}), [String(s.stage)]: today() };
  try { await must(sb.from('renewals').update({ reminders: rem }).eq('id', x.id)); x.reminders = rem; } catch (e) { toast(friendly(e), true); }
}
function editRenewal(x, preset = {}) {
  const isNew = !x;
  x = x || { kind: 'DSC', status: 'Active', repeat_months: 24, assigned_to: null, ...preset };
  const cl = clients.filter(c => (c.active && (isManager() || c.default_staff === me.id)) || c.id === x.client_id);
  const body = `<div class="form-grid">
    <label class="full">Client<select name="client_id">${isNew && !x.client_id ? '<option value="">Select client…</option>' : ''}${opts(cl, x.client_id, c => c.name, c => c.id)}</select></label>
    <label>Type<input autocomplete="off" name="kind" list="dl-rnk" value="${esc(x.kind || '')}" placeholder="Pick or type"></label>
    <datalist id="dl-rnk">${Object.keys(RN_KINDS).map(k => `<option value="${esc(k)}"></option>`).join('')}</datalist>
    <label>Holder name<input name="holder" value="${esc(x.holder || '')}" placeholder="e.g. DSC holder (director)"></label>
    <label>Licence / registration no.<input name="ref_no" value="${esc(x.ref_no || '')}"></label>
    <label>Validity (months)<input name="repeat_months" type="number" min="0" max="120" value="${esc(x.repeat_months ?? 12)}"></label>
    <label>Issued / valid from<input name="issued_on" type="date" value="${esc(x.issued_on || '')}"></label>
    <label>Expires on<span class="pw-wrap"><input name="expires_on" type="date" value="${esc(x.expires_on || '')}"><button type="button" class="pw-eye" data-fill title="Work out from issue date and validity">Fill</button></span></label>
    <label>Assigned to<select name="assigned_to">${staffOpts(x.assigned_to || (clientById(x.client_id) || {}).default_staff || '')}</select></label>
    <label>Status<select name="status">${opts(RN_STATUSES, x.status)}</select></label>
    <p class="note small full" data-hint></p>
    <label class="full">Remarks<textarea name="remarks" rows="2">${esc(x.remarks || '')}</textarea></label>
    ${!isNew && (x.history || []).length ? `<div class="full small"><b>Earlier periods</b>${x.history.map(h => `<div class="muted">${fmtDate(h.issued_on)} → ${fmtDate(h.expires_on)}${h.ref_no ? ' · ' + esc(h.ref_no) : ''} · renewed ${fmtDate(h.renewed_on)}${h.by ? ' by ' + esc(profName(h.by)) : ''}</div>`).join('')}</div>` : ''}
  </div>`;
  const m = modal(isNew ? 'Add renewal' : 'Renewal details', body, {
    extra: !isNew && isManager() ? '<button class="btn danger" data-rdel>Delete</button>' + (rnLive(x) ? ' <button class="btn" data-rtask>+ Work item</button>' : '') : '',
    onSave: async el => {
      const rec = { client_id: fv(el, 'client_id'), kind: rnKind(fv(el, 'kind')), holder: fv(el, 'holder') || null, ref_no: fv(el, 'ref_no') || null,
        repeat_months: Math.max(0, Math.round(num(fv(el, 'repeat_months')))), issued_on: fv(el, 'issued_on') || null, expires_on: fv(el, 'expires_on') || null,
        assigned_to: fv(el, 'assigned_to') || null, status: fv(el, 'status'), remarks: fv(el, 'remarks') || null };
      if (!rec.client_id || !rec.kind) { toast('Client and type are required', true); return false; }
      if (rec.issued_on && rec.expires_on && rec.expires_on < rec.issued_on) { toast('Expiry is before the issue date', true); return false; }
      if (!isNew && rec.expires_on !== x.expires_on) rec.reminders = {};
      if (isNew) await must(sb.from('renewals').insert(rec)); else await must(sb.from('renewals').update(rec).eq('id', x.id));
      toast('Saved'); if (preset.onDone) preset.onDone(); else route();
    }
  });
  const el = m.el, hint = () => { const k = RN_KINDS[rnKind(fv(el, 'kind'))]; $('[data-hint]', el).textContent = k ? k.hint : 'Any other licence or registration with an expiry date.'; $('[data-hint]', el).hidden = false; };
  hint();
  $('[name=kind]', el).addEventListener('change', () => {
    const k = RN_KINDS[rnKind(fv(el, 'kind'))]; hint();
    if (k && isNew) { $('[name=repeat_months]', el).value = k.months; if (k.fy && !fv(el, 'expires_on')) $('[name=expires_on]', el).value = fyEndOf(fv(el, 'issued_on') || today()); }
  });
  $('[name=client_id]', el).addEventListener('change', () => { const c = clientById(fv(el, 'client_id')); if (c && c.default_staff && !fv(el, 'assigned_to')) $('[name=assigned_to]', el).value = c.default_staff; });
  $('[data-fill]', el).onclick = () => {
    const from = fv(el, 'issued_on'), mo = num(fv(el, 'repeat_months')), k = RN_KINDS[rnKind(fv(el, 'kind'))];
    if (!from) return toast('Enter the issue date first', true);
    $('[name=expires_on]', el).value = k && k.fy ? fyEndOf(from) : mo ? iso(addDays(new Date(addMonths(from, mo) + 'T00:00:00'), -1)) : '';
  };
  const del = $('[data-rdel]', el);
  if (del) del.onclick = async () => { if (!confirm('Delete this renewal and its history?')) return; try { await must(sb.from('renewals').delete().eq('id', x.id)); m.close(); toast('Deleted'); route(); } catch (e) { toast(friendly(e), true); } };
  const tk = $('[data-rtask]', el);
  if (tk) tk.onclick = async () => {
    try {
      const c = clientById(x.client_id) || {};
      const { data } = await must(sb.from('tasks').upsert([{ client_id: x.client_id, work_type: 'Other', return_name: `${x.kind} renewal`, period: x.expires_on ? 'Expiry ' + fmtDate(x.expires_on) : 'Renewal',
        due_date: x.expires_on || null, assigned_to: x.assigned_to || c.default_staff || null, remarks: rnWhat(x) }], { onConflict: 'client_id,return_name,period', ignoreDuplicates: true }).select('id'));
      if ((data || []).length && x.status === 'Active') await must(sb.from('renewals').update({ status: 'Renewal in progress' }).eq('id', x.id));
      toast((data || []).length ? 'Work item created (Other → All work)' : 'A work item for this renewal already exists'); m.close(); route();
    } catch (e) { toast(friendly(e), true); }
  };
}
function renewedDone(x) {
  const k = RN_KINDS[x.kind] || {}, base = x.expires_on || today();
  const from = x.expires_on && x.expires_on >= today() ? iso(addDays(new Date(x.expires_on + 'T00:00:00'), 1)) : today();
  const next = k.fy ? fyEndOf(from) : x.repeat_months ? iso(addDays(new Date(addMonths(from, x.repeat_months) + 'T00:00:00'), -1)) : '';
  modal(`Renewed: ${rnWhat(x)}`, `<p class="muted small">The current period (${x.issued_on ? fmtDate(x.issued_on) : '—'} → ${fmtDate(base)}) is kept in the history. Reminders start again for the new expiry.</p>
    <div class="form-grid"><label>Renewed on<input type="date" name="on" value="${today()}"></label><label>New licence / ref. no.<input name="ref" value="${esc(x.ref_no || '')}"></label>
    <label>New valid from<input type="date" name="from" value="${from}"></label><label>New expiry<input type="date" name="exp" value="${next}"></label></div>`, {
    saveText: 'Save renewal',
    onSave: async el => {
      const exp = fv(el, 'exp') || null, fr = fv(el, 'from') || null;
      if (exp && fr && exp < fr) { toast('New expiry is before the start date', true); return false; }
      const history = [...(x.history || []), { issued_on: x.issued_on, expires_on: x.expires_on, ref_no: x.ref_no, renewed_on: fv(el, 'on') || today(), by: me.id }];
      await must(sb.from('renewals').update({ issued_on: fr, expires_on: exp, ref_no: fv(el, 'ref') || null, history, reminders: {}, status: 'Active' }).eq('id', x.id));
      toast('Renewal saved'); route();
    }
  });
}
const RN_HEAD = ['Client (name, GSTIN or PAN)', 'Type', 'Holder name', 'Licence / ref no', 'Issued on', 'Expires on', 'Validity (months)', 'Assigned to (email)', 'Remarks'];
async function renewalTemplate() {
  const X = await loadXlsxFull();
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet([RN_HEAD,
    ['ABC Traders', 'DSC', 'R. Kumar (Director)', '', '15/01/2025', '14/01/2027', 24, me.email, 'Class 3 – signing'],
    ['33AAAAA0000A1Z5', 'GST LUT', '', 'AD330325012345X', '01/04/2026', '31/03/2027', 12, '', ''],
    ['ABC Traders', 'FSSAI', '', '12421999000123', '10/06/2022', '09/06/2027', 60, '', 'State licence'],
    ['ABC Traders', 'IEC', '', 'AAAAA0000A', '', '30/06/2027', 12, '', 'Yearly DGFT update']]);
  ws['!cols'] = RN_HEAD.map((h, i) => ({ wch: [30, 16, 22, 20, 12, 12, 10, 26, 24][i] }));
  X.utils.book_append_sheet(wb, ws, 'Renewals');
  const help = X.utils.aoa_to_sheet([['How to fill'], ['One row per DSC / licence. Delete the sample rows first.'], ['Client: the exact client name, or its GSTIN or PAN.'],
    ['Type: DSC, GST LUT, Udyam, IEC, FSSAI, Trade licence, Professional tax — or any other name.'], ['Dates: dd/mm/yyyy (e.g. 31/03/2027). Leave Expires on blank if there is no expiry (Udyam).'],
    ['Assigned to: staff login email (optional — the client\'s default staff is used otherwise).']]);
  help['!cols'] = [{ wch: 90 }];
  X.utils.book_append_sheet(wb, help, 'Help');
  X.writeFile(wb, 'renewals-template.xlsx');
}
function findClient(s) {
  const k = String(s ?? '').trim(); if (!k) return null;
  const u = k.toUpperCase(), norm = z => lc(z).replace(/[^a-z0-9]/g, '');
  return clients.find(c => c.gstin && c.gstin === u) || clients.find(c => c.pan && c.pan === u)
    || clients.find(c => lc(c.name) === lc(k)) || clients.find(c => norm(c.name) === norm(k)) || null;
}
function parseRenewalRows(rows, existing = []) {
  const hi = rows.findIndex(r => r.some(x => /client/i.test(String(x))) && r.some(x => /expir/i.test(String(x))));
  if (hi < 0) throw new Error('Could not find the header row (it needs "Client" and "Expires on" columns). Use the Excel template.');
  const head = rows[hi].map(h => lc(String(h)));
  const col = re => head.findIndex(h => re.test(h));
  const C = { client: col(/client/), kind: col(/^type|kind|licen[cs]e type/), holder: col(/holder/), ref: col(/ref|number|no\b|licen[cs]e \/|reg/), issued: col(/issue|from/), exp: col(/expir/),
    months: col(/validity|months/), staff: col(/assign|staff/), remarks: col(/remark|note/) };
  const get = (r, k) => (C[k] >= 0 ? r[C[k]] : '');
  const seen = new Set(existing.map(e => [e.client_id, lc(e.kind), lc(e.holder), e.expires_on].join('|')));
  const ok = [], bad = [];
  rows.slice(hi + 1).forEach((r, i) => {
    if (!r.some(x => String(x).trim() !== '')) return;
    const n = hi + i + 2, c = findClient(get(r, 'client')), kind = rnKind(get(r, 'kind')), iss = anyDate(get(r, 'issued')), exp = anyDate(get(r, 'exp'));
    const why = !c ? `client "${get(r, 'client')}" not found` : !kind ? 'type missing' : iss === undefined ? `issue date "${get(r, 'issued')}" not understood` : exp === undefined ? `expiry "${get(r, 'exp')}" not understood` : '';
    if (why) { bad.push(`Row ${n}: ${why}`); return; }
    const sEmail = lc(String(get(r, 'staff'))), staff = sEmail ? profiles.find(p => lc(p.email) === sEmail) : null;
    const rec = { client_id: c.id, kind, holder: String(get(r, 'holder') || '').trim() || null, ref_no: String(get(r, 'ref') || '').trim() || null, issued_on: iss, expires_on: exp,
      repeat_months: get(r, 'months') !== '' ? Math.round(num(get(r, 'months'))) : (RN_KINDS[kind] || { months: 12 }).months,
      assigned_to: staff ? staff.id : c.default_staff || null, remarks: String(get(r, 'remarks') || '').trim() || null, status: 'Active' };
    const key = [rec.client_id, lc(rec.kind), lc(rec.holder), rec.expires_on].join('|');
    if (seen.has(key)) { bad.push(`Row ${n}: already in the list — skipped`); return; }
    seen.add(key); ok.push(rec);
  });
  return { ok, bad };
}
async function importRenewals(file, existing) {
  const sheets = await readSheets(file);
  const sh = sheets.find(s => s.rows.some(r => r.some(x => /expir/i.test(String(x))))) || sheets[0];
  const { ok, bad } = parseRenewalRows(sh.rows, existing);
  modal('Import renewals', `<p><b>${ok.length}</b> row${ok.length === 1 ? '' : 's'} ready to import from <b>${esc(file.name)}</b>${bad.length ? `, <b>${bad.length}</b> left out` : ''}.</p>
    ${ok.length ? `<div class="table-wrap" style="max-height:260px"><table><thead><tr><th>Client</th><th>Type</th><th>Holder</th><th>Expires</th></tr></thead><tbody>${ok.slice(0, 200).map(r => `<tr><td>${esc(clientName(r.client_id))}</td><td>${esc(r.kind)}</td><td>${esc(r.holder || '')}</td><td>${r.expires_on ? fmtDate(r.expires_on) : 'No expiry'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${bad.length ? `<p class="note warn small" style="margin-top:10px">${bad.slice(0, 30).map(esc).join('<br>')}${bad.length > 30 ? `<br>… and ${bad.length - 30} more` : ''}</p>` : ''}`, {
    saveText: `Import ${ok.length}`,
    onSave: ok.length ? async () => { await must(sb.from('renewals').insert(ok)); toast(`${ok.length} renewal${ok.length > 1 ? 's' : ''} imported`); route(); } : null
  });
}

/* ---------------- 2. TAX PAYMENT INTIMATION ---------------- */
const GST_22 = ['22', '23', '24', '25', '26', '27', '29', '30', '31', '32', '33', '34', '35', '36', '37'];   // GSTR-3B (QRMP) due 22nd; others 24th
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const nextMonthDay = (ym, day) => { const [y, m] = ym.split('-').map(Number); const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; return dueDateFor(day, ny, nm); };
function gstPayDue(c, ym) {                                // { form, due } or null when nothing is payable this month
  const m = +ym.split('-')[1], qEnd = m % 3 === 0;
  if (c.gst_scheme === 'Composition') return qEnd ? { form: 'CMP-08', due: nextMonthDay(ym, 18) } : null;
  if (c.gst_scheme === 'QRMP') return qEnd ? { form: 'GSTR-3B (quarterly)', due: nextMonthDay(ym, GST_22.includes((c.gstin || '').slice(0, 2)) ? 22 : 24) } : { form: 'PMT-06', due: nextMonthDay(ym, 25) };
  return { form: 'GSTR-3B', due: nextMonthDay(ym, 20) };
}
const tdsPayDue = ym => ym.endsWith('-03') ? `${ym.slice(0, 4)}-04-30` : nextMonthDay(ym, 7);
const ADV_INST = [['06-15', 15, '15 Jun'], ['09-15', 45, '15 Sep'], ['12-15', 75, '15 Dec'], ['03-15', 100, '15 Mar']];
const tyLabel = y => `TY ${y}-${String(y + 1).slice(2)}`;
const advDue = (y, i) => (i === 3 ? `${y + 1}-` : `${y}-`) + ADV_INST[i][0];
function advCurrent(t = today()) {                        // next instalment on or after today
  const [y, m] = t.split('-').map(Number), fy0 = m >= 4 ? y : y - 1;
  for (let i = 0; i < 4; i++) if (advDue(fy0, i) >= t) return { y: fy0, i };
  return { y: fy0 + 1, i: 0 };
}
function advInstalment({ est, paidBefore, pct, presumptive }) {
  const p = presumptive ? (pct === 100 ? 100 : 0) : pct;
  return Math.max(0, Math.round(num(est) * p / 100 - num(paidBefore)));
}
function taxMsg(kind, c, o) {
  const hi = `Dear ${c.contact_person || c.name},\n`, by = `- ${firmName()}`;
  if (kind === 'GST') {
    if (!(o.total > 0)) return `${hi}GST for ${o.period}: no cash payment is needed — the tax is fully covered by input tax credit. We will file ${o.form} by ${fmtDate(o.due)}.\n${by}`;
    const L = [['IGST', o.a.ig], ['CGST', o.a.cg], ['SGST', o.a.sg], ['Cess', o.a.cs]].filter(([, x]) => num(x) > 0).map(([k, x]) => `${k}: ${inr(Math.round(x))}`).join('\n');
    return `${hi}GST payable for ${o.period} (${o.form}):\n${L}\nTotal: ${inr(Math.round(o.total))}\n\nPlease pay by ${fmtDate(o.due)} — GST portal → Payments → Create challan (PMT-06), then net banking / UPI — and send us the paid challan (CIN). If you would like us to generate the challan, please tell us.\n${by}`;
  }
  if (kind === 'TDS') {
    const L = [['TDS', o.a.tds], ['TCS', o.a.tcs], ['Interest', o.a.int]].filter(([, x]) => num(x) > 0).map(([k, x]) => `${k}: ${inr(Math.round(x))}`).join('\n');
    return `${hi}TDS / TCS to be deposited for ${o.period}:\n${L}\nTotal: ${inr(Math.round(o.total))}\n\nPlease deposit by ${fmtDate(o.due)} through e-Pay Tax on the income-tax portal (TDS/TCS payable by taxpayer) and send us the challan (BSR code, date and challan no.). Late deposit attracts interest of 1.5% a month.\n${by}`;
  }
  return `${hi}Advance tax for ${o.period.replace(' · ', ', instalment due ')} (${o.a.pct}% of the estimated tax for the year):\nEstimated tax for the year: ${inr(o.a.est)}\nAlready paid: ${inr(o.a.paid_before || 0)}\nPayable now: ${inr(o.total)}\n\nPlease pay by ${fmtDate(o.due)} through e-Pay Tax on the income-tax portal (advance tax) and send us the challan. Short payment attracts interest.\n${by}`;
}
let tpTab = 'GST', tpMonth = prevMonth(), tpAdv = null, tpQ = '', tpHide = false;
VIEWS.taxpay = async v => {
  const probe = await safe(sb.from('tax_intimations').select('id').limit(1));
  if (probe.error) return notReady(v, 'Tax payment intimation', 'update-session1.sql');
  if (!tpAdv) tpAdv = advCurrent();
  const isAdv = tpTab === 'ADV';
  const period = isAdv ? `${tyLabel(tpAdv.y)} · ${ADV_INST[tpAdv.i][2]}` : monthLabel(tpMonth);
  v.innerHTML = `<div class="page-head"><h2>Tax payment intimation</h2><span class="spacer"></span>
      ${isAdv ? `<select id="tpY" aria-label="Tax year">${[-1, 0, 1].map(k => tpAdv.y + k).map(y => `<option value="${y}" ${y === tpAdv.y ? 'selected' : ''}>${tyLabel(y)}</option>`).join('')}</select>
        <select id="tpI" aria-label="Instalment">${ADV_INST.map((x, i) => `<option value="${i}" ${i === tpAdv.i ? 'selected' : ''}>${x[2]} · ${x[1]}%</option>`).join('')}</select>`
      : `<label class="small muted" for="tpM">Tax month</label><input type="month" id="tpM" value="${esc(tpMonth)}">`}</div>
    <div class="toolbar"><div class="seg">${[['GST', 'GST cash payable'], ['TDS', 'TDS / TCS (by 7th)'], ['ADV', 'Advance tax']].map(([k, l]) => `<button data-tp="${k}" class="${tpTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input type="search" id="tpQ" placeholder="Search client" value="${esc(tpQ)}"><label class="check"><input type="checkbox" id="tpH" ${tpHide ? 'checked' : ''}> Hide sent & paid</label>
      <button class="btn sm" id="tpCsv">Export CSV</button></div>
    <div id="tpBody"><div class="loading">Loading…</div></div>`;
  $$('[data-tp]', v).forEach(b => b.onclick = () => { tpTab = b.dataset.tp; route(); });
  if ($('#tpM')) $('#tpM').onchange = e => { tpMonth = e.target.value || prevMonth(); route(); };
  if ($('#tpY')) $('#tpY').onchange = e => { tpAdv = { ...tpAdv, y: +e.target.value }; route(); };
  if ($('#tpI')) $('#tpI').onchange = e => { tpAdv = { ...tpAdv, i: +e.target.value }; route(); };
  const body = $('#tpBody', v);
  const mine = myClients();
  let rows = [];
  const ex = await must(sb.from('tax_intimations').select('*').eq('kind', tpTab).eq('period', period).limit(5000));
  const sent = new Map((ex.data || []).map(x => [x.client_id, x]));
  if (tpTab === 'GST') {
    const list = mine.filter(c => c.gstin && c.gst_scheme !== 'Not registered' && (c.services || []).includes('GST'));
    const gm = await safe(sb.from('gst_months').select('client_id,status,summary').eq('period', tpMonth + '-01').limit(5000));
    const gmap = new Map((gm.error ? [] : gm.data || []).map(r => [r.client_id, r]));
    const cashObj = g => g && g.summary && g.summary.cash && typeof g.summary.cash === 'object' ? g.summary.cash : null;   // months saved before v17 hold a single number
    const need = list.filter(c => gmap.has(c.id) && !cashObj(gmap.get(c.id))).map(c => c.id);
    if (need.length) {
      const full = await safe(sb.from('gst_months').select('client_id,status,sales,purchases,gstr2b,gstr3b,gstr1').eq('period', tpMonth + '-01').in('client_id', need));
      (full.error ? [] : full.data || []).forEach(r => { const sm = GR.summarise(r); gmap.set(r.client_id, { ...gmap.get(r.client_id), summary: { cash: sm.cash, cash_draft: sm.cashTotal, has: sm.counts.sales + sm.counts.b2b + sm.counts.purchases } }); });
    }
    rows = list.map(c => {
      const d = gstPayDue(c, tpMonth); if (!d) return null;
      const x = sent.get(c.id), g = gmap.get(c.id), cash = cashObj(g);
      const a = x ? x.amounts : cash ? { ig: Math.round(cash.ig), cg: Math.round(cash.cg), sg: Math.round(cash.sg), cs: Math.round(cash.cs) } : { ig: 0, cg: 0, sg: 0, cs: 0 };
      const src = x ? 'Saved' : cash ? (g.status === 'Verified' ? 'Draft 3B ✓ verified' : 'Draft 3B (not verified)') : 'No GST review data';
      return { c, x, a, src, form: d.form, due: x && x.due_date || d.due, warn: !x && !cash };
    }).filter(Boolean);
  } else if (tpTab === 'TDS') {
    const tw = await safe(sb.from('tds_entries').select('client_id,tds').eq('month', tpMonth + '-01').limit(20000));      // from TDS working (update-session4.sql)
    const twSum = new Map(); (tw.error ? [] : tw.data || []).forEach(r => twSum.set(r.client_id, (twSum.get(r.client_id) || 0) + num(r.tds)));
    const tc = await safe(sb.from('tds_challans').select('client_id,intr').eq('month', tpMonth + '-01').limit(5000));
    const tcInt = new Map(); (tc.error ? [] : tc.data || []).forEach(r => tcInt.set(r.client_id, (tcInt.get(r.client_id) || 0) + num(r.intr)));
    rows = mine.filter(c => (c.services || []).includes('TDS') || c.tan).map(c => { const x = sent.get(c.id), w = twSum.has(c.id);
      return { c, x, a: x ? x.amounts : { tds: Math.round(twSum.get(c.id) || 0), tcs: 0, int: Math.round(tcInt.get(c.id) || 0) }, src: x ? 'Saved' : w ? 'From TDS working' : 'Type the amount (no TDS working)', due: x && x.due_date || tdsPayDue(tpMonth), warn: !x && !w }; });
  } else {
    const earlier = await must(sb.from('tax_intimations').select('client_id,period,amounts,paid_amount,total').eq('kind', 'ADV').like('period', tyLabel(tpAdv.y) + ' ·%').limit(5000));
    const before = ADV_INST.slice(0, tpAdv.i).map(x => `${tyLabel(tpAdv.y)} · ${x[2]}`);
    rows = mine.filter(c => c.pan).map(c => {
      const x = sent.get(c.id), prev = (earlier.data || []).filter(e => e.client_id === c.id && before.includes(e.period));
      const last = prev.sort((p, q) => before.indexOf(q.period) - before.indexOf(p.period))[0];
      const paid = prev.reduce((s, e) => s + num(e.paid_amount ?? 0), 0);
      const a = x ? x.amounts : { est: last ? num(last.amounts.est) : 0, paid_before: paid, pct: ADV_INST[tpAdv.i][1], presumptive: last ? !!last.amounts.presumptive : false };
      return { c, x, a, src: x ? 'Saved' : last ? 'From earlier instalment' : 'Type the estimate', due: advDue(tpAdv.y, tpAdv.i), warn: !x && !last };
    });
  }
  const totalOf = a => tpTab === 'GST' ? num(a.ig) + num(a.cg) + num(a.sg) + num(a.cs) : tpTab === 'TDS' ? num(a.tds) + num(a.tcs) + num(a.int) : advInstalment({ est: a.est, paidBefore: a.paid_before, pct: num(a.pct) || ADV_INST[tpAdv.i][1], presumptive: a.presumptive });
  const amtCols = tpTab === 'GST' ? [['ig', 'IGST'], ['cg', 'CGST'], ['sg', 'SGST'], ['cs', 'Cess']] : tpTab === 'TDS' ? [['tds', 'TDS'], ['tcs', 'TCS'], ['int', 'Interest']] : [['est', 'Estimated tax (year)'], ['paid_before', 'Paid so far']];
  const ctx = r => ({ period, form: r.form, due: r.due, a: r.a, total: totalOf(r.a) });
  const render = () => {
    const q = lc(tpQ);
    const list = rows.filter(r => (!q || lc(r.c.name).includes(q)) && !(tpHide && r.x && r.x.sent_on && r.x.paid_on));
    const nSent = rows.filter(r => r.x && r.x.sent_on).length, nPaid = rows.filter(r => r.x && r.x.paid_on).length, tot = rows.reduce((s, r) => s + totalOf(r.a), 0);
    body.innerHTML = `<div class="bento-stats card stats4" style="margin-bottom:14px">
        <div class="mini blue"><span>Clients</span><b>${rows.length}</b></div><div class="mini amber"><span>Not sent yet</span><b>${rows.length - nSent}</b></div>
        <div class="mini green"><span>Paid</span><b>${nPaid}</b></div><div class="mini"><span>Total payable</span><b class="tp-amt">${inr(Math.round(tot))}</b></div></div>
      <p class="muted small" style="margin:-4px 2px 10px">${tpTab === 'GST' ? `Amounts come from each client's Draft GSTR-3B (GST review → ${esc(period)}). Monthly: GSTR-3B by the 20th · QRMP: PMT-06 by the 25th, quarter-end 3B by the 22nd/24th · Composition: CMP-08 by the 18th after the quarter. Change any amount before sending.`
        : tpTab === 'TDS' ? 'TDS / TCS deducted in the month is due by the 7th of the next month (30 April for March). TDS comes from each client’s TDS working (side menu → TDS working) for the month; type the amount for clients without a working. Change any amount before sending.'
        : `Instalments: 15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar. "Paid so far" adds up the amounts marked paid for earlier instalments. Tick "Presumptive" for clients who pay the whole advance tax by 15 March.`}</p>
      ${list.length ? `<div class="table-wrap"><table class="tp-t"><thead><tr><th>Client</th>${tpTab === 'GST' ? '<th>Form</th>' : ''}${amtCols.map(([, l]) => `<th class="r">${l}</th>`).join('')}${tpTab === 'ADV' ? '<th>Presumptive</th>' : ''}<th class="r">Payable</th><th>Due</th><th>Sent</th><th>Paid</th><th></th></tr></thead><tbody>
        ${list.map(r => { const i = rows.indexOf(r), x = r.x || {}, late = !x.paid_on && r.due < today();
          return `<tr data-i="${i}" class="${late && totalOf(r.a) > 0 ? 'overdue' : ''}"><td class="wrap"><b>${esc(r.c.name)}</b><div class="muted small ${r.warn ? 'late' : ''}">${esc(r.src)}</div></td>
            ${tpTab === 'GST' ? `<td class="small">${esc(r.form)}<div class="muted">${esc(r.c.gst_scheme)}</div></td>` : ''}
            ${amtCols.map(([k]) => `<td class="r"><input class="tp-in" type="number" min="0" step="1" data-k="${k}" value="${esc(Math.round(num(r.a[k])) || '')}" placeholder="0" aria-label="${k}"></td>`).join('')}
            ${tpTab === 'ADV' ? `<td><label class="check"><input type="checkbox" data-k="presumptive" ${r.a.presumptive ? 'checked' : ''}> All by 15 Mar</label></td>` : ''}
            <td class="r"><b data-tot>${inr(totalOf(r.a))}</b></td><td class="${late ? 'late' : ''}">${fmtDate(r.due)}</td>
            <td class="small">${x.sent_on ? `${fmtDate(x.sent_on)}<div class="muted">${esc(x.sent_via || '')}${x.sent_count > 1 ? ' · ' + x.sent_count + '×' : ''}</div>` : '<span class="muted">—</span>'}</td>
            <td class="small">${x.paid_on ? `<span class="st st-filed">Paid ${fmtDate(x.paid_on)}</span>${x.challan ? `<div class="muted">${esc(x.challan)}</div>` : ''}` : '<span class="muted">—</span>'}</td>
            <td class="row-btns"><a class="btn sm ${x.sent_on ? '' : 'primary'}" data-send="wa" href="#" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" data-send="mail" href="#">Email</a><button class="btn sm ghost" data-paid>${x.paid_on ? 'Edit paid' : 'Mark paid'}</button></td></tr>`; }).join('')}
        </tbody></table></div>` : `<div class="table-wrap"><div class="empty">${rows.length ? 'Nothing to show.' : tpTab === 'GST' ? 'No GST clients with a payment due for this month (needs GSTIN and the GST service ticked).' : tpTab === 'TDS' ? 'No TDS clients — tick the TDS service or add a TAN on the client.' : 'No clients with a PAN.'}</div></div>`}`;
  };
  render();
  const readRow = tr => { const r = rows[+tr.dataset.i]; $$('[data-k]', tr).forEach(inp => { r.a[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : num(inp.value); }); if (tpTab === 'ADV') r.a.pct = ADV_INST[tpAdv.i][1]; return r; };
  body.addEventListener('input', e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const r = readRow(tr); $('[data-tot]', tr).textContent = inr(totalOf(r.a)); });
  body.addEventListener('change', e => { const tr = e.target.closest('tr[data-i]'); if (tr && e.target.type === 'checkbox') { const r = readRow(tr); $('[data-tot]', tr).textContent = inr(totalOf(r.a)); } });
  const save = async (r, patch) => {
    const rec = { client_id: r.c.id, kind: tpTab, period, due_date: r.due, amounts: r.a, total: totalOf(r.a), ...patch };
    const { data } = await must(sb.from('tax_intimations').upsert(rec, { onConflict: 'client_id,kind,period' }).select().single());
    r.x = data; r.src = 'Saved'; r.warn = false;
  };
  body.addEventListener('click', e => {
    const a = e.target.closest('[data-send]'), p = e.target.closest('[data-paid]');
    const tr = e.target.closest('tr[data-i]'); if (!tr || (!a && !p)) return;
    const r = readRow(tr), c = r.c;
    if (a) {
      const msg = taxMsg(tpTab, c, ctx(r)), wa = a.dataset.send === 'wa';
      if (wa) { a.href = waShare(msg, c.phone); if (!c.phone) toast('No phone saved for this client — pick the contact in WhatsApp'); }
      else { if (!firstEmail(c)) { e.preventDefault(); toast('No email saved for this client (Clients → Edit)', true); return; } a.href = mailUrl(c.email, `${tpTab === 'GST' ? 'GST' : tpTab === 'TDS' ? 'TDS' : 'Advance tax'} payment – ${period} – ${c.name}`, msg); }
      save(r, { sent_on: today(), sent_via: wa ? 'WhatsApp' : 'Email', sent_by: me.id, sent_count: ((r.x && r.x.sent_count) || 0) + 1 }).then(render).catch(err => toast(friendly(err), true));
    }
    if (p) {
      const x = r.x || {};
      modal(`Payment made – ${c.name}`, `<div class="form-grid"><label>Paid on<input type="date" name="on" value="${esc(x.paid_on || today())}"></label>
        <label>Amount paid (₹)<input type="number" name="amt" value="${esc(x.paid_amount ?? totalOf(r.a))}"></label>
        <label class="full">${tpTab === 'GST' ? 'CPIN / CIN' : 'BSR code · date · challan no.'}<input name="ch" value="${esc(x.challan || '')}"></label>
        <label class="full">Remarks<input name="rm" value="${esc(x.remarks || '')}"></label></div>`, {
        extra: x.paid_on ? '<button class="btn danger" data-unpay>Not paid</button>' : '',
        onSave: async el => { await save(r, { paid_on: fv(el, 'on') || today(), paid_amount: num(fv(el, 'amt')), challan: fv(el, 'ch') || null, remarks: fv(el, 'rm') || null }); toast('Saved'); render(); }
      });
      const un = $('[data-unpay]'); if (un) un.onclick = async () => { try { await save(r, { paid_on: null, paid_amount: null }); un.closest('.modal-back').remove(); render(); } catch (err) { toast(friendly(err), true); } };
    }
  });
  $('#tpQ', v).oninput = e => { tpQ = e.target.value; render(); };
  $('#tpH', v).onchange = e => { tpHide = e.target.checked; render(); };
  $('#tpCsv', v).onclick = () => download(`tax-intimation-${tpTab}-${slug(period)}.csv`, toCSV([['Client', 'GSTIN / PAN', ...(tpTab === 'GST' ? ['Form'] : []), ...amtCols.map(x => x[1]), 'Payable', 'Due', 'Sent on', 'Sent via', 'Paid on', 'Amount paid', 'Challan'],
    ...rows.map(r => [r.c.name, tpTab === 'GST' ? r.c.gstin : r.c.pan || '', ...(tpTab === 'GST' ? [r.form] : []), ...amtCols.map(([k]) => Math.round(num(r.a[k]))), totalOf(r.a), r.due,
      (r.x || {}).sent_on || '', (r.x || {}).sent_via || '', (r.x || {}).paid_on || '', (r.x || {}).paid_amount ?? '', (r.x || {}).challan || ''])]));
};

/* ---------------- 3. NEW CLIENT ONBOARDING ---------------- */
const OB_DEFAULT = [
  ['KYC documents', 'PAN'], ['KYC documents', 'Aadhaar of directors / partners'], ['KYC documents', 'GST certificate'],
  ['KYC documents', 'Incorporation certificate / partnership deed'], ['KYC documents', 'Address proof'], ['KYC documents', 'Bank statement / cancelled cheque'],
  ['Engagement', 'Engagement letter signed'], ['Engagement', 'Fee agreement signed'],
  ['Set-up', 'Client details, services & default staff set'], ['Set-up', 'Portal logins saved (GST / TDS / MCA)'], ['Set-up', 'Recurring work created'],
  ['Set-up', 'Renewal dates added (DSC, LUT …)'], ['Set-up', 'Status link / client portal shared']
];
const OB_GROUPS = ['KYC documents', 'Engagement', 'Set-up'];
const obList = () => (Array.isArray(settings.onboard_items) && settings.onboard_items.length ? settings.onboard_items.map(x => [x.grp, x.label]) : OB_DEFAULT);
const obKey = s => slug(s).slice(0, 40);
const obFresh = () => obList().map(([grp, label]) => ({ k: obKey(label), label, grp, done: false }));
const obProgress = ob => { const it = (ob.items || []).filter(i => !i.na); return { done: it.filter(i => i.done).length, total: it.length }; };
const FEE_FREQ = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time', 'Per filing'];
const OB_FEE_START = { 'GST': [['GSTR-1', 'Monthly'], ['GSTR-3B', 'Monthly'], ['GSTR-9', 'Yearly']], 'TDS': [['TDS deposit', 'Monthly'], ['26Q (other than salary)', 'Quarterly'], ['24Q (salary)', 'Quarterly']],
  'ROC/MCA': [['AOC-4', 'Yearly'], ['MGT-7', 'Yearly'], ['DIR-3 KYC', 'Yearly']], 'Other': [['Accounting / bookkeeping', 'Monthly']] };
const OB_TERMS = `1. You will send complete and correct data (sales, purchases, bank statements, salary and TDS details) by the 5th of every month, or by any earlier date we ask for.
2. You are responsible for the accuracy of your books and documents. We prepare and file returns on the basis of the information you give us.
3. Fees are exclusive of GST and of government fees, taxes, late fees, interest and penalties. Our invoices are payable within 15 days.
4. Late fees or interest caused by delay in sending data or making payment will be borne by you.
5. Portal logins and OTPs you share will be kept confidential and used only for this engagement.
6. Notices, assessments, appeals, registrations and other work outside the scope above will be charged separately, after telling you.
7. Either of us may end this engagement with 30 days' written notice. Fees for work already done remain payable.
8. Fees will be reviewed once a year.`;
async function obGet(clientId) {
  const r = await safe(sb.from('onboarding').select('*').eq('client_id', clientId).maybeSingle());
  if (r.error) throw new Error('Onboarding is not set up yet — run update-session1.sql in Supabase.');
  return r.data;
}
async function startOnboarding(c) {
  const ob = { client_id: c.id, items: obFresh(), fees: obFeeStart(c), letter: { date: today(), terms: OB_TERMS }, status: 'In progress', started_on: today() };
  const { data } = await must(sb.from('onboarding').insert(ob).select().single());
  return data;
}
function obFeeStart(c) {
  const out = [];
  (c.services || []).forEach(w => (OB_FEE_START[w] || []).forEach(([work, freq]) => out.push({ work, freq, amount: 0 })));
  return out.length ? out : [{ work: '', freq: 'Monthly', amount: 0 }];
}
async function openOnboarding(c, after = () => route()) {
  let ob;
  try { ob = await obGet(c.id); } catch (e) { return toast(friendly(e), true); }
  if (!ob) {
    if (!isManager()) return toast('Onboarding has not been started for this client. Ask a manager.', true);
    try { ob = await startOnboarding(c); } catch (e) { return toast(friendly(e), true); }
  }
  // fill standard fees from the fee list where the agreement has none yet
  const fr = await safe(sb.from('fee_rates').select('client_id,return_name,amount').or(`client_id.is.null,client_id.eq.${c.id}`));
  const rates = fr.error ? [] : fr.data || [];
  const rateFor = w => { const own = rates.find(f => f.client_id === c.id && lc(f.return_name) === lc(w)), std = rates.find(f => !f.client_id && lc(f.return_name) === lc(w)); return (own || std || {}).amount || 0; };
  (ob.fees || []).forEach(f => { if (!num(f.amount) && f.work) f.amount = rateFor(f.work); });
  const items = ob.items || [], fees = ob.fees || [], letter = { date: today(), terms: OB_TERMS, ...(ob.letter || {}) };
  const allRet = [].concat(...WORK_TYPES.map(w => WORK_ITEMS[w] || []));
  const itemRow = (it, i) => `<div class="ob-item ${it.done ? 'done' : ''} ${it.na ? 'na' : ''}"><label class="check"><input type="checkbox" data-ob="${i}" ${it.done ? 'checked' : ''} ${it.na ? 'disabled' : ''}> ${esc(it.label)}</label>
      <span class="muted small">${it.done && it.on ? `${fmtDate(it.on)}${it.by ? ' · ' + esc(profName(it.by)) : ''}` : ''}</span><span class="spacer"></span>
      <input class="ob-note" data-obn="${i}" value="${esc(it.note || '')}" placeholder="Note"><button type="button" class="link small" data-obna="${i}">${it.na ? 'Needed' : 'N/A'}</button></div>`;
  const feeRows = () => fees.map((f, i) => `<tr data-fi="${i}"><td><input autocomplete="off" data-f="work" list="dl-obfee" value="${esc(f.work)}" placeholder="e.g. GSTR-3B"></td><td><select data-f="freq">${opts(FEE_FREQ, f.freq)}</select></td>
      <td class="r"><input data-f="amount" type="number" min="0" step="1" value="${esc(f.amount || '')}" style="max-width:120px"></td><td><button type="button" class="link small danger-t" data-fdel="${i}">Remove</button></td></tr>`).join('');
  const body = `<div class="ob-head"><div><b>${esc(c.name)}</b> <span class="muted small">· started ${fmtDate(ob.started_on)}</span></div><span class="spacer"></span><span class="badge ${ob.status === 'Completed' ? 'ok' : ''}" data-obp></span></div>
    ${OB_GROUPS.map(g => `<h4 class="ob-g">${esc(g)}</h4>${items.map((it, i) => [it, i]).filter(([it]) => (it.grp || 'Set-up') === g || (g === 'Set-up' && !OB_GROUPS.includes(it.grp))).map(([it, i]) => itemRow(it, i)).join('')}
      ${g === 'KYC documents' ? `<div class="toolbar" style="margin:6px 0 0"><input data-obadd placeholder="Add another document (e.g. MOA / AOA, LLP agreement)"><button type="button" class="btn sm" data-obaddb>Add</button><span class="spacer"></span>
        <a class="btn sm" href="#" data-obask="wa" target="_blank" rel="noopener">Ask client on WhatsApp</a><a class="btn sm" href="#" data-obask="mail">Email</a></div>` : ''}
      ${g === 'Engagement' ? `<div class="ob-eng"><div class="form-grid"><label>Letter date<input type="date" data-l="date" value="${esc(letter.date || today())}"></label>
          <label>Signed copy received on<input type="date" data-l="signed_on" value="${esc(letter.signed_on || '')}"></label></div>
        <div class="small muted" style="margin:10px 0 4px;font-weight:600">Fee agreement</div>
        <div class="table-wrap"><table class="ob-fees"><thead><tr><th>Work</th><th>Frequency</th><th class="r">Fee (₹, excl. GST)</th><th></th></tr></thead><tbody data-fees>${feeRows()}</tbody></table></div>
        <datalist id="dl-obfee">${allRet.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
        <div class="toolbar" style="margin:8px 0 0"><button type="button" class="btn sm" data-fadd>+ Fee line</button>${isManager() ? '<button type="button" class="btn sm" data-fsave>Save fees to Billing</button>' : ''}<span class="spacer"></span>
          <button type="button" class="btn sm primary" data-print>Engagement letter & fee agreement (print / PDF)</button></div>
        <details style="margin-top:8px"><summary class="small">Terms printed in the letter (edit for this client)</summary><textarea data-l="terms" rows="9" style="width:100%;margin-top:6px">${esc(letter.terms || OB_TERMS)}</textarea></details></div>` : ''}
      ${g === 'Set-up' ? `<div class="toolbar" style="margin:6px 0 0"><button type="button" class="btn sm" data-oba="edit">Edit client</button><button type="button" class="btn sm" data-oba="logins">🔑 Portal logins</button>
        ${isManager() ? '<button type="button" class="btn sm primary" data-oba="work">Create recurring work</button>' : ''}<button type="button" class="btn sm" data-oba="renew">+ Renewal date</button>
        <a class="btn sm" href="${esc(waShare(clientMsg(c), c.phone))}" target="_blank" rel="noopener" data-oba="link">Send status link</a></div>` : ''}`).join('')}`;
  let dirty = false;
  const m = modal('Client onboarding', body, {
    wide: true, saveText: 'Save',
    extra: isManager() ? `<button class="btn" data-obdone>${ob.status === 'Completed' ? 'Re-open' : 'Mark complete'}</button>` : '',
    onSave: async () => { await persist(); toast('Onboarding saved'); after(); }
  });
  const el = m.el;
  const prog = () => { const p = obProgress({ items }); $('[data-obp]', el).textContent = ob.status === 'Completed' ? `Completed ${fmtDate(ob.completed_on)}` : `${p.done} / ${p.total} done`; };
  prog();
  const readFees = () => $$('[data-fi]', el).forEach(tr => { const f = fees[+tr.dataset.fi]; f.work = $('[data-f=work]', tr).value.trim(); f.freq = $('[data-f=freq]', tr).value; f.amount = num($('[data-f=amount]', tr).value); });
  const readLetter = () => $$('[data-l]', el).forEach(i => { letter[i.dataset.l] = i.value; });
  const persist = async (extra = {}) => {
    readFees(); readLetter();
    const rec = { items, fees: fees.filter(f => f.work), letter, ...extra };
    if (letter.signed_on) { const t = items.find(i => /engagement letter/i.test(i.label)); if (t && !t.done) Object.assign(t, { done: true, on: letter.signed_on, by: me.id }); }
    await must(sb.from('onboarding').update(rec).eq('client_id', c.id)); Object.assign(ob, rec); dirty = false;
  };
  const tick = (re, on = true) => { const it = items.find(i => re.test(i.label)); if (it && !it.done && on) { Object.assign(it, { done: true, on: today(), by: me.id }); refreshItems(); persist().catch(() => {}); } };
  const refreshItems = () => { $$('[data-ob]', el).forEach(cb => { const it = items[+cb.dataset.ob]; cb.checked = !!it.done; cb.disabled = !!it.na; cb.closest('.ob-item').className = `ob-item ${it.done ? 'done' : ''} ${it.na ? 'na' : ''}`; }); prog(); };
  el.addEventListener('change', e => {
    const i = e.target.dataset.ob; dirty = true;
    if (i !== undefined) { const it = items[+i]; Object.assign(it, e.target.checked ? { done: true, on: today(), by: me.id } : { done: false, on: null, by: null }); refreshItems(); }
  });
  el.addEventListener('input', e => { const n = e.target.dataset.obn; dirty = true; if (n !== undefined) items[+n].note = e.target.value; });
  el.addEventListener('click', async e => {
    const t = e.target, na = t.dataset.obna;
    if (na !== undefined) { const it = items[+na]; it.na = !it.na; if (it.na) it.done = false; t.textContent = it.na ? 'Needed' : 'N/A'; refreshItems(); dirty = true; }
    if (t.dataset.obaddb !== undefined) {
      const inp = $('[data-obadd]', el), label = inp.value.trim(); if (!label) return;
      items.push({ k: obKey(label) + '-' + items.length, label, grp: 'KYC documents', done: false });
      await persist().catch(err => toast(friendly(err), true)); m.close(); openOnboarding(c, after);
    }
    const ask = t.closest('[data-obask]');
    if (ask) {
      const miss = items.filter(i => i.grp === 'KYC documents' && !i.done && !i.na).map(i => i.label);
      if (!miss.length) { e.preventDefault(); return toast('All KYC documents are already received'); }
      const msg = `Dear ${c.contact_person || c.name},\nWelcome to ${firmName()}. To complete your registration with us, please send copies of:\n${miss.map(x => '- ' + x).join('\n')}\nYou can reply to this message with photos / PDFs, or email them to us.\n- ${firmName()}`;
      if (ask.dataset.obask === 'wa') ask.href = waShare(msg, c.phone);
      else { if (!firstEmail(c)) { e.preventDefault(); return toast('No email saved for this client (Edit client)', true); } ask.href = mailUrl(c.email, `KYC documents – ${firmName()}`, msg); }
    }
    if (t.dataset.fadd !== undefined) { readFees(); fees.push({ work: '', freq: 'Monthly', amount: 0 }); $('[data-fees]', el).innerHTML = feeRows(); dirty = true; }
    if (t.dataset.fdel !== undefined) { readFees(); fees.splice(+t.dataset.fdel, 1); $('[data-fees]', el).innerHTML = feeRows(); dirty = true; }
    if (t.dataset.fsave !== undefined) {
      readFees();
      const ok = fees.filter(f => f.work && num(f.amount) > 0);
      if (!ok.length) return toast('Enter at least one fee', true);
      try {
        for (const f of ok) {
          const ex = rates.find(r => r.client_id === c.id && lc(r.return_name) === lc(f.work));
          if (ex) await must(sb.from('fee_rates').update({ amount: num(f.amount) }).eq('client_id', c.id).eq('return_name', ex.return_name));
          else { await must(sb.from('fee_rates').insert({ client_id: c.id, return_name: f.work, amount: num(f.amount) })); rates.push({ client_id: c.id, return_name: f.work, amount: num(f.amount) }); }
        }
        await persist(); toast(`${ok.length} client fee${ok.length > 1 ? 's' : ''} saved — new work items will carry these fees`);
      } catch (err) { toast(friendly(err), true); }
    }
    if (t.dataset.print !== undefined) { readFees(); readLetter(); printEngagement(c, fees.filter(f => f.work), letter); }
    const act = t.closest('[data-oba]') && t.closest('[data-oba]').dataset.oba;
    if (act === 'edit') { await persist().catch(() => {}); m.close(); editClient(c); }
    if (act === 'logins') { openLogins(c); tick(/portal logins/i, false); }
    if (act === 'work') createRecurringWork(c, n => { if (n) tick(/recurring work/i); });
    if (act === 'renew') editRenewal(null, { client_id: c.id, onDone: () => tick(/renewal dates/i) });
    if (act === 'link') tick(/status link/i);
    if (t.dataset.obdone !== undefined) {
      const p = obProgress({ items });
      if (ob.status !== 'Completed' && p.done < p.total && !confirm(`${p.total - p.done} item(s) are still open. Mark onboarding complete anyway?`)) return;
      try { await persist(ob.status === 'Completed' ? { status: 'In progress', completed_on: null } : { status: 'Completed', completed_on: today() }); m.close(); toast(ob.status === 'Completed' ? 'Onboarding complete' : 'Re-opened'); after(); } catch (err) { toast(friendly(err), true); }
    }
  });
  $$('[data-x]', el).forEach(b => b.addEventListener('click', () => { if (dirty) persist().catch(() => {}); }, { capture: true }));
}
function printEngagement(c, fees, letter) {
  const svc = [...new Set(fees.map(f => (Object.entries(WORK_ITEMS).find(([, l]) => l.some(x => lc(x) === lc(f.work))) || ['Other'])[0]))];
  const svcName = { 'GST': 'GST — returns, payment working, reconciliation', 'TDS': 'TDS / TCS — deposits, quarterly returns, certificates', 'ROC/MCA': 'Company / LLP (MCA) annual filings and event-based forms', 'Other': 'Accounting and other services listed below' };
  const scope = (svc.length ? svc : c.services || []).map(w => `<li>${esc(svcName[w] || w)}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Engagement letter – ${esc(c.name)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:36px;font-size:13px;line-height:1.5}h1{font-size:19px;margin:0}.muted{color:#555}.pre{white-space:pre-line}
    .top{border-bottom:2px solid #2667d1;padding-bottom:10px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
    th{background:#eef3fb}.r{text-align:right}.sig{display:flex;justify-content:space-between;margin-top:46px}.pb{page-break-before:always}
    @media print{body{margin:14mm}.noprint{display:none}}</style></head><body>
    <div class="noprint" style="text-align:right;margin-bottom:10px"><button onclick="print()">Print / Save as PDF</button></div>
    <div class="top"><h1>${esc(firmName())}</h1><div class="muted pre">${esc(settings.firm_address || '')}</div><div class="muted">${[esc(settings.firm_phone || ''), esc(settings.firm_email || '')].filter(Boolean).join(' · ')}</div></div>
    <p>Date: ${fmtDate(letter.date || today())}</p>
    <p>To<br><b>${esc(c.name)}</b><span class="pre">${c.address ? '<br>' + esc(c.address) : ''}</span>${c.gstin ? '<br>GSTIN: ' + esc(c.gstin) : c.pan ? '<br>PAN: ' + esc(c.pan) : ''}</p>
    <p><b>Sub: Engagement letter for professional services</b></p>
    <p>Dear ${esc(c.contact_person || 'Sir / Madam')},</p>
    <p>Thank you for choosing ${esc(firmName())}. This letter confirms the work we will do for you and the terms on which we will do it.</p>
    <p><b>Scope of work</b></p><ul>${scope || '<li>As listed in the fee agreement below</li>'}</ul>
    <p><b>Fees</b> — as per the fee agreement attached.</p>
    <p><b>Terms</b></p><div class="pre">${esc(letter.terms || OB_TERMS)}</div>
    <p>Please sign and return a copy of this letter and the fee agreement as your acceptance.</p>
    <div class="sig"><div>For ${esc(firmName())}<br><br><br>Authorised signatory</div><div>Accepted for ${esc(c.name)}<br><br><br>Signature, name &amp; date</div></div>
    <div class="pb"></div><h1 style="margin-top:10px">Fee agreement</h1><p class="muted">${esc(c.name)} · effective ${fmtDate(letter.date || today())}</p>
    <table><thead><tr><th style="width:36px">#</th><th>Work</th><th>Frequency</th><th class="r">Fee (₹)</th></tr></thead><tbody>
      ${fees.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.work)}</td><td>${esc(f.freq)}</td><td class="r">${num(f.amount) ? num(f.amount).toLocaleString('en-IN') : 'As agreed'}</td></tr>`).join('') || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
    <p class="small">Fees are exclusive of GST${settings.gst_rate ? ` (currently ${esc(settings.gst_rate)}%)` : ''} and of government fees, late fees, interest and penalties. Invoices are payable within 15 days.${settings.bank_details ? '<br><b>Bank details:</b> <span class="pre">' + esc(settings.bank_details) + '</span>' : ''}</p>
    <div class="sig"><div>For ${esc(firmName())}<br><br><br>Authorised signatory</div><div>Accepted for ${esc(c.name)}<br><br><br>Signature, name &amp; date</div></div>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups for this site to print the letter', true);
  w.document.open(); w.document.write(html); w.document.close();
}
// due dates for one client over the next months (same matching rule as "Create work")
function recurringPlan(c, dues, fromYm, months) {
  const out = [];
  for (let k = 0; k < months; k++) {
    const d0 = new Date(+fromYm.slice(0, 4), +fromYm.slice(5, 7) - 1 + k, 1), y = d0.getFullYear(), m = d0.getMonth() + 1;
    dues.filter(d => (d.months || []).includes(m) && d.work_type !== 'Income Tax' && clientMatches(c, { work_type: d.work_type, applies_to: d.applies_to }))
      .forEach(d => out.push({ work_type: d.work_type, return_name: d.return_name, period: periodFor(d.period_rule, y, m), due_date: dueDateFor(d.due_day, y, m) }));
  }
  return out.filter(x => x.period).sort((a, b) => a.due_date.localeCompare(b.due_date));
}
async function createRecurringWork(c, done = () => {}) {
  const [dd, tk] = await Promise.all([must(sb.from('due_dates').select('*').order('sort')), must(sb.from('tasks').select('return_name,period').eq('client_id', c.id).limit(5000))]);
  const have = new Set((tk.data || []).map(t => t.return_name + '|' + t.period));
  let fromYm = today().slice(0, 7), months = 3;
  const m = modal(`Create recurring work – ${c.name}`, `<div class="toolbar" style="margin:0 0 10px"><label class="small">From <input type="month" data-rf value="${fromYm}"></label>
      <label class="small">for <select data-rm>${[1, 2, 3, 6, 12].map(n => `<option value="${n}" ${n === months ? 'selected' : ''}>${n} month${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
      <span class="spacer"></span><span class="muted small" data-rc></span></div>
    <p class="muted small" style="margin-top:0">From the Due dates list, for this client's services (${esc((c.services || []).join(', ') || 'none ticked')}) and GST scheme (${esc(c.gst_scheme || '—')}). Assigned to ${esc(profName(c.default_staff) || 'nobody (no default staff)')}. Work that already exists is skipped.</p>
    <div class="client-list" data-rl style="max-height:340px"></div>`, {
    wide: true, saveText: 'Create work',
    onSave: async el => {
      const pick = $$('[data-rl] input:checked', el).map(i => plan[+i.value]);
      if (!pick.length) { toast('Nothing ticked', true); return false; }
      const rows = pick.map(p => ({ client_id: c.id, ...p, assigned_to: c.default_staff || null }));
      const { data } = await must(sb.from('tasks').upsert(rows, { onConflict: 'client_id,return_name,period', ignoreDuplicates: true }).select('id'));
      const n = (data || []).length; toast(`${n} work item${n === 1 ? '' : 's'} created`); done(n);
    }
  });
  let plan = [];
  const draw = () => {
    plan = recurringPlan(c, dd.data || [], fromYm, months);
    $('[data-rl]', m.el).innerHTML = plan.length ? plan.map((p, i) => { const ex = have.has(p.return_name + '|' + p.period);
      return `<label class="check"><input type="checkbox" value="${i}" ${ex ? 'disabled' : 'checked'}> ${wtBadge(p.work_type)} <b>${esc(p.return_name)}</b> · ${esc(p.period)} <span class="muted small">due ${fmtDate(p.due_date)}${ex ? ' · already exists' : ''}</span></label>`; }).join('')
      : '<div class="empty">No due dates match. Tick the services on the client (Edit client) first.</div>';
    $('[data-rc]', m.el).textContent = `${plan.filter(p => !have.has(p.return_name + '|' + p.period)).length} new`;
  };
  draw();
  $('[data-rf]', m.el).onchange = e => { fromYm = e.target.value || today().slice(0, 7); draw(); };
  $('[data-rm]', m.el).onchange = e => { months = +e.target.value; draw(); };
}
let obShow = 'In progress';
VIEWS.onboarding = async v => {
  const r = await safe(sb.from('onboarding').select('*').order('started_on', { ascending: false }).limit(2000));
  if (r.error) return notReady(v, 'Client onboarding', 'update-session1.sql');
  const all = r.data || [];
  const notStarted = clients.filter(c => c.active && !all.some(o => o.client_id === c.id));
  v.innerHTML = `<div class="page-head"><h2>Client onboarding</h2><span class="spacer"></span>
      ${isAdmin() ? '<button class="btn" id="obStd">Edit standard checklist</button>' : ''}
      ${isManager() ? `<select id="obNew" aria-label="Start onboarding"><option value="">+ Start for a client…</option>${opts(notStarted, '', c => c.name, c => c.id)}</select>` : ''}</div>
    <div class="toolbar"><div class="seg">${['In progress', 'Completed', 'All'].map(k => `<button data-obs="${k}" class="${obShow === k ? 'on' : ''}">${k} (${k === 'All' ? all.length : all.filter(o => o.status === k).length})</button>`).join('')}</div></div>
    <div class="table-wrap">${(() => { const list = all.filter(o => obShow === 'All' || o.status === obShow).filter(o => clientById(o.client_id));
      return list.length ? `<table><thead><tr><th>Client</th><th>Started</th><th>KYC</th><th>Engagement</th><th>Set-up</th><th>Progress</th><th></th></tr></thead><tbody>${list.map(o => {
        const p = obProgress(o), grp = g => { const it = (o.items || []).filter(i => i.grp === g && !i.na); return it.length ? `${it.filter(i => i.done).length}/${it.length}` : '—'; };
        return `<tr><td><b>${esc(clientName(o.client_id))}</b><div class="muted small">${esc(profName((clientById(o.client_id) || {}).default_staff) || '')}</div></td><td>${fmtDate(o.started_on)}</td>
          <td>${grp('KYC documents')}</td><td>${grp('Engagement')}</td><td>${grp('Set-up')}</td>
          <td style="min-width:140px">${o.status === 'Completed' ? `<span class="st st-filed">Completed ${fmtDate(o.completed_on)}</span>` : `<div class="small">${p.done} / ${p.total}</div><div class="progress"><i style="width:${p.total ? Math.round(100 * p.done / p.total) : 0}%"></i></div>`}</td>
          <td><button class="btn sm" data-obo="${o.client_id}">Open</button></td></tr>`; }).join('')}</tbody></table>`
        : `<div class="empty">${obShow === 'In progress' ? 'No client is being onboarded right now.' : 'Nothing here.'}${isManager() ? ' Pick a client above, or add a new client — you will be asked to start onboarding.' : ''}</div>`; })()}</div>`;
  $$('[data-obs]', v).forEach(b => b.onclick = () => { obShow = b.dataset.obs; route(); });
  v.addEventListener('click', e => { const id = e.target.dataset.obo; if (id) openOnboarding(clientById(id)); });
  if ($('#obNew')) $('#obNew').onchange = e => { const c = clientById(e.target.value); if (c) openOnboarding(c); };
  if ($('#obStd')) $('#obStd').onclick = () => {
    modal('Standard onboarding checklist', `<p class="muted small">One item per line as <b>Group | Item</b>. Groups: ${OB_GROUPS.join(', ')}. Used for clients you start from now on; existing clients keep their own list.</p>
      <textarea name="list" rows="16" style="width:100%">${esc(obList().map(([g, l]) => `${g} | ${l}`).join('\n'))}</textarea>`, {
      extra: '<button class="btn ghost" data-obreset>Built-in list</button>',
      onSave: async el => {
        const list = fv(el, 'list').split('\n').map(s => s.split('|').map(x => x.trim())).filter(p => p[0])
          .map(p => p.length > 1 ? { grp: OB_GROUPS.find(g => lc(g) === lc(p[0])) || 'Set-up', label: p.slice(1).join(' | ') } : { grp: 'KYC documents', label: p[0] });
        await must(sb.from('settings').update({ onboard_items: list }).eq('id', 1)); settings.onboard_items = list; toast('Standard checklist saved');
      }
    });
    const rs = $('[data-obreset]'); if (rs) rs.onclick = () => { $('[name=list]').value = OB_DEFAULT.map(([g, l]) => `${g} | ${l}`).join('\n'); };
  };
};

/* =====================================================================
   v18 · SESSION 2: MONTHLY CLIENT REPORT · GSTR-1 JSON EXPORT
   ===================================================================== */
const ymLabelFull = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_FULL[m - 1]} ${y}`; };
const ymEnd = ym => { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); };
const ymShift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const TI_KIND = { GST: 'GST', TDS: 'TDS / TCS', ADV: 'Advance tax' };

/* ---------- 1. gather one client's month ---------- */
async function buildClientReport(c, ym) {
  const start = ym + '-01', end = ymEnd(ym), nextEnd = ymEnd(ymShift(ym, 1)), label = monthLabel(ym);
  const [tk, ti, gm, rn] = await Promise.all([
    must(sb.from('tasks').select('*').eq('client_id', c.id).limit(3000)),
    safe(sb.from('tax_intimations').select('*').eq('client_id', c.id).limit(500)),
    safe(sb.from('gst_months').select('*').eq('client_id', c.id).eq('period', start).maybeSingle()),
    safe(sb.from('renewals').select('kind,holder,ref_no,expires_on,status').eq('client_id', c.id).limit(200))
  ]);
  const tasks = tk.data || [];
  const inMonth = d => d && d >= start && d <= end;
  const filed = tasks.filter(t => t.status === 'Filed' && (periodToMonth(t.period) === ym || inMonth(t.filed_on)))
    .sort((a, b) => (a.filed_on || '').localeCompare(b.filed_on || '') || a.return_name.localeCompare(b.return_name))
    .map(t => ({ type: t.work_type, ret: t.return_name, period: t.period, filed_on: t.filed_on || null, arn: t.arn || '' }));
  const pending = tasks.filter(t => isOpen(t.status) && (t.status === 'Pending data' || !t.due_date || t.due_date <= nextEnd))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    .map(t => ({ type: t.work_type, ret: t.return_name, period: t.period, due: t.due_date || null, status: t.status, late: !!(t.due_date && t.due_date < today()) }));
  const tax = (ti.error ? [] : ti.data || []).filter(x => x.period === label || (x.kind === 'ADV' && (inMonth(x.due_date) || inMonth(x.paid_on))))
    .map(x => ({ kind: x.kind, period: x.period, due: x.due_date, payable: num(x.total), paid_on: x.paid_on || null, paid: x.paid_on ? num(x.paid_amount ?? x.total) : 0, challan: x.challan || '' }));
  let gst = null, missing = [];
  const row = gm.error ? null : gm.data;
  if (row && (row.sales || row.purchases || row.gstr2b || row.gstr3b)) {
    const sm = GR.summarise(row);
    gst = { sales: Math.round(sm.out.t), out_tax: Math.round(gTax(sm.out)), itc_2b: sm.has2b ? Math.round(gTax(sm.itc2b)) : null, itc_books: sm.counts.purchases ? Math.round(gTax(sm.itcBooks)) : null,
      blocked: Math.round(gTax(sm.blocked)), cash: Math.round(row.gstr3b && row.gstr3b.cash ? gTax(row.gstr3b.cash) : sm.cashTotal), cash_from: row.gstr3b && row.gstr3b.cash ? 'filed GSTR-3B' : 'draft working',
      verified: row.status === 'Verified', has2b: sm.has2b, hasBooks: !!sm.counts.purchases };
    if (sm.rec) missing = sm.rec.items.filter(o => o.st === 'books_only' && o.b).map(o => ({ supplier: o.b.n || '', gstin: o.b.g || '', inv: o.b.i, date: o.b.d || '', tax: Math.round(GR.tax(o.b)) }))
      .sort((a, b) => b.tax - a.tax);
  }
  const renew = (rn.error ? [] : rn.data || []).filter(x => rnLive(x) && x.expires_on && x.expires_on <= iso(addDays(new Date(), 60)))
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on)).map(x => ({ kind: x.kind, holder: x.holder || '', expires: x.expires_on }));
  return { v: 1, ym, label: ymLabelFull(ym), made_at: new Date().toISOString(), made_by: me.full_name || me.email,
    client: { name: c.name, gstin: c.gstin || '', pan: c.pan || '', contact: c.contact_person || '' },
    firm: { name: firmName(), address: settings.firm_address || '', phone: settings.firm_phone || '', email: settings.firm_email || '' },
    filed, pending, tax, gst, missing, missing_tax: missing.reduce((s, m) => s + m.tax, 0), renew };
}

/* ---------- 2. the printable report (also stored for the client portal) ---------- */
function clientReportHtml(R) {
  const e = esc, rs = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  const sec = (title, inner, note = '') => `<h2>${title}</h2>${note ? `<p class="muted">${note}</p>` : ''}${inner}`;
  const tbl = (head, rows, empty) => rows.length ? `<table><thead><tr>${head.map(h => `<th${/₹$/.test(h) ? ' class="r"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : `<p class="muted">${empty}</p>`;
  const taxPaid = R.tax.reduce((s, t) => s + t.paid, 0);
  const tiles = [['Returns filed', R.filed.length], ['Tax paid', rs(taxPaid)], ['Pending items', R.pending.length], ['Invoices missing in 2B', R.missing.length]];
  const g = R.gst;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(R.client.name)} – ${e(R.label)} report</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#14213d;margin:32px auto;max-width:860px;padding:0 18px;font-size:13px;line-height:1.45}
    .top{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #2667d1;padding-bottom:12px;flex-wrap:wrap}h1{font-size:20px;margin:0}
    .ttl{text-align:right}.ttl b{font-size:18px;color:#2667d1;display:block}.muted{color:#5a6478}
    .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.tile{background:#eef3fb;border-radius:10px;padding:10px 12px}.tile b{display:block;font-size:20px}
    h2{font-size:15px;margin:22px 0 6px;color:#2667d1}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5dce8;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#eef3fb;font-size:12px}.r{text-align:right}.late{color:#b42318;font-weight:700}.ok{color:#1f7a4d;font-weight:700}
    .kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kv div{border:1px solid #d5dce8;border-radius:8px;padding:8px 10px}.kv b{display:block;font-size:15px}
    .foot{margin-top:28px;border-top:1px solid #d5dce8;padding-top:8px;font-size:11px}
    @media (max-width:640px){.tiles,.kv{grid-template-columns:1fr 1fr}body{margin:16px auto}}@media print{.noprint{display:none}body{margin:10mm auto}}</style></head><body>
    <div class="noprint" style="text-align:right;margin-bottom:10px"><button onclick="print()">Print / Save as PDF</button></div>
    <div class="top"><div><h1>${e(R.firm.name)}</h1><div class="muted">${e(R.firm.address)}</div><div class="muted">${[e(R.firm.phone), e(R.firm.email)].filter(Boolean).join(' · ')}</div></div>
      <div class="ttl"><b>Monthly compliance report</b>${e(R.label)}<br><span class="muted">${e(R.client.name)}${R.client.gstin ? '<br>GSTIN ' + e(R.client.gstin) : R.client.pan ? '<br>PAN ' + e(R.client.pan) : ''}</span></div></div>
    <div class="tiles">${tiles.map(([l, v]) => `<div class="tile"><span class="muted">${l}</span><b>${v}</b></div>`).join('')}</div>
    ${sec('Returns filed', tbl(['Return', 'Period', 'Filed on', 'ARN / acknowledgement'], R.filed.map(f => `<tr><td>${e(f.ret)}</td><td>${e(f.period)}</td><td>${fmtDate(f.filed_on)}</td><td>${e(f.arn || '—')}</td></tr>`), 'No returns filed for this month yet.'))}
    ${sec('Tax paid', tbl(['Tax', 'Period', 'Payable ₹', 'Paid ₹', 'Paid on', 'Challan'], R.tax.map(t => `<tr><td>${e(TI_KIND[t.kind] || t.kind)}</td><td>${e(t.period)}</td><td class="r">${rs(t.payable)}</td><td class="r">${t.paid_on ? rs(t.paid) : '—'}</td><td class="${!t.paid_on && t.due && t.due < today() && t.payable > 0 ? 'late' : ''}">${t.paid_on ? fmtDate(t.paid_on) : t.payable > 0 ? 'Not paid · due ' + fmtDate(t.due) : '—'}</td><td>${e(t.challan || '')}</td></tr>`), 'No tax payment recorded for this month.'))}
    ${g ? sec('GST summary', `<div class="kv"><div><span class="muted">Taxable sales</span><b>${rs(g.sales)}</b></div><div><span class="muted">Output tax</span><b>${rs(g.out_tax)}</b></div>
      <div><span class="muted">ITC available (GSTR-2B)</span><b>${g.itc_2b == null ? '—' : rs(g.itc_2b)}</b></div><div><span class="muted">ITC as per your books</span><b>${g.itc_books == null ? '—' : rs(g.itc_books)}</b></div>
      <div><span class="muted">ITC not available</span><b>${rs(g.blocked)}</b></div><div><span class="muted">Cash payable (${e(g.cash_from)})</span><b>${rs(g.cash)}</b></div></div>`, g.verified ? '' : 'Working not yet verified — figures may change.') : ''}
    ${g && g.has2b && g.hasBooks ? sec('Purchase invoices missing in GSTR-2B', tbl(['Supplier', 'GSTIN', 'Invoice', 'Date', 'Tax ₹'], R.missing.slice(0, 60).map(m => `<tr><td>${e(m.supplier)}</td><td>${e(m.gstin)}</td><td>${e(m.inv)}</td><td>${fmtDate(m.date)}</td><td class="r">${rs(m.tax)}</td></tr>`), '<span class="ok">✓ All purchase invoices in your books appear in GSTR-2B.</span>')
      + (R.missing.length ? `<p>ITC of <b>${rs(R.missing_tax)}</b> cannot be claimed until these suppliers file their returns. Please ask them to upload the invoices.${R.missing.length > 60 ? ` (${R.missing.length - 60} more not shown.)` : ''}</p>` : '')) : ''}
    ${sec('Pending items', tbl(['Work', 'Period', 'Due', 'Status'], R.pending.map(p => `<tr><td>${e(p.ret)}</td><td>${e(p.period)}</td><td class="${p.late ? 'late' : ''}">${fmtDate(p.due)}</td><td>${p.status === 'Pending data' ? '<b>Waiting for your documents</b>' : e(p.status)}</td></tr>`), '<span class="ok">✓ Nothing pending.</span>'))}
    ${R.renew.length ? sec('Renewals coming up', tbl(['Item', 'Holder', 'Expires'], R.renew.map(x => `<tr><td>${e(x.kind)}</td><td>${e(x.holder)}</td><td>${fmtDate(x.expires)}</td></tr>`), '')) : ''}
    <div class="foot muted">Prepared by ${e(R.firm.name)} on ${fmtDate(R.made_at.slice(0, 10))}. Please contact us for any clarification.</div></body></html>`;
}
const clientReportMsg = (R, c, published) => {
  const rs = n => inr(Math.round(n || 0)), paid = R.tax.filter(t => t.paid_on), due = R.tax.filter(t => !t.paid_on && t.payable > 0), waiting = R.pending.filter(p => p.status === 'Pending data');
  const L = [`Dear ${c.contact_person || c.name},`, `Your compliance summary for ${R.label}:`];
  L.push(R.filed.length ? `\nReturns filed:\n${R.filed.map(f => `- ${f.ret} (${f.period})${f.arn ? ' · ARN ' + f.arn : ''}`).join('\n')}` : '\nReturns filed: none yet.');
  if (paid.length) L.push(`\nTax paid:\n${paid.map(t => `- ${TI_KIND[t.kind]} ${t.period}: ${rs(t.paid)}`).join('\n')}`);
  if (due.length) L.push(`\nTax to pay:\n${due.map(t => `- ${TI_KIND[t.kind]} ${t.period}: ${rs(t.payable)} by ${fmtDate(t.due)}`).join('\n')}`);
  if (R.gst && R.gst.itc_2b != null) L.push(`\nITC available in GSTR-2B: ${rs(R.gst.itc_2b)}`);
  if (R.missing.length) L.push(`${R.missing.length} purchase invoice${R.missing.length > 1 ? 's' : ''} (ITC ${rs(R.missing_tax)}) not yet in GSTR-2B — please ask the supplier${R.missing.length > 1 ? 's' : ''} to upload.`);
  if (waiting.length) L.push(`\nWaiting for your documents:\n${waiting.map(p => `- ${p.ret} (${p.period})`).join('\n')}`);
  L.push(published ? `\nFull report: sign in to your client portal ${portalUrl()}` : '\nThe full report (PDF) is attached / will follow.');
  L.push(`- ${firmName()}`);
  return L.join('\n');
};

/* ---------- 3. the page ---------- */
let crMonth = prevMonth(), crQ = '';
VIEWS.clientreport = async v => {
  const r = await safe(sb.from('client_reports').select('id,client_id,period,published,published_at,sent_on,sent_via,made_at').eq('period', crMonth + '-01').limit(5000));
  if (r.error) return notReady(v, 'Monthly client report', 'update-session2.sql');
  const rep = new Map((r.data || []).map(x => [x.client_id, x]));
  const list = myClients();
  v.innerHTML = `<div class="page-head"><h2>Monthly client report</h2><span class="spacer"></span><label class="small muted" for="crM">Month</label><input type="month" id="crM" value="${esc(crMonth)}"></div>
    <p class="muted small" style="margin-top:-6px">Returns filed with ARN, tax paid, ITC, pending items and purchase invoices missing in GSTR-2B — for each client. <b>Publish</b> puts it in the client portal; WhatsApp / Email send the summary.</p>
    <div class="bento-stats card stats4" style="margin-bottom:14px"><div class="mini blue"><span>Clients</span><b>${list.length}</b></div>
      <div class="mini green"><span>Published to portal</span><b>${list.filter(c => (rep.get(c.id) || {}).published).length}</b></div>
      <div class="mini amber"><span>Not sent yet</span><b>${list.filter(c => !(rep.get(c.id) || {}).sent_on).length}</b></div>
      <div class="mini"><span>Month</span><b class="tp-amt">${esc(ymLabelFull(crMonth))}</b></div></div>
    <div class="toolbar"><input type="search" id="crQ" placeholder="Search client" value="${esc(crQ)}"></div><div id="crList"></div>`;
  const draw = () => {
    const q = lc(crQ), rows = list.filter(c => !q || lc(c.name).includes(q));
    $('#crList').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Services</th><th>Portal</th><th>Sent</th><th></th></tr></thead><tbody>${rows.map(c => { const x = rep.get(c.id) || {};
      return `<tr data-c="${c.id}"><td><b>${esc(c.name)}</b><div class="muted small">${esc(c.gstin || c.pan || '')}</div></td><td class="wrap">${(c.services || []).map(wtBadge).join(' ')}</td>
        <td class="small">${x.published ? `<span class="st st-filed">Published ${fmtDate((x.published_at || '').slice(0, 10))}</span>` : '<span class="muted">—</span>'}</td>
        <td class="small">${x.sent_on ? `${fmtDate(x.sent_on)}<div class="muted">${esc(x.sent_via || '')}</div>` : '<span class="muted">—</span>'}</td>
        <td class="row-btns"><button class="btn sm" data-cr="view">Report / PDF</button><button class="btn sm ${x.sent_on ? '' : 'primary'}" data-cr="wa">WhatsApp</button><button class="btn sm" data-cr="mail">Email</button>
          ${isManager() ? `<button class="btn sm ghost" data-cr="${x.published ? 'unpub' : 'pub'}">${x.published ? 'Unpublish' : 'Publish to portal'}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="table-wrap"><div class="empty">No clients.</div></div>';
  };
  draw();
  $('#crM').onchange = e => { crMonth = e.target.value || prevMonth(); route(); };
  $('#crQ').oninput = e => { crQ = e.target.value; draw(); };
  const store = async (c, R, patch) => {
    const rec = { client_id: c.id, period: crMonth + '-01', data: R, html: clientReportHtml(R), made_at: R.made_at, ...patch };
    const { data } = await must(sb.from('client_reports').upsert(rec, { onConflict: 'client_id,period' }).select('id,client_id,period,published,published_at,sent_on,sent_via,made_at').single());
    rep.set(c.id, data); draw();
  };
  $('#crList').addEventListener('click', async e => {
    const b = e.target.closest('[data-cr]'); if (!b) return;
    const c = clientById(b.closest('tr').dataset.c), act = b.dataset.cr, x = rep.get(c.id) || {};
    if (act === 'mail' && !firstEmail(c)) return toast('No email saved for this client (Clients → Edit)', true);
    const w = act === 'view' || act === 'wa' ? window.open('', '_blank') : null;     // open now, fill after the data loads (pop-up rule)
    if ((act === 'view' || act === 'wa') && !w) return toast('Allow pop-ups for this site', true);
    if (w) w.document.write('<p style="font-family:Arial;padding:20px">Preparing the report…</p>');
    b.disabled = true;
    try {
      const R = await buildClientReport(c, crMonth);
      if (act === 'view') { w.document.open(); w.document.write(clientReportHtml(R)); w.document.close(); await store(c, R, {}); }
      if (act === 'wa') { if (!c.phone) toast('No phone saved for this client — pick the contact in WhatsApp'); w.location.href = waShare(clientReportMsg(R, c, !!x.published), c.phone); await store(c, R, { sent_on: today(), sent_via: 'WhatsApp' }); }
      if (act === 'mail') { location.href = mailUrl(c.email, `Compliance report – ${R.label} – ${c.name}`, clientReportMsg(R, c, !!x.published)); await store(c, R, { sent_on: today(), sent_via: 'Email' }); }
      if (act === 'pub') { await store(c, R, { published: true, published_at: new Date().toISOString(), published_by: me.id }); toast(`Published — ${c.name} can see it in the client portal`); }
      if (act === 'unpub') { await must(sb.from('client_reports').update({ published: false }).eq('client_id', c.id).eq('period', crMonth + '-01')); rep.set(c.id, { ...x, published: false }); draw(); toast('Removed from the client portal'); }
    } catch (err) { if (w) w.close(); toast(friendly(err), true); }
    finally { b.disabled = false; }
  });
};

/* ---------- 4. GSTR-1 JSON (GST portal: Returns → GSTR-1 → Prepare offline → Upload) ---------- */
const g1json = (() => {
  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const dmy = s => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
  const up = v => String(v ?? '').trim().toUpperCase();
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const det = (x, s = 1) => { const o = { txval: r2(s * x.amt), rt: x.rt }; if (x.inter) o.iamt = r2(s * x.ig); else { o.camt = r2(s * x.cg); o.samt = r2(s * x.sg); } o.csamt = r2(s * x.cs); return o; };
  const DOCNUM = Object.fromEntries(G1L.docs.map((d, i) => [d, i + 1]));
  function build(D, c, period) {
    const own = String(c.gstin || '').slice(0, 2), S = G1.calcSales(D.sales || [], own, c.gstin), V = G1.calcAdv(D.adv || [], own), sm = G1.summary(D, c);
    const errors = [...S, ...V].filter(o => o.x && !o.x.ok).map(o => `${o.row.no || o.row.rv || '(no number)'}: ${o.x.check}`);
    const ok = S.filter(o => o.x && o.x.ok).map(o => ({ ...o, x: { ...o.x, rt: has(o.row.nil) ? 0 : num(o.row.rate) } }));
    const notes = [], out = { gstin: up(c.gstin), fp: period.slice(5, 7) + period.slice(0, 4), version: 'GST3.2.3', hash: 'hash' };
    // group lines of the same document into one invoice with rate-wise items
    const group = (rows, keyFn) => { const m = new Map(); rows.forEach(o => { const k = keyFn(o); if (!m.has(k)) m.set(k, []); m.get(k).push(o); }); return [...m.values()]; };
    const items = (lines, s = 1, nest = true) => { const byRate = new Map(); lines.forEach(({ x }) => { const k = x.rt; const a = byRate.get(k) || { amt: 0, ig: 0, cg: 0, sg: 0, cs: 0, rt: k, inter: x.inter }; a.amt += x.amt; a.ig += x.ig; a.cg += x.cg; a.sg += x.sg; a.cs += x.cs; byRate.set(k, a); });
      return [...byRate.values()].map((a, i) => nest ? { num: i + 1, itm_det: det(a, s) } : det(a, s)); };
    const val = lines => r2(lines.reduce((t, { row, x }) => t + x.amt + (row.rc === 'Yes' ? 0 : x.ig + x.cg + x.sg) + x.cs, 0));
    const invTyp = r => /^SEZ - Without/.test(r.exp || '') ? 'SEWOP' : /^SEZ - With/.test(r.exp || '') ? 'SEWP' : 'R';
    const pos = (o) => o.x.sc === '99' ? '96' : o.x.sc;
    // B2B + SEZ
    const b2b = ok.filter(o => ['B2B', 'SEZ'].includes(o.x.table) && o.x.type === 'Invoice');
    if (b2b.length) out.b2b = group(b2b, o => up(o.row.gstin)).map(g => ({ ctin: up(g[0].row.gstin),
      inv: group(g, o => up(o.row.no)).map(L => ({ inum: String(L[0].row.no).trim(), idt: dmy(L[0].row.d), val: val(L), pos: pos(L[0]), rchrg: L[0].row.rc === 'Yes' ? 'Y' : 'N', inv_typ: invTyp(L[0].row), itms: items(L) })) }));
    // B2CL
    const b2cl = ok.filter(o => o.x.table === 'B2CL');
    if (b2cl.length) out.b2cl = group(b2cl, o => pos(o)).map(g => ({ pos: pos(g[0]), inv: group(g, o => up(o.row.no)).map(L => ({ inum: String(L[0].row.no).trim(), idt: dmy(L[0].row.d), val: val(L), itms: items(L) })) }));
    // Exports
    const exp = ok.filter(o => o.x.table === 'EXP' && o.x.type === 'Invoice');
    if (exp.length) out.exp = group(exp, o => /Without/.test(o.row.exp) ? 'WOPAY' : 'WPAY').map(g => ({ exp_typ: /Without/.test(g[0].row.exp) ? 'WOPAY' : 'WPAY',
      inv: group(g, o => up(o.row.no)).map(L => ({ inum: String(L[0].row.no).trim(), idt: dmy(L[0].row.d), val: val(L), itms: items(L, 1, false).map(d => ({ txval: d.txval, rt: d.rt, iamt: d.iamt || 0, csamt: d.csamt })) })) }));
    // Credit / debit notes
    const notesR = ok.filter(o => o.x.type !== 'Invoice' && has(o.row.gstin));
    if (notesR.length) out.cdnr = group(notesR, o => up(o.row.gstin)).map(g => ({ ctin: up(g[0].row.gstin),
      nt: group(g, o => up(o.row.no)).map(L => ({ ntty: L[0].x.type === 'Credit Note' ? 'C' : 'D', nt_num: String(L[0].row.no).trim(), nt_dt: dmy(L[0].row.d), val: val(L), pos: pos(L[0]), rchrg: 'N', inv_typ: invTyp(L[0].row), itms: items(L) })) }));
    const notesU = ok.filter(o => o.x.type !== 'Invoice' && !has(o.row.gstin));
    const cdnur = [], b2csNotes = [];
    group(notesU, o => up(o.row.no)).forEach(L => {
      const r = L[0].row, isExp = /^Export/.test(r.exp || ''), big = L[0].x.inter && val(L) > 100000;
      if (isExp || big) cdnur.push({ typ: isExp ? (/Without/.test(r.exp) ? 'EXPWOP' : 'EXPWP') : 'B2CL', ntty: L[0].x.type === 'Credit Note' ? 'C' : 'D', nt_num: String(r.no).trim(), nt_dt: dmy(r.d), val: val(L), ...(isExp ? {} : { pos: pos(L[0]) }), itms: items(L) });
      else b2csNotes.push(...L);
    });
    if (cdnur.length) out.cdnur = cdnur;
    if (b2csNotes.length) notes.push(`${new Set(b2csNotes.map(o => up(o.row.no))).size} credit/debit note(s) to unregistered customers were netted into B2CS (Table 7), as the portal requires.`);
    // B2CS (state + rate, notes netted)
    const bcs = new Map();
    [...ok.filter(o => o.x.table === 'B2CS'), ...b2csNotes].forEach(o => { const k = pos(o) + '|' + o.x.rt + '|' + (o.row.eco ? up(o.row.eco) : ''); const s = o.x.sign;
      const a = bcs.get(k) || { pos: pos(o), rt: o.x.rt, inter: o.x.inter, eco: o.row.eco ? up(o.row.eco) : '', amt: 0, ig: 0, cg: 0, sg: 0, cs: 0 }; a.amt += s * o.x.amt; a.ig += s * o.x.ig; a.cg += s * o.x.cg; a.sg += s * o.x.sg; a.cs += s * o.x.cs; bcs.set(k, a); });
    if (bcs.size) out.b2cs = [...bcs.values()].filter(a => Math.abs(a.amt) > 0.004).map(a => ({ sply_ty: a.inter ? 'INTER' : 'INTRA', pos: a.pos, typ: a.eco ? 'E' : 'OE', ...(a.eco ? { etin: a.eco } : {}), ...det(a) }));
    // Nil / exempt / non-GST (Table 8)
    const nil = {};
    ok.filter(o => o.x.table === 'NIL').forEach(o => { const k = (o.x.inter ? 'INTR' : 'INTRA') + (has(o.row.gstin) ? 'B2B' : 'B2C'); const a = nil[k] = nil[k] || { sply_ty: k, expt_amt: 0, nil_amt: 0, ngsup_amt: 0 };
      const f = o.row.nil === 'Exempted' ? 'expt_amt' : o.row.nil === 'Non-GST' ? 'ngsup_amt' : 'nil_amt'; a[f] = r2(a[f] + o.x.sign * o.x.amt); });
    if (Object.keys(nil).length) out.nil = { inv: Object.values(nil) };
    // Advances (11A / 11B)
    const adv = (kind) => { const m = new Map(); V.filter(o => o.x && o.x.ok && kind.test(o.row.ty)).forEach(({ row, x }) => { const p = x.sc, k = p;
        const e = m.get(k) || { pos: p, sply_ty: x.inter ? 'INTER' : 'INTRA', rates: new Map() }; const rt = num(row.rate), a = e.rates.get(rt) || { rt, ad_amt: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        a.ad_amt = r2(a.ad_amt + x.amt); a.iamt = r2(a.iamt + x.ig); a.camt = r2(a.camt + x.cg); a.samt = r2(a.samt + x.sg); a.csamt = r2(a.csamt + x.cs); e.rates.set(rt, a); m.set(k, e); });
      return [...m.values()].map(e => ({ pos: e.pos, sply_ty: e.sply_ty, itms: [...e.rates.values()].map(a => { const o = { rt: a.rt, ad_amt: a.ad_amt }; if (e.sply_ty === 'INTER') o.iamt = a.iamt; else { o.camt = a.camt; o.samt = a.samt; } o.csamt = a.csamt; return o; }) })); };
    const at = adv(/11A/), txpd = adv(/11B/);
    if (at.length) out.at = at; if (txpd.length) out.txpd = txpd;
    // HSN (Table 12, B2B and B2C split)
    const hb = [], hc = [];
    Object.entries(sm.hsn).forEach(([k, h]) => { const [tab, code, rate, uqc] = k.split('|');
      const e = { hsn_sc: code, desc: '', uqc: uqc || 'NA', qty: r2(h.q), rt: +rate, txval: r2(h.t), iamt: r2(h.ig), camt: r2(h.cg), samt: r2(h.sg), csamt: r2(h.cs) };
      (tab === 'B2B' ? hb : hc).push(e); });
    if (hb.length || hc.length) out.hsn = { ...(hb.length ? { hsn_b2b: hb.map((e, i) => ({ ...e, num: i + 1 })) } : {}), ...(hc.length ? { hsn_b2c: hc.map((e, i) => ({ ...e, num: i + 1 })) } : {}) };
    // Documents issued (Table 13)
    const docs = sm.docs.filter(d => d.total);
    if (docs.length) out.doc_issue = { doc_det: docs.map(d => ({ doc_num: DOCNUM[d.nat], docs: [{ num: 1, from: String(d.from), to: String(d.to), totnum: num(d.total), cancel: num(d.cancelled), net_issue: num(d.net) }] })) };
    const amendN = G1.calcAmend(D.amend || [], own).filter(o => o.x).length;
    if (amendN) notes.push(`${amendN} amendment row(s) are not included — enter amendments (Tables 9A/9C/10) directly on the GST portal.`);
    if (c.gst_scheme === 'QRMP') notes.push('QRMP client: for a quarter-end month this is GSTR-1 (quarterly) and must hold the whole quarter; other months are IFF (B2B only) — upload B2B there.');
    const count = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'].reduce((s, k) => s + (out[k] || []).length, 0);
    return { json: out, errors, notes, count, summary: sm };
  }
  return { build };
})();

// GST review → Tax payment intimation for the same month
document.addEventListener('click', e => { if (!e.target.closest) return; if (e.target.closest('[data-tpfrom]')) { tpTab = 'GST'; tpMonth = grMonth; } if (e.target.closest('[data-crgo]')) { crMonth = grMonth; crQ = (clientById(grClient) || {}).name || ''; } }, true);

// expose pure helpers for testing
/* =====================================================================
   v20 · SESSION 3: MCA DEPTH — company master, directors, AGM-based ROC dates, DIR-3 KYC, ADT-1 / DPT-3 / MSME-1
   ===================================================================== */
const MCA_TYPES = ['Private company', 'Public company', 'OPC', 'Section 8', 'Producer company', 'Nidhi', 'LLP'];
const MCA_DESIG = ['Director', 'Managing Director', 'Whole-time Director', 'Additional Director', 'Nominee Director', 'Independent Director', 'Designated Partner', 'Partner', 'Company Secretary', 'CFO', 'CEO', 'Manager'];
const CIN_TYPE = { PTC: 'Private company', PLC: 'Public company', OPC: 'OPC', NPL: 'Section 8', FTC: 'Private company', FLC: 'Public company', GOI: 'Public company', SGC: 'Public company', GAP: 'Section 8', GAT: 'Public company', ULL: 'Public company', ULT: 'Private company' };
const STATE_ROC = { TN: 'RoC Chennai', KA: 'RoC Bengaluru', KL: 'RoC Ernakulam', AP: 'RoC Vijayawada', TG: 'RoC Hyderabad', MH: 'RoC Mumbai', DL: 'RoC Delhi', GJ: 'RoC Ahmedabad', WB: 'RoC Kolkata', PY: 'RoC Puducherry', RJ: 'RoC Jaipur', UP: 'RoC Kanpur', HR: 'RoC Delhi', MP: 'RoC Gwalior', OR: 'RoC Cuttack', GA: 'RoC Goa', PB: 'RoC Chandigarh', CH: 'RoC Chandigarh', BR: 'RoC Patna', AS: 'RoC Shillong', JH: 'RoC Ranchi', CT: 'RoC Bilaspur', UR: 'RoC Uttarakhand', HP: 'RoC Himachal Pradesh', JK: 'RoC Jammu' };
const MCA = (() => {
  const p2 = n => String(n).padStart(2, '0');
  const isoD = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const plus = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const fyL = s => `${s}-${String(s + 1).slice(2)}`;                 // 2025 → "2025-26"
  const FY = s => `FY ${fyL(s)}`;
  const fyStartOf = s => { const [y, m] = s.split('-').map(Number); return m >= 4 ? y : y - 1; };
  const isLLP = co => (co && co.entity_type) === 'LLP';
  const isOPC = co => (co && co.entity_type) === 'OPC';
  function cinInfo(s) {
    const u = String(s || '').toUpperCase().replace(/\s/g, '');
    let m = u.match(/^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$/);
    if (m) return { kind: 'company', listed: m[1] === 'L', state: m[3], year: +m[4], code: m[5], type: CIN_TYPE[m[5]] || '', roc: STATE_ROC[m[3]] || '' };
    if (/^[A-Z]{3}-\d{4}$/.test(u)) return { kind: 'llp', type: 'LLP' };
    return null;
  }
  const dinOk = d => /^\d{8}$/.test(String(d || ''));
  // start year of the company's first financial year (Sec 2(41): incorporated on/after 1 Jan → first FY may end 31 Mar of the next year)
  const firstFy = co => co.first_fy_end ? +co.first_fy_end.slice(0, 4) - 1 : co.incorporated_on ? +co.incorporated_on.slice(0, 4) : null;
  const agmOf = (co, F) => (co.agms || []).find(a => a.fy === fyL(F)) || {};
  function agmDue(co, F) {                                                  // { due, basis } — null for OPC / LLP
    if (isLLP(co) || isOPC(co)) return null;
    const a = agmOf(co, F), first = firstFy(co) === F;
    const due = a.extended_to || (first ? `${F + 1}-12-31` : `${F + 1}-09-30`);
    return { due, first, basis: a.extended_to ? `AGM extended by RoC to ${a.extended_to}` : first ? 'First AGM: within 9 months of the end of the first FY (Sec 96)' : 'Within 6 months of the FY end (Sec 96)' };
  }
  // next DIR-3 KYC due: 30 June after every third consecutive FY (Rule 12A, from 31 Mar 2026). Filed in FY 2025-26 → 30 Jun 2028.
  function kycNext(d, t) {
    if (d.kyc_next) return { due: d.kyc_next, basis: 'Next KYC date set by hand' };
    if (d.kyc_on) { const e = fyStartOf(d.kyc_on) + 1; return { due: `${e + 2}-06-30`, basis: `Last KYC filed ${d.kyc_on} (FY ${fyL(e - 1)}) — next by 30 June after the third FY (Rule 12A)` }; }
    const y = +t.slice(0, 4), nxt = t <= `${y}-06-30` ? `${y}-06-30` : `${y + 1}-06-30`;
    return { due: nxt, unknown: true, basis: 'Last KYC date not saved — check the DIN status on MCA and enter it' };
  }
  const live = (d, from) => !d.ceased_on || d.ceased_on >= from;
  // ROC work for the accounts year F (FY F-(F+1)): annual forms, DPT-3, MSME-1 (H2 of F, H1 of F+1), DIR-3 KYC falling due in the filing year
  function plan(co, dirs = [], F, { t = isoD(new Date()), kycOwner = () => true } = {}) {
    const out = [], fyEnd = `${F + 1}-03-31`, a = agmOf(co, F), ap = { dpt3: true, msme1: false, cfs: false, xbrl: false, ...(co.applies || {}) };
    const add = (o) => out.push({ period: FY(F), ...o });
    const ff = firstFy(co);
    if (ff != null && ff > F) { /* not yet incorporated in this accounts year */ }
    else if (isLLP(co)) {
      add({ return_name: 'LLP Form 11', due: `${F + 1}-05-30`, basis: 'Annual return — by 30 May' });
      add({ return_name: 'LLP Form 8', due: `${F + 1}-10-30`, basis: 'Statement of account & solvency — by 30 October' });
    } else {
      const ag = agmDue(co, F), held = a.agm_on || null;
      if (ag) add({ return_name: 'AGM', due: held || ag.due, done: !!held, basis: held ? `AGM held on ${held}` : ag.basis, ag: true });
      const base = held || (ag && ag.due), est = !held && !isOPC(co);
      const aocDue = isOPC(co) ? plus(fyEnd, 180) : plus(base, 30);
      const aocBasis = isOPC(co) ? 'OPC: within 180 days of the FY end' : held ? '30 days from the AGM' : '30 days from the last date for the AGM (AGM date not entered yet)';
      add({ return_name: ap.xbrl ? 'AOC-4 XBRL' : 'AOC-4', due: aocDue, est, basis: aocBasis });
      if (ap.cfs) add({ return_name: 'AOC-4 CFS', due: aocDue, est, basis: aocBasis + ' (consolidated)' });
      const mgt = isOPC(co) || co.small_company ? 'MGT-7A' : 'MGT-7';
      add({ return_name: mgt, due: isOPC(co) ? plus(`${F + 1}-09-30`, 60) : plus(base, 60), est,
        basis: isOPC(co) ? 'OPC: 60 days from the date the AGM would have been due (30 Sep)' : held ? '60 days from the AGM' : '60 days from the last date for the AGM (AGM date not entered yet)' });
      const au = co.auditor || {};
      if (!isOPC(co) && (!au.name || au.to_fy === fyL(F)))
        add({ return_name: 'ADT-1', due: plus(base, 15), est, basis: !au.name ? 'No auditor saved — appointment / re-appointment at this AGM, ADT-1 within 15 days' : `Auditor's term ends at this AGM (term to FY ${au.to_fy}) — new or re-appointment, ADT-1 within 15 days` });
      if (ap.dpt3) add({ return_name: 'DPT-3', due: `${F + 1}-06-30`, basis: 'Return of deposits / outstanding loans as on 31 March — by 30 June' });
      if (ap.msme1) {
        add({ return_name: 'MSME-1', period: `H2 (Oct–Mar) ${FY(F)}`, due: `${F + 1}-04-30`, basis: 'MSE supplier dues over 45 days, Oct–Mar — by 30 April' });
        add({ return_name: 'MSME-1', period: `H1 (Apr–Sep) ${FY(F + 1)}`, due: `${F + 1}-10-31`, basis: 'MSE supplier dues over 45 days, Apr–Sep — by 31 October' });
      }
    }
    const wFrom = `${F + 1}-04-01`, wTo = `${F + 2}-03-31`;
    dirs.filter(d => dinOk(d.din) && live(d, wFrom) && kycOwner(d)).forEach(d => {
      const k = kycNext(d, t);
      if (k.unknown ? F === fyStartOf(t) - 1 : k.due <= wTo && (k.due >= wFrom || k.due < t))
        out.push({ return_name: 'DIR-3 KYC', period: `KYC ${k.due.slice(0, 4)} · ${d.name} · DIN ${d.din}`, due: k.due, est: !!k.unknown, basis: k.basis, din: d.din });
    });
    return out;
  }
  // paste from MCA V3 "View company / LLP master data" → director table
  function parseDirectorPaste(text) {
    const out = [], seen = new Set();
    String(text || '').split(/\r?\n/).forEach(line => {
      const m = line.match(/(^|\D)(\d{8})(\D|$)/); if (!m) return;
      const din = m[2]; if (seen.has(din)) return;
      const cells = line.split(/\t| {2,}/).map(s => s.trim()).filter(Boolean);
      const dates = (line.match(/\b\d{1,2}[\/.\-](\d{1,2}|[A-Za-z]{3})[\/.\-]\d{2,4}\b/g) || []);
      const desig = [...MCA_DESIG].sort((p, q) => q.length - p.length).find(x => new RegExp('\\b' + x.replace(/[-]/g, '.') + '\\b', 'i').test(line)) || (/designated partner/i.test(line) ? 'Designated Partner' : /director/i.test(line) ? 'Director' : '');
      let name = cells.find(c => /[A-Za-z]{2}/.test(c) && !c.includes(din) && !MCA_DESIG.some(x => lc(c) === lc(x)) && !/^(yes|no|active|approved|-)$/i.test(c) && !/\d{1,2}[\/.\-]/.test(c) && !/^[A-Z]{5}\d{4}[A-Z]$/.test(c));
      if (!name) { const rest = line.replace(din, ' ').replace(/\d[\d\/.\-]*/g, ' '); name = rest.replace(new RegExp(desig || '^$', 'i'), ' ').replace(/\s+/g, ' ').trim(); }
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (!name) return;
      seen.add(din);
      const pan = (line.match(/\b[A-Z]{5}\d{4}[A-Z]\b/) || [])[0] || null;
      out.push({ din, name: name === name.toUpperCase() ? name.toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase()) : name, designation: desig || 'Director', appointed_on: dates[0] ? (anyDate(dates[0].replace(/\./g, '/')) || null) : null, ceased_on: dates[1] ? (anyDate(dates[1].replace(/\./g, '/')) || null) : null, pan });
    });
    return out;
  }
  return { cinInfo, dinOk, agmDue, agmOf, kycNext, plan, parseDirectorPaste, fyL, FY, fyStartOf, isLLP, isOPC, firstFy, plus };
})();

let mcaTab = 'companies', mcaFy = MCA.fyStartOf(today()) - 1, mcaQ = '', mcaWin = 'all';
async function mcaLoad() {
  const [co, di, tk, rn] = await Promise.all([
    safe(sb.from('mca_companies').select('*').limit(3000)),
    safe(sb.from('mca_directors').select('*').order('name').limit(10000)),
    safe(sb.from('tasks').select('id,client_id,return_name,period,due_date,status,assigned_to,filed_on,arn').eq('work_type', 'ROC/MCA').limit(10000)),
    safe(sb.from('renewals').select('id,client_id,kind,holder,expires_on,status').eq('kind', 'DSC').limit(5000))
  ]);
  if (co.error || di.error) return null;
  return { co: co.data || [], di: di.data || [], tk: tk.data || [], rn: rn.data || [] };
}
// one owner company per DIN for the KYC task (a director on 3 companies files one KYC)
function mcaKycOwners(cos, dirs) {
  const own = {}, name = id => lc(clientName(id));
  dirs.filter(d => MCA.dinOk(d.din) && !d.ceased_on).sort((a, b) => name(a.client_id).localeCompare(name(b.client_id))).forEach(d => { if (!own[d.din]) own[d.din] = d.client_id; });
  return own;
}
function mcaCompanyList(D) {
  const byC = Object.fromEntries(D.co.map(x => [x.client_id, x]));
  return clients.filter(c => (c.active || byC[c.id]) && (byC[c.id] || c.cin || (c.services || []).includes('ROC/MCA')))
    .map(c => ({ c, co: byC[c.id] || { client_id: c.id, entity_type: (MCA.cinInfo(c.cin) || {}).type || '', cin: c.cin || '', agms: [], auditor: {}, applies: {}, _new: true } }));
}
const mcaTaskKey = (cid, rn, p) => `${cid}|${lc(rn)}|${lc(p)}`;
function mcaPlanAll(D, F) {
  const own = mcaKycOwners(D.co, D.di), tmap = new Map(D.tk.map(x => [mcaTaskKey(x.client_id, x.return_name, x.period), x])), t = today();
  return mcaCompanyList(D).flatMap(({ c, co }) => {
    const dirs = D.di.filter(d => d.client_id === c.id);
    return MCA.plan(co, dirs, F, { t, kycOwner: d => own[d.din] === c.id }).map(it => ({ ...it, c, co, task: tmap.get(mcaTaskKey(c.id, it.return_name, it.period)) || null }));
  });
}
const mcaStatus = it => it.done ? 'done' : it.task ? (it.task.status === 'Filed' ? 'filed' : it.task.status === 'Not applicable' ? 'na' : 'open') : 'none';
const dscFor = (D, d) => D.rn.filter(r => r.client_id === d.client_id && r.holder && lc(r.holder).includes(lc(d.name).split(' ')[0])).sort((a, b) => (b.expires_on || '').localeCompare(a.expires_on || ''))[0];

VIEWS.mca = async v => {
  const D = await mcaLoad();
  if (!D) return notReady(v, 'Companies & LLPs', 'update-session3.sql');
  const t = today(), in30 = iso(addDays(new Date(), 30)), F = mcaFy;
  const list = mcaCompanyList(D), items = mcaPlanAll(D, F);
  const open = items.filter(i => !i.ag && !['filed', 'na'].includes(mcaStatus(i)));
  const agmLate = items.filter(i => i.ag && !i.done && i.due < t).length;
  const late = open.filter(i => i.due < t).length, due30 = open.filter(i => i.due >= t && i.due <= in30).length;
  const kyc = items.filter(i => i.return_name === 'DIR-3 KYC' && !['filed', 'na'].includes(mcaStatus(i)) && (i.due <= iso(addDays(new Date(), 90)) || i.est)).length;
  const noWork = open.filter(i => !i.task).length;
  const fyOpts = [0, 1, 2, 3].map(k => MCA.fyStartOf(t) - k).map(s => `<option value="${s}" ${s === F ? 'selected' : ''}>Accounts ${MCA.FY(s)}</option>`).join('');
  v.innerHTML = `<div class="page-head"><h2>Companies &amp; LLPs</h2><span class="muted">CIN · directors · AGM · ROC forms · DIR-3 KYC</span><span class="spacer"></span>
      <select id="mcFy" aria-label="Accounts year">${fyOpts}</select>
      <button class="btn" id="mcTpl">Excel template</button><button class="btn" id="mcImp">Import Excel</button><button class="btn" id="mcCsv">Export CSV</button>
      ${isManager() ? `<button class="btn primary" id="mcWork" ${noWork ? '' : 'disabled'}>Create ROC work (${noWork})</button>` : ''}<input type="file" id="mcFile" accept=".xlsx,.xls,.csv" hidden></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <button class="mini red" data-mw="agm"><span>AGM overdue</span><b>${agmLate}</b></button>
      <button class="mini red" data-mw="late"><span>ROC forms overdue</span><b>${late}</b></button>
      <button class="mini amber" data-mw="30"><span>Due in 30 days</span><b>${due30}</b></button>
      <button class="mini blue" data-mw="kyc"><span>DIR-3 KYC to check</span><b>${kyc}</b></button></div>
    <p class="muted small" style="margin:-4px 2px 12px">Dates follow the AGM: AOC-4 30 days, MGT-7/7A 60 days, ADT-1 15 days after it. Until the AGM date is entered they use the last date for the AGM (marked “est.”). DIR-3 KYC is now once every three years — by 30 June after the third FY (Rule 12A, from 31 Mar 2026).</p>
    <div class="toolbar"><div class="seg">${[['companies', `Companies · ${list.length}`], ['due', `ROC due list · ${items.filter(i => !i.ag).length}`], ['directors', `Directors · ${D.di.length}`]].map(([k, l]) => `<button data-mt="${k}" class="${mcaTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input type="search" id="mcQ" placeholder="Search company / CIN / director / DIN" value="${esc(mcaQ)}"><span class="spacer"></span>
      ${mcaTab === 'due' ? `<select id="mcW" aria-label="Show">${opts([['all', 'All'], ['open', 'Open'], ['late', 'Overdue'], ['30', 'Due in 30 days'], ['nowork', 'No work item yet'], ['kyc', 'DIR-3 KYC']], mcaWin, x => x[1], x => x[0])}</select>` : ''}
      <button class="btn" id="mcAdd">+ Company / LLP</button></div>
    <div id="mcBody"></div>`;
  const q = () => lc(mcaQ);
  const body = $('#mcBody');
  const pill = it => { const s = mcaStatus(it);
    if (s === 'done') return '<span class="st st-filed">Held</span>';
    if (s === 'filed') return `<span class="st st-filed">Filed</span>${it.task.filed_on ? `<div class="muted tiny">${fmtDate(it.task.filed_on)}</div>` : ''}`;
    if (s === 'na') return '<span class="st st-not-applicable">N/A</span>';
    if (s === 'open') return `<span class="st st-${slug(it.task.status || 'Pending data')}">${esc(it.task.status || 'Pending data')}</span>${it.task.due_date !== it.due ? `<div class="tiny warn-t" title="The work item has ${fmtDate(it.task.due_date)}">work item: ${fmtDate(it.task.due_date)}</div>` : ''}`;
    return it.ag ? '<span class="muted small">Not held</span>' : '<span class="muted small">No work item</span>'; };
  const dueCell = it => { const late = !['done', 'filed', 'na'].includes(mcaStatus(it)) && it.due < t, d = daysFrom(t, it.due);
    return `<span class="${late ? 'late' : d <= 15 && d >= 0 ? 'soon' : ''}">${fmtDate(it.due)}</span>${it.est ? ' <span class="pill a tiny" title="Estimated">est.</span>' : ''}${late ? `<div class="tiny late">${-d} day${d === -1 ? '' : 's'} late</div>` : ''}`; };
  const draw = () => {
    $$('[data-mt]', v).forEach(b => b.classList.toggle('on', b.dataset.mt === mcaTab));
    if (mcaTab === 'companies') {
      const rows = list.filter(({ c, co }) => !q() || lc([c.name, c.cin, co.cin, co.entity_type, ...D.di.filter(d => d.client_id === c.id).map(d => d.name + ' ' + d.din)].join(' ')).includes(q()));
      body.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Company / LLP</th><th>Type</th><th>AGM ${esc(MCA.fyL(F))}</th><th>Annual forms</th><th>Directors</th><th></th></tr></thead><tbody>
        ${rows.map(({ c, co }) => { const its = items.filter(i => i.c.id === c.id), ag = its.find(i => i.ag), forms = its.filter(i => !i.ag && i.return_name !== 'DIR-3 KYC');
          const dirs = D.di.filter(d => d.client_id === c.id && !d.ceased_on), kycDue = its.filter(i => i.return_name === 'DIR-3 KYC' && !['filed', 'na'].includes(mcaStatus(i)));
          return `<tr class="${ag && !ag.done && ag.due < t ? 'overdue' : ''}"><td class="wrap"><b>${esc(c.name)}</b><div class="muted small">${esc(co.cin || c.cin || 'CIN not saved')}${co._new ? ' · <span class="warn-t">master not filled</span>' : ''}</div></td>
            <td><span class="badge">${esc(co.entity_type || '—')}</span>${co.small_company ? '<div class="muted tiny">Small company</div>' : ''}</td>
            <td>${ag ? (ag.done ? `<span class="st st-filed">Held ${fmtDate(ag.due)}</span>` : `Due ${dueCell(ag)}`) : `<span class="muted small">${MCA.isLLP(co) ? 'LLP — no AGM' : co.entity_type === 'OPC' ? 'OPC — no AGM' : '—'}</span>`}</td>
            <td class="wrap small">${forms.map(i => `<span class="mca-f ${mcaStatus(i)} ${mcaStatus(i) === 'none' || mcaStatus(i) === 'open' ? (i.due < t ? 'late' : '') : ''}" title="${esc(i.return_name + ' · ' + i.period + ' · due ' + fmtDate(i.due) + (i.est ? ' (est.)' : '') + ' — ' + i.basis)}">${esc(i.return_name)} ${fmtDate(i.due).slice(0, 6)}${mcaStatus(i) === 'filed' ? ' ✓' : ''}</span>`).join(' ') || '—'}</td>
            <td>${dirs.length}${kycDue.length ? `<div class="tiny warn-t">${kycDue.length} KYC</div>` : ''}</td>
            <td class="row-btns"><button class="btn sm primary" data-mplan="${c.id}">Plan &amp; work</button><button class="btn sm" data-mdir="${c.id}">Directors</button><button class="btn sm ghost" data-medit="${c.id}">Edit</button></td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="table-wrap"><div class="empty">${list.length ? 'No match.' : 'No companies yet. Clients with a CIN or the ROC/MCA service appear here — or click “+ Company / LLP”.'}</div></div>`;
    } else if (mcaTab === 'due') {
      const sel = items.filter(i => !i.ag || mcaWin === 'all').filter(i => { const s = mcaStatus(i);
        return mcaWin === 'all' ? true : mcaWin === 'open' ? !['done', 'filed', 'na'].includes(s) : mcaWin === 'late' ? !['done', 'filed', 'na'].includes(s) && i.due < t
          : mcaWin === '30' ? !['done', 'filed', 'na'].includes(s) && i.due >= t && i.due <= in30 : mcaWin === 'nowork' ? s === 'none' && !i.ag : i.return_name === 'DIR-3 KYC'; })
        .filter(i => !q() || lc([i.c.name, i.return_name, i.period, i.co.cin].join(' ')).includes(q())).sort((a, b) => a.due.localeCompare(b.due));
      body.innerHTML = sel.length ? `<div class="count">${sel.length} item${sel.length > 1 ? 's' : ''}</div><div class="table-wrap"><table><thead><tr><th>Company</th><th>Form</th><th>Period</th><th>Due</th><th>How the date is worked out</th><th>Work</th></tr></thead><tbody>
        ${sel.map(i => `<tr><td class="wrap"><b>${esc(i.c.name)}</b></td><td><b>${esc(i.return_name)}</b></td><td class="small wrap">${esc(i.period)}</td><td class="nowrap">${dueCell(i)}</td><td class="small wrap muted">${esc(i.basis)}</td><td>${pill(i)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="table-wrap"><div class="empty">Nothing in this view.</div></div>';
    } else {
      const own = mcaKycOwners(D.co, D.di), byDin = {};
      D.di.forEach(d => { if (MCA.dinOk(d.din)) (byDin[d.din] = byDin[d.din] || []).push(d); });
      const rows = D.di.filter(d => !q() || lc([d.name, d.din, d.designation, clientName(d.client_id), d.pan].join(' ')).includes(q()));
      body.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>DIN</th><th>Company</th><th>Designation</th><th>Appointed</th><th>DIR-3 KYC</th><th>DSC</th><th></th></tr></thead><tbody>
        ${rows.map(d => { const k = MCA.kycNext(d, t), dsc = dscFor(D, d), other = (byDin[d.din] || []).filter(x => x.client_id !== d.client_id);
          const kd = daysFrom(t, k.due);
          return `<tr class="${d.ceased_on ? 'muted-row' : ''}"><td class="wrap"><b>${esc(d.name)}</b>${d.pan ? `<div class="muted tiny">${esc(d.pan)}</div>` : ''}</td><td class="nowrap">${esc(d.din || '—')}${d.din && !MCA.dinOk(d.din) ? ' <span class="warn-t tiny">check</span>' : ''}</td>
            <td class="wrap">${esc(clientName(d.client_id))}${other.length ? `<div class="muted tiny">also: ${other.map(x => esc(clientName(x.client_id))).join(', ')}</div>` : ''}</td>
            <td class="small">${esc(d.designation || '')}${d.ceased_on ? `<div class="tiny">Ceased ${fmtDate(d.ceased_on)}</div>` : ''}</td><td class="small">${fmtDate(d.appointed_on)}</td>
            <td class="small">${!MCA.dinOk(d.din) || d.ceased_on ? '—' : `${d.kyc_on ? 'Filed ' + fmtDate(d.kyc_on) : '<span class="warn-t">Last KYC not saved</span>'}<div class="${kd < 0 ? 'late' : kd <= 90 ? 'soon' : 'muted'}">Next by ${fmtDate(k.due)}</div>${own[d.din] && own[d.din] !== d.client_id ? '<div class="muted tiny">KYC work under the other company</div>' : ''}`}</td>
            <td class="small">${dsc ? `${fmtDate(dsc.expires_on)}${dsc.expires_on && dsc.expires_on < t ? ' <span class="late">expired</span>' : ''}` : `<button class="link small" data-mdsc="${d.id}">+ DSC expiry</button>`}</td>
            <td><button class="btn sm ghost" data-mdir="${d.client_id}">Edit</button></td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="table-wrap"><div class="empty">${D.di.length ? 'No match.' : 'No directors yet. Open a company → Directors, or paste the director list from MCA master data.'}</div></div>`;
    }
  };
  draw();
  $('#mcFy').onchange = e => { mcaFy = +e.target.value; route(); };
  $$('[data-mt]', v).forEach(b => b.onclick = () => { mcaTab = b.dataset.mt; VIEWS.mca(v); });
  $$('[data-mw]', v).forEach(b => b.onclick = () => { mcaTab = 'due'; mcaWin = { agm: 'all', late: 'late', 30: '30', kyc: 'kyc' }[b.dataset.mw]; VIEWS.mca(v); });
  $('#mcQ').oninput = e => { mcaQ = e.target.value; draw(); };
  if ($('#mcW')) $('#mcW').onchange = e => { mcaWin = e.target.value; draw(); };
  $('#mcAdd').onclick = () => {
    const cands = myClients().filter(c => !list.some(x => x.c.id === c.id));
    if (!cands.length) return toast('All your clients are already listed — open Edit on a company');
    const m = modal('Add company / LLP', `<label>Client<select name="cid"><option value="">Select client…</option>${opts(cands, '', c => c.name, c => c.id)}</select></label>`, { saveText: 'Next',
      onSave: el => { const c = clientById(fv(el, 'cid')); if (!c) { toast('Pick a client', true); return false; } setTimeout(() => editCompany({ c, co: { client_id: c.id, entity_type: '', cin: c.cin || '', agms: [], auditor: {}, applies: {}, _new: true } }, D), 0); } });
  };
  $('#mcTpl').onclick = () => mcaTemplate().catch(e => toast(friendly(e), true));
  $('#mcImp').onclick = () => $('#mcFile').click();
  $('#mcFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) mcaImport(f, D).catch(err => toast(friendly(err), true)); };
  $('#mcCsv').onclick = () => download(`roc-due-list-${MCA.fyL(F)}.csv`, toCSV([['Company', 'CIN', 'Type', 'Form', 'Period', 'Due', 'Estimated', 'Basis', 'Work status', 'Filed on', 'SRN / ARN'],
    ...items.map(i => [i.c.name, i.co.cin || i.c.cin || '', i.co.entity_type || '', i.return_name, i.period, i.due, i.est ? 'Yes' : '', i.basis, i.done ? 'Held' : i.task ? i.task.status : 'No work item', i.task && i.task.filed_on || '', i.task && i.task.arn || ''])]));
  if ($('#mcWork')) $('#mcWork').onclick = () => mcaWorkDialog(open.filter(i => !i.task), `Create ROC work — accounts ${MCA.FY(F)}`);
  body.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const get = id => list.find(x => x.c.id === id) || { c: clientById(id), co: { client_id: id, agms: [], auditor: {}, applies: {}, _new: true } };
    if (b.dataset.medit) editCompany(get(b.dataset.medit), D);
    if (b.dataset.mdir) editDirectors(get(b.dataset.mdir), D);
    if (b.dataset.mplan) mcaPlanDialog(get(b.dataset.mplan), D, F);
    if (b.dataset.mdsc) { const d = D.di.find(x => x.id === b.dataset.mdsc); editRenewal(null, { client_id: d.client_id, kind: 'DSC', holder: `${d.name}${d.designation ? ' (' + d.designation + ')' : ''}`, repeat_months: 24 }); }
  });
};

function editCompany({ c, co }, D) {
  const ap = { dpt3: true, msme1: false, cfs: false, xbrl: false, ...(co.applies || {}) }, au = co.auditor || {}, F = mcaFy, a = MCA.agmOf(co, F);
  const body = `<div class="form-grid">
    <label>CIN / LLPIN<input name="cin" value="${esc(co.cin || c.cin || '')}" style="text-transform:uppercase" placeholder="U74999TN2015PTC123456"></label>
    <label>Type<select name="entity_type"><option value="">Select…</option>${opts(MCA_TYPES, co.entity_type || '')}</select></label>
    <label>Incorporated on<input type="date" name="incorporated_on" value="${esc(co.incorporated_on || '')}"></label>
    <label>RoC<input name="roc" value="${esc(co.roc || '')}" placeholder="RoC Chennai"></label>
    <label>Authorised capital (₹)<input type="number" name="auth_capital" value="${esc(co.auth_capital ?? '')}"></label>
    <label><span data-paid>${co.entity_type === 'LLP' ? 'Total contribution (₹)' : 'Paid-up capital (₹)'}</span><input type="number" name="paid_capital" value="${esc(co.paid_capital ?? '')}"></label>
    <label>Company email (MCA)<input name="company_email" value="${esc(co.company_email || '')}"></label>
    <label>First FY ends (only if unusual)<input type="date" name="first_fy_end" value="${esc(co.first_fy_end || '')}" title="Incorporated on/after 1 January? The first FY may end on 31 March of the next year."></label>
    <label class="full">Registered office<input name="reg_office" value="${esc(co.reg_office || '')}"></label>
    <div class="full toolbar" style="margin:0"><label class="check"><input type="checkbox" name="small_company" ${co.small_company ? 'checked' : ''}> Small company (MGT-7A)</label>
      <label class="check"><input type="checkbox" name="dpt3" ${ap.dpt3 ? 'checked' : ''}> DPT-3 (loans / deposits)</label>
      <label class="check"><input type="checkbox" name="msme1" ${ap.msme1 ? 'checked' : ''}> MSME-1 (MSE dues &gt; 45 days)</label>
      <label class="check"><input type="checkbox" name="cfs" ${ap.cfs ? 'checked' : ''}> Has subsidiary (AOC-4 CFS)</label>
      <label class="check"><input type="checkbox" name="xbrl" ${ap.xbrl ? 'checked' : ''}> XBRL filing</label></div>
    <h4 class="full" style="margin:8px 0 0">AGM for accounts ${MCA.FY(F)}</h4>
    <label>AGM held on<input type="date" name="agm_on" value="${esc(a.agm_on || '')}"></label>
    <label>Extended by RoC to<input type="date" name="extended_to" value="${esc(a.extended_to || '')}"></label>
    <label>Balance sheet date<input type="date" name="bs_date" value="${esc(a.bs_date || `${F + 1}-03-31`)}"></label>
    <h4 class="full" style="margin:8px 0 0">Statutory auditor</h4>
    <label>Auditor / firm<input name="au_name" value="${esc(au.name || '')}"></label>
    <label>FRN / M. No.<input name="au_frn" value="${esc(au.frn || '')}"></label>
    <label>Appointed at AGM on<input type="date" name="au_on" value="${esc(au.appointed_on || '')}"></label>
    <label>Term ends at AGM for FY<input name="au_to" value="${esc(au.to_fy || '')}" placeholder="e.g. 2029-30"></label>
    <label class="full">Remarks<textarea name="remarks" rows="2">${esc(co.remarks || '')}</textarea></label>
    ${(co.agms || []).filter(x => x.agm_on && x.fy !== MCA.fyL(F)).length ? `<div class="full small"><b>Earlier AGMs</b> ${(co.agms || []).filter(x => x.agm_on && x.fy !== MCA.fyL(F)).sort((x, y) => y.fy.localeCompare(x.fy)).map(x => `<span class="muted">FY ${esc(x.fy)}: ${fmtDate(x.agm_on)}</span>`).join(' · ')}</div>` : ''}
  </div>`;
  const m = modal(`${c.name} — company master`, body, { wide: true,
    extra: !co._new && isManager() ? '<button class="btn danger" data-mcdel>Remove master</button>' : '',
    onSave: async el => {
      const ck = n => $(`[name=${n}]`, el).checked, cin = fv(el, 'cin').toUpperCase().replace(/\s/g, '') || null;
      if (cin && !MCA.cinInfo(cin) && !confirm(`"${cin}" does not look like a CIN (21 characters) or LLPIN (AAA-1234). Save anyway?`)) return false;
      const agms = (co.agms || []).filter(x => x.fy !== MCA.fyL(F));
      const agmRec = { ...a, fy: MCA.fyL(F), agm_on: fv(el, 'agm_on') || null, extended_to: fv(el, 'extended_to') || null, bs_date: fv(el, 'bs_date') || null };
      if (agmRec.agm_on || agmRec.extended_to) agms.push(agmRec);
      if (agmRec.agm_on && agmRec.agm_on < `${F + 1}-04-01`) { toast('The AGM date is before the end of that financial year', true); return false; }
      const rec = { client_id: c.id, cin, entity_type: fv(el, 'entity_type') || null, incorporated_on: fv(el, 'incorporated_on') || null, roc: fv(el, 'roc') || null,
        auth_capital: fv(el, 'auth_capital') === '' ? null : num(fv(el, 'auth_capital')), paid_capital: fv(el, 'paid_capital') === '' ? null : num(fv(el, 'paid_capital')),
        company_email: fv(el, 'company_email') || null, first_fy_end: fv(el, 'first_fy_end') || null, reg_office: fv(el, 'reg_office') || null, small_company: ck('small_company'),
        applies: { dpt3: ck('dpt3'), msme1: ck('msme1'), cfs: ck('cfs'), xbrl: ck('xbrl') }, agms,
        auditor: { name: fv(el, 'au_name') || null, frn: fv(el, 'au_frn') || null, appointed_on: fv(el, 'au_on') || null, to_fy: fv(el, 'au_to') || null }, remarks: fv(el, 'remarks') || null };
      if (rec.small_company && ['Public company', 'Section 8', 'LLP'].includes(rec.entity_type)) { toast('Only a private company can be a small company', true); return false; }
      await must(sb.from('mca_companies').upsert(rec, { onConflict: 'client_id' }));
      if (cin && cin !== (c.cin || null)) { try { await must(sb.from('clients').update({ cin }).eq('id', c.id)); c.cin = cin; } catch (e) {} }
      toast('Saved');
      // AGM date entered → offer to move open work items to the AGM-based dates
      if (agmRec.agm_on && agmRec.agm_on !== a.agm_on) {
        const its = MCA.plan(rec, [], F).filter(i => ['AOC-4', 'AOC-4 XBRL', 'AOC-4 CFS', 'MGT-7', 'MGT-7A', 'ADT-1'].includes(i.return_name));
        const ex = (D.tk || []).filter(x => x.client_id === c.id && isOpen(x.status) && its.some(i => lc(i.return_name) === lc(x.return_name) && lc(i.period) === lc(x.period)));
        const ch = ex.map(x => [x, its.find(i => lc(i.return_name) === lc(x.return_name))]).filter(([x, i]) => x.due_date !== i.due);
        if (ch.length && confirm(`AGM on ${fmtDate(agmRec.agm_on)}. Move the due dates of ${ch.length} open work item(s)?\n\n${ch.map(([x, i]) => `${x.return_name}: ${fmtDate(x.due_date)} → ${fmtDate(i.due)}`).join('\n')}`))
          await Promise.all(ch.map(([x, i]) => must(sb.from('tasks').update({ due_date: i.due }).eq('id', x.id))));
      }
      route();
    } });
  const el = m.el;
  $('[name=cin]', el).addEventListener('change', () => {
    const i = MCA.cinInfo(fv(el, 'cin')); if (!i) return;
    if (i.type && !fv(el, 'entity_type')) $('[name=entity_type]', el).value = i.type;
    if (i.roc && !fv(el, 'roc')) $('[name=roc]', el).value = i.roc;
    if (i.year && !fv(el, 'incorporated_on')) toast(`CIN shows incorporation in ${i.year}${i.listed ? ' · listed' : ''} — enter the exact date`);
  });
  $('[name=entity_type]', el).addEventListener('change', () => { $('[data-paid]', el).textContent = fv(el, 'entity_type') === 'LLP' ? 'Total contribution (₹)' : 'Paid-up capital (₹)'; });
  const del = $('[data-mcdel]', el);
  if (del) del.onclick = async () => { if (!confirm('Remove the company master (CIN details, AGM history, auditor)? Directors and work items are kept.')) return; try { await must(sb.from('mca_companies').delete().eq('client_id', c.id)); m.close(); toast('Removed'); route(); } catch (e) { toast(friendly(e), true); } };
}

function editDirectors({ c, co }, D) {
  let rows = D.di.filter(d => d.client_id === c.id).map(d => ({ ...d }));
  const LLP = MCA.isLLP(co);
  const m = modal(`${c.name} — ${LLP ? 'designated partners' : 'directors & KMP'}`, `<div data-dl></div>
    <div class="toolbar" style="margin-top:10px"><button class="btn sm" data-dadd>+ Add ${LLP ? 'partner' : 'director'}</button><button class="btn sm" data-dpaste>Paste from MCA master data</button><span class="spacer"></span>
      <a class="btn sm ghost" href="https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html" target="_blank" rel="noopener">Open MCA master data ↗</a></div>
    <p class="muted small">DIR-3 KYC: enter the date the last KYC was filed — the next one is due by 30 June after the third financial year. A change of mobile, email or address needs a KYC update within 30 days.</p>`, { wide: true, saveText: 'Save', onSave: async () => save() });
  const el = m.el, box = $('[data-dl]', el);
  const orig = new Map(rows.filter(r => r.id).map(r => [r.id, { ...r }]));
  const draw = () => {
    box.innerHTML = rows.length ? `<div class="table-wrap"><table class="dir-grid"><thead><tr><th>Name</th><th>DIN / DPIN</th><th>Designation</th><th>Appointed</th><th>Ceased</th><th>Last KYC filed</th><th>Mobile</th><th>Email</th><th>PAN</th><th></th></tr></thead><tbody>
      ${rows.map((d, i) => `<tr data-i="${i}" class="${d._del ? 'muted-row' : ''}"><td><input data-f="name" value="${esc(d.name || '')}" ${d._del ? 'disabled' : ''}></td>
        <td><input data-f="din" value="${esc(d.din || '')}" inputmode="numeric" maxlength="8" style="width:7.5em" class="${d.din && !MCA.dinOk(d.din) ? 'bad' : ''}"></td>
        <td><select data-f="designation">${opts([...new Set([...MCA_DESIG, d.designation || 'Director'])], d.designation || (LLP ? 'Designated Partner' : 'Director'))}</select></td>
        <td><input type="date" data-f="appointed_on" value="${esc(d.appointed_on || '')}"></td><td><input type="date" data-f="ceased_on" value="${esc(d.ceased_on || '')}"></td>
        <td><input type="date" data-f="kyc_on" value="${esc(d.kyc_on || '')}"></td><td><input data-f="phone" value="${esc(d.phone || '')}" style="width:8em"></td><td><input data-f="email" value="${esc(d.email || '')}"></td>
        <td><input data-f="pan" value="${esc(d.pan || '')}" maxlength="10" style="width:7.5em;text-transform:uppercase"></td>
        <td>${d._del ? `<button class="link small" data-undel="${i}">Undo</button>` : `<button class="icon-btn" data-ddel="${i}" aria-label="Remove">×</button>`}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">No directors yet.</div>';
  };
  draw();
  box.addEventListener('input', e => { const f = e.target.dataset.f, tr = e.target.closest('[data-i]'); if (!f || !tr) return; rows[+tr.dataset.i][f] = e.target.value.trim(); if (f === 'din') e.target.classList.toggle('bad', !!e.target.value && !MCA.dinOk(e.target.value.trim())); });
  box.addEventListener('change', e => { const f = e.target.dataset.f, tr = e.target.closest('[data-i]'); if (f && tr) rows[+tr.dataset.i][f] = e.target.value.trim(); });
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ddel != null) { const r = rows[+b.dataset.ddel]; if (r.id) r._del = true; else rows.splice(+b.dataset.ddel, 1); draw(); }
    if (b.dataset.undel != null) { rows[+b.dataset.undel]._del = false; draw(); } });
  $('[data-dadd]', el).onclick = () => { rows.push({ client_id: c.id, name: '', designation: LLP ? 'Designated Partner' : 'Director' }); draw(); const ins = $$('[data-f=name]', box); ins[ins.length - 1].focus(); };
  $('[data-dpaste]', el).onclick = () => {
    const pm = modal('Paste director list', `<p class="small" style="margin-top:0">On MCA V3 → <b>View company / LLP master data</b>, select the <b>Director / Signatory details</b> table, copy (Ctrl+C) and paste it below. Rows with an 8-digit DIN are picked up.</p>
      <textarea rows="10" class="code" data-pt placeholder="DIN    Name    Designation    Date of appointment …"></textarea><div data-pp class="small"></div>`, { wide: true, saveText: 'Add these',
      onSave: () => { const got = MCA.parseDirectorPaste($('[data-pt]', pm.el).value); if (!got.length) { toast('No rows with a DIN found', true); return false; }
        let added = 0, upd = 0;
        got.forEach(g => { const ex = rows.find(r => r.din === g.din); if (ex) { ['designation', 'appointed_on', 'ceased_on', 'pan'].forEach(k => { if (g[k] && !ex[k]) { ex[k] = g[k]; upd++; } }); } else { rows.push({ client_id: c.id, ...g }); added++; } });
        draw(); toast(`${added} added${upd ? `, ${upd} detail(s) filled` : ''} — check and Save`); } });
    $('[data-pt]', pm.el).addEventListener('input', e => { const g = MCA.parseDirectorPaste(e.target.value); $('[data-pp]', pm.el).innerHTML = g.length ? `<b>${g.length}</b> found: ${g.map(x => `${esc(x.name)} (${x.din}, ${esc(x.designation)}${x.appointed_on ? ', from ' + fmtDate(x.appointed_on) : ''})`).join('; ')}` : ''; });
  };
  async function save() {
    const live = rows.filter(r => !r._del && (r.name || r.din));
    const bad = live.find(r => !r.name) || live.find(r => r.din && !MCA.dinOk(r.din));
    if (bad) { toast(bad.name ? `DIN of ${bad.name} must be 8 digits` : 'Every row needs a name', true); return false; }
    const dup = live.map(r => r.din).filter(Boolean).find((d, i, a) => a.indexOf(d) !== i);
    if (dup) { toast(`DIN ${dup} is entered twice`, true); return false; }
    const clean = r => ({ client_id: c.id, name: r.name, din: r.din || null, designation: r.designation || null, appointed_on: r.appointed_on || null, ceased_on: r.ceased_on || null,
      kyc_on: r.kyc_on || null, phone: r.phone || null, email: r.email || null, pan: (r.pan || '').toUpperCase() || null });
    const dels = rows.filter(r => r._del && r.id).map(r => r.id);
    if (dels.length) await must(sb.from('mca_directors').delete().in('id', dels));
    const ins = live.filter(r => !r.id).map(clean), upd = live.filter(r => r.id);
    if (ins.length) await must(sb.from('mca_directors').insert(ins));
    await Promise.all(upd.map(r => must(sb.from('mca_directors').update(clean(r)).eq('id', r.id))));
    // event forms: DIR-12 for appointment / cessation in the last 30 days, KYC update for changed contact details
    const t = today(), back30 = iso(addDays(new Date(), -30)), ev = [];
    live.forEach(r => { const o = r.id ? orig.get(r.id) : {};
      if (!LLP && r.appointed_on && r.appointed_on >= back30 && r.appointed_on !== o.appointed_on) ev.push({ return_name: 'DIR-12', period: `Appointment · ${r.name} · ${fmtDate(r.appointed_on)}`, due: MCA.plus(r.appointed_on, 30), why: `${r.name} appointed ${fmtDate(r.appointed_on)}` });
      if (!LLP && r.ceased_on && r.ceased_on >= back30 && r.ceased_on !== o.ceased_on) ev.push({ return_name: 'DIR-12', period: `Cessation · ${r.name} · ${fmtDate(r.ceased_on)}`, due: MCA.plus(r.ceased_on, 30), why: `${r.name} ceased ${fmtDate(r.ceased_on)}` });
      if (LLP && (r.appointed_on && r.appointed_on >= back30 && r.appointed_on !== o.appointed_on || r.ceased_on && r.ceased_on >= back30 && r.ceased_on !== o.ceased_on))
        ev.push({ return_name: 'LLP Form 4', period: `${r.ceased_on ? 'Cessation' : 'Appointment'} · ${r.name} · ${fmtDate(r.ceased_on || r.appointed_on)}`, due: MCA.plus(r.ceased_on || r.appointed_on, 30), why: `${r.name} ${r.ceased_on ? 'ceased' : 'appointed'}` });
      if (r.id && MCA.dinOk(r.din) && !r.ceased_on && ((o.phone || '') !== (r.phone || '') && o.phone || (o.email || '') !== (r.email || '') && o.email))
        ev.push({ return_name: 'DIR-3 KYC', period: `Update · ${r.name} · DIN ${r.din} · ${fmtDate(t)}`, due: MCA.plus(t, 30), why: `${r.name}: mobile / email changed — DIR-3 KYC-Web within 30 days` });
    });
    toast('Saved');
    if (ev.length && isManager() && confirm(`Create ${ev.length} event work item(s)?\n\n${ev.map(x => `${x.return_name} by ${fmtDate(x.due)} — ${x.why}`).join('\n')}`))
      try { await must(sb.from('tasks').upsert(ev.map(x => ({ client_id: c.id, work_type: 'ROC/MCA', return_name: x.return_name, period: x.period, due_date: x.due, assigned_to: c.default_staff || null, remarks: x.why })), { onConflict: 'client_id,return_name,period', ignoreDuplicates: true })); toast('Event work items created'); }
      catch (e) { toast(friendly(e), true); }
    route();
  }
}

function mcaPlanDialog({ c, co }, D, F) {
  const own = mcaKycOwners(D.co, D.di), tmap = new Map(D.tk.map(x => [mcaTaskKey(x.client_id, x.return_name, x.period), x]));
  const its = MCA.plan(co, D.di.filter(d => d.client_id === c.id), F, { kycOwner: d => own[d.din] === c.id }).map(i => ({ ...i, c, co, task: tmap.get(mcaTaskKey(c.id, i.return_name, i.period)) || null }));
  if (co._new) toast('Fill the company master first for exact dates (type, incorporation, AGM)');
  mcaWorkDialog(its.filter(i => !i.ag), `${c.name} — ROC work for accounts ${MCA.FY(F)}`, its.find(i => i.ag));
}
function mcaWorkDialog(items, title, agm) {
  const t = today();
  if (!items.length) return toast('Nothing to create — every item already has a work item');
  const can = isManager();
  const rows = items.map((i, k) => { const s = mcaStatus(i), moved = i.task && isOpen(i.task.status) && i.task.due_date !== i.due;
    return `<tr><td>${s === 'none' || moved ? `<input type="checkbox" data-k="${k}" ${can ? 'checked' : 'disabled'}>` : ''}</td><td class="wrap"><b>${esc(i.c.name)}</b></td><td><b>${esc(i.return_name)}</b><div class="muted tiny">${esc(i.period)}</div></td>
      <td class="nowrap ${i.due < t && s !== 'filed' ? 'late' : ''}">${fmtDate(i.due)}${i.est ? ' <span class="pill a tiny">est.</span>' : ''}</td><td class="small muted wrap">${esc(i.basis)}</td>
      <td class="small">${s === 'none' ? 'New' : s === 'filed' ? '✓ Filed' : s === 'na' ? 'N/A' : moved ? `Move date from ${fmtDate(i.task.due_date)}` : esc(i.task.status)}</td></tr>`; }).join('');
  const m = modal(title, `${agm ? `<p class="small" style="margin-top:0">AGM: ${agm.done ? `held on <b>${fmtDate(agm.due)}</b>` : `last date <b>${fmtDate(agm.due)}</b>${agm.due < t ? ' — <span class="late">overdue</span>' : ''} · ${esc(agm.basis)}`}</p>` : ''}
    <div class="table-wrap" style="max-height:52vh"><table><thead><tr><th></th><th>Company</th><th>Form</th><th>Due</th><th>Basis</th><th>Work item</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="form-grid" style="margin-top:10px"><label>Assign to<select name="who"><option value="">Each client's default staff</option>${opts(activeStaff(), '', p => p.full_name || p.email, p => p.id)}</select></label></div>
    ${can ? '' : '<p class="note small">Only a manager or above can create work items.</p>'}`, { wide: true, saveText: 'Create / update work items',
    onSave: can ? async el => {
      const pick = $$('[data-k]:checked', el).map(x => items[+x.dataset.k]); if (!pick.length) { toast('Nothing ticked', true); return false; }
      const who = fv(el, 'who') || null;
      const neu = pick.filter(i => !i.task), mv = pick.filter(i => i.task);
      if (neu.length) await must(sb.from('tasks').upsert(neu.map(i => ({ client_id: i.c.id, work_type: 'ROC/MCA', return_name: i.return_name, period: i.period, due_date: i.due,
        assigned_to: who || i.c.default_staff || null, remarks: (i.est ? 'Estimated date — ' : '') + i.basis })), { onConflict: 'client_id,return_name,period', ignoreDuplicates: true }));
      await Promise.all(mv.map(i => must(sb.from('tasks').update({ due_date: i.due }).eq('id', i.task.id))));
      toast(`${neu.length} work item${neu.length === 1 ? '' : 's'} created${mv.length ? `, ${mv.length} date${mv.length > 1 ? 's' : ''} moved` : ''}`); route();
    } : null });
}

const MC_HEAD = ['Client (name, GSTIN, PAN or CIN)', 'CIN / LLPIN', 'Type', 'Incorporated on', 'Small company (Y/N)', 'Paid-up capital / contribution', 'Last AGM date', 'AGM for FY', 'Auditor', 'Auditor FRN', 'Auditor term to FY', 'DPT-3 (Y/N)', 'MSME-1 (Y/N)'];
const MD_HEAD = ['Client (name, GSTIN, PAN or CIN)', 'Name', 'DIN / DPIN', 'Designation', 'Appointed on', 'Ceased on', 'Last DIR-3 KYC filed on', 'Mobile', 'Email', 'PAN'];
async function mcaTemplate() {
  const X = await loadXlsxFull(), wb = X.utils.book_new(), F = mcaFy;
  const a = X.utils.aoa_to_sheet([MC_HEAD, ['ABC Traders Private Limited', 'U74999TN2015PTC123456', 'Private company', '12/06/2015', 'Y', 500000, '', MCA.fyL(F), 'K S & Co', '012345S', '2029-30', 'Y', 'N'],
    ['XYZ Consultants LLP', 'AAB-1234', 'LLP', '01/04/2019', '', 200000, '', '', '', '', '', '', '']]);
  a['!cols'] = MC_HEAD.map(() => ({ wch: 18 })); a['!cols'][0] = { wch: 32 }; X.utils.book_append_sheet(wb, a, 'Companies');
  const b = X.utils.aoa_to_sheet([MD_HEAD, ['ABC Traders Private Limited', 'R. Kumar', '01234567', 'Managing Director', '12/06/2015', '', '28/09/2025', '9840012345', 'kumar@abc.in', 'ABCPK1234A'],
    ['ABC Traders Private Limited', 'S. Lakshmi', '07654321', 'Director', '12/06/2015', '', '', '', '', '']]);
  b['!cols'] = MD_HEAD.map(() => ({ wch: 16 })); b['!cols'][0] = { wch: 32 }; X.utils.book_append_sheet(wb, b, 'Directors');
  const h = X.utils.aoa_to_sheet([['How to fill'], ['Delete the sample rows first. Client = exact client name, or its GSTIN, PAN or CIN.'], ['Type: Private company, Public company, OPC, Section 8, Producer company, Nidhi or LLP (worked out from the CIN when blank).'],
    ['Dates: dd/mm/yyyy. "AGM for FY" e.g. 2025-26 (the accounts year the AGM adopted). Auditor term to FY: the FY whose AGM ends the term.'], ['Directors: one row per person per company. DIN = 8 digits. KMP without a DIN (CS / CFO) — leave DIN blank.']]);
  h['!cols'] = [{ wch: 100 }]; X.utils.book_append_sheet(wb, h, 'Help');
  X.writeFile(wb, 'companies-directors-template.xlsx');
}
function mcaFindClient(s) { const u = String(s ?? '').trim().toUpperCase(); return findClient(s) || (u ? clients.find(c => c.cin && c.cin.toUpperCase() === u) : null) || null; }
function parseMcaSheets(sheets, D, F = mcaFy) {
  const yes = x => /^(y|yes|true|1)$/i.test(String(x).trim());
  const find = re => sheets.find(s => s.rows.some(r => r.some(x => re.test(String(x)))));
  const cos = [], dirs = [], bad = [];
  const cs = find(/cin \/ llpin|^type$/i), ds = find(/^din|din \/ dpin/i);
  const hdr = (rows, re) => rows.findIndex(r => r.some(x => re.test(String(x))));
  if (cs) { const hi = hdr(cs.rows, /cin \/ llpin|^cin/i), H = cs.rows[hi].map(x => lc(String(x))), col = re => H.findIndex(h => re.test(h));
    const C = { c: col(/^client/), cin: col(/cin/), ty: col(/^type/), inc: col(/incorporat/), sm: col(/small/), cap: col(/capital|contribution/), agm: col(/last agm/), afy: col(/agm for/), au: col(/^auditor$/), frn: col(/frn/), ato: col(/term/), dp: col(/dpt/), ms: col(/msme/) };
    cs.rows.slice(hi + 1).forEach((r, i) => { if (!r.some(x => String(x).trim())) return; const g = k => C[k] >= 0 ? r[C[k]] : '';
      const c = mcaFindClient(g('c')) || mcaFindClient(g('cin')); if (!c) return bad.push(`Companies row ${hi + i + 2}: client "${g('c')}" not found`);
      const cin = String(g('cin') || '').toUpperCase().replace(/\s/g, '') || c.cin || null, ty = MCA_TYPES.find(x => lc(x) === lc(String(g('ty')))) || (MCA.cinInfo(cin) || {}).type || null;
      const inc = anyDate(g('inc')), agm = anyDate(g('agm')); if (inc === undefined || agm === undefined) return bad.push(`Companies row ${hi + i + 2}: date not understood`);
      const ex = D.co.find(x => x.client_id === c.id) || {}, afy = String(g('afy') || '').trim() || (agm ? MCA.fyL(MCA.fyStartOf(agm) - 1) : '');
      const agms = (ex.agms || []).filter(x => x.fy !== afy); if (agm) agms.push({ fy: afy, agm_on: agm });
      cos.push({ client_id: c.id, cin, entity_type: ty, incorporated_on: inc || ex.incorporated_on || null, small_company: yes(g('sm')), paid_capital: g('cap') === '' ? (ex.paid_capital ?? null) : num(g('cap')),
        roc: ex.roc || (MCA.cinInfo(cin) || {}).roc || null, agms, applies: { ...(ex.applies || { dpt3: true }), ...(g('dp') !== '' ? { dpt3: yes(g('dp')) } : {}), ...(g('ms') !== '' ? { msme1: yes(g('ms')) } : {}) },
        auditor: g('au') ? { name: String(g('au')).trim(), frn: String(g('frn') || '').trim() || null, to_fy: String(g('ato') || '').trim() || null } : (ex.auditor || {}) }); }); }
  if (ds) { const hi = hdr(ds.rows, /din/i), H = ds.rows[hi].map(x => lc(String(x))), col = re => H.findIndex(h => re.test(h));
    const C = { c: col(/^client/), n: col(/^name/), din: col(/din/), de: col(/designation/), ap: col(/appoint/), ce: col(/ceas/), k: col(/kyc/), ph: col(/mobile|phone/), em: col(/email/), pan: col(/^pan/) };
    const seen = new Set(D.di.map(d => d.client_id + '|' + d.din));
    ds.rows.slice(hi + 1).forEach((r, i) => { if (!r.some(x => String(x).trim())) return; const g = k => C[k] >= 0 ? r[C[k]] : '', n = hi + i + 2;
      const c = mcaFindClient(g('c')); if (!c) return bad.push(`Directors row ${n}: client "${g('c')}" not found`);
      const din = String(g('din') || '').replace(/\D/g, '').padStart(String(g('din') || '').replace(/\D/g, '').length ? 8 : 0, '0') || null;
      if (!String(g('n')).trim()) return bad.push(`Directors row ${n}: name missing`);
      if (din && !MCA.dinOk(din)) return bad.push(`Directors row ${n}: DIN "${g('din')}" is not 8 digits`);
      const ap = anyDate(g('ap')), ce = anyDate(g('ce')), k = anyDate(g('k')); if ([ap, ce, k].includes(undefined)) return bad.push(`Directors row ${n}: date not understood`);
      if (din && seen.has(c.id + '|' + din)) return bad.push(`Directors row ${n}: DIN ${din} already saved for ${c.name} — skipped`);
      if (din) seen.add(c.id + '|' + din);
      dirs.push({ client_id: c.id, name: String(g('n')).trim(), din, designation: String(g('de') || '').trim() || 'Director', appointed_on: ap, ceased_on: ce, kyc_on: k, phone: String(g('ph') || '').trim() || null, email: String(g('em') || '').trim() || null, pan: String(g('pan') || '').trim().toUpperCase() || null }); }); }
  if (!cs && !ds) throw new Error('No "Companies" or "Directors" sheet found. Use the Excel template.');
  return { cos, dirs, bad };
}
async function mcaImport(file, D) {
  const { cos, dirs, bad } = parseMcaSheets(await readSheets(file), D);
  modal('Import companies & directors', `<p><b>${cos.length}</b> compan${cos.length === 1 ? 'y' : 'ies'} and <b>${dirs.length}</b> director${dirs.length === 1 ? '' : 's'} ready from <b>${esc(file.name)}</b>${bad.length ? `, <b>${bad.length}</b> row(s) left out` : ''}.</p>
    ${cos.length ? `<p class="small muted">${cos.slice(0, 40).map(x => esc(clientName(x.client_id))).join(', ')}${cos.length > 40 ? ' …' : ''}</p>` : ''}
    ${bad.length ? `<p class="note warn small">${bad.slice(0, 30).map(esc).join('<br>')}${bad.length > 30 ? `<br>… and ${bad.length - 30} more` : ''}</p>` : ''}`, {
    saveText: 'Import', onSave: cos.length || dirs.length ? async () => {
      if (cos.length) await must(sb.from('mca_companies').upsert(cos, { onConflict: 'client_id' }));
      if (dirs.length) await must(sb.from('mca_directors').insert(dirs));
      const cinUp = cos.filter(x => x.cin && (clientById(x.client_id) || {}).cin !== x.cin);
      await Promise.all(cinUp.map(x => safe(sb.from('clients').update({ cin: x.cin }).eq('id', x.client_id))));
      toast(`Imported ${cos.length} compan${cos.length === 1 ? 'y' : 'ies'}, ${dirs.length} director${dirs.length === 1 ? '' : 's'}`); route(); } : null });
}

/* =====================================================================
   v20 · SESSION 3: BILL READER — PDF / photo purchase bills → purchase register
   Free first: e-invoice QR code → PDF text → text recognition (Tesseract) · Claude only when needed and a key is saved
   ===================================================================== */
const BILL = (() => {
  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function gstinCheck(g) {                                   // GSTIN check digit (15th character)
    g = String(g || '').toUpperCase();
    if (!/^[0-9]{2}[A-Z0-9]{12}[0-9A-Z]$/.test(g)) return false;
    let s = 0;
    for (let i = 0; i < 14; i++) { const v = CH.indexOf(g[i]); if (v < 0) return false; const p = v * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + (p % 36); }
    return CH[(36 - (s % 36)) % 36] === g[14];
  }
  // OCR often swaps O/0, I/1, S/5, B/8 — fix by position (2 digits · 5 letters · 4 digits · letter · 1 · Z · check)
  const D2L = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 2: 'Z', 6: 'G' }, L2D = { O: '0', D: '0', Q: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' };
  function fixGstin(tok) {
    let t = String(tok || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (t.length !== 15) return null;
    if (gstinCheck(t)) return t;
    const a = t.split('');
    [0, 1, 7, 8, 9, 10].forEach(i => { if (L2D[a[i]]) a[i] = L2D[a[i]]; });
    [2, 3, 4, 5, 6, 11].forEach(i => { if (D2L[a[i]]) a[i] = D2L[a[i]]; });
    if (a[13] === '2') a[13] = 'Z';
    const f = a.join('');
    return gstinCheck(f) ? f : null;
  }
  function findGstins(text) {
    const out = [], seen = new Set();
    const toks = String(text || '').toUpperCase().match(/[0-9OIDQLSBZG]{2}[A-Z0-9]{5}[0-9OIDQLSBZG]{4}[A-Z0-9][A-Z0-9][A-Z0-9]{2}|[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g) || [];
    // also spaced OCR forms like "33 AAAAA 1234 A 1Z5"
    const spaced = String(text || '').toUpperCase().match(/\b\d{2}\s?[A-Z]{5}\s?\d{4}\s?[A-Z]\s?[1-9A-Z]\s?Z\s?[0-9A-Z]\b/g) || [];
    [...toks, ...spaced.map(s => s.replace(/\s/g, ''))].forEach(t => { const g = fixGstin(t); if (g && !seen.has(g)) { seen.add(g); out.push(g); } });
    return out;
  }
  // numbers on a piece of text: Indian / western grouping; skips rates (9%, @18) and parts of codes
  const NUM = /(?<![\w.\/\-])(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)(?![\w%\/])/g;
  function nums(s) {
    const out = []; let m;
    const str = String(s || '').replace(/₹|rs\.?|inr/gi, ' ');
    NUM.lastIndex = 0;
    while ((m = NUM.exec(str))) {
      const before = str.slice(Math.max(0, m.index - 2), m.index), after = str.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (/@\s*$/.test(before) || /^\s*%/.test(after)) continue;
      const x = parseFloat(m[1].replace(/,/g, '')); if (isFinite(x)) out.push(x);
    }
    return out;
  }
  const HEADS = [
    ['ig', /\b(igst|integrated\s+tax)\b/i], ['cg', /\b(cgst|central\s+tax)\b/i], ['sg', /\b(sgst|utgst|state\s*\/?\s*ut\s+tax|state\s+tax)\b/i], ['cs', /\b(cess)\b/i],
    ['v', /(grand\s*total|total\s*invoice\s*(value|amount)|invoice\s*(total|value|amount)|total\s*amount\s*(after\s*tax|payable)?|net\s*(amount|payable|total)|amount\s*payable|total\s*value|bill\s*amount|total\s*\(?(inr|rs)\.?\)?)/i],
    ['t', /(taxable\s*(value|amount|amt|val)?|assessable\s*value|sub\s*-?\s*total|total\s*before\s*tax|amount\s*before\s*tax)/i]
  ];
  const RATES = [0.05, 0.12, 0.18, 0.28, 0.40, 0.03, 0.0025, 0.015, 0.01, 0.06, 0.075, 0.14];
  function candidates(lines) {
    const c = { t: [], v: [], ig: [], cg: [], sg: [], cs: [], all: [] };
    lines.forEach((ln, k) => {
      const hits = [];
      HEADS.forEach(([h, re]) => { const g = new RegExp(re.source, 'gi'); let m; while ((m = g.exec(ln))) hits.push({ h, s: m.index, e: m.index + m[0].length }); });
      hits.sort((a, b) => a.s - b.s);
      const clean = hits.filter((x, i) => !hits.some((y, j) => j !== i && y.s <= x.s && y.e >= x.e && (y.e - y.s) > (x.e - x.s)));   // "total invoice value" beats "invoice value"
      clean.forEach((x, i) => {
        const seg = ln.slice(x.e, i + 1 < clean.length ? clean[i + 1].s : ln.length);
        let n = nums(seg);
        if (!n.length && (x.h === 't' || x.h === 'v') && lines[k + 1] && !HEADS.some(([, re]) => re.test(lines[k + 1]))) n = nums(lines[k + 1]).slice(-1);
        if (n.length) c[x.h].push(...(x.h === 't' || x.h === 'v' ? [n[n.length - 1], ...(n.length > 1 ? [Math.max(...n)] : [])] : [n[n.length - 1]]));
      });
      // tax-summary "Total" row of a table: every number may be one of the totals
      if (/^\s*(sub\s*)?total\b/i.test(ln) && !clean.some(x => x.h === 'v')) { const n = nums(ln); if (n.length >= 2) ['t', 'v', 'ig', 'cg', 'sg'].forEach(h => c[h].push(...n)); }
      c.all.push(...nums(ln).filter(x => x >= 1));
    });
    return c;
  }
  function solve(c, { fixedV = null, intra = null, wide = false } = {}) {
    const top = (a, n) => [...new Set(a.map(r2))].filter(x => x > 0).sort((x, y) => y - x).slice(0, n);
    const all = wide ? top(c.all, 14) : [];
    const pool = (k, n) => top(wide ? [...c[k], ...all] : c[k], wide ? 14 : n);
    const T = pool('t', 6), V = fixedV ? [r2(fixedV)] : pool('v', 6), IG = [0, ...pool('ig', 6)], CG = [0, ...pool('cg', 6)], SG = [0, ...pool('sg', 6)], CS = [0, ...top(c.cs, 3)];
    let best = null;
    for (const t of (T.length ? T : [null])) for (const v of (V.length ? V : [null])) for (const ig of IG) for (const cg of CG) for (const sg of SG) for (const cs of CS) {
      if (ig && (cg || sg)) continue;
      if (wide && !ig && cg !== sg) continue;
      const tax = r2(ig + cg + sg + cs);
      let tt = t; if (tt == null && v != null) tt = r2(v - tax);
      if (tt == null || tt <= 0 || tax >= tt) continue;
      if (v != null && tax && v <= tt) continue;
      let sc = 0; const d = v != null ? Math.abs(tt + tax - v) : null;
      if (d != null) sc += d <= 1.01 ? 6 : d <= 5 ? 3 : -2 - Math.min(3, d / Math.max(1, v) * 50);
      if (!ig && (cg || sg)) sc += Math.abs(cg - sg) <= 0.51 ? 3 : -3;
      const g = ig || cg + sg, rate = g / tt;
      sc += !g ? -1 : RATES.some(r => Math.abs(rate - r) < 0.0015) ? 3 : rate > 0 && rate <= 0.4 ? 0.5 : -4;
      if (intra === true && ig) sc -= 3; if (intra === false && (cg || sg)) sc -= 3;
      if (t == null) sc -= 1;
      sc += Math.log10(1 + tt) * 0.01;
      if (!best || sc > best.sc) best = { sc, t: tt, v: v != null ? v : r2(tt + tax), ig, cg, sg, cs, d, rate };
    }
    if (!best) return null;
    best.ok = best.d != null && best.d <= 1.01 && (best.ig || best.cg === best.sg || Math.abs(best.cg - best.sg) <= 0.51) && RATES.some(r => Math.abs(best.rate - r) < 0.0015);
    return best;
  }
  const DATE_RE = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-]?[A-Za-z]{3,9}[\s\-,']*\d{2,4}|\d{4}-\d{2}-\d{2})/;
  const INV_RE = /(?:invoice|inv|bill|document|doc|voucher|vch|note)\s*(?:no|number|num|#)\.?\s*[:\-#]?\s*([A-Za-z0-9][A-Za-z0-9\/\-_.]{0,19})/i;
  const BAD_INV = /^(date|dated|of|and|no|ref|for|the|type|details)$/i;
  function normDate(s) {
    const d = GR.toDate(String(s).replace(/'/g, ' ').replace(/(\d)(st|nd|rd|th)\b/i, '$1').trim());
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && +d.slice(0, 4) > 2015 && +d.slice(0, 4) < 2100 ? d : '';
  }
  function supplierName(lines, gLine, buyerAt) {
    const SKIP = /tax\s*invoice|invoice|original|duplicate|triplicate|recipient|gstin|gst\s*no|phone|ph[:.]|mobile|mob[:.]|e-?mail|www\.|@|address|road|street|\bst\b|nagar|salai|\bno\b[.:]|pin\s*code|pincode|state\s*(name|code)|cin\b|pan\b|fssai|udyam|irn|ack|e-?way|bill\s*of\s*supply|cash\s*memo|credit\s*note|debit\s*note|^page|^\d|signature|declaration|place of supply|dated|^to$|^m\/s/i;
    const CO = /\b(pvt|private|ltd|limited|llp|enterprises?|traders?|trading|agenc(y|ies)|industries|services|stores|solutions|corporation|company|& ?co|and co|associates|distributors|suppliers|exports|imports|mart|electricals?|hardwares?|motors|textiles|pharma|foods|chemicals|engineering|technologies|systems|infotech|logistics|transports?)\b/i;
    const lim = buyerAt >= 0 ? buyerAt : lines.length;
    const ok = l => l && l.length >= 3 && l.length <= 70 && /[A-Za-z]{3}/.test(l) && !SKIP.test(l);
    const co = lines.slice(0, Math.min(lim, 25)).find(l => ok(l) && CO.test(l));
    if (co) return co.replace(/\s{2,}.*/, '').replace(/^for\s+/i, '').trim();
    if (gLine > 0) for (let k = gLine - 1; k >= Math.max(0, gLine - 6); k--) if (ok(lines[k])) return lines[k].replace(/\s{2,}.*/, '').trim();
    const first = lines.slice(0, Math.min(lim, 8)).find(ok);
    return first ? first.replace(/\s{2,}.*/, '').trim() : '';
  }
  // signed e-invoice QR (JWT) → fields; a plain JSON QR also works
  function parseQr(s) {
    if (!s) return null;
    let o = null;
    const parts = String(s).trim().split('.');
    try {
      if (parts.length === 3) {
        const b = parts[1].replace(/-/g, '+').replace(/_/g, '/'), pad = b + '==='.slice((b.length + 3) % 4);
        const j = JSON.parse(decodeURIComponent(escape(atob(pad))));
        o = typeof j.data === 'string' ? JSON.parse(j.data) : j.data || j;
      } else if (/^\s*\{/.test(s)) { const j = JSON.parse(s); o = typeof j.data === 'string' ? JSON.parse(j.data) : j.data || j; }
    } catch (e) { return null; }
    if (!o || !(o.SellerGstin || o.DocNo)) return null;
    return { g: String(o.SellerGstin || '').toUpperCase(), buyer: String(o.BuyerGstin || '').toUpperCase(), i: String(o.DocNo || ''), d: normDate(o.DocDt || ''),
      v: +o.TotInvVal || 0, cn: /^CRN$/i.test(o.DocTyp || '') || undefined, dn: /^DBN$/i.test(o.DocTyp || '') || undefined, irn: o.Irn || '', hsn: o.MainHsnCode || '', items: +o.ItemCnt || 0 };
  }
  // text (PDF text layer or OCR) + optional QR → purchase-register row with confidence notes
  function extract(text, { client = '', qr = null, known = {} } = {}) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
    const flat = lines.join('\n');
    const gl = findGstins(flat), own = String(client || '').toUpperCase();
    let g = (qr && qr.g) || gl.find(x => x !== own) || '';
    const gLine = g ? lines.findIndex(l => findGstins(l).includes(g)) : -1;
    const buyerAt = lines.findIndex(l => /\b(bill(ed)?\s*to|buyer|consignee|ship(ped)?\s*to|recipient|customer|sold\s*to|details\s*of\s*receiver)\b/i.test(l));
    let i = '', d = '';
    for (let k = 0; k < lines.length && !i; k++) {
      const m = lines[k].match(INV_RE);
      if (m && !BAD_INV.test(m[1]) && /\d/.test(m[1])) i = m[1].replace(/[.,:]+$/, '');
      else if (m && BAD_INV.test(m[1]) || /^\s*(invoice|bill)\s*(no|number)\.?\s*$/i.test(lines[k])) { const nx = (lines[k + 1] || '').trim().split(/\s{2,}|\t/)[0]; if (/^[A-Za-z0-9][A-Za-z0-9\/\-_.]{0,19}$/.test(nx) && /\d/.test(nx) && !DATE_RE.test(nx)) i = nx; }
    }
    for (const l of lines) { const m = l.match(new RegExp('(?:invoice\\s*date|inv\\.?\\s*date|bill\\s*date|dated|date\\s*of\\s*(?:invoice|issue)|\\bdate)\\s*[:\\-]?\\s*' + DATE_RE.source, 'i')); if (m) { d = normDate(m[1]); if (d) break; } }
    if (!d) { for (const l of lines) { const m = l.match(DATE_RE); if (m && normDate(m[1])) { d = normDate(m[1]); break; } } }
    const cn = /credit\s*note/i.test(lines.slice(0, 15).join(' ')) || undefined;
    const rc = /reverse\s*charge\s*(applicable)?\s*[:\-]?\s*(yes|y)\b/i.test(flat) || undefined;
    const intra = g && own ? g.slice(0, 2) === own.slice(0, 2) : null;
    const c = candidates(lines);
    let s = solve(c, { fixedV: qr && qr.v, intra });
    if (!s || !s.ok) { const w = solve(c, { fixedV: qr && qr.v, intra, wide: true }); if (w && (!s || w.ok && !s.ok || w.sc > s.sc + 2)) s = w; }
    const out = { g, n: known[g] || (g ? supplierName(lines, gLine, buyerAt) : supplierName(lines, -1, buyerAt)), i: (qr && qr.i) || i, d: (qr && qr.d) || d,
      t: s ? r2(s.t) : 0, ig: s ? r2(s.ig) : 0, cg: s ? r2(s.cg) : 0, sg: s ? r2(s.sg) : 0, cs: s ? r2(s.cs) : 0, v: s ? r2(s.v) : r2(qr && qr.v || 0),
      cn: (qr && qr.cn) || cn, rc, irn: qr && qr.irn || undefined };
    return { row: out, sumOk: !!(s && s.ok), buyerSeen: own ? gl.includes(own) : null, qrBuyerOk: qr && own ? qr.buyer === own : null, gstins: gl };
  }
  // review checks for one row
  function checks(row, { client = '', month = '', dupKeys = new Set() } = {}) {
    const out = [], own = String(client || '').toUpperCase(), tax = r2((+row.ig || 0) + (+row.cg || 0) + (+row.sg || 0) + (+row.cs || 0));
    const add = (lvl, msg) => out.push({ lvl, msg });
    if (!row.g) add('err', 'Supplier GSTIN missing'); else if (!gstinCheck(row.g)) add('err', 'GSTIN check digit is wrong — re-check the GSTIN');
    else if (row.g === own) add('err', 'This is the client’s own GSTIN — enter the supplier’s');
    if (!row.i) add('err', 'Invoice no. missing'); else if (String(row.i).length > 16) add('warn', 'Invoice no. is longer than 16 characters');
    if (!row.d) add('err', 'Date missing');
    else { if (month && row.d.slice(0, 7) !== month) add('warn', `Dated ${row.d.split('-').reverse().join('-')} — not in this month`); if (row.d > isoToday()) add('err', 'Date is in the future'); }
    if (!(+row.t)) add('err', 'Taxable value missing');
    if (+row.t && +row.v && Math.abs(+row.t + tax - +row.v) > 1.01) add('warn', `Taxable + tax = ${r2(+row.t + tax)}, total on bill ${r2(+row.v)}`);
    if ((+row.cg || +row.sg) && Math.abs((+row.cg || 0) - (+row.sg || 0)) > 0.51) add('warn', 'CGST and SGST differ');
    if (+row.ig && (+row.cg || +row.sg)) add('err', 'Both IGST and CGST/SGST');
    if (row.g && own && gstinCheck(row.g)) { const intra = row.g.slice(0, 2) === own.slice(0, 2); if (intra && +row.ig) add('warn', 'Same state supplier but IGST charged'); if (!intra && (+row.cg || +row.sg)) add('warn', 'Other state supplier but CGST/SGST charged'); }
    if (+row.t && tax) { const rate = ((+row.ig || 0) + (+row.cg || 0) + (+row.sg || 0)) / +row.t; if (!RATES.some(r => Math.abs(rate - r) < 0.0015)) add('warn', `Tax is ${(rate * 100).toFixed(2)}% of taxable — mixed rates or a misread figure?`); }
    if (dupKeys.has(dupKey(row))) add('err', 'Already in this month’s purchase register');
    return out;
  }
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dupKey = r => `${String(r.g || '').toUpperCase()}|${GR.normInv(r.i)}`;
  // pdf.js text items → lines (keeps columns apart with two spaces)
  function itemsToLines(items) {
    const it = items.filter(x => x.str && x.str.trim()).map(x => ({ s: x.str, x: x.transform[4], y: x.transform[5], w: x.width || x.str.length * 4, h: Math.abs(x.transform[3]) || 8 }));
    it.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    it.forEach(x => { const r = rows.find(r => Math.abs(r.y - x.y) <= Math.max(2, Math.min(r.h, x.h) * 0.45)); if (r) r.a.push(x); else rows.push({ y: x.y, h: x.h, a: [x] }); });
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => { r.a.sort((p, q) => p.x - q.x); let s = '', end = null;
      r.a.forEach(x => { if (end != null) { const gap = x.x - end, cw = x.w / Math.max(1, x.s.length); s += gap > cw * 1.8 ? '   ' : gap > cw * 0.25 ? ' ' : ''; } s += x.s; end = x.x + x.w; });
      return s.replace(/\s+$/, ''); }).join('\n');
  }
  return { gstinCheck, fixGstin, findGstins, nums, candidates, solve, parseQr, extract, checks, dupKey, itemsToLines, normDate };
})();

/* ---------- libraries (loaded only when a bill is read) ---------- */
const BILL_LIB = Object.assign({
  pdf: 'pdf.min.js', pdfWorker: 'pdf.worker.min.js', qr: 'jsQR.min.js',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  tessWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  tessCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  tessLang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
}, window.BILL_LIBS || {});
const libCache = {};
const loadLib = (src, test) => libCache[src] || (libCache[src] = test() ? Promise.resolve() : new Promise((ok, bad) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete libCache[src]; bad(new Error('Could not load ' + src.split('/').pop() + ' — check the internet connection')); }; document.head.appendChild(s); }));
async function pdfLib() { await loadLib(BILL_LIB.pdf, () => window.pdfjsLib); window.pdfjsLib.GlobalWorkerOptions.workerSrc = BILL_LIB.pdfWorker; return window.pdfjsLib; }
async function qrLib() { await loadLib(BILL_LIB.qr, () => window.jsQR); return window.jsQR; }
let tessWorker = null;
async function ocrWorker(note) {
  if (tessWorker) return tessWorker;
  note('Loading text recognition (first time takes ~10 s)…');
  await loadLib(BILL_LIB.tesseract, () => window.Tesseract);
  tessWorker = await window.Tesseract.createWorker('eng', 1, { workerPath: BILL_LIB.tessWorker, corePath: BILL_LIB.tessCore, langPath: BILL_LIB.tessLang, gzip: true });
  return tessWorker;
}
function canvasOf(src, max) {
  const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); return cv;
}
async function scanQr(cv) {
  const jsQR = await qrLib(), W = cv.width, H = cv.height, ctx = cv.getContext('2d');
  const regions = [[0, 0, W, H], [W / 2, 0, W / 2, H / 2], [0, 0, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 4, 0, W / 2, H / 2], [W / 3, H / 4, W / 2, H / 2]];
  for (const [x, y, w, h] of regions) {
    let img = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (img.width * img.height > 4.2e6) { const c2 = document.createElement('canvas'); c2.width = Math.round(w); c2.height = Math.round(h); c2.getContext('2d').putImageData(img, 0, 0); const s = canvasOf(c2, 2000); img = s.getContext('2d').getImageData(0, 0, s.width, s.height); }
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (r && r.data) { const q = BILL.parseQr(r.data); if (q) return q; }
  }
  return null;
}
const thumbOf = cv => canvasOf(cv, 360).toDataURL('image/jpeg', 0.6);
// read one bill file with the free methods; returns { row, method, notes, thumb, text, … }
async function readBillFree(file, ctx, note = () => {}) {
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  let text = '', qr = null, thumb = '', method = '', cvs = [];
  if (isPdf) {
    note('Opening PDF…');
    const pdfjs = await pdfLib(), doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const n = Math.min(doc.numPages, 3);
    for (let p = 1; p <= n; p++) { const pg = await doc.getPage(p); text += BILL.itemsToLines((await pg.getTextContent()).items) + '\n'; }
    const pg1 = await doc.getPage(1), vp = pg1.getViewport({ scale: 3 }), cv = document.createElement('canvas');
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await pg1.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    cvs.push(cv); thumb = thumbOf(cv);
    note('Looking for the e-invoice QR code…'); qr = await scanQr(cv).catch(() => null);
    method = text.replace(/\s/g, '').length > 60 ? 'PDF text' : '';
    if (!method && n > 1) for (let p = 2; p <= Math.min(n, 2); p++) { const pg = await doc.getPage(p), v2 = pg.getViewport({ scale: 2.5 }), c2 = document.createElement('canvas'); c2.width = Math.round(v2.width); c2.height = Math.round(v2.height); await pg.render({ canvasContext: c2.getContext('2d'), viewport: v2 }).promise; cvs.push(c2); }
  } else if (/^image\//i.test(file.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
    const bmp = await createImageBitmap(file), cv = canvasOf(bmp, 2600);
    cvs.push(cv); thumb = thumbOf(cv);
    note('Looking for the e-invoice QR code…'); qr = await scanQr(cv).catch(() => null);
  } else throw new Error('Not a PDF or photo');
  if (!method) {
    note('Reading the text (text recognition)…');
    const w = await ocrWorker(note);
    for (const cv of cvs.slice(0, 2)) { const r = await w.recognize(canvasOf(cv, 2400)); text += (r.data && r.data.text || '') + '\n'; }
    method = 'Text recognition';
  }
  const x = BILL.extract(text, { client: ctx.client, qr, known: ctx.known || {} });
  const notes = [];
  if (qr) notes.push('E-invoice QR read — GSTIN, invoice no., date and total are exact');
  if (x.qrBuyerOk === false) notes.push(`QR says the buyer is ${qr.buyer}, not the client`);
  if (x.buyerSeen === false && !qr) notes.push('Client’s GSTIN not found on the bill');
  return { row: x.row, sumOk: x.sumOk, method: qr ? method + ' + QR' : method, notes, thumb, text, qr: !!qr };
}
const billComplete = b => { const r = b.row; return !!(r.g && BILL.gstinCheck(r.g) && r.i && r.d && +r.t && b.sumOk); };
async function fileB64(file, maxSide = 1800) {
  if (/^image\//i.test(file.type)) {                        // shrink photos: fewer AI tokens, smaller upload
    const cv = canvasOf(await createImageBitmap(file), maxSide), data = cv.toDataURL('image/jpeg', 0.85);
    return { media_type: 'image/jpeg', data: data.split(',')[1] };
  }
  const b = new Uint8Array(await file.arrayBuffer()); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return { media_type: 'application/pdf', data: btoa(s) };
}
async function readBillAi(file, ctx) {
  if (file.size > 9e6) throw new Error('File is over 9 MB — too big for AI reading');
  const f = await fileB64(file);
  const j = await fnCall('bill-read', 'read', { client_id: ctx.clientId, name: file.name, ...f });
  const r = j.bill || {};
  const row = { g: String(r.supplier_gstin || '').toUpperCase().replace(/\s/g, ''), n: r.supplier_name || '', i: String(r.invoice_no || ''), d: BILL.normDate(r.invoice_date || '') || '',
    t: +r.taxable_value || 0, ig: +r.igst || 0, cg: +r.cgst || 0, sg: +r.sgst || 0, cs: +r.cess || 0, v: +r.total || 0, cn: r.document_type === 'credit_note' || undefined, rc: !!r.reverse_charge || undefined };
  if (row.g && !BILL.gstinCheck(row.g)) { const f2 = BILL.fixGstin(row.g); if (f2) row.g = f2; }
  const notes = [`Read by AI (${j.model || 'Claude'}) · about ₹${(+j.cost_inr || 0).toFixed(2)}`];
  if (r.buyer_gstin && ctx.client && String(r.buyer_gstin).toUpperCase() !== ctx.client) notes.push(`AI: buyer GSTIN on the bill is ${r.buyer_gstin}`);
  if (r.note) notes.push('AI: ' + r.note);
  return { row, sumOk: Math.abs(row.t + row.ig + row.cg + row.sg + row.cs - row.v) <= 1.01, method: 'AI', notes };
}
let aiState = null;                                           // { ok, why } per client for this session
async function aiAvailable(clientId) {
  const r = await safe(sb.rpc('ai_can_read', { p_client: clientId }));
  aiState = { client: clientId, at: Date.now(), ok: !r.error && r.data && r.data.ok, why: r.error ? 'AI bill reading is not set up (run update-session3.sql)' : (r.data || {}).why || '' };
  return aiState;
}

// review window: read every file, let staff correct, then add to the month's purchase register
async function readBillsDialog({ c, month, files, getRow, save, onAdded }) {
  if (!files || !files.length) return;
  const known = {};
  const cur = getRow();
  [...((cur.gstr2b || {}).rows || []), ...((cur.purchases || {}).rows || [])].forEach(x => { if (x.g && x.n && !known[x.g]) known[x.g] = x.n; });
  const dupKeys = new Set(((cur.purchases || {}).rows || []).map(BILL.dupKey));
  const ctx = { client: String(c.gstin || '').toUpperCase(), clientId: c.id, known };
  const ai = await aiAvailable(c.id);
  const bills = [...files].map(f => ({ f, st: 'wait', row: {}, notes: [], method: '' }));
  const mLabel = `${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
  const m = modal(`Read bills → purchase register · ${c.name} · ${mLabel}`, `<p class="muted small" style="margin-top:0">Each bill is read on this computer for free (e-invoice QR, PDF text, then text recognition)${ai.ok ? '. When the free reading is incomplete, AI reads it (small cost per bill)' : `. ${esc(ai.why || 'AI reading is off')}`}. <b>Check every figure</b> before adding.</p>
    <div data-bl></div>`, { wide: true, saveText: 'Add to purchase register', extra: '<span class="muted small" data-bsum></span>',
    onSave: async () => {
      const okRows = bills.filter(b => b.st === 'done' && !b.skip);
      const blocked = okRows.filter(b => BILL.checks(b.row, { client: ctx.client, month, dupKeys }).some(x => x.lvl === 'err'));
      if (!okRows.length) { toast('Nothing to add yet', true); return false; }
      if (blocked.length) { toast(`${blocked.length} bill(s) still have errors (red) — fix them or untick “Add”`, true); return false; }
      const P = getRow().purchases || { rows: [] };
      const add = okRows.map(b => { const r = b.row, sgn = r.cn ? -1 : 1, a = k => Math.round(sgn * Math.abs(+r[k] || 0) * 100) / 100;
        return { g: r.g, n: r.n || '', i: r.i, d: r.d, t: a('t'), ig: a('ig'), cg: a('cg'), sg: a('sg'), cs: a('cs'), v: a('v'), cn: r.cn || undefined, rc: r.rc || undefined, src: 'BILL', bill: b.f.name, how: b.method }; });
      const names = [...new Set([...(String(P.file || '').split(' + ').filter(Boolean)), `${add.length} bill${add.length > 1 ? 's' : ''} read`])];
      await save({ purchases: { ...P, rows: [...(P.rows || []), ...add], file: names.join(' + '), source: P.source || 'bills', at: new Date().toISOString(), by: me.id } });
      toast(`${add.length} bill${add.length > 1 ? 's' : ''} added to the purchase register`);
      if (onAdded) onAdded();
    } });
  const box = $('[data-bl]', m.el), sum = $('[data-bsum]', m.el);
  const F = [['g', 'Supplier GSTIN', 'text', 15], ['n', 'Supplier', 'text'], ['i', 'Invoice no.', 'text'], ['d', 'Date', 'date'], ['t', 'Taxable', 'num'], ['ig', 'IGST', 'num'], ['cg', 'CGST', 'num'], ['sg', 'SGST', 'num'], ['cs', 'Cess', 'num'], ['v', 'Total', 'num']];
  const draw = () => {
    box.innerHTML = bills.map((b, k) => { const ck = b.st === 'done' ? BILL.checks(b.row, { client: ctx.client, month, dupKeys }) : [], err = ck.some(x => x.lvl === 'err');
      return `<div class="bill ${b.st} ${err ? 'has-err' : ''} ${b.skip ? 'skip' : ''}" data-b="${k}">
        <div class="bill-h">${b.thumb ? `<img src="${b.thumb}" alt="" class="bill-th" data-zoom="${k}">` : '<span class="bill-th ph">📄</span>'}
          <div class="bill-fn"><b>${esc(b.f.name)}</b><div class="muted tiny">${b.st === 'wait' ? 'Waiting…' : b.st === 'busy' ? esc(b.msg || 'Reading…') : b.st === 'fail' ? `<span class="late">${esc(b.err)}</span>` : `${esc(b.method)}${b.sumOk ? ' · figures add up ✓' : ''}`}</div></div>
          <span class="spacer"></span>${b.st === 'busy' ? '<span class="spin" aria-hidden="true"></span>' : ''}
          ${b.st === 'done' || b.st === 'fail' ? `${ai.ok && b.method !== 'AI' ? `<button class="btn sm" data-ai="${k}">Read with AI</button>` : ''}<label class="check small"><input type="checkbox" data-skip="${k}" ${b.skip ? '' : 'checked'}> Add</label>` : ''}</div>
        ${b.st === 'done' ? `<div class="bill-f">${F.map(([f, l, ty]) => `<label class="${f === 'n' || f === 'g' ? 'wide' : ''}">${l}<input data-f="${f}" ${ty === 'date' ? 'type="date"' : ty === 'num' ? 'inputmode="decimal"' : ''} value="${esc(b.row[f] ?? '')}" ${f === 'g' ? 'maxlength="15" style="text-transform:uppercase"' : ''}></label>`).join('')}
          <label class="check small"><input type="checkbox" data-f="cn" ${b.row.cn ? 'checked' : ''}> Credit note</label><label class="check small"><input type="checkbox" data-f="rc" ${b.row.rc ? 'checked' : ''}> Reverse charge</label></div>
          <div class="bill-ck">${[...ck.map(x => `<span class="${x.lvl === 'err' ? 'late' : 'warn-t'}">${x.lvl === 'err' ? '✗' : '⚠'} ${esc(x.msg)}</span>`), ...(b.notes || []).map(n => `<span class="muted">ⓘ ${esc(n)}</span>`)].join('') || '<span class="ok-t">✓ All checks passed</span>'}</div>` : ''}</div>`; }).join('');
    const done = bills.filter(b => b.st === 'done' && !b.skip);
    sum.textContent = done.length ? `${done.length} to add · taxable ${gst$(done.reduce((s, b) => s + (+b.row.t || 0) * (b.row.cn ? -1 : 1), 0))} · ITC ${gst$(done.reduce((s, b) => s + ((+b.row.ig || 0) + (+b.row.cg || 0) + (+b.row.sg || 0) + (+b.row.cs || 0)) * (b.row.cn ? -1 : 1), 0))}` : '';
  };
  const reCheck = k => { const el = $(`[data-b="${k}"]`, box), b = bills[k]; if (!el) return; const ck = BILL.checks(b.row, { client: ctx.client, month, dupKeys });
    el.classList.toggle('has-err', ck.some(x => x.lvl === 'err'));
    $('.bill-ck', el).innerHTML = [...ck.map(x => `<span class="${x.lvl === 'err' ? 'late' : 'warn-t'}">${x.lvl === 'err' ? '✗' : '⚠'} ${esc(x.msg)}</span>`), ...(b.notes || []).map(n => `<span class="muted">ⓘ ${esc(n)}</span>`)].join('') || '<span class="ok-t">✓ All checks passed</span>'; };
  box.addEventListener('input', e => { const f = e.target.dataset.f, el = e.target.closest('[data-b]'); if (!f || !el) return; const b = bills[+el.dataset.b];
    b.row[f] = e.target.type === 'checkbox' ? e.target.checked || undefined : ['t', 'ig', 'cg', 'sg', 'cs', 'v'].includes(f) ? GR.amt(e.target.value) : f === 'g' ? e.target.value.trim().toUpperCase() : e.target.value.trim();
    if (f === 'g' && known[b.row.g] && !b.row.n) { b.row.n = known[b.row.g]; $('[data-f=n]', el).value = b.row.n; }
    reCheck(+el.dataset.b); });
  box.addEventListener('change', e => { if (e.target.dataset.f === 'cn' || e.target.dataset.f === 'rc') { const el = e.target.closest('[data-b]'); bills[+el.dataset.b].row[e.target.dataset.f] = e.target.checked || undefined; reCheck(+el.dataset.b); }
    if (e.target.dataset.skip != null) { bills[+e.target.dataset.skip].skip = !e.target.checked; draw(); } });
  box.addEventListener('click', async e => {
    const z = e.target.dataset.zoom; if (z != null) { const u = URL.createObjectURL(bills[+z].f); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60000); return; }
    const b = e.target.closest('[data-ai]'); if (!b) return;
    const k = +b.dataset.ai; await runAi(k);
  });
  async function runAi(k) {
    const b = bills[k]; b.st = 'busy'; b.msg = 'AI is reading the bill…'; draw();
    try { const r = await readBillAi(b.f, ctx); Object.assign(b, r, { st: 'done', notes: [...r.notes, ...(b.freeNotes || [])] }); }
    catch (e) { if (b.row && b.row.g !== undefined && b.method) { b.st = 'done'; b.notes = [`AI failed: ${friendly(e)}`, ...(b.notes || [])]; } else { b.st = 'fail'; b.err = 'AI: ' + friendly(e); } }
    draw();
  }
  draw();
  for (let k = 0; k < bills.length; k++) {
    if (!document.body.contains(m.el)) return;                 // window closed
    const b = bills[k]; b.st = 'busy'; draw();
    try {
      const r = await readBillFree(b.f, ctx, msg => { b.msg = msg; const el = $(`[data-b="${k}"] .bill-fn .tiny`, box); if (el) el.textContent = msg; });
      Object.assign(b, r, { st: 'done', freeNotes: r.notes });
      draw();
      if (ai.ok && !billComplete(b)) await runAi(k);
    } catch (e) {
      b.st = 'fail'; b.err = friendly(e); draw();
      if (ai.ok) await runAi(k);
    }
  }
}
const pickFiles = accept => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => res([...i.files]); i.click(); });

/* ---------- Settings: bill reading (AI key) ---------- */
async function renderAiSettings(box) {
  const r = await safe(sb.rpc('ai_admin_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Bill reading (AI)</h3><p class="note small">Run <b>update-session3.sql</b> in Supabase to set this up.</p></div>'; return; }
  const s = r.data || {}, when = t => t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<div class="card"><h3>Bill reading (AI)</h3>
    <p class="muted">PDF and photo bills are always read for free first (e-invoice QR code, PDF text, then text recognition on this computer). If a Claude API key is saved and this is switched on, bills that the free reading cannot finish are sent to Claude — about ₹0.05 a bill with Claude Haiku 5.5. The key is stored encrypted in the database and is never shown again.</p>
    <div class="mail-stat"><span class="pill ${s.enabled && s.key_set ? 'g' : 'a'}">${s.enabled && s.key_set ? '● AI on' : s.key_set ? 'AI switched off' : 'No key — free reading only'}</span>
      <span class="small">This month: <b>${s.month_reads || 0}</b> bills by AI · about <b>₹${(+s.month_cost || 0).toFixed(2)}</b>${s.month_errors ? ` · ${s.month_errors} failed` : ''}</span></div>
    <div class="form-grid" style="margin-top:12px">
      <label>Model<select id="aiModel">${opts([['claude-haiku-5-5', 'Claude Haiku 5.5 — cheapest (recommended)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — for hard handwritten bills']], s.model || 'claude-haiku-5-5', x => x[1], x => x[0])}</select></label>
      <label>Most AI reads a month<input id="aiMax" type="number" min="0" value="${esc(s.max_per_month ?? 2000)}"></label>
      <label>Price in (US$ / million tokens)<input id="aiPin" type="number" step="0.01" value="${esc(s.price_in ?? 0.1)}"></label>
      <label>Price out (US$ / million tokens)<input id="aiPout" type="number" step="0.01" value="${esc(s.price_out ?? 0.5)}"></label>
      <label>₹ per US$<input id="aiFx" type="number" step="0.5" value="${esc(s.usd_inr ?? 88)}"></label></div>
    <p class="muted small">Prices are only used to show the cost here. Check the current rates on console.anthropic.com → Settings → Billing.</p>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="aiOn" ${s.enabled ? 'checked' : ''} ${s.key_set ? '' : 'disabled'}> Use AI when the free reading is incomplete</label>
    ${isAdmin() ? `<div class="toolbar" style="margin-top:12px"><button class="btn primary" id="aiSave">Save</button><span class="spacer"></span>
      <button class="btn" id="aiKey">${s.key_set ? 'Replace key' : 'Save Claude API key'}</button>${s.key_set ? '<button class="btn ghost" id="aiDel">Remove key</button>' : ''}</div>
    ${s.key_set ? `<p class="muted small">Key ending …${esc(s.key_hint || '')}, saved ${when(s.key_set_at)}.</p>` : ''}` : '<p class="muted small">Only the Admin can change these.</p>'}
    <details class="small" style="margin-top:8px"><summary>How to get a Claude API key</summary><ol class="steps">
      <li>Go to <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> and sign up / sign in.</li>
      <li>Settings → Billing: add a payment method and a small credit (e.g. US$5 lasts for thousands of bills).</li>
      <li>Settings → API keys → Create key (name it “JLR tracker”). Copy it — it starts with <b>sk-ant-</b>.</li>
      <li>Here: <b>Save Claude API key</b>, paste, then tick “Use AI…” and Save.</li></ol></details></div>`;
  if (!isAdmin()) return;
  $('#aiSave', box).onclick = async () => {
    try { await must(sb.rpc('ai_admin_save', { p_enabled: $('#aiOn', box).checked, p_model: $('#aiModel', box).value, p_max: Math.round(num($('#aiMax', box).value)), p_price_in: num($('#aiPin', box).value), p_price_out: num($('#aiPout', box).value), p_usd_inr: num($('#aiFx', box).value) })); aiState = null; toast('Saved'); renderAiSettings(box); }
    catch (e) { toast(friendly(e), true); }
  };
  $('#aiKey', box).onclick = () => modal('Claude API key', `<p class="small" style="margin-top:0">Paste the key from console.anthropic.com → API keys. It is saved encrypted and cannot be viewed again.</p>
      <label>API key<input type="password" name="k" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>`, { saveText: 'Save key',
    onSave: async el => { const k = fv(el, 'k'); if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k)) { toast('That does not look like a Claude API key (it starts with sk-ant-)', true); return false; }
      await must(sb.rpc('ai_admin_set_key', { p_key: k })); aiState = null; toast('Key saved'); renderAiSettings(box); } });
  if ($('#aiDel', box)) $('#aiDel', box).onclick = async () => { if (!confirm('Remove the Claude API key? Bills will be read with the free methods only.')) return; try { await must(sb.rpc('ai_admin_set_key', { p_key: '' })); aiState = null; toast('Key removed'); renderAiSettings(box); } catch (e) { toast(friendly(e), true); } };
}

/* =====================================================================
   TDS WORKING (Session 4, v21)  #/tds
   Section-wise working · challans · quarterly return prep · Form 16 / 16A
   Every section is shown with BOTH numbers: Income-tax Act 1961 (old) and
   Income-tax Act 2025 (new, in force from 1 April 2026).
   ===================================================================== */
// k = key · o = old section (1961 Act) · n = new reference (2025 Act) · name · r = rate % (number, {IND, CO, OTH} or null = type it)
// th = threshold {one: per payment, fy: in the year, pm: per month, over: TDS only on the amount above} · f = return form · code = e-Pay Tax payment code
const TDS_SEC = [
  { k: '192', o: '192', n: '392', name: 'Salary', r: null, th: {}, f: '24Q', code: '', note: 'TDS as per the slab rates — type the TDS worked out in payroll.' },
  { k: '192A', o: '192A', n: '392(7)', name: 'EPF accumulated balance paid', r: 10, th: { one: 50000 }, f: '26Q', code: '1004' },
  { k: '193', o: '193', n: '393(1) Sl. 5(i)', name: 'Interest on securities', r: 10, th: { fy: 10000 }, f: '26Q', code: '1019' },
  { k: '194', o: '194', n: '393(1) Sl. 7', name: 'Dividend', r: 10, th: { fy: 10000 }, f: '26Q', code: '1029' },
  { k: '194A-B', o: '194A', n: '393(1) Sl. 5(ii)', name: 'Interest – bank / co-op bank / post office', r: 10, th: { fy: 50000 }, f: '26Q', code: '1021', note: 'Senior citizens: ₹1,00,000 in the year.' },
  { k: '194A', o: '194A', n: '393(1) Sl. 5(iii)', name: 'Interest – other than bank (loans, deposits)', r: 10, th: { fy: 10000 }, f: '26Q', code: '1022' },
  { k: '194B', o: '194B', n: '393(3) Sl. 1', name: 'Winnings – lottery, crossword, game', r: 30, th: { one: 10000 }, f: '26Q', code: '1058' },
  { k: '194BB', o: '194BB', n: '393(3) Sl. 3', name: 'Winnings – horse race', r: 30, th: { one: 10000 }, f: '26Q', code: '1062' },
  { k: '194C', o: '194C', n: '393(1) Sl. 6(i)', name: 'Contractor / sub-contractor (incl. manpower supply)', r: { IND: 1, CO: 2, OTH: 2 }, th: { one: 30000, fy: 100000 }, f: '26Q', code: '1023 (Ind/HUF) · 1024 (others)', note: 'No TDS for a transporter (≤10 goods carriages) who gives PAN + declaration — reason T.' },
  { k: '194D', o: '194D', n: '393(1) Sl. 1(i)', name: 'Insurance commission', r: { IND: 2, OTH: 2, CO: 10 }, th: { fy: 20000 }, f: '26Q', code: '1005' },
  { k: '194DA', o: '194DA', n: '393(1) Sl. 8(i)', name: 'Life insurance payout (on the income part)', r: 2, th: { fy: 100000 }, f: '26Q', code: '' },
  { k: '194G', o: '194G', n: '393(3) Sl. 4', name: 'Commission on sale of lottery tickets', r: 2, th: { fy: 20000 }, f: '26Q', code: '1063' },
  { k: '194H', o: '194H', n: '393(1) Sl. 1(ii)', name: 'Commission / brokerage', r: 2, th: { fy: 20000 }, f: '26Q', code: '1006' },
  { k: '194I-PM', o: '194-I(a)', n: '393(1) Sl. 2(ii)(a)', name: 'Rent – plant, machinery, equipment', r: 2, th: { pm: 50000 }, f: '26Q', code: '1008' },
  { k: '194I-LB', o: '194-I(b)', n: '393(1) Sl. 2(ii)(b)', name: 'Rent – land, building, furniture', r: 10, th: { pm: 50000 }, f: '26Q', code: '1009' },
  { k: '194IA', o: '194-IA', n: '393(1) Sl. 3(i)', name: 'Purchase of immovable property (≥ ₹50 lakh)', r: 1, th: { one: 5000000 }, f: '141', code: '', note: 'Paid with Form 141 (old 26QB) — not part of the quarterly return.' },
  { k: '194IB', o: '194-IB', n: '393(1) Sl. 2(i)', name: 'Rent paid by individual / HUF (no audit)', r: 2, th: { pm: 50000 }, f: '141', code: '1007', note: 'Paid with Form 141 (old 26QC).' },
  { k: '194IC', o: '194-IC', n: '393(1) Sl. 3(ii)', name: 'Joint development agreement – consideration', r: 10, th: {}, f: '26Q', code: '' },
  { k: '194J-T', o: '194J(a)', n: '393(1) Sl. 6(iii)(a)', name: 'Fees for technical services, call centre, film royalty', r: 2, th: { fy: 50000 }, f: '26Q', code: '1026' },
  { k: '194J-P', o: '194J(b)', n: '393(1) Sl. 6(iii)(b)', name: 'Professional fees, royalty, non-compete fees', r: 10, th: { fy: 50000 }, f: '26Q', code: '1027' },
  { k: '194J-D', o: '194J', n: '393(1) Sl. 6(iii)', name: 'Director sitting fees / commission (not salary)', r: 10, th: {}, f: '26Q', code: '' },
  { k: '194K', o: '194K', n: '393(1) Sl. 4(i)', name: 'Income on mutual fund units', r: 10, th: { fy: 10000 }, f: '26Q', code: '1013' },
  { k: '194LA', o: '194LA', n: '393(1) Sl. 3(iii)', name: 'Compensation on compulsory acquisition', r: 10, th: { fy: 500000 }, f: '26Q', code: '1012' },
  { k: '194M', o: '194M', n: '393(1) Sl. 6(ii)', name: 'Contract / professional fees by individual / HUF (no audit)', r: 2, th: { fy: 5000000 }, f: '141', code: '', note: 'Paid with Form 141 (old 26QD).' },
  { k: '194O', o: '194-O', n: '393(1) Sl. 8(v)', name: 'E-commerce operator – payment to sellers', r: 0.1, th: {}, f: '26Q', code: '1035' },
  { k: '194Q', o: '194Q', n: '393(1) Sl. 8(ii)', name: 'Purchase of goods (buyer turnover > ₹10 crore)', r: 0.1, th: { over: 5000000 }, f: '26Q', code: '1031', note: 'TDS only on purchases above ₹50 lakh from one seller in the year.' },
  { k: '194R', o: '194R', n: '393(1) Sl. 8(iv)', name: 'Business benefit / perquisite', r: 10, th: { fy: 20000 }, f: '26Q', code: '1033' },
  { k: '194S', o: '194S', n: '393(1) Sl. 8(vi)', name: 'Transfer of virtual digital asset (crypto)', r: 1, th: { fy: 50000 }, f: '26Q', code: '1037' },
  { k: '194T', o: '194T', n: '393(3) Sl. 7', name: 'Salary, remuneration, commission, interest to partners', r: 10, th: { fy: 20000 }, f: '26Q', code: '1067' },
  { k: '195', o: '195', n: '393(2)', name: 'Payment to a non-resident (rate as per Act / DTAA)', r: null, th: {}, f: '27Q', code: '1057', note: 'Type the rate as per the Act or the DTAA (with TRC and Form 41, old 10F).' },
  // ---- TCS (old sec 206C → new sec 394) · return Form 143 (old 27EQ) · rates from 1 April 2026 (for FY 2025-26 and earlier, type the rate)
  { k: '206C-LQ', o: '206C(1)', n: '394(1)', name: 'TCS – alcoholic liquor for human consumption', r: 2, th: {}, f: '27EQ', code: '1068' },
  { k: '206C-TL', o: '206C(1)', n: '394(1)', name: 'TCS – tendu leaves', r: 2, th: {}, f: '27EQ', code: '1069' },
  { k: '206C-FP', o: '206C(1)', n: '394(1)', name: 'TCS – timber / other forest produce', r: 2, th: {}, f: '27EQ', code: '1070' },
  { k: '206C-SC', o: '206C(1)', n: '394(1)', name: 'TCS – scrap', r: 2, th: {}, f: '27EQ', code: '1073' },
  { k: '206C-MN', o: '206C(1)', n: '394(1)', name: 'TCS – minerals (coal, lignite, iron ore)', r: 2, th: {}, f: '27EQ', code: '1074' },
  { k: '206C1C', o: '206C(1C)', n: '394(2)', name: 'TCS – parking lot, toll plaza, mining / quarrying lease', r: 2, th: {}, f: '27EQ', code: '1090' },
  { k: '206C1F', o: '206C(1F)', n: '394(3)', name: 'TCS – motor vehicle above ₹10 lakh', r: 1, th: { one: 1000000 }, f: '27EQ', code: '1075' },
  { k: '206C1G-ED', o: '206C(1G)', n: '394(1)', name: 'TCS – LRS remittance for education / medical treatment', r: 2, th: { over: 1000000 }, f: '27EQ', code: '1086', note: 'Only on the amount above ₹10 lakh in the year. Nil if paid out of an education loan from a financial institution — use reason B.' },
  { k: '206C1G-OT', o: '206C(1G)', n: '394(1)', name: 'TCS – LRS remittance for other purposes', r: 20, th: { over: 1000000 }, f: '27EQ', code: '1087', note: 'Only on the amount above ₹10 lakh in the year.' },
  { k: '206C1G-TP', o: '206C(1G)', n: '394(1)', name: 'TCS – overseas tour programme package', r: 2, th: {}, f: '27EQ', code: '1088' },
];
const TDS_BY = Object.fromEntries(TDS_SEC.map(s => [s.k, s]));
const TDS_TYPES = [['IND', 'Individual / HUF'], ['CO', 'Company'], ['OTH', 'Firm / LLP / others']];
const TDS_REASONS = [['', 'Normal'], ['A', 'A – lower / nil (certificate)'], ['B', 'B – no TDS (15G / 15H)'], ['C', 'C – higher rate (no PAN)'], ['T', 'T – transporter declaration'], ['Y', 'Y – below threshold']];
// return forms: [old name, new name]   — the new names apply from FY 2026-27
const TDS_FORMS = { '24Q': ['24Q', '138', 'Salary'], '26Q': ['26Q', '140', 'Non Salary'], '27Q': ['27Q', '144', 'NRI'], '27EQ': ['27EQ', '143', 'TCS'] };
const TDS_CERT = { '24Q': ['Form 16', 'Form 130'], '26Q': ['Form 16A', 'Form 131'], '27Q': ['Form 16A', 'Form 131'] };
const tdsNewAct = fy0 => fy0 >= 2026;
const tdsFormName = (f, fy0) => { const [o, n] = TDS_FORMS[f]; return tdsNewAct(fy0) ? `Form ${n}-${o}` : `${o} (Form ${n})`; };
const tdsFormTab = (f, fy0) => `${tdsFormName(f, fy0)} ${TDS_FORMS[f][2]}`;   // e.g. Form 138-24Q Salary
const tdsCertName = (f, fy0) => { const [o, n] = TDS_CERT[f]; return tdsNewAct(fy0) ? `${n} (old ${o})` : `${o} (new ${n})`; };
const tdsSecShort = (s, fy0) => s ? (tdsNewAct(fy0) ? `${s.n} · old ${s.o}` : `${s.o} · new ${s.n}`) : '—';
const tdsSecLabel = s => `${s.o} → ${s.n} · ${s.name}`;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const panType = p => { const c = String(p || '').toUpperCase()[3]; return c === 'C' ? 'CO' : c === 'P' || c === 'H' ? 'IND' : c ? 'OTH' : ''; };
const tdsFyKey = fy0 => `${fy0}-${String(fy0 + 1).slice(2)}`;
const tdsFyOf = ym => { const [y, m] = ym.split('-').map(Number); return m >= 4 ? y : y - 1; };
const tdsQOf = ym => { const m = +ym.split('-')[1]; return m >= 4 && m <= 6 ? 1 : m <= 9 && m >= 7 ? 2 : m >= 10 ? 3 : 4; };
const tdsFyMonths = fy0 => Array.from({ length: 12 }, (_, i) => { const m = (i + 3) % 12 + 1, y = m >= 4 ? fy0 : fy0 + 1; return `${y}-${pad(m)}`; });
const tdsQMonths = (fy0, q) => tdsFyMonths(fy0).slice((q - 1) * 3, q * 3);
const tdsRetDue = (fy0, q, f) => f === '27EQ' ? [`${fy0}-07-15`, `${fy0}-10-15`, `${fy0 + 1}-01-15`, `${fy0 + 1}-05-15`][q - 1]   // TCS return: 15th
  : [`${fy0}-07-31`, `${fy0}-10-31`, `${fy0 + 1}-01-31`, `${fy0 + 1}-05-31`][q - 1];
const tdsCertDue = (fy0, q, f) => f === '24Q' ? (q === 4 ? `${fy0 + 1}-06-15` : null) : [`${fy0}-08-15`, `${fy0}-11-15`, `${fy0 + 1}-02-15`, `${fy0 + 1}-06-15`][q - 1];
function tdsRate(s, type, pan) {                       // standard rate for the section, deductee type and PAN
  if (!s || s.r == null) return null;
  let r = typeof s.r === 'number' ? s.r : (s.r[type] ?? s.r.OTH);
  if (!PAN_RE.test(String(pan || '').toUpperCase())) r = s.f === '27EQ' ? Math.max(2 * r, 5) : Math.max(r, ['194O', '194Q'].includes(s.k) ? 5 : 20);   // no / invalid PAN: higher rate (old sec 206AA)
  return r;
}
// Work out every row of the year (rows = all entries of the FY, in any order). Returns a Map row → result.
function tdsCalcRows(rows) {
  const out = new Map(), cum = new Map(), pmCum = new Map();
  const party = r => (PAN_RE.test(String(r.pan || '').toUpperCase()) ? String(r.pan).toUpperCase() : 'N:' + lc(r.name));
  const sorted = rows.map((r, i) => [r, i]).filter(([r]) => r.sec || r.amount || r.name).sort((a, b) => String(a[0].paid_on || '').localeCompare(String(b[0].paid_on || '')) || a[1] - b[1]);
  for (const [r] of sorted) {
    const s = TDS_BY[r.sec], amt = num(r.amount), err = [], warn = [];
    const pan = String(r.pan || '').toUpperCase().trim(), type = r.dtype || panType(pan) || 'OTH';
    const key = party(r) + '|' + r.sec, before = cum.get(key) || 0;
    cum.set(key, before + amt);
    const mk = key + '|' + String(r.paid_on || '').slice(0, 7), pmBefore = pmCum.get(mk) || 0; pmCum.set(mk, pmBefore + amt);
    if (!r.paid_on) err.push('date missing');
    if (!r.name) err.push('deductee name missing');
    if (!s) err.push('section missing');
    if (!(amt > 0)) err.push('amount missing');
    if (pan && !PAN_RE.test(pan)) err.push('PAN not valid');
    if (!pan && s && s.r != null) warn.push('no PAN – higher rate');
    const std = tdsRate(s, type, pan);
    const manualRate = r.rate !== '' && r.rate != null;
    const rate = manualRate ? num(r.rate) : std;
    let base = amt;
    if (s && s.th.over) base = Math.max(0, before + amt - s.th.over) - Math.max(0, before - s.th.over);
    const zero = ['B', 'T', 'Y'].includes(r.reason);
    const auto = zero ? 0 : rate == null ? null : Math.round(base * rate / 100);
    const manTds = r.tds_man !== '' && r.tds_man != null;
    const tds = manTds ? Math.round(num(r.tds_man)) : auto;
    if (tds == null && amt > 0 && s) err.push(s.k === '192' ? 'type the TDS (as per slab)' : 'type the rate / TDS');
    if (r.reason === 'A' && !r.cert) err.push('lower-deduction certificate no. missing');
    if (manualRate && std != null && rate < std && r.reason !== 'A' && !zero) warn.push(`rate below ${std}% – reason A?`);
    if (s && amt > 0 && !zero) {
      const t = s.th, ytd = before + amt;
      const below = (t.fy || t.one || t.pm) && !(t.fy && ytd > t.fy) && !(t.one && amt > t.one) && !(t.pm && pmBefore + amt > t.pm);
      if (below && tds > 0) warn.push(`below threshold (${t.fy ? 'year ' + inr(ytd) + ' of ' + inr(t.fy) : t.pm ? 'month ' + inr(pmBefore + amt) + ' of ' + inr(t.pm) : 'per payment ' + inr(t.one)}) – reason Y?`);
      if (t.fy && before <= t.fy && ytd > t.fy && before > 0 && !(t.one && amt > t.one)) warn.push(`year limit ${inr(t.fy)} crossed now – deduct on earlier payments too`);
    }
    if (zero && s && amt > 0) {
      const t = s.th, ytd = before + amt;
      if (r.reason === 'Y' && ((t.fy && ytd > t.fy) || (t.one && amt > t.one) || (t.pm && pmBefore + amt > t.pm) || (!t.fy && !t.one && !t.pm && !t.over))) err.push('threshold crossed – TDS is due');
      if (r.reason === 'T' && s.k !== '194C') err.push('reason T is only for 194C (393(1) Sl. 6(i))');
    }
    const ded = r.ded_on || r.paid_on;
    const lateM = r.ded_on && r.paid_on && r.ded_on > r.paid_on ? monthsSpan(r.paid_on, r.ded_on) : 0;
    if (lateM) warn.push(`deducted late – interest 1% × ${lateM} month${lateM > 1 ? 's' : ''}`);
    out.set(r, { s, type, rate, std, tds: tds || 0, base, before, ded, lateM, err, warn, ok: !err.length, reason: !pan && s && s.r != null && !r.reason ? 'C' : r.reason || '' });
  }
  return out;
}
// interest on one challan (late deduction 1% + late deposit 1.5% a month; part of a month = a full month)
function tdsInterest(entries, calc, ym, paidOn) {
  const tcs = entries.some(r => TDS_BY[r.sec] && TDS_BY[r.sec].f === '27EQ');
  const due = tcs ? nextMonthDay(ym, 7) : tdsPayDue(ym);          // TCS: 7th of next month, March too
  let i1 = 0, i2 = 0;
  for (const r of entries) {
    const x = calc.get(r); if (!x || !x.tds) continue;
    i1 += Math.round(x.tds * 0.01 * x.lateM);
    if (paidOn && paidOn > due) i2 += Math.round(x.tds * (tcs ? 0.01 : 0.015) * monthsSpan(x.ded, paidOn));
  }
  return { due, i1, i2, total: i1 + i2 };
}
function parseTdsSec(v) {
  const s = String(v ?? '').trim(); if (!s) return '';
  if (TDS_BY[s]) return s;
  const u = s.toUpperCase().replace(/\s+/g, '').replace(/^SEC(TION)?/, '');
  const plain = { '194J': '194J-P', '194I': '194I-LB', '194-I': '194I-LB', '194A': '194A' }[u]; if (plain) return plain;
  const byOld = TDS_SEC.find(x => x.o.toUpperCase().replace(/[\s-]/g, '') === u.replace(/-/g, ''));
  if (byOld) return byOld.k;
  const byNew = TDS_SEC.find(x => x.n.toUpperCase().replace(/[\s.]/g, '').replace('SL', 'SL') === u.replace(/\./g, ''));
  return byNew ? byNew.k : '';
}
const TDS_COLS = [['paid_on', 'Date paid / credited', 'date', 128], ['name', 'Deductee name', 'text', 180], ['pan', 'PAN', 'pan', 112], ['dtype', 'Type', TDS_TYPES, 120],
  ['sec', 'Section (old → new)', 'sec', 250], ['amount', 'Amount paid / credited', 'num', 110], ['reason', 'Reason', TDS_REASONS, 120], ['rate', 'Rate % (blank = auto)', 'num', 78],
  ['tds_man', 'TDS (blank = auto)', 'num', 92], ['ded_on', 'Deducted on (blank = same date)', 'date', 128], ['cert', 'Lower-deduction cert. no.', 'text', 120], ['bill', 'Bill / voucher no.', 'text', 100], ['remarks', 'Remarks', 'text', 140]];
const TCS_LBL = { paid_on: 'Date of sale / receipt', name: 'Buyer (collectee) name', amount: 'Sale value / amount received', tds_man: 'TCS (blank = auto)', ded_on: 'Collected on (blank = same date)', cert: 'Lower-collection cert. no.' };
const TDS_STATUS = ['Not started', 'Data pending', 'Prepared', 'Filed', 'Revised'];

let tdsDedF = 'all';   // Deductions tab: which return form's rows to show
let tdsClient = '', tdsMonth = prevMonth(), tdsTab = 'ded', tdsQ = 0, tdsForm = '26Q', tdsDraft = null, tdsDirty = false;
const tdsClients = () => myClients().filter(c => (c.services || []).includes('TDS') || c.tan);
window.addEventListener('beforeunload', e => { if (tdsDirty) { e.preventDefault(); e.returnValue = ''; } });

VIEWS.tds = async v => {
  const probe = await safe(sb.from('tds_entries').select('id').limit(1));
  if (probe.error) return notReady(v, 'TDS working', 'update-session4.sql');
  const list = tdsClients();
  if (tdsClient && !list.some(c => c.id === tdsClient)) tdsClient = '';
  const fy0 = tdsFyOf(tdsMonth);
  if (!tdsQ) tdsQ = tdsQOf(tdsMonth);
  v.innerHTML = `<div class="page-head"><h2>TDS working</h2><span class="spacer"></span>
      <select id="tdsC" aria-label="Client"><option value="">All TDS clients (overview)</option>${opts(list, tdsClient, c => c.name + (c.tan ? ' · ' + c.tan : ''), c => c.id)}</select>
      <label class="small muted" for="tdsM">Month</label><input type="month" id="tdsM" value="${esc(tdsMonth)}"></div>
    ${tdsClient ? `<div class="toolbar"><div class="seg">${[['ded', 'Deductions'], ['chl', 'Challans'], ['ret', 'Quarterly return'], ['cert', 'Form 16 / 16A'], ['fy', 'Year view']].map(([k, l]) => `<button data-tt="${k}" class="${tdsTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="muted small">${esc(tdsFyKey(fy0) === '2026-27' || fy0 >= 2026 ? `FY ${tdsFyKey(fy0)} – Income-tax Act 2025 (new section shown first, old in brackets)` : `FY ${tdsFyKey(fy0)} – Income-tax Act 1961 (old section shown first)`)}</span>
      <span class="spacer"></span><button class="btn sm ghost" id="tdsSecs">Section list (old → new)</button></div>` : '<div class="toolbar"><span class="spacer"></span><button class="btn sm ghost" id="tdsSecs">Section list (old → new)</button></div>'}
    <div id="tdsBody"><div class="loading">Loading…</div></div>`;
  const leave = () => !tdsDirty || confirm('You have unsaved TDS entries. Leave without saving?');
  $('#tdsC', v).onchange = e => { if (!leave()) { e.target.value = tdsClient; return; } tdsClient = e.target.value; tdsDraft = null; tdsDirty = false; route(); };
  $('#tdsM', v).onchange = e => { if (!leave()) { e.target.value = tdsMonth; return; } tdsMonth = e.target.value || prevMonth(); tdsQ = tdsQOf(tdsMonth); tdsDraft = null; tdsDirty = false; route(); };
  $$('[data-tt]', v).forEach(b => b.onclick = () => { tdsTab = b.dataset.tt; route(); });
  $('#tdsSecs', v).onclick = () => tdsSectionList(fy0);
  const body = $('#tdsBody', v);
  if (!tdsClient) return tdsOverview(body, list, fy0);
  const c = clientById(tdsClient), fyk = tdsFyKey(fy0), ms = tdsFyMonths(fy0);
  const [E, C, R] = await Promise.all([
    must(sb.from('tds_entries').select('*').eq('client_id', c.id).eq('fy', fyk).order('line').limit(20000)),
    must(sb.from('tds_challans').select('*').eq('client_id', c.id).gte('month', ms[0] + '-01').lte('month', ms[11] + '-01').limit(5000)),
    must(sb.from('tds_returns').select('*').eq('client_id', c.id).eq('fy', fyk).limit(50))]);
  const ctx = { c, fy0, fyk, all: E.data || [], challans: C.data || [], returns: R.data || [] };
  if (tdsDraft && tdsDraft.client === c.id && tdsDraft.month === tdsMonth) ctx.grid = tdsDraft.rows;
  else ctx.grid = ctx.all.filter(r => r.month.slice(0, 7) === tdsMonth).map(r => ({ ...r, rate: r.rate ?? '', tds_man: r.tds_man ?? '' }));
  ({ ded: tdsDeductions, chl: tdsChallans, ret: tdsReturn, cert: tdsCerts, fy: tdsYear }[tdsTab] || tdsDeductions)(body, ctx);
};
// all FY rows with this month's grid in place of the saved month (so thresholds see unsaved edits)
const tdsYearRows = ctx => [...ctx.all.filter(r => r.month.slice(0, 7) !== tdsMonth), ...ctx.grid.filter(r => r.name || r.amount || r.sec)];
const tdsMonthOf = (ctx, ym) => (ym === tdsMonth ? ctx.grid.filter(r => r.name || r.amount || r.sec) : ctx.all.filter(r => r.month.slice(0, 7) === ym));

function tdsSectionList(fy0) {
  modal('TDS sections – old (1961 Act) and new (2025 Act)', `<p class="muted small" style="margin-top:0">From 1 April 2026 the Income-tax Act 2025 applies: almost all TDS is in <b>section 393</b> (tables in 393(1) residents, 393(2) non-residents, 393(3) any person) and salary in <b>section 392</b>. Payments made up to 31 March 2026 stay under the old sections (FY 2025-26 returns use the old forms). Rates and limits below are the standard ones — check any change in the Finance Act. Payment codes are for the e-Pay Tax challan; check them on the challan screen.</p>
    <div class="table-wrap" style="max-height:60vh"><table><thead><tr><th>Old section</th><th>New section</th><th>Nature of payment</th><th class="r">Rate</th><th>Limit (no TDS up to)</th><th>Return</th><th>Payment code</th></tr></thead><tbody>
    ${TDS_SEC.map(s => `<tr><td><b>${esc(s.o)}</b></td><td><b>${esc(s.n)}</b></td><td class="wrap">${esc(s.name)}${s.note ? `<div class="muted small">${esc(s.note)}</div>` : ''}</td>
      <td class="r">${s.r == null ? 'as per slab / DTAA' : typeof s.r === 'number' ? s.r + '%' : Object.entries(s.r).map(([k, x]) => `${k === 'IND' ? 'Ind/HUF' : k === 'CO' ? 'Co.' : 'Others'} ${x}%`).join('<br>')}</td>
      <td class="small">${[s.th.one && inr(s.th.one) + ' per payment', s.th.fy && inr(s.th.fy) + ' in the year', s.th.pm && inr(s.th.pm) + ' a month', s.th.over && 'on amount above ' + inr(s.th.over)].filter(Boolean).join('<br>') || 'No limit'}</td>
      <td class="small">${s.f === '141' ? 'Form 141 (old 26QB/QC/QD)' : esc(tdsFormName(s.f, fy0))}</td><td class="small">${esc(s.code || '—')}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted small">No PAN: 20% (5% for 194O / 194Q) or the normal rate, whichever is higher (old sec 206AA). Forms from FY 2026-27: 24Q → 138, 26Q → 140, 27Q → 144, 27EQ → 143, Form 16 → 130, 16A → 131, 27D → 133, 26QB/QC/QD → 141, 15G/15H → 121, Form 13 → 128.</p>`, { wide: true });
}

/* ---------- overview: all TDS clients for the month ---------- */
async function tdsOverview(body, list, fy0) {
  const ym = tdsMonth, q = tdsQOf(ym), fyk = tdsFyKey(fy0), prevQ = q === 1 ? null : q - 1;
  const ids = list.map(c => c.id);
  if (!ids.length) { body.innerHTML = '<div class="table-wrap"><div class="empty">No TDS clients — tick the TDS service or add a TAN on the client.</div></div>'; return; }
  const [E, C, R] = await Promise.all([
    must(sb.from('tds_entries').select('client_id,sec,tds,paid_on,ded_on').eq('month', ym + '-01').in('client_id', ids).limit(20000)),
    must(sb.from('tds_challans').select('client_id,sec,tds,paid_on').eq('month', ym + '-01').in('client_id', ids).limit(5000)),
    must(sb.from('tds_returns').select('client_id,q,form,status,filed_on,certs,cert_dl_on').eq('fy', fyk).in('client_id', ids).limit(5000))]);
  const due = tdsPayDue(ym), t = today();
  const rows = list.map(c => {
    const e = (E.data || []).filter(x => x.client_id === c.id), ch = (C.data || []).filter(x => x.client_id === c.id);
    const tds = e.reduce((s, x) => s + num(x.tds), 0), paid = ch.reduce((s, x) => s + (x.paid_on ? num(x.tds) : 0), 0);
    const late = ch.some(x => x.paid_on && x.paid_on > due);
    const st = !e.length ? (ch.length ? 'Paid' : 'No entries') : tds <= 0 ? 'Nil' : paid >= tds - 1 ? (late ? 'Paid late' : 'Paid') : paid > 0 ? 'Short' : t > due ? 'Overdue' : 'To deposit';
    const ret = f => (R.data || []).find(x => x.client_id === c.id && x.q === q && x.form === f);
    const prv = prevQ ? (R.data || []).find(x => x.client_id === c.id && x.q === prevQ && x.form === '26Q') : null;
    return { c, n: e.length, tds, paid, st, r26: ret('26Q'), r24: ret('24Q'), prv };
  });
  const k = s => rows.filter(r => r.st === s).length;
  body.innerHTML = `<div class="bento-stats card stats4" style="margin-bottom:14px">
      <div class="mini blue"><span>TDS clients</span><b>${rows.length}</b></div><div class="mini amber"><span>Entries not made (${esc(monthLabel(ym))})</span><b>${k('No entries')}</b></div>
      <div class="mini red"><span>Overdue / short (due ${fmtDate(due).slice(0, 6)})</span><b>${k('Overdue') + k('Short')}</b></div><div class="mini green"><span>Deposited</span><b>${k('Paid') + k('Paid late')}</b></div></div>
    <p class="muted small" style="margin:-4px 2px 10px">TDS deducted in ${esc(monthLabel(ym))} is due by ${fmtDate(due)}. Quarter ${q} returns (${esc(tdsFormName('26Q', fy0))}, ${esc(tdsFormName('24Q', fy0))}) are due by ${fmtDate(tdsRetDue(fy0, q))}. Pick a client to enter deductions.</p>
    <div class="table-wrap"><table><thead><tr><th>Client</th><th class="r">Entries</th><th class="r">TDS deducted</th><th class="r">Deposited</th><th>Deposit</th><th>Q${q} ${esc(TDS_FORMS['26Q'][tdsNewAct(fy0) ? 1 : 0])}</th><th>Q${q} ${esc(TDS_FORMS['24Q'][tdsNewAct(fy0) ? 1 : 0])}</th>${prevQ ? `<th>Q${prevQ} ${esc(TDS_CERT['26Q'][tdsNewAct(fy0) ? 1 : 0])}</th>` : ''}<th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r.st === 'Overdue' || r.st === 'Short' ? 'overdue' : ''}"><td class="wrap"><b>${esc(r.c.name)}</b><div class="muted small">${esc(r.c.tan || 'TAN not saved')}</div></td>
      <td class="r">${r.n}</td><td class="r">${inr(r.tds)}</td><td class="r">${inr(r.paid)}</td>
      <td><span class="st st-${r.st === 'Paid' || r.st === 'Nil' ? 'filed' : r.st === 'Paid late' || r.st === 'To deposit' ? 'ready-to-file' : r.st === 'No entries' ? 'pending-data' : 'pending-data late'}">${esc(r.st)}</span></td>
      <td class="small">${r.r26 ? esc(r.r26.status) + (r.r26.filed_on ? `<div class="muted">${fmtDate(r.r26.filed_on)}</div>` : '') : '<span class="muted">—</span>'}</td>
      <td class="small">${r.r24 ? esc(r.r24.status) : '<span class="muted">—</span>'}</td>
      ${prevQ ? `<td class="small">${r.prv && r.prv.status === 'Filed' ? (Object.keys(r.prv.certs || {}).length ? Object.keys(r.prv.certs).length + ' issued' : 'Not issued') : '<span class="muted">—</span>'}</td>` : ''}
      <td><button class="btn sm" data-open="${r.c.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`;
  body.onclick = e => { const b = e.target.closest('[data-open]'); if (b) { tdsClient = b.dataset.open; tdsTab = 'ded'; route(); } };
}

/* ---------- 1. deductions grid (one month) ---------- */
function tdsDeductions(body, ctx) {
  const { c, fy0 } = ctx;
  const rows = ctx.grid;
  const F = tdsDedF, filled = r => r.name || r.amount || r.sec;
  // a row belongs to the return form of its section; a row without a section stays on the tab it was typed in
  const vis = r => F === 'all' || (r.sec ? (TDS_BY[r.sec] || {}).f === F : !r._f || r._f === F);
  const visIdx = () => rows.map((r, j) => j).filter(j => vis(rows[j]));
  const show = () => { while (visIdx().length < Math.max(rows.filter(r => vis(r) && filled(r)).length + 5, 10)) rows.push({ rate: '', tds_man: '', _f: F === 'all' ? undefined : F }); };
  show();
  const keep = () => { tdsDraft = { client: c.id, month: tdsMonth, rows }; };
  const secOpts = sel => `<option value=""></option>` + TDS_SEC.filter(s => F === 'all' || s.f === F || s.k === sel).map(s => `<option value="${s.k}" ${s.k === sel ? 'selected' : ''}>${esc(tdsNewAct(fy0) ? `${s.n} [old ${s.o}] · ${s.name}` : `${s.o} [new ${s.n}] · ${s.name}`)}</option>`).join('');
  const cell = (col, v, i) => {
    const [k, , kind] = col;
    if (kind === 'sec') return `<select data-k="${k}" data-i="${i}" style="width:250px">${secOpts(v || '')}</select>`;
    if (Array.isArray(kind)) return `<select data-k="${k}" data-i="${i}"><option value=""></option>${kind.filter(o => o[0]).map(([a, l]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const t = kind === 'date' ? 'date' : 'text';
    return `<input type="${t}" data-k="${k}" data-i="${i}" value="${esc(v ?? '')}" class="${kind === 'num' ? 'r' : kind === 'pan' ? 'up' : ''}" style="width:${col[3]}px" ${kind === 'num' ? 'inputmode="decimal"' : ''}>`;
  };
  const autoCells = x => x ? `<td class="g1-auto r">${x.rate == null ? '—' : x.rate + '%'}</td><td class="g1-auto r"><b>${inr(x.tds)}</b></td><td class="g1-auto r">${inr(x.before)}</td><td class="g1-auto g1-chk ${x.ok ? (x.warn.length ? '' : 'ok') : 'bad'}">${x.ok ? (x.warn.length ? '⚠ ' + esc(x.warn.join('; ')) : '✓') : '✗ ' + esc(x.err.join('; '))}</td>`
    : '<td class="g1-auto"></td><td class="g1-auto"></td><td class="g1-auto"></td><td class="g1-auto"></td>';
  const calc = () => tdsCalcRows(tdsYearRows(ctx));
  const summary = cl => {
    const m = new Map();
    rows.forEach(r => { const x = cl.get(r); if (!x || !x.s) return; const g = m.get(x.s.k) || { s: x.s, n: 0, amt: 0, tds: 0 }; g.n++; g.amt += num(r.amount); g.tds += x.tds; m.set(x.s.k, g); });
    const L = [...m.values()].sort((a, b) => TDS_SEC.indexOf(a.s) - TDS_SEC.indexOf(b.s));
    const bad = rows.filter(r => cl.get(r) && !cl.get(r).ok).length, warn = rows.filter(r => cl.get(r) && cl.get(r).ok && cl.get(r).warn.length).length;
    return `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">Section-wise working – ${esc(monthLabel(tdsMonth))}</h3>
      ${L.length ? `<div class="table-wrap"><table><thead><tr><th>Section</th><th>Nature</th><th class="r">Entries</th><th class="r">Amount</th><th class="r">TDS</th><th>Return</th></tr></thead><tbody>
        ${L.map(g => `<tr><td><b>${esc(tdsSecShort(g.s, fy0))}</b></td><td class="small">${esc(g.s.name)}</td><td class="r">${g.n}</td><td class="r">${inr(g.amt)}</td><td class="r"><b>${inr(g.tds)}</b></td><td class="small">${g.s.f === '141' ? 'Form 141 (old 26QB/QC/QD)' : esc(tdsFormName(g.s.f, fy0))}</td></tr>`).join('')}
        <tr><td colspan="3"><b>Total</b></td><td class="r"><b>${inr(L.reduce((s, g) => s + g.amt, 0))}</b></td><td class="r"><b>${inr(L.reduce((s, g) => s + g.tds, 0))}</b></td><td></td></tr></tbody></table></div>
        <p class="small muted">${bad ? `<span class="late">${bad} row${bad > 1 ? 's' : ''} with errors (✗) — fix before the return.</span> ` : ''}${warn ? `${warn} row${warn > 1 ? 's' : ''} to check (⚠). ` : ''}Deposit by <b>${fmtDate(tdsPayDue(tdsMonth))}</b>.</p>` : '<p class="muted">No entries yet.</p>'}</div>`;
  };
  const draw = () => {
    show();
    const cl = calc();
    const cnt = f => rows.filter(r => filled(r) && (f === 'all' || (TDS_BY[r.sec] || {}).f === f)).length;
    body.innerHTML = `<div class="seg tds-ftabs" role="tablist">${[['all', 'All entries'], ...Object.keys(TDS_FORMS).map(f => [f, tdsFormTab(f, fy0)])].map(([f, l]) => `<button type="button" data-df="${f}" class="${f === F ? 'on' : ''}">${esc(l)} <small>${cnt(f)}</small></button>`).join('')}</div>
      ${F === '27EQ' ? '<p class="muted small">TCS: one row per sale / receipt. Name and PAN are the buyer’s; the amount is the sale value or amount received; the TCS fills in from the section. No PAN = twice the rate or 5%, whichever is higher. TCS is deposited by the 7th of the next month (March too); interest is 1% a month.</p>' : ''}
      <div class="g1-bar"><span class="${tdsDirty ? 'late' : 'muted'} small" id="tdsDirty">${tdsDirty ? '● Unsaved changes' : 'Saved'}</span><span class="spacer"></span>
        <button class="btn sm" id="tdsCopy">Copy deductees from last month</button><button class="btn sm" id="tdsTpl">Excel template</button>
        <label class="btn sm">Import Excel / CSV<input type="file" id="tdsImp" accept=".xlsx,.xls,.csv" hidden></label>
        <button class="btn sm" id="tdsXl">Download Excel</button><button class="btn primary" id="tdsSave">Save</button></div>
      <p class="muted small">One row per payment or credit to a deductee. Rate and TDS fill in from the section, deductee type and PAN (no PAN = higher rate); type a rate or TDS only to override. <b>Tip:</b> copy rows from Excel and paste into the first cell — they fill across.</p>
      <div class="table-wrap g1-wrap"><table class="g1-grid"><thead><tr><th>#</th>${TDS_COLS.map(([k, l, , w]) => `<th style="min-width:${Math.min(w, 140)}px">${esc(F === '27EQ' ? TCS_LBL[k] || l : l)}</th>`).join('')}<th class="g1-auto">Rate used</th><th class="g1-auto">${F === '27EQ' ? 'TCS' : 'TDS'}</th><th class="g1-auto">Paid earlier in FY</th><th class="g1-auto">Check</th><th></th></tr></thead>
      <tbody>${visIdx().map((i, pos) => [rows[i], i, pos]).map(([r, i, pos]) => `<tr data-row="${i}"><td class="muted small">${pos + 1}</td>${TDS_COLS.map(col => `<td>${cell(col, r[col[0]], i)}</td>`).join('')}${autoCells(cl.get(r))}<td><button class="link small danger-t" data-del="${i}" aria-label="Remove row" title="Remove row">×</button></td></tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:8px"><button class="btn sm" id="tdsAdd">+ 10 rows</button><span class="muted small">Blank rows are ignored.</span></div>
      <div id="tdsSum">${summary(cl)}</div>`;
  };
  let tm;
  const refresh = () => { clearTimeout(tm); tm = setTimeout(() => {
    const cl = calc();
    $$('tbody tr[data-row]', body).forEach(tr => { const r = rows[+tr.dataset.row]; const tmp = document.createElement('tr'); tmp.innerHTML = autoCells(cl.get(r)); const cells = $$('.g1-auto', tr);
      $$('td', tmp).forEach((td, j) => { if (cells[j]) { cells[j].className = td.className; cells[j].innerHTML = td.innerHTML; } }); });
    const s = $('#tdsSum', body); if (s) s.innerHTML = summary(cl);
  }, 200); };
  const dirty = () => { tdsDirty = true; keep(); const d = $('#tdsDirty', body); if (d) { d.textContent = '● Unsaved changes'; d.className = 'late small'; } };
  const setVal = (i, k, val) => {
    const col = TDS_COLS.find(x => x[0] === k); if (!col || !rows[i]) return;
    let x = typeof val === 'string' ? val.trim() : val;
    if (col[2] === 'num') x = x === '' ? '' : num(x);
    if (col[2] === 'pan') x = String(x).toUpperCase();
    if (col[2] === 'date' && x) x = anyDate(x) || '';
    if (col[2] === 'sec') x = parseTdsSec(x);
    if (Array.isArray(col[2]) && x) { const m = col[2].find(([a, l]) => lc(a) === lc(x) || lc(l) === lc(x) || lc(l).startsWith(lc(x))); x = m ? m[0] : ''; }
    rows[i][k] = x;
    if (F !== 'all' && !rows[i].sec) { rows[i]._f = F; if (F === '24Q' && k !== 'sec' && x !== '') rows[i].sec = '192'; }
    if (k === 'pan' && x && !rows[i].dtype) rows[i].dtype = panType(x);
  };
  body.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; setVal(+e.target.dataset.i, k, e.target.value); dirty(); refresh(); });
  body.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; const i = +e.target.dataset.i; setVal(i, k, e.target.value); dirty();
    if (k === 'pan') { const sel = $(`[data-k="dtype"][data-i="${i}"]`, body); if (sel) sel.value = rows[i].dtype || ''; }
    if (k !== 'sec') { const ss = $(`[data-k="sec"][data-i="${i}"]`, body); if (ss && rows[i].sec && !ss.value) ss.value = rows[i].sec; }
    refresh(); });
  body.addEventListener('paste', e => {
    const inp = e.target.closest('[data-k]'); if (!inp) return;
    const text = (e.clipboardData || window.clipboardData).getData('text'); if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').split('\n').filter((l, j, a) => l !== '' || j < a.length - 1);
    const V = visIdx(), p0 = Math.max(0, V.indexOf(+inp.dataset.i)), c0 = TDS_COLS.findIndex(x => x[0] === inp.dataset.k);
    lines.forEach((ln, di) => { let i = V[p0 + di]; if (i == null) { rows.push({ rate: '', tds_man: '', _f: F === 'all' ? undefined : F }); i = rows.length - 1; V.push(i); }
      ln.split('\t').forEach((val, dj) => { const col = TDS_COLS[c0 + dj]; if (col) setVal(i, col[0], val); }); });
    dirty(); draw(); toast(`${lines.length} row${lines.length > 1 ? 's' : ''} pasted`);
  });
  body.addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (del) { rows.splice(+del.dataset.del, 1); dirty(); draw(); return; }
    const id = e.target.id;
    if (id === 'tdsAdd') { for (let j = 0; j < 10; j++) rows.push({ rate: '', tds_man: '', _f: F === 'all' ? undefined : F }); keep(); draw(); }
    const df = e.target.closest('[data-df]');
    if (df) { tdsDedF = df.dataset.df; keep(); route(); return; }
    if (id === 'tdsCopy') {
      const pm = addMonths(tdsMonth + '-01', -1).slice(0, 7), prev = tdsMonthOf(ctx, pm);
      if (!prev.length) { toast(`No entries in ${monthLabel(pm)} to copy`, true); return; }
      const have = new Set(rows.filter(r => r.name).map(r => lc(r.name) + '|' + r.sec));
      const add = prev.filter(r => !have.has(lc(r.name) + '|' + r.sec)).map(r => ({ name: r.name, pan: r.pan, dtype: r.dtype, sec: r.sec, rate: r.rate ?? '', tds_man: '', amount: r.sec === '194I-LB' || r.sec === '194I-PM' || r.sec === '192' ? r.amount : '', paid_on: '' }));
      const filled = rows.filter(r => r.name || r.amount || r.sec); rows.length = 0; rows.push(...filled, ...add);
      dirty(); draw(); toast(`${add.length} deductee${add.length === 1 ? '' : 's'} copied — fill in dates and amounts`);
    }
    if (id === 'tdsTpl') tdsTemplate();
    if (id === 'tdsXl') tdsMonthExcel(ctx, rows, calc());
    if (id === 'tdsSave') {
      const btn = e.target; btn.disabled = true;
      try { await tdsSaveMonth(ctx, rows, calc()); tdsDirty = false; tdsDraft = null; toast('TDS entries saved'); route(); }
      catch (err) { toast(friendly(err), true); btn.disabled = false; }
    }
  });
  body.addEventListener('change', async e => {
    if (e.target.id !== 'tdsImp' || !e.target.files[0]) return;
    try {
      const got = await tdsImport(e.target.files[0]);
      if (!got.ok.length) { toast('No rows found in the file' + (got.bad.length ? ' — ' + got.bad[0] : ''), true); return; }
      const out = got.ok.filter(r => r.paid_on && r.paid_on.slice(0, 7) !== tdsMonth);
      const filled = rows.filter(r => r.name || r.amount || r.sec); rows.length = 0; rows.push(...filled, ...got.ok.filter(r => !out.includes(r)));
      dirty(); draw();
      toast(`${got.ok.length - out.length} row${got.ok.length - out.length === 1 ? '' : 's'} added${out.length ? ` · ${out.length} dated outside ${monthLabel(tdsMonth)} left out` : ''}${got.bad.length ? ` · ${got.bad.length} not read` : ''} — check and Save`);
    } catch (err) { toast(friendly(err), true); }
  });
  draw();
}
async function tdsSaveMonth(ctx, rows, cl) {
  const keepRows = rows.filter(r => r.name || r.amount || r.sec);
  const recs = keepRows.map((r, i) => { const x = cl.get(r) || {};
    return { id: r.id || newId(), client_id: ctx.c.id, fy: ctx.fyk, month: tdsMonth + '-01', line: i + 1, paid_on: r.paid_on || null, name: r.name || null, pan: (r.pan || '').toUpperCase() || null,
      dtype: r.dtype || panType(r.pan) || null, sec: r.sec || null, amount: num(r.amount), reason: x.reason || r.reason || null, rate: r.rate === '' || r.rate == null ? null : num(r.rate),
      tds_man: r.tds_man === '' || r.tds_man == null ? null : num(r.tds_man), tds: x.tds || 0, ded_on: r.ded_on || null, cert: r.cert || null, bill: r.bill || null, remarks: r.remarks || null }; });
  const before = ctx.all.filter(r => r.month.slice(0, 7) === tdsMonth).map(r => r.id);
  if (recs.length) await must(sb.from('tds_entries').upsert(recs));
  const gone = before.filter(id => !recs.some(r => r.id === id));
  if (gone.length) await must(sb.from('tds_entries').delete().in('id', gone));
}
const TDS_HEAD = ['Date paid / credited', 'Deductee name', 'PAN', 'Type (Individual / Company / Firm)', 'Section (old e.g. 194C, or new e.g. 393(1) Sl. 6(i))', 'Amount', 'Reason (A/B/C/T/Y or blank)', 'Rate % (blank = auto)', 'TDS (blank = auto)', 'Deducted on', 'Lower-deduction cert. no.', 'Bill / voucher no.', 'Remarks'];
async function tdsTemplate() {
  const X = await loadXlsxFull(), wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet([TDS_HEAD, ['05/10/2026', 'Sri Murugan Transports', 'AAAPM1234K', 'Individual', '194C', 45000, '', '', '', '', '', 'INV-112', ''],
    ['10/10/2026', 'Kumar & Associates', 'AAAFK5678L', 'Firm', '194J(b)', 60000, '', '', '', '', '', '', 'Audit fees'], ['01/10/2026', 'R. Lakshmi (landlord)', 'ABCPL4321M', 'Individual', '194-I(b)', 75000, '', '', '', '', '', '', 'Office rent']]);
  ws['!cols'] = TDS_HEAD.map((h, i) => ({ wch: [12, 28, 13, 14, 26, 12, 10, 9, 10, 12, 16, 14, 18][i] }));
  X.utils.book_append_sheet(wb, ws, 'TDS entries');
  const sec = X.utils.aoa_to_sheet([['Old section (1961 Act)', 'New section (2025 Act)', 'Nature of payment', 'Rate', 'Return'], ...TDS_SEC.map(s => [s.o, s.n, s.name, s.r == null ? 'type it' : typeof s.r === 'number' ? s.r + '%' : Object.values(s.r).join('/') + '%', s.f === '141' ? 'Form 141' : `${TDS_FORMS[s.f][0]} / Form ${TDS_FORMS[s.f][1]}`])]);
  sec['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 52 }, { wch: 10 }, { wch: 14 }];
  X.utils.book_append_sheet(wb, sec, 'Sections');
  const help = X.utils.aoa_to_sheet([['How to fill'], ['One row per payment / credit. Delete the sample rows first.'], ['Dates: dd/mm/yyyy. Section: old (194C, 194J(b), 194-I(b)…) or new (393(1) Sl. 6(i)…) — see the Sections sheet. "194J" alone = professional fees, "194I" = rent of land/building.'],
    ['Reason: A = lower/nil deduction certificate · B = 15G/15H · C = no PAN (higher rate) · T = transporter declaration (194C) · Y = below threshold.'], ['Leave Rate and TDS blank — the tracker works them out. Salary (192 / 392) and non-resident (195 / 393(2)): type the TDS.']]);
  help['!cols'] = [{ wch: 110 }];
  X.utils.book_append_sheet(wb, help, 'Help');
  X.writeFile(wb, 'tds-entries-template.xlsx');
}
async function tdsImport(file) {
  const sheets = await readSheets(file);
  const sh = sheets.find(s => s.rows.some(r => r.some(x => /deductee/i.test(String(x))))) || sheets[0];
  const hi = sh.rows.findIndex(r => r.some(x => /deductee|section/i.test(String(x))));
  const H = (sh.rows[hi] || []).map(x => lc(String(x)));
  const col = re => H.findIndex(h => re.test(h));
  const ix = { paid_on: col(/^date|paid|credit/), name: col(/deductee|name|party/), pan: col(/^pan/), dtype: col(/type/), sec: col(/section|sec/), amount: col(/^amount|amount paid|gross/),
    reason: col(/reason/), rate: col(/rate/), tds_man: col(/^tds/), ded_on: col(/deducted on/), cert: col(/cert/), bill: col(/bill|voucher|invoice/), remarks: col(/remark/) };
  const ok = [], bad = [];
  sh.rows.slice(hi + 1).forEach((r, j) => {
    const get = k => ix[k] >= 0 ? r[ix[k]] : '';
    if (!String(get('name')).trim() && !num(get('amount'))) return;
    const xd = v => { if (v === '' || v == null) return ''; if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10); return anyDate(v) || ''; };
    const sec = parseTdsSec(get('sec')), tp = lc(String(get('dtype')));
    const row = { paid_on: xd(get('paid_on')), name: String(get('name')).trim(), pan: String(get('pan')).toUpperCase().trim(), dtype: /comp/.test(tp) ? 'CO' : /ind|huf/.test(tp) ? 'IND' : tp ? 'OTH' : '', sec,
      amount: num(get('amount')), reason: String(get('reason')).trim().toUpperCase().slice(0, 1), rate: get('rate') === '' ? '' : num(get('rate')), tds_man: get('tds_man') === '' ? '' : num(get('tds_man')),
      ded_on: xd(get('ded_on')), cert: String(get('cert')).trim(), bill: String(get('bill')).trim(), remarks: String(get('remarks')).trim() };
    if (!row.dtype) row.dtype = panType(row.pan);
    if (!['', 'A', 'B', 'C', 'T', 'Y'].includes(row.reason)) row.reason = '';
    if (!sec) bad.push(`Row ${hi + j + 2}: section "${get('sec')}" not understood`);
    ok.push(row);
  });
  return { ok, bad };
}
async function tdsMonthExcel(ctx, rows, cl) {
  const X = await loadXlsxFull(), wb = X.utils.book_new(), fy0 = ctx.fy0;
  const L = rows.filter(r => r.name || r.amount || r.sec).map(r => { const x = cl.get(r) || {}, s = x.s;
    return [r.paid_on || '', r.name || '', r.pan || '', (TDS_TYPES.find(t => t[0] === x.type) || [, ''])[1], s ? s.o : '', s ? s.n : '', s ? s.name : '', num(r.amount), x.reason || '', x.rate ?? '', x.tds || 0, r.ded_on || r.paid_on || '', r.cert || '', r.bill || '', r.remarks || '', x.ok ? (x.warn || []).join('; ') : (x.err || []).join('; ')]; });
  const ws = X.utils.aoa_to_sheet([['Date', 'Deductee', 'PAN', 'Type', 'Old section', 'New section', 'Nature', 'Amount', 'Reason', 'Rate %', 'TDS', 'Deducted on', 'Cert no', 'Bill no', 'Remarks', 'Check'], ...L]);
  X.utils.book_append_sheet(wb, ws, 'Entries');
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Client', ctx.c.name], ['TAN', ctx.c.tan || ''], ['Month', monthLabel(tdsMonth)], ['Deposit due', tdsPayDue(tdsMonth)], [], ['Old section', 'New section', 'Nature', 'Amount', 'TDS'],
    ...TDS_SEC.map(s => { const m = rows.filter(r => r.sec === s.k && cl.get(r)); return m.length ? [s.o, s.n, s.name, m.reduce((a, r) => a + num(r.amount), 0), m.reduce((a, r) => a + cl.get(r).tds, 0)] : null; }).filter(Boolean)]), 'Section-wise');
  X.writeFile(wb, `TDS-${slug(ctx.c.name)}-${tdsMonth}.xlsx`);
  void fy0;
}

/* ---------- 2. challans (one month) ---------- */
function tdsChallans(body, ctx) {
  const { c, fy0 } = ctx, ym = tdsMonth, due = tdsPayDue(ym);
  const ent = tdsMonthOf(ctx, ym), cl = tdsCalcRows(tdsYearRows(ctx));
  const secs = [...new Set([...ent.filter(r => cl.get(r) && cl.get(r).tds > 0).map(r => r.sec), ...ctx.challans.filter(x => x.month.slice(0, 7) === ym).map(x => x.sec)])].filter(Boolean)
    .sort((a, b) => TDS_SEC.findIndex(s => s.k === a) - TDS_SEC.findIndex(s => s.k === b));
  const rowsOf = k => ent.filter(r => r.sec === k);
  const draw = () => {
    const data = secs.map(k => { const s = TDS_BY[k], x = ctx.challans.find(y => y.month.slice(0, 7) === ym && y.sec === k) || {}, e = rowsOf(k);
      const work = e.reduce((a, r) => a + (cl.get(r) ? cl.get(r).tds : 0), 0), it = tdsInterest(e, cl, ym, x.paid_on || (today() > due ? today() : null));
      const st = !x.paid_on ? (today() > due ? 'Overdue' : 'Not paid') : num(x.tds) + 0.5 < work ? `Short ${inr(work - num(x.tds))}` : x.paid_on > due ? (num(x.intr) + 0.5 < it.total ? 'Paid late – interest short' : 'Paid late') : 'Paid';
      return { k, s, x, work, it, st }; });
    const tw = data.reduce((a, d) => a + d.work, 0), tp = data.reduce((a, d) => a + (d.x.paid_on ? num(d.x.tds) : 0), 0);
    body.innerHTML = `<div class="bento-stats card stats4" style="margin-bottom:14px"><div class="mini blue"><span>TDS as per working</span><b class="tp-amt">${inr(tw)}</b></div>
        <div class="mini green"><span>Deposited</span><b class="tp-amt">${inr(tp)}</b></div><div class="mini ${tw - tp > 0.5 ? 'red' : ''}"><span>Balance to deposit</span><b class="tp-amt">${inr(Math.max(0, tw - tp))}</b></div>
        <div class="mini amber"><span>Due date</span><b class="tp-amt">${fmtDate(due)}</b></div></div>
      <p class="muted small" style="margin:-4px 2px 10px">One challan per section (nature of payment). Interest is worked out on each entry: 1% a month for late deduction and 1.5% a month for late deposit (part of a month = full month) — old sec 201(1A). ${tdsNewAct(fy0) ? 'Use the payment code on the e-Pay Tax challan (2025 Act).' : ''}</p>
      ${data.length ? `<div class="table-wrap"><table class="tp-t"><thead><tr><th>Section</th><th class="r">TDS as per working</th><th class="r">Interest (worked out)</th><th class="r">TDS paid</th><th class="r">Interest paid</th><th class="r">Late fee / others</th><th>Paid on</th><th>BSR code</th><th>Challan no.</th><th>Status</th><th></th></tr></thead><tbody>
        ${data.map((d, i) => `<tr data-i="${i}" class="${/Overdue|Short/.test(d.st) ? 'overdue' : ''}"><td class="wrap"><b>${esc(tdsSecShort(d.s, fy0))}</b><div class="muted small">${esc(d.s.name)}${d.s.code ? ' · code ' + esc(d.s.code) : ''}</div></td>
          <td class="r"><b>${inr(d.work)}</b></td><td class="r small">${d.it.total ? inr(d.it.total) + `<div class="muted">${d.it.i1 ? 'deduction ' + inr(d.it.i1) : ''}${d.it.i1 && d.it.i2 ? ' + ' : ''}${d.it.i2 ? 'deposit ' + inr(d.it.i2) : ''}</div>` : '—'}</td>
          <td class="r"><input class="tp-in" type="number" min="0" data-f="tds" value="${esc(d.x.tds ?? (d.x.id ? '' : d.work))}"></td><td class="r"><input class="tp-in" type="number" min="0" data-f="intr" value="${esc(d.x.intr ?? (d.it.total || ''))}"></td>
          <td class="r"><input class="tp-in" type="number" min="0" data-f="fee" value="${esc(d.x.fee ?? '')}"></td><td><input type="date" data-f="paid_on" value="${esc(d.x.paid_on || '')}"></td>
          <td><input data-f="bsr" value="${esc(d.x.bsr || '')}" maxlength="7" style="width:80px" placeholder="7 digits"></td><td><input data-f="chno" value="${esc(d.x.chno || '')}" style="width:80px"></td>
          <td class="small"><span class="st st-${d.st === 'Paid' ? 'filed' : /late/.test(d.st) ? 'ready-to-file' : 'pending-data'}">${esc(d.st)}</span></td>
          <td class="row-btns"><button class="btn sm primary" data-save="${i}">Save</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="table-wrap"><div class="empty">No TDS in the working for this month. Add entries on the Deductions tab first.</div></div>'}
      <div class="toolbar" style="margin-top:12px"><button class="btn" id="tdsTp">Send TDS payment intimation to client →</button><span class="muted small">Opens Tax payment intimation with this month's TDS filled in from the working.</span></div>`;
    body.onclick = async e => {
      if (e.target.id === 'tdsTp') { tpTab = 'TDS'; tpMonth = ym; location.hash = '#/taxpay'; return; }
      const b = e.target.closest('[data-save]'); if (!b) return;
      const tr = b.closest('tr'), d = data[+b.dataset.save], f = k => { const el = $(`[data-f="${k}"]`, tr); return el ? el.value.trim() : ''; };
      if (f('bsr') && !/^\d{7}$/.test(f('bsr'))) { toast('BSR code is 7 digits', true); return; }
      b.disabled = true;
      try {
        const rec = { client_id: c.id, month: ym + '-01', sec: d.k, tds: num(f('tds')), intr: num(f('intr')), fee: num(f('fee')), paid_on: f('paid_on') || null, bsr: f('bsr') || null, chno: f('chno') || null };
        const { data: saved } = await must(sb.from('tds_challans').upsert(rec, { onConflict: 'client_id,month,sec' }).select().single());
        ctx.challans = [...ctx.challans.filter(y => y.id !== saved.id), saved]; toast('Challan saved'); draw();
      } catch (err) { toast(friendly(err), true); b.disabled = false; }
    };
  };
  draw();
}

/* ---------- 3. quarterly return prep ---------- */
function tdsReturnData(ctx, q, form) {
  const ms = tdsQMonths(ctx.fy0, q), cl = tdsCalcRows(tdsYearRows(ctx));
  const byM = ms.map(m => [m, tdsMonthOf(ctx, m).filter(r => { const s = TDS_BY[r.sec]; return s && s.f === form; })]);
  const ent = byM.flatMap(([, e]) => e);
  const ch = ctx.challans.filter(x => ms.includes(x.month.slice(0, 7)) && TDS_BY[x.sec] && TDS_BY[x.sec].f === form);
  const checks = [];
  ent.forEach(r => { const x = cl.get(r); if (x && !x.ok) checks.push(['err', `${r.name || '(no name)'} ${fmtDate(r.paid_on)}: ${x.err.join('; ')}`]); });
  const noPan = ent.filter(r => !PAN_RE.test(String(r.pan || '').toUpperCase())).length;
  if (noPan) checks.push(['warn', `${noPan} deductee row${noPan > 1 ? 's' : ''} without a valid PAN — higher rate applied; the deductee gets no credit until PAN is given.`]);
  const groups = [];
  byM.forEach(([m, em]) => [...new Set(em.map(r => r.sec))].sort((a, b) => TDS_SEC.findIndex(s => s.k === a) - TDS_SEC.findIndex(s => s.k === b)).forEach(k => {
    const e = em.filter(r => r.sec === k);
    const work = e.reduce((a, r) => a + (cl.get(r) ? cl.get(r).tds : 0), 0), x = ch.find(y => y.month.slice(0, 7) === m && y.sec === k);
    const it = tdsInterest(e, cl, m, x && x.paid_on);
    groups.push({ m, k, s: TDS_BY[k], e, work, x, it });
    if (work > 0 && (!x || !x.paid_on)) checks.push(['err', `${monthLabel(m)} ${TDS_BY[k].o}/${TDS_BY[k].n}: TDS ${inr(work)} not deposited (no paid challan).`]);
    else if (x && num(x.tds) + 0.5 < work) checks.push(['err', `${monthLabel(m)} ${TDS_BY[k].o}/${TDS_BY[k].n}: challan ${inr(x.tds)} is less than TDS ${inr(work)} — short ${inr(work - num(x.tds))}.`]);
    if (x && x.paid_on && (!x.bsr || !x.chno)) checks.push(['err', `${monthLabel(m)} ${TDS_BY[k].o}: BSR code / challan no. missing.`]);
    if (x && it.total > num(x.intr) + 0.5) checks.push(['warn', `${monthLabel(m)} ${TDS_BY[k].o}: interest ${inr(it.total)} worked out, ${inr(x.intr)} paid.`]);
  }));
  const due = tdsRetDue(ctx.fy0, q, form), rec = ctx.returns.find(x => x.q === q && x.form === form) || null;
  const totTds = groups.reduce((a, g) => a + g.work, 0);
  const lateDays = Math.max(0, daysFrom(due, (rec && rec.filed_on) || today()));
  const lateFee = rec && rec.status === 'Filed' && !rec.filed_on ? 0 : Math.min(lateDays * 200, totTds);
  if (!ctx.c.tan) checks.push(['err', 'TAN not saved on the client.']);
  return { ms, ent, ch, groups, checks, due, rec, totTds, lateDays, lateFee, cl };
}
function tdsReturn(body, ctx) {
  const { c, fy0 } = ctx, q = tdsQ;
  const counts = Object.keys(TDS_FORMS).map(f => [f, tdsReturnData(ctx, q, f).ent.length]);
  if (!counts.some(([f]) => f === tdsForm)) tdsForm = '26Q';
  const D = tdsReturnData(ctx, q, tdsForm), rec = D.rec || {};
  const filed = rec.status === 'Filed' || rec.status === 'Revised';
  body.innerHTML = `<div class="toolbar"><div class="seg">${[1, 2, 3, 4].map(k => `<button data-q="${k}" class="${k === q ? 'on' : ''}">Q${k}</button>`).join('')}</div>
      <div class="seg">${counts.map(([f, n]) => `<button data-f="${f}" class="${f === tdsForm ? 'on' : ''}">${esc(tdsFormTab(f, fy0))} <small>${n}</small></button>`).join('')}</div></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px"><div class="mini blue"><span>Deductee rows</span><b>${D.ent.length}</b></div><div class="mini"><span>TDS in the quarter</span><b class="tp-amt">${inr(D.totTds)}</b></div>
      <div class="mini ${!D.ent.length ? '' : D.checks.some(x => x[0] === 'err') ? 'red' : 'green'}"><span>Checks</span><b>${!D.ent.length ? '—' : D.checks.filter(x => x[0] === 'err').length ? D.checks.filter(x => x[0] === 'err').length + ' ✗' : '✓'}</b></div>
      <div class="mini ${!filed && today() > D.due ? 'red' : 'amber'}"><span>Due date</span><b class="tp-amt">${fmtDate(D.due)}</b></div></div>
    <div class="card"><h3 style="margin-top:0">${esc(tdsFormName(tdsForm, fy0))} – Q${q} FY ${esc(ctx.fyk)} · ${esc(TDS_FORMS[tdsForm][2])}</h3>
      ${!D.ent.length ? '<p class="small muted">No deductee entries for this form in the quarter — nothing to file, unless the client wants a nil statement.</p>' : D.checks.length ? `<ul class="small" style="margin:0 0 10px;padding-left:18px">${D.checks.map(([k, t]) => `<li class="${k === 'err' ? 'late' : ''}">${k === 'err' ? '✗' : '⚠'} ${esc(t)}</li>`).join('')}</ul>` : '<p class="small" style="color:var(--green)">✓ All checks passed — ready to prepare in the RPU / your TDS software.</p>'}
      ${!filed && D.lateDays > 0 && D.totTds > 0 ? `<p class="note warn small">Filed after the due date: late fee ₹200 a day = ${inr(D.lateFee)} so far (up to the TDS amount) — old sec 234E${tdsNewAct(fy0) ? ', new sec 427' : ''}.</p>` : ''}
      ${D.groups.length ? `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Section</th><th class="r">Rows</th><th class="r">Amount</th><th class="r">TDS</th><th class="r">Challan TDS</th><th class="r">Interest paid</th><th>Paid on</th><th>BSR · Challan</th></tr></thead><tbody>
        ${D.groups.map(g => `<tr><td>${esc(monthLabel(g.m))}</td><td><b>${esc(tdsSecShort(g.s, fy0))}</b></td><td class="r">${g.e.length}</td><td class="r">${inr(g.e.reduce((a, r) => a + num(r.amount), 0))}</td><td class="r"><b>${inr(g.work)}</b></td>
          <td class="r">${g.x ? inr(g.x.tds) : '—'}</td><td class="r">${g.x ? inr(g.x.intr) : '—'}</td><td>${g.x && g.x.paid_on ? fmtDate(g.x.paid_on) : '<span class="late">not paid</span>'}</td><td class="small">${g.x ? esc([g.x.bsr, g.x.chno].filter(Boolean).join(' · ')) : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="toolbar" style="margin-top:12px"><button class="btn" id="tdsRx">Download return prep (Excel)</button><span class="muted small">Challan and deductee sheets in the order the RPU asks for, with old and new sections and the checks.</span></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Filing status</h3>
      <div class="form-grid"><label>Status<select name="st">${opts(TDS_STATUS, rec.status || 'Not started')}</select></label><label>Filed on<input type="date" name="on" value="${esc(rec.filed_on || '')}"></label>
        <label>Token / acknowledgement no.<input name="tk" value="${esc(rec.token || '')}" maxlength="20"></label><label>Late fee paid (₹)<input type="number" name="lf" value="${esc(rec.late_fee ?? '')}"></label>
        <label class="full">Remarks<input name="rm" value="${esc(rec.remarks || '')}"></label></div>
      <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="tdsRs">Save status</button><span class="muted small">Marking Filed also closes the matching TDS work item (${esc(TDS_FORMS[tdsForm][0])} / Form ${esc(TDS_FORMS[tdsForm][1])}, Q${q} FY ${esc(ctx.fyk)}) with the token no.</span></div></div>`;
  $$('[data-q]', body).forEach(b => b.onclick = () => { tdsQ = +b.dataset.q; route(); });
  $$('[data-f]', body).forEach(b => b.onclick = () => { tdsForm = b.dataset.f; route(); });
  $('#tdsRx', body).onclick = () => tdsReturnExcel(ctx, D, q).catch(err => toast(friendly(err), true));
  $('#tdsRs', body).onclick = async e => {
    const b = e.target, st = fv(body, 'st'), on = fv(body, 'on') || (st === 'Filed' ? today() : '');
    if (st === 'Filed' && D.checks.some(x => x[0] === 'err') && !confirm('Some checks have errors (✗). Mark as filed anyway?')) return;
    b.disabled = true;
    try {
      const r = { client_id: c.id, fy: ctx.fyk, q, form: tdsForm, status: st, filed_on: on || null, token: fv(body, 'tk') || null, late_fee: fv(body, 'lf') === '' ? null : num(fv(body, 'lf')), remarks: fv(body, 'rm') || null };
      if (st === 'Prepared' && !rec.prepared_on) r.prepared_on = today();
      await must(sb.from('tds_returns').upsert(r, { onConflict: 'client_id,fy,q,form' }));
      if (st === 'Filed') { const n = await tdsCloseTask(c, ctx.fyk, q, tdsForm, r); if (n) toast(`Work item marked Filed`); }
      toast('Status saved'); route();
    } catch (err) { toast(friendly(err), true); b.disabled = false; }
  };
}
async function tdsCloseTask(c, fyk, q, form, r) {
  const per = `Q${q} FY ${fyk}`, [o, n] = TDS_FORMS[form];
  const { data } = await must(sb.from('tasks').select('id,return_name,period,status').eq('client_id', c.id).eq('work_type', 'TDS').eq('period', per));
  const hit = (data || []).filter(t => isOpen(t.status) && (t.return_name.includes(o) || new RegExp(`\\b${n}\\b`).test(t.return_name)));
  for (const t of hit) await must(sb.from('tasks').update({ status: 'Filed', filed_on: r.filed_on || today(), arn: r.token || null }).eq('id', t.id));
  return hit.length;
}
async function tdsReturnExcel(ctx, D, q) {
  const X = await loadXlsxFull(), wb = X.utils.book_new(), fy0 = ctx.fy0;
  const chRows = D.groups.filter(g => g.x || g.work > 0);
  const serial = new Map(chRows.map((g, i) => [g.m + '|' + g.k, i + 1]));
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Deductor', ctx.c.name], ['TAN', ctx.c.tan || ''], ['PAN', ctx.c.pan || ''], ['Return', tdsFormName(tdsForm, fy0)], ['Quarter', `Q${q} FY ${ctx.fyk}`], ['Due date', D.due], ['Deductee rows', D.ent.length], ['TDS', D.totTds],
    ['Prepared by', me.full_name || me.email], ['Prepared on', today()], [], ['Checks'], ...(D.checks.length ? D.checks.map(([k, t]) => [k === 'err' ? 'ERROR' : 'Check', t]) : [['OK', 'All checks passed']])]), 'Summary');
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Challan serial', 'Month', 'Old section', 'New section', 'Payment code', 'TDS', 'Surcharge', 'Cess', 'Interest', 'Fee', 'Others', 'Total', 'BSR code', 'Date of deposit', 'Challan serial no.', 'TDS as per working'],
    ...chRows.map((g, i) => { const x = g.x || {}; return [i + 1, monthLabel(g.m), g.s.o, g.s.n, g.s.code, num(x.tds), 0, 0, num(x.intr), num(x.fee), 0, num(x.tds) + num(x.intr) + num(x.fee), x.bsr || '', x.paid_on || '', x.chno || '', g.work]; })]), 'Challans');
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Challan serial', 'Old section', 'New section', 'PAN', 'Deductee name', 'Deductee type', 'Date paid / credited', 'Amount paid / credited', 'Rate %', 'TDS', 'Surcharge', 'Cess', 'Total tax deducted', 'Total tax deposited', 'Date of deduction', 'Reason code', 'Certificate no. (lower deduction)', 'Bill / voucher no.'],
    ...D.groups.flatMap(g => g.e.map(r => { const x = D.cl.get(r) || {}; return [serial.get(g.m + '|' + g.k) || '', g.s.o, g.s.n, PAN_RE.test(String(r.pan || '').toUpperCase()) ? r.pan.toUpperCase() : 'PANNOTAVBL', r.name || '', (TDS_TYPES.find(t => t[0] === x.type) || [, ''])[1],
      r.paid_on || '', num(r.amount), x.rate ?? '', x.tds || 0, 0, 0, x.tds || 0, x.tds || 0, x.ded || '', x.reason || '', r.cert || '', r.bill || '']; }))]), 'Deductees');
  X.writeFile(wb, `${TDS_FORMS[tdsForm][tdsNewAct(fy0) ? 1 : 0].replace(/^(\d)/, 'Form$1')}-Q${q}-${slug(ctx.c.name)}-${ctx.fyk}.xlsx`);
}

/* ---------- 4. Form 16 / 16A (130 / 131) issue tracker ---------- */
function tdsCerts(body, ctx) {
  const { c, fy0 } = ctx, q = tdsQ;
  const form = TDS_CERT[tdsForm] ? tdsForm : '26Q';
  const annual = form === '24Q';
  const ms = annual ? tdsFyMonths(fy0) : tdsQMonths(fy0, q);
  const ent = ms.flatMap(m => tdsMonthOf(ctx, m)).filter(r => TDS_BY[r.sec] && TDS_BY[r.sec].f === form);
  const cl = tdsCalcRows(tdsYearRows(ctx));
  const due = tdsCertDue(fy0, annual ? 4 : q, form);
  const recQ = annual ? 4 : q, rec = ctx.returns.find(x => x.q === recQ && x.form === form) || null;
  const certs = { ...((rec && rec.certs) || {}) };
  const people = new Map();
  ent.forEach(r => { const k = PAN_RE.test(String(r.pan || '').toUpperCase()) ? r.pan.toUpperCase() : 'N:' + lc(r.name); const p = people.get(k) || { k, name: r.name, pan: r.pan, amt: 0, tds: 0 }; p.amt += num(r.amount); p.tds += cl.get(r) ? cl.get(r).tds : 0; people.set(k, p); });
  const L = [...people.values()].filter(p => p.tds > 0).sort((a, b) => lc(a.name).localeCompare(lc(b.name)));
  const nIss = L.filter(p => certs[p.k]).length, late = due && today() > due && nIss < L.length;
  const cname = tdsCertName(form, fy0);
  body.innerHTML = `<div class="toolbar">${annual ? '' : `<div class="seg">${[1, 2, 3, 4].map(k => `<button data-q="${k}" class="${k === q ? 'on' : ''}">Q${k}</button>`).join('')}</div>`}
      <div class="seg">${Object.keys(TDS_CERT).map(f => `<button data-f="${f}" class="${f === form ? 'on' : ''}">${esc(tdsCertName(f, fy0))}${f === '24Q' ? ' – salary (yearly)' : f === '27Q' ? ' – non-resident' : ''}</button>`).join('')}</div></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px"><div class="mini blue"><span>Deductees</span><b>${L.length}</b></div><div class="mini green"><span>Issued</span><b>${nIss}</b></div>
      <div class="mini ${late ? 'red' : 'amber'}"><span>Not issued</span><b>${L.length - nIss}</b></div><div class="mini"><span>Issue by</span><b class="tp-amt">${due ? fmtDate(due) : '—'}</b></div></div>
    <div class="card"><h3 style="margin-top:0">${esc(cname)} – ${annual ? `FY ${esc(ctx.fyk)}` : `Q${q} FY ${esc(ctx.fyk)}`}</h3>
      <p class="muted small">${annual ? `${esc(cname)} is issued once a year to each employee by 15 June after the year, after the Q4 ${esc(tdsFormName('24Q', fy0))} is processed.` : `${esc(cname)} is issued every quarter, within 15 days of the return due date.`} Download from TRACES (Downloads → requested certificates), then mark each one issued. Late issue: penalty ₹100 a day (old sec 272A(2)(g)).${rec && rec.status === 'Filed' ? '' : ` <b>The ${esc(tdsFormName(form, fy0))} return for this period is not marked Filed yet.</b>`}</p>
      <div class="form-grid" style="margin-bottom:10px"><label>Downloaded from TRACES on<input type="date" name="dl" value="${esc((rec && rec.cert_dl_on) || '')}"></label></div>
      ${L.length ? `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="cAll" aria-label="Select all"></th><th>Deductee</th><th>PAN</th><th class="r">Amount</th><th class="r">TDS</th><th>Issued on</th><th>Sent by</th></tr></thead><tbody>
        ${L.map((p, i) => { const x = certs[p.k]; return `<tr data-i="${i}"><td><input type="checkbox" data-pick="${i}" aria-label="Select"></td><td class="wrap"><b>${esc(p.name)}</b></td><td>${esc(p.pan || 'no PAN')}</td><td class="r">${inr(p.amt)}</td><td class="r">${inr(p.tds)}</td>
          <td>${x ? `<span class="st st-filed">${fmtDate(x.on)}</span>` : `<span class="${late ? 'late' : 'muted'}">Not issued</span>`}</td><td class="small">${x ? esc(x.via || '') : ''}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="toolbar" style="margin-top:10px"><label class="small">Issued on <input type="date" id="cOn" value="${today()}"></label><select id="cVia">${opts(['Email', 'WhatsApp', 'By hand', 'Courier'], 'Email')}</select>
          <button class="btn primary" id="cMark">Mark selected issued</button><button class="btn ghost" id="cUn">Clear selected</button><span class="spacer"></span><button class="btn sm" id="cCsv">Export CSV</button></div>` : '<p class="muted">No deductees with TDS in this period.</p>'}</div>`;
  $$('[data-q]', body).forEach(b => b.onclick = () => { tdsQ = +b.dataset.q; route(); });
  $$('[data-f]', body).forEach(b => b.onclick = () => { tdsForm = b.dataset.f; route(); });
  const save = async patch => {
    const r = { client_id: c.id, fy: ctx.fyk, q: recQ, form, certs, cert_dl_on: fv(body, 'dl') || null, ...patch };
    if (!rec) r.status = 'Not started';
    await must(sb.from('tds_returns').upsert(r, { onConflict: 'client_id,fy,q,form' })); route();
  };
  const dl = $('[name=dl]', body); if (dl) dl.onchange = () => save({}).catch(err => toast(friendly(err), true));
  if ($('#cAll', body)) $('#cAll', body).onchange = e => $$('[data-pick]', body).forEach(x => { x.checked = e.target.checked; });
  const picked = () => $$('[data-pick]', body).filter(x => x.checked).map(x => L[+x.dataset.pick]);
  if ($('#cMark', body)) $('#cMark', body).onclick = () => { const P = picked(); if (!P.length) { toast('Tick the deductees first', true); return; }
    P.forEach(p => { certs[p.k] = { on: $('#cOn', body).value || today(), via: $('#cVia', body).value, by: me.id }; }); save({}).then(() => toast(`${P.length} marked issued`)).catch(err => toast(friendly(err), true)); };
  if ($('#cUn', body)) $('#cUn', body).onclick = () => { const P = picked(); P.forEach(p => { delete certs[p.k]; }); save({}).catch(err => toast(friendly(err), true)); };
  if ($('#cCsv', body)) $('#cCsv', body).onclick = () => download(`${slug(cname)}-${slug(c.name)}-${annual ? ctx.fyk : 'Q' + q + '-' + ctx.fyk}.csv`, toCSV([['Deductee', 'PAN', 'Amount', 'TDS', 'Issued on', 'Sent by'], ...L.map(p => [p.name, p.pan || '', p.amt, p.tds, (certs[p.k] || {}).on || '', (certs[p.k] || {}).via || ''])]));
}

/* ---------- 5. year view ---------- */
function tdsYear(body, ctx) {
  const { fy0 } = ctx, cl = tdsCalcRows(tdsYearRows(ctx)), ms = tdsFyMonths(fy0);
  const row = m => { const e = tdsMonthOf(ctx, m), ch = ctx.challans.filter(x => x.month.slice(0, 7) === m);
    const tds = e.reduce((a, r) => a + (cl.get(r) ? cl.get(r).tds : 0), 0), paid = ch.reduce((a, x) => a + (x.paid_on ? num(x.tds) : 0), 0), intr = ch.reduce((a, x) => a + num(x.intr), 0);
    const late = ch.some(x => x.paid_on && x.paid_on > tdsPayDue(m)); return { m, n: e.length, tds, paid, intr, late, bad: e.filter(r => cl.get(r) && !cl.get(r).ok).length }; };
  const R = ms.map(row);
  const secTot = TDS_SEC.map(s => { const e = tdsYearRows(ctx).filter(r => r.sec === s.k); return e.length ? { s, amt: e.reduce((a, r) => a + num(r.amount), 0), tds: e.reduce((a, r) => a + (cl.get(r) ? cl.get(r).tds : 0), 0) } : null; }).filter(Boolean);
  body.innerHTML = `<div class="card"><h3 style="margin-top:0">FY ${esc(ctx.fyk)} – month by month</h3><div class="table-wrap"><table><thead><tr><th>Month</th><th class="r">Entries</th><th class="r">TDS</th><th class="r">Deposited</th><th class="r">Interest</th><th>Status</th><th></th></tr></thead><tbody>
    ${R.map(r => `<tr class="${r.tds - r.paid > 0.5 && today() > tdsPayDue(r.m) ? 'overdue' : ''}"><td>${esc(monthLabel(r.m))}</td><td class="r">${r.n}${r.bad ? ` <span class="late">(${r.bad} ✗)</span>` : ''}</td><td class="r">${inr(r.tds)}</td><td class="r">${inr(r.paid)}</td><td class="r">${r.intr ? inr(r.intr) : '—'}</td>
      <td class="small">${!r.n ? '<span class="muted">—</span>' : r.tds - r.paid > 0.5 ? `<span class="late">Balance ${inr(r.tds - r.paid)}</span>` : r.late ? 'Paid late' : '✓ Paid'}</td><td><button class="btn sm" data-m="${r.m}">Open</button></td></tr>`).join('')}
    <tr><td><b>Total</b></td><td class="r"><b>${R.reduce((a, r) => a + r.n, 0)}</b></td><td class="r"><b>${inr(R.reduce((a, r) => a + r.tds, 0))}</b></td><td class="r"><b>${inr(R.reduce((a, r) => a + r.paid, 0))}</b></td><td class="r"><b>${inr(R.reduce((a, r) => a + r.intr, 0))}</b></td><td></td><td></td></tr></tbody></table></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Returns &amp; certificates</h3><div class="table-wrap"><table><thead><tr><th>Quarter</th>${Object.keys(TDS_FORMS).map(f => `<th>${esc(tdsFormName(f, fy0))}</th>`).join('')}<th>Due</th></tr></thead><tbody>
      ${[1, 2, 3, 4].map(q => `<tr><td>Q${q}</td>${Object.keys(TDS_FORMS).map(f => { const x = ctx.returns.find(y => y.q === q && y.form === f); return `<td class="small">${x ? esc(x.status) + (x.filed_on ? ' ' + fmtDate(x.filed_on) : '') + (Object.keys(x.certs || {}).length ? `<div class="muted">${Object.keys(x.certs).length} cert. issued</div>` : '') : '<span class="muted">—</span>'}</td>`; }).join('')}<td>${fmtDate(tdsRetDue(fy0, q))}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Section-wise for the year</h3>${secTot.length ? `<div class="table-wrap"><table><thead><tr><th>Old section</th><th>New section</th><th>Nature</th><th class="r">Amount</th><th class="r">TDS</th></tr></thead><tbody>
      ${secTot.map(x => `<tr><td><b>${esc(x.s.o)}</b></td><td><b>${esc(x.s.n)}</b></td><td class="small">${esc(x.s.name)}</td><td class="r">${inr(x.amt)}</td><td class="r">${inr(x.tds)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No entries this year.</p>'}</div>`;
  body.onclick = e => { const b = e.target.closest('[data-m]'); if (b) { tdsMonth = b.dataset.m; tdsQ = tdsQOf(tdsMonth); tdsTab = 'ded'; tdsDraft = null; route(); } };
}
const TDSW = { TDS_SEC, TDS_BY, tdsRate, tdsCalcRows, tdsInterest, parseTdsSec, panType, tdsRetDue, tdsCertDue, tdsQMonths, tdsFyMonths, tdsFormName, tdsCertName, tdsQOf, tdsFyOf };

/* =====================================================================
   BANK STATEMENT CONVERTER (Session 5, v22)  #/bank
   PDF (text, password-protected) · scanned PDF / photo (text recognition) · Excel / CSV
   → one clean table, running-balance check on every row, ledger rules, Excel + Tally XML.
   AI (Claude, through the bill-read function) only when asked and a key is saved.
   ===================================================================== */
const BANK = (() => {
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const p2 = n => String(n).padStart(2, '0');
  const okYmd = (y, m, d) => { if (y < 100) y += 2000; if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return ''; const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCDate() === d ? `${y}-${p2(m)}-${p2(d)}` : ''; };
  // date from text / Excel serial / Date → 'YYYY-MM-DD' or ''
  function date(v) {
    if (v instanceof Date && !isNaN(v)) return okYmd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') { if (v > 20000 && v < 80000) { const t = new Date(Math.round((v - 25569) * 864e5)); return okYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); } return ''; }
    const s = String(v ?? '').trim().replace(/\s+/g, ' ');
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?)?$/i);
    if (m) return okYmd(+m[3], +m[2], +m[1]);
    m = s.match(/^(\d{1,2})[\s\-\/.]?([A-Za-z]{3,9})[\s\-\/.,']*(\d{4}|\d{2})$/);
    if (m && MON[m[2].toLowerCase().slice(0, 3)]) return okYmd(+m[3], MON[m[2].toLowerCase().slice(0, 3)], +m[1]);
    m = s.match(/^([A-Za-z]{3,9})\s(\d{1,2}),?\s(\d{4})$/);
    if (m && MON[m[1].toLowerCase().slice(0, 3)]) return okYmd(+m[3], MON[m[1].toLowerCase().slice(0, 3)], +m[2]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return okYmd(+m[1], +m[2], +m[3]);
    return '';
  }
  // amount → {v, sfx:'cr'|'dr'|''} or null.  strict: PDF/OCR text needs paise (".00"); Excel cells may be whole numbers
  function amt(v, { loose = false, ocr = false } = {}) {
    if (typeof v === 'number') return isFinite(v) ? { v, sfx: '' } : null;
    let t = String(v ?? '').trim(); if (!t) return null;
    let sfx = '';
    const m = t.match(/[\s(]*\b(cr|dr)\b\.?\s*\)?$/i) || t.match(/(?<=\d)\s*\(?\s*(cr|dr)\.?\s*\)?$/i);
    if (m && m.index > 0) { sfx = m[1].toLowerCase(); t = t.slice(0, m.index).trim(); }
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1).trim(); }
    t = t.replace(/^(₹|rs\.?|inr)\s*/i, '');
    if (t.startsWith('-')) { neg = true; t = t.slice(1).trim(); }
    if (t.endsWith('-')) { neg = true; t = t.slice(0, -1).trim(); }
    if (ocr) { t = t.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/\s/g, ''); if (/^[\d,]+,\d{2}$/.test(t) && !t.includes('.')) t = t.replace(/,(\d{2})$/, '.$1'); t = t.replace(/\.(?=.*\.)/g, ','); }
    const dec = /^\d{1,3}(,\d{2,3})*\.\d{1,2}$|^\d+\.\d{1,2}$/.test(t), whole = /^\d{1,3}(,\d{2,3})+$|^\d+$/.test(t);
    if (!dec && !(loose && whole)) return null;
    const n = +t.replace(/,/g, '');
    return isFinite(n) ? { v: neg ? -n : n, sfx } : null;
  }
  const isAmt = (s, o) => !!amt(s, o);
  const dateIn = s => { const t = String(s || '').trim(); if (!t) return ''; const d = date(t); if (d) return d; const w = t.split(' '); for (let j = Math.min(3, w.length); j >= 1; j--) { const x = date(w.slice(0, j).join(' ')); if (x) return x; } return ''; };
  const SFX_ONLY = /^\(?(cr|dr)\.?\)?$/i;
  // header word → column role
  function role(t) {
    const s = String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s || s.length > 40) return '';
    if (/balance|\bbal\b\.?/.test(s)) return 'bal';
    if (/^(dr\s*\/\s*cr|cr\s*\/\s*dr|d\/c|c\/d|type|txn type|cr\/dr\s*ind)\.?$/.test(s)) return 'type';
    const dr = /withdraw|debit|\bdr\b|paid out|payments?\b/.test(s), cr = /deposit|credit|\bcr\b|paid in|receipts?\b/.test(s);
    if (dr && cr) return 'amt';
    if (dr) return 'dr';
    if (cr) return 'cr';
    if (/^(txn |transaction |tran )?amount|amount\s*\(|^amt\b/.test(s)) return 'amt';
    if (/value\s*(date|dt)|val\.?\s*dt/.test(s)) return 'vdate';
    if (/narration|naration|description|particulars|details|remarks|transaction remarks/.test(s)) return 'desc';
    if (/chq|cheque|check no|ref|instrument|inst\.?\s*no|utr|tran(saction)?\s*id|txn\s*id/.test(s)) return 'ref';
    if (/date|\bdt\b\.?/.test(s)) return 'date';
    if (/^(s\.?\s*no|sl\.?\s*no|sr\.?\s*no|#|no\.?)\.?$/.test(s)) return 'sno';
    if (/branch|init|\bbr\b|sol/.test(s)) return 'br';
    return '';
  }
  const AMT_ROLES = ['dr', 'cr', 'amt', 'bal'];
  // items: [{s, x0, x1, y (baseline, grows downwards), h, p}] → lines
  function toLines(items) {
    const L = [], by = [...items].filter(i => /[A-Za-z0-9]/.test(String(i.s))).sort((a, b) => a.p - b.p || a.y - b.y || a.x0 - b.x0);
    for (const it of by) {
      const last = L[L.length - 1], tol = Math.max(1.5, 0.45 * (it.h || 8));
      if (last && last.p === it.p && Math.abs(last.y - it.y) <= tol) { last.w.push(it); last.h = Math.max(last.h, it.h || 8); }
      else L.push({ p: it.p, y: it.y, h: it.h || 8, w: [it] });
    }
    for (const l of L) {
      l.w.sort((a, b) => a.x0 - b.x0);
      const W = [];                                 // glue touching pieces ("17.70" + "(Dr)", split numbers)
      for (const it of l.w) {
        const pv = W[W.length - 1], s = String(it.s).trim();
        if (pv && (it.x0 - pv.x1) < 0.25 * l.h && /^[-(₹]?[\d,]+\.?$/.test(pv.s) && /^[\d,]*\.?\d*\)?$/.test(s) && !(isAmt(pv.s) && isAmt(s))) { pv.s = pv.s + (it.x0 - pv.x1 > 0.12 * l.h ? ' ' : '') + s; pv.x1 = Math.max(pv.x1, it.x1); }
        else if (pv && SFX_ONLY.test(s) && isAmt(pv.s) && it.x0 - pv.x1 < 2 * l.h) { pv.s += ' ' + s; pv.x1 = it.x1; }
        else W.push({ s, x0: it.x0, x1: it.x1 });
      }
      l.w = W; l.text = W.map(w => w.s).join(' ');
    }
    return L;
  }
  // header columns from one line (+ the next line when the header wraps)
  function headerCells(words, h) {
    words = [...words].sort((a, b) => (a.l2 || 0) - (b.l2 || 0) || a.x0 - b.x0);   // first-line titles first, then the wrapped parts join them
    const cells = [], g = 0.42 * h;
    for (const w of words) {
      const c = w.l2 ? cells.find(c => w.x0 <= c.x1 + g && w.x1 >= c.x0 - g) : cells.find(c => c.l1 && w.x0 - c.x1 < g && w.x0 >= c.x0);
      if (c) { c.parts.push(w); c.x0 = Math.min(c.x0, w.x0); c.x1 = Math.max(c.x1, w.x1); if (!w.l2) c.l1 = 1; }
      else cells.push({ x0: w.x0, x1: w.x1, parts: [w], l1: w.l2 ? 0 : 1 });
    }
    for (const c of cells) { c.text = c.parts.sort((a, b) => (a.l2 || 0) - (b.l2 || 0) || a.x0 - b.x0).map(p => p.s).join(' '); c.role = role(c.text); }
    for (let k = 0; k < cells.length; k++) {                  // PDF text sometimes runs two titles together
      const c = cells[k]; if (c.role === 'amt' || c.parts.some(p => p.l2)) continue;
      const ws = c.text.split(' '); let cut = null;
      for (let j = 1; j < ws.length && !cut; j++) {
        const a = role(ws.slice(0, j).join(' ')), b = role(ws.slice(j).join(' '));
        if (a && b && a !== b && !(['dr', 'cr'].includes(a) && b === 'amt') && !(['dr', 'cr'].includes(b) && a === 'amt')) cut = j;
      }
      if (!cut) continue;
      const left = ws.slice(0, cut).join(' '), right = ws.slice(cut).join(' '), cw = (c.x1 - c.x0) / Math.max(1, c.text.length);
      const c2 = { x0: c.x0 + (left.length + 1) * cw, x1: c.x1, parts: [], text: right, role: role(right), l1: 1 };
      c.x1 = c.x0 + left.length * cw; c.text = left; c.role = role(left);
      cells.splice(k + 1, 0, c2);
    }
    for (const c of cells) c.xc = (c.x0 + c.x1) / 2;
    return cells;
  }
  const nRoles = cells => cells.filter(c => c.role).length;
  function headerAt(L, i) {
    const l = L[i]; if (!l) return null;
    if (new Set(l.w.map(w => role(w.s)).filter(Boolean)).size < 2) return null;
    let words = [...l.w], used = 1, cells = headerCells(words, l.h);
    for (let k = 1; k <= 2; k++) {                              // titles that wrap onto 2–3 lines ("Transaction / Posted / Date")
      const nx = L[i + k], pv = L[i + k - 1];
      if (!(nx && nx.p === l.p && nx.y - pv.y < 1.9 * l.h && nx.w.every(w => w.s.length <= 18 && !/\d{2,}/.test(w.s) && !(/[\/\\]/.test(w.s) && /\d/.test(w.s)) && !isAmt(w.s) && !date(w.s)))) break;
      const w2 = [...words, ...nx.w.map(w => ({ ...w, l2: 1 }))], c2 = headerCells(w2, l.h);
      if (nRoles(c2) <= nRoles(cells) && !c2.some(c => c.role && !cells.some(o => o.role === c.role))) break;   // must complete a title
      words = w2; cells = c2; used++;
    }
    const dates = cells.filter(c => c.role === 'date'); if (dates.length > 1) dates.slice(1).forEach(c => { c.role = cells.some(x => x.role === 'vdate') ? 'pdate' : 'vdate'; });
    const roles = cells.map(c => c.role).filter(Boolean);
    const has = r => roles.includes(r), n = new Set(roles).size;
    const ok = n >= 3 && (has('date') || has('vdate')) && (has('bal') || (has('dr') && has('cr')) || has('amt'));
    if (!ok) return null;
    if (!has('date')) cells.find(c => c.role === 'vdate').role = 'date';
    // titles we don't know (e.g. "Init. Br", "Tran Type") stay as columns so their contents don't spill into the narration
    cells.forEach(c => { if (!c.role && c.text.length <= 25 && /[a-z]/i.test(c.text)) c.role = 'x'; });
    return { cols: cells.filter(c => c.role && c.role !== 'pdate'), used };
  }
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  function colOf(w, cols, h) {
    const a = isAmt(w.s) || isAmt(w.s, { ocr: true });
    const C = a ? cols.filter(c => AMT_ROLES.includes(c.role)) : cols;
    let best = null, bs = 0;
    for (const c of C) { const s = overlap(w.x0, w.x1, c.x0 - 0.6 * h, c.x1 + 0.6 * h); if (s > bs) { bs = s; best = c; } }
    if (best) return best;
    if (!a) {                                                    // left-aligned text: the column whose title starts at or before the word
      const L = cols.filter(c => !AMT_ROLES.includes(c.role) && c.x0 <= w.x0 + 0.5 * h).sort((x, y) => y.x0 - x.x0)[0];
      if (L) return L;
    }
    let bd = 1e9;
    for (const c of C) { const d = a ? Math.min(Math.abs(w.x1 - c.x1), Math.abs((w.x0 + w.x1) / 2 - c.xc)) : Math.abs(w.x0 - c.x0); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  const JUNK = /page\s*\d+\s*(of\s*\d+)?|computer generated|does not require|statement summary|generated on|end of statement|customer care|registered office|please (note|contact)|unless the constituent|\*{3,}|abbreviations/i;
  const OPEN_RE = /opening\s*balance|balance\s*b\/?f|brought\s*forward|b\/f\b|balance\s*forward/i, CLOSE_RE = /closing\s*balance|carried\s*forward|c\/f\b|balance\s*c\/?f/i;
  // table mode: rows from lines using the header columns
  function fromLines(L, { ocr = false } = {}) {
    const ao = { ocr };
    let cols = null, hdrFound = false;
    const anchors = [], cont = [], recs = [];
    let skipTo = -1;
    const hdrs = {}; L.forEach((l, i) => { if (!(l.p in hdrs) && headerAt(L, i)) hdrs[l.p] = i; });
    for (let i = 0; i < L.length; i++) {
      if (i <= skipTo) continue;
      const l = L[i];
      if (l.p in hdrs && i < hdrs[l.p]) continue;                // page title / address above the header
      const hd = i === hdrs[l.p] || (l.p in hdrs && i > hdrs[l.p]) ? headerAt(L, i) : null;
      if (hd) { cols = hd.cols; hdrFound = true; skipTo = i + hd.used - 1; continue; }
      if (!cols) continue;
      const by = {}, edges = cols.filter(c => !AMT_ROLES.includes(c.role)).map(c => c.x0);
      const W = [];
      for (const w of l.w) {
        const crosses = / /.test(w.s) && !isAmt(w.s, ao) && edges.some(e => w.x0 < e - 0.5 * l.h && w.x1 > e + l.h);
        if (!crosses) { W.push(w); continue; }
        const cw = (w.x1 - w.x0) / w.s.length; let pos = 0;
        for (const part of w.s.split(' ')) { if (part) W.push({ s: part, x0: w.x0 + pos * cw, x1: w.x0 + (pos + part.length) * cw }); pos += part.length + 1; }
      }
      l.w = W;
      for (const w of l.w) { const c = colOf(w, cols, l.h); if (!c) continue; (by[c.role] = by[c.role] || []).push(w); }
      const txt = r => (by[r] || []).map(w => w.s).join(' ').trim();
      const dt = dateIn(txt('date')) || (ocr ? dateIn(txt('date').replace(/[oO]/g, '0').replace(/[lI|]/g, '1')) : '');
      recs.push({ p: l.p, y: l.y, h: l.h, by, x: l.w.length ? l.w[0].x0 : 0, start: /^\d{1,2}([\/\-. ]|[A-Za-z]{3})/.test(txt('date')) || !!dt });
      const nums = r => (by[r] || []).map(w => amt(w.s, ao)).filter(Boolean);
      const hasAmt = AMT_ROLES.some(r => nums(r).length);
      if (dt && hasAmt) {
        const a = { p: l.p, y: l.y, h: l.h, date: dt, vdate: date(txt('vdate')), desc: [[l.y, txt('desc')]], ref: [[l.y, txt('ref')]], type: txt('type') };
        for (const r of AMT_ROLES) { const n = nums(r); if (n.length) a[r] = n[n.length - 1]; }
        // text that fell into other text columns (sno/br/unknown) is dropped; desc fallback: any non-amount text left of amounts
        if (!a.desc[0][1]) a.desc[0][1] = l.w.filter(w => !isAmt(w.s, ao) && !date(w.s) && colOf(w, cols, l.h) && !['date', 'vdate', 'sno', 'br', 'type', 'ref'].includes(colOf(w, cols, l.h).role)).map(w => w.s).join(' ');
        const dw = by.desc || []; if (dw.length) a.dx = Math.min(...dw.map(w => w.x0));
        anchors.push(a); continue;
      }
      if (JUNK.test(l.text) || /^\s*(grand\s*)?total\b/i.test(l.text)) { recs.pop(); continue; }
      if (OPEN_RE.test(l.text) || CLOSE_RE.test(l.text)) {
        recs.pop();
        const f = re => { const m = l.text.match(re); return m ? amt(m[1] + (m[2] ? ' ' + m[2] : ''), ao) : null; };
        const ob = f(/(?:opening\s*balance|balance\s*b\/?f|brought\s*forward|b\/f|balance\s*forward)[^\d\-]{0,30}(-?[\d,]+\.\d{2})\s*(cr|dr)?/i), cb = f(/(?:closing\s*balance|carried\s*forward|c\/f|balance\s*c\/?f)[^\d\-]{0,30}(-?[\d,]+\.\d{2})\s*(cr|dr)?/i);
        if (ob || cb) cont.push({ p: l.p, y: l.y, ob, cb });
        continue;
      }
      // continuation: only text in narration / ref columns
      const roles = Object.keys(by);
      if (roles.length && roles.every(r => r === 'desc' || r === 'ref') && !l.w.some(w => isAmt(w.s, ao))) cont.push({ p: l.p, y: l.y, h: l.h, x: l.w[0].x0, desc: txt('desc'), ref: txt('ref') });
    }
    if (!hdrFound) return [];
    // vertically centred rows (text above the date line)? → attach each text line to the nearest row; else to the row above
    const firstA = anchors[0];
    const centred = !!firstA && cont.filter(c => c.desc != null && /[A-Za-z0-9]{3}/.test(c.desc) && c.p === firstA.p && c.y < firstA.y && (firstA.dx == null || Math.abs(c.x - firstA.dx) < 2 * c.h)).length > 0;
    let opening = null, closing = null;
    const dxs = anchors.map(a => a.dx).filter(x => x != null).sort((a, b) => a - b), dx = dxs.length ? dxs[Math.floor(dxs.length * 0.1)] : null;
    const text = [];
    for (const c of cont) {
      if (c.ob || c.cb) { if (c.ob && opening == null) opening = c.ob; if (c.cb) closing = c.cb; continue; }
      if (dx != null && c.x < dx - 1.2 * c.h) continue;        // starts left of the narration column → not narration
      text.push(c);
    }
    const add = (a, c) => { if (c.desc) a.desc.push([c.y, c.desc]); if (c.ref) a.ref.push([c.y, c.ref]); };
    let band = null;
    {
      const B = []; let cur = null;
      for (const r of recs) {
        if (r.start) { cur = { lines: [r] }; B.push(cur); continue; }
        if (!cur || cur.closed) continue;
        const pv = cur.lines[cur.lines.length - 1];
        if (r.p === pv.p && r.y - pv.y > 2.6 * r.h) { cur.closed = true; continue; }     // table ended (summary / legend below)
        if (r.p !== pv.p) { const roles = Object.keys(r.by); if (!roles.every(x => x === 'desc' || x === 'ref') || (dx != null && r.x < dx - 1.2 * r.h)) continue; }
        cur.lines.push(r);
      }
      const frags = (b, role) => b.lines.flatMap(r => (r.by[role] || []).length ? [{ t: r.by[role].map(w => w.s).join(' '), x1: Math.max(...r.by[role].map(w => w.x1)) }] : []);
      const x1s = B.flatMap(b => frags(b, 'desc').map(f => f.x1)).sort((a, b) => a - b), right = x1s.length ? x1s[Math.floor(x1s.length * 0.95)] : 0;
      const tight = (F, ok) => { let t = ''; for (const f of F) { if (!t) t = f.t; else if (!ok(t)) t += f.t; else break; } return t; };
      const dJoin = F => { let t = ''; for (const f of F) { if (!t) t = f.t; else if (/^\d{1,4}\b/.test(f.t) && (!dateIn(t) || dateIn(t + f.t)) && /[\/\-.]\d{0,3}$/.test(t)) t += f.t; else break; } return t; };
      // does this bank cut words at the column edge (ICICI) or wrap at spaces? look at lines that continue on the next line
      const wrapped = B.flatMap(b => { const F = frags(b, 'desc'); return F.slice(0, -1).map(f => f.x1); }), hh = (B[0] && B[0].lines[0].h) || 8;
      const wrapped2 = B.flatMap(b => { const F = frags(b, 'desc'); return F.slice(0, -1).filter(f => !/[\/\-:]$/.test(f.t)).map(f => f.x1); });
      const cutWords = right && wrapped2.length >= 5 && wrapped2.filter(x => x > right - 0.6 * hh).length / wrapped2.length > 0.6;
      const smart = (F, h) => F.reduce((t, f, k) => !t ? f.t : (/[\/\-:]$/.test(t) || /^[\/\-]/.test(f.t) || (cutWords && F[k - 1].x1 > right - 0.6 * h)) ? t + f.t : t + ' ' + f.t, '');
      const out = [];
      for (const b of B) {
        const h = b.lines[0].h, dT = dJoin(frags(b, 'date')), d = dateIn(dT) || (ocr ? dateIn(dT.replace(/[oO]/g, '0').replace(/[lI|]/g, '1')) : '');
        const o = { date: d, vdate: dateIn(dJoin(frags(b, 'vdate'))), desc: smart(frags(b, 'desc'), h), ref: smart(frags(b, 'ref'), h), type: frags(b, 'type').map(f => f.t).join(' ') };
        for (const r of AMT_ROLES) { const t = tight(frags(b, r).map(f => ({ t: f.t.replace(/\s+/g, '') })), x => isAmt(x, ao)); const a = amt(t, ao); if (a) o[r] = a; }
        if (d && AMT_ROLES.some(r => o[r])) out.push(o);
      }
      if (out.length) band = { rows: out, opening, closing, mode: 'table-rows' };
    }
    if (!centred) {
      for (const c of text) {
        let tgt = null;
        for (const a of anchors) { if (a.p < c.p || (a.p === c.p && a.y < c.y)) tgt = a; else break; }
        if (tgt) add(tgt, c);
      }
    } else {
      // each row's text is centred on its date line: split the lines between two rows so every row has (about) as many lines below as above
      for (const p of [...new Set(anchors.map(a => a.p))]) {
        const A = anchors.filter(a => a.p === p), T = text.filter(c => c.p === p);
        const gaps = A.map((a, j) => T.filter(c => c.y > a.y && (j === A.length - 1 || c.y < A[j + 1].y)));
        const pre = T.filter(c => c.y < A[0].y); pre.forEach(c => add(A[0], c));
        // dp[j][u] = best cost with anchor j having u lines above
        const forced = gaps.map((g, j) => {
          if (j === A.length - 1 || !g.length) return null;
          const ys = [A[j].y, ...g.map(c => c.y), A[j + 1].y], df = ys.slice(1).map((y, i) => y - ys[i]);
          const mx = Math.max(...df), srt = [...df].sort((a, b) => a - b), med = srt[Math.floor(srt.length / 2)];
          return mx > med + 0.2 * A[j].h && df.filter(x => x > mx - 0.1).length === 1 ? df.indexOf(mx) : null;
        });
        let J = 0;
        const cost = (d, u) => (forced[J] != null ? (d === forced[J] ? 0 : 5) : 0) + (d === u + 1 ? 0 : d === u ? 0.001 : 1 + Math.abs(d - u) * 0.1);
        let best = new Map([[pre.length, { c: 0, path: [] }]]);
        for (let j = 0; j < A.length; j++) {
          J = j;
          const k = gaps[j].length, next = new Map(), last = j === A.length - 1;
          for (const [u, st] of best) for (let d = last ? k : 0; d <= k; d++) {
            const c2 = st.c + cost(d, u), u2 = k - d, cur = next.get(u2);
            if (!cur || c2 < cur.c) next.set(u2, { c: c2, path: [...st.path, d] });
          }
          best = next;
        }
        const path = [...best.values()].sort((a, b) => a.c - b.c)[0].path;
        A.forEach((a, j) => { const g = gaps[j], d = path[j]; g.slice(0, d).forEach(c => add(a, c)); if (j + 1 < A.length) g.slice(d).forEach(c => add(A[j + 1], c)); });
      }
    }
    const join = arr => arr.sort((a, b) => a[0] - b[0]).map(x => x[1]).filter(Boolean).reduce((s, t) => !s ? t : /[\/\-:]$/.test(s) || /^[\/\-]/.test(t) ? s + t : s + ' ' + t, '');
    const rows = anchors.map(a => ({ date: a.date, vdate: a.vdate, desc: join(a.desc), ref: join(a.ref), dr: a.dr, cr: a.cr, amt: a.amt, bal: a.bal, type: a.type }));
    return [band, rows.length ? { rows, opening, closing, mode: centred ? 'table-centred' : 'table' } : null].filter(Boolean);
  }
  // no header found: a row = a line that starts with a date and ends with amounts
  function fromLinesLoose(L, { ocr = false } = {}) {
    const ao = { ocr }, rows = []; let last = null, descX = null;
    for (const l of L) {
      const w = l.w;
      let k = 0, dt = '';
      for (let j = 1; j <= Math.min(3, w.length); j++) { const d = date(w.slice(0, j).map(x => x.s).join(' ')); if (d) { dt = d; k = j; } }
      const nums = []; let e = w.length;
      while (e > k && (amt(w[e - 1].s, ao) || /^[-–]$/.test(w[e - 1].s))) { e--; const a = amt(w[e].s, ao); if (a) nums.unshift(a); }
      if (dt && nums.length) {
        let s = k; const vd = s < e ? date(w[s].s) : ''; if (vd) s++;
        const mid = w.slice(s, e); if (mid.length) descX = mid[0].x0;
        const refI = mid.length > 1 ? mid.findIndex((x, j) => j > 0 && /^[A-Z0-9\/\-]{6,}$/i.test(x.s) && /\d/.test(x.s) && !/\s/.test(x.s)) : -1;
        const ref = refI > 0 ? mid[refI].s : '';
        const desc = mid.filter((x, j) => j !== refI).map(x => x.s).join(' ');
        const bal = nums[nums.length - 1], rest = nums.slice(0, -1).filter(n => n.v !== 0);
        last = { date: dt, vdate: vd, desc, ref, bal, amt: rest.length === 1 ? rest[0] : undefined, dr: rest.length === 2 ? rest[0] : undefined, cr: rest.length === 2 ? rest[1] : undefined, p: l.p };
        if (!rest.length && nums.length === 2 && nums[0].v === 0) last.amt = undefined;
        rows.push(last); continue;
      }
      if (JUNK.test(l.text) || !last || last.p !== l.p) continue;
      if (!w.some(x => isAmt(x.s, ao)) && descX != null && w[0].x0 >= descX - l.h) last.desc += (/[\/\-]$/.test(last.desc) ? '' : ' ') + l.text;
    }
    return rows.length >= 2 ? { rows, mode: 'loose' } : null;
  }
  // Excel / CSV rows (arrays of cells)
  function fromSheet(rows) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const m = {}; (rows[i] || []).forEach((c, j) => { const r = role(c); if (r && !(r in m)) m[r] = j; else if (r === 'date' && 'date' in m && !('vdate' in m)) m.vdate = j; });
      const n = Object.keys(m).length;
      if (n >= 3 && ('date' in m || 'vdate' in m) && ('bal' in m || ('dr' in m && 'cr' in m) || 'amt' in m)) { hi = i; map = m; if (!('date' in m)) { m.date = m.vdate; delete m.vdate; } break; }
    }
    if (hi < 0) return null;
    const out = []; let last = null, opening = null;
    for (const r of rows.slice(hi + 1)) {
      const g = k => k in map ? r[map[k]] : '';
      const dt = date(g('date'));
      const A = k => { const v = g(k); return v === '' || v == null ? null : amt(v, { loose: true }); };
      const desc = String(g('desc') ?? '').replace(/\s+/g, ' ').trim();
      if (dt && (A('bal') || A('dr') || A('cr') || A('amt'))) {
        if (OPEN_RE.test(desc) && !A('dr') && !A('cr') && !A('amt')) { opening = A('bal'); continue; }
        last = { date: dt, vdate: date(g('vdate')), desc, ref: String(g('ref') ?? '').trim(), dr: A('dr') || undefined, cr: A('cr') || undefined, amt: A('amt') || undefined, bal: A('bal') || undefined, type: String(g('type') ?? '') };
        out.push(last); continue;
      }
      if (last && desc && !dt && !A('dr') && !A('cr') && !A('bal') && !/^\*+$/.test(desc)) last.desc += ' ' + desc;
    }
    return out.length ? { rows: out, opening, mode: 'sheet', hi } : null;
  }
  const r2 = n => Math.round(n * 100) / 100;
  const near = (a, b) => Math.abs(a - b) < 0.011;
  // turn raw rows into final rows: sides, signs, order, opening, checks
  function finish(raw, { opening: op0 = null, meta = {} } = {}) {
    let rows = raw.map(r => {
      const o = { date: r.date, vdate: r.vdate || '', desc: (r.desc || '').replace(/\s+/g, ' ').trim(), ref: (r.ref || '').trim(), dr: 0, cr: 0, bal: null, side: '' };
      if (r.bal) o.bal = r.bal.sfx === 'dr' ? -Math.abs(r.bal.v) : r.bal.v;
      const t = String(r.type || '').trim().toLowerCase();
      if (r.dr && r.dr.v) { o.dr = Math.abs(r.dr.v); o.side = 'dr'; }
      if (r.cr && r.cr.v) { o.cr = Math.abs(r.cr.v); o.side = o.side ? 'both' : 'cr'; }
      if (!o.side && r.amt && r.amt.v) {
        const s = r.amt.sfx || (/^(dr|d|debit|withdrawal)\.?$/.test(t) ? 'dr' : /^(cr|c|credit|deposit)\.?$/.test(t) ? 'cr' : r.amt.v < 0 ? 'dr' : '');
        o.amt = Math.abs(r.amt.v); if (s) { o[s] = o.amt; o.side = s; } else o.side = '?';
      }
      return o;
    });
    // newest first? compare how many rows tally forward vs backward
    const score = R => { let s = 0; for (let i = 1; i < R.length; i++) { const a = R[i - 1], b = R[i]; if (a.bal == null || b.bal == null) continue; const d = b.bal - a.bal, m = b.amt || b.dr || b.cr; if (b.side === '?' ? near(Math.abs(d), m) : near(d, b.cr - b.dr)) s++; } return s; };
    const desc = rows.length > 2 && rows[0].date > rows[rows.length - 1].date;
    const rev = [...rows].reverse();
    if (desc || score(rev) > score(rows)) rows = rev;
    // sides from the balance; fix swapped debit/credit
    let fixed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], pb = i ? rows[i - 1].bal : op0;
      if (r.bal == null || pb == null) continue;
      const d = r2(r.bal - pb);
      if (r.side === '?') { if (near(d, r.amt)) { r.cr = r.amt; r.side = 'cr'; } else if (near(d, -r.amt)) { r.dr = r.amt; r.side = 'dr'; } }
      else if (!near(d, r.cr - r.dr) && near(d, r.dr - r.cr) && r.side !== 'both') { [r.dr, r.cr] = [r.cr, r.dr]; r.side = r.side === 'dr' ? 'cr' : 'dr'; fixed++; }
    }
    if (rows[0] && rows[0].side === '?') { const c = /\bby\b|deposit|credit|\bcr\b|received|int\.?\s*pd|interest|refund|rev/i.test(rows[0].desc); rows[0][c ? 'cr' : 'dr'] = rows[0].amt; rows[0].side = c ? 'cr' : 'dr'; }
    rows.forEach(r => { delete r.amt; if (r.side === '?') r.side = ''; });
    const first = rows[0];
    const opening = op0 != null ? op0 : first && first.bal != null ? r2(first.bal - first.cr + first.dr) : 0;
    const out = rows.map(r => ({ d: r.date, vd: r.vdate, n: r.desc, r: r.ref, dr: r2(r.dr), cr: r2(r.cr), b: r.bal == null ? null : r2(r.bal) }));
    const res = check(out, opening);
    return { rows: out, opening, fixed, ...res, meta };
  }
  // running balance check: every printed balance must equal the previous balance + credit − debit
  function check(rows, opening) {
    let run = opening, bad = 0; const flags = [];
    rows.forEach((r, i) => {
      const exp = r2(run + (+r.cr || 0) - (+r.dr || 0));
      if (r.b == null || r.b === '') { flags[i] = { ok: true, calc: exp }; run = exp; return; }
      const ok = near(exp, +r.b); if (!ok) bad++;
      flags[i] = { ok, exp, diff: r2(+r.b - exp) }; run = +r.b;
    });
    const dr = r2(rows.reduce((s, r) => s + (+r.dr || 0), 0)), cr = r2(rows.reduce((s, r) => s + (+r.cr || 0), 0));
    const lastB = [...rows].reverse().find(r => r.b != null && r.b !== '');
    const closing = rows.length ? (lastB ? +lastB.b : r2(opening + cr - dr)) : opening;
    return { flags, bad, dr, cr, closing, nDr: rows.filter(r => +r.dr).length, nCr: rows.filter(r => +r.cr).length, sumOk: near(r2(opening + cr - dr), closing) };
  }
  const BANKS = [['State Bank of India', /state bank of india|\bsbi\b/i, 'SBIN'], ['HDFC Bank', /hdfc bank/i, 'HDFC'], ['ICICI Bank', /icici bank/i, 'ICIC'], ['Axis Bank', /axis bank/i, 'UTIB'],
    ['Kotak Mahindra Bank', /kotak/i, 'KKBK'], ['Indian Bank', /\bindian bank\b/i, 'IDIB'], ['Indian Overseas Bank', /indian overseas/i, 'IOBA'], ['Canara Bank', /canara/i, 'CNRB'], ['Bank of Baroda', /bank of baroda/i, 'BARB'],
    ['Union Bank of India', /union bank/i, 'UBIN'], ['Punjab National Bank', /punjab national/i, 'PUNB'], ['Bank of India', /(?<!state |central )bank of india\b/i, 'BKID'], ['Central Bank of India', /central bank of india/i, 'CBIN'],
    ['IDFC FIRST Bank', /idfc/i, 'IDFB'], ['Yes Bank', /yes bank/i, 'YESB'], ['IndusInd Bank', /indusind/i, 'INDB'], ['Federal Bank', /federal bank/i, 'FDRL'], ['Karur Vysya Bank', /karur vysya/i, 'KVBL'],
    ['City Union Bank', /city union/i, 'CIUB'], ['Tamilnad Mercantile Bank', /tamilnad mercantile/i, 'TMBL'], ['South Indian Bank', /south indian bank/i, 'SIBL'], ['UCO Bank', /\buco bank/i, 'UCBA'],
    ['Bandhan Bank', /bandhan/i, 'BDBL'], ['AU Small Finance Bank', /au small finance/i, 'AUBL'], ['RBL Bank', /\brbl bank/i, 'RATN'], ['DBS Bank', /dbs bank/i, 'DBSS'], ['Equitas', /equitas/i, 'ESFB']];
  function meta(text, headText) {
    const t = String(text || '');
    const head = String(headText == null ? t : headText).slice(0, 1500);
    const ifsc = (t.match(/IFS(?:C)?\s*(?:code)?\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})\b/i) || head.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/) || [])[1] || '';
    const byIfsc = ifsc && BANKS.find(([, , pre]) => pre === ifsc.slice(0, 4).toUpperCase());
    const bank = (byIfsc || BANKS.find(([, re]) => re.test(head.slice(0, 600))) || BANKS.find(([, re]) => re.test(head)) || [''])[0];
    const acct = (t.match(/(?:a\/?c|account)\s*(?:no|number|num)?\.?\s*[:\-]?\s*([0-9Xx*]{6,20})\b/i) || t.match(/\(INR\)\s*-\s*(\d{9,18})/) || [])[1] || '';
    const name = ((t.match(/(?:account\s*name|a\/c\s*name|customer\s*name|name)\s*[:\-]\s*([^\n]{3,80})/i) || [])[1] || '').split(/\s{2,}|\s+(?=(?:a\/c\s|branch|ifsc|address|cust|customer|account|micr|phone|mobile|e-?mail|date|period|statement|type|currency|jt\.?)\b[^:]{0,20}:)/i)[0].trim().slice(0, 60);
    const pm = t.match(/(?:period|from)\s*:?\s*([0-9A-Za-z\/\-. ]{6,12}?)\s*(?:to|-)\s*:?\s*([0-9A-Za-z\/\-. ]{6,12})(?:\s|$)/i);
    const g = re => { const m = t.match(re); return m ? amt(m[1]) : null; };
    const ob = g(/opening\s*bal(?:ance)?\s*:?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.\d{2})/i) || g(/balance\s*as\s*on[^:\n]{0,20}:\s*([\d,]+\.\d{2})/i);
    const cb = g(/closing\s*bal(?:ance)?\s*:?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.\d{2})/i);
    const td = g(/total\s*(?:debits?|withdrawals?)\s*:?\s*([\d,]+\.\d{2})/i), tc = g(/total\s*(?:credits?|deposits?)\s*:?\s*([\d,]+\.\d{2})/i);
    return { bank, ifsc, acct, name, from: pm ? date(pm[1].trim()) : '', to: pm ? date(pm[2].trim()) : '', ob: ob && ob.v, cb: cb && cb.v, td: td && td.v, tc: tc && tc.v };
  }
  // compare with the bank's own summary
  function summaryNotes(res, m) {
    const n = [], noB = res.rows.filter(r => r.b == null).length;
    if (res.rows.length && noB > res.rows.length / 2) n.push(`The balance column could not be read for ${noB} of ${res.rows.length} rows, so those rows cannot be checked. Use Read with AI, or send this statement to Claude to add its layout.`);
    if (m.ob != null && !near(m.ob, res.opening)) n.push(`Opening balance on the statement is ${m.ob.toFixed(2)}, worked out ${res.opening.toFixed(2)} — a row at the start may be missing.`);
    if (m.cb != null && !near(m.cb, res.closing)) n.push(`Closing balance on the statement is ${m.cb.toFixed(2)}, last row shows ${res.closing.toFixed(2)} — rows at the end may be missing.`);
    if (m.td != null && !near(m.td, res.dr)) n.push(`Total debits on the statement ${m.td.toFixed(2)}, rows add up to ${res.dr.toFixed(2)}.`);
    if (m.tc != null && !near(m.tc, res.cr)) n.push(`Total credits on the statement ${m.tc.toFixed(2)}, rows add up to ${res.cr.toFixed(2)}.`);
    return n;
  }
  // best of table mode and line mode
  function parseLines(L, o = {}) {
    const hi = L.findIndex((l, i) => headerAt(L, i));
    const text = L.map(l => l.text).join('\n'), m = meta(text, hi > 0 ? L.slice(0, hi).map(l => l.text).join('\n') : text.slice(0, 600));
    const tries = [...fromLines(L, o), fromLinesLoose(L, o)].filter(Boolean).map(x => ({ x, f: finish(x.rows, { opening: x.opening != null ? (x.opening.sfx === 'dr' ? -x.opening.v : x.opening.v) : null }) }));
    if (!tries.length) return null;
    const sc = t => t.f.rows.filter(r => r.b != null).length + 0.5 * t.f.rows.filter(r => r.b == null).length - 3 * t.f.bad + (t.x.mode === 'table-centred' ? 0.5 : t.x.mode === 'table' ? 0.25 : 0);
    tries.sort((a, b) => sc(b) - sc(a));
    const best = tries[0];
    return { ...best.f, mode: best.x.mode, meta: m, notes: summaryNotes(best.f, m) };
  }
  function parseSheet(sheets) {
    for (const sh of sheets) {
      const x = fromSheet(sh.rows); if (!x || !x.rows.length) continue;
      const text = sh.rows.slice(0, 40).map(r => r.join(' ')).join('\n'), m = meta(text, sh.rows.slice(0, x.hi).map(r => r.join(' ')).join('\n'));
      const f = finish(x.rows, { opening: x.opening ? x.opening.v : null });
      return { ...f, mode: 'sheet', meta: m, notes: summaryNotes(f, m) };
    }
    return null;
  }
  /* ---------- party, ledger rules, vouchers ---------- */
  const STOP = /^(neft|rtgs|imps|upi|ach|nach|ecs|by|to|transfer|trf|inb|mb|ib|clg|chq|cheque|dep|deposit|wdl|withdrawal|atm|pos|p2a|p2p|p2m|cr|dr|payment|payments|from|phone|ref|inv|bill|settlement|cms|int|pd|cash|self|branch|the|of|for|and|at|tp|d|c|okaxis|oksbi|okhdfcbank|okicici|ybl|paytm|ibl|axl|upi|na|txn|mobile|ft|imp|nft|rtg|outward|inward|fund|funds|on|via|in|no)$/i;
  function party(n) {
    const s = String(n || '');
    if (!/[\/*|:]|\b(neft|rtgs|imps|upi|chq|clg|transfer|trf|by|to)\b/i.test(s)) return '';
    for (const ch of s.split(/[\/*|:]+|\s-\s/)) {
      const junk = w => STOP.test(w) || /\d{3,}/.test(w) || /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(w) || !/[a-z]/i.test(w);
      const words = ch.trim().split(/\s+/).filter(Boolean);
      while (words.length && junk(words[0])) words.shift();
      while (words.length && junk(words[words.length - 1])) words.pop();
      if (words.some(w => /\d{3,}/.test(w))) continue;
      const letters = words.join('').replace(/[^a-z]/gi, '').length;
      if (letters >= 4 && (words.length >= 2 || letters >= 5) && !/^(neft|rtgs|imps|upi)/i.test(ch.trim())) return words.join(' ').replace(/^(by|to)\s+/i, '').slice(0, 60);
    }
    return '';
  }
  const BUILTIN = [
    { re: /\b(atm|cash\s*w(?:i)?d(?:l|rawal)?|self\s*chq|cash\s*paid|nwd|atw)\b/i, dir: 'dr', ledger: 'Cash', group: 'Cash-in-Hand' },
    { re: /cash\s*dep|\bcdm\b|by\s*cash/i, dir: 'cr', ledger: 'Cash', group: 'Cash-in-Hand' },
    { re: /\b(gst\s*pay\w*|cpin|gstn|gst\s*challan|cbic)\b/i, dir: 'dr', ledger: 'GST Payable', group: 'Duties & Taxes' },
    { re: /\b(cbdt|oltas|tds\s*challan|itns\s*28[01]|tin\s*nsdl|income\s*tax\s*challan)\b/i, dir: 'dr', ledger: 'TDS Payable', group: 'Duties & Taxes' },
    { re: /\b(charges?|chrgs?|chgs|sms\s*alert|amc|annual\s*fee|min(?:imum)?\s*bal|service\s*fee|commission)\b/i, dir: 'dr', ledger: 'Bank Charges', group: 'Indirect Expenses' },
    { re: /\b(int\.?\s*pd|interest\s*(?:paid|credit|cr)|int\s*credit|sb\s*int|int\.?\s*coll)\b/i, dir: 'cr', ledger: 'Interest Received', group: 'Indirect Incomes' },
    { re: /\bsalary\b|\bsal\s+\w+\s+\d{4}/i, dir: 'dr', ledger: 'Salary', group: 'Indirect Expenses' }];
  const DEFAULT_GROUP = Object.fromEntries(BUILTIN.map(b => [b.ledger, b.group]));
  // rules: [{match, dir, ledger}] most specific first; returns {ledger, how}
  function ledgerFor(r, rules) {
    const n = lc(r.n), side = +r.dr ? 'dr' : 'cr', p = lc(r.p || party(r.n));
    const R = [...rules].sort((a, b) => (a.client_id ? 0 : 1) - (b.client_id ? 0 : 1) || String(b.match).length - String(a.match).length);
    for (const x of R) { const m = lc(x.match).trim(); if (m && (n.includes(m) || (p && p === m)) && (!x.dir || x.dir === 'any' || x.dir === side)) return { ledger: x.ledger, how: 'rule' }; }
    for (const b of BUILTIN) if (b.dir === side && b.re.test(r.n)) return { ledger: b.ledger, how: 'auto' };
    return { ledger: '', how: '' };
  }
  const vtype = (r, ledger) => (lc(ledger) === 'cash' ? 'Contra' : +r.dr ? 'Payment' : 'Receipt');
  const xe = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const ymd = d => String(d || '').replace(/-/g, '');
  const env = (company, body) => `<ENVELOPE>\n <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n <BODY><IMPORTDATA>\n  <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${company ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ''}</REQUESTDESC>\n  <REQUESTDATA>\n${body}  </REQUESTDATA>\n </IMPORTDATA></BODY>\n</ENVELOPE>\n`;
  function tallyLedgers({ company, bankLedger, bankGroup = 'Bank Accounts', ledgers }) {
    const L = [[bankLedger, bankGroup], ...Object.entries(ledgers)];
    return env(company, L.map(([n, g]) => `   <TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xe(n)}" ACTION="Create"><NAME.LIST><NAME>${xe(n)}</NAME></NAME.LIST><PARENT>${xe(g)}</PARENT><ISBILLWISEON>No</ISBILLWISEON><AFFECTSSTOCK>No</AFFECTSSTOCK></LEDGER></TALLYMESSAGE>\n`).join('')).replace('All Masters', 'All Masters');
  }
  function tallyVouchers({ company, bankLedger, rows, bankAlloc = false }) {
    const f = n => (+n).toFixed(2);
    const body = rows.map(r => {
      const a = +r.dr || +r.cr, isDr = +r.dr > 0, led = r.l || 'Suspense A/c', vt = vtype(r, led), dt = ymd(r.d);
      const narr = [r.n, r.r && `Ref: ${r.r}`].filter(Boolean).join(' · ').slice(0, 900);
      const other = `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xe(led)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${isDr ? '-' : ''}${f(a)}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
      const alloc = bankAlloc ? `<BANKALLOCATIONS.LIST><DATE>${dt}</DATE><INSTRUMENTDATE>${dt}</INSTRUMENTDATE><TRANSACTIONTYPE>Others</TRANSACTIONTYPE>${r.r ? `<INSTRUMENTNUMBER>${xe(String(r.r).slice(0, 30))}</INSTRUMENTNUMBER>` : ''}<AMOUNT>${isDr ? '' : '-'}${f(a)}</AMOUNT></BANKALLOCATIONS.LIST>` : '';
      const bank = `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xe(bankLedger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDr ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE><AMOUNT>${isDr ? '' : '-'}${f(a)}</AMOUNT>${alloc}</ALLLEDGERENTRIES.LIST>`;
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${vt}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${dt}</DATE><EFFECTIVEDATE>${dt}</EFFECTIVEDATE><VOUCHERTYPENAME>${vt}</VOUCHERTYPENAME><PARTYLEDGERNAME>${xe(led)}</PARTYLEDGERNAME><NARRATION>${xe(narr)}</NARRATION><PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>${isDr ? other + bank : bank + other}</VOUCHER></TALLYMESSAGE>\n`;
    }).join('');
    return env(company, body).replace('All Masters', 'Vouchers');
  }
  return { date, amt, role, toLines, headerAt, fromLines, fromLinesLoose, fromSheet, finish, check, meta, parseLines, parseSheet, party, ledgerFor, vtype, tallyLedgers, tallyVouchers, BUILTIN, DEFAULT_GROUP, summaryNotes };
})();

/* ---------- reading a file ---------- */
async function pdfItems(doc, maxPages) {
  const items = []; let chars = 0;
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    for (const it of tc.items) { const s = it.str; if (!s || !s.trim()) continue; const x = it.transform[4], y = vp.height - it.transform[5], h = Math.abs(it.transform[3]) || it.height || 8; items.push({ s, x0: x, x1: x + (it.width || s.length * h * 0.5), y, h, p }); chars += s.trim().length; }
  }
  return { items, chars };
}
async function ocrItems(canvases, note) {
  const w = await ocrWorker(note), items = [];
  for (let i = 0; i < canvases.length; i++) {
    note(`Text recognition: page ${i + 1} of ${canvases.length}…`);
    const r = await w.recognize(canvases[i], {}, { blocks: true, text: true });
    const D = r.data || {};
    const words = D.words && D.words.length ? D.words : (D.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => (p.lines || []).flatMap(l => l.words || [])));
    for (const wd of words) { const b = wd.bbox; if (!wd.text || !wd.text.trim() || (wd.confidence != null && wd.confidence < 15)) continue; items.push({ s: wd.text.trim(), x0: b.x0, x1: b.x1, y: b.y1, h: b.y1 - b.y0, p: i + 1 }); }
  }
  return items;
}
const BANK_FMT = /\.(pdf|xlsx|xls|csv|jpe?g|png|webp|bmp)$/i;
async function bankReadFile(file, { note = () => {}, askPassword } = {}) {
  const name = file.name || 'statement';
  if (/\.(xlsx|xls|csv)$/i.test(name)) {
    note('Reading the spreadsheet…');
    const res = BANK.parseSheet(await readSheets(file));
    if (!res) throw new Error('Could not find the transaction table (Date / Narration / Debit / Credit / Balance) in this file');
    return { ...res, method: 'Excel / CSV' };
  }
  let canvases = [];
  if (/\.pdf$/i.test(name) || /pdf$/i.test(file.type)) {
    const pdfjs = await pdfLib(), bytes = new Uint8Array(await file.arrayBuffer());
    let doc = null, password = '';
    for (let tries = 0; !doc; tries++) {
      try { note('Opening PDF…'); doc = await pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false }).promise; }
      catch (e) {
        if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) {
          if (!askPassword || tries > 5) throw new Error('This PDF is locked with a password');
          password = await askPassword(tries > 0);
          if (password == null) throw new Error('Cancelled — the PDF needs its password');
        } else throw e;
      }
    }
    const { items, chars } = await pdfItems(doc, 80);
    if (chars > 80) {
      const res = BANK.parseLines(BANK.toLines(items));
      if (res && res.rows.length) return { ...res, method: password ? 'PDF text (unlocked)' : 'PDF text', pages: doc.numPages };
    }
    note('No text in the PDF — it looks scanned. Preparing pages…');
    for (let p = 1; p <= Math.min(doc.numPages, 15); p++) { const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 2.4 }), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; canvases.push(cv); }
  } else if (/^image\//i.test(file.type) || /\.(jpe?g|png|webp|bmp)$/i.test(name)) {
    canvases.push(canvasOf(await createImageBitmap(file), 3000));
  } else throw new Error('Use a PDF, Excel / CSV or a photo of the statement');
  const res = BANK.parseLines(BANK.toLines(await ocrItems(canvases, note)), { ocr: true });
  if (!res || !res.rows.length) throw new Error('Could not read transactions from the scanned pages — try a clearer scan, or Read with AI');
  return { ...res, method: 'Text recognition (scanned)', pages: canvases.length };
}
async function bankReadAi(file, clientId) {
  if (file.size > 9e6) throw new Error('File is over 9 MB — too big for AI reading');
  if (!/\.pdf$/i.test(file.name) && !/^image\//i.test(file.type)) throw new Error('AI reads PDF or photo statements only');
  const f = await fileB64(file, 2400);
  const j = await fnCall('bill-read', 'statement', { kind: 'statement', client_id: clientId, name: file.name, ...f });
  const s = j.statement || {};
  const raw = (s.transactions || []).map(t => ({ date: BANK.date(t.date) || '', desc: t.narration || '', ref: t.ref || '', dr: +t.debit ? { v: +t.debit } : undefined, cr: +t.credit ? { v: +t.credit } : undefined, bal: t.balance === '' || t.balance == null ? undefined : { v: +t.balance } })).filter(r => r.date);
  if (!raw.length) throw new Error('AI could not find transactions in this file');
  const res = BANK.finish(raw, { opening: s.opening_balance == null || s.opening_balance === '' ? null : +s.opening_balance });
  const meta = { bank: s.bank || '', acct: s.account_number || '', ifsc: s.ifsc || '', name: s.account_name || '', from: BANK.date(s.period_from) || '', to: BANK.date(s.period_to) || '', cb: +s.closing_balance || null };
  const notes = BANK.summaryNotes(res, meta);
  if (j.truncated) notes.unshift('The statement was too long for one AI reading — rows near the end may be missing. Check the closing balance.');
  return { ...res, meta, notes, method: `AI (${j.model || 'Claude'}) · about ₹${(+j.cost_inr || 0).toFixed(2)}` };
}

/* ---------- page ---------- */
const BK_GROUPS = ['Sundry Debtors', 'Sundry Creditors', 'Indirect Expenses', 'Direct Expenses', 'Indirect Incomes', 'Direct Incomes', 'Duties & Taxes', 'Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c', 'Capital Account',
  'Loans (Liability)', 'Secured Loans', 'Unsecured Loans', 'Loans & Advances (Asset)', 'Deposits (Asset)', 'Current Liabilities', 'Current Assets', 'Provisions', 'Fixed Assets', 'Investments', 'Purchase Accounts', 'Sales Accounts', 'Suspense A/c'];
const BK_PAGE = 200;
let bkCur = null, bkFile = null, bkDirty = false, bkFilter = 'all', bkQ = '', bkPg = 0, bkRules = [];
window.addEventListener('beforeunload', e => { if (bkDirty) { e.preventDefault(); e.returnValue = ''; } });
const bkState = () => (bkDirty ? '● Not downloaded yet' : bkCur && bkCur.id ? `Saved to ${(clientById(bkCur.client_id) || {}).name || 'client'}` : 'Downloaded');
function bkMarkDone() { bkDirty = false; const d = $('#bkDirty'); if (d) { d.textContent = bkState(); d.className = 'muted small'; } }
const bkMask = a => { const s = String(a || ''); return s.length > 4 ? '••' + s.slice(-4) : s; };
const bkInr = n => (+n < 0 ? '−₹' : '₹') + Math.abs(+n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bkAmt = n => (+n ? bkInr(n).replace('₹', '') : '');
const bkFix = n => (n == null || n === '' ? '' : (+n).toFixed(2));
function bkRecheck() { const c = BANK.check(bkCur.rows, +bkCur.opening || 0); Object.assign(bkCur, { flags: c.flags, bad: c.bad, dr: c.dr, cr: c.cr, closing: c.closing, nDr: c.nDr, nCr: c.nCr, sumOk: c.sumOk }); }
function bkApplyRules(all = false) {
  let n = 0;
  bkCur.rows.forEach(r => { if (!r.p) r.p = BANK.party(r.n); if (r.lm && !all) return; const x = BANK.ledgerFor(r, bkRules); if (x.ledger && (all || !r.l)) { if (r.l !== x.ledger) n++; r.l = x.ledger; r.lh = x.how; r.lm = 0; } });
  return n;
}
async function bkLoadRules(clientId) {
  const q = sb.from('bank_rules').select('*');
  const r = await safe((clientId ? q.or(`client_id.is.null,client_id.eq.${clientId}`) : q.is('client_id', null)).limit(2000));
  bkRules = r.error ? [] : r.data || [];
}

const bkTallyKey = a => 'jlr-bk-tally:' + String(a || '').replace(/\s/g, '');
function bkTallyLoad(a) { try { return JSON.parse(localStorage.getItem(bkTallyKey(a)) || '{}') || {}; } catch (e) { return {}; } }
function bkTallySave(a, t) { try { localStorage.setItem(bkTallyKey(a), JSON.stringify({ company: t.company, bank_ledger: t.bank_ledger, groups: t.groups, alloc: t.alloc })); } catch (e) { /* private window */ } }
function bkPickClient(title, note, saveText) {
  return new Promise(res => {
    const list = myClients().filter(c => c.active !== false); let done = false;
    if (!list.length) { toast('Add a client first', true); res(null); return; }
    const m = modal(title, `<p class="small muted" style="margin-top:0">${esc(note)}</p><label>Client<select name="c">${opts(list, (bkCur && bkCur.client_id) || '', c => c.name, c => c.id)}</select></label>`,
      { saveText, onSave: w => { done = true; res(fv(w, 'c') || null); } });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) res(null); } }); obs.observe(document.body, { childList: true });
  });
}

VIEWS.bank = async v => {
  const probe = await safe(sb.from('bank_statements').select('id').limit(1));
  if (probe.error) return notReady(v, 'Bank statement converter', 'update-session5.sql');
  v.innerHTML = `<div class="page-head"><h2>Bank statement converter</h2></div><div id="bkBody"><div class="loading">Loading…</div></div>`;
  const body = $('#bkBody', v);
  await bkLoadRules(bkCur && bkCur.client_id);
  if (bkCur) return bkEditor(body);
  bkHome(body);
};

async function bkHome(body) {
  const r = await safe(sb.from('bank_statements').select('id,client_id,bank,account,period_from,period_to,n_rows,bad,opening,closing,status,file_name,updated_at,created_by').order('updated_at', { ascending: false }).limit(50));
  const data = r.error ? [] : r.data || [];
  body.innerHTML = `<div class="card bk-drop" id="bkDrop" tabindex="0" role="button" aria-label="Choose a bank statement file">
      <div class="bk-drop-in"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
        <b>Drop a bank statement here, or click to choose</b>
        <span class="muted small">PDF (password-protected is fine) · Excel / CSV from net banking · scanned PDF or photo — any bank</span></div>
      <input type="file" id="bkFile" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,image/*,application/pdf" hidden></div>
    <p class="muted small" style="margin:8px 2px 16px">Convert → check → download Excel or Tally. Digital PDFs and Excel files are read on this computer for free; scanned statements use text recognition (slower — check the figures). Every row is checked against the running balance. The statement file is not stored.</p>
    <div class="toolbar"><button class="btn sm ghost" id="bkRules">Ledger rules (${bkRules.length})</button></div>
    ${data.length ? `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">Saved to a client</h3><div class="table-wrap"><table><thead><tr><th>Client</th><th>Bank</th><th>Account</th><th>Period</th><th class="r">Rows</th><th class="r">Closing</th><th>Check</th><th>Status</th><th></th></tr></thead><tbody>
        ${data.map(s => `<tr><td class="small">${esc((clientById(s.client_id) || {}).name || '—')}</td><td><b>${esc(s.bank || '—')}</b><div class="muted small">${esc(s.file_name || '')}</div></td><td>${esc(bkMask(s.account))}</td><td class="small">${s.period_from ? fmtDate(s.period_from) : ''} – ${s.period_to ? fmtDate(s.period_to) : ''}</td>
          <td class="r">${s.n_rows}</td><td class="r">${bkInr(s.closing)}</td><td>${s.bad ? `<span class="late">✗ ${s.bad}</span>` : '<span style="color:var(--green)">✓</span>'}</td><td class="small">${esc(s.status)}</td>
          <td class="row-btns"><button class="btn sm" data-open="${s.id}">Open</button>${isManager() || s.created_by === me.id ? `<button class="link small danger-t" data-del="${s.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  const pick = $('#bkFile', body), drop = $('#bkDrop', body);
  drop.onclick = () => pick.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.click(); } };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('on'); };
  drop.ondragleave = () => drop.classList.remove('on');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('on'); const f = e.dataTransfer.files[0]; if (f) bkStart(f); };
  pick.onchange = () => { if (pick.files[0]) bkStart(pick.files[0]); };
  $('#bkRules', body).onclick = () => bkRulesDialog(() => route());
  body.onclick = async e => {
    const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (o) { const { data: s } = await must(sb.from('bank_statements').select('*').eq('id', o.dataset.open).single()); bkCur = { ...s, rows: s.rows || [], tally: s.tally || {}, notes: s.notes || [] }; bkFile = null; bkDirty = false; bkFilter = 'all'; bkPg = 0; bkQ = ''; bkRecheck(); route(); }
    if (d && confirm('Delete this saved statement? (The ledger rules stay.)')) { await must(sb.from('bank_statements').delete().eq('id', d.dataset.del)); toast('Deleted'); route(); }
  };
}
function bkPassword(again) {
  return new Promise(res => {
    let done = false;
    const m = modal('Statement password', `<p class="small" style="margin-top:0">${again ? '<b class="late">That password did not open the file.</b> ' : ''}This PDF is locked. Banks usually use a mix of the name, date of birth, customer ID or mobile number — see the bank's email.</p>
      <label>Password<input type="password" name="pw" autocomplete="off" autofocus></label><p class="muted small">The password is used only on this computer to open the file. It is not saved.</p>`,
      { saveText: 'Open', onSave: w => { done = true; res(fv(w, 'pw')); } });
    const inp = $('[name=pw]', m.el); setTimeout(() => inp.focus(), 50);
    inp.onkeydown = e => { if (e.key === 'Enter') $('[data-save]', m.el).click(); };
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) res(null); } }); obs.observe(document.body, { childList: true });
  });
}
async function bkStart(file) {
  if (!BANK_FMT.test(file.name)) { toast('Use a PDF, Excel / CSV or a photo of the statement', true); return; }
  const body = $('#bkBody'); if (!body) return;
  body.innerHTML = `<div class="card"><h3 style="margin-top:0">Reading ${esc(file.name)}</h3><p id="bkNote" class="muted">Starting…</p><div class="bk-bar"><i></i></div></div>`;
  const note = t => { const n = $('#bkNote'); if (n) n.textContent = t; };
  try {
    const res = await bankReadFile(file, { note, askPassword: bkPassword });
    bkOpenResult(res, file);
  } catch (err) {
    body.innerHTML = `<div class="card"><h3 style="margin-top:0">Could not convert ${esc(file.name)}</h3><p class="late">${esc(friendly(err))}</p>
      <div class="toolbar"><button class="btn" id="bkBack">← Back</button>${/\.(pdf|jpe?g|png|webp)$/i.test(file.name) || /^(application\/pdf|image\/)/i.test(file.type) ? '<button class="btn primary" id="bkAi">Read with AI</button>' : ''}</div></div>`;
    $('#bkBack', body).onclick = () => route();
    const ai = $('#bkAi', body); if (ai) ai.onclick = () => bkAi(file);
  }
}
async function bkOpenResult(res, file) {
  const m = res.meta || {};
  const pt = bkTallyLoad(m.acct);
  const bank = m.bank || 'Bank';
  const dates = res.rows.map(r => r.d).filter(Boolean).sort();
  bkCur = { client_id: null, bank, account: m.acct || '', ifsc: m.ifsc || '', holder: m.name || '', period_from: m.from || dates[0] || null, period_to: m.to || dates[dates.length - 1] || null,
    opening: res.opening, file_name: file.name, method: res.method + (res.fixed ? ` · ${res.fixed} debit/credit swapped by balance` : ''), status: 'Draft', notes: res.notes || [],
    rows: res.rows.map(r => ({ ...r, p: BANK.party(r.n), l: '', lh: '', lm: 0 })), tally: { company: pt.company || '', bank_ledger: pt.bank_ledger || `${bank}${m.acct ? ' A/c ' + String(m.acct).slice(-4) : ''}`, groups: pt.groups || {}, alloc: !!pt.alloc } };
  bkFile = file; bkDirty = true; bkFilter = 'all'; bkPg = 0; bkQ = '';
  bkApplyRules(); bkRecheck();
  if (bkCur.bad) bkFilter = 'bad';
  bkEditor($('#bkBody'));
}
async function bkAi(file) {
  const cid = (bkCur && bkCur.client_id) || await bkPickClient('Read with AI', 'AI reading has a small cost, logged against a client. Which client is this statement for?', 'Continue');
  if (!cid) return;
  const ai = await aiAvailable(cid);
  if (!ai.ok) { toast(ai.why || 'AI reading is not set up — save a Claude key in Settings and deploy the bill-read function', true); return; }
  if (!confirm('Send this statement to Claude (Anthropic) to read? It costs a few rupees per statement and the file leaves this computer.')) return;
  const body = $('#bkBody');
  body.innerHTML = `<div class="card"><h3 style="margin-top:0">AI is reading ${esc(file.name)}</h3><p class="muted">This takes 20–60 seconds for a long statement…</p><div class="bk-bar"><i></i></div></div>`;
  try { await bkOpenResult(await bankReadAi(file, cid), file); bkCur.client_id = cid; }
  catch (err) { toast(friendly(err), true); route(); }
}

function bkEditor(body) {
  const S = bkCur, c = clientById(S.client_id);
  const ledgers = () => [...new Set([...S.rows.map(r => r.l).filter(Boolean), ...bkRules.map(r => r.ledger), ...BANK.BUILTIN.map(b => b.ledger), 'Suspense A/c'])].sort((a, b) => a.localeCompare(b));
  const vis = () => {
    const q = lc(bkQ);
    return S.rows.map((r, i) => i).filter(i => { const r = S.rows[i], f = S.flags[i] || {};
      if (bkFilter === 'bad' && f.ok !== false) return false; if (bkFilter === 'nol' && r.l) return false; if (bkFilter === 'dr' && !+r.dr) return false; if (bkFilter === 'cr' && !+r.cr) return false;
      return !q || lc(r.n + ' ' + r.r + ' ' + r.p + ' ' + r.l).includes(q) || String(r.dr).includes(q) || String(r.cr).includes(q); });
  };
  const rowHtml = i => { const r = S.rows[i], f = S.flags[i] || {};
    return `<tr data-i="${i}" class="${f.ok === false ? 'bk-bad' : ''}"><td><input type="checkbox" data-pick="${i}" aria-label="Select row ${i + 1}"></td><td class="muted small">${i + 1}</td>
      <td><input type="date" data-k="d" value="${esc(r.d || '')}" style="width:128px"></td><td><input data-k="n" value="${esc(r.n || '')}" style="width:300px" title="${esc(r.n || '')}"></td><td><input data-k="r" value="${esc(r.r || '')}" style="width:96px"></td>
      <td><input class="r" data-k="dr" value="${+r.dr ? bkFix(r.dr) : ''}" inputmode="decimal" style="width:96px"></td><td><input class="r" data-k="cr" value="${+r.cr ? bkFix(r.cr) : ''}" inputmode="decimal" style="width:96px"></td>
      <td><input class="r" data-k="b" value="${bkFix(r.b)}" inputmode="decimal" style="width:104px"></td>
      <td><input data-k="p" value="${esc(r.p || '')}" style="width:140px"></td><td><input autocomplete="off" data-k="l" value="${esc(r.l || '')}" list="bkLed" style="width:150px" class="${r.lh === 'auto' ? 'bk-auto' : ''}" title="${r.lh === 'rule' ? 'From a ledger rule' : r.lh === 'auto' ? 'Suggested from the narration' : ''}"></td>
      <td class="g1-auto small">${BANK.vtype(r, r.l)}</td><td class="g1-auto g1-chk ${f.ok === false ? 'bad' : 'ok'}" data-chk>${f.ok === false ? `✗ expected ${bkAmt(f.exp)}` : f.calc != null ? '<span class="muted">✓ (no balance)</span>' : '✓'}</td>
      <td><button class="link small danger-t" data-delrow="${i}" aria-label="Remove row ${i + 1}" title="Remove row">×</button></td></tr>`; };
  const stats = () => `<div class="mini blue"><span>Opening</span><b class="tp-amt">${bkInr(S.opening)}</b></div><div class="mini green"><span>Credits (${S.nCr})</span><b class="tp-amt">${bkInr(S.cr)}</b></div>
      <div class="mini amber"><span>Debits (${S.nDr})</span><b class="tp-amt">${bkInr(S.dr)}</b></div><div class="mini"><span>Closing</span><b class="tp-amt">${bkInr(S.closing)}</b></div>
      <div class="mini ${S.bad ? 'red' : 'green'}"><span>Balance check</span><b>${S.bad ? `✗ ${S.bad} row${S.bad > 1 ? 's' : ''}` : `✓ all ${S.rows.length}`}</b></div>`;
  const counts = () => ({ bad: S.flags.filter(f => f && f.ok === false).length, nol: S.rows.filter(r => !r.l).length });
  const draw = () => {
    const V = vis(), pages = Math.max(1, Math.ceil(V.length / BK_PAGE)); if (bkPg >= pages) bkPg = 0;
    const show = V.slice(bkPg * BK_PAGE, (bkPg + 1) * BK_PAGE), k = counts();
    body.innerHTML = `<div class="card bk-head"><div class="bk-title"><div><h3 style="margin:0">${esc(S.bank || 'Bank')} ${S.account ? '· A/c ' + esc(S.account) : ''}</h3>
        <div class="muted small">${c ? esc(c.name) + ' · ' : ''}${S.holder ? esc(S.holder) + ' · ' : ''}${S.ifsc ? 'IFSC ' + esc(S.ifsc) + ' · ' : ''}${S.period_from ? fmtDate(S.period_from) : '?'} – ${S.period_to ? fmtDate(S.period_to) : '?'} · ${esc(S.file_name || '')} · <span class="badge">${esc(S.method || '')}</span></div></div>
        <span class="spacer"></span><button class="btn sm ghost" id="bkMeta">Edit details</button><span class="${bkDirty ? 'late' : 'muted'} small" id="bkDirty">${bkState()}</span></div>
      <div class="bento-stats stats5" id="bkStats" style="margin-top:12px">${stats()}</div>
      ${(S.notes || []).length ? `<ul class="small" style="margin:10px 0 0;padding-left:18px">${S.notes.map(n => `<li class="late">⚠ ${esc(n)}</li>`).join('')}</ul>` : ''}
      ${S.bad ? `<p class="note warn small" style="margin:10px 0 0">${S.bad} row${S.bad > 1 ? 's do' : ' does'} not tally with the printed balance — a figure was misread or a row is missing just above. Fix the amount (the check updates as you type)${bkFile && /\.pdf$|\.(jpe?g|png|webp)$/i.test(bkFile.name) ? ', or try <button class="link" id="bkAi">Read with AI</button>' : ''}.</p>` : ''}</div>
      <div class="toolbar bk-tools"><div class="seg">${[['all', `All ${S.rows.length}`], ['bad', `Not tallying ${k.bad}`], ['nol', `No ledger ${k.nol}`], ['dr', 'Debits'], ['cr', 'Credits']].map(([f, l]) => `<button data-f="${f}" class="${bkFilter === f ? 'on' : ''}">${l}</button>`).join('')}</div>
        <input type="search" id="bkQ" placeholder="Search narration, party, amount…" value="${esc(bkQ)}" style="min-width:200px"><span class="spacer"></span>
        <button class="btn sm" id="bkSetL">Set ledger for ticked</button><button class="btn sm" id="bkRe">Re-apply rules</button><button class="btn sm ghost" id="bkRules">Rules</button></div>
      <datalist id="bkLed">${ledgers().map(l => `<option value="${esc(l)}">`).join('')}</datalist>
      <div class="table-wrap g1-wrap"><table class="g1-grid bk-grid"><thead><tr><th><input type="checkbox" id="bkAll" aria-label="Tick all shown"></th><th>#</th><th>Date</th><th>Narration</th><th>Ref / Chq</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Party</th><th>Ledger</th><th class="g1-auto">Voucher</th><th class="g1-auto">Check</th><th></th></tr></thead>
        <tbody>${show.length ? show.map(rowHtml).join('') : `<tr><td colspan="13" class="empty">${bkFilter === 'bad' ? '✓ Every row tallies with the balance.' : 'Nothing to show.'}</td></tr>`}</tbody></table></div>
      <div class="toolbar" style="margin-top:8px">${pages > 1 ? `<button class="btn sm" data-pg="-1" ${bkPg ? '' : 'disabled'}>‹ Prev</button><span class="small">Rows ${bkPg * BK_PAGE + 1}–${Math.min(V.length, (bkPg + 1) * BK_PAGE)} of ${V.length}</span><button class="btn sm" data-pg="1" ${bkPg < pages - 1 ? '' : 'disabled'}>Next ›</button>` : ''}
        <button class="btn sm" id="bkAdd">+ Add row</button><label class="small">Opening balance <input id="bkOpen" class="r" value="${S.opening}" inputmode="decimal" style="width:120px"></label></div>
      <div class="card bk-foot"><div class="toolbar"><button class="btn" id="bkBack">← All statements</button><span class="spacer"></span>
        <button class="btn ghost" id="bkSave" title="Optional — keep this converted statement on a client's file">${S.client_id ? 'Save' : 'Save to client…'}</button><button class="btn primary" id="bkXl">Download Excel</button><button class="btn primary" id="bkTally">Tally XML…</button></div></div>`;
  };
  const dirty = () => { bkDirty = true; const d = $('#bkDirty', body); if (d) { d.textContent = bkState(); d.className = 'late small'; } };
  let tm;
  const refresh = () => { clearTimeout(tm); tm = setTimeout(() => {
    bkRecheck();
    $$('tbody tr[data-i]', body).forEach(tr => { const i = +tr.dataset.i, f = S.flags[i] || {}, td = $('[data-chk]', tr); tr.classList.toggle('bk-bad', f.ok === false);
      if (td) { td.className = `g1-auto g1-chk ${f.ok === false ? 'bad' : 'ok'}`; td.innerHTML = f.ok === false ? `✗ expected ${bkAmt(f.exp)}` : f.calc != null ? '<span class="muted">✓ (no balance)</span>' : '✓'; }
      const vt = tr.children[10]; if (vt) vt.textContent = BANK.vtype(S.rows[i], S.rows[i].l); });
    const st = $('#bkStats', body); if (st) st.innerHTML = stats();
    const k = counts(); const sb2 = $$('.bk-tools .seg button', body); if (sb2[1]) sb2[1].textContent = `Not tallying ${k.bad}`; if (sb2[2]) sb2[2].textContent = `No ledger ${k.nol}`;
  }, 150); };
  const setVal = (i, k, v) => {
    const r = S.rows[i]; if (!r) return;
    if (k === 'dr' || k === 'cr') { r[k] = v === '' ? 0 : Math.abs(num(v)); }
    else if (k === 'b') r.b = v === '' ? null : num(v);
    else if (k === 'l') { r.l = v.trim(); r.lm = 1; r.lh = ''; }
    else r[k] = v;
  };
  body.oninput = e => {
    const k = e.target.dataset.k;
    if (e.target.id === 'bkQ') { bkQ = e.target.value; clearTimeout(tm); tm = setTimeout(() => { bkPg = 0; draw(); const q = $('#bkQ', body); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); return; }
    if (e.target.id === 'bkOpen') { S.opening = num(e.target.value); dirty(); refresh(); return; }
    if (!k) return;
    const i = +e.target.closest('tr').dataset.i; setVal(i, k, e.target.value); dirty(); if (k !== 'l') refresh();
  };
  body.onchange = e => {
    if (e.target.dataset.k !== 'l') return;
    const i = +e.target.closest('tr').dataset.i, r = S.rows[i]; refresh();
    if (r.l && r.p) {                                       // same party, no ledger yet → same ledger
      let n = 0; S.rows.forEach((x, j) => { if (j !== i && !x.l && lc(x.p) === lc(r.p)) { x.l = r.l; x.lm = 1; n++; } });
      if (n) { toast(`Also set “${r.l}” on ${n} other row${n > 1 ? 's' : ''} for ${r.p}`); draw(); }
    }
  };
  body.onclick = async e => {
    const t = e.target, id = t.id;
    const f = t.closest('[data-f]'); if (f && f.closest('.bk-tools')) { bkFilter = f.dataset.f; bkPg = 0; draw(); return; }
    const pg = t.closest('[data-pg]'); if (pg) { bkPg += +pg.dataset.pg; draw(); body.scrollIntoView({ block: 'start' }); return; }
    const del = t.closest('[data-delrow]'); if (del) { S.rows.splice(+del.dataset.delrow, 1); dirty(); bkRecheck(); draw(); return; }
    if (id === 'bkAll') { $$('[data-pick]', body).forEach(x => { x.checked = t.checked; }); return; }
    if (id === 'bkAdd') { const last = S.rows[S.rows.length - 1] || {}; S.rows.push({ d: last.d || '', n: '', r: '', dr: 0, cr: 0, b: null, p: '', l: '', lm: 1 }); bkFilter = 'all'; bkPg = Math.floor((S.rows.length - 1) / BK_PAGE); dirty(); bkRecheck(); draw(); return; }
    if (id === 'bkAi' && bkFile) { bkAi(bkFile); return; }
    if (id === 'bkRe') { const n = bkApplyRules(); bkRecheck(); draw(); toast(n ? `${n} ledger${n > 1 ? 's' : ''} filled from the rules` : 'No new matches — rows you typed a ledger for are kept'); if (n) dirty(); return; }
    if (id === 'bkRules') { bkRulesDialog(() => { const n = bkApplyRules(); draw(); if (n) { dirty(); toast(`${n} ledger${n > 1 ? 's' : ''} filled`); } }); return; }
    if (id === 'bkSetL') {
      const P = $$('[data-pick]', body).filter(x => x.checked).map(x => +x.dataset.pick);
      if (!P.length) { toast('Tick the rows first', true); return; }
      modal(`Ledger for ${P.length} row${P.length > 1 ? 's' : ''}`, `<label>Ledger<input autocomplete="off" name="l" list="bkLed2" autofocus></label><datalist id="bkLed2">${ledgers().map(l => `<option value="${esc(l)}">`).join('')}</datalist>`,
        { saveText: 'Set', onSave: w => { const l = fv(w, 'l'); P.forEach(i => { S.rows[i].l = l; S.rows[i].lm = 1; S.rows[i].lh = ''; }); dirty(); draw(); } });
      return;
    }
    if (id === 'bkBack') { if (bkDirty && !confirm('Leave this statement? It has not been downloaded or saved.')) return; bkCur = null; bkDirty = false; route(); return; }
    if (id === 'bkMeta') {
      modal('Statement details', `<div class="form-grid"><label>Bank<input name="bank" value="${esc(S.bank || '')}"></label><label>Account number<input name="acct" value="${esc(S.account || '')}"></label>
        <label>IFSC<input name="ifsc" value="${esc(S.ifsc || '')}" class="up"></label><label>Account holder<input name="holder" value="${esc(S.holder || '')}"></label>
        <label>Period from<input type="date" name="from" value="${esc(S.period_from || '')}"></label><label>Period to<input type="date" name="to" value="${esc(S.period_to || '')}"></label></div>`,
        { saveText: 'Apply', onSave: w => { const oldL = S.tally.bank_ledger, autoL = `${S.bank}${S.account ? ' A/c ' + String(S.account).slice(-4) : ''}`;
          S.bank = fv(w, 'bank') || 'Bank'; S.account = fv(w, 'acct'); S.ifsc = fv(w, 'ifsc').toUpperCase(); S.holder = fv(w, 'holder'); S.period_from = fv(w, 'from') || null; S.period_to = fv(w, 'to') || null;
          if (!oldL || oldL === autoL) S.tally.bank_ledger = `${S.bank}${S.account ? ' A/c ' + String(S.account).slice(-4) : ''}`;
          dirty(); draw(); } });
      return;
    }
    if (id === 'bkXl') { bkExcel().then(() => { bkMarkDone(); bkLearn(); }).catch(err => toast(friendly(err), true)); return; }
    if (id === 'bkTally') { bkTallyDialog(); return; }
    if (id === 'bkSave') {
      if (!S.client_id) { const cid = await bkPickClient('Save to a client', 'Optional — keeps the converted rows and ledgers on the client so you can open them again later. Not needed to download.', 'Save'); if (!cid) return; S.client_id = cid; }
      t.disabled = true; try { await bkSave(); await bkLoadRules(S.client_id); draw(); bkLearn(); } catch (err) { toast(friendly(err), true); } t.disabled = false; }
  };
  draw();
}
// ledgers typed by hand for a party → offer (once) to remember them for the next statement
function bkLearn() {
  const S = bkCur; if (!S || S.asked) return;
  if (!S.client_id && !isManager()) return;                    // rules for all statements are kept by managers
  const learn = new Map();
  S.rows.forEach(r => { if (r.lm && r.l && r.p && r.p.length >= 4) { const k = lc(r.p) + '|' + (+r.dr ? 'dr' : 'cr'); if (!learn.has(k) && !bkRules.some(x => lc(x.match) === lc(r.p) && x.ledger === r.l)) learn.set(k, { match: r.p, dir: +r.dr ? 'dr' : 'cr', ledger: r.l }); } });
  if (!learn.size) return;
  S.asked = true;
  const L = [...learn.values()].slice(0, 40), cn = (clientById(S.client_id) || {}).name;
  modal('Remember these ledgers?', `<p class="small" style="margin-top:0">Next time a statement${cn ? ' for ' + esc(cn) : ''} has these parties, the ledger fills in by itself.</p>
    <div class="table-wrap"><table><thead><tr><th></th><th>When the party is</th><th>Debit / credit</th><th>Ledger</th></tr></thead><tbody>${L.map((x, i) => `<tr><td><input type="checkbox" data-lr="${i}" checked aria-label="Remember"></td><td>${esc(x.match)}</td><td>${x.dir === 'dr' ? 'Debit' : 'Credit'}</td><td><b>${esc(x.ledger)}</b></td></tr>`).join('')}</tbody></table></div>`,
    { saveText: 'Remember ticked', onSave: async w => { const pick = $$('[data-lr]', w).filter(x => x.checked).map(x => L[+x.dataset.lr]); if (!pick.length) return;
      const { data: ins } = await must(sb.from('bank_rules').insert(pick.map(x => ({ client_id: S.client_id || null, match: x.match, dir: x.dir, ledger: x.ledger }))).select()); bkRules.push(...(ins || [])); toast(`${pick.length} rule${pick.length > 1 ? 's' : ''} saved`); } });
}
async function bkSave() {
  const S = bkCur;
  const rec = { client_id: S.client_id, bank: S.bank, account: S.account || null, ifsc: S.ifsc || null, holder: S.holder || null, period_from: S.period_from || null, period_to: S.period_to || null,
    opening: S.opening, closing: S.closing, total_dr: S.dr, total_cr: S.cr, n_rows: S.rows.length, bad: S.bad, file_name: S.file_name, method: S.method, status: S.status === 'Exported' ? 'Exported' : S.bad ? 'Draft' : 'Checked',
    rows: S.rows.map(r => ({ d: r.d, vd: r.vd || '', n: r.n, r: r.r, dr: +r.dr || 0, cr: +r.cr || 0, b: r.b, p: r.p || '', l: r.l || '', lh: r.lh || '', lm: r.lm || 0 })), tally: S.tally, notes: S.notes || [] };
  if (S.id) rec.id = S.id;
  const { data } = await must(sb.from('bank_statements').upsert(rec).select('id,status').single());
  S.id = data.id; S.status = data.status; bkDirty = false; toast(`Saved to ${(clientById(S.client_id) || {}).name || 'the client'}`);
}
function bkRulesDialog(after) {
  const cid = bkCur && bkCur.client_id, c = clientById(cid), canAll = isManager();
  const draw = w => { const box = $('[data-rl]', w);
    box.innerHTML = `<div class="table-wrap" style="max-height:46vh"><table><thead><tr><th>Narration or party contains</th><th>Debit / credit</th><th>Ledger</th><th>For</th><th></th></tr></thead><tbody>
      ${bkRules.length ? bkRules.slice().sort((a, b) => (a.client_id ? 0 : 1) - (b.client_id ? 0 : 1) || lc(a.match).localeCompare(lc(b.match))).map(r => `<tr><td><b>${esc(r.match)}</b></td><td>${r.dir === 'dr' ? 'Debit' : r.dir === 'cr' ? 'Credit' : 'Either'}</td><td>${esc(r.ledger)}</td><td class="small">${r.client_id ? esc((clientById(r.client_id) || {}).name || 'Client') : 'All statements'}</td>
        <td>${!r.client_id && !isManager() ? '' : `<button class="link small danger-t" data-rdel="${r.id}">Delete</button>`}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No rules yet.</td></tr>'}</tbody></table></div>`; };
  const m = modal('Ledger rules', `<p class="small muted" style="margin-top:0">A rule fills the ledger when the narration (or the party name) contains the text. Built-in ones (cash, GST, TDS, bank charges, interest, salary) come last; rules for one client (when a statement is saved to a client) come first. Rows where you typed a ledger are never overwritten.${!cid && !canAll ? ' <b>Only a Manager can add rules for all statements.</b>' : ''}</p>
    <div data-rl></div>
    <div class="form-grid" style="margin-top:12px"><label>Narration / party contains<input name="m" placeholder="e.g. TNEB or SRI MURUGAN TRANSPORTS"></label><label>Ledger<input name="l" placeholder="e.g. Electricity charges"></label>
      <label>Debit / credit<select name="d"><option value="any">Either</option><option value="dr">Debit (payment)</option><option value="cr">Credit (receipt)</option></select></label>
      <label>For<select name="f">${canAll ? '<option value="all">All statements</option>' : ''}${cid ? `<option value="c">Only ${esc(c ? c.name : 'this client')}</option>` : ''}</select></label></div>`,
    { saveText: 'Add rule', extra: '', onSave: async w => {
      const mt = fv(w, 'm'), l = fv(w, 'l'); if (!mt || !l) { toast('Type the text and the ledger', true); return false; }
      if (!fv(w, 'f')) { toast('Only a Manager can add rules for all statements', true); return false; }
      const { data } = await must(sb.from('bank_rules').insert({ client_id: fv(w, 'f') === 'all' ? null : cid, match: mt, dir: fv(w, 'd'), ledger: l }).select().single());
      bkRules.push(data); $('[name=m]', w).value = ''; $('[name=l]', w).value = ''; draw(w); toast('Rule added'); return false; } });
  draw(m.el);
  m.el.addEventListener('click', async e => { const d = e.target.closest('[data-rdel]'); if (!d) return; await must(sb.from('bank_rules').delete().eq('id', d.dataset.rdel)); bkRules = bkRules.filter(r => r.id !== d.dataset.rdel); draw(m.el); });
  const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (after) after(); } }); obs.observe(document.body, { childList: true });
}
function bkLedgerGroups() {
  const S = bkCur, use = {};
  S.rows.forEach(r => { const l = r.l || 'Suspense A/c'; const u = use[l] = use[l] || { n: 0, dr: 0, cr: 0 }; u.n++; u.dr += +r.dr || 0; u.cr += +r.cr || 0; });
  const G = {};
  for (const [l, u] of Object.entries(use)) G[l] = S.tally.groups[l] || BANK.DEFAULT_GROUP[l] || (l === 'Suspense A/c' ? 'Suspense A/c' : u.cr > u.dr ? 'Sundry Debtors' : 'Sundry Creditors');
  return { use, G };
}
function bkTallyDialog() {
  const S = bkCur, T = S.tally, { use, G } = bkLedgerGroups();
  const noL = S.rows.filter(r => !r.l).length;
  const m = modal('Export to Tally (Tally Prime / ERP 9)', `${S.bad ? `<p class="note warn small" style="margin-top:0">${S.bad} row${S.bad > 1 ? 's do' : ' does'} not tally with the balance. Fix them first, or the books will not match the bank.</p>` : ''}
    ${noL ? `<p class="note small">${noL} row${noL > 1 ? 's have' : ' has'} no ledger — they go to <b>Suspense A/c</b>.</p>` : ''}
    <div class="form-grid"><label>Tally company name <span class="muted small">(blank = the company open in Tally)</span><input name="co" value="${esc(T.company || '')}"></label>
      <label>Bank ledger name in Tally<input name="bl" value="${esc(T.bank_ledger || '')}"></label>
      <label class="full"><span><input type="checkbox" name="al" ${T.alloc ? 'checked' : ''}> Add cheque / reference details for bank reconciliation (turn off if Tally reports an error)</span></label></div>
    <h4 style="margin:14px 0 6px">Ledgers and their Tally groups</h4>
    <div class="table-wrap" style="max-height:40vh"><table><thead><tr><th>Ledger</th><th class="r">Rows</th><th class="r">Debits</th><th class="r">Credits</th><th>Group (used when the ledger is created)</th></tr></thead><tbody>
      ${Object.entries(use).sort((a, b) => b[1].n - a[1].n).map(([l, u]) => `<tr><td><b>${esc(l)}</b></td><td class="r">${u.n}</td><td class="r">${bkAmt(u.dr)}</td><td class="r">${bkAmt(u.cr)}</td><td><select data-g="${esc(l)}">${opts(BK_GROUPS, G[l])}</select></td></tr>`).join('')}</tbody></table></div>
    <ol class="small muted" style="margin:12px 0 0;padding-left:18px"><li><b>Ledgers file</b> first — creates the bank ledger and any missing ledgers (ones that already exist are skipped by Tally).</li>
      <li><b>Vouchers file</b> — Payment for debits, Receipt for credits, Contra for cash.</li>
      <li>Tally Prime: Alt+O Import → Masters (ledgers file), then Transactions (vouchers file). ERP 9: Gateway → Import Data → Masters / Vouchers.</li></ol>`,
    { wide: true, extra: '<button class="btn" data-dl="led">Download ledgers XML</button><button class="btn primary" data-dl="vch">Download vouchers XML</button>' });
  const read = () => { T.company = fv(m.el, 'co'); T.bank_ledger = fv(m.el, 'bl') || 'Bank'; T.alloc = $('[name=al]', m.el).checked; $$('[data-g]', m.el).forEach(s => { T.groups[s.dataset.g] = s.value; }); bkTallySave(S.account, T); };
  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-dl]'); if (!b) return; read();
    const base = `${slug(S.bank)}-${String(S.account || '').slice(-4)}-${S.period_from || ''}-${S.period_to || ''}`.replace(/-+/g, '-');
    if (b.dataset.dl === 'led') { const g = {}; Object.keys(use).forEach(l => { g[l] = T.groups[l] || G[l]; }); download(`tally-ledgers-${base}.xml`, BANK.tallyLedgers({ company: T.company, bankLedger: T.bank_ledger, bankGroup: S.closing < 0 ? 'Bank OD A/c' : 'Bank Accounts', ledgers: g }), 'application/xml'); }
    else { download(`tally-vouchers-${base}.xml`, BANK.tallyVouchers({ company: T.company, bankLedger: T.bank_ledger, rows: S.rows.filter(r => +r.dr || +r.cr), bankAlloc: T.alloc }), 'application/xml'); S.status = 'Exported'; }
    toast('Downloaded'); if (b.dataset.dl === 'vch') { bkMarkDone(); setTimeout(bkLearn, 300); }
  });
}
async function bkExcel() {
  const S = bkCur, X = await loadXlsxFull(), wb = X.utils.book_new();
  const D = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : d; };
  const ws = X.utils.aoa_to_sheet([['Date', 'Value date', 'Narration', 'Ref / Chq no.', 'Debit', 'Credit', 'Balance', 'Party', 'Ledger', 'Voucher type', 'Check'],
    ...S.rows.map((r, i) => { const f = S.flags[i] || {}; return [D(r.d), r.vd ? D(r.vd) : '', r.n, r.r, +r.dr || null, +r.cr || null, r.b == null ? null : +r.b, r.p || '', r.l || '', BANK.vtype(r, r.l), f.ok === false ? `Does not tally – expected ${f.exp}` : 'OK']; })],
    { cellDates: true, dateNF: 'dd-mm-yyyy' });
  ws['!cols'] = [{ wch: 11 }, { wch: 11 }, { wch: 60 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 26 }, { wch: 22 }, { wch: 10 }, { wch: 26 }];
  ws['!autofilter'] = { ref: `A1:K${S.rows.length + 1}` };
  X.utils.book_append_sheet(wb, ws, 'Transactions');
  const sum = X.utils.aoa_to_sheet([...(S.client_id ? [['Client', (clientById(S.client_id) || {}).name || '']] : []), ['Bank', S.bank], ['Account', S.account], ['IFSC', S.ifsc], ['Account holder', S.holder], ['Period', `${S.period_from || ''} to ${S.period_to || ''}`], [],
    ['Opening balance', S.opening], ['Total credits', S.cr], ['Total debits', S.dr], ['Closing balance', S.closing], ['Credits (count)', S.nCr], ['Debits (count)', S.nDr], [],
    ['Balance check', S.bad ? `${S.bad} row(s) do not tally` : 'All rows tally'], ['Read by', S.method], ['File', S.file_name], ['Converted by', me.full_name || me.email], ['On', today()], ...(S.notes || []).map(n => ['Note', n])]);
  sum['!cols'] = [{ wch: 18 }, { wch: 60 }];
  X.utils.book_append_sheet(wb, sum, 'Summary');
  const { use, G } = bkLedgerGroups();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Ledger', 'Tally group', 'Rows', 'Debits', 'Credits'], ...Object.entries(use).map(([l, u]) => [l, G[l], u.n, Math.round(u.dr * 100) / 100, Math.round(u.cr * 100) / 100])]), 'Ledger summary');
  X.writeFile(wb, `${S.holder ? slug(S.holder).slice(0, 30) + '-' : ''}${slug(S.bank)}-${String(S.account || '').slice(-4)}-${S.period_from || ''}-to-${S.period_to || ''}.xlsx`.replace(/-+/g, '-'));
}


/* =====================================================================
   v23  AI HELP CHAT  +  NOTICE REPLY DRAFT
   Uses the Edge Function "assistant" (Claude key from Settings → Bill reading).
   Without a key both still work: the chat answers from the built-in guide,
   and the notice draft is a ready letter format with blanks to fill.
   ===================================================================== */
const HELP = {
  noKey: false,
  // offline guide: [keywords, answer, [ [label, route] ...] ]
  topics: [
    [['start', 'new', 'joiner', 'begin', 'first day', 'tour', 'features', 'what can', 'overview', 'menu', 'kya hai', 'enna'],
      'Welcome! The menu on the left is grouped by work: **Overview** (Dashboard, calendar, all your work and notices), **GST**, **TDS** and **MCA** (each with its work list, working page and notices), **Tools** (bank statements, late fee calculator, checklists, law updates), **Clients**, and **Payments & billing**. Start each day on the Dashboard — it shows what is overdue and due this week.',
      [['Dashboard', 'dashboard'], ['My work', 'work'], ['Due-date calendar', 'calendar']]],
    [['my work', 'my task', 'assigned', 'today', 'pending', 'overdue', 'what should i do'],
      'Your work is in **Overview → My work** (Managers see **All work**). Filter by month or status; click a row to update its status (Pending data → In progress → Ready to file → Filed), add the ARN and tick the checklist. The Dashboard shows your overdue and due-in-7-days items.',
      [['My work', 'work'], ['Dashboard', 'dashboard']]],
    [['gstr-1', 'gstr1', 'gstr 1', 'iff', 'sales', 'outward', 'json'],
      'GSTR-1 work is created automatically each month for monthly clients (IFF / quarterly GSTR-1 for QRMP). To prepare it: **GST → GST review** → pick client and month → load the sales data (Excel template or bills) → check the summary → download the **GSTR-1 JSON** and upload it on the GST portal. Then mark the work Filed with the ARN in **GST → GST work**.',
      [['GST review', 'gst'], ['GST work', 'work']]],
    [['3b', 'gstr-3b', 'gstr3b', 'itc', 'input', '2b', 'reconcil', 'purchase'],
      'For GSTR-3B open **GST → GST review**, pick the client and month, load purchases and the **GSTR-2B** — the Reconciliation tab shows matched, missing and mismatched bills. The summary gives the 3B figures. Purchase bills can be read with the bill reader (PDF or photo).',
      [['GST review', 'gst']]],
    [['tds', '26q', '24q', '27q', 'challan', 'deductee', '194', '393', 'form 16', 'traces', 'tcs'],
      'TDS has two places: **TDS → TDS / TCS work** for the quarterly returns and due dates, and **TDS → TDS working** for deductee-wise entries, challans and return data. Sections show both the old (1961 Act) and new (2025 Act) numbers.',
      [['TDS working', 'tds'], ['TDS work', 'work']]],
    [['mca', 'roc', 'aoc', 'mgt', 'dir-3', 'kyc', 'company', 'llp', 'agm', 'director'],
      '**MCA → Companies & LLPs** holds each company / LLP with its AGM date, ROC due dates (AOC-4, MGT-7, Form 11, Form 8) and directors with DIR-3 KYC. The filing work itself is in **MCA → MCA / ROC work**.',
      [['Companies & LLPs', 'mca'], ['MCA work', 'work']]],
    [['notice', 'scn', 'show cause', 'asmt', 'drc', 'demand', 'hearing', 'intimation', '143', '148', 'reply'],
      'Notices are under **Overview → All notices** (or GST / TDS / MCA notices in each group). Notice emails from the portals are added automatically; press **Check now** to look right away. Open a notice and use **Draft reply with AI** for a first draft, then edit, save and set the status to Reply drafted / Replied.',
      [['All notices', 'notices']]],
    [['bank', 'statement', 'tally', 'excel', 'convert', 'passbook'],
      '**Tools → Bank statements**: drop a bank statement (PDF, password PDF, Excel / CSV or a scan). Every row is checked against the running balance. Fill ledgers, then download **Excel** or **Tally XML** (ledgers first, then vouchers).',
      [['Bank statements', 'bank']]],
    [['late fee', 'interest', 'penalty', 'calculat', '234e', 'late'],
      '**Tools → Late fee calculator** works out GST late fee and interest, TDS late filing fee (234E) and interest, and ROC additional fees.',
      [['Late fee calculator', 'calc']]],
    [['client', 'gstin', 'pan', 'add client', 'new client', 'contact', 'master'],
      'Client details are in **Clients → Clients** (Managers) — GSTIN, PAN, TAN, CIN, email, phone, GST scheme, services and default staff. Use the top search box to find any client by name, GSTIN or PAN. New clients go through **Clients → Onboarding**.',
      [['Clients', 'clients'], ['Onboarding', 'onboarding']]],
    [['mail', 'email', 'attachment', 'data received', 'inbox', 'documents'],
      'Files that clients email to the office mailbox arrive in **Clients → Client mail**, matched to the client. From there mark the data received or import it into GST review.',
      [['Client mail', 'inbox']]],
    [['dsc', 'renew', 'expiry', 'lut', 'licence', 'license'],
      '**Clients → Renewals** tracks DSC, LUT, trade licences and other expiry dates, with reminders before they run out.',
      [['Renewals', 'renewals']]],
    [['bill', 'invoice', 'fee', 'payment received', 'outstanding', 'zoho'],
      'Fees and invoices are in **Payments & billing → Billing & fees** (Managers): fee list, invoices, payments received and outstanding.',
      [['Billing & fees', 'billing']]],
    [['tax payment', 'intimation', 'advance tax', 'pay tax', 'how much to pay'],
      '**Payments & billing → Tax payment intimation** sends clients the GST / TDS / advance tax amount to pay and the due date, by WhatsApp or email.',
      [['Tax payment intimation', 'taxpay']]],
    [['report', 'monthly report', 'performance', 'on time'],
      '**Clients → Monthly client reports** makes a status report to send to each client. Partners see office performance in **Office → Reports**.',
      [['Monthly client reports', 'clientreport']]],
    [['checklist', 'steps', 'procedure'],
      '**Tools → Checklists** has the step lists for each return; they appear inside each work item so you can tick them as you go.',
      [['Checklists', 'checklists']]],
    [['due date', 'calendar', 'when is', 'last date'],
      '**Overview → Due-date calendar** shows every statutory due date month by month, and Managers can create the work for many clients from it.',
      [['Due-date calendar', 'calendar']]],
    [['password', 'login', 'theme', 'dark', 'layout', 'install', 'phone', 'mobile'],
      'Click your name at the top right: **Theme & layout** (two layouts, light / dark), **Install app on this device** (works on phone too) and **Change password**.',
      []],
    [['whatsapp', 'reminder'],
      'Staff get WhatsApp reminders of their pending work, and Managers / Partners get alerts for new notices. Your phone number must be saved in Team & logins — ask the Admin.',
      []]
  ],
  find(q) {
    const s = ' ' + q.toLowerCase() + ' ';
    let best = null, score = 0;
    for (const t of this.topics) { const sc = t[0].reduce((a, k) => a + (s.includes(k) ? k.length : 0), 0); if (sc > score) { score = sc; best = t; } }
    return best;
  },
  md(t) {   // tiny, safe markdown: **bold**, [label](#/route), line breaks, numbered lines
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((#\/[a-z0-9\-]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');
  }
};

function mountHelp() {
  if ($('#helpFab')) return;
  const fab = document.createElement('button');
  fab.id = 'helpFab'; fab.className = 'help-fab'; fab.setAttribute('aria-label', 'Help — ask where to find things'); fab.title = 'Help';
  fab.innerHTML = `${navIcon('chat')}<span>Help</span>`;
  const pane = document.createElement('section');
  pane.id = 'helpPane'; pane.className = 'help-pane'; pane.hidden = true; pane.setAttribute('aria-label', 'Help chat');
  pane.innerHTML = `<header><b>Tracker help</b><span class="muted small" id="hpMode"></span><span class="spacer"></span><button class="icon-btn" id="hpX" aria-label="Close help">×</button></header>
    <div class="hp-log" id="hpLog" aria-live="polite"></div>
    <div class="hp-chips" id="hpChips">${['Show me around', 'Where is my work?', 'How do I file GSTR-1?', 'How do notices work?', 'Convert a bank statement'].map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form id="hpForm"><input id="hpIn" autocomplete="off" placeholder="Ask anything about the tracker…" aria-label="Your question"><button class="btn primary sm">Ask</button></form>`;
  document.body.append(fab, pane);
  const log = $('#hpLog', pane), hist = [];
  const say = (who, html) => { const d = document.createElement('div'); d.className = 'hp-msg ' + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  const offline = q => {
    const t = HELP.find(q);
    if (!t) return say('bot', `I'm not sure about that one. Try words like <i>GST</i>, <i>notice</i>, <i>TDS</i>, <i>bank statement</i> or <i>client</i> — or ask your Manager.${HELP.noKey && isAdmin() ? '<div class="muted small">Tip: add a Claude key in Settings → Bill reading and I can answer any question.</div>' : ''}`);
    say('bot', HELP.md(t[1]) + (t[2].length ? `<div class="hp-links">${t[2].filter(([, r]) => r !== 'clients' && r !== 'billing' || isManager()).map(([l, r]) => `<a class="btn sm" href="#/${r}">${esc(l)} →</a>`).join('')}</div>` : ''));
  };
  const ask = async q => {
    q = q.trim(); if (!q) return;
    $('#hpChips', pane).hidden = true;
    say('me', esc(q)); hist.push({ role: 'user', content: q });
    if (HELP.noKey) { offline(q); return; }
    const wait = say('bot wait', '<span class="dots"><i></i><i></i><i></i></span>');
    try {
      const j = await fnCall('assistant', 'help', { mode: 'help', messages: hist, page: location.hash });
      wait.remove(); say('bot', HELP.md(j.text || '…')); hist.push({ role: 'assistant', content: j.text || '' });
      $('#hpMode', pane).textContent = '· AI';
    } catch (e) {
      wait.remove(); hist.pop();
      if (/no_key|Could not reach|not found|404/i.test(e.message)) { HELP.noKey = true; $('#hpMode', pane).textContent = '· built-in guide'; }
      else say('bot', `<span class="muted small">${esc(e.message)} — answering from the built-in guide:</span>`);
      offline(q);
    }
  };
  const open = on => { pane.hidden = !on; fab.classList.toggle('on', on); if (on) { if (!log.children.length) say('bot', `Hi ${esc((me.full_name || '').split(' ')[0] || '')}! I can tell you what each part of the tracker does and where to find it. Ask a question or pick one below.`); setTimeout(() => $('#hpIn', pane).focus(), 50); } };
  fab.onclick = () => open(pane.hidden);
  $('#hpX', pane).onclick = () => open(false);
  $('#hpForm', pane).onsubmit = e => { e.preventDefault(); const i = $('#hpIn', pane); const q = i.value; i.value = ''; ask(q); };
  $('#hpChips', pane).onclick = e => { const q = e.target.dataset.q; if (q) ask(q === 'Show me around' ? 'Give me a tour of the features' : q); };
  log.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]') && innerWidth < 700) open(false); });
}

/* ---------- notice reply draft ---------- */
function noticeLetter(n) {          // ready letter format when AI is not available
  const c = clientById(n.client_id) || {}, d = n.dept === 'ROC/MCA' ? 'MCA' : n.dept;
  const idl = [c.gstin && 'GSTIN: ' + c.gstin, c.pan && 'PAN: ' + c.pan, c.tan && 'TAN: ' + c.tan, c.cin && 'CIN / LLPIN: ' + c.cin].filter(Boolean).join(' | ');
  const to = { GST: 'The Proper Officer,\n[Designation, Range / Circle]\n[Office of the GST department]', TDS: 'The Assessing Officer (TDS) / CPC-TDS,\n[Ward / Circle]', 'MCA': 'The Registrar of Companies,\n[ROC, State]', Other: 'The Assessing Officer,\n[Ward / Circle]' }[d] || 'The Proper Officer';
  const form = /ASMT-10/i.test(n.notice_type) ? 'Form GST ASMT-11' : /DRC-01A/i.test(n.notice_type) ? 'Form GST DRC-01A Part B' : /DRC-01|73|74/i.test(n.notice_type) ? 'Form GST DRC-06' : /REG/i.test(n.notice_type) ? 'the reply form on the GST portal (REG-04 / REG-18)' : /143|148|142|139|245/.test(n.notice_type) ? 'the e-Proceedings response on the Income-tax portal' : d === 'TDS' ? 'a correction statement on TRACES' : 'the portal';
  return `Date: ${fmtDate(today())}

To,
${to}

Subject: Reply to ${n.notice_type || 'notice'}${n.ref_no ? ' – Ref / DIN ' + n.ref_no : ''}${n.period ? ' – ' + n.period : ''}
In the case of: ${c.name || '[Client name]'}${idl ? '\n' + idl : ''}

Respected Sir / Madam,

We refer to the above notice dated ${n.notice_date ? fmtDate(n.notice_date) : '[notice date]'}${n.amount ? ' involving an amount of Rs. ' + inr(n.amount).replace('₹', '') : ''}. On behalf of our client, we submit as follows:

1. [Point raised in the notice] – [Our explanation, with figures from books / returns]
2. [Point raised in the notice] – [Our explanation]
3. [Any reconciliation or reason for difference]

In view of the above, we request you to kindly accept this reply and drop the proceedings. If any further information is needed, we request an opportunity of personal hearing.

Documents enclosed:
a) [Reconciliation statement]
b) [Copies of returns / invoices / ledgers]
c) Authorisation letter

Thanking you,
Yours faithfully,
For ${c.name || '[Client name]'}

[Authorised signatory]
${firmName()} (Authorised representative)

---
Points to check before filing:
• Fill every [ … ] with facts from the books.
• File through ${form} before ${n.reply_due ? fmtDate(n.reply_due) : 'the due date'}.
• Attach the reconciliation and supporting documents.
• Keep the acknowledgement number and enter it here.`;
}
async function aiNoticeDraft(el, n, btn) {
  const ta = $('[name="draft_reply"]', el);
  if (!n.id) { ta.value = noticeLetter({ ...n, client_id: fv(el, 'client_id'), notice_type: fv(el, 'notice_type'), ref_no: fv(el, 'ref_no'), period: fv(el, 'period'), notice_date: fv(el, 'notice_date'), reply_due: fv(el, 'reply_due'), amount: fv(el, 'amount'), dept: fv(el, 'dept') }); ta.rows = 14; toast('Letter format filled in — save the notice first to get an AI draft'); return; }
  const m = modal('Draft reply with AI', `<p class="small" style="margin-top:0">Claude drafts the reply from the notice details. For a better draft paste the notice text and add your explanation. The draft is for a CA to check — it never files anything.</p>
    <label class="full">Text of the notice (copy from the PDF / portal — optional)<textarea id="aiNt" rows="7" placeholder="Paste the notice here…"></textarea></label>
    <label class="full">Your facts / explanation (optional)<textarea id="aiFc" rows="4" placeholder="e.g. Difference is due to credit notes of ₹2.1 lakh issued in March, shown in GSTR-1 of April…"></textarea></label>
    ${ta.value.trim() ? '<label class="check"><input type="checkbox" id="aiImp" checked> Improve the current draft instead of starting again</label>' : ''}`, { saveText: 'Write the draft', onSave: async () => {
      const go = $('[data-save]', m.el); go.disabled = true; go.textContent = 'Writing… (up to a minute)';
      try {
        if (ta.value.trim() !== (n.draft_reply || '').trim()) await must(sb.from('notices').update({ draft_reply: ta.value || null }).eq('id', n.id));
        const j = await fnCall('assistant', 'notice_reply', { mode: 'notice_reply', notice_id: n.id, notice_text: $('#aiNt', m.el).value, facts: $('#aiFc', m.el).value, improve: !!($('#aiImp', m.el) || {}).checked });
        ta.value = j.text || ''; ta.rows = 16;
        await safe(sb.from('notices').update({ draft_reply: ta.value, draft_at: new Date().toISOString(), ...(n.status === 'Open' ? { status: 'Reply drafted' } : {}) }).eq('id', n.id));
        n.draft_reply = ta.value; if (n.status === 'Open') { n.status = 'Reply drafted'; const st = $('[name="status"]', el); if (st) st.value = 'Reply drafted'; }
        toast(`Draft written${j.cost_inr ? ` · cost ₹${(+j.cost_inr).toFixed(2)}` : ''} — check every point before use`);
      } catch (e) {
        if (/no_key|Could not reach/i.test(e.message)) { if (!ta.value.trim()) ta.value = noticeLetter(n); ta.rows = 16; toast('AI is not set up — the standard letter format is filled in instead' + (isAdmin() ? ' (add a Claude key in Settings → Bill reading)' : ''), true); }
        else { toast(friendly(e), true); go.disabled = false; go.textContent = 'Write the draft'; return false; }
      }
    } });
}


/* =====================================================================
   v24  CLIENT HEALTH SCORE  (#/health, Managers & Partners)
   100 points, minus: overdue work, late filings (6 months), data waiting near the due date,
   reminders ignored, open / overdue notices, unpaid fees. Green ≥ 80 · Amber 50–79 · Red < 50
   ===================================================================== */
const HEALTH = {
  RULES: [
    // key, label, points each, max points, colour of the chip
    ['overdue', n => `${n} return${n > 1 ? 's' : ''} overdue`, 15, 45, 'red'],
    ['nlate', n => `${n} notice repl${n > 1 ? 'ies' : 'y'} overdue`, 20, 40, 'red'],
    ['nopen', n => `${n} open notice${n > 1 ? 's' : ''}`, 8, 24, 'amber'],
    ['late', n => `${n} filed late (6 months)`, 5, 20, 'amber'],
    ['waiting', n => `${n} waiting for data, due soon`, 5, 15, 'amber'],
    ['ignored', n => `${n} reminders, no reply`, 10, 10, 'amber'],
    ['fee90', n => `fees unpaid > 90 days`, 15, 15, 'red'],
    ['fee30', n => `fees unpaid 31–90 days`, 8, 8, 'amber']
  ],
  score(c, D, t) {
    const in5 = iso(addDays(new Date(t + 'T00:00:00'), 5)), back = iso(addDays(new Date(t + 'T00:00:00'), -183)), b30 = iso(addDays(new Date(t + 'T00:00:00'), -30)), b90 = iso(addDays(new Date(t + 'T00:00:00'), -90));
    const tk = D.tasks.filter(r => r.client_id === c.id && r.status !== 'Not applicable');
    const open = tk.filter(r => r.status !== 'Filed');
    const items = {
      overdue: open.filter(r => r.due_date && r.due_date < t),
      late: tk.filter(r => r.status === 'Filed' && r.filed_on && r.due_date && r.filed_on > r.due_date && r.due_date >= back),
      waiting: open.filter(r => r.status === 'Pending data' && r.due_date && r.due_date >= t && r.due_date <= in5),
      nlate: D.notices.filter(n => n.client_id === c.id && isOpenNotice(n.status) && n.status !== 'Hearing' && n.reply_due && n.reply_due < t),
      nopen: [], ignored: [], fee90: [], fee30: []
    };
    items.nopen = D.notices.filter(n => n.client_id === c.id && n.status !== 'Closed' && !items.nlate.includes(n));
    const rounds = new Set((D.chase || []).filter(l => l.client_id === c.id && l.kind === 'client' && l.created_at >= b30 && l.status !== 'failed' && l.status !== 'skipped').map(l => l.round_no));
    if (rounds.size >= 3 && open.some(r => r.status === 'Pending data')) items.ignored = [...rounds];
    const unpaid = (D.invoices || []).filter(i => i.client_id === c.id && num(i.total) - num(i.paid) > 0.009);
    const old = unpaid.filter(i => i.inv_date && i.inv_date < b90), mid = unpaid.filter(i => i.inv_date && i.inv_date < b30 && i.inv_date >= b90);
    if (old.length) items.fee90 = old; else if (mid.length) items.fee30 = mid;
    let s = 100; const reasons = [];
    for (const [k, lab, each, max, tone] of this.RULES) {
      const n = items[k].length; if (!n) continue;
      const lose = Math.min(max, n * each); s -= lose;
      reasons.push({ k, text: k === 'ignored' ? lab(n) : lab(n), lose, tone });
    }
    const due = unpaid.reduce((a, i) => a + num(i.total) - num(i.paid), 0);
    s = Math.max(0, s);
    return { c, score: s, level: s >= 80 ? 'green' : s >= 50 ? 'amber' : 'red', reasons: reasons.sort((a, b) => b.lose - a.lose), items, due };
  },
  async load() {
    const t = today(), from = iso(addDays(new Date(), -200));
    const [tk, nt, iv, ch] = await Promise.all([
      must(sb.from('tasks').select('id,client_id,return_name,period,due_date,status,filed_on,assigned_to').gte('due_date', from).limit(20000)),
      safe(sb.from('notices').select('id,client_id,dept,notice_type,status,reply_due,ref_no').neq('status', 'Closed').limit(5000)),
      P4() ? safe(sb.from('invoices').select('id,client_id,inv_no,inv_date,total,paid').limit(10000)) : Promise.resolve({ data: [] }),
      safe(sb.from('chase_log').select('client_id,kind,round_no,status,created_at').gte('created_at', iso(addDays(new Date(), -31))).limit(10000))
    ]);
    const D = { tasks: tk.data || [], notices: nt.error ? [] : nt.data || [], invoices: iv.error ? [] : iv.data || [], chase: ch.error ? [] : ch.data || [] };
    return clients.filter(c => c.active).map(c => this.score(c, D, t)).sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name));
  }
};
let hf = { level: '', staff: '', q: '' };
VIEWS.health = async v => {
  await loadRefs();
  v.innerHTML = '<div class="loading">Working out client health…</div>';
  const all = await HEALTH.load();
  const cnt = l => all.filter(x => x.level === l).length;
  v.innerHTML = `<div class="page-head"><h2>Client health</h2><span class="muted">${all.length} active clients</span><span class="spacer"></span><button class="btn ghost sm" id="hHow">How is it scored?</button></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <button class="mini red" data-hl="red"><span>Needs attention</span><b>${cnt('red')}</b></button>
      <button class="mini amber" data-hl="amber"><span>Watch</span><b>${cnt('amber')}</b></button>
      <button class="mini green" data-hl="green"><span>Healthy</span><b>${cnt('green')}</b></button>
      <button class="mini blue" data-hl=""><span>Average score</span><b>${all.length ? Math.round(all.reduce((a, x) => a + x.score, 0) / all.length) : '—'}</b></button></div>
    <div class="toolbar"><select id="hL"><option value="">All clients</option><option value="red">Red — needs attention</option><option value="amber">Amber — watch</option><option value="green">Green — healthy</option></select>
      <select id="hS"><option value="">All staff</option>${opts(activeStaff(), hf.staff, p => p.full_name || p.email, p => p.id)}</select>
      <input type="search" id="hQ" placeholder="Search client" value="${esc(hf.q)}"></div><div id="hList"></div>`;
  $('#hL').value = hf.level;
  const render = () => {
    const s = hf.q.toLowerCase();
    const list = all.filter(x => (!hf.level || x.level === hf.level) && (!hf.staff || x.c.default_staff === hf.staff) && (!s || x.c.name.toLowerCase().includes(s)));
    $('#hList').innerHTML = list.length ? `<div class="table-wrap"><table class="hl-table"><thead><tr><th>Client</th><th>Score</th><th>Why</th><th>Staff</th><th></th></tr></thead><tbody>
      ${list.map(x => `<tr class="hl-${x.level}" data-hc="${x.c.id}">
        <td class="wrap"><b>${esc(x.c.name)}</b><div class="muted small">${esc([x.c.gstin || x.c.pan, x.c.phone].filter(Boolean).join(' · '))}</div></td>
        <td><span class="hscore ${x.level}" title="${x.score} / 100">${x.score}</span><div class="hbar"><i class="${x.level}" style="width:${x.score}%"></i></div></td>
        <td class="wrap">${x.reasons.length ? x.reasons.map(r => `<span class="chip ${r.tone}" title="−${r.lose}">${esc(r.text)}</span>`).join(' ') : '<span class="muted small">All on time</span>'}${x.due > 0.009 ? `<div class="muted small">Unpaid ${inr(x.due)}</div>` : ''}</td>
        <td>${esc(profName(x.c.default_staff) || '—')}</td>
        <td class="nowrap"><button class="btn sm" data-hd="${x.c.id}">Details</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="table-wrap"><div class="empty">No clients here.</div></div>';
  };
  render();
  $('#hL').onchange = e => { hf.level = e.target.value; render(); };
  $('#hS').onchange = e => { hf.staff = e.target.value; render(); };
  $('#hQ').oninput = e => { hf.q = e.target.value; render(); };
  $$('[data-hl]', v).forEach(b => b.onclick = () => { hf.level = b.dataset.hl; $('#hL').value = hf.level; render(); });
  $('#hHow').onclick = () => modal('How the health score works', `<p class="small" style="margin-top:0">Every active client starts at <b>100</b>. Points come off for:</p>
    <table class="small"><tbody>${HEALTH.RULES.map(([k, lab, each, max]) => `<tr><td>${esc(lab(2).replace(/^2 /, '').replace(/^fees/, 'Fees'))}</td><td class="r">−${each}${each !== max ? ' each, up to −' + max : ''}</td></tr>`).join('')}</tbody></table>
    <p class="small"><span class="hscore green">80+</span> healthy · <span class="hscore amber">50–79</span> watch · <span class="hscore red">below 50</span> needs attention. It updates every time the page opens.</p>`);
  $('#hList').onclick = e => {
    const id = (e.target.closest('[data-hd]') || {}).dataset?.hd; if (!id) return;
    const x = all.find(y => y.c.id === id), I = x.items;
    const sec = (title, rows) => rows.length ? `<h4 style="margin:14px 0 6px">${esc(title)}</h4><ul class="small hl-ul">${rows.join('')}</ul>` : '';
    const tl = r => `<li>${esc(r.return_name)} · ${esc(r.period || '')} — due ${fmtDate(r.due_date)}${r.filed_on ? ', filed ' + fmtDate(r.filed_on) : ''} <span class="muted">(${esc(profName(r.assigned_to) || 'unassigned')})</span></li>`;
    const m = modal(`${x.c.name} — ${x.score} / 100`, `<p style="margin-top:0"><span class="hscore ${x.level}">${x.score}</span> ${x.level === 'green' ? 'Healthy' : x.level === 'amber' ? 'Watch' : 'Needs attention'}</p>
      ${sec('Overdue work', I.overdue.map(tl))}${sec('Waiting for data, due within 5 days', I.waiting.map(tl))}${sec('Filed late in the last 6 months', I.late.map(tl))}
      ${sec('Notices', [...I.nlate, ...I.nopen].map(n => `<li>${esc(n.dept === 'ROC/MCA' ? 'MCA' : n.dept)} ${esc(n.notice_type)}${n.ref_no ? ' · ' + esc(n.ref_no) : ''} — reply ${n.reply_due ? 'by ' + fmtDate(n.reply_due) : 'date not set'}${I.nlate.includes(n) ? ' <b class="late">overdue</b>' : ''}</li>`))}
      ${sec('Unpaid fees', [...I.fee90, ...I.fee30].map(i => `<li>Invoice ${esc(i.inv_no || '')} of ${fmtDate(i.inv_date)} — ${inr(num(i.total) - num(i.paid))} due</li>`))}
      ${I.ignored.length ? `<p class="small">${I.ignored.length} automatic data reminders sent in the last 30 days without the data arriving.</p>` : ''}
      ${!x.reasons.length ? '<p class="muted">Nothing pending — all work on time, no open notices or unpaid fees.</p>' : ''}`,
      { extra: `<a class="btn" href="#/work" data-hw>Open work</a>${x.c.phone ? `<a class="btn" href="${esc(waShare('Dear ' + (x.c.contact_person || x.c.name) + ',\n', x.c.phone))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` });
    $('[data-hw]', m.el).onclick = () => { wf = { ...WF_DEFAULT, client: id, status: 'open' }; m.close(); };
  };
};

/* ---------- Settings: automatic data chasing ---------- */
async function renderChaseSettings(box) {
  const r = await safe(sb.rpc('chase_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Automatic data chasing</h3><p class="note small">Run <b>update-session7.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {}, edit = isPartner(), pv = s.preview || [];
  const when = t => t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<div class="card"><h3>Automatic data chasing</h3>
    <p class="muted">While work is in <b>Pending data</b>, the client gets a polite reminder by WhatsApp and email every few days until the data arrives — every morning at 10 AM (Mon–Sat). Each reminder shows as a follow-up on the work. If the client still hasn't sent anything after a set number of reminders, the staff member and Managers get an email to call them.</p>
    <div class="mail-stat"><span class="pill ${s.enabled ? 'g' : 'a'}">${s.enabled ? '● On' : 'Off'}</span>
      <span class="small">Last run: <b>${when(s.last_run_at)}</b>${s.last_note ? ' · ' + esc(s.last_note) : ''} · Clients reminded in 7 days: <b>${s.sent_7 || 0}</b>${s.queued ? ` · emails waiting to send: <b>${s.queued}</b>` : ''}${s.failed_7 ? ` · <span class="late">${s.failed_7} failed</span>` : ''}</span></div>
    ${!s.mailbox ? '<p class="note warn small">Emails are sent by the office mailbox script — set up Notice watch first (it uses the same key).</p>' : ''}
    <div class="form-grid" style="margin-top:12px">
      <label>Start reminding (days before the due date)<input type="number" id="chStart" min="1" max="30" value="${esc(s.start_days)}"></label>
      <label>Remind again every (days)<input type="number" id="chEvery" min="1" max="15" value="${esc(s.every_days)}"></label>
      <label>At most this many reminders per client in 30 days<input type="number" id="chMax" min="1" max="10" value="${esc(s.max_month)}"></label>
      <label>Tell staff &amp; Managers after this many reminders<input type="number" id="chEsc" min="1" max="10" value="${esc(s.escalate_after)}"></label></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="chOn" ${s.enabled ? 'checked' : ''}> <b>Switched on</b> (this replaces the older one-time client reminder in WhatsApp settings)</label>
    <label class="check"><input type="checkbox" id="chWa" ${s.use_wa ? 'checked' : ''}> WhatsApp (uses the approved <b>client_data_reminder</b> template)</label>
    <label class="check"><input type="checkbox" id="chEm" ${s.use_email ? 'checked' : ''}> Email from the office mailbox (clients can reply with the files — they land in Client mail)</label>
    <div class="toolbar" style="margin-top:12px">${edit ? '<button class="btn primary" id="chSave">Save</button>' : ''}<span class="spacer"></span><button class="btn" id="chRun">Send due reminders now</button></div>
    <h4 style="margin:16px 0 6px">Waiting for data now (${pv.length})</h4>
    ${pv.length ? `<div class="table-wrap"><table class="small"><thead><tr><th>Client</th><th>Waiting for</th><th>Earliest due</th><th>Reminders (30 days)</th><th>Next</th></tr></thead><tbody>
      ${pv.map(p => `<tr><td><b>${esc(p.client)}</b><div class="muted">${p.phone ? 'WhatsApp' : '<span class="late">no mobile</span>'} · ${p.email ? 'email' : '<span class="late">no email</span>'}</div></td><td class="wrap">${esc(p.items)}</td>
        <td class="${p.earliest < today() ? 'late' : ''}">${fmtDate(p.earliest)}</td><td>${p.sent_30}${p.last_sent ? `<div class="muted">last ${fmtDate(p.last_sent.slice(0, 10))}</div>` : ''}</td>
        <td>${p.sent_30 >= s.max_month ? '<span class="muted">limit reached</span>' : p.due_now ? '<b>due now</b>' : 'in a few days'}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted small">No client is waiting on data within the reminder window.</p>'}
    <p class="muted small">To leave a client out, open the client and tick “Don't send automatic reminders”.</p></div>`;
  if ($('#chSave', box)) $('#chSave', box).onclick = async () => {
    const n = id => Math.round(num($(id, box).value));
    try { await must(sb.rpc('chase_save', { p: { enabled: $('#chOn', box).checked, use_wa: $('#chWa', box).checked, use_email: $('#chEm', box).checked, start_days: n('#chStart'), every_days: n('#chEvery'), max_month: n('#chMax'), escalate_after: n('#chEsc') } })); toast('Saved'); renderChaseSettings(box); }
    catch (e) { toast(friendly(e), true); }
  };
  if (!edit) $$('input', box).forEach(x => x.disabled = true);
  $('#chRun', box).onclick = async e => {
    if (!confirm('Send reminders now to the clients marked “due now”?')) return;
    e.target.disabled = true;
    try { const { data } = await must(sb.rpc('chase_run_now')); toast(data ? `${data} client${data > 1 ? 's' : ''} reminded` : 'No reminder due right now'); renderChaseSettings(box); }
    catch (err) { toast(friendly(err), true); e.target.disabled = false; }
  };
}


/* =====================================================================
   v26  ACTIVITY LOG  (#/activity, Partners & Admin) + History buttons
   Rows are written by the database itself (triggers), so nothing can skip them.
   ===================================================================== */
const AUDIT = {
  AREA: { clients: 'Client', tasks: 'Work', notices: 'Notice', invoices: 'Invoice', payments: 'Payment', profiles: 'Team member', task_docs: 'Work file', renewals: 'Renewal',
    mca_companies: 'Company / LLP', mca_directors: 'Director', tds_challans: 'TDS challan', tds_returns: 'TDS return', fee_rates: 'Fee rate', due_dates: 'Due date',
    onboarding: 'Onboarding', tax_intimations: 'Tax intimation', checklist_templates: 'Checklist', settings: 'Settings', login: 'Sign-in' },
  ACT: { insert: 'Added', update: 'Changed', delete: 'Deleted', sign_in: 'Signed in', sign_out: 'Signed out', idle_sign_out: 'Signed out (5 min idle)', export: 'Exported' },
  FIELD: { status: 'Status', assigned_to: 'Staff', default_staff: 'Default staff', due_date: 'Due date', filed_on: 'Filed on', arn: 'ARN', remarks: 'Remarks', client_id: 'Client',
    return_name: 'Return', period: 'Period', work_type: 'Type', gstin: 'GSTIN', pan: 'PAN', tan: 'TAN', cin: 'CIN', phone: 'Phone', email: 'Email', client_code: 'Client code',
    name: 'Name', active: 'Active', role: 'Role', full_name: 'Name', reply_due: 'Reply due', hearing_date: 'Hearing', notice_type: 'Notice', ref_no: 'Reference', amount: 'Amount',
    fee: 'Fee', total: 'Total', paid: 'Paid', inv_no: 'Invoice no.', inv_date: 'Invoice date', gst_scheme: 'GST scheme', services: 'Services', status_token: 'Status link',
    data_received_on: 'Data received', contact_person: 'Contact person', address: 'Address', notes: 'Notes', draft_reply: 'Reply draft', replied_on: 'Replied on', ack_no: 'Ack no.',
    chase_off: 'No auto reminders', expiry: 'Expiry', paid_on: 'Paid on' },
  lab(k) { return this.FIELD[k] || k.replace(/_/g, ' ').replace(/^./, x => x.toUpperCase()); },
  val(k, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.join(', ') || '—';
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 120);
    if (['assigned_to', 'default_staff', 'created_by', 'user_id', 'updated_by'].includes(k)) return profName(v) || 'someone';
    if (k === 'client_id') return (clientById(v) || {}).name || 'a client';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return String(v);
  },
  changes(r) {
    const c = r.changes || {}, ks = Object.keys(c);
    if (!ks.length) return r.summary && r.area === 'login' ? esc(r.summary) : '';
    if (r.action === 'update') return ks.map(k => c[k][1] === '(changed)' ? `<div><b>${esc(this.lab(k))}:</b> changed (hidden for safety)</div>` : `<div><b>${esc(this.lab(k))}:</b> <span class="aud-old">${esc(this.val(k, c[k][0]))}</span> → <span class="aud-new">${esc(this.val(k, c[k][1]))}</span></div>`).join('');
    const keep = ['status', 'client_code', 'name', 'return_name', 'period', 'due_date', 'assigned_to', 'role', 'email', 'notice_type', 'reply_due', 'amount', 'total', 'arn'];
    const main = ks.filter(k => keep.includes(k)), rest = ks.filter(k => !keep.includes(k) && k !== 'client_id');
    const line = k => `<b>${esc(this.lab(k))}:</b> ${esc(this.val(k, c[k]))}`;
    return `<div class="muted">${main.map(line).join(' · ')}</div>${rest.length ? `<details><summary class="small">All details (${rest.length})</summary><div class="small">${rest.map(line).join('<br>')}</div></details>` : ''}`;
  },
  when(t) { return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
  row(r, showWhat = true) {
    return `<tr class="aud-${r.action}"><td class="nowrap small">${this.when(r.at)}</td><td>${esc(r.user_name || '—')}</td>
      <td><span class="aud-act aud-${r.action}">${esc(this.ACT[r.action] || r.action)}</span>${showWhat ? `<div class="small muted">${esc(this.AREA[r.area] || r.area)}</div>` : ''}</td>
      ${showWhat ? `<td class="wrap">${esc(r.summary || '')}</td>` : ''}<td class="wrap small">${this.changes(r)}</td></tr>`;
  },
  event(a, note) { return safe(sb.rpc('audit_event', { p_action: a, p_note: note || null })); }
};

let af = { from: '', to: '', user: '', area: '', client: '', act: '', q: '' };
VIEWS.activity = async v => {
  await loadRefs();
  if (!af.from) { af.from = iso(addDays(new Date(), -7)); af.to = today(); }
  v.innerHTML = `<div class="page-head"><h2>Activity log</h2><span class="muted">Who changed what, and when</span><span class="spacer"></span><button class="btn" id="aExp">Export CSV</button></div>
    <div class="toolbar aud-filters">
      <label class="small">From <input type="date" id="aFrom" value="${af.from}"></label><label class="small">To <input type="date" id="aTo" value="${af.to}"></label>
      <select id="aUser"><option value="">Everyone</option>${opts(profiles, af.user, p => p.full_name || p.email, p => p.id)}<option value="system" ${af.user === 'system' ? 'selected' : ''}>System (automatic)</option></select>
      <select id="aArea"><option value="">Everything</option>${opts(Object.entries(AUDIT.AREA), af.area, x => x[1], x => x[0])}</select>
      <select id="aAct"><option value="">Added / changed / deleted</option>${opts(Object.entries(AUDIT.ACT), af.act, x => x[1], x => x[0])}</select>
      <select id="aClient"><option value="">All clients</option>${opts(clients, af.client, cLabel, c => c.id)}</select>
      <input type="search" id="aQ" placeholder="Search" value="${esc(af.q)}"></div>
    <div id="aList"><div class="loading">Loading…</div></div>`;
  let rows = [], done = false;
  const PAGE = 200;
  const load = async (more) => {
    let q = sb.from('audit_log').select('*').gte('at', af.from + 'T00:00:00+05:30').lt('at', iso(addDays(new Date(af.to + 'T00:00:00'), 1)) + 'T00:00:00+05:30')
      .order('at', { ascending: false }).order('id', { ascending: false }).range(more ? rows.length : 0, (more ? rows.length : 0) + PAGE - 1);
    if (af.user === 'system') q = q.is('user_id', null); else if (af.user) q = q.eq('user_id', af.user);
    if (af.area) q = q.eq('area', af.area);
    if (af.act) q = q.eq('action', af.act);
    if (af.client) q = q.eq('client_id', af.client);
    if (af.q) q = q.ilike('summary', '%' + af.q.replace(/[%_,()]/g, ' ') + '%');
    const r = await safe(q);
    if (r.error) { $('#aList').innerHTML = `<p class="note warn">${/audit_log/.test(r.error.message || '') ? 'Run <b>update-session9.sql</b> in Supabase to switch the activity log on.' : esc(friendly(r.error))}</p>`; return; }
    rows = more ? rows.concat(r.data) : r.data; done = r.data.length < PAGE;
    $('#aList').innerHTML = rows.length ? `<div class="table-wrap"><table class="aud-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>What changed</th></tr></thead><tbody>
      ${rows.map(x => AUDIT.row(x)).join('')}</tbody></table></div>
      <div class="toolbar" style="justify-content:center;margin-top:10px"><span class="muted small">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}</span>${done ? '' : '<button class="btn" id="aMore">Load more</button>'}</div>`
      : '<div class="table-wrap"><div class="empty">Nothing recorded for these filters.</div></div>';
    if ($('#aMore')) $('#aMore').onclick = () => load(true);
  };
  const set = (k, id, ev = 'onchange') => { $(id)[ev] = e => { af[k] = e.target.value; clearTimeout(set.t); set.t = setTimeout(() => load(false), ev === 'oninput' ? 350 : 0); }; };
  set('from', '#aFrom'); set('to', '#aTo'); set('user', '#aUser'); set('area', '#aArea'); set('act', '#aAct'); set('client', '#aClient'); set('q', '#aQ', 'oninput');
  $('#aExp').onclick = () => {
    if (!rows.length) return toast('Nothing to export', true);
    const flat = r => r.action === 'update' ? Object.entries(r.changes || {}).map(([k, x]) => `${AUDIT.lab(k)}: ${AUDIT.val(k, x[0])} -> ${AUDIT.val(k, x[1])}`).join('; ')
      : Object.entries(r.changes || {}).map(([k, x]) => `${AUDIT.lab(k)}: ${AUDIT.val(k, x)}`).join('; ');
    download(`activity-log-${af.from}-to-${af.to}.csv`, toCSV([['When', 'Who', 'Action', 'Area', 'Record', 'Details'],
      ...rows.map(r => [AUDIT.when(r.at), r.user_name || '', AUDIT.ACT[r.action] || r.action, AUDIT.AREA[r.area] || r.area, r.summary || '', flat(r)])]));
    AUDIT.event('export', `Activity log ${af.from} to ${af.to} (${rows.length} rows)`);
  };
  load(false);
};

/* History window for one record (work / notice) or one client (everything about that client) */
async function showHistory(kind, id, title) {
  const m = modal('History — ' + title, '<div class="loading">Loading…</div>', { wide: true });
  let q = sb.from('audit_log').select('*').order('at', { ascending: false }).order('id', { ascending: false }).limit(300);
  q = kind === 'client' ? q.eq('client_id', id) : q.eq('area', kind).eq('row_id', id);
  const r = await safe(q);
  $('.modal-body', m.el).innerHTML = r.error ? `<p class="note warn">${/audit_log/.test(r.error.message || '') ? 'Run update-session9.sql in Supabase to switch the activity log on.' : esc(friendly(r.error))}</p>`
    : r.data.length ? `<div class="table-wrap"><table class="aud-table"><thead><tr><th>When</th><th>Who</th><th>Action</th>${kind === 'client' ? '<th>Record</th>' : ''}<th>What changed</th></tr></thead><tbody>
        ${r.data.map(x => AUDIT.row(x, kind === 'client')).join('')}</tbody></table></div>${r.data.length === 300 ? '<p class="muted small">Showing the latest 300 — see Activity log for more.</p>' : ''}`
    : '<p class="muted">No changes recorded yet. Changes are recorded from the day the activity log was switched on.</p>';
}


/* =====================================================================
   v27  DASHBOARDS BY ROLE + WORK REQUESTS
   Team member: "My day"  ·  Manager / Partner: "Office"  ·  Admin: Office | My work | System
   ===================================================================== */
const WR_PRI = ['Normal', 'High', 'Urgent'];
const WR_ST = ['New', 'In progress', 'Done', 'Cancelled'];
const dashTabs = () => isAdmin() ? [['office', 'Office'], ['mine', 'My work'], ['system', 'System']]
  : (isManager() || isPartner()) ? [['office', 'Office']] : [['mine', 'My day']];

VIEWS.dashboard = async v => {
  const tabs = dashTabs();
  let tab = ''; try { tab = localStorage.getItem('jlr-dash-tab') || ''; } catch (e) {}
  if (!tabs.some(x => x[0] === tab)) tab = tabs[0][0];
  v.innerHTML = (tabs.length > 1 ? `<div class="dash-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-dt="${k}" aria-selected="${k === tab}">${esc(l)}</button>`).join('')}</div>` : '') + '<div id="dashBody"></div>';
  const body = $('#dashBody', v);
  try { await loadRefs(); const b = demoBanner(); if (b) v.insertAdjacentHTML('afterbegin', b); } catch (e) {}
  if (GAME.on()) { body.insertAdjacentHTML('beforebegin', '<div id="gameHero" class="game-hero" aria-live="polite"></div>'); GAME.hero($('#gameHero', v)); }
  const show = async k => {
    tab = k; try { localStorage.setItem('jlr-dash-tab', k); } catch (e) {}
    $$('[data-dt]', v).forEach(b => b.setAttribute('aria-selected', b.dataset.dt === k));
    body.innerHTML = '<div class="loading">Loading…</div>';
    try { await ({ office: dashOffice, mine: dashMine, system: dashSystemTab }[k])(body); }
    catch (e) { body.innerHTML = `<p class="note warn">${esc(friendly(e))}</p>`; }
  };
  $$('[data-dt]', v).forEach(b => b.onclick = () => show(b.dataset.dt));
  await show(tab);
};

/* ---------- shared: work-request list and window ---------- */
const wrBadge = r => `<span class="st wr-${slug(r.status)}">${esc(r.status)}</span>${r.priority !== 'Normal' ? ` <span class="chip ${r.priority === 'Urgent' ? 'red' : 'amber'} small">${esc(r.priority)}</span>` : ''}`;
function wrTable(list, { mine = false } = {}) {
  if (!list.length) return `<div class="empty small">${mine ? 'No requests for you right now.' : 'No open requests.'}</div>`;
  const t = today();
  return `<div class="table-wrap"><table><thead><tr><th>Request</th><th>${mine ? 'From' : 'For'}</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(r => `<tr><td class="wrap"><b>${esc(r.title)}</b>${r.client_id ? `<div class="muted small">${esc(cLabel(clientById(r.client_id) || { name: '' }))}</div>` : ''}${r.reply ? `<div class="small">↳ ${esc(r.reply)}</div>` : ''}</td>
      <td>${esc(profName(mine ? r.requested_by : r.assigned_to) || '—')}</td>
      <td class="${r.due_date && r.due_date < t && !['Done', 'Cancelled'].includes(r.status) ? 'late' : ''}">${r.due_date ? fmtDate(r.due_date) : '—'}</td>
      <td>${wrBadge(r)}</td>
      <td class="row-btns">${mine && r.status === 'New' ? `<button class="btn sm" data-wrgo="${r.id}" data-to="In progress">Start</button>` : ''}${mine && ['New', 'In progress'].includes(r.status) ? `<button class="btn sm primary" data-wrdone="${r.id}">Done</button>` : ''}<button class="btn sm ghost" data-wropen="${r.id}">Open</button></td></tr>`).join('')}
    </tbody></table></div>`;
}
function bindWr(el, list, refresh) {
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const r = list.find(x => x.id === (b.dataset.wrgo || b.dataset.wrdone || b.dataset.wropen)); if (!r) return;
    if (b.dataset.wrgo) { try { await must(sb.from('work_requests').update({ status: b.dataset.to }).eq('id', r.id)); toast('Started'); refresh(); } catch (err) { toast(friendly(err), true); } }
    if (b.dataset.wrdone) wrDone(r, refresh);
    if (b.dataset.wropen) editRequest(r, refresh);
  };
}
function wrDone(r, refresh) {
  modal('Mark as done', `<p class="small" style="margin-top:0"><b>${esc(r.title)}</b></p>
    <label class="full">Reply to ${esc(profName(r.requested_by) || 'your manager')} (optional)<textarea name="reply" rows="3" placeholder="e.g. Collected all 6 months, saved in Client mail">${esc(r.reply || '')}</textarea></label>`,
    { saveText: 'Mark done', onSave: async el => { await must(sb.from('work_requests').update({ status: 'Done', reply: fv(el, 'reply') || null }).eq('id', r.id)); toast('Done — ' + (profName(r.requested_by) || 'your manager') + ' has been told'); refresh(); } });
}
function editRequest(r, refresh) {
  const isNew = !r || !!r._new, mgr = isManager();
  r = r || { priority: 'Normal', status: 'New' };
  const ro = !mgr ? 'disabled' : '';
  const staff = activeStaff().filter(p => p.id !== me.id || isAdmin());
  const m = modal(isNew ? 'New work request' : 'Work request', `<div class="form-grid">
    <label class="full">What needs doing ${REQ}<input name="title" value="${esc(r.title || '')}" maxlength="200" placeholder="e.g. Collect Oct–Mar bank statements and convert to Tally" ${ro}></label>
    <label>For ${REQ}<select name="assigned_to" ${ro}>${isNew ? '<option value="">Choose a team member…</option>' : ''}${opts(staff, r.assigned_to, p => p.full_name || p.email, p => p.id)}</select></label>
    <label>Client (optional)<select name="client_id" ${ro}><option value="">— none —</option>${opts(clients.filter(c => c.active || c.id === r.client_id), r.client_id, cLabel, c => c.id)}</select></label>
    <label>Due date<input type="date" name="due_date" value="${esc(r.due_date || '')}" ${ro}></label>
    <label>Priority<select name="priority" ${ro}>${opts(WR_PRI, r.priority)}</select></label>
    <label class="full">Details<textarea name="details" rows="4" ${ro}>${esc(r.details || '')}</textarea></label>
    ${isNew ? '' : `<label>Status<select name="status">${opts(mgr ? WR_ST : WR_ST.filter(s => s !== 'Cancelled'), r.status)}</select></label>
      <label class="full">Reply from ${esc(profName(r.assigned_to) || 'team member')}<textarea name="reply" rows="3" ${r.assigned_to === me.id || mgr ? '' : 'disabled'}>${esc(r.reply || '')}</textarea></label>
      <p class="full muted small" style="margin:0">Asked by ${esc(profName(r.requested_by) || '—')} on ${fmtDate((r.created_at || '').slice(0, 10))}${r.started_at ? ' · started ' + fmtDate(r.started_at.slice(0, 10)) : ''}${r.done_at ? ' · done ' + fmtDate(r.done_at.slice(0, 10)) : ''}</p>`}
    ${isNew ? '<p class="full muted small" style="margin:0">The team member sees this on their dashboard and gets an email. You are told when it is done.</p>' : ''}</div>`, {
    saveText: isNew ? 'Send request' : 'Save',
    extra: !isNew && mgr ? '<button class="btn danger" data-wrdel>Delete</button>' : '',
    onSave: async el => {
      const rec = isNew || mgr ? { title: fv(el, 'title').trim(), assigned_to: fv(el, 'assigned_to') || null, client_id: fv(el, 'client_id') || null,
        due_date: fv(el, 'due_date') || null, priority: fv(el, 'priority'), details: fv(el, 'details') || null } : {};
      if (!isNew) { rec.status = fv(el, 'status'); rec.reply = fv(el, 'reply') || null; }
      if ((isNew || mgr) && !rec.title) { toast('Write what needs doing', true); return false; }
      if ((isNew || mgr) && !rec.assigned_to) { toast('Choose the team member', true); return false; }
      if (isNew) await must(sb.from('work_requests').insert({ ...rec, status: 'New' })); else await must(sb.from('work_requests').update(rec).eq('id', r.id));
      toast(isNew ? `Request sent to ${profName(rec.assigned_to)}` : 'Saved'); refresh && refresh();
    }
  });
  const d = $('[data-wrdel]', m.el);
  if (d) d.onclick = async () => { if (!confirm('Delete this request?')) return; try { await must(sb.from('work_requests').delete().eq('id', r.id)); m.close(); toast('Deleted'); refresh && refresh(); } catch (e) { toast(friendly(e), true); } };
}

/* ---------- OFFICE (Manager, Partner, Admin) ---------- */
async function dashOffice(body) {
  const now = new Date(), t = today(), in7 = iso(addDays(now, 7)), y = now.getFullYear(), m = now.getMonth() + 1;
  const mStart = iso(new Date(y, m - 1, 1)), mEnd = iso(new Date(y, m, 0));
  const [open, month, nt, wr, inv, pay] = await Promise.all([
    must(sb.from('tasks').select('*').not('status', 'in', '("Filed","Not applicable")').order('due_date', { ascending: true, nullsFirst: false }).limit(5000)),
    must(sb.from('tasks').select('id,client_id,work_type,return_name,status,due_date,filed_on,assigned_to').gte('due_date', mStart).lte('due_date', mEnd).limit(10000)),
    safe(sb.from('notices').select('id,client_id,dept,notice_type,status,reply_due,assigned_to').neq('status', 'Closed').limit(3000)),
    safe(sb.from('work_requests').select('*').in('status', ['New', 'In progress']).order('due_date', { ascending: true, nullsFirst: false }).limit(500)),
    isPartner() && P4() ? safe(sb.from('invoices').select('client_id,total,paid').limit(10000)) : Promise.resolve({ data: null }),
    isPartner() && P4() ? safe(sb.from('payments').select('amount,paid_on').gte('paid_on', mStart).lte('paid_on', mEnd).limit(5000)) : Promise.resolve({ data: null })
  ]);
  const rows = open.data || [], mrows = (month.data || []).filter(r => r.status !== 'Not applicable');
  const notices = nt.error ? [] : nt.data || [], reqs = wr.error ? null : wr.data || [];
  const overdue = rows.filter(r => r.due_date && r.due_date < t), soon = rows.filter(r => r.due_date && r.due_date >= t && r.due_date <= in7);
  const nDue = notices.filter(n => isOpenNotice(n.status) && n.reply_due && n.reply_due <= in7).sort((a, b) => a.reply_due.localeCompare(b.reply_due));

  // this month by department
  const dept = ['GST', 'TDS', 'ROC/MCA', 'Other'].map(w => {
    const list = mrows.filter(r => inTab(r, w));
    const c = { filed: list.filter(r => r.status === 'Filed').length, prog: list.filter(r => ['In progress', 'Ready to file'].includes(r.status)).length,
      wait: list.filter(r => r.status === 'Pending data').length, late: list.filter(r => r.status !== 'Filed' && r.due_date < t).length };
    const [bg, fg] = WT_TONE[w], p = list.length ? Math.round(100 * c.filed / list.length) : 0;
    return `<div class="bento-card dept od-dept"><div class="dept-head"><span class="dept-ico" style="background:${bg};color:${fg}">${wtIcon(w, 20)}</span><b>${esc(w === 'ROC/MCA' ? 'MCA' : w)}</b><span class="dept-count">${c.filed} / ${list.length}</span></div>
      <div class="bar"><i style="width:${p}%;background:${fg}"></i></div>
      <div class="od-nums">${[['filed', 'Filed', c.filed, 'Filed'], ['prog', 'In progress', c.prog, 'progress'], ['wait', 'Waiting data', c.wait, 'Pending data'], ['late', 'Overdue', c.late, 'overdue']]
        .map(([k, l, n, st]) => `<a href="#/work" data-od="${esc(w)}|${st}" class="od-n od-${k}${n ? '' : ' zero'}"><b>${n}</b><span>${l}</span></a>`).join('')}</div></div>`;
  }).join('');

  // staff board
  const people = activeStaff().map(p => {
    const mine = rows.filter(r => r.assigned_to === p.id), mm = mrows.filter(r => r.assigned_to === p.id);
    return { p, late: mine.filter(r => r.due_date && r.due_date < t).length, week: mine.filter(r => r.due_date && r.due_date >= t && r.due_date <= in7).length,
      wait: mine.filter(r => r.status === 'Pending data').length, open: mine.length, done: mm.filter(r => r.status === 'Filed').length, total: mm.length,
      req: (reqs || []).filter(r => r.assigned_to === p.id).length };
  }).filter(x => x.open || x.total || x.req).sort((a, b) => b.late - a.late || b.open - a.open);
  const un = rows.filter(r => !r.assigned_to);
  const staffRows = people.map(x => `<tr><td><b>${esc(x.p.full_name || x.p.email)}</b><div class="muted small">${esc(ROLE_LABEL ? (ROLE_LABEL[x.p.role] || x.p.role) : x.p.role)}</div></td>
      <td class="${x.late ? 'late' : ''}"><b>${x.late}</b></td><td>${x.week}</td><td>${x.wait}</td><td>${x.open}</td>
      <td>${x.total ? `${x.done} / ${x.total}<div class="hbar"><i class="green" style="width:${Math.round(100 * x.done / x.total)}%"></i></div>` : '—'}</td><td>${x.req || '—'}</td>
      <td class="row-btns"><a class="btn sm" href="#/work" data-ostaff="${x.p.id}">Open list</a><button class="btn sm ghost" data-oreq="${x.p.id}">+ Request</button></td></tr>`).join('');

  const fees = inv && inv.data ? inv.data.reduce((a, i) => a + num(i.total) - num(i.paid), 0) : null;
  const got = pay && pay.data ? pay.data.reduce((a, x) => a + num(x.amount), 0) : null;
  const filedM = mrows.filter(r => r.status === 'Filed').length;
  body.innerHTML = `
    <div class="page-head"><h2>Office</h2><span class="muted">${MONTHS_FULL[m - 1]} ${y} · ${filedM} of ${mrows.length} filed</span><span class="spacer"></span>
      <button class="btn primary" id="oReq">+ Work request</button></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <a class="mini red k-late" href="#/work" data-oq="overdue">${kpiIco('late')}<span>Overdue</span><b>${overdue.length}</b></a>
      <a class="mini amber k-soon" href="#/work" data-oq="soon">${kpiIco('soon')}<span>Due in 7 days</span><b>${soon.length}</b></a>
      <a class="mini blue k-wait" href="#/work" data-oq="waiting">${kpiIco('wait')}<span>Waiting for client data</span><b>${rows.filter(r => r.status === 'Pending data').length}</b></a>
      <a class="mini ${nDue.length ? 'red' : 'green'} k-note" href="#/notices">${kpiIco('note')}<span>Notice replies due (7 days)</span><b>${nDue.length}</b></a></div>
    ${fees !== null ? `<div class="od-fees"><a class="chip blue" href="#/billing" data-billdue>Fees outstanding ${inr(fees)}</a><span class="chip green">Collected this month ${inr(got || 0)}</span><span id="oGstBill"></span></div>` : ''}
    <h3 class="od-h">This month by department</h3><div class="od-depts">${dept}</div>
    <div class="card"><h3>Team</h3>${people.length || un.length ? `<div class="table-wrap"><table class="od-staff"><thead><tr><th>Person</th><th>Overdue</th><th>Due 7 days</th><th>Waiting data</th><th>All open</th><th>Filed this month</th><th>Requests</th><th></th></tr></thead><tbody>
      ${staffRows}${un.length ? `<tr><td><b>Not assigned</b></td><td class="${un.filter(r => r.due_date && r.due_date < t).length ? 'late' : ''}"><b>${un.filter(r => r.due_date && r.due_date < t).length}</b></td><td>${un.filter(r => r.due_date && r.due_date >= t && r.due_date <= in7).length}</td><td>${un.filter(r => r.status === 'Pending data').length}</td><td>${un.length}</td><td>—</td><td>—</td><td class="row-btns"><a class="btn sm" href="#/work" data-ostaff="none">Open list</a></td></tr>` : ''}
      </tbody></table></div>` : '<div class="empty small">No open work.</div>'}</div>
    <div class="card"><h3>Work requests in progress${reqs ? ` (${reqs.length})` : ''}</h3><div id="oReqList">${reqs ? '' : '<p class="note small">Run <b>update-session10.sql</b> in Supabase to switch on work requests.</p>'}</div></div>
    <div class="card"><h3>Overdue (${overdue.length})</h3><div data-t="late"></div></div>
    <div class="card"><h3>Due in the next 7 days (${soon.length})</h3><div data-t="soon"></div></div>
    ${nDue.length ? `<div class="card"><h3>Notice replies due</h3><div class="table-wrap"><table><thead><tr><th>Client</th><th>Notice</th><th>Reply by</th><th>Staff</th></tr></thead><tbody>
      ${nDue.slice(0, 30).map(n => `<tr><td>${esc(clientName(n.client_id))}</td><td>${esc((n.dept === 'ROC/MCA' ? 'MCA' : n.dept) + ' · ' + n.notice_type)}</td><td class="${n.reply_due < t ? 'late' : ''}">${fmtDate(n.reply_due)}</td><td>${esc(profName(n.assigned_to) || '—')}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div id="oHealth"></div>`;
  const refresh = () => route();
  const lateEl = $('[data-t=late]', body), soonEl = $('[data-t=soon]', body);
  lateEl.innerHTML = taskTable(overdue.slice(0, 50), { showArn: false, showAssigned: true }); bindTaskTable(lateEl, overdue, refresh);
  soonEl.innerHTML = taskTable(soon.slice(0, 50), { showArn: false, showAssigned: true }); bindTaskTable(soonEl, soon, refresh);
  if (reqs) { $('#oReqList', body).innerHTML = wrTable(reqs); bindWr($('#oReqList', body), reqs, refresh); }
  $('#oReq', body).onclick = () => reqs ? editRequest(null, refresh) : toast('Run update-session10.sql in Supabase first', true);
  const t0 = t, mo = t.slice(0, 7);
  $$('[data-oq]', body).forEach(a => a.onclick = () => { wf = { ...WF_DEFAULT, status: a.dataset.oq === 'waiting' ? 'Pending data' : 'open', quick: a.dataset.oq === 'waiting' ? '' : a.dataset.oq }; });
  $$('[data-od]', body).forEach(a => a.onclick = () => { const [w, st] = a.dataset.od.split('|'); wf = { ...WF_DEFAULT, type: w, month: mo, status: st === 'progress' ? 'open' : st === 'overdue' ? 'open' : st, quick: st === 'overdue' ? 'overdue' : '' }; });
  $$('[data-ostaff]', body).forEach(a => a.onclick = () => { wf = { ...WF_DEFAULT, staff: a.dataset.ostaff === 'none' ? '' : a.dataset.ostaff, status: 'open' }; });
  $$('[data-oreq]', body).forEach(b => b.onclick = () => reqs ? editRequest({ priority: 'Normal', status: 'New', assigned_to: b.dataset.oreq, _new: true }, refresh) : toast('Run update-session10.sql in Supabase first', true));
  $$('[data-billdue]', body).forEach(x => x.onclick = () => { billTab = 'due'; });
  if ($('#oGstBill', body) && now.getDate() >= gstBillDay()) safe(sb.rpc('gst_bill_ready', { p_upto: null })).then(r => {
    const d = r.data, el = $('#oGstBill', body); if (!el || r.error || !d || !+d.clients) return;
    el.innerHTML = `<a class="chip amber" href="#/billing" data-gstbill>GST billing${now.getDate() === gstBillDay() ? ' day' : ''}: ${d.clients} client${+d.clients > 1 ? 's' : ''} ready · ${inr(d.amount)}</a>`;
    $('[data-gstbill]', el).onclick = () => { billTab = 'toinv'; };
  });
  countUp(body);
  HEALTH.load().then(all => {
    const red = all.filter(x => x.level === 'red'), box = $('#oHealth', body); if (!box || !document.body.contains(box) || !red.length) return;
    box.innerHTML = `<div class="card"><h3>Clients needing attention (${red.length})</h3><div class="chips">${red.slice(0, 12).map(x => `<a class="chip red" href="#/health" data-hred>${esc(x.c.name)} · ${x.score}</a>`).join('')}</div></div>`;
    $$('[data-hred]', box).forEach(a => a.onclick = () => { hf = { ...hf, level: 'red' }; });
  }).catch(() => {});
}

/* ---------- MY DAY (team member, and Admin's own work) ---------- */
async function dashMine(body) {
  const now = new Date(), t = today(), in7 = iso(addDays(now, 7)), y = now.getFullYear(), m = now.getMonth() + 1;
  const mStart = iso(new Date(y, m - 1, 1)), mEnd = iso(new Date(y, m, 0));
  const [open, done, nt, wr] = await Promise.all([
    must(sb.from('tasks').select('*').eq('assigned_to', me.id).not('status', 'in', '("Filed","Not applicable")').order('due_date', { ascending: true, nullsFirst: false }).limit(3000)),
    must(sb.from('tasks').select('id,status,due_date,filed_on').eq('assigned_to', me.id).eq('status', 'Filed').gte('filed_on', mStart).lte('filed_on', mEnd).limit(3000)),
    safe(sb.from('notices').select('*').eq('assigned_to', me.id).neq('status', 'Closed').order('reply_due', { ascending: true, nullsFirst: false }).limit(500)),
    safe(sb.from('work_requests').select('*').eq('assigned_to', me.id).in('status', ['New', 'In progress']).order('due_date', { ascending: true, nullsFirst: false }).limit(300))
  ]);
  const rows = open.data || [], filed = done.data || [], notices = nt.error ? [] : nt.data || [], reqs = wr.error ? null : wr.data || [];
  const overdue = rows.filter(r => r.due_date && r.due_date < t), todayL = rows.filter(r => r.due_date === t), week = rows.filter(r => r.due_date && r.due_date > t && r.due_date <= in7);
  const waiting = rows.filter(r => r.status === 'Pending data');
  const ontime = filed.filter(r => !r.due_date || (r.filed_on || '') <= r.due_date).length;
  const hour = now.getHours(), hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nLate = notices.filter(n => n.reply_due && n.reply_due < t && n.status !== 'Hearing');
  body.innerHTML = `
    <div class="page-head"><h2>${hello}, ${esc((me.full_name || '').split(' ')[0] || 'there')}</h2><span class="muted">${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div class="bento-stats card stats4" style="margin-bottom:14px">
      <a class="mini red k-late" href="#/work" data-mq="overdue">${kpiIco('late')}<span>Overdue</span><b>${overdue.length}</b></a>
      <a class="mini amber k-soon" href="#/work" data-mq="soon">${kpiIco('soon')}<span>Due today &amp; this week</span><b>${todayL.length + week.length}</b></a>
      <a class="mini blue k-wait" href="#/work" data-mq="waiting">${kpiIco('wait')}<span>Waiting for client data</span><b>${waiting.length}</b></a>
      <div class="mini green k-done">${kpiIco('done')}<span>Filed this month · on time</span><b>${filed.length}</b><small>${filed.length ? Math.round(100 * ontime / filed.length) + '% on time' : '—'}</small></div></div>
    ${reqs && reqs.length ? `<div class="card wr-card"><h3>Requests for you (${reqs.length})</h3><div id="mReq"></div></div>` : ''}
    ${!reqs ? '' : !reqs.length ? '' : ''}
    <div class="card"><h3>Overdue (${overdue.length})</h3><div data-t="late"></div></div>
    <div class="card"><h3>Due today (${todayL.length})</h3><div data-t="today"></div></div>
    <div class="card"><h3>Due in the next 7 days (${week.length})</h3><div data-t="week"></div></div>
    <div class="card"><h3>Waiting for client data (${waiting.length})</h3><p class="muted small" style="margin-top:-4px">Use Follow-up to call or WhatsApp the client and note when they promised the data.</p><div data-t="wait"></div></div>
    ${notices.length ? `<div class="card"><h3>My notices (${notices.length})${nLate.length ? ` <span class="chip red small">${nLate.length} reply overdue</span>` : ''}</h3><div class="table-wrap"><table><thead><tr><th>Client</th><th>Notice</th><th>Reply by</th><th>Status</th></tr></thead><tbody>
      ${notices.map(n => `<tr><td>${esc(clientName(n.client_id))}</td><td><a href="#/notices">${esc((n.dept === 'ROC/MCA' ? 'MCA' : n.dept) + ' · ' + n.notice_type)}</a></td><td class="${n.reply_due && n.reply_due < t ? 'late' : ''}">${n.reply_due ? fmtDate(n.reply_due) : '—'}</td><td>${esc(n.status)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  const refresh = () => route();
  [['late', overdue], ['today', todayL], ['week', week], ['wait', waiting]].forEach(([k, list]) => {
    const el = $(`[data-t=${k}]`, body);
    el.innerHTML = list.length ? taskTable(list.slice(0, 60), { showArn: false, showAssigned: false }) : `<div class="empty small">${k === 'late' ? 'Nothing overdue — well done.' : 'Nothing here.'}</div>`;
    if (list.length) bindTaskTable(el, list, refresh);
  });
  if (reqs && reqs.length) { $('#mReq', body).innerHTML = wrTable(reqs, { mine: true }); bindWr($('#mReq', body), reqs, refresh); }
  $$('[data-mq]', body).forEach(a => a.onclick = () => { wf = { ...WF_DEFAULT, staff: isManager() ? me.id : '', status: a.dataset.mq === 'waiting' ? 'Pending data' : 'open', quick: a.dataset.mq === 'waiting' ? '' : a.dataset.mq }; });
  countUp(body);
}

/* ---------- SYSTEM (Admin): automatic jobs + the full dashboard ---------- */
async function dashSystemTab(body) {
  body.innerHTML = '<div class="card sys-card"><h3>Automatic jobs</h3><div class="sys-grid" id="sysGrid"><div class="loading">Checking…</div></div></div><div id="sysOld"></div>';
  const when = x => { if (!x) return 'never'; const mins = Math.round((Date.now() - new Date(x)) / 60000); return mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.round(mins / 60) + ' h ago' : new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  Promise.all([safe(sb.rpc('wa_admin_status')), safe(sb.from('wa_settings').select('enabled,client_enabled').eq('id', 1).maybeSingle()), safe(sb.rpc('notice_status')), safe(sb.rpc('auto_work_status')),
    safe(sb.rpc('chase_status')), safe(sb.rpc('mail_admin_status')), safe(sb.from('backups').select('taken_at,rows').order('taken_at', { ascending: false }).limit(1)), safe(sb.rpc('ai_admin_status'))])
  .then(([wa, ws, nw, aw, ch, ml, bk, ai]) => {
    const tile = (name, ok, line, href) => `<a class="sys-tile ${ok === true ? 'ok' : ok === false ? 'bad' : 'off'}" href="${href}"><span class="sys-dot"></span><b>${esc(name)}</b><span class="small">${line}</span></a>`;
    const n = nw.data || {}, a = aw.data || {}, c = ch.data || {}, mm = ml.data || {}, b = (bk.data || [])[0], ia = ai.data || {}, w = ws.data || {};
    const bkAge = b ? (Date.now() - new Date(b.taken_at)) / 36e5 : null;
    $('#sysGrid', body).innerHTML = [
      tile('WhatsApp reminders', wa.error || ws.error || !w.enabled ? null : true, wa.error || ws.error ? 'not set up' : w.enabled ? 'on — staff 9:30 AM daily' : 'switched off', '#/settings'),
      tile('Notice watch', nw.error ? null : n.connected && n.enabled ? !n.last_error && !!n.last_check_at && (Date.now() - new Date(n.last_check_at)) < 3 * 36e5 : null, nw.error ? 'not installed' : !n.connected ? 'not set up' : n.last_error ? 'problem: ' + esc(n.last_error) : 'last check ' + when(n.last_check_at), '#/notices'),
      tile('Automatic GST work', aw.error ? null : a.gst_enabled ? true : null, aw.error ? 'not installed' : a.gst_enabled ? 'last run ' + when(a.last_run_at) + (a.last_made != null ? ` · ${a.last_made} made` : '') : 'switched off', '#/settings'),
      tile('Data chasing', ch.error ? null : c.enabled ? !c.failed_7 : null, ch.error ? 'not installed' : c.enabled ? `on · ${c.sent_7 || 0} clients reminded in 7 days${c.failed_7 ? ` · ${c.failed_7} failed` : ''}${c.queued ? ` · ${c.queued} emails waiting` : ''}` : 'switched off', '#/settings'),
      tile('Client mail', ml.error ? null : mm.enabled && mm.key_set ? !mm.last_error : null, ml.error ? 'not installed' : mm.enabled && mm.key_set ? 'last mail ' + when(mm.last_mail_at) + (mm.new ? ` · ${mm.new} waiting` : '') : 'not set up', '#/inbox'),
      tile('Backup', bk.error ? null : b ? bkAge < 30 : false, bk.error ? 'not available' : b ? 'last ' + when(b.taken_at) + ` · ${b.rows} rows` : 'no backup yet', '#/settings'),
      tile('AI (bills, help, replies)', ai.error ? null : ia.enabled && ia.key_set ? true : null, ai.error ? 'not installed' : ia.key_set ? `this month ₹${(+ia.month_cost || 0).toFixed(2)}` : 'no key — free reading only', '#/settings')
    ].join('');
  });
  await dashFull($('#sysOld', body));
}


/* =====================================================================
   v28  FILING ACKNOWLEDGEMENTS — read the GST / TDS / MCA acknowledgement PDF,
   find the work, mark it Filed with ARN and date, keep the PDF.
   ===================================================================== */
const ACK = {
  MON: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  MON3: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  key: s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  TDS_ALIAS: { '24Q': ['24q', 'form138'], '26Q': ['26q', 'form140'], '27Q': ['27q', 'form144'], '27EQ': ['27eq', 'form143'] },
  NEW_TO_OLD: { 138: '24Q', 140: '26Q', 144: '27Q', 143: '27EQ' },
  date(s) {
    if (!s) return null;
    let m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    m = s.match(/(\d{1,2})[\s\-]([A-Za-z]{3})[A-Za-z]*[\s\-,]+(\d{4})/);
    if (m) { const i = this.MON.indexOf(m[2].toLowerCase()); if (i >= 0) return `${m[3]}-${String(i + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
    return null;
  },
  parse(text) {
    const T = String(text || '').replace(/ /g, ' '), U = T.toUpperCase();
    const r = { kind: null, form: null, gstin: null, tan: null, cin: null, fyStart: null, month: null, quarter: null, arn: null, filed_on: null, period: null };
    r.gstin = (U.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/) || [])[1] || null;
    r.tan = (U.match(/\b([A-Z]{4}\d{5}[A-Z])\b/) || [])[1] || null;
    r.cin = (U.match(/\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/) || U.match(/LLPIN\s*[:\-]?\s*([A-Z]{3}-\d{4})\b/) || [])[1] || null;
    // form
    let m;
    if ((m = U.match(/\b(GSTR[\s-]?(?:3B|1|4|7|8|9C|9)|CMP[\s-]?08|PMT[\s-]?06)\b/))) { r.kind = 'GST'; r.form = m[1].replace(/\s/g, '').replace(/^GSTR(?!-)/, 'GSTR-').replace(/^CMP(?!-)/, 'CMP-').replace(/^PMT(?!-)/, 'PMT-'); }
    else if (/INVOICE FURNISHING FACILITY|\bIFF\b/.test(U)) { r.kind = 'GST'; r.form = 'IFF'; }
    if (!r.form && (m = U.match(/\bFORM\s*(?:NO\.?\s*)?:?\s*(24Q|26Q|27Q|27EQ|138|140|143|144)\b/) || U.match(/\b(24Q|26Q|27Q|27EQ)\b/))) { r.kind = 'TDS'; r.form = this.NEW_TO_OLD[m[1]] || m[1]; }
    if (!r.form && (m = U.match(/\b(AOC[\s-]?4(?:\s*(?:XBRL|CFS))?|MGT[\s-]?7A?|ADT[\s-]?1|DIR[\s-]?3\s*KYC(?:[\s-]?WEB)?|DPT[\s-]?3|MSME[\s-]?1|INC[\s-]?20A|LLP\s*FORM\s*(?:NO\.?\s*)?(?:11|8)|FORM\s*(?:11|8)\b)/))) {
      r.kind = 'MCA'; r.form = m[1].replace(/\s+/g, ' ').replace(/^LLP\s*FORM\s*(?:NO\.?\s*)?/, 'Form ').replace(/^(AOC|MGT|ADT|DPT|MSME|INC)\s?-?/, '$1-').replace(/^DIR[\s-]?3\s*KYC.*/, 'DIR-3 KYC');
    }
    if (!r.kind) r.kind = r.gstin ? 'GST' : r.tan ? 'TDS' : r.cin ? 'MCA' : null;
    // year
    if ((m = T.match(/(?:Financial\s*Year|F\.?\s?Y\.?|Year)\s*(?:ending\s*(?:on)?)?\s*[:\-]?\s*(20\d{2})\s*[-–\/]\s*(\d{2,4})/i))) r.fyStart = +m[1];
    else if ((m = T.match(/Assessment\s*Year\s*[:\-]?\s*(20\d{2})\s*[-–]\s*\d{2,4}/i))) r.fyStart = +m[1] - 1;
    else if ((m = T.match(/(?:year|period)\s*end(?:ed|ing)\s*(?:on)?\s*[:\-]?\s*31[\/\-.\s](?:03|mar\w*)[\/\-.\s,]*(20\d{2})/i))) r.fyStart = +m[1] - 1;
    // quarter / month
    const qm = T.match(/\b(?:Quarter|Qtr)\s*[:\-]?\s*(?:Q\s*)?([1-4])\b/i) || T.match(/\bQ\s?([1-4])\b/) ||
      T.match(/\b(Apr(?:il)?\s*[-–to]+\s*Jun(?:e)?|Jul(?:y)?\s*[-–to]+\s*Sep(?:tember)?|Oct(?:ober)?\s*[-–to]+\s*Dec(?:ember)?|Jan(?:uary)?\s*[-–to]+\s*Mar(?:ch)?)\b/i);
    if (qm) r.quarter = /^\d$/.test(qm[1]) ? +qm[1] : ({ apr: 1, jul: 2, oct: 3, jan: 4 })[qm[1].slice(0, 3).toLowerCase()];
    const mm = T.match(/(?:Tax\s*Period|Return\s*Period|Period|Month)\s*[:\-]?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b(?!\s*[-–]\s*[A-Z])/i);
    if (mm) r.month = this.MON.indexOf(mm[1].slice(0, 3).toLowerCase()) + 1;
    if (r.month && !r.fyStart) { const y = T.match(new RegExp(mm[1] + '[,\\s-]*(20\\d{2})', 'i')); if (y) r.fyStart = r.month >= 4 ? +y[1] : +y[1] - 1; }
    // reference number
    if (r.kind === 'GST') r.arn = (U.match(/\bARN\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z]{2}\d{12}[A-Z0-9])\b/) || U.match(/\b(AA\d{12}[A-Z0-9])\b/) || [])[1] || null;
    if (r.kind === 'TDS') r.arn = (U.match(/(?:TOKEN|PROVISIONAL\s*RECEIPT|RECEIPT|ACKNOWLEDG(?:E)?MENT)\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*(\d{15})\b/) || U.match(/\b(\d{15})\b/) || [])[1] || null;
    if (r.kind === 'MCA') r.arn = (U.match(/\bSRN\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z]{1,2}\d{7,8})\b/) || U.match(/SERVICE\s*REQUEST\s*NUMBER\s*[:\-]?\s*([A-Z]{1,2}\d{7,8})/) || [])[1] || null;
    if (!r.arn) r.arn = (U.match(/\bARN\s*[:\-]?\s*([A-Z0-9]{10,20})\b/) || [])[1] || null;
    // date
    const dm = T.match(/(?:Date\s*of\s*(?:ARN|filing|submission|receipt|acknowledg\w*)|ARN\s*Date|Filing\s*Date|Filed\s*on|Date\s*of\s*Filing|Submitted\s*on|Payment\s*Date|SRN\s*Date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,]+\d{4})/i);
    r.filed_on = this.date(dm ? dm[1] : (T.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2}\b/) || [])[0]);
    // the tracker's period text
    const fy = s => `FY ${s}-${String(s + 1).slice(2)}`;
    const annual = /GSTR-9|GSTR-4|AOC|MGT|ADT|DPT|Form 11|Form 8|DIR-3|INC/.test(r.form || '');
    if (r.fyStart) {
      if (annual) r.period = fy(r.fyStart);
      else if (r.month && !(r.kind === 'TDS')) r.period = `${this.MON3[r.month - 1]} ${r.month >= 4 ? r.fyStart : r.fyStart + 1}`;
      else if (r.quarter) r.period = `Q${r.quarter} ${fy(r.fyStart)}`;
      else r.period = fy(r.fyStart);
    }
    return r;
  },
  formMatches(form, kind, returnName) {
    const k = this.key(returnName);
    if (!form) return false;
    if (kind === 'TDS') return (this.TDS_ALIAS[form] || [this.key(form)]).some(a => k.includes(a));
    const f = this.key(form);
    if (f === 'gstr9') return k.startsWith('gstr9') && !k.startsWith('gstr9c') || k === 'gstr99c';
    if (f === 'dir3kyc') return k.includes('dir3');
    return k.startsWith(f) || k.includes(f);
  },
  clientFor(r) {
    const act = clients.filter(c => c.active);
    return (r.gstin && act.find(c => (c.gstin || '').toUpperCase() === r.gstin)) || (r.tan && act.find(c => (c.tan || '').toUpperCase() === r.tan)) ||
      (r.cin && act.find(c => (c.cin || '').toUpperCase() === r.cin)) || (r.gstin && act.find(c => (c.pan || '').toUpperCase() === r.gstin.slice(2, 12))) || null;
  },
  // best work item for this acknowledgement: same client + return; same period if it can be read, else the earliest open one
  pick(r, tasks) {
    const same = tasks.filter(t => this.formMatches(r.form, r.kind, t.return_name));
    const per = r.period ? same.filter(t => this.key(t.period) === this.key(r.period)) : [];
    const open = x => x.filter(t => t.status !== 'Filed');
    const exact = open(per)[0] || per[0];
    if (exact) return { task: exact, sure: true, list: same };
    const guess = open(same).sort((a, b) => String(a.due_date || '9').localeCompare(String(b.due_date || '9')))[0];
    return { task: guess || null, sure: false, list: same };
  },
  async readText(file) {
    const pdfjs = await pdfLib(), doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    let text = '';
    for (let p = 1; p <= Math.min(doc.numPages, 6); p++) { const pg = await doc.getPage(p); text += BILL.itemsToLines((await pg.getTextContent()).items) + '\n'; }
    return text;
  },
  async save(task, r, file) {
    let path = null;
    if (file) {
      path = `${task.client_id}/${task.id}/${Date.now()}-${(file.name || 'ack.pdf').replace(/[^\w.\-]+/g, '_')}`;
      const up = await sb.storage.from('filing-acks').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (up.error) path = null;
    }
    const ins = await safe(sb.from('filing_acks').insert({ task_id: task.id, client_id: task.client_id, kind: r.kind, return_name: task.return_name, period: task.period,
      arn: r.arn || null, filed_on: r.filed_on || today(), file_name: file ? file.name : null, file_path: path }));
    await must(sb.from('tasks').update({ status: 'Filed', arn: r.arn || task.arn || null, filed_on: r.filed_on || today() }).eq('id', task.id));
    return { stored: !!path, logged: !ins.error };
  },
  async open(a) {
    const { data, error } = await sb.storage.from('filing-acks').createSignedUrl(a.file_path, 120);
    if (error) return toast(friendly(error), true);
    window.open(data.signedUrl, '_blank', 'noopener');
  }
};

/* one work item: button in the work window */
async function ackForTask(task, after) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    let r;
    try { toast('Reading the acknowledgement…'); r = ACK.parse(await ACK.readText(file)); }
    catch (e) { return toast(/password/i.test(e.message || '') ? 'This PDF is locked — open it, save a copy without a password, then try again' : 'Could not read this PDF: ' + friendly(e), true); }
    const c = clientById(task.client_id) || {}, warn = [];
    const who = ACK.clientFor(r);
    if (!r.arn) warn.push('No ARN / acknowledgement number found — type it in the ARN box.');
    if (who && who.id !== task.client_id) warn.push(`This acknowledgement looks like it is for <b>${esc(who.name)}</b>, not ${esc(c.name)}.`);
    if (r.form && !ACK.formMatches(r.form, r.kind, task.return_name)) warn.push(`It is for <b>${esc(r.form)}</b>, but this work is ${esc(task.return_name)}.`);
    if (r.period && ACK.key(r.period) !== ACK.key(task.period)) warn.push(`Period read as <b>${esc(r.period)}</b>; this work is ${esc(task.period || '—')}.`);
    if (!r.form && !r.arn) warn.push('This does not look like a GST / TDS / MCA acknowledgement. If it is a scanned copy, type the ARN by hand.');
    modal('Acknowledgement read', `<table class="small"><tbody>
        <tr><td>Return</td><td><b>${esc(r.form || '—')}</b> ${r.kind ? `<span class="muted">(${esc(r.kind)})</span>` : ''}</td></tr>
        <tr><td>${r.kind === 'MCA' ? 'CIN / LLPIN' : r.kind === 'TDS' ? 'TAN' : 'GSTIN'}</td><td>${esc(r.gstin || r.tan || r.cin || '—')}</td></tr>
        <tr><td>Period</td><td>${esc(r.period || '—')}</td></tr>
        <tr><td>${r.kind === 'MCA' ? 'SRN' : r.kind === 'TDS' ? 'Token / receipt no.' : 'ARN'}</td><td><input name="arn" value="${esc(r.arn || '')}" style="text-transform:uppercase"></td></tr>
        <tr><td>Filed on</td><td><input type="date" name="filed_on" value="${esc(r.filed_on || today())}"></td></tr></tbody></table>
      ${warn.length ? `<div class="note warn small">${warn.join('<br>')}</div>` : '<p class="small" style="color:var(--green)">✓ Matches this work.</p>'}
      <p class="muted small">Saving marks <b>${esc(task.return_name)} · ${esc(task.period || '')}</b> as Filed with this number and date, and keeps the PDF with the work.</p>`,
      { saveText: 'Mark filed', onSave: async el => {
        const rr = { ...r, arn: fv(el, 'arn').toUpperCase() || null, filed_on: fv(el, 'filed_on') || today() };
        const res = await ACK.save(task, rr, file);
        toast(res.stored ? 'Marked Filed — acknowledgement saved' : 'Marked Filed (the PDF could not be stored — run update-session11.sql)', !res.stored);
        after && after();
      } });
  };
  inp.click();
}

/* many at once: Tools → Acknowledgements */
VIEWS.acks = async v => {
  await loadRefs();
  v.innerHTML = `<div class="page-head"><h2>Filing acknowledgements</h2><span class="muted">GST · TDS · MCA</span></div>
    <div class="card"><div class="bk-drop" id="akDrop" tabindex="0" role="button" aria-label="Choose acknowledgement PDFs">
      <b>Drop acknowledgement PDFs here</b><span class="muted small">or click to choose — as many as you like (GSTR-1, 3B, IFF, CMP-08, 26Q / Form 140, AOC-4, MGT-7…)</span></div>
      <input type="file" id="akFile" accept="application/pdf,.pdf" multiple hidden>
      <p class="muted small" style="margin:10px 0 0">Each PDF is read on this computer. The tracker finds the client by GSTIN / TAN / CIN, picks the work for that return and period, and marks it Filed with the ARN and date. Check the list, then press <b>Mark as filed</b>.</p></div>
    <div id="akRes"></div><div class="card"><h3>Saved acknowledgements</h3><div id="akSaved"><div class="loading">Loading…</div></div></div>`;
  let rows = [];
  const drawSaved = async () => {
    const r = await safe(sb.from('filing_acks').select('*').order('created_at', { ascending: false }).limit(100));
    $('#akSaved').innerHTML = r.error ? '<p class="note small">Run <b>update-session11.sql</b> in Supabase to keep acknowledgements.</p>'
      : r.data.length ? `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Return</th><th>ARN / SRN</th><th>Filed on</th><th>Added</th><th></th></tr></thead><tbody>
        ${r.data.map(a => `<tr><td>${esc(cLabel(clientById(a.client_id) || { name: '—' }))}</td><td>${esc(a.return_name || '')} <span class="muted small">${esc(a.period || '')}</span></td><td class="small">${esc(a.arn || '—')}</td>
          <td>${a.filed_on ? fmtDate(a.filed_on) : '—'}</td><td class="small muted">${a.created_at ? fmtDate(a.created_at.slice(0, 10)) : ''} · ${esc(profName(a.uploaded_by) || '')}</td>
          <td>${a.file_path ? `<button class="btn sm" data-akopen="${a.id}">PDF</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty small">None yet.</div>';
    $('#akSaved').onclick = e => { const id = e.target.dataset.akopen; if (id) ACK.open(r.data.find(a => a.id === id)); };
  };
  const draw = () => {
    if (!rows.length) { $('#akRes').innerHTML = ''; return; }
    const ready = rows.filter(x => x.task && !x.done && x.r.arn);
    $('#akRes').innerHTML = `<div class="card"><div class="toolbar" style="margin-top:0"><h3 style="margin:0">Read ${rows.length} file${rows.length > 1 ? 's' : ''}</h3><span class="spacer"></span>
      <button class="btn primary" id="akGo" ${ready.length ? '' : 'disabled'}>Mark ${ready.length} as filed</button></div>
      <div class="table-wrap"><table><thead><tr><th>File</th><th>Client</th><th>Return · period</th><th>ARN / SRN</th><th>Filed on</th><th>Work to mark</th></tr></thead><tbody>
      ${rows.map((x, i) => `<tr class="${x.done ? 'ak-done' : ''}"><td class="small wrap">${esc(x.file.name)}${x.err ? `<div class="late">${esc(x.err)}</div>` : ''}</td>
        <td>${x.client ? esc(cLabel(x.client)) : `<span class="late small">No client with ${esc(x.r.gstin || x.r.tan || x.r.cin || 'this number')}</span>`}</td>
        <td>${esc(x.r.form || '—')} <span class="muted small">${esc(x.r.period || '')}</span></td>
        <td><input class="ak-in" data-akarn="${i}" value="${esc(x.r.arn || '')}" ${x.done ? 'disabled' : ''}></td>
        <td><input type="date" data-akdt="${i}" value="${esc(x.r.filed_on || '')}" ${x.done ? 'disabled' : ''}></td>
        <td>${x.done ? '<span class="st st-filed">Filed ✓</span>' : x.client ? `<select data-aktask="${i}"><option value="">— skip —</option>${opts(x.tasks, x.task ? x.task.id : '', t => `${t.return_name} · ${t.period || ''}${t.status === 'Filed' ? ' (already filed)' : ''}`, t => t.id)}</select>${x.task && !x.sure ? '<div class="small" style="color:var(--amber)">best guess — please check</div>' : ''}` : '—'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    $('#akRes').oninput = $('#akRes').onchange = e => {
      const i = +(e.target.dataset.akarn ?? e.target.dataset.akdt ?? e.target.dataset.aktask ?? -1); if (i < 0) return;
      const x = rows[i];
      if (e.target.dataset.akarn != null) x.r.arn = e.target.value.trim().toUpperCase() || null;
      if (e.target.dataset.akdt != null) x.r.filed_on = e.target.value || null;
      if (e.target.dataset.aktask != null) { x.task = x.tasks.find(t => t.id === e.target.value) || null; x.sure = true; if (e.type === 'change') draw(); }
      const n = rows.filter(y => y.task && !y.done && y.r.arn).length, b = $('#akGo'); if (b) { b.disabled = !n; b.textContent = `Mark ${n} as filed`; }
    };
    const go = $('#akGo');
    if (go) go.onclick = async () => {
      go.disabled = true; let n = 0, stored = 0;
      for (const x of rows.filter(y => y.task && !y.done && y.r.arn)) {
        try { const res = await ACK.save(x.task, x.r, x.file); x.done = true; n++; if (res.stored) stored++; } catch (e) { x.err = friendly(e); }
      }
      toast(`${n} marked Filed${stored < n ? ` (${n - stored} PDF${n - stored > 1 ? 's' : ''} not stored)` : ''}`, stored < n);
      draw(); drawSaved();
    };
  };
  const add = async files => {
    const pdfs = [...files].filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return toast('Choose PDF files', true);
    $('#akRes').innerHTML = '<div class="card"><div class="loading">Reading ' + pdfs.length + ' file' + (pdfs.length > 1 ? 's' : '') + '…</div></div>';
    const byClient = {};
    for (const file of pdfs) {
      const x = { file, r: {}, client: null, tasks: [], task: null, sure: false };
      try { x.r = ACK.parse(await ACK.readText(file)); } catch (e) { x.err = /password/i.test(e.message || '') ? 'Locked PDF — save a copy without the password' : 'Could not read'; rows.push(x); continue; }
      x.client = ACK.clientFor(x.r);
      if (x.client) {
        if (!byClient[x.client.id]) { const q = await safe(sb.from('tasks').select('id,client_id,work_type,return_name,period,due_date,status,arn').eq('client_id', x.client.id).order('due_date', { ascending: false }).limit(400)); byClient[x.client.id] = q.data || []; }
        x.tasks = byClient[x.client.id].filter(t => !x.r.kind || ACK.formMatches(x.r.form, x.r.kind, t.return_name) || t.status !== 'Filed');
        const p = ACK.pick(x.r, byClient[x.client.id]); x.task = p.task; x.sure = p.sure;
        if (x.task && !x.tasks.includes(x.task)) x.tasks.unshift(x.task);
      }
      if (!x.r.form && !x.r.arn) x.err = 'Does not look like an acknowledgement';
      rows.push(x);
    }
    draw();
  };
  const drop = $('#akDrop');
  drop.onclick = () => $('#akFile').click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#akFile').click(); } };
  $('#akFile').onchange = e => { add(e.target.files); e.target.value = ''; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); };
  drawSaved();
};

/* =====================================================================
   v28  MONTHLY DOCUMENTS — one page for the month: what each client must send,
   ticked as it arrives (the same "Documents from client" lists the work items use)
   ===================================================================== */
let mdf = { month: '', missing: true, staff: '', q: '' };
const mdMsg = (c, tasks, missing) => `Dear ${c.contact_person || c.name},\nFor ${tasks.map(t => `${t.return_name} - ${t.period}`).join(', ')}, we are waiting for:\n${missing.map(x => '- ' + x).join('\n')}\nPlease share at the earliest so we can file on time.\nStatus: ${statusUrl(c.status_token)}\n- ${firmName()}`;
VIEWS.docs = async v => {
  await loadRefs();
  if (!mdf.month) mdf.month = today().slice(0, 7);
  const [y, m] = mdf.month.split('-').map(Number), from = `${mdf.month}-01`, to = iso(new Date(y, m, 0));
  v.innerHTML = `<div class="page-head"><h2>Documents for the month</h2><span class="muted">What each client still has to send</span></div>
    <div class="toolbar"><label class="small">Work due in <input type="month" id="mdM" value="${mdf.month}"></label>
      ${isManager() ? `<select id="mdS"><option value="">All staff</option>${opts(activeStaff(), mdf.staff, p => p.full_name || p.email, p => p.id)}</select>` : ''}
      <label class="check"><input type="checkbox" id="mdMiss" ${mdf.missing ? 'checked' : ''}> Only clients with documents missing</label>
      <input type="search" id="mdQ" placeholder="Search client" value="${esc(mdf.q)}"></div><div id="mdList"><div class="loading">Loading…</div></div>`;
  const tq = await must(sb.from('tasks').select('id,client_id,work_type,return_name,period,due_date,status,assigned_to,data_received_on').gte('due_date', from).lte('due_date', to).neq('status', 'Not applicable').limit(5000));
  let tasks = tq.data || [];
  const loadDocs = async () => {
    const out = [];
    for (let i = 0; i < tasks.length; i += 150) {
      const r = await safe(sb.from('task_docs').select('*').in('task_id', tasks.slice(i, i + 150).map(t => t.id)));
      if (r.error) return null; out.push(...(r.data || []));
    }
    return out;
  };
  let docs = await loadDocs();
  if (docs === null) { $('#mdList').innerHTML = '<p class="note warn">Client documents are not set up yet (update-phase4.sql).</p>'; return; }
  // fill in the standard list for work that has none yet (only open work this person may change)
  const has = new Set(docs.map(d => d.task_id));
  const fill = tasks.filter(t => !has.has(t.id) && t.status !== 'Filed' && (isManager() || t.assigned_to === me.id)).flatMap(t => {
    const tpl = templateFor(t.return_name); return tpl && (tpl.docs || []).length ? tpl.docs.map((n, i) => ({ task_id: t.id, seq: i + 1, name: n })) : [];
  });
  if (fill.length) { for (let i = 0; i < fill.length; i += 300) await safe(sb.from('task_docs').upsert(fill.slice(i, i + 300), { onConflict: 'task_id,name', ignoreDuplicates: true })); docs = await loadDocs() || docs; }

  const render = () => {
    const s = mdf.q.toLowerCase(), byC = {};
    tasks.filter(t => !mdf.staff || t.assigned_to === mdf.staff).forEach(t => (byC[t.client_id] = byC[t.client_id] || []).push(t));
    let list = Object.entries(byC).map(([cid, ts]) => {
      const c = clientById(cid) || { id: cid, name: '—' }, ids = new Set(ts.map(t => t.id)), names = {};
      docs.filter(d => ids.has(d.task_id)).forEach(d => { (names[d.name] = names[d.name] || []).push(d); });
      const items = Object.entries(names).map(([n, rows]) => ({ n, rows, got: rows.every(r => r.received) })).sort((a, b) => a.got - b.got || a.n.localeCompare(b.n));
      return { c, ts, items, missing: items.filter(x => !x.got).map(x => x.n) };
    }).filter(x => (!s || (x.c.name + ' ' + (x.c.client_code || '')).toLowerCase().includes(s)) && (!mdf.missing || x.missing.length));
    list.sort((a, b) => b.missing.length - a.missing.length || a.c.name.localeCompare(b.c.name));
    const allC = Object.keys(byC).length, done = Object.values(byC).length - list.filter(x => x.missing.length).length;
    $('#mdList').innerHTML = `<p class="muted small">${allC} client${allC === 1 ? '' : 's'} with work due in ${MONTHS_FULL[m - 1]} ${y}${mdf.missing ? ` · showing ${list.length} still missing documents` : ''}. Tick a document when it arrives — it is ticked in every work item that needs it, and the client sees it on their status link. Automatic reminders list what is still missing.</p>` +
      (list.length ? list.map(x => {
        const got = x.items.filter(i => i.got).length, pct = x.items.length ? Math.round(100 * got / x.items.length) : 100;
        const can = isManager() || x.ts.some(t => t.assigned_to === me.id);
        return `<div class="card md-client" data-cid="${x.c.id}"><div class="md-head"><div><b>${esc(cLabel(x.c))}</b>
            <div class="muted small">${x.ts.map(t => `${esc(t.return_name)} ${esc(t.period || '')} <span class="st st-${slug(t.status)}">${esc(t.status)}</span>`).join(' · ')}</div></div><span class="spacer"></span>
            ${x.items.length ? `<span class="small"><b>${got}</b> of ${x.items.length} received</span><div class="hbar"><i class="${pct === 100 ? 'green' : pct >= 50 ? 'amber' : 'red'}" style="width:${pct}%"></i></div>` : '<span class="small muted">No list</span>'}</div>
          <div class="md-docs">${x.items.length ? x.items.map(i => `<button type="button" class="md-doc ${i.got ? 'got' : ''}" data-mdn="${esc(i.n)}" ${can ? '' : 'disabled'} aria-pressed="${i.got}">${i.got ? '✓' : '○'} ${esc(i.n)}</button>`).join('') : '<span class="muted small">No document list for this work — add one in the work item’s Checklist.</span>'}</div>
          ${x.missing.length && can ? `<div class="md-foot">${x.c.phone ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(waShare(mdMsg(x.c, x.ts, x.missing), x.c.phone))}">Ask on WhatsApp</a>` : ''}
            ${clientEmails(x.c).length ? `<a class="btn sm ghost" href="mailto:${esc(clientEmails(x.c).join(','))}?subject=${encodeURIComponent('Documents needed: ' + x.ts.map(t => t.return_name + ' ' + t.period).join(', '))}&body=${encodeURIComponent(mdMsg(x.c, x.ts, x.missing))}">Email</a>` : ''}
            <button class="btn sm ghost" data-mdall>Mark all received</button></div>` : ''}</div>`;
      }).join('') : `<div class="table-wrap"><div class="empty">${mdf.missing ? 'Every client has sent everything for this month 🎉' : 'No work due this month.'}</div></div>`);
  };
  const setDocs = async (cid, names, val) => {
    const ids = new Set(tasks.filter(t => t.client_id === cid).map(t => t.id));
    const rows = docs.filter(d => ids.has(d.task_id) && names.includes(d.name) && !!d.received !== val);
    if (!rows.length) return;
    await must(sb.from('task_docs').update({ received: val }).in('id', rows.map(r => r.id)));
    rows.forEach(r => { r.received = val; r.received_on = val ? today() : null; });
  };
  $('#mdList').onclick = async e => {
    const card = e.target.closest('.md-client'); if (!card) return;
    const b = e.target.closest('[data-mdn]'), all = e.target.closest('[data-mdall]');
    try {
      if (b) { const n = b.dataset.mdn, now = b.getAttribute('aria-pressed') !== 'true'; b.disabled = true; await setDocs(card.dataset.cid, [n], now); }
      if (all) { all.disabled = true; await setDocs(card.dataset.cid, [...card.querySelectorAll('[data-mdn]')].map(x => x.dataset.mdn), true); toast('All documents marked received'); }
      if (b || all) { const t2 = await must(sb.from('tasks').select('id,status,data_received_on').in('id', tasks.filter(t => t.client_id === card.dataset.cid).map(t => t.id))); (t2.data || []).forEach(u => Object.assign(tasks.find(t => t.id === u.id), u)); render(); }
    } catch (err) { toast(friendly(err), true); render(); }
  };
  $('#mdM').onchange = e => { mdf.month = e.target.value || today().slice(0, 7); route(); };
  if ($('#mdS')) $('#mdS').onchange = e => { mdf.staff = e.target.value; render(); };
  $('#mdMiss').onchange = e => { mdf.missing = e.target.checked; render(); };
  $('#mdQ').oninput = e => { mdf.q = e.target.value; render(); };
  render();
};


/* =====================================================================
   v29  FEES & PROFITABILITY (#/profit, Partners & Admin)
   Per client for a financial year: work done, billed (before GST), received, outstanding,
   average fee per return against the Fee list, unbilled filed work, effort (notices, follow-ups),
   days to pay — and flags: under-charged, not billed, slow payer.
   ===================================================================== */
let pf = { fy: 0, flag: '', q: '', sort: 'billed' };
VIEWS.profit = async v => {
  await loadRefs();
  const now = new Date(), curFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  if (!pf.fy) pf.fy = curFy;
  const from = `${pf.fy}-04-01`, to = `${pf.fy + 1}-03-31`, fyL = `FY ${pf.fy}-${String(pf.fy + 1).slice(2)}`;
  v.innerHTML = `<div class="page-head"><h2>Fees &amp; profitability</h2><span class="muted">${fyL}</span><span class="spacer"></span><button class="btn" id="pfCsv">Export CSV</button></div>
    <div class="toolbar"><select id="pfFy">${[0, 1, 2].map(k => curFy - k).map(y => `<option value="${y}" ${y === pf.fy ? 'selected' : ''}>FY ${y}-${String(y + 1).slice(2)}</option>`).join('')}</select>
      <select id="pfFlag"><option value="">All clients</option><option value="under">Under-charged</option><option value="unbilled">Work not billed</option><option value="slow">Slow payers</option><option value="nofee">Work with no fee</option></select>
      <select id="pfSort"><option value="billed">Sort: billed (high → low)</option><option value="rate">Sort: % of standard fee (low → high)</option><option value="work">Sort: work done</option><option value="due">Sort: outstanding</option></select>
      <input type="search" id="pfQ" placeholder="Search client" value="${esc(pf.q)}"></div><div id="pfBody"><div class="loading">Working it out…</div></div>`;
  $('#pfFlag').value = pf.flag; $('#pfSort').value = pf.sort;
  const [tk, iv, py, fr, nt, fu] = await Promise.all([
    must(sb.from('tasks').select('id,client_id,work_type,return_name,period,due_date,status,filed_on,fee,invoice_id').eq('status', 'Filed').gte('due_date', from).lte('due_date', iso(addDays(new Date(to + 'T00:00:00'), 31))).limit(20000)),
    safe(sb.from('invoices').select('id,client_id,inv_no,inv_date,subtotal,total,paid').gte('inv_date', from).lte('inv_date', to).limit(10000)),
    safe(sb.from('payments').select('invoice_id,amount,paid_on').gte('paid_on', from).limit(20000)),
    must(sb.from('fee_rates').select('*')),
    safe(sb.from('notices').select('client_id,notice_date').gte('notice_date', from).lte('notice_date', to).limit(5000)),
    safe(sb.from('followups').select('client_id,kind,on_date').gte('on_date', from).lte('on_date', to).limit(20000))
  ]);
  const tasks = tk.data || [], invs = iv.error ? [] : iv.data || [], pays = py.error ? [] : py.data || [], fees = fr.data || [];
  const nots = nt.error ? [] : nt.data || [], fus = fu.error ? [] : fu.data || [];
  const std = r => { const f = fees.find(x => !x.client_id && lc(x.return_name) === lc(r.return_name)); return f ? num(f.amount) : null; };
  const own = r => { const f = fees.find(x => x.client_id === r.client_id && lc(x.return_name) === lc(r.return_name)); return f ? num(f.amount) : null; };
  const charged = r => r.fee != null ? num(r.fee) : own(r) ?? std(r) ?? 0;
  const rows = clients.filter(c => c.active || tasks.some(t => t.client_id === c.id) || invs.some(i => i.client_id === c.id)).map(c => {
    const w = tasks.filter(t => t.client_id === c.id), ci = invs.filter(i => i.client_id === c.id);
    const billed = ci.reduce((a, i) => a + num(i.subtotal != null ? i.subtotal : i.total), 0), billedG = ci.reduce((a, i) => a + num(i.total), 0);
    const recd = ci.reduce((a, i) => a + num(i.paid), 0), due = billedG - recd;
    const unb = w.filter(t => !t.invoice_id), unbVal = unb.reduce((a, t) => a + charged(t), 0);
    const withStd = w.filter(t => std(t) != null && std(t) > 0), stdVal = withStd.reduce((a, t) => a + std(t), 0), chVal = withStd.reduce((a, t) => a + charged(t), 0);
    const pct = stdVal ? Math.round(100 * chVal / stdVal) : null;
    const nofee = w.filter(t => charged(t) === 0).length;
    const dpay = ci.filter(i => num(i.total) - num(i.paid) <= 0.009).map(i => { const ps = pays.filter(p => p.invoice_id === i.id).map(p => p.paid_on).sort(); return ps.length ? (new Date(ps[ps.length - 1]) - new Date(i.inv_date)) / 864e5 : null; }).filter(x => x != null);
    const oldDue = ci.filter(i => num(i.total) - num(i.paid) > 0.009).map(i => (now - new Date(i.inv_date)) / 864e5);
    const days = dpay.length ? Math.round(dpay.reduce((a, b) => a + b, 0) / dpay.length) : null;
    const flags = [];
    if (pct != null && pct < 80) flags.push(['under', `Under-charged (${pct}% of standard)`, 'amber']);
    if (unb.length) flags.push(['unbilled', `${unb.length} filed, not billed`, 'red']);
    if ((days != null && days > 60) || oldDue.some(d => d > 90)) flags.push(['slow', days != null && days > 60 ? `Pays in ~${days} days` : 'Unpaid over 90 days', 'red']);
    if (nofee) flags.push(['nofee', `${nofee} with no fee set`, 'amber']);
    return { c, work: w.length, billed, recd, due, avg: w.length ? billed / Math.max(1, w.length - unb.length) : 0, pct, unb: unb.length, unbVal,
      notices: nots.filter(n => n.client_id === c.id).length, fups: fus.filter(f => f.client_id === c.id).length, days, flags };
  });
  const render = () => {
    const s = pf.q.toLowerCase();
    let list = rows.filter(r => (!s || cLabel(r.c).toLowerCase().includes(s)) && (!pf.flag || r.flags.some(f => f[0] === pf.flag)));
    const by = { billed: (a, b) => b.billed - a.billed, rate: (a, b) => (a.pct ?? 999) - (b.pct ?? 999), work: (a, b) => b.work - a.work, due: (a, b) => b.due - a.due }[pf.sort];
    list.sort(by);
    const T = k => rows.reduce((a, r) => a + r[k], 0);
    const under = rows.filter(r => r.flags.some(f => f[0] === 'under')).length;
    $('#pfBody').innerHTML = `<div class="bento-stats card stats4" style="margin-bottom:14px">
        <div class="mini blue"><span>Billed (before GST)</span><b>${inr(T('billed'))}</b></div>
        <div class="mini green"><span>Received</span><b>${inr(T('recd'))}</b></div>
        <div class="mini red"><span>Outstanding</span><b>${inr(T('due'))}</b></div>
        <div class="mini amber"><span>Filed but not billed</span><b>${inr(T('unbVal'))}</b><small>${rows.reduce((a, r) => a + r.unb, 0)} returns · ${under} client${under === 1 ? '' : 's'} under-charged</small></div></div>
      ${list.length ? `<div class="table-wrap"><table class="pf-table"><thead><tr><th>Client</th><th class="r">Returns filed</th><th class="r">Billed</th><th class="r">Received</th><th class="r">Outstanding</th>
        <th class="r">Avg fee / return</th><th class="r">vs standard fee</th><th class="r">Not billed</th><th class="r">Effort</th><th>Flags</th></tr></thead><tbody>
        ${list.map(r => `<tr><td class="wrap"><b>${esc(cLabel(r.c))}</b>${r.c.active ? '' : ' <span class="badge">inactive</span>'}</td><td class="r">${r.work}</td><td class="r">${inr(r.billed)}</td><td class="r">${inr(r.recd)}</td>
          <td class="r ${r.due > 0.009 ? 'late' : ''}">${inr(r.due)}</td><td class="r">${r.work ? inr(Math.round(r.avg)) : '—'}</td>
          <td class="r">${r.pct == null ? '<span class="muted">—</span>' : `<span class="${r.pct < 80 ? 'late' : r.pct >= 100 ? 'ok-t' : ''}">${r.pct}%</span>`}</td>
          <td class="r">${r.unb ? `${r.unb} · ${inr(r.unbVal)}` : '—'}</td>
          <td class="r small" title="Notices handled · follow-ups logged">${r.notices} notices · ${r.fups} follow-ups</td>
          <td class="wrap">${r.flags.map(f => `<span class="chip ${f[2]} small">${esc(f[1])}</span>`).join(' ') || '<span class="muted small">OK</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="table-wrap"><div class="empty">No clients match.</div></div>'}
      <p class="muted small">“vs standard fee” compares what was charged for each return with the standard Fee list (100% = standard). “Not billed” = filed returns with no invoice yet (valued at their fee). Effort counts notices and client follow-ups in the year. Invoices and payments are for invoices dated in ${fyL}.</p>`;
  };
  render();
  $('#pfFy').onchange = e => { pf.fy = +e.target.value; route(); };
  $('#pfFlag').onchange = e => { pf.flag = e.target.value; render(); };
  $('#pfSort').onchange = e => { pf.sort = e.target.value; render(); };
  $('#pfQ').oninput = e => { pf.q = e.target.value; render(); };
  $('#pfCsv').onclick = () => download(`fees-profitability-${fyL.replace(/\s/g, '')}.csv`, toCSV([['Client code', 'Client', 'Returns filed', 'Billed (before GST)', 'Received', 'Outstanding', 'Avg fee per return', '% of standard fee', 'Filed not billed (count)', 'Filed not billed (value)', 'Notices', 'Follow-ups', 'Avg days to pay', 'Flags'],
    ...rows.map(r => [r.c.client_code || '', r.c.name, r.work, Math.round(r.billed), Math.round(r.recd), Math.round(r.due), Math.round(r.avg), r.pct ?? '', r.unb, Math.round(r.unbVal), r.notices, r.fups, r.days ?? '', r.flags.map(f => f[1]).join('; ')])]));
};


/* =====================================================================
   v30  MONTHLY DATA REQUEST EMAILS (Settings card)
   GST data · TDS payment workings · TDS return filing — sent on the 1st at 9 AM IST
   ===================================================================== */
const DR_KIND = { gst: 'GST data request', tds_pay: 'TDS payment workings', tds_return: 'TDS return filing' };
const DR_TAGS = { gst: '{contact} {client} {period} {returns} {due_line} {reply_by} {portal} {firm} {firm_phone}',
  tds_pay: '{contact} {client} {period} {due} {reply_by} {portal} {firm} {firm_phone}',
  tds_return: '{contact} {client} {quarter} {fy} {quarter_months} {forms} {due} {reply_by} {portal} {firm} {firm_phone}' };
async function renderDataRequestSettings(box) {
  const r = await safe(sb.rpc('dr_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Monthly data request emails</h3><p class="note small">Run <b>update-session13.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {}, edit = isPartner(), plan = s.plan || [], cur = s.this_month || [];
  const nd = s.next_day ? fmtDate(s.next_day) : '1st of next month', count = k => plan.filter(p => p.kind === k).length;
  const noMail = plan.filter(p => !p.to), curLeft = cur.filter(p => !p.already && p.to);
  box.innerHTML = `<div class="card"><h3>Monthly data request emails</h3>
    <p class="muted">On the 1st of every month at 9 AM the office mailbox sends each client the data request they need — <b>GST data</b> (monthly filers every month, QRMP clients after each quarter), <b>TDS payment workings</b> (every month) and <b>TDS return filing</b> (1 Jul, 1 Oct, 1 Jan, 1 Apr). Signed with the firm name. Clients reply to the email or upload on the client portal; if nothing comes by the reply-by date, data chasing takes over.</p>
    <div class="mail-stat"><span class="pill ${s.enabled ? 'g' : 'a'}">${s.enabled ? '● On' : 'Off'}</span>
      <span class="small">Last run: <b>${s.last_run_at ? new Date(s.last_run_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</b>${s.last_note ? ' · ' + esc(s.last_note) : ''}</span></div>
    <div class="form-grid" style="margin-top:12px">
      <label>GST data — reply by (day of month)<input type="number" id="drG" min="1" max="28" value="${esc(s.gst_reply_day)}"></label>
      <label>TDS payment workings — reply by<input type="number" id="drP" min="1" max="28" value="${esc(s.tdsp_reply_day)}"></label>
      <label>TDS return filing — reply by<input type="number" id="drR" min="1" max="28" value="${esc(s.tdsr_reply_day)}"></label></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="drOn" ${s.enabled ? 'checked' : ''}> <b>Switched on</b> — send automatically on the 1st</label>
    <div class="toolbar" style="margin-top:12px">${edit ? '<button class="btn primary" id="drSave">Save</button><button class="btn" id="drTpl">Edit email text</button>' : ''}<span class="spacer"></span>
      ${curLeft.length ? `<button class="btn" id="drNow">Send this month's ${curLeft.length} unsent email${curLeft.length > 1 ? 's' : ''} now</button>` : ''}</div>
    <h4 style="margin:16px 0 6px">On ${esc(nd)}: ${plan.length} email${plan.length === 1 ? '' : 's'} — ${count('gst')} GST · ${count('tds_pay')} TDS payment · ${count('tds_return')} TDS return</h4>
    ${noMail.length ? `<p class="note warn small">${noMail.length} client${noMail.length > 1 ? 's have' : ' has'} no email saved and will be skipped: ${[...new Set(noMail.map(p => p.client))].map(esc).join(', ')}.</p>` : ''}
    ${plan.length ? `<div class="table-wrap"><table class="small"><thead><tr><th>Client</th><th>Email</th><th>For</th><th>Sent to</th><th></th></tr></thead><tbody>
      ${plan.map((p, i) => `<tr><td>${esc(cLabel(clientById(p.client_id) || { name: p.client }))}</td><td>${esc(DR_KIND[p.kind])}</td><td>${esc(p.period)}</td>
        <td class="wrap">${p.to ? esc(p.to.replace(/,/g, ', ')) : '<span class="late">no email</span>'}</td><td><button class="btn sm ghost" data-drpv="${i}">Preview</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted small">No client is set up for these emails yet. Tick GST in a client\'s services (with GST scheme Monthly or QRMP), or the TDS ticks on the client form.</p>'}
    <p class="muted small">To leave a client out, open the client and tick “Don't send automatic reminders”.</p></div>`;
  if (!edit) $$('input', box).forEach(x => x.disabled = true);
  $$('[data-drpv]', box).forEach(b => b.onclick = async () => {
    const p = plan[+b.dataset.drpv];
    const q = await safe(sb.rpc('dr_preview', { p_client: p.client_id, p_kind: p.kind, p_day: s.next_day }));
    if (q.error || !q.data) return toast(q.error ? friendly(q.error) : 'Nothing to preview', true);
    modal(DR_KIND[p.kind] + ' — ' + p.client, `<p class="small" style="margin-top:0"><b>To:</b> ${esc((q.data.to || '—').replace(/,/g, ', '))}<br><b>Subject:</b> ${esc(q.data.subject)}</p>
      <pre class="dr-mail">${esc(q.data.body)}</pre>`, { wide: true });
  });
  if ($('#drSave', box)) $('#drSave', box).onclick = async () => {
    const n = id => Math.round(num($(id, box).value));
    try { await must(sb.rpc('dr_save', { p: { enabled: $('#drOn', box).checked, gst_reply_day: n('#drG'), tdsp_reply_day: n('#drP'), tdsr_reply_day: n('#drR') } })); toast('Saved'); renderDataRequestSettings(box); }
    catch (e) { toast(friendly(e), true); }
  };
  if ($('#drNow', box)) $('#drNow', box).onclick = async e => {
    if (!confirm(`Send ${curLeft.length} data request email${curLeft.length > 1 ? 's' : ''} for this month now?\n${curLeft.slice(0, 8).map(p => '• ' + p.client + ' – ' + DR_KIND[p.kind]).join('\n')}${curLeft.length > 8 ? '\n…' : ''}`)) return;
    e.target.disabled = true;
    try { const { data } = await must(sb.rpc('dr_run_now')); toast(`${data} email${data === 1 ? '' : 's'} queued — the office mailbox sends them within a minute`); renderDataRequestSettings(box); }
    catch (err) { toast(friendly(err), true); e.target.disabled = false; }
  };
  if ($('#drTpl', box)) $('#drTpl', box).onclick = () => {
    const T = s.templates || {};
    const m = modal('Edit data request emails', `<div class="dr-tabs">${Object.keys(DR_KIND).map((k, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-drk="${k}">${esc(DR_KIND[k])}</button>`).join('')}</div>
      <label class="full">Subject<input name="sub"></label>
      <label class="full">Email text<textarea name="body" rows="18" class="dr-body"></textarea></label>
      <p class="muted small" data-tags></p>`, { wide: true, saveText: 'Save this email', onSave: async el => {
        await must(sb.rpc('dr_save_template', { p_kind: cur, p_subject: fv(el, 'sub'), p_body: $('[name=body]', el).value }));
        T[cur] = { subject: fv(el, 'sub'), body: $('[name=body]', el).value }; toast(DR_KIND[cur] + ' saved'); return false;
      } });
    let cur = 'gst';
    const show = k => { cur = k; $$('[data-drk]', m.el).forEach(b => b.classList.toggle('on', b.dataset.drk === k));
      $('[name=sub]', m.el).value = (T[k] || {}).subject || ''; $('[name=body]', m.el).value = (T[k] || {}).body || '';
      $('[data-tags]', m.el).innerHTML = 'Filled in for each client: ' + DR_TAGS[k].split(' ').map(t => `<code>${esc(t)}</code>`).join(' '); };
    $$('[data-drk]', m.el).forEach(b => b.onclick = () => show(b.dataset.drk));
    show('gst');
  };
}

/* =====================================================================
   v31  SAMPLE DATA FOR THE DEMO (Settings card, Admin only)
   Loads 20 made-up clients (DEMO-01 … DEMO-20) with work, notices, invoices, payments,
   requests and follow-ups — and clears them all in one click. Nothing is ever emailed for them.
   ===================================================================== */
async function renderDemoSettings(box) {
  if (!isAdmin()) { box.innerHTML = ''; return; }
  const r = await safe(sb.rpc('demo_status'));
  if (r.error) { box.innerHTML = '<div class="card"><h3>Sample data for the demo</h3><p class="note small">Run <b>update-session14.sql</b> in Supabase to switch this on.</p></div>'; return; }
  const s = r.data || {}, on = num(s.clients) > 0;
  box.innerHTML = `<div class="card demo-card"><h3>Sample data for the demo</h3>
    <p class="muted">Fills the tracker with <b>20 made-up clients</b> (codes DEMO-01 to DEMO-20) and a realistic month of work — GST, TDS and MCA returns in every status, two overdue items, notices with a reply draft and a hearing, invoices with full / part / no payment, work requests and follow-ups — so every screen has something to show. Demo clients use example.com emails and have automatic reminders switched off, so <b>nothing is ever sent</b> to anyone.</p>
    <div class="mail-stat"><span class="pill ${on ? 'a' : 'g'}">${on ? '● Sample data loaded' : 'No sample data'}</span>
      ${on ? `<span class="small">${num(s.clients)} clients · ${num(s.tasks)} work items · ${num(s.notices)} notices · ${num(s.invoices)} invoices</span>` : ''}</div>
    <div class="toolbar" style="margin-top:12px">${on ? '<button class="btn danger" id="demoClear">Clear sample data</button>' : '<button class="btn primary" id="demoLoad">Load sample data</button>'}</div>
    <p class="muted small">${on ? 'Clear it after the demo — it removes the demo clients and everything linked to them (work, notices, invoices, payments, requests, follow-ups, emails, activity). Your real clients are not touched.' : 'Takes a few seconds. Your real clients are not touched, and one click removes it all again.'}</p></div>`;
  const go = async (btn, rpc, ask, done) => {
    if (!confirm(ask)) return;
    btn.disabled = true; btn.textContent = 'Working…';
    try { const { data } = await must(sb.rpc(rpc)); toast(done(data || {})); await loadRefs(true); renderDemoSettings(box); }
    catch (e) { toast(friendly(e), true); btn.disabled = false; renderDemoSettings(box); }
  };
  if ($('#demoLoad', box)) $('#demoLoad', box).onclick = e => go(e.target, 'demo_load',
    'Load 20 sample clients with work, notices and invoices for the demo?\n\nNothing will be emailed. You can clear it all with one click afterwards.',
    d => `Sample data loaded: ${num(d.clients)} clients, ${num(d.tasks)} work items, ${num(d.invoices)} invoices`);
  if ($('#demoClear', box)) $('#demoClear', box).onclick = e => go(e.target, 'demo_clear',
    `Remove all ${num(s.clients)} demo clients (DEMO-01 to DEMO-20) and everything linked to them?\n\nThis cannot be undone. Real clients are not touched.`,
    d => `Sample data cleared: ${num(d.clients)} demo clients removed`);
}
function demoBanner() {
  if (!isAdmin() || !(clients || []).some(c => c.is_demo)) return '';
  return `<p class="note warn small demo-banner">Sample data is loaded (DEMO-01 to DEMO-20). Clear it in <a href="#/settings">Settings → Sample data for the demo</a> before real work starts.</p>`;
}

/* =====================================================================
   v32  THEMES: Professional (everyone) and Game (Admin & Team members can choose)
   Game adds points, a level and a filing streak, worked out from real filings:
     10 points for every return filed this financial year, +5 when it was filed by the due date,
     +10 for every work request done. Level = every 1,000 points. Streak = working days in a row
     (Sundays skipped) with at least one filing. Admin sees the office's numbers, a team member their own.
   ===================================================================== */
const KPI_SVG = {
  late: '<path d="M4 6h16v14H4zM8 3v4M16 3v4M4 10h16"></path><path d="M12 13v3M12 18.5h.01"></path>',
  soon: '<path d="M4 6h16v14H4zM8 3v4M16 3v4M4 10h16"></path><path d="M9 15l2 2 4-4"></path>',
  wait: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"></path>',
  note: '<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4"></path>',
  done: '<path d="M20 6L9 17l-5-5"></path>'
};
const kpiIco = k => `<i class="kpi-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${KPI_SVG[k]}</svg></i>`
  + `<i class="kpi-wm" aria-hidden="true"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${KPI_SVG[k]}</svg></i><i class="kpi-go" aria-hidden="true">›</i>`;
const GAME = {
  cache: null, at: 0,
  on() { return document.documentElement.dataset.look === 'game' && !!me && canLayoutB(); },
  async stats(force) {
    if (!force && this.cache && this.cache.uid === me.id && Date.now() - this.at < 300000) return this.cache;
    const now = new Date(), fy0 = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, t = today();
    const mine = q => (isAdmin() ? q : q.eq('assigned_to', me.id));
    const [f, o, w] = await Promise.all([
      safe(mine(sb.from('tasks').select('due_date,filed_on').eq('status', 'Filed').gte('filed_on', `${fy0}-04-01`)).limit(20000)),
      safe(mine(sb.from('tasks').select('id,due_date').not('status', 'in', '("Filed","Not applicable")').lt('due_date', t)).limit(5000)),
      safe(mine(sb.from('work_requests').select('done_at').eq('status', 'Done')).limit(5000))]);
    const filed = f.error ? [] : f.data || [], done = w.error ? [] : (w.data || []).filter(x => x.done_at && x.done_at.slice(0, 10) >= `${fy0}-04-01`);
    const pts = filed.reduce((a, x) => a + 10 + (x.due_date && x.filed_on && x.filed_on <= x.due_date ? 5 : 0), 0) + done.length * 10;
    const days = new Set(filed.map(x => x.filed_on));
    let d = new Date(), streak = 0;
    if (!days.has(iso(d))) d = addDays(d, -1);
    for (let i = 0; i < 400; i++) { const k = iso(d); if (days.has(k)) { streak++; d = addDays(d, -1); } else if (d.getDay() === 0) d = addDays(d, -1); else break; }
    const mo = t.slice(0, 7), month = filed.filter(x => (x.filed_on || '').slice(0, 7) === mo);
    this.cache = { uid: me.id, pts, level: 1 + Math.floor(pts / 1000), into: pts % 1000, streak, overdue: o.error ? 0 : (o.data || []).length,
      month: month.length, ontime: month.filter(x => x.due_date && x.filed_on <= x.due_date).length };
    this.at = Date.now();
    return this.cache;
  },
  async bar() {
    const el = $('#gameBar'); if (!el) return;
    if (!this.on()) { el.hidden = true; el.innerHTML = ''; return; }
    const s = await this.stats().catch(() => null); if (!s) return;
    el.hidden = false;
    el.innerHTML = `<span class="gb-pts" title="10 points for each return filed this year, +5 when filed by the due date, +10 for each work request done">⭐ <b>${s.pts.toLocaleString('en-IN')}</b> pts</span>
      <span class="gb-lvl" title="${1000 - s.into} points to level ${s.level + 1}">🏆 <span><b>Level ${s.level}</b><i class="gb-prog"><i style="width:${Math.round(s.into / 10)}%"></i></i></span></span>`;
  },
  async hero(el) {
    if (!el) return;
    const s = await this.stats().catch(() => null); if (!s) { el.remove(); return; }
    const who = isAdmin() ? 'The office is' : 'You’re';
    const [h, sub] = s.overdue ? [`${s.overdue} item${s.overdue > 1 ? 's' : ''} overdue — let’s clear ${s.overdue > 1 ? 'them' : 'it'}!`, `${s.month} filed this month · finish the overdue work to keep the streak going.`]
      : [s.month ? 'Keep up the great work!' : 'A fresh month — let’s go!', `${who} on track this month · ${s.month} filed${s.month ? `, ${Math.round(100 * s.ontime / s.month)}% on time` : ''}.`];
    el.innerHTML = `<div class="gh-trophy" aria-hidden="true">🏆</div>
      <div class="gh-text"><b>${esc(h)}</b><span>${esc(sub)}</span></div>
      <div class="gh-art" aria-hidden="true"><span class="gh-mtn">⛰️</span><span class="gh-flag">🚩</span><span class="gh-rocket">🚀</span></div>
      <div class="gh-streak" title="Working days in a row with at least one filing (Sundays skipped)"><span aria-hidden="true">🔥</span><span><small>${isAdmin() ? 'Office streak' : 'Your streak'}</small><b>${s.streak} day${s.streak === 1 ? '' : 's'}</b></span></div>`;
  }
};

window.__tracker = { GAME, ACK, dashTabs, AUDIT, IDLE, clientProblems, HEALTH, HELP, noticeLetter, BANK, bankReadFile, TDSW, MCA, BILL, parseMcaSheets, mcaPlanAll, fillGstWorkings, G1, GR, RECO, gstr3bFromApi, periodToMonth, strongPassword, periodFor, dueDateFor, parseCSV, toCSV, gstLateFee, gstInterest, tdsCalc, rocCalc, monthsSpan, tdsDepositDue, g1json, clientReportHtml, clientReportMsg, rnStage, anyDate, parseRenewalRows, gstPayDue, tdsPayDue, advInstalment, advCurrent, advDue, recurringPlan, taxMsg, addMonths, fyEndOf, obProgress, rnKind };
start();
})();

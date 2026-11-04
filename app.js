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
  sb.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') showSetPassword(); });
  const { data: { session } } = await sb.auth.getSession();
  if (recovering && session) return showSetPassword();
  session ? boot() : showLogin();
}

function showLogin(msg) {
  root.innerHTML = `<div class="auth-wrap"><form class="card auth" id="loginForm">
    <div class="brand">${esc(cfg.FIRM_NAME || 'Office Work Tracker')}</div>
    <h2>Sign in</h2>${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    <label>Email<input name="email" type="email" required autocomplete="username"></label>
    <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn primary full" type="submit">Sign in</button>
    <button class="link small" type="button" id="forgot">Forgot password?</button></form></div>`;
  const f = $('#loginForm');
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) { toast(error.message, true); b.disabled = false; b.textContent = 'Sign in'; }
    else boot();
  };
  $('#forgot').onclick = async () => {
    const email = f.email.value.trim();
    if (!email) return toast('Type your email first, then click "Forgot password?"', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    error ? toast(error.message, true) : toast('A reset link has been sent to your email');
  };
}

function showSetPassword() {
  root.innerHTML = `<div class="auth-wrap"><form class="card auth" id="pwForm">
    <div class="brand">${esc(cfg.FIRM_NAME || 'Office Work Tracker')}</div><h2>Set a new password</h2>
    <label>New password<input name="p1" type="password" minlength="8" required autocomplete="new-password"></label>
    <label>Repeat password<input name="p2" type="password" minlength="8" required autocomplete="new-password"></label>
    <button class="btn primary full">Save password</button></form></div>`;
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
    const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!prof) { await sb.auth.signOut(); return showLogin('Your login has no profile. Ask the admin to check the setup (schema.sql).'); }
    if (!prof.active) { await sb.auth.signOut(); return showLogin('Your account has been deactivated. Please contact the admin.'); }
    me = prof;
    await loadRefs();
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
  const [p, c, s] = await Promise.all([
    must(sb.from('profiles').select('*').order('full_name')),
    must(sb.from('clients').select('*').order('name')),
    must(sb.from('settings').select('*').eq('id', 1).maybeSingle())
  ]);
  profiles = p.data || []; clients = c.data || []; settings = s.data || {};
  // checklists (empty if update-checklists.sql has not been run yet)
  const [t, r] = await Promise.all([
    sb.from('checklist_templates').select('*').order('id'),
    sb.from('linked_rules').select('*').order('id')
  ]);
  templates = t.error ? [] : t.data || []; rules = r.error ? [] : r.data || [];
}

function renderShell() {
  const nav = [['dashboard', 'Dashboard'], ['work', isManager() ? 'All work' : 'My work'], ['calendar', 'Due dates'], ['notices', 'Notices'], ['updates', 'Updates'], ['checklists', 'Checklists']]
    .concat(isManager() ? [['workload', 'Workload'], ['billing', 'Billing']] : []).concat(isPartner() ? [['reports', 'Reports']] : []).concat(isManager() ? [['clients', 'Clients']] : []);
  root.innerHTML = `<header class="top">
      <div class="brand">${esc(settings.firm_name || cfg.FIRM_NAME || 'Office Work Tracker')}</div>
      <nav id="nav">${nav.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${l}</a>`).join('')}</nav>
      <div class="user"><button class="btn ghost sm" id="userBtn">${esc(me.full_name || me.email)} ▾</button>
        <div class="menu" id="userMenu" hidden>
          <div class="menu-info">${esc(me.email)}<br><span class="badge">${esc(ROLE_LABEL[me.role] || me.role)}</span></div>
          ${isAdmin() ? '<a href="#/team" data-act="nav">Team</a><a href="#/settings" data-act="nav">Settings</a>' : ''}<a href="#/calc" data-act="nav">Late fee calculator</a><button data-act="install">Install app on this device</button><button data-act="theme">Theme</button><button data-act="pw">Change password</button><button data-act="out">Sign out</button></div></div>
    </header><main id="view"></main>`;
  const menu = $('#userMenu');
  $('#userBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.onclick = async e => {
    const act = e.target.dataset.act;
    if (act === 'out') { await sb.auth.signOut(); me = null; location.hash = ''; showLogin(); }
    if (act === 'pw') changePassword();
    if (act === 'theme') pickTheme();
    if (act === 'install') installApp();
  };
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
  const body = `<div class="small muted" style="font-weight:600;margin-bottom:8px">Theme</div>
    <div class="skins">${T.SKINS.map(([k, name]) => { const [bg, hero, acc] = SKIN_PREVIEW[k];
      return `<button type="button" class="skin ${start.skin === k ? 'on' : ''}" data-s="${k}" aria-pressed="${start.skin === k}">
        <span class="pv" style="background:${bg}"><i style="height:38px;background:${hero}"></i><i style="height:22px;background:${acc}"></i><i style="height:30px;background:${hero};opacity:.6"></i></span><b>${esc(name)}</b></button>`; }).join('')}</div>
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Animation</div>
    <div class="seg" data-anim-seg>${[['full', 'Full'], ['subtle', 'Subtle'], ['off', 'Off']].map(([k, l]) =>
      `<button type="button" data-an="${k}" class="${start.anim === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div data-orig>
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Light / dark (Original theme)</div>
    <div class="seg" data-mode>${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Same as device']].map(([k, l]) =>
      `<button type="button" data-m="${k}" class="${start.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="small muted" style="font-weight:600;margin:18px 0 6px">Accent colour (Original theme)</div>
    <div class="swatches">${ACCENTS.map(([k, c, l]) =>
      `<button type="button" class="swatch ${start.accent === k ? 'on' : ''}" data-a="${k}" title="${l}" aria-label="${l}" style="background:${c}"></button>`).join('')}</div></div>
    <p class="muted small" style="margin-top:16px">Saved on this device only — each person can pick their own. Changes show instantly.</p>`;
  const m = modal('Theme', body, { onSave: () => { toast('Theme saved'); route(); }, saveText: 'Done', wide: true,
    extra: '<button class="btn ghost" data-reset>Reset</button>' });
  const el = m.el;
  const sync = () => {
    const cur = T.get();
    $$('[data-s]', el).forEach(b => { b.classList.toggle('on', b.dataset.s === cur.skin); b.setAttribute('aria-pressed', b.dataset.s === cur.skin); });
    $$('[data-an]', el).forEach(b => b.classList.toggle('on', b.dataset.an === cur.anim));
    $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === cur.mode));
    $$('[data-a]', el).forEach(b => b.classList.toggle('on', b.dataset.a === cur.accent));
    $('[data-orig]', el).style.opacity = cur.skin === 'original' ? '1' : '.4';
    $('[data-orig]', el).style.pointerEvents = cur.skin === 'original' ? '' : 'none';
  };
  sync();
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.s) { T.setSkin(b.dataset.s); sync(); }
    if (b.dataset.an) { T.setAnim(b.dataset.an); sync(); }
    if (b.dataset.m) { T.set(b.dataset.m, null); sync(); }
    if (b.dataset.a) { T.set(null, b.dataset.a); sync(); }
    if (b.hasAttribute('data-reset')) { T.reset(); sync(); }
  });
  // Cancel / close restores the previous choice
  $$('[data-x]', el).forEach(x => x.addEventListener('click', () => { T.setSkin(start.skin); T.setAnim(start.anim); T.set(start.mode, start.accent); }));
}

const VIEWS = {};
async function route() {
  if (!me) return;
  const key = location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  const adminOnly = ['clients', 'team', 'settings', 'billing', 'reports'];
  const need = { team: isAdmin, settings: isAdmin, reports: isPartner, clients: isManager, billing: isManager, workload: isManager }[key];
  if (!VIEWS[key] || (need && !need())) { location.hash = '#/dashboard'; return; }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.k === key));
  const v = $('#view');
  v.innerHTML = '<div class="loading">Loading…</div>';
  try { await VIEWS[key](v); }
  catch (e) { v.innerHTML = `<div class="card"><p class="error">Something went wrong: ${esc(friendly(e))}</p></div>`; }
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
      <td class="row-btns"><button class="btn sm" data-edit="${r.id}">${can ? 'Edit' : 'View'}</button>${hasChecklist(r) ? `<button class="btn sm" data-chk="${r.id}" title="Checklist">☑ Checklist</button>` : ''}</td></tr>`;
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
    <label class="full">Client<select name="client_id" ${dis}>${isNew ? '<option value="">Select client…</option>' : ''}${opts(clients.filter(c => c.active || c.id === task.client_id), task.client_id, c => c.name, c => c.id)}</select></label>
    <label>Work type<select name="work_type" ${dis}>${opts(typesWith(task.work_type), task.work_type)}</select></label>
    <label>Return / task<input name="return_name" list="${dlFor(task.work_type)}" value="${esc(task.return_name || '')}" placeholder="Pick or type, e.g. GSTR-3B" ${dis}></label>
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
    ${!isNew ? `<p class="muted small full">Last updated ${new Date(task.updated_at).toLocaleString('en-IN')}${task.updated_by ? ' by ' + esc(profName(task.updated_by)) : ''}</p>` : ''}
  </div>`;
  const extra = (isPartner() && !isNew ? '<button class="btn danger" data-del>Delete</button>' : '') +
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
        <input name="mt" value="${esc((t.matches || []).join(', '))}" list="dl-allret" placeholder="e.g. GSTR-1, IFF"></label>
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
      <label class="full">Client<select name="cl"><option value="">Select client…</option>${opts(clients.filter(c => c.active), '', c => c.name, c => c.id)}</select></label>
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
    <label>Return / task<input name="return_name" list="${dlFor(preset.work_type || 'GST')}" value="${esc(preset.return_name || '')}" placeholder="Pick or type, e.g. GSTR-3B"></label>
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
VIEWS.dashboard = async v => {
  const now = new Date(), t = today(), in7 = iso(addDays(now, 7));
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const mStart = iso(new Date(y, m - 1, 1)), mEnd = iso(new Date(y, m, 0));
  let notRows = [], invRows = null, luNew = 0, payFu = [];
  const [open, month, dd] = await Promise.all([
    must(sb.from('tasks').select('*').not('status', 'in', '("Filed","Not applicable")').order('due_date', { ascending: true, nullsFirst: false }).limit(3000)),
    must(sb.from('tasks').select('id,client_id,work_type,return_name,status,due_date,filed_on,remarks').gte('due_date', mStart).lte('due_date', mEnd).limit(5000)),
    must(sb.from('due_dates').select('*').order('sort')),
    safe(sb.from('notices').select('id,status,reply_due,hearing_date').neq('status', 'Closed').limit(3000)),
    safe(sb.from('law_updates').select('id').eq('status', 'published').gte('published_at', iso(addDays(now, -14))).limit(100)),
    isManager() && P4() ? safe(sb.from('invoices').select('client_id,total,paid').limit(5000)) : Promise.resolve({ data: null }),
    isManager() ? safe(sb.from('followups').select('client_id,on_date,next_on,created_at').eq('kind', 'payment').order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000)) : Promise.resolve({ data: [] })
  ]).then(r => { notRows = r[3].error ? [] : r[3].data || []; luNew = r[4].error ? 0 : (r[4].data || []).length; invRows = r[5].error ? null : r[5].data; payFu = r[6].error ? [] : r[6].data || []; return r; });
  const rows = open.data || [];
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
      <div class="chips">${chips.join('') || '<span class="chip green">All clear — nothing overdue</span>'}</div>
    </section>
    <section class="bento-card bento-portals">
      <h2>Quick portals</h2>
      <div class="portals">${PORTALS.map(([w, name, url]) => `<a href="${url}" target="_blank" rel="noopener"><span style="color:${WT_TONE[w][1]}">${wtIcon(w, 20)}</span><b>${esc(name)}</b></a>`).join('')}</div>
    </section>
  </div>
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
  const wa = $('[data-wa-send]', v);
  if (wa) wa.onclick = async () => {
    if (!confirm("Send today's pending-work reminders to staff on WhatsApp now?")) return;
    wa.disabled = true;
    try { const { data } = await must(sb.rpc('wa_admin_run', { p_kind: 'daily' })); toast(data ? `${data} reminder(s) sent` : 'Nothing sent — check Settings → WhatsApp reminders', !data); }
    catch (e) { toast(friendly(e), true); } finally { wa.disabled = false; }
  };
};

/* ---------- WORK LIST ---------- */
const WF_DEFAULT = { month: '', status: 'open', type: '', ret: '', staff: '', client: '', q: '', quick: '' };
let wf = { ...WF_DEFAULT };
VIEWS.work = async v => {
  v.innerHTML = `<div class="page-head"><h2>${isManager() ? 'All work' : 'My work'}</h2><span class="spacer"></span>
      ${isManager() ? '<button class="btn" id="bulkBtn">+ Create for many clients</button><button class="btn primary" id="addBtn">+ Add work</button>' : ''}</div>
    <div class="wtabs" role="tablist">${WT_TABS.map(([k, l]) => `<button role="tab" data-wt="${esc(k)}" class="${wf.type === k ? 'on' : ''}">${k ? wtIcon(k, 16) : ''}<span>${l}</span><b data-n="${esc(k)}">…</b></button>`).join('')}</div>
    <div class="toolbar">
      <input type="month" id="fMonth" value="${esc(wf.month)}" title="Due month">
      <select id="fStatus"><option value="open">Open (not filed)</option><option value="all">All statuses</option>${opts(STATUSES, wf.status)}</select>
      <select id="fRet"><option value="">All returns</option>${opts(wf.type ? WORK_ITEMS[wf.type] || [] : [].concat(...WORK_TYPES.map(w => WORK_ITEMS[w] || [])), wf.ret)}</select>
      ${isManager() ? `<select id="fStaff"><option value="">All staff</option><option value="none" ${wf.staff === 'none' ? 'selected' : ''}>Unassigned</option>${opts(activeStaff(), wf.staff, p => p.full_name || p.email, p => p.id)}</select>` : ''}
      <select id="fClient"><option value="">All clients</option>${opts(clients, wf.client, c => c.name, c => c.id)}</select>
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
      <a class="btn" href="#/calc">Late fee calculator</a>
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
    <label>Return / task<input name="return_name" list="${dlFor(d.work_type)}" value="${esc(d.return_name || '')}"></label>
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
  v.innerHTML = `<div class="page-head"><h2>Clients</h2><span class="muted">${clients.filter(c => c.active).length} active</span><span class="spacer"></span>
      <button class="btn" id="tplBtn">CSV template</button><button class="btn" id="impBtn">Import CSV</button>
      <button class="btn primary" id="addC">+ Add client</button><input type="file" id="impFile" accept=".csv,text/csv" hidden></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="Search name / GSTIN / PAN" value="${esc(clientQ)}">
      <label class="check"><input type="checkbox" id="inact" ${showInactive ? 'checked' : ''}> Show inactive</label></div>
    <div id="cList"></div>`;
  const render = () => {
    const s = clientQ.toLowerCase();
    const list = clients.filter(c => (showInactive || c.active) && (!s || [c.name, c.gstin, c.pan, c.tan, c.cin].join(' ').toLowerCase().includes(s)));
    $('#cList').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>Client</th><th>GSTIN</th><th>PAN / TAN</th><th>GST scheme</th><th>Services</th><th>Default staff</th><th>Status link</th><th></th></tr></thead><tbody>
      ${list.map(c => `<tr>
        <td class="wrap"><b>${esc(c.name)}</b>${c.active ? '' : ' <span class="badge">inactive</span>'}<div class="muted small">${esc([c.contact_person, c.phone].filter(Boolean).join(' · '))}</div></td>
        <td class="small">${esc(c.gstin || '—')}</td><td class="small">${esc(c.pan || '—')}<div class="muted">${esc(c.tan || '')}</div></td>
        <td>${esc(c.gst_scheme)}</td><td class="wrap">${(c.services || []).map(wtBadge).join(' ')}</td>
        <td>${esc(profName(c.default_staff) || '—')}</td>
        <td class="row-btns"><button class="btn sm" data-copy="${c.id}">Copy link</button><a class="btn sm" href="${esc(waShare(clientMsg(c), c.phone))}" target="_blank" rel="noopener" title="Send on WhatsApp">WhatsApp</a><a class="btn sm ghost" href="${esc(statusUrl(c.status_token))}" target="_blank" rel="noopener">Open</a></td>
        <td><button class="btn sm" data-ed="${c.id}">Edit</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="table-wrap"><div class="empty">${clients.length ? 'No match.' : 'No clients yet. Add one, or import your list from a CSV file.'}</div></div>`;
  };
  render();
  $('#cq').oninput = e => { clientQ = e.target.value; render(); };
  $('#inact').onchange = e => { showInactive = e.target.checked; render(); };
  $('#addC').onclick = () => editClient(null);
  $('#cList').onclick = e => {
    if (e.target.dataset.copy) copy(statusUrl(clientById(e.target.dataset.copy).status_token));
    if (e.target.dataset.ed) editClient(clientById(e.target.dataset.ed));
  };
  $('#tplBtn').onclick = () => download('clients-template.csv', toCSV([
    ['name', 'gstin', 'pan', 'tan', 'cin', 'contact_person', 'phone', 'email', 'gst_scheme', 'services', 'default_staff_email'],
    ['ABC Traders', '33AAAAA0000A1Z5', 'AAAAA0000A', 'CHEA00000A', '', 'Mr. Kumar', '9876543210', 'abc@example.com', 'Monthly', 'GST;TDS;Income Tax', me.email]]));
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
        return { name: get(r, 'name'), gstin: get(r, 'gstin').toUpperCase() || null, pan: get(r, 'pan').toUpperCase() || null, tan: get(r, 'tan').toUpperCase() || null,
          cin: get(r, 'cin').toUpperCase() || null, contact_person: get(r, 'contact_person') || null, phone: get(r, 'phone') || null, email: get(r, 'email') || null,
          gst_scheme: scheme, services, default_staff: staff ? staff.id : null };
      });
      if (!confirm(`Import ${recs.length} client(s)?`)) return;
      await must(sb.from('clients').insert(recs));
      toast(`${recs.length} clients imported`); route();
    } catch (err) { toast(friendly(err), true); }
  };
};

function editClient(c) {
  const isNew = !c;
  c = c || { gst_scheme: 'Monthly', services: ['GST'], active: true };
  const body = `<div class="form-grid">
    <label class="full">Client / business name<input name="name" value="${esc(c.name || '')}"></label>
    <label>GSTIN<input name="gstin" value="${esc(c.gstin || '')}" maxlength="15" style="text-transform:uppercase"></label>
    <label>GST scheme<select name="gst_scheme">${opts(GST_SCHEMES, c.gst_scheme)}</select></label>
    <label>PAN<input name="pan" value="${esc(c.pan || '')}" maxlength="10" style="text-transform:uppercase"></label>
    <label>TAN<input name="tan" value="${esc(c.tan || '')}" maxlength="10" style="text-transform:uppercase"></label>
    <label>CIN / LLPIN<input name="cin" value="${esc(c.cin || '')}" style="text-transform:uppercase"></label>
    <label>Default staff<select name="default_staff">${staffOpts(c.default_staff || '', { blank: 'None' })}</select></label>
    <label>Contact person<input name="contact_person" value="${esc(c.contact_person || '')}"></label>
    <label>Phone / WhatsApp<input name="phone" value="${esc(c.phone || '')}" placeholder="10-digit mobile"></label>
    ${P4() ? `<label class="full">Address (for invoices)<textarea name="address" rows="2">${esc(c.address || '')}</textarea></label>` : ''}
    <label class="full">Email (for data tracking — separate several with commas)<input name="email" value="${esc(c.email || '')}" placeholder="accounts@client.com, owner@client.com"></label>
    <div class="full"><div class="small muted" style="margin-bottom:6px;font-weight:500">Services you handle for this client</div>
      <div class="toolbar" style="margin:0" data-svc>${[...WORK_TYPES, ...(c.services || []).filter(x => !WORK_TYPES.includes(x))].map(w => `<label class="check"><input type="checkbox" value="${esc(w)}" ${(c.services || []).includes(w) ? 'checked' : ''}> ${wtIcon(w, 16)} ${esc(w)}</label>`).join('')}</div></div>
    <label class="full">Notes<textarea name="notes">${esc(c.notes || '')}</textarea></label>
    <label class="check full"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> Active client</label>
    ${!isNew && c.gstin && isAdmin() ? `<div class="full"><button type="button" class="btn sm" data-gstnow>Check GST filing now</button>
      <span class="muted small">Looks up this GSTIN's filed returns and marks matching open GST work as Filed.</span></div>` : ''}
    ${!isNew && isManager() ? '<div class="full portal-box" data-portal></div>' : ''}
    ${!isNew ? `<div class="full"><div class="small muted" style="font-weight:500">Client status link (share with this client only)</div>
      <div class="linkbox"><input readonly value="${esc(statusUrl(c.status_token))}"><button type="button" class="btn sm" data-cp>Copy</button><a class="btn sm" href="${esc(waShare(clientMsg(c), c.phone))}" target="_blank" rel="noopener">WhatsApp</a><button type="button" class="btn sm" data-regen>New link</button></div></div>` : ''}
  </div>`;
  const m = modal(isNew ? 'Add client' : 'Edit client', body, {
    wide: true,
    extra: isNew || !isPartner() ? '' : '<button class="btn danger" data-del>Delete</button>',
    onSave: async el => {
      const up = n => fv(el, n).toUpperCase() || null;
      const rec = {
        name: fv(el, 'name'), gstin: up('gstin'), pan: up('pan'), tan: up('tan'), cin: up('cin'),
        gst_scheme: fv(el, 'gst_scheme'), default_staff: fv(el, 'default_staff') || null,
        contact_person: fv(el, 'contact_person') || null, phone: fv(el, 'phone') || null, email: fv(el, 'email') || null,
        ...(P4() ? { address: fv(el, 'address') || null } : {}),
        notes: fv(el, 'notes') || null, active: $('[name=active]', el).checked,
        services: $$('[data-svc] input:checked', el).map(i => i.value)
      };
      if (!rec.name) { toast('Name is required', true); return false; }
      if (rec.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(rec.gstin)) { toast('GSTIN should be 15 characters', true); return false; }
      if (rec.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(rec.pan)) { toast('PAN format looks wrong (e.g. ABCDE1234F)', true); return false; }
      if (isNew) await must(sb.from('clients').insert(rec));
      else await must(sb.from('clients').update(rec).eq('id', c.id));
      toast('Saved'); route();
    }
  });
  const el = m.el;
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
};

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
  if (billTab === 'toinv') renderToInvoice(box, toInv, fees);
  if (billTab === 'inv') renderInvoices(box, invoices);
  if (billTab === 'due') renderDue(box, due);
  if (billTab === 'fees') renderFees(box, fees);
};

function renderToInvoice(box, rows, fees = []) {
  const rateFor = r => { const f = fees.find(x => x.client_id === r.client_id && lc(x.return_name) === lc(r.return_name)) || fees.find(x => !x.client_id && lc(x.return_name) === lc(r.return_name)); return f ? f.amount : ''; };
  if (!rows.length) { box.innerHTML = '<div class="table-wrap"><div class="empty">All filed work is invoiced 🎉</div></div>'; return; }
  const by = {}; rows.forEach(r => (by[r.client_id] = by[r.client_id] || []).push(r));
  const ids = Object.keys(by).sort((a, b) => clientName(a).localeCompare(clientName(b)));
  box.innerHTML = `<p class="muted small">Filed work that is not billed yet. Fees come from the Fee list — change any amount here before creating the invoice.</p>` +
    ids.map(cid => `<div class="card bill-client" data-cid="${cid}">
      <div class="bill-head"><h3 style="margin:0">${esc(clientName(cid))}</h3><span class="muted small">${by[cid].length} item${by[cid].length > 1 ? 's' : ''}</span></div>
      <div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-all checked aria-label="Select all"></th><th>Work</th><th>Filed on</th><th style="width:140px">Fee (₹)</th></tr></thead><tbody>
      ${by[cid].map(r => `<tr><td><input type="checkbox" data-t="${r.id}" checked aria-label="Select"></td><td>${wtBadge(r.work_type)} ${esc(r.return_name)} <span class="muted small">${esc(r.period)}</span></td>
        <td class="small">${fmtDate(r.filed_on)}</td><td><input type="number" min="0" step="1" class="fee-in" data-fee="${r.id}" value="${r.fee ?? rateFor(r)}" placeholder="0"></td></tr>`).join('')}
      <tr><td></td><td><input data-xdesc placeholder="Extra line (optional), e.g. Consultation" style="width:100%"></td><td></td><td><input type="number" min="0" class="fee-in" data-xamt placeholder="0"></td></tr>
      </tbody></table></div>
      <div class="bill-foot"><span>Selected: <b data-sum>₹0</b> <span class="muted small" data-gstamt></span></span><span class="spacer"></span>
        <label class="small">GST <select data-gst>${[...new Set([18, 5, 0, num(settings.gst_rate)])].sort((a, b) => b - a).map(r => `<option value="${r}" ${r === num(settings.gst_rate) ? 'selected' : ''}>${r}%</option>`).join('')}</select></label>
        <label class="small">Invoice date <input type="date" data-date value="${today()}"></label>
        <button class="btn primary" data-mk>Create invoice</button></div></div>`).join('');
  const recalc = card => {
    let s = 0;
    $$('[data-t]', card).forEach(c => { if (c.checked) s += num($(`[data-fee="${c.dataset.t}"]`, card).value); });
    s += num($('[data-xamt]', card).value);
    const r = num($('[data-gst]', card).value), g = Math.round(s * r) / 100;
    $('[data-sum]', card).textContent = inr(s);
    $('[data-gstamt]', card).textContent = r ? `+ GST ${r}% ${inr(g)} = ${inr(s + g)}` : '(no GST)';
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

function invStatus(i) {
  if (i.zoho_status === 'void') return '<span class="st st-not-applicable">Void</span>';
  const bal = num(i.total) - num(i.paid);
  return bal <= 0.009 ? '<span class="st st-filed">Paid</span>' : num(i.paid) > 0 ? '<span class="st st-ready-to-file">Part paid</span>' : '<span class="st st-pending-data">Unpaid</span>';
}
function renderInvoices(box, invoices) {
  const list = billClient ? invoices.filter(i => i.client_id === billClient) : invoices;
  box.innerHTML = `<div class="toolbar"><select id="bc"><option value="">All clients</option>${opts(clients, billClient, c => c.name, c => c.id)}</select>
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
function addPayment(i) {
  const bal = (num(i.total) - num(i.paid)).toFixed(2);
  modal(`Payment for ${i.inv_no}`, `<p class="muted small" style="margin-top:0">${esc(clientName(i.client_id))} · Total ${inr(i.total)} · Balance <b>${inr(bal)}</b></p>
    <div class="form-grid"><label>Received on<input type="date" name="d" value="${today()}"></label>
      <label>Amount (₹)<input type="number" name="a" min="1" step="0.01" value="${bal}"></label>
      <label>Mode<select name="m">${opts(['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other'], 'Bank transfer')}</select></label>
      <label>Reference (UTR / cheque no.)<input name="r"></label></div>`, {
    saveText: 'Save payment',
    onSave: async el => {
      const amount = num(fv(el, 'a')); if (!(amount > 0)) { toast('Enter the amount', true); return false; }
      const { data: pay } = await must(sb.from('payments').insert({ invoice_id: i.id, paid_on: fv(el, 'd') || today(), amount, mode: fv(el, 'm'), ref: fv(el, 'r') || null }).select().single());
      toast('Payment saved');
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
      <label>Client<select name="fc"><option value="">Standard (all clients)</option>${opts(clients.filter(c => c.active), '', c => c.name, c => c.id)}</select></label>
      <label>Return / work<input name="fr" list="dl-feeret" placeholder="e.g. GSTR-3B"></label>
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
  const all = r.data || [], t = today(), in7 = iso(addDays(new Date(), 7));
  v.innerHTML = `<div class="page-head"><h2>Notices</h2><span class="spacer"></span>${isManager() ? '<button class="btn primary" id="addN">+ Add notice</button>' : ''}</div>
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
          <td class="wrap">${esc(n.notice_type)}<div class="muted small">${esc([n.ref_no, n.period].filter(Boolean).join(' · '))}</div></td>
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
};
function editNotice(n) {
  const isNew = !n, admin = isManager();
  n = n || { dept: 'GST', status: 'Open', notice_date: today() };
  const can = admin || n.assigned_to === me.id, dis = admin ? '' : 'disabled', ro = can ? '' : 'disabled';
  const body = `<div class="form-grid">
    <label class="full">Client<select name="client_id" ${dis}>${isNew ? '<option value="">Select client…</option>' : ''}${opts(clients.filter(c => c.active || c.id === n.client_id), n.client_id, c => c.name, c => c.id)}</select></label>
    <label>Department<select name="dept" ${dis}>${opts(NOTICE_DEPTS, n.dept, d => d === 'ROC/MCA' ? 'MCA' : d)}</select></label>
    <label>Notice type<input name="notice_type" list="dl-ntype" value="${esc(n.notice_type || '')}" placeholder="e.g. ASMT-10" ${dis}></label>
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
    <label class="full">Remarks / next action<textarea name="remarks" ${ro}>${esc(n.remarks || '')}</textarea></label></div>`;
  const m = modal(isNew ? 'Add notice' : 'Notice details', body, {
    extra: isPartner() && !isNew ? '<button class="btn danger" data-ndel>Delete</button>' : '',
    onSave: can ? async el => {
      const rec = {};
      ['ref_no', 'period', 'notice_date', 'hearing_date', 'status', 'replied_on', 'ack_no', 'remarks'].forEach(k => rec[k] = fv(el, k) || null);
      if (admin) { ['client_id', 'dept', 'notice_type', 'reply_due', 'assigned_to'].forEach(k => rec[k] = fv(el, k) || null); rec.amount = fv(el, 'amount') === '' ? null : num(fv(el, 'amount')); }
      if (admin && (!rec.client_id || !rec.notice_type)) { toast('Client and notice type are required', true); return false; }
      if (isNew) await must(sb.from('notices').insert(rec)); else await must(sb.from('notices').update(rec).eq('id', n.id));
      toast('Saved'); route();
    } : null
  });
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
    <p class="muted small">A full copy of the tracker (clients, work, checklists, documents list, notices, invoices, payments, fees, team) is saved automatically every night at 11:30 PM and kept for 30 days. Download any copy as Excel.</p>
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
    ['linked_rules', 'Linked filings'], ['team', 'Team']];
  for (const [k, name] of order) {
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
  box.innerHTML = `<div class="docs-box"><div class="docs-head"><h4 style="margin:0">Files uploaded by the client</h4><span class="muted small">${r.data.length}</span></div>
    ${r.data.map(u => `<div class="file-row"><span>📄 ${esc(u.file_name)}</span><span class="muted small">${new Date(u.uploaded_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${u.size_bytes ? ' · ' + Math.max(1, Math.round(u.size_bytes / 1024)) + ' KB' : ''}</span>
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

// expose pure helpers for testing
window.__tracker = { periodFor, dueDateFor, parseCSV, toCSV, gstLateFee, gstInterest, tdsCalc, rocCalc, monthsSpan, tdsDepositDue };
start();
})();

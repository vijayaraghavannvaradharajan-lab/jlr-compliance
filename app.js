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
  const nav = [['dashboard', 'Dashboard'], ['work', isManager() ? 'All work' : 'My work'], ['calendar', 'Due dates'], ['gst', 'GST review'], ['notices', 'Notices'], ['updates', 'Updates']]
    .concat(isManager() ? [['workload', 'Workload'], ['billing', 'Billing']] : []).concat(isPartner() ? [['reports', 'Reports']] : []).concat(isManager() ? [['clients', 'Clients']] : []);
  root.innerHTML = `<header class="top">
      <div class="brand">${esc(settings.firm_name || cfg.FIRM_NAME || 'Office Work Tracker')}</div>
      <nav id="nav">${nav.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${l}</a>`).join('')}</nav>
      <div class="user"><button class="btn ghost sm" id="userBtn">${esc(me.full_name || me.email)} ▾</button>
        <div class="menu" id="userMenu" hidden>
          <div class="menu-info">${esc(me.email)}<br><span class="badge">${esc(ROLE_LABEL[me.role] || me.role)}</span></div>
          ${isAdmin() ? '<a href="#/team" data-act="nav">Team</a><a href="#/settings" data-act="nav">Settings</a>' : ''}<a href="#/checklists" data-act="nav">Checklists</a><a href="#/calc" data-act="nav">Late fee calculator</a><button data-act="install">Install app on this device</button><button data-act="theme">Theme</button><button data-act="pw">Change password</button><button data-act="out">Sign out</button></div></div>
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
      ${isAdmin() ? '<button class="btn ghost" id="lgLog">Login access log</button>' : ''}<button class="btn" id="tplBtn">CSV template</button><button class="btn" id="impBtn">Import CSV</button>
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
        <td class="row-btns"><button class="btn sm" data-lgc="${c.id}" title="GST / TDS / MCA portal logins">🔑 Logins</button><button class="btn sm" data-ed="${c.id}">Edit</button></td></tr>`).join('')}
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
  };
  if ($('#lgLog')) $('#lgLog').onclick = () => loginLog(null);
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
    ${!isNew ? '<div class="full"><button type="button" class="btn sm" data-govlg>🔑 GST / TDS / MCA portal logins</button> <span class="muted small">Encrypted · every view is logged</span></div>' : ''}
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
    const S = (m.sales && m.sales.rows) || [], P = (m.purchases && m.purchases.rows) || [], B = (m.gstr2b && m.gstr2b.rows) || [];
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
    return { out, outB2B, outB2C, itc2b, blocked, rcm, itcBooks, itcBase, has2b, liab: fix(liab), setoff: so, cash, cashTotal: tax(cash), rec, checks,
      counts: { sales: S.length, purchases: P.length, b2b: B.length },
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
    patch.summary = { ...sm.trend, sales_n: sm.counts.sales, b2b_n: sm.counts.b2b, cash_draft: sm.cashTotal, at: new Date().toISOString() };
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
        <button class="btn sm" data-portal-api>Fetch from GST portal</button></div>
      <div class="gr-srcs">
        ${card('sales', 'Sales register', S, S ? `${S.rows.length} documents · taxable ${gst$(sm.out.t)} · tax ${gst$(gTax(sm.out))}` : 'Type in the GSTR-1 entry tab, or upload an Excel / CSV / Tally export',
          `<button class="btn sm" data-up="sales">Upload</button><button class="link small" data-tpl="sales">Template</button>`)}
        ${card('purchases', 'Purchase register (books)', P, P ? `${P.rows.length} documents · ITC in books ${gst$(gTax(sm.itcBooks))}` : 'Purchases as per books, for the 2B match',
          `<button class="btn sm" data-up="purchases">Upload</button><button class="link small" data-tpl="purchases">Template</button>`)}
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
          ${gTax(sm.rcm) ? row4('3.1(d) Inward supplies on reverse charge', sm.rcm) : ''}
          ${row4(`4(A)(5) ITC available ${sm.has2b ? '(GSTR-2B)' : '(books)'}`, sm.itcBase)}
          ${gTax(sm.blocked) ? row4('ITC not available in 2B (do not claim)', sm.blocked, 'warn-row') : ''}
        </tbody></table></div>
        <h4>Set-off &amp; cash payable</h4>
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
    const get = p => ((data || []).find(r => r.period === p) || {}).summary || null;
    const cols = [['sales', 'Sales (taxable)'], ['outTax', 'Output tax'], ['itc', 'ITC'], ['cash', 'Cash paid / payable']];
    const max = k => Math.max(1, ...months.map(p => (get(p) || {})[k] || 0));
    o.innerHTML = `<h3 style="margin-top:0">Last 6 months</h3><div class="table-wrap"><table class="gr-t"><thead><tr><th>Month</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}<th>Status</th></tr></thead><tbody>
      ${months.map(p => { const s = get(p), st = ((data || []).find(r => r.period === p) || {}).status; return `<tr><td><b>${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}</b></td>${cols.map(([k]) => `<td>${s ? `<div class="gr-bar"><i style="width:${Math.round(100 * (s[k] || 0) / max(k))}%"></i></div><span class="small">${gst$(s[k])}</span>` : '<span class="muted small">—</span>'}</td>`).join('')}
        <td>${st ? (st === 'Verified' ? '<span class="pill g">Verified</span>' : '<span class="pill a">Draft</span>') : ''}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muted small">Big swings month to month are worth a question to the client before filing.</p>`;
  }

  // ----- data in -----
  const pickFile = accept => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0]); i.click(); });
  async function upload(kind) {
    const f = await pickFile(kind === 'gstr2b' ? '.json,.xlsx,.xls,.zip' : '.xlsx,.xls,.csv');
    if (!f) return;
    if (/\.zip$/i.test(f.name)) return toast('Please unzip the portal download first and upload the .json file inside', true);
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
      await save({ [kind]: { rows, file: f.name, source: 'file', ...by() } });
      toast(`${label} saved — ${rows.length} documents`);
    } catch (e) { toast('Could not read the file: ' + friendly(e), true); }
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
    if (d.ent) enterFigures(d.ent);
    if (d.tpl) template(d.tpl);
    if (d.clr) { if (!confirm('Remove this data for the month?')) return; await save({ [d.clr]: null }).catch(err => toast(friendly(err), true)); }
    if ('portalApi' in d) gstPortalFetch(c, grMonth, async patch => { await save(patch); });
    if (b.id === 'grSaveNotes') { await save({ notes: $('#grNotes', body).value.trim() || null }).catch(err => toast(friendly(err), true)); toast('Notes saved'); }
    if (b.id === 'grVer') { if (!GR.summarise(row).counts.sales && !row.gstr2b) return toast('Add the data first', true); await save({ status: 'Verified', notes: $('#grNotes', body).value.trim() || null }).catch(err => toast(friendly(err), true)); toast('Marked as verified'); }
    if (b.id === 'grUnver') { await save({ status: 'Draft' }).catch(err => toast(friendly(err), true)); }
  });
  render();
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
        : x.st === 'CHECK' ? 'Unknown state / GSTIN state code' : !has(r.nil) && !has(r.rate) ? 'GST rate missing' : String(r.hsn ?? '').trim().length < 4 ? 'HSN / SAC must be at least 4 digits'
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
        v: r2(s * x.val), cn: s < 0 || undefined, src: 'G1' }; });
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
      <button class="btn sm" data-g1dl>Blank template</button><button class="btn sm" data-g1up>Upload filled template</button><button class="btn sm" data-g1xl>Download Excel</button><button class="btn sm" data-g1wb title="Your GST Workings master template, filled for the whole financial year">GST workings (master)</button>
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

// expose pure helpers for testing
window.__tracker = { fillGstWorkings, G1, GR, RECO, gstr3bFromApi, periodToMonth, strongPassword, periodFor, dueDateFor, parseCSV, toCSV, gstLateFee, gstInterest, tdsCalc, rocCalc, monthsSpan, tdsDepositDue };
start();
})();

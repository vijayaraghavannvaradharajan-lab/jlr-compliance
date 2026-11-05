/* Client portal: clients log in to see their work status, upload documents and download invoices. */
(() => {
  'use strict';
  const cfg = window.TRACKER_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const out = $('#out');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = s => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d} ${MONTHS[+m - 1]} ${y}`; };
  const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const num = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
  const inr = n => '₹' + num(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const today = new Date().toISOString().slice(0, 10);
  const LABEL = { 'Pending data': 'Waiting for your documents', 'In progress': 'In progress', 'Ready to file': 'Ready to file', 'Filed': 'Filed', 'Not applicable': 'Not applicable' };
  const badge = s => `<span class="st st-${slug(s)}">${esc(LABEL[s] || s)}</span>`;
  const toast = (msg, err) => { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500); };

  if (!window.supabase || /PASTE/.test(cfg.SUPABASE_URL || 'PASTE')) { out.innerHTML = '<div class="card"><div class="empty">The portal is not configured yet.</div></div>'; return; }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { storageKey: 'jlr-client-portal-auth' } });  // separate from staff login
  let data = null, tab = 'work', recovering = /type=(recovery|invite)/.test(location.hash);

  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; showSetPassword(); } });

  function showLogin(msg) {
    $('#title').textContent = 'Client portal'; $('#sub').textContent = 'Sign in to see your work status, upload documents and download invoices';
    out.innerHTML = `<div class="card portal-login"><h3 style="margin-top:0">Sign in</h3>${msg ? `<p class="note small">${esc(msg)}</p>` : ''}
      <form id="lf" class="form-grid"><label class="full">Email<input name="e" type="email" autocomplete="username" required></label>
        <label class="full">Password<input name="p" type="password" autocomplete="current-password" required></label>
        <div class="full toolbar" style="margin:0"><button class="btn primary" type="submit">Sign in</button><span class="spacer"></span><button class="link small" type="button" id="fg">Forgot password?</button></div></form></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const { error } = await sb.auth.signInWithPassword({ email: f.e.value.trim(), password: f.p.value });
      if (error) return toast('Email or password is wrong', true);
      load();
    };
    $('#fg').onclick = async () => {
      const email = $('[name=e]').value.trim(); if (!email) return toast('Type your email first', true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      toast(error ? 'Could not send the email now — ask your consultant for a new link' : 'If this email has a login, a reset link has been sent');
    };
  }
  function showSetPassword() {
    $('#title').textContent = 'Set your password'; $('#sub').textContent = 'Choose a password for the client portal';
    out.innerHTML = `<div class="card portal-login"><form id="sp" class="form-grid">
        <label class="full">New password<input name="p1" type="password" minlength="8" autocomplete="new-password" required></label>
        <label class="full">Repeat password<input name="p2" type="password" minlength="8" autocomplete="new-password" required></label>
        <div class="full"><button class="btn primary" type="submit">Save password</button></div></form></div>`;
    $('#sp').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (f.p1.value.length < 8) return toast('Use at least 8 characters', true);
      if (f.p1.value !== f.p2.value) return toast('Passwords do not match', true);
      const { error } = await sb.auth.updateUser({ password: f.p1.value });
      if (error) return toast(error.message, true);
      recovering = false; history.replaceState(null, '', location.pathname); toast('Password saved'); load();
    };
  }

  async function load() {
    const { data: s } = await sb.auth.getSession();
    if (!s || !s.session) return showLogin();
    if (recovering) return showSetPassword();
    const { data: me, error } = await sb.rpc('portal_me');
    if (error || !me) { await sb.auth.signOut({ scope: 'local' }); return showLogin('This login is not linked to a client. Staff should use the main tracker page instead.'); }
    data = me;
    const rp = await sb.rpc('portal_reports');
    data.reports = rp.error ? null : (rp.data || []);
    render();
  }

  function render() {
    const c = data.client, f = data.firm, tasks = data.tasks || [], invs = (data.invoices || []).filter(i => !i.void);
    document.title = `${c.name} · ${f.name || 'Client portal'}`;
    $('#title').textContent = c.name;
    $('#sub').innerHTML = `${c.gstin ? 'GSTIN ' + esc(c.gstin) + ' · ' : ''}Client portal of ${esc(f.name || '')} · <button class="link" id="so" style="color:inherit">Sign out</button>`;
    $('#so').onclick = async () => { await sb.auth.signOut({ scope: 'local' }); showLogin(); };
    const cnt = st => tasks.filter(t => t.status === st).length;
    const due = invs.reduce((a, i) => a + num(i.total) - num(i.paid), 0);
    out.innerHTML = `<div class="stats">
        <div class="stat amber"><div class="n">${cnt('Pending data')}</div><div class="l">Waiting for your documents</div></div>
        <div class="stat blue"><div class="n">${cnt('In progress') + cnt('Ready to file')}</div><div class="l">In progress</div></div>
        <div class="stat green"><div class="n">${cnt('Filed')}</div><div class="l">Filed</div></div>
        <div class="stat ${due > 0.009 ? 'red' : 'green'}"><div class="n">${inr(due)}</div><div class="l">Balance due</div></div></div>
      <div class="toolbar"><div class="tabs"><button data-tab="work" class="${tab === 'work' ? 'on' : ''}">Work status</button><button data-tab="inv" class="${tab === 'inv' ? 'on' : ''}">Invoices (${invs.length})</button>${data.reports && data.reports.length ? `<button data-tab="rep" class="${tab === 'rep' ? 'on' : ''}">Monthly reports (${data.reports.length})</button>` : ''}</div></div>
      <div id="pv"></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
    const pv = $('#pv');
    if (tab === 'work') {
      pv.innerHTML = tasks.length ? tasks.map(t => {
        const late = t.due_date && t.due_date < today && t.status !== 'Filed';
        const docs = t.docs || [], ups = t.uploads || [];
        return `<div class="card pt"><div class="pt-head"><b>${esc(t.return_name)}</b><span class="muted small">${esc(t.period)}</span><span class="spacer"></span>${badge(t.status)}</div>
          <div class="pt-meta small"><span class="${late ? 'late' : ''}">Due ${fmt(t.due_date)}</span>${t.filed_on ? `<span>Filed ${fmt(t.filed_on)}${t.arn ? ' · ' + esc(t.arn) : ''}</span>` : ''}${t.data_received_on ? `<span>Your data received ${fmt(t.data_received_on)}</span>` : ''}</div>
          ${docs.length && t.status !== 'Filed' ? `<div class="docs-pub">${docs.map(d => `<span class="${d.received ? 'ok' : 'need'}">${d.received ? '✓' : '○'} ${esc(d.name)}</span>`).join('')}</div>` : ''}
          ${ups.length ? `<div class="muted small" style="margin-top:6px">Uploaded: ${ups.map(u => esc(u.name)).join(', ')}</div>` : ''}
          ${t.status !== 'Filed' ? `<div style="margin-top:10px"><button class="btn sm primary" data-up="${t.id}">Upload documents</button></div>` : ''}</div>`;
      }).join('') + '<p class="muted small">○ = still needed, ✓ = received. Upload files here or share them with your consultant.</p>'
        : '<div class="table-wrap"><div class="empty">No work items yet.</div></div>';
      $$('[data-up]', pv).forEach(b => b.onclick = () => upload(tasks.find(t => t.id === b.dataset.up)));
    } else if (tab === 'rep' && data.reports) {
      pv.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Published</th><th></th></tr></thead><tbody>${data.reports.map((r, k) => { const [y, m] = r.period.split('-');
        return `<tr><td><b>${MONTHS[+m - 1]} ${y}</b></td><td class="muted small">${fmt(r.published_at)}</td><td><button class="btn sm primary" data-rep="${k}">Open / PDF</button></td></tr>`; }).join('')}</tbody></table></div>
        <p class="muted small">Each report shows returns filed (with ARN), tax paid, ITC, invoices missing in GSTR-2B and pending items.</p>`;
      $$('[data-rep]', pv).forEach(b => b.onclick = () => { const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to open the report', true); w.document.write(data.reports[+b.dataset.rep].html || '<p>Report not available</p>'); w.document.close(); });
    } else {
      pv.innerHTML = invs.length ? `<div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Balance</th><th></th></tr></thead><tbody>
        ${invs.map(i => `<tr><td><b>${esc(i.inv_no)}</b></td><td>${fmt(i.inv_date)}</td><td class="r">${inr(i.total)}</td><td class="r">${inr(i.paid)}</td>
          <td class="r"><b>${inr(num(i.total) - num(i.paid))}</b></td><td><button class="btn sm" data-inv="${i.id}">Download</button></td></tr>`).join('')}</tbody></table></div>
        ${f.bank ? `<div class="card" style="margin-top:12px"><b>Payment details</b><div class="small" style="white-space:pre-line;margin-top:4px">${esc(f.bank)}</div></div>` : ''}`
        : '<div class="table-wrap"><div class="empty">No invoices yet.</div></div>';
      $$('[data-inv]', pv).forEach(b => b.onclick = () => printInvoice(invs.find(i => i.id === b.dataset.inv)));
    }
  }

  function upload(t) {
    const need = (t.docs || []).filter(d => !d.received);
    const wrap = document.createElement('div'); wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>Upload documents</h3><button class="icon-btn" data-x aria-label="Close">×</button></div>
      <div class="modal-body"><p class="muted small" style="margin-top:0">${esc(t.return_name)} · ${esc(t.period)}</p><div class="form-grid">
        <label class="full">Which document is this?<select name="doc">${need.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}<option value="">Other document</option></select></label>
        <label class="full">Files (PDF, Excel, images — max 25 MB each)<input type="file" name="f" multiple accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip,.doc,.docx,.txt,.json"></label>
        <p class="muted small full" data-st></p></div></div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn ghost" data-x>Cancel</button><button class="btn primary" data-go>Upload</button></div></div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    $$('[data-x]', wrap).forEach(b => b.onclick = close);
    $('[data-go]', wrap).onclick = async e => {
      const files = [...$('[name=f]', wrap).files]; if (!files.length) return toast('Choose at least one file', true);
      const big = files.find(x => x.size > 25 * 1024 * 1024); if (big) return toast(`${big.name} is larger than 25 MB`, true);
      e.target.disabled = true; const st = $('[data-st]', wrap);
      const doc = $('[name=doc]', wrap).value || null;
      try {
        for (const [k, file] of files.entries()) {
          st.textContent = `Uploading ${k + 1} of ${files.length}: ${file.name}…`;
          const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);
          const path = `${data.client.id}/${t.id}/${Date.now()}-${safe}`;
          const { error } = await sb.storage.from('client-docs').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
          if (error) throw error;
          const r = await sb.rpc('portal_record_upload', { p_task: t.id, p_doc: k === 0 ? doc : null, p_path: path, p_name: file.name, p_size: file.size });
          if (r.error) throw r.error;
        }
        toast('Uploaded — thank you'); close(); load();
      } catch (err) { toast('Upload failed: ' + (err.message || err), true); e.target.disabled = false; st.textContent = ''; }
    };
  }

  function printInvoice(i) {
    const f = data.firm, c = data.client, rate = num(i.gst_rate), gst = num(i.gst_amount);
    const igst = (f.gstin || '').slice(0, 2) && (c.gstin || '').slice(0, 2) && (f.gstin || '').slice(0, 2) !== (c.gstin || '').slice(0, 2);
    const n2 = v => num(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const rows = (i.items || []).map((it, k) => `<tr><td>${k + 1}</td><td>${esc(it.desc)}</td><td>${esc(f.sac || '')}</td><td class="r">${n2(it.amount)}</td></tr>`).join('');
    const tax = rate ? (igst ? `<tr><td colspan="3" class="r">IGST @ ${rate}%</td><td class="r">${n2(gst)}</td></tr>`
      : `<tr><td colspan="3" class="r">CGST @ ${rate / 2}%</td><td class="r">${n2(gst / 2)}</td></tr><tr><td colspan="3" class="r">SGST @ ${rate / 2}%</td><td class="r">${n2(gst - gst / 2)}</td></tr>`) : '';
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to download the invoice', true);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(i.inv_no)}</title><style>
      body{font-family:Arial,sans-serif;margin:32px;font-size:13px;color:#111}.top{display:flex;justify-content:space-between;border-bottom:2px solid #2667d1;padding-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:7px 9px;text-align:left}th{background:#eef3fb}.r{text-align:right}
      .pre{white-space:pre-line}.muted{color:#555}@media print{.noprint{display:none}}</style></head><body>
      <div class="noprint" style="text-align:right"><button onclick="print()">Print / Save as PDF</button></div>
      <div class="top"><div><h2 style="margin:0">${esc(f.name || '')}</h2><div class="muted pre">${esc(f.address || '')}</div><div class="muted">${f.gstin ? 'GSTIN: ' + esc(f.gstin) : ''}</div></div>
        <div style="text-align:right"><b style="color:#2667d1;font-size:17px">${rate ? 'TAX INVOICE' : 'INVOICE'}</b><br>No: <b>${esc(i.inv_no)}</b><br>Date: ${fmt(i.inv_date)}</div></div>
      <p><b>Bill to</b><br>${esc(c.name)}<span class="pre"><br>${esc(c.address || '')}</span>${c.gstin ? '<br>GSTIN: ' + esc(c.gstin) : ''}</p>
      <table><thead><tr><th>#</th><th>Description</th><th>SAC</th><th class="r">Amount (₹)</th></tr></thead><tbody>${rows}
        <tr><td colspan="3" class="r">Taxable value</td><td class="r">${n2(i.subtotal)}</td></tr>${tax}<tr><td colspan="3" class="r"><b>Total</b></td><td class="r"><b>${n2(i.total)}</b></td></tr>
        <tr><td colspan="3" class="r">Paid</td><td class="r">${n2(i.paid)}</td></tr><tr><td colspan="3" class="r"><b>Balance</b></td><td class="r"><b>${n2(num(i.total) - num(i.paid))}</b></td></tr></tbody></table>
      ${f.bank ? `<p><b>Bank details</b><br><span class="pre">${esc(f.bank)}</span></p>` : ''}<p class="muted">This is a computer generated invoice.</p></body></html>`);
    w.document.close();
  }

  load();
})();

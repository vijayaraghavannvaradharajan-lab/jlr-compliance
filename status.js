/* Public, read-only status page.  status.html?c=<client link>  or  status.html?b=<board link> */
(async () => {
  'use strict';
  const cfg = window.TRACKER_CONFIG || {};
  const $ = s => document.querySelector(s);
  const out = $('#out');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d} ${MONTHS[+m - 1]} ${y}`; };
  const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pad = n => String(n).padStart(2, '0');
  const now = new Date(); const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const LABEL = { 'Pending data': 'Waiting for your documents', 'In progress': 'In progress', 'Ready to file': 'Ready to file', 'Filed': 'Filed', 'Not applicable': 'Not applicable' };
  const badge = s => `<span class="st st-${slug(s)}">${esc(LABEL[s] || s)}</span>`;
  const fail = msg => { $('#sub').textContent = ''; out.innerHTML = `<div class="card"><div class="empty">${esc(msg)}</div></div>`; };

  const p = new URLSearchParams(location.search);
  const c = p.get('c'), b = p.get('b');
  if (!c && !b) return fail('This link is incomplete. Please ask your consultant for the correct link.');
  if (!window.supabase || /PASTE/.test(cfg.SUPABASE_URL || 'PASTE')) return fail('The tracker is not configured yet.');
  if (!/^[0-9a-f-]{36}$/i.test(c || b)) return fail('This link is not valid. Please ask your consultant for a new link.');

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = c
    ? await sb.rpc('get_client_status', { p_token: c })
    : await sb.rpc('get_board_status', { p_token: b });
  if (error) return fail('Could not load the status right now. Please try again later.');
  if (!data) return fail(b ? 'This status board is switched off or the link has changed.' : 'This link is no longer valid. Please ask your consultant for a new link.');

  const tasks = data.tasks || [];
  document.title = (data.firm || 'Work') + ' · Status';
  const MAIN = ['GST', 'TDS', 'ROC/MCA'];
  const inTab = (t, k) => k === 'All' || (k === 'Other' ? !MAIN.includes(t.work_type) : t.work_type === k);
  const LBL = { 'ROC/MCA': 'MCA' };
  const types = ['All', 'GST', 'TDS', 'ROC/MCA', 'Other'].filter(k => k === 'All' || tasks.some(t => inTab(t, k)));
  let tab = 'All', q = '';

  if (c) {
    $('#title').textContent = data.client.name;
    $('#sub').textContent = `${data.client.gstin ? 'GSTIN ' + data.client.gstin + ' · ' : ''}Status from ${data.firm} · updated live`;
  } else {
    $('#title').textContent = `${data.firm} — Work status board`;
    $('#sub').textContent = 'Work due in the last 45 and next 45 days · updated live';
  }

  const render = () => {
    const s = q.toLowerCase();
    const list = tasks.filter(t => inTab(t, tab) && (!s || [t.client, t.return_name, t.period].join(' ').toLowerCase().includes(s)));
    const cnt = st => tasks.filter(t => t.status === st).length;
    out.innerHTML = `
      <div class="stats">
        <div class="stat green"><div class="n">${cnt('Filed')}</div><div class="l">Filed</div></div>
        <div class="stat blue"><div class="n">${cnt('In progress') + cnt('Ready to file')}</div><div class="l">In progress</div></div>
        <div class="stat amber"><div class="n">${cnt('Pending data')}</div><div class="l">${c ? 'Waiting for your documents' : 'Waiting for client data'}</div></div>
      </div>
      <div class="toolbar"><div class="tabs">${types.map(t => `<button data-tab="${esc(t)}" class="${t === tab ? 'on' : ''}">${esc(LBL[t] || t)} <span class="tab-n">${tasks.filter(x => inTab(x, t)).length}</span></button>`).join('')}</div>
        ${b ? `<span class="spacer"></span><input type="search" id="q" placeholder="Search client / return" value="${esc(q)}">` : ''}</div>
      <div class="table-wrap">${list.length ? `<table><thead><tr>${b ? '<th>Client</th>' : ''}<th>Return</th><th>Period</th><th>Due date</th><th>Status</th>${c ? '<th>Filed on / ARN</th>' : ''}</tr></thead><tbody>
        ${list.map(t => {
          const late = t.due_date && t.due_date < today && t.status !== 'Filed';
          return `<tr>${b ? `<td class="wrap"><b>${esc(t.client)}</b></td>` : ''}<td>${esc(t.return_name)} <span class="muted small">${esc(LBL[t.work_type] || t.work_type)}</span></td><td>${esc(t.period)}</td>
            <td class="${late ? 'late' : ''}">${fmt(t.due_date)}</td><td>${badge(t.status)}${t.data_received_on && t.status !== 'Filed' ? `<div class="muted small" style="margin-top:4px">Your data received ${fmt(t.data_received_on)}</div>` : ''}${c && t.status !== 'Filed' && (t.docs || []).length ? `<div class="docs-pub">${t.docs.map(d => `<span class="${d.received ? 'ok' : 'need'}">${d.received ? '✓' : '○'} ${esc(d.name)}</span>`).join('')}</div>` : ''}</td>
            ${c ? `<td class="small">${t.filed_on ? fmt(t.filed_on) : ''}${t.arn ? `<div class="muted">${esc(t.arn)}</div>` : ''}</td>` : ''}</tr>`;
        }).join('')}</tbody></table>` : '<div class="empty">No work to show.</div>'}</div>
      ${c && cnt('Pending data') ? '<p class="note warn small" style="margin-top:12px">Items marked “Waiting for your documents” need data from you. ○ = still needed, ✓ = received. Please share the pending documents with your consultant to file on time.</p>' : ''}`;
    out.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { tab = btn.dataset.tab; render(); });
    const qi = $('#q');
    if (qi) qi.oninput = e => { q = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  };
  render();
})();

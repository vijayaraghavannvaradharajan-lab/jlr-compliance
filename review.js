/* v35: the senior opens this from the verification email (no login). The link carries a one-time token. */
(() => {
  const cfg = window.TRACKER_CONFIG || {}, sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const q = new URLSearchParams(location.search), token = q.get('t') || '', want = q.get('a') || '';
  const out = document.getElementById('out'), sub = document.getElementById('sub'), title = document.getElementById('title');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = v => v == null || v === '' ? '' : '₹' + (+v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = p => { const [y, m] = String(p).split('-'); return `${MON[+m - 1]} ${y}`; };
  const table = (head, rows, money = true) => `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${i ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(r => `<tr>${r.map((v, i) => `<td class="${i && typeof v === 'number' ? 'r' : ''}">${i && typeof v === 'number' && money ? inr(v) : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  // the token stays out of the address bar after loading
  if (token) history.replaceState(null, '', location.pathname);
  async function load() {
    if (!token) { out.innerHTML = '<div class="card"><p>This link is not complete. Open it again from the email.</p></div>'; sub.textContent = ''; return; }
    const { data, error } = await sb.rpc('review_peek', { p_token: token });
    if (error || !data || data.error) { out.innerHTML = `<div class="card"><p>${esc((data && data.error) || (error && error.message) || 'Could not open this link.')}</p></div>`; sub.textContent = ''; return; }
    const S = data.summary || {}, H5 = ['', 'Taxable', 'IGST', 'CGST', 'SGST', 'Cess'];
    title.textContent = `${data.client} — GST ${mon(data.period)}`;
    sub.textContent = `GSTIN ${data.gstin} · prepared by ${data.sent_by || S.prepared_by || ''} · sent ${new Date(data.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
    if (data.state !== 'sent') { out.innerHTML = `<div class="card"><p>This has already been ${data.state === 'approved' ? 'approved' : data.state === 'changes' ? 'sent back for changes' : 'handled'}.</p></div>`; return; }
    const box = (l, v, cls = '') => `<div class="rc-b ${cls}"><small>${l}</small><b>${inr(v)}</b></div>`;
    out.innerHTML = `
      <div class="card rev-act" id="act">
        <h3 style="margin-top:0">Your decision</h3>
        <div class="toolbar"><button class="btn primary" id="ok" style="min-height:48px">✓ Approve — ready to file</button><button class="btn" id="chg" style="min-height:48px">Needs changes</button></div>
        <div id="chgBox" ${want === 'changes' ? '' : 'hidden'} style="margin-top:12px"><label class="full">What should the team change?<textarea id="rm" rows="4" style="width:100%" placeholder="e.g. Recheck KP-1102 — supplier credit note expected; don't claim hotel bill"></textarea></label>
          <div class="toolbar" style="margin-top:8px"><button class="btn primary" id="send">Send remarks to the team</button></div></div>
        <p class="muted small" id="msg"></p>
      </div>
      <div class="rc-sum rc4">${box('Tax on sales', S.tax_sales)}${box('Net ITC', S.net_itc)}${box('Credit carried forward', S.credit_cf)}${box('Cash to deposit', S.cash, S.cash ? 'bad' : 'ok')}</div>
      <div class="card"><h3>GSTR-1 — draft as per portal <span class="muted small">(${esc(S.g1_from || '')})</span></h3>${table(H5, [...(S.g1 || []), ...(S.g1_total ? [S.g1_total] : []), ...(S.g1_filed ? [S.g1_filed] : [])])}</div>
      <div class="card"><h3>GSTR-3B — 3.1 Outward supplies</h3>${table(H5, S.b31 || [])}
        <h3>4 Eligible ITC</h3>${table(['', 'IGST', 'CGST', 'SGST', 'Cess'], (S.b4 || []).map(r => [r[0], ...r.slice(2)]))}
        <h3>6.1 Payment of tax</h3>${table(['Tax', 'Payable', 'Paid by ITC', 'Reverse charge (cash)', 'From cash ledger', 'Cash to deposit'], S.b61 || [])}</div>
      ${S.itc ? `<div class="card"><h3>ITC — GSTR-2B vs books</h3>${table(['', 'Amount'], [['ITC in GSTR-2B', S.itc.in2b], ['ITC in books', S.itc.books], ['ITC claimed', S.itc.claim], ['Held back', S.itc.held]])}
        <p class="small muted">${S.itc.matched} matched · ${S.itc.decide} to decide · ${S.itc.missing} in books not in 2B · ${S.itc.notbooks} in 2B not in books</p>
        ${(S.decide || []).length ? '<h4>Bills with a difference</h4>' + table(['Supplier', 'GSTIN', 'Bill', 'Tax (books)', 'Tax (2B)', 'Decision'], S.decide) : ''}
        ${(S.missing || []).length ? '<h4>In books, not in GSTR-2B</h4>' + table(['Supplier', 'GSTIN', 'Bill', 'Tax (books)', 'Tax (2B)'], S.missing) : ''}</div>` : ''}
      ${S.notes ? `<div class="card"><h3>Review notes</h3><p style="white-space:pre-wrap">${esc(S.notes)}</p></div>` : ''}
      ${(data.remarks || []).length ? `<div class="card"><h3>Earlier remarks</h3><ul>${data.remarks.map(r => `<li>${esc(r.text)} <span class="muted small">— ${esc(r.by)}</span></li>`).join('')}</ul></div>` : ''}`;
    const msg = t => { document.getElementById('msg').textContent = t; };
    const decide = async (d, rm) => {
      document.querySelectorAll('#act button').forEach(b => b.disabled = true); msg('Saving…');
      const { data: res, error: e } = await sb.rpc('review_decide', { p_token: token, p_decision: d, p_remarks: rm || null });
      if (e) { msg(e.message || 'Could not save — try again'); document.querySelectorAll('#act button').forEach(b => b.disabled = false); return; }
      document.getElementById('act').innerHTML = res === 'approved' ? '<h3 style="margin-top:0" class="ok-t">✓ Approved. The team has been told to file.</h3>' : res === 'changes' ? '<h3 style="margin-top:0">Remarks sent to the team. Thank you.</h3>' : `<p>${esc(res)}</p>`;
    };
    document.getElementById('ok').onclick = () => decide('approve');
    document.getElementById('chg').onclick = () => { document.getElementById('chgBox').hidden = false; document.getElementById('rm').focus(); };
    document.getElementById('send').onclick = () => { const v = document.getElementById('rm').value.trim(); if (!v) { msg('Please type what needs to change.'); return; } decide('changes', v); };
    if (want === 'approve') document.getElementById('ok').focus();
  }
  load();
})();

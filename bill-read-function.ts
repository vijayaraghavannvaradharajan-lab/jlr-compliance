// Supabase Edge Function "bill-read" (JLR tracker v20)
// Reads one purchase bill (PDF or photo) with Claude and returns the fields for the purchase register.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via editor → name "bill-read" → paste this file → Deploy.
// Then: Edge Functions → bill-read → Settings → switch OFF "Verify JWT with legacy secret" → Save (the function checks the login itself).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TOOL = {
  name: 'record_bill',
  description: 'Record the fields of one Indian GST purchase bill (tax invoice, bill of supply, credit or debit note).',
  input_schema: {
    type: 'object',
    properties: {
      document_type: { type: 'string', enum: ['invoice', 'credit_note', 'debit_note', 'bill_of_supply', 'not_a_bill'] },
      supplier_gstin: { type: 'string', description: '15-character GSTIN of the SELLER / supplier (not the buyer). Empty if none.' },
      supplier_name: { type: 'string' },
      buyer_gstin: { type: 'string', description: 'GSTIN of the buyer / recipient, empty if none' },
      invoice_no: { type: 'string' },
      invoice_date: { type: 'string', description: 'YYYY-MM-DD' },
      taxable_value: { type: 'number', description: 'Total taxable value of the whole bill (before GST), in rupees' },
      igst: { type: 'number' }, cgst: { type: 'number' }, sgst: { type: 'number', description: 'SGST or UTGST' }, cess: { type: 'number' },
      total: { type: 'number', description: 'Grand total / invoice value including tax and round-off' },
      reverse_charge: { type: 'boolean' },
      note: { type: 'string', description: 'Short note if anything is unclear or unreadable; otherwise empty' }
    },
    required: ['document_type', 'supplier_gstin', 'invoice_no', 'invoice_date', 'taxable_value', 'igst', 'cgst', 'sgst', 'cess', 'total']
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') || '';
    const body = await req.json().catch(() => ({}));
    const { client_id, name, media_type, data } = body || {};
    if (!client_id || !data || !media_type) return json({ error: 'Missing file' }, 400);
    if (!/^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(media_type)) return json({ error: 'Only PDF or photo bills can be read' }, 400);
    if (data.length > 13_000_000) return json({ error: 'File too big (max about 9 MB)' }, 400);

    const user = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: can, error: cErr } = await user.rpc('ai_can_read', { p_client: client_id });
    if (cErr) return json({ error: 'Please sign in again' }, 401);
    if (!can || !can.ok) return json({ error: (can && can.why) || 'Not allowed' }, 403);

    const admin = createClient(url, service);
    const { data: k } = await admin.rpc('ai_key');
    if (!k || !k.key) return json({ error: 'No AI key saved (Settings → Bill reading)' }, 400);

    const block = media_type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type, data } }
      : { type: 'image', source: { type: 'base64', media_type, data } };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': k.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: k.model || 'claude-haiku-5-5', max_tokens: 800,
        system: 'You read Indian GST purchase bills for a chartered accountant\'s office. Report figures exactly as printed for the WHOLE bill (sum all tax rates and all pages). Amounts are rupees as plain numbers. The supplier is the seller who issued the bill; the buyer is the recipient. If a field is not printed, use an empty string or 0. Never guess a GSTIN.',
        tools: [TOOL], tool_choice: { type: 'tool', name: 'record_bill' },
        messages: [{ role: 'user', content: [block, { type: 'text', text: `Record this bill (file: ${String(name || '').slice(0, 80)}).` }] }]
      })
    });
    const j = await r.json().catch(() => ({}));
    const usage = j.usage || {}, inT = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0), outT = usage.output_tokens || 0;
    const cost = ((inT * (+k.price_in || 0) + outT * (+k.price_out || 0)) / 1e6) * (+k.usd_inr || 88);
    const uid = can.user || null;
    if (!r.ok) {
      const msg = (j.error && j.error.message) || `Claude error ${r.status}`;
      await admin.from('ai_usage').insert({ user_id: uid, client_id, file_name: name, model: k.model, in_tokens: inT, out_tokens: outT, cost_inr: cost, ok: false, error: msg.slice(0, 300) });
      return json({ error: r.status === 401 ? 'The Claude API key was rejected — save a new key in Settings' : r.status === 429 ? 'Claude is busy or the credit is used up — try again later' : msg }, 502);
    }
    const tool = (j.content || []).find((c: { type: string }) => c.type === 'tool_use');
    const bill = tool ? tool.input : null;
    await admin.from('ai_usage').insert({ user_id: uid, client_id, file_name: name, model: k.model, in_tokens: inT, out_tokens: outT, cost_inr: cost, ok: !!bill, error: bill ? null : 'No result' });
    if (!bill) return json({ error: 'AI could not read this bill' }, 422);
    if (bill.document_type === 'not_a_bill') return json({ error: 'AI says this file is not a bill' + (bill.note ? ' — ' + bill.note : '') }, 422);
    return json({ bill, model: k.model, cost_inr: Math.round(cost * 10000) / 10000, tokens: { in: inT, out: outT } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

// pages/api/notify.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id obrigatório' });

    // --- Supabase (server-only) ---
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    // Carrega pedido
    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select('id,name,phone,drink_name,status')
      .eq('id', id)
      .single();

    if (loadErr || !order) {
      return res.status(404).json({ ok: false, error: 'Pedido não encontrado' });
    }

    // Atualiza de 'new' -> 'ready' (idempotente)
    const { data: updData, error: updErr } = await supabase
      .from('orders')
      .update({ status: 'ready' })
      .eq('id', id)
      .eq('status', 'new')
      .select('id');

    if (updErr) {
      return res.status(500).json({ ok: false, error: updErr.message });
    }

    const justBecameReady = Array.isArray(updData) && updData.length > 0;
    if (!justBecameReady && order.status === 'ready') {
      // Já estava pronto; não reenvia SMS
      return res.status(200).json({ ok: true, channel: 'none', already: true });
    }

    // --- Twilio SMS (usar sempre From número) ---
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      // Pedido ficou pronto, mas Twilio não configurado
      return res.status(200).json({ ok: true, channel: 'none', reason: 'twilio_from_not_configured' });
    }

    const normalizeBR = (p) => {
      let x = (p || '').replace(/\D/g, '');
      if (x.startsWith('55')) x = '+' + x;
      else if (x.startsWith('0')) x = '+55' + x.slice(1);
      else if (!x.startsWith('+')) x = '+55' + x;
      return x;
    };

    const to = normalizeBR(order.phone);
    const bodyText = `Oi ${order.name}! Seu ${order.drink_name} está pronto. Retire no bar. 🍸`;

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: bodyText });

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const r = await fetch(twilioUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const text = await r.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch {}

    if (!r.ok || (payload && payload.error_code)) {
      return res.status(200).json({
        ok: false,
        channel: 'from',
        error: payload?.message || text,
        error_code: payload?.error_code || null
      });
    }

    return res.status(200).json({
      ok: true,
      channel: 'from',
      sid: payload?.sid || null
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

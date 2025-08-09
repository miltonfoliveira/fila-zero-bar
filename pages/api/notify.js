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

    // Carrega pedido atual
    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select('id,name,phone,drink_name,status,ready_at')
      .eq('id', id)
      .single();

    if (loadErr || !order) {
      return res.status(404).json({ ok: false, error: 'Pedido não encontrado' });
    }

    // 1) Tenta 'new' -> 'ready' + ready_at agora
    let { data: updData, error: updErr } = await supabase
      .from('orders')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'new')
      .select('id, status, ready_at');

    if (updErr) {
      return res.status(500).json({ ok: false, error: updErr.message });
    }

    let justBecameReady = Array.isArray(updData) && updData.length > 0;

    // 2) Já estava ready, mas sem ready_at -> preenche agora (idempotente)
    if (!justBecameReady && order.status === 'ready' && !order.ready_at) {
      const { data: fixData, error: fixErr } = await supabase
        .from('orders')
        .update({ ready_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'ready')
        .is('ready_at', null)
        .select('id, status, ready_at');
      if (fixErr) {
        return res.status(500).json({ ok: false, error: fixErr.message });
      }
      if (Array.isArray(fixData) && fixData.length > 0) {
        justBecameReady = true;
      }
    }

    // --- Gate para desativar SMS em desenvolvimento/teste ---
    if (process.env.ENABLE_SMS !== 'true') {
      return res.status(200).json({
        ok: true,
        channel: 'sms_disabled',
        reason: 'SMS desativado por configuração'
      });
    }

    // --- Twilio SMS (sempre com From número) ---
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

// pages/api/remind.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id obrigatório' });

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    // Carrega pedido; só permite reenvio se estiver 'ready'
    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select('id,name,phone,drink_name,status,ready_at')
      .eq('id', id)
      .single();

    if (loadErr || !order) {
      return res.status(404).json({ ok: false, error: 'Pedido não encontrado' });
    }
    if (order.status !== 'ready') {
      return res.status(400).json({ ok: false, error: 'Pedido ainda não está pronto' });
    }

    // --- Twilio SMS (usar número From) ---
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      return res.status(200).json({ ok: false, error: 'Twilio não configurado' });
    }

    const normalizeBR = (p) => {
      let x = (p || '').replace(/\D/g, '');
      if (x.startsWith('55')) x = '+' + x;
      else if (x.startsWith('0')) x = '+55' + x.slice(1);
      else if (!x.startsWith('+')) x = '+55' + x;
      return x;
    };

    const to = normalizeBR(order.phone);
    const bodyText = `Lembrete: Oi ${order.name}! Seu ${order.drink_name} está pronto no bar. 🍸`;

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
        error: payload?.message || text,
        error_code: payload?.error_code || null
      });
    }

    return res.status(200).json({ ok: true, sid: payload?.sid || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

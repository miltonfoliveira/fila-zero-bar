// pages/api/notify.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ ok: false, error: 'id obrigatório' })

  // --- Supabase (server) ---
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  )

  // Carrega pedido
  const { data: order, error: loadErr } = await supabase
    .from('orders')
    .select('id,name,phone,drink_name,status')
    .eq('id', id)
    .single()

  if (loadErr || !order) {
    return res.status(404).json({ ok: false, error: 'Pedido não encontrado' })
  }

  // Tenta mudar de 'new' -> 'ready' (idempotente)
  const { data: updData, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'ready' })
    .eq('id', id)
    .eq('status', 'new')
    .select('id')

  if (updErr) {
    return res.status(500).json({ ok: false, error: updErr.message })
  }

  const justBecameReady = Array.isArray(updData) && updData.length > 0

  // Se já estava 'ready', não reenvia SMS (idempotente)
  if (!justBecameReady && order.status === 'ready') {
    return res.status(200).json({ ok: true, channel: 'none', already: true })
  }

  // --- Twilio SMS ---
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  if (!sid || !token || (!from && !messagingServiceSid)) {
    // Sem credenciais? Considera ok (pedido já ficou pronto), mas sem envio de SMS
    return res.status(200).json({ ok: true, channel: 'none', reason: 'twilio_not_configured' })
  }

  const normalizeBR = (p) => {
    // tenta normalizar para E.164
    let x = (p || '').replace(/\D/g, '')
    if (x.startsWith('55')) x = '+' + x
    else if (x.startsWith('0')) x = '+55' + x.slice(1)
    else if (!x.startsWith('+')) x = '+55' + x
    return x
  }

  const to = normalizeBR(order.phone)
  const body = `Oi ${order.name}! Seu ${order.drink_name} está pronto. Retire no bar. 🍸`

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const params = new URLSearchParams({ To: to, Body: body })
  if (messagingServiceSid) params.append('MessagingServiceSid', messagingServiceSid)
  else params.append('From', from)

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  if (!r.ok) {
    const txt = await r.text()
    // Mesmo com falha de SMS, o pedido já ficou ready — retornamos ok=false pra você ver no painel
    return res.status(200).json({ ok: false, channel: messagingServiceSid ? 'service' : 'from', error: txt })
  }

  return res.status(200).json({ ok: true, channel: messagingServiceSid ? 'service' : 'from' })
}

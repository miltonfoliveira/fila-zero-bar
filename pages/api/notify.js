  // --- Twilio SMS (força envio com From) ---
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER  // <— usamos só o número
  if (!sid || !token || !from) {
    return res.status(200).json({ ok: true, channel: 'none', reason: 'twilio_from_not_configured' })
  }

  const normalizeBR = (p) => {
    let x = (p || '').replace(/\D/g, '')
    if (x.startsWith('55')) x = '+' + x
    else if (x.startsWith('0')) x = '+55' + x.slice(1)
    else if (!x.startsWith('+')) x = '+55' + x
    return x
  }

  const to = normalizeBR(order.phone)
  const bodyText = `Oi ${order.name}! Seu ${order.drink_name} está pronto. Retire no bar. 🍸`

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: bodyText
  })

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const r = await fetch(twilioUrl, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  const text = await r.text()
  let payload = null
  try { payload = JSON.parse(text) } catch {}

  if (!r.ok || (payload && payload.error_code)) {
    return res.status(200).json({
      ok: false,
      channel: 'from',
      error: payload?.message || text,
      error_code: payload?.error_code || null
    })
  }

  return res.status(200).json({
    ok: true,
    channel: 'from',
    sid: payload?.sid || null
  })

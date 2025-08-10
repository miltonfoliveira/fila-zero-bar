// pages/bar.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// som de novo pedido
const useDing = () => {
  const audioRef = useRef(null)
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    audioRef.current = new Audio('/ding.mp3')
  }, [])
  const play = () => {
    if (!enabled || !audioRef.current) return
    try { audioRef.current.currentTime = 0; audioRef.current.play() } catch {}
  }
  return { play, enabled, setEnabled }
}

export default function Bar() {
  const router = useRouter()
  const { play, enabled, setEnabled } = useDing()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const lastSeenIdRef = useRef(null)

  // carrega pedidos + assina realtime
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, name, phone, photo_url, drink_id, drink_name, status, created_at, ready_at, reminded_at')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) setErrorMsg(error.message)
      setOrders(data || [])
      setLoading(false)

      // marca último id para controle de som
      if ((data || []).length) {
        lastSeenIdRef.current = (data || [])[(data || []).length - 1].id
      }
    }

    load()
    const poll = setInterval(load, 20000)

    const channel = supabase
      .channel('bar-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new
        setOrders(prev => {
          const next = [...prev, o].sort((a,b)=> new Date(a.created_at) - new Date(b.created_at))
          // tocar som só se for novo depois do último visto
          if (lastSeenIdRef.current && o.id > lastSeenIdRef.current) play()
          lastSeenIdRef.current = o.id
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new
        setOrders(prev => prev.map(x => x.id === o.id ? o : x))
      })
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [])

  const pending = useMemo(() => {
    const list = orders.filter(o => o.status === 'new')
    // prioridade = ordem de chegada (1 = mais antigo)
    return list.map((o, idx) => ({ ...o, priority: idx + 1 }))
  }, [orders])

  const readyRecent = useMemo(() => {
    const now = Date.now()
    return orders
      .filter(o => o.status === 'ready')
      .filter(o => {
        const t = new Date(o.ready_at || o.created_at).getTime()
        return now - t <= 15 * 60 * 1000 // últimos 15 minutos
      })
      .sort((a,b) => new Date(b.ready_at || b.created_at) - new Date(a.ready_at || a.created_at))
  }, [orders])

  const markReady = async (id) => {
    // seta status=ready + ready_at=now (apenas se estiver new)
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'ready', ready_at: nowIso })
      .eq('id', id)
      .eq('status', 'new')
      .select('id, name, phone, drink_name, ready_at')
      .maybeSingle()

    if (error) { alert(error.message); return }
    if (!data) return // já estava pronto

    // chama API de notificação (respeita ENABLE_SMS)
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: data.phone,
          name: data.name,
          drink: data.drink_name,
          orderId: data.id,
          channel: 'sms'
        })
      })
    } catch {}
  }

  const canRemind = (o) => {
    if (o.status !== 'ready') return false
    const readyMs = new Date(o.ready_at || o.created_at).getTime()
    const now = Date.now()
    if (now - readyMs < 10 * 60 * 1000) return false // só depois de 10 min
    if (o.reminded_at) {
      // evita spam: só 1 lembrete
      return false
    }
    return true
  }

  const sendReminder = async (o) => {
    try {
      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: o.phone,
          name: o.name,
          drink: o.drink_name,
          orderId: o.id,
          channel: 'sms',
          reminder: true
        })
      })
      // se OK, grava reminded_at
      if (r.ok) {
        const nowIso = new Date().toISOString()
        await supabase.from('orders').update({ reminded_at: nowIso }).eq('id', o.id)
      } else {
        const text = await r.text()
        alert('Falha ao enviar lembrete: ' + text)
      }
    } catch (e) {
      alert('Erro ao enviar lembrete: ' + (e?.message || ''))
    }
  }

  return (
    <main style={{ padding:16, maxWidth:1200, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Header do bar: título + botões à direita (Esgotado / Som) */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'1fr auto',
        alignItems:'center',
        gap:12,
        marginBottom:10
      }}>
        <h1 style={{ margin:0, fontSize:20 }}>Painel do Bar</h1>

        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => router.push('/bar/estoque')}
            style={{ padding:'10px 14px', border:'1px solid #e5e7eb', background:'#fff', borderRadius:10, fontSize:16 }}
            title="Marcar drinks como esgotados"
          >
            Esgotado
          </button>
          <button
            onClick={() => setEnabled(v => !v)}
            style={{ padding:'10px 14px', border:'1px solid #e5e7eb', background:'#fff', borderRadius:10, fontSize:16 }}
            title="Som de novo pedido"
          >
            {enabled ? '🔔 Som' : '🔕 Som'}
          </button>
        </div>
      </div>

      {/* Colunas: aguardando (esq) | prontos (dir) */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'1fr 1fr',
        gap:16
      }}>
        {/* Coluna aguardando */}
        <section>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
            <h2 style={{ margin:0, fontSize:18 }}>🧑‍🍳 A preparar</h2>
            <small style={{ opacity:.7 }}>{pending.length} na fila</small>
          </div>

          {pending.length === 0 ? (
            <div style={{ fontSize:14, opacity:.7 }}>Sem pedidos aguardando…</div>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {pending.map((o) => (
                <li key={o.id} style={{
                  background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:12,
                  display:'grid', gridTemplateColumns:'120px 1fr', gap:12, alignItems:'center',
                  boxShadow:'0 4px 12px rgba(0,0,0,.04)'
                }}>
                  <img
                    src={o.photo_url || '/avatar-placeholder.png'}
                    alt={o.name}
                    style={{ width:120, height:120, objectFit:'cover', borderRadius:12, border:'1px solid #e5e7eb' }}
                  />
                  <div style={{ display:'grid', gap:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                      <div style={{ fontWeight:800, fontSize:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {o.drink_name}
                      </div>
                      <div style={{ fontSize:12, padding:'4px 8px', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:999 }}>
                        prioridade {o.priority}
                      </div>
                    </div>
                    <div style={{ color:'#374151' }}>
                      <div style={{ fontSize:15, fontWeight:600 }}>{o.name}</div>
                      <div style={{ fontSize:12, opacity:.7 }}>
                        pedido às {new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => markReady(o.id)}
                        style={{ padding:'10px 14px', border:'1px solid #10b981', background:'#ecfdf5', color:'#065f46', borderRadius:10, fontSize:16, fontWeight:700 }}
                      >
                        ✅ Drink pronto
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Coluna prontos (últimos 15min) */}
        <section>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
            <h2 style={{ margin:0, fontSize:18 }}>✅ Prontos (últimos 15 min)</h2>
            <small style={{ opacity:.7 }}>{readyRecent.length}</small>
          </div>

          {readyRecent.length === 0 ? (
            <div style={{ fontSize:14, opacity:.7 }}>Nenhum drink pronto nos últimos 15 minutos…</div>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {readyRecent.map((o) => (
                <li key={o.id} style={{
                  background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:12,
                  display:'grid', gridTemplateColumns:'120px 1fr', gap:12, alignItems:'center',
                  boxShadow:'0 4px 12px rgba(0,0,0,.04)'
                }}>
                  <img
                    src={o.photo_url || '/avatar-placeholder.png'}
                    alt={o.name}
                    style={{ width:120, height:120, objectFit:'cover', borderRadius:12, border:'1px solid #e5e7eb' }}
                  />
                  <div style={{ display:'grid', gap:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                      <div style={{ fontWeight:800, fontSize:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {o.drink_name}
                      </div>
                      <div style={{ fontSize:12, padding:'4px 8px', background:'#dcfce7', border:'1px solid #86efac', borderRadius:999 }}>
                        pronto
                      </div>
                    </div>
                    <div style={{ color:'#374151' }}>
                      <div style={{ fontSize:15, fontWeight:600 }}>{o.name}</div>
                      <div style={{ fontSize:12, opacity:.7 }}>
                        pronto às {new Date(o.ready_at || o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => sendReminder(o)}
                        disabled={!canRemind(o)}
                        title={!canRemind(o) ? 'Lembrete liberado 10 min após ficar pronto (e apenas 1 vez)' : 'Enviar lembrete por SMS'}
                        style={{
                          padding:'10px 14px',
                          border:'1px solid #3b82f6',
                          background: canRemind(o) ? '#eff6ff' : '#f3f4f6',
                          color:'#1d4ed8',
                          borderRadius:10,
                          fontSize:16,
                          opacity: canRemind(o) ? 1 : 0.5,
                          cursor: canRemind(o) ? 'pointer' : 'not-allowed'
                        }}
                      >
                        🔁 Reenviar SMS
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

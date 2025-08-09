import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const FIFTEEN_MIN = 15 * 60 * 1000
const TEN_MIN = 10 * 60 * 1000

function since(ts, now = Date.now()) {
  const ms = Math.max(0, now - new Date(ts).getTime())
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`
}

export default function BaristaPanel() {
  const [pending, setPending] = useState([]) // status=new asc
  const [ready, setReady] = useState([])     // status=ready (last 15m) desc
  const [errorMsg, setErrorMsg] = useState('')
  const [now, setNow] = useState(Date.now())

  const soundEnabledRef = useRef(false)
  const prevPendingCountRef = useRef(0)
  const [remindingIds, setRemindingIds] = useState({}) // { [id]: true }
  const audioRef = useRef(null)

  // Relógio p/ “tempo na fila” e re-render
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  // Áudio + preferência
  useEffect(() => {
    audioRef.current = new Audio('/alert.mp3')
    try {
      const saved = localStorage.getItem('fzb_sound')
      if (saved === 'on') soundEnabledRef.current = true
    } catch {}
  }, [])

  const playSound = () => {
    if (!soundEnabledRef.current || !audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }

  const pruneReady = (list) => {
    const cutoff = Date.now() - FIFTEEN_MIN
    return (list || []).filter(o =>
      o.ready_at && new Date(o.ready_at).getTime() >= cutoff
    )
  }

  const fetchQueues = async () => {
    const cutoffISO = new Date(Date.now() - FIFTEEN_MIN).toISOString()

    // Pendentes (new) — já traz foto_url
    const p = await supabase
      .from('orders')
      .select('id,name,drink_name,status,created_at,photo_url')
      .eq('status', 'new')
      .order('created_at', { ascending: true })

    // Prontos (ready) últimos 15 min por ready_at — já traz foto_url
    const r = await supabase
      .from('orders')
      .select('id,name,drink_name,status,created_at,ready_at,photo_url')
      .eq('status', 'ready')
      .not('ready_at', 'is', null)
      .gte('ready_at', cutoffISO)
      .order('ready_at', { ascending: false })

    if (p.error) { setErrorMsg(p.error.message); return }
    if (r.error) { setErrorMsg(r.error.message); return }

    if (Array.isArray(p.data) && p.data.length > prevPendingCountRef.current) {
      playSound()
    }
    prevPendingCountRef.current = (p.data || []).length

    setPending(p.data || [])
    setReady(pruneReady(r.data || []))
  }

  // Inicial + polling + limpeza periódica
  useEffect(() => {
    fetchQueues()
    const poll = setInterval(fetchQueues, 20000)
    const clean = setInterval(() => setReady(prev => pruneReady(prev)), 15000)
    return () => { clearInterval(poll); clearInterval(clean) }
  }, [])

  // Realtime: INSERT (new) e UPDATE (ready)
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.status === 'new') {
          setPending(prev => {
            if (prev.some(p => p.id === row.id)) return prev
            const next = [...prev, row].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
            prevPendingCountRef.current = next.length
            return next
          })
          playSound()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.status === 'ready') {
          setPending(prev => prev.filter(o => o.id !== row.id))
          setReady(prev => {
            const next = pruneReady([row, ...prev])
            return next.sort(
              (a,b) => new Date(b.ready_at || b.created_at) - new Date(a.ready_at || a.created_at)
            )
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function markReady(id) {
    try {
      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const d = await r.json()
      if (!d.ok) setErrorMsg(d.error || 'Falha ao notificar por SMS')
      // realtime cuida do resto
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  async function remind(id) {
    try {
      setRemindingIds(prev => ({ ...prev, [id]: true }))
      const r = await fetch('/api/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const d = await r.json()
      if (!d.ok) setErrorMsg(d.error || 'Falha ao reenviar SMS')
    } catch (e) {
      setRemindingIds(prev => {
        const { [id]: _, ...rest } = prev
        return rest
      })
      setErrorMsg(String(e))
    }
  }

  const avatar = (url) => (
    <img
      src={url || '/avatar-placeholder.png'}
      alt="foto do convidado"
      style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:'1px solid #e5e7eb' }}
    />
  )

  return (
    <div style={{ fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background:'#fff', minHeight:'100vh', color:'#0f172a' }}>
      {/* Topbar clara */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'16px 20px', background:'#ffffff', borderBottom:'1px solid #e5e7eb'
      }}>
        <div>
          <div style={{ fontSize:26, fontWeight:700, color:'#111827' }}>Painel do Bar</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>
            Atualizado: {new Date(now).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
          </div>
        </div>
        <button
          onClick={() => { soundEnabledRef.current = true; localStorage.setItem('fzb_sound','on'); playSound() }}
          style={{
            padding:'10px 14px', fontSize:16, borderRadius:10,
            border:'1px solid #d1d5db', background:'#f9fafb', color:'#111827'
          }}
        >
          🔊 Ativar som
        </button>
      </div>

      {errorMsg && <div style={{ color:'#b91c1c', margin:'12px 20px' }}>{errorMsg}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, padding:20 }}>
        {/* Coluna esquerda: A preparar */}
        <section>
          <h2 style={{ fontSize:20, marginBottom:12, color:'#111827' }}>🧑‍🍳 A preparar</h2>
          {pending.length === 0 ? (
            <p style={{ color:'#6b7280' }}>Nenhum pedido aguardando…</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {pending.map((order, idx) => (
                <li key={order.id} style={{
                  padding:16, borderRadius:14, background:'#ffffff',
                  border:'1px solid #e5e7eb', boxShadow:'0 4px 12px rgba(0,0,0,.04)'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    {avatar(order.photo_url)}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:18, color:'#111827' }}>
                        <strong>{order.name}</strong> pediu:
                      </div>
                      <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>
                        ⏱️ Na fila há {since(order.created_at, now)}
                      </div>
                    </div>
                    <div style={{ fontSize:18, padding:'4px 10px', background:'#111827', color:'#fff', borderRadius:10, minWidth:64, textAlign:'center' }}>
                      #{idx + 1}
                    </div>
                  </div>

                  <div style={{ fontSize:24, fontWeight:700, color:'#111827', marginBottom:12 }}>
                    {order.drink_name}
                  </div>

                  <button
                    onClick={() => markReady(order.id)}
                    style={{
                      padding:14, fontSize:18, background:'#22c55e', color:'#0b0e0c',
                      border:'none', borderRadius:10, width:'100%', fontWeight:700
                    }}
                  >
                    ✅ Drink pronto
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Coluna direita: Prontos (últimos 15 min por ready_at) */}
        <section>
          <h2 style={{ fontSize:20, marginBottom:12, color:'#111827' }}>✅ Prontos (15 min)</h2>
          {ready.length === 0 ? (
            <p style={{ color:'#6b7280' }}>Nenhum drink pronto no momento…</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {ready.map((order) => {
                const readyMs = new Date(order.ready_at || order.created_at).getTime()
                const olderThan10 = Date.now() - readyMs >= TEN_MIN
                const disabled = !!remindingIds[order.id]
                return (
                  <li key={order.id} style={{
                    padding:16, borderRadius:14, background:'#ffffff',
                    border:'1px solid #e5e7eb', boxShadow:'0 4px 12px rgba(0,0,0,.04)'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      {avatar(order.photo_url)}
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:18, color:'#111827' }}>
                          <strong>{order.name}</strong>
                        </div>
                        <div style={{ fontSize:12, color:'#6b7280' }}>
                          pronto às {new Date(order.ready_at || order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginTop:8 }}>
                      {order.drink_name}
                    </div>

                    {olderThan10 && (
                      <button
                        onClick={() => remind(order.id)}
                        disabled={disabled}
                        style={{
                          marginTop:10, padding:12, fontSize:16,
                          background: disabled ? '#e5e7eb' : '#38bdf8',
                          color:'#0b0e0c', border:'none', borderRadius:10, width:'100%', fontWeight:700,
                          cursor: disabled ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {disabled ? 'Lembrete enviado' : '🔔 Reenviar SMS (lembrete)'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

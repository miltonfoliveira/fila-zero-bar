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

  const audioRef = useRef(null)
  const soundEnabledRef = useRef(false)
  const prevPendingCountRef = useRef(0)
  const [remindingIds, setRemindingIds] = useState({}) // { [id]: true } para desabilitar botão após clique

  // Atualiza relógio
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

    // Pendentes
    const p = await supabase
      .from('orders')
      .select('id,name,drink_name,status,created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: true })

    // Prontos últimos 15 min por ready_at
    const r = await supabase
      .from('orders')
      .select('id,name,drink_name,status,created_at,ready_at')
      .eq('status', 'ready')
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
            return next.sort((a,b) => new Date(b.ready_at || b.created_at) - new Date(a.ready_at || a.created_at))
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
      // Não mexe no estado; botão fica desabilitado para este item
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  return (
    <div style={{ fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background:'#0f0f12', minHeight:'100vh', color:'#f5f5f5' }}>
      <div style={{
        position:'sticky', top:0, zIndex:10,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'16px 20px', background:'#141419', borderBottom:'1px solid #222'
      }}>
        <div>
          <div style={{ fontSize:26, fontWeight:700 }}>Painel do Bar</div>
          <div style={{ fontSize:12, opacity:.7 }}>Atualizado: {new Date(now).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <button
          onClick={() => { soundEnabledRef.current = true; localStorage.setItem('fzb_sound','on'); playSound() }}
          style={{ padding:'10px 14px', fontSize:16, borderRadius:10, border:'1px solid #3a3a44', background:'#1c1c23', color:'#fff' }}
        >
          🔊 Ativar som
        </button>
      </div>

      {errorMsg && <div style={{ color:'#ff6b6b', margin: '12px 20px' }}>{errorMsg}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, padding:20 }}>
        {/* Coluna esquerda: A preparar */}
        <section>
          <h2 style={{ fontSize:20, marginBottom:12 }}>🧑‍🍳 A preparar</h2>
          {pending.length === 0 ? (
            <p style={{ opacity:.8 }}>Nenhum pedido aguardando…</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {pending.map((order, idx) => (
                <li key={order.id} style={{
                  padding:16, borderRadius:14, background:'linear-gradient(180deg, #1a1a22 0%, #121217 100%)',
                  border:'1px solid #2a2a34', boxShadow:'0 6px 20px rgba(0,0,0,.35)'
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <div style={{ fontSize:18 }}>
                      <strong>{order.name}</strong> pediu:
                    </div>
                    <div style={{ fontSize:18, padding:'4px 10px', background:'#4f46e5', color:'#fff', borderRadius:10, minWidth:64, textAlign:'center' }}>
                      #{idx + 1}
                    </div>
                  </div>
                  <div style={{ fontSize:24, margin:'8px 0 10px', fontWeight:700 }}>{order.drink_name}</div>
                  <div style={{ fontSize:13, padding:'4px 8px', borderRadius:8, background:'#22242c', color:'#9aa0b4', display:'inline-block', marginBottom:12 }}>
                    ⏱️ Na fila há {since(order.created_at, now)}
                  </div>
                  <button
                    onClick={() => markReady(order.id)}
                    style={{ padding:14, fontSize:18, background:'#22c55e', color:'#0b0e0c', border:'none', borderRadius:10, width:'100%', fontWeight:700 }}
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
          <h2 style={{ fontSize:20, marginBottom:12 }}>✅ Prontos (15 min)</h2>
          {ready.length === 0 ? (
            <p style={{ opacity:.8 }}>Nenhum drink pronto no momento…</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
              {ready.map((order) => {
                const readyMs = new Date(order.ready_at || order.created_at).getTime()
                const olderThan10 = Date.now() - readyMs >= TEN_MIN
                const disabled = !!remindingIds[order.id]
                return (
                  <li key={order.id} style={{
                    padding:16, borderRadius:14, background:'linear-gradient(180deg, #132216 0%, #0f1a12 100%)',
                    border:'1px solid #204125', boxShadow:'0 6px 20px rgba(0,0,0,.35)'
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div style={{ fontSize:18 }}>
                        <strong>{order.name}</strong>
                      </div>
                      <div style={{ fontSize:12, opacity:.8 }}>
                        pronto às {new Date(order.ready_at || order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <div style={{ fontSize:24, marginTop:6, fontWeight:700 }}>{order.drink_name}</div>

                    {/* Botão de lembrete após 10 min */}
                    {olderThan10 && (
                      <button
                        onClick={() => remind(order.id)}
                        disabled={disabled}
                        style={{
                          marginTop:10, padding:10, fontSize:16,
                          background: disabled ? '#334155' : '#38bdf8',
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

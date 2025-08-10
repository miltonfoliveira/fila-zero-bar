// pages/me.jsx
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import HeaderBar from '../components/HeaderBar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const normalizeBR = (p) => {
  let x = (p || '').replace(/\D/g, '')
  if (x.startsWith('55')) return '+' + x
  if (x.startsWith('0')) return '+55' + x.slice(1)
  if (!x.startsWith('+')) return '+55' + x
  return x
}

export default function Me() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!router.isReady) return
    let p = ''
    if (router.query.phone) p = String(router.query.phone)
    if (!p) { try { p = localStorage.getItem('fzb_phone') || '' } catch {} }
    if (!p) { router.replace('/cadastro'); return }
    setPhone(normalizeBR(p))
  }, [router.isReady]) // eslint-disable-line

  useEffect(() => {
    if (!phone) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id,drink_name,status,created_at,ready_at')
        .eq('phone', phone)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) setErrorMsg(error.message)
      setOrders(data || [])
      setLoading(false)
    }

    load()
    const poll = setInterval(load, 20000)

    const channel = supabase
      .channel('me-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.phone === phone) {
          setOrders(prev => [...prev, row].sort((a,b)=> new Date(a.created_at)-new Date(b.created_at)))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.phone === phone) {
          setOrders(prev => prev.map(o => o.id === row.id ? row : o))
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [phone])

  const pending = useMemo(() => orders.filter(o => o.status === 'new'), [orders])
  const ready = useMemo(() =>
    orders.filter(o => o.status === 'ready')
      .sort((a,b) => new Date(b.ready_at || b.created_at) - new Date(a.ready_at || a.created_at))
  , [orders])

  return (
    <main style={{ padding:'12px 20px 80px', maxWidth:700, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <HeaderBar title="Meus pedidos" />

      <p style={{ fontSize:13, opacity:.7, marginTop:0, marginBottom:12, textAlign:'center' }}>
        Você receberá um SMS quando seu drink ficar pronto.
      </p>

      {errorMsg && <div style={{ color:'#e11d48', marginBottom:12 }}>{errorMsg}</div>}
      {loading && <div style={{ opacity:.7, marginBottom:12 }}>Carregando…</div>}

      <section style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:16, margin:'8px 0' }}>🧑‍🍳 A preparar ({pending.length})</h2>
        {pending.length === 0 ? (
          <div style={{ fontSize:14, opacity:.7 }}>Nenhum pedido aguardando…</div>
        ) : (
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:10 }}>
            {pending.map((o) => (
              <li key={o.id} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:12, background:'#fff' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <div style={{ fontWeight:700 }}>{o.drink_name}</div>
                  <span style={{ fontSize:12, padding:'4px 8px', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:999 }}>
                    aguardando
                  </span>
                </div>
                <div style={{ fontSize:12, opacity:.7, marginTop:6 }}>
                  feito em {new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize:16, margin:'8px 0' }}>✅ Prontos ({ready.length})</h2>
        {ready.length === 0 ? (
          <div style={{ fontSize:14, opacity:.7 }}>Assim que estiver pronto, aparece aqui.</div>
        ) : (
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:10 }}>
            {ready.map((o) => (
              <li key={o.id} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:12, background:'#fff' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <div style={{ fontWeight:800 }}>{o.drink_name}</div>
                  <span style={{ fontSize:12, padding:'4px 8px', background:'#dcfce7', border:'1px solid #86efac', borderRadius:999 }}>
                    pronto
                  </span>
                </div>
                <div style={{ fontSize:12, opacity:.7, marginTop:6 }}>
                  pronto às {new Date(o.ready_at || o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

// pages/ranking.jsx
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderBar from '../components/HeaderBar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Ranking() {
  const [orders, setOrders] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, profile_id, name, photo_url, created_at')
        .order('created_at', { ascending: true })
      if (!active) return
      if (error) setErrorMsg(error.message)
      setOrders(data || [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('ranking-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        setOrders((prev) => [...prev, row])
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [])

  const ranking = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const key = o.profile_id || `name:${o.name || '???'}`
      const curr = map.get(key) || { id: key, name: o.name || 'Convidado', photo_url: o.photo_url || null, count: 0, last_at: o.created_at }
      curr.count += 1
      if (o.photo_url) curr.photo_url = o.photo_url
      curr.last_at = o.created_at
      map.set(key, curr)
    }
    return Array.from(map.values()).sort((a,b) => (b.count - a.count) || (new Date(b.last_at) - new Date(a.last_at)))
  }, [orders])

  return (
    <main style={{ padding:20, maxWidth:1000, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <HeaderBar title="Ranking de Drinks" />

      {errorMsg && <div style={{ color:'#e11d48', marginBottom:12 }}>{errorMsg}</div>}
      {loading && <div style={{ opacity:.7, marginBottom:12 }}>Carregando…</div>}

      <ul style={{
        listStyle:'none', padding:0, margin:0,
        display:'grid', gap:16,
        gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))'
      }}>
        {ranking.map((p, i) => (
          <li key={p.id} style={{
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:14,
            boxShadow:'0 4px 12px rgba(0,0,0,.04)', padding:16,
            display:'grid', gridTemplateColumns:'72px 1fr', gap:12, alignItems:'center'
          }}>
            <img
              src={p.photo_url || '/avatar-placeholder.png'}
              alt={p.name}
              style={{ width:72, height:72, objectFit:'cover', borderRadius:'50%', border:'1px solid #e5e7eb' }}
            />
            <div style={{ display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ fontWeight:800, fontSize:18, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize:12, color:'#6b7280' }}>#{i+1}</div>
              </div>
              <div style={{ marginTop:6, fontSize:16 }}>
                🍹 <strong>{p.count}</strong> {p.count === 1 ? 'drink' : 'drinks'}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {ranking.length === 0 && !loading && (
        <div style={{ opacity:.7, marginTop:12 }}>Ainda não há pedidos.</div>
      )}
    </main>
  )
}

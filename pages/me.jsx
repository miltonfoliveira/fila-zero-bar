import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const badge = (s) => {
  const map = { new: 'Novo', prep: 'Em preparo', ready: 'Pronto' }
  const color = s === 'ready' ? '#2e7d32' : s === 'prep' ? '#1565c0' : '#8d6e63'
  return <span style={{ padding:'4px 8px', borderRadius:8, background:'#eee', color }}>{map[s] || s}</span>
}

const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function MyOrders() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  // Pega phone da query ou do localStorage
  useEffect(() => {
    const q = (router.query.phone || '').toString()
    if (q) setPhone(q)
    else {
      try {
        const saved = localStorage.getItem('fzb_phone') || ''
        if (saved) setPhone(saved)
      } catch {}
    }
  }, [router.query.phone])

  // Carrega + realtime + polling leve
  useEffect(() => {
    if (!phone) return
    let active = true

    const load = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,drink_name,status,created_at')
        .eq('phone', phone)
        .order('created_at', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      if (!active) return
      setOrders(data || [])
    }

    load()
    const poll = setInterval(load, 30000) // fallback 30s

    // Realtime: INSERT/UPDATE para a tabela inteira (filtra no cliente)
    const channel = supabase
      .channel('orders-me')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const row = payload.new || payload.old
        if (!row || row.phone !== phone) return

        setOrders(prev => {
          let next = [...prev]
          const idx = next.findIndex(x => x.id === row.id)
          if (payload.eventType === 'INSERT') {
            if (idx === -1) next.push(payload.new)
          } else if (payload.eventType === 'UPDATE') {
            if (idx !== -1) next[idx] = payload.new
          }
          next.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
          return next
        })
      })
      .subscribe()

    return () => {
      active = false
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [phone])

  const grouped = useMemo(() => {
    // Apenas para exibir “em preparo”/“pronto” de forma clara
    const ready = orders.filter(o => o.status === 'ready')
    const pending = orders.filter(o => o.status !== 'ready')
    return { ready, pending }
  }, [orders])

  if (!phone) {
    return (
      <main style={{ padding:20, maxWidth:480, margin:'0 auto', fontFamily:'sans-serif' }}>
        <h1>Meus pedidos</h1>
        <p>Informe seu celular para ver seus pedidos.</p>
        <form onSubmit={(e)=>{e.preventDefault(); router.push(`/me?phone=${encodeURIComponent(phone)}`)}}>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55DDD9XXXXXXXX" style={{ width:'100%', padding:10, marginBottom:12 }} />
          <button style={{ padding:12, fontSize:16 }}>Ver meus pedidos</button>
        </form>
      </main>
    )
  }

  return (
    <main style={{ padding:20, maxWidth:600, margin:'0 auto', fontFamily:'sans-serif' }}>
      <h1>Meus pedidos</h1>

      {/* ✅ Botões de ação */}
      <div style={{ display:'flex', gap:10, margin:'8px 0 16px' }}>
        <button
          onClick={() => {
            try { localStorage.setItem('fzb_phone', phone) } catch {}
            window.location.href = '/'
          }}
          style={{ padding:10, fontSize:16, borderRadius:8, border:'1px solid #ccc', background:'#f7f7f7' }}
        >
          ➕ Pedir outro drink
        </button>
      </div>

      <div style={{ opacity:.8, marginBottom:12 }}>Celular: {phone}</div>
      {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

      <section style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:20, marginBottom:8 }}>Em andamento</h2>
        {grouped.pending.length === 0 ? (
          <div>Nenhum pedido em andamento.</div>
        ) : (
          <ul style={{ listStyle:'none', padding:0 }}>
            {grouped.pending.map(o=>(
              <li key={o.id} style={{ padding:12, marginBottom:10, background:'#f6f6f6', borderRadius:10 }}>
                <div style={{ fontSize:18, marginBottom:6 }}>{o.drink_name}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {badge(o.status)} <span style={{ opacity:.7 }}>• feito às {fmt(o.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize:20, marginBottom:8 }}>Prontos</h2>
        {grouped.ready.length === 0 ? (
          <div>Nenhum pedido pronto ainda.</div>
        ) : (
          <ul style={{ listStyle:'none', padding:0 }}>
            {grouped.ready.map(o=>(
              <li key={o.id} style={{ padding:12, marginBottom:10, background:'#eef8ee', borderRadius:10 }}>
                <div style={{ fontSize:18, marginBottom:6 }}>{o.drink_name}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {badge(o.status)} <span style={{ opacity:.7 }}>• pedido às {fmt(o.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

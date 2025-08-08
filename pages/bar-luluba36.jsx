import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function BaristaPanel() {
  const [orders, setOrders] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const audioRef = useRef(null)
  const soundEnabledRef = useRef(false)

  useEffect(() => {
    audioRef.current = new Audio('/alert.mp3')
  }, [])

  const playSound = () => {
    if (!soundEnabledRef.current || !audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }

  // Carregar fila inicial + polling de segurança
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,name,drink_name,status,created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      if (!active) return
      setOrders(data || [])
    }
    load()
    const id = setInterval(load, 60000) // fallback 60s
    return () => { active = false; clearInterval(id) }
  }, [])

  // Realtime: novos pedidos (INSERT)
  useEffect(() => {
    const channel = supabase
      .channel('orders-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.status === 'new') {
          setOrders(prev => {
            // Evita duplicar
            if (prev.some(p => p.id === row.id)) return prev
            const next = [...prev, row].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
            return next
          })
          playSound()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function markReady(id) {
    const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
    if (error) { setErrorMsg(error.message); return }
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 26 }}>Painel do Bar</h1>
        <button
          onClick={() => { soundEnabledRef.current = true; playSound() }}
          style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', background: '#f7f7f7' }}
        >
          🔊 Ativar som
        </button>
      </div>

      {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

      {orders.length === 0 ? (
        <p style={{ fontSize: 18, opacity:.8 }}>Nenhum pedido na fila…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {orders.map(order => (
            <li key={order.id} style={{ marginBottom: 18, padding: 18, background: '#eee', borderRadius: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>
                <strong>{order.name}</strong> pediu:
              </div>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{order.drink_name}</div>
              <button
                onClick={() => markReady(order.id)}
                style={{ padding: 16, fontSize: 20, background: '#28a745', color: 'white', border: 'none', borderRadius: 12 }}
              >
                ✅ Drink pronto
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

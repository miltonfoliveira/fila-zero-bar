import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function BaristaPanel() {
  const [orders, setOrders] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const audio = typeof window !== 'undefined' ? new Audio('/alert.mp3') : null

  // Polling simples a cada 3s (mais robusto do que Realtime sem configurar publications)
  useEffect(() => {
    let active = true
    const tick = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,name,drink_name,status,created_at')
        .eq('status', 'new') // <- status correto
        .order('created_at', { ascending: true })

      if (error) { setErrorMsg(error.message); return }
      if (!active) return

      // Se entrou pedido novo, toca som
      if (orders.length && data && data.length > orders.length) {
        try { audio && audio.play() } catch {}
      }
      setOrders(data || [])
    }

    tick()
    const id = setInterval(tick, 3000)
    return () => { active = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function markReady(id) {
    const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
    if (error) { setErrorMsg(error.message); return }
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 26, marginBottom: 12 }}>Painel do Bar</h1>
      {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

      {orders.length === 0 ? (
        <p>Nenhum pedido na fila…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {orders.map(order => (
            <li key={order.id} style={{ marginBottom: 18, padding: 18, background: '#eee', borderRadius: 10 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>
                <strong>{order.name}</strong> pediu:
              </div>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{order.drink_name}</div>
              <button
                onClick={() => markReady(order.id)}
                style={{ padding: 16, fontSize: 18, background: '#28a745', color: 'white', border: 'none', borderRadius: 10 }}
              >
                Drink pronto ✅
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://egjsxugmbtuualogwetx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...ky0'
)

export default function BaristaPanel() {
  const [orders, setOrders] = useState([])
  const audio = typeof window !== 'undefined' ? new Audio('/alert.mp3') : null

  useEffect(() => {
    fetchOrders()
    const subscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        setOrders(prev => [...prev, payload.new])
        audio?.play()
      })
      .subscribe()
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'pending').order('created_at')
    setOrders(data || [])
  }

  async function markReady(id) {
    await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
    setOrders(orders.filter(o => o.id !== id))
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24 }}>Painel do Bar</h1>
      {orders.length === 0 ? (
        <p>Nenhum pedido na fila...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {orders.map(order => (
            <li key={order.id} style={{ marginBottom: 20, padding: 20, background: '#eee', borderRadius: 8 }}>
              <p style={{ fontSize: 20 }}><strong>{order.name}</strong> pediu:</p>
              <p style={{ fontSize: 24 }}>{order.drink}</p>
              <button onClick={() => markReady(order.id)} style={{ padding: 16, fontSize: 18, background: '#28a745', color: 'white', border: 'none', borderRadius: 8 }}>
                Drink pronto ✅
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
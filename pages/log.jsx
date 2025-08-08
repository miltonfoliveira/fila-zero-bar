import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

export default function LogPage() {
  const [rows, setRows] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  // Carregar log inicial + polling leve (2 min) só por garantia
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,name,drink_name,created_at,status')
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      if (!active) return
      setRows(data || [])
    }
    load()
    const id = setInterval(load, 120000)
    return () => { active = false; clearInterval(id) }
  }, [])

  // Realtime: quando um pedido vira 'ready'
  useEffect(() => {
    const channel = supabase
      .channel('orders-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new
        if (row.status === 'ready') {
          setRows(prev => {
            if (prev.some(p => p.id === row.id)) return prev
            const next = [...prev, row].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
            return next
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Log de pedidos entregues</h1>
      {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}
      {rows.length === 0 ? (
        <p>Nenhum pedido entregue ainda.</p>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', borderBottom:'1px solid #ccc', padding:'8px 4px' }}>Hora</th>
              <th style={{ textAlign:'left', borderBottom:'1px solid #ccc', padding:'8px 4px' }}>Nome</th>
              <th style={{ textAlign:'left', borderBottom:'1px solid #ccc', padding:'8px 4px' }}>Drink</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding:'8px 4px' }}>{fmtTime(r.created_at)}</td>
                <td style={{ padding:'8px 4px' }}>{r.name}</td>
                <td style={{ padding:'8px 4px' }}>{r.drink_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://egjsxugmbtuualogwetx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...ky0'
)

export default function Home() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [drink, setDrink] = useState('')
  const [sent, setSent] = useState(false)

  const drinks = [
    'Caipirinha',
    'Margarita',
    'Gin Tônica',
    'Mojito',
    'Sex on the Beach',
    'Piña Colada',
    'Bloody Mary',
    'Negroni'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !phone || !drink) return alert('Preencha todos os campos')
    await supabase.from('orders').insert({ name, phone, drink, status: 'pending' })
    setSent(true)
  }

  if (sent) return <h2>Seu pedido foi enviado! 🥂</h2>

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Pedir um drink 🍹</h1>
      <input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 10, fontSize: 16 }} />
      <input placeholder="Seu celular" value={phone} onChange={e => setPhone(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 10, fontSize: 16 }} />
      <select value={drink} onChange={e => setDrink(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 10, fontSize: 16 }}>
        <option value="">Escolha seu drink</option>
        {drinks.map((d, i) => <option key={i} value={d}>{d}</option>)}
      </select>
      <button type="submit" style={{ padding: 12, fontSize: 16, background: 'green', color: 'white', border: 'none', borderRadius: 5 }}>Enviar pedido</button>
    </form>
  )
}
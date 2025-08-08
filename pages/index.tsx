import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://egjsxugmbtuualogwetx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...ky0'
)

const DRINKS = [
  'Mojito',
  'Caipirinha',
  'Gin Tônica',
  'Margarita',
  'Aperol Spritz',
  'Piña Colada',
  'Sex on the Beach',
  'Negroni'
]

export default function Home() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedDrink, setSelectedDrink] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone || !selectedDrink) return alert('Preencha todos os campos.')
    setLoading(true)

    const { error } = await supabase.from('orders').insert({
      name,
      phone,
      drink: selectedDrink,
      status: 'pending'
    })

    setLoading(false)
    if (error) return alert('Erro ao enviar pedido.')
    setSuccess(true)
  }

  return (
    <main style={{ padding: 20, maxWidth: 400, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Fila Zero Bar</h1>
      {success ? (
        <p>Pedido enviado com sucesso! Aguarde ser chamado.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Nome:</label><br />
          <input value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: 8, marginBottom: 12 }} /><br />

          <label>Celular:</label><br />
          <input value={phone} onChange={e => setPhone(e.target.value)} required style={{ width: '100%', padding: 8, marginBottom: 12 }} /><br />

          <label>Escolha seu drink:</label><br />
          <select value={selectedDrink} onChange={e => setSelectedDrink(e.target.value)} required style={{ width: '100%', padding: 8, marginBottom: 12 }}>
            <option value="">Selecione...</option>
            {DRINKS.map(drink => <option key={drink} value={drink}>{drink}</option>)}
          </select>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, fontSize: 16 }}>
            {loading ? 'Enviando...' : 'Fazer pedido'}
          </button>
        </form>
      )}
    </main>
  )
}

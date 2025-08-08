import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Home() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [drinks, setDrinks] = useState([])
  const [drinkId, setDrinkId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('drinks')
        .select('id,name,available')
        .order('id', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      setDrinks((data || []).filter(d => d.available))
    }
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!name || !phone || !drinkId) {
      setErrorMsg('Preencha nome, celular e escolha um drink.')
      return
    }

    setLoading(true)
    try {
      const drink = drinks.find(d => String(d.id) === String(drinkId))
      if (!drink) throw new Error('Drink inválido.')

      const { error } = await supabase.from('orders').insert({
        name,
        phone,
        drink_id: drink.id,
        drink_name: drink.name,
        status: 'new' // <- precisa ser 'new'
      })
      if (error) throw error
      setSuccess(true)
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar pedido.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h2>Pedido enviado! 🥂</h2>
        <p>Você será avisado quando estiver pronto.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: 20, maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Fila Zero Bar</h1>
      <form onSubmit={handleSubmit}>
        <label>Seu nome</label><br/>
        <input value={name} onChange={e=>setName(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12 }} />

        <label>Celular (WhatsApp)</label><br/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+5511999999999" style={{ width:'100%', padding:10, marginBottom:12 }} />

        <label>Escolha seu drink</label><br/>
        <select value={drinkId} onChange={e=>setDrinkId(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12 }}>
          <option value="">Selecione...</option>
          {drinks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

        <button type="submit" disabled={loading} style={{ width:'100%', padding:12, fontSize:16 }}>
          {loading ? 'Enviando...' : 'Fazer pedido'}
        </button>
      </form>
    </main>
  )
}

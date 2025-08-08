import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

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

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [drinks, setDrinks] = useState([])
  const [drinkId, setDrinkId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Prefill do navegador
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('fzb_name') || ''
      const savedPhone = localStorage.getItem('fzb_phone') || ''
      if (savedName) setName(savedName)
      if (savedPhone) setPhone(savedPhone)
    } catch {}
  }, [])

  // Carregar drinks disponíveis
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

      const normalized = normalizeBR(phone)
      const { error } = await supabase.from('orders').insert({
        name,
        phone: normalized,
        drink_id: drink.id,
        drink_name: drink.name,
        status: 'new'
      })
      if (error) throw error

      // Persistir dados do usuário
      try {
        localStorage.setItem('fzb_name', name)
        localStorage.setItem('fzb_phone', normalized)
      } catch {}

      setSuccess(true)
      setDrinkId('')
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar pedido.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main style={{ padding: 20, maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h2>Pedido enviado! 🥂</h2>
        <p>Você receberá um <strong>SMS</strong> quando ficar pronto.</p>

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => setSuccess(false)}
            style={{ padding: 12, fontSize: 16 }}
          >
            ➕ Pedir outro drink
          </button>
          <button
            onClick={() => router.push(`/me?phone=${encodeURIComponent(normalizeBR(phone))}`)}
            style={{ padding: 12, fontSize: 16 }}
          >
            👀 Acompanhar status dos meus pedidos
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: 20, maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Fila Zero Bar</h1>
      <form onSubmit={handleSubmit}>
        <label>Seu nome</label><br/>
        <input value={name} onChange={e=>setName(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12 }} />

        <label>Celular</label><br/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55DDD9XXXXXXXX"
               style={{ width:'100%', padding:10, marginBottom:8 }} />
        <div style={{ fontSize:12, opacity:.8, marginBottom:12 }}>
          Você receberá um <strong>SMS</strong> quando seu drink estiver pronto.
        </div>

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

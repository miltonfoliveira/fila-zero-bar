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

export default function Menu() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [drinks, setDrinks] = useState([])
  const [drinkId, setDrinkId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // carrega perfil
  useEffect(() => {
    const load = async () => {
      let pid = null
      try { pid = localStorage.getItem('fzb_profile_id') || null } catch {}
      if (!pid) { router.replace('/cadastro'); return }

      const { data, error } = await supabase
        .from('profiles')
        .select('id,name,phone,photo_url')
        .eq('id', pid)
        .single()

      if (error || !data) { router.replace('/cadastro'); return }
      setProfile(data)
    }
    load()
  }, [router])

  useEffect(() => {
    const fetchDrinks = async () => {
      const { data, error } = await supabase
        .from('drinks')
        .select('id,name,available')
        .order('id', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      setDrinks((data || []).filter(d => d.available))
    }
    fetchDrinks()
  }, [])

  const order = async (e) => {
    e.preventDefault()
    if (!profile || !drinkId) { setErrorMsg('Escolha um drink.'); return }
    setLoading(true); setErrorMsg('')

    try {
      const drink = drinks.find(d => String(d.id) === String(drinkId))
      if (!drink) throw new Error('Drink inválido.')

      const { error } = await supabase.from('orders').insert({
        profile_id: profile.id,
        name: profile.name,
        phone: normalizeBR(profile.phone),
        photo_url: profile.photo_url || null,
        drink_id: drink.id,
        drink_name: drink.name,
        status: 'new'
      })
      if (error) throw error

      setSuccess(true)
      setDrinkId('')
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar pedido.')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    try {
      localStorage.removeItem('fzb_profile_id')
      localStorage.removeItem('fzb_name')
      localStorage.removeItem('fzb_phone')
      localStorage.removeItem('fzb_photo')
    } catch {}
    router.replace('/cadastro')
  }

  if (!profile) {
    return <main style={{ padding:20, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>Carregando…</main>
  }

  if (success) {
    return (
      <main style={{ padding:20, maxWidth:480, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <header style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover' }} />
          <div>
            <div style={{ fontWeight:700 }}>Olá, {profile.name}</div>
            <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <button onClick={logout} style={{ padding:'8px 10px' }}>Sair</button>
          </div>
        </header>

        <h2>Pedido enviado! 🥂</h2>
        <p>Você receberá um <strong>SMS</strong> quando ficar pronto.</p>

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <button onClick={() => setSuccess(false)} style={{ padding: 12, fontSize: 16 }}>
            ➕ Pedir outro drink
          </button>
          <button
            onClick={() => router.push(`/me?phone=${encodeURIComponent(normalizeBR(profile.phone))}`)}
            style={{ padding: 12, fontSize: 16 }}
          >
            👀 Acompanhar status dos meus pedidos
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding:20, maxWidth:480, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover' }} />
        <div>
          <div style={{ fontWeight:700 }}>Olá, {profile.name}</div>
          <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
        </div>
        <div style={{ marginLeft:'auto' }}>
          <button onClick={logout} style={{ padding:'8px 10px' }}>Sair</button>
        </div>
      </header>

      <h1>Cardápio</h1>
      <form onSubmit={order}>
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

      <div style={{ marginTop:16 }}>
        <button
          onClick={() => router.push(`/me?phone=${encodeURIComponent(normalizeBR(profile.phone))}`)}
          style={{ padding: 10, fontSize: 16 }}
        >
          👀 Acompanhar status
        </button>
      </div>
    </main>
  )
}

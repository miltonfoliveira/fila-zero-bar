// pages/menu.jsx
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
  const [loadingId, setLoadingId] = useState(null)
  const [success, setSuccess] = useState(false)
  const [lastDrinkName, setLastDrinkName] = useState('')
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

  // busca drinks com descrição
  useEffect(() => {
    const fetchDrinks = async () => {
      const { data, error } = await supabase
        .from('drinks')
        .select('id,name,description,available')
        .order('id', { ascending: true })
      if (error) { setErrorMsg(error.message); return }
      setDrinks(data || [])
    }
    fetchDrinks()
  }, [])

  const placeOrder = async (drink) => {
    if (!profile || !drink) return
    if (!drink.available) return
    setErrorMsg('')
    setLoadingId(drink.id)

    try {
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
      setLastDrinkName(drink.name)
      setSuccess(true)
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar pedido.')
    } finally {
      setLoadingId(null)
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

  // tela de sucesso pós-pedido
  if (success) {
    return (
      <main style={{ padding:20, maxWidth:520, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <header style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover' }} />
          <div>
            <div style={{ fontWeight:700 }}>Olá, {profile.name}</div>
            <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button onClick={() => router.push('/ranking')} style={{ padding:'8px 10px' }}>🏆 Ranking</button>
            <button onClick={logout} style={{ padding:'8px 10px' }}>Sair</button>
          </div>
        </header>

        <h2>Pedido enviado! 🥂</h2>
        <p>Seu <strong>{lastDrinkName}</strong> foi para a fila. Você receberá um <strong>SMS</strong> quando ficar pronto.</p>

        <div style={{ display:'grid', gap:10, marginTop:16 }}>
          <button onClick={() => setSuccess(false)} style={{ padding:12, fontSize:16 }}>
            ➕ Pedir outro drink
          </button>
          <button
            onClick={() => router.push(`/me?phone=${encodeURIComponent(normalizeBR(profile.phone))}`)}
            style={{ padding:12, fontSize:16 }}
          >
            👀 Acompanhar status dos meus pedidos
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding:20, maxWidth:960, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover' }} />
        <div>
          <div style={{ fontWeight:700 }}>Olá, {profile.name}</div>
          <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => router.push('/ranking')} style={{ padding:'8px 10px' }}>
            🏆 Ranking
          </button>
          <button onClick={() => router.push(`/me?phone=${encodeURIComponent(normalizeBR(profile.phone))}`)} style={{ padding:'8px 10px' }}>
            👀 Acompanhar status
          </button>
          <button onClick={logout} style={{ padding:'8px 10px' }}>Sair</button>
        </div>
      </header>

      <h1 style={{ margin:'8px 0 16px' }}>Cardápio</h1>
      {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

      {/* grid de cards */}
      <ul style={{
        listStyle:'none', padding:0, margin:0,
        display:'grid', gap:16,
        gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))'
      }}>
        {drinks.map(drink => {
          const unavailable = !drink.available
          return (
            <li key={drink.id} style={{
              background:'linear-gradient(180deg, #ffffff 0%, #f7f7f9 100%)',
              border:'1px solid #e5e7eb', borderRadius:14, boxShadow:'0 4px 14px rgba(0,0,0,.06)',
              display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:160
            }}>
              <div style={{ padding:16 }}>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>
                  {drink.name}
                </div>
                {drink.description ? (
                  <div style={{ fontSize:14, opacity:.8, lineHeight:1.4 }}>
                    {drink.description}
                  </div>
                ) : (
                  <div style={{ fontSize:12, opacity:.6 }}>Sem descrição</div>
                )}
              </div>

              <div style={{ padding:16, paddingTop:0 }}>
                <button
                  onClick={() => placeOrder(drink)}
                  disabled={unavailable || loadingId === drink.id}
                  style={{
                    width:'100%', padding:12, fontSize:16, fontWeight:700,
                    border:'none', borderRadius:10,
                    background: unavailable ? '#d1d5db' : (loadingId === drink.id ? '#93c5fd' : '#22c55e'),
                    color: unavailable ? '#6b7280' : '#0b0e0c',
                    cursor: unavailable ? 'not-allowed' : 'pointer'
                  }}
                  aria-label={`Pedir ${drink.name}`}
                  title={unavailable ? 'Esgotado' : `Pedir ${drink.name}`}
                >
                  {unavailable ? 'Esgotado' : (loadingId === drink.id ? 'Enviando…' : 'Pedir')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

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

function clearLocalProfile() {
  try {
    localStorage.removeItem('fzb_profile_id')
    localStorage.removeItem('fzb_name')
    localStorage.removeItem('fzb_phone')
    localStorage.removeItem('fzb_photo')
  } catch {}
}

export default function Menu() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [drinks, setDrinks] = useState([])
  const [loadingId, setLoadingId] = useState(null)
  const [success, setSuccess] = useState(false)
  const [lastDrinkName, setLastDrinkName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [actionsOpen, setActionsOpen] = useState(false)

  // carrega perfil com verificação robusta
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let pid = null
      try { pid = localStorage.getItem('fzb_profile_id') || null } catch {}
      if (!pid) { router.replace('/cadastro'); return }

      const { data } = await supabase
        .from('profiles')
        .select('id,name,phone,photo_url')
        .eq('id', pid)
        .maybeSingle()

      if (cancelled) return
      if (!data) {
        clearLocalProfile()
        router.replace('/cadastro')
        return
      }
      setProfile(data)
    }
    load()
    return () => { cancelled = true }
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

  // realtime: reflete UPDATE/INSERT/DELETE em drinks
  useEffect(() => {
    const channel = supabase
      .channel('drinks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drinks' },
        (payload) => {
          const { eventType } = payload
          if (eventType === 'UPDATE') {
            const row = payload.new
            setDrinks(prev =>
              prev.map(d =>
                d.id === row.id
                  ? { ...d, name: row.name, description: row.description, available: row.available }
                  : d
              )
            )
          } else if (eventType === 'INSERT') {
            const row = payload.new
            setDrinks(prev => {
              if (prev.some(d => d.id === row.id)) return prev
              const next = [...prev, row]
              // mantém ordenação por id asc como no fetch inicial
              next.sort((a, b) => (a.id > b.id ? 1 : -1))
              return next
            })
          } else if (eventType === 'DELETE') {
            const row = payload.old
            setDrinks(prev => prev.filter(d => d.id !== row.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      setActionsOpen(false)
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar pedido.')
    } finally {
      setLoadingId(null)
    }
  }

  const logout = () => {
    clearLocalProfile()
    router.replace('/cadastro')
  }

  const goMe = () => {
    router.push(`/me?phone=${encodeURIComponent(normalizeBR(profile.phone))}`)
  }

  if (!profile) {
    return <main style={{ padding:20, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>Carregando…</main>
  }

  // tela de sucesso pós-pedido
  if (success) {
    return (
      <main style={{ padding:20, maxWidth:520, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        {/* Header compacto */}
        <header style={{
          display:'grid',
          gridTemplateColumns:'auto 1fr auto',
          alignItems:'center', gap:12, marginBottom:12
        }}>
          <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover' }} />
          <div>
            <div style={{ fontWeight:700, fontSize:16, lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis' }}>
              Olá, {profile.name}
            </div>
            <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
          </div>
          <button
            onClick={() => setActionsOpen(v => !v)}
            style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff' }}
            aria-label="Menu"
          >
            ☰
          </button>
        </header>

        {/* Sheet de ações */}
        {actionsOpen && (
          <ActionSheet
            onClose={() => setActionsOpen(false)}
            actions={[
              { label:'🏆 Ranking', onClick: () => router.push('/ranking') },
              { label:'👀 Acompanhar status', onClick: goMe },
              { label:'🖼️ Alterar foto do perfil', onClick: () => router.push('/perfil') },
              { label:'🚪 Sair', onClick: logout, danger: true },
            ]}
          />
        )}

        <h2>Pedido enviado! 🥂</h2>
        <p>Seu <strong>{lastDrinkName}</strong> foi para a fila. Você receberá um <strong>SMS</strong> quando ficar pronto.</p>

        <div style={{ display:'grid', gap:10, marginTop:16 }}>
          <button onClick={() => setSuccess(false)} style={{ padding:12, fontSize:16 }}>
            ➕ Pedir outro drink
          </button>
          <button onClick={goMe} style={{ padding:12, fontSize:16 }}>
            👀 Acompanhar status dos meus pedidos
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding:20, maxWidth:960, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Header compacto e responsivo */}
      <header style={{
        display:'grid',
        gridTemplateColumns:'auto 1fr auto',
        alignItems:'center', gap:12, marginBottom:12
      }}>
        <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover' }} />
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:16, lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis' }}>
            Olá, {profile.name}
          </div>
          <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
        </div>
        <button
          onClick={() => setActionsOpen(v => !v)}
          style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff' }}
          aria-label="Menu"
        >
          ☰
        </button>
      </header>

      {/* Sheet de ações */}
      {actionsOpen && (
        <ActionSheet
          onClose={() => setActionsOpen(false)}
          actions={[
            { label:'🏆 Ranking', onClick: () => router.push('/ranking') },
            { label:'👀 Acompanhar status', onClick: goMe },
            { label:'🖼️ Alterar foto do perfil', onClick: () => router.push('/perfil') },
            { label:'🚪 Sair', onClick: logout, danger: true },
          ]}
        />
      )}

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
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>
                    {drink.name}
                  </div>
                  {unavailable && (
                    <span
                      aria-label="Esgotado"
                      title="Esgotado"
                      style={{
                        fontSize:12, padding:'2px 8px', borderRadius:999,
                        background:'#eee', color:'#666', border:'1px solid #ddd', whiteSpace:'nowrap'
                      }}
                    >
                      Esgotado
                    </span>
                  )}
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

/** Action sheet simples para mobile */
function ActionSheet({ actions, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.4)',
        display:'flex', justifyContent:'center', alignItems:'flex-end',
        zIndex:1000
      }}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{
          background:'#fff', width:'100%', maxWidth:540, borderTopLeftRadius:16, borderTopRightRadius:16,
          padding:10, boxShadow:'0 -10px 24px rgba(0,0,0,.15)'
        }}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick?.(); onClose(); }}
            style={{
              width:'100%', textAlign:'left', padding:'14px 16px',
              border:'none', background:'transparent',
              fontSize:16, borderBottom: i < actions.length-1 ? '1px solid #f1f5f9' : 'none',
              color: a.danger ? '#b91c1c' : '#0f172a'
            }}
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{ width:'100%', padding:'14px 16px', marginTop:6, border:'none', background:'#f8fafc', borderRadius:12, fontSize:16 }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

// pages/bar/gerenciar.jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

/**
 * Requer coluna:
 *   ALTER TABLE drinks ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true;
 */
export default function GerenciarDrinks() {
  const router = useRouter()
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drinks')
      .select('id, name, ingredients, available')
      .order('name', { ascending: true })
    if (error) setErrorMsg(error.message)
    setDrinks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = async (d) => {
    const { error } = await supabase
      .from('drinks')
      .update({ available: !d.available })
      .eq('id', d.id)
    if (error) { alert(error.message); return }
    setDrinks(prev => prev.map(x => x.id === d.id ? { ...x, available: !d.available } : x))
  }

  return (
    <main style={{ padding:16, maxWidth:900, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', marginBottom:12
      }}>
        <h1 style={{ margin:0, fontSize:20 }}>Gerenciar drinks</h1>
        <button
          onClick={() => router.push('/bar')}
          style={{ padding:'10px 14px', border:'1px solid #e5e7eb', background:'#fff', borderRadius:10, fontSize:16 }}
        >
          ← Voltar ao bar
        </button>
      </div>

      <p style={{ marginTop:0, opacity:.8 }}>
        Toque para alternar: <strong>Disponível</strong> ↔ <strong>Não disponível</strong>. Drinks não disponíveis somem do cardápio dos convidados.
      </p>

      {errorMsg && <div style={{ color:'#e11d48', marginBottom:12 }}>{errorMsg}</div>}
      {loading && <div style={{ opacity:.7, marginBottom:12 }}>Carregando…</div>}

      <ul style={{
        listStyle:'none', padding:0, margin:0,
        display:'grid', gap:12,
        gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))'
      }}>
        {drinks.map((d) => (
          <li key={d.id} style={{
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:14,
            display:'grid', gap:8, boxShadow:'0 4px 12px rgba(0,0,0,.04)'
          }}>
            <div style={{ fontWeight:800, fontSize:18 }}>{d.name}</div>
            {d.ingredients && (
              <div style={{ fontSize:13, color:'#374151' }}>{d.ingredients}</div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
              <span style={{
                fontSize:12,
                padding:'4px 8px',
                borderRadius:999,
                border: d.available ? '1px solid #86efac' : '1px solid #fecaca',
                background: d.available ? '#dcfce7' : '#fee2e2',
                color: d.available ? '#065f46' : '#991b1b'
              }}>
                {d.available ? 'Disponível' : 'Não disponível'}
              </span>
              <button
                onClick={() => toggle(d)}
                style={{
                  padding:'8px 12px',
                  border:'1px solid ' + (d.available ? '#fecaca' : '#86efac'),
                  background: d.available ? '#fff1f2' : '#ecfdf5',
                  color: d.available ? '#9f1239' : '#065f46',
                  borderRadius:10,
                  fontWeight:700
                }}
              >
                {d.available ? 'Marcar como não disponível' : 'Marcar como disponível'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {(!loading && drinks.length === 0) && (
        <div style={{ opacity:.7, marginTop:12 }}>Nenhum drink cadastrado.</div>
      )}
    </main>
  )
}

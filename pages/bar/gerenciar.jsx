// pages/bar/gerenciar.jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function GerenciarDrinks() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null) // id em salvamento
  const [error, setError] = useState(null)
  const [drinks, setDrinks] = useState([])

  const loadDrinks = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('drinks')
      .select('id, name, available')
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
      setDrinks([])
    } else {
      setDrinks(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDrinks()
  }, [])

  const onToggle = async (drinkId, nextValue) => {
    setSaving(drinkId)
    setError(null)

    // Atualiza UI de forma otimista
    setDrinks((prev) =>
      prev.map((d) => (d.id === drinkId ? { ...d, available: nextValue } : d))
    )

    const { error } = await supabase
      .from('drinks')
      .update({ available: nextValue })
      .eq('id', drinkId)

    if (error) {
      setError(error.message)
      // Reverte mudança caso haja erro
      setDrinks((prev) =>
        prev.map((d) => (d.id === drinkId ? { ...d, available: !nextValue } : d))
      )
    }

    setSaving(null)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
          paddingBottom: 12,
          borderBottom: '1px solid #eee',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>Gerenciar Drinks</h1>
        <button
          onClick={() => router.push('/bar-luluba36')}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: '#fff',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Voltar ao bar
        </button>
      </div>

      {loading && <p>Carregando...</p>}
      {error && (
        <p style={{ color: 'crimson', marginBottom: 12 }}>
          Erro: {error}
        </p>
      )}

      {!loading && drinks.length === 0 && <p>Nenhum drink cadastrado.</p>}

      {!loading && drinks.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {drinks.map((d) => (
            <li
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                border: '1px solid #eee',
                borderRadius: 10,
                marginBottom: 10
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ marginBottom: 4 }}>{d.name}</strong>
                <small style={{ color: d.available ? 'green' : 'gray' }}>
                  {d.available ? 'Disponível' : 'Não disponível'}
                </small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={saving === d.id}
                  onClick={() => onToggle(d.id, true)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: d.available ? '#e8f8ee' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Disponível
                </button>
                <button
                  disabled={saving === d.id}
                  onClick={() => onToggle(d.id, false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: !d.available ? '#fdeeee' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Não disponível
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

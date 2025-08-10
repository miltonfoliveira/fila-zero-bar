// components/HeaderBar.jsx
import { useState } from 'react'
import { useRouter } from 'next/router'

function clearLocalProfile() {
  try {
    localStorage.removeItem('fzb_profile_id')
    localStorage.removeItem('fzb_name')
    localStorage.removeItem('fzb_phone')
    localStorage.removeItem('fzb_photo')
  } catch {}
}

export default function HeaderBar({ title = '' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/menu')
    }
  }

  const actions = [
    { label: '🏠 Menu', onClick: () => router.push('/menu') },
    { label: '🏆 Ranking', onClick: () => router.push('/ranking') },
    {
      label: '👀 Acompanhar status',
      onClick: () => {
        let p = ''
        try { p = localStorage.getItem('fzb_phone') || '' } catch {}
        const qs = p ? `?phone=${encodeURIComponent(p)}` : ''
        router.push(`/me${qs}`)
      }
    },
    { label: '🖼️ Alterar foto do perfil', onClick: () => router.push('/perfil') },
    { label: '🚪 Sair', danger: true, onClick: () => { clearLocalProfile(); router.replace('/cadastro') } },
  ]

  return (
    <>
      <header style={{
        display:'grid',
        gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center',
        gap:12,
        padding:'12px 0',
        marginBottom:8,
        position:'relative'
      }}>
        {/* coluna esquerda vazia para balancear */}
        <div />

        {/* Título centralizado real */}
        <h1 style={{
          margin:0,
          fontSize:18,
          textAlign:'center',
          whiteSpace:'nowrap',
          overflow:'hidden',
          textOverflow:'ellipsis'
        }}>
          {title}
        </h1>

        {/* Grupo de botões alinhado à direita */}
        <div style={{ justifySelf:'end', display:'flex', gap:8 }}>
          {/* Voltar (esquerda) */}
          <button
            onClick={goBack}
            aria-label="Voltar"
            style={{
              padding:'8px 12px',
              border:'1px solid #e5e7eb',
              background:'#fff',
              borderRadius:10,
              fontSize:18,
              lineHeight:1,
              boxShadow:'0 2px 8px rgba(0,0,0,.06)',
              cursor:'pointer'
            }}
          >
            &lt;
          </button>

          {/* Menu (direita) */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            style={{
              padding:'8px 12px',
              border:'1px solid #e5e7eb',
              background:'#fff',
              borderRadius:10,
              fontSize:18,
              lineHeight:1,
              boxShadow:'0 2px 8px rgba(0,0,0,.06)',
              cursor:'pointer'
            }}
          >
            ☰
          </button>
        </div>
      </header>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.4)',
            display:'flex', justifyContent:'center', alignItems:'flex-end',
            zIndex:1000
          }}
        >
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{
              background:'#fff', width:'100%', maxWidth:540,
              borderTopLeftRadius:16, borderTopRightRadius:16,
              padding:10, boxShadow:'0 -10px 24px rgba(0,0,0,.15)'
            }}
          >
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => { a.onClick?.(); setOpen(false) }}
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
              onClick={() => setOpen(false)}
              style={{ width:'100%', padding:'14px 16px', marginTop:6, border:'none', background:'#f8fafc', borderRadius:12, fontSize:16 }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

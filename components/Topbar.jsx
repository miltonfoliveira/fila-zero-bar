// components/Topbar.jsx
import { useRouter } from 'next/router'

export default function Topbar({ title, onBack }) {
  const router = useRouter()
  const goBack = () => {
    if (onBack) return onBack()
    router.push('/menu')
  }

  return (
    <header style={{
      display:'grid',
      gridTemplateColumns:'auto 1fr auto',
      alignItems:'center',
      gap:12,
      padding:'12px 0',
      marginBottom:8
    }}>
      <button
        onClick={goBack}
        style={{
          padding:'8px 12px',
          border:'1px solid #e5e7eb',
          borderRadius:10,
          background:'#fff'
        }}
        aria-label="Voltar ao menu"
      >
        ⬅️ Menu
      </button>

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

      {/* espaçador para balancear o grid */}
      <div style={{ width:84 }} />
    </header>
  )
}

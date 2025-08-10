import { useRouter } from 'next/router'

export default function MenuButton({ label = 'Menu' }) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/menu')}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        padding: '8px 14px',
        background: '#eee',
        border: '1px solid #ccc',
        borderRadius: 6,
        fontSize: 14,
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  )
}

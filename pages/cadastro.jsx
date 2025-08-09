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

const genId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now()
}

export default function Cadastro() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // se já tem perfil, manda para /menu
  useEffect(() => {
    try {
      const pid = localStorage.getItem('fzb_profile_id')
      if (pid) router.replace('/menu')
    } catch {}
  }, [router])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    if (f) {
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result)
      reader.readAsDataURL(f)
    } else {
      setPreview('')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!name || !phone) {
      setErrorMsg('Preencha nome e celular.')
      return
    }
    setLoading(true)
    const profileId = genId()

    try {
      let photoUrl = null
      if (file) {
        // converte para base64 puro
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => {
            const res = (r.result || '').toString()
            const base64data = res.split(',')[1] || ''
            resolve(base64data)
          }
          r.onerror = reject
          r.readAsDataURL(file)
        })

        const up = await fetch('/api/upload-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            contentType: file.type || 'image/jpeg',
            filename: file.name || 'avatar.jpg',
            profileId
          })
        })
        const upRes = await up.json()
        if (!up.ok || !upRes.ok) throw new Error(upRes.error || 'Falha no upload da foto')
        photoUrl = upRes.url
      }

      const normalized = normalizeBR(phone)
      const { error } = await supabase.from('profiles').insert({
        id: profileId,
        name,
        phone: normalized,
        photo_url: photoUrl
      })
      if (error) throw error

      // guarda no navegador
      try {
        localStorage.setItem('fzb_profile_id', profileId)
        localStorage.setItem('fzb_name', name)
        localStorage.setItem('fzb_phone', normalized)
        if (photoUrl) localStorage.setItem('fzb_photo', photoUrl)
      } catch {}

      router.replace('/menu')
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao salvar cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding:20, maxWidth:420, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>Seu cadastro</h1>
      <p style={{ opacity:.8 }}>Preencha uma vez. Você poderá sair na próxima tela para trocar.</p>

      <form onSubmit={submit}>
        <label>Seu nome</label><br/>
        <input value={name} onChange={e=>setName(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12 }} />

        <label>Celular</label><br/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="DDD9XXXXXXXX"
               style={{ width:'100%', padding:10, marginBottom:12 }} />

        <label>Sua foto</label><br/>
        <input type="file" accept="image/*" onChange={onFile} style={{ marginBottom:12 }} />
        {preview && (
          <div style={{ marginBottom:12 }}>
            <img src={preview} alt="Prévia" style={{ width:120, height:120, objectFit:'cover', borderRadius:'50%' }} />
          </div>
        )}

        {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

        <button disabled={loading} style={{ width:'100%', padding:12, fontSize:16 }}>
          {loading ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>
    </main>
  )
}

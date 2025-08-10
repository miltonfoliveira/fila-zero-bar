import { useEffect, useRef, useState } from 'react'
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

// ------ Cropper simples (arraste + zoom) ------
function AvatarCropper({ file, onCancel, onConfirm }) {
  const [img, setImg] = useState(null)
  const [scale, setScale] = useState(1) // zoom
  const [pos, setPos] = useState({ x: 0, y: 0 }) // deslocamento
  const [drag, setDrag] = useState(null) // {x,y} do pointer down
  const containerRef = useRef(null)

  const VIEW = 280 // tamanho da janela de crop (quadrada); preview circular via CSS
  const OUT = 512  // resolução final exportada

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      // centraliza inicialmente
      setPos({ x: 0, y: 0 })
      setScale( Math.max(1, Math.min(2.5, VIEW / Math.min(image.width, image.height))) )
      URL.revokeObjectURL(url)
    }
    image.src = url
  }, [file])

  const onPointerDown = (e) => {
    e.preventDefault()
    const p = 'touches' in e ? e.touches[0] : e
    setDrag({ x: p.clientX, y: p.clientY, start: { ...pos } })
  }
  const onPointerMove = (e) => {
    if (!drag) return
    const p = 'touches' in e ? e.touches[0] : e
    const dx = p.clientX - drag.x
    const dy = p.clientY - drag.y
    setPos({ x: drag.start.x + dx, y: drag.start.y + dy })
  }
  const onPointerUp = () => setDrag(null)

  const wheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.max(1, Math.min(4, s + delta)))
  }

  const exportCropped = async () => {
    if (!img) return
    // Desenha no canvas final OUT×OUT
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')

    // Mapeia posição/escala da viewport (VIEW) para canvas OUT
    // A imagem é desenhada centrada em (OUT/2, OUT/2) com escala proporcional
    const scaleFactor = (OUT / VIEW) * scale
    const centerX = OUT / 2 + pos.x * (OUT / VIEW)
    const centerY = OUT / 2 + pos.y * (OUT / VIEW)

    const iw = img.width
    const ih = img.height
    const drawW = iw * scaleFactor
    const drawH = ih * scaleFactor

    ctx.fillStyle = '#fff'
    ctx.fillRect(0,0,OUT,OUT)

    ctx.save()
    // Máscara circular para exportar já redondo (opcional; se preferir quadrado, remova o clip)
    ctx.beginPath()
    ctx.arc(OUT/2, OUT/2, OUT/2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    ctx.drawImage(
      img,
      centerX - drawW / 2,
      centerY - drawH / 2,
      drawW,
      drawH
    )
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]
    // tamanho aproximado (base64 ~1.37x), só pra info
    const approxBytes = Math.ceil((base64.length * 3) / 4)
    // console.log('approx', approxBytes)

    await onConfirm({ base64, mime: 'image/jpeg', filename: 'avatar.jpg' })
  }

  if (!img) {
    return (
      <div style={{ padding: 12, textAlign: 'center' }}>Carregando imagem…</div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 10, fontWeight: 700 }}>Ajuste sua foto</div>
      <div
        ref={containerRef}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        onWheel={wheel}
        style={{
          width: VIEW, height: VIEW, margin: '0 auto 10px',
          borderRadius: '50%', overflow: 'hidden',
          position: 'relative', border: '2px solid #e5e7eb',
          touchAction: 'none', background: '#f9fafb'
        }}
      >
        {/* layer da imagem */}
        <img
          src={img.src}
          alt="preview"
          draggable={false}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
            transformOrigin: 'center center',
            userSelect: 'none',
            width: img.width + 'px',
            height: img.height + 'px'
          }}
        />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'10px 0' }}>
        <span style={{ fontSize:12, opacity:.7 }}>Zoom</span>
        <input
          type="range" min="1" max="4" step="0.01"
          value={scale} onChange={e => setScale(parseFloat(e.target.value))}
          style={{ flex:1 }}
        />
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        <button onClick={onCancel} style={{ padding:'8px 12px' }}>Cancelar</button>
        <button onClick={exportCropped} style={{ padding:'8px 12px', fontWeight:700 }}>Usar esta foto</button>
      </div>
    </div>
  )
}

export default function Cadastro() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [file, setFile] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [finalPhoto, setFinalPhoto] = useState(null) // {base64, mime, filename, previewUrl}
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
    if (!f) return
    // guarda arquivo bruto e abre cropper
    setFile(f)
    setShowCropper(true)
  }

  const onCropCancel = () => {
    setShowCropper(false)
    setFile(null)
  }

  const onCropConfirm = async ({ base64, mime, filename }) => {
    // cria um preview local a partir do base64
    const previewUrl = `data:${mime};base64,${base64}`
    setFinalPhoto({ base64, mime, filename, previewUrl })
    setShowCropper(false)
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
      if (finalPhoto?.base64) {
        const up = await fetch('/api/upload-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: finalPhoto.base64,
            contentType: finalPhoto.mime,
            filename: finalPhoto.filename,
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
        {!finalPhoto?.previewUrl ? (
          <>
            <input type="file" accept="image/*" onChange={onFile} style={{ marginBottom:12 }} />
            <div style={{ fontSize:12, opacity:.7, marginBottom:12 }}>
              Dica: escolha uma foto do rosto. Você poderá ajustar o enquadramento e o zoom.
            </div>
          </>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <img src={finalPhoto.previewUrl} alt="Prévia" style={{ width:120, height:120, objectFit:'cover', borderRadius:'50%', border:'1px solid #e5e7eb' }} />
            <button type="button" onClick={() => { setFinalPhoto(null); setFile(null); }} style={{ padding:'8px 10px' }}>
              Trocar foto
            </button>
          </div>
        )}

        {showCropper && file && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.6)',
            display:'grid', placeItems:'center', zIndex:1000, padding:20
          }}>
            <div style={{ background:'#fff', borderRadius:12, padding:16, width:340, maxWidth:'90vw' }}>
              <AvatarCropper file={file} onCancel={onCropCancel} onConfirm={onCropConfirm} />
            </div>
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

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

/** Cropper simples (arraste + zoom) trabalhando com DataURL */
function AvatarCropper({ dataUrl, onCancel, onConfirm }) {
  const [imgEl, setImgEl] = useState(null)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState(null)

  const VIEW = 280, OUT = 512
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const clampPos = (px, py, s, iw, ih) => {
    const halfW = (iw * s) / 2, halfH = (ih * s) / 2, halfView = VIEW / 2
    const maxX = Math.max(0, halfW - halfView), maxY = Math.max(0, halfH - halfView)
    return { x: clamp(px, -maxX, +maxX), y: clamp(py, -maxY, +maxY) }
  }

  useEffect(() => {
    if (!dataUrl) return
    const img = new Image()
    img.onload = () => {
      setImgEl(img)
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
      const m = VIEW / Math.min(iw, ih)
      setMinScale(m); setScale(m * 1.05); setPos({ x: 0, y: 0 })
    }
    img.src = dataUrl
  }, [dataUrl])

  const onPointerDown = (e) => { e.preventDefault(); const p = 'touches' in e ? e.touches[0] : e; setDrag({ x: p.clientX, y: p.clientY, start: { ...pos } }) }
  const onPointerMove = (e) => {
    if (!drag || !imgEl) return
    const p = 'touches' in e ? e.touches[0] : e
    const dx = p.clientX - drag.x, dy = p.clientY - drag.y
    const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height
    setPos(clampPos(drag.start.x + dx, drag.start.y + dy, scale, iw, ih))
  }
  const onPointerUp = () => setDrag(null)
  const wheel = (e) => {
    e.preventDefault()
    if (!imgEl) return
    const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height
    const next = clamp(scale + (e.deltaY > 0 ? -0.1 : 0.1), minScale, 6)
    setScale(next)
    setPos(prev => clampPos(prev.x, prev.y, next, iw, ih))
  }

  const exportCropped = async () => {
    if (!imgEl) return
    const canvas = document.createElement('canvas'); canvas.width = OUT; canvas.height = OUT
    const ctx = canvas.getContext('2d')
    const scaleFactor = (OUT / VIEW) * scale
    const centerX = OUT / 2 + pos.x * (OUT / VIEW)
    const centerY = OUT / 2 + pos.y * (OUT / VIEW)
    const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height
    const drawW = iw * scaleFactor, drawH = ih * scaleFactor
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,OUT,OUT)
    ctx.save(); ctx.beginPath(); ctx.arc(OUT/2, OUT/2, OUT/2, 0, Math.PI*2); ctx.closePath(); ctx.clip()
    ctx.drawImage(imgEl, centerX - drawW/2, centerY - drawH/2, drawW, drawH)
    ctx.restore()
    const outDataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = outDataUrl.split(',')[1]
    await onConfirm({ base64, mime:'image/jpeg', filename:'avatar.jpg', previewUrl: outDataUrl })
  }

  if (!imgEl) return <div style={{ padding: 12, textAlign: 'center' }}>Carregando imagem…</div>

  return (
    <div>
      <div style={{ marginBottom: 10, fontWeight: 700 }}>Ajuste sua foto</div>
      <div
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp} onWheel={wheel}
        style={{ width:280, height:280, margin:'0 auto 10px', borderRadius:'50%', overflow:'hidden',
                 position:'relative', border:'2px solid #e5e7eb', touchAction:'none', background:'#f9fafb' }}
      >
        <img src={dataUrl} alt="preview" draggable={false}
             style={{ position:'absolute', left:'50%', top:'50%',
                      transform:`translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
                      transformOrigin:'center center', userSelect:'none' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'10px 0' }}>
        <span style={{ fontSize:12, opacity:.7 }}>Zoom</span>
        <input type="range" min={minScale} max={6} step="0.01" value={scale} onChange={e => {
          const s = parseFloat(e.target.value)
          if (!imgEl) return
          const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height
          const next = Math.max(minScale, Math.min(6, s))
          setScale(next)
          setPos(prev => clampPos(prev.x, prev.y, next, iw, ih))
        }} style={{ flex:1 }}/>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        <button onClick={onCancel} style={{ padding:'10px 14px' }}>Cancelar</button>
        <button onClick={exportCropped} style={{ padding:'10px 14px', fontWeight:700 }}>Usar esta foto</button>
      </div>
    </div>
  )
}

export default function Cadastro() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fileDataUrl, setFileDataUrl] = useState('')   // Data URL para o cropper
  const [showCropper, setShowCropper] = useState(false)
  const [finalPhoto, setFinalPhoto] = useState(null)   // {base64, mime, filename, previewUrl}
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Evita loop: valida se profile existe antes de redirecionar
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pid = localStorage.getItem('fzb_profile_id')
        if (!pid) return
        const { data } = await supabase.from('profiles').select('id').eq('id', pid).maybeSingle()
        if (cancelled) return
        if (data?.id) {
          router.replace('/menu')
        } else {
          localStorage.removeItem('fzb_profile_id')
          localStorage.removeItem('fzb_name')
          localStorage.removeItem('fzb_phone')
          localStorage.removeItem('fzb_photo')
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [router])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result?.toString() || ''
      setFileDataUrl(dataUrl)
      setShowCropper(true)
    }
    reader.onerror = () => {
      setErrorMsg('Não foi possível ler a imagem. Tente outra foto.')
    }
    reader.readAsDataURL(f) // usa DataURL (robusto no iOS, inclusive HEIC -> Safari decodifica)
  }

  const onCropCancel = () => {
    setShowCropper(false)
    setFileDataUrl('')
  }

  const onCropConfirm = async ({ base64, mime, filename, previewUrl }) => {
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
        id: profileId, name, phone: normalized, photo_url: photoUrl
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
        <input
          value={name}
          onChange={e=>setName(e.target.value)}
          style={{ width:'100%', padding:12, marginBottom:12, fontSize:18 }}
          inputMode="text"
          autoComplete="name"
          autoCorrect="off"
          autoCapitalize="words"
        />

        <label>Celular</label><br/>
        <input
          value={phone}
          onChange={e=>setPhone(e.target.value)}
          placeholder="DDD9XXXXXXXX"
          style={{ width:'100%', padding:12, marginBottom:12, fontSize:18 }}
          inputMode="tel"
          autoComplete="tel"
          autoCorrect="off"
          autoCapitalize="off"
        />

        <label>Sua foto</label><br/>
        {!finalPhoto?.previewUrl ? (
          <>
            <input type="file" accept="image/*" onChange={onFile} style={{ marginBottom:12, fontSize:17 }} />
            <div style={{ fontSize:12, opacity:.7, marginBottom:12 }}>
              Dica: escolha uma foto do rosto. Você poderá ajustar o enquadramento e o zoom.
            </div>
          </>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <img src={finalPhoto.previewUrl} alt="Prévia" style={{ width:120, height:120, objectFit:'cover', borderRadius:'50%', border:'1px solid #e5e7eb' }} />
            <button type="button" onClick={() => { setFinalPhoto(null); setFileDataUrl(''); }} style={{ padding:'8px 10px' }}>
              Trocar foto
            </button>
          </div>
        )}

        {showCropper && fileDataUrl && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'grid', placeItems:'center', zIndex:1000, padding:20 }}>
            <div style={{ background:'#fff', borderRadius:12, padding:16, width:340, maxWidth:'90vw' }}>
              <AvatarCropper dataUrl={fileDataUrl} onCancel={onCropCancel} onConfirm={onCropConfirm} />
            </div>
          </div>
        )}

        {errorMsg && <div style={{ color:'#e66', marginBottom:12 }}>{errorMsg}</div>}

        <button disabled={loading} style={{ width:'100%', padding:12, fontSize:18 }}>
          {loading ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>
    </main>
  )
} 
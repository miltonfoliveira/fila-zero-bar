// pages/perfil.jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import HeaderBar from '../components/HeaderBar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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
    const next = Math.max(minScale, Math.min(6, scale + (e.deltaY > 0 ? -0.1 : 0.1)))
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

export default function Perfil() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [fileDataUrl, setFileDataUrl] = useState('')
  const [showCropper, setShowCropper] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pid = localStorage.getItem('fzb_profile_id')
        if (!pid) { router.replace('/cadastro'); return }
        const { data } = await supabase.from('profiles').select('id,name,phone,photo_url').eq('id', pid).maybeSingle()
        if (cancelled) return
        if (!data) { router.replace('/cadastro'); return }
        setProfile(data)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [router])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setFileDataUrl(reader.result?.toString() || '')
      setShowCropper(true)
    }
    reader.onerror = () => setErrorMsg('Não foi possível ler a imagem.')
    reader.readAsDataURL(f)
  }

  const onCropCancel = () => { setShowCropper(false); setFileDataUrl('') }

  const onCropConfirm = async ({ base64, mime, filename, previewUrl }) => {
    if (!profile) return
    setSaving(true)
    try {
      const profileId = profile.id
      const up = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, contentType: mime, filename, profileId })
      })
      const upRes = await up.json()
      if (!up.ok || !upRes.ok) throw new Error(upRes.error || 'Falha no upload')

      const { error } = await supabase.from('profiles').update({ photo_url: upRes.url }).eq('id', profileId)
      if (error) throw error

      try { localStorage.setItem('fzb_photo', upRes.url) } catch {}
      setProfile(prev => ({ ...prev, photo_url: upRes.url }))
      setShowCropper(false); setFileDataUrl('')
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao salvar foto.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <main style={{ padding:20, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>Carregando…</main>

  return (
    <main style={{ padding:20, maxWidth:420, margin:'0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <HeaderBar title="Seu perfil" />

      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <img src={profile.photo_url || '/avatar-placeholder.png'} alt="avatar" style={{ width:96, height:96, borderRadius:'50%', objectFit:'cover', border:'1px solid #e5e7eb' }} />
        <div>
          <div style={{ fontWeight:700 }}>{profile.name}</div>
          <div style={{ opacity:.7, fontSize:12 }}>{profile.phone}</div>
        </div>
      </div>

      <label>Trocar foto</label><br/>
      <input type="file" accept="image/*" onChange={onFile} style={{ margin:'6px 0 12px' }} />

      {showCropper && fileDataUrl && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'grid', placeItems:'center', zIndex:1000, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:16, width:340, maxWidth:'90vw' }}>
            <AvatarCropper dataUrl={fileDataUrl} onCancel={onCropCancel} onConfirm={onCropConfirm} />
          </div>
        </div>
      )}

      {errorMsg && <div style={{ color:'#e11d48', marginTop:8 }}>{errorMsg}</div>}

      <button disabled={saving} onClick={() => router.push('/menu')} style={{ width:'100%', padding:12, marginTop:16 }}>
        {saving ? 'Salvando…' : 'Concluir'}
      </button>
    </main>
  )
}

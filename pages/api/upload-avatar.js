// pages/api/upload-avatar.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { fileBase64, contentType, filename, profileId } = req.body || {};
    if (!fileBase64 || !contentType || !filename || !profileId) {
      return res.status(400).json({ ok: false, error: 'Parâmetros inválidos' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE, // server key
      { auth: { persistSession: false } }
    );

    // Converte base64 para buffer
    const buffer = Buffer.from(fileBase64, 'base64');
    // (opcional) limite de 1MB — o 512x512 jpeg 0.85 costuma ficar < 200KB
    if (buffer.length > 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'Imagem muito grande após compressão.' });
    }

    const safeName = (filename || 'avatar.jpg').toLowerCase().replace(/[^a-z0-9_.-]/g,'')
    const path = `profiles/${profileId}/${Date.now()}-${safeName.endsWith('.jpg') ? safeName : safeName + '.jpg'}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    return res.status(200).json({ ok: true, url: pub.publicUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

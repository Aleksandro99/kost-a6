// Pengingat WhatsApp otomatis untuk Piket (dijalankan Vercel Cron tiap hari 08:00 WIB).
//  - Piket WC   : pengingat di hari Sabtu giliran + pemberitahuan DENDA bila terlambat >= 7 hari
//  - Buang sampah: pengingat harian ke kelompok yang statusnya masih "belum buang sampah"
// Pengiriman memakai Fonnte (https://fonnte.com). Ganti fungsi sendWA() jika memakai gateway lain.
import { createClient } from '@supabase/supabase-js'

const FINE_AMOUNT = 10000
const FINE_AFTER_DAYS = 7

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000)
const tanggal = (iso: string) =>
  new Date(toUTC(iso)).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

async function sendWA(target: string, message: string): Promise<{ ok: boolean; info?: string }> {
  const token = process.env.FONNTE_TOKEN
  if (!token) return { ok: false, info: 'FONNTE_TOKEN belum diisi' }
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: new URLSearchParams({ target, message, countryCode: '62' }),
    })
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string }
    return { ok: res.ok && json.status !== false, info: json.reason }
  } catch (e) {
    return { ok: false, info: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron otomatis mengirim "Authorization: Bearer <CRON_SECRET>"
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return Response.json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi' }, { status: 500 })
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const dry = new URL(request.url).searchParams.get('dry') === '1' // uji coba tanpa mengirim
  const appUrl = (process.env.VITE_APP_URL || '').replace(/\/$/, '')
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  const report: { to: string; type: string; sent: boolean; info?: string }[] = []

  const deliver = async (phone: string, type: string, text: string) => {
    if (dry) {
      report.push({ to: phone, type, sent: false, info: 'dry-run' })
      return true
    }
    const r = await sendWA(phone, text)
    report.push({ to: phone, type, sent: r.ok, info: r.info })
    return r.ok
  }

  // ---------------- PIKET WC ----------------
  const { data: wc, error: wcErr } = await db.from('piket_wc_members').select('*')
  if (wcErr) return Response.json({ error: wcErr.message }, { status: 500 })

  for (const m of wc || []) {
    if (!m.phone) continue
    const late = daysBetween(m.next_date, today) // <0 = belum tiba

    if (late >= FINE_AFTER_DAYS) {
      if (m.fine_notified_for === m.next_date) continue
      const ok = await deliver(
        m.phone,
        'wc-denda',
        `Halo ${m.name} 👋,\n\nPiket WC kamu terjadwal *${tanggal(m.next_date)}* dan belum dibersihkan selama *${late} hari*.\nSesuai aturan, kamu dikenakan *denda ${rupiah(FINE_AMOUNT)}*.\n\nSegera bersihkan WC lalu tekan tombol "Sudah Piket":\n👉 ${appUrl}/piket/wc\n\n\nKOST A6`
      )
      if (ok && !dry) await db.from('piket_wc_members').update({ fine_notified_for: m.next_date }).eq('id', m.id)
    } else if (late >= 0) {
      if (m.reminded_for === m.next_date) continue
      const ok = await deliver(
        m.phone,
        'wc-pengingat',
        `Halo ${m.name} 👋,\n\nHari ini giliran kamu *piket WC* (${tanggal(m.next_date)}).\nJika belum dibersihkan dalam ${FINE_AFTER_DAYS} hari akan dikenakan denda ${rupiah(FINE_AMOUNT)}.\n\nSetelah selesai, tekan tombol "Sudah Piket":\n👉 ${appUrl}/piket/wc\n\n\nKOST A6`
      )
      if (ok && !dry) await db.from('piket_wc_members').update({ reminded_for: m.next_date }).eq('id', m.id)
    }
  }

  // ---------------- PIKET BUANG SAMPAH ----------------
  const { data: state } = await db.from('piket_sampah_state').select('*').eq('id', 1).maybeSingle()
  if (state && state.last_reminded_on !== today) {
    const { data: g } = await db.from('piket_sampah_groups').select('*').eq('id', state.current_group).maybeSingle()
    if (g) {
      let anySent = false
      for (const [name, phone] of [
        [g.member1_name, g.member1_phone],
        [g.member2_name, g.member2_phone],
      ] as const) {
        if (!phone) continue
        const ok = await deliver(
          phone,
          'sampah',
          `Halo ${name} 👋,\n\nSekarang giliran *${g.name}* untuk piket buang sampah dan statusnya masih *belum buang sampah*.\n\nSetelah selesai, centang "Sudah buang sampah" di:\n👉 ${appUrl}/piket/sampah\n\n\nKOST A6`
        )
        anySent = anySent || ok
      }
      if (anySent && !dry) await db.from('piket_sampah_state').update({ last_reminded_on: today }).eq('id', 1)
    }
  }

  return Response.json({ today, dry, count: report.length, report })
}

// Helper bersama untuk fitur Piket

export const FINE_AMOUNT = 10000 // denda piket WC
export const FINE_AFTER_DAYS = 7 // terlambat >= 7 hari -> denda

// Samakan format nomor HP (08xx / 8xx / 628xx -> 628xx)
export const normalizePhone = (p?: string | null) => {
  let c = (p || '').replace(/\D/g, '')
  if (c.startsWith('0')) c = '62' + c.slice(1)
  else if (c.startsWith('8')) c = '62' + c
  return c
}

export const getSession = (): { isAdmin: boolean; myPhone: string } => {
  try {
    const s = JSON.parse(localStorage.getItem('kost_session') || '{}')
    return { isAdmin: s.role === 'admin', myPhone: normalizePhone(s.phone) }
  } catch {
    return { isAdmin: false, myPhone: '' }
  }
}

// Tanggal hari ini (WIB) format YYYY-MM-DD
export const todayWIB = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Selisih hari (b - a), keduanya YYYY-MM-DD
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000)

export const addDays = (iso: string, n: number) => new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10)

export const formatTanggal = (iso: string, withWeekday = true) =>
  new Date(toUTC(iso)).toLocaleDateString('id-ID', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

export const isSaturday = (iso: string) => new Date(toUTC(iso)).getUTCDay() === 6

export const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

// Alamat aplikasi untuk link di pesan WhatsApp (isi VITE_APP_URL di Vercel)
export const appUrl = ((import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin).replace(/\/$/, '')

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${normalizePhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export interface Resident {
  phone: string
  name: string
}

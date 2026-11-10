import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  XMarkIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'
import {
  FINE_AFTER_DAYS,
  FINE_AMOUNT,
  addDays,
  appUrl,
  daysBetween,
  formatRupiah,
  formatTanggal,
  getSession,
  isSaturday,
  normalizePhone,
  todayWIB,
  waLink,
  type Resident,
} from '../lib/piket'

interface Member {
  id: number
  group_no: number
  position: number
  name: string
  phone: string | null
  next_date: string
  group_size: number
  is_mine: boolean
}

const GROUPS = [1, 2, 3]

export default function PiketWC() {
  const [{ isAdmin }] = useState(getSession)
  const [members, setMembers] = useState<Member[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const today = todayWIB()

  // Modal edit (admin)
  const [edit, setEdit] = useState<Member | null>(null)
  const [eName, setEName] = useState('')
  const [ePhone, setEPhone] = useState('')
  const [eDate, setEDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (first = false) => {
    const { data, error } = await supabase.rpc('get_piket_wc')
    if (error) console.error('Error fetch piket wc:', error)
    const list = (data as Member[]) || []
    setMembers(list)
    // buka otomatis kelompok milik user yang login
    if (first) setOpen([...new Set(list.filter((m) => m.is_mine).map((m) => m.group_no))])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('allowed_users')
      .select('phone, name')
      .eq('role', 'resident')
      .order('name', { ascending: true })
      .then(({ data }) => setResidents(data || []))
  }, [isAdmin])

  const toggle = (g: number) => setOpen((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]))

  const reminderText = (m: Member, late: number) =>
    late >= FINE_AFTER_DAYS
      ? `Halo ${m.name} 👋,\n\nPiket WC kamu terjadwal *${formatTanggal(m.next_date)}* dan sudah terlambat *${late} hari*. Sesuai aturan kamu dikenakan *denda ${formatRupiah(FINE_AMOUNT)}*.\n\nSegera bersihkan WC lalu tekan tombol "Sudah Piket":\n👉 ${appUrl}/piket/wc\n\nTerima kasih 🙏\n\n\nViktorius (KOST A6)`
      : `Halo ${m.name} 👋,\n\nPengingat: jadwal piket WC kamu *${formatTanggal(m.next_date)}*.\nJika terlambat sampai ${FINE_AFTER_DAYS} hari akan dikenakan denda ${formatRupiah(FINE_AMOUNT)}.\n\nSetelah selesai, tekan tombol "Sudah Piket":\n👉 ${appUrl}/piket/wc\n\nTerima kasih 🙏\n\n\nViktorius (KOST A6)`

  const handleDone = async (m: Member) => {
    const nextDate = addDays(m.next_date, 14 * m.group_size)
    if (!confirm(`Konfirmasi ${m.name} sudah piket WC?\nJadwal berikutnya: ${formatTanggal(nextDate)}`)) return
    setBusyId(m.id)
    const { data, error } = await supabase.rpc('piket_wc_selesai', { p_member: m.id })
    setBusyId(null)
    if (error) return alert('Gagal: ' + error.message)
    if ((data as { fined?: boolean } | null)?.fined) {
      alert(`✅ Piket tercatat.\n⚠️ Terlambat ${FINE_AFTER_DAYS}+ hari, dikenakan denda ${formatRupiah(FINE_AMOUNT)}.`)
    } else {
      alert('✅ Piket tercatat. Jadwal berpindah ke giliran berikutnya.')
    }
    fetchData()
  }

  const openEdit = (m: Member) => {
    setEdit(m)
    setEName(m.name)
    setEPhone(m.phone || '')
    setEDate(m.next_date)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    if (!eName.trim() || !eDate) return alert('Nama & tanggal wajib diisi.')
    if (!isSaturday(eDate) && !confirm('Tanggal ini bukan hari Sabtu. Tetap simpan?')) return
    setSaving(true)
    const { error } = await supabase
      .from('piket_wc_members')
      .update({ name: eName.trim(), phone: normalizePhone(ePhone) || null, next_date: eDate })
      .eq('id', edit.id)
    setSaving(false)
    if (error) return alert('Gagal menyimpan: ' + error.message)
    setEdit(null)
    fetchData()
  }

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">Memuat data...</div>
  }
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
        Data piket WC belum ada. Pastikan SQL schema sudah dijalankan.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
        <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-xs md:text-sm text-yellow-800">
          Piket WC dilakukan <b>hari Sabtu</b>, bergiliran tiap 2 minggu. Jika belum membersihkan WC selama{' '}
          <b>{FINE_AFTER_DAYS} hari</b> sejak jadwal, dikenakan <b>denda {formatRupiah(FINE_AMOUNT)}</b>. Pengingat dikirim
          otomatis lewat WhatsApp ke nomor yang terdaftar.
        </p>
      </div>

      <div className="space-y-3">
        {GROUPS.map((gNo) => {
          const list = members.filter((m) => m.group_no === gNo)
          if (list.length === 0) return null
          const isOpen = open.includes(gNo)
          const next = [...list].sort((a, b) => a.next_date.localeCompare(b.next_date))[0]
          const hasLate = list.some((m) => daysBetween(m.next_date, today) >= FINE_AFTER_DAYS)

          return (
            <div key={gNo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggle(gNo)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition"
                aria-expanded={isOpen}
              >
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 border-2 border-green-300 flex items-center justify-center shrink-0">
                  <UserGroupIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 flex items-center gap-2">
                    WC Kelompok {gNo}
                    {hasLate && (
                      <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">ADA DENDA</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {[...list].sort((a, b) => a.position - b.position).map((m) => m.name).join(' · ')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Giliran berikutnya: <b className="text-slate-600">{next.name}</b> — {formatTanggal(next.next_date, false)}
                  </p>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {[...list]
                    .sort((a, b) => a.next_date.localeCompare(b.next_date) || a.position - b.position)
                    .map((m) => {
                      const d = daysBetween(today, m.next_date) // >0 = belum tiba
                      const late = Math.max(-d, 0)
                      const fined = late >= FINE_AFTER_DAYS
                      const due = d <= 0

                      let statusColor = 'bg-blue-50 text-blue-600 border-blue-200'
                      let avatarColor = 'bg-blue-50 text-blue-700 border-blue-300'
                      let statusText = 'TERJADWAL'
                      let Icon = CalendarDaysIcon
                      let note = d === 1 ? 'Besok' : `${d} hari lagi`
                      if (fined) {
                        statusColor = 'bg-red-50 text-red-600 border-red-200'
                        avatarColor = 'bg-red-50 text-red-600 border-red-300'
                        statusText = `DENDA ${formatRupiah(FINE_AMOUNT)}`
                        Icon = ExclamationTriangleIcon
                        note = `Terlambat ${late} hari`
                      } else if (due) {
                        statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-300'
                        avatarColor = 'bg-yellow-50 text-yellow-700 border-yellow-400'
                        statusText = 'GILIRAN PIKET'
                        Icon = ClockIcon
                        note = late === 0 ? 'Hari ini' : `Terlambat ${late} hari`
                      }

                      const canPress = isAdmin || (m.is_mine && due)

                      return (
                        <div
                          key={m.id}
                          className={`relative bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center text-center ${
                            m.is_mine && !isAdmin ? 'border-blue-300 ring-2 ring-blue-200' : 'border-slate-200'
                          }`}
                        >
                          {m.is_mine && !isAdmin && (
                            <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                              KAMU
                            </span>
                          )}

                          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-3xl font-extrabold shadow-inner ${avatarColor}`}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="mt-3 flex items-center justify-center gap-1.5 max-w-full">
                            <p className="font-bold text-slate-800 text-base leading-tight truncate">{m.name}</p>
                            {isAdmin && m.phone && (
                              <a
                                href={waLink(m.phone, due ? reminderText(m, late) : undefined)}
                                target="_blank"
                                rel="noreferrer"
                                title={due ? 'Ingatkan via WhatsApp' : 'Chat WhatsApp'}
                                className="bg-green-100 text-green-600 p-1 rounded-full hover:bg-green-200 transition shrink-0"
                              >
                                <ChatBubbleLeftRightIcon className="w-3 h-3 md:w-4 md:h-4" />
                              </a>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-500 font-semibold flex items-center gap-1">
                            <CalendarDaysIcon className="w-3.5 h-3.5 text-slate-400" /> {formatTanggal(m.next_date)}
                          </p>

                          <div className={`mt-2 px-3 py-1.5 rounded-full font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 border ${statusColor}`}>
                            <Icon className="w-3 h-3 md:w-4 md:h-4" /> {statusText}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">{note}</p>

                          <div className="w-full mt-auto pt-3 flex flex-col items-center gap-2">
                            {(isAdmin || m.is_mine) && (
                              <button
                                onClick={() => handleDone(m)}
                                disabled={!canPress || busyId === m.id}
                                title={!canPress ? 'Tombol aktif mulai hari Sabtu giliranmu' : undefined}
                                className={`w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm ${
                                  canPress
                                    ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <CheckCircleIcon className="w-4 h-4" /> Sudah Piket
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => openEdit(m)}
                                title="Edit nama / nomor / jadwal"
                                className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-orange-100 hover:text-orange-600 transition border border-slate-200 shadow-sm"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODAL EDIT (ADMIN) */}
      {isAdmin && edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                <PencilSquareIcon className="w-5 h-5" /> WC Kelompok {edit.group_no}
              </h3>
              <button onClick={() => setEdit(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-orange-100 transition">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600">Pilih dari User Terdaftar (opsional)</label>
                <select
                  value={residents.some((r) => r.phone === normalizePhone(ePhone)) ? normalizePhone(ePhone) : ''}
                  onChange={(e) => {
                    const r = residents.find((x) => x.phone === e.target.value)
                    if (r) {
                      setEName(r.name)
                      setEPhone(r.phone)
                    }
                  }}
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="">-- pilih penghuni --</option>
                  {residents.map((r) => (
                    <option key={r.phone} value={r.phone}>{r.name} ({r.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Nama</label>
                <input value={eName} onChange={(e) => setEName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">No HP / WA (tujuan pengingat otomatis)</label>
                <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Tanggal Piket Berikutnya (Sabtu)</label>
                <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-slate-600">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold shadow-lg transition disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

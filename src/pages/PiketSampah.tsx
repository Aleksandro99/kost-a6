import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  XCircleIcon,
  CheckBadgeIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  XMarkIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/solid'
import { appUrl, formatTanggal, getSession, normalizePhone, waLink, type Resident } from '../lib/piket'

interface Group {
  id: number
  name: string
  member1_name: string | null
  member1_phone: string | null
  member2_name: string | null
  member2_phone: string | null
  last_done_at: string | null
  is_current: boolean
  is_mine: boolean
}

type MemberForm = { name: string; phone: string }
const emptyMember: MemberForm = { name: '', phone: '' }

export default function PiketSampah() {
  const [{ isAdmin }] = useState(getSession)
  const [groups, setGroups] = useState<Group[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Modal edit (admin)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [m1, setM1] = useState<MemberForm>(emptyMember)
  const [m2, setM2] = useState<MemberForm>(emptyMember)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_piket_sampah')
    if (error) console.error('Error fetch piket sampah:', error)
    setGroups((data as Group[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
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

  const current = groups.find((g) => g.is_current)

  const membersOf = (g: Group) =>
    [
      { name: g.member1_name, phone: g.member1_phone },
      { name: g.member2_name, phone: g.member2_phone },
    ].filter((m) => m.name)

  const reminderText = (g: Group, name: string) =>
    `Halo ${name} 👋,\n\nSekarang giliran *${g.name}* untuk piket buang sampah dan statusnya masih *belum buang sampah*.\n\nSetelah selesai, jangan lupa centang "Sudah buang sampah" di:\n👉 ${appUrl}/piket/sampah\n\nTerima kasih 🙏\n\n\nViktorius (KOST A6)`

  // --- Centang "sudah buang sampah" ---
  const handleDone = async (g: Group) => {
    if (!confirm(`Konfirmasi ${g.name} sudah buang sampah?\nGiliran akan pindah ke kelompok berikutnya.`)) return
    setBusyId(g.id)
    const { error } = await supabase.rpc('piket_sampah_selesai', { p_group: g.id })
    setBusyId(null)
    if (error) alert('Gagal: ' + error.message)
    fetchData()
  }

  // --- Admin: edit anggota ---
  const openEdit = (g: Group) => {
    setEditGroup(g)
    setM1({ name: g.member1_name || '', phone: g.member1_phone || '' })
    setM2({ name: g.member2_name || '', phone: g.member2_phone || '' })
  }

  const pickResident = (phone: string, set: (m: MemberForm) => void) => {
    const r = residents.find((x) => x.phone === phone)
    if (r) set({ name: r.name, phone: r.phone })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGroup) return
    const p1 = normalizePhone(m1.phone)
    const p2 = normalizePhone(m2.phone)
    if (p1 && p2 && p1 === p2) return alert('Anggota 1 dan 2 tidak boleh orang yang sama.')
    if ((m1.name.trim() && !p1) || (m2.name.trim() && !p2)) {
      if (!confirm('Ada anggota tanpa No HP: tidak bisa mencentang sendiri & tidak dapat pengingat WhatsApp. Lanjut simpan?')) return
    }
    setSaving(true)
    const { error } = await supabase
      .from('piket_sampah_groups')
      .update({
        member1_name: m1.name.trim() || null,
        member1_phone: p1 || null,
        member2_name: m2.name.trim() || null,
        member2_phone: p2 || null,
      })
      .eq('id', editGroup.id)
    setSaving(false)
    if (error) return alert('Gagal menyimpan: ' + error.message)
    setEditGroup(null)
    fetchData()
  }

  const handleSetCurrent = async () => {
    if (!editGroup) return
    if (!confirm(`Jadikan ${editGroup.name} sebagai giliran buang sampah sekarang?`)) return
    const { error } = await supabase.rpc('piket_sampah_set_current', { p_group: editGroup.id })
    if (error) return alert('Gagal: ' + error.message)
    setEditGroup(null)
    fetchData()
  }

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">Memuat data...</div>
  }
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
        Data kelompok belum ada. Pastikan SQL schema sudah dijalankan.
      </div>
    )
  }

  return (
    <div>
      {/* GILIRAN SEKARANG */}
      {current && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <MegaphoneIcon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-red-700">Giliran buang sampah: {current.name}</p>
            <p className="text-red-600/80 text-xs mt-0.5">
              {membersOf(current).map((m) => m.name).join(' & ') || 'Anggota belum diisi'} — status{' '}
              <b>belum buang sampah</b>. Setelah dicentang, giliran pindah ke kelompok berikutnya.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
        {groups.map((g) => {
          const done = !g.is_current && !!g.last_done_at
          let statusColor = 'bg-slate-100 text-slate-500 border-slate-200'
          let avatarColor = 'bg-slate-100 text-slate-500 border-slate-300'
          let statusText = 'MENUNGGU'
          let Icon = ClockIcon
          if (g.is_current) {
            statusColor = 'bg-red-50 text-red-500 border-red-200'
            avatarColor = 'bg-red-50 text-red-600 border-red-300'
            statusText = 'BELUM BUANG SAMPAH'
            Icon = XCircleIcon
          } else if (done) {
            statusColor = 'bg-green-100 text-green-700 border-green-200'
            avatarColor = 'bg-green-50 text-green-700 border-green-400'
            statusText = 'SUDAH BUANG SAMPAH'
            Icon = CheckBadgeIcon
          }

          const members = membersOf(g)
          const canCheck = g.is_current && (isAdmin || g.is_mine)

          return (
            <div
              key={g.id}
              className={`relative bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center text-center transition hover:shadow-md ${
                g.is_mine && !isAdmin ? 'border-blue-300 ring-2 ring-blue-200' : g.is_current ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              {g.is_mine && !isAdmin && (
                <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                  KELOMPOKMU
                </span>
              )}

              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 flex items-center justify-center text-3xl md:text-4xl font-extrabold shadow-inner ${avatarColor}`}>
                {g.id}
              </div>

              <h3 className="mt-3 font-extrabold text-slate-800 text-base">{g.name}</h3>

              {/* 2 anggota */}
              <div className="mt-1 w-full space-y-1 min-h-[2.75rem]">
                {members.length === 0 && <p className="text-sm text-slate-400 italic">Belum diisi</p>}
                {members.map((m, i) => (
                  <div key={i} className="flex items-center justify-center gap-1.5">
                    <p className="text-sm text-slate-700 font-semibold truncate">{m.name}</p>
                    {isAdmin && m.phone && (
                      <a
                        href={waLink(m.phone, g.is_current ? reminderText(g, m.name || '') : undefined)}
                        target="_blank"
                        rel="noreferrer"
                        title={g.is_current ? 'Ingatkan via WhatsApp' : 'Chat WhatsApp'}
                        className="bg-green-100 text-green-600 p-1 rounded-full hover:bg-green-200 transition shrink-0"
                      >
                        <ChatBubbleLeftRightIcon className="w-3 h-3 md:w-4 md:h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className={`mt-2 px-3 py-1.5 rounded-full font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 border ${statusColor}`}>
                <Icon className="w-3 h-3 md:w-4 md:h-4" /> {statusText}
              </div>
              {done && g.last_done_at && (
                <p className="text-[10px] text-slate-400 mt-1">{formatTanggal(g.last_done_at.slice(0, 10), false)}</p>
              )}

              {/* Centang */}
              <div className="w-full mt-auto pt-3 flex flex-col items-center gap-2">
                <label
                  className={`w-full flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-bold select-none transition ${
                    canCheck
                      ? 'cursor-pointer bg-white border-green-400 text-green-700 hover:bg-green-50 active:scale-95'
                      : 'cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                  title={
                    canCheck ? 'Centang jika sudah buang sampah' : g.is_current ? 'Hanya anggota kelompok ini / admin' : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={!canCheck || busyId === g.id}
                    onChange={() => handleDone(g)}
                    className="w-4 h-4 accent-green-600"
                  />
                  Sudah buang sampah
                </label>

                {isAdmin && (
                  <button
                    onClick={() => openEdit(g)}
                    title="Isi / edit anggota"
                    className="p-1.5 md:p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-orange-100 hover:text-orange-600 transition border border-slate-200 shadow-sm"
                  >
                    <PencilSquareIcon className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL EDIT (ADMIN) */}
      {isAdmin && editGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                <PencilSquareIcon className="w-5 h-5" /> {editGroup.name}
              </h3>
              <button onClick={() => setEditGroup(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-orange-100 transition">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto">
              {[
                { label: 'Anggota 1', v: m1, set: setM1 },
                { label: 'Anggota 2', v: m2, set: setM2 },
              ].map(({ label, v, set }) => (
                <div key={label} className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <p className="text-xs font-extrabold text-slate-700 uppercase">{label}</p>
                  <select
                    value={residents.some((r) => r.phone === normalizePhone(v.phone)) ? normalizePhone(v.phone) : ''}
                    onChange={(e) => pickResident(e.target.value, set)}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                  >
                    <option value="">-- pilih dari user terdaftar (opsional) --</option>
                    {residents.map((r) => (
                      <option key={r.phone} value={r.phone}>{r.name} ({r.phone})</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Nama"
                    value={v.name}
                    onChange={(e) => set({ ...v, name: e.target.value })}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="No HP / WA (harus sama dengan nomor login)"
                    value={v.phone}
                    onChange={(e) => set({ ...v, phone: e.target.value })}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                  />
                </div>
              ))}

              {!editGroup.is_current && (
                <button
                  type="button"
                  onClick={handleSetCurrent}
                  className="w-full py-2 text-xs font-bold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition"
                >
                  Jadikan {editGroup.name} giliran sekarang (belum buang sampah)
                </button>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditGroup(null)} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-slate-600">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold shadow-lg transition disabled:opacity-60"
                >
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

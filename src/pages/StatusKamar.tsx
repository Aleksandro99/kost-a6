import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  XCircleIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  XMarkIcon,
  BellAlertIcon,
  BanknotesIcon,
  CreditCardIcon,
  ClockIcon,
  KeyIcon,
  DocumentDuplicateIcon,
  HomeIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/solid'
import { useNavigate } from 'react-router-dom'
import { appUrl } from '../lib/piket'

interface Room {
  id: number
  room_number: string
  is_occupied: boolean
  tenant_name: string | null
  tenant_phone: string | null
  price: number | null // null = tidak boleh dilihat user ini
  is_mine?: boolean // true = kamar milik user yang login
  // digabung dari monthly_payments (per bulan)
  is_paid?: boolean
  proof_path?: string | null
}

interface Resident {
  phone: string
  name: string
}

interface MonthlyPayment {
  room_id: number
  is_paid: boolean
  proof_path: string | null
}

const DEFAULT_ROOMS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4']

// Samakan format nomor HP (08xx / 8xx / 628xx -> 628xx)
const normalizePhone = (p?: string | null) => {
  let c = (p || '').replace(/\D/g, '')
  if (c.startsWith('0')) c = '62' + c.slice(1)
  else if (c.startsWith('8')) c = '62' + c
  return c
}

export default function StatusKamar() {
  const navigate = useNavigate()

  // --- AUTH (dibaca sinkron dari session supaya data tidak di-fetch dua kali) ---
  const [{ isAdmin, myPhone }] = useState(() => {
    try {
      const session = JSON.parse(localStorage.getItem('kost_session') || '{}')
      return { isAdmin: session.role === 'admin', myPhone: normalizePhone(session.phone) }
    } catch {
      return { isAdmin: false, myPhone: '' } // session rusak -> dianggap tamu
    }
  })

  // Kamar ini milik user yang sedang login?
  const isMyRoom = useCallback((r: Room) => r.is_occupied && !!r.is_mine, [])

  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() =>
    new Date().toLocaleDateString('sv-SE').slice(0, 7)
  )

  // Modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [proofRoom, setProofRoom] = useState<Room | null>(null)
  const [proofMode, setProofMode] = useState<'view' | 'verify'>('view')
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofLoading, setProofLoading] = useState(false)

  // Form edit kamar (admin)
  const [editId, setEditId] = useState<number | null>(null)
  const [editRoomNo, setEditRoomNo] = useState('')
  const [editOccupied, setEditOccupied] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPrice, setEditPrice] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const formatRupiah = (num?: number | null) => 'Rp ' + (num ?? 0).toLocaleString('id-ID')

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    setLoading(true)

    let roomsData: Room[] | null = null

    if (isAdmin) {
      // Admin: baca langsung dari tabel (harga & no HP semua kamar)
      const { data, error } = await supabase.from('rooms').select('*').order('room_number', { ascending: true })
      if (error) console.error('Error fetch rooms:', error)
      roomsData = data
    } else {
      // Penghuni: harga & no HP kamar orang lain TIDAK dikirim oleh server (lihat get_rooms di SQL)
      const { data, error } = await supabase.rpc('get_rooms')
      if (!error && data) {
        roomsData = data as Room[]
      } else {
        // Fallback bila SQL migrasi privasi belum dijalankan: sembunyikan di sisi aplikasi
        console.warn('get_rooms belum tersedia, pakai fallback:', error)
        const res = await supabase.from('rooms').select('*').order('room_number', { ascending: true })
        roomsData = (res.data || []).map((r: Room) => {
          const mine = r.is_occupied && !!myPhone && normalizePhone(r.tenant_phone) === myPhone
          return { ...r, is_mine: mine, price: mine ? r.price : null, tenant_phone: mine ? r.tenant_phone : null }
        })
      }
    }

    if (!roomsData) {
      setLoading(false)
      return
    }

    const { data: paymentsData } = await supabase
      .from('monthly_payments')
      .select('id, room_id, proof_path, is_paid')
      .eq('month_year', currentMonth)

    setRooms(
      roomsData.map((room: Room) => {
        const payment = paymentsData?.find((item: MonthlyPayment) => item.room_id === room.id)
        const mine = isAdmin ? false : !!room.is_mine
        return {
          ...room,
          is_mine: mine,
          is_paid: payment ? payment.is_paid : false,
          proof_path: payment?.proof_path || null, // gambar hanya bisa dibuka admin & pemilik kamar
        }
      })
    )
    setLoading(false)
  }, [currentMonth, isAdmin, myPhone])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Daftar penghuni terdaftar (untuk dropdown di form admin)
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('allowed_users')
      .select('phone, name')
      .eq('role', 'resident')
      .order('name', { ascending: true })
      .then(({ data }) => setResidents(data || []))
  }, [isAdmin])

  // Buat 10 kamar default jika tabel masih kosong (admin saja)
  const handleSeedRooms = async () => {
    if (!confirm('Buat kamar A1-A6 dan B1-B4?')) return
    const { error } = await supabase
      .from('rooms')
      .insert(DEFAULT_ROOMS.map((n) => ({ room_number: n, is_occupied: false, price: 0 })))
    if (error) alert('Gagal membuat kamar: ' + error.message)
    fetchData()
  }

  // --- BUKTI TRANSFER (bucket private -> signed URL) ---
  const handleOpenProof = (room: Room, mode: 'view' | 'verify') => {
    if (!isAdmin && !isMyRoom(room)) return // hanya admin & pemilik kamar
    setProofRoom(room)
    setProofMode(mode)
    setShowProofModal(true)
  }

  useEffect(() => {
    if (!showProofModal || !proofRoom?.proof_path) {
      setProofSignedUrl(null)
      return
    }
    let cancelled = false
    setProofLoading(true)
    supabase.storage
      .from('receipts')
      .createSignedUrl(proofRoom.proof_path, 60 * 5)
      .then(({ data, error }) => {
        if (cancelled) return
        setProofSignedUrl(error ? null : data?.signedUrl || null)
        setProofLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showProofModal, proofRoom])

  const handleValidateTransfer = async (room: Room) => {
    if (!isAdmin) return
    if (!confirm(`Validasi pembayaran ${room.tenant_name} (Kamar ${room.room_number})?`)) return

    const { error } = await supabase
      .from('monthly_payments')
      .update({ is_paid: true })
      .eq('room_id', room.id)
      .eq('month_year', currentMonth)

    if (error) return alert('Gagal memvalidasi')
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('transactions').insert({
      created_at: today,
      type: 'income',
      amount: room.price,
      description: `Uang Kost - ${room.tenant_name} Kamar ${room.room_number} (${currentMonth})`,
    })
    alert('✅ Pembayaran Divalidasi & Lunas!')
    setShowProofModal(false)
    fetchData()
  }

  const handleRejectTransfer = async (room: Room) => {
    if (!isAdmin) return
    const msg =
      proofMode === 'verify'
        ? `Tolak bukti transfer dari ${room.tenant_name}?`
        : `Batalkan status LUNAS untuk ${room.tenant_name}?`
    if (!confirm(msg)) return

    if (room.proof_path) {
      const { error } = await supabase.storage.from('receipts').remove([room.proof_path])
      if (error) console.error('Gagal menghapus file bukti:', error)
    }
    const { error } = await supabase
      .from('monthly_payments')
      .delete()
      .eq('room_id', room.id)
      .eq('month_year', currentMonth)
    if (!error) {
      alert('❌ Status dikembalikan ke Belum Bayar.')
      setShowProofModal(false)
      fetchData()
    }
  }

  const toggleManualPayment = async (room: Room) => {
    if (!isAdmin || !room.is_occupied) return
    if (room.proof_path) {
      handleOpenProof(room, room.is_paid ? 'view' : 'verify')
      return
    }
    if (room.is_paid) {
      if (!confirm(`Batalkan status lunas (CASH) untuk ${room.tenant_name}?`)) return
      await supabase.from('monthly_payments').delete().eq('room_id', room.id).eq('month_year', currentMonth)
    } else {
      if (!confirm(`Tandai ${room.tenant_name} (Kamar ${room.room_number}) sudah bayar TUNAI (CASH)?`)) return
      await supabase.from('monthly_payments').insert({
        room_id: room.id,
        month_year: currentMonth,
        amount: room.price,
        is_paid: true,
        proof_path: null,
      })
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('transactions').insert({
        created_at: today,
        type: 'income',
        amount: room.price,
        description: `Uang Kost - ${room.tenant_name} Kamar ${room.room_number} (${currentMonth})`,
      })
    }
    fetchData()
  }

  const handleRemindTenant = (room: Room) => {
    if (!room.tenant_phone) return alert('Nomor HP penghuni belum diisi!')
    const phone = normalizePhone(room.tenant_phone)
    const isLate = new Date().getDate() > 10 ? 'Mengingat sekarang sudah lewat tanggal 10, ' : ''
    const message = `Halo ${room.tenant_name} 👋,\n\nSekadar mengingatkan, tagihan kost kamar *${room.room_number}* bulan ini sebesar *${formatRupiah(room.price)}* belum lunas.\n\n${isLate}Mohon segera melakukan pembayaran ya.\n Bayar langsung atau tf kunjungi \n 👉 ${appUrl} \nTerima kasih 🙏\n\n\nViktorius (KOST A6)`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  // --- USER: klik kamar sendiri untuk bayar ---
  const handleRoomClick = (room: Room) => {
    if (isAdmin) return
    if (!isMyRoom(room)) return // hanya kamar sendiri
    if (room.is_paid) return
    if (room.proof_path && !room.is_paid) {
      alert('Pembayaran sedang diproses oleh Admin. Mohon ditunggu')
      return
    }
    setSelectedRoom(room)
    setShowPayModal(true)
  }

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRoom) return
    // Cek ulang: user hanya boleh upload untuk kamarnya sendiri
    if (!isAdmin && !isMyRoom(selectedRoom)) return alert('Kamu hanya bisa upload bukti untuk kamarmu sendiri.')
    if (!file.type.startsWith('image/')) return alert('File harus berupa gambar.')
    if (file.size > 5 * 1024 * 1024) return alert('Ukuran gambar maksimal 5 MB.')

    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${currentMonth}/${selectedRoom.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('receipts').upload(path, file)
      if (error) throw error

      const { data: existing } = await supabase
        .from('monthly_payments')
        .select('id, proof_path')
        .eq('room_id', selectedRoom.id)
        .eq('month_year', currentMonth)
        .maybeSingle()

      if (existing) {
        await supabase.from('monthly_payments').update({ proof_path: path, is_paid: false }).eq('id', existing.id)
        if (existing.proof_path) await supabase.storage.from('receipts').remove([existing.proof_path])
      } else {
        await supabase.from('monthly_payments').insert({
          room_id: selectedRoom.id,
          month_year: currentMonth,
          amount: selectedRoom.price,
          proof_path: path,
          is_paid: false,
        })
      }
      alert('Upload Berhasil! Status berubah menjadi MENUNGGU VERIFIKASI.')
      setShowPayModal(false)
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      alert("Gagal upload! Pastikan Bucket 'receipts' sudah dibuat.\n" + message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // --- ADMIN: edit kamar ---
  const handleEditClick = (room: Room) => {
    setEditId(room.id)
    setEditRoomNo(room.room_number)
    setEditOccupied(room.is_occupied)
    setEditName(room.tenant_name || '')
    setEditPhone(room.tenant_phone || '')
    setEditPrice(room.price ? String(room.price) : '')
    setShowEditModal(true)
  }

  const handlePickResident = (phone: string) => {
    const r = residents.find((x) => x.phone === phone)
    if (r) {
      setEditName(r.name)
      setEditPhone(r.phone)
    }
  }

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    if (editOccupied && !editName.trim()) return alert('Nama penghuni wajib diisi untuk kamar terisi.')
    if (editOccupied && !editPhone.trim()) {
      if (!confirm('No HP kosong, penghuni tidak akan bisa upload bukti transfer. Lanjut simpan?')) return
    }
    const { error } = await supabase
      .from('rooms')
      .update({
        is_occupied: editOccupied,
        tenant_name: editOccupied ? editName.trim() : null,
        tenant_phone: editOccupied ? normalizePhone(editPhone) || null : null,
        price: parseInt(editPrice) || 0,
      })
      .eq('id', editId)
    if (error) return alert('Gagal menyimpan: ' + error.message)
    setShowEditModal(false)
    fetchData()
  }

  const handleCopy = (text: string, bankName: string) => {
    navigator.clipboard.writeText(text)
    alert(`✅ Nomor Rekening ${bankName} berhasil disalin!`)
  }

  const getWALink = (phone?: string | null) => (phone ? `https://wa.me/${normalizePhone(phone)}` : '#')

  const hasMyRoom = rooms.some(isMyRoom)

  return (
    <div className="max-w-7xl mx-auto mt-6 px-2 md:px-4 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            🏠 Status Kamar
            {!isAdmin && (
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded-full uppercase">
                Mode Anak Kost
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {isAdmin
              ? 'Kelola kamar & pembayaran bulanan'
              : hasMyRoom
                ? 'Tekan "Upload Bukti Transfer" di kamarmu untuk membayar'
                : 'Kamu belum terdaftar di kamar mana pun. Hubungi Admin.'}
          </p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200 w-full md:w-auto items-center overflow-x-auto">
          <div className="relative flex-1 md:flex-none min-w-[150px]">
            <CalendarDaysIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/manage-users')}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition whitespace-nowrap shadow-sm"
            >
              <KeyIcon className="w-5 h-5 text-yellow-400" /> <span className="hidden sm:inline">Kelola Akses</span>
            </button>
          )}
        </div>
      </div>

      {/* DAFTAR KAMAR (KARTU) */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">Memuat data...</div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
          Belum ada data kamar.
          {isAdmin && (
            <div className="mt-3">
              <button onClick={handleSeedRooms} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
                Buat Kamar A1-A6 &amp; B1-B4
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
          {rooms.map((room) => {
            const mine = isMyRoom(room)
            const canSeeProof = isAdmin || mine
            const canSeePrice = isAdmin || mine // harga hanya admin & penghuni kamar tsb

            let statusColor = 'bg-red-50 text-red-500 border-red-200'
            let avatarColor = 'bg-red-50 text-red-600 border-red-300'
            let statusText = 'BELUM'
            let Icon = XCircleIcon
            if (!room.is_occupied) {
              statusColor = 'bg-slate-100 text-slate-500 border-slate-200'
              avatarColor = 'bg-slate-100 text-slate-500 border-slate-300'
              statusText = 'KOSONG'
              Icon = HomeIcon
            } else if (room.is_paid) {
              statusColor = 'bg-green-100 text-green-700 border-green-200'
              avatarColor = 'bg-green-50 text-green-700 border-green-400'
              statusText = 'LUNAS'
              Icon = room.proof_path ? CreditCardIcon : BanknotesIcon
            } else if (room.proof_path) {
              statusColor = 'bg-yellow-50 text-yellow-600 border-yellow-200'
              avatarColor = 'bg-yellow-50 text-yellow-600 border-yellow-300'
              statusText = 'PROSES'
              Icon = ClockIcon
            }

            const canUpload = !isAdmin && mine && !room.is_paid && !room.proof_path
            const showPrice = canSeePrice && (room.is_occupied || (room.price ?? 0) > 0)

            return (
              <div
                key={room.id}
                className={`relative bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center text-center transition hover:shadow-md ${
                  mine && !isAdmin ? 'border-blue-300 ring-2 ring-blue-200' : 'border-slate-200'
                }`}
              >
                {mine && !isAdmin && (
                  <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                    KAMARMU
                  </span>
                )}

                {/* Lingkaran nomor kamar (seperti foto profil) */}
                <div
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 flex items-center justify-center text-2xl md:text-3xl font-extrabold shadow-inner ${avatarColor}`}
                >
                  {room.room_number}
                </div>

                {/* Nama penghuni */}
                <div className="mt-3 w-full flex items-center justify-center gap-1.5">
                  {room.is_occupied ? (
                    <p className="font-bold text-slate-800 text-sm md:text-base leading-tight truncate">{room.tenant_name}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Belum terisi</p>
                  )}
                  {isAdmin && room.is_occupied && room.tenant_phone && (
                    <a
                      href={getWALink(room.tenant_phone)}
                      target="_blank"
                      rel="noreferrer"
                      title="Chat WhatsApp"
                      className="bg-green-100 text-green-600 p-1 rounded-full hover:bg-green-200 transition shrink-0"
                    >
                      <ChatBubbleLeftRightIcon className="w-3 h-3 md:w-4 md:h-4" />
                    </a>
                  )}
                </div>

                {/* Harga kamar (admin & pemilik kamar saja) */}
                <p className="mt-0.5 text-xs md:text-sm text-slate-500 font-mono min-h-[1.25rem]">
                  {showPrice ? formatRupiah(room.price) : ''}
                </p>

                {/* Status */}
                <button
                  onClick={() => {
                    if (!isAdmin || !room.is_occupied) return
                    if (room.proof_path) handleOpenProof(room, room.is_paid ? 'view' : 'verify')
                    else toggleManualPayment(room)
                  }}
                  className={`mt-2 px-3 py-1.5 rounded-full font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 border ${statusColor} ${
                    isAdmin && room.is_occupied ? 'cursor-pointer active:scale-95 shadow-sm hover:brightness-95' : 'cursor-default'
                  }`}
                >
                  <Icon className="w-3 h-3 md:w-4 md:h-4" /> {statusText}
                </button>

                {/* Aksi */}
                <div className="w-full flex flex-col items-center gap-2 mt-auto pt-3">
                  {canUpload && (
                    <button
                      onClick={() => handleRoomClick(room)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" /> Upload Bukti Transfer
                    </button>
                  )}

                  {mine && !isAdmin && !room.is_paid && room.proof_path && (
                    <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 px-2 py-1 rounded border border-yellow-100">
                      sedang diverifikasi
                    </span>
                  )}

                  {room.proof_path && canSeeProof && !isAdmin && (
                    <button
                      onClick={() => handleOpenProof(room, 'view')}
                      className="text-[11px] text-blue-500 underline hover:text-blue-700"
                    >
                      Lihat Bukti
                    </button>
                  )}

                  {isAdmin && (
                    <div className="flex items-center justify-center gap-2">
                      {room.is_occupied && !room.is_paid && !room.proof_path && (
                        <button
                          onClick={() => handleRemindTenant(room)}
                          title="Ingatkan"
                          className="p-1.5 md:p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition border border-yellow-200 shadow-sm animate-pulse"
                        >
                          <BellAlertIcon className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditClick(room)}
                        title="Edit kamar"
                        className="p-1.5 md:p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-orange-100 hover:text-orange-600 transition border border-slate-200 shadow-sm"
                      >
                        <PencilSquareIcon className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL VERIFIKASI / LIHAT BUKTI */}
      {showProofModal && proofRoom && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-2 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg">{proofMode === 'verify' ? 'Verifikasi Pembayaran' : 'Bukti Pembayaran'}</h3>
                <p className="text-xs opacity-80">{proofRoom.tenant_name} - Kamar {proofRoom.room_number}</p>
              </div>
              <button onClick={() => setShowProofModal(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition">
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center overflow-auto relative p-2">
              {proofLoading ? (
                <div className="text-white text-sm animate-pulse">Memuat gambar...</div>
              ) : proofSignedUrl ? (
                <img src={proofSignedUrl} alt="Bukti" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-white text-sm">Gambar tidak ditemukan / tidak punya akses</div>
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              {isAdmin && proofMode === 'verify' ? (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleRejectTransfer(proofRoom)} className="py-3 bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-200 transition border border-red-200">
                    <XMarkIcon className="w-5 h-5" /> Tolak
                  </button>
                  <button onClick={() => handleValidateTransfer(proofRoom)} className="py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition shadow-lg">
                    <CheckBadgeIcon className="w-5 h-5" /> Terima (Valid)
                  </button>
                </div>
              ) : isAdmin ? (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleRejectTransfer(proofRoom)} className="py-3 bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-200 transition border border-red-200">
                    <XMarkIcon className="w-5 h-5" /> Batal / Reset
                  </button>
                  <button onClick={() => setShowProofModal(false)} className="py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition">
                    Tutup
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowProofModal(false)} className="w-full py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition">
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMBAYARAN USER */}
      {showPayModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-4 text-white text-center shrink-0">
              <h3 className="font-bold text-lg">Metode Pembayaran</h3>
              <p className="text-xs opacity-90">{selectedRoom.tenant_name} - Kamar {selectedRoom.room_number}</p>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 font-bold uppercase">Total Tagihan</p>
                <p className="text-2xl font-bold text-slate-800">{formatRupiah(selectedRoom.price)}</p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                  <p className="font-bold text-xs text-slate-500 uppercase mb-3 flex items-center gap-1">
                    Transfer Bank / E-Wallet
                    <span className="text-[9px] font-normal text-slate-400 lowercase">(klik nomor untuk menyalin)</span>
                  </p>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <p className="font-bold text-blue-800">GOPAY</p>
                      <p className="text-[10px] text-slate-500">AFRIANSYAH AKBAR</p>
                    </div>
                    <button
                      onClick={() => handleCopy('082111763984', 'GOPAY')}
                      className="font-mono font-bold bg-white px-2 py-1.5 rounded border border-slate-200 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition active:scale-95 flex items-center gap-1 group"
                    >
                      082111763984
                      <DocumentDuplicateIcon className="w-3 h-3 text-slate-300 group-hover:text-blue-500" />
                    </button>
                  </div>
                </div>
                <p className="text-center text-[10px] text-slate-400 italic">*Bisa juga bayar tunai langsung ke Admin</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700">Upload Bukti Transfer</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  onChange={handleUploadProof}
                  disabled={uploading}
                />
                {uploading && <p className="text-xs text-blue-500 animate-pulse font-bold text-center">Sedang mengupload...</p>}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={() => setShowPayModal(false)} className="w-full py-3 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg transition border border-slate-300 bg-white">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT KAMAR (ADMIN) */}
      {isAdmin && showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                <PencilSquareIcon className="w-5 h-5" /> Kamar {editRoomNo}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-orange-100 transition">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4">
              {/* Status terisi / kosong */}
              <div>
                <label className="text-xs font-bold text-slate-600">Status Kamar</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setEditOccupied(true)}
                    className={`py-2 rounded-lg font-bold text-sm border transition ${editOccupied ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Terisi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditOccupied(false)}
                    className={`py-2 rounded-lg font-bold text-sm border transition ${!editOccupied ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Kosong
                  </button>
                </div>
              </div>

              {editOccupied && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Pilih dari User Terdaftar (opsional)</label>
                    <select
                      value={residents.some((r) => r.phone === normalizePhone(editPhone)) ? normalizePhone(editPhone) : ''}
                      onChange={(e) => handlePickResident(e.target.value)}
                      className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      <option value="">-- pilih penghuni --</option>
                      {residents.map((r) => (
                        <option key={r.phone} value={r.phone}>{r.name} ({r.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Nama Penghuni</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">No HP / WA (harus sama dengan nomor login penghuni)</label>
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono" />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600">Jumlah Pembayaran / Bulan (Rp)</label>
                <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-slate-600">Batal</button>
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold shadow-lg transition">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

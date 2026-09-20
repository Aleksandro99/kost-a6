import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { 
  XCircleIcon, 
  UserPlusIcon, 
  TrashIcon, 
  CalendarDaysIcon, 
  CheckBadgeIcon, 
  ChatBubbleLeftRightIcon, 
  PencilSquareIcon, 
  XMarkIcon,
  BellAlertIcon,
  //ExclamationTriangleIcon,
  BanknotesIcon,
  CreditCardIcon,
  ClockIcon,
  KeyIcon,
  DocumentDuplicateIcon // Import icon copy
} from '@heroicons/react/24/solid'
import { useNavigate } from 'react-router-dom'

interface Tenant {
  id: number;
  name: string;
  room_number: string;
  price: number;
  phone?: string;
  is_paid?: boolean;
  proof_url?: string | null;
}

export default function StatusPembayaran() {
  const navigate = useNavigate()
  // --- AUTH CHECK ---
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    const session = localStorage.getItem('kost_session')
    if (session) {
        const user = JSON.parse(session)
        setIsAdmin(user.role === 'admin')
    }
  }, [])
  // ------------------

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  
  // Tanggal sesuai Local Time
  const [currentMonth, setCurrentMonth] = useState(() => {
      const now = new Date()
      // Menggunakan toLocaleDateString dengan format Swedia (sv-SE) -> YYYY-MM-DD
      // Ini lebih aman daripada toISOString yang pakai UTC
      return now.toLocaleDateString('sv-SE').slice(0, 7)
  })
  
  // State Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [proofTenant, setProofTenant] = useState<Tenant | null>(null)
  const [proofMode, setProofMode] = useState<'view' | 'verify'>('view')
  
  // State Form Input Tenant
  const [newName, setNewName] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // State Form Edit Tenant
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoom, setEditRoom] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editPhone, setEditPhone] = useState('')
  //ok
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const formatRupiah = (num: number) => "Rp " + num.toLocaleString('id-ID')

  // --- 1. FETCH DATA UTAMA ---
  const fetchData = async () => {
    setLoading(true)
    const { data: tenantsData, error: errTenant } = await supabase.from('tenants').select('*').order('room_number', { ascending: true })
    
    if (errTenant || !tenantsData) { 
        console.error("Error fetch tenants:", errTenant)
        setLoading(false); 
        return 
    }

    const { data: paymentsData } = await supabase.from('monthly_payments').select('id, tenant_id, proof_url, is_paid').eq('month_year', currentMonth)

    const mergedData = tenantsData.map(t => {
        const payment = paymentsData?.find(p => p.tenant_id === t.id)
        return {
            ...t,
            is_paid: payment ? payment.is_paid : false,
            proof_url: payment?.proof_url || null
        }
    })

    setTenants(mergedData)
    setLoading(false)

    // Auto Scan Telat Bayar (Hanya Admin)
    if (isAdmin) {
        const today = new Date()
        const checkDate = today.getDate() 
        // Cek Local Time juga disini
        const currentMonthStr = today.toLocaleDateString('sv-SE').slice(0, 7)

        if (currentMonth === currentMonthStr && checkDate > 10) {
            const lateList = mergedData.filter(t => !t.is_paid && !t.proof_url)
            if (lateList.length > 0) setShowLateModal(true)
        }
    }
  }

  useEffect(() => { fetchData() }, [currentMonth, isAdmin])

  // --- 3. LOGIKA PEMBAYARAN & BUKTI ---
  const handleOpenProof = (tenant: Tenant, mode: 'view' | 'verify') => {
      setProofTenant(tenant)
      setProofMode(mode) 
      setShowProofModal(true)
  }

  const handleValidateTransfer = async (tenant: Tenant) => {
      if (!isAdmin) return
      if (!confirm(`Validasi pembayaran ${tenant.name}?`)) return

      const { error } = await supabase.from('monthly_payments').update({ is_paid: true }).eq('tenant_id', tenant.id).eq('month_year', currentMonth)

      if (!error) {
          const today = new Date().toISOString().split('T')[0]
          await supabase.from('transactions').insert({ created_at: today, type: 'income', amount: tenant.price, description: `Uang Kost - ${tenant.name} (${currentMonth})` })
          alert("✅ Pembayaran Divalidasi & Lunas!")
          setShowProofModal(false)
          fetchData() 
      } else { alert("Gagal memvalidasi") }
  }

  const handleRejectTransfer = async (tenant: Tenant) => {
      if (!isAdmin) return
      const confirmMsg = proofMode === 'verify' ? `Tolak bukti transfer dari ${tenant.name}?` : `Batalkan status LUNAS untuk ${tenant.name}?`
      if (!confirm(confirmMsg)) return

      // --- LOGIKA HAPUS GAMBAR DARI BUCKET ---
      if (tenant.proof_url) {
          try {
              // Ambil nama file dari ujung URL (contoh: url.com/.../receipts/nama-file.png)
              const fileName = tenant.proof_url.split('/').pop()
              if (fileName) {
                  await supabase.storage.from('receipts').remove([fileName])
              }
          } catch (err) {
              console.error("Gagal menghapus gambar dari bucket:", err)
          }
      }
      // ----------------------------------------

      const { error } = await supabase.from('monthly_payments').delete().eq('tenant_id', tenant.id).eq('month_year', currentMonth)
      if (!error) {
          alert("❌ Status dikembalikan ke Belum Bayar.")
          setShowProofModal(false)
          fetchData()
      }
  }

  const toggleManualPayment = async (tenant: Tenant) => {
    if (!isAdmin) return 
    if (tenant.proof_url) { handleOpenProof(tenant, tenant.is_paid ? 'view' : 'verify'); return }
    if (tenant.is_paid) {
        if (!confirm(`Batalkan status lunas (CASH) untuk ${tenant.name}?`)) return
        await supabase.from('monthly_payments').delete().eq('tenant_id', tenant.id).eq('month_year', currentMonth)
    } else {
        if (!confirm(`Tandai ${tenant.name} sudah bayar secara TUNAI (CASH)?`)) return
        await supabase.from('monthly_payments').insert({ tenant_id: tenant.id, month_year: currentMonth, amount: tenant.price, is_paid: true, proof_url: null })
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('transactions').insert({ created_at: today, type: 'income', amount: tenant.price, description: `Uang Kost - ${tenant.name} (${currentMonth})` })
    }
    fetchData()
  }

  const handleRemindTenant = (tenant: Tenant) => {
    if (!tenant.phone) return alert("Nomor HP tidak ada!")
    let phone = tenant.phone.replace(/\D/g,'')
    if(phone.startsWith('0')) phone = '62' + phone.substring(1)
    const todayDate = new Date().getDate()
    const isLate = todayDate > 10 ? "Mengingat sekarang sudah lewat tanggal 10, " : ""
    const message = `Halo ${tenant.name} 👋,\n\nSekadar mengingatkan, tagihan kost kamar *${tenant.room_number}* bulan ini sebesar *${formatRupiah(tenant.price)}* belum lunas.\n\n${isLate}Mohon segera melakukan pembayaran ya.\n Bayar langsung atau tf kunjungi \n 👉 https://kosta6.vercel.app/ \nTerima kasih 🙏\n\n\nViktorius (KOST A6)`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleTenantClick = (tenant: Tenant) => {
      if (!isAdmin) {
        if (tenant.is_paid) return
        if (tenant.proof_url && !tenant.is_paid) { alert("Pembayaran sedang diproses oleh Admin. Mohon ditunggu"); return }
        setSelectedTenant(tenant)
        setShowPayModal(true)
      }
  }

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file || !selectedTenant) return
      setUploading(true)
      try {
          const fileExt = file.name.split('.').pop()
          const fileName = `${currentMonth}-${selectedTenant.id}-${Date.now()}.${fileExt}`
          const { error } = await supabase.storage.from('receipts').upload(fileName, file)
          if(error) throw error
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
          const { data: existing } = await supabase.from('monthly_payments').select('*').eq('tenant_id', selectedTenant.id).eq('month_year', currentMonth).maybeSingle()
          
          if (existing) await supabase.from('monthly_payments').update({ proof_url: publicUrl, is_paid: false }).eq('id', existing.id)
          else await supabase.from('monthly_payments').insert({ tenant_id: selectedTenant.id, month_year: currentMonth, amount: selectedTenant.price, proof_url: publicUrl, is_paid: false })
          
          alert("Upload Berhasil! Status berubah menjadi MENUNGGU VERIFIKASI."); setShowPayModal(false); fetchData()
      } catch (error: any) { alert("Gagal upload! Pastikan Bucket 'receipts' sudah dibuat.\n" + error.message) } 
      finally { setUploading(false) }
  }

  // --- CRUD HANDLERS ---
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newName || !newRoom) return alert("Wajib diisi!")
    let cleanPhone = newPhone.replace(/\D/g,''); if(cleanPhone.startsWith('0')) cleanPhone = '62'+cleanPhone.slice(1)
    await supabase.from('tenants').insert({ name: newName, room_number: newRoom, price: parseInt(newPrice) || 0, phone: cleanPhone })
    alert("Sukses!"); setShowAddModal(false); fetchData(); setNewName(''); setNewRoom(''); setNewPrice(''); setNewPhone('')
  }

  const handleEditClick = (tenant: Tenant) => {
      setEditId(tenant.id); setEditName(tenant.name); setEditRoom(tenant.room_number); setEditPrice(tenant.price.toString()); setEditPhone(tenant.phone || ''); setShowEditModal(true)
  }

  const handleUpdateTenant = async (e: React.FormEvent) => {
      e.preventDefault(); if (!editId) return
      let cleanPhone = editPhone.replace(/\D/g,''); if(cleanPhone.startsWith('0')) cleanPhone = '62'+cleanPhone.slice(1)
      await supabase.from('tenants').update({ name: editName, room_number: editRoom, price: parseInt(editPrice) || 0, phone: cleanPhone }).eq('id', editId)
      alert("Updated!"); setShowEditModal(false); fetchData()
  }

  const handleDeleteTenant = async () => {
      if (!editId || !confirm("Hapus permanen?")) return
      await supabase.from('tenants').delete().eq('id', editId); setShowEditModal(false); fetchData()
  }
  
  const getWALink = (phone?: string) => { if(!phone) return '#'; let f = phone.replace(/\D/g,''); if(f.startsWith('0')) f = '62' + f.substring(1); return `https://wa.me/${f}` }

  const latePayersList = tenants.filter(t => !t.is_paid && !t.proof_url)

  // --- FUNGSI COPY REKENING ---
  const handleCopy = (text: string, bankName: string) => {
    navigator.clipboard.writeText(text)
    alert(`✅ Nomor Rekening ${bankName} berhasil disalin!`)
  }

  return (
    <div className="max-w-7xl mx-auto mt-6 px-2 md:px-4 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                🏠 Status Kost
                {!isAdmin && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded-full uppercase">Mode Anak Kost</span>}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
                {isAdmin ? "Kelola pembayaran bulanan" : "Klik namamu untuk bayar / upload bukti"}
            </p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200 w-full md:w-auto items-center overflow-x-auto">
             <div className="relative flex-1 md:flex-none min-w-[150px]">
                <CalendarDaysIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
             </div>
             
             {isAdmin && (
                 <>
                    {/* TOMBOL KELOLA AKSES USER */}
                    <button onClick={() => navigate('/manage-users')} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition whitespace-nowrap shadow-sm">
                        <KeyIcon className="w-5 h-5 text-yellow-400" /> <span className="hidden sm:inline">Kelola Akses</span>
                    </button>

                    {/* TOMBOL TAMBAH PENGHUNI */}
                    <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition whitespace-nowrap shadow-sm">
                        <UserPlusIcon className="w-5 h-5" /> <span className="hidden sm:inline">Baru</span>
                    </button>
                 </>
             )}
        </div>
      </div>

      {/* TABEL LIST PENGHUNI */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] md:text-xs font-bold">
                    <tr>
                        <th className="px-2 md:px-4 py-3 w-20 md:w-28 text-center">Kamar</th>
                        <th className="px-1 md:px-2 py-3">Penghuni</th>
                        <th className="px-2 md:px-4 py-3 text-center">Status Pembayaran</th>
                        {isAdmin && <th className="px-2 md:px-4 py-3 w-24 md:w-32 text-center">Aksi</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Memuat data...</td></tr>
                    ) : tenants.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Belum ada penghuni.</td></tr>
                    ) : (
                        tenants.map((item) => {
                            let statusColor = 'bg-red-50 text-red-500 border-red-200'
                            let statusText = 'BELUM'
                            let Icon = XCircleIcon
                            if (item.is_paid) {
                                if (item.proof_url) { statusColor = 'bg-green-100 text-green-700 border-blue-200'; statusText = 'LUNAS'; Icon = CreditCardIcon } 
                                else { statusColor = 'bg-green-100 text-green-700 border-green-200'; statusText = 'LUNAS'; Icon = BanknotesIcon }
                            } else if (item.proof_url) { statusColor = 'bg-yellow-50 text-yellow-600 border-yellow-200'; statusText = 'PROSES'; Icon = ClockIcon }

                            return (
                                <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group">
                                    <td className="px-2 md:px-4 py-3 text-center align-middle">
                                        <div className="inline-block bg-slate-100 rounded-lg px-2 py-1 text-slate-700 font-bold text-sm md:text-base border border-slate-200 min-w-[3rem]">{item.room_number}</div>
                                    </td>
                                    <td className={`px-1 md:px-2 py-4 align-middle ${!isAdmin ? (item.is_paid || item.proof_url ? 'cursor-not-allowed opacity-70' : 'cursor-pointer group-hover:text-blue-600') : ''}`} onClick={() => handleTenantClick(item)}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-slate-800 text-sm md:text-base leading-tight">{item.name}</p>
                                            {isAdmin && item.phone && (<a href={getWALink(item.phone)} target="_blank" onClick={(e) => e.stopPropagation()} className="bg-green-100 text-green-600 p-1 rounded-full hover:bg-green-200 transition"><ChatBubbleLeftRightIcon className="w-3 h-3 md:w-4 md:h-4" /></a>)}
                                        </div>
                                        <p className="text-xs text-slate-500 font-mono">{formatRupiah(item.price)}</p>
                                        {!isAdmin && !item.is_paid && !item.proof_url && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block animate-pulse border border-blue-100">klik untuk bayar</span>}
                                        {!isAdmin && !item.is_paid && item.proof_url && <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded mt-1 inline-block border border-yellow-100">sedang diverifikasi</span>}
                                    </td>
                                    <td className="px-2 md:px-4 py-4 text-center align-middle">
                                        <button onClick={() => { if(isAdmin) { if(item.proof_url && !item.is_paid) handleOpenProof(item, 'verify'); else if(item.proof_url && item.is_paid) handleOpenProof(item, 'view'); else toggleManualPayment(item) }}} className={`px-3 py-1.5 rounded-full font-bold text-[10px] md:text-xs flex items-center justify-center gap-1 mx-auto border ${statusColor} ${isAdmin ? 'cursor-pointer active:scale-95 shadow-sm hover:brightness-95' : 'cursor-default'}`}>
                                            <Icon className="w-3 h-3 md:w-4 md:h-4"/> {statusText}
                                        </button>
                                        {item.proof_url && !isAdmin && (<button onClick={() => window.open(item.proof_url || '', '_blank')} className="block text-[10px] text-blue-500 underline mt-1 hover:text-blue-700 w-full text-center">Lihat Bukti</button>)}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-1 md:px-4 py-4 align-middle">
                                            <div className="flex items-center justify-center gap-1 md:gap-2">
                                                {item.proof_url ? (<div className="p-1.5 md:p-2 invisible border border-transparent"><BellAlertIcon className="w-4 h-4 md:w-5 md:h-5" /></div>) : !item.is_paid ? (<button onClick={() => handleRemindTenant(item)} title="Ingatkan" className="p-1.5 md:p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition border border-yellow-200 shadow-sm animate-pulse"><BellAlertIcon className="w-4 h-4 md:w-5 md:h-5" /></button>) : (<div className="p-1.5 md:p-2 invisible border border-transparent"><BellAlertIcon className="w-4 h-4 md:w-5 md:h-5" /></div>)}
                                                <button onClick={() => handleEditClick(item)} title="Edit" className="p-1.5 md:p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-orange-100 hover:text-orange-600 transition border border-slate-200 shadow-sm"><PencilSquareIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL VERIFIKASI / LIHAT BUKTI */}
      {showProofModal && proofTenant && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-2 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                    <div><h3 className="font-bold text-lg">{proofMode === 'verify' ? 'Verifikasi Pembayaran' : 'Bukti Pembayaran'}</h3><p className="text-xs opacity-80">{proofTenant.name} - Kamar {proofTenant.room_number}</p></div>
                    <button onClick={() => setShowProofModal(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition"><XMarkIcon className="w-6 h-6 text-white" /></button>
                </div>
                <div className="flex-1 bg-black flex items-center justify-center overflow-auto relative p-2">
                    {proofTenant.proof_url ? (<img src={proofTenant.proof_url} alt="Bukti" className="max-w-full max-h-full object-contain"/>) : (<div className="text-white text-sm">Gambar tidak ditemukan</div>)}
                </div>
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    {proofMode === 'verify' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleRejectTransfer(proofTenant)} className="py-3 bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-200 transition border border-red-200"><XMarkIcon className="w-5 h-5" /> Tolak</button>
                            <button onClick={() => handleValidateTransfer(proofTenant)} className="py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition shadow-lg"><CheckBadgeIcon className="w-5 h-5" /> Terima (Valid)</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleRejectTransfer(proofTenant)} className="py-3 bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-200 transition border border-red-200"><XMarkIcon className="w-5 h-5" /> Batal / Reset</button>
                            <button onClick={() => setShowProofModal(false)} className="py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition">Tutup</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* MODAL PEMBAYARAN USER (DENGAN COPY REKENING) */}
      {showPayModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-4 text-white text-center shrink-0">
                    <h3 className="font-bold text-lg">Metode Pembayaran</h3>
                    <p className="text-xs opacity-90">{selectedTenant.name} - Kamar {selectedTenant.room_number}</p>
                </div>
                
                <div className="p-5 overflow-y-auto space-y-4">
                    <div className="text-center">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Tagihan</p>
                        <p className="text-2xl font-bold text-slate-800">{formatRupiah(selectedTenant.price)}</p>
                    </div>

                    <div className="space-y-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                            <p className="font-bold text-xs text-slate-500 uppercase mb-3 flex items-center gap-1">
                                Transfer Bank / E-Wallet 
                                <span className="text-[9px] font-normal text-slate-400 lowercase">(klik nomor untuk menyalin)</span>
                            </p>
                            
                            <div className="space-y-3">
                                {/* Mandiri */}
                                {/* <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <div>
                                        <p className="font-bold text-blue-800">MANDIRI</p>
                                        <p className="text-[10px] text-slate-500">AFRIANSYAH AKBAR</p>
                                    </div>
                                    <button 
                                        onClick={() => handleCopy("1460018273743", "MANDIRI")}
                                        className="font-mono font-bold bg-white px-2 py-1.5 rounded border border-slate-200 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition active:scale-95 flex items-center gap-1 group"
                                    >
                                        1460018273743
                                        <DocumentDuplicateIcon className="w-3 h-3 text-slate-300 group-hover:text-blue-500"/>
                                    </button>
                                </div> */}

                                {/* GOPAY */}
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <div>
                                        <p className="font-bold text-blue-800">GOPAY</p>
                                        <p className="text-[10px] text-slate-500">AFRIANSYAH AKBAR</p>
                                    </div>
                                    <button 
                                        onClick={() => handleCopy("082111763984", "GOPAY")}
                                        className="font-mono font-bold bg-white px-2 py-1.5 rounded border border-slate-200 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition active:scale-95 flex items-center gap-1 group"
                                    >
                                        082111763984
                                        <DocumentDuplicateIcon className="w-3 h-3 text-slate-300 group-hover:text-blue-500"/>
                                    </button>
                                </div>

                                {/* DANA */}
                                {/* <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-blue-500">DANA/Shopee Pay</p>
                                        <p className="text-[10px] text-slate-500">VIKTORIUS ANDO SAPUTRA</p>
                                    </div>
                                    <button 
                                        onClick={() => handleCopy("082256668107", "DANA/Shopee Pay")}
                                        className="font-mono font-bold bg-white px-2 py-1.5 rounded border border-slate-200 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition active:scale-95 flex items-center gap-1 group"
                                    >
                                        082256668107
                                        <DocumentDuplicateIcon className="w-3 h-3 text-slate-300 group-hover:text-blue-500"/>
                                    </button>
                                </div> */}
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-slate-400 italic">*Bisa juga bayar tunai langsung ke Admin</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-sm font-bold text-slate-700">Upload Bukti Transfer</label>
                        <input type="file" accept="image/*" ref={fileInputRef} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" onChange={handleUploadProof} disabled={uploading} />
                        {uploading && <p className="text-xs text-blue-500 animate-pulse font-bold text-center">Sedang mengupload...</p>}
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button onClick={() => setShowPayModal(false)} className="w-full py-3 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg transition border border-slate-300 bg-white">Tutup</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL TAMBAH & EDIT */}
      {isAdmin && showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Tambah Penghuni</h3>
                <form onSubmit={handleAddTenant} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3"><input type="text" placeholder="Kamar (A1)" value={newRoom} onChange={e=>setNewRoom(e.target.value)} className="w-full p-2 border rounded-lg" /><input type="number" placeholder="Harga" value={newPrice} onChange={e=>setNewPrice(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    <input type="text" placeholder="Nama Lengkap" value={newName} onChange={e=>setNewName(e.target.value)} className="w-full p-2 border rounded-lg" /><input type="text" placeholder="No HP / WA" value={newPhone} onChange={e=>setNewPhone(e.target.value)} className="w-full p-2 border rounded-lg" />
                    <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold">Batal</button><button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Simpan</button></div>
                </form>
            </div>
        </div>
      )}

      {isAdmin && showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in scale-95 duration-200">
              <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center"><h3 className="text-lg font-bold text-orange-800 flex items-center gap-2"><PencilSquareIcon className="w-5 h-5" /> Edit Data</h3><button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-orange-100 transition"><XMarkIcon className="w-6 h-6" /></button></div>
              <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-600">No Kamar</label><input type="text" value={editRoom} onChange={e=>setEditRoom(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-bold text-center uppercase" /></div><div><label className="text-xs font-bold text-slate-600">Harga</label><input type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" /></div></div>
                  <div><label className="text-xs font-bold text-slate-600">Nama Lengkap</label><input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" /></div><div><label className="text-xs font-bold text-slate-600">No HP / WA</label><input type="text" value={editPhone} onChange={e=>setEditPhone(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" /></div>
                  <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4"><button type="button" onClick={handleDeleteTenant} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 border border-red-200 flex items-center gap-2"><TrashIcon className="w-5 h-5" /> Hapus</button><button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-bold shadow-lg transition">Simpan Perubahan</button></div>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}

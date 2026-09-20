import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  TrashIcon, PencilSquareIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, 
  XMarkIcon, MagnifyingGlassIcon, InboxIcon, CalendarDaysIcon, ClockIcon, 
  ArrowDownTrayIcon, KeyIcon
} from '@heroicons/react/24/solid'
import * as XLSX from 'xlsx'

interface Transaction {
  id: number;
  created_at: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
}

export default function AdminInput() {
  const navigate = useNavigate()
  const getToday = () => new Date().toISOString().split('T')[0]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(getToday()) 
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [qty, setQty] = useState<number>(0)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState<'income' | 'expense'>('income')
  const [editQty, setEditQty] = useState(0)

  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => { if (type === 'income') setQty(0) }, [type])
  useEffect(() => { if (editType === 'income') setEditQty(0) }, [editType])

  const fetchTransactions = async () => {
    setLoading(true)
    const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
    const lastDay = new Date(filterYear, filterMonth, 0).getDate()
    const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${lastDay}`

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', `${endDate} 23:59:59`)
      .order('created_at', { ascending: false })

    if (!error && data) setTransactions(data)
    setLoading(false)
  }

  useEffect(() => { fetchTransactions() }, [filterMonth, filterYear])

  const handleEdit = (item: Transaction) => {
    setEditId(item.id)
    setEditDate(item.created_at.split('T')[0])
    setEditDesc(item.description)
    setEditAmount(item.amount.toString())
    setEditType(item.type)
    setEditQty(0) 
    setShowModal(true)
  }

  const handleCloseModal = () => { setShowModal(false); setEditId(null) }

  const handleSubmit = async (e: React.FormEvent, isEditMode: boolean = false) => {
    e.preventDefault()
    setLoading(true)

    const currentAmount = isEditMode ? editAmount : amount
    let currentDesc = isEditMode ? editDesc : desc
    const currentDate = isEditMode ? editDate : date
    const currentType = isEditMode ? editType : type
    const currentQty = isEditMode ? editQty : qty

    if (!currentAmount || !currentDesc || !currentDate) {
        setLoading(false); return alert("Lengkapi data!")
    }

    const inputHarga = parseInt(currentAmount)
    let finalAmount = inputHarga
    
    // SAFETY CHECK: Pastikan currentQty selalu valid number, jika NaN/Null maka jadikan 0
    const safeQty = Number.isNaN(currentQty) || !currentQty ? 0 : currentQty

    if (currentType === 'expense') {
        const multiplier = safeQty === 0 ? 1 : safeQty
        finalAmount = inputHarga * multiplier
        currentDesc = currentDesc.replace(/\s?x\d+$/, '');
        if (safeQty > 0) currentDesc = `${currentDesc} x${safeQty}`
    }

    const payload = { created_at: currentDate, description: currentDesc, amount: finalAmount, type: currentType }

    try {
        if (isEditMode && editId) {
            await supabase.from('transactions').update(payload).eq('id', editId)
            alert("Updated!"); handleCloseModal()
        } else {
            await supabase.from('transactions').insert([payload])
            alert("Tersimpan!"); 
            setDesc(''); setAmount(''); setQty(0)
        }
        fetchTransactions()
    } catch (error) { console.error(error); alert("Error!") } 
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!editId) return
    if (confirm("Hapus permanen?")) {
      await supabase.from('transactions').delete().eq('id', editId)
      handleCloseModal(); fetchTransactions()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false }) as any[]
        const formattedData = data.map((row) => ({
            created_at: row['Tanggal'] || getToday(), 
            description: row['Keterangan'] || '-',
            amount: parseInt(String(row['Nominal']).replace(/[^0-9]/g, '')) || 0,
            type: (row['Tipe']?.toLowerCase().includes('masuk')) ? 'income' : 'expense'
        }))

        if (confirm(`Proses ${formattedData.length} data? Data duplikat akan di-update.`)) {
            setLoading(true);
            let updatedCount = 0; let insertedCount = 0;
            try {
                for (const item of formattedData) {
                    const { data: existingData } = await supabase.from('transactions').select('id').eq('created_at', item.created_at).eq('description', item.description).maybeSingle()
                    if (existingData) { await supabase.from('transactions').update({ amount: item.amount, type: item.type }).eq('id', existingData.id); updatedCount++; } 
                    else { await supabase.from('transactions').insert([item]); insertedCount++; }
                }
                alert(`Selesai! Baru: ${insertedCount}, Update: ${updatedCount}`); fetchTransactions();
            } catch (error) { console.error(error); alert("Error import."); } 
            finally { setLoading(false) }
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  const handleExportData = async () => {
      if(!confirm("Download Laporan?")) return
      setLoading(true)
      try {
          const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false })
          const formatted = data?.map(item => ({ "Tanggal": item.created_at.split('T')[0], "Keterangan": item.description, "Jenis": item.type === 'income' ? 'Pemasukan' : 'Pengeluaran', "Nominal": item.amount }))
          const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted || []), "Laporan"); XLSX.writeFile(wb, `Laporan_${getToday()}.xlsx`)
      } catch (error) { console.error(error); alert("Gagal export.") } 
      finally { setLoading(false) }
  }

  const filteredTransactions = transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  const incomeList = filteredTransactions.filter(t => t.type === 'income')
  const expenseList = filteredTransactions.filter(t => t.type === 'expense')

  const AdminRow = ({ item, colorClass }: { item: Transaction, colorClass: string }) => {
    const dateObj = new Date(item.created_at)
    return (
      <tr className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group">
        <td className="px-2 md:px-4 py-3 w-14 md:w-20 align-top">
           <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1 w-10 h-10 md:w-12 md:h-12 text-slate-600 border border-slate-200">
              <span className="text-[9px] md:text-[10px] font-bold uppercase leading-none">{dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              <span className="text-base md:text-xl font-bold leading-none text-slate-800">{dateObj.getDate()}</span>
           </div>
        </td>
        <td className="px-1 md:px-2 py-4 align-middle"><p className="font-semibold text-slate-700 text-xs md:text-sm leading-snug line-clamp-2">{item.description}</p></td>
        <td className="px-2 md:px-4 py-4 align-middle">
           <div className={`flex items-baseline justify-end gap-0.5 md:gap-1 ${colorClass}`}>
               <span className="text-[10px] md:text-xs font-medium opacity-70">Rp</span>
               <span className="font-bold font-mono text-sm md:text-base">{item.amount.toLocaleString('id-ID')}</span>
           </div>
        </td>
        <td className="px-2 md:px-4 py-4 text-center align-middle w-12 md:w-16">
            <button onClick={() => handleEdit(item)} className="p-1.5 md:p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition shadow-sm border border-slate-200"><PencilSquareIcon className="w-3 h-3 md:w-4 md:h-4" /></button>
        </td>
      </tr>
    )
  }

  return (
    <div className="max-w-7xl mx-auto mt-6 px-2 md:px-4 pb-20">
      
      {/* HEADER & BUTTONS */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 mb-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">➕ Input Data</h2>
            
            <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => navigate('/manage-users')} className="bg-slate-800 text-white px-3 py-2 rounded-lg font-bold text-xs border border-slate-900 hover:bg-slate-900 flex items-center gap-2 shadow-sm transition">
                    <KeyIcon className="w-4 h-4 text-yellow-400" /> Kelola Akses Login
                </button>

                <div className="w-px h-8 bg-slate-300 mx-1 hidden md:block"></div>

                <button onClick={handleExportData} className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-bold text-xs border border-purple-200 hover:bg-purple-200 flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4"/><span className="hidden sm:inline">Export</span></button>
                <input type="file" accept=".csv, .xlsx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg font-bold text-xs border border-green-200 hover:bg-green-200">Import</button>
            </div>
        </div>
        
        {/* FORM INPUT TRANSAKSI */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
            <button type="button" onClick={() => setType('income')} className={`py-2 rounded-md text-sm font-bold transition ${type === 'income' ? 'bg-green-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Pemasukan</button>
            <button type="button" onClick={() => setType('expense')} className={`py-2 rounded-md text-sm font-bold transition ${type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Pengeluaran</button>
          </div>
          <div><label className="text-sm font-medium text-slate-600">Tanggal</label><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1"><label className="text-sm font-medium text-slate-600">Keterangan</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" placeholder={type === 'income' ? "Contoh: Uang Kost" : "Contoh: Beli Lampu"} /></div>
            <div className={`flex gap-3 transition-all ${type === 'expense' ? 'md:w-5/12' : 'md:w-1/3'}`}>
                <div className="flex-1"><label className="text-sm font-medium text-slate-600">{type === 'income' ? 'Nominal' : 'Harga Satuan'}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 outline-none" placeholder="0" /></div>
                {type === 'expense' && (
                    <div className="w-20 animate-in fade-in slide-in-from-right-4">
                        <label className="text-sm font-medium text-slate-600">Qty</label>
                        <input type="number" min="0" value={qty} onChange={(e) => setQty(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)} className="w-full p-3 rounded-lg border border-yellow-400 bg-yellow-50 text-center font-bold outline-none" />
                    </div>
                )}
            </div>
          </div>
          {type === 'expense' && (parseInt(amount)||0) > 0 && (
              <div className="text-right text-sm text-slate-500 bg-slate-50 p-2 rounded">
                  Total: <b>Rp {((parseInt(amount)||0) * (Number.isNaN(qty) || qty === 0 ? 1 : qty)).toLocaleString('id-ID')}</b>
                  {qty > 0 && !Number.isNaN(qty) && <span className="ml-2 text-xs text-orange-600">(x{qty})</span>}
              </div>
          )}
          <button disabled={loading} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold shadow-sm transition">{loading ? 'Menyimpan...' : 'Simpan Data Baru'}</button>
        </form>
      </div>

      {/* FILTER & TABLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2"><ClockIcon className="w-6 h-6 text-slate-500" /> Riwayat Input</h3>
        <div className="flex gap-2 w-full md:w-auto bg-white p-2 rounded-lg border shadow-sm items-center">
            <div className={`relative transition-all duration-300 ${isSearchOpen ? 'hidden md:block md:w-auto' : 'flex-1'}`}>
                <CalendarDaysIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="month" value={`${filterYear}-${String(filterMonth).padStart(2, '0')}`} onChange={(e) => { const val = e.target.value; if(val) { const [y, m] = val.split('-'); setFilterYear(parseInt(y)); setFilterMonth(parseInt(m)); } }} className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg outline-none cursor-pointer font-bold" />
            </div>
            <div className={`relative transition-all duration-300 flex items-center justify-end ${isSearchOpen ? 'flex-1' : 'w-auto'}`}>
                {isSearchOpen ? (
                    <div className="relative w-full animate-in fade-in slide-in-from-right-10">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input autoFocus type="text" placeholder="Cari..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg outline-none" />
                        <button onClick={() => {setIsSearchOpen(false); setSearchTerm('')}} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full p-0.5"><XMarkIcon className="w-4 h-4"/></button>
                    </div>
                ) : (
                    <button onClick={() => setIsSearchOpen(true)} className="p-2 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 hover:bg-blue-50 transition shadow-sm"><MagnifyingGlassIcon className="w-5 h-5" /></button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden h-fit">
            <div className="bg-green-50/50 p-4 border-b border-green-100 font-bold text-green-800 flex justify-between items-center"><span className="flex items-center gap-2"><ArrowTrendingUpIcon className="w-5 h-5"/> Pemasukan</span><span className="text-[10px] bg-white border border-green-200 text-green-700 px-2 py-1 rounded-full">{incomeList.length} Item</span></div>
            <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-left border-collapse"><tbody className="divide-y divide-slate-100">
                    {incomeList.length === 0 ? (<tr><td colSpan={4} className="p-10 text-center flex flex-col items-center text-slate-400"><InboxIcon className="w-10 h-10 mb-2 opacity-20"/>Data Kosong</td></tr>) : incomeList.map((t) => <AdminRow key={t.id} item={t} colorClass="text-green-600" />)}
                </tbody></table>
            </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden h-fit">
            <div className="bg-red-50/50 p-4 border-b border-red-100 font-bold text-red-800 flex justify-between items-center"><span className="flex items-center gap-2"><ArrowTrendingDownIcon className="w-5 h-5"/> Pengeluaran</span><span className="text-[10px] bg-white border border-red-200 text-red-700 px-2 py-1 rounded-full">{expenseList.length} Item</span></div>
            <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-left border-collapse"><tbody className="divide-y divide-slate-100">
                    {expenseList.length === 0 ? (<tr><td colSpan={4} className="p-10 text-center flex flex-col items-center text-slate-400"><InboxIcon className="w-10 h-10 mb-2 opacity-20"/>Data Kosong</td></tr>) : expenseList.map((t) => <AdminRow key={t.id} item={t} colorClass="text-red-600" />)}
                </tbody></table>
            </div>
        </div>
      </div>

      {/* MODAL EDIT */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden scale-100">
              <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center"><h3 className="text-lg font-bold text-orange-800 flex items-center gap-2"><PencilSquareIcon className="w-5 h-5" /> Edit Transaksi</h3><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-orange-100 transition"><XMarkIcon className="w-6 h-6" /></button></div>
              <form onSubmit={(e) => handleSubmit(e, true)} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                    <button type="button" onClick={() => setEditType('income')} className={`py-2 rounded-md text-sm font-bold transition ${editType === 'income' ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>Pemasukan</button>
                    <button type="button" onClick={() => setEditType('expense')} className={`py-2 rounded-md text-sm font-bold transition ${editType === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>Pengeluaran</button>
                  </div>
                  <div><label className="text-sm font-medium text-slate-600">Tanggal</label><input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" /></div>
                  <div className="flex gap-4">
                    <div className="flex-1"><label className="text-sm font-medium text-slate-600">Keterangan</label><input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" /></div>
                    <div className="flex-1"><label className="text-sm font-medium text-slate-600">Nominal Total</label><input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" /></div>
                  </div>
                  {editType === 'expense' && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between">
                        <label className="text-sm font-bold text-yellow-800">Ubah Qty?</label>
                        <input type="number" min="0" value={editQty} onChange={(e) => setEditQty(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)} className="w-20 p-2 text-center rounded border border-yellow-300 font-bold outline-none" />
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                      <button type="button" onClick={handleDelete} className="px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 border border-red-200 flex items-center gap-2"><TrashIcon className="w-5 h-5" /> Hapus</button>
                      <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-bold shadow-lg transition">{loading ? '...' : 'Simpan Perubahan'}</button>
                  </div>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}
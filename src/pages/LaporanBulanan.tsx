import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CalendarDaysIcon, PrinterIcon, InboxIcon } from '@heroicons/react/24/solid'

interface Transaction {
  id: number;
  created_at: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
}

export default function LaporanBulanan() {
  const getCurrentMonth = () => new Date().toISOString().slice(0, 7)
  
  // --- PERBAIKAN LOGIKA ADMIN (Sesuai Sistem Login Baru) ---
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
      const session = localStorage.getItem('kost_session')
      if (session) {
          const user = JSON.parse(session)
          setIsAdmin(user.role === 'admin')
      }
  }, [])
  // ---------------------------------------------------------

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth()) 

  const fetchTransactions = async () => {
    setLoading(true)
    const [year, month] = selectedMonth.split('-').map(Number)
    
    // Logika tanggal untuk Supabase filter
    // Awal bulan: Tanggal 1 bulan ini
    // Akhir bulan: Tanggal 1 bulan depan (supaya bisa pakai operator < less than)
    const startOfMonth = new Date(year, month - 1, 1).toISOString()
    const startOfNextMonth = new Date(year, month, 1).toISOString()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startOfMonth)
      .lt('created_at', startOfNextMonth)
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error:', error)
    else setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [selectedMonth])

  const handlePrint = () => { window.print() }

  const incomeList = transactions.filter((t) => t.type === 'income')
  const expenseList = transactions.filter((t) => t.type === 'expense')
  const totalIncome = incomeList.reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = expenseList.reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpense
  
  const formatRupiah = (num: number) => "Rp " + num.toLocaleString('id-ID')
  
  const [year, month] = selectedMonth.split('-').map(Number)
  const readableDate = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })

  // --- KOMPONEN BARIS TABEL ---
  const TransactionRow = ({ item, colorClass }: { item: Transaction, colorClass: string }) => {
    const dateObj = new Date(item.created_at)
    
    return (
      <tr className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group print:break-inside-avoid">
        <td className="px-2 md:px-4 py-3 w-14 md:w-20 align-top">
           <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1 w-10 h-10 md:w-12 md:h-12 text-slate-600 border border-slate-200">
              <span className="text-[9px] md:text-[10px] font-bold uppercase leading-none">{dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              <span className="text-base md:text-xl font-bold leading-none text-slate-800">{dateObj.getDate()}</span>
           </div>
        </td>
        <td className="px-1 md:px-2 py-4 align-middle">
           <p className="font-semibold text-slate-700 text-xs md:text-sm leading-snug line-clamp-2">{item.description}</p>
        </td>
        <td className={`px-2 md:px-4 py-4 align-middle ${colorClass}`}>
           <div className="flex items-baseline justify-end gap-0.5 md:gap-1">
               <span className="text-[10px] md:text-xs font-medium opacity-70">Rp</span>
               <span className="font-bold font-mono text-sm md:text-base">
                   {item.amount.toLocaleString('id-ID')}
               </span>
           </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="max-w-7xl mx-auto mt-6 px-2 md:px-4 pb-20 print:pb-0 print:max-w-none print:px-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 print:mb-4">
        <div className="w-full md:w-auto">
            <h2 className="text-2xl font-bold text-slate-800">Laporan Keuangan</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Periode: {readableDate}</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto bg-white p-2 rounded-lg border shadow-sm print:hidden">
            <div className="relative flex-1 md:flex-none">
                <CalendarDaysIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="pl-10 pr-3 py-2 w-full md:w-auto bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" 
                />
            </div>

            {isAdmin && (
                <button onClick={handlePrint} className="bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-700 shadow-sm font-bold text-sm flex items-center gap-2" title="Cetak PDF">
                    <PrinterIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Cetak</span>
                </button>
            )}
        </div>
      </div>

      {/* CARDS SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 print:grid-cols-3 print:gap-2">
        <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Pemasukan</p>
                    <p className="text-2xl font-bold text-slate-800">{formatRupiah(totalIncome)}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg text-green-600"><ArrowTrendingUpIcon className="w-6 h-6"/></div>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Pengeluaran</p>
                    <p className="text-2xl font-bold text-slate-800">{formatRupiah(totalExpense)}</p>
                </div>
                <div className="bg-red-100 p-2 rounded-lg text-red-600"><ArrowTrendingDownIcon className="w-6 h-6"/></div>
            </div>
        </div>

        {/* CARD SISA SALDO 
            style={{ printColorAdjust: 'exact' }} <- INI KUNCINYA AGAR WARNA BACKGROUND TERCETAK
        */}
        <div 
            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} 
            className={`p-5 rounded-xl shadow-md text-white relative overflow-hidden ${balance >= 0 ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-red-600'}`}
        >
            <div>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Sisa Saldo</p>
                <p className="text-3xl font-bold">{formatRupiah(balance)}</p>
            </div>
        </div>
      </div>

      {/* DUA TABEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4">
        
        {/* PEMASUKAN */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-slate-300 h-fit">
            <div className="bg-green-50/50 p-4 border-b border-green-100 flex justify-between items-center">
                <h3 className="font-bold text-green-800 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-5 h-5"/> Pemasukan
                </h3>
                <span className="text-[10px] font-bold bg-white border border-green-200 text-green-700 px-2 py-1 rounded-full shadow-sm">{incomeList.length} Transaksi</span>
            </div>
            
            <div className="overflow-auto max-h-[600px] print:max-h-none">
                <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                             <tr><td colSpan={3} className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : incomeList.length === 0 ? (
                            <tr><td colSpan={3} className="p-10 text-center flex flex-col items-center text-slate-400">
                                <InboxIcon className="w-10 h-10 mb-2 opacity-20"/> Belum ada data
                            </td></tr>
                        ) : (
                            incomeList.map((t) => <TransactionRow key={t.id} item={t} colorClass="text-green-600" />)
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* PENGELUARAN */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-slate-300 h-fit">
            <div className="bg-red-50/50 p-4 border-b border-red-100 flex justify-between items-center">
                <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <ArrowTrendingDownIcon className="w-5 h-5"/> Pengeluaran
                </h3>
                <span className="text-[10px] font-bold bg-white border border-red-200 text-red-700 px-2 py-1 rounded-full shadow-sm">{expenseList.length} Transaksi</span>
            </div>

            <div className="overflow-auto max-h-[600px] print:max-h-none">
                <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                          {loading ? (
                             <tr><td colSpan={3} className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : expenseList.length === 0 ? (
                            <tr><td colSpan={3} className="p-10 text-center flex flex-col items-center text-slate-400">
                                <InboxIcon className="w-10 h-10 mb-2 opacity-20"/> Belum ada data
                            </td></tr>
                        ) : (
                            expenseList.map((t) => <TransactionRow key={t.id} item={t} colorClass="text-red-600" />)
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>

      {/* FOOTER KHUSUS CETAK (Tanda Tangan) */}
      <div className="hidden print:flex justify-end mt-28 break-inside-avoid">
          <div className="text-center w-48">
              <p className="text-xs text-slate-500 mb-16">Pontianak, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
              <p className="font-bold text-slate-800 border-b border-slate-400 pb-1">Viktorius</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">Admin</p>
          </div>
      </div>
    </div>
  )
}
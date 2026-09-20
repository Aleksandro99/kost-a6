// import { useEffect, useState } from 'react'
// import { supabase } from '../supabaseClient'
// import { ClipboardDocumentListIcon, ShieldCheckIcon } from '@heroicons/react/24/solid'

// // 1. Kita definisikan tipe datanya dulu biar TS senang
// interface Rule {
//   id: number;
//   order_id: number;
//   description: string;
// }

// export default function Peraturan() {
//   // 2. Pasang tipe data di state
//   const [rules, setRules] = useState<Rule[]>([])
//   const [loading, setLoading] = useState(true)

//   // Ambil data dari database
//   useEffect(() => {
//     fetchRules()
//   }, [])

//   const fetchRules = async () => {
//     setLoading(true)
//     try {
//       const { data, error } = await supabase
//         .from('rules')
//         .select('*')
//         .order('order_id', { ascending: true }) // Urutkan berdasarkan No

//       if (error) throw error
//       // TS akan otomatis tahu data ini sesuai interface Rule
//       setRules(data || [])
//     } catch (error) {
//       console.error('Gagal mengambil peraturan:', error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="max-w-4xl mx-auto mt-6 px-4 pb-24">
      
//       {/* HEADER */}
//       <div className="mb-6">
//         <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
//           <ClipboardDocumentListIcon className="w-8 h-8 text-green-600"/> 
//           Tata Tertib Kost A6
//         </h1>
//         <p className="text-sm text-slate-500 mt-1">Demi kenyamanan dan keamanan bersama.</p>
//       </div>

//       {/* KONTEN PERATURAN */}
//       <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
//         {/* Banner Atas */}
//         <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-3">
//             <ShieldCheckIcon className="w-6 h-6 text-green-600 shrink-0" />
//             <h3 className="font-bold text-green-800 text-sm md:text-base">
//                 Setiap penghuni wajib mematuhi poin-poin berikut:
//             </h3>
//         </div>

//         {/* Daftar List Simpel */}
//         <div className="p-6">
//             {loading ? (
//                 <div className="text-center py-10 text-slate-400 animate-pulse">
//                     Memuat data...
//                 </div>
//             ) : (
//                 <div className="space-y-4">
//                     {rules.map((rule) => (
//                         <div key={rule.id} className="flex gap-4 items-start group">
//                             {/* Kolom NO */}
//                             <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 font-bold rounded-full group-hover:bg-green-100 group-hover:text-green-700 transition border border-slate-200">
//                                 {rule.order_id}
//                             </div>

//                             {/* Kolom ISI */}
//                             <div className="text-slate-700 text-sm md:text-base leading-relaxed pt-1">
//                                 {rule.description}
//                             </div>
//                         </div>
//                     ))}
                    
//                     {rules.length === 0 && (
//                         <p className="text-center text-slate-400 italic">Belum ada peraturan yang ditambahkan.</p>
//                     )}
//                 </div>
//             )}
//         </div>

//         {/* Footer */}
//         <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-500">
//             Peraturan berlaku untuk semua penghuni.
//         </div>

//       </div>
//     </div>
//   )
// }


import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ClipboardDocumentListIcon, ShieldCheckIcon, TrashIcon, PlusCircleIcon } from '@heroicons/react/24/solid'

// Definisi Tipe Data agar TypeScript tidak error
interface Rule {
  id: number;
  order_id: number;
  description: string;
}

export default function Peraturan() {
  const [rules, setRules] = useState<Rule[]>([]) // Pakai tipe Rule[]
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newRule, setNewRule] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem('kost_session')
    if (session) {
        const user = JSON.parse(session)
        setIsAdmin(user.role === 'admin')
    }
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .order('order_id', { ascending: true })

      if (error) throw error
      setRules(data || [])
    } catch (error) {
      console.error('Gagal mengambil peraturan:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRule = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newRule) return

      setAdding(true)
      const nextOrder = rules.length > 0 ? rules[rules.length - 1].order_id + 1 : 1

      const { error } = await supabase
        .from('rules')
        .insert({ order_id: nextOrder, description: newRule })

      if (!error) {
          setNewRule('')
          fetchRules()
      } else {
          alert('Gagal menambah peraturan')
      }
      setAdding(false)
  }

  const handleDeleteRule = async (id: number) => {
      if(!confirm("Hapus poin peraturan ini?")) return
      
      const { error } = await supabase.from('rules').delete().eq('id', id)
      if (!error) fetchRules()
  }

  return (
    //<div className="max-w-7xl mx-auto mt-6 px-4 pb-24">
    <div className="max-w-8xl mx-auto mt-6 px-2 md:px-4 pb-20">
        
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <ClipboardDocumentListIcon className="w-8 h-8 text-green-600"/> 
          Tata Tertib Kost A6
        </h1>
        {/* <p className="text-slate-900 text-sm md:text-base leading-relaxed">PERATURAN INI DIBUAT UNTUK KEBAIKAN SEMUA AGGOTA KOS A6, MAKA MOHON DIBACA HINGGA SELESAI DAN DITAATI.<br/> TERIMAKASIH</p> */}
      </div>

      {isAdmin && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 mb-6 animate-in fade-in">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <PlusCircleIcon className="w-5 h-5 text-blue-600"/> Tambah Peraturan Baru
              </h3>
              <form onSubmit={handleAddRule} className="flex gap-2">
                  <input type="text" value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="Tulis peraturan baru disini..." className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                  <button type="submit" disabled={adding} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
                      {adding ? '...' : 'Simpan'}
                  </button>
              </form>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-green-600 shrink-0" />
            <h3 className="font-bold text-green-800 text-sm md:text-base">Setiap penghuni wajib mematuhi poin-poin berikut:</h3>
        </div>
        <div className="p-6">
            {loading ? (
                <div className="text-center py-10 text-slate-400 animate-pulse">Memuat data...</div>
            ) : (
                <div className="space-y-4">
                    {rules.map((rule, index) => (
                        <div key={rule.id} className="flex gap-4 items-start group">
                            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 font-bold rounded-full group-hover:bg-green-100 group-hover:text-green-700 transition border border-slate-200">
                                {index + 1}
                            </div>
                            <div className="flex-1 pt-1">
                                <div className="flex justify-between items-start gap-4">
                                    <p className="text-slate-900 text-sm md:text-base leading-relaxed">{rule.description}</p>
                                    {isAdmin && (
                                        <button onClick={() => handleDeleteRule(rule.id)} className="text-red-500 p-1" title="Hapus Aturan">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {rules.length === 0 && <p className="text-center text-slate-400 italic">Belum ada peraturan.</p>}
                </div>
            )}
            
        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-500">Peraturan berlaku untuk semua penghuni.</div>
      </div>
    </div>
  )
}
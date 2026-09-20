import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
  TrashIcon, 
  UserPlusIcon, 
  UserGroupIcon, 
  ArrowLeftIcon,
  KeyIcon 
} from '@heroicons/react/24/solid'
import { useNavigate } from 'react-router-dom'

interface AllowedUser {
  phone: string;
  name: string;
  role: 'admin' | 'resident';
}

export default function ManageUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [newUserPhone, setNewUserPhone] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'resident'>('resident')
  const [loading, setLoading] = useState(false)

  // Fetch Data
  const fetchUsers = async () => {
      setLoading(true)
      const { data } = await supabase.from('allowed_users').select('*').order('name', { ascending: true })
      setUsers(data || [])
      setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  // Tambah User
  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newUserPhone || !newUserName) return alert("Isi nama & no HP!")
      
      setLoading(true)
      let cleanPhone = newUserPhone.trim().replace(/\D/g, '')
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1)
      else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone

      const { error } = await supabase.from('allowed_users').insert({ phone: cleanPhone, name: newUserName, role: newUserRole })

      if (error) alert("Gagal! Nomor mungkin sudah ada.")
      else {
          alert("✅ User berhasil ditambahkan!")
          setNewUserPhone(''); setNewUserName('')
          fetchUsers()
      }
      setLoading(false)
  }

  // Hapus User
  const handleDeleteUser = async (phone: string) => {
      if(!confirm("Hapus akses user ini?")) return
      setLoading(true)
      await supabase.from('allowed_users').delete().eq('phone', phone)
      fetchUsers()
      setLoading(false)
  }

  return (
    // UBAH DISINI: px-2 untuk HP (biar lebih lebar), md:px-4 untuk Laptop
    <div className="max-w-4xl mx-auto mt-6 px-2 md:px-4 pb-20">
      
      {/* HEADER + BACK BUTTON */}
      <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <button onClick={() => navigate('/admin')} className="bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition">
              <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <KeyIcon className="w-5 h-5 md:w-6 md:h-6 text-yellow-500"/> Kelola Akses Login
              </h1>
              <p className="text-xs md:text-sm text-slate-500">Daftar orang yang diizinkan masuk aplikasi</p>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          
          {/* KOLOM KIRI: FORM TAMBAH */}
          <div className="md:col-span-1">
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg border border-slate-200 sticky top-24">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                      <UserPlusIcon className="w-5 h-5 text-blue-600"/> Tambah Baru
                  </h3>
                  <form onSubmit={handleAddUser} className="space-y-3 md:space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Nama Lengkap</label>
                          <input type="text" placeholder="Contoh: Budi Santoso" value={newUserName} onChange={e=>setNewUserName(e.target.value)} className="w-full p-3 text-sm border rounded-lg bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" required />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Nomor HP (WhatsApp)</label>
                          <input type="text" placeholder="08xxxxxxxxxx" value={newUserPhone} onChange={e=>setNewUserPhone(e.target.value)} className="w-full p-3 text-sm border rounded-lg bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" required />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Role / Peran</label>
                          <select value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)} className="w-full p-3 text-sm border rounded-lg bg-slate-50 focus:bg-white outline-none cursor-pointer">
                              <option value="resident">Penghuni (Anak Kost)</option>
                              <option value="admin">Admin (Pemilik)</option>
                          </select>
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md transition active:scale-95 disabled:opacity-50">
                          {loading ? 'Menyimpan...' : 'Tambah User'}
                      </button>
                  </form>
              </div>
          </div>

          {/* KOLOM KANAN: TABEL LIST */}
          <div className="md:col-span-2">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2">
                          <UserGroupIcon className="w-5 h-5 text-slate-500"/> Daftar User Terdaftar
                      </h3>
                      <span className="text-xs font-bold bg-white px-2 py-1 rounded border text-slate-500">Total: {users.length}</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-white text-slate-500 text-xs uppercase font-bold border-b">
                              <tr>
                                  <th className="p-3 md:p-4">Nama</th>
                                  <th className="p-3 md:p-4">No HP</th>
                                  <th className="p-3 md:p-4 text-center">Role</th>
                                  <th className="p-3 md:p-4 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {users.map((user) => (
                                  <tr key={user.phone} className="hover:bg-blue-50/50 transition">
                                      <td className="p-3 md:p-4 font-bold text-slate-700">{user.name}</td>
                                      <td className="p-3 md:p-4 text-slate-500 font-mono text-xs md:text-sm">{user.phone}</td>
                                      <td className="p-3 md:p-4 text-center">
                                          <span className={`text-[10px] px-2 md:px-3 py-1 rounded-full font-bold uppercase ${user.role==='admin' ? 'bg-slate-800 text-white' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                              {user.role}
                                          </span>
                                      </td>
                                      <td className="p-3 md:p-4 text-center">
                                          <button onClick={() => handleDeleteUser(user.phone)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition" title="Hapus Akses">
                                              <TrashIcon className="w-5 h-5"/>
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {users.length === 0 && !loading && (
                                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Belum ada data user.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>

      </div>
    </div>
  )
}
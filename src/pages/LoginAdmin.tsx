import { useState } from 'react'
import { supabase } from '../supabaseClient'
// TAMBAHAN: Import EyeIcon dan EyeSlashIcon
import { LockClosedIcon, ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'
import { useNavigate } from 'react-router-dom'

interface LoginProps {
  onSuccess: () => void;
}

export default function LoginAdmin({ onSuccess }: LoginProps) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // STATE BARU: Untuk toggle lihat password
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(false)
    setLoading(true)

    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single()

        if (error || !data) {
            console.error("Gagal mengambil config:", error)
            alert("Terjadi kesalahan sistem/koneksi.")
            setLoading(false)
            return
        }

        if (password === data.value) {
            onSuccess()
        } else {
            setError(true)
            setPassword('')
        }

    } catch (err) {
        console.error(err)
        setError(true)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-sm w-full text-center">
        
        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
            <LockClosedIcon className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">Area Terbatas</h2>
        <p className="text-slate-500 text-sm mb-6">Masukkan PIN Admin untuk masuk.</p>

        <form onSubmit={handleLogin} className="space-y-4">
            
            {/* WRAPPER INPUT AGAR BISA POSISIKAN ICON MATA */}
            <div className="relative">
                <input 
                    // LOGIKA TIPE INPUT
                    type={showPassword ? "text" : "password"} 
                    placeholder="PIN / Password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value)
                        setError(false)
                    }}
                    disabled={loading}
                    // TAMBAHAN: pr-12 (padding right) biar teks gak nabrak icon mata
                    className="w-full text-center text-lg p-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none transition disabled:bg-slate-100"
                    autoFocus
                />
                
                {/* TOMBOL MATA (POSISI ABSOLUTE DI KANAN) */}
                <button
                    type="button" // PENTING: Biar gak submit form pas diklik
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                >
                    {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                        <EyeIcon className="w-5 h-5" />
                    )}
                </button>
            </div>
            
            {error && (
                <p className="text-red-500 text-sm font-bold animate-pulse">
                    Password Salah!
                </p>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-md active:scale-95 disabled:bg-slate-400 disabled:scale-100"
            >
                {loading ? 'Memeriksa...' : 'Masuk Admin'}
            </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100">
            <button 
                onClick={() => navigate('/')} 
                className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 text-sm font-bold w-full transition"
            >
                <ArrowLeftIcon className="w-4 h-4" />
                Kembali ke Laporan
            </button>
        </div>

      </div>
    </div>
  )
}
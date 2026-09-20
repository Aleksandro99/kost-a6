import { useState } from 'react';
import { supabase } from '../supabaseClient'; 
import { LockClosedIcon, PhoneIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

interface LoginProps {
  onLoginSuccess: (sessionData: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State untuk tampilan sukses
  const [successUser, setSuccessUser] = useState<{ name: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    let cleanPhone = phoneNumber.trim().replace(/\D/g, ''); 
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

    try {
        const { data, error } = await supabase
            .from('allowed_users')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle(); 

        if (error) throw error;

        if (!data) {
            setErrorMsg('Nomor HP belum terdaftar! Hubungi Admin.');
            setLoading(false);
            return;
        }

        // Simpan Session
        localStorage.setItem('kost_session', JSON.stringify(data));

        // Tampilkan Animasi Sukses
        setSuccessUser(data);

        // Jeda 2 detik (sesuai durasi animasi loading bar)
        setTimeout(() => {
            onLoginSuccess(data);
        }, 2000);

    } catch (err: any) {
        setErrorMsg('Terjadi kesalahan sistem.');
        setLoading(false);
    }
  };

  // --- TAMPILAN ANIMASI SUKSES (SPLASH SCREEN) ---
  if (successUser) {
      return (
        // Gunakan fixed inset-0 z-50 agar menutupi seluruh layar
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-600 text-white px-4 animate-in fade-in duration-500">
            
            {/* Animasi Icon/Logo Memantul */}
            <div className="bg-white p-2 rounded-full shadow-2xl mb-8 animate-bounce">
                <img 
                    src="/icon-a6.png" 
                    alt="User" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-green-100"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                />
                <CheckCircleIcon className="w-24 h-24 text-green-600 hidden" id="fallback-icon"/>
            </div>

            {/* Teks Selamat Datang dengan Efek Slide Up */}
            <h2 className="text-3xl font-extrabold mb-2 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100 text-center">
                Login Berhasil!
            </h2>
            <p className="text-lg text-green-100 mb-10 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-200 text-center">
                Selamat datang kembali, <span className="font-bold text-white">{successUser.name}</span>
            </p>

            {/* Loading Bar Container */}
            <div className="w-64 h-1.5 bg-green-800 rounded-full overflow-hidden relative">
                {/* Garis Putih yang berjalan (Lihat style di bawah) */}
                <div className="h-full bg-white rounded-full animate-loading-bar"></div>
            </div>
            
            <p className="text-xs text-green-200 mt-3 animate-pulse">
                Mengalihkan ke Dashboard...
            </p>

            {/* CSS KHUSUS UNTUK LOADING BAR */}
            <style>{`
                @keyframes loading {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
                .animate-loading-bar {
                    animation: loading 2s ease-in-out forwards;
                }
            `}</style>
        </div>
      )
  }

  // --- TAMPILAN FORM LOGIN BIASA ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 pb-10">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 relative overflow-hidden">
        {/* <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-400 to-green-600"></div> */}

        <div className="text-center mb-8 flex flex-col items-center">
            <img 
                src="/icon-a6.png" 
                alt="Logo Kost A6" 
                className="w-24 h-24 object-contain mb-4 hover:scale-105 transition duration-300 drop-shadow-sm rounded-full"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = document.getElementById('logo-fallback');
                    if(fallback) fallback.style.display = 'flex';
                }}
            />
            <div id="logo-fallback" className="hidden w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4 text-green-600 font-bold text-2xl">
                A6
            </div>

            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">KOST A6</h1>
            <p className="text-slate-500 text-sm mt-1">Aplikasi Manajemen Kost</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Nomor WhatsApp</label>
                <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-green-500 transition">
                        <PhoneIcon className="h-5 w-5" />
                    </span>
                    <input 
                        type="tel" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="Contoh: 0812..."
                        required
                        disabled={loading}
                    />
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <LockClosedIcon className="w-4 h-4 shrink-0" />
                    {errorMsg}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 active:scale-95 transition shadow-lg shadow-green-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
                {loading ? 'Memeriksa...' : 'Masuk Aplikasi'}
            </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8">
           &copy; {new Date().getFullYear()} Kost A6 Pontianak
        </p>
      </div>
    </div>
  );
}
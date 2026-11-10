import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { 
  DocumentChartBarIcon, 
  HomeModernIcon, 
  PencilSquareIcon, 
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
  SparklesIcon
} from '@heroicons/react/24/solid'

// Import Halaman
import Login from './pages/Login'
import AdminInput from './pages/AdminInput'
import LaporanBulanan from './pages/LaporanBulanan'
import StatusKamar from './pages/StatusKamar'
import Piket from './pages/Piket'

// PERBAIKAN 1: Tambahkan 's' di akhir (ManageUsers) sesuaikan dengan nama file asli
import ManageUsers from './pages/ManageUsers' 

// PERBAIKAN 2: Pastikan file Peraturan sudah di-rename jadi .tsx
import Peraturan from './pages/Peraturan' 

interface UserSession {
  phone: string;
  name: string;
  role: 'admin' | 'resident';
}

function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem('kost_session');
    if (savedSession) {
        setUser(JSON.parse(savedSession));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData: UserSession) => {
    setUser(userData);
    localStorage.setItem('kost_session', JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (confirm("Keluar dari aplikasi?")) {
        setUser(null);
        localStorage.removeItem('kost_session');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-green-600">Loading...</div>;

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-sans text-slate-800 pb-24 md:pb-0 print:pb-0 print:bg-white">
        
        {/* === HEADER (LAPTOP) === */}
        <nav className="hidden md:block print:hidden bg-green-600 text-white border-b border-green-700 sticky top-0 z-50 shadow-md">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-xl font-extrabold tracking-wide flex items-center gap-2 shadow-sm">
                💰 KOST A6
              </h1>
              
              <div className="flex gap-2 items-center">
                {/* Laporan hanya untuk admin */}
                {user.role === 'admin' && <DesktopLink to="/laporan" label="Laporan" />}
                <DesktopLink to="/status-kamar" label="Status Kamar" />
                <DesktopLink to="/piket" label="Piket" />
                <DesktopLink to="/peraturan" label="Tata Tertib" />
                
                {user.role === 'admin' && (
                   <DesktopLink to="/admin" label="Input" />
                )}

                <div className="w-px h-6 bg-green-400 mx-2"></div>

                <div className="flex items-center gap-3 ml-2">
                    <span className="text-sm font-medium text-green-100 text-right leading-tight">
                        Halo, {user.name} <br/> 
                        <span className="text-[10px] opacity-70 uppercase tracking-wider">{user.role === 'admin' ? 'ADMIN' : 'PENGHUNI'}</span>
                    </span>
                    <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 p-2 rounded-lg transition shadow-sm" title="Keluar">
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-white" />
                    </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* === HEADER (HP) === */}
        <header className="md:hidden print:hidden bg-green-600 text-white sticky top-0 z-40 px-4 h-14 flex items-center justify-between shadow-md relative">
            <h1 className="text-lg font-extrabold tracking-widest flex items-center gap-2">
                💰 KOST A6
            </h1>
            <div className="flex items-center gap-2">
                <span className="text-xs text-right text-green-100">
                    {user.name.split(' ')[0]} <br/>
                    <span className="text-[9px] bg-green-700 px-1 rounded opacity-80">{user.role === 'admin' ? 'ADMIN' : 'USER'}</span>
                </span>
                <button onClick={handleLogout} className="bg-red-600 p-1.5 rounded-lg active:scale-95 transition">
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                </button>
            </div>
        </header>

        {/* === ROUTING === */}
        <main className="p-4 md:p-8 print:p-0">
          <Routes>
            {/* Beranda: admin -> Laporan, penghuni -> Status Kamar */}
            <Route path="/" element={<Navigate to={user.role === 'admin' ? '/laporan' : '/status-kamar'} replace />} />
            <Route
                path="/laporan"
                element={user.role === 'admin' ? <LaporanBulanan /> : <Navigate to="/status-kamar" replace />}
            />
            <Route path="/status-kamar" element={<StatusKamar />} />
            <Route path="/status-kost" element={<Navigate to="/status-kamar" replace />} />
            <Route path="/piket" element={<Navigate to="/piket/sampah" replace />} />
            <Route path="/piket/:tab" element={<Piket />} />
            <Route path="/peraturan" element={<Peraturan />} />
            
            <Route 
                path="/admin" 
                element={user.role === 'admin' ? <AdminInput /> : <Navigate to="/status-kamar" replace />} 
            />

            <Route 
                path="/manage-users" 
                element={user.role === 'admin' ? <ManageUsers /> : <Navigate to="/status-kamar" replace />} 
            />

             <Route path="/login" element={<Navigate to="/" />} />
          </Routes>
        </main>

        {/* === NAVIGASI BAWAH (HP) === */}
        <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
           <div className="flex justify-around items-center h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              {user.role === 'admin' && (
                <MobileLink to="/laporan" label="Laporan">
                  <DocumentChartBarIcon className="w-6 h-6 mb-0.5" />
                </MobileLink>
              )}

              <MobileLink to="/status-kamar" label="Kamar">
                <HomeModernIcon className="w-6 h-6 mb-0.5" />
              </MobileLink>

              <MobileLink to="/piket" label="Piket">
                <SparklesIcon className="w-6 h-6 mb-0.5" />
              </MobileLink>

              <MobileLink to="/peraturan" label="Aturan">
                <BookOpenIcon className="w-6 h-6 mb-0.5" />
              </MobileLink>

              {user.role === 'admin' && (
                  <MobileLink to="/admin" label="Admin">
                    <PencilSquareIcon className="w-6 h-6 mb-0.5" />
                  </MobileLink>
              )}
           </div>
        </nav>

      </div>
    </BrowserRouter>
  )
}

// --- Helper Components ---
function DesktopLink({ to, label }: { to: string, label: string }) {
  const location = useLocation()
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/') || (to === '/admin' && location.pathname === '/manage-users')
  
  return (
    <Link 
      to={to} 
      className={`px-5 py-2 rounded-lg text-sm font-bold transition ${
        isActive ? 'bg-white text-green-700 shadow-sm' : 'text-green-100 hover:bg-green-700 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )
}

function MobileLink({ to, label, children }: { to: string, label: string, children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/') || (to === '/admin' && location.pathname === '/manage-users')
  
  return (
    <Link 
      to={to} 
      className={`flex flex-1 flex-col items-center justify-center h-full transition active:scale-95 ${
        isActive ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {children}
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  )
}

export default App

import { Link, Navigate, useParams } from 'react-router-dom'
import { TrashIcon, SparklesIcon } from '@heroicons/react/24/solid'
import PiketSampah from './PiketSampah'
import PiketWC from './PiketWC'

export default function Piket() {
  const { tab } = useParams()
  if (tab !== 'sampah' && tab !== 'wc') return <Navigate to="/piket/sampah" replace />

  const tabs = [
    { key: 'sampah', label: 'Piket Buang Sampah', short: 'Buang Sampah', Icon: TrashIcon },
    { key: 'wc', label: 'Piket WC', short: 'WC', Icon: SparklesIcon },
  ] as const

  return (
    <div className="max-w-7xl mx-auto mt-6 px-2 md:px-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">🧹 Piket</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Jadwal piket kost A6</p>
      </div>

      {/* SUB MENU */}
      <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm mb-6 max-w-md">
        {tabs.map(({ key, label, short, Icon }) => (
          <Link
            key={key}
            to={`/piket/${key}`}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
              tab === key ? 'bg-green-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </Link>
        ))}
      </div>

      {tab === 'sampah' ? <PiketSampah /> : <PiketWC />}
    </div>
  )
}


import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { Package, TrendingUp, ArrowUpRight, Briefcase, Plus, Tag, FileText, AlertTriangle } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'

const CATEGORY_LABELS = {
  camera: 'Camera',
  lens: 'Obiettivo',
  drone: 'Drone',
  audio: 'Audio',
  lighting: 'Illuminazione',
  support: 'Supporto',
  accessory: 'Accessorio',
  altro: 'Altro',
}

const STATUS_STYLES = {
  planned: 'bg-slate-700 text-slate-300',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
  incomplete: 'bg-red-500/20 text-red-300',
}
const STATUS_LABELS = {
  planned: 'Pianificato',
  out: 'In uscita',
  returned: 'Rientrato',
  incomplete: 'Incompleto',
}

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: equipment },
    { data: sets },
    { data: setItemsOut },
    { count: setsTotal },
  ] = await Promise.all([
    supabase.from('equipment').select('*'),
    supabase.from('sets').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('set_items').select('*').eq('status', 'out'),
    supabase.from('sets').select('*', { count: 'exact', head: true }),
  ])

  const totalValue = equipment?.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0) ?? 0
  const outCount = setItemsOut?.length ?? 0

  const now = new Date()
  const maintenanceItems = equipment?.filter((e) => {
    if (!e.last_checked_at) return true
    return differenceInDays(now, new Date(e.last_checked_at)) > 90
  }) ?? []

  const categoryCounts = equipment?.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1
    return acc
  }, {}) ?? {}

  const stats = [
    { label: 'Attrezzature totali', value: equipment?.length ?? 0, icon: Package, color: 'blue' },
    { label: 'Valore di mercato', value: `€ ${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, icon: TrendingUp, color: 'emerald' },
    { label: 'Item attualmente fuori', value: outCount, icon: ArrowUpRight, color: 'amber' },
    { label: 'Set creati', value: setsTotal ?? 0, icon: Briefcase, color: 'purple' },
  ]

  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
        </p>
      </div>

      {/* Maintenance alert */}
      {maintenanceItems.length > 0 && (
        <Link
          href="/inventario"
          className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 hover:bg-red-500/15 transition"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">
              {maintenanceItems.length} attrezzatur{maintenanceItems.length === 1 ? 'a' : 'e'} da controllare
            </p>
            <p className="text-xs text-red-400/70 mt-0.5 truncate">
              {maintenanceItems.slice(0, 3).map((e) => e.name).join(', ')}
              {maintenanceItems.length > 3 ? ` e altre ${maintenanceItems.length - 3}…` : ''}
            </p>
          </div>
          <span className="text-xs text-red-400 flex-shrink-0">Vedi →</span>
        </Link>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
            <div className={`inline-flex p-2 rounded-lg border ${colorMap[stat.color]} mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent sets */}
        <div className="bg-slate-800 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Ultimi set</h2>
            <Link href="/set" className="text-xs text-blue-400 hover:text-blue-300 transition">Vedi tutti →</Link>
          </div>
          <div className="divide-y divide-slate-700/50">
            {sets?.length === 0 && (
              <p className="text-sm text-slate-500 px-5 py-6 text-center">Nessun set creato ancora</p>
            )}
            {sets?.map((set) => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/30 transition group"
              >
                <div>
                  <div className="text-sm font-medium text-white group-hover:text-blue-300 transition">
                    {set.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {set.job_date ? format(new Date(set.job_date), 'd MMM yyyy', { locale: it }) : 'Data non impostata'}
                    {set.location ? ` · ${set.location}` : ''}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[set.status] || 'bg-slate-700 text-slate-300'}`}>
                  {STATUS_LABELS[set.status] || set.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-slate-800 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Categorie</h2>
            <Link href="/inventario" className="text-xs text-blue-400 hover:text-blue-300 transition">Inventario →</Link>
          </div>
          <div className="p-5 space-y-3">
            {Object.entries(categoryCounts).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Nessuna attrezzatura registrata</p>
            )}
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-24 truncate">{CATEGORY_LABELS[cat] || cat}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round((count / (equipment?.length || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-300 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Azioni rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link href="/inventario" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Plus className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition">Nuova attrezzatura</span>
          </Link>
          <Link href="/set" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Briefcase className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition">Nuovo set</span>
          </Link>
          <Link href="/etichette" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Tag className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition">Stampa etichette</span>
          </Link>
          <Link href="/report" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-slate-700 text-slate-400"><FileText className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition">Report assicurativo</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

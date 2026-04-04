import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  Package, TrendingUp, ArrowUpRight, Briefcase, Plus, Tag, FileText,
  AlertTriangle, Calendar, MapPin, Clock,
} from 'lucide-react'
import { format, differenceInDays, isAfter, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

const STATUS_STYLES = {
  planned: 'bg-muted text-muted-foreground',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
  incomplete: 'bg-red-500/20 text-red-300',
}
const STATUS_LABELS = {
  planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto',
}

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = startOfDay(new Date())

  const [
    { data: equipment },
    { data: activeSets },
    { data: upcomingSets },
    { data: recentSets },
    { data: incompleteSets },
    { data: setItemsOut },
    { count: setsTotal },
  ] = await Promise.all([
    supabase.from('equipment').select('*'),
    // Sets currently out
    supabase.from('sets').select('*, set_items(count)').eq('status', 'out').order('job_date', { ascending: true }),
    // Upcoming planned sets with a future job date
    supabase.from('sets').select('*, set_items(count)').eq('status', 'planned')
      .gte('job_date', today.toISOString()).order('job_date', { ascending: true }).limit(5),
    // Recent sets (last 5, any status, for fallback)
    supabase.from('sets').select('*, set_items(count)').order('created_at', { ascending: false }).limit(5),
    // Incomplete sets
    supabase.from('sets').select('id, name').eq('status', 'incomplete'),
    supabase.from('set_items').select('equipment_id').eq('status', 'out'),
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

  // Left panel: upcoming if any, else recent
  const leftSets = upcomingSets?.length > 0 ? upcomingSets : (recentSets || [])
  const leftTitle = upcomingSets?.length > 0 ? 'Prossimi lavori' : 'Ultimi set'

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(now, "EEEE d MMMM yyyy", { locale: it })}
        </p>
      </div>

      {/* Active sets alert */}
      {activeSets && activeSets.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20">
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              {activeSets.length} set attualmente fuori
            </span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {activeSets.map((set) => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-amber-500/5 transition group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium group-hover:text-amber-300 transition truncate">{set.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {set.job_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(set.job_date), 'd MMM', { locale: it })}
                      </span>
                    )}
                    {set.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {set.location}
                      </span>
                    )}
                    <span>{set.set_items?.[0]?.count ?? 0} item</span>
                  </div>
                </div>
                <span className="text-xs text-amber-400 flex-shrink-0">Gestisci →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete sets alert */}
      {incompleteSets && incompleteSets.length > 0 && (
        <Link
          href="/set"
          className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 hover:bg-red-500/15 transition"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">
              {incompleteSets.length} set con rientro incompleto
            </p>
            <p className="text-xs text-red-400/70 mt-0.5 truncate">
              {incompleteSets.slice(0, 3).map((s) => s.name).join(', ')}
              {incompleteSets.length > 3 ? ` e altri ${incompleteSets.length - 3}…` : ''}
            </p>
          </div>
          <span className="text-xs text-red-400 flex-shrink-0">Vedi →</span>
        </Link>
      )}

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
          <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
            <div className={`inline-flex p-2 rounded-lg border ${colorMap[stat.color]} mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming / recent sets */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              {upcomingSets?.length > 0
                ? <Calendar className="w-4 h-4 text-primary" />
                : <Clock className="w-4 h-4 text-muted-foreground" />
              }
              <h2 className="text-sm font-semibold">{leftTitle}</h2>
            </div>
            <Link href="/set" className="text-xs text-primary hover:underline">Vedi tutti →</Link>
          </div>
          <div className="divide-y divide-border/50">
            {leftSets.length === 0 && (
              <p className="text-sm text-muted-foreground px-5 py-6 text-center">Nessun set pianificato</p>
            )}
            {leftSets.map((set) => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium group-hover:text-primary transition truncate">{set.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {set.job_date
                      ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(set.job_date), 'd MMM yyyy', { locale: it })}</span>
                      : <span>Data non impostata</span>
                    }
                    {set.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{set.location}</span>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ml-3 ${STATUS_STYLES[set.status] || 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[set.status] || set.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Categorie</h2>
            <Link href="/inventario" className="text-xs text-primary hover:underline">Inventario →</Link>
          </div>
          <div className="p-5 space-y-3">
            {Object.entries(categoryCounts).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna attrezzatura registrata</p>
            )}
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 truncate">{CATEGORY_LABELS[cat] || cat}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round((count / (equipment?.length || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Azioni rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link href="/inventario" className="flex items-center gap-3 bg-card hover:bg-muted/30 border border-border rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Plus className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition">Nuova attrezzatura</span>
          </Link>
          <Link href="/set" className="flex items-center gap-3 bg-card hover:bg-muted/30 border border-border rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Briefcase className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition">Nuovo set</span>
          </Link>
          <Link href="/etichette" className="flex items-center gap-3 bg-card hover:bg-muted/30 border border-border rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Tag className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition">Stampa etichette</span>
          </Link>
          <Link href="/report" className="flex items-center gap-3 bg-card hover:bg-muted/30 border border-border rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground"><FileText className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition">Report assicurativo</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

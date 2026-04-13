import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  Package, TrendingUp, ArrowUpRight, Briefcase, Plus, Tag, FileText,
  AlertTriangle, Calendar, MapPin, Clock, LogOut, LogIn, Activity, QrCode, BatteryLow, Wrench,
} from 'lucide-react'
import { format, differenceInDays, isAfter, startOfDay, endOfDay, addDays, isSameDay, parseISO, isWithinInterval } from 'date-fns'
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

  const now = new Date()
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)

  const [
    { data: equipment },
    { data: activeSets },
    { data: upcomingSets },
    { data: recentSets },
    { data: incompleteSets },
    { data: setItemsOut },
    { count: setsTotal },
    { data: todaySets },
    { data: overdueSets },
    { data: recentActivity },
    { data: weekSets },
  ] = await Promise.all([
    supabase.from('equipment').select('*'),
    // Sets currently out
    supabase.from('sets').select('*, set_items(count)').eq('status', 'out').order('job_date', { ascending: true }),
    // Upcoming planned sets with a future job date (tomorrow onwards)
    supabase.from('sets').select('*, set_items(count)').eq('status', 'planned')
      .gt('job_date', todayEnd.toISOString()).order('job_date', { ascending: true }).limit(5),
    // Recent sets (last 5, any status, for fallback)
    supabase.from('sets').select('*, set_items(count)').order('created_at', { ascending: false }).limit(5),
    // Incomplete sets
    supabase.from('sets').select('id, name').eq('status', 'incomplete'),
    supabase.from('set_items').select('equipment_id').eq('status', 'out'),
    supabase.from('sets').select('*', { count: 'exact', head: true }),
    // Sets with job_date = today
    supabase.from('sets').select('*, set_items(count)')
      .gte('job_date', today.toISOString())
      .lte('job_date', todayEnd.toISOString())
      .order('created_at', { ascending: false }),
    // Overdue: still 'out' but job_date is in the past
    supabase.from('sets').select('id, name, job_date, location')
      .eq('status', 'out')
      .lt('job_date', today.toISOString())
      .order('job_date', { ascending: true }),
    // Recent activity feed
    supabase.from('movement_log')
      .select('id, action, created_at, equipment(name), sets(name), profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(6),
    // Sets in the next 7 days — include sets that START before the window but END within it
    supabase.from('sets').select('id, name, job_date, end_date, status, location')
      .or(`job_date.lte.${endOfDay(addDays(now, 7)).toISOString()},end_date.gte.${todayEnd.toISOString()}`)
      .not('job_date', 'is', null)
      .order('job_date', { ascending: true }),
  ])

  const activeEquipment = equipment?.filter((e) => e.condition !== 'sold') ?? []
  const totalValue = activeEquipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)
  const outCount = setItemsOut?.length ?? 0

  const maintenanceItems = activeEquipment.filter((e) => {
    if (!e.last_checked_at) return true
    return differenceInDays(now, new Date(e.last_checked_at)) > 90
  })

  const lowBatteryItems = activeEquipment.filter((e) => e.battery_status === 'low' && e.condition !== 'retired')
  const repairItems = activeEquipment.filter((e) => e.condition === 'repair')

  const batteryBreakdown = activeEquipment.reduce((acc, e) => {
    if (e.condition === 'retired') return acc
    const status = e.battery_status || 'na'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
  const hasBatteryData = Object.values(batteryBreakdown).some((v) => v > 0) && batteryBreakdown.na !== Object.values(batteryBreakdown).reduce((s, v) => s + v, 0)

  const categoryCounts = activeEquipment.reduce((acc, e) => {
    const key = e.category || 'altro'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  // 7-day calendar strip: build days array
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i))

  // Left panel: upcoming if any, else recent — sorted by priority (out/planned first)
  const leftSetsRaw = upcomingSets?.length > 0 ? upcomingSets : (recentSets || [])
  const statusPriority = { out: 0, planned: 1, incomplete: 2, returned: 3 }
  const leftSets = [...leftSetsRaw].sort((a, b) => (statusPriority[a.status] ?? 2) - (statusPriority[b.status] ?? 2))
  const leftTitle = upcomingSets?.length > 0 ? 'Prossimi lavori' : 'Ultimi set'
  const allReturned = leftSets.length > 0 && leftSets.every((s) => s.status === 'returned')

  const stats = [
    { label: 'Attrezzature totali', value: activeEquipment.length, icon: Package, color: 'blue', href: '/inventario' },
    { label: 'Valore di mercato', value: `€ ${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, icon: TrendingUp, color: 'emerald', href: '/ammortamento' },
    { label: 'Attrezzature fuori', value: outCount, icon: ArrowUpRight, color: 'amber', href: '/prestiti' },
    { label: 'Set totali', value: setsTotal ?? 0, icon: Briefcase, color: 'purple', href: '/set' },
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
          {format(now, "EEEE d MMMM yyyy", { locale: it }).replace(/^./, (c) => c.toUpperCase())}
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

      {/* Overdue sets alert */}
      {overdueSets && overdueSets.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-500/20">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
              {overdueSets.length} set in ritardo — non ancora rientrati
            </span>
          </div>
          <div className="divide-y divide-orange-500/10">
            {overdueSets.map((set) => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-orange-500/5 transition group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium group-hover:text-orange-300 transition truncate">{set.name}</div>
                  {set.job_date && (
                    <div className="text-xs text-orange-400/70 mt-0.5">
                      Previsto il {format(new Date(set.job_date), 'd MMM yyyy', { locale: it })} — {differenceInDays(now, new Date(set.job_date))} giorni fa
                    </div>
                  )}
                </div>
                <span className="text-xs text-orange-400 flex-shrink-0 ml-3">Gestisci →</span>
              </Link>
            ))}
          </div>
        </div>
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

      {/* Repair items alert */}
      {repairItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              {repairItems.length} {repairItems.length === 1 ? 'item in riparazione' : 'item in riparazione'}
            </span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {repairItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href={`/scan/${item.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-500/5 transition group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium group-hover:text-amber-300 transition truncate block">{item.name}</span>
                  {(item.brand || item.model) && (
                    <span className="text-xs text-muted-foreground">{[item.brand, item.model].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
                <span className="text-xs text-amber-400 flex-shrink-0">Segna riparato →</span>
              </Link>
            ))}
            {repairItems.length > 4 && (
              <Link href="/inventario" className="block px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition text-center">
                e altri {repairItems.length - 4} item →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Low battery alert */}
      {lowBatteryItems.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/20">
            <BatteryLow className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">
              {lowBatteryItems.length} {lowBatteryItems.length === 1 ? 'item con batteria scarica' : 'item con batteria scarica'}
            </span>
          </div>
          <div className="divide-y divide-red-500/10">
            {lowBatteryItems.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/scan/${item.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/5 transition group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium group-hover:text-red-300 transition truncate block">{item.name}</span>
                  {(item.brand || item.model) && (
                    <span className="text-xs text-muted-foreground truncate block">{[item.brand, item.model].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
                <span className="text-xs text-red-400 flex-shrink-0">Aggiorna →</span>
              </Link>
            ))}
            {lowBatteryItems.length > 5 && (
              <Link href="/inventario" className="block px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition text-center">
                e altri {lowBatteryItems.length - 5} item →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Today's sets */}
      {todaySets && todaySets.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Oggi — {format(now, 'd MMMM', { locale: it })}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{todaySets.length} set</span>
          </div>
          <div className="divide-y divide-border/50">
            {todaySets.map((set) => {
              const isOut = set.status === 'out'
              const isReturned = set.status === 'returned'
              return (
                <Link
                  key={set.id}
                  href={`/set/${set.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group"
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${isOut ? 'bg-amber-500/10 text-amber-400' : isReturned ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                    {isOut ? <LogOut className="w-3.5 h-3.5" /> : isReturned ? <LogIn className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium group-hover:text-primary transition truncate">{set.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {set.set_items?.[0]?.count ?? 0} item
                      {set.location && <span className="ml-2 flex-shrink-0">{set.location}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[set.status] || 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[set.status] || set.status}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-day ahead strip */}
      {weekDays.some((day) => (weekSets || []).some((s) => {
        if (!s.job_date) return false
        const start = parseISO(s.job_date)
        const end   = s.end_date ? parseISO(s.end_date) : start
        return isWithinInterval(day, { start, end })
      })) && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prossimi 7 giorni</span>
          </div>
          <div className="grid grid-cols-7 divide-x divide-border/50">
            {weekDays.map((day) => {
              const daySets = (weekSets || []).filter((s) => {
                if (!s.job_date) return false
                const start = parseISO(s.job_date)
                const end   = s.end_date ? parseISO(s.end_date) : start
                return isWithinInterval(day, { start, end })
              })
              return (
                <div key={day.toISOString()} className={`py-2.5 text-center min-w-0 overflow-hidden ${daySets.length > 0 ? 'bg-primary/5' : ''}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                    {format(day, 'EEE', { locale: it })}
                  </div>
                  <div className="mt-0.5 px-1 flex justify-center">
                    {isSameDay(day, today) ? (
                      <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-semibold">{format(day, 'd')}</span>
                    ) : (
                      <span className={`text-sm font-semibold ${daySets.length > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{format(day, 'd')}</span>
                    )}
                  </div>
                  {daySets.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5 px-0.5">
                      {daySets.map((s) => {
                        const STATUS_PILL = { planned: '#2563eb', out: '#f59e0b', returned: '#059669', incomplete: '#dc2626' }
                        const color   = STATUS_PILL[s.status] || '#2563eb'

                        return (
                          <Link key={s.id} href={`/set/${s.id}`} title={s.name}>
                            <div
                              style={{ backgroundColor: color }}
                              className="h-6 flex items-center overflow-hidden rounded px-1"
                            >
                              <span className="text-[10px] font-semibold text-white truncate leading-none">{s.name}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 transition">
            <div className={`inline-flex p-2 rounded-lg border ${colorMap[stat.color]} mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Azioni rapide</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
          <Link href="/manutenzione" className="flex items-center gap-3 bg-card hover:bg-muted/30 border border-border rounded-xl p-4 transition group">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400"><AlertTriangle className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition">Manutenzione</span>
          </Link>
        </div>
      </div>

      {/* Battery status breakdown */}
      {hasBatteryData && (
        <div className="bg-card rounded-xl border border-border px-5 py-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stato batterie</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'charged', label: (c) => c === 1 ? 'Carica' : 'Cariche', color: 'text-emerald-400', bar: 'bg-emerald-400' },
              { key: 'charging', label: () => 'In carica', color: 'text-primary', bar: 'bg-primary' },
              { key: 'low', label: (c) => c === 1 ? 'Scarica' : 'Scariche', color: 'text-red-400', bar: 'bg-red-400' },
              { key: 'na', label: () => 'Non rilevato', color: 'text-muted-foreground', bar: 'bg-muted-foreground/30' },
            ].map(({ key, label, color, bar }) => {
              const count = batteryBreakdown[key] || 0
              const total = Object.values(batteryBreakdown).reduce((s, v) => s + v, 0)
              return (
                <div key={key} className="text-center">
                  <div className={`text-xl font-bold ${color}`}>{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 mb-1.5">{label(count)}</div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden relative">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: total > 0 ? `${Math.round((count / total) * 100)}%` : '0%' }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{count}/{total}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
            {allReturned && (
              <p className="text-xs text-muted-foreground px-5 pt-3 pb-1 text-center">Nessun set attivo al momento</p>
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
                    style={{ width: `${Math.round((count / (activeEquipment.length || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right tabular-nums">{count}/{activeEquipment.length}</span>
              </div>
            ))}
            {(categoryCounts.altro || 0) > activeEquipment.length / 2 && (
              <p className="text-xs text-muted-foreground/70 mt-2">Consiglio: categorizza meglio le attrezzature per una vista più utile</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recentActivity && recentActivity.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Attività recente</h2>
            <Link href="/storico" className="text-xs text-primary hover:underline">Storico completo →</Link>
          </div>
          <div className="divide-y divide-border/50">
            {recentActivity.map((m) => {
              const isOut = m.action === 'checkout'
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${isOut ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {isOut ? <ArrowUpRight className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.equipment?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isOut ? 'Uscita' : 'Rientro'}
                      {m.sets?.name ? ` · ${m.sets.name}` : ''}
                      {(m.profiles?.full_name || m.profiles?.email) ? ` · ${m.profiles.full_name || m.profiles.email}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(m.created_at), 'd MMM HH:mm', { locale: it })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

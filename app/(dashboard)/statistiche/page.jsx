'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import {
  BarChart2, Loader2, Package, Briefcase, TrendingUp, ArrowUpRight, Tag, Users,
} from 'lucide-react'
import Link from 'next/link'
import { format, subDays, eachDayOfInterval, parseISO, startOfWeek, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const PERIOD_OPTIONS = [
  { value: '30', label: 'Ultimi 30 giorni' },
  { value: '90', label: 'Ultimi 90 giorni' },
  { value: '180', label: 'Ultimi 6 mesi' },
  { value: '365', label: 'Ultimo anno' },
]

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className={`inline-flex p-2 rounded-lg border mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function StatistichePage() {
  const [period, setPeriod] = useState('30')
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState([])
  const [equipment, setEquipment] = useState([])
  const [sets, setSets] = useState([])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const supabase = getSupabase()
      const since = subDays(new Date(), parseInt(period)).toISOString()

      const [mvRes, eqRes, setRes] = await Promise.all([
        supabase.from('movement_log')
          .select('id, action, created_at, equipment_id, set_id, user_id, equipment(name), sets(name), profiles(full_name)')
          .gte('created_at', since)
          .order('created_at'),
        supabase.from('equipment').select('id, name, category'),
        supabase.from('sets').select('id, name, status, job_date'),
      ])

      setMovements(mvRes.data || [])
      setEquipment(eqRes.data || [])
      setSets(setRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const checkouts = movements.filter((m) => m.action === 'checkout')
  const checkins = movements.filter((m) => m.action === 'checkin')

  // Daily activity chart
  const days = eachDayOfInterval({ start: subDays(new Date(), parseInt(period) - 1), end: new Date() })
  const groupBy = parseInt(period) <= 30 ? 1 : parseInt(period) <= 90 ? 7 : 30
  const buckets = []
  for (let i = 0; i < days.length; i += groupBy) {
    const bucketDays = days.slice(i, i + groupBy)
    const label = groupBy === 1
      ? format(bucketDays[0], 'd MMM', { locale: it })
      : groupBy === 7
      ? format(bucketDays[0], 'd MMM', { locale: it })
      : format(bucketDays[0], 'MMM yyyy', { locale: it })
    const start = bucketDays[0]
    const end = bucketDays[bucketDays.length - 1]
    const inRange = (m) => {
      const d = new Date(m.created_at)
      return d >= start && d <= new Date(end.getTime() + 86400000)
    }
    buckets.push({
      label,
      Uscite: movements.filter((m) => m.action === 'checkout' && inRange(m)).length,
      Rientri: movements.filter((m) => m.action === 'checkin' && inRange(m)).length,
    })
  }

  // Top equipment by checkout count
  const eqCounts = {}
  checkouts.forEach((m) => {
    if (!m.equipment_id) return
    const name = m.equipment?.name || m.equipment_id
    eqCounts[name] = (eqCounts[name] || 0) + 1
  })
  const topEquipment = Object.entries(eqCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, Utilizzi: count }))

  // Top sets by item movements
  const setCounts = {}
  movements.forEach((m) => {
    if (!m.set_id) return
    const name = m.sets?.name || m.set_id
    setCounts[name] = (setCounts[name] || 0) + 1
  })
  const topSets = Object.entries(setCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const totalMovements = movements.length
  const uniqueEquipment = new Set(checkouts.map((m) => m.equipment_id)).size
  const activeSets = sets.filter((s) => s.status === 'out').length
  const usedIds = new Set(checkouts.map((m) => m.equipment_id))
  const idleEquipment = equipment.filter((e) => !usedIds.has(e.id))

  const CATEGORY_LABELS = {
    camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
    lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
  }
  // Per-operator leaderboard
  const operatorCounts = {}
  movements.forEach((m) => {
    const name = m.profiles?.full_name
    if (!name) return
    if (!operatorCounts[name]) operatorCounts[name] = { checkouts: 0, checkins: 0 }
    if (m.action === 'checkout') operatorCounts[name].checkouts++
    else if (m.action === 'checkin') operatorCounts[name].checkins++
  })
  const operatorLeaderboard = Object.entries(operatorCounts)
    .map(([name, counts]) => ({ name, total: counts.checkouts + counts.checkins, ...counts }))
    .sort((a, b) => b.total - a.total)
  const maxOpTotal = operatorLeaderboard[0]?.total || 1

  const catUsage = Object.entries(
    checkouts.reduce((acc, m) => {
      const eq = equipment.find((e) => e.id === m.equipment_id)
      const cat = eq?.category || 'altro'
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])
  const maxCatCount = catUsage[0]?.[1] || 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Statistiche</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Utilizzo e movimentazione attrezzatura</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-auto min-w-[170px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Movimenti totali"
          value={totalMovements}
          sub={`${checkouts.length} uscite · ${checkins.length} rientri`}
          icon={BarChart2}
          color="bg-blue-500/10 text-blue-400 border-blue-500/20"
        />
        <StatCard
          label="Attrezzature usate"
          value={uniqueEquipment}
          sub={`su ${equipment.length} totali`}
          icon={Package}
          color="bg-violet-500/10 text-violet-400 border-violet-500/20"
        />
        <StatCard
          label="Set attivi ora"
          value={activeSets}
          sub="stato: In uscita"
          icon={Briefcase}
          color="bg-amber-500/10 text-amber-400 border-amber-500/20"
        />
        <StatCard
          label="Tasso utilizzo"
          value={equipment.length > 0 ? `${Math.round((uniqueEquipment / equipment.length) * 100)}%` : '—'}
          sub="% attrezzatura mossa"
          icon={TrendingUp}
          color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        />
      </div>

      {/* Activity chart */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold mb-4">Attività nel periodo</h2>
        {buckets.every((b) => b.Uscite === 0 && b.Rientri === 0) ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Nessun movimento nel periodo selezionato
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buckets} barSize={groupBy === 1 ? 10 : 20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Uscite" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Rientri" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-amber-500 inline-block" />
            Uscite
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" />
            Rientri
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top equipment */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Attrezzatura più utilizzata</h2>
          {topEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topEquipment} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Utilizzi" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top sets */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Set con più movimenti</h2>
          {topSets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun dato</p>
          ) : (
            <div className="space-y-3">
              {topSets.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round((count / topSets[0][1]) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category usage + idle equipment */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Category breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Utilizzo per categoria</h2>
          </div>
          {catUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun dato</p>
          ) : (
            <div className="space-y-3">
              {catUsage.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 truncate flex-shrink-0">
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.round((count / maxCatCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Idle equipment */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Attrezzatura inutilizzata</h2>
            <span className="text-xs text-muted-foreground">{idleEquipment.length} item</span>
          </div>
          {idleEquipment.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-sm text-emerald-400">Tutta l&apos;attrezzatura è stata usata nel periodo</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {idleEquipment.map((e) => (
                <Link
                  key={e.id}
                  href={`/scan/${e.id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition group"
                >
                  <span className="text-sm truncate group-hover:text-primary transition">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                    {CATEGORY_LABELS[e.category] || e.category || '—'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operator leaderboard */}
      {operatorLeaderboard.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Operatori più attivi</h2>
          </div>
          <div className="space-y-3">
            {operatorLeaderboard.slice(0, 8).map((op, i) => (
              <div key={op.name} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-5 text-right flex-shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{op.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{op.total} mov.</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-primary'}`}
                      style={{ width: `${Math.round((op.total / maxOpTotal) * 100)}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-amber-400">{op.checkouts} uscite</span>
                    <span className="text-[10px] text-emerald-400">{op.checkins} rientri</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

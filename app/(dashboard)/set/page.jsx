'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  Plus, Briefcase, MapPin, Calendar, Loader2, ChevronRight, Copy,
  ChevronLeft, List, LayoutGrid, Search, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const STATUS_BADGE = {
  planned: 'bg-muted text-muted-foreground border-border',
  out: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  returned: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  incomplete: 'bg-red-500/15 text-red-300 border-red-500/20',
}
const STATUS_DOT = {
  planned: 'bg-muted-foreground',
  out: 'bg-amber-400',
  returned: 'bg-emerald-400',
  incomplete: 'bg-red-400',
}
const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

const EMPTY_SET = { name: '', job_date: '', location: '', notes: '', status: 'planned' }

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function CalendarView({ sets, onNewSet }) {
  const [month, setMonth] = useState(new Date())

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const setsWithDate = sets.filter((s) => s.job_date)

  function setsOnDay(day) {
    return setsWithDate.filter((s) => isSameDay(parseISO(s.job_date), day))
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold capitalize">
          {format(month, 'MMMM yyyy', { locale: it })}
        </h2>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
          {days.map((day) => {
            const daySets = setsOnDay(day)
            const inMonth = isSameMonth(day, month)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[72px] p-1.5 ${inMonth ? '' : 'opacity-30'}`}
              >
                <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium mb-1 rounded-full ${
                  today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {daySets.slice(0, 2).map((s) => (
                    <Link
                      key={s.id}
                      href={`/set/${s.id}`}
                      className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight hover:bg-muted/50 transition truncate group"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] || 'bg-muted-foreground'}`} />
                      <span className="truncate group-hover:text-primary transition">{s.name}</span>
                    </Link>
                  ))}
                  {daySets.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{daySets.length - 2} altri</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[k]}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Sets without date */}
      {sets.filter((s) => !s.job_date).length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senza data</h3>
          </div>
          <div className="divide-y divide-border/50">
            {sets.filter((s) => !s.job_date).map((set) => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition group"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[set.status] || 'bg-muted-foreground'}`} />
                <span className="flex-1 text-sm font-medium group-hover:text-primary transition truncate">{set.name}</span>
                <Badge variant="outline" className={`text-xs border flex-shrink-0 ${STATUS_BADGE[set.status]}`}>
                  {STATUS_LABELS[set.status] || set.status}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SetPage() {
  const router = useRouter()
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SET)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicating, setDuplicating] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { fetchSets() }, [])

  async function fetchSets() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('sets')
      .select('*, set_items(count, equipment(market_value))')
      .order('job_date', { ascending: true, nullsFirst: false })
    setSets(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('sets').insert({
      name: form.name,
      job_date: form.job_date || null,
      location: form.location || null,
      notes: form.notes || null,
      status: 'planned',
    })
    if (err) {
      setError(err.message)
    } else {
      setShowModal(false)
      setForm(EMPTY_SET)
      fetchSets()
      toast.success(`Set "${form.name}" creato`)
    }
    setSaving(false)
  }

  async function duplicateSet(set, e) {
    e.preventDefault()
    e.stopPropagation()
    setDuplicating(set.id)
    const supabase = getSupabase()

    const { data: newSet, error: setErr } = await supabase
      .from('sets')
      .insert({
        name: `${set.name} (copia)`,
        location: set.location || null,
        notes: set.notes || null,
        status: 'planned',
      })
      .select()
      .single()

    if (setErr || !newSet) { setDuplicating(null); return }

    const { data: sourceItems } = await supabase
      .from('set_items')
      .select('equipment_id')
      .eq('set_id', set.id)

    if (sourceItems?.length > 0) {
      await supabase.from('set_items').insert(
        sourceItems.map((i) => ({ set_id: newSet.id, equipment_id: i.equipment_id, status: 'planned' }))
      )
    }

    setDuplicating(null)
    toast.success(`"${set.name}" duplicato`)
    router.push(`/set/${newSet.id}`)
  }

  const displaySets = sets.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Set Manager</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {displaySets.length}{displaySets.length !== sets.length ? ` / ${sets.length}` : ''} set
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition ${view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`p-1.5 rounded-md transition ${view === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista calendario"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuovo set</span>
          </Button>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o location…"
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-1 border border-border/50 h-8">
          {[
            { value: 'all', label: 'Tutti' },
            { value: 'planned', label: 'Pianificati' },
            { value: 'out', label: 'In uscita' },
            { value: 'returned', label: 'Rientrati' },
            { value: 'incomplete', label: 'Incompleti' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap ${
                statusFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sets.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm mb-4">Nessun set creato ancora</p>
          <Button size="sm" onClick={() => setShowModal(true)}>Crea il primo set</Button>
        </div>
      ) : view === 'calendar' ? (
        <CalendarView sets={displaySets} onNewSet={() => setShowModal(true)} />
      ) : displaySets.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">Nessun set trovato</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displaySets.map((set) => (
            <Link
              key={set.id}
              href={`/set/${set.id}`}
              className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition group"
            >
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold group-hover:text-primary transition truncate">{set.name}</span>
                  <Badge variant="outline" className={`text-xs border ${STATUS_BADGE[set.status] || 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[set.status] || set.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {set.job_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(set.job_date), 'd MMM yyyy', { locale: it })}
                    </span>
                  )}
                  {set.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {set.location}
                    </span>
                  )}
                  <span>{set.set_items?.[0]?.count ?? 0} item</span>
                  {(() => {
                    const val = (set.set_items || []).reduce((s, si) => s + (parseFloat(si.equipment?.market_value) || 0), 0)
                    return val > 0 ? <span>€ {val.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</span> : null
                  })()}
                </div>
              </div>
              <button
                onClick={(e) => duplicateSet(set, e)}
                disabled={duplicating === set.id}
                title="Duplica set"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0 disabled:opacity-40"
              >
                {duplicating === set.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Copy className="w-4 h-4" />
                }
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setForm(EMPTY_SET); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuovo set</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Nome set *</Label>
              <Input
                id="set-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Es. Shooting Milano 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data lavoro</Label>
                <Input type="date" value={form.job_date} onChange={(e) => setForm((f) => ({ ...f, job_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Es. Studio Roma" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Note sul set…" className="resize-none" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Crea set
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

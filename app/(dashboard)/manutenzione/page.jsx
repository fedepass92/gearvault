'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import {
  Wrench, CheckCircle2, AlertTriangle, Clock, Loader2, ChevronRight,
  Filter, ArrowUpRight, CheckCheck, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

function getStatus(last_checked_at) {
  if (!last_checked_at) return 'never'
  const days = differenceInDays(new Date(), new Date(last_checked_at))
  if (days > 90) return 'overdue'
  if (days > 60) return 'soon'
  return 'ok'
}

const STATUS_META = {
  never:   { label: 'Mai controllato',  color: 'bg-red-500/15 text-red-300 border-red-500/20',     dot: 'bg-red-400',     order: 0 },
  overdue: { label: 'Scaduto',          color: 'bg-red-500/15 text-red-300 border-red-500/20',     dot: 'bg-red-400',     order: 1 },
  soon:    { label: 'In scadenza',      color: 'bg-amber-500/15 text-amber-300 border-amber-500/20', dot: 'bg-amber-400', order: 2 },
  ok:      { label: 'OK',               color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-400', order: 3 },
}

const GROUP_HEADINGS = {
  never:   { title: 'Mai controllato',  icon: AlertTriangle, iconClass: 'text-red-400' },
  overdue: { title: 'Controllo scaduto (>90 giorni)', icon: AlertTriangle, iconClass: 'text-red-400' },
  soon:    { title: 'In scadenza (61–90 giorni)',      icon: Clock,         iconClass: 'text-amber-400' },
  ok:      { title: 'Controllato',                     icon: CheckCircle2,  iconClass: 'text-emerald-400' },
}

function InlineMark({ item, onMarked }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function mark(e) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    const supabase = getSupabase()
    const now = new Date().toISOString()
    await supabase.from('equipment').update({ last_checked_at: now }).eq('id', item.id)
    setLoading(false)
    setDone(true)
    onMarked(item.id, now)
    toast.success(`${item.name} — controllo registrato`)
  }

  if (done) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Fatto
      </span>
    )
  }

  return (
    <button
      onClick={mark}
      disabled={loading}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50 flex-shrink-0"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
      Segna
    </button>
  )
}

function exportCSV(equipment) {
  const headers = ['Nome', 'Marca', 'Modello', 'Seriale', 'Categoria', 'Stato', 'Ultimo controllo', 'Giorni fa']
  const rows = equipment.map((e) => {
    const days = e.last_checked_at ? differenceInDays(new Date(), new Date(e.last_checked_at)) : null
    return [
      e.name || '',
      e.brand || '',
      e.model || '',
      e.serial_number || '',
      CATEGORY_LABELS[e.category] || e.category || '',
      getStatus(e.last_checked_at) === 'never' ? 'Mai controllato' : getStatus(e.last_checked_at) === 'overdue' ? 'Scaduto' : getStatus(e.last_checked_at) === 'soon' ? 'In scadenza' : 'OK',
      e.last_checked_at ? format(new Date(e.last_checked_at), 'dd/MM/yyyy') : '',
      days !== null ? String(days) : '',
    ]
  })
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `manutenzione-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ManutenzonePage() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('equipment')
        .select('id, name, brand, model, serial_number, category, condition, last_checked_at')
        .neq('condition', 'retired')
        .order('name')
      setEquipment(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const [bulkMarking, setBulkMarking] = useState(null) // status key being marked

  const handleMarked = useCallback((id, now) => {
    setEquipment((prev) =>
      prev.map((e) => e.id === id ? { ...e, last_checked_at: now } : e)
    )
  }, [])

  async function markAllInGroup(items) {
    setBulkMarking(true)
    const supabase = getSupabase()
    const now = new Date().toISOString()
    const ids = items.map((e) => e.id)
    await supabase.from('equipment').update({ last_checked_at: now }).in('id', ids)
    setEquipment((prev) => prev.map((e) => ids.includes(e.id) ? { ...e, last_checked_at: now } : e))
    setBulkMarking(null)
    toast.success(`${ids.length} item segnati come controllati`)
  }

  const filtered = categoryFilter === 'all'
    ? equipment
    : equipment.filter((e) => e.category === categoryFilter)

  const grouped = ['never', 'overdue', 'soon', 'ok'].map((status) => ({
    status,
    items: filtered.filter((e) => getStatus(e.last_checked_at) === status),
  })).filter((g) => g.items.length > 0)

  const counts = {
    overdue: filtered.filter((e) => ['never', 'overdue'].includes(getStatus(e.last_checked_at))).length,
    soon: filtered.filter((e) => getStatus(e.last_checked_at) === 'soon').length,
    ok: filtered.filter((e) => getStatus(e.last_checked_at) === 'ok').length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Manutenzione</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {counts.overdue > 0
              ? `${counts.overdue} item da controllare · ${counts.soon} in scadenza · ${counts.ok} OK`
              : counts.soon > 0
              ? `${counts.soon} in scadenza · ${counts.ok} OK`
              : `Tutto in ordine · ${counts.ok} item controllati`
            }
          </p>
        </div>
        {!loading && equipment.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => exportCSV(filtered)}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        )}
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          {counts.overdue > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-300">{counts.overdue} da controllare</span>
            </div>
          )}
          {counts.soon > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">{counts.soon} in scadenza</span>
            </div>
          )}
          {counts.ok > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">{counts.ok} OK</span>
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-auto min-w-[180px] h-8 text-sm">
          <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Tutte le categorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le categorie</SelectItem>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ status, items }) => {
            const { title, icon: Icon, iconClass } = GROUP_HEADINGS[status]
            return (
              <div key={status} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <Icon className={`w-4 h-4 ${iconClass}`} />
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">{title}</h2>
                  <span className="text-xs text-muted-foreground mr-2">{items.length}</span>
                  {(status === 'never' || status === 'overdue') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 gap-1"
                      disabled={!!bulkMarking}
                      onClick={() => markAllInGroup(items)}
                    >
                      {bulkMarking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                      Segna tutti
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((item) => {
                    const days = item.last_checked_at
                      ? differenceInDays(new Date(), new Date(item.last_checked_at))
                      : null
                    const isCheckedToday = item.last_checked_at &&
                      new Date(item.last_checked_at).toDateString() === new Date().toDateString()

                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link href={`/scan/${item.id}`} className="text-sm font-medium truncate hover:text-primary transition">
                              {item.name}
                            </Link>
                            {item.category && (
                              <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">
                                {CATEGORY_LABELS[item.category] || item.category}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.brand && <span>{item.brand} · </span>}
                            {item.last_checked_at
                              ? isCheckedToday
                                ? <span className="text-emerald-400">Controllato oggi</span>
                                : <span>Ultimo controllo: {format(new Date(item.last_checked_at), 'd MMM yyyy', { locale: it })} ({days}g fa)</span>
                              : <span className="text-red-400">Nessun controllo registrato</span>
                            }
                          </div>
                        </div>
                        {isCheckedToday ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Oggi
                          </span>
                        ) : (
                          <InlineMark item={item} onMarked={handleMarked} />
                        )}
                        <Link
                          href={`/scan/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0"
                          title="Apri scheda"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {grouped.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Wrench className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Nessuna attrezzatura trovata</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
  startOfWeek, endOfWeek, parseISO, isWithinInterval,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Briefcase, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'

const STATUS_CONFIG = {
  planned:    { label: 'Pianificato', bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-400' },
  out:        { label: 'In uscita',   bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  returned:   { label: 'Rientrato',   bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  incomplete: { label: 'Incompleto',  bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-400' },
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function CalendarioPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null) // Date
  const [selectedSets, setSelectedSets] = useState([]) // sets on selected day
  const [detailSet, setDetailSet] = useState(null)

  useEffect(() => {
    async function fetchSets() {
      setLoading(true)
      const supabase = getSupabase()
      // Fetch sets with a job_date in ±3 months of currentMonth
      const from = format(subMonths(currentMonth, 1), 'yyyy-MM-01')
      const to   = format(addMonths(currentMonth, 2), 'yyyy-MM-01')
      const { data } = await supabase
        .from('sets')
        .select('id, name, status, job_date, end_date, location, notes')
        .or(`job_date.gte.${from},end_date.gte.${from}`)
        .order('job_date')
      setSets((data || []).filter((s) => s.job_date))
      setLoading(false)
    }
    fetchSets()
  }, [currentMonth])

  // Build calendar grid (Mon-Sun weeks)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const allDays    = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function setsOnDay(date) {
    return sets.filter((s) => {
      if (!s.job_date) return false
      const start = parseISO(s.job_date)
      const end   = s.end_date ? parseISO(s.end_date) : start
      return isWithinInterval(date, { start, end })
    })
  }

  function isRangeStart(set, date) {
    return set.job_date && isSameDay(parseISO(set.job_date), date)
  }

  function isRangeEnd(set, date) {
    return set.end_date && isSameDay(parseISO(set.end_date), date)
  }

  function isMiddleOfRange(set, date) {
    return set.end_date && !isRangeStart(set, date) && !isRangeEnd(set, date)
  }

  function handleDayClick(date, daySets) {
    if (daySets.length === 0) return
    setSelectedDay(date)
    setSelectedSets(daySets)
  }

  // Counts by status for the legend — include sets that overlap the current month
  const monthSets = sets.filter((s) => {
    if (!s.job_date) return false
    const start = parseISO(s.job_date)
    const end   = s.end_date ? parseISO(s.end_date) : start
    return isSameMonth(start, currentMonth) || isSameMonth(end, currentMonth) ||
      (start <= monthStart && end >= monthEnd)
  })
  const statusCounts = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key, cfg, count: monthSets.filter((s) => s.status === key).length,
  })).filter((x) => x.count > 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Calendario</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {monthSets.length} set pianificati in {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm font-semibold text-foreground capitalize min-w-[140px] text-center hover:bg-muted rounded-md transition"
          >
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      {statusCounts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {statusCounts.map(({ key, cfg, count }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
              <span className="text-xs font-semibold text-foreground">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {allDays.map((day, i) => {
              const inMonth  = isSameMonth(day, currentMonth)
              const today    = isToday(day)
              const daySets  = setsOnDay(day)
              const hasSets  = daySets.length > 0
              const isLast   = i === allDays.length - 1

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day, daySets)}
                  className={`
                    relative min-h-[90px] p-1.5 border-b border-r border-border/50 transition
                    ${!isLast && (i + 1) % 7 === 0 ? 'border-r-0' : ''}
                    ${i >= allDays.length - 7 ? 'border-b-0' : ''}
                    ${hasSets ? 'cursor-pointer hover:bg-muted/40' : ''}
                    ${!inMonth ? 'bg-muted/20' : ''}
                  `}
                >
                  {/* Day number */}
                  <div className={`
                    w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 mx-auto
                    ${today ? 'bg-primary text-primary-foreground font-bold' : ''}
                    ${!inMonth ? 'text-muted-foreground/40' : today ? '' : 'text-foreground'}
                  `}>
                    {format(day, 'd')}
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {daySets.slice(0, 3).map((s) => {
                      const cfg    = STATUS_CONFIG[s.status] || STATUS_CONFIG.planned
                      const start  = isRangeStart(s, day)
                      const end    = isRangeEnd(s, day)
                      const middle = isMiddleOfRange(s, day)
                      return (
                        <div
                          key={s.id}
                          className={`text-[10px] font-medium py-0.5 ${cfg.bg} ${cfg.text} border-y ${cfg.border}
                            ${start && end ? 'px-1.5 rounded border-x' : ''}
                            ${start && !end ? 'pl-1.5 pr-0 rounded-l border-l' : ''}
                            ${end && !start ? 'pr-1.5 pl-0 rounded-r border-r' : ''}
                            ${middle ? 'px-0' : ''}
                          `}
                          title={s.name}
                        >
                          {(start || (!s.end_date)) ? (
                            <span className="truncate block px-0.5">{s.name}</span>
                          ) : (
                            <span className="invisible text-[10px]">·</span>
                          )}
                        </div>
                      )
                    })}
                    {daySets.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{daySets.length - 3} altri
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {selectedDay && format(selectedDay, "d MMMM yyyy", { locale: it })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedSets.map((s) => {
              const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.planned
              return (
                <div key={s.id} className={`rounded-lg border p-3 ${cfg.border} ${cfg.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${cfg.text} truncate`}>{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.job_date && format(parseISO(s.job_date), 'd MMM yyyy', { locale: it })}
                        {s.end_date && s.end_date !== s.job_date && (
                          <> → {format(parseISO(s.end_date), 'd MMM yyyy', { locale: it })}</>
                        )}
                      </div>
                      {s.location && <div className="text-xs text-muted-foreground">{s.location}</div>}
                      {s.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.notes}</div>}
                    </div>
                    <Badge variant="outline" className={`text-[10px] border flex-shrink-0 ${cfg.border} ${cfg.text}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <Link
                      href={`/set/${s.id}`}
                      onClick={() => setSelectedDay(null)}
                      className={`text-xs font-medium ${cfg.text} hover:underline flex items-center gap-1`}
                    >
                      <Briefcase className="w-3 h-3" />
                      Apri set
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

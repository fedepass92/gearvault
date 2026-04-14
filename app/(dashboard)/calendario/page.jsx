'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addDays,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
  startOfWeek, endOfWeek, parseISO, isWithinInterval,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Briefcase, CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { getSetColor } from '@/lib/set-colors'

const STATUS_CONFIG = {
  planned:    { label: 'Pianificato', bg: 'bg-blue-600',    pill: '#2563eb', text: 'text-white', border: 'border-blue-500/30',    dot: 'bg-blue-400' },
  out:        { label: 'In uscita',   bg: 'bg-amber-500',   pill: '#f59e0b', text: 'text-white', border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  returned:   { label: 'Rientrato',   bg: 'bg-emerald-600', pill: '#059669', text: 'text-white', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  incomplete: { label: 'Incompleto',  bg: 'bg-red-600',     pill: '#dc2626', text: 'text-white', border: 'border-red-500/30',     dot: 'bg-red-400' },
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function CalendarioPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null) // Date
  const [selectedSets, setSelectedSets] = useState([]) // sets on selected day
  const [hoveredSetId, setHoveredSetId] = useState(null)
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
  }))
  const activeStatuses = statusCounts.filter((x) => x.count > 0)
  const isCurrentMonth = isSameMonth(currentMonth, new Date())

  // Build header subtitle (total count only — per-status breakdown is in the legend)
  const monthName = format(currentMonth, 'MMMM yyyy', { locale: it })
  const headerSubtitle = monthSets.length === 0
    ? `Nessun set in ${monthName}`
    : `${monthSets.length} set in ${monthName}`

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Calendario</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {headerSubtitle}
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Oggi
            </Button>
          )}
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

      {/* Legend — always show all statuses with plural labels */}
      <div className="flex items-center gap-3 flex-wrap">
        {statusCounts.map(({ key, cfg, count }) => {
          const pluralLabels = { planned: 'Pianificati', out: 'In uscita', returned: 'Rientrati', incomplete: 'Incompleti' }
          const label = count === 1 ? cfg.label : (pluralLabels[key] || cfg.label)
          return (
            <div key={key} className={`flex items-center gap-1.5 ${count === 0 ? 'opacity-40' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-semibold text-foreground">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl">
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
        ) : (() => {
          // Group days into weeks (rows of 7)
          const weeks = []
          for (let w = 0; w < allDays.length; w += 7) {
            weeks.push(allDays.slice(w, w + 7))
          }

          // Pre-compute lane assignments per week
          const weekLanes = weeks.map((weekRow) => {
            const weekStart = weekRow[0]
            const weekEnd   = weekRow[weekRow.length - 1]
            // Sets visible in this week
            const weekSetsVisible = sets.filter((s) => {
              if (!s.job_date) return false
              const sStart = parseISO(s.job_date)
              const sEnd   = s.end_date ? parseISO(s.end_date) : sStart
              return sStart <= weekEnd && sEnd >= weekStart
            })
            // Assign lanes
            const lanes = []
            const setLane = {}
            for (const s of weekSetsVisible) {
              const sStart = parseISO(s.job_date)
              const sEnd   = s.end_date ? parseISO(s.end_date) : sStart
              let assigned = -1
              for (let l = 0; l < lanes.length; l++) {
                const conflict = lanes[l].some((other) => {
                  const oStart = parseISO(other.job_date)
                  const oEnd   = other.end_date ? parseISO(other.end_date) : oStart
                  return sStart <= oEnd && sEnd >= oStart
                })
                if (!conflict) { assigned = l; break }
              }
              if (assigned === -1) { assigned = lanes.length; lanes.push([]) }
              lanes[assigned].push(s)
              setLane[s.id] = assigned
            }
            return { totalLanes: lanes.length, setLane }
          })

          return (
            <div className="grid grid-cols-7">
              {allDays.map((day, i) => {
                const weekIdx   = Math.floor(i / 7)
                const { totalLanes, setLane } = weekLanes[weekIdx]
                const weekRow   = weeks[weekIdx]
                const inMonth   = isSameMonth(day, currentMonth)
                const today     = isToday(day)
                const daySets   = setsOnDay(day)
                const hasSets   = daySets.length > 0
                const isLast    = i === allDays.length - 1

                // Build slot array: one entry per lane
                const slots = Array.from({ length: totalLanes }, () => null)
                for (const s of daySets) {
                  if (setLane[s.id] !== undefined) slots[setLane[s.id]] = s
                }

                // Cell with a label needs higher z-index so overflow text paints above adjacent cells
                const hasLabel = daySets.some((s) => {
                  const _isStart = isRangeStart(s, day)
                  const _isSingle = !s.end_date || s.end_date === s.job_date
                  const _isFirstVis = !_isStart && !_isSingle && isSameDay(day, weekRow[0]) && parseISO(s.job_date) < weekRow[0]
                  return _isStart || _isSingle || _isFirstVis
                })

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day, daySets)}
                    className={`
                      group relative overflow-visible min-h-[100px] pt-1.5 pb-1.5 px-0 border-b border-r border-border/50 transition
                      ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}
                      ${i >= allDays.length - 7 ? 'border-b-0' : ''}
                      ${hasLabel ? 'z-[2]' : 'z-[1]'}
                      ${hasSets ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/20'}
                      ${!inMonth ? 'bg-muted/30' : ''}
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

                    {/* Add set button on empty days */}
                    {!hasSets && inMonth && (
                      <Link
                        href={`/set?new=${format(day, 'yyyy-MM-dd')}`}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    )}

                    {/* Events — lane-based rendering */}
                    <div className="space-y-0.5 overflow-visible">
                      {slots.map((s, laneIdx) => {
                        if (!s) return <div key={laneIdx} className="h-8" />
                        const color     = getSetColor(s.id, s.status)
                        const isStart   = isRangeStart(s, day)
                        const isEnd     = isRangeEnd(s, day)
                        const isSingle  = !s.end_date || s.end_date === s.job_date
                        const isFirstVisibleInWeek = !isStart && !isSingle && isSameDay(day, weekRow[0]) && parseISO(s.job_date) < weekRow[0]
                        const isLastVisibleInWeek = !isEnd && !isSingle && isSameDay(day, weekRow[6]) && s.end_date && parseISO(s.end_date) > weekRow[6]
                        const showName  = isStart || isSingle || isFirstVisibleInWeek
                        const roundLeft  = isStart || isSingle || isFirstVisibleInWeek
                        const roundRight = isEnd || isSingle || isLastVisibleInWeek

                        const borderRadius = roundLeft && roundRight
                          ? '4px'
                          : roundLeft  ? '4px 0 0 4px'
                          : roundRight ? '0 4px 4px 0'
                          :              '0'
                        const isLastCol = (i + 1) % 7 === 0
                        const ml = roundLeft  ? '2px' : '0'
                        const mr = roundRight ? '2px' : isLastCol ? '0' : '-1px'

                        // Calculate how many visible days remain from this day to end of set (clamped to week row)
                        let spanDays = 1
                        if (showName && !isSingle) {
                          const sEnd = s.end_date ? parseISO(s.end_date) : parseISO(s.job_date)
                          const clampedEnd = sEnd > weekRow[6] ? weekRow[6] : sEnd
                          for (let d = 1; d <= 6; d++) {
                            if (addDays(day, d) <= clampedEnd) spanDays++
                            else break
                          }
                        }

                        const isHovered = hoveredSetId === s.id

                        return (
                          <div
                            key={s.id}
                            onMouseEnter={() => setHoveredSetId(s.id)}
                            onMouseLeave={() => setHoveredSetId(null)}
                            style={{
                              borderRadius,
                              marginLeft: ml,
                              marginRight: mr,
                              backgroundColor: color,
                            }}
                            className={`h-8 relative overflow-visible cursor-pointer transition-all duration-150 ${isHovered ? 'brightness-125' : ''}`}
                          >
                            {showName && (
                              <span
                                className="absolute left-0 top-0 h-full flex items-center text-xs font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis pl-2 pointer-events-none z-20"
                                style={{ width: `calc(${spanDays} * 100% - 8px)`, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                              >{s.name}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
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
                <div key={s.id} className={`rounded-lg border p-3 ${cfg.border}`} style={{ backgroundColor: `${cfg.pill}18` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.job_date && format(parseISO(s.job_date), 'd MMM yyyy', { locale: it })}
                        {s.end_date && s.end_date !== s.job_date && (
                          <> → {format(parseISO(s.end_date), 'd MMM yyyy', { locale: it })}</>
                        )}
                      </div>
                      {s.location && <div className="text-xs text-muted-foreground">{s.location}</div>}
                      {s.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.notes}</div>}
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: cfg.pill }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <Link
                      href={`/set/${s.id}`}
                      onClick={() => setSelectedDay(null)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
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

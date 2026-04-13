'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, isSameDay, parseISO, isWithinInterval, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { getSetColor } from '@/lib/set-colors'

export default function WeekStrip({ weekSets, weekDays: weekDaysISO, today: todayISO }) {
  const [hoveredSetId, setHoveredSetId] = useState(null)

  // Parse ISO strings from server component
  const weekDays = useMemo(() => weekDaysISO.map((d) => parseISO(d)), [weekDaysISO])
  const today = useMemo(() => parseISO(todayISO), [todayISO])

  // Filter sets that overlap the 7-day window
  const visibleSets = useMemo(() => (weekSets || []).filter((s) => {
    if (!s.job_date) return false
    const start = parseISO(s.job_date)
    const end   = s.end_date ? parseISO(s.end_date) : start
    return weekDays.some((day) => isWithinInterval(day, { start, end }))
  }), [weekSets, weekDays])

  // Lane assignment: each set gets a fixed row index for its entire duration
  const { totalLanes, setLane } = useMemo(() => {
    const lanes = []
    const setLane = {}
    for (const s of visibleSets) {
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
  }, [visibleSets])

  if (visibleSets.length === 0) return null

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prossimi 7 giorni</span>
      </div>
      <div className="grid grid-cols-7 divide-x divide-border/50">
        {weekDays.map((day) => {
          const daySets = visibleSets.filter((s) => {
            const start = parseISO(s.job_date)
            const end   = s.end_date ? parseISO(s.end_date) : start
            return isWithinInterval(day, { start, end })
          })
          const slots = Array.from({ length: totalLanes }, () => null)
          for (const s of daySets) slots[setLane[s.id]] = s

          return (
            <div key={day.toISOString()} className={`py-2.5 text-center min-w-0 ${daySets.length > 0 ? 'bg-primary/5' : ''}`}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                {format(day, 'EEE', { locale: it })}
              </div>
              <div className="mt-0.5 px-1 flex justify-center h-8 items-center">
                {isSameDay(day, today) ? (
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-semibold">{format(day, 'd')}</span>
                ) : (
                  <span className={`text-sm font-semibold ${daySets.length > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{format(day, 'd')}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {slots.map((s, laneIdx) => {
                  if (!s) return <div key={laneIdx} className="h-6" />
                  const color    = getSetColor(s.id, s.status)
                  const isStart  = isSameDay(parseISO(s.job_date), day)
                  const isEnd    = s.end_date ? isSameDay(parseISO(s.end_date), day) : true
                  const isSingle = !s.end_date || s.end_date === s.job_date
                  const isFirstVisible = !isStart && !isSingle && isSameDay(day, weekDays[0]) && parseISO(s.job_date) < weekDays[0]
                  const showName   = isStart || isSingle || isFirstVisible
                  const roundLeft  = isStart || isSingle
                  const roundRight = isEnd || isSingle

                  const borderRadius = roundLeft && roundRight
                    ? '4px'
                    : roundLeft  ? '4px 0 0 4px'
                    : roundRight ? '0 4px 4px 0'
                    :              '0'
                  const ml = roundLeft  ? '2px' : '0'
                  const mr = roundRight ? '2px' : '0'

                  let spanDays = 1
                  if (showName && !isSingle) {
                    const sEnd = s.end_date ? parseISO(s.end_date) : parseISO(s.job_date)
                    const lastVisible = weekDays[6]
                    const clampedEnd = sEnd > lastVisible ? lastVisible : sEnd
                    for (let d = 1; d < 7; d++) {
                      if (addDays(day, d) <= clampedEnd) spanDays++
                      else break
                    }
                  }

                  const isHovered = hoveredSetId === s.id
                  const isDimmed  = hoveredSetId !== null && hoveredSetId !== s.id

                  return (
                    <Link key={s.id} href={`/set/${s.id}`}>
                      <div
                        onMouseEnter={() => setHoveredSetId(s.id)}
                        onMouseLeave={() => setHoveredSetId(null)}
                        style={{ backgroundColor: color, borderRadius, marginLeft: ml, marginRight: mr }}
                        className={`h-6 relative overflow-visible cursor-pointer transition-all duration-150 ${isHovered ? 'brightness-125 ring-2 ring-white/30' : ''} ${isDimmed ? 'opacity-50' : ''}`}
                      >
                        {showName && (
                          <span
                            className="absolute left-0 top-0 h-full flex items-center text-[10px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis pl-2 pointer-events-none z-10"
                            style={{ width: `calc(${spanDays * 100}% - 4px)` }}
                          >{s.name}</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

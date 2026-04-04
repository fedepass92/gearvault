'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { History, Search, Loader2, ArrowUpRight, RotateCcw, Download, X } from 'lucide-react'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

function exportCSV(logs) {
  const headers = ['Data', 'Ora', 'Azione', 'Attrezzatura', 'Seriale', 'Set', 'Utente']
  const rows = logs.map((l) => [
    format(new Date(l.created_at), 'd MMM yyyy', { locale: it }),
    format(new Date(l.created_at), 'HH:mm'),
    l.action === 'checkout' ? 'Uscita' : 'Rientro',
    l.equipment?.name || '',
    l.equipment?.serial_number || '',
    l.sets?.name || '',
    l.profiles?.full_name || '',
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `storico-movimenti-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ACTION_BADGE = {
  checkout: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  checkin: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
}
const ACTION_LABELS = { checkout: 'Uscita', checkin: 'Rientro' }

export default function StoricoPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [equipmentList, setEquipmentList] = useState([])
  const [setsList, setSetsList] = useState([])
  const [usersList, setUsersList] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [setFilter, setSetFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    async function fetchFilters() {
      const supabase = getSupabase()
      const [{ data: eq }, { data: st }, { data: us }] = await Promise.all([
        supabase.from('equipment').select('id, name').order('name'),
        supabase.from('sets').select('id, name').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ])
      setEquipmentList(eq || [])
      setSetsList(st || [])
      setUsersList((us || []).filter((u) => u.full_name))
    }
    fetchFilters()
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()
    let q = supabase
      .from('movement_log')
      .select('*, equipment(id, name, brand, serial_number), sets(id, name), profiles(full_name)')
      .order('created_at', { ascending: false })

    if (equipmentFilter !== 'all') q = q.eq('equipment_id', equipmentFilter)
    if (setFilter !== 'all') q = q.eq('set_id', setFilter)
    if (actionFilter !== 'all') q = q.eq('action', actionFilter)
    if (userFilter !== 'all') q = q.eq('user_id', userFilter)
    if (dateFrom) q = q.gte('created_at', startOfDay(parseISO(dateFrom)).toISOString())
    if (dateTo) q = q.lte('created_at', endOfDay(parseISO(dateTo)).toISOString())

    // Only apply 500 limit when no date range is set
    if (!dateFrom && !dateTo) q = q.limit(500)

    const { data } = await q
    let results = data || []

    if (search) {
      const s = search.toLowerCase()
      results = results.filter(
        (l) =>
          l.equipment?.name?.toLowerCase().includes(s) ||
          l.sets?.name?.toLowerCase().includes(s) ||
          l.profiles?.full_name?.toLowerCase().includes(s)
      )
    }

    setLogs(results)
    setLoading(false)
  }, [equipmentFilter, setFilter, actionFilter, userFilter, search, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const hasDateFilter = dateFrom || dateTo

  function clearDates() {
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Storico movimenti</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{logs.length} movimenti{!hasDateFilter ? ' (ultimi 500)' : ''}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCSV(logs)} disabled={logs.length === 0}>
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per attrezzatura, set, utente…"
              className="pl-8 h-8"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-auto min-w-[130px] h-8 text-sm">
              <SelectValue placeholder="Tutte le azioni" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le azioni</SelectItem>
              <SelectItem value="checkout">Uscita</SelectItem>
              <SelectItem value="checkin">Rientro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
            <SelectTrigger className="w-auto min-w-[160px] h-8 text-sm">
              <SelectValue placeholder="Tutte le attrezzature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le attrezzature</SelectItem>
              {equipmentList.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={setFilter} onValueChange={setSetFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
              <SelectValue placeholder="Tutti i set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i set</SelectItem>
              {setsList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {usersList.length > 0 && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
                <SelectValue placeholder="Tutti gli utenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli utenti</SelectItem>
                {usersList.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Dal</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-sm"
          />
          <span className="text-xs text-muted-foreground">al</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-sm"
          />
          {hasDateFilter && (
            <button
              onClick={clearDates}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted"
            >
              <X className="w-3 h-3" />
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun movimento registrato</p>
            <p className="text-xs mt-1 text-muted-foreground/60">I movimenti vengono registrati automaticamente al check-in/out dei set</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Data / Ora', 'Azione', 'Attrezzatura', 'Set', 'Utente'].map((h, i) => (
                    <th key={h} className={`text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider ${i >= 3 ? 'hidden md:table-cell' : ''} ${i === 4 ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log) => {
                  const ActionIcon = log.action === 'checkout' ? ArrowUpRight : RotateCcw
                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-foreground">{format(new Date(log.created_at), 'd MMM yyyy', { locale: it })}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs border ${ACTION_BADGE[log.action] || 'bg-muted text-muted-foreground'}`}>
                          <ActionIcon className="w-3 h-3 mr-1" />
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {log.equipment?.id ? (
                          <Link href={`/scan/${log.equipment.id}`} className="font-medium text-sm hover:text-primary transition">
                            {log.equipment.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">Eliminata</span>
                        )}
                        {log.equipment?.serial_number && (
                          <div className="text-xs text-muted-foreground font-mono">S/N {log.equipment.serial_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {log.sets ? (
                          <Link href={`/set/${log.set_id}`} className="text-sm text-primary hover:underline">
                            {log.sets.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-sm">
                        {log.profiles?.full_name || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

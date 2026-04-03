'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { History, Search, ChevronDown, Loader2, ArrowUpRight, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import Link from 'next/link'

const ACTION_STYLES = {
  checkout: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  checkin: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
}
const ACTION_LABELS = { checkout: 'Uscita', checkin: 'Rientro' }
const ACTION_ICONS = { checkout: ArrowUpRight, checkin: RotateCcw }

export default function StoricoPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [equipment, setEquipment] = useState([])
  const [sets, setSets] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchFilters() {
      const supabase = getSupabase()
      const [{ data: eq }, { data: st }] = await Promise.all([
        supabase.from('equipment').select('id, name').order('name'),
        supabase.from('sets').select('id, name').order('created_at', { ascending: false }),
      ])
      setEquipment(eq || [])
      setSets(st || [])
    }
    fetchFilters()
  }, [])

  const fetchLogs = useCallback(async () => {
    const supabase = getSupabase()
    let q = supabase
      .from('movement_log')
      .select('*, equipment(id, name, brand, serial_number), sets(id, name), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (equipmentFilter) q = q.eq('equipment_id', equipmentFilter)
    if (setFilter) q = q.eq('set_id', setFilter)

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
  }, [equipmentFilter, setFilter, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Storico movimenti</h1>
          <p className="text-slate-400 text-sm mt-0.5">{logs.length} movimenti</p>
        </div>
        <History className="w-6 h-6 text-slate-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per attrezzatura, set, utente…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <div className="relative">
          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition max-w-[200px]"
          >
            <option value="">Tutte le attrezzature</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition max-w-[200px]"
          >
            <option value="">Tutti i set</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun movimento registrato</p>
            <p className="text-xs mt-1 text-slate-600">I movimenti vengono registrati automaticamente al check-in/out dei set</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Data / Ora</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Azione</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Attrezzatura</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Set</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Utente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {logs.map((log) => {
                  const ActionIcon = ACTION_ICONS[log.action] || ArrowUpRight
                  return (
                    <tr key={log.id} className="hover:bg-slate-700/20 transition">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                        {format(new Date(log.created_at), 'd MMM yyyy', { locale: it })}
                        <div className="text-slate-600">
                          {format(new Date(log.created_at), 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_STYLES[log.action] || 'bg-slate-700 text-slate-400'}`}>
                          <ActionIcon className="w-3 h-3" />
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">
                          {log.equipment?.name || <span className="text-slate-600 italic">Eliminata</span>}
                        </div>
                        {log.equipment?.serial_number && (
                          <div className="text-xs text-slate-500 font-mono">S/N {log.equipment.serial_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {log.sets ? (
                          <Link
                            href={`/set/${log.set_id}`}
                            className="text-sm text-blue-400 hover:text-blue-300 transition"
                          >
                            {log.sets.name}
                          </Link>
                        ) : (
                          <span className="text-slate-600 text-sm italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm">
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

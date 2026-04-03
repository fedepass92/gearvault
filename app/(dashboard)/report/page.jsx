'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { exportInsuranceReport } from '@/lib/pdf'
import { FileDown, Filter, Loader2, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const CATEGORIES = [
  { value: '', label: 'Tutte le categorie' },
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Obiettivo' },
  { value: 'drone', label: 'Drone' },
  { value: 'audio', label: 'Audio' },
  { value: 'lighting', label: 'Illuminazione' },
  { value: 'support', label: 'Supporto' },
  { value: 'accessory', label: 'Accessorio' },
  { value: 'altro', label: 'Altro' },
]

const CONDITION_BADGE = {
  active: 'bg-emerald-500/20 text-emerald-300',
  repair: 'bg-amber-500/20 text-amber-300',
  retired: 'bg-slate-700 text-slate-400',
}
const CONDITION_LABEL = { active: 'Attivo', repair: 'Riparazione', retired: 'Ritirato' }

export default function ReportPage() {
  const [equipment, setEquipment] = useState([])
  const [allEquipment, setAllEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [exportLoading, setExportLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'admin')
    }
    checkRole()
  }, [])

  const fetchEquipment = useCallback(async () => {
    const supabase = getSupabase()
    let q = supabase.from('equipment').select('*').order('name')
    const { data } = await q
    setAllEquipment(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEquipment() }, [fetchEquipment])

  useEffect(() => {
    if (categoryFilter) {
      setEquipment(allEquipment.filter((e) => e.category === categoryFilter))
    } else {
      setEquipment(allEquipment)
    }
  }, [allEquipment, categoryFilter])

  async function handleExport() {
    setExportLoading(true)
    try {
      await exportInsuranceReport(allEquipment, categoryFilter || null)
    } finally {
      setExportLoading(false)
    }
  }

  const totalPurchase = equipment.reduce((s, e) => s + (parseFloat(e.purchase_price) || 0), 0)
  const totalMarket = equipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Report Assicurativo</h1>
          <p className="text-slate-400 text-sm mt-0.5">Elenco attrezzature Brain Digital</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleExport}
            disabled={exportLoading || equipment.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Esporta PDF
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs text-slate-500 mb-1">Totale item</div>
          <div className="text-2xl font-bold text-white">{equipment.length}</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs text-slate-500 mb-1">Valore acquisto</div>
          <div className="text-xl font-bold text-white">
            € {totalPurchase.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs text-slate-500 mb-1">Valore di mercato</div>
          <div className="text-xl font-bold text-white">
            € {totalMarket.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-500" />
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        <span className="text-xs text-slate-500">{equipment.length} item{categoryFilter ? ` in ${CATEGORIES.find(c=>c.value===categoryFilter)?.label}` : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Nome', 'Marca', 'Modello', 'Seriale', 'Data Acquisto', 'Val. Acquisto', 'Val. Mercato', 'Condizione'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {equipment.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3 text-slate-400">{item.brand || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{item.model || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.serial_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {item.purchase_date ? format(new Date(item.purchase_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-right whitespace-nowrap">
                      {item.purchase_price ? `€ ${parseFloat(item.purchase_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-right whitespace-nowrap">
                      {item.market_value ? `€ ${parseFloat(item.market_value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_BADGE[item.condition] || 'bg-slate-700 text-slate-400'}`}>
                        {CONDITION_LABEL[item.condition] || item.condition}
                      </span>
                    </td>
                  </tr>
                ))}
                {equipment.length > 0 && (
                  <tr className="bg-slate-700/30 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-sm text-slate-300">
                      Totale ({equipment.length} item)
                    </td>
                    <td className="px-4 py-3 text-right text-white whitespace-nowrap">
                      € {totalPurchase.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-white whitespace-nowrap">
                      € {totalMarket.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            {equipment.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">Nessuna attrezzatura trovata</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import EquipmentModal from '@/components/EquipmentModal'
import { Plus, Search, Filter, Pencil, Trash2, Loader2, ImageOff, ChevronDown } from 'lucide-react'

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

const CONDITIONS = [
  { value: '', label: 'Tutte le condizioni' },
  { value: 'active', label: 'Attivo' },
  { value: 'repair', label: 'In riparazione' },
  { value: 'retired', label: 'Ritirato' },
]

const CONDITION_BADGE = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  repair: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  retired: 'bg-slate-700 text-slate-400 border-slate-600',
}
const CONDITION_LABEL = { active: 'Attivo', repair: 'Riparazione', retired: 'Ritirato' }

export default function InventarioPage() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | item
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEquipment = useCallback(async () => {
    const supabase = getSupabase()
    let q = supabase.from('equipment').select('*').order('created_at', { ascending: false })
    if (categoryFilter) q = q.eq('category', categoryFilter)
    if (conditionFilter) q = q.eq('condition', conditionFilter)
    if (search) q = q.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`)
    const { data } = await q
    setEquipment(data || [])
    setLoading(false)
  }, [search, categoryFilter, conditionFilter])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

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

  async function handleDelete(item) {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('equipment').delete().eq('id', item.id)
    setDeleteConfirm(null)
    setDeleting(false)
    fetchEquipment()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-slate-400 text-sm mt-0.5">{equipment.length} attrezzature</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuova attrezzatura</span>
            <span className="sm:hidden">Nuova</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, marca, seriale…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
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
        <div className="relative">
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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
        ) : equipment.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessuna attrezzatura trovata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-14">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Marca / Modello</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Seriale</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Val. Acquisto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Val. Mercato</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Stato</th>
                  {isAdmin && <th className="w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {equipment.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center">
                        {item.photo_url ? (
                          <Image src={item.photo_url} alt={item.name} width={40} height={40} className="object-cover w-full h-full" />
                        ) : (
                          <ImageOff className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{item.name}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                      {[item.brand, item.model].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-400 font-mono text-xs">
                      {item.serial_number || '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-slate-400">
                      {CATEGORIES.find((c) => c.value === item.category)?.label || item.category || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-300 text-right">
                      {item.purchase_price ? `€ ${parseFloat(item.purchase_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-300 text-right">
                      {item.market_value ? `€ ${parseFloat(item.market_value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${CONDITION_BADGE[item.condition] || 'bg-slate-700 text-slate-400'}`}>
                        {CONDITION_LABEL[item.condition] || item.condition}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setModal(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Equipment modal */}
      {modal && (
        <EquipmentModal
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchEquipment() }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Elimina attrezzatura</h3>
            <p className="text-sm text-slate-400 mb-5">
              Sei sicuro di voler eliminare <span className="text-white font-medium">{deleteConfirm.name}</span>? L&apos;operazione è irreversibile.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">Annulla</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Package({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V11" />
    </svg>
  )
}

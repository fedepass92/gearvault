'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import LabelCard from '@/components/LabelCard'
import {
  ArrowLeft, Box, Plus, Trash2, Search, X, Loader2,
  Printer, Package, Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export default function CaseDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [caseData, setCaseData] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [showLabelPreview, setShowLabelPreview] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchCase = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase.from('cases').select('*').eq('id', id).single()
    if (!data) { router.push('/case'); return }
    setCaseData(data)
    setEditForm({ name: data.name, description: data.description || '' })

    const { data: itemsData } = await supabase
      .from('case_items')
      .select('*, equipment(*)')
      .eq('case_id', id)
      .order('added_at', { ascending: true })
    setItems(itemsData || [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchCase() }, [fetchCase])

  useEffect(() => {
    if (!showAddPicker) return
    async function fetchEquipment() {
      const supabase = getSupabase()
      let q = supabase.from('equipment').select('id, name, brand, model, serial_number, category').order('name')
      if (pickerSearch) q = q.or(`name.ilike.%${pickerSearch}%,serial_number.ilike.%${pickerSearch}%,brand.ilike.%${pickerSearch}%`)
      const { data } = await q
      const addedIds = new Set(items.map((i) => i.equipment_id))
      setAvailableEquipment((data || []).filter((e) => !addedIds.has(e.id)))
    }
    fetchEquipment()
  }, [showAddPicker, pickerSearch, items])

  async function addItem(equipment) {
    const supabase = getSupabase()
    await supabase.from('case_items').insert({ case_id: id, equipment_id: equipment.id })
    setShowAddPicker(false)
    fetchCase()
  }

  async function removeItem(caseItemId) {
    const supabase = getSupabase()
    await supabase.from('case_items').delete().eq('id', caseItemId)
    fetchCase()
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    const supabase = getSupabase()
    await supabase.from('cases').update({
      name: editForm.name,
      description: editForm.description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditModal(false)
    setEditSaving(false)
    fetchCase()
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('cases').delete().eq('id', id)
    router.push('/case')
  }

  function handlePrint() {
    setShowLabelPreview(true)
    setTimeout(() => window.print(), 300)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    )
  }
  if (!caseData) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <h1 className="text-xl font-bold text-white truncate">{caseData.name}</h1>
          </div>
          {caseData.description && (
            <p className="text-xs text-slate-500 mt-1 ml-7">{caseData.description}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5 ml-7">
            {items.length} item · creato {format(new Date(caseData.created_at), 'd MMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditModal(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Etichetta</span>
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Label preview (print area) */}
      {showLabelPreview && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Etichetta case
          </h2>
          <div id="print-area">
            <LabelCard item={caseData} type="qr" isCase />
          </div>
        </div>
      )}
      {!showLabelPreview && (
        <div className="hidden" id="print-area">
          <LabelCard item={caseData} type="qr" isCase />
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowAddPicker(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Aggiungi attrezzatura
        </button>
      </div>

      {/* Items list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-white">Contenuto del case</h2>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessuna attrezzatura aggiunta</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{item.equipment?.name || 'Eliminato'}</div>
                  <div className="text-xs text-slate-500">
                    {[item.equipment?.brand, item.equipment?.model].filter(Boolean).join(' · ')}
                    {item.equipment?.serial_number ? ` · S/N: ${item.equipment.serial_number}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-700 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Modifica case</h2>
              <button onClick={() => setEditModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrizione</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditModal(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">Annulla</button>
                <button type="submit" disabled={editSaving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Elimina case</h3>
            <p className="text-sm text-slate-400 mb-5">
              Sei sicuro di voler eliminare <span className="text-white font-medium">{caseData.name}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">Annulla</button>
              <button
                onClick={handleDelete}
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

      {/* Add equipment picker */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Aggiungi attrezzatura al case</h2>
              <button onClick={() => { setShowAddPicker(false); setPickerSearch('') }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-slate-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Cerca attrezzatura…"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {availableEquipment.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">Nessuna attrezzatura disponibile</div>
              ) : (
                <div className="divide-y divide-slate-700/30">
                  {availableEquipment.map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => addItem(eq)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-700/50 transition text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{eq.name}</div>
                        <div className="text-xs text-slate-500">
                          {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                          {eq.serial_number ? ` · S/N: ${eq.serial_number}` : ''}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

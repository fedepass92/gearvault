'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { useScannerListener } from '@/components/ScannerContext'
import {
  ArrowLeft, Plus, Scan, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Search, X, Trash2, Package, ArrowUpRight, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const STATUS_STYLES = {
  planned: 'bg-slate-700 text-slate-300',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
  incomplete: 'bg-red-500/20 text-red-300',
}
const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

const ITEM_STATUS_STYLES = {
  planned: 'bg-slate-700/50 text-slate-400',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
}
const ITEM_STATUS_LABELS = { planned: 'Pianificato', out: 'Fuori', returned: 'Rientrato' }

export default function SetDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [set, setSet] = useState(null)
  const [items, setItems] = useState([]) // set_items joined with equipment
  const [loading, setLoading] = useState(true)
  const [scanMode, setScanMode] = useState(null) // null | 'out' | 'in'
  const [scannedIds, setScannedIds] = useState(new Set())
  const [lastScanResult, setLastScanResult] = useState(null) // {status: 'ok'|'unknown', item}
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [confirmScan, setConfirmScan] = useState(false)

  const fetchSet = useCallback(async () => {
    const supabase = getSupabase()
    const { data: setData } = await supabase.from('sets').select('*').eq('id', id).single()
    if (!setData) { router.push('/set'); return }
    setSet(setData)

    const { data: itemsData } = await supabase
      .from('set_items')
      .select('*, equipment(*)')
      .eq('set_id', id)
    setItems(itemsData || [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchSet() }, [fetchSet])

  useEffect(() => {
    if (!showAddPicker) return
    async function fetchEquipment() {
      const supabase = getSupabase()
      let q = supabase.from('equipment').select('id, name, brand, model, serial_number').order('name')
      if (pickerSearch) q = q.or(`name.ilike.%${pickerSearch}%,serial_number.ilike.%${pickerSearch}%,brand.ilike.%${pickerSearch}%`)
      const { data } = await q
      // Exclude already-added items
      const addedIds = new Set(items.map((i) => i.equipment_id))
      setAvailableEquipment((data || []).filter((e) => !addedIds.has(e.id)))
    }
    fetchEquipment()
  }, [showAddPicker, pickerSearch, items])

  async function addItem(equipment) {
    const supabase = getSupabase()
    await supabase.from('set_items').insert({ set_id: id, equipment_id: equipment.id, status: 'planned' })
    setShowAddPicker(false)
    fetchSet()
  }

  async function removeItem(setItemId) {
    const supabase = getSupabase()
    await supabase.from('set_items').delete().eq('id', setItemId)
    fetchSet()
  }

  // Scanner listener
  useScannerListener(
    useCallback((result) => {
      if (!scanMode) return
      // Try to match by ID or serial
      const matched = items.find(
        (i) =>
          (result.id && i.equipment_id === result.id) ||
          (result.serial && i.equipment?.serial_number === result.serial) ||
          (result.type === 'serial' && i.equipment?.serial_number === result.raw)
      )
      if (matched) {
        setScannedIds((prev) => new Set(prev).add(matched.equipment_id))
        setLastScanResult({ status: 'ok', item: matched.equipment })
      } else {
        setLastScanResult({ status: 'unknown', raw: result.raw })
      }
    }, [scanMode, items]),
    scanMode !== null
  )

  async function confirmOut() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    // Update all scanned items → out
    for (const item of items) {
      if (scannedIds.has(item.equipment_id)) {
        await supabase.from('set_items').update({ status: 'out', checked_out_at: now }).eq('id', item.id)
      }
    }
    await supabase.from('sets').update({ status: 'out' }).eq('id', id)
    setScanMode(null)
    setScannedIds(new Set())
    setConfirmScan(false)
    fetchSet()
  }

  async function confirmIn() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    let anyMissing = false
    for (const item of items) {
      if (item.status === 'out') {
        if (scannedIds.has(item.equipment_id)) {
          await supabase.from('set_items').update({ status: 'returned', checked_in_at: now }).eq('id', item.id)
        } else {
          anyMissing = true
        }
      }
    }
    await supabase.from('sets').update({ status: anyMissing ? 'incomplete' : 'returned' }).eq('id', id)
    setScanMode(null)
    setScannedIds(new Set())
    setConfirmScan(false)
    fetchSet()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    )
  }

  if (!set) return null

  const outItems = items.filter((i) => i.status === 'out')
  const allOutScanned = outItems.length > 0 && outItems.every((i) => scannedIds.has(i.equipment_id))

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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white truncate">{set.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[set.status] || 'bg-slate-700 text-slate-300'}`}>
              {STATUS_LABELS[set.status] || set.status}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            {set.job_date && <span>{format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}</span>}
            {set.location && <span>{set.location}</span>}
            <span>{items.length} item nel set</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {set.notes && (
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 px-4 py-3 text-sm text-slate-400">
          {set.notes}
        </div>
      )}

      {/* Scanner mode banner */}
      {scanMode && (
        <div className={`rounded-xl border p-4 ${scanMode === 'out' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scan className={`w-4 h-4 scanner-active ${scanMode === 'out' ? 'text-amber-400' : 'text-blue-400'}`} />
              <span className="text-sm font-semibold text-white">
                {scanMode === 'out' ? 'Modalità uscita attiva' : 'Modalità rientro attiva'}
              </span>
            </div>
            <button
              onClick={() => { setScanMode(null); setScannedIds(new Set()); setLastScanResult(null) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Scansiona i codici QR o barcode degli item. {scannedIds.size}/{scanMode === 'out' ? items.length : outItems.length} scansionati.
          </p>

          {/* Last scan result */}
          {lastScanResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3 ${lastScanResult.status === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              {lastScanResult.status === 'ok' ? (
                <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {lastScanResult.item?.name} scansionato</>
              ) : (
                <><XCircle className="w-4 h-4 flex-shrink-0" /> Codice non riconosciuto: {lastScanResult.raw}</>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setConfirmScan(true)}
              disabled={scannedIds.size === 0}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition"
            >
              {scanMode === 'out' ? 'Conferma uscita' : 'Conferma rientro'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!scanMode && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowAddPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Aggiungi item
          </button>
          {items.some((i) => i.status === 'planned') && (
            <button
              onClick={() => { setScanMode('out'); setScannedIds(new Set()); setLastScanResult(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Inizia uscita
            </button>
          )}
          {items.some((i) => i.status === 'out') && (
            <button
              onClick={() => { setScanMode('in'); setScannedIds(new Set()); setLastScanResult(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              <RotateCcw className="w-4 h-4" />
              Rientro
            </button>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-white">Attrezzatura nel set</h2>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessun item aggiunto al set</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {items.map((item) => {
              const isScanned = scannedIds.has(item.equipment_id)
              const isMissing = scanMode === 'in' && item.status === 'out' && !isScanned
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 transition ${
                    isScanned && scanMode ? 'bg-emerald-500/5' : isMissing ? 'bg-red-500/5' : ''
                  }`}
                >
                  {scanMode && (
                    <div className="flex-shrink-0">
                      {isScanned ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isMissing ? (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{item.equipment?.name || 'Item eliminato'}</div>
                    <div className="text-xs text-slate-500">
                      {[item.equipment?.brand, item.equipment?.model].filter(Boolean).join(' · ')}
                      {item.equipment?.serial_number ? ` · S/N: ${item.equipment.serial_number}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ITEM_STATUS_STYLES[item.status] || 'bg-slate-700 text-slate-400'}`}>
                    {ITEM_STATUS_LABELS[item.status] || item.status}
                  </span>
                  {!scanMode && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-700 transition flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm scan dialog */}
      {confirmScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">
              {scanMode === 'out' ? 'Conferma uscita' : 'Conferma rientro'}
            </h3>
            <p className="text-sm text-slate-400 mb-1">
              Item scansionati: <span className="text-white font-medium">{scannedIds.size}</span>
            </p>
            {scanMode === 'in' && (
              <p className="text-sm text-slate-400 mb-4">
                Item mancanti: <span className={outItems.length - scannedIds.size > 0 ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
                  {outItems.length - scannedIds.size}
                </span>
              </p>
            )}
            {scanMode === 'out' && (
              <p className="text-sm text-slate-400 mb-4">
                Non scansionati: <span className="text-slate-300 font-medium">{items.length - scannedIds.size}</span> (rimarranno in stato pianificato)
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmScan(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                Annulla
              </button>
              <button
                onClick={scanMode === 'out' ? confirmOut : confirmIn}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add item picker */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Aggiungi attrezzatura al set</h2>
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

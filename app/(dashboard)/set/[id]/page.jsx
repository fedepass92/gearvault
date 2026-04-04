'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import { exportSetInsurancePDF } from '@/lib/pdf'
import { useScannerListener } from '@/components/ScannerContext'
import {
  ArrowLeft, Plus, Scan, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Search, X, Trash2, Package, ArrowUpRight, RotateCcw,
  FileDown, ImageOff, Upload, MessageSquare, ChevronDown, ChevronUp,
  Battery, BatteryLow, BatteryCharging, Minus, Box, Layers,
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

const BATTERY_ICON = { charged: Battery, charging: BatteryCharging, low: BatteryLow, na: Minus }
const BATTERY_COLOR = { charged: 'text-emerald-400', charging: 'text-blue-400', low: 'text-red-400', na: 'text-slate-600' }

/** Compress image via Canvas API before upload */
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      const tryQ = (q) => canvas.toBlob((blob) => {
        if (blob.size > 200 * 1024 && q > 0.3) tryQ(q - 0.1)
        else resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', q)
      tryQ(0.7)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function SetDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [set, setSet] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanMode, setScanMode] = useState(null)
  const [scannedIds, setScannedIds] = useState(new Set())
  const [lastScanResult, setLastScanResult] = useState(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerTab, setPickerTab] = useState('attrezzatura')
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [availableCases, setAvailableCases] = useState([])
  const [availableKits, setAvailableKits] = useState([])
  const [confirmScan, setConfirmScan] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Notes
  const [notes, setNotes] = useState([])
  const [showNoteForm, setShowNoteForm] = useState(null) // 'pre' | 'post' | null
  const [noteBody, setNoteBody] = useState('')
  const [notePhotoUrl, setNotePhotoUrl] = useState('')
  const [noteUploading, setNoteUploading] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(true)
  const notePhotoRef = useRef(null)

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

  const fetchNotes = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('set_notes')
      .select('*, profiles(full_name)')
      .eq('set_id', id)
      .order('created_at', { ascending: true })
    setNotes(data || [])
  }, [id])

  useEffect(() => { fetchSet() }, [fetchSet])
  useEffect(() => { fetchNotes() }, [fetchNotes])

  useEffect(() => {
    if (!showAddPicker) return
    async function fetchAvailable() {
      const supabase = getSupabase()
      const addedIds = new Set(items.map((i) => i.equipment_id))
      const searchLower = pickerSearch.toLowerCase()

      const [eqRes, casesRes, kitsRes] = await Promise.all([
        (() => {
          let q = supabase.from('equipment').select('id, name, brand, model, serial_number, battery_status').order('name')
          if (pickerSearch) q = q.or(`name.ilike.%${pickerSearch}%,serial_number.ilike.%${pickerSearch}%,brand.ilike.%${pickerSearch}%`)
          return q
        })(),
        supabase.from('cases').select('id, name, description, case_items(equipment_id, equipment(id, name, brand, model, serial_number, battery_status))').order('name'),
        supabase.from('kits').select('id, name, description, kit_items(equipment_id, equipment(id, name, brand, model, serial_number, battery_status))').order('name'),
      ])

      setAvailableEquipment((eqRes.data || []).filter((e) => !addedIds.has(e.id)))
      setAvailableCases(
        (casesRes.data || [])
          .filter((c) => !pickerSearch || c.name.toLowerCase().includes(searchLower))
      )
      setAvailableKits(
        (kitsRes.data || [])
          .filter((k) => !pickerSearch || k.name.toLowerCase().includes(searchLower))
      )
    }
    fetchAvailable()
  }, [showAddPicker, pickerSearch, items])

  async function addItem(equipment) {
    const supabase = getSupabase()
    await supabase.from('set_items').insert({ set_id: id, equipment_id: equipment.id, status: 'planned' })
    setShowAddPicker(false)
    fetchSet()
  }

  async function addCase(caseItem) {
    const supabase = getSupabase()
    const addedIds = new Set(items.map((i) => i.equipment_id))
    const toAdd = (caseItem.case_items || [])
      .map((ci) => ci.equipment)
      .filter((eq) => eq && !addedIds.has(eq.id))
      .map((eq) => ({ set_id: id, equipment_id: eq.id, status: 'planned' }))
    if (toAdd.length > 0) await supabase.from('set_items').insert(toAdd)
    setShowAddPicker(false)
    fetchSet()
  }

  async function addKit(kitItem) {
    const supabase = getSupabase()
    const addedIds = new Set(items.map((i) => i.equipment_id))
    const toAdd = (kitItem.kit_items || [])
      .map((ki) => ki.equipment)
      .filter((eq) => eq && !addedIds.has(eq.id))
      .map((eq) => ({ set_id: id, equipment_id: eq.id, status: 'planned' }))
    if (toAdd.length > 0) await supabase.from('set_items').insert(toAdd)
    setShowAddPicker(false)
    fetchSet()
  }

  async function removeItem(setItemId) {
    const supabase = getSupabase()
    await supabase.from('set_items').delete().eq('id', setItemId)
    fetchSet()
  }

  useScannerListener(
    useCallback((result) => {
      if (!scanMode) return
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

  async function logMovements(action, equipmentIds) {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const logs = equipmentIds.map((eqId) => {
      const si = items.find((i) => i.equipment_id === eqId)
      return { set_id: id, equipment_id: eqId, set_item_id: si?.id || null, action, user_id: user?.id || null, created_at: now }
    })
    if (logs.length > 0) await supabase.from('movement_log').insert(logs)
  }

  async function confirmOut() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    const scannedList = [...scannedIds]
    for (const item of items) {
      if (scannedIds.has(item.equipment_id)) {
        await supabase.from('set_items').update({ status: 'out', checked_out_at: now }).eq('id', item.id)
      }
    }
    await supabase.from('sets').update({ status: 'out' }).eq('id', id)
    await logMovements('checkout', scannedList)
    setScanMode(null); setScannedIds(new Set()); setConfirmScan(false)
    fetchSet()
  }

  async function confirmIn() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    let anyMissing = false
    const returnedIds = []
    for (const item of items) {
      if (item.status === 'out') {
        if (scannedIds.has(item.equipment_id)) {
          await supabase.from('set_items').update({ status: 'returned', checked_in_at: now }).eq('id', item.id)
          returnedIds.push(item.equipment_id)
        } else {
          anyMissing = true
        }
      }
    }
    await supabase.from('sets').update({ status: anyMissing ? 'incomplete' : 'returned' }).eq('id', id)
    await logMovements('checkin', returnedIds)
    setScanMode(null); setScannedIds(new Set()); setConfirmScan(false)
    fetchSet()
  }

  async function handleNotePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setNoteUploading(true)
    let toUpload = file
    if (file.type.startsWith('image/')) {
      try { toUpload = await compressImage(file) } catch { /* fallback */ }
    }
    const supabase = getSupabase()
    const path = `set-notes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const { error } = await supabase.storage.from('equipment-photos').upload(path, toUpload, { upsert: true, contentType: 'image/jpeg' })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('equipment-photos').getPublicUrl(path)
      setNotePhotoUrl(publicUrl)
    }
    setNoteUploading(false)
    e.target.value = ''
  }

  async function saveNote() {
    if (!noteBody && !notePhotoUrl) return
    setNoteSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('set_notes').insert({
      set_id: id,
      type: showNoteForm,
      body: noteBody || null,
      photo_url: notePhotoUrl || null,
      user_id: user?.id || null,
    })
    setNoteBody(''); setNotePhotoUrl(''); setShowNoteForm(null); setNoteSaving(false)
    fetchNotes()
  }

  async function deleteNote(noteId) {
    const supabase = getSupabase()
    await supabase.from('set_notes').delete().eq('id', noteId)
    fetchNotes()
  }

  async function handleExportPDF() {
    setPdfLoading(true)
    try {
      await exportSetInsurancePDF(set, items)
    } finally {
      setPdfLoading(false)
    }
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
  const preNotes = notes.filter((n) => n.type === 'pre')
  const postNotes = notes.filter((n) => n.type === 'post')

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
        {/* Export PDF */}
        <button
          onClick={handleExportPDF}
          disabled={pdfLoading || items.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-sm font-medium transition flex-shrink-0"
        >
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          <span className="hidden sm:inline">PDF Assicurazione</span>
        </button>
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
          {lastScanResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3 ${lastScanResult.status === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              {lastScanResult.status === 'ok' ? (
                <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {lastScanResult.item?.name} scansionato</>
              ) : (
                <><XCircle className="w-4 h-4 flex-shrink-0" /> Codice non riconosciuto: {lastScanResult.raw}</>
              )}
            </div>
          )}
          <button
            onClick={() => setConfirmScan(true)}
            disabled={scannedIds.size === 0}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition"
          >
            {scanMode === 'out' ? 'Conferma uscita' : 'Conferma rientro'}
          </button>
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
              const BattIcon = BATTERY_ICON[item.equipment?.battery_status] || Minus
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
                  {!scanMode && item.equipment?.battery_status && (
                    <BattIcon className={`w-4 h-4 flex-shrink-0 ${BATTERY_COLOR[item.equipment.battery_status] || 'text-slate-600'}`} />
                  )}
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

      {/* Pre/Post Notes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/20 transition"
          onClick={() => setNotesExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Note pre/post set</h2>
            {notes.length > 0 && (
              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{notes.length}</span>
            )}
          </div>
          {notesExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {notesExpanded && (
          <div className="p-4 space-y-4">
            {/* Add note buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNoteForm('pre'); setNoteBody(''); setNotePhotoUrl('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nota pre-set
              </button>
              <button
                onClick={() => { setShowNoteForm('post'); setNoteBody(''); setNotePhotoUrl('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nota post-set
              </button>
            </div>

            {/* Note form */}
            {showNoteForm && (
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {showNoteForm === 'pre' ? 'Nota pre-set' : 'Nota post-set'}
                  </span>
                  <button onClick={() => setShowNoteForm(null)} className="p-1 text-slate-500 hover:text-white transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                  placeholder="Scrivi una nota…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => notePhotoRef.current?.click()}
                    disabled={noteUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {noteUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {noteUploading ? 'Caricamento…' : 'Foto'}
                  </button>
                  {notePhotoUrl && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-700">
                      <Image src={notePhotoUrl} alt="nota" fill className="object-cover" />
                      <button
                        onClick={() => setNotePhotoUrl('')}
                        className="absolute top-0 right-0 w-4 h-4 bg-black/60 flex items-center justify-center rounded-bl"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  )}
                  <input ref={notePhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNotePhotoUpload} />
                  <button
                    onClick={saveNote}
                    disabled={noteSaving || (!noteBody && !notePhotoUrl)}
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition"
                  >
                    {noteSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salva nota
                  </button>
                </div>
              </div>
            )}

            {/* Notes list */}
            {notes.length === 0 && !showNoteForm && (
              <p className="text-xs text-slate-500 text-center py-2">Nessuna nota aggiunta</p>
            )}
            {[{ label: 'Pre-set', items: preNotes, color: 'text-amber-400' }, { label: 'Post-set', items: postNotes, color: 'text-blue-400' }].map(({ label, items: noteList, color }) =>
              noteList.length > 0 ? (
                <div key={label}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</div>
                  <div className="space-y-2">
                    {noteList.map((note) => (
                      <div key={note.id} className="bg-slate-900 rounded-lg border border-slate-700/50 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] text-slate-500">
                            {format(new Date(note.created_at), 'd MMM yyyy HH:mm', { locale: it })}
                            {note.profiles?.full_name ? ` · ${note.profiles.full_name}` : ''}
                          </span>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="text-slate-600 hover:text-red-400 transition flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {note.body && <p className="text-sm text-slate-300">{note.body}</p>}
                        {note.photo_url && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-slate-700" style={{ maxWidth: 200 }}>
                            <Image src={note.photo_url} alt="nota" width={200} height={150} className="object-cover w-full" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
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
            <p className="text-sm text-slate-400 mb-1">Item scansionati: <span className="text-white font-medium">{scannedIds.size}</span></p>
            {scanMode === 'in' && (
              <p className="text-sm text-slate-400 mb-4">
                Item mancanti: <span className={outItems.length - scannedIds.size > 0 ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
                  {outItems.length - scannedIds.size}
                </span>
              </p>
            )}
            {scanMode === 'out' && (
              <p className="text-sm text-slate-400 mb-4">
                Non scansionati: <span className="text-slate-300 font-medium">{items.length - scannedIds.size}</span> (rimarranno pianificati)
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmScan(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">Annulla</button>
              <button onClick={scanMode === 'out' ? confirmOut : confirmIn} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Add item picker */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Aggiungi al set</h2>
              <button onClick={() => { setShowAddPicker(false); setPickerSearch(''); setPickerTab('attrezzatura') }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
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
                  placeholder="Cerca…"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
              {[
                { id: 'attrezzatura', label: 'Attrezzatura', icon: Package },
                { id: 'case', label: 'Case', icon: Box },
                { id: 'kit', label: 'Kit', icon: Layers },
              ].map(({ id: tabId, label, icon: Icon }) => (
                <button
                  key={tabId}
                  onClick={() => setPickerTab(tabId)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition border-b-2 -mb-px ${
                    pickerTab === tabId
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1">
              {pickerTab === 'attrezzatura' && (
                availableEquipment.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">Nessuna attrezzatura disponibile</div>
                ) : (
                  <div className="divide-y divide-slate-700/30">
                    {availableEquipment.map((eq) => {
                      const BattIcon = BATTERY_ICON[eq.battery_status] || Minus
                      return (
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
                          <BattIcon className={`w-4 h-4 flex-shrink-0 ${BATTERY_COLOR[eq.battery_status] || 'text-slate-600'}`} />
                          <Plus className="w-4 h-4 text-slate-500" />
                        </button>
                      )
                    })}
                  </div>
                )
              )}
              {pickerTab === 'case' && (
                availableCases.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">Nessun case disponibile</div>
                ) : (
                  <div className="divide-y divide-slate-700/30">
                    {availableCases.map((c) => {
                      const addedIds = new Set(items.map((i) => i.equipment_id))
                      const newCount = (c.case_items || []).filter((ci) => ci.equipment && !addedIds.has(ci.equipment.id)).length
                      return (
                        <button
                          key={c.id}
                          onClick={() => addCase(c)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-700/50 transition text-left"
                        >
                          <Box className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{c.name}</div>
                            <div className="text-xs text-slate-500">
                              {newCount} item da aggiungere
                              {c.description ? ` · ${c.description}` : ''}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-500" />
                        </button>
                      )
                    })}
                  </div>
                )
              )}
              {pickerTab === 'kit' && (
                availableKits.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">Nessun kit disponibile</div>
                ) : (
                  <div className="divide-y divide-slate-700/30">
                    {availableKits.map((k) => {
                      const addedIds = new Set(items.map((i) => i.equipment_id))
                      const newCount = (k.kit_items || []).filter((ki) => ki.equipment && !addedIds.has(ki.equipment.id)).length
                      return (
                        <button
                          key={k.id}
                          onClick={() => addKit(k)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-700/50 transition text-left"
                        >
                          <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{k.name}</div>
                            <div className="text-xs text-slate-500">
                              {newCount} item da aggiungere
                              {k.description ? ` · ${k.description}` : ''}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-500" />
                        </button>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

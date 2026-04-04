'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import { exportSetInsurancePDF } from '@/lib/pdf'
import { useScannerListener } from '@/components/ScannerContext'
import CameraScanner from '@/components/CameraScanner'
import {
  ArrowLeft, Plus, Scan, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Search, X, Trash2, Package, ArrowUpRight, RotateCcw,
  FileDown, ImageOff, Upload, MessageSquare, ChevronDown, ChevronUp,
  Battery, BatteryLow, BatteryCharging, Minus, Box, Layers, Camera,
  Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STATUS_STYLES = {
  planned: 'bg-muted text-muted-foreground',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
  incomplete: 'bg-red-500/20 text-red-300',
}
const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

const ITEM_STATUS_STYLES = {
  planned: 'bg-muted/50 text-muted-foreground',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
}
const ITEM_STATUS_LABELS = { planned: 'Pianificato', out: 'Fuori', returned: 'Rientrato' }

const BATTERY_ICON = { charged: Battery, charging: BatteryCharging, low: BatteryLow, na: Minus }
const BATTERY_COLOR = { charged: 'text-emerald-400', charging: 'text-primary', low: 'text-red-400', na: 'text-muted-foreground' }

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
  const [showCamera, setShowCamera] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleScanResult = useCallback((result) => {
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
  }, [scanMode, items])

  useScannerListener(handleScanResult, scanMode !== null)

  const handleCameraDetected = useCallback((raw) => {
    if (!scanMode) return
    // Parse same formats as ScannerContext
    let result
    const urlMatch = raw.match(/\/scan\/([0-9a-f-]{36})$/)
    if (urlMatch) {
      result = { type: 'gearvault', id: urlMatch[1], serial: null, raw }
    } else if (raw.startsWith('GEARVAULT:')) {
      const parts = raw.split(':')
      result = { type: 'gearvault', id: parts[1] || null, serial: parts[2] || null, raw }
    } else {
      result = { type: 'serial', serial: raw, raw }
    }
    handleScanResult(result)
  }, [scanMode, handleScanResult])

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

  async function bulkOut() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    const plannedItems = items.filter((i) => i.status === 'planned')
    for (const item of plannedItems) {
      await supabase.from('set_items').update({ status: 'out', checked_out_at: now }).eq('id', item.id)
    }
    await supabase.from('sets').update({ status: 'out' }).eq('id', id)
    await logMovements('checkout', plannedItems.map((i) => i.equipment_id))
    fetchSet()
  }

  async function bulkIn() {
    const supabase = getSupabase()
    const now = new Date().toISOString()
    const outItems = items.filter((i) => i.status === 'out')
    for (const item of outItems) {
      await supabase.from('set_items').update({ status: 'returned', checked_in_at: now }).eq('id', item.id)
    }
    await supabase.from('sets').update({ status: 'returned' }).eq('id', id)
    await logMovements('checkin', outItems.map((i) => i.equipment_id))
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

  async function handleEditSave(e) {
    e.preventDefault()
    setEditSaving(true)
    const supabase = getSupabase()
    const { data: updated } = await supabase
      .from('sets')
      .update({
        name: editForm.name,
        job_date: editForm.job_date || null,
        location: editForm.location || null,
        notes: editForm.notes || null,
        status: editForm.status,
      })
      .eq('id', id)
      .select()
      .single()
    if (updated) setSet(updated)
    setEditSaving(false)
    setShowEdit(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('set_notes').delete().eq('set_id', id)
    await supabase.from('set_items').delete().eq('set_id', id)
    await supabase.from('sets').delete().eq('id', id)
    router.push('/set')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{set.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[set.status] || 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[set.status] || set.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {set.job_date && <span>{format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}</span>}
            {set.location && <span>{set.location}</span>}
            <span>{items.length} item nel set</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setEditForm({ name: set.name, job_date: set.job_date?.slice(0, 10) || '', location: set.location || '', notes: set.notes || '', status: set.status }); setShowEdit(true) }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Modifica set"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading || items.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/70 disabled:opacity-40 text-muted-foreground rounded-lg text-sm font-medium transition"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {set.notes && (
        <div className="bg-card rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
          {set.notes}
        </div>
      )}

      {/* Scanner mode banner */}
      {scanMode && (
        <div className={`rounded-xl border p-4 ${scanMode === 'out' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-primary/10 border-primary/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scan className={`w-4 h-4 scanner-active ${scanMode === 'out' ? 'text-amber-400' : 'text-primary'}`} />
              <span className="text-sm font-semibold">
                {scanMode === 'out' ? 'Modalità uscita attiva' : 'Modalità rientro attiva'}
              </span>
            </div>
            <button
              onClick={() => { setScanMode(null); setScannedIds(new Set()); setLastScanResult(null) }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Scansiona i codici QR o barcode degli item. {scannedIds.size}/{scanMode === 'out' ? items.length : outItems.length} scansionati.
          </p>
          {lastScanResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3 ${lastScanResult.status === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
              {lastScanResult.status === 'ok' ? (
                <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {lastScanResult.item?.name} scansionato</>
              ) : (
                <><XCircle className="w-4 h-4 flex-shrink-0" /> Codice non riconosciuto: {lastScanResult.raw}</>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCamera(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-xs font-medium transition"
            >
              <Camera className="w-3.5 h-3.5" />
              Camera
            </button>
            <button
              onClick={() => setConfirmScan(true)}
              disabled={scannedIds.size === 0}
              className="flex-1 px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded-lg text-xs font-medium transition"
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
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Aggiungi item
          </button>
          {items.some((i) => i.status === 'planned') && (
            <>
              <button
                onClick={() => { setScanMode('out'); setScannedIds(new Set()); setLastScanResult(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
              >
                <Scan className="w-4 h-4" />
                Scansiona uscita
              </button>
              <button
                onClick={bulkOut}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/30 rounded-lg text-sm font-medium transition"
              >
                <ArrowUpRight className="w-4 h-4" />
                Tutto fuori
              </button>
            </>
          )}
          {items.some((i) => i.status === 'out') && (
            <>
              <button
                onClick={() => { setScanMode('in'); setScannedIds(new Set()); setLastScanResult(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition"
              >
                <Scan className="w-4 h-4" />
                Scansiona rientro
              </button>
              <button
                onClick={bulkIn}
                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-sm font-medium transition"
              >
                <RotateCcw className="w-4 h-4" />
                Tutto rientrato
              </button>
            </>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Attrezzatura nel set</h2>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessun item aggiunto al set</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
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
                        <div className="w-5 h-5 rounded-full border-2 border-border" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.equipment?.name || 'Item eliminato'}</div>
                    <div className="text-xs text-muted-foreground">
                      {[item.equipment?.brand, item.equipment?.model].filter(Boolean).join(' · ')}
                      {item.equipment?.serial_number ? ` · S/N: ${item.equipment.serial_number}` : ''}
                    </div>
                  </div>
                  {!scanMode && item.equipment?.battery_status && (
                    <BattIcon className={`w-4 h-4 flex-shrink-0 ${BATTERY_COLOR[item.equipment.battery_status]}`} />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ITEM_STATUS_STYLES[item.status] || 'bg-muted text-muted-foreground'}`}>
                    {ITEM_STATUS_LABELS[item.status] || item.status}
                  </span>
                  {!scanMode && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
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
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted/20 transition"
          onClick={() => setNotesExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Note pre/post set</h2>
            {notes.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{notes.length}</span>
            )}
          </div>
          {notesExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {notesExpanded && (
          <div className="p-4 space-y-4">
            {/* Add note buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNoteForm('pre'); setNoteBody(''); setNotePhotoUrl('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nota pre-set
              </button>
              <button
                onClick={() => { setShowNoteForm('post'); setNoteBody(''); setNotePhotoUrl('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nota post-set
              </button>
            </div>

            {/* Note form */}
            {showNoteForm && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {showNoteForm === 'pre' ? 'Nota pre-set' : 'Nota post-set'}
                  </span>
                  <button onClick={() => setShowNoteForm(null)} className="p-1 text-muted-foreground hover:text-foreground transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                  placeholder="Scrivi una nota…"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => notePhotoRef.current?.click()}
                    disabled={noteUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {noteUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {noteUploading ? 'Caricamento…' : 'Foto'}
                  </button>
                  {notePhotoUrl && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border">
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
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded-lg text-xs font-medium transition"
                  >
                    {noteSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salva nota
                  </button>
                </div>
              </div>
            )}

            {/* Notes list */}
            {notes.length === 0 && !showNoteForm && (
              <p className="text-xs text-muted-foreground text-center py-2">Nessuna nota aggiunta</p>
            )}
            {[{ label: 'Pre-set', items: preNotes, color: 'text-amber-400' }, { label: 'Post-set', items: postNotes, color: 'text-primary' }].map(({ label, items: noteList, color }) =>
              noteList.length > 0 ? (
                <div key={label}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</div>
                  <div className="space-y-2">
                    {noteList.map((note) => (
                      <div key={note.id} className="bg-background rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(note.created_at), 'd MMM yyyy HH:mm', { locale: it })}
                            {note.profiles?.full_name ? ` · ${note.profiles.full_name}` : ''}
                          </span>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="text-muted-foreground hover:text-destructive transition flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {note.body && <p className="text-sm text-foreground">{note.body}</p>}
                        {note.photo_url && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-border" style={{ maxWidth: 200 }}>
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
          <div className="bg-popover rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold mb-2">
              {scanMode === 'out' ? 'Conferma uscita' : 'Conferma rientro'}
            </h3>
            <p className="text-sm text-muted-foreground mb-1">Item scansionati: <span className="text-foreground font-medium">{scannedIds.size}</span></p>
            {scanMode === 'in' && (
              <p className="text-sm text-muted-foreground mb-4">
                Item mancanti: <span className={outItems.length - scannedIds.size > 0 ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
                  {outItems.length - scannedIds.size}
                </span>
              </p>
            )}
            {scanMode === 'out' && (
              <p className="text-sm text-muted-foreground mb-4">
                Non scansionati: <span className="text-foreground font-medium">{items.length - scannedIds.size}</span> (rimarranno pianificati)
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmScan(false)} className="flex-1 px-4 py-2 bg-muted hover:bg-muted/70 text-muted-foreground rounded-lg text-sm font-medium transition">Annulla</button>
              <button onClick={scanMode === 'out' ? confirmOut : confirmIn} className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition">Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Add item picker */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Aggiungi al set</h2>
              <button onClick={() => { setShowAddPicker(false); setPickerSearch(''); setPickerTab('attrezzatura') }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Cerca…"
                  autoFocus
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border">
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
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
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
                  <div className="text-center py-10 text-muted-foreground text-sm">Nessuna attrezzatura disponibile</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {availableEquipment.map((eq) => {
                      const BattIcon = BATTERY_ICON[eq.battery_status] || Minus
                      return (
                        <button
                          key={eq.id}
                          onClick={() => addItem(eq)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{eq.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                              {eq.serial_number ? ` · S/N: ${eq.serial_number}` : ''}
                            </div>
                          </div>
                          <BattIcon className={`w-4 h-4 flex-shrink-0 ${BATTERY_COLOR[eq.battery_status] || 'text-muted-foreground'}`} />
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                )
              )}
              {pickerTab === 'case' && (
                availableCases.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">Nessun case disponibile</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {availableCases.map((c) => {
                      const addedIds = new Set(items.map((i) => i.equipment_id))
                      const newCount = (c.case_items || []).filter((ci) => ci.equipment && !addedIds.has(ci.equipment.id)).length
                      return (
                        <button
                          key={c.id}
                          onClick={() => addCase(c)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                        >
                          <Box className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {newCount} item da aggiungere
                              {c.description ? ` · ${c.description}` : ''}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                )
              )}
              {pickerTab === 'kit' && (
                availableKits.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">Nessun kit disponibile</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {availableKits.map((k) => {
                      const addedIds = new Set(items.map((i) => i.equipment_id))
                      const newCount = (k.kit_items || []).filter((ki) => ki.equipment && !addedIds.has(ki.equipment.id)).length
                      return (
                        <button
                          key={k.id}
                          onClick={() => addKit(k)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                        >
                          <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{k.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {newCount} item da aggiungere
                              {k.description ? ` · ${k.description}` : ''}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-muted-foreground" />
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

      {/* Camera scanner overlay */}
      {showCamera && (
        <CameraScanner
          onDetected={(raw) => { handleCameraDetected(raw); setShowCamera(false) }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Edit set dialog */}
      <Dialog open={showEdit} onOpenChange={(o) => { if (!o) setShowEdit(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifica set</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome set *</Label>
              <Input value={editForm.name || ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data lavoro</Label>
                <Input type="date" value={editForm.job_date || ''} onChange={(e) => setEditForm((f) => ({ ...f, job_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={editForm.location || ''} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} placeholder="Es. Studio Roma" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Stato</Label>
              <Select value={editForm.status || 'planned'} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Pianificato</SelectItem>
                  <SelectItem value="out">In uscita</SelectItem>
                  <SelectItem value="returned">Rientrato</SelectItem>
                  <SelectItem value="incomplete">Incompleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={editForm.notes || ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="resize-none" />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto" onClick={() => { setShowEdit(false); setShowDeleteConfirm(true) }}>
                Elimina set
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Annulla</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina set</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong className="text-foreground">{set.name}</strong>? Verranno eliminati anche tutti gli item e le note associate. L&apos;operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

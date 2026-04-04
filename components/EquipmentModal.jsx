'use client'

import { useState, useRef, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useScanner } from '@/components/ScannerContext'
import Image from 'next/image'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Upload, Loader2, Trash2, Battery, BatteryLow, BatteryCharging, Minus, Scan,
} from 'lucide-react'

const CATEGORIES = [
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
  { value: 'active', label: 'Attivo' },
  { value: 'repair', label: 'In riparazione' },
  { value: 'retired', label: 'Ritirato' },
]

const LOCATIONS = [
  { value: '', label: 'Seleziona location' },
  { value: 'studio', label: 'Studio' },
  { value: 'campo', label: 'Campo' },
  { value: 'prestito', label: 'In prestito' },
]

const BATTERY_OPTIONS = [
  { value: 'na', label: 'N/D', icon: Minus },
  { value: 'charged', label: 'Carica', icon: Battery },
  { value: 'charging', label: 'In carica', icon: BatteryCharging },
  { value: 'low', label: 'Scarica', icon: BatteryLow },
]

const BATTERY_STYLES = {
  na: 'border-border text-muted-foreground',
  charged: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  charging: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  low: 'border-red-500/40 bg-red-500/10 text-red-400',
}

const EMPTY = {
  name: '', brand: '', model: '', serial_number: '', category: '',
  purchase_date: '', purchase_price: '', market_value: '', insured_value: '',
  condition: 'active', battery_status: 'na', last_checked_at: '',
  location: 'studio', useful_life_years: '', notes: '', photo_url: '',
}

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

export default function EquipmentModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(
    item?.id ? {
      ...item,
      purchase_date: item.purchase_date?.slice(0, 10) || '',
      purchase_price: item.purchase_price ?? '',
      market_value: item.market_value ?? '',
      insured_value: item.insured_value ?? '',
      battery_status: item.battery_status || 'na',
      last_checked_at: item.last_checked_at ? item.last_checked_at.slice(0, 10) : '',
      location: item.location || 'studio',
      useful_life_years: item.useful_life_years ?? '',
      category: item.category || '',
    } : EMPTY
  )
  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // Scanner for serial
  const { subscribe } = useScanner()
  const [scanningSerial, setScanningSerial] = useState(false)

  useEffect(() => {
    if (!scanningSerial) return
    const unsub = subscribe((result) => {
      const val = result.serial || result.raw || ''
      if (val) {
        setForm((f) => ({ ...f, serial_number: val }))
        setScanningSerial(false)
      }
    })
    return unsub
  }, [scanningSerial, subscribe])

  // Kit / Case lists for assignment
  const [kits, setKits] = useState([])
  const [cases, setCases] = useState([])
  const [selectedKit, setSelectedKit] = useState('')
  const [selectedCase, setSelectedCase] = useState('')

  useEffect(() => {
    async function fetchOptions() {
      const supabase = getSupabase()
      const [{ data: k }, { data: c }] = await Promise.all([
        supabase.from('kits').select('id, name').order('name'),
        supabase.from('cases').select('id, name').order('name'),
      ])
      setKits(k || [])
      setCases(c || [])
    }
    fetchOptions()
  }, [])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    setError('')
    let toUpload = file
    if (file.type.startsWith('image/')) {
      try { toUpload = await compressImage(file) } catch { /* fallback */ }
    }
    const supabase = getSupabase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('equipment-photos')
      .upload(path, toUpload, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) { setError('Errore upload: ' + uploadError.message); setUploadLoading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('equipment-photos').getPublicUrl(path)
    setField('photo_url', publicUrl)
    setUploadLoading(false)
    e.target.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = getSupabase()
    const payload = {
      name: form.name,
      brand: form.brand || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      category: form.category || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price !== '' ? parseFloat(form.purchase_price) : null,
      market_value: form.market_value !== '' ? parseFloat(form.market_value) : null,
      insured_value: form.insured_value !== '' ? parseFloat(form.insured_value) : null,
      condition: form.condition,
      battery_status: form.battery_status || 'na',
      last_checked_at: form.last_checked_at ? new Date(form.last_checked_at).toISOString() : null,
      location: form.location || null,
      useful_life_years: form.useful_life_years !== '' ? parseInt(form.useful_life_years) : null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
    }

    let result
    if (isEdit) {
      result = await supabase.from('equipment')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', item.id).select().single()
    } else {
      result = await supabase.from('equipment').insert(payload).select().single()
    }

    if (result.error) { setError(result.error.message); setLoading(false); return }

    const equipmentId = result.data.id
    // Assign to kit if selected
    if (selectedKit) {
      await supabase.from('kit_items').upsert({ kit_id: selectedKit, equipment_id: equipmentId }, { onConflict: 'kit_id,equipment_id' })
    }
    // Assign to case if selected
    if (selectedCase) {
      await supabase.from('case_items').upsert({ case_id: selectedCase, equipment_id: equipmentId }, { onConflict: 'case_id,equipment_id' })
    }

    onSaved(result.data)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{isEdit ? 'Modifica attrezzatura' : 'Nuova attrezzatura'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Foto</Label>
            <div className="flex items-center gap-4">
              {form.photo_url ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <Image src={form.photo_url} alt="foto" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Upload className="w-6 h-6" />
                </div>
              )}
              <div className="space-y-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadLoading}>
                  {uploadLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadLoading ? 'Caricamento…' : 'Carica foto'}
                </Button>
                <p className="text-[10px] text-muted-foreground">Max 800×800 · JPEG 70%</p>
                {form.photo_url && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => setField('photo_url', '')} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" /> Rimuovi
                  </Button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
              </div>
            </div>
          </div>

          {/* Name */}
          <Field label="Nome *">
            <Input value={form.name} onChange={(e) => setField('name', e.target.value)} required placeholder="Es. Sony A7S III" />
          </Field>

          {/* Brand + Model */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marca">
              <Input value={form.brand} onChange={(e) => setField('brand', e.target.value)} placeholder="Es. Sony" />
            </Field>
            <Field label="Modello">
              <Input value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="Es. ILCE-7SM3" />
            </Field>
          </div>

          {/* Serial + Scanner */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Numero seriale">
              <div className="relative">
                <Input
                  value={form.serial_number}
                  onChange={(e) => setField('serial_number', e.target.value)}
                  placeholder="Es. 1234567"
                  className={scanningSerial ? 'border-primary pr-9' : 'pr-9'}
                />
                <button
                  type="button"
                  onClick={() => setScanningSerial((v) => !v)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition ${scanningSerial ? 'text-primary scanner-active' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Scansiona seriale"
                >
                  <Scan className="w-4 h-4" />
                </button>
              </div>
              {scanningSerial && <p className="text-xs text-primary mt-1">Pronto — scansiona il barcode…</p>}
            </Field>
            <Field label="Categoria">
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none"
              >
                <option value="" disabled>Seleziona categoria</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Purchase date + Price */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data acquisto">
              <Input type="date" value={form.purchase_date} onChange={(e) => setField('purchase_date', e.target.value)} />
            </Field>
            <Field label="Valore acquisto (€)">
              <Input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => setField('purchase_price', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          {/* Market value + Insured value */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valore di mercato (€)">
              <Input type="number" step="0.01" min="0" value={form.market_value} onChange={(e) => setField('market_value', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Valore assicurato (€)">
              <Input type="number" step="0.01" min="0" value={form.insured_value} onChange={(e) => setField('insured_value', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          {/* Condition + Location */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Condizione">
              <select value={form.condition} onChange={(e) => setField('condition', e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none">
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <select value={form.location} onChange={(e) => setField('location', e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none">
                {LOCATIONS.map((l) => <option key={l.value} value={l.value} disabled={l.value === ''}>{l.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Useful life + Last checked */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vita utile (anni)">
              <Input type="number" min="1" max="50" value={form.useful_life_years} onChange={(e) => setField('useful_life_years', e.target.value)} placeholder="Es. 5" />
            </Field>
            <Field label="Ultimo controllo">
              <Input type="date" value={form.last_checked_at} onChange={(e) => setField('last_checked_at', e.target.value)} />
            </Field>
          </div>

          {/* Battery status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Stato batteria</Label>
            <div className="flex gap-2 flex-wrap">
              {BATTERY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('battery_status', value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                    form.battery_status === value ? BATTERY_STYLES[value] : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Kit / Case assignment */}
          {(kits.length > 0 || cases.length > 0) && (
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border">
              {kits.length > 0 && (
                <Field label="Aggiungi a Kit">
                  <select value={selectedKit} onChange={(e) => setSelectedKit(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none">
                    <option value="">Nessun kit</option>
                    {kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </Field>
              )}
              {cases.length > 0 && (
                <Field label="Aggiungi a Case">
                  <select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none">
                    <option value="">Nessun case</option>
                    {cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          {/* Notes */}
          <Field label="Note">
            <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={3} placeholder="Note aggiuntive…" className="resize-none" />
          </Field>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="border-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annulla</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea attrezzatura'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  )
}

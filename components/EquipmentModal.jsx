'use client'

import { useState, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { X, Upload, Loader2, Trash2, Battery, BatteryLow, BatteryCharging, Minus } from 'lucide-react'
import Image from 'next/image'

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

const BATTERY_OPTIONS = [
  { value: 'na', label: 'N/D', icon: Minus },
  { value: 'charged', label: 'Carica', icon: Battery },
  { value: 'charging', label: 'In carica', icon: BatteryCharging },
  { value: 'low', label: 'Scarica', icon: BatteryLow },
]

const BATTERY_STYLES = {
  na: 'bg-slate-700 text-slate-400 border-slate-600',
  charged: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  charging: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  low: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const EMPTY = {
  name: '',
  brand: '',
  model: '',
  serial_number: '',
  category: 'camera',
  purchase_date: '',
  purchase_price: '',
  market_value: '',
  insured_value: '',
  condition: 'active',
  battery_status: 'na',
  last_checked_at: '',
  notes: '',
  photo_url: '',
}

/** Compress image to max 800x800px, JPEG 70%, max ~200KB using Canvas API */
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Start at 70% quality, reduce if still too large
      const tryQuality = (q) => {
        canvas.toBlob(
          (blob) => {
            if (blob.size > 200 * 1024 && q > 0.3) {
              tryQuality(q - 0.1)
            } else {
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
              resolve(compressed)
            }
          },
          'image/jpeg',
          q
        )
      }
      tryQuality(0.7)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback: use original
    }
    img.src = url
  })
}

export default function EquipmentModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(
    item?.id
      ? {
          ...item,
          purchase_date: item.purchase_date?.slice(0, 10) || '',
          purchase_price: item.purchase_price || '',
          market_value: item.market_value || '',
          insured_value: item.insured_value || '',
          battery_status: item.battery_status || 'na',
          last_checked_at: item.last_checked_at ? item.last_checked_at.slice(0, 10) : '',
        }
      : EMPTY
  )
  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadLoading(true)
    setError('')

    let toUpload = file
    if (file.type.startsWith('image/')) {
      try {
        toUpload = await compressImage(file)
      } catch {
        // fallback to original
      }
    }

    const supabase = getSupabase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('equipment-photos')
      .upload(path, toUpload, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setError('Errore upload foto: ' + uploadError.message)
      setUploadLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('equipment-photos').getPublicUrl(path)
    set('photo_url', publicUrl)
    setUploadLoading(false)
    // reset input so same file can be re-selected
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
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      market_value: form.market_value ? parseFloat(form.market_value) : null,
      insured_value: form.insured_value ? parseFloat(form.insured_value) : null,
      condition: form.condition,
      battery_status: form.battery_status || 'na',
      last_checked_at: form.last_checked_at ? new Date(form.last_checked_at).toISOString() : null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
    }

    let result
    if (isEdit) {
      result = await supabase
        .from('equipment')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .select()
        .single()
    } else {
      result = await supabase.from('equipment').insert(payload).select().single()
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
    } else {
      onSaved(result.data)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Modifica attrezzatura' : 'Nuova attrezzatura'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Foto</label>
            <div className="flex items-center gap-4">
              {form.photo_url ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                  <Image src={form.photo_url} alt="foto" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                  <Upload className="w-6 h-6" />
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition disabled:opacity-50"
                >
                  {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadLoading ? 'Caricamento…' : 'Carica foto'}
                </button>
                <p className="text-[10px] text-slate-500 mt-1">Max 800×800px · JPEG 70%</p>
                {form.photo_url && (
                  <button
                    type="button"
                    onClick={() => set('photo_url', '')}
                    className="flex items-center gap-1 mt-1 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-3 h-3" /> Rimuovi
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
          </div>

          {/* Name */}
          <Field label="Nome" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="Es. Sony A7S III"
              className={inputClass}
            />
          </Field>

          {/* Brand + Model */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marca">
              <input type="text" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Es. Sony" className={inputClass} />
            </Field>
            <Field label="Modello">
              <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Es. ILCE-7SM3" className={inputClass} />
            </Field>
          </div>

          {/* Serial + Category */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Numero seriale">
              <input type="text" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Es. 1234567" className={inputClass} />
            </Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Purchase date + Price */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data acquisto">
              <input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Valore acquisto (€)">
              <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="0.00" className={inputClass} />
            </Field>
          </div>

          {/* Market value + Insured value */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valore di mercato (€)">
              <input type="number" step="0.01" min="0" value={form.market_value} onChange={(e) => set('market_value', e.target.value)} placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Valore assicurato (€)">
              <input type="number" step="0.01" min="0" value={form.insured_value} onChange={(e) => set('insured_value', e.target.value)} placeholder="0.00" className={inputClass} />
            </Field>
          </div>

          {/* Condition + Last checked */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Condizione">
              <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={inputClass}>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ultimo controllo">
              <input type="date" value={form.last_checked_at} onChange={(e) => set('last_checked_at', e.target.value)} className={inputClass} />
            </Field>
          </div>

          {/* Battery status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Stato batteria</label>
            <div className="flex gap-2 flex-wrap">
              {BATTERY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('battery_status', value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    form.battery_status === value
                      ? BATTERY_STYLES[value]
                      : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Field label="Note">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Note aggiuntive…"
              className={inputClass + ' resize-none'}
            />
          </Field>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea attrezzatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'

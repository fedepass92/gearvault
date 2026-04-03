'use client'

import { useState, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { X, Upload, Loader2, Trash2 } from 'lucide-react'
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

const EMPTY = {
  name: '',
  brand: '',
  model: '',
  serial_number: '',
  category: 'camera',
  purchase_date: '',
  purchase_price: '',
  market_value: '',
  condition: 'active',
  notes: '',
  photo_url: '',
}

export default function EquipmentModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(item?.id ? { ...item, purchase_date: item.purchase_date?.slice(0, 10) || '', purchase_price: item.purchase_price || '', market_value: item.market_value || '' } : EMPTY)
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
    const supabase = getSupabase()
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('equipment-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Errore upload foto: ' + uploadError.message)
      setUploadLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('equipment-photos').getPublicUrl(path)
    set('photo_url', publicUrl)
    setUploadLoading(false)
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
      condition: form.condition,
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
                {form.photo_url && (
                  <button
                    type="button"
                    onClick={() => set('photo_url', '')}
                    className="flex items-center gap-1 mt-1 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-3 h-3" /> Rimuovi
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
            </div>
          </div>

          {/* Name */}
          <Field label="Nome *" required>
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

          {/* Market value + Condition */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valore di mercato (€)">
              <input type="number" step="0.01" min="0" value={form.market_value} onChange={(e) => set('market_value', e.target.value)} placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Condizione">
              <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={inputClass}>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
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

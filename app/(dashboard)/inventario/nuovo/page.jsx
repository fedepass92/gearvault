'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { estimateMarketValue } from '@/lib/depreciation'
import { toast } from 'sonner'
import {
  ArrowLeft, Camera, Upload, Image as ImageIcon, X, Check,
  ChevronRight, Loader2, SkipForward, Package, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'camera',    label: 'Camera',      emoji: '📷' },
  { value: 'lens',      label: 'Obiettivo',   emoji: '🔭' },
  { value: 'audio',     label: 'Audio',       emoji: '🎙️' },
  { value: 'lighting',  label: 'Illuminazione', emoji: '💡' },
  { value: 'drone',     label: 'Drone',       emoji: '🚁' },
  { value: 'support',   label: 'Supporto',    emoji: '🔧' },
  { value: 'accessory', label: 'Accessorio',  emoji: '📦' },
  { value: 'altro',     label: 'Altro',       emoji: '❓' },
]

const CONDITIONS = [
  { value: 'active',  label: 'Ottimo — funziona perfettamente' },
  { value: 'active',  label: 'Buono — piccoli segni uso' },
  { value: 'repair',  label: 'Da riparare' },
  { value: 'retired', label: 'Ritirato' },
]

const CONDITIONS_SIMPLE = [
  { value: 'active',  label: 'Attivo / Disponibile' },
  { value: 'repair',  label: 'In riparazione' },
  { value: 'retired', label: 'Ritirato' },
]

const LOCATIONS = [
  { value: 'studio',   label: '🏢 Studio' },
  { value: 'campo',    label: '🌍 Campo' },
  { value: 'prestito', label: '🤝 In prestito' },
]

const TOTAL_STEPS = 6

// ── Autocomplete hook ──────────────────────────────────────────────────────────

function useAutocomplete(items, field, query, filterField = null, filterValue = null) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  const seen = new Set()
  return items
    .filter((item) => {
      if (filterField && filterValue && item[filterField] !== filterValue) return false
      return item[field]?.toLowerCase().includes(q)
    })
    .map((item) => item[field])
    .filter((v) => v && !seen.has(v) && seen.add(v))
    .slice(0, 6)
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 font-mono tabular-nums flex-shrink-0">
        {step} / {total}
      </span>
    </div>
  )
}

// ── AutocompleteInput ─────────────────────────────────────────────────────────

function AutocompleteInput({ label, value, onChange, suggestions, placeholder, inputMode = 'text', autoFocus = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    setOpen(suggestions.length > 0 && value.length > 0)
  }, [suggestions, value])

  return (
    <div className="relative space-y-1.5">
      {label && <Label>{label}</Label>}
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition border-b border-border/50 last:border-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function NuovaAttrezzaturaPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [sliding, setSliding] = useState(false)

  // Existing equipment for autocomplete
  const [existing, setExisting] = useState([])

  // Form data
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [insuredValue, setInsuredValue] = useState('')
  const [autoEstimate, setAutoEstimate] = useState(true)
  const [serialNumber, setSerialNumber] = useState('')
  const [condition, setCondition] = useState('active')
  const [location, setLocation] = useState('studio')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Load existing equipment for autocomplete
  useEffect(() => {
    getSupabase()
      .from('equipment')
      .select('name, brand, model, category')
      .order('name')
      .then(({ data }) => setExisting(data || []))
  }, [])

  // Autocomplete suggestions
  const nameSuggestions  = useAutocomplete(existing, 'name',  name,  'category', category || null)
  const brandSuggestions = useAutocomplete(existing, 'brand', brand)
  const modelSuggestions = useAutocomplete(existing, 'model', model, 'brand', brand || null)

  // Live market estimate
  const liveEstimate = autoEstimate && purchasePrice && purchaseDate && category
    ? estimateMarketValue({ purchase_price: purchasePrice, purchase_date: purchaseDate, category, condition })
    : null

  // ── Navigation ────────────────────────────────────────────────────────────────
  function goTo(next) {
    setSliding(true)
    setTimeout(() => {
      setStep(next)
      setSliding(false)
    }, 120)
  }

  function back() {
    if (step === 1) { router.back(); return }
    goTo(step - 1)
  }

  function next() {
    goTo(step + 1)
  }

  // ── Photo handling ─────────────────────────────────────────────────────────────
  function handlePhoto(file) {
    if (!file) return
    setPhotoFile(file)
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
    next()
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { toast.error('Il nome è obbligatorio'); return }
    setSaving(true)

    const supabase = getSupabase()
    let photo_url = null

    // Upload photo
    if (photoFile) {
      try {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('equipment-photos')
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('equipment-photos').getPublicUrl(path)
          photo_url = publicUrl
        } else {
          console.warn('Photo upload error:', upErr)
        }
      } catch (err) {
        console.warn('Photo upload failed:', err)
      }
    }

    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      category: category || null,
      serial_number: serialNumber.trim() || null,
      condition,
      location,
      notes: notes.trim() || null,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
      purchase_date: purchaseDate || null,
      insured_value: insuredValue ? parseFloat(insuredValue) : null,
      market_value: liveEstimate ?? null,
      photo_url,
    }

    const { error } = await supabase.from('equipment').insert(payload)
    setSaving(false)

    if (error) {
      toast.error(error.message || 'Errore nel salvataggio')
      return
    }

    goTo(TOTAL_STEPS + 1) // success screen
  }

  // ── Render steps ──────────────────────────────────────────────────────────────
  const contentClass = `transition-opacity duration-120 ${sliding ? 'opacity-0' : 'opacity-100'}`

  return (
    <div className="-m-4 lg:-m-6 min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-1">
        <button
          onClick={back}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Nuova attrezzatura</h1>
      </div>

      {step <= TOTAL_STEPS && <ProgressBar step={step} total={TOTAL_STEPS} />}

      <div className={`flex-1 flex flex-col px-4 pb-8 ${contentClass}`}>

        {/* ── STEP 1: Foto ── */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-5 pt-4">
            <div className="text-center">
              <p className="text-lg font-bold mb-1">Aggiungi una foto</p>
              <p className="text-sm text-slate-400">Opzionale — puoi aggiungerla dopo</p>
            </div>

            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="preview" className="w-56 h-56 rounded-2xl object-cover border border-border" />
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
              </div>
            )}

            <div className="w-full space-y-3">
              <Button
                variant="outline"
                className="w-full py-6 text-base"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-5 h-5 text-primary" />
                Scatta foto
              </Button>
              <Button
                variant="outline"
                className="w-full py-6 text-base"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                Carica da libreria
              </Button>
              {photoPreview && (
                <Button className="w-full py-6 text-base font-bold" onClick={next}>
                  <ChevronRight className="w-5 h-5" />
                  Continua
                </Button>
              )}
              <button
                onClick={next}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition"
              >
                <SkipForward className="w-4 h-4" />
                Salta — aggiungi foto dopo
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
          </div>
        )}

        {/* ── STEP 2: Categoria ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5 pt-4">
            <div className="text-center">
              <p className="text-lg font-bold mb-1">Che tipo di attrezzatura è?</p>
              <p className="text-sm text-slate-400">Tocca per selezionare</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => { setCategory(cat.value); next() }}
                  className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border text-base font-medium transition ${
                    category === cat.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:border-muted-foreground/50 text-foreground'
                  }`}
                >
                  <span className="text-3xl">{cat.emoji}</span>
                  <span className="text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Nome, Brand, Modello ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <p className="text-lg font-bold mb-1">Nome e marca</p>
              {category && (
                <p className="text-sm text-slate-400">
                  {CATEGORIES.find((c) => c.value === category)?.emoji}{' '}
                  {CATEGORIES.find((c) => c.value === category)?.label}
                </p>
              )}
            </div>
            <AutocompleteInput
              label="Nome item *"
              value={name}
              onChange={setName}
              suggestions={nameSuggestions}
              placeholder="es. Sony A7 IV"
              autoFocus
            />
            <AutocompleteInput
              label="Brand"
              value={brand}
              onChange={setBrand}
              suggestions={brandSuggestions}
              placeholder="es. Sony, Canon, DJI…"
            />
            <AutocompleteInput
              label="Modello"
              value={model}
              onChange={setModel}
              suggestions={modelSuggestions}
              placeholder="es. A7 IV, EOS R5…"
            />
            <Button
              className="w-full py-6 text-base font-bold mt-2"
              onClick={next}
              disabled={!name.trim()}
            >
              Continua
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* ── STEP 4: Dati economici ── */}
        {step === 4 && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <p className="text-lg font-bold mb-1">Dati economici</p>
              <p className="text-sm text-slate-400">Opzionale — utile per report e ammortamento</p>
            </div>

            <div className="space-y-1.5">
              <Label>Prezzo di acquisto (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="es. 2499.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data di acquisto</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Valore assicurato (€) — opzionale</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={insuredValue}
                onChange={(e) => setInsuredValue(e.target.value)}
                placeholder="es. 2000.00"
              />
            </div>

            {/* Auto-estimate toggle */}
            <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer">
              <input
                type="checkbox"
                checked={autoEstimate}
                onChange={(e) => setAutoEstimate(e.target.checked)}
                className="mt-0.5 accent-orange-500 w-4 h-4 flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  Stima valore di mercato automatica
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Usa il tasso di ammortamento per categoria per stimare il valore attuale
                </p>
                {liveEstimate != null && (
                  <p className="text-sm text-orange-400 font-semibold mt-1.5">
                    Stima: € {liveEstimate.toLocaleString('it-IT')}
                  </p>
                )}
                {autoEstimate && (!purchasePrice || !purchaseDate || !category) && (
                  <p className="text-xs text-slate-500 mt-1">
                    Inserisci prezzo, data e categoria per vedere la stima
                  </p>
                )}
              </div>
            </label>

            <div className="flex gap-3 mt-2">
              <Button className="flex-1 py-6 text-base font-bold" onClick={next}>
                Continua
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" className="px-5 py-6 text-sm" onClick={() => goTo(6)}>
                Salta
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Dettagli aggiuntivi ── */}
        {step === 5 && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <p className="text-lg font-bold mb-1">Dettagli aggiuntivi</p>
              <p className="text-sm text-slate-400">Tutti opzionali</p>
            </div>

            <div className="space-y-1.5">
              <Label>Numero seriale</Label>
              <Input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="es. SN-1234567890"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Condizione</Label>
              <div className="space-y-2">
                {CONDITIONS_SIMPLE.map((c) => (
                  <label key={c.value + c.label} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    condition === c.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}>
                    <input
                      type="radio"
                      name="condition"
                      value={c.value}
                      checked={condition === c.value}
                      onChange={() => setCondition(c.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <div className="grid grid-cols-3 gap-2">
                {LOCATIONS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLocation(l.value)}
                    className={`py-3 rounded-xl border text-sm font-medium transition ${
                      location === l.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note aggiuntive…"
                rows={3}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition resize-none"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <Button className="flex-1 py-6 text-base font-bold" onClick={next}>
                Continua
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" className="px-5 py-6 text-sm" onClick={next}>
                Salta
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Riepilogo + Salva ── */}
        {step === 6 && (
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-lg font-bold">Riepilogo</p>

            {/* Photo + name */}
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-muted">
                  <Package className="w-12 h-12 text-slate-600" />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xl font-bold">{name || '—'}</p>
                  {(brand || model) && (
                    <p className="text-sm text-slate-400 mt-0.5">{[brand, model].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {category && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Categoria</p>
                      <p className="text-slate-200">{CATEGORIES.find((c) => c.value === category)?.label}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Condizione</p>
                    <p className="text-slate-200">{CONDITIONS_SIMPLE.find((c) => c.value === condition)?.label}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Location</p>
                    <p className="text-slate-200">{LOCATIONS.find((l) => l.value === location)?.label}</p>
                  </div>
                  {serialNumber && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Seriale</p>
                      <p className="text-slate-200 font-mono text-xs">{serialNumber}</p>
                    </div>
                  )}
                </div>
                {(purchasePrice || purchaseDate || insuredValue) && (
                  <div className="pt-3 border-t border-border grid grid-cols-2 gap-3 text-sm">
                    {purchasePrice && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Acquisto</p>
                        <p className="text-slate-200">€ {parseFloat(purchasePrice).toLocaleString('it-IT')}</p>
                      </div>
                    )}
                    {liveEstimate != null && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Stima mercato</p>
                        <p className="text-orange-400 font-semibold">€ {liveEstimate.toLocaleString('it-IT')}</p>
                      </div>
                    )}
                    {insuredValue && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Assicurato</p>
                        <p className="text-slate-200">€ {parseFloat(insuredValue).toLocaleString('it-IT')}</p>
                      </div>
                    )}
                    {purchaseDate && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Data acquisto</p>
                        <p className="text-slate-200">{new Date(purchaseDate).toLocaleDateString('it-IT')}</p>
                      </div>
                    )}
                  </div>
                )}
                {notes && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Note</p>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </div>
            </div>

            <Button
              className="w-full py-6 text-base font-bold"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {saving ? 'Salvataggio…' : 'Salva attrezzatura'}
            </Button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === TOTAL_STEPS + 1 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-9 h-9 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold mb-2">Aggiunto!</p>
              <p className="text-foreground font-medium">{name}</p>
              {brand && <p className="text-sm text-slate-400 mt-0.5">{[brand, model].filter(Boolean).join(' · ')}</p>}
            </div>
            <div className="w-full space-y-3">
              <Button
                className="w-full py-6 text-base font-bold"
                onClick={() => {
                  setStep(1); setPhotoFile(null); setPhotoPreview(null)
                  setCategory(''); setName(''); setBrand(''); setModel('')
                  setPurchasePrice(''); setPurchaseDate(''); setInsuredValue('')
                  setSerialNumber(''); setCondition('active'); setLocation('studio')
                  setNotes(''); setAutoEstimate(true)
                }}
              >
                <Package className="w-5 h-5" />
                Aggiungi un&apos;altra
              </Button>
              <Button
                variant="outline"
                className="w-full py-6 text-base"
                onClick={() => router.push('/inventario')}
              >
                Vai all&apos;inventario
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

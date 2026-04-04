'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'
import EquipmentModal from '@/components/EquipmentModal'
import {
  Plus, Search, Pencil, Trash2, Loader2, ImageOff,
  Download, Upload, Battery, BatteryLow, BatteryCharging,
  Minus, AlertTriangle, CheckCircle2, Package, MapPin, Clock,
  Layers, Box, TrendingUp, ArrowUpDown, ChevronRight,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import Papa from 'papaparse'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'all', label: 'Tutte le categorie' },
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
  { value: 'all', label: 'Tutte le condizioni' },
  { value: 'active', label: 'Attivo' },
  { value: 'repair', label: 'In riparazione' },
  { value: 'retired', label: 'Ritirato' },
]

const LOCATIONS = [
  { value: 'all', label: 'Tutte le location' },
  { value: 'studio', label: 'Studio' },
  { value: 'campo', label: 'Campo' },
  { value: 'prestito', label: 'Prestito' },
]

const CONDITION_LABEL = { active: 'Attivo', repair: 'Riparazione', retired: 'Ritirato' }
const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}
const BATTERY_ICON = { charged: Battery, charging: BatteryCharging, low: BatteryLow, na: Minus }
const BATTERY_COLOR = {
  charged: 'text-emerald-400', charging: 'text-blue-400', low: 'text-red-400', na: 'text-muted-foreground',
}
const BATTERY_LABEL = { charged: 'Carica', charging: 'In carica', low: 'Scarica', na: '—' }

const LOCATION_BADGE = {
  studio: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  campo: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  prestito: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
}
const LOCATION_LABEL = { studio: 'Studio', campo: 'Campo', prestito: 'Prestito' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function needsMaintenance(item) {
  if (!item.last_checked_at) return true
  return differenceInDays(new Date(), new Date(item.last_checked_at)) > 90
}

function fmtEur(v) {
  if (v == null || v === '' || isNaN(parseFloat(v))) return '—'
  return `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
}

function calcDepreciation(item) {
  if (!item.useful_life_years || !item.purchase_date || !item.purchase_price) return null
  const yearsElapsed = differenceInDays(new Date(), new Date(item.purchase_date)) / 365
  const pct = Math.min(100, (yearsElapsed / item.useful_life_years) * 100)
  const residual = parseFloat(item.purchase_price) * Math.max(0, 1 - yearsElapsed / item.useful_life_years)
  return { pct: Math.round(pct), residual }
}

function exportCSV(equipment) {
  const headers = [
    'Nome', 'Marca', 'Modello', 'Seriale', 'Categoria', 'Condizione', 'Location',
    'Data Acquisto', 'Valore Acquisto (€)', 'Valore Mercato (€)', 'Valore Assicurato (€)',
    'Stato Batteria', 'Ultimo Controllo', 'Vita Utile (anni)', 'Note',
  ]
  const rows = equipment.map((e) => [
    e.name || '',
    e.brand || '',
    e.model || '',
    e.serial_number || '',
    CATEGORY_LABELS[e.category] || e.category || '',
    CONDITION_LABEL[e.condition] || e.condition || '',
    LOCATION_LABEL[e.location] || e.location || '',
    e.purchase_date ? format(new Date(e.purchase_date), 'dd/MM/yyyy') : '',
    e.purchase_price != null ? parseFloat(e.purchase_price).toFixed(2) : '',
    e.market_value != null ? parseFloat(e.market_value).toFixed(2) : '',
    e.insured_value != null ? parseFloat(e.insured_value).toFixed(2) : '',
    BATTERY_LABEL[e.battery_status] || '',
    e.last_checked_at ? format(new Date(e.last_checked_at), 'dd/MM/yyyy') : '',
    e.useful_life_years || '',
    (e.notes || '').replace(/"/g, '""'),
  ])

  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GearVault_Inventario_${format(new Date(), 'yyyyMMdd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// CSV column → DB field mapping
const CSV_MAP = {
  'nome': 'name', 'marca': 'brand', 'modello': 'model', 'seriale': 'serial_number',
  'note': 'notes',
}

function parseCSVRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase().trim()
    if (CSV_MAP[key]) out[CSV_MAP[key]] = v
    else if (key.includes('acquisto') && key.includes('€')) out.purchase_price = parseFloat(v.replace(',', '.')) || null
    else if (key.includes('mercato')) out.market_value = parseFloat(v.replace(',', '.')) || null
    else if (key.includes('assicurato')) out.insured_value = parseFloat(v.replace(',', '.')) || null
    else if (key.includes('data acquisto')) {
      const parts = v.split('/')
      if (parts.length === 3) out.purchase_date = `${parts[2]}-${parts[1]}-${parts[0]}`
    } else if (key.includes('vita utile')) out.useful_life_years = parseInt(v) || null
    else if (key.includes('categoria')) {
      const found = Object.entries(CATEGORY_LABELS).find(([, label]) => label.toLowerCase() === v.toLowerCase())
      out.category = found ? found[0] : v.toLowerCase()
    } else if (key.includes('condizione')) {
      const found = Object.entries(CONDITION_LABEL).find(([, label]) => label.toLowerCase() === v.toLowerCase())
      out.condition = found ? found[0] : 'active'
    } else if (key.includes('location')) {
      const found = Object.entries(LOCATION_LABEL).find(([, label]) => label.toLowerCase() === v.toLowerCase())
      out.location = found ? found[0] : 'studio'
    }
  }
  return out
}

// ─── Item Detail Modal ─────────────────────────────────────────────────────────

function ItemDetailModal({ item, onClose, onEdit, onDelete }) {
  const [priceHistory, setPriceHistory] = useState([])
  const [movements, setMovements] = useState([])
  const [memberships, setMemberships] = useState({ sets: [], kits: [], cases: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!item) return
    async function load() {
      const supabase = getSupabase()
      const [ph, mv, si, ki, ci] = await Promise.all([
        supabase.from('price_history').select('*').eq('equipment_id', item.id).order('date'),
        supabase.from('movement_log').select('*, sets(name)').eq('equipment_id', item.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('set_items').select('*, sets(id, name, job_date)').eq('equipment_id', item.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('kit_items').select('*, kits(id, name)').eq('equipment_id', item.id),
        supabase.from('case_items').select('*, cases(id, name)').eq('equipment_id', item.id),
      ])
      setPriceHistory(ph.data || [])
      setMovements(mv.data || [])
      setMemberships({
        sets: (si.data || []).filter((s) => s.sets),
        kits: (ki.data || []).filter((k) => k.kits),
        cases: (ci.data || []).filter((c) => c.cases),
      })
      setLoading(false)
    }
    load()
  }, [item])

  if (!item) return null

  const depr = calcDepreciation(item)
  const maintenance = needsMaintenance(item)
  const chartData = priceHistory.map((p) => ({
    date: format(new Date(p.date), 'MMM yy', { locale: it }),
    valore: parseFloat(p.value),
    note: p.note,
  }))

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {item.photo_url ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-card shrink-0">
                  <Image src={item.photo_url} alt={item.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold truncate">{item.name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[item.brand, item.model].filter(Boolean).join(' · ') || 'Nessuna marca/modello'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {item.category && (
                    <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs border ${
                      item.condition === 'active' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                      : item.condition === 'repair' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                      : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {CONDITION_LABEL[item.condition] || item.condition}
                  </Badge>
                  {item.location && (
                    <Badge variant="outline" className={`text-xs border ${LOCATION_BADGE[item.location] || ''}`}>
                      <MapPin className="w-2.5 h-2.5 mr-1" />
                      {LOCATION_LABEL[item.location] || item.location}
                    </Badge>
                  )}
                  {maintenance && (
                    <Badge variant="outline" className="text-xs border bg-red-500/15 text-red-400 border-red-500/20">
                      <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                      {item.last_checked_at
                        ? `${differenceInDays(new Date(), new Date(item.last_checked_at))}gg senza controllo`
                        : 'Mai controllato'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <Tabs defaultValue="dettagli" className="w-full">
            <div className="px-5 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="dettagli" className="flex-1">Dettagli</TabsTrigger>
                <TabsTrigger value="storico" className="flex-1">Storico</TabsTrigger>
                <TabsTrigger value="appartenenza" className="flex-1">Appartenenza</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Dettagli ── */}
            <TabsContent value="dettagli" className="px-5 pb-5 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Seriale" value={item.serial_number} mono />
                <DetailField label="Categoria" value={CATEGORY_LABELS[item.category] || item.category} />
                <DetailField label="Data acquisto" value={item.purchase_date ? format(new Date(item.purchase_date), 'd MMM yyyy', { locale: it }) : null} />
                <DetailField label="Vita utile" value={item.useful_life_years ? `${item.useful_life_years} anni` : null} />
                <DetailField label="Val. acquisto" value={fmtEur(item.purchase_price)} />
                <DetailField label="Val. mercato" value={fmtEur(item.market_value)} />
                <DetailField label="Val. assicurato" value={fmtEur(item.insured_value)} />
                <DetailField
                  label="Batteria"
                  value={BATTERY_LABEL[item.battery_status] || '—'}
                  valueClass={BATTERY_COLOR[item.battery_status]}
                />
                <DetailField
                  label="Ult. controllo"
                  value={item.last_checked_at ? format(new Date(item.last_checked_at), 'd MMM yyyy', { locale: it }) : null}
                  fallback="Mai controllato"
                />
              </div>

              {depr && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Ammortamento</p>
                    <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Deprezzamento</span>
                        <span className="font-medium text-amber-400">{depr.pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${depr.pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Valore residuo stimato</span>
                        <span className="font-semibold text-foreground">{fmtEur(depr.residual)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {item.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{item.notes}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Storico ── */}
            <TabsContent value="storico" className="px-5 pb-5 pt-4 space-y-5">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {chartData.length > 1 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Storico prezzi
                      </p>
                      <div className="bg-card rounded-lg border border-border p-3">
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.38 0.025 263 / 40%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'oklch(0.67 0.02 263)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'oklch(0.67 0.02 263)' }} tickFormatter={(v) => `€${v}`} width={55} />
                            <Tooltip
                              contentStyle={{ background: 'oklch(0.265 0.027 263)', border: '1px solid oklch(0.38 0.025 263 / 60%)', borderRadius: '8px', fontSize: '12px' }}
                              formatter={(v) => [`€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Valore']}
                            />
                            <Line type="monotone" dataKey="valore" stroke="oklch(0.546 0.22 264)" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Movimenti recenti
                    </p>
                    {movements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessun movimento registrato</p>
                    ) : (
                      <div className="space-y-1.5">
                        {movements.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${m.action === 'checkout' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                              <span className="font-medium">{m.action === 'checkout' ? 'Uscita' : 'Rientro'}</span>
                              {m.sets?.name && <span className="text-muted-foreground">· {m.sets.name}</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(m.created_at), 'd MMM yy', { locale: it })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Appartenenza ── */}
            <TabsContent value="appartenenza" className="px-5 pb-5 pt-4 space-y-5">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <MembershipSection
                    title="Set" icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                    items={memberships.sets.map((s) => ({
                      id: s.sets.id,
                      name: s.sets.name,
                      sub: s.sets.job_date ? format(new Date(s.sets.job_date), 'd MMM yyyy', { locale: it }) : null,
                    }))}
                    emptyLabel="Non assegnato a nessun set"
                  />
                  <MembershipSection
                    title="Kit" icon={<Layers className="w-3.5 h-3.5" />}
                    items={memberships.kits.map((k) => ({ id: k.kits.id, name: k.kits.name }))}
                    emptyLabel="Non assegnato a nessun kit"
                  />
                  <MembershipSection
                    title="Case" icon={<Box className="w-3.5 h-3.5" />}
                    items={memberships.cases.map((c) => ({ id: c.cases.id, name: c.cases.name }))}
                    emptyLabel="Non assegnato a nessun case"
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/30 rounded-b-xl flex-row gap-2 justify-end">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            Elimina
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
            Modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailField({ label, value, mono = false, valueClass = '', fallback = '—' }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium ${valueClass || 'text-foreground'} ${mono ? 'font-mono' : ''} ${!value ? 'text-muted-foreground' : ''}`}>
        {value || fallback}
      </p>
    </div>
  )
}

function MembershipSection({ title, icon, items, emptyLabel }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
              <span className="font-medium">{item.name}</span>
              {item.sub && <span className="text-xs text-muted-foreground">{item.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────

function CSVImportModal({ open, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data?.length) { setError('File vuoto o non valido'); return }
        setHeaders(Object.keys(result.data[0]))
        setRows(result.data)
      },
      error: () => setError('Errore nella lettura del file CSV'),
    })
  }

  async function handleImport() {
    setImporting(true)
    const supabase = getSupabase()
    const mapped = rows.map(parseCSVRow).filter((r) => r.name)
    if (!mapped.length) { setError('Nessuna riga valida (colonna "Nome" obbligatoria)'); setImporting(false); return }

    const { error: err } = await supabase.from('equipment').insert(mapped)
    if (err) { setError(`Errore: ${err.message}`); setImporting(false); return }

    setRows([])
    setHeaders([])
    setImporting(false)
    onImported()
    onClose()
  }

  function handleClose() {
    setRows([])
    setHeaders([])
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle>Importa da CSV</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Colonne supportate: Nome*, Marca, Modello, Seriale, Categoria, Condizione, Location, Data Acquisto (gg/mm/aaaa), Valore Acquisto (€), Valore Mercato (€), Valore Assicurato (€), Vita Utile (anni), Note
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" />
              Scegli file CSV
            </Button>
            {rows.length > 0 && (
              <span className="text-sm text-muted-foreground">{rows.length} righe trovate</span>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          {rows.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {headers.slice(0, 7).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                      {headers.length > 7 && <th className="px-3 py-2 text-muted-foreground">…</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/50">
                        {headers.slice(0, 7).map((h) => (
                          <td key={h} className="px-3 py-2 text-foreground max-w-[120px] truncate">{row[h] || ''}</td>
                        ))}
                        {headers.length > 7 && <td className="px-3 py-2 text-muted-foreground">…</td>}
                      </tr>
                    ))}
                    {rows.length > 10 && (
                      <tr>
                        <td colSpan={Math.min(headers.length, 8)} className="px-3 py-2 text-center text-muted-foreground">
                          + {rows.length - 10} altre righe
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/30 rounded-b-xl flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Annulla</Button>
          <Button
            onClick={handleImport}
            disabled={!rows.length || importing}
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            Importa {rows.length > 0 ? `${rows.length} righe` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [editModal, setEditModal] = useState(null)       // null | 'new' | item
  const [detailItem, setDetailItem] = useState(null)     // item for detail modal
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [recentlyChecked, setRecentlyChecked] = useState({}) // { [id]: true }

  const fetchEquipment = useCallback(async () => {
    const supabase = getSupabase()
    let q = supabase.from('equipment').select('*').order('created_at', { ascending: false })
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter)
    if (conditionFilter !== 'all') q = q.eq('condition', conditionFilter)
    if (locationFilter !== 'all') q = q.eq('location', locationFilter)
    if (search) q = q.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`)
    const { data } = await q
    setEquipment(data || [])
    setLoading(false)
  }, [search, categoryFilter, conditionFilter, locationFilter])

  useEffect(() => { fetchEquipment() }, [fetchEquipment])

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

  async function handleControllato(item, e) {
    e.stopPropagation()
    const supabase = getSupabase()
    const now = new Date().toISOString()
    await supabase.from('equipment').update({ last_checked_at: now }).eq('id', item.id)
    setEquipment((prev) => prev.map((eq) => eq.id === item.id ? { ...eq, last_checked_at: now } : eq))
    setRecentlyChecked((prev) => ({ ...prev, [item.id]: true }))
    setTimeout(() => setRecentlyChecked((prev) => { const n = { ...prev }; delete n[item.id]; return n }), 2500)
  }

  async function handleDelete(item) {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('equipment').delete().eq('id', item.id)
    setDeleteConfirm(null)
    setDetailItem(null)
    setDeleting(false)
    fetchEquipment()
  }

  const maintenanceCount = equipment.filter(needsMaintenance).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Inventario</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-muted-foreground text-sm">{equipment.length} attrezzature</p>
            {maintenanceCount > 0 && (
              <Badge variant="outline" className="text-xs border bg-red-500/15 text-red-400 border-red-500/20">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {maintenanceCount} da controllare
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportCSV(equipment)} disabled={equipment.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Esporta CSV</span>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importa CSV</span>
              </Button>
              <Button size="sm" onClick={() => setEditModal('new')}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuova</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, marca, seriale…"
            className="pl-8 h-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[150px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-auto min-w-[150px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : equipment.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessuna attrezzatura trovata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Marca / Modello</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Seriale</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Location</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Batteria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Val. Mercato</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stato</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {equipment.map((item) => {
                  const BattIcon = BATTERY_ICON[item.battery_status] || Minus
                  const maintenance = needsMaintenance(item)
                  const justChecked = recentlyChecked[item.id]

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition cursor-pointer"
                      onClick={() => setDetailItem(item)}
                    >
                      <td className="px-4 py-3">
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {item.photo_url ? (
                            <Image src={item.photo_url} alt={item.name} width={36} height={36} className="object-cover w-full h-full" />
                          ) : (
                            <ImageOff className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          {maintenance && !justChecked && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-card" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-none">{item.name}</div>
                        {maintenance && !justChecked && (
                          <div className="text-[10px] text-red-400 flex items-center gap-0.5 mt-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {item.last_checked_at
                              ? `${differenceInDays(new Date(), new Date(item.last_checked_at))}gg fa`
                              : 'Mai controllato'}
                          </div>
                        )}
                        {justChecked && (
                          <div className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Controllato ora
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {[item.brand, item.model].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground font-mono text-xs">
                        {item.serial_number || '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {item.location ? (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${LOCATION_BADGE[item.location] || ''}`}>
                            <MapPin className="w-2.5 h-2.5" />
                            {LOCATION_LABEL[item.location] || item.location}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-center">
                        <span title={BATTERY_LABEL[item.battery_status]}>
                          <BattIcon className={`w-4 h-4 mx-auto ${BATTERY_COLOR[item.battery_status] || 'text-muted-foreground'}`} />
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-right text-xs">
                        {item.market_value ? fmtEur(item.market_value) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                          item.condition === 'active' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                          : item.condition === 'repair' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {CONDITION_LABEL[item.condition] || item.condition}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className="flex items-center gap-0.5 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleControllato(item, e)}
                            title="Segna come controllato"
                            className={`p-1.5 rounded-lg transition ${justChecked ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditModal(item) }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item) }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => { setEditModal(detailItem); setDetailItem(null) }}
          onDelete={() => { setDeleteConfirm(detailItem); setDetailItem(null) }}
        />
      )}

      {/* Edit / New Modal */}
      {editModal && (
        <EquipmentModal
          item={editModal === 'new' ? null : editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchEquipment() }}
        />
      )}

      {/* CSV Import Modal */}
      <CSVImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchEquipment}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina attrezzatura</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong className="text-foreground">{deleteConfirm?.name}</strong>? L&apos;operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleDelete(deleteConfirm)}
              disabled={deleting}
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

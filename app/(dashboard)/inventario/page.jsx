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
  Square, CheckSquare, X, Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
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

        {/* ── Hero photo banner ── */}
        {item.photo_url ? (
          <div className="relative w-full h-48 shrink-0 overflow-hidden rounded-t-xl bg-muted">
            <Image src={item.photo_url} alt={item.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <DialogTitle className="text-lg font-bold text-white leading-tight">{item.name}</DialogTitle>
              <p className="text-sm text-white/70 mt-0.5">
                {[item.brand, item.model].filter(Boolean).join(' · ') || ''}
              </p>
            </div>
          </div>
        ) : (
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold">{item.name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[item.brand, item.model].filter(Boolean).join(' · ') || 'Nessuna marca/modello'}
                </p>
              </div>
            </div>
          </DialogHeader>
        )}

        {/* ── Badge row ── */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 border-b border-border bg-muted/30">
          {item.category && (
            <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[item.category] || item.category}</Badge>
          )}
          <Badge
            variant="outline"
            className={`text-xs border ${
              item.condition === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
              : item.condition === 'repair' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
              : 'bg-muted text-muted-foreground'
            }`}
          >
            {item.condition === 'active' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
            {CONDITION_LABEL[item.condition] || item.condition}
          </Badge>
          {item.location && (
            <Badge variant="outline" className={`text-xs border ${LOCATION_BADGE[item.location] || ''}`}>
              <MapPin className="w-2.5 h-2.5 mr-1" />
              {LOCATION_LABEL[item.location] || item.location}
            </Badge>
          )}
          {maintenance && (
            <Badge variant="outline" className="text-xs border bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30">
              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
              {item.last_checked_at
                ? `${differenceInDays(new Date(), new Date(item.last_checked_at))}gg senza controllo`
                : 'Mai controllato'}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <Tabs defaultValue="dettagli" className="w-full">
            {/* ── Tabs header ── */}
            <div className="sticky top-0 z-10 bg-background border-b border-border px-5 pt-3 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 w-full justify-start rounded-none">
                {[
                  { value: 'dettagli', label: 'Dettagli' },
                  { value: 'storico', label: 'Storico' },
                  { value: 'appartenenza', label: 'Appartenenza' },
                ].map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="relative rounded-none bg-transparent px-4 pb-3 pt-1 font-medium text-sm text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full data-[state=active]:after:bg-primary"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── Dettagli ── */}
            <TabsContent value="dettagli" className="px-5 pb-5 pt-5 space-y-5 mt-0">
              {/* Identificazione */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Identificazione</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField label="Numero seriale" value={item.serial_number} mono />
                  <DetailField label="Categoria" value={CATEGORY_LABELS[item.category] || item.category} />
                </div>
              </div>

              <Separator />

              {/* Valori */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Valori economici</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                  <DetailField label="Prezzo acquisto" value={fmtEur(item.purchase_price)} />
                  <DetailField label="Valore di mercato" value={fmtEur(item.market_value)} />
                  <DetailField label="Valore assicurato" value={fmtEur(item.insured_value)} />
                  <DetailField label="Data acquisto" value={item.purchase_date ? format(new Date(item.purchase_date), 'd MMM yyyy', { locale: it }) : null} />
                  <DetailField label="Vita utile" value={item.useful_life_years ? `${item.useful_life_years} anni` : null} />
                </div>
              </div>

              <Separator />

              {/* Stato */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stato operativo</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField
                    label="Stato batteria"
                    value={BATTERY_LABEL[item.battery_status] || '—'}
                    valueClass={BATTERY_COLOR[item.battery_status]}
                  />
                  <DetailField
                    label="Ultimo controllo"
                    value={item.last_checked_at ? format(new Date(item.last_checked_at), 'd MMM yyyy', { locale: it }) : null}
                    fallback="Mai controllato"
                    valueClass={maintenance ? 'text-red-500 dark:text-red-400' : ''}
                  />
                </div>
              </div>

              {depr && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ammortamento</p>
                    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Deprezzamento accumulato</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">{depr.pct}%</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${depr.pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm pt-1">
                        <span className="text-muted-foreground">Valore residuo stimato</span>
                        <span className="font-bold text-foreground text-base">{fmtEur(depr.residual)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {item.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Storico ── */}
            <TabsContent value="storico" className="px-5 pb-5 pt-5 space-y-5 mt-0">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {chartData.length > 1 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Andamento valore
                      </p>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `€${v}`} width={55} />
                            <Tooltip
                              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                              formatter={(v) => [`€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Valore']}
                            />
                            <Line type="monotone" dataKey="valore" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <AddPriceForm itemId={item.id} onAdded={() => {
                    getSupabase().from('price_history').select('*').eq('equipment_id', item.id).order('date')
                      .then(({ data }) => { if (data) setPriceHistory(data) })
                  }} />

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Movimenti recenti
                    </p>
                    {movements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessun movimento registrato</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {movements.map((m) => (
                          <div key={m.id} className="flex items-center justify-between py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${m.action === 'checkout' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                              <span className="text-sm font-medium">{m.action === 'checkout' ? 'Uscita' : 'Rientro'}</span>
                              {m.sets?.name && <span className="text-sm text-muted-foreground">· {m.sets.name}</span>}
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
            <TabsContent value="appartenenza" className="px-5 pb-5 pt-5 space-y-5 mt-0">
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
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${valueClass || 'text-foreground'} ${mono ? 'font-mono tracking-wide' : ''} ${!value ? 'text-muted-foreground font-normal' : ''}`}>
        {value || fallback}
      </p>
    </div>
  )
}

function MembershipSection({ title, icon, items, emptyLabel }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon} {title}
        <span className="ml-1 text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors">
              <span className="font-medium">{item.name}</span>
              {item.sub && <span className="text-xs text-muted-foreground">{item.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort, align = 'left' }) {
  const active = sortField === field
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 uppercase tracking-wider text-xs font-medium transition hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'} ${align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''}`}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 flex-shrink-0 ${active ? 'text-primary' : 'opacity-40'}`} />
    </button>
  )
}

// ─── Add Price Form ───────────────────────────────────────────────────────────

function AddPriceForm({ itemId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!value) return
    setSaving(true)
    const supabase = getSupabase()
    await supabase.from('price_history').insert({
      equipment_id: itemId,
      value: parseFloat(value),
      date,
      note: note || null,
    })
    setValue(''); setNote('')
    setDate(new Date().toISOString().slice(0, 10))
    setOpen(false)
    setSaving(false)
    onAdded()
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          Aggiungi valore
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="bg-card border border-border rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Nuovo valore di mercato</p>
      <div className="flex gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="€ 0,00"
          required
          className="h-8 text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 px-2.5 rounded-lg border border-input bg-transparent text-sm focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opzionale)"
        className="h-8 text-sm"
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annulla</Button>
        <Button type="submit" size="sm" disabled={saving || !value}>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salva
        </Button>
      </div>
    </form>
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
  const [outEquipmentIds, setOutEquipmentIds] = useState(new Set())
  const [availabilityFilter, setAvailabilityFilter] = useState('all') // 'all' | 'free' | 'in_use'
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [sortField, setSortField] = useState('name') // 'name' | 'market_value' | 'last_checked_at' | 'purchase_date' | 'category'
  const [sortDir, setSortDir] = useState('asc')
  const [addToSetModal, setAddToSetModal] = useState(false)
  const [setsList, setSetsList] = useState([])
  const [targetSetId, setTargetSetId] = useState('')
  const [addingToSet, setAddingToSet] = useState(false)

  const fetchEquipment = useCallback(async () => {
    setSelectedIds(new Set())
    const supabase = getSupabase()
    let q = supabase.from('equipment').select('*').order('created_at', { ascending: false })
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter)
    if (conditionFilter !== 'all') q = q.eq('condition', conditionFilter)
    if (locationFilter !== 'all') q = q.eq('location', locationFilter)
    if (search) q = q.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`)
    const [{ data }, { data: outItems }] = await Promise.all([
      q,
      supabase.from('set_items').select('equipment_id').eq('status', 'out'),
    ])
    setEquipment(data || [])
    setOutEquipmentIds(new Set((outItems || []).map((r) => r.equipment_id)))
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

  const BATTERY_CYCLE = { charged: 'low', low: 'charging', charging: 'na', na: 'charged' }

  async function handleBatteryCycle(item, e) {
    e.stopPropagation()
    const next = BATTERY_CYCLE[item.battery_status] || 'charged'
    const supabase = getSupabase()
    await supabase.from('equipment').update({ battery_status: next }).eq('id', item.id)
    setEquipment((prev) => prev.map((eq) => eq.id === item.id ? { ...eq, battery_status: next } : eq))
    toast.success(`Batteria: ${BATTERY_LABEL[next]}`)
  }

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

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === displayEquipment.length
      ? new Set()
      : new Set(displayEquipment.map((e) => e.id))
    )
  }

  async function bulkMarkChecked() {
    setBulkLoading(true)
    const supabase = getSupabase()
    const now = new Date().toISOString()
    await supabase.from('equipment').update({ last_checked_at: now }).in('id', [...selectedIds])
    setEquipment((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, last_checked_at: now } : e))
    setRecentlyChecked((prev) => {
      const next = { ...prev }
      selectedIds.forEach((id) => { next[id] = true })
      return next
    })
    const count = selectedIds.size
    setSelectedIds(new Set())
    setBulkLoading(false)
    toast.success(`${count} item segnati come controllati`)
  }

  async function bulkUpdateField(field, value) {
    setBulkLoading(true)
    const supabase = getSupabase()
    await supabase.from('equipment').update({ [field]: value }).in('id', [...selectedIds])
    setEquipment((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, [field]: value } : e))
    const count = selectedIds.size
    setSelectedIds(new Set())
    setBulkLoading(false)
    toast.success(`${count} item aggiornati`)
  }

  function bulkExport() {
    const selected = equipment.filter((e) => selectedIds.has(e.id))
    exportCSV(selected)
    toast.success(`${selected.length} item esportati`)
  }

  async function openAddToSet() {
    const supabase = getSupabase()
    const { data } = await supabase.from('sets').select('id, name, status, job_date')
      .in('status', ['planned', 'out']).order('job_date', { ascending: true, nullsFirst: false })
    setSetsList(data || [])
    setTargetSetId('')
    setAddToSetModal(true)
  }

  async function bulkAddToSet() {
    if (!targetSetId) return
    setAddingToSet(true)
    const supabase = getSupabase()
    const rows = [...selectedIds].map((eid) => ({ set_id: targetSetId, equipment_id: eid, status: 'planned' }))
    const { error } = await supabase.from('set_items').upsert(rows, { onConflict: 'set_id,equipment_id', ignoreDuplicates: true })
    setAddingToSet(false)
    setAddToSetModal(false)
    if (error) { toast.error('Errore durante l\'assegnazione'); return }
    const setName = setsList.find((s) => s.id === targetSetId)?.name || 'set'
    toast.success(`${selectedIds.size} item aggiunti a "${setName}"`)
    setSelectedIds(new Set())
  }

  const maintenanceCount = equipment.filter(needsMaintenance).length

  const filteredEquipment = availabilityFilter === 'free'
    ? equipment.filter((e) => !outEquipmentIds.has(e.id))
    : availabilityFilter === 'in_use'
    ? equipment.filter((e) => outEquipmentIds.has(e.id))
    : equipment

  const displayEquipment = [...filteredEquipment].sort((a, b) => {
    let av, bv
    if (sortField === 'name') { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase() }
    else if (sortField === 'brand') { av = ([a.brand, a.model].filter(Boolean).join(' ') || '').toLowerCase(); bv = ([b.brand, b.model].filter(Boolean).join(' ') || '').toLowerCase() }
    else if (sortField === 'market_value') { av = parseFloat(a.market_value) || 0; bv = parseFloat(b.market_value) || 0 }
    else if (sortField === 'last_checked_at') { av = a.last_checked_at ? new Date(a.last_checked_at).getTime() : 0; bv = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0 }
    else if (sortField === 'category') { av = (CATEGORY_LABELS[a.category] || a.category || '').toLowerCase(); bv = (CATEGORY_LABELS[b.category] || b.category || '').toLowerCase() }
    else { av = ''; bv = '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Inventario</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-muted-foreground text-sm">
              {displayEquipment.length}{displayEquipment.length !== equipment.length ? ` / ${equipment.length}` : ''} attrezzature
            </p>
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
        <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
          <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Disponibilità: tutti</SelectItem>
            <SelectItem value="free">Solo disponibili</SelectItem>
            <SelectItem value="in_use">Solo in uso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-primary flex-shrink-0">{selectedIds.size} selezionati</span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkLoading} onClick={bulkMarkChecked}>
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Segna controllati
            </Button>
            <Select onValueChange={(v) => bulkUpdateField('location', v)}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs" disabled={bulkLoading}>
                <SelectValue placeholder="Location…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="campo">Campo</SelectItem>
                <SelectItem value="prestito">Prestito</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdateField('condition', v)}>
              <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs" disabled={bulkLoading}>
                <SelectValue placeholder="Condizione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Attivo</SelectItem>
                <SelectItem value="repair">In riparazione</SelectItem>
                <SelectItem value="retired">Ritirato</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdateField('battery_status', v)}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs" disabled={bulkLoading}>
                <SelectValue placeholder="Batteria…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="charged">Carica</SelectItem>
                <SelectItem value="charging">In carica</SelectItem>
                <SelectItem value="low">Scarica</SelectItem>
                <SelectItem value="na">N/D</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkLoading} onClick={bulkExport}>
              <Download className="w-3 h-3" />
              Esporta
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkLoading} onClick={openAddToSet}>
              <Briefcase className="w-3 h-3" />
              Aggiungi a Set
            </Button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded text-muted-foreground hover:text-foreground transition flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayEquipment.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessuna attrezzatura trovata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition">
                      {selectedIds.size > 0 && selectedIds.size === displayEquipment.length
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <SortHeader label="Nome" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    <SortHeader label="Marca / Modello" field="brand" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Seriale</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Location</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Batteria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    <SortHeader label="Val. Mercato" field="market_value" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <SortHeader label="Stato" field="category" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="center" />
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayEquipment.map((item) => {
                  const BattIcon = BATTERY_ICON[item.battery_status] || Minus
                  const maintenance = needsMaintenance(item)
                  const justChecked = recentlyChecked[item.id]
                  const isOut = outEquipmentIds.has(item.id)

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/30 transition cursor-pointer ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => setDetailItem(item)}
                    >
                      <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}>
                        <button className="text-muted-foreground hover:text-foreground transition">
                          {selectedIds.has(item.id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground leading-none">{item.name}</span>
                          {isOut && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 flex-shrink-0">
                              In uso
                            </span>
                          )}
                        </div>
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
                      <td className="px-4 py-3 hidden xl:table-cell text-center" onClick={(e) => { e.stopPropagation(); handleBatteryCycle(item, e) }}>
                        <button
                          title={`Batteria: ${BATTERY_LABEL[item.battery_status]} — clicca per cambiare`}
                          className="p-1 rounded hover:bg-muted transition mx-auto block"
                        >
                          <BattIcon className={`w-4 h-4 ${BATTERY_COLOR[item.battery_status] || 'text-muted-foreground'}`} />
                        </button>
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

      {/* Add to Set Modal */}
      <Dialog open={addToSetModal} onOpenChange={(o) => { if (!o) setAddToSetModal(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aggiungi a Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} item selezionati verranno aggiunti al set scelto.
            </p>
            {setsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun set attivo disponibile</p>
            ) : (
              <Select value={targetSetId} onValueChange={setTargetSetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un set…" />
                </SelectTrigger>
                <SelectContent>
                  {setsList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.name}</span>
                      {s.job_date && <span className="text-muted-foreground ml-2 text-xs">{new Date(s.job_date).toLocaleDateString('it-IT')}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddToSetModal(false)}>Annulla</Button>
            <Button onClick={bulkAddToSet} disabled={!targetSetId || addingToSet}>
              {addingToSet && <Loader2 className="w-4 h-4 animate-spin" />}
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

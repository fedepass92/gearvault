'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { exportInsuranceReport } from '@/lib/pdf'
import { FileDown, Filter, Loader2, Download, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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

const CONDITION_BADGE = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  repair: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  retired: 'bg-muted text-muted-foreground border-border',
}
const CONDITION_LABEL = { active: 'Attivo', repair: 'Riparazione', retired: 'Ritirato' }

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

function fmtEur(v) {
  if (v == null || v === '' || isNaN(parseFloat(v))) return '—'
  return `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
}

function exportCSV(equipment, categoryFilter) {
  const items = categoryFilter !== 'all' ? equipment.filter((e) => e.category === categoryFilter) : equipment
  const headers = ['Nome', 'Marca', 'Modello', 'Seriale', 'Categoria', 'Data Acquisto', 'Valore Acquisto (€)', 'Valore Mercato (€)', 'Valore Assicurato (€)', 'Condizione']
  const rows = items.map((e) => [
    e.name || '', e.brand || '', e.model || '', e.serial_number || '',
    CATEGORY_LABELS[e.category] || e.category || '',
    e.purchase_date ? format(new Date(e.purchase_date), 'dd/MM/yyyy') : '',
    e.purchase_price != null ? parseFloat(e.purchase_price).toFixed(2) : '',
    e.market_value != null ? parseFloat(e.market_value).toFixed(2) : '',
    e.insured_value != null ? parseFloat(e.insured_value).toFixed(2) : '',
    CONDITION_LABEL[e.condition] || e.condition || '',
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `BrainDigital_Report_${format(new Date(), 'yyyyMMdd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportPage() {
  const [equipment, setEquipment] = useState([])
  const [allEquipment, setAllEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('active')
  const [exportLoading, setExportLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

  const fetchEquipment = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase.from('equipment').select('*').order('name')
    setAllEquipment(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEquipment() }, [fetchEquipment])

  useEffect(() => {
    let filtered = allEquipment
    if (conditionFilter !== 'all') filtered = filtered.filter((e) => e.condition === conditionFilter)
    if (categoryFilter !== 'all') filtered = filtered.filter((e) => e.category === categoryFilter)
    setEquipment(filtered)
  }, [allEquipment, categoryFilter, conditionFilter])

  async function handleExport() {
    setExportLoading(true)
    try {
      await exportInsuranceReport(equipment, categoryFilter !== 'all' ? categoryFilter : null)
    } finally {
      setExportLoading(false)
    }
  }

  const totalPurchase = equipment.reduce((s, e) => s + (parseFloat(e.purchase_price) || 0), 0)
  const totalMarket = equipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)
  const totalInsured = equipment.reduce((s, e) => s + (parseFloat(e.insured_value) || 0), 0)

  const underinsured = equipment.filter((e) => {
    const market = parseFloat(e.market_value) || 0
    const insured = parseFloat(e.insured_value) || 0
    return market > 0 && insured < market
  }).sort((a, b) => {
    const gapA = (parseFloat(a.market_value) || 0) - (parseFloat(a.insured_value) || 0)
    const gapB = (parseFloat(b.market_value) || 0) - (parseFloat(b.insured_value) || 0)
    return gapB - gapA
  })

  const coverageGap = totalMarket - totalInsured

  const categoryValues = Object.entries(
    equipment.reduce((acc, e) => {
      const cat = CATEGORY_LABELS[e.category] || e.category || 'Altro'
      if (!acc[cat]) acc[cat] = { market: 0, insured: 0 }
      acc[cat].market += parseFloat(e.market_value) || 0
      acc[cat].insured += parseFloat(e.insured_value) || 0
      return acc
    }, {})
  ).sort((a, b) => b[1].market - a[1].market)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Report Assicurativo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Elenco attrezzature Brain Digital</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(equipment, categoryFilter)} disabled={equipment.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={handleExport} disabled={exportLoading || equipment.length === 0}>
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Esporta PDF
            </Button>
          )}
        </div>
      </div>

      {/* Condition + category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-auto min-w-[150px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le condizioni</SelectItem>
            <SelectItem value="active">Solo attivi</SelectItem>
            <SelectItem value="repair">In riparazione</SelectItem>
            <SelectItem value="retired">Ritirati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[170px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(conditionFilter !== 'active' || categoryFilter !== 'all') && (
          <button
            onClick={() => { setConditionFilter('active'); setCategoryFilter('all') }}
            className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted flex items-center gap-1"
          >
            <Filter className="w-3 h-3" />
            Reset filtri
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{equipment.length} item</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Totale item', value: equipment.length, mono: false },
          { label: 'Valore acquisto', value: `€ ${totalPurchase.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` },
          { label: 'Valore di mercato', value: `€ ${totalMarket.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` },
          { label: 'Valore assicurato', value: `€ ${totalInsured.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, accent: true },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
            <div className={`text-xl font-bold ${card.accent ? 'text-primary' : 'text-foreground'}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Coverage analysis */}
      {!loading && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Per-category value breakdown */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold mb-4">Valore per categoria</h2>
            <div className="space-y-3">
              {categoryValues.map(([cat, vals]) => {
                const pctInsured = vals.market > 0 ? Math.min(100, (vals.insured / vals.market) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{cat}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtEur(vals.insured)} / {fmtEur(vals.market)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden relative">
                      <div className="h-full bg-muted-foreground/30 rounded-full w-full absolute" />
                      <div
                        className={`h-full rounded-full transition-all ${pctInsured >= 100 ? 'bg-emerald-400' : pctInsured >= 70 ? 'bg-primary' : 'bg-amber-400'}`}
                        style={{ width: `${pctInsured}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coverage gap */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              {coverageGap > 0
                ? <ShieldAlert className="w-4 h-4 text-amber-400" />
                : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              <h2 className="text-sm font-semibold">Copertura assicurativa</h2>
            </div>
            {coverageGap > 0 ? (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-4">
                  <p className="text-sm font-semibold text-amber-300">Gap di copertura: {fmtEur(coverageGap)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Math.round((totalInsured / totalMarket) * 100)}% del valore di mercato è assicurato
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Item sottoassicurati ({underinsured.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {underinsured.slice(0, 8).map((e) => {
                    const gap = (parseFloat(e.market_value) || 0) - (parseFloat(e.insured_value) || 0)
                    return (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate flex-1 mr-2">{e.name}</span>
                        <span className="text-amber-400 flex-shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {fmtEur(gap)}
                        </span>
                      </div>
                    )
                  })}
                  {underinsured.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center">+ altri {underinsured.length - 8}…</p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-emerald-300">Copertura completa</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tutti gli item sono assicurati per il valore di mercato o superiore.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Nome', 'Marca', 'Modello', 'Seriale', 'Data Acquisto', 'Val. Acquisto', 'Val. Mercato', 'Val. Assicurato', 'Condizione'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {equipment.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/scan/${item.id}`} className="hover:text-primary transition">{item.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.brand || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.model || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.serial_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {item.purchase_date ? format(new Date(item.purchase_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtEur(item.purchase_price)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtEur(item.market_value)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-primary font-medium">{fmtEur(item.insured_value)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs border ${CONDITION_BADGE[item.condition] || 'bg-muted text-muted-foreground'}`}>
                        {CONDITION_LABEL[item.condition] || item.condition}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {equipment.length > 0 && (
                  <tr className="bg-muted/30 font-semibold border-t border-border">
                    <td colSpan={5} className="px-4 py-3 text-sm text-muted-foreground">Totale ({equipment.length} item)</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtEur(totalPurchase)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs">{fmtEur(totalMarket)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-primary font-semibold">{fmtEur(totalInsured)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            {equipment.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Nessuna attrezzatura trovata</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

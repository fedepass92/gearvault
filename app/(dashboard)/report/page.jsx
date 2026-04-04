'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { exportInsuranceReport } from '@/lib/pdf'
import { FileDown, Filter, Loader2, Download } from 'lucide-react'
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
    setEquipment(categoryFilter !== 'all' ? allEquipment.filter((e) => e.category === categoryFilter) : allEquipment)
  }, [allEquipment, categoryFilter])

  async function handleExport() {
    setExportLoading(true)
    try {
      await exportInsuranceReport(allEquipment, categoryFilter !== 'all' ? categoryFilter : null)
    } finally {
      setExportLoading(false)
    }
  }

  const totalPurchase = equipment.reduce((s, e) => s + (parseFloat(e.purchase_price) || 0), 0)
  const totalMarket = equipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)
  const totalInsured = equipment.reduce((s, e) => s + (parseFloat(e.insured_value) || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Report Assicurativo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Elenco attrezzature Brain Digital</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(allEquipment, categoryFilter)} disabled={equipment.length === 0}>
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

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[180px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {equipment.length} item{categoryFilter !== 'all' ? ` in ${CATEGORIES.find((c) => c.value === categoryFilter)?.label}` : ''}
        </span>
      </div>

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
                    <td className="px-4 py-3 font-medium">{item.name}</td>
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
